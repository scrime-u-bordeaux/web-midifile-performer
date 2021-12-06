<template>
  <div>
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
      class="scroll"
      :enabled="currentMode === 'perform'"
      :start="sequenceStart"
      :end="sequenceEnd"
      :index="sequenceIndex"
      @index="onIndexChange"/>

    <div>
    <button
      @click="onClickListen"
      :disabled="currentMode !== 'silent' && currentMode !== 'listen'">
      Écouter
    </button>

    <button
      @click="onClickPerform"
      :disabled="currentMode !== 'silent' && currentMode !== 'perform'">
      Interpréter
    </button>

    <button
      style="display: none;"
      @click="onClickExport"
      :disabled="currentMode !== 'silent'">
      Exporter
    </button>

    <button
      @click="$router.push('/midifile-performer')"
      :disabled="currentMode !== 'silent'">
      Aller plus loin 
    </button>
    </div>
  </div>
</template>

<style scoped>
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
      'midiBuffers',
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
  created() {
    this.performer.addListener('index', this.onIndexChange);
  },
  async mounted() {
    const bufferId = 'bach-c-prelude-the-well-tempered-clavier'
    //console.log(this.midiBuffers);
    await this.performer.loadArrayBuffer(this.midiBuffers[bufferId].buffer);
    this.performer.setSequenceBounds([ 0, 63 ]);
    this.performer.setMode('silent');
    this.cursor = { x: -100, y: 0 };
  },
  beforeUnmount() {
    this.performer.setMode('silent');
    this.performer.removeListener('index', this.onIndexChange);
  },
  methods: {
    // ...mapMutations([
    //   'setKeyboardState',
    //   'setSequenceIndex',
    // ]),
    onIndexChange(i) { // callback from scrollbar
      //this.setSequenceIndex(i); // already done in App.vue
      this.cursor = i < this.positions.length
                  ? this.positions[i]
                  : { x: -100, y: 0 };
    },
    onClickListen() {
      this.currentMode = this.currentMode === 'silent' ? 'listen' : 'silent';
      this.performer.setMode(this.currentMode);
      // if (this.currentMode !== 'listen') {
        this.performer.setSequenceIndex(0);
        this.cursor = { x: -100, y: 0 };
      // }
    },
    onClickPerform() {
      this.currentMode = this.currentMode === 'silent' ? 'perform' : 'silent';
      this.performer.setMode(this.currentMode);
      // if (this.currentMode !== 'perform') {
        this.performer.setSequenceIndex(0);
        this.cursor = { x: -100, y: 0 };
      // }
      // this.performer.reset();
    },
  },
};
</script>