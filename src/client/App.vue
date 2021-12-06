<template>
  <!-- <pop-up> <component :is="'Guide'"> </component> </pop-up> -->
  <le-menu
    id="app-menu"
    :items="[
      { text: 'Accueil',            page: 'Home' },
      { text: 'Premiers Pas',       page: 'FirstSteps' },
      { text: 'Midifile Performer', page: 'MidifilePerformer' },
    ]"
  />

  <router-view id="app-content" />
</template>

<script>
import { mapState, mapMutations }   from 'vuex';
import { parseArrayBuffer }         from 'midi-json-parser';
import { encode }                   from 'json-midi-encoder';
import MidiPlayer                   from 'midi-player-js';
import LeMenu                       from './components/LeMenu.vue';
import PopUp                        from './components/PopUp.vue';
import Guide                        from './pages/Guide.vue';
import LookForScores                from './pages/LookForScores.vue';

export default {
  inject: [ 'performer', 'synth' ], // get instance vars (set with provide())
  components: { LeMenu, PopUp, Guide, LookForScores },
  data() {
    return {
      audioContext: null,
      speed: 1,
    };
  },
  computed: {
    ...mapState([
      //'keyboardState'
      'sequenceLength',
      'sequenceStart',
      'sequenceEnd',
      'midiBuffers',
    ]),
  },
  methods: {
    ...mapMutations([
      // 'setKeyboardState',
      'noteOn',
      'noteOff',
      'setSequenceLength',
      'setSequenceStart',
      'setSequenceEnd',
      'setSequenceIndex',
      'setMidiBuffer',
    ]),
    onKeyDown(e) {
      this.performer.keyDown(e);
    },
    onKeyUp(e) {
      this.performer.keyUp(e);
    },
    onNoteOn(note) {
      this.synth.noteOn(note);
      this.noteOn(note); // update keyboard state
    },
    onNoteOff(note) {
      this.synth.noteOff(note);
      this.noteOff(note); // update keyboard state
    },
    onSequenceChanged(sequenceData) {
      const { length, start, end } = sequenceData;
      this.setSequenceLength(length);
      this.setSequenceStart(start);
      this.setSequenceEnd(end);
    },
    onSequenceIndex(index) {
      this.setSequenceIndex(index);
    },
    async onUserClick(e) {
      document.removeEventListener('click', this.onUserClick);
      console.log('audio context should be ok on safari now');

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      const g = this.audioContext.createGain();
      g.gain.value = 0;
      g.connect(this.audioContext.destination);
      this.synth.setContext(this.audioContext);
      await this.synth.loadSounds();
    },
  },
  async created() {
    document.addEventListener('click', this.onUserClick);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    this.performer.addListener('noteon', this.onNoteOn);
    this.performer.addListener('noteoff', this.onNoteOff);
    this.performer.addListener('sequence', this.onSequenceChanged);
    this.performer.addListener('index', this.onSequenceIndex);

    // navigator.requestMIDIAccess() not supported in FF :(
    // => must implement own General MIDI-like piano synth (see Synth class)
    // but this should be implemented too for other browsers' users

    const fileUrl = 'mid/bach-c-prelude-the-well-tempered-clavier.mid';
    // const fileUrl = 'mid/debussy_arabesque_2_e_major_schmitz.mid';

    // const fileUrl = 'mid/ch-etn04.mid';
    // const fileUrl = 'mid/chet1004.mid';
    // const fileUrl = 'mid/chopin-etude-op10-no4.mid'; // this one is ok (not recorded "by hand")

    // const res = await fetch(fileUrl);
    // const buffer = await res.arrayBuffer();

    /////////// PLAY MIDI FILES :

    /*
    const midiPlayer = new MidiPlayer.Player();

    midiPlayer.on('midiEvent', e => {
      //console.log(e);
      if (e.name === "Note on") {
        const { noteNumber, velocity } = e;
        if (velocity > 0) {
          this.onNoteOn({ noteNumber, velocity });
        } else {
          this.onNoteOff({ noteNumber, velocity });
        }
      } else if (e.name === "Note off") {
        const { noteNumber, velocity } = e;
        this.onNoteOff({ noteNumber, velocity });
      } else if (e.name === "Set Tempo") {
        console.log(e);
        // always multiply current tempo by a UI speed factor :
        midiPlayer.setTempo(e.data * this.speed);
      }
    });

    midiPlayer.loadArrayBuffer(buffer);
    // midiPlayer.play();
    //*/

    /////////// GENERATE MIDI FILES :

    const track = [];

    for (let i = 0; i < 12; ++i) {
      track.push({
        delta: i * 20,
        noteOn: {
          noteNumber: 60 + i,
          velocity: 127,
        },
      })
    }

    for (let i = 0; i < 12; ++i) {
      track.push({
        delta: 50,
        noteOn: {
          noteNumber: 60 + i,
          velocity: 0,
        },
      })
    }

    track.push({
      delta: 100,
      endOfTrack: true,
    });

    const json = {
      division: 480,
      format: 1,
      tracks: [ track ],
    };

    const arrayBuffer = await encode(json);

    // midiPlayer.loadArrayBuffer(arrayBuffer);
    //midiPlayer.play();

    // await this.performer.loadArrayBuffer(buffer);
    // this.performer.setMode('listen');

    /*
    // can't get this to work : must run the server yourself, and it doesn't come
    // as a node package (yet)

    fetch('http://guido.grame.fr', {
      method: 'POST',
      body: "[ a, b, c ]",
      headers: { 'Content-Type': 'text/plain' },
    })
    .then(res => res.json())
    .then(res => console.log(res));
    //*/
  },
  async mounted() {
    const midifiles = [
      {
        id: 'bach-c-prelude-the-well-tempered-clavier',
        title: 'Bach prélude C - Le Clavier Bien Tempéré',
        url: 'mid/bach-c-prelude-the-well-tempered-clavier.mid',
      },
      {
        id: 'chopin-etude-op10-no4',
        title: 'Chopin - Etude Op10 no4',
        url: 'mid/chopin-etude-op10-no4.mid',
      },
      {
        id: 'debussy-arabesque-2-e',
        title: 'Debussy - Arabesque E no2',
        url: 'mid/debussy_arabesque_2_e_major_schmitz.mid',
      },
    ];

    const promises = [];
    midifiles.forEach(file => {
      promises.push(new Promise((resolve, reject) => {
        fetch(file.url)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          // const { id, title, url } = file;
          this.setMidiBuffer({ ...file, buffer });
          resolve();
        });
      }));
    });

    // await this.synth.loadSounds();
    const mididata = await Promise.all(promises);
    // await this.performer.loadArrayBuffer(mididata[0].buffer);
    // this.performer.setSequenceBounds([ 0, 63 ]);
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.performer.removeListener('noteon', this.onNoteOn);
    this.performer.removeListener('noteoff', this.onNoteOff);
    this.performer.removeListener('sequence', this.onPerformerBufferChanged);
  },
};
</script>