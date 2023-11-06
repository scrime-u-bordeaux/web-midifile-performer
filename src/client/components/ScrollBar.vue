<template>
<div class="scroll-bar-container" :class="!hasBounds ? 'horizontal-layout' : 'vertical-layout'" >
  <div :class="!hasBounds ? 'with-reset' : 'full-width'">
    <!-- @mousedown="startDrag"> -->
    <span v-if="!hasBounds" class="pseudo-link" @click="$emit('reset')">{{ $t('scrollBar.reset') }}</span>
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

  <div class="indices">
    <div v-if="hasBounds" class="play-button-container">
      <div class="play-button"
       :class="currentMode === 'listen' ? 'pause-icon' : 'play-icon'"
       @click="toggleListen">
      </div>
    </div>

    <div v-if="hasBounds" class="speed-input">
      <div class="input-label"> {{ $t('scrollBar.speed') }} </div>

      <input
        ref="speed-input"
        name="speed"
        type="number"
        :min="0.1"
        :max="10"
        :step="0.1"
        :value="1"
        @keydown="onInputKeyDown"
        @input="onPlaybackSpeedChanged"
      />
    </div>

    <div v-if="hasBounds">
      <div class="input-label"> {{$t('scrollBar.start')}} </div>
      <!-- <div class="event-number"> {{ start + 1 }} </div> -->
      <input
        ref="start-input"
        name="start"
        type="number"
        :min="1"
        :max="end + 1"
        :value="start + 1"
        @keydown="onInputKeyDown"
        @input="onStartInput" />
    </div>
    <div :class="!hasBounds ? 'no-padding-indice' : ''">
      <div class="input-label"> {{ capitalizedIndexLabel || $t('scrollBar.current') }} </div>
      <!-- <div class="event-number"> {{ index + 1 }} </div> -->
      <input
        ref="index-input"
        name="index"
        type="number"
        :min="hasBounds ? start + 1 : start"
        :max="hasBounds ? end + 1 : end"
        :value="hasBounds ? Math.max(index + 1, start + 1) : Math.max(index, start)"
        @keydown="onInputKeyDown"
        @input="onIndexInput" />
      <!-- <number-input
        ref="index-input"
        :min="(start + 1)"
        :max="(end + 1 )"
        :value="(Math.max(index + 1, start + 1))"
        @change="onIndexChange"/> -->
    </div>
    <div v-if="hasBounds">
      <div class="input-label"> {{$t('scrollBar.end')}} </div>
      <!-- <div class="event-number"> {{ end + 1 }} </div> -->
      <input
        ref="end-input"
        name="end"
        type="number"
        :min="start + 1"
        :max="Math.max(1, size)"
        :value="end + 1"
        @keydown="onInputKeyDown"
        @input="onEndInput" />
        <!-- @change="onEndChange" /> -->
    </div>

    <div v-if="hasBounds" class="stop-button-container" @click="silence()">
      <div class="stop-button"></div>
    </div>
  </div>
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
.scroll-bar-container.horizontal-layout {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center; /* Actually, this is useless on Firefox (because the elements on the same size) and doesn't work on Chrome (because native Chrome inputs are different sizes and thus misaligned anyway)*/
}
.scroll-bar-container.horizontal-layout .with-reset {
  display: flex;
  flex-direction: column;
  align-items: start;
  margin-top: 12px;
  width: 85%;
}
.pseudo-link {
  font-style: italic;
  color: var(--hint-blue);
  text-decoration: underline;
  cursor: pointer;
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
.indices .no-padding-indice {
  padding-right: 0;
  padding-top: 0;
  padding-bottom: 0;
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
.indices .input-label {
  margin-bottom: 8px;
}
.event-number {
  font-size: 2em;
}
</style>

<script>
import NumberInput from './NumberInput.vue';
import { mapState } from 'vuex';

export default {
  props: [ 'start', 'end', 'index', 'size', 'hasBounds', 'indexLabel' ],
  components: { NumberInput },
  data() {
    return {
      currentMode: 'silent',
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
    ...mapState(
      ['performModeStartedAt']
    ),
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
  mounted() {
    this.boundingRect = this.$refs['scroll-bar'].getBoundingClientRect();
  },
  beforeUnmount() {
    document.removeEventListener('mousemove', this.drag);
    document.removeEventListener('mouseup', this.endDrag);
    document.removeEventListener('keydown', this.onKeyDown);
  },
  methods: {
    onStartInput(e) {
      const input = this.$refs['start-input'];
      let v = input.value - 1;
      v = Math.min(this.end, Math.max(0, v));
      // input.value = v;
      if(this.hasBounds) // this method shouldn't be called if this is false anyway, but just to be sure
        this.$emit('start', v);
      if (this.index < v)
        this.$emit('index', v);
    },
    onIndexInput(e) {
      const input = this.$refs['index-input'];
      let v = this.hasBounds ? input.value - 1 : input.value;
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
    toggleListen(e) {
      const newMode = this.currentMode === 'listen' ? 'silent' : 'listen';
      this.currentMode = newMode // to avoid such duplication, it's possible to use the store.
      // however, this induces a lateral workflow between components that will be harder to maintain in the long run.
      // a little duplication seems preferrable (unless we can find a third, better solution)
      this.$emit('modeChange', newMode);
    },
    onPlaybackSpeedChanged(e) {
      const input = this.$refs['speed-input']
      this.$emit('speed', input.value)
    },
    onKeyDown(e) {
      if(this.hasBounds) { // I don't think most users will want to use the arrow keys for velocities or playback speed, so this avoids having to manage focus
        if(e.code==="ArrowLeft") this.$emit("index",Math.max(this.index - 1, 0))
        if(e.code==="ArrowRight") this.$emit("index",this.index + 1)
      }
    },
    // BEWARE : extremely messy code ahead
    // Even a regexp would not properly handle every case...
    // There has to be a better way to do this, right ???
    onInputKeyDown(e) {
      e.stopPropagation(); // prevent these inputs from triggering the MFP

      // This was the simple part.
      // Now, we need to ensure the value displayed to the user stays in bounds
      // This is not enforced by min and max.

      // First : we want to exclude any key that doesn't make sense with the number input.

      const allValidKeys = ['0','1','2','3','4','5','6','7','8','9','Backspace','ArrowUp','ArrowDown','.']
      const numberKeys = allValidKeys.slice(0,10)

      let validInputKeys;
      if(e.target.name === "speed") validInputKeys = allValidKeys // Speed takes decimals
      else validInputKeys = allValidKeys.slice(0,-1)

      // Then, we must determine what the tentative value after the event would be.

      let attemptedValue;

      // Disclaimer : I think using Number conversion on e.target.value instead of valueAsNumber helps with uniformity and readability here.
      // Else ifs instead of switch is to avoid having to fallthrough for all numerical cases

      const initialInputString = e.target.value
      const initialInputNumber = Number(initialInputString)

      if(numberKeys.includes(e.key)) { // User pressed a number key. Simply concatenate.
        // The decimal flag exists to distinguish between "1" and "1.",
        // which e.target.value does not do.
        if(initialInputString.includes('.') || (this.decimalFlag && e.target.name === "speed")) {
          // null check necessary or we get a NaN
          // yes, even with the safe call operator
          const decimalPlaces = initialInputString.split('.')[1] ? initialInputString.split('.')[1].length : 0
          attemptedValue = initialInputNumber + (Number(e.key) * 10**-(decimalPlaces+1))
        }
        else attemptedValue = Number(e.target.value+e.key)
      }

      // User is incrementing by the step.
      else if(e.key === "ArrowUp") attemptedValue = initialInputNumber + Number(e.target.step)
      else if(e.key === "ArrowDown") attemptedValue = initialInputNumber - Number(e.target.step)

      // User is deleting a digit, **or** the decimal point in the case of speed input.
      else if(e.key === "Backspace") {
        if(this.decimalFlag && e.target.name === "speed" && initialInputString.length === 1) { // We are erasing the decimal point
          // The length condition is 1 and not 2 because erasing from x.y directly produces x and not x.
          attemptedValue = initialInputNumber
          this.decimalFlag = false;
        }
        else { // Ordinary deletion case
          const inputStringAfterBackspace = initialInputString.slice(0,-1)
          attemptedValue = Number(inputStringAfterBackspace)
          if(inputStringAfterBackspace.endsWith('.')) this.decimalFlag = true; // Contrary to the Number conversion, this *can* end with "."
        }
      }

      // User is inputting the decimal point themselves (for the speed)
      // The value doesn't actually change until they enter a decimal.
      // Of course, we can't have multiple decimal points.
      else if(e.key === "." && e.target.name === "speed" && !initialInputString.includes('.') && !this.decimalFlag) {
        attemptedValue = initialInputNumber
        this.decimalFlag = true;
      }

      // ...none of these checks are made by the input.

      const parsedMin = Number(e.target.min);
      const parsedMax = Number(e.target.max);

      // All of this case checking was for this single action :
      // If the tentative value set by the user is not in bounds, reject the event.

      if(!validInputKeys.includes(e.key)
        || (attemptedValue < parsedMin || attemptedValue > parsedMax)) {
          e.preventDefault();
          // TODO : allow attempted values out of bounds but clip them back in.
          // This means modifying the event value. Is this doable ?
        }
    },
    silence() {
      this.$emit('silence')
    }
  },
};
</script>
