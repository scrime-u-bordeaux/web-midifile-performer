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
    ]),
  },

  async created() {
    // TODO : should these be moved to MFP.vue instead ?
    // The semantic separation isn't too clear at the moment.
    this.performer.addListener('notes', this.onNotes);
    // Simply calling ioctl.allNotesOff results in the wrong 'this' binding.
    // JS~
    this.performer.addListener('allnotesoff', this.onPerformerAllNotesOff);
    this.performer.addListener('sequence', this.onSequenceChanged);
    this.performer.addListener('index', this.onSequenceIndex);
    this.performer.addListener('speed', this.onPlaybackSpeedChanged);

    this.ioctl.setInternalSampler(this.synth);
    this.ioctl.addListener('inputs', this.onInputsChanged);
    this.ioctl.addListener('outputs', this.onOutputsChanged);
    this.ioctl.addListener('command', this.onCommand);
    this.ioctl.addListener('noteOn', this.onNoteOn);
    this.ioctl.addListener('noteOff', this.onNoteOff);
    this.ioctl.addListener('channelOff', this.onChannelOff);
    // There is, shockingly, no segregation of events based on their emitter,
    // So this event must have a different name from the performer's allnotesoff,
    // Otherwise it will share the same listener, leading to infinite recursion.
    this.ioctl.addListener('ioctlallnotesoff', this.onIoctlAllNotesOff);

    // We can only load the audio context after MIDI access has been requested.
    document.addEventListener('click', this.onUserClick);

    this.synth.addListener('notesFetched', this.onNotesFetched);
    this.synth.addListener('notesDecoded', this.onNotesDecoded);

    // Ensure we kill all sound in external outputs when the page is closed or refreshed
    addEventListener('beforeunload', () => this.ioctl.allNotesOff())
  },

  beforeUnmount() {
    this.synth.removeListener('notesFetched', this.onNotesFetched);
    this.synth.removeListener('notesDecoded', this.onNotesDecoded);

    this.ioctl.removeListener('inputs', this.onInputsChanged);
    this.ioctl.removeListener('outputs', this.onOutputsChanged);
    this.ioctl.removeListener('command', this.onCommand)
    this.ioctl.removeListener('noteOn', this.onNoteOn);
    this.ioctl.removeListener('noteOff', this.onNoteOff);
    this.ioctl.removeListener('channelOff', this.onChannelOff);
    this.ioctl.removeListener('ioctlallnotesoff', this.onIoctlAllNotesOff);

    this.performer.removeListener('notes', this.onNotes);
    this.performer.removeListener('allnotesoff', this.onPerformerAllNotesOff);
    this.performer.removeListener('sequence', this.onPerformerBufferChanged);
    this.performer.removeListener('index', this.onSequenceIndex);
    this.performer.removeListener('speed', this.onPlaybackSpeedChanged);
  },

  methods: {
    ...mapMutations([
      'setInputs',
      'setOutputs',
      // 'setKeyboardState',
      'animateNoteOn',
      'animateNoteOff',
      'animateChannelOff',
      'animateAllNotesOff',
      'setSequenceLength',
      'setSequenceStart',
      'setSequenceEnd',
      'setSequenceIndex',
      'setPlaybackSpeed',
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

    // This is the core of the app, which triggers perform by the user.
    onCommand(cmd) {
      if(this.canPerform) this.performer.command(cmd);
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

    onChannelOff(channel) {
      this.animateChannelOff(channel) // update keyboard state
    },
    onPerformerAllNotesOff() {
      this.ioctl.allNotesOff()
    },
    onIoctlAllNotesOff() {
      this.animateAllNotesOff(); // ditto
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

    onPlaybackSpeedChanged(speed) {
      this.setPlaybackSpeed(speed)
    },

    onNotesFetched(e) {
      this.setSynthNotesFetched(e)
    },
    onNotesDecoded(e) {
      this.setSynthNotesDecoded(e)
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
    }
  }
};
</script>
