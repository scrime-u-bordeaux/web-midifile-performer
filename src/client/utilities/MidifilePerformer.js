import EventEmitter         from 'events';
import { parseArrayBuffer } from 'midi-json-parser';
import { encode }           from 'json-midi-encoder';
import MidiPlayer           from 'midi-player-js';
import Performer            from 'midifile-performer';

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

  return allNoteEvents;
}

/**
 * Another utility : generate midi note events from a vector of noteData.
 * Used by MidifilePerformer.loadArrayBuffer when setting up the note events
 * callback : this.performer.setNoteEventsCallback(() => { ... });
 */
function noteEventsFromNoteDataVector(notes) {
  const res = [];
  for (let i = 0; i < notes.size(); ++i) {
    const e = notes.get(i);
    const { on, pitch, velocity, channel } = e;
    res.push({
      event: on ? 'noteon' : 'noteoff',
      data: { noteNumber: pitch, velocity, channel }
    });
  }
  return res;
}

/* * * * * * * * * * * * MIDI FILE PERFORMER PLAYER CLASS * * * * * * * * * * */

class MidifilePerformer extends EventEmitter {
  constructor() {
    super();
    this.performer = null;

    this.index = 0;
    this.sequenceStartIndex = 0;
    this.sequenceEndIndex = 0;

    this.mode = 'silent'; // could be 'listen' or 'perform'
  }

  async initialize() {
    this.mfp = await Performer();

    this.performer = new this.mfp.Performer({
      unmeet: true,
      complete: false,
      shiftMode: this.mfp.shiftMode.pitchAndChannel,
      temporalResolution: chordDeltaMsDateThreshold,
    });
    this.performer.setChordVelocityMappingStrategy(
      this.mfp.chordStrategy.sameForAll,
      // this.mfp.chordStrategy.clippedScaledFromMax,
    );
    this.performer.setLooping(true);
  }

  async loadArrayBuffer(buffer) {
    // this.emit('allnotesoff');
    const midiJson = await parseMidiArrayBuffer(buffer);
    const allNoteEvents = mergeTracks(midiJson);

    // FEED THE PERFORMER //////////////////////////////////////////////////////

    this.performer.clear();
    
    // we only manipulate channels between 1 and 16
    // we set them directly here when parsing the MIDI file and we set them
    // back to between 0 to 15 just before sending the MIDI events out in
    // IOController.js
    allNoteEvents.forEach(e => {
      const { delta, on, noteNumber, velocity, channel } = e;
      console.log(delta);
      this.performer.pushEvent(delta, {
        on,
        pitch: noteNumber,
        velocity,
        channel: channel + 1,
      });
    });

    this.performer.finalize();

    this.performer.setNoteEventsCallback(notes => {
      const events = noteEventsFromNoteDataVector(notes);
      events.forEach(({ event, data }) => {
        this.emit(event, data);
      });
    });

    this.performer.setLoopIndices(0, this.performer.size() - 1);
    this.sequenceStartIndex = this.performer.getLoopStartIndex();
    this.sequenceEndIndex = this.performer.getLoopEndIndex();
    // this.performer.setCurrentIndex(0);
    this.setSequenceIndex(0);

    // NOTIFY CHANGES TO CONSUMERS /////////////////////////////////////////////

    this.emit('sequence', {
      length: this.performer.size(),
      start: this.sequenceStartIndex,
      end: this.sequenceEndIndex,
    });
  }

  clear() {
    this.performer.clear();
    this.emit('sequence', { length: 0, start: 0, end: 0 });
  }

  setSequenceIndex(sequenceIndex) {
    // const index = Math.max(Math.min(sequenceIndex, this.sequenceEndIndex), this.sequenceStartIndex);
    // this.index = index;
    // this.performer.setCurrentIndex(this.index);
    // this.emit('index', this.index);

    this.index = this.performer.setCurrentIndex(sequenceIndex);
    this.emit('index', this.index);
  }

  setSequenceBounds(min, max) {
    this.performer.setLoopIndices(min, max);
    this.index = this.performer.getCurrentIndex();

    this.emit('sequence', {
      length: this.performer.size(),
      start: this.performer.getLoopStartIndex(),
      end: this.performer.getLoopEndIndex(),
    });

    this.emit('index', this.index);
  }

  setLooping(l) {
    this.performer.setLooping(l);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;

    if (this.mode === 'listen') {
      this.performer.setChordVelocityMappingStrategy(
        this.mfp.chordStrategy.none
      );

      if (!this.performer.stopped()) {
        this.performer.stop();
      }
      this.setSequenceIndex(this.performer.getCurrentIndex());

      // if (this.performer.getCurrentIndex() < this.performer.getLoopEndIndex()) {
      //   this.setSequenceIndex(this.performer.getCurrentIndex());
      // } else {
      //   this.performer.stop();
      // }

      let pair;
      const playNextSet = (start, first) => {
        let dt = 0;
        if (start) {
          pair = this.performer.peekNextSetPair();
          dt = pair.start.dt;
          // const nextIndex = this.performer.getNextIndex();
          // if (nextIndex === this.performer.getLoopStartIndex()) { /* ... */ }
          // if (nextIndex === this.performer.getLoopEndIndex()) { /* ... */ }
        } else  {
          dt = pair.end.dt;
        }

        dt = first ? 0 : dt;
        
        if (this.performer.stopped()) return;

        this.timeout = setTimeout(() => {
          this.performer.render({
            pressed: start,
            id: 1,
            velocity: (start ? 127 : 0),
            channel: 1
          });

          if (start) this.emit('index', this.performer.getCurrentIndex());

          playNextSet(!start, false);
        }, dt);
      };

      playNextSet(true, true);
    }

    if (this.mode === 'perform') {
      this.performer.setChordVelocityMappingStrategy(
        this.mfp.chordStrategy.clippedScaledFromMax
      );

      this.performer.stop();
      if (this.performer.getCurrentIndex() < this.performer.getLoopEndIndex()) {
        this.setSequenceIndex(this.performer.getCurrentIndex());
      }

      // this.setSequenceIndex(0);
      // this.emit('index', this.performer.getCurrentIndex());
      // console.log(this.performer.getCurrentIndex());
      // todo : start recording events automatically
    }

    if (this.mode === 'silent') {
      this.performer.stop();
      if (this.performer.getCurrentIndex() < this.performer.getLoopEndIndex()) {
        this.setSequenceIndex(this.performer.getCurrentIndex());
      }

      // if (this.performer.getCurrentIndex() < this.performer.getLoopEndIndex()) {
      //   this.setSequenceIndex(this.performer.getCurrentIndex());
      // } else {
      //   this.performer.stop();
      // }

      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      // this.setSequenceIndex(0);
      // console.log(this.performer.getCurrentIndex());
      this.emit('allnotesoff');
    }
  }

  command(cmd) {
    // command : { pressed, id, velocity, channel }
    // note : { on, pitch, velocity, channel }

    const res = [];
    if (this.mode !== 'perform') return res;

    // this.emit('index', this.index);
    this.performer.render(cmd);
    if (cmd.pressed) this.emit('index', this.performer.getCurrentIndex());

    // DON'T RETURN ANYTHING ANYMORE :
    // const noteEvents = this.performer.render(cmd);
    // USE NOTE EVENTS CALLBACK INSTEAD !
  }
  //*
  allNotesOff() {
    const velocity = 0;
    for (let channel = 1; channel <= 16; ++channel)
      for (let noteNumber = 0; noteNumber < 128; noteNumber++)
        this.emit('noteoff', { noteNumber, velocity, channel });
  }
  //*/
}

export default new MidifilePerformer();


