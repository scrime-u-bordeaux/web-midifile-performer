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
const FERMATA_FLAG = 16
const DURATION_MASK = 3
const VELOCITY_MASK = 12
const FERMATA_MASK = 16

const FERMATA_HOLD = 2

const DEFAULT_GRACE_DURATION_DOTTED = 1 / 3
const DEFAULT_GRACE_DURATION_NORMAL = 1 / 2

const DYN_PREVIOUS = 0
const DYN_SFZ = 1

// Minimum timestamp difference between two note on events,
// Under which they are considered simultaneous.
// This is not used for any actual parsing,
// Just advance determination of future notesequence indices
// To transmit info the visualizer.

const DELTA_EPSILON = 0.0000000001

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
    ["ppppp", 5],
    ["pppp", 10],
    ["ppp", 16],
    ["sppp", [16, DYN_PREVIOUS]],
    ["pp", 33],
    ["spp", [33, DYN_PREVIOUS]],
    ["p", 49],
    ["sp", [49, DYN_PREVIOUS]],
    ["mp", 64],
    ["mf", 80],
    ["pf", 85],
    ["f", 96],
    ["fp", [96, 49]],
    ["sf", [96, DYN_PREVIOUS]],
    ["fz", DYN_SFZ],
    ["sfz", DYN_SFZ],
    ["ff", 112],
    ["sff", [112, DYN_PREVIOUS]],
    ["fff", 120],
    ["sfff", [120, DYN_PREVIOUS]],
    ["ffff", 126],
    ["fffff", 127]
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

class PartTrack {
  activeChannel

  // Arpeggios disturb the synchronization of part events through backups.
  // To mitigate this effect, we keep track of :
  #arpDurations = new Map() // The extra duration incurred by each arp
  #arpOffsetForMeasure = 0 // The sum of these durations over the measure

  #fermataOffsetForMeasure = 0

  // For later identification of notes in the OSMD visualizer,
  // We need to keep track of each part's channel throughout the totality of the file.
  channelHistory

  // Not all files will provide note-specific dynamics.
  // In fact, for "high-level" notation (distanced from MIDI),
  // only written values (like mf, f, p, etc), may be provided.
  // These written values are stored here.
  notatedDynamics = []

  transpose = 0

  // DT is accumulated per part/track, with backup tags the only way of rewinding it.
  // We convert to relative at the end.
  // This is awkward as we convert back to absolute in the MFP,
  // But otherwise processing is a nightmare.
  currentDelta = DEFAULT_DELTA

  // Unfortunately, a single accumulator is not enough :
  // Because of how the musicXML sync system works, we need to rewind the accumulator by one step
  // when dealing with notes in a chord.
  lastIncrement = 0

  // A binary flag holder. From most to least significant bit :
  // Fermata, accent, marcato, staccatissimo, staccato
  // Used to carry that information through chords.
  articulationFlags = 0
  preserveArticulation = false // Used when articulation flags should exceptionally carry over

  // Testing for inclusion in this will prevent analyzing the same grace notes multiple times.
  lastAnalyzedGraceNoteSequence = null
  // Ditto for arpeggiated chords.
  #lastArpeggiatedChordDelta = null
  lastArpeggiatedChord = null

  // Some files may not provide a default tempo event.
  // The MFP.js parser assumes the default tempo anyway,
  // But just to be safe, we provide an event for it to start.
  events = [getDefaultTempoEvent()]

  // This is a very heavy, but convenient solution to find the preceding note-off of a grace note.
  // Sadly, it will just take up space for nothing in most cases.
  xmlNotesToNoteOffEvents = new Map()
  // In turn this map is necessary to check arpeggio shift, and nothing else.
  noteOffEventsToXmlNotes = new Map()

  // Conversely, these two hacks are necessary to bypass OSMD's inability to position its cursor over grace notes.
  // By using it, we can know at which deltas grace notes are encountered...
  noteOnEventsToXmlNotes = new Map()
  // ... and where their principals are
  xmlNotesToNoteOnEvents = new Map()

  constructor(startingChannel) {
    this.activeChannel = startingChannel
    this.channelHistory = [getChannelChangePseudoEvent(startingChannel, DEFAULT_DELTA)]
  }

  addNotatedDynamics(xmlDirections) {
    const dynamics = xmlDirections.directionTypes.find(
      direction => direction.hasOwnProperty("dynamics")
    ).dynamics

    const velocityKeys = Array.from(velocityMap.keys())

    const dynamicsValue = velocityMap.get(
      // We're going to assume a dynamics object can only contain one "normal" dynamic tag
      Object.keys(dynamics).find(key => velocityKeys.includes(key))
    )

    if(!dynamicsValue) return

    if(dynamicsValue instanceof Array) { // subito dynamics

      const lastNotatedDynamics = this.notatedDynamics.at(-1)

      this.notatedDynamics.push({ // push this one only for this beat
        delta: this.currentDelta,
        value: dynamicsValue[0]
      })

      this.notatedDynamics.push({
        delta: this.currentDelta+1, // TODO : should this rather be + divisions ?
        value:
          !!dynamicsValue[1] ? // If the second value is a valid dynamics value, use it
            dynamicsValue[1] : // This is only the case for fortepiano.
            !!lastNotatedDynamics ? // Otherwise, use the last notated dynamics...
            lastNotatedDynamics.value :
            dynamicsValue[1] // And if there aren't any, signal to use defaults instead.
      })
    }

    else if(dynamicsValue === DYN_SFZ) {
      this.articulationFlags |= MARCATO_FLAG // interpret sforzando as marcato
      this.preserveArticulation = true
    }

    else this.notatedDynamics.push({
      delta: this.currentDelta,
      value: dynamicsValue
    })
  }

  cleanUpForMeasure(measureEnd) {
    // Ensure measures do not encroach on each other,
    // Even if backups end up in the middle of one.
    if(this.currentDelta < measureEnd) {
      // console.log("Delta over measure, correcting to", measureEnd)
      this.currentDelta = measureEnd
    }

    this.#arpOffsetForMeasure = 0
    this.#fermataOffsetForMeasure = 0
  }

  getRelevantNotatedDynamics(startTime) {
    return this.notatedDynamics.findLast(
      dynamics => dynamics.delta <= startTime
    )?.value
  }

  getArpCompensation(xmlNote) {
    // Synced arpeggios should not be compensated.
    // This seems like an acceptable compromise for now.
    // If it breaks in some cases, just use the difference of their respective offsets.

    if(!!xmlNote.arpeggioStartNote) return 0

    // Check if an arp was registered at this delta.
    // If so, add its extra duration to the delta increment.

    const durationMapAtDelta = this.#arpDurations.get(getNoteStartTime(xmlNote, this))

    if(!durationMapAtDelta) return 0

    // Compensate events synced with one or more arps
    // With the sum of these arps' offset

    const offset = Array.from(
      durationMapAtDelta.values()
    )?.reduce(
      (accOffset, offset) => accOffset + offset
    )

    return offset || 0
  }

  getOffsetForMeasure() {
    return this.#arpOffsetForMeasure + this.#fermataOffsetForMeasure
  }

  registerArp(arp) {
    this.#lastArpeggiatedChordDelta = this.currentDelta
    this.lastArpeggiatedChord = new Set(arp)
  }

  updateArpsAndOffsets(xmlNote) {
    const arpDelta = this.#lastArpeggiatedChordDelta // should never be null when this method is called
    const durationMapAtDelta = this.#arpDurations.get(arpDelta) || new Map()

    const arpRef = xmlNote.arpeggioStartNote
    const arpDuration = durationMapAtDelta.get(arpRef)

    // Do NOT add the duration of the last arp note : it is normal, and not part of the offset system.
    const increment = xmlNote.lastArpeggiatedChordNoteFlag ? 0 : getTrueNoteDuration(xmlNote, this)

    durationMapAtDelta.set(
      arpRef,
      !!arpDuration ? arpDuration + increment : increment
    )

    this.#arpDurations.set(arpDelta, durationMapAtDelta)

    // Arpeggio is over

    if(xmlNote.lastArpeggiatedChordNoteFlag) {
      // Add total arpeggio offset to measure accumulator
      this.#arpOffsetForMeasure += arpDuration

      // Shift every registered event that comes after the arp,
      // So everything remains in sync.

      this.events.filter( midiEvent => {
        const isNoteEvent = !!midiEvent.noteOn || !!midiEvent.noteOff
        if(!isNoteEvent) return false

        const xmlEquivalent =
          !!midiEvent.noteOn ?
            this.noteOnEventsToXmlNotes.get(midiEvent) :
            this.noteOffEventsToXmlNotes.get(midiEvent)

        const isInSyncedArp =
          this.xmlNotesToNoteOnEvents.get(xmlEquivalent.arpeggioStartNote)?.delta === arpDelta

        return !isInSyncedArp && midiEvent.delta > arpDelta
      }).forEach(
        event => {
          // FIXME : this works for Clair de Lune,
          // which is the only sample I found with synchronized arpeggios,
          // But is not valid in the general case.
          event.delta += Math.max(arpDuration - event.offsetAtCreation, 0)
        }
      )
    }
  }

  signalFermata(xmlNote) {
    this.#fermataOffsetForMeasure += xmlNote.duration
  }
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
      new PartTrack(startingChannel)
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

  let measureStart = null
  // This is also useful to mark the start of measures.
  // (The start of a measure is just the end of another one)
  const measureStarts = new Set()

  // console.log("Begin MusicXML parsing")

  xmlScore.measures.forEach((measure, index) => {

    // console.log(`Measure ${index}`)

    measureStart = null

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

              if(event.directionTypes.some(direction => direction.hasOwnProperty("dynamics")))
                partTrack.addNotatedDynamics(event)

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

            partTrack.currentDelta -= event.duration + partTrack.getOffsetForMeasure()

            break

          // Forward elements do the opposite.

          case "Forward":

            partTrack.currentDelta += event.duration + partTrack.getOffsetForMeasure()

            break

          // The main case.

          case "Note":

            if(!event.rest) { // Rests are not actual pitches, and thus need not be pushed.

              if(isArpeggiatedChordNote(event) && !partTrack.lastArpeggiatedChord?.has(event))
                partTrack.registerArp(markArpeggio(partArray, index))

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

              if(!event.ties || (event.ties.length === 1 && event.ties[0].type === TIE_START))
                measureStart = measureStart !== null ?
                  Math.min(measureStart, partTrack.currentDelta) :
                  partTrack.currentDelta
            }

            // Notes bearing a "chord" attribute are synced to the previous pitch that did not bear one.
            // As such, their duration is irrelevant for the accumulator.

            if(!event.chord || isArpeggiatedChordNote(event)) { // We want this to happen to rests as well.
              if(isArpeggiatedChordNote(event)) partTrack.updateArpsAndOffsets(event)

              const increment = (isArpeggiatedChordNote(event) ?
                getTrueNoteDuration(event, partTrack) : event.duration
              ) + partTrack.getArpCompensation(event)

              partTrack.currentDelta += increment
              partTrack.lastIncrement = increment

              if(partTrack.currentDelta > measureEnd) measureEnd = partTrack.currentDelta
            }

            break
        }

        // console.log("Delta after parsing :", partTrack.currentDelta)
      })

      partTrack.cleanUpForMeasure(measureEnd)
    }

    measureStarts.add(measureStart)
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

  const allNoteOns = Array.from(trackMap.values()).flatMap(partTrack =>
    partTrack.events.filter(
      event => !!event.noteOn
    )
  ).sort(
    (noteA, noteB) => {
      if(Math.abs(noteA.delta - noteB.delta) > DELTA_EPSILON)
        return noteA.delta - noteB.delta

      // Ensure strict order even within to-be sets,
      // So the indices conform to those of the eventual note sequence,
      // Which uses the same disambiguation.

      else return noteA.noteOn.noteNumber - noteB.noteOn.noteNumber
    }
  )

  // The first thing this merged list is used for is knowing where measures start.
  // For now, this is only useful in determining MFP auto-playback triggers ;
  // However, it might have several more uses in the future
  // (e.g. : jump to / loop on measure)

  const measureStartIndices = new Set(
    allNoteOns.map(
      (note, index) => measureStarts.has(note.delta) ? index : null
    ).filter(
      indexOrNull => indexOrNull !== null
    )
  )

  // Using allNoteOns, we can get the noteSequence-compatible index of every grace note,
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
    info => !!info
  )

  // We are also able to mark every note which is part of an arpeggio.

  const arpeggioInfo = allNoteOns.map(
    (note, index) => {
      const startXmlEquivalent = mergedOnToXml.get(note)
      if(!startXmlEquivalent.firstArpeggiatedChordNoteFlag) return null

      const endIndex = allNoteOns.slice(index).findIndex(note => {
        const candidateXmlEquivalent = mergedOnToXml.get(note)
        return (
          candidateXmlEquivalent.lastArpeggiatedChordNoteFlag &&
          candidateXmlEquivalent.arpeggioStartNote === startXmlEquivalent
        )
      }) + index

      return {
        startIndex: index,
        endIndex: endIndex
      }
    }
  ).filter(
    info => !!info
  )

  // Worse yet : we can't emit from there, because this isn't a class
  // (and it has no reason to be ! This isn't a sufficient reason to change that)
  // So instead, we pass this data along in the midiJson, for transmission by MFP.js.

  const midiJson = {
    division: divisions,
    format: 1,
    tracks: Array.from(trackMap.values()).map(track => convertToRelative(track.events)),
    measureStartIndices: measureStartIndices,
    tempoEvents: tempoEvents,
    channelChanges: channelChanges,
    graceNoteInfo: graceNoteInfo,
    arpeggioInfo: arpeggioInfo
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
    },

    // This other info is not used by the MFP,
    // Only for parsing and registration purposes

    // This is for record-keeping in arpeggio-induced time shifts
    offsetAtCreation: partTrack.getOffsetForMeasure()
  }

  partTrack.noteOnEventsToXmlNotes.set(midiNoteOnEvent, xmlNote)
  partTrack.xmlNotesToNoteOnEvents.set(xmlNote, midiNoteOnEvent)

  return midiNoteOnEvent
}

function getMidiNoteOffEvent(xmlNote, partTrack) {
  // TODO : is this call needed ?
  // Shouldn't a call in getMidiNoteOnEvent suffice ?
  // I don't want to remove it and risk breakign something, but...
  manageNoteArticulations(xmlNote, partTrack, false)

  const startTime = getNoteStartTime(xmlNote, partTrack)
  const duration = getTrueNoteDuration(xmlNote, partTrack, true)

  const midiNoteOffEvent = {
    delta: startTime + duration,
    channel : partTrack.activeChannel,
    noteOff: {
      velocity: getMidiVelocity(xmlNote),
      noteNumber: getMidiNoteNumber(xmlNote, partTrack)
    },
    offsetAtCreation: partTrack.getOffsetForMeasure()
  }

  partTrack.xmlNotesToNoteOffEvents.set(xmlNote, {
    previousNoteOff: midiNoteOffEvent,
    start: startTime,
    duration: duration
  })

  partTrack.noteOffEventsToXmlNotes.set(
    midiNoteOffEvent,
    xmlNote
  )

  return midiNoteOffEvent
}

function getNoteStartTime(xmlNote, partTrack) {
  return xmlNote.chord && !isArpeggiatedChordNote(xmlNote) ?
    partTrack.currentDelta - partTrack.lastIncrement : partTrack.currentDelta
}

function manageNoteArticulations(xmlNote, partTrack, signalFermata = true) {
  if(!xmlNote.chord) {
    if(!partTrack.preserveArticulation) partTrack.articulationFlags = 0
    else partTrack.preserveArticulation = false

    // Fermata are not grouped with articulations,
    // but are instead direct children of the notation node.
    // I don't really know why.

    const notations = xmlNote.notations

    if(!!notations?.find(notation => !!notation.fermatas)) {
      // Hacky way to avoid doing this twice, since the function is called for both on and off
      // TODO : Why is that the case ??
      if(signalFermata) partTrack.signalFermata(xmlNote)

      partTrack.articulationFlags |= FERMATA_FLAG
    }

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

function getTrueNoteDuration(xmlNote, partTrack, fullDurationForArps = false) {
  if(isArpeggiatedChordNote(xmlNote)
      &&
     !xmlNote.lastArpeggiatedChordNoteFlag
      &&
     !fullDurationForArps
    )
    return partTrack.divisions / 16

  const hasFermata = partTrack.articulationFlags & FERMATA_MASK

  // Modify the duration in place for a fermata,
  // So the rest of the logic with the delta accumulator follows.

  if(!!hasFermata)
    xmlNote.duration *= FERMATA_HOLD

  // Note that fermata and non-zero divisors should not overlap :
  // A note should not be both fermata and staccato,
  // Because it can't be both longer and shorter.

  // Divide by 2 (1 << 1) for staccato, by 4 (2 << 1) for staccatissimo.
  const divisor = (partTrack.articulationFlags & DURATION_MASK) << 1
  return (divisor > 0 ? xmlNote.duration / divisor : xmlNote.duration)
}

function markArpeggio(partArray, initialArpeggioIndex) {
  partArray[initialArpeggioIndex].firstArpeggiatedChordNoteFlag = true
  partArray[initialArpeggioIndex].arpeggioStartNote = partArray[initialArpeggioIndex]

  const fullChord = [partArray[initialArpeggioIndex]]
  let i = initialArpeggioIndex + 1

  // This second argument set to true means : check that the notes have "chord" attributes.
  // Because here, we might run into two successive arpeggiated chords,
  // and we want to stop at the end of the first one.
  // So when the next one starts, with arpeggiates set, but no "chord" attr (since it's the first note of the chord)
  // The loop stops.
  for(; isArpeggiatedChordNote(partArray[i], true); i++) {
    fullChord.push(partArray[i])
    partArray[i].arpeggioStartNote = partArray[initialArpeggioIndex]
  }

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
  const followingXmlNote = partArray[i]?._class !== "Note" || !!partArray[i]?.grace ? null : partArray[i]

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

  const { previousNoteOff, start, duration } = { ...partTrack.xmlNotesToNoteOffEvents.get(previousXmlNote) }
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
  // Also, note that if notatedDynamics is 0, this means a return to default
  // So !! works as intended.

  const notatedDynamics = partTrack?.getRelevantNotatedDynamics(startTime)

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
