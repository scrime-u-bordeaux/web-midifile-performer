<template>
  <LoadingScreen v-if="displayLoadingScreen"/>

  <div v-else class="container">
    <bach-prelude
      class="score"
      :cursor="cursor"/>

    <Keyboard
      ref="keyboard"
      class="keyboard"
      :state="keyboardState"
      :minNote="minKeyboardNote"
      :maxNote="maxKeyboardNote"
      :whiteNoteWidth="15"/>

    <scroll-bar
      ref="scrollBar"
      class="scroll"
      :hasBounds="true"
      :start="Math.min(sequenceStart, maxLength - 1)"
      :end="Math.min(sequenceEnd,     maxLength - 1)"
      :index="Math.min(sequenceIndex, maxLength - 1)"
      :size="Math.min(sequenceLength, maxLength)"
      @index="onScrollBarIndexChange"
      @start="onScrollBarStartChange"
      @end="onScrollBarEndChange"
      @speed="onSpeedChange"
      @modeChange="onModeChange"
      @silence="onSilence"/>

    <div>

    <button
      style="display: none;"
      @click="onClickExport"
      :disabled="currentMode !== 'silent'">
      {{$t('firstSteps.export')}}
    </button>

    <button
      @click="$router.push('/midifile-performer')"
      :disabled="currentMode !== 'silent'">
      {{$t('firstSteps.goFurther')}}
    </button>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.score, .scroll, .keyboard {
  display: inline-block;
  width: 100%;
}
.score, .keyboard {
  max-width: var(--score-width);
}
</style>

<script>
import { mapState, mapMutations } from 'vuex';
import BachPrelude from '../components/BachPrelude.vue';
import Keyboard from '../components/Keyboard.vue';
import ScrollBar from '../components/ScrollBar.vue';
import LoadingScreen from '../components/LoadingScreen.vue';

export default {
  inject: [ 'performer', 'ioctl', 'DEFAULT_IO_ID', 'NUMBER_OF_KEYS', 'NUMBER_OF_SOUNDFILES' ],
  components: { BachPrelude, Keyboard, ScrollBar, LoadingScreen },
  computed: {
    ...mapState([
      'firstStepsMidiFile',
      'minKeyboardNote',
      'maxKeyboardNote',
      'keyboardState',
      'sequenceLength',
      'sequenceStart',
      'sequenceEnd',
      'sequenceIndex',
      'synthNotesDecoded'
    ]),
    displayLoadingScreen() {
      return (!localStorage.getItem('output') || localStorage.getItem('output') === this.DEFAULT_IO_ID)
        && this.synthNotesDecoded !== this.NUMBER_OF_SOUNDFILES
    }
  },
  data() {
    return {
      //sequenceLength: this.performer.chordSequence.length,
      maxLength: 64,
      currentMode: 'silent',
      cursor: { x: -100, y: 0 },
      positions: [
        { x: 656, y: 200 },
        { x: 783, y: 200 },
        { x: 870, y: 200 },
        { x: 995, y: 200 },
        { x: 1117, y: 200 },
        { x: 1245, y: 200 },
        { x: 1370, y: 200 },
        { x: 1495, y: 200 },

        { x: 1620, y: 200 },
        { x: 1745, y: 200 },
        { x: 1835, y: 200 },
        { x: 1960, y: 200 },
        { x: 2080, y: 200 },
        { x: 2205, y: 200 },
        { x: 2330, y: 200 },
        { x: 2455, y: 200 },

        { x: 2695, y: 200 },
        { x: 2820, y: 200 },
        { x: 2940, y: 200 },
        { x: 3065, y: 200 },
        { x: 3190, y: 200 },
        { x: 3315, y: 200 },
        { x: 3440, y: 200 },
        { x: 3565, y: 200 },

        { x: 3692, y: 200 },
        { x: 3818, y: 200 },
        { x: 3935, y: 200 },
        { x: 4065, y: 200 },
        { x: 4190, y: 200 },
        { x: 4315, y: 200 },
        { x: 4440, y: 200 },
        { x: 4565, y: 200 },

        { x: 500, y: 1750 },
        { x: 630, y: 1750 },
        { x: 750, y: 1750 },
        { x: 880, y: 1750 },
        { x: 1012, y: 1750 },
        { x: 1140, y: 1750 },
        { x: 1272, y: 1750 },
        { x: 1404, y: 1750 },

        { x: 1532, y: 1750 },
        { x: 1665, y: 1750 },
        { x: 1785, y: 1750 },
        { x: 1915, y: 1750 },
        { x: 2045, y: 1750 },
        { x: 2175, y: 1750 },
        { x: 2305, y: 1750 },
        { x: 2435, y: 1750 },

        { x: 2685, y: 1750 },
        { x: 2815, y: 1750 },
        { x: 2910, y: 1750 },
        { x: 3040, y: 1750 },
        { x: 3168, y: 1750 },
        { x: 3298, y: 1750 },
        { x: 3428, y: 1750 },
        { x: 3558, y: 1750 },

        { x: 3690, y: 1750 },
        { x: 3820, y: 1750 },
        { x: 3915, y: 1750 },
        { x: 4042, y: 1750 },
        { x: 4170, y: 1750 },
        { x: 4300, y: 1750 },
        { x: 4430, y: 1750 },
        { x: 4560, y: 1750 },
      ],
      spacePressed: false,
      pauseWithRelease: false
    };
  },
  async created() {

    // Load the "first steps" midi file

    if (this.firstStepsMidiFile.buffer === null) {
      const file = this.firstStepsMidiFile;
      fetch(file.url)
      .then(res => res.arrayBuffer())
      .then(async buffer => {
        file.buffer = buffer;
        // const { id, ...data } = { ...file, buffer };
        this.setFirstStepsMidiFile(file);
        await this.loadFirstStepsMidiFile();
      });
    } else {
      await this.loadFirstStepsMidiFile();
    }

    // Activate pause function (duplication with MFP view, but this is the case for everything else on this page)

    document.addEventListener('keydown',this.onKeyDown)
    document.addEventListener('keyup',this.onKeyUp)
  },
  mounted() {
    this.$emit("canPerform",true)
  },
  beforeUnmount() {
    this.$emit("canPerform",false)
    this.performer.setMode('silent');
    this.ioctl.allNotesOff()

    this.performer.removeListener('index', this.onPerformerIndexChange);
    document.removeEventListener('keydown',this.onKeyDown)
    document.removeEventListener('keyup',this.onKeyUp)
  },
  methods: {
    ...mapMutations([
      'setFirstStepsMidiFile',
    ]),
    async loadFirstStepsMidiFile() {
      await this.performer.loadArrayBuffer(this.firstStepsMidiFile.buffer);
      this.performer.setMode('silent');
      this.performer.setPlaybackSpeed(1)
      this.performer.addListener('index', this.onPerformerIndexChange);
      this.performer.setSequenceBounds(0, 63);
      this.performer.setSequenceIndex(0);
      // this.$refs.scrollBar.resetSpeedDisplay();
      this.cursor = { x: -100, y: 0 };
    },
    onScrollBarStartChange(i) {
      this.performer.setSequenceBounds(i, this.sequenceEnd);
    },
    onScrollBarIndexChange(i) {
      this.performer.setSequenceIndex(i);
      this.onPerformerIndexChange(i);
    },
    onPerformerIndexChange(i) {
      this.cursor = i < this.positions.length
                  ? this.positions[i]
                  : { x: -100, y: 0 };
    },
    onScrollBarEndChange(i) {
      this.performer.setSequenceBounds(this.sequenceStart, i);
    },
    onSpeedChange(s) {
      this.performer.setPlaybackSpeed(s);
    },
    onModeChange(mode) {
      this.performer.setMode(mode);
    },
    onSilence() {
      if(this.performer.mode === 'listen') this.$refs.scrollBar.toggleListen() // keep scrollbar state consistent if listen mode
      else this.performer.setMode('silent') // simply silence if perform mode
    },
    onKeyDown(e) {
      if(e.code === 'Space') {
        e.preventDefault()
        if(!this.spacePressed) {
          this.spacePressed = true;
          this.$refs.scrollBar.toggleListen()
        } else {
          this.pauseWithRelease = true;
        }
      }
    },
    onKeyUp(e) {
      if(e.code === 'Space' && this.spacePressed) {
        this.spacePressed = false;
        if(this.pauseWithRelease) {
          this.pauseWithRelease = false;
          if(this.performer.mode === 'listen') this.$refs.scrollBar.toggleListen()
        }
      }
    }
  },
};
</script>
