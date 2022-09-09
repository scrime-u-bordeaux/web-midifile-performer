import { notes } from 'piano-mp3/src/notes';

class Synth {
  constructor() {
    //const AudioContext = window.AudioContext || window.webkitAudioContext;
    //this.ctx = new AudioContext();
    this.ctx = null;
    this.releaseTime = 0.15; // 150 ms
    //this.notes = [];
    this.notes = new Map();
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
    notes.forEach((note, i) => {
      promises.push(new Promise((resolve, reject) => {
        fetch(`piano-mp3/${note}.mp3`)
        .then(async res => {
          const arrayBuffer = await res.arrayBuffer();

          // const buffer = await this.ctx.decodeAudioData(arrayBuffer);
          // const player = null;
          // const playing = false;
          // resolve({ buffer, player, playing, i });

          this.ctx.decodeAudioData(arrayBuffer, buffer => {
            const player = null;
            const playing = false;
            resolve({ buffer, player, playing, i });
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
    let note = this.getNoteIfInRange(noteNumber, channel);

    if (note !== null) {
      const { buffer, player, playing } = note;
      
      if (playing) {
        player.volume.gain.cancelScheduledValues(this.ctx.currentTime);
        const val = player.volume.gain.value;
        player.volume.gain.setValueAtTime(val, this.ctx.currentTime);
        player.volume.gain.linearRampToValueAtTime(0, this.ctx.currentTime + this.releaseTime);
      }
      
      note.player = this.makePlayer(buffer);
      note.playing = true;

      //////////////////////////////////// velocity specific settings :

      const normVelocity = velocity / 127;
      
      // - velocity driven lowpass filter :
      // todo : compute this value from a note ratio (nth harmonic) perspective
      // instead of using a fixed frequency
      note.player.biquad.frequency.value = Math.pow(normVelocity, 3) * 20000 + 1000;
      
      // - velocity driven gain :
      note.player.volume.gain.value = normVelocity;
      //const ramp = (1 - normVelocity) * 0.01; // 10ms max
      //note.player.volume.gain.setValueAtTime(normVelocity, this.ctx.currentTime + ramp);
      
      // - velocity driven start time :
      const offset = (1 - normVelocity) * 0.005; // 5ms max
      note.player.source.start(this.ctx.currentTime, offset);
    }
  }

  noteOff({ noteNumber, velocity, channel }) {
    const note = this.getNoteIfInRange(noteNumber, channel);

    if (note !== null) {
      const { buffer, player, playing } = note;

      if (playing) {
        player.volume.gain.cancelScheduledValues(this.ctx.currentTime);
        const val = player.volume.gain.value;
        player.volume.gain.setValueAtTime(val, this.ctx.currentTime);
        player.volume.gain.linearRampToValueAtTime(0, this.ctx.currentTime + this.releaseTime);
        note.playing = false;
      }
    }
  }

  allNotesOff() {
    for (let i = this.minNote; i <= this.maxNote; ++i) {
      this.noteOff({ noteNumber: i, velocity: 0 });
    }
  }

  getNoteIfInRange(noteNumber, channel) {
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
};

export default new Synth();