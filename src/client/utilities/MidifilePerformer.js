import EventEmitter           from 'events';
import { parseArrayBuffer }   from 'midi-json-parser';
import { encode }             from 'json-midi-encoder';
import MidiPlayer             from 'midi-player-js';

const alphabet = ' abcdefghijklmnopqrstuvwxyz';

// todo : improve this by allowing threshold in ms
// according to midi file bpm and resolution data
const chordDeltaDateThreshold = 1;

// async function midiArrayBufferToChordSequence(buffer) {
async function parseMidiArrayBuffer(buffer) {
  const allNoteOnEvents = [];

  // we need to copy because the array buffer will be transfered and detached
  // by parseArrayBuffer
  const bufferCopy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(bufferCopy).set(new Uint8Array(buffer));

  const json = await parseArrayBuffer(bufferCopy);
  const { division, format, tracks } = json;
  console.log({ division, format });

  // append all tracks note on events in a single array
  tracks.forEach((track, i) => {
    let date = 0;

    track.forEach(obj => {
      date += obj.delta;

      // if (!(obj.hasOwnProperty('noteOn') || obj.hasOwnProperty('noteOff'))) {
      //   console.log(obj);
      // }

      if (obj.hasOwnProperty('setTempo')) {
        console.log(obj);
        const { delta, setTempo } = obj;
        const { microsecondsPerQuarter } = setTempo;
      }

      if (obj.hasOwnProperty('timeSignature')) {
        console.log(obj);
        const { delta, timeSignature } = obj;
        const {
          numerator,
          denominator,
          metronome,
          thirtyseconds
        } = timeSignature;
      }

      if (obj.hasOwnProperty('noteOn')) {
        const { channel, noteOn } = obj;
        const { noteNumber, velocity } = noteOn;
        allNoteOnEvents.push({ date, track: i, channel, noteNumber, velocity });
      }
    });
  });

  // sort the array so that all note on events from all tracks are merged
  allNoteOnEvents.sort((a,b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    return 0;
  });

  const sequenceIndices = [];

  // reduce to an array of single notes or chords (notes gathered by same date)
  // and create array of sequence indices from inside reduction function
  const chordSequence = allNoteOnEvents
  .map((e, index) => {
    return { ...e, index };
  })
  .reduce((prev, current, i, arr) => {
    const res = prev;

    // if (res.length > 0 && arr[i].date - arr[i - 1].date < chordDeltaDateThreshold) {
    if (res.length > 0 && arr[i].date === arr[i - 1].date) {
      res[res.length - 1].push(current);
    } else {
      res.push([current]);
    }

    sequenceIndices.push(res.length - 1);
    return res;
  }, []);

  return {
    chordSequence,
    sequenceIndices,
  };
}

/* * * * * * * * * * * * MIDI FILE PERFORMER PLAYER CLASS * * * * * * * * * * */

/*
loadArrayBuffer(buffer)
setMode(mode) // 'silent', 'listen' or 'perform'
keyDown(e)
keyUp(e)
//*/

class MidifilePerformer extends EventEmitter {
  constructor() {
    super();
    this.chordSequence = [];
    this.sequenceIndices = [];
    this.sequenceStartIndex = 0;
    this.sequenceEndIndex = 0;
    this.index = 0;

    this.noteKeys = new Array(128).map(() => null);
    this.activeNotesByKey = new Map();

    this.mode = 'silent'; // could be 'listen' or 'perform'
    
    this.playerSpeed = 1;
    this.player = new MidiPlayer.Player();
    this.noteOnIndex = 0;

    this.player.on('midiEvent', e => {
      if (e.name === 'Note on' ||
          e.name === 'Note off') {

        const { noteNumber, velocity } = e;

        if (e.name === 'Note on' && velocity > 0) {
          const index = this.getSequenceIndex(this.noteOnIndex++);

          if (index > this.sequenceEndIndex) {
            this.player.stop();
            this.allNotesOff();
            return;
          }

          this.emit('noteon', { noteNumber, velocity });
          this.emit('index', index);          
        } else {
          this.emit('noteoff', { noteNumber, velocity });
        }
      } else if (e.name === 'Set Tempo') {
        // always multiply current tempo by a speed factor :
        // this.player.setTempo(e.data * this.playerSpeed);
      }
    });
  }

  async loadArrayBuffer(buffer) {
    this.index = 0;
    this.player.stop();
    this.allNotesOff();
    this.player.loadArrayBuffer(buffer);
    // this.chordSequence = await midiArrayBufferToChordSequence(buffer);
    const {
      chordSequence,
      sequenceIndices
    } = await parseMidiArrayBuffer(buffer);

    this.chordSequence = chordSequence;
    this.sequenceIndices = sequenceIndices;
    this.sequenceStartIndex = 0;
    this.sequenceEndIndex = Math.max(chordSequence.length - 1, 0);

    //this.emit('loaded');
    this.emit('sequence', {
      length: this.chordSequence.length,
      start: this.sequenceStartIndex,
      end: this.sequenceEndIndex,
    });
  }

  clear() {
    this.chordSequence = [];
    this.sequenceIndices = [];
    this.sequenceStartIndex = 0;
    this.sequenceEndIndex = 0;

    this.emit('sequence', {
      length: this.chordSequence.length,
      start: this.sequenceStartIndex,
      end: this.sequenceEndIndex,
    });
  }

  // really need this ?
  // we should instead call play each time we want to restart,

  reset() {
    this.index = this.sequenceStartIndex;
  }

  setSequenceIndex(sequenceIndex) {
    const index = Math.max(Math.min(sequenceIndex, this.sequenceEndIndex), this.sequenceStartIndex);
    this.index = index;
    this.noteOnIndex = this.getNoteOnIndex(index);
    this.emit('index', this.index);
  }

  setSequenceBounds([ min, max ]) {
    const clipBounds = (v, min, max) => Math.min(Math.max(v, min), max);

    const tmp = max;
    if (min > max) {
      max = min;
      min = tmp;
    }

    this.sequenceStartIndex = clipBounds(min, 0, this.chordSequence.length - 1);
    this.sequenceEndIndex = clipBounds(max, 0, this.chordSequence.length - 1);
    this.index = clipBounds(this.index, min, max);

    this.emit('sequence', {
      length: this.chordSequence.length,
      start: this.sequenceStartIndex,
      end: this.sequenceEndIndex,
    });

    this.emit('index', this.index);
  }

  getSequenceIndex(noteOnIndex) {
    return this.sequenceIndices[noteOnIndex];
  }

  getNoteOnTickDate(sequenceIndex) {
    return this.chordSequence[sequenceIndex][0].date;
  }

  getNoteOnIndex(sequenceIndex) {
    return this.chordSequence[sequenceIndex][0].index;
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;

    if (this.mode === 'listen') {
      // we might still have a buffer in the player but we don't want to play it
      if (this.chordSequence.length === 0) return;

      this.noteOnIndex = this.getNoteOnIndex(this.sequenceStartIndex);
      this.player.skipToTick(this.getNoteOnTickDate(this.sequenceStartIndex));
      this.player.play();
    } else {
      this.player.stop();
    }

    if (this.mode === 'perform') {
      this.setSequenceIndex(0);
      // todo : start recording events automatically
    }

    if (this.mode === 'silent') {
      this.allNotesOff();
    }
  }

  keyDown(e) {
    if (this.mode !== 'perform') return;
    if (e.repeat) return;
    if (e.key.length !== 1 || !alphabet.includes(e.key)) return; 
    if (this.index > this.sequenceEndIndex) return;

    this.emit('index', this.index);

    const chord = this.getNextChord();

    // if we want to loop :
    // this.index = Math.max((this.index + 1) % (this.sequenceEndIndex + 1), this.sequenceStartIndex)
    // else we go further and stop :
    this.index++;

    this.activeNotesByKey.set(e.key, chord);

    chord.forEach(({ noteNumber, velocity }) => {
      this.noteKeys[noteNumber] = e.key;
      this.emit('noteon', { noteNumber, velocity }); // define custom velocity here (from keys ?)
    });    
  }

  keyUp(e) {
    if (this.mode !== 'perform') return;
    if (e.key.length !== 1 || !alphabet.includes(e.key)) return;
    if (!this.activeNotesByKey.has(e.key)) return;

    const chord = this.activeNotesByKey.get(e.key);
    this.activeNotesByKey.delete(e.key);

    chord.forEach(({ noteNumber, velocity }) => {
      if (this.noteKeys[noteNumber] === e.key) { // check if voice wasn't stolen
        this.noteKeys[noteNumber] = null;
        this.emit('noteoff', { noteNumber, velocity });
      }
    });
  }

  getNextChord() {
    if (this.chordSequence.length === 0)
      return [];

    return this.chordSequence[this.index];
    // this.index = Math.max((this.index + 1) % (this.sequenceEndIndex + 1), this.sequenceStartIndex);
    // return res;
  }

  allNotesOff() {
    for (let i = 0; i < 128; i++)
      this.emit('noteoff', { noteNumber: i, velocity: 0 });
  }
}

export default new MidifilePerformer();


