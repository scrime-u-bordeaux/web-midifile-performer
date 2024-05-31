<template>
  <!-- <pop-up> <component :is="'Guide'"> </component> </pop-up> -->
  <le-menu
    id="app-menu"
    :items="[
      { text: $t('menu.home'),            page: 'Home' },
      { text: $t('menu.firstSteps'),       page: 'FirstSteps' },
      { text: $t('menu.mfp'), page: 'MidifilePerformer' },
      { text: $t('menu.help'), page: 'Guide' },
      { text: $t('menu.credits'),            page: 'Credits'}
    ]"
  />

  <router-view id="app-content" @canPerform="updateCanPerform"/>
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
  inject: [ 'ioctl', 'performer', 'synth', 'defaultKeyboardVelocities' ], // get instance vars (set with provide())
  components: { LeMenu, PopUp, Guide, LookForScores },
  data() {
    return {
      audioContext: null,
      canPerform: false // avoid playing from non-MFP tabs
    };
  },
  computed: {
    ...mapState([
      // 'keyboardState'
      'sequenceLength',
      'sequenceStart',
      'sequenceEnd',
      'midiBuffers',
      'performModeStartedAt'
    ]),
  },
  methods: {
    ...mapMutations([
      'setInputs',
      'setOutputs',
      // 'setKeyboardState',
      'animateNoteOn',
      'animateNoteOff',
      'allNotesOff',
      'setSequenceLength',
      'setSequenceStart',
      'setSequenceEnd',
      'setSequenceIndex',
      'setPerformModeStartedAt',
      'setMidiAccessRequested',
      'setUserClickOccurred',
      'setSynthNotesFetched',
      'setSynthNotesDecoded'
    ]),
    onInputsChanged(inputs) {
      this.setMidiAccessRequested()
      this.setInputs(inputs);
    },
    onOutputsChanged(outputs) {
      this.setMidiAccessRequested()
      this.setOutputs(outputs);
    },

    // THIS IS WHERE WE ACTUALLY USE THE MIDIFILE PERFORMER STUFF :
    onCommand(cmd) {
      if(this.canPerform) {
        if(this.performer.mode !== 'perform' && cmd.pressed) { // key releases can never trigger perform mode
          this.performer.setMode('perform')
          this.setPerformModeStartedAt(Date.now()) // inform watchers, e.g. the scroll bar to set the button to pause
        }
        this.performer.command(cmd);
      }
    },
    onNotes(notes) {
      this.ioctl.playNoteEvents(notes)
    },
    onNoteOn(note) {
      this.animateNoteOn(note)
    },
    onNoteOff(note) {
      this.animateNoteOff(note)
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
      this.setUserClickOccurred()
      console.log('audio context should be ok on safari now');

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();
      const g = this.audioContext.createGain();
      g.gain.value = 0;
      g.connect(this.audioContext.destination);
      this.synth.setContext(this.audioContext);
      await this.synth.loadSounds();
    },
    updateCanPerform(e) {
      this.canPerform = e
    },
    onNotesFetched(e) {
      this.setSynthNotesFetched(e)
    },
    onNotesDecoded(e) {
      this.setSynthNotesDecoded(e)
    }
  },
  async created() {
    // await this.$store.dispatch('loadMidiBuffers');
    // await this.performer.initialize();

    this.performer.addListener('notes', this.onNotes);
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
    this.ioctl.addListener('command', this.onCommand);
    this.ioctl.addListener('noteOn', this.onNoteOn);
    this.ioctl.addListener('noteOff', this.onNoteOff);
    this.ioctl.addListener('allnotesoff', this.allNotesOff);

    // We can only load the audio context after MIDI access has been requested.
    document.addEventListener('click', this.onUserClick);

    this.synth.addListener('notesFetched', this.onNotesFetched);
    this.synth.addListener('notesDecoded', this.onNotesDecoded);

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

    // Ensure we kill all sound in external outputs when the page is closed or refreshed
    addEventListener('beforeunload', () => this.ioctl.allNotesOff())
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
