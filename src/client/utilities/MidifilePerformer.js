import EventEmitter         from 'events';
import { parseArrayBuffer } from 'midi-json-parser';
import { encode }           from 'json-midi-encoder';
import MidiPlayer           from 'midi-player-js';
import Performer            from 'midifile-performer';

import { convertChronologyToNoteSequence, getSetUtil } from './NoteSequenceUtils'

const chordDeltaMsDateThreshold = 20;

// typedefs ////////////////////////////////////////////////////////////////////

/**
 * @typedef midiEvent - An object with at least a delta field representing a MIDI event
 * @type {object}
 * @property {number} delta - Delta time with the previous event in ticks
 *
 * @typedef midiJson - An object containing all the useful information from a MIDI file
 * @type {object}
 * @property {number} division - PPQ (ticks per quarter) of the MIDI file
 * @property {number} type - MIDI file type : 0, 1 or 2
 * @property {midiEvent[][]} tracks - An array of arrays of {@link midiEvent} objects
 */

const PRETEND_TRIGGER = 42
const WAIT = 50
const TRIGGER_NEXT = 60


// parsing /////////////////////////////////////////////////////////////////////

/**
 * We make a copy of the buffer argument to prevent modifications, and we parse
 * the copy with parseArrayBuffer (which will leave the copy in a transferred
 * and detached state)
 * @param buffer - A MIDI ArrayBuffer
 * @returns {midiJson} a {@link midiJson} object
 */

async function parseMidiArrayBuffer(buffer) {
  const bufferCopy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(bufferCopy).set(new Uint8Array(buffer));

  const json = await parseArrayBuffer(bufferCopy);
  return Promise.resolve(json);
}

// converting delta times from ticks to (tempo-inferred) milliseconds //////////

/**
 * We want to compute the absolute date or global delta time in milliseconds
 * for all events in a SMF (Standard MIDI File)
 *
 * This is required to provide a correct dt value when calling
 * performer.pushEvent(dt, noteData) and to enable playback of the chronology.
 *
 * A SMF provides a division and a tempo parameter.
 * - Assuming the division is in PPQ (not frames per second) unit,
 *   it represents the number of pulses/ticks per quarter/beat.
 * - The tempo represents the number of microseconds per quarter/beat, has a
 *   default value of 500000, and can vary over time when setTempo events
 *   occur.
 *
 * In short : current tick duration in microseconds = current tempo / division
 *
 * NB : the time signature of the file, and eventual further time signature
 * events in the file, are not involved in computing a tick's duration (right ?)
 * see : https://www.recordingblogs.com/wiki/time-division-of-a-midi-file
 *
 * Problem :
 * Many SMFs have several tracks, and the delta times of all the events in a
 * track follow their own timeline, specific to this track.
 * Plus we have to take setTempo events into account, which make the
 * duration of a tick vary over time, and can occur anytime in any track.
 *
 * Solution :
 * - compute the absolute date in ticks for each event of interest (setTempo,
 *   noteOn and noteOff), in each track.
 * - sort all these events by absolute date in ticks.
 * - iterate over the sorted events to reconstruct tempo-independent delta times
 *   in whatever unit (us, ms, ...)
 *
 * NB : only format 1 files will work for now because events of different tracks
 * are merged as if they were simultaneous. Handling format 2 would require to
 * modify the mergeTracks function a little bit : accumulate all deltas instead
 * of resetting them to zero on each track
 */
function mergeTracks({ division, format, tracks }) {
  const defaultMicroSecondsPerQuarter = 500000;
  const defaultTickDuration = Math.floor(
    defaultMicroSecondsPerQuarter / division
  );

  const allEvents = [];

  tracks.forEach((track, i) => {
    let tickDate = 0;

    track.forEach(obj => {
      tickDate += obj.delta;

      if (obj.hasOwnProperty('setTempo')) {
        const { microsecondsPerQuarter } = obj.setTempo;
        const tickDuration = Math.floor(microsecondsPerQuarter / division);
        allEvents.push({
          tickDate, type: 'tempo',
          tickDuration
        });
      } else if (obj.hasOwnProperty('noteOn')) {
        const { channel, noteOn } = obj;
        const { noteNumber, velocity } = noteOn;
        allEvents.push({
          tickDate, type: 'note',
          on: velocity > 0, track: i, channel, noteNumber, velocity
        });
      } else if (obj.hasOwnProperty('noteOff')) {
        const { channel, noteOff } = obj;
        const { noteNumber, velocity } = noteOff;
        allEvents.push({
          tickDate, type: 'note',
          on: false, track: i, channel, noteNumber, velocity
        });
      }
      // if (
      //   !obj.hasOwnProperty('controlChange') &&
      //   !obj.hasOwnProperty('noteOn') &&
      //   !obj.hasOwnProperty('noteOff')
      // ) {
      //   console.log(obj);
      // }
    }); // track
  }); // tracks

  allEvents.sort((a, b) => {
    if (a.tickDate < b.tickDate) return -1;

    if (a.tickDate > b.tickDate) return 1;

    if (a.tickDate === b.tickDate) { // make sure tempo events always come first
      if (a.type === 'tempo' && !b.type === 'tempo') return -1;
      if (!a.type === 'tempo' && b.type === 'tempo') return 1;
    }

    return 0;
  });

  const allNoteEvents = [];

  // in case there is no tempo definition in the file
  let tickDuration = defaultTickDuration;
  let prevTickDate = 0;
  let msDate = 0;
  let prevMsDate = 0;

  allEvents.forEach((e, i) => {
    // reconstruct delta times in ticks and convert them to milliseconds :
    // (tick dates and tickDuration are guaranteed to be integers)
    const msDelta = (e.tickDate - prevTickDate) * tickDuration * 0.001;
    msDate += msDelta;

    switch (e.type) {
      case 'note':
        const { type, tickDate, ...allOthers } = e;
        allNoteEvents.push({ delta: msDate - prevMsDate, ...allOthers });
        prevMsDate = msDate;
        break;
      case 'tempo':
        // we don't update prevMsDate so that delta times are only computed
        // for note events
        tickDuration = e.tickDuration;
        break;
      default:
        break;
    }

    prevTickDate = e.tickDate;
  });

  return allNoteEvents
}

/**
 * Convert a C++-WASM vector of noteData to an array of JS objects.
 * Used by MidifilePerformer.loadMidifile when setting up the note events
 * callback : this.performer.setNoteEventsCallback(() => { ... });
 */
function noteEventsFromNoteDataVector(notes) {
  const res = [];
  for (let i = 0; i < notes.size(); ++i) {
    const e = notes.get(i);
    const { on, pitch, velocity, channel } = e;
    res.push({ on, pitch, velocity, channel });
  }
  return res;
}

class InterruptionGuard {
  constructor(dt, startTimeStamp) {
    // we can interrupt something longer than a second ;
    // interruption matters with delays between ordinary notes
    this.dt = Math.min(dt, 1000) || 0;
    this.startTimeStamp = startTimeStamp || Date.now();
  }

  playbackInterruptionStatus() {
    const timeElapsed = Date.now() - this.startTimeStamp

    if(timeElapsed < this.dt / 2) return PRETEND_TRIGGER // Too early to move on : pretend the performed key triggered the last playback starting set
    else if(this.dt / 2 <= timeElapsed && timeElapsed < this.dt) return WAIT // Too late to pretend : wait until interruption is acceptable
    else return TRIGGER_NEXT // Proceed with performing next starting set
  }
}

class AutoPlaybackSemaphore {
  #semaphore = 0

  isClear(offset = 1) {
    // console.log("Semaphore is", this.#semaphore)
    return this.#semaphore <= (0 + offset)
  }

  update(command) {
    this.#semaphore += command.pressed ? 1 : -1
    // console.log("Semaphore is", this.#semaphore)
  }

  reset() {
    // console.log("Reset semaphore")
    this.#semaphore = 0
  }
}

/* * * * * * * * * * * * MIDI FILE PERFORMER PLAYER CLASS * * * * * * * * * * */

class MidifilePerformer extends EventEmitter {

  #chronology = null;

  // Mostly, MusicXMLs are processed identically to other MIDI files,
  // However in their case, they can also be performed by the measure (with auto-playback),
  // Whereas MIDI files cannot ;
  // Hence keeping track of the file type is needed.

  #isFileMusicXml = false;
  #measureStartingSetIndices = null;
  #beatSetIndices = null;

  #playbackTriggerDescription = null;
  #playbackTriggers = new Set();
  #noInterruptFlag = false;
  #noRenderFlag = false;
  #autoPlaybackSemaphore = null;

  #storeCommandFlag = false;
  #storedUntriggeredCommand = null;

  constructor() {
    super();
    this.performer = null;

    this.index = 0;
    this.playbackSpeed = 1;

    this.mode = 'silent'; // could be 'listen' or 'perform'

    this.interruptionGuard = new InterruptionGuard() // watcher to avoid cutting an automatic starting set too soon
    this.pendingEndSet = [] // end set for the currently automatically playing starting set ; will be appended to perform mode's first triggered set

    this.preferredVelocityStrategy = "clippedScaledFromMax"
    this.conserveVelocity = true
    this.performVelocitySaved = false;
    this.maxVelocities = [];
    this.velocityProfile = [];

    this.#autoPlaybackSemaphore = new AutoPlaybackSemaphore()
  }

  async initialize() {
    this.mfp = await Performer();

    this.vanillaPerformer = new this.mfp.Performer({
      unmeet: true,
      complete: false,
      // we can't simply use pitch-only shifting : for unclear reasons, it creates additional staccato
      shiftMode: this.mfp.shiftMode.pitchAndChannel,
      temporalResolution: chordDeltaMsDateThreshold,
    });

    this.constructInnerPerformer()
  }

  constructInnerPerformer(options) {

    let loopingBeforeSet, velocityStrategyBeforeSet

    if(!!options) {
      loopingBeforeSet = this.#getLooping()
      velocityStrategyBeforeSet = this.currentVelocityStrategy

      this.performer = new this.mfp.Performer({
        unmeet: options.unmeet,
        complete: options.complete,
        shiftMode: this.mfp.shiftMode.pitchAndChannel,
        temporalResolution: options.temporalResolution,
      })
    }

    else {
      loopingBeforeSet = true
      velocityStrategyBeforeSet = "sameForAll"
      this.performer = this.vanillaPerformer
    }

    this.#resetInnerPerformerNonConstructorParameters(loopingBeforeSet, velocityStrategyBeforeSet)
  }

  async loadMidifile(jsonOrBuffer, isBuffer = true) {
    // this.emit('allnotesoff');
    this.#isFileMusicXml = false
    this.#chronology = null

    const midiJson = isBuffer ? await parseMidiArrayBuffer(jsonOrBuffer) : jsonOrBuffer;

    if(!isBuffer) { // Arrays and maps of absolute-delta events are included in midi JSONs parsed from MusicXML files.
      // They are for the OSMD visualizer. Pass them along.
      this.#isFileMusicXml = true
      this.emit('musicXmlTempos', jsonOrBuffer.tempoEvents)
      this.emit('musicXmlChannels', jsonOrBuffer.channelChanges)
      this.emit('musicXmlGraceNoteInfo', jsonOrBuffer.graceNoteInfo)
      this.emit('musicXmlArpeggioInfo', jsonOrBuffer.arpeggioInfo)
    }

    const allNoteEvents = mergeTracks(midiJson);

    // FEED THE PERFORMER //////////////////////////////////////////////////////

    this.performer.clear();

    // we only manipulate channels between 1 and 16
    // we set them directly here when parsing the MIDI file and we set them
    // back to between 0 to 15 just before sending the MIDI events out in
    // IOController.js
    allNoteEvents.forEach(e => {
      const { delta, on, noteNumber, velocity, channel } = e;
      // console.log(e);
      this.performer.pushEvent(delta, {
        on,
        pitch: noteNumber,
        velocity,
        channel: channel + 1,
      });
    });

    this.performer.finalize();

    // GENERATE VELOCITY PROFILE ///////////////////////////////////////////////

    this.#chronology = this.#getChronology()
    const { maxVelocities, velocityProfile } = this.#createVelocityProfile();

    this.maxVelocities = maxVelocities
    this.velocityProfile = velocityProfile

    // DEFINE CALLBACK TO RENDER METHOD ////////////////////////////////////////
    // TODO : why is this done every time we load and not at construction time ?
    // is this because the lib binds the events callback to the chronology ?
    // TODO : OUTSOURCE this massive function to a non-lambda,
    // But this will require amending the wrapper.

    this.performer.setNoteEventsCallback(notes => {
      // console.log("Rendering")
      const receivedNotes = noteEventsFromNoteDataVector(notes)
      const notesToEmit = this.mode === 'perform' ? [...this.pendingEndSet, ...receivedNotes] : receivedNotes

      const isStartingSet = notesToEmit.filter(note => note.on).length > 0

      // This was lifted from #playNextSet(), where it was called immediately after render,
      // Thereby transmitting the wrong index immediately rather than waiting.
      if (isStartingSet) this.emit('index', this.#getCurrentIndex());

      // console.log("Emitting", notesToEmit)
      this.emit('notes', notesToEmit)

      // Prevent triggering the pending ending set more than once

      // Do it here rather than in command() after this callback ends ;
      // Otherwise the wrong set gets dropped on auto-listen.

      if(this.mode === 'perform') {
        // console.log("Emptying pending end set (was ", this.pendingEndSet, ")")
        this.pendingEndSet = []
      }

      if(notesToEmit.length > 0 && this.mode === 'perform' || isStartingSet) {
        // in passive playback, only redraw on note on's
        // in perform, note offs may dynamically cancel, so redraw on both
        this.emit('visualizerRefresh', {
          isStartingSet: isStartingSet,
          referenceSetIndex: this.#getCurrentIndex()
        })
      }

      // This block acts together with #updateIndexOnModeShift,
      // to ensure proper mode transition around loop boundaries.
      // Sadly, it's not enough to update the index as the mode shifts :
      // it must also be done when the index is reached via rendering.

      if(this.mode!=="silent" && !this.performer.stopped()) { // Technically the check against stopped is redundant since we're not stopping the performer anymore
        if(this.#getCurrentIndex() === this.#getLoopEndIndex())
          this.endAlreadyPlayed = true;
        else if(this.#getCurrentIndex() === this.#getLoopStartIndex()) {
          this.startAlreadyPlayed = true;
          this.endAlreadyPlayed = false; // yes, this is necessary, or else jumping to the end will be buggy
        }
        else {
          this.startAlreadyPlayed = false;
          this.endAlreadyPlayed = false;
        }
      }

      // console.log("NoTriggerModeSwitch:", this.noTriggerModeSwitch)

      // Manage mode auto-switch (based on provided playback triggers)

      // After an index jump, e.g. by clicking the visualizer or moving the transport bar,
      // Auto-switch should never happen.
      if(this.noTriggerModeSwitch) {

        // In the case of autoplayed notes, it's necessary to kill sound manually without relying on the lib
        // Because the AVS returns no off events regarding them.
        // By extension, this applies on top of the existing off events sent for ordinary index updates.
        if(this.#getCurrentIndex() !== this.#getLoopStartIndex()) this.emit('allnotesoff')

        // The flag will be set back to true if we jump again.
        this.noTriggerModeSwitch = false
      } else {

        // Evaluate conditions that could lead to mode switch.
        // See methods in question for their formulation.

        // Auto-listen scheduling happens on keydown,
        // Not release as was previously programmed.
        if(isStartingSet && this.#shouldTriggerAutoListen()) {
          // console.log(true)
          // console.log("Auto switch to listen")

          // Unset this flag : otherwise, jumping in perform mode
          // Will repeat the last perform set when enabling auto-listen
          // Do it here rather than in setMode too ;
          // Otherwise it would happen after updateIndex = too late
          if(this.repeatIndexFromJump) this.repeatIndexFromJump = false

          this.#scheduleAutoListen()
        } else if(this.#shouldEndAutoListen()) {
          if(isStartingSet) {
            // console.log("Activating command store")
            this.#storeCommandFlag = true
          }

          else {
             // console.log("Auto switch to perform")
             this.#storeCommandFlag = false
             this.setMode('perform', true)
          }
        }
      }

      // Finally, manage reaching the end of the sequence with looping disabled.

      if(
        !this.#getLooping() &&
        this.#getCurrentIndex() === this.#getLoopEndIndex() &&
        this.#areSameEventSets(notesToEmit, noteEventsFromNoteDataVector(this.#getCurrentSetPair().end.events))
      ) {
        this.setMode("silent")
      }
    });

    // SET FLAGS ///////////////////////////////////////////////////////////////

    this.performer.setLoopIndices(0, this.performer.size() - 1);
    this.setSequenceIndex(0); // TODO : replace with #innerSetSequenceIndex ?
    this.startAlreadyPlayed = false;
    this.endAlreadyPlayed = false;
    this.performVelocitySaved = false;

    // Always reset playback triggers.

    this.#playbackTriggers = new Set();

    // Do not preserve channel-based playback triggering between files.
    // Preserve tempo-based triggering,
    // But since it is only possible in MusicXML files, test for that first.

    if(
      this.#playbackTriggerDescription?.triggerType === 'channels' ||
      (
        (
          !this.#isFileMusicXml &&
          this.#playbackTriggerDescription?.triggerType === 'tempo'
        )
        ||
        // Additionally, deactivate tempo-based play when a file is uplodaded
        // Where it is not possible, because it has no measures or beats to play by
        // (This is known as free meter)
        (
          this.#isFileMusicXml &&
          (
            !jsonOrBuffer.hasMeasures &&
            this.#playbackTriggerDescription?.triggerCriteria === "measure"
          )
          ||
          (
            !jsonOrBuffer.hasBeats &&
            this.#playbackTriggerDescription?.triggerCriteria === "beat"
          )
        )
      )
    ) {
      this.#playbackTriggerDescription = null
      // Ensure that when switching to a file where tempo triggers are forcibly reset,
      // They are updated on the app side.
      // Otherwise, visualizers will wrongly paint notes in the autoplay colors.
      // This is not necessary for channel-based trigger reset, 
      // Because these are initiated *by* the app (@MFP.vue).
      this.emit('playbackTriggers', this.#playbackTriggers)

      // Re-enable channel perform selection,
      // In case we had it disabled in the previously loaded MusicXML
      this.emit('enablePerformChoice')
    }

    // ... in-between calculations ... /////////////////////////////////////////

    const noteSequenceInfo = convertChronologyToNoteSequence(this.#chronology)

    if(this.#isFileMusicXml) {
      this.#measureStartingSetIndices = jsonOrBuffer.hasMeasures ? new Set(
        // We could also use map() on the chronology ;
        // The result is exactly the same, by virtue of what setStarts *is*.
        noteSequenceInfo.setStarts.map((_, index) => {
          const set = getSetUtil(
            index,
            noteSequenceInfo.noteSequence,
            noteSequenceInfo.setStarts,
            noteSequenceInfo.setEnds
          )

          return set.some(note => jsonOrBuffer.measureStartIndices.has(note.index)) ?
            index : null
        }).filter(
          indexOrNull => indexOrNull !== null
        )
      ) : new Set()

      this.#beatSetIndices = jsonOrBuffer.hasBeats ? new Set(
        noteSequenceInfo.setStarts.map((_, index) => {
          const set = getSetUtil(
            index,
            noteSequenceInfo.noteSequence,
            noteSequenceInfo.setStarts,
            noteSequenceInfo.setEnds
          )

          return set.some(note => jsonOrBuffer.beatIndices.has(note.index)) ?
            index : null
        }).filter(
          indexOrNull => indexOrNull !== null
        )
      ) : new Set()

      this.emit('disableMeasurePlay', !jsonOrBuffer.hasMeasures)
      this.emit('disableBeatPlay', !jsonOrBuffer.hasBeats)
    } else {
      this.#measureStartingSetIndices = null
      this.#beatSetIndices = null
    }

    // NOTIFY CHANGES TO CONSUMERS /////////////////////////////////////////////

    this.emit('sequence', {
      length: this.performer.size(),
      start: this.#getLoopStartIndex(),
      end: this.#getLoopEndIndex(),
    });

    this.emit(
      'noteSequenceInfo',
      noteSequenceInfo
    )

    if(this.#playbackTriggerDescription?.triggerType === "tempo")
      this.updatePlaybackTriggers(this.#playbackTriggerDescription)
  }

  clear() {
    this.performer.clear();
  }

  setSequenceIndex(sequenceIndex, killSound = true) {
    this.#innerSetSequenceIndex(sequenceIndex, killSound)
    this.emit('userChangedIndex', this.index)
  }

  markIndexJump() {
    this.repeatIndexFromJump = true
    this.noTriggerModeSwitch = true
  }

  setSequenceBounds(min, max) {
    const previousIndex = this.#getCurrentIndex()
    this.performer.setLoopIndices(min, max);
    this.index = this.#getCurrentIndex();

    this.emit('sequence', {
      length: this.performer.size(),
      start: this.#getLoopStartIndex(),
      end: this.#getLoopEndIndex(),
    });

    this.emit('index', this.index);
    if(this.index !== previousIndex) this.emit('userChangedIndex', this.index)
  }

  setLooping(l) {
    this.performer.setLooping(l);
  }

  setPlaybackSpeed(s) {
    this.playbackSpeed = s
    this.emit('speed', s)
  }

  setPreferredVelocityStrategy(s) {
    this.preferredVelocityStrategy = s
    if(this.mode === "perform" || (this.mode === "listen" && this.conserveVelocity && this.performVelocitySaved))
      this.#setChordVelocityMappingStrategy(s)
  }

  setConserveVelocity(c) {
    this.conserveVelocity = c
    if(this.mode === "listen") {
      if(c && this.performVelocitySaved) this.#setChordVelocityMappingStrategy(this.preferredVelocityStrategy)
      else this.#setChordVelocityMappingStrategy("none")
    }
  }

  setMode(mode, toggleNoInterrupt = false) {
    // console.log("Setting mode to", mode)
    if (mode === this.mode) {
      // Edge case : toggleListen() called while in auto-playback
      // The intuitive response is to then *stay* in listen mode,
      // But the ordinary type.
      if(this.#noInterruptFlag && toggleNoInterrupt) this.#noInterruptFlag = false
      return;
    }

    const previousMode = this.mode
    this.mode = mode;

    // Historically the performer was stopped on mode shift
    // This doesn't seem necessary anymore

    // if (!this.performer.stopped()) {
    //   this.performer.stop();
    // }

    // Handle transition from listen mode
    //

    if(this.timeout && previousMode === "listen") {
      // console.log("Clearing timeout", this.timeout)
      clearTimeout(this.timeout);
      this.timeout = null;

      // This flag is ESSENTIAL to mode auto-switch.
      // Without it, nested timeouts, which cannot be cancelled by the above instructions,
      // May keep firing listen mode out of control.
      // However, it is unnecessary and in fact causes bug for ordinary playback,
      // So it's only set if auto playback was active.

      if(this.mode === 'perform' && this.#noInterruptFlag) this.#noRenderFlag = true
    }

    if(this.mode !== 'listen' || !toggleNoInterrupt) this.#autoPlaybackSemaphore.reset()

    this.#updateIndexOnModeShift()

    if (this.mode === 'listen') {

      if(toggleNoInterrupt) {
        this.#noInterruptFlag = true
        this.#noRenderFlag = false
      }

      this.#setChordVelocityMappingStrategy(
        this.conserveVelocity && this.performVelocitySaved ?
          this.preferredVelocityStrategy :
          "none"
      );

      let pair; // carry the pair information between calls ; otherwise delays are shifted

      this.#playNextSet(pair, true, true);
    }

    if (this.mode === 'perform') {

      if(toggleNoInterrupt) this.#noInterruptFlag = false

      if(!toggleNoInterrupt && this.interruptionGuard.playbackInterruptionStatus() === PRETEND_TRIGGER)
        this.pretendTriggerFlag = true

      else while(this.interruptionGuard.playbackInterruptionStatus() === WAIT) {
          console.log("Active wait") // maybe there's something more productive to do while waiting ?
      }

      this.#setChordVelocityMappingStrategy(this.preferredVelocityStrategy);

      // if(!!this.#storedUntriggeredCommand) console.log("Triggering stored command")
      this.command(this.#storedUntriggeredCommand, true)
      this.#storedUntriggeredCommand = null
    }

    if (this.mode === 'silent') {
      this.#noInterruptFlag = false
      this.emit('allnotesoff');
    }

    this.emit('mode', this.mode)
    this.emit('autoplay', this.#noInterruptFlag)
  }

  toggleListen() {
    this.setMode(
      // When in auto playback, the user still feels like they're in perform mode.
      // Hence, toggling must bring them to listen, as it would on a non-playback set,
      // Not silent.
      this.mode === 'listen' && !this.#noInterruptFlag ? 'silent' : 'listen',
      this.#noInterruptFlag
    )
  }

  command(cmd, noUpdateSemaphore = false) {
    // command : { pressed, id, velocity, channel }
    // note : { on, pitch, velocity, channel }

    // console.log("MFP command, pressed = ", cmd?.pressed)

    // console.log("Repeat index flag", this.repeatIndexFromPretendTrigger)

    if(!cmd) return

    if(this.#noInterruptFlag) {
      // console.log("Interrupt attempt ignored")

      if(this.#storeCommandFlag && cmd.pressed) {
        // console.log("Store command for later trigger")
        this.#storedUntriggeredCommand = cmd
      }

      return
    }

    // key releases can never trigger perform mode
    if(this.mode !== 'perform' && cmd.pressed)
      this.setMode('perform')

    // From this point onwards, #noInterruptFlag is guaranteed to be false.

    if(!noUpdateSemaphore) {
      // console.log("Updating semaphore")
      this.#autoPlaybackSemaphore.update(cmd)
    }

    const res = [];
    if ((this.mode !== 'perform' && cmd.pressed) || this.pretendTriggerFlag) {
      // Ensure we do not do this more than once
      this.pretendTriggerFlag = false;
      // Indicate to listen mode that pretendTrigger was performed,
      // And thus that it should repeat this index if it resumes there
      if(!this.#noInterruptFlag) this.repeatIndexFromPretendTrigger = true;
      // console.log("Return early from pretend trigger")
      return res;
    }

    // this.emit('index', this.index);

    if(
      !cmd.pressed
      ||
      (cmd.pressed &&
        // Ensure the last perform keydown will not overstep the index into autoplay set
        (!this.#playbackTriggerReached() || this.#autoPlaybackSemaphore.isClear())
      )
    ) {
      // console.log("Begin render")
      this.performer.render(cmd);
    }

    if (cmd.pressed) {
      // Releasing the key does not change the index
      // So this flag only becomes false on key press
      this.repeatIndexFromPretendTrigger = false;
      this.emit('index', this.#getCurrentIndex()); // TODO : is this still needed now that this emit is present in the render callback ?

      if(!this.performVelocitySaved) this.performVelocitySaved = true;
      this.#refreshMaxVelocities(cmd.velocity)
    }
  }

  // ---------------------------------------------------------------------------
  // ---------------------------PRIVATE METHODS---------------------------------
  // ---------------------------------------------------------------------------

  // Util for performer reconstruction

  #resetInnerPerformerNonConstructorParameters(looping, strategy) {
    this.#setChordVelocityMappingStrategy(strategy);
    this.performer.setLooping(looping);
  }

  // Wrapping methods
  // Most of them are direct returns, but at any point we might want to wrap logic around it
  // (such as the #getNextIndex() method)

  #getCurrentSetPair() {
    return this.performer.getCurrentSetPair()
  }

  #getCurrentIndex() {
    return this.performer.getCurrentIndex()
  }

  // Ensure we stay within bounds at the loop end, even if it's the end of the track

  #getNextIndex() {
    const currentIndex = this.#getCurrentIndex()
    const loopEnd = this.#getLoopEndIndex()
    return this.#getLooping() ?
      (currentIndex + 1) % (loopEnd + 1) :
      (currentIndex < loopEnd ? currentIndex : loopEnd)
  }

  #getLoopStartIndex() {
    return this.performer.getLoopStartIndex()
  }

  #getLoopEndIndex() {
    return this.performer.getLoopEndIndex()
  }

  #getLooping() {
    return this.performer.getLooping()
  }

  // Translate the C++ Chronology into an array of sets,
  // With each set having its inner vector translated into a JS object.
  // Also dissassociate the pairs, leaving sets equal.

  #getChronology() {
    const chronology = this.performer.getChronology().getContainer()
    const translatedChronology = []

    for(let i = 0; i < chronology.size(); i++) {
      const pair = chronology.get(i)
      const start = pair.start
      const end = pair.end

      const translatedStart = {type: "start", dt: start.dt, events: noteEventsFromNoteDataVector(start.events)}
      const translatedEnd = {type: "end", dt: end.dt, events: noteEventsFromNoteDataVector(end.events)}

      translatedChronology.push(translatedStart)
      translatedChronology.push(translatedEnd)
    }

    return translatedChronology
  }

  #setChordVelocityMappingStrategy(strategyName) {
    this.currentVelocityStrategy = strategyName
    this.performer.setChordVelocityMappingStrategy(this.mfp.chordStrategy[this.currentVelocityStrategy])
  }

  #innerSetSequenceIndex(sequenceIndex, killSound) {
    this.index = this.performer.setCurrentIndex(sequenceIndex, killSound);
    this.emit('index', this.index);
  }

  /**
   * Determine triggers for automatic playback in partial perform mode.
  **/

  updatePlaybackTriggers(triggerDescription) {
    const {triggerType, triggerCriteria} = triggerDescription

    this.#playbackTriggers = new Set()
    this.#playbackTriggerDescription = triggerDescription

    if(triggerType === 'tempo') {
      if(!this.#isFileMusicXml) {
        console.warn('ERROR : attempted setting tempo-based triggers on MIDI file')
        console.warn('Tempo-based triggers are only valid for MusicXML files')
        console.warn('Ignoring and setting no triggers')

        this.#playbackTriggerDescription = null

        return
      }

      if(this.#playbackTriggerDescription.triggerCriteria === 'all') {
        this.emit('playbackTriggers', this.#playbackTriggers)
        return
      }

      const relevantIndices =
        this.#playbackTriggerDescription.triggerCriteria === 'measure' ?
          this.#measureStartingSetIndices :
          this.#beatSetIndices

      if(!relevantIndices) {
        console.warn(
          `Trying to get ${this.#playbackTriggerDescription.triggerCriteria}-based \
          playback triggers from nonexistent ${this.#playbackTriggerDescription.triggerCriteria} info`
        )
        console.warn("This should not happen !")
        console.warn("Ignoring request and resetting playback triggers.")
        return new Set()
      }

      this.#playbackTriggers = new Set(
        this.#chronology.filter(
          set => set.type === "start"
        ).map(
          (_, index) => relevantIndices.has(index) ? null : index
        ).filter(
          indexOrNull => indexOrNull !== null
        )
      )
    }

    else if(triggerType === 'channels') {

      // Was used only in testing.
      // With the actual implementation, the default criteria lists all channels, not none
      // So this is no longer true.
      // if(triggerCriteria.size === 0) return

      const playbackChannels = new Set(
        Array.from({length: 16}, (_, index) => index + 1)
      ).difference(triggerCriteria)

      this.#playbackTriggers = new Set(
        this.#chronology.filter(
          set => set.type === "start"
        ).map((set, index) =>
          {
            return set.events.filter(
              event => event.on
            ).every(
              event => playbackChannels.has(event.channel)
            ) ?
              index : null
          }
        ).filter(indexOrNull => indexOrNull !== null)
      )
    }

    this.emit('playbackTriggers', this.#playbackTriggers)

    // console.log("Playback set indices : ", this.#playbackTriggers)
  }

  /**
   * Keep track of the ratio between each set's velocity and the max velocity of the piece.
   * This is used to conserve velocity variations when using passive playback
   * with a non-null chord velocity mapping
  **/

  #createVelocityProfile() {
    const localMaximums =
      this.#chronology.filter(set => set.type === "start")
        .map(startingSet => startingSet.events)
        .map(set =>
          Math.max(...set.filter(event => event.on).map(event => event.velocity))
        )
    const maxVelocity = Math.max(...localMaximums)

    return {
      maxVelocities : localMaximums,
      velocityProfile: localMaximums.map(localMaximum => localMaximum / maxVelocity)
    }
  }

  /**
   * On each new input, use the velocity profile to redetermine the local velocity for passive playback.
   * The next index is used, rather than the current one, because the effect begins at the first unplayed set,
   * i.e. the set at nextIndex.
  **/

  #refreshMaxVelocities(commandVelocity) {
    const newMaxVelocity = commandVelocity / this.velocityProfile[this.#getNextIndex()]
    this.maxVelocities = this.velocityProfile.map(ratio => ratio * newMaxVelocity)
  }

  // Passive playback (listen) algorithm

  #playNextSet(pair, start, first) {
    if (this.performer.stopped()) return;

    if(this.#noRenderFlag) {
      // console.log("No render flag is true, not playing next set")
      this.#noRenderFlag = false
      return
    }

    // console.log("Playing next set")

    let dt = 0;
    if (start) {
      pair = this.performer.peekNextSetPair();
      dt = pair.start.dt;
      this.pendingEndSet = noteEventsFromNoteDataVector(pair.end.events)
    } else  {
      dt = pair.end.dt;
      // retain the pending set during this time, perform may still interrupt
      // better to trigger it twice than never
    }

    dt = first ? 0 : dt;

    // Fix "unstoppable playback" bug : no two timeouts at a time
    if(this.timeout) clearTimeout(this.timeout)

    this.timeout = setTimeout(() => {
      this.performer.render({
        pressed: start,
        id: 1,
        velocity: (
          start ?
            this.maxVelocities[this.#getNextIndex()] // render has not happened yet, so it's the next index we're after
            : 0
          ),
        channel: 1
      });

      // console.log("Set new timeout", this.timeout)

      // Ensure perform won't cut off a note too soon, nor move to the next one too early.
      // Ending sets can be interrupted just fine (right ?)
      this.interruptionGuard = new InterruptionGuard(start ? (dt + pair.end.dt) / this.playbackSpeed : 0)

      this.#playNextSet(pair, !start, false);
    }, dt / this.playbackSpeed);
  };

  // This ugly logic is due to edge cases around the start and loop indices.
  // When switching modes, we do not want the new mode to repeat the previous set.
  // This is simple for any non-boundary index : just advance by one.
  // But, if we're at the start or end, we do want to stay there to actually play it,
  // without repeating it on a mode shift.

  #updateIndexOnModeShift() {
    if(this.mode==="silent") {
      if (this.#getCurrentIndex() < this.#getLoopEndIndex()) {
        this.#innerSetSequenceIndex(this.#getCurrentIndex());
      }
    } else {
      const index = this.#getCurrentIndex()

      // If we are at the start and haven't played the start (resp. : end)...

      if((index === this.#getLoopStartIndex() && !this.startAlreadyPlayed)
        || (index === this.#getLoopEndIndex() && !this.endAlreadyPlayed)) {

          // ...then we must play that, first
          this.#innerSetSequenceIndex(this.#getCurrentIndex(), false);

          // and remember that it's done
          index === this.#getLoopStartIndex() ?
            this.startAlreadyPlayed = true : this.endAlreadyPlayed = true
        }

      // In special cases, the current index should be repeated

      else if(this.repeatIndexFromPretendTrigger || this.repeatIndexFromJump) {

        // PretendTrigger :
        // Perform pretended to trigger a set actually triggered by listen mode.
        // So the index already moved forward then, but it produced nothing.
        // If we're here, that means listen mode was set right after that,
        // and so we need to play the set at the index it was set to.

        if(this.repeatIndexFromPretendTrigger) this.repeatIndexFromPretendTrigger = false;

        // Jump :
        // The user set the current index here. So we want to play this.

        if(this.repeatIndexFromJump) this.repeatIndexFromJump = false;

        this.#innerSetSequenceIndex(this.#getCurrentIndex(), false);
      }

      else { // we need to play the next set (move forward, do not repeat the last one)
        this.#innerSetSequenceIndex(this.#getNextIndex(), false);
        // the boundaries have been exceeded
        this.startAlreadyPlayed = false;
        this.endAlreadyPlayed = false;
      }
    }
  }

  // TODO : compare performance to lodash.isEqual.

  #areSameEventSets(setA, setB, ignoreVelocity = false) {
    if(!setA || !setB) return false

    return setA.length === setB.length && setA.every((event, index) => {
      const eventB = setB[index]

      return event.on === eventB.on &&
        event.pitch === eventB.pitch &&
        (ignoreVelocity || event.velocity === eventB.velocity) &&
        event.channel === eventB.channel
    })
  }

  // Boolean triggers for mode auto-switch

  #playbackTriggerReached(when = "next") {
    return this.mode === 'perform' && // User was performing
    this.#playbackTriggers.has(when === "next" ? this.#getNextIndex() : this.#getCurrentIndex()) // We have reached a playback trigger
  }

  #shouldTriggerAutoListen() {
    return this.#playbackTriggerReached()
  }

  #shouldEndAutoListen() {
    return this.mode === 'listen' && // TODO : I think this is superfluous...
    this.#noInterruptFlag && // ...because this flag is here, and only ever set to true in auto-listen
    !this.#playbackTriggers.has(this.#getNextIndex()) // Of course, only hand back to perform if we are not on a playback trigger !
  }

  #scheduleAutoListen() {
    // Preemptively set this flag here.
    // Otherwise, there is a chance that the user will slip in before the setTimeouts,
    // Disturbing the process.
    // The flag will be set to true again in setMode, to no effect.
    this.#noInterruptFlag = true

    // dt for the ending set of the current pair
    const endDt = this.#getCurrentSetPair().end.dt
    // dt for the starting set of the next pair
    const startDt = endDt + this.performer.peekNextSetPair().start.dt

    // When the current pair's ending set should come,
    // Trigger *all* ending sets matching keys currently held

    setTimeout(() => {
      // getAllNoteOffs() brings all playing notes,
      // we want a new method that only ends notes which should end at this index
      this.emit('notes', noteEventsFromNoteDataVector(this.performer.getAllPendingNoteOffs()))
    }, endDt)

    // Then, begin auto-listen on the next starting set

    setTimeout(() => {
      this.setMode('listen', true)
    }, startDt /*/ this.playbackSpeed*/)
  }
}

export default new MidifilePerformer();
