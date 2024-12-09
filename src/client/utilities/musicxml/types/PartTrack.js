import {
  MICROSECONDS_PER_MINUTE,

  DYN_SFZ,

  DEFAULT_DELTA,
  DEFAULT_PROVIDED_DYNAMICS,

  DEFAULT_ON_VELOCITY,
  DEFAULT_OFF_VELOCITY,

  BASE_MIDI_PITCH,
  STEPS_PER_OCTAVE,

  STACCATO_FLAG,
  STACCATISSIMO_FLAG,
  ACCENT_FLAG,
  MARCATO_FLAG,
  FERMATA_FLAG,
  DURATION_MASK,
  VELOCITY_MASK,
  FERMATA_MASK,

  FERMATA_HOLD,

  DEFAULT_GRACE_DURATION_NORMAL,
  DEFAULT_GRACE_DURATION_DOTTED,

  VELOCITY_MAP,
  STEP_OFFSETS
} from '../constants'

import {
  getChannelChangePseudoEvent,
  isArpeggiatedChordNote
} from '../util'

export default class PartTrack {
  activeChannel

  // Arpeggios disturb the synchronization of part events through backups.
  // To mitigate this effect, we keep track of :
  #arpDurations = new Map() // The extra duration incurred by each arp
  #arpOffsetSinceLastBackup = 0 // The sum of these durations since the last backup
  #arpOffsetForMeasure = 0 // The sum of these durations over the measure
  #maxArpOffsetForMeasure = 0 // The biggest individual arp offset across one non-backup iteration of the measure
  #totalArpOffset = 0 // The sum of these durations over the whole piece (for beat tracking)

  #fermataOffsetSinceLastBackup = 0
  #fermataOffsetForMeasure = 0
  #maxFermataOffsetForMeasure = 0
  #totalFermataOffset = 0

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

  #backupJustPerformed = false
  #backupPerformedInMeasure = false

  // Unfortunately, a single accumulator is not enough :
  // Because of how the musicXML sync system works, we need to rewind the accumulator by one step
  // when dealing with notes in a chord.
  lastIncrement = 0

  #lastMeasureEnd = 0

  // Consists of the base increment in time units for each beat,
  // And the delta at which this criteria begins, as an additive offset
  // To the increment multiplication
  #beatCriteria = null

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

  // do NOT add a default tempo event ;
  // In multi-track files, this causes the tempo to revert to 120 BPM,
  // Due to the default event on the second track onwards.
  // MFP.js assumes 120 BPM by default anyway, so it's unneeded.
  #events = []

  // Although I cannot make this getter readonly,
  // It hopefully will be enough to convey to future contributors
  // That the events array should not be modified from the outside.
  get events() {
    return this.#events
  }

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

  // ---------------------------------------------------------------------------
  // ---------------------- BASIC PARSING OPERATIONS ---------------------------
  // ---------------------------------------------------------------------------

  addMidiNoteEventPair(xmlNote) {
    this.addMidiNoteOnEvent(xmlNote)
    this.addMidiNoteOffEvent(xmlNote)
  }

  addMidiNoteOnEvent(xmlNote) {
    this.manageNoteArticulations(xmlNote)

    const startTime = this.getNoteStartTime(xmlNote)

    // console.log(isArpeggiatedChordNote(xmlNote))

    const midiNoteOnEvent = {
      delta: startTime,
      channel : this.activeChannel,
      noteOn: {
        velocity: this.getMidiVelocity(xmlNote, startTime),
        noteNumber: this.getMidiNoteNumber(xmlNote)
      },

      // This other info is not used by the MFP,
      // Only for parsing and registration purposes

      // This is for record-keeping in arpeggio-induced time shifts
      offsetAtCreation: this.getOffsetForMeasure(),
      isOnBeat: this.isOnBeat(xmlNote)
    }

    this.noteOnEventsToXmlNotes.set(midiNoteOnEvent, xmlNote)
    this.xmlNotesToNoteOnEvents.set(xmlNote, midiNoteOnEvent)

    this.#events.push(midiNoteOnEvent)
  }

  addMidiNoteOffEvent(xmlNote) {
    // TODO : is this call needed ?
    // Shouldn't a call in getMidiNoteOnEvent suffice ?
    // I don't want to remove it and risk breaking something, but...
    this.manageNoteArticulations(xmlNote, false)

    const startTime = this.getNoteStartTime(xmlNote)
    const duration = this.getTrueNoteDuration(xmlNote, true)

    const midiNoteOffEvent = {
      delta: startTime + duration,
      channel : this.activeChannel,
      noteOff: {
        velocity: this.getMidiVelocity(xmlNote),
        noteNumber: this.getMidiNoteNumber(xmlNote)
      },
      offsetAtCreation: this.getOffsetForMeasure()
    }

    this.xmlNotesToNoteOffEvents.set(xmlNote, {
      previousNoteOff: midiNoteOffEvent,
      start: startTime,
      duration: duration
    })

    this.noteOffEventsToXmlNotes.set(
      midiNoteOffEvent,
      xmlNote
    )

    this.#events.push(midiNoteOffEvent)
  }

  addTempoEvent(xmlSound) {
    this.#events.push({
      delta: this.currentDelta,
      setTempo : {
        // MusicXML tempo is defined in quarter notes per minute,
        // We want it in microseconds per quarter note.
        microsecondsPerQuarter: MICROSECONDS_PER_MINUTE / parseInt(xmlSound.tempo, 10)
      }
    })
  }

  backup(event) {
    this.currentDelta -= event.duration + this.getOffsetForMeasure()
    this.#backupJustPerformed = true
    this.#backupPerformedInMeasure = true

    this.#maxArpOffsetForMeasure = Math.max(this.#arpOffsetSinceLastBackup, this.#maxArpOffsetForMeasure)
    this.#maxFermataOffsetForMeasure = Math.max(this.#fermataOffsetSinceLastBackup, this.#maxFermataOffsetForMeasure)

    this.#arpOffsetSinceLastBackup = 0
    this.#fermataOffsetSinceLastBackup = 0
  }

  forward(event) {
    this.currentDelta += event.duration + this.getOffsetForMeasure()
  }

  addNotatedDynamics(xmlDirections) {
    const dynamics = xmlDirections.directionTypes.find(
      direction => direction.hasOwnProperty("dynamics")
    ).dynamics

    const velocityKeys = Array.from(VELOCITY_MAP.keys())

    const dynamicsValue = VELOCITY_MAP.get(
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

  updateActiveChannel(channel) {
    this.activeChannel = channel

    this.channelHistory.push(
      getChannelChangePseudoEvent(
        this.activeChannel,
        this.currentDelta
      )
    )
  }

  // ---------------------------------------------------------------------------
  // ----------------------- OFFSET-CREATING EVENTS-----------------------------
  // ---------------------------------------------------------------------------

  // This section gathers methods related to arps, fermatas,
  // And later on things such as mordents, trills, and so on,
  // Which disturb the intended flow of the accumulator.

  getArpCompensation(xmlNote) {
    // Synced arpeggios should not be compensated.
    // This seems like an acceptable compromise for now.
    // If it breaks in some cases, just use the difference of their respective offsets.

    if(!!xmlNote.arpeggioStartNote) return 0

    // Check if an arp was registered at this delta.
    // If so, add its extra duration to the delta increment.

    const durationMapAtDelta = this.#arpDurations.get(this.getNoteStartTime(xmlNote))

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

  getOffsetSinceLastBackup() {
    return this.#arpOffsetSinceLastBackup + this.#fermataOffsetSinceLastBackup
  }

  getOffsetForMeasure() {
    return this.#arpOffsetForMeasure + this.#fermataOffsetForMeasure
  }

  getOffsetOverPiece() {
    return this.#totalArpOffset + this.#totalFermataOffset
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
    const increment =
      xmlNote.lastArpeggiatedChordNoteFlag ?
        0 :
        this.getTrueNoteDuration(xmlNote)

    durationMapAtDelta.set(
      arpRef,
      !!arpDuration ? arpDuration + increment : increment
    )

    this.#arpDurations.set(arpDelta, durationMapAtDelta)

    // Arpeggio is over

    if(xmlNote.lastArpeggiatedChordNoteFlag) {
      // Add total arpeggio offset to measure accumulator
      this.#arpOffsetSinceLastBackup += arpDuration
      this.#arpOffsetForMeasure += arpDuration

      // Shift every registered event that comes after the arp,
      // So everything remains in sync.

      this.#events.filter( midiEvent => {
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
    this.#fermataOffsetSinceLastBackup += xmlNote.duration
    this.#fermataOffsetForMeasure += xmlNote.duration
  }

  // ---------------------------------------------------------------------------
  // -------------------------- CLEANUP METHODS --------------------------------
  // ---------------------------------------------------------------------------

  cleanUpForMeasure(measureEnd) {
    // Ensure measures do not encroach on each other,
    // Even if backups end up in the middle of one.

    // !!measureEnd tests if the file *has* explicit measures, or is free-meter ;
    // Since a measure would never end at delta 0,
    // This is a valid way of doing so.
    if(!!measureEnd && this.currentDelta < measureEnd) {
      // console.log("Delta over measure, correcting to", measureEnd)
      this.currentDelta = measureEnd
    }

    const measureTotal = measureEnd - this.#lastMeasureEnd

    if(
      !!this.#beatCriteria &&
      measureTotal < this.#beatCriteria.measureTotal
    ) {
      this.#beatCriteria.baseDelta = measureEnd

      if(!this.isMeasureImplicit) { // Pickup ("incomplete") measures should always be implicit.
        // Otherwise, we're probably looking at file corruption.
        // Still, pursue parsing, as this is not a fatal error, especially not for MFP purposes.
        console.warn('WARNING : encountered incomplete explicit measure')
        console.warn('This file may be invalid')
      }
    }

    this.#lastMeasureEnd = measureEnd

    this.#maxArpOffsetForMeasure = Math.max(this.#arpOffsetSinceLastBackup, this.#maxArpOffsetForMeasure)
    this.#maxFermataOffsetForMeasure = Math.max(this.#fermataOffsetSinceLastBackup, this.#maxFermataOffsetForMeasure)

    this.#totalArpOffset += this.#maxArpOffsetForMeasure
    this.#totalFermataOffset += this.#maxFermataOffsetForMeasure

    this.#arpOffsetForMeasure = 0
    this.#arpOffsetSinceLastBackup = 0
    this.#maxArpOffsetForMeasure = 0

    this.#fermataOffsetForMeasure = 0
    this.#fermataOffsetSinceLastBackup = 0
    this.#maxFermataOffsetForMeasure = 0

    this.#backupJustPerformed = false
    this.#backupPerformedInMeasure = false
  }

  cleanUpForNote(xmlNote) {
    if(!isArpeggiatedChordNote(xmlNote) || xmlNote.lastArpeggiatedChordNoteFlag)
      this.#backupJustPerformed = false
  }

  // ---------------------------------------------------------------------------
  // -------------------------- BEAT TRACKING ----------------------------------
  // ---------------------------------------------------------------------------

  updateBeatCriteria(timeSignatureEvent) {
    const baseUnit = this.divisions * (2 ** (2 - Math.log2(timeSignatureEvent.beatTypes[0])))

    const numerator = parseInt(timeSignatureEvent.beats[0], 10)

    const isMeterCompound = numerator % 3 === 0 && numerator !== 3

    const beatIncrement =
      isMeterCompound ?
        3 * baseUnit : // Compound meter
        baseUnit // Simple or complex meter

    const measureTotal =
      isMeterCompound ?
        (numerator / 3) * baseUnit :
        numerator * baseUnit

    const baseDelta = this.currentDelta

    this.#beatCriteria = {
      increment: beatIncrement,
      measureTotal: measureTotal,
      baseDelta: baseDelta
    }
  }

  isOnBeat(xmlNote) {

    // This happens when no time signature was provided before notes are written
    // This is the case in free meter files
    if(!this.#beatCriteria) return false

    // Due to how arps, fermatas etc work,
    // The note start time is not enough to see if a note is on beat ;
    // We must subtract from that start time a variable offset.

    // The base of that offset is as follows :

    const baseOffset = this.getOffsetOverPiece() + this.getOffsetForMeasure()
    // This sum is needed because offsetOverPiece is only incremented at the end of each measure,
    // To ensure that the right increment is selected.

    // However, in certain cases, this baseOffset is too large,
    // And must be reduced by another quantity.

    let offsetNotConsidered = 0

    // If a backup has just been performed, the measure offset has already been deduced,
    // Hence none of it is to be subtracted again.
    if(this.#backupJustPerformed)
      offsetNotConsidered = this.getOffsetForMeasure()

    // If other offsets have begun since the last backup,
    // Then only they must be considered,
    // And the rest of the measure total discarded.

    // FIXME : this is the wrong condition.
    // The actual check must be : are we past the point of applying a certain arp's offset ?
    // If we are before that arp, no ; otherwise yes.
    // This can be done through durationMapAtDelta.

    // However, to do that, the entire arp algorithm should be rewritten,
    // Because backups too should only take into account the offsets
    // That take place in the space that they traverse.
    else if(this.#backupPerformedInMeasure && !!this.getOffsetSinceLastBackup())
      offsetNotConsidered = this.getOffsetForMeasure() - this.getOffsetSinceLastBackup()

    const finalOffset = baseOffset - offsetNotConsidered

    console.log(
      "Actual note start time :", this.getNoteStartTime(xmlNote),

      "Base offset to subtract :", this.#beatCriteria.baseDelta + baseOffset,

      "Not subtracted for special cases :", offsetNotConsidered,

      "Total subtracted :", this.#beatCriteria.baseDelta + finalOffset,

      "Evaluated value :", this.getNoteStartTime(xmlNote) - (
        this.#beatCriteria.baseDelta + finalOffset
      ),

      "Beat increment :", this.#beatCriteria.increment,

      "Remainder of eval by beat increment : ", (
        this.getNoteStartTime(xmlNote) - (
          this.#beatCriteria.baseDelta + finalOffset
        )
      ) % this.#beatCriteria.increment
    )

    return (
      this.getNoteStartTime(xmlNote) - (
        this.#beatCriteria.baseDelta + finalOffset
      )
    ) % this.#beatCriteria.increment === 0
  }

  // ---------------------------------------------------------------------------
  // -------------------------- PARSING UTILS ----------------------------------
  // ---------------------------------------------------------------------------

  getRelevantNotatedDynamics(startTime) {
    return this.notatedDynamics.findLast(
      dynamics => dynamics.delta <= startTime
    )?.value
  }

  getNoteStartTime(xmlNote) {
    return xmlNote.chord && !isArpeggiatedChordNote(xmlNote) ?
      this.currentDelta - this.lastIncrement : this.currentDelta
  }

  getMidiNoteNumber(xmlNote) {
    const { step, octave, alter } = xmlNote.pitch
    const stepOffset = STEP_OFFSETS.get(step)
    const realOctave = step === "a" || step === "b" ? octave : octave - 1
    const definedAlter = !!alter ? alter : 0

    return (BASE_MIDI_PITCH + stepOffset) + (STEPS_PER_OCTAVE * realOctave) + definedAlter + this.transpose
  }

  // Velocity is defined by the dynamics (for the note on) and end-dynamics (for the note off)
  // attributes of note tags.
  // When these are not present, dynamics tags are used instead,
  // Whose values are stored in the track metadata.

  getMidiVelocity(xmlNote, startTime = null) {

    const on = startTime !== null // This argument is only given for note ons, so a local alias makes more sense.

    const relevantDynamics = on ? xmlNote.dynamics : xmlNote.endDynamics
    const relevantDefault = on ? DEFAULT_ON_VELOCITY : DEFAULT_OFF_VELOCITY

    // Multiply by 1.25 (1 + (1 / (8 >> 1))) for a normal accent, by 1.5 (1 + (1 / (4 >> 1))) for a marcato.
    const divisor = on ? ((this.articulationFlags & VELOCITY_MASK) >> 1) : 0
    const multiplicator = 1 + (divisor ? 1 / divisor : 0)

    // Because of how our parsing lib currently works, there is always a dynamics and endDynamics field on notes.
    // So instead of testing for its existence, we test for a default.
    // Also, note that if notatedDynamics is 0, this means a return to default
    // So !! works as intended.

    const notatedDynamics = on ? this.getRelevantNotatedDynamics(startTime) : 0

    if(!!notatedDynamics && relevantDynamics === DEFAULT_PROVIDED_DYNAMICS)
      return multiplicator * notatedDynamics

    // If the note's own dynamics is not set to the default value,
    // It overrides the staff notation.

    // Notice that dynamics are expressed as a percentage of velocity 90.
    // For example, dynamics = 71 means 0.71 * 90 ~= 64.

    return multiplicator * Math.round((relevantDynamics / 100) * relevantDefault)
  }

  getTrueNoteDuration(xmlNote, fullDurationForArps = false) {
    if(isArpeggiatedChordNote(xmlNote)
        &&
       !xmlNote.lastArpeggiatedChordNoteFlag
        &&
       !fullDurationForArps
      )
      return this.divisions / 16

    const hasFermata = this.articulationFlags & FERMATA_MASK

    // Modify the duration in place for a fermata,
    // So the rest of the logic with the delta accumulator follows.

    if(!!hasFermata)
      xmlNote.duration *= FERMATA_HOLD

    // Note that fermata and non-zero divisors should not overlap :
    // A note should not be both fermata and staccato,
    // Because it can't be both longer and shorter.

    // Divide by 2 (1 << 1) for staccato, by 4 (2 << 1) for staccatissimo.
    const divisor = (this.articulationFlags & DURATION_MASK) << 1
    return (divisor > 0 ? xmlNote.duration / divisor : xmlNote.duration)
  }

  manageNoteArticulations(xmlNote, signalFermata = true) {
    if(!xmlNote.chord) {
      if(!this.preserveArticulation) this.articulationFlags = 0
      else this.preserveArticulation = false

      // Fermata are not grouped with articulations,
      // but are instead direct children of the notation node.
      // I don't really know why.

      const notations = xmlNote.notations

      if(!!notations?.find(notation => !!notation.fermatas)) {
        // Hacky way to avoid doing this twice, since the function is called for both on and off
        // TODO : Why is that the case ??
        if(signalFermata) this.signalFermata(xmlNote)

        this.articulationFlags |= FERMATA_FLAG
      }

      const articulations = xmlNote.notations?.find(notation => !!notation.articulations)?.articulations

      if(!articulations) return

      if(!!articulations.find(articulation => !!articulation.staccato))
        this.articulationFlags |= STACCATO_FLAG
      else if(!!articulations.find(articulation => !!articulation.staccatissimo))
        this.articulationFlags |= STACCATISSIMO_FLAG

      if(!!articulations.find(articulation => !!articulation.accent))
        this.articulationFlags |= ACCENT_FLAG
      else if(!!articulations.find(articulation => !!articulation.strongAccent))
        this.articulationFlags |= MARCATO_FLAG
    }
  }

  // Grace notes have no built-in duration.
  // This constructs one for them, so the parser logic can treat them just like other notes.

  resolveGraceNoteDurations({ graceNoteSequence, followingXmlNote, previousXmlNote }) {

    this.lastAnalyzedGraceNoteSequence = graceNoteSequence

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

    // I don't think making it a set will improve performance that much,
    // Because grace note sequences are very short arrays.
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
      // TODO : rather than this system, which changes their duration based on the principal
      // (Like ordinary grace notes)
      // They should always last 0.25 * divisions (= a sixteenth note)
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

    // The previous note, if extant, has already been parsed.
    // Hence, it's the MIDI note off event that must be modified.

    const { previousNoteOff, start, duration } = { ...this.xmlNotesToNoteOffEvents.get(previousXmlNote) }
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
      this.currentDelta -= duration * stolenPrevious
    }

    if(!!followingXmlNote) {

      // Since the following note hasn't been parsed yet,
      // its duration can simply be changed in place.

      followingXmlNote.duration *= 1 - stealTimeFollowing.filter(
        (_, index) => !chordGraceNoteIndices.includes(index)
      ).reduce(
        (acc, curr) => acc + curr, 0
      )

      // For beat tracking purposes, it is important to ensure that the grace note sequence
      // Leaves the accumulator exactly as it would have been without it.

      // This means : ensure that the sum of grace note durations
      // Is equal to the eventual reached value of the accumulator after the sequence ends.

      const sequenceDuration = graceNoteSequence.filter(
        (_, index) => !chordGraceNoteIndices.includes(index)
      ).reduce(
        (acc, curr) => acc + curr.duration, 0
      )

      followingXmlNote.intendedStartDelta = this.currentDelta + sequenceDuration
    }
  }

  // ---------------------------------------------------------------------------
  // -------------------------- FINAL OPERATION --------------------------------
  // ---------------------------------------------------------------------------

  // Event deltas are only converted to relative at the very end of the parsing process.

  convertEventsToRelative() {
    this.#events.sort((eventA, eventB) => eventA.delta - eventB.delta)

    let refDelta = this.#events[0].delta

    this.#events.forEach(event => {
      const absDelta = event.delta
      event.delta = event.delta - refDelta
      if(absDelta != refDelta) refDelta = absDelta
    })
  }
}
