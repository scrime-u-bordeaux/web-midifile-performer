<template>
<div>
  <div>
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
        :width="(index / (size - 1)) * layout.width"
        :height="layout.barHeight" />
      <!-- <circle
        class="cursor"
        :cx="position * layout.width"
        :cx2="position * (layout.width - layout.cursorSize) + layout.cursorSize / 2"
        :cy="layout.height / 2"
        :r="layout.cursorSize / 2" /> -->
      <circle
        class="cursor"
        :cx="(index / (size - 1)) * (layout.width - layout.cursorSize) + layout.cursorSize / 2"
        :cy="layout.height / 2"
        :r="layout.cursorSize / 2" />
      <rect
        ref="loop-start"
        class="loop-bar"
        :x="layout.loopStartFlagLeft"
        y="0"
        :width="layout.loopBarWidth"
        :height="layout.height" />
      <polygon
        id="left"
        class="loop-flag"
        :points="`
          ${layout.loopStartFlagLeft},0
          ${layout.loopStartFlagLeft + layout.loopFlagWidth},${layout.loopFlagHeight / 2}
          ${layout.loopStartFlagLeft},${layout.loopFlagHeight}
        `" />
      <rect
        ref="loop-end"
        class="loop-bar"
        :x="layout.loopEndFlagRight - layout.loopBarWidth"
        y="0"
        :width="layout.loopBarWidth"
        :height="layout.height" />
      <polygon
        id="right"
        class="loop-flag"
        :points="`
          ${layout.loopEndFlagRight},0
          ${layout.loopEndFlagRight - layout.loopFlagWidth},${layout.loopFlagHeight / 2}
          ${layout.loopEndFlagRight},${layout.loopFlagHeight}
        `" />
    </svg>
  </div>

  <div class="indices">
    <div>
      <div> début </div>
      <!-- <div class="event-number"> {{ start + 1 }} </div> -->
      <input
        ref="start-input"
        type="number"
        :min="1"
        :max="end + 1"
        :value="start + 1"
        @input="onStartInput" />
    </div>
    <div>
      <div> courant </div>
      <!-- <div class="event-number"> {{ index + 1 }} </div> -->
      <input
        ref="index-input"
        type="number"
        :min="start + 1"
        :max="end + 1"
        :value="Math.max(index + 1, start + 1)"
        @keydown="e => { e.preventDefault(); }"
        @input="onIndexInput" />
      <!-- <number-input
        ref="index-input"
        :min="(start + 1)"
        :max="(end + 1 )"
        :value="(Math.max(index + 1, start + 1))"
        @change="onIndexChange"/> -->
    </div>
    <div>
      <div> fin </div>
      <!-- <div class="event-number"> {{ end + 1 }} </div> -->
      <input
        ref="end-input"
        type="number"
        :min="start + 1"
        :max="Math.max(1, size)"
        :value="end + 1"
        @input="onEndInput" />
        <!-- @change="onEndChange" /> -->
    </div>
  </div>
</div>
</template>

<style scoped>
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
  fill: #555;
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
.indices > div {
  display: inline-block;
  padding: 10px;
}
.indices input[type="number"] {
  /* pointer-events: none; */
  user-select: none;
}
.indices input[type="number"]::selection {
  caret-color: transparent;
  color: black;
  background: transparent;
}
.event-number {
  font-size: 2em;
}
</style>

<script>
import NumberInput from './NumberInput.vue';
export default {
  props: [ 'enabled', 'start', 'end', 'index', 'size' ],
  components: { NumberInput },
  data() {
    return {
      dragging: null,
      boundingRect: null,
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
    positions() {
      // return this.end - this.start + 1;
      console.log(this.size);
      return this.size;
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
        barHeight: 2,
        cursorSize: 20,
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
    //*/
  },
  created() {
    document.addEventListener('mousemove', this.drag);
    document.addEventListener('mouseup', this.endDrag);
  },
  mounted() {
    this.boundingRect = this.$refs['scroll-bar'].getBoundingClientRect();
  },
  beforeUnmount() {
    document.removeEventListener('mousemove', this.drag);
    document.removeEventListener('mouseup', this.endDrag);
  },
  methods: {
    onStartInput(e) {
      const input = this.$refs['start-input'];
      let v = input.value - 1;
      v = Math.min(this.end, Math.max(0, v));
      // input.value = v;
      this.$emit('start', v);
      if (this.index < v)
        this.$emit('index', v);
    },
    onIndexInput(e) {
      const input = this.$refs['index-input'];
      let v = input.value - 1;
      v = Math.min(this.end, Math.max(this.start, v));
      // input.value = v;
      this.$emit('index', v);
    },
    onIndexChange(e) {

    },
    onEndInput(e) {
      const input = this.$refs['end-input'];
      let v = input.value - 1;
      v = Math.min(this.size - 1, Math.max(this.start, v));
      // input.value = v;
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

      let position = (e.clientX - x - this.cursorRadius) /
                     (width - 2 * this.cursorRadius);
      position = Math.max(Math.min(position, 1), 0);
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
  },
};
</script>