<template>
  <div ref="container" class="sheet-music-container">
    <div ref="osmdContainer" class="osmd-container" id="osmd-container"></div>
  </div>
</template>

<style scoped>
.sheet-music-container {
  width: var(--score-width);
  height: fit-content;
  overflow: auto;
  scroll-behavior: smooth;
}
</style>

<script>

import { mapState, mapMutations } from 'vuex'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

export default {
  computed: {
    ...mapState([
      'mfpMidiFile',
      'sequenceStart', 'sequenceEnd',
      'noteSequence', 'setStarts', 'setEnds',
      'osmdCursorAnchors', 'osmdSetCoordinates'
    ]),

    start() {
      return this.osmd.cursors[0]
    },

    cursor() {
      return this.osmd.cursors[1]
    },

    end() {
      return this.osmd.cursors[2]
    },

    containerHeight() {
      return this.$refs.container.getBoundingClientRect().height
    }
  },

  data() {
    return {
      drawn: false,
      zoom: 0.5,
      osmd: null, // because the OSMD constructor requires a container argument, it cannot just be injected.
      osmdOptions: {
        autoResize: false,
        backend: "svg", // see if we change this later,
        cursorsOptions: [
          {
            alpha: 0.5,
            color: '#02a78c',
            follow: false,
            type: 1
          },

          {
            alpha: 1,
            color: '#58e28e',
            follow: true,
            type: 0
          },

          {
            alpha: 0.5,
            color: '#02a78c',
            follow: false,
            type: 1
          }
        ],
        // Because OSMD uses Element.scrollIntoView() on the cursor to follow it,
        // The *entire page* is scrolled as a result.
        // This is not what we want.
        // followCursor: true
      },

      // To be updated by MFP.vue on emit by MFP.js after MusicXML parse
      tempoEvents: [],

      // The list of dates covered by the cursor that correspond to each set.
      // Used to move cursors during refresh.
      cursorAnchors: [],

      // The X and Y coordinate of the main cursor at it passes on each set.
      // Used to move cursors during drag.
      setCoordinates: [],

      // Simple convenience to avoid redundant switch statements.
      cursorNames: ["start", "index", "end"]
    }
  },

  async mounted() {
    if(!this.osmd) this.initOsmd()
    if(!!this.mfpMidiFile.musicXmlString) await this.updateScore(false)
  },
  beforeUnmount() {
    this.clearView()
  },

  watch: {
    async mfpMidiFile(newFile, oldFile) {
      this.clearView() // do this regardless of file type.
      if(newFile.isMidi || !newFile.musicXmlString) return
      await this.updateScore()
    },

    sequenceStart(newStart, oldStart) {
      if(this.drawn) this.moveCursorToSet(newStart, "start")
    },

    sequenceEnd(newEnd, oldEnd) {
      if(this.drawn) this.moveCursorToSet(newEnd + 1, "end")
    },

    // TODO : implement zoom on wheel like the piano roll.

    zoom(newZoom, oldZoom) {
      this.osmd.zoom = newZoom;
    }
  },

  methods: {

    ...mapMutations(['setOsmdCursorAnchors', 'setOsmdSetCoordinates']),

    // -------------------------------------------------------------------------
    // --------------------------SETUP AND CLEAR--------------------------------
    // -------------------------------------------------------------------------

    initOsmd() {
      this.osmd = new OpenSheetMusicDisplay('osmd-container')
      this.osmd.setOptions(this.osmdOptions)
    },

    async updateScore(calculateAnchors = true) {
      await this.loadScore(this.mfpMidiFile.musicXmlString)

      this.drawn = false

      this.displayScore()

      if(calculateAnchors) this.calculateCursorAnchorsAndSetCoordinates()
      // NORMALLY, if called without the setup step, we should already have the anchors/coordinates cached.
      else {
        this.cursorAnchors = this.osmdCursorAnchors
        this.setCoordinates = this.osmdSetCoordinates
      }

      this.setupCursors()

      this.drawn = true
    },

    // TODO : is this wrapper really necessary ?

    async loadScore(scoreString) {
      await this.osmd.load(scoreString)
    },

    displayScore() {
      // Yes, this method starts with a capital letter.
      if(!this.osmd.IsReadyToRender()) return;

      // Any update to zoom before load is ignored.
      // Therefore, it must only be set before render.
      this.osmd.zoom = this.zoom
      this.osmd.render()
    },

    setupCursors() {
      this.moveCursorToSet(0, "start")
      this.moveCursorToSet(this.setStarts.length, "end") // move to the last anchor, after the last actual set

      this.start.show()
      this.end.show()

      // OSMD sets the z-index of all cursors to -2, so the default cursor type stays behind notes as it highlights them.
      // However, this is unnecessary for thin-line left-aligned cursors.
      // And if we want to be able to click on them, they can't be behind the score.
      // So we modify this.

      // Note that for this same reason, it is completely impossible to attach
      // the mousedown listener to the index cursor without having it overlay the score.

      this.start.cursorElement.style.setProperty('z-index', 200)
      this.end.cursorElement.style.setProperty('z-index', 200)

      // Actual drag is not desirable here.
      // This is for two reasons :
      // 1. Seeing the drag "phantom image" is visually confusing.
      // 2. We would have to painstakingly interrupt drag event propagation,
      // since drag and drop are file upload events in the parent.

      this.start.cursorElement.draggable = false
      this.end.cursorElement.draggable = false

      // Since the cursor index cannot be treated the same, the osmdContainer,
      // which overlays it, takes the listener in its stead.

      this.start.cursorElement.addEventListener('mousedown', this.onCursorDragStart)
      this.$refs.osmdContainer.addEventListener('mousedown', this.onCursorDragStart)
      this.end.cursorElement.addEventListener('mousedown', this.onCursorDragStart)

      this.$refs.osmdContainer.addEventListener('mousemove', this.onCursorDrag)
      this.$refs.osmdContainer.addEventListener('mouseup', this.onCursorDragEnd)
    },

    clearView() {
      this.$refs.osmdContainer.innerHTML = ''
      this.drawn = false
    },

    // -------------------------------------------------------------------------
    // -----------------------------LISTENERS-----------------------------------
    //--------------------------------------------------------------------------

    // TODO : is this wrapper really necessary ?

    onIndexJump(index) {
      this.refresh(index, true)
    },

    onCursorDragStart(event) {
      // Called by the start or end cursor
      if(event.target instanceof HTMLImageElement) {
        const imgIndex = parseInt(event.target.id.split('-')[1], 10)
        this.dragging = this.cursorNames[imgIndex]
      }

      // Called by the container.
      else if(event.target instanceof SVGElement) {
        if(this.isWithinIndexCursorBounds(event.offsetX, event.offsetY))
          this.dragging = "index"
      }
    },

    onCursorDrag(event) {
      if(!!this.dragging && event.buttons > 0) {

        // The mousemove event may trigger with the cursor itself as target, thereby giving wrong offset values.
        // We need to prevent this case ; however, it's fine if any other element of the score is the target
        // (part lines, notes, etc.)
        // as their offset values are still correct.

        const refCursor = this.osmd.cursors[this.cursorNames.indexOf(this.dragging)].cursorElement
        if(event.target === refCursor) return

        // FIXME : we should optimize which coords we look for to only be within the container bounds.
        // However, we can't just filter, since we need to preserve indices. 

        const topDistances = this.setCoordinates.map(coord =>
          Math.hypot(coord.x - event.offsetX, coord.topY - event.offsetY)
        )
        const bottomDistances = this.setCoordinates.map(coord =>
          Math.hypot(coord.x - event.offsetX, coord.bottomY - event.offsetY)
        )

        const topMin = Math.min(...topDistances)
        const bottomMin = Math.min(...bottomDistances)
        const min = Math.min(topMin, bottomMin)

        const nearestSetIndex = (min === topMin ? topDistances : bottomDistances).indexOf(min)

        this.$emit(this.dragging, nearestSetIndex)
      }
    },

    onCursorDragEnd(event) {
      this.dragging = null
    },

    // This still counts as a listener to me, despite the naming.

    refresh(referenceSetIndex, scroll = false) {

      if(!this.drawn) return

      // Normally, OSMD should call init() on each cursor, which should set its hidden property to true.
      // However in practice, it is left undefined, requiring this.
      if(this.cursor.hidden === undefined || this.cursor.hidden) this.cursor.show()

      this.moveCursorToSet(referenceSetIndex)
      if(scroll) this.scrollCursorIntoView()
      // console.log(this.currentCursorDate())
    },

    // -------------------------------------------------------------------------
    // ----------------------------BULKY UTILS----------------------------------
    //--------------------------------------------------------------------------

    calculateCursorAnchorsAndSetCoordinates() {
      const allCursorDates = []
      const allCursorCoordinates = []

      // This is necessary to get actual X and Y coordinates for the cursor at it moves.
      // I don't like it, but there's no other way.
      // It will probably make no difference to the user anyway : they're unlikely to see this.
      this.cursor.show()

      while(!this.cursor.iterator.endReached) {
        // console.log("Measure : ", this.cursor.iterator.currentMeasureIndex)
        const notesUnderCursor = this.cursor.NotesUnderCursor()
        // console.log(notesUnderCursor)
        if( // Because date approximation is always finicky, we want to put luck on our side
          // So we exclude cursor entries that :
          notesUnderCursor.some(
            note => !note.isRest() // - contain only rests
            &&
            (!note.tie || note.tie.StartNote === note) // - contain only tied notes (except for tie starts, naturally)
          )
          // ...and which could be found to be closer to our actual sets than we'd like
        ) {
          allCursorDates.push(this.currentCursorDate())
          allCursorCoordinates.push(this.currentCursorCoordinates())
        }

        this.cursor.next()
      }

      // Also register the information for the cursor entry that comes *after* the end,
      // Because the end cursor can move there.

      this.cursor.next()
      const endDate = this.currentCursorDate()
      const endCoordinates = this.currentCursorCoordinates()

      this.cursor.reset()
      this.cursor.hide()

      // To make the search faster, we keep track of the last index
      // (because we only ever move forward)
      // and to do that, we need an object.
      // I miss int references.

      const cursorDatesAndSearchIndex = {
        searchIndex: 0,
        dates: allCursorDates
      }

      this.cursorAnchors = this.setStarts.map(startIndex =>
        this.findNearestCursorDate(startIndex, cursorDatesAndSearchIndex)
      ).concat([endDate]) // push() returns the length instead

      // I'm not very happy with this double array iteration.
      // I *could* do it inside the map for more efficiency,
      // But it would also be less readable.

      this.setCoordinates = allCursorCoordinates.filter((coord, index) =>
        this.cursorAnchors.includes(allCursorDates[index])
      ).concat([endCoordinates])

      this.setOsmdCursorAnchors(this.cursorAnchors)
      this.setOsmdSetCoordinates(this.setCoordinates)

      // console.log("All possible positions : ", allCursorPositions)
      // console.log("Full note sequence : ", this.noteSequence)
      //
      // console.log("Retained anchors : ", this.cursorAnchors)
      // console.log("Actual set start times : ", this.setStarts.map(startIndex => this.noteSequence[startIndex].startTime))
    },

    // Store tempos with their date of occurrence in microseconds.
    // This is necessary because otherwise, on read, we would assume all quarters to have elapsed with the same microsecond value
    // Which is not the case.

    setTempoEvents(tempoEvents) {
      let usAccum = 0;
      let wholeNoteAccum = 0;

      this.tempoEvents = tempoEvents.map((event, index) => {

        if(index > 0) { // the first event is always a dummy at delta 0. It won't affect the accumulator.
          const wholeNotesSincePreviousTempo = Math.abs(event.delta - wholeNoteAccum)
          // Don't forget : here, deltas are measured in whole notes.
          // So to get the amount of quarters, a factor of 4 is needed.
          usAccum += 4 * wholeNotesSincePreviousTempo * tempoEvents[index - 1].setTempo.microsecondsPerQuarter
          wholeNoteAccum += wholeNotesSincePreviousTempo
        }

        return {
          delta: event.delta,
          setTempo: event.setTempo,
          usDate: usAccum
        }
      })
    },

    getNearestTempoEvent(timeStampInWholeNotes) {
      return this.tempoEvents.findLast(event => event.delta <= timeStampInWholeNotes)
    },

    findNearestCursorDate(setStartIndex, cursorDatesAndSearchIndex) {
      const referenceStartTime = this.noteSequence[setStartIndex].startTime
      const allCursorDates = cursorDatesAndSearchIndex.dates

      let difference = Infinity;
      let prevDifference = difference

      for(let i = cursorDatesAndSearchIndex.searchIndex ; i < allCursorDates.length ; i++) {
        difference = Math.abs(referenceStartTime - allCursorDates[i])

        if(difference > prevDifference) { // since we only ever move forwards in time, once the difference increases it will never decrease again.
          cursorDatesAndSearchIndex.searchIndex = i;
          return allCursorDates[i-1] // this will never trigger at i = 0, because nothing will be larger than Infinity
        }
        else prevDifference = difference
      }

      // Of course, we won't find a bigger difference for the last anchor point.
      return allCursorDates[allCursorDates.length - 1]
    },

    currentCursorDate(providedCursor = undefined) {
      const cursor = !!providedCursor ? providedCursor : this.cursor

      const tempo = this.getNearestTempoEvent(cursor.iterator.currentTimeStamp.realValue)
      return (
        tempo.usDate +
        4 * (cursor.iterator.currentTimeStamp.realValue - tempo.delta)
          * tempo.setTempo.microsecondsPerQuarter
      ) * 0.000001
    },

    currentCursorCoordinates(providedCursor = undefined) {
      const cursor = !!providedCursor ? providedCursor : this.cursor

      return {
        x: cursor.cursorElement.offsetLeft,
        topY: cursor.cursorElement.offsetTop,
        bottomY: cursor.cursorElement.offsetTop + cursor.cursorElement.offsetHeight
      }
    },

    moveCursorToSet(setIndex, which = "index") {

      const chosenCursor = this.osmd.cursors[this.cursorNames.indexOf(which)]

      // FIXME : this is a strange bug that occurs after remounting on tab switch.
      // On first mount, the start and end cursors are shown and their hidden flag is false, as expected.
      // On re-mount, show() is indeed called on them both, but their hidden flag is set back to true at some later point.
      // Hence the need to show them again.
      // if(chosenCursor != this.cursor && chosenCursor.hidden) chosenCursor.show()
      // ...but even this is not enough !
      // Because the cursor's inner logic ends up graphically updating a non-existent DOM node,
      // thereby doing nothing.

      const desiredDate = this.cursorAnchors[setIndex]

      while(this.currentCursorDate(chosenCursor) !== desiredDate) { // thanks to the cursor anchors, we can use equality
        if(this.currentCursorDate(chosenCursor) < desiredDate) chosenCursor.next()
        else if(this.currentCursorDate(chosenCursor) > desiredDate) chosenCursor.previous()
      }
    },

    // Used instead of OSMD's cursor follow system,
    // Which calls Element.scrollIntoView(), causing the whole page to scroll constantly.

    scrollCursorIntoView() {
      const cursorTop = this.cursor.cursorElement.offsetTop
      const cursorHeight = this.cursor.cursorElement.getBoundingClientRect().height
      // const cursorBottom = cursorTop + cursorHeight

      const isOutOfSight =
        cursorTop < this.$refs.container.scrollTop ||
        cursorTop > this.containerHeight / 2 + this.$refs.container.scrollTop

      // Unlike the piano roll, there's only one scrollig alignment,
      // used both on index skip and on normal refresh.
      // This is because scrolling is not continuous.

      if(isOutOfSight) this.$refs.container.scrollTop = cursorTop - cursorHeight / 2
    },

    isWithinIndexCursorBounds(eventX, eventY) {
      if(this.cursor.hidden || this.cursor.hidden === undefined) return false

      const refElem = this.cursor.cursorElement

      const leftX = refElem.offsetLeft
      const rightX = leftX + refElem.offsetWidth
      const topY = refElem.offsetTop
      const bottomY = topY + refElem.offsetHeight

      return leftX <= eventX && eventX <= rightX && topY <= eventY && eventY <= bottomY
    }
  }
}
</script>
