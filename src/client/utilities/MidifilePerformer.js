import EventEmitter         from 'events';
import { parseArrayBuffer } from 'midi-json-parser';
import { encode }           from 'json-midi-encoder';
import MidiPlayer           from 'midi-player-js';
import Performer            from 'midifile-performer';
import AllNoteEventsAnalyzer from './AllNoteEventsAnalyzer';

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
  const allVisualizerNotes = []
  const visualizerNoteMap = new Map()

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
    this.dt = Math.min(dt,1000) || 0; // we can interrupt something longer than a second, it's about delays between ordinary notes
    this.startTimeStamp = startTimeStamp || Date.now();
  }

  playbackInterruptionStatus() {
    const timeElapsed = Date.now() - this.startTimeStamp

    if(timeElapsed < this.dt / 2) return PRETEND_TRIGGER // Too early to move on : pretend the performed key triggered the last playback starting set
    else if(this.dt / 2 <= timeElapsed && timeElapsed < this.dt) return WAIT // Too late to pretend : wait until interruption is acceptable
    else return TRIGGER_NEXT // Proceed with performing next starting set
  }
}

/* * * * * * * * * * * * MIDI FILE PERFORMER PLAYER CLASS * * * * * * * * * * */

class MidifilePerformer extends EventEmitter {
  constructor() {
    super();
    this.performer = null;
    this.analyzer = new AllNoteEventsAnalyzer();

    this.index = 0;
    this.playbackSpeed = 1;

    this.mode = 'silent'; // could be 'listen' or 'perform'

    this.interruptionGuard = new InterruptionGuard() // watcher to avoid cutting an automatic starting set too soon
    this.pendingEndSet = [] // end set for the currently automatically playing starting set ; will be appended to perform mode's first triggered set

    this.preferredVelocityStrategy = "clippedScaledFromMax"
    this.performVelocitySaved = false;
    this.maxVelocities = [];
    this.velocityProfile = [];
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
    const midiJson = isBuffer ? await parseMidiArrayBuffer(jsonOrBuffer) : jsonOrBuffer;

    if(!isBuffer) { // Arrays and maps of absolute-delta events are included in midi JSONs parsed from MusicXML files.
      // They are for the OSMD visualizer. Pass them along.
      this.emit('musicXmlTempos', jsonOrBuffer.tempoEvents)
      this.emit('musicXmlChannels', jsonOrBuffer.channelChanges)
    }

    const allNoteEvents = mergeTracks(midiJson);
    this.analyzer.analyze(allNoteEvents);

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

    const translatedChronology = this.#getChronology()
    const { maxVelocities, velocityProfile } = this.#createVelocityProfile(translatedChronology);

    this.maxVelocities = maxVelocities
    this.velocityProfile = velocityProfile

    // DEFINE CALLBACK TO RENDER METHOD ////////////////////////////////////////
    // TODO : why is this done every time we load and not at construction time ?
    // is this because the lib binds the events callback to the chronology ?

    this.performer.setNoteEventsCallback(notes => {
      const receivedNotes = noteEventsFromNoteDataVector(notes)

      const notesToEmit = this.mode === 'perform' ? [...this.pendingEndSet, ...receivedNotes] : receivedNotes
      this.emit('notes', notesToEmit)

      const isStartingSet = notesToEmit.filter(note => note.on).length > 0

      if(notesToEmit.length > 0 && this.mode === 'perform' || isStartingSet)
        // in passive playback, only redraw on note on's
        // in perform, note offs may dynamically cancel, so redraw on both
        this.emit('visualizerRefresh', {
          isStartingSet: isStartingSet,
          referenceSetIndex: this.#getCurrentIndex()
        })

      // This acts together with #updateIndexOnModeShift to ensure proper mode transition around loop boundaries.
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
    this.setSequenceIndex(0);
    this.startAlreadyPlayed = false;
    this.endAlreadyPlayed = false;
    this.performVelocitySaved = false;

    // NOTIFY CHANGES TO CONSUMERS /////////////////////////////////////////////

    this.emit('sequence', {
      length: this.performer.size(),
      start: this.#getLoopStartIndex(),
      end: this.#getLoopEndIndex(),
    });

    this.emit('chronology', translatedChronology)
  }

  clear() {
    this.performer.clear();
  }

  setSequenceIndex(sequenceIndex, killSound = true) {
    this.index = this.performer.setCurrentIndex(sequenceIndex, killSound);
    this.emit('index', this.index);
    this.emit('userChangedIndex', this.index)
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
  }

  setPreferredVelocityStrategy(s) {
    this.preferredVelocityStrategy = s
    if(this.mode === "perform" || (this.mode === "listen" && this.performVelocitySaved))
      this.#setChordVelocityMappingStrategy(s)
  }

  setMode(mode) {
    if (mode === this.mode) return;
    const previousMode = this.mode
    this.mode = mode;

    // Historically the performer was stopped on mode shift
    // This doesn't seem necessary anymore

    // if (!this.performer.stopped()) {
    //   this.performer.stop();
    // }

    this.#updateIndexOnModeShift()

    if (this.mode === 'listen') {

      this.#setChordVelocityMappingStrategy(
        this.performVelocitySaved ?
          this.preferredVelocityStrategy :
          "none"
      );

      let pair; // carry the pair information between calls ; otherwise delays are shifted

      this.#playNextSet(pair, true, true);
    }

    if (this.mode === 'perform') {

      // Handle transition from listen mode
      //

      if(this.interruptionGuard.playbackInterruptionStatus() === PRETEND_TRIGGER)
        this.pretendTriggerFlag = true

      else while(this.interruptionGuard.playbackInterruptionStatus() === WAIT) {
          console.log("Active wait") // maybe there's something more productive to do while waiting ?
      }

      if (this.timeout && previousMode === "listen") {
        clearTimeout(this.timeout);
        this.timeout = null;
      }

      this.#setChordVelocityMappingStrategy(this.preferredVelocityStrategy);
    }

    if (this.mode === 'silent') {
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }

      this.emit('allnotesoff');
    }

    // temporary !!
    // TODO : phase out with unification of mode state into store
    this.emit('isModeSilent', this.mode === 'silent')
  }

  command(cmd) {
    // command : { pressed, id, velocity, channel }
    // note : { on, pitch, velocity, channel }

    const res = [];
    if (this.mode !== 'perform' || this.pretendTriggerFlag) {
      // Ensure we do not do this more than once
      this.pretendTriggerFlag = false;
      // Indicate to listen mode that pretendTrigger was performed,
      // And thus that it should repeat this index if it resumes there
      this.repeatIndexFlag = true;
      return res;
    }

    // this.emit('index', this.index);
    this.performer.render(cmd);

    // Prevent triggering the pending ending set more than once

    this.pendingEndSet = []

    if (cmd.pressed) {
      // Releasing the key does not change the index
      // So this flag only becomes false on key press
      this.repeatIndexFlag = false;
      this.emit('index', this.#getCurrentIndex());

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

  /**
   * Read the chronology from the performer and keep track of the ratio between each set's velocity and the max velocity of the piece.
   * This is used to conserve velocity variations when using passive playback with a non-null chord velocity mapping
  **/

  #createVelocityProfile(chronology) {
    const localMaximums =
      chronology.filter(set => set.type === "start")
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

    if (this.performer.stopped()) return;

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

      if (start) this.emit('index', this.#getCurrentIndex());

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
        this.setSequenceIndex(this.#getCurrentIndex());
      }
    } else {
      const index = this.#getCurrentIndex()

      // If we are at the start and haven't played the start (resp. : end)...

      if((index === this.#getLoopStartIndex() && !this.startAlreadyPlayed)
        || (index === this.#getLoopEndIndex() && !this.endAlreadyPlayed)) {

          // ...then we must play that, first
          this.setSequenceIndex(this.#getCurrentIndex(), false);

          // and remember that it's done
          index === this.#getLoopStartIndex() ?
            this.startAlreadyPlayed = true : this.endAlreadyPlayed = true
        }

      else if(this.repeatIndexFlag) { // special case of perform mode interruption
        // It pretended to trigger a set actually triggered by listen mode.
        // So the index already moved forward then, but it produced nothing.
        // If we're here, that means listen mode was set right after that,
        // and so we need to play the set at the index it was set to.
        this.repeatIndexFlag = false;
        this.setSequenceIndex(this.#getCurrentIndex(), false);
      }

      else { // we need to play the next set (move forward, do not repeat the last one)
        this.setSequenceIndex(this.#getNextIndex(), false);
        // the boundaries have been exceeded
        this.startAlreadyPlayed = false;
        this.endAlreadyPlayed = false;
      }
    }
  }

  #areSameEventSets(setA, setB) {
    if(setA.length === 0) return setB.length === 0 // Don't forget : every() is true for any condition if the array is empty
    // And actually, can the last ending set even be empty ? I think not.
    // So we could just write setA.length !== 0 && every ...
    // ...but better safe than sorry.

    return setA.every((event, index) => {
      const eventB = setB[index]

      return event.on === eventB.on &&
        event.pitch === eventB.pitch &&
        event.velocity === eventB.velocity &&
        event.channel === eventB.channel
    })
  }
}

export default new MidifilePerformer();
