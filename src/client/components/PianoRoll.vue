<template>
  <div ref="container" class="piano-roll-container">
    <svg ref="svg"></svg>
  </div>
</template>

<style scoped>
.piano-roll-container {
  width: var(--score-width);
  height: fit-content;
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
    initialNoteHeight: { default: 4 },
    noteSpacing: { default: 5 },
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

      noteHeight: this.initialNoteHeight,

      sequenceBoundaryWidth: 3, // should we rather make it noteSpacing ?
      // but that would incentivize larger spacing and thus smaller notes, with the way things are currently calculated
      sequenceBoundarySpacing: 1,
      sequenceBoundaryRGB: '2, 167, 240',

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
      allowHighlight: true,

      // temporary !!
      // FIXME (issue #57): this doesn't fix the overlaps of successive notes
      // if the following note is calculated to start before the other ends
      // setting fixed margins doesn't work either
      // this is annoying
      occupiedX: new Set(),

      // for instant lookup when dragging boundary rectangles
      setX: [],

      // for switching between set and single-note highlight/play
      ctrlKey: false,
      // last note the mouse has been over
      highlightedNote: null
    }
  },

  computed: {
    ...mapState([
      'sequenceStart', 'sequenceEnd',
      'minKeyboardNote', 'keyboardState'
    ])
  },

  watch: {

    noteHeight(newHeight, oldHeight) {
      if(newHeight < 1) {
        this.noteHeight = 1 // Vue doesn't allow setters on data()
        // so this is my best equivalent to guard the value
        return;
      }

      this.setSize()
      this.clearGraphics()
      this.draw()
    },

    sequenceStart(newStart, oldStart) {
      if(newStart !== oldStart) this.redrawBoundary('start')
    },

    sequenceEnd(newEnd, oldEnd) {
      if(newEnd !== oldEnd) this.redrawBoundary('end')
    }
  },

  mounted() {
    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
    this.$refs.container.addEventListener('wheel', this.onWheel)
    // TODO : add sync on scroll rather than just click ?
    // Or would we prefer scroll to stay a simple "peek" operation ?
    //this.$refs.container.addEventListener('scroll', this.onContainerScroll)
  },

  updated() { // for some reason, the width of this component changes after mount
    // so this is the right hook to use.
    this.containerWidth = this.$refs.container.getBoundingClientRect().width
  },

  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    this.$refs.container.removeEventListener('wheel', this.onWheel)
  },

  methods: {

    updateNoteSequence(chronology) {

      this.clear()
      this.convertChronologyToNoteSequence(chronology)
      this.setSize()
      this.draw()

      // Okay, so, hello to future me or anyone who might be wondering what this setTimeout is.
      // Normally, this shouldn't be needed.
      // On loading a new file, the sequence index is set to 0 and the autoscroll goes to 0 too.
      // ...except, right *after* that, and for no explainable reason,
      // the container receives a scrollEvent with isTrusted set to true
      // that cannot be cancelled, and that resets the scroll value to whatever it previously was.
      // All my efforts to track down the origin of this scroll event,
      // or to prevent its effects through CSS or JS,
      // have failed. So instead, I do this.
      // The setTimeout is necessary because the event is received after this function ends.
      // Of course, like any setTimeout hack, it might not actually work on other machines.
      // When it doesn't, we can look at this issue again.
      // For now I need to move on. 
      setTimeout(() => {this.$refs.container.scrollLeft = 0}, 50)

      this.$emit('ready')
    },

    draw() {
      this.occupiedX.clear()

      this.noteSequence.forEach((note, index) => {
        const pos = this.getNotePosition(note)
        if(this.setStarts.includes(index)) this.setX.push(Math.round(pos.x))

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

      this.drawBoundaries()

      this.drawn = true
    },

    refresh(setIndex) {
      const activeNotes = this.refreshActiveNotes(setIndex)
      this.fillActiveRects(activeNotes)
      this.scrollToSet(setIndex)
    },

    // TODO : Can we factorize these ?
    // (By testing the type of the received event)

    onKeyDown(event) {
      if(event.key === 'Control') {
        this.ctrlKey = true
        this.highlightedNote?.dispatchEvent(new Event('mouseover'))
      }
    },

    onKeyUp(event) {
      if(event.key === 'Control') {
        this.ctrlKey = false
        this.highlightedNote?.dispatchEvent(new Event('mouseover'))
      }
    },

    onWheel(event) {
      if(event.ctrlKey) {
        event.preventDefault()
        event.stopPropagation()

        const growAmount = - Math.sign(event.deltaY)
        this.noteHeight += growAmount
      }
    },

    onNoteClick(event) {
      const rect = event.target
      const noteIndex = this.getNoteIndexFromRect(rect)
      const setIndex = this.getSetIndex(noteIndex)

      if(setIndex < this.sequenceStart) this.$emit('start', setIndex)
      if(setIndex > this.sequenceEnd) this.$emit('end', setIndex)
      this.$emit('index', setIndex)

      // "allowHighlight" means "if mode is silent".
      // TODO : switch this when mode is unified into store.
      if(this.allowHighlight) {
        this.paintSetOrNote(rect)
        this.$emit('play',
          this.ctrlKey ? // if control key is held down, only play the one note the mouse is highlighting
            [this.noteSequence[this.getNoteIndexFromRect(rect)]] :
            this.getSet(setIndex) // otherwise send the sets
            // Our notes are compatible with the rest of the app, so this works
        )
      }
    },

    onNoteUnClick(event) {
      this.onNoteLeave()
    },

    onNoteHover(event) {
      if(!this.allowHighlight) return;

      const rect = event.target
      this.highlightedNote = rect

      this.paintSetOrNote(rect)
    },

    onNoteLeave(event) {
      if(!this.allowHighlight) return;

      if(!!event) this.highlightedNote = null
      this.unfillActiveRects()
      this.$emit('stop')
    },

    onBoundaryDragStart(event) {
      // Am I allowed to facepalm over inconsistencies as big as JS arrays having an "includes" method,
      // But DOMTokenLists having a "contains" method instead ?
      // Seriously.
      const isStart = event.target.classList.contains("start")
      this.dragging = isStart ? "start" : "end"
    },

    onBoundaryDrag(event) {
      if(!!this.dragging && event.buttons > 0) {
        const nextSetIndex = this.setX.findIndex(setX => setX > event.offsetX)

        const closestSetIndex = this.dragging === "start" ?
          nextSetIndex :
          nextSetIndex > 0 ? // as usual, the last set won't be found this way, giving -1
            nextSetIndex - 1 :
            this.setX.length - 1

        this.$emit(this.dragging, closestSetIndex)
      }
    },

    onBoundaryDragEnd(event) {
      if(!!this.dragging) this.redrawBoundary(this.dragging)
      this.dragging = null
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

    clearNoteSequence() {
      this.noteSequence = []
      this.setStarts = []
      this.setEnds = []
    },

    clearActiveNotes() {
      this.activeNotes.clear()
    },

    clearGraphics() {
      this.setX = []
      this.$refs.svg.innerHTML = '';
      this.drawn = false;
    },

    clear() {
      this.clearNoteSequence()
      this.clearActiveNotes()
      this.clearGraphics()
    },

    // -------------------------------------------------------------------------
    // -------------------------------UTILS-------------------------------------
    // -------------------------------------------------------------------------

    convertChronologyToNoteSequence(chronology) {

      // Ideally, we would love to phase out the "note sequence",
      // and directly use the chronology as our working type.

      // For now, we keep this, and we do it from the chronology and not the file,
      // So notes we have artificially synced through temporal resolution are also synced.

      let msDate = 0;
      let boundaryCounter = 0; // keep track of set starts and ends
      const noteMap = new Map()
      // We use this map to keep a stack of note ons/off for a give note/pitch.
      // We could instead store arrays of the notes and calculate their size,
      // But this way is easier to read, so I favor it.
      const noteCountMap = new Map()

      // Incidentally : this code will unavoidably be very similar to that
      // of the AllNoteEventsAnalyzer.

      chronology.forEach(set => {
        msDate += set.dt;

        const isStartingSet = set.type === "start"
        if(isStartingSet) this.setStarts.push(boundaryCounter)

        const setLength = set.events.length

        set.events.forEach((note, index) => {

          if(isStartingSet && index === setLength - 1) this.setEnds.push(boundaryCounter)

          const mapKey = `p${note.pitch}c${note.channel}`
          const noteCounter = noteCountMap.get(mapKey) || 0

          // In a file with no duplicate note ons, when noteMap has the mapKey,
          // it will always be because noteCounter === 1
          // (<=> we're encountering the note off for the singular stacked note on).

          // If the file *has* duplicate note ons,
          // any new note on must still be pushed,
          // regardless of how many have been stacked (or we lose notes).

          // But in all cases, a note off can only trigger a push
          // if it's the last one in a stack — i.e. : if noteCounter === 1.
          // In other words : the final on in a stack of multiples
          // will be terminated by as many offs as there were on's before it.

          const shouldPushNote = noteMap.has(mapKey) && (note.on || noteCounter === 1)

          if(shouldPushNote) {
            const timedNote = noteMap.get(mapKey)
            timedNote.endTime = msDate * 0.001
            this.noteSequence.push(timedNote)
          }

          if(note.on) {
            boundaryCounter++;
            const timedNote = { startTime: msDate * 0.001, ...note }
            noteMap.set(mapKey, timedNote)
            noteCountMap.set(mapKey, noteCounter+1)
          }

          else {
            if(noteCounter - 1 === 0 ) { // final note on in this stack
              noteCountMap.delete(mapKey)
              noteMap.delete(mapKey)
            }
            // Unstack note offs one by one. Every duplicate note on should have a matching amount of note offs.
            // (Else we have notes that never end...)
            else noteCountMap.set(mapKey, noteCounter - 1)
          }
        })
      })

      // TODO : Is the sort necessary ?
      // The chronology should already be sorted.
      this.noteSequence.sort((noteA, noteB) => noteA.startTime - noteB.startTime)
      this.noteSequence.forEach((note, index) => note.index = index)
    },

    drawBoundaries() {
      this.drawBoundary('start')
      this.drawBoundary('end')
      this.$refs.svg.addEventListener('mousemove', this.onBoundaryDrag)
      this.$refs.svg.addEventListener('mouseup', this.onBoundaryDragEnd)
    },

    drawBoundary(type) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')

      rect.classList.add('boundary')
      rect.classList.add(type)
      rect.setAttribute('fill', `rgba(${this.sequenceBoundaryRGB}, 0.6)`)

      rect.setAttribute('x', `${this.getBoundaryPosition(type)}`)
      rect.setAttribute('y', '0')
      rect.setAttribute('width', this.sequenceBoundaryWidth)
      rect.setAttribute('height', this.height)

      rect.addEventListener('mousedown', this.onBoundaryDragStart)

      this.$refs.svg.appendChild(rect);
    },

    redrawBoundary(type) {
      const boundaryRect = this.$refs.svg.querySelector(`.${type}`)
      boundaryRect.setAttribute('x', `${this.getBoundaryPosition(type)}`)
    },

    paintSetOrNote(rect) {
      if(!this.ctrlKey) this.paintNoteSet(this.getNoteIndexFromRect(rect))
      // It's a bit silly, but it's easier for this to be the exception
      // and fillActiveRects to keep taking notes as input.
      else this.fillActiveRects([this.noteSequence[this.getNoteIndexFromRect(rect)]])
    },

    paintNoteSet(index) {
      const setIndex = this.getSetIndex(index)
      const set = this.getSet(setIndex)
      this.fillActiveRects(set)
    },

    refreshActiveNotes(setIndex) {
      Array.from(this.activeNotes.values()).forEach(note => {
        // TODO : is the overhead of creating a function for this worth
        // the factorization ?
        // Depending on how JS behaves, it could slow down the playback.

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
      const alignLeft = this.isOutOfReach(activeNotePosition)
      this.scrollIntoView(activeNotePosition, alignLeft)
    },

    getSet(setIndex) {
      return this.noteSequence.slice(this.setStarts[setIndex], this.setEnds[setIndex]+1)
    },

    getSetIndex(noteIndex) {
      const tentativeSetIndex = this.setStarts.findIndex(i => i > noteIndex)
      return tentativeSetIndex > 0 ? tentativeSetIndex - 1 : this.setStarts.length - 1
    },

    getNoteIndexFromRect(rect) {
      return parseInt(rect.getAttribute('data-index'), 10)
    },

    getRectFromNoteIndex(index) {
      return this.$refs.svg.querySelector(`rect[data-index="${index}"]`)
    },

    getBoundaryPosition(type) {
      if(type !== "start" && type !== "end")
        throw new Error("Invalid boundary type")

      const boundSetIndex = type === "start" ? this.sequenceStart : this.sequenceEnd
      const setStartIndex = this.setStarts[type === "start" ? boundSetIndex : boundSetIndex + 1]
      const setStartX =
        setStartIndex !== undefined ?
          parseInt(this.getRectFromNoteIndex(setStartIndex).getAttribute('x'), 10) :
          this.width

      return setStartX - this.sequenceBoundaryWidth
    },

    isOutOfReach(activeNotePosition) {
      return activeNotePosition < this.$refs.container.scrollLeft || // hidden on the left
      activeNotePosition > this.$refs.container.scrollLeft + this.containerWidth // or hidden on the right
    },

    // The rest of the utils are taken from the Magenta component.
    // Although they are only used once or twice and do not need to be functions,
    // Having them be improves the readability of the big methods above.

    // Originally called getSize()
    // Used to return the width and height instead of mutating them.

    setSize() {

      // TODO : we don't have to do this every time...

      this.minPitch = 127
      this.maxPitch = 0

      this.noteSequence.forEach(note => {
        this.minPitch = Math.min(this.minPitch, note.pitch);
        this.maxPitch = Math.max(this.maxPitch, note.pitch);
      })

      // Keep "padding" norms from Magenta. Adjust as needed.
      // This means we have to deal with it in the parent element, though.

      this.minPitch -= 4;
      this.maxPitch += 4;

      this.height = (this.maxPitch - this.minPitch) * this.noteHeight

      const endTime = this.noteSequence[this.noteSequence.length - 1].endTime
      this.width =
        endTime * this.pixelsPerTimeStep +
        2*(this.sequenceBoundaryWidth) + this.sequenceBoundarySpacing

      this.$refs.svg.style.width = `${this.width}px`
      this.$refs.svg.style.height = `${this.height}px`
    },

    getNotePosition(note) {
      const duration = note.endTime - note.startTime

      // Premature round is necessary for the occupiedX set to work properly
      const tentativeX =
        Math.round(note.startTime * this.pixelsPerTimeStep + this.sequenceBoundaryWidth)

      const x = this.occupiedX.has(tentativeX) ?
        tentativeX + this.noteSpacing : // if we just add the noteSpacing everywhere, it cancels out.
        tentativeX

      const w = Math.max(
        1, // make notes at least one pixel wide
        this.pixelsPerTimeStep * duration - this.noteSpacing + 1
      )

      // Here too, premature rounding is necessary.
      // Note that Math.round() is not distributive.
      this.occupiedX.add(Math.round(x) + Math.round(w))

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
        this.$refs.container.scrollLeft =
          activeNotePosition - this.sequenceBoundaryWidth
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

      rect.addEventListener("mousedown", this.onNoteClick)
      rect.addEventListener("mouseover", this.onNoteHover)
      rect.addEventListener("mouseup", this.onNoteUnClick)
      rect.addEventListener("mouseleave", this.onNoteLeave)

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
