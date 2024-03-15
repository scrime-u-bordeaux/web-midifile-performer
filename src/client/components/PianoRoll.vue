<template>
  <div ref="container" class="piano-roll-container">
    <svg ref="svg"></svg>
  </div>
</template>

<style scoped>
.piano-roll-container {
  width: var(--score-width);
  overflow: auto;
}

svg {
  width: inherit;
  height: inherit;
}
</style>

<script>

/**
 * This code is in great part reproduced from the visualizers of
 * Magenta.JS, under copyright by Google, Inc. (2018).
 * Originally licensed under the Apache License, Version 2.0 :
 * https://www.apache.org/licenses/LICENSE-2.0
 */

import { mapState } from 'vuex'

export default {

  props: {
    noteHeight: { default: 6 },
    noteSpacing: { default: 1 },
    pixelsPerTimeStep: { default: 60 },
    noteRGB: { default: '102, 102, 102' },
    activeNoteRGB: { default: '88, 226, 142' }

    // remove min and max pitch props from Magenta and always determine from ambitus
  },

  data() {
    return {
      drawn: false,

      height: 0,
      width: 0,

      // apparently, Vue can't handle defining data from computed properties,
      // so I can't rely on mapState for the starting values here.
      minPitch: 127,
      maxPitch: 0,

      noteSequence: [],
      setBoundaries: [], // index of the first note for each set, used to trigger redraw

      // temporary !!
      // TODO : Phase out with unification of mode state in store
      allowHighlight: true
    }
  },

  computed: {
    ...mapState(['sequenceStart', 'sequenceEnd'])
  },

  methods: {

    updateNoteSequence(chronology) {

      this.convertChronologyToNoteSequence(chronology)

      const size = this.getSize()
      this.height = size.height
      this.width = size.width

      this.$refs.svg.style.width = `${this.width}px`
      this.$refs.svg.style.height = `${this.height}px`

      this.clear()
      this.draw()

      this.$refs.container.scrollLeft = 0
      this.$emit('ready')
    },

    draw() {
      this.noteSequence.forEach((note, index) => {
        const pos = this.getNotePosition(note)
        const fill = this.getNoteFillColor(note, false) // when first drawing, nothing is active

        // Magenta being written in TS used custom types here,
        // We use anonymous objects instead.

        const dataAttributes = [
          {key: 'index', value: index},
          {key: 'channel', value: note.channel},
          {key: 'pitch', value: note.pitch}
        ]

        const cssProperties = [
          // Taking this straight from magenta, they color undefined velocity the same as max
          // Undefined velocity shouldn't happen anyway, or we have bigger issues...
          {key: '--midi-velocity', value: `${!!note.velocity ? note.velocity : 127}`}
        ]

        this.drawNote(
          pos.x, pos.y, pos.w, pos.h, fill,
          dataAttributes, cssProperties
        )
      })

      this.drawn = true
    },

    // While we still work with a noteSequence, the referenceIndex will most often be
    // One of a set, and not of a note, requiring a lookup to know where that set begins.

    redraw(referenceIndex, fromSet = true) {
      if(!this.drawn) this.draw()

      const referenceNote =
        this.noteSequence[fromSet ? this.setBoundaries[referenceIndex] : referenceIndex]

      if(!referenceNote) return;

      // Original comment :
      // "Remove the current active note, if one exists.""
      this.unfillActiveRects()

      let activeNotePosition;

      this.noteSequence.forEach((note, index) => {
        // Remove redundant integrity check on referenceNote from Magenta
        // Also : only count note as active if the highlight comes from play or perform
        // (=== if the referenceIndex is that of a set)
        // If it's a hover highlight, show the user what will be effectively played
        // Once they jump to this exact index.
        const isActive = this.isPaintingActiveNote(note, referenceNote, fromSet)

        if(!isActive) return; // Redrawing is only relevant for the notes we need to highlight

        const rect = this.$refs.svg.querySelector(`rect[data-index="${index}"]`)
        rect.setAttribute('fill', this.getNoteFillColor(note, true))
        rect.classList.add('active')

        // change Magenta's referential check to the same check done in isPaintingActiveNote
        if(note.startTime === referenceNote.startTime)
          activeNotePosition = parseFloat(rect.getAttribute('x'));
      })

      this.scrollIntoView(activeNotePosition)
    },

    onNoteClick(event) {
      const rect = event.target
      const noteIndex = this.getNoteIndexFromRect(rect)
      const setIndex = this.setBoundaries.findIndex(index => index > noteIndex) - 1

      if(setIndex < this.sequenceStart) this.$emit('start', setIndex)
      if(setIndex > this.sequenceEnd) this.$emit('end', setIndex)

      this.$emit('index', setIndex)
      // We might run into an async issue here,
      // Where the index event chain could end after this,
      // Cancelling the redraw.
      this.redraw(noteIndex, false)
      setTimeout(this.unfillActiveRects, 100) // maybe we can do better than this ?
      // mouseup within the visualizerr + a bool flag ?
    },

    onNoteHighlight(event) {
      if(!this.allowHighlight) return;

      const rect = event.target
      this.redraw(this.getNoteIndexFromRect(rect), false)
    },

    onNoteUnHighlight(event) {
      if(!this.allowHighlight) return;

      this.unfillActiveRects()
    },

    stop() {
      this.unfillActiveRects()
    },

    clear() {
      this.drawn = false;
      this.$refs.svg.innerHTML = '';
    },

    // -------------------------------------------------------------------------
    // -------------------------------UTILS-------------------------------------
    // -------------------------------------------------------------------------

    convertChronologyToNoteSequence(chronology) {

      // Ideally, we would love to phase out the "note sequence",
      // and directly use the chronology as our working type.
      // The issue with that is determining when notes overlap,
      // with a better time cost than O(N) (for N held notes).

      // For now, we keep this, and we do it from the chronology and not the file,
      // So notes we have artificially synced through temporal resolution are also synced.

      this.noteSequence = []
      this.setBoundaries = []

      let msDate = 0;
      let boundaryCounter = 0;
      const noteMap = new Map()

      // This code, by the way, will unavoidably be very similar to that
      // of the AllNoteEventsAnalyzer.

      chronology.forEach(set => {
        msDate += set.dt;
        if(set.type === "start") this.setBoundaries.push(boundaryCounter)

        set.events.forEach(note => {

          const mapKey = JSON.stringify({pitch: note.pitch, channel: note.channel})

          if(noteMap.has(mapKey)) {
            const timedNote = noteMap.get(mapKey)
            timedNote.endTime = msDate * 0.001
            this.noteSequence.push(timedNote)
          }

          if(note.on) {
            boundaryCounter++;
            const timedNote = { startTime: msDate * 0.001, ...note }
            noteMap.set(mapKey, timedNote)
          }

          else noteMap.delete(mapKey)
        })
      })

      this.noteSequence.sort((noteA, noteB) => noteA.startTime - noteB.startTime)
    },

    getNoteIndexFromRect(rect) {
      return parseInt(rect.getAttribute('data-index'), 10)
    },

    // The rest of the utils are all taken from the Magenta component.
    // Although they are only used once or twice and do not need to be functions,
    // Having them be improves the readability of the big methods above.

    getSize() {

      this.minPitch = 127
      this.maxPitch = 0

      this.noteSequence.forEach(note => {
        this.minPitch = Math.min(this.minPitch, note.pitch);
        this.maxPitch = Math.max(this.maxPitch, note.pitch);
      })

      // Keep padding norms from Magenta. Adjust as needed.

      this.minPitch -= 4;
      this.maxPitch += 4;

      const height = (this.maxPitch - this.minPitch) * this.noteHeight

      const endTime = this.noteSequence[this.noteSequence.length - 1].endTime
      const width = endTime * this.pixelsPerTimeStep

      return {width, height}
    },

    getNotePosition(note) {
      const duration = note.endTime - note.startTime

      const x = note.startTime * this.pixelsPerTimeStep
      const w = Math.max(
        1, // make notes at least one pixel wide
        this.pixelsPerTimeStep * duration - this.noteSpacing
      )

      // Comment from original Magenta code :
      // "The svg' y=0 is at the top, but a smaller pitch is actually
      // lower, so we're kind of painting backwards"

      const y = this.height - ((note.pitch - this.minPitch) * this.noteHeight)

      return {x, y, w, h: this.noteHeight}
    },

    scrollIntoView(activeNotePosition) {
      if(!this.$refs.container) return; // inherited from Magenta ; probably useless here

      const containerWidth = this.$refs.container.getBoundingClientRect().width

      // Scroll in both directions (Magenta only scrolls forward)

      if (activeNotePosition > (this.$refs.container.scrollLeft + containerWidth) ||
          activeNotePosition < this.$refs.container.scrollLeft)
        this.$refs.container.scrollLeft = activeNotePosition - 20;

    },

    isPaintingActiveNote(note, referenceNote, countOverlap = true) {
      const isSyncedToReference =
        note.startTime === referenceNote.startTime
      const overlapsReference =
        note.startTime <= referenceNote.startTime &&
        note.endTime > referenceNote.startTime // correct Magenta not displaying some overlaps
        // (if the overlapping note ends before the ref note, but is still playing when it starts)

      return isSyncedToReference || (countOverlap && overlapsReference)
    },

    getNoteFillColor(note, isActive) {
      const opacityBaseline = 0.2;  // Original comment : "Shift all the opacities up a little."
      const opacity = note.velocity ? note.velocity / 100 + opacityBaseline : 1;
      const fill =
        `rgba(${isActive ? this.activeNoteRGB : this.noteRGB}, ${opacity})`;
      return fill;
    },

    drawNote(x, y, w, h, fill, dataAttributes, cssProperties) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')

      rect.classList.add('note')
      rect.setAttribute('fill', fill)

      rect.setAttribute('x', `${Math.round(x)}`);
      rect.setAttribute('y', `${Math.round(y)}`);
      rect.setAttribute('width', `${Math.round(w)}`);
      rect.setAttribute('height', `${Math.round(h)}`);

      dataAttributes.forEach(attribute => {
        // We cannot use !! because 0 is a valid value.
        if(attribute.value !== undefined) rect.dataset[attribute.key] = `${attribute.value}`;
      });
      cssProperties.forEach(attribute => {
        rect.style.setProperty(attribute.key, attribute.value);
      });

      rect.addEventListener("click", this.onNoteClick)
      rect.addEventListener("mouseover", this.onNoteHighlight)
      rect.addEventListener("mouseleave", this.onNoteUnHighlight)

      this.$refs.svg.appendChild(rect);
    },

    unfillActiveRects() {
      const activeRects = this.$refs.svg.querySelectorAll('rect.active')
      activeRects.forEach(rect => {
        const fill = this.getNoteFillColor(
          this.noteSequence[this.getNoteIndexFromRect(rect)],
          false
        )
        rect.setAttribute('fill', fill)
        rect.classList.remove('active')
      })
    }
  }
}
</script>
