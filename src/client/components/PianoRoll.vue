<template>
  <div ref="container" class="piano-roll-container">
    <svg ref="svg"></svg>
  </div>
</template>

<style scoped>
.piano-roll-container {
  width: var(--score-width);
  overflow: auto;
  scroll-behavior: smooth;
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

      // Height and width of the SVG element, not the container.
      height: 0,
      width: 0,

      // apparently, Vue can't handle defining data from computed properties,
      // so I can't rely on mapState for the starting values here.
      minPitch: 127,
      maxPitch: 0,

      // The main visualizer model, adapted from Magenta's own.
      // Contains notes with their MFP information,
      // Their start, and end times.
      noteSequence: [],

      // Convenience arrays to switch between noteSequence indexes and set indexes.
      setStarts: [], // index of the first note for each set
      setEnds:[], // index of the last note for each set

      // Keep track of notes for dynamic highlight,
      // When the user triggers a note off out of sync with the original file.
      activeNotes: new Map(),

      // temporary !!
      // TODO : Phase out with unification of mode state in store
      allowHighlight: true
    }
  },

  computed: {
    ...mapState([
      'sequenceStart', 'sequenceEnd',
      'minKeyboardNote', 'keyboardState'
    ])
  },

  // TODO : add sync on scroll rather than just click ?
  // Or would we prefer scroll to stay a simple "peek" operation ?

  // mounted() {
  //   this.$refs.container.addEventListener('scroll', this.onContainerScroll)
  // },

  updated() { // for some reason, the width of this component changes after mount
    // so this is the right hook to use.
    this.containerWidth = this.$refs.container.getBoundingClientRect().width
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
      // this.$refs.container.scrollLeft = 0 // onIndexJump now performs this by itself

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

    refresh(setIndex) {
      const activeNotes = this.refreshActiveNotes(setIndex)
      this.fillActiveRects(activeNotes)
      this.scrollToSet(setIndex)
    },

    onNoteClick(event) {
      const rect = event.target
      const noteIndex = this.getNoteIndexFromRect(rect)
      const tentativeSetIndex = this.setStarts.findIndex(index => index > noteIndex)
      const setIndex = tentativeSetIndex > 0 ? tentativeSetIndex - 1 : this.setStarts.length - 1

      if(setIndex < this.sequenceStart) this.$emit('start', setIndex)
      if(setIndex > this.sequenceEnd) this.$emit('end', setIndex)
      this.$emit('index', setIndex)

      // We might run into an async issue here,
      // Where the index event chain could end after this,
      // Cancelling the paint job.
      this.paintNoteSet(setIndex, true)
      setTimeout(this.unfillActiveRects, 200) // maybe we can do better than this ?
      // mouseup within the visualizerr + a bool flag ?

      // Read : "if mode is silent". TODO : switch this when mode is unified into store.
      if(this.allowHighlight) this.$emit('play')
    },

    onNoteHighlight(event) {
      if(!this.allowHighlight) return;

      const rect = event.target
      this.paintNoteSet(this.getNoteIndexFromRect(rect))
    },

    onNoteUnHighlight(event) {
      if(!this.allowHighlight) return;

      this.unfillActiveRects()
    },

    onIndexJump(index) { // don't forget, this is also called on file reset.
      this.activeNotes.clear()

      const referenceNoteIndex = this.setStarts[index]
      const rect = this.getRectFromNoteIndex(referenceNoteIndex)
      if(!rect) return;

      const activeNotePosition = parseFloat(rect.getAttribute('x'))

      // If the index is off limits, then we need to scroll to it,
      // But with the corresponding notes on the left of the window, not the middle.

      if(this.isOutOfReach(activeNotePosition))
        this.scrollIntoView(activeNotePosition, true)
    },

    stop() {
      this.unfillActiveRects()
    },

    clear() {
      this.drawn = false;
      this.$refs.svg.innerHTML = '';
      this.activeNotes.clear()
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
      this.setStarts = []
      this.setEnds = []

      let msDate = 0;
      let boundaryCounter = 0;
      const noteMap = new Map()

      // This code, by the way, will unavoidably be very similar to that
      // of the AllNoteEventsAnalyzer.

      chronology.forEach(set => {
        msDate += set.dt;

        const isStartingSet = set.type === "start"
        if(isStartingSet) this.setStarts.push(boundaryCounter)

        const setLength = set.events.length

        set.events.forEach((note, index) => {

          if(isStartingSet && index === setLength - 1) this.setEnds.push(boundaryCounter)

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

      // TODO : Is the sort necessary ?
      // The chronology should already be sorted. 
      this.noteSequence.sort((noteA, noteB) => noteA.startTime - noteB.startTime)
      this.noteSequence.forEach((note, index) => note.index = index)
    },

    paintNoteSet(index, isSetIndex = false) {
      let setIndex

      if(isSetIndex) setIndex = index
      else {
        const tentativeSetIndex = this.setStarts.findIndex(i => i > index)
        setIndex = tentativeSetIndex > 0 ? tentativeSetIndex - 1 : this.setStarts.length - 1
      }

      const set = this.getSet(setIndex)
      this.fillActiveRects(set)
    },

    refreshActiveNotes(setIndex) {
      Array.from(this.activeNotes.values()).forEach(note => {
        const mapKey = `p${note.pitch}c${note.channel}`
        const pitchMask = this.keyboardState[note.pitch - this.minKeyboardNote]
        const isPlaying = pitchMask & 1 << note.channel

        if(!isPlaying) this.activeNotes.delete(mapKey)
      })

      const set = this.getSet(setIndex)

      set.forEach((note, index) => {
        const mapKey = `p${note.pitch}c${note.channel}`
        const pitchMask = this.keyboardState[note.pitch - this.minKeyboardNote]
        const isPlaying = pitchMask & 1 << note.channel

        if(isPlaying) this.activeNotes.set(mapKey, note)
      })

      return Array.from(this.activeNotes.values())
    },

    scrollToSet(setIndex) {
      const activeNotePosition = parseFloat(this.getRectFromNoteIndex(this.setStarts[setIndex]).getAttribute('x'))
      const rewinding = setIndex === this.sequenceStart
      const alignLeft = this.isOutOfReach(activeNotePosition)
      this.scrollIntoView(activeNotePosition, alignLeft)
    },

    getSet(setIndex) {
      return this.noteSequence.slice(this.setStarts[setIndex], this.setEnds[setIndex]+1)
    },

    getNoteIndexFromRect(rect) {
      return parseInt(rect.getAttribute('data-index'), 10)
    },

    getRectFromNoteIndex(index) {
      return this.$refs.svg.querySelector(`rect[data-index="${index}"]`)
    },

    isOutOfReach(activeNotePosition) {
      return activeNotePosition < this.$refs.container.scrollLeft || // hidden on the left
      activeNotePosition > this.$refs.container.scrollLeft + this.containerWidth // or hidden on the right
    },

    // The rest of the utils are taken from the Magenta component.
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

    scrollIntoView(activeNotePosition, toBoundary = false) {

      if(!this.$refs.container) return; // inherited from Magenta ; probably useless here

      // Early special case : index jumped to a note off limits.
      // Display the window with it at the left edge.

      if(toBoundary) {
        this.$refs.container.scrollLeft = activeNotePosition
        return
      }

      // Default scrolling behavior.

      const activeNoteBeyondHalfPoint =
        Math.abs(activeNotePosition - this.$refs.container.scrollLeft) > this.containerWidth / 2

      if(activeNoteBeyondHalfPoint)
        // keep active notes in the middle of the window
        this.$refs.container.scrollLeft = activeNotePosition - this.containerWidth / 2
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

    // This one isn't from Magenta, it just doesn't make sense for it
    // not to be with unfillActiveRects.

    fillActiveRects(activeNotes) {
      if(!this.drawn) this.draw()
      this.unfillActiveRects()

      activeNotes.forEach(note => {
        const rect = this.getRectFromNoteIndex(note.index)
        rect.setAttribute('fill', this.getNoteFillColor(note, true))
        rect.classList.add('active')
      })
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
