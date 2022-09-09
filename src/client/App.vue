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
import { mapState, mapMutations, mapActions }   from 'vuex';
// import { parseArrayBuffer }         from 'midi-json-parser';
import { encode }                   from 'json-midi-encoder';
// import MidiPlayer                   from 'midi-player-js';
// import MidifilePerformer from './utilities/MidifilePerformer';
import LeMenu                       from './components/LeMenu.vue';
import PopUp                        from './components/PopUp.vue';
import Guide                        from './pages/Guide.vue';
import LookForScores                from './pages/LookForScores.vue';

export default {
  inject: [ 'ioctl', 'performer', 'synth' ], // get instance vars (set with provide())
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
      'setInputs',
      'setOutputs',
      'setCurrentInputId',
      'setCurrentOutputId',
      // 'setKeyboardState',
      'noteOn',
      'noteOff',
      'allNotesOff',
      'setSequenceLength',
      'setSequenceStart',
      'setSequenceEnd',
      'setSequenceIndex',
    ]),
    onInputsChanged(inputs) {
      this.setInputs(inputs);
    },
    onOutputsChanged(outputs) {
      this.setOutputs(outputs);
    },
    onCurrentInputIdChanged(id) {
      //this.ioctl.allNotesOff();
      this.setCurrentInputId(id);
    },
    onCurrentOutputIdChanged(id) {
      //this.ioctl.allNotesOff();
      this.setCurrentOutputId(id);
    },
    // THIS IS WHERE WE ACTUALLY USE THE MIDIFILE PERFORMER STUFF :
    onCommand(cmd) {
      // const noteEvents = this.performer.command(cmd);
      this.performer.command(cmd);
      // this.ioctl.noteEvents(noteEvents);
    },
    onNoteOn(note) {
      //this.synth.noteOn(note);
      this.noteOn(note); // update keyboard state
      const { noteNumber, velocity, channel } = note;
      this.ioctl.noteEvents([
        { on: true, pitch: noteNumber, velocity, channel }
      ]);
    },
    onNoteOff(note) {
      //this.synth.noteOff(note);
      this.noteOff(note); // update keyboard state
      const { noteNumber, velocity, channel } = note;
      this.ioctl.noteEvents([
        { on: false, pitch: noteNumber, velocity, channel }
      ]);
    },
    onAllNotesOff() {
      this.allNotesOff(); // update keyboard state
    },
    onSequenceChanged(sequenceData) {
      const { length, start, end } = sequenceData;
      this.setSequenceLength(length);
      this.setSequenceStart(start);
      this.setSequenceEnd(end);
    },
    onSequenceIndex(index) {
      // console.log('calling setSequenceIndex(' + index + ')');
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
    // await this.$store.dispatch('loadMidiBuffers');
    // await this.performer.initialize();

    document.addEventListener('click', this.onUserClick);
    this.performer.addListener('noteon', this.onNoteOn);
    this.performer.addListener('noteoff', this.onNoteOff);
    this.performer.addListener('allnotesoff', () => {
      this.ioctl.allNotesOff();
      this.allNotesOff();
    });
    this.performer.addListener('sequence', this.onSequenceChanged);
    this.performer.addListener('index', this.onSequenceIndex);
    // this.performer.addListener('start', this.onSequenceStart);
    // this.performer.addListener('end', this.onSequenceEnd);

    this.ioctl.setInternalSampler(this.synth);
    this.ioctl.addListener('inputs', this.onInputsChanged);
    this.ioctl.addListener('outputs', this.onOutputsChanged);
    this.ioctl.addListener('currentInputId', this.onCurrentInputIdChanged);
    this.ioctl.addListener('currentOutputId', this.onCurrentOutputIdChanged);
    this.ioctl.addListener('command', this.onCommand);
    this.ioctl.addListener('allnotesoff', this.allNotesOff);
    this.ioctl.updateInputsAndOutputs();

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

    /*
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
    // now find a way to propose a download to the user
    //*

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
  // },
  // async mounted() {
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

    /*
    const promises = [];
    midifiles.forEach(file => {
      // const { id, title, url } = file;
      promises.push(new Promise((resolve, reject) => {
        fetch(file.url)
        .then(res => res.arrayBuffer())
        .then(buffer => {
          this.setMidiBuffer({ ...file, buffer });
          resolve({ ...file, buffer });
        });
      }));
    });
    //*/

    // const mididata = await Promise.all(promises);
    // console.log(mididata);
  },
  beforeUnmount() {
    // document.removeEventListener('keydown', this.onKeyDown);
    // document.removeEventListener('keyup', this.onKeyUp);
    this.performer.removeListener('noteon', this.onNoteOn);
    this.performer.removeListener('noteoff', this.onNoteOff);
    this.performer.removeListener('sequence', this.onPerformerBufferChanged);
  },
};
</script>