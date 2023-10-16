<template>
  <div class="container">
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
      @modeChange="onModeChange"/>

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
  max-width: var(--content-width);
  display: flex;
  flex-direction: column;
  align-items: center;
}
.score, .scroll, .keyboard {
  display: inline-block;
  max-width: var(--score-width);
  width: 100%;
}
</style>

<script>
import { mapState, mapMutations } from 'vuex';
import BachPrelude from '../components/BachPrelude.vue';
import Keyboard from '../components/Keyboard.vue';
import ScrollBar from '../components/ScrollBar.vue';

export default {
  inject: [ 'performer' ],
  components: { BachPrelude, Keyboard, ScrollBar },
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
    ]),
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
      ]
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
  },
  mounted() {
    // ?
  },
  beforeUnmount() {
    this.performer.setMode('silent');
    this.performer.removeListener('index', this.onPerformerIndexChange);
    document.removeEventListener('keydown',this.onKeyDown)
  },
  methods: {
    ...mapMutations([
      'setFirstStepsMidiFile',
    ]),
    async loadFirstStepsMidiFile() {
      await this.performer.loadArrayBuffer(this.firstStepsMidiFile.buffer);
      this.performer.setMode('silent');
      this.performer.addListener('index', this.onPerformerIndexChange);
      this.performer.setSequenceBounds(0, 63);
      this.performer.setSequenceIndex(0);
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
    onModeChange(mode) {
      this.performer.setMode(mode);
    },
    onKeyDown(e) {
      if(e.code === 'Space') {
        e.preventDefault()
        this.$refs.scrollBar.onClickListen()
      }
    }
  },
};
</script>
