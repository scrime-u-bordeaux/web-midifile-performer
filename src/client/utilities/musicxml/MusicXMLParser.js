import { parseScore } from 'musicxml-interfaces'
import PartTrack from './types/PartTrack'

import {
  DEFAULT_CHANNEL,

  TIE_START,

  TEMPO_MAP,

  DELTA_EPSILON
} from './constants'

import {
  isArpeggiatedChordNote
} from './util'

export default function parseMusicXml(buffer) {
  const xmlScore = parseScore(buffer) // Always returns a timewise score, even from a partwise file.
  const trackMap = new Map()

  // Because the score is always timewise, the score object will always have logical measures,
  // But if there are actual, engraved measures, then at least some will be explicit.
  const hasMeasures = xmlScore.measures.some(measure => !measure.implicit)

  // Whether a score has beats (= a time signature) cannot so easily be said.
  // It will only be made true if and when we encounter a time signature along the way.
  let hasBeats = false

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
  let measureEnd = hasMeasures ? 0 : null

  // The start of measures (= the delta of the first note on in that measure) is marked separately,
  // Because a measure may start with rests.
  let measureStart = null
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

          case "Attributes":

            // Attribute tags can carry the division.
            // If so, it is found in the first measure for every part.
            // However, *the specified divisions for every part may be different.*
            // TODO : handle this, converting them all to one single division value for the resulting MIDI

            if(!!event.divisions) {
              divisions = event.divisions
              Array.from(trackMap.values()).forEach(partTrack => partTrack.divisions = divisions)
            }

            if(!!event.transposes) partTrack.transpose = parseInt(event.transposes[0].chromatic, 10)

            if(!!event.times && event.times[0].beats && event.times[0].beatTypes) {
              partTrack.updateBeatCriteria(event.times[0])
              hasBeats = true
            }

            break

          case "Direction":
            // For some reasons, children of a directionType do not work on the _class system.
            if(!!event.directionTypes) {

              if(event.directionTypes.some(direction => direction.hasOwnProperty("dynamics")))
                partTrack.addNotatedDynamics(event)

              if(event.directionTypes.some(direction => direction.hasOwnProperty("words"))) {
                // Again, I assume there's never going to be *more* than one direction string in a single direction object.
                const word = event.directionTypes.find(direction => direction.hasOwnProperty("words")).words[0].data
                const resultingTempo = TEMPO_MAP.get(word)
                if(!!resultingTempo)
                  partTrack.addTempoEvent({ tempo : resultingTempo })
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

            if(!!soundEvent.tempo) partTrack.addTempoEvent(soundEvent)

            if(!!soundEvent.midiInstrument && !!soundEvent.midiInstrument.channel)
              partTrack.updateActiveChannel(soundEvent.midiInstrument.channel - 1)

            // TODO :  Sound events may also change divisions along the way, but supposedly, this is only after codas.
            // For now, we won't worry about it. It's less urgent than the multiple initial division problem.

            break

          // -------------------------------------------------------------------
          // --------------------------EVENT TAGS-------------------------------
          // -------------------------------------------------------------------

          case "Backup":

            partTrack.backup(event)

            break

          case "Forward":

            partTrack.forward(event)

            break

          // The main case.

          case "Note":

            if(!!event.intendedStartDelta && partTrack.currentDelta !== event.intendedStartDelta)
              partTrack.currentDelta = Math.round(partTrack.currentDelta)

            if(!event.rest) { // Rests are not actual pitches, and thus need not be pushed.

              if(isArpeggiatedChordNote(event) && !partTrack.lastArpeggiatedChord?.has(event)) {
                const arpeggiatedChord = markArpeggio(partArray, index)

                // In some broken exported files, we find arpeggios on single notes,
                // Which is obviously a mistake, and thus warrants aborting the process
                if(arpeggiatedChord.length > 1) partTrack.registerArp(arpeggiatedChord)
                else throw new Error("Invalid arpeggio detected : parsing aborted")
              }

              if(event.grace && !partTrack.lastAnalyzedGraceNoteSequence?.includes(event)) {
                const graceNoteData = gatherGraceNoteData(partArray, index)
                partTrack.resolveGraceNoteDurations(graceNoteData)
              }

              // Notes bearing a "ties" attribute are special.
              // They are notes "tied" beyond measure boundaries.
              // They begin on the first note of the tie and end on the last.
              // All tied notes in between only renew their prolongation.

              if(!!event.ties && event.ties.length === 1) { // In other words :
              // If there is more than one tie for a note, it simply prolongs the note further,
              // So it should not be pushed.

                if(event.ties[0].type === TIE_START) partTrack.addMidiNoteOnEvent(event)

                else partTrack.addMidiNoteOffEvent(event)

              } else if(!event.ties) {
                partTrack.addMidiNoteEventPair(event)
              }

              if(
                hasMeasures &&
                (
                  !event.ties ||
                  (event.ties.length === 1 && event.ties[0].type === TIE_START)
                )
              )
                measureStart = measureStart !== null ?
                  Math.min(measureStart, partTrack.currentDelta) :
                  partTrack.currentDelta
            }

            // Notes bearing a "chord" attribute are synced to the previous pitch that did not bear one.
            // As such, their duration is irrelevant for the accumulator...
            // ...except if the chord is arpeggiated,
            // because then, the notes in question are, of course, not synced.

            if(!event.chord || isArpeggiatedChordNote(event)) { // We want this to happen to rests as well.
              if(isArpeggiatedChordNote(event)) partTrack.updateArpsAndOffsets(event)

              const increment = (isArpeggiatedChordNote(event) ?
                partTrack.getTrueNoteDuration(event) : event.duration
              ) + partTrack.getArpCompensation(event)

              partTrack.currentDelta += increment
              partTrack.lastIncrement = increment

              if(hasMeasures && partTrack.currentDelta > measureEnd) measureEnd = partTrack.currentDelta
            }

            partTrack.cleanUpForNote(event)

            break
        }

        // console.log("Delta after parsing :", partTrack.currentDelta)
      })

      partTrack.cleanUpForMeasure(measureEnd)
    }

    if(hasMeasures) measureStarts.add(measureStart)
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

  const measureStartIndices = hasMeasures ? new Set(
    allNoteOns.map(
      (note, index) => measureStarts.has(note.delta) ? index : null
    ).filter(
      indexOrNull => indexOrNull !== null
    )
  ) : new Set()

  const beatIndices = hasBeats ? new Set(
    allNoteOns.map(
      (note, index) => note.isOnBeat ? index : null
    ).filter(
      indexOrNull => indexOrNull !== null
    )
  ) : new Set()

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

  Array.from(trackMap.values()).forEach(partTrack => partTrack.convertEventsToRelative())

  // Worse yet : we can't emit from there, because this isn't a class
  // (and it has no reason to be ! This isn't a sufficient reason to change that)
  // So instead, we pass this data along in the midiJson, for transmission by MFP.js.

  const midiJson = {
    division: divisions,
    format: 1,
    tracks: Array.from(trackMap.values()).map(track => track.events),

    hasMeasures: hasMeasures,
    hasBeats: hasBeats,

    measureStartIndices: measureStartIndices,
    beatIndices: beatIndices,

    tempoEvents: tempoEvents,
    channelChanges: channelChanges,

    graceNoteInfo: graceNoteInfo,
    arpeggioInfo: arpeggioInfo
  }

  return midiJson
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
  // Note that this following note may very well be a rest with this implementation ;
  // Is this a good thing ?
  const followingXmlNote = partArray[i]?._class !== "Note" || !!partArray[i]?.grace ? null : partArray[i]

  let j = initialGraceNoteIndex - 1

  // There may also not be a preceding non-grace note in the measure.
  // Non-note events (harmony notations, directions...) may also precede the grace cluster.
  for(; j >= 0 && (partArray[j]._class !== "Note" || partArray[j].grace) ; j--) continue

  const previousXmlNote = partArray[j]

  return { graceNoteSequence, followingXmlNote, previousXmlNote }
}
