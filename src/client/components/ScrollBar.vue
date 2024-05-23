<template>

<div class="scroll-bar-container" :class="!hasBounds ? 'horizontal-layout' : 'vertical-layout'" >

  <div class="indices" v-if="!hasBounds">
    <div class="no-bounds-indice">
      <NumberInput
        ref="index-input"
        :label="capitalizedIndexLabel || $t('scrollBar.current')"
        :min="hasBounds ? start + 1 : start"
        :max="hasBounds ? end + 1 : end"
        :step="1"
        :value="Math.max(index, start)"
        :allowNaN="true"
        @input="onIndexInput"
      />
    </div>
  </div>

  <div :class="!hasBounds ? 'reduced-width' : 'full-width'">
    <!-- @mousedown="startDrag"> -->

    <svg
      style="/*display: none;*/"
      ref="scroll-bar"
      width="100%" height="100%" :viewBox="`0 0 ${layout.width} ${layout.height}`"
      @mousedown="startDrag">
      <rect
        class="line-bg"
        x="0"
        :y="(layout.height - layout.barHeight) / 2"
        :width="layout.width"
        :height="layout.barHeight" />
      <!-- <rect
        class="line-fg"
        x="0"
        :y="(layout.height - layout.barHeight) / 2"
        :width="(position * layout.width)"
        :height="layout.barHeight" /> -->
      <rect
        class="line-fg"
        x="0"
        :y="(layout.height - layout.barHeight) / 2"
        :width="((index - start) / (size - 1)) * layout.width"
        :height="layout.barHeight" />
      <!-- <circle
        class="cursor"
        :cx="position * layout.width"
        :cx2="position * (layout.width - layout.cursorSize) + layout.cursorSize / 2"
        :cy="layout.height / 2"
        :r="layout.cursorSize / 2" /> -->
      <circle
        class="cursor"
        :cx="((index - start) / (size - 1)) * (layout.width - layout.cursorSize) + (layout.cursorSize / 2)"
        :cy="layout.height / 2"
        :r="layout.cursorSize / 2"/>
      <rect
        v-if="hasBounds"
        ref="loop-start"
        class="loop-bar"
        :x="layout.loopStartFlagLeft"
        y="0"
        :width="layout.loopBarWidth"
        :height="layout.height" />
      <polygon
        v-if="hasBounds"
        id="left"
        class="loop-flag"
        :points="`
          ${layout.loopStartFlagLeft},0
          ${layout.loopStartFlagLeft + layout.loopFlagWidth},${layout.loopFlagHeight / 2}
          ${layout.loopStartFlagLeft},${layout.loopFlagHeight}
        `" />
      <rect
        v-if="hasBounds"
        ref="loop-end"
        class="loop-bar"
        :x="layout.loopEndFlagRight - layout.loopBarWidth"
        y="0"
        :width="layout.loopBarWidth"
        :height="layout.height" />
      <polygon
        v-if="hasBounds"
        id="right"
        class="loop-flag"
        :points="`
          ${layout.loopEndFlagRight},0
          ${layout.loopEndFlagRight - layout.loopFlagWidth},${layout.loopFlagHeight / 2}
          ${layout.loopEndFlagRight},${layout.loopFlagHeight}
        `" />
    </svg>
  </div>

  <div class="indices" v-if="hasBounds">
    <div class="play-button-container">
      <div class="play-button"
       :class="currentMode === 'listen' ? 'pause-icon' : 'play-icon'"
       @click="toggleListen">
      </div>
    </div>

    <div class="speed-input">
      <NumberInput
        ref="speed-input"
        :label="$t('scrollBar.speed')"
        :min="0.1"
        :max="10"
        :step="0.1"
        :value="1"
        :allowNaN="false"
        @input="onPlaybackSpeedChanged"
      />
    </div>

    <div>
      <NumberInput
        ref="start-input"
        :label="$t('scrollBar.start')"
        :min="1"
        :max="end + 1"
        :step="1"
        :value="start + 1"
        :allowNaN="true"
        @input="onStartInput"
      />
    </div>

    <div>
      <NumberInput
        ref="index-input"
        :label="capitalizedIndexLabel || $t('scrollBar.current')"
        :min="hasBounds ? start + 1 : start"
        :max="hasBounds ? end + 1 : end"
        :step="1"
        :value="hasBounds ? Math.max(index + 1, start + 1) : Math.max(index, start)"
        :allowNaN="true"
        @input="onIndexInput"
      />
    </div>

    <div>
      <NumberInput
        ref="end-input"
        :label="$t('scrollBar.end')"
        :min="start + 1"
        :max="Math.max(1, size)"
        :step="1"
        :value="end + 1"
        :allowNaN="true"
        @input="onEndInput"
      />
    </div>

    <div class="stop-button-container">
      <div class="stop-button" @click="silence()"></div>
    </div>
  </div>

  <span v-else class="pseudo-link" @click="$emit('reset')">{{ $t('scrollBar.reset') }}</span>
</div>
</template>

<style scoped>
.scroll-bar-container.vertical-layout {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.scroll-bar-container.vertical-layout .full-width{
  width: var(--score-width)
}
.horizontal-layout {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.horizontal-layout .reduced-width {
  margin-top: 2em;
  width: 60%;
}
.pseudo-link {
  font-style: italic;
  color: var(--hint-blue);
  text-decoration: underline;
  cursor: pointer;
  margin-top: 1.5em;
}
/* diable pointer events on all children : */
rect, circle {
  pointer-events: none;
  /*fill: none;*/
  /*stroke-width: 1;*/
  /*stroke-linecap: 'round';*/
}
.line-bg {
  /*stroke: black;*/
  /* fill: black; */
  fill: #666;
}
.line-fg {
  /*stroke: var(--button-blue);*/
  fill: var(--button-blue);
}
.cursor {
  pointer-events: none;
  /*cursor: pointer;*/
  fill: var(--button-blue);
  stroke: none;
}
.loop-bar {
  /* fill: rgba(30, 30, 30, 0.3); */
  fill: black;
}
.loop-flag {
  fill: red;
  stroke: black;
  stroke-width: 1;
}
.indices {
  width: fit-content;
}
.indices > div {
  display: inline-block;
  padding: 10px;
}
.play-button-container {
  width: 1.875rem;
  height: 1.875rem;
}
.play-button {
  cursor: pointer;
  width: 0;
  box-sizing: border-box;
  border-color: transparent transparent transparent var(--button-blue);
  transition: 100ms all ease;
  will-change: border-width;
}
.play-button.play-icon {
  height: 0;
  border-style: solid;
  border-width: 1rem 0px 1rem 1.875rem;
}
.play-button.pause-icon {
  height: 1.875rem;
  border-style: double;
  border-width: 0 0 0 1.875rem;
}
.stop-button {
  cursor: pointer;
  width: 1.875rem;
  height: 1.875rem;
  background-color: red;
}
.indices .no-bounds-indice {
  padding-right: 0;
  padding-top: 0;
  padding-bottom: 0;

  width: 11.25em;
}
.event-number {
  font-size: 2em;
}
</style>

<script>
import NumberInput from './NumberInput.vue';
import { mapState } from 'vuex';

export default {
  // TODO : should we keep exposing start and end as props instead of through mapState ?
  props: [ 'start', 'end', 'index', 'size', 'hasBounds', 'indexLabel' ],
  components: { NumberInput },
  data() {
    return {
      currentMode: 'silent',
      dragging: null,
      position: 0,
      refreshKey: 0,
      // index: 1,
      /*
      layout: {
        width: 1000,
        height: 40,
        barHeight: 2,
        cursorSize: 18,
        loopMarkerWidth: 2,
        loopFlagWidth: 13,
        loopFlagHeight: 12,
      },
      //*/
    };
  },
  computed: {
    ...mapState(
      ['performModeStartedAt']
    ),
    positions() {
      // return this.end - this.start + 1;
      console.log(this.size);
      return this.size;
    },
    boundingRect() {
      return this.$refs['scroll-bar'].getBoundingClientRect();
    },
    cursorRadius() {
      if (!this.boundingRect) { return 0; }
      // return this.boundingRect.height * 0.5;
      return this.boundingRect.height * 0.5 * (this.layout.cursorSize / this.layout.height);
    },
    //*
    layout() {
      // this.position;
      const layout = {
        width: 1000,
        height: 60,
        barHeight: this.hasBounds ? 2 : 10,
        cursorSize: this.hasBounds ? 20 : 30,
        loopBarWidth: 2,
        loopFlagHeight: 15,
        loopFlagWidth: 18,
      };
      return {
        ...layout,
        loopStartFlagLeft: (this.start / (this.size - 1)) * (layout.width - layout.cursorSize),
        loopEndFlagRight: (this.end / (this.size - 1)) * (layout.width - layout.cursorSize) + layout.cursorSize,
      };
    },
    capitalizedIndexLabel() {
      return !!this.indexLabel ? this.indexLabel[0].toUpperCase() + this.indexLabel.slice(1) : ""
    }
    //*/
  },
  watch: {
    performModeStartedAt(newestTime, previousTime) {
      this.currentMode = 'perform'
    }
  },
  created() {
    document.addEventListener('mousemove', this.drag);
    document.addEventListener('mouseup', this.endDrag);
    document.addEventListener('keydown', this.onKeyDown);
  },
  beforeUnmount() {
    document.removeEventListener('mousemove', this.drag);
    document.removeEventListener('mouseup', this.endDrag);
    document.removeEventListener('keydown', this.onKeyDown);
  },
  methods: {
    onStartInput(e) {
      let v = e.target.value - 1;
      v = Math.min(this.end, Math.max(0, v));
      if(this.hasBounds) // this method shouldn't be called if this is false anyway, but just to be sure
        this.$emit('start', v);
      if (this.index < v)
        this.$emit('index', v);
    },
    onIndexInput(e) {
      let v = this.hasBounds ? e.target.value - 1 : e.target.value;
      v = Math.min(this.end, Math.max(this.start, v));
      this.$emit('index', v);
    },
    onIndexChange(e) {

    },
    onEndInput(e) {
      let v = e.target.value - 1;
      v = Math.min(this.size - 1, Math.max(this.start, v));
      if(this.hasBounds) // this method shouldn't be called if this is false anyway, but just to be sure
        this.$emit('end', v);
      if (this.index > v)
        this.$emit('index', v);
    },
    // checkIfInsideRect(x, y, rect) {
    //   return (
    //       x > rect.left && x < rect.right &&
    //       y > rect.top && y < rect.bottom
    //     );
    // },
    startDrag(e) {
      // this.boundingRect = e.target.getBoundingClientRect();
      // const loopStartRect = this.$refs['loop-start'].getBoundingClientRect();
      // const loopEndRect = this.$refs['loop-end'].getBoundingClientRect();

      if (e.target.classList.contains('loop-flag')) {
        console.log(`clicked ${e.target.id} loop flag`);
        this.dragging = e.target.id === 'left' ? 'start' : 'end';
        // this.draggingOffset = e.clientX - this.boundingRect.x;
        this.draggingOffset = e.clientX - e.target.getBoundingClientRect().x;
        // this.draggingOffset = e.clientX - this.boundingRect.x - e.target.getBoundingClientRect().x;
      } else {
        // console.log(e.target.classList);
        this.dragging = 'cursor';
        this.drag(e);
      }
    },
    drag(e) {
      if (this.dragging === null) return;

      const { x, width } = this.boundingRect;

      if (this.dragging === 'start' || this.dragging === 'end') {
        let position = (e.clientX - this.draggingOffset - x) / (width - 2 * this.cursorRadius);
        position = Math.max(Math.min(position, 1), 0);
        const newBound = Math.round(position * (this.size - 1));
        this.$emit(this.dragging, newBound);
        // console.log(`emitting new ${this.dragging} of ${newBound}`);
        return;
      }

      let position = (e.clientX - x - this.cursorRadius + (this.start / (this.size - 1))*(width - 2 * this.cursorRadius)) /
                     (width - 2 * this.cursorRadius);
                     
      let newIndex = Math.round(position * (this.size - 1));
      newIndex = Math.min(this.end, Math.max(this.start, newIndex));
      // console.log(`new index : ${newIndex}`);

      // if (newIndex !== this.index) {
        this.$emit('index', newIndex);
      // }
    },
    endDrag(e) {
      if (this.dragging === null) return;
      this.dragging = null;
    },
    toggleListen(e) {
      // THIS IS *BAD* and I despise myself for thinking such duplication was acceptable
      // For the love of all that is good in this world, please let the store deal with this !!!
      const newMode = this.currentMode === 'listen' ? 'silent' : 'listen';
      this.currentMode = newMode
      this.$emit('modeChange', newMode);
    },
    onPlaybackSpeedChanged(e) {
      this.$emit('speed', e.target.value)
    },
    onKeyDown(e) {
      if(this.hasBounds) { // I don't think most users will want to use the arrow keys for velocities or playback speed, so this avoids having to manage focus
        if(e.code==="ArrowLeft") this.$emit("index",this.index - 1)
        if(e.code==="ArrowRight") this.$emit("index",this.index + 1)
      }
    },
    resetSpeedDisplay() {
      // FIXME : REPLACE THIS WITH REACTIVITY BY CHANGING THE COMPONENT STRUCTURE
      // (divorce ScrollBar from Slider, and give ScrollBar a "speed" prop)
      this.$refs['speed-input'].reset()
    },
    silence() {
      this.$emit('silence')
    }
  },
};
</script>
