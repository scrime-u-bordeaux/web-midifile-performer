import { parseScore } from 'musicxml-interfaces'

const DEFAULT_TEMPO = 500000 // 500000 us/quarter note = 0.5 seconds/quarter note = 120 BPM if the beat is X/4

// Our underlying parsing library tasked with converting MusicXML to JSON always provides a dynamics value for notes.
// This means we cannot distinguish between notes that carry it or not to apply local override of dynamics from the notated value.
// Until this is fixed (an issue has been opened at https://github.com/jocelyn-stericker/musicxml-interfaces/issues/17),
// we will treat notes carrying this default value as exceptions to override.
const DEFAULT_PROVIDED_DYNAMICS = 90

// Because of this situation, for now, these two values are never returned directly.
const DEFAULT_ON_VELOCITY = 90 // TODO : should we use this value ?
// The default velocity is generally cited as 80 = mezzoforte,
// But the MusicXML standard cites this instead.
const DEFAULT_OFF_VELOCITY = 0

const DEFAULT_CHANNEL = 1 // MusicXML channels are 1-indexed
const DEFAULT_DELTA = 0

const BASE_MIDI_PITCH = 21
const STEPS_PER_OCTAVE = 12
const MICROSECONDS_PER_MINUTE = 60000000

const TIE_START = 0
const TIE_END = 1

const STACCATO_FLAG = 1
const STACCATISSIMO_FLAG = 2
const MARCATO_FLAG = 4
const ACCENT_FLAG = 8
const DURATION_MASK = 3
const VELOCITY_MASK = 12

const stepOffsets = new Map(
  [
    ["a", 0],
    ["b", 2],
    ["c", 3],
    ["d", 5],
    ["e", 7],
    ["f", 8],
    ["g", 10]
  ]
)

const velocityMap = new Map(
  [
    ["ppp", 16],
    ["pp", 33],
    ["p", 49],
    ["mp", 64],
    ["mf", 80],
    ["f", 96],
    ["ff", 112],
    ["fff", 127]
  ]
)

export default function parseMusicXml(buffer) {
  const xmlScore = parseScore(buffer) // Always returns a timewise score, even from a partwise file.
  const trackMap = new Map()

  let divisions = 0

  // We're always gonna list through measures, because the score is timewise.

  // Per MusicXML standards, each MusicXML part will become a MIDI track.
  // Aside from the track's final state as an array of events,
  // We also store metadata that is necessary for parsing, and discarded on return.

  xmlScore.partList.forEach(partOrGroup => {
    if(partOrGroup._class === "PartGroup") return;
    const part = partOrGroup

    // The part provides one or more score-instruments tags associated with midi-instruments giving a channel.
    // If there's only one instrument on the part, every note on the part has that channel.
    // Else, the sound tags will contain a midi-instrument + midi-channel tag to change it.
    // Thus we can keep track of channels in the track map, since one track/part only has one active channel at a time.

    const startingChannel =
      (!!part.midiInstruments &&
      part.midiInstruments.length === 1 && // if multiple instruments exist, the one to use will be defined in the measure.
      // ...otherwise I don't understand how this works.
      !!part.midiInstruments[0].midiChannel ?
        part.midiInstruments[0].midiChannel  :
        DEFAULT_CHANNEL) // Is this right ? What if the notes of multiple tracks collide ?
      - 1

    trackMap.set(
      part.id,
      {
        activeChannel: startingChannel,

        // For later identification of notes in the OSMD visualizer,
        // We need to keep track of each part's channel throughout the totality of the file.
        channelHistory: [getChannelChangePseudoEvent(startingChannel, DEFAULT_DELTA)],

        // Not all files will provide note-specific dynamics.
        // In fact, for "high-level" notation (distanced from MIDI),
        // only written values (like mf, f, p, etc), may be provided.
        // These written values are stored here.
        notatedDynamics: null,

        // A binary flag holder. From most to least significant bit :
        // Accent, marcato, staccatissimo, staccato
        // Used to carry that information through chords.
        articulationFlags: 0,

        // DT is accumulated per part/track, with backup tags the only way of rewinding it.
        // We convert to relative at the end.
        // This is awkward as we convert back to absolute in the MFP,
        // But otherwise processing is a nightmare.
        currentDelta: DEFAULT_DELTA,

        // Unfortunately, a single accumulator is not enough :
        // Because of how the musicXML sync system works, we need to rewind the accumulator by one step
        // when dealing with notes in a chord.
        lastIncrement: 0,

        // Some files may not provide a default tempo event.
        // The MFP.js parser assumes the default tempo anyway,
        // But just to be safe, we provide an event for it to start.
        events: [getDefaultTempoEvent()]
      }
    )
  })

  // Some files may use backups and rests in such a way
  // That the last stated events of a measure are not at the end of it.
  // (For instance : the measure has two voices, the first voice goes to the end,
  // then a backup and the second voice isn't filled to the end with rests)
  // In such cases, we need to enforce measure boundaries nonetheless
  // (relying on the fact that backups SHOULD NOT cross measure bounds)
  // Since measures are cross-part entities,
  // This can be stored in a single place.
  let measureEnd = 0

  xmlScore.measures.forEach(measure => {

    for(const partID in measure.parts) {
      const partTrack = trackMap.get(partID)
      const partObject = measure.parts[partID]

      for(const eventIndex in partObject) {
        const event = partObject[eventIndex]

        switch(event._class) {

          // -------------------------------------------------------------------
          // -------------------------CONFIG TAGS-------------------------------
          // -------------------------------------------------------------------

          // Attribute tags can carry the division.
          // If so, it is found in the first measure. Every part restates it, but it's of no consequence.
          // Sound events may change divisions along the way, but supposedly, this is only after codas.
          // For now, we won't worry about it.

          case "Attributes":

            if(!!event.divisions) divisions = event.divisions
            break

          case "Direction":
            // For some reasons, children of a directionType do not work on the _class system.
            if(!!event.directionTypes && event.directionTypes.some(direction => direction.hasOwnProperty("dynamics"))) {
              const dynamics = event.directionTypes.find(direction => direction.hasOwnProperty("dynamics")).dynamics
              const velocityKeys = Array.from(velocityMap.keys())
              const dynamicsValue = velocityMap.get(
                // We're going to assume a dynamics object can only contain one "normal" dynamic tag
                Object.keys(dynamics).find(key => velocityKeys.includes(key))
              )
              partTrack.notatedDynamics = dynamicsValue
            }
            // intentional fallthrough,
            // because sound tags can occur either directly at measure level or in a direction tag.
            // (I don't know why.)
          case "Sound":
            // A sound event can modify the tempo, the channel, or both.

            // Not all Direction tags contain a Sound tag, however.
            if(event._class === "Direction" && !event.sound) continue

            const soundEvent = event._class === "Sound" ? event : event.sound

            if(!!soundEvent.tempo) partTrack.events.push(getTempoEvent(soundEvent, partTrack.currentDelta))

            if(!!soundEvent.midiInstrument && !!soundEvent.midiInstrument.channel) {
              partTrack.activeChannel = soundEvent.midiInstrument.channel - 1
              partTrack.channelHistory.push(getChannelChangePseudoEvent(partTrack.activeChannel - 1, partTrack.currentDelta))
            }

            break

          // -------------------------------------------------------------------
          // --------------------------EVENT TAGS-------------------------------
          // -------------------------------------------------------------------

          // Backup elements simply rewind the accumulator.

          case "Backup":

            partTrack.currentDelta -= event.duration

            break

          // Forward elements do the opposite.

          case "Forward":

            partTrack.currentDelta += event.duration

            break

          // The main case.

          case "Note":

            if(!event.rest) { // Rests are not actual pitches, and thus need not be pushed.

              // Notes bearing a "ties" attribute are special.
              // They are notes "tied" beyond measure boundaries.
              // They begin on the first note of the tie and end on the last.
              // All tied notes in between only renew their prolongation.

              if(!!event.ties && event.ties.length === 1) { // In other words :
              // If there is more than one tie for a note, it simply prolongs the note further,
              // So it should not be pushed.

                if(event.ties[0].type === TIE_START)
                  partTrack.events.push(
                    getMidiNoteOnEvent(event, partTrack)
                  )

                else
                  partTrack.events.push(
                    getMidiNoteOffEvent(event, partTrack)
                  )

              } else if(!event.ties) {
                partTrack.events.push(
                  ...getMidiNoteEventPair(event, partTrack)
                )
              }
            }

            // Notes bearing a "chord" attribute are synced to the previous pitch that did not bear one.
            // As such, their duration is irrelevant for the accumulator.

            if(!event.chord) { // We want this to happen to rests as well.
              partTrack.currentDelta += event.duration
              partTrack.lastIncrement = event.duration
              if(partTrack.currentDelta > measureEnd) measureEnd = partTrack.currentDelta
            }

            break
        }
      }

      // Ensure measures do not encroach on each other,
      // Even if backups end up in the middle of one.
      if(partTrack.currentDelta < measureEnd) partTrack.currentDelta = measureEnd
    }
  })

  // TODO : this isn't very semantically relevant, but it's the best place in the code flow to do so :
  // The OSMD visualizer is going to require a list of ABSOLUTE DELTA events,
  // And this point is the only place in the entire program where we have absolute delta events at our disposal.

  // First, we need a list of all tempo changes.
  // These will be used to convert the OSMD cursor's timestamps,
  // From fractions of whole notes to actual seconds.

  const tempoEvents = Array.from(trackMap.values())
  .flatMap(
    track => track.events.filter(event => !!event.setTempo)
  ).map(
    // OSMD uses a fraction of whole notes, so we divide by 4 after getting the amount in quarters
    event => {
      return { delta: event.delta / (4 * divisions), setTempo: event.setTempo }
    }
  ).sort(
    (eventA, eventB) => eventA.delta - eventB.delta
  )

  // Second, we need the list of all channel changes on every part.
  // This is because OSMD notes keep track of their part (as the parent of their voice),
  // But not of channels (because it's only concerned with instruments).

  // (we could just use mapValues in Kotlin...)

  const channelChanges = new Map()

  Array.from(trackMap.keys()).forEach(key => {
    const channelHistory = trackMap.get(key).channelHistory
    channelChanges.set(key, channelHistory.map(channelChange => {
      return {
        channel: channelChange.channel,
        delta: channelChange.delta / (4 * divisions)
      }
    }))
  })

  // Worse yet : we can't emit from there, because this isn't a class
  // (and it has no reason to be ! This isn't a sufficient reason to change that)
  // So instead, we pass this data along in the midiJson, for transmission by MFP.js.

  const midiJson = {
    division: divisions,
    format: 1,
    tracks: Array.from(trackMap.values()).map(track => convertToRelative(track.events)),
    tempoEvents: tempoEvents,
    channelChanges: channelChanges
  }

  return midiJson
}

function convertToRelative(trackEvents) {
  trackEvents.sort((eventA, eventB) => eventA.delta - eventB.delta)

  let refDelta = 0
  trackEvents.forEach((event, index) => {
    if(index === 0) event.delta = 0
    else {
      const absDelta = event.delta
      event.delta = event.delta - refDelta
      if(absDelta != refDelta) refDelta = absDelta
    }
  })
  return trackEvents
}

function getMidiNoteEventPair(xmlNote, partTrack) {
  return [
    getMidiNoteOnEvent(xmlNote, partTrack),
    getMidiNoteOffEvent(xmlNote, partTrack)
  ]
}

function getMidiNoteOnEvent(xmlNote, partTrack) {
  manageNoteArticulations(xmlNote, partTrack)

  const noteNumber = getMidiNoteNumber(xmlNote)
  return {
    delta: getNoteStartTime(xmlNote, partTrack),
    channel : partTrack.activeChannel,
    noteOn: {
      velocity: getMidiVelocity(xmlNote, partTrack),
      noteNumber: noteNumber
    }
  }
}

function getMidiNoteOffEvent(xmlNote, partTrack) {
  manageNoteArticulations(xmlNote, partTrack)

  const noteNumber = getMidiNoteNumber(xmlNote)
  return {
    delta: getNoteStartTime(xmlNote, partTrack) + getTrueNoteDuration(xmlNote, partTrack),
    channel : partTrack.activeChannel,
    noteOff: {
      velocity: getMidiVelocity(xmlNote),
      noteNumber: noteNumber
    }
  }
}

function getNoteStartTime(xmlNote, partTrack) {
  return xmlNote.chord ? partTrack.currentDelta - partTrack.lastIncrement : partTrack.currentDelta
}

function manageNoteArticulations(xmlNote, partTrack) {
  if(!xmlNote.chord) {
    partTrack.articulationFlags = 0

    const articulations = xmlNote.notations?.find(notation => !!notation.articulations)?.articulations

    if(!articulations) return

    if(!!articulations.find(articulation => !!articulation.staccato))
      partTrack.articulationFlags |= STACCATO_FLAG
    else if(!!articulations.find(articulation => !!articulation.staccatissimo))
      partTrack.articulationFlags |= STACCATISSIMO_FLAG

    if(!!articulations.find(articulation => !!articulation.accent))
      partTrack.articulationFlags |= ACCENT_FLAG
    else if(!!articulations.find(articulation => !!articulation.strongAccent))
      partTrack.articulationFlags |= MARCATO_FLAG
  }
}

function getTrueNoteDuration(xmlNote, partTrack) {
  // Divide by 2 (1 << 1) for staccato, by 4 (2 << 1) for staccatissimo.
  const divisor = (partTrack.articulationFlags & DURATION_MASK) << 1
  return divisor > 0 ? xmlNote.duration / divisor : xmlNote.duration
}

// Velocity is defined by the dynamics (for the note on) and end-dynamics (for the note off)
// attributes of note tags.
// When these are not present, dynamics tags are used instead,
// Whose values are stored in the track metadata.

function getMidiVelocity(xmlNote, partTrack = null) {

  const on = !!partTrack // This argument is only given for note ons, so a local alias makes more sense.

  const relevantDynamics = on ? xmlNote.dynamics : xmlNote.endDynamics
  const relevantDefault = on ? DEFAULT_ON_VELOCITY : DEFAULT_OFF_VELOCITY

  // Multiply by 1.25 (1 + (1 / (8 >> 1))) for a normal accent, by 1.5 (1 + (1 / (4 >> 1))) for a marcato.
  const divisor = ((partTrack?.articulationFlags & VELOCITY_MASK) >> 1)
  const multiplicator = 1 + (divisor ? 1 / divisor : 0)

  // Because of how our parsing lib currently works, there is always a dynamics and endDynamics field on notes.
  // So instead of testing for its existence, we test for a default.
  // Also, note that notatedDynamics can never be 0, so !! works fine here.
  if(!!partTrack?.notatedDynamics && relevantDynamics === DEFAULT_PROVIDED_DYNAMICS)
    return multiplicator * partTrack.notatedDynamics

  // If the note's own dynamics is not set to the default value,
  // It overrides the staff notation.

  // Notice that dynamics are expressed as a percentage of velocity 90.
  // For example, dynamics = 71 means 0.71 * 90 ~= 64.

  return multiplicator * Math.round((relevantDynamics / 100) * relevantDefault)
}

function getMidiNoteNumber(xmlNote) {
  const { step, octave, alter } = xmlNote.pitch
  const stepOffset = stepOffsets.get(step)
  const realOctave = step === "a" || step === "b" ? octave : octave - 1
  const definedAlter = !!alter ? alter : 0

  return (BASE_MIDI_PITCH + stepOffset) + (STEPS_PER_OCTAVE * realOctave) + definedAlter
}

function getTempoEvent(xmlSound, currentDelta) {
  return {
    delta: currentDelta,
    setTempo : {
      // MusicXML tempo is defined in quarter notes per minute,
      // We want it in microseconds per quarter note.
      microsecondsPerQuarter: MICROSECONDS_PER_MINUTE / parseInt(xmlSound.tempo, 10)
    }
  }
}

function getDefaultTempoEvent() {
  return {
    delta: DEFAULT_DELTA,
    setTempo: {
      microsecondsPerQuarter: DEFAULT_TEMPO
    }
  }
}

function getChannelChangePseudoEvent(channel, delta) {
  return {
    channel: channel,
    delta: delta
  }
}
