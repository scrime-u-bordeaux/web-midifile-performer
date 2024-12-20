import EventEmitter from 'events';

class Synth extends EventEmitter {
  constructor() {
    //const AudioContext = window.AudioContext || window.webkitAudioContext;
    //this.ctx = new AudioContext();
    super();

    this.ctx = null;
    this.lookahead = 0; // attempt to give more room to chrome to avoid clicks ... fail :(
    this.releaseTime = 0.15; // 150 ms
    this.noteBuffers = new Map();
    this.playingMap = new Map()
    for(let i = 1; i<=16; i++) this.playingMap.set(i, new Map())
    // A0 is midi note 21 :
    this.minNote = 21;
    // C8 is midi note 108 :
    this.maxNote = 108;
  }

  setContext(ctx) {
    this.ctx = ctx;
  }

  async loadSounds() {
    if (this.ctx === null)
      throw new Error(`audioContext not set`);

    const promises = [];

    let notesFetched = 0;
    let notesDecoded = 0;

    noteFiles.forEach((note, i) => {
      promises.push(new Promise((resolve, reject) => {
        fetch(`samples/${note}.mp3`)
        .then(async res => {
          notesFetched += 1
          this.emit('notesFetched', notesFetched)

          const arrayBuffer = await res.arrayBuffer();

          this.ctx.decodeAudioData(arrayBuffer, buffer => {
            notesDecoded += 1
            this.emit('notesDecoded', notesDecoded)
            resolve({ buffer, i });
          });
        })
        .catch(e => console.error(e));
      }));
    });

    this.noteBuffers = await Promise.all(promises);
    return Promise.resolve();
  }

  noteOn({ noteNumber, velocity, channel }) {
    const note = this.getNoteIfInRange(noteNumber);

    if (note !== null) {
      const [ bufferIndex, playbackRate ] = note;
      const { buffer } = this.noteBuffers[bufferIndex];
      const noteIndex = this.getNoteIndexIfInRange(noteNumber);
      const notePosition = ((noteIndex / (notesLayout.length - 1)) * 2 - 1);
      const normVelocity = Math.pow(velocity / 127, 1.5);
      const cutoff = Math.pow(normVelocity, 4) * 12000 + 200; // * 20000 + 500

      let player = this.getPlayerForNoteOnChannel(noteNumber, channel)

      if (!!player) this.turnOffPlayer(player)

      // we must pass cutoff here because IIRFilterNode needs its coefficients
      // at instantiation time :
      player = this.makePlayer(buffer, cutoff, playbackRate);

      // ------------------ Velocity-specific settings : -----------------------

      // - Velocity-driven lowpass filter :
      // TODO : compute this value from a note ratio (nth harmonic) perspective
      // instead of using a fixed frequency
      // player.biquad.frequency.value = Math.pow(normVelocity, 2.5) * 20000 + 1500;

      // - Velocity-driven gain :
      player.volume.gain.value = normVelocity * 0.8 + 0.2;

      // - NoteNumber-defined panning :
      // don't pan fully left or right
      player.panner.pan.value = notePosition * 0.9;

      // - Velocity-driven start time :
      // TODO : try to make a ramp to avoid clicks -> still doesn't improve anything
      const offset = (1 - normVelocity) * 0.005; // 5ms max
      player.source.start(this.ctx.currentTime + this.lookahead, offset);
      // -----------------------------------------------------------------------

      this.setPlayerForNoteOnChannel(noteNumber, channel, player);
    }
  }

  // TODO : use velocity to influence how fast the note turns off
  // (what computation should be made ? logarithmic ?)
  noteOff({ noteNumber, velocity, channel }) {
    const note = this.getNoteIfInRange(noteNumber, channel);

    if (note !== null) {
      const player = this.getPlayerForNoteOnChannel(noteNumber, channel)

      if (!!player) {
        this.turnOffPlayer(player);
        this.removePlayerForNoteOnChannel(noteNumber, channel);
      }
    }
  }

  silenceChannel(channel) {
    for (let i = this.minNote; i <= this.maxNote; ++i) {
      this.noteOff({ noteNumber: i, velocity: 0, channel: channel});
    }
  }

  allNotesOff() {
    for(let channel = 1; channel <= 16; channel++)
      this.silenceChannel(channel)
  }

  getNoteIndexIfInRange(noteNumber) {
    if (
      noteNumber >= this.minNote &&
      noteNumber <= this.maxNote &&
      this.noteBuffers.length > 0
    ) {
      //return this.noteBuffers[noteNumber - this.minNote];
      return noteNumber - this.minNote;
    }

    return null;
  }

  getNoteIfInRange(noteNumber) {
    const noteIndex = this.getNoteIndexIfInRange(noteNumber);
    if (noteIndex !== null) {
      return noteInfos[noteIndex];
    }

    return null;
  }

  makePlayer(buffer, cutoff, playbackRate = 1) {
    const source = this.ctx.createBufferSource();

    let b1 = Math.exp(-2 * Math.PI * cutoff / this.ctx.sampleRate);
    let a0 = (1 - b1);
    let feedForward = [ -a0, 0 ];
    let feedBack = [ 1, -b1 ];
    const onepole = this.ctx.createIIRFilter(feedForward, feedBack);
    // const biquad = this.ctx.createBiquadFilter();

    const volume = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    source.connect(onepole);
    // source.connect(biquad);

    onepole.connect(volume);
    // biquad.type = 'lowpass';
    // biquad.Q.value = 0.001;
    // biquad.frequency.value = 20000;
    // biquad.connect(volume);

    volume.gain.value = 1;
    volume.connect(panner);

    panner.connect(this.ctx.destination);

    // return { source, biquad, volume, panner };
    return { source, onepole, volume, panner };
  }

  getPlayerForNoteOnChannel(noteNumber, channel) {
    const currentChannelNotes = this.playingMap.get(channel)
    return currentChannelNotes?.get(noteNumber)
  }

  setPlayerForNoteOnChannel(noteNumber, channel, player) {
    const currentChannelNotes = this.playingMap.get(channel)
    currentChannelNotes?.set(noteNumber, player)
  }

  removePlayerForNoteOnChannel(noteNumber, channel) {
    const currentChannelNotes = this.playingMap.get(channel)
    currentChannelNotes?.delete(noteNumber)
  }

  turnOffPlayer(player) {
    const val = player.volume.gain.value;
    player.volume.gain.cancelScheduledValues(this.ctx.currentTime + this.lookahead);
    player.volume.gain.setValueAtTime(val, this.ctx.currentTime + this.lookahead);
    //player.volume.gain.cancelAndHoldAtTime(this.ctx.currentTime); // not supported by firefox and doesn't fix the issue
    player.volume.gain.linearRampToValueAtTime(0, this.ctx.currentTime + this.releaseTime + this.lookahead);
  }
};


// notes must be specified in increasing order :

const notesLayout = [
  { name: 'A0',   file: 'A0',   transpose: 0  },
  { name: 'Bb0',  file: 'A0',   transpose: 1  },
  { name: 'B0',   file: 'C1',   transpose: -1 },
  { name: 'C1',   file: 'C1',   transpose: 0  },
  { name: 'Db1',  file: 'C1',   transpose: 1  },
  { name: 'D1',   file: 'Eb1',  transpose: -1 },
  { name: 'Eb1',  file: 'Eb1',  transpose: 0  },
  { name: 'E1',   file: 'Eb1',  transpose: 1  },
  { name: 'F1',   file: 'Gb1',  transpose: -1 },
  { name: 'Gb1',  file: 'Gb1',  transpose: 0  },
  { name: 'G1',   file: 'Gb1',  transpose: 1  },
  { name: 'Ab1',  file: 'A1',   transpose: -1 },
  { name: 'A1',   file: 'A1',   transpose: 0  },
  { name: 'Bb1',  file: 'A1',   transpose: 1  },
  { name: 'B1',   file: 'C2',   transpose: -1 },
  { name: 'C2',   file: 'C2',   transpose: 0  },
  { name: 'Db2',  file: 'C2',   transpose: 1  },
  { name: 'D2',   file: 'Eb2',  transpose: -1 },
  { name: 'Eb2',  file: 'Eb2',  transpose: 0  },
  { name: 'E2',   file: 'Eb2',  transpose: 1  },
  { name: 'F2',   file: 'Gb2',  transpose: -1 },
  { name: 'Gb2',  file: 'Gb2',  transpose: 0  },
  { name: 'G2',   file: 'Gb2',  transpose: 1  },
  { name: 'Ab2',  file: 'A2',   transpose: -1 },
  { name: 'A2',   file: 'A2',   transpose: 0  },
  { name: 'Bb2',  file: 'A2',   transpose: 1  },
  { name: 'B2',   file: 'C3',   transpose: -1 },
  { name: 'C3',   file: 'C3',   transpose: 0  },
  { name: 'Db3',  file: 'C3',   transpose: 1  },
  { name: 'D3',   file: 'Eb3',  transpose: -1 },
  { name: 'Eb3',  file: 'Eb3',  transpose: 0  },
  { name: 'E3',   file: 'Eb3',  transpose: 1  },
  { name: 'F3',   file: 'Gb3',  transpose: -1 },
  { name: 'Gb3',  file: 'Gb3',  transpose: 0  },
  { name: 'G3',   file: 'Gb3',  transpose: 1  },
  { name: 'Ab3',  file: 'A3',   transpose: -1 },
  { name: 'A3',   file: 'A3',   transpose: 0  },
  { name: 'Bb3',  file: 'A3',   transpose: 1  },
  { name: 'B3',   file: 'C4',   transpose: -1 },
  { name: 'C4',   file: 'C4',   transpose: 0  },
  { name: 'Db4',  file: 'C4',   transpose: 1  },
  { name: 'D4',   file: 'Eb4',  transpose: -1 },
  { name: 'Eb4',  file: 'Eb4',  transpose: 0  },
  { name: 'E4',   file: 'Eb4',  transpose: 1  },
  { name: 'F4',   file: 'Gb4',  transpose: -1 },
  { name: 'Gb4',  file: 'Gb4',  transpose: 0  },
  { name: 'G4',   file: 'Gb4',  transpose: 1  },
  { name: 'Ab4',  file: 'A4',   transpose: -1 },
  { name: 'A4',   file: 'A4',   transpose: 0  },
  { name: 'Bb4',  file: 'A4',   transpose: 1  },
  { name: 'B4',   file: 'C5',   transpose: -1 },
  { name: 'C5',   file: 'C5',   transpose: 0  },
  { name: 'Db5',  file: 'C5',   transpose: 1  },
  { name: 'D5',   file: 'Eb5',  transpose: -1 },
  { name: 'Eb5',  file: 'Eb5',  transpose: 0  },
  { name: 'E5',   file: 'Eb5',  transpose: 1  },
  { name: 'F5',   file: 'Gb5',  transpose: -1 },
  { name: 'Gb5',  file: 'Gb5',  transpose: 0  },
  { name: 'G5',   file: 'Gb5',  transpose: 1  },
  { name: 'Ab5',  file: 'A5',   transpose: -1 },
  { name: 'A5',   file: 'A5',   transpose: 0  },
  { name: 'Bb5',  file: 'A5',   transpose: 1  },
  { name: 'B5',   file: 'C6',   transpose: -1 },
  { name: 'C6',   file: 'C6',   transpose: 0  },
  { name: 'Db6',  file: 'C6',   transpose: 1  },
  { name: 'D6',   file: 'Eb6',  transpose: -1 },
  { name: 'Eb6',  file: 'Eb6',  transpose: 0  },
  { name: 'E6',   file: 'Eb6',  transpose: 1  },
  { name: 'F6',   file: 'Gb6',  transpose: -1 },
  { name: 'Gb6',  file: 'Gb6',  transpose: 0  },
  { name: 'G6',   file: 'Gb6',  transpose: 1  },
  { name: 'Ab6',  file: 'A6',   transpose: -1 },
  { name: 'A6',   file: 'A6',   transpose: 0  },
  { name: 'Bb6',  file: 'A6',   transpose: 1  },
  { name: 'B6',   file: 'C7',   transpose: -1 },
  { name: 'C7',   file: 'C7',   transpose: 0  },
  { name: 'Db7',  file: 'C7',   transpose: 1  },
  { name: 'D7',   file: 'Eb7',  transpose: -1 },
  { name: 'Eb7',  file: 'Eb7',  transpose: 0  },
  { name: 'E7',   file: 'Eb7',  transpose: 1  },
  { name: 'F7',   file: 'Gb7',  transpose: -1 },
  { name: 'Gb7',  file: 'Gb7',  transpose: 0  },
  { name: 'G7',   file: 'Gb7',  transpose: 1  },
  { name: 'Ab7',  file: 'A7',   transpose: -1 },
  { name: 'A7',   file: 'A7',   transpose: 0  },
  { name: 'Bb7',  file: 'A7',   transpose: 1  },
  { name: 'B7',   file: 'C8',   transpose: -1 },
  { name: 'C8',   file: 'C8',   transpose: 0  },
];

const noteFiles = Array.from(
  notesLayout.reduce((accumulator, { file }) => {
    accumulator.add(file);
    return accumulator;
  }, new Set())
);

const noteInfos = notesLayout.map(({ file, transpose }) => {
  const bufferIndex = noteFiles.indexOf(file);
  const playbackRate = 2 ** (transpose / 12);
  return [ bufferIndex, playbackRate ];
});

const NUMBER_OF_KEYS = notesLayout.length;
const NUMBER_OF_SOUNDFILES = noteFiles.length;

const synth = new Synth()

export { synth as default, NUMBER_OF_KEYS, NUMBER_OF_SOUNDFILES }
