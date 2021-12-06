<template>
<div>
  <div>
    <!-- @mousedown="startDrag"> -->
    <svg
      style="display: none;"
      ref="scroll-bar"
      width="100%" height="100%" viewBox="0 0 1020 20"
      @mousedown="startDrag">
      <rect class="line-bg" x="0" y="9" width="1020" height="2" />
      <rect class="line-fg" x="0" y="9" :width="(position * 1000)" height="2" />
      <circle class="cursor" :cx="(position * 1000) + 10" cy="10" r="10" />
    </svg>
  </div>

  <div class="indices">
    <div>
      <div> début </div>
      <div class="event-number"> {{ start + 1 }} </div>
    </div>
    <div>
      <div> courant </div>
      <div class="event-number"> {{ index + 1 }} </div>
    </div>
    <div>
      <div> fin </div>
      <div class="event-number"> {{ end + 1 }} </div>
    </div>
  </div>
</div>
</template>

<style scoped>
rect {
  pointer-events: none;
  /*fill: none;*/
  /*stroke-width: 1;*/
  /*stroke-linecap: 'round';*/
}
.line-bg {
  /*stroke: black;*/
  fill: black;
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
.indices > div {
  display: inline-block;
  padding: 10px;
}
.event-number {
  font-size: 2em;
}
</style>

<script>
export default {
  props: [ 'enabled', 'start', 'end', 'index' ],
  data() {
    return {
      dragging: false,
      boundingRect: null,
      position: 0,
      //index: 1,
    };
  },
  computed: {
    positions() {
      return this.end - this.start + 1;
    },
    cursorRadius() {
      if (!this.boundingRect) { return 0; }
      return this.boundingRect.height * 0.5;
    },
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
    startDrag(e) {
      this.dragging = true;
      this.boundingRect = e.target.getBoundingClientRect();
      this.drag(e);
    },
    drag(e) {
      if (!this.dragging) return;

      const { x, width } = this.boundingRect;
      let position = (e.clientX - x - this.cursorRadius) /
                     (width - 2 * this.cursorRadius);

      position = Math.max(Math.min(position, 1), 0);

      const division = 1 / (this.positions - 1);

      for (let i = 0; i < this.positions; i++) {
        if (Math.abs(position - i * (division)) <= division * 0.5) {
          // this.index = (i + 1);
          const prevPosition = this.position;
          this.position = i * division;
          if (this.position !== prevPosition) {
            this.$emit('index', i + this.start);
          }
          break;
        }
      }
    },
    endDrag(e) {
      if (!this.dragging) return;
      this.dragging = false;
    },
  },
};
</script>