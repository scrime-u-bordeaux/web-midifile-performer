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

const DEFAULT_GRACE_DURATION_DOTTED = 1 / 3
const DEFAULT_GRACE_DURATION_NORMAL = 1 / 2

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

// DISCLAIMER : many tempo values are ranges, these ranges often overlap, and sources contradict each other on their bounds.
// I'm doing my best as a non-musician to create a scale that makes sense :
// J.H. will probably be able to calibrate it better.

const tempoMap = new Map(
  [
    ["Larghissimo", 20],
    ["Grave", 35],
    ["Lento", 40],
    ["Largo", 50],
    ["Larghetto", 60],
    ["Adagio", 70],
    ["Adagietto", 75],
    ["Andante", 80],
    ["Tranquillo", 80],
    ["Andantino", 85],
    ["Andante moderato", 95],
    ["Moderato", 110],
    ["Allegretto", 115],
    ["Allegro moderato", 120],
    ["Allegro", 140],
    ["Molto Allegro", 155],
    ["Allegro vivace", 155],
    ["Vivace", 170],
    ["Vivacissimo", 175],
    ["Allegrissimo", 175],
    ["Presto", 190],
    ["Prestissimo", 210]
  ]
)

// Before starting, define sub-functions relating to backup manipulation through delta warping.
// TODO : make partTrack a JS class instead. These will be methods.

function prepareDeltaWarp(partTrack) {
  partTrack.deltaWarpExit = partTrack.currentDelta
  // console.log("Preparing delta warp by registering exit", partTrack.deltaWarpExit)
}

function registerDeltaWarp(partTrack) {
  partTrack.deltaWarps.set(partTrack.currentDelta, partTrack.deltaWarpExit)
  // console.log("Registering delta warp from", partTrack.currentDelta, "to", partTrack.deltaWarpExit)
  partTrack.deltaWarpExit = null
}

function executeDeltaWarp(partTrack) {
  if(partTrack.deltaWarps.has(partTrack.currentDelta)) {
    const origDelta = partTrack.currentDelta
    partTrack.currentDelta = partTrack.deltaWarps.get(partTrack.currentDelta)
    // console.log("Executing registered delta warp from", origDelta, "to", partTrack.currentDelta)
    partTrack.warpCompensationValue = origDelta - partTrack.currentDelta
    // console.log("Registering compensation value of", partTrack.warpCompensationValue)
  }
}

function getWarpCompensationValue(partTrack, reset = true) {
  const returnedValue = partTrack.warpCompensationValue

  if(requiresWarpCompensation(partTrack)) {
    if(reset) partTrack.warpCompensationValue = 0
    // console.log("Returning non-zero warp compensation value", returnedValue)
  }

  return returnedValue
}

function requiresWarpCompensation(partTrack) {
  return partTrack.warpCompensationValue !== 0
}

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
        notatedDynamics: [],

        transpose: 0,

        // DT is accumulated per part/track, with backup tags the only way of rewinding it.
        // We convert to relative at the end.
        // This is awkward as we convert back to absolute in the MFP,
        // But otherwise processing is a nightmare.
        currentDelta: DEFAULT_DELTA,

        // Unfortunately, a single accumulator is not enough :
        // Because of how the musicXML sync system works, we need to rewind the accumulator by one step
        // when dealing with notes in a chord.
        lastIncrement: 0,

        // A binary flag holder. From most to least significant bit :
        // Accent, marcato, staccatissimo, staccato
        // Used to carry that information through chords.
        articulationFlags: 0,

        // Testing for inclusion in this will prevent analyzing the same grace notes multiple times.
        lastAnalyzedGraceNoteSequence: null,
        // Ditto for arpeggiated chords.
        lastArpeggiatedChord: null,

        // Some edge cases, such as arpeggiated chords, require altering backups.
        // The delta warp mechanism aids with this.
        deltaWarpExit: null,
        deltaWarps: new Map(),
        warpCompensationValue: 0,

        // Some files may not provide a default tempo event.
        // The MFP.js parser assumes the default tempo anyway,
        // But just to be safe, we provide an event for it to start.
        events: [getDefaultTempoEvent()],

        // This is a very heavy, but convenient solution to find the preceding note-off of a grace note.
        // Sadly, it will just take up space for nothing in most cases.
        xmlNotesToOffEvents: new Map(),

        // Conversely, these two hacks are necessary to bypass OSMD's inability to position its cursor over grace notes.
        // By using it, we can know at which deltas grace notes are encountered...
        noteOnEventsToXmlNotes: new Map(),
        // ... and where their principals are
        xmlNotesToNoteOnEvents: new Map()
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

  // console.log("Begin MusicXML parsing")

  xmlScore.measures.forEach((measure, index) => {

    // console.log(`Measure ${index}`)

    for(const partID in measure.parts) {
      const partTrack = trackMap.get(partID)

      const partArray = measure.parts[partID]

      // console.log(`Part ${partID} :`, partArray)

      partArray.forEach((event, index) => {

        // console.log("Parsing", event)
        // console.log("Delta before parsing :", partTrack.currentDelta)

        switch(event._class) {

          // -------------------------------------------------------------------
          // -------------------------CONFIG TAGS-------------------------------
          // -------------------------------------------------------------------

          // Attribute tags can carry the division.
          // If so, it is found in the first measure for every part.
          // However, *the specified divisions for every part may be different.*
          // TODO : handle this, converting them all to one single division value for the resulting MIDI

          case "Attributes":

            if(!!event.divisions) {
              divisions = event.divisions
              Array.from(trackMap.values()).forEach(partTrack => partTrack.divisions = divisions)
            }

            if(!!event.transposes) partTrack.transpose = parseInt(event.transposes[0].chromatic, 10)
            break

          case "Direction":
            // For some reasons, children of a directionType do not work on the _class system.
            if(!!event.directionTypes) {

              if(event.directionTypes.some(direction => direction.hasOwnProperty("dynamics"))) {
                const dynamics = event.directionTypes.find(direction => direction.hasOwnProperty("dynamics")).dynamics
                const velocityKeys = Array.from(velocityMap.keys())
                const dynamicsValue = velocityMap.get(
                  // We're going to assume a dynamics object can only contain one "normal" dynamic tag
                  Object.keys(dynamics).find(key => velocityKeys.includes(key))
                )
                // FIXME : No nullcheck ?
                partTrack.notatedDynamics.push({
                  delta: partTrack.currentDelta,
                  value: dynamicsValue
                })
              }

              if(event.directionTypes.some(direction => direction.hasOwnProperty("words"))) {
                // Again, I assume there's never going to be *more* than one direction string in a single direction object.
                const word = event.directionTypes.find(direction => direction.hasOwnProperty("words")).words[0].data
                const resultingTempo = tempoMap.get(word)
                if(!!resultingTempo)
                  partTrack.events.push(getTempoEvent({ tempo : resultingTempo }, partTrack.currentDelta))
              }
            }
            // intentional fallthrough,
            // because sound tags can occur either directly at measure level or in a direction tag.
            // (I don't know why.)
          case "Sound":
            // A sound event can modify the tempo, the channel, or both.

            // Not all Direction tags contain a Sound tag, however.
            if(event._class === "Direction" && !event.sound) return

            const soundEvent = event._class === "Sound" ? event : event.sound

            if(!!soundEvent.tempo) partTrack.events.push(getTempoEvent(soundEvent, partTrack.currentDelta))

            if(!!soundEvent.midiInstrument && !!soundEvent.midiInstrument.channel) {
              partTrack.activeChannel = soundEvent.midiInstrument.channel - 1
              partTrack.channelHistory.push(getChannelChangePseudoEvent(partTrack.activeChannel - 1, partTrack.currentDelta))
            }

            // TODO :  Sound events may also change divisions along the way, but supposedly, this is only after codas.
            // For now, we won't worry about it. It's less urgent than the multiple initial division problem.

            break

          // -------------------------------------------------------------------
          // --------------------------EVENT TAGS-------------------------------
          // -------------------------------------------------------------------

          // Backup elements simply rewind the accumulator.

          case "Backup":

            partTrack.currentDelta -= event.duration
            executeDeltaWarp(partTrack)

            break

          // Forward elements do the opposite.

          case "Forward":

            partTrack.currentDelta += event.duration
            executeDeltaWarp(partTrack)

            break

          // The main case.

          case "Note":

            if(!event.rest) { // Rests are not actual pitches, and thus need not be pushed.

              if(isArpeggiatedChordNote(event) && !partTrack.lastArpeggiatedChord?.includes(event)) {
                partTrack.lastArpeggiatedChord = markLastArpeggiatedChordNote(partArray, index)
                prepareDeltaWarp(partTrack)
              }

              if(event.grace && !partTrack.lastAnalyzedGraceNoteSequence?.includes(event)) {
                const graceNoteData = gatherGraceNoteData(partArray, index)
                partTrack.lastAnalyzedGraceNoteSequence = graceNoteData.graceNoteSequence
                resolveGraceNoteDurations(partTrack, graceNoteData)
              }

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

              } else if(!event.ties)
                  partTrack.events.push(
                    ...getMidiNoteEventPair(event, partTrack)
                  )
            }

            // Notes bearing a "chord" attribute are synced to the previous pitch that did not bear one.
            // As such, their duration is irrelevant for the accumulator.

            if(!event.chord || isArpeggiatedChordNote(event)) { // We want this to happen to rests as well.
              if(event.lastArpeggiatedChordNoteFlag) registerDeltaWarp(partTrack)

              partTrack.currentDelta +=
                isArpeggiatedChordNote(event) ?
                getTrueNoteDuration(event, partTrack) : event.duration + getWarpCompensationValue(partTrack)
              partTrack.lastIncrement = event.duration

              if(partTrack.currentDelta > measureEnd) measureEnd = partTrack.currentDelta
            }

            break
        }

        // console.log("Delta after parsing :", partTrack.currentDelta)
      })

      // Ensure measures do not encroach on each other,
      // Even if backups end up in the middle of one.
      if(partTrack.currentDelta < measureEnd) {
        // console.log("Delta over measure, correcting to", measureEnd)
        partTrack.currentDelta = measureEnd
      }
    }
  })

  // This isn't very semantically relevant, but it's the best place in the code flow to do so :
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

  // Third (and this is only due to an OSMD limitation), we need to identify every grace note in the score.
  // This is so they can be dealt with properly when assigning cursor positions and notehead equivalents.

  // To do this, we first need to merge the relevant maps for all tracks.

  const mergedOnToXml = new Map(
    Array.from(trackMap.values()).flatMap(
      partTrack => Array.from(partTrack.noteOnEventsToXmlNotes.entries())
    )
  )

  const mergedXmlToOn = new Map(
    Array.from(trackMap.values()).flatMap(
      partTrack => Array.from(partTrack.xmlNotesToNoteOnEvents.entries())
    )
  )

  // We can then get all note ons, the same way they're gathered in the noteSequence.
  // IMPORTANT : the in-set order might still vary.
  // But what really matters is that the indexes we're getting will point to the right set.

  const allNoteOns = Array.from(trackMap.values()).flatMap(partTrack =>
    partTrack.events.filter(
      event => !!event.noteOn
    )
  ).sort(
    (noteA, noteB) => {
      if(noteA.delta !== noteB.delta)
        return noteA.delta - noteB.delta

      // Ensure strict order even within to-be sets,
      // So the indices conform to those of the eventual note sequence,
      // Which uses the same disambiguation.

      else return noteA.noteOn.noteNumber - noteB.noteOn.noteNumber
    }
  )

  // So, finally, we can get the noteSequence-compatible index of every grace note,
  // And its principal.

  const graceNoteInfo = allNoteOns.map(
    (note, index) => {
      if(!mergedOnToXml.get(note).grace) return null

      const principalIndex = allNoteOns.indexOf(
          mergedXmlToOn.get(
            mergedOnToXml.get(note).principal
          )
      )

      return {
        graceIndex: index,
        principalIndex: principalIndex
      }
    }
  ).filter(
    note => !!note
  )

  // Worse yet : we can't emit from there, because this isn't a class
  // (and it has no reason to be ! This isn't a sufficient reason to change that)
  // So instead, we pass this data along in the midiJson, for transmission by MFP.js.

  const midiJson = {
    division: divisions,
    format: 1,
    tracks: Array.from(trackMap.values()).map(track => convertToRelative(track.events)),
    tempoEvents: tempoEvents,
    channelChanges: channelChanges,
    graceNoteInfo: graceNoteInfo
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

  const startTime = getNoteStartTime(xmlNote, partTrack)

  const midiNoteOnEvent = {
    delta: startTime,
    channel : partTrack.activeChannel,
    noteOn: {
      velocity: getMidiVelocity(xmlNote, partTrack, startTime),
      noteNumber: getMidiNoteNumber(xmlNote, partTrack)
    }
  }

  partTrack.noteOnEventsToXmlNotes.set(midiNoteOnEvent, xmlNote)
  partTrack.xmlNotesToNoteOnEvents.set(xmlNote, midiNoteOnEvent)

  return midiNoteOnEvent
}

function getMidiNoteOffEvent(xmlNote, partTrack) {
  manageNoteArticulations(xmlNote, partTrack)

  const midiNoteOffEvent = {
    delta: getNoteStartTime(xmlNote, partTrack) + getTrueNoteDuration(xmlNote, partTrack),
    channel : partTrack.activeChannel,
    noteOff: {
      velocity: getMidiVelocity(xmlNote),
      noteNumber: getMidiNoteNumber(xmlNote, partTrack)
    }
  }

  partTrack.xmlNotesToOffEvents.set(xmlNote, {
    previousNoteOff: midiNoteOffEvent,
    start: getNoteStartTime(xmlNote, partTrack),
    duration: getTrueNoteDuration(xmlNote, partTrack)
  })

  return midiNoteOffEvent
}

function getNoteStartTime(xmlNote, partTrack) {
  return xmlNote.chord && !isArpeggiatedChordNote(xmlNote) ?
    partTrack.currentDelta - partTrack.lastIncrement : partTrack.currentDelta
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
  if(isArpeggiatedChordNote(xmlNote)
      &&
     !xmlNote.lastArpeggiatedChordNoteFlag
    )
    return partTrack.divisions / 16

  // Divide by 2 (1 << 1) for staccato, by 4 (2 << 1) for staccatissimo.
  const divisor = (partTrack.articulationFlags & DURATION_MASK) << 1
  return (divisor > 0 ? xmlNote.duration / divisor : xmlNote.duration) + getWarpCompensationValue(partTrack, false)
}

function markLastArpeggiatedChordNote(partArray, initialArpeggioIndex) {
  let i = initialArpeggioIndex
  const fullChord = [partArray[i]]

  for(; isArpeggiatedChordNote(partArray[i], true); i++) fullChord.push(partArray[i])

  partArray[i-1].lastArpeggiatedChordNoteFlag = true

  return fullChord
}

function gatherGraceNoteData(partArray, initialGraceNoteIndex) {
  const graceNoteSequence = [partArray[initialGraceNoteIndex]]

  let i = initialGraceNoteIndex + 1

  // There may be multiple grace notes in a row.
  // We will only deal with each sequence once, as the first note in it is encountered.
  for(; i < partArray.length && partArray[i].grace ; i++) graceNoteSequence.push(partArray[i])

  // There may not always be a following non-grace note in the measure.
  const followingXmlNote = !!partArray[i]?.grace ? null : partArray[i]

  let j = initialGraceNoteIndex - 1

  // There may also not be a preceding non-grace note in the measure.
  // Non-note events (harmony notations, directions...) may also precede the grace cluster.
  for(; j >= 0 && (partArray[j]._class !== "Note" || partArray[j].grace) ; j--) continue

  const previousXmlNote = partArray[j]

  return { graceNoteSequence, followingXmlNote, previousXmlNote }
}

// Grace notes have no built-in duration.
// This constructs one for them, so the parser logic can treat them just like other notes.

function resolveGraceNoteDurations(partTrack, { graceNoteSequence, followingXmlNote, previousXmlNote }) {

  // It is unclear what the make-time attribute does.
  // No example for it exists in the MusicXML standard, nor in the Lilypond or OSMD test suites.
  // OSMD devs seem not to know what to make of it either.
  // Hence, it is ignored for now.
  if(graceNoteSequence.some(graceNote => graceNote.grace.makeTime)) {
    console.warn('makeTime property of grace notes not yet supported by parser ; grace notes with make-time will be treated identically to other grace notes.')
  }

  // By default, a grace note precedes its principal.
  // However, even if a following non-grace note exists in the measure,
  // A grace note with steal-time-previous set relates to its preceding note.
  const principalNotes = graceNoteSequence.map(graceNote =>
    !!followingXmlNote && !graceNote.grace.stealTimePrevious ? followingXmlNote : previousXmlNote
  )

  // Store this information for OSMD...
  graceNoteSequence.forEach((graceNote, index) => {
    graceNote.principal = principalNotes[index]
  })

  const chordGraceNoteIndices = graceNoteSequence.map((graceNote, index) => {
    return graceNote.chord ? index : null
  }).filter(indexOrNull => indexOrNull !== null)

  const relatedToFollowing = principalNotes.filter(
    (pnote, index) => !chordGraceNoteIndices.includes(index) && pnote === followingXmlNote
  ).length

  const relatedToPrevious = principalNotes.filter(
    (pnote, index) => !chordGraceNoteIndices.includes(index) && pnote === previousXmlNote
  ).length

  const relevantDefaults = principalNotes.map(principalNote =>
    principalNote.dots ? DEFAULT_GRACE_DURATION_DOTTED : DEFAULT_GRACE_DURATION_NORMAL
  )

  const stealTimePrevious = graceNoteSequence.map(graceNote =>
    parseInt(graceNote.grace.stealTimePrevious, 10) / 100
  )
  const stealTimeFollowing = graceNoteSequence.map(graceNote =>
    parseInt(graceNote.grace.stealTimeFollowing, 10) / 100
  )

  // The index has to be used to mutate properly, because these are arrays of primitive values,
  // Hence forEach passes their entries by copy.

  function assignStealValue(amount, index, steal) {
    const relatedPrincipal = (steal === stealTimePrevious ? previousXmlNote : followingXmlNote)

    if(isNaN(amount)) steal[index] =
      principalNotes[index] === relatedPrincipal ?
      relevantDefaults[index] / (
        relatedPrincipal === previousXmlNote ? relatedToPrevious : relatedToFollowing
      ) : 0

    // Slashed grace notes, or acciaccature, are of very short duration.
    // Four times as short as appoggiature seems like a good rule of thumb.
    steal[index] *= graceNoteSequence[index].grace.slash ?
      0.25 : 1
  }

  stealTimePrevious.forEach(assignStealValue)
  stealTimeFollowing.forEach(assignStealValue)

  // Normally, there should never be a case where both of these steal percentages are non-zero.
  // Still, better to allow it if it happens.
  graceNoteSequence.forEach((graceNote, index) => {
    graceNote.duration =
      stealTimePrevious[index] * (previousXmlNote?.duration || 0)
      + stealTimeFollowing[index] * (followingXmlNote?.duration || 0)
  })

  // Since the following note hasn't been parsed yet, its duration can simply be changed in place.
  if(!!followingXmlNote)
    followingXmlNote.duration *= 1 - stealTimeFollowing.filter(
      (_, index) => !chordGraceNoteIndices.includes(index)
    ).reduce(
      (acc, curr) => acc + curr, 0
    )

  // However, the previous note has already been parsed.
  // Hence, it's the MIDI note off event that must be modified.

  const { previousNoteOff, start, duration } = { ...partTrack.xmlNotesToOffEvents.get(previousXmlNote) }
  if(!!previousNoteOff) {

    const stolenPrevious = stealTimePrevious.filter(
      (_, index) => !chordGraceNoteIndices.includes(index)
    ).reduce(
      (acc, curr) => acc + curr, 0
    )

    previousNoteOff.delta = start + duration * (1 - stolenPrevious)

    // Because we always process grace note clusters when encountering the *first* of their members,
    // The accumulator is always exactly where it was when this note off event was pushed.
    // Hence, it can simply be rewound like so.
    partTrack.currentDelta -= duration * stolenPrevious
  }
}

function getRelevantNotatedDynamics(partTrack, startTime) {
  return partTrack?.notatedDynamics.findLast(
    dynamics => dynamics.delta <= startTime
  )?.value
}

// Velocity is defined by the dynamics (for the note on) and end-dynamics (for the note off)
// attributes of note tags.
// When these are not present, dynamics tags are used instead,
// Whose values are stored in the track metadata.

function getMidiVelocity(xmlNote, partTrack = null, startTime = null) {

  const on = !!partTrack // This argument is only given for note ons, so a local alias makes more sense.

  const relevantDynamics = on ? xmlNote.dynamics : xmlNote.endDynamics
  const relevantDefault = on ? DEFAULT_ON_VELOCITY : DEFAULT_OFF_VELOCITY

  // Multiply by 1.25 (1 + (1 / (8 >> 1))) for a normal accent, by 1.5 (1 + (1 / (4 >> 1))) for a marcato.
  const divisor = ((partTrack?.articulationFlags & VELOCITY_MASK) >> 1)
  const multiplicator = 1 + (divisor ? 1 / divisor : 0)

  // Because of how our parsing lib currently works, there is always a dynamics and endDynamics field on notes.
  // So instead of testing for its existence, we test for a default.
  // Also, note that notatedDynamics can never be 0, so !! works fine here.

  const notatedDynamics = getRelevantNotatedDynamics(partTrack, startTime)

  if(!!notatedDynamics && relevantDynamics === DEFAULT_PROVIDED_DYNAMICS)
    return multiplicator * notatedDynamics

  // If the note's own dynamics is not set to the default value,
  // It overrides the staff notation.

  // Notice that dynamics are expressed as a percentage of velocity 90.
  // For example, dynamics = 71 means 0.71 * 90 ~= 64.

  return multiplicator * Math.round((relevantDynamics / 100) * relevantDefault)
}

function getMidiNoteNumber(xmlNote, partTrack) {
  const { step, octave, alter } = xmlNote.pitch
  const stepOffset = stepOffsets.get(step)
  const realOctave = step === "a" || step === "b" ? octave : octave - 1
  const definedAlter = !!alter ? alter : 0

  return (BASE_MIDI_PITCH + stepOffset) + (STEPS_PER_OCTAVE * realOctave) + definedAlter + partTrack.transpose
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

function isArpeggiatedChordNote(xmlNote, checkChord = false) {
  return (!checkChord || !!xmlNote?.chord) && xmlNote?.notations?.find(notation => !!notation.arpeggiates)
}
