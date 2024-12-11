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

svg :deep(.note) {
  stroke-width: 1px;
  filter: drop-shadow(3px 3px 1px #ccc)
}

svg :deep(.note.muted) {
  fill: white;
  stroke: #666;
  opacity: 0.7;
  filter: none;
}
</style>

<script>

/**
 * This code is in great part reproduced from the visualizers of
 * Magenta.JS, under copyright by Google, Inc. (2018).
 * Originally licensed under the Apache License, Version 2.0 :
 * https://www.apache.org/licenses/LICENSE-2.0
 */

import { mapState, mapGetters, mapMutations } from 'vuex'
import { noteMapKey } from '../utilities/NoteSequenceUtils'

export default {

  props: {
    initialNoteHeight: { default: 4 },
    noteSpacing: { default: 5 },
    pixelsPerTimeStep: { default: 90 },
    minimalNoteWidth: { default: 5}

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
      // but that would incentivize larger spacing and thus smaller notes,
      // with the way things are currently calculated
      sequenceBoundarySpacing: 1,
      sequenceBoundaryRGB: '#02a7f099', // storing opacity together here, because it never changes

      // Always use a fixed size based off extrema pitches 21 and 108 offset by 4 each.

      minPitch: 17,
      maxPitch: 112,

      // Keep track of notes for dynamic highlight,
      // When the user triggers a note off out of sync with the original file.
      activeNotes: new Map(),

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
      // last rect the mouse has been over
      rectUnderCursor: null,

      // Interval for a function that paints the active set in play/perform mode
      interval: null,

      allHighlightTypes: ["mouse", "refresh", "current"]
    }
  },

  computed: {
    ...mapState([
      'currentMode', // used only for watcher,
      'currentChannelControls', // ditto
      'sequenceStart', 'sequenceEnd', 'sequenceIndex',
      'noteSequence', 'setStarts', 'setEnds',
      'playbackTriggers',
      'minKeyboardNote', 'keyboardState',
      'highlightPalette',
      'playOnClickInSilentMode', 'playOnClickInPerformMode'
    ]),

    ...mapGetters([
      'isModeSilent', 'isModePerform',
      'getSet', 'getSetIndex'
    ]),

    playOnClick() {
      return (this.isModeSilent && this.playOnClickInSilentMode) ||
             (this.isModePerform && this.playOnClickInPerformMode)
    }
  },

  watch: {

    noteSequence(newSequence, oldSequence) {
      this.clear()

      this.setSize()
      this.draw()
      this.paintCurrentSet()

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
    },

    currentMode(newMode, oldMode) {
      this.updateBaseRectColor()

      if(newMode === 'silent') {
        this.stop()
        this.paintCurrentSet()
      }
    },

    currentChannelControls(newControls, oldControls) {
      newControls.channelActive.forEach((active, index) => {
        const channel = index + 1

        this.$refs.svg.querySelectorAll(
          `rect[data-channel="${channel}"]`
        ).forEach(rect => {
          if(active) {
            rect.classList.remove("muted")
            this.$refs.svg.insertBefore(rect, null) // make sure unmuted notes are on top of muted ones
          }
          else rect.classList.add("muted")
        })
      })
    },

    playbackTriggers(newTriggers, oldTriggers) {
      this.updateBaseRectColor()
    },

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
    },

    sequenceIndex(newIndex, oldIndex) {
      if(this.isModeSilent) this.paintCurrentSet()
    }
  },

  mounted() {
    this.containerWidth = this.$refs.container.getBoundingClientRect().width

    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
    this.$refs.container.addEventListener('wheel', this.onWheel)
    // TODO : add sync on scroll rather than just click ?
    // Or would we prefer scroll to stay a simple "peek" operation ?
    //this.$refs.container.addEventListener('scroll', this.onContainerScroll)

    this.interval = setInterval(this.keepTrackOfCurrentSet.bind(this), 100)
  },

  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)
    this.$refs.container.removeEventListener('wheel', this.onWheel)

    clearInterval(this.interval)
  },

  methods: {

    ...mapMutations([
      'setActiveNotes'
    ]),

    // -------------------------------------------------------------------------
    // -----------------------------MAIN LOGIC----------------------------------
    // -------------------------------------------------------------------------

    refresh(setIndex) {
      const activeNotes = this.refreshActiveNotes(setIndex)
      this.setActiveNotes(activeNotes)

      this.unfillActiveRects("current")
      this.fillActiveRects(activeNotes)

      this.scrollToSet(setIndex)
    },

    stop() {
      this.unfillActiveRects("refresh")
      this.paintCurrentSet()
    },

    clearActiveNotes() {
      this.activeNotes.clear()
      this.setActiveNotes(this.activeNotes)
    },

    clearGraphics() {
      this.setX = []
      this.$refs.svg.innerHTML = '';
      this.drawn = false;
    },

    clear() {
      this.clearActiveNotes()
      this.clearGraphics()
    },

    // -------------------------------------------------------------------------
    // -----------------------------LISTENERS-----------------------------------
    // -------------------------------------------------------------------------

    // TODO : Can we factorize these ?
    // (By testing the type of the received event)

    onKeyDown(event) {
      if(event.key === 'Control') {
        this.ctrlKey = true
        this.rectUnderCursor?.dispatchEvent(new Event('mouseover'))
      }
    },

    onKeyUp(event) {
      if(event.key === 'Control') {
        this.ctrlKey = false
        this.rectUnderCursor?.dispatchEvent(new Event('mouseover'))
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

      this.paintSetOrNote(rect)

      if(this.playOnClick) {
        this.$emit('play',
          this.ctrlKey ? // if control key is held down, only play the one note the mouse is highlighting
            [this.noteSequence[noteIndex]] :
            this.getSet(setIndex) // otherwise send the sets
            // nsNotes are compatible with the rest of the app, so this works
        )
        this.clickPlayed = true
      }
    },

    onNoteUnClick(event) {
      this.onNoteLeave()
    },

    onNoteHover(event) {
      const rect = event.target
      this.rectUnderCursor = rect

      this.paintSetOrNote(rect)
    },

    onNoteLeave(event) {
      if(!!event) this.rectUnderCursor = null
      this.unfillActiveRects()

      if(this.clickPlayed) {
        this.$emit('stop')
        this.clickPlayed = false
      }
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

    onIndexJump({index, fromUser}) { // don't forget, this is also called on file reset.
      if(fromUser) this.clearActiveNotes()
      else this.paintCurrentSet()

      const referenceNoteIndex = this.setStarts[index]
      const rect = this.getRectFromNoteIndex(referenceNoteIndex)
      if(!rect) return;

      const activeNotePosition = parseFloat(rect.getAttribute('x'))

      // If the index is off limits, then we need to scroll to it,
      // But with the corresponding notes on the left of the window, not the middle.

      if(this.isOutOfReach(activeNotePosition))
        this.scrollIntoView(activeNotePosition, true)
    },

    // -------------------------------------------------------------------------
    // -------------------------------DRAW--------------------------------------
    // -------------------------------------------------------------------------

    draw() {
      this.occupiedX.clear()

      this.noteSequence.forEach((note, index) => {
        const pos = this.getNotePosition(note)
        if(this.setStarts.includes(index)) this.setX.push(Math.round(pos.x))

        const fill = this.getNoteFillColor(note, "disable") // when first drawing, nothing is active
        const fillOpacity = this.getNoteFillOpacity(note)

        // Magenta, being written in TS, used custom types here ;
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
          pos.x, pos.y, pos.w, pos.h, fill, fillOpacity,
          dataAttributes, cssProperties
        )
      })

      this.drawBoundaries()

      this.drawn = true
    },

    drawNote(x, y, w, h, fill, fillOpacity, dataAttributes, cssProperties) {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')

      rect.classList.add('note')

      rect.setAttribute('fill', fill)
      rect.setAttribute('fill-opacity', fillOpacity)

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
      rect.setAttribute('fill', this.sequenceBoundaryRGB)

      rect.setAttribute('x', `${this.getBoundaryPosition(type)}`)
      rect.setAttribute('y', '0')
      rect.setAttribute('width', this.sequenceBoundaryWidth)
      rect.setAttribute('height', this.height)

      rect.addEventListener('mousedown', this.onBoundaryDragStart)

      this.$refs.svg.appendChild(rect);
    },

    redrawBoundary(type) {
      const boundaryRect = this.$refs.svg.querySelector(`.${type}`)
      boundaryRect?.setAttribute('x', `${this.getBoundaryPosition(type)}`)
    },

    // -------------------------------------------------------------------------
    // ------------------------------PAINT--------------------------------------
    // -------------------------------------------------------------------------

    paintSetOrNote(rect) {
      if(!this.ctrlKey) this.paintNoteSet(this.getNoteIndexFromRect(rect), "mouse")
      // It's a bit silly, but it's easier for this to be the exception
      // and fillActiveRects to keep taking notes as input.
      else this.fillActiveRects([this.noteSequence[this.getNoteIndexFromRect(rect)]], "mouse")
    },

    paintNoteSet(index, mode = "refresh") {
      const setIndex = mode === "current" ? index : this.getSetIndex(index)
      const set = this.getSet(setIndex)
      this.fillActiveRects(set, mode)
    },

    paintCurrentSet() {
      this.paintNoteSet(this.sequenceIndex, "current")
    },

    getNoteFillColor(nsNote, type = "refresh") {
      switch(type) {
        case "current":
          return this.currentSetRGB(nsNote)
          break

        case "refresh":
        case "mouse":
          return this.activeNoteRGB(nsNote)
          break

        case "disable":
        default:
          return this.noteRGB(nsNote)
          break
      }
    },

    getNoteFillOpacity(note) {
      const opacityBaseline = 0.2  // Original comment : "Shift all the opacities up a little."
      return note.velocity ? note.velocity / 100 + opacityBaseline : 1;
    },

    // This one isn't from Magenta, it just doesn't make sense for it
    // not to be with unfillActiveRects.

    fillActiveRects(activeNotes, type = "refresh") {
      if(!this.drawn) this.draw()
      this.unfillActiveRects(type)

      activeNotes.forEach(note => {
        const rect = this.getRectFromNoteIndex(note.index)

        rect.classList.add(type)

        rect.setAttribute('fill', this.getNoteFillColor(note, type))
      })
    },

    // I considered having an array of types instead,
    // but currently, there's no situation where that is necessary

    unfillActiveRects(type = "mouse") {
      const activeRects = this.$refs.svg.querySelectorAll(
        `rect.${type}`
      )

      activeRects.forEach(rect => {
        // Ensure a note rect can only have one highlight class.
        // Never remove the "note" class.
        rect.classList.remove(type)

        const fill = this.getNoteFillColor(
          this.noteSequence[this.getNoteIndexFromRect(rect)],
          rect.classList.contains("current") ? "current" : "disable"
        )
        rect.setAttribute('fill', fill)
      })
    },

    updateBaseRectColor() {
      const allRects = this.$refs.svg.querySelectorAll(
        `rect.note`
      )

      allRects.forEach(rect => rect.setAttribute('fill',
        this.getNoteFillColor(
          this.noteSequence[this.getNoteIndexFromRect(rect)],
          rect.classList.contains("current") ? "current" :
            rect.classList.contains("refresh") || rect.classList.contains("mouse") ? "refresh" : "disable"
        )
      ))
    },

    activeNoteRGB(nsNote) {
      if(nsNote.isPlaybackNote) return this.highlightPalette.get("autoplayLightYellow")
      return this.highlightPalette.get(
        this.isModeSilent ? "baseBlue" : "baseGreen"
      )
    },

    currentSetRGB(nsNote) {
      if(nsNote.isPlaybackNote) return this.highlightPalette.get("autoplayDarkYellow")
      return this.highlightPalette.get(
        this.isModeSilent ? "darkBlue" : "darkGreen"
      )
    },

    noteRGB(nsNote) {
      if(nsNote.isPlaybackNote) return this.highlightPalette.get("autoplayDarkYellow")
      else return "#666666"
    },

    // -------------------------------------------------------------------------
    // ----------------------------MISC GETTERS---------------------------------
    // -------------------------------------------------------------------------

    getNotePosition(note) {
      const duration = note.endTime - note.startTime

      // Premature round is necessary for the occupiedX set to work properly
      const tentativeX =
        Math.round(note.startTime * this.pixelsPerTimeStep + this.sequenceBoundaryWidth)

      const x = this.occupiedX.has(tentativeX) ?
        tentativeX + this.noteSpacing : // if we just add the noteSpacing everywhere, it cancels out.
        tentativeX

      const w = Math.max(
        this.minimalNoteWidth, // make notes at least one pixel wide
        this.pixelsPerTimeStep * duration - this.noteSpacing + 1
      )

      // console.log(`Drawing note at x = ${x} with width ${w}`)

      // Here too, premature rounding is necessary.
      // Note that Math.round() is not distributive.
      this.occupiedX.add(Math.round(x) + Math.round(w))

      // Comment from original Magenta code :
      // "The svg' y=0 is at the top, but a smaller pitch is actually
      // lower, so we're kind of painting backwards"

      const y = this.height -
        (this.height / ((this.maxPitch - this.minPitch + 1) * this.noteHeight)
          * (note.pitch - this.minPitch) * this.noteHeight
        )

      return {x, y, w, h: this.noteHeight}
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

    isMouseOverCurrentSet() {
      return this.getSet(this.sequenceIndex)
        .map(note => this.getRectFromNoteIndex(note.index))
        .includes(this.rectUnderCursor)
    },

    // -------------------------------------------------------------------------
    // ----------------------------MISC LOGIC-----------------------------------
    // -------------------------------------------------------------------------

    // Originally called getSize()
    // Used to return the width and height instead of mutating them.

    setSize() {
      this.height = Math.max(
        this.$refs.container.getBoundingClientRect().height,
        (this.maxPitch - this.minPitch) * this.noteHeight
      )

      const endTime = this.noteSequence[this.noteSequence.length - 1].endTime

      this.width =
        endTime * this.pixelsPerTimeStep +
        2*(this.sequenceBoundaryWidth) + this.sequenceBoundarySpacing

      this.$refs.svg.style.width = `${this.width}px`
      this.$refs.svg.style.height = `${this.height}px`
    },

    refreshActiveNotes(setIndex) {
      // TODO : Array.from() may be less performant than the spread syntax [...]
      // Consider replacing it in this often-called, performance-critical function.

      Array.from(this.activeNotes.values()).forEach(note => {
        // TODO : is the overhead of creating a function for this worth
        // the factorization ?
        // Depending on how JS behaves, it could slow down the playback.

        const mapKey = noteMapKey(note)
        const pitchMask = this.keyboardState[note.pitch - this.minKeyboardNote]
        const isPlaying = pitchMask & 1 << note.channel

        if(!isPlaying) this.activeNotes.delete(mapKey)
      })

      const set = this.getSet(setIndex)

      set.forEach((note, index) => {
        const mapKey = noteMapKey(note)
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

    scrollIntoView(activeNotePosition, toBoundary = false) {

      if (!this.$refs.container) return; // inherited from Magenta ; probably useless here

      // Early special case : index jumped to a note off limits.
      // Display the window with it at the left edge.

      if (toBoundary) {
        this.$refs.container.scrollLeft =
          activeNotePosition - this.sequenceBoundaryWidth
        return
      }

      // Default scrolling behavior.

      const activeNoteBeyondHalfPoint =
        Math.abs(activeNotePosition - this.$refs.container.scrollLeft) > this.containerWidth / 2

      if (activeNoteBeyondHalfPoint)
        // keep active notes in the middle of the window
        this.$refs.container.scrollLeft = activeNotePosition - this.containerWidth / 2
    },

    keepTrackOfCurrentSet() {
      // FIXME : this won't work when a longer note is being held...
      // Is there a better way ?
      if(
        this.isModePerform &&
        this.activeNotes.size === 0 &&
        !this.isMouseOverCurrentSet()) this.paintCurrentSet()
    }
  }
}
</script>
