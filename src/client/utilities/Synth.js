import EventEmitter from 'events';

class Synth extends EventEmitter {
  constructor() {
    //const AudioContext = window.AudioContext || window.webkitAudioContext;
    //this.ctx = new AudioContext();
    super()
    
    this.ctx = null;
    this.releaseTime = 0.15; // 150 ms
    //this.notes = [];
    this.notes = new Map();
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

    // notes.length == 88 (A0 to C8)

    let notesFetched = 0;
    let notesDecoded = 0;

    notes.forEach((note, i) => {
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

    this.notes = await Promise.all(promises);
    console.log(this.notes);
    return Promise.resolve();
  }

  noteOn({ noteNumber, velocity, channel }) {
    const note = this.getNoteIfInRange(noteNumber);

    if (note !== null) {
      const { buffer } = note;
      let player = this.getPlayerForNoteOnChannel(noteNumber, channel)

      if (!!player) this.turnOffPlayer(player)

      player = this.makePlayer(buffer)

      // ------------------ Velocity-specific settings : -----------------------

      const normVelocity = velocity / 127;

      // - Velocity-driven lowpass filter :
      // TODO : compute this value from a note ratio (nth harmonic) perspective
      // instead of using a fixed frequency
      player.biquad.frequency.value = Math.pow(normVelocity, 3) * 20000 + 1000;

      // - Velocity-driven gain :
      player.volume.gain.value = normVelocity;
      //const ramp = (1 - normVelocity) * 0.01; // 10ms max
      //note.player.volume.gain.setValueAtTime(normVelocity, this.ctx.currentTime + ramp);

      // - Velocity-driven start time :
      const offset = (1 - normVelocity) * 0.005; // 5ms max
      player.source.start(this.ctx.currentTime, offset);

      // -----------------------------------------------------------------------

      this.setPlayerForNoteOnChannel(noteNumber, channel, player);
    }
  }

  noteOff({ noteNumber, velocity, channel }) { // TODO : use velocity to influence how fast the note turns off (what computation should be made ? logarithmic ?)
    const note = this.getNoteIfInRange(noteNumber, channel);

    if (note !== null) {
      const player = this.getPlayerForNoteOnChannel(noteNumber, channel)

      if (!!player) {
        this.turnOffPlayer(player)
        this.removePlayerForNoteOnChannel(noteNumber, channel)
      }
    }
  }

  allNotesOff() {
    for(let channel = 1; channel <= 16; channel++) {
      for (let i = this.minNote; i <= this.maxNote; ++i) {
        this.noteOff({ noteNumber: i, velocity: 0, channel: channel});
      }
    }
  }

  getNoteIfInRange(noteNumber) {
    if (
      noteNumber >= this.minNote &&
      noteNumber <= this.maxNote &&
      this.notes.length > 0
    ) {
      return this.notes[noteNumber - this.minNote];
    }

    return null;
  }

  makePlayer(buffer) {
    const source = this.ctx.createBufferSource();
    const biquad = this.ctx.createBiquadFilter();
    const volume = this.ctx.createGain();

    source.buffer = buffer;
    source.connect(biquad);

    biquad.type = 'lowpass';
    biquad.Q.value = 0;
    biquad.frequency.value = 20000;
    biquad.connect(volume);

    volume.gain.value = 1;
    volume.connect(this.ctx.destination);

    return { source, biquad, volume };
  }

  getPlayerForNoteOnChannel(noteNumber, channel) {
    const currentChannelNotes = this.playingMap.get(channel)
    return currentChannelNotes.get(noteNumber)
  }

  setPlayerForNoteOnChannel(noteNumber, channel, player) {
    const currentChannelNotes = this.playingMap.get(channel)
    currentChannelNotes.set(noteNumber, player)
  }

  removePlayerForNoteOnChannel(noteNumber, channel) {
    const currentChannelNotes = this.playingMap.get(channel)
    currentChannelNotes.delete(noteNumber)
  }

  turnOffPlayer(player) {
    player.volume.gain.cancelScheduledValues(this.ctx.currentTime);
    const val = player.volume.gain.value;
    player.volume.gain.setValueAtTime(val, this.ctx.currentTime);
    player.volume.gain.linearRampToValueAtTime(0, this.ctx.currentTime + this.releaseTime);
  }
};

const notes = [
  'A0',
  'Bb0',
  'B0',
  'C1',
  'Db1',
  'D1',
  'Eb1',
  'E1',
  'F1',
  'Gb1',
  'G1',
  'Ab1',
  'A1',
  'Bb1',
  'B1',
  'C2',
  'Db2',
  'D2',
  'Eb2',
  'E2',
  'F2',
  'Gb2',
  'G2',
  'Ab2',
  'A2',
  'Bb2',
  'B2',
  'C3',
  'Db3',
  'D3',
  'Eb3',
  'E3',
  'F3',
  'Gb3',
  'G3',
  'Ab3',
  'A3',
  'Bb3',
  'B3',
  'C4',
  'Db4',
  'D4',
  'Eb4',
  'E4',
  'F4',
  'Gb4',
  'G4',
  'Ab4',
  'A4',
  'Bb4',
  'B4',
  'C5',
  'Db5',
  'D5',
  'Eb5',
  'E5',
  'F5',
  'Gb5',
  'G5',
  'Ab5',
  'A5',
  'Bb5',
  'B5',
  'C6',
  'Db6',
  'D6',
  'Eb6',
  'E6',
  'F6',
  'Gb6',
  'G6',
  'Ab6',
  'A6',
  'Bb6',
  'B6',
  'C7',
  'Db7',
  'D7',
  'Eb7',
  'E7',
  'F7',
  'Gb7',
  'G7',
  'Ab7',
  'A7',
  'Bb7',
  'B7',
  'C8',
];

export default new Synth();
