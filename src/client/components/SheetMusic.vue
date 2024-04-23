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
      'noteSequence', 'setStarts', 'setEnds',
      'osmdCursorAnchors'
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

      // The list of available positions for the cursor that correspond to each set.
      cursorAnchors: []
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
      if(newFile.isMidi || !newFile.musicXmlString) {
        this.clearView()
        return;
      }
      await this.updateScore()
    },

    // TODO : implement zoom on wheel like the piano roll.

    zoom(newZoom, oldZoom) {
      this.osmd.zoom = newZoom;
    }
  },

  methods: {

    ...mapMutations(['setOsmdCursorAnchors']),

    // -------------------------------------------------------------------------
    // --------------------------SETUP AND CLEAR--------------------------------
    // -------------------------------------------------------------------------

    initOsmd() {
      this.osmd = new OpenSheetMusicDisplay('osmd-container')
      this.osmd.setOptions(this.osmdOptions)
    },

    async updateScore(setupCursor = true) {
      await this.loadScore(this.mfpMidiFile.musicXmlString)

      this.drawn = false

      this.displayScore()

      if(setupCursor) this.prepareCursor()
      // NORMALLY, if called without the setup step, we should already have the anchors cached.
      else this.cursorAnchors = this.osmdCursorAnchors

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

      this.start.show()
      this.end.show()
    },

    clearView() {
      this.$refs.osmdContainer.innerHTML = ''
      this.drawn = false
    },

    // -------------------------------------------------------------------------
    // -----------------------------LISTENERS-----------------------------------
    //--------------------------------------------------------------------------

    onIndexJump(index) {
      if(this.drawn) this.refresh(index, true)
    },

    // This still counts as a listener to me, despite the naming.

    refresh(referenceSetIndex, scroll = false) {
      // Normally, OSMD should call init() on each cursor, which should set its hidden property to true.
      // However in practice, it is left undefined, requiring this.
      if(this.cursor.hidden === undefined || this.cursor.hidden) this.cursor.show()

      this.moveCursorToSet(referenceSetIndex)
      if(scroll) this.scrollCursorIntoView()
      // console.log(this.currentCursorPosition())
    },

    // -------------------------------------------------------------------------
    // ----------------------------BULKY UTILS----------------------------------
    //--------------------------------------------------------------------------

    prepareCursor() {
      const allCursorPositions = []

      while(!this.cursor.iterator.endReached) {
        // console.log("Measure : ", this.cursor.iterator.currentMeasureIndex)
        const notesUnderCursor = this.cursor.NotesUnderCursor()
        // console.log(notesUnderCursor)
        if( // Because position approximation is always finicky, we want to put luck on our side
          // So we exclude positions that :
          notesUnderCursor.some(
            note => !note.isRest() // - contain only rests
            &&
            (!note.tie || note.tie.StartNote === note) // - contain only tied notes (except for tie starts, naturally)
          )
          // ...and which could be found to be closer to our actual sets than we'd like
        ) {
          allCursorPositions.push(this.currentCursorPosition())
        }

        this.cursor.next()
      }

      this.cursor.reset()

      // To make the search faster, we keep track of the last index
      // (because we only ever move forward)
      // and to do that, we need an object.
      // I miss int references.

      const cursorPositionsAndSearchIndex = {
        searchIndex: 0,
        positions: allCursorPositions
      }

      this.cursorAnchors = this.setStarts.map(startIndex =>
        this.findNearestCursorPosition(startIndex, cursorPositionsAndSearchIndex)
      )

      this.setOsmdCursorAnchors(this.cursorAnchors)

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

    findNearestCursorPosition(setStartIndex, cursorPositionsAndSearchIndex) {
      const referenceStartTime = this.noteSequence[setStartIndex].startTime
      const allCursorPositions = cursorPositionsAndSearchIndex.positions

      let difference = Infinity;
      let prevDifference = difference

      for(let i = cursorPositionsAndSearchIndex.searchIndex ; i < allCursorPositions.length ; i++) {
        difference = Math.abs(referenceStartTime - allCursorPositions[i])

        if(difference > prevDifference) { // since we only ever move forwards in time, once the difference increases it will never decrease again.
          cursorPositionsAndSearchIndex.searchIndex = i;
          return allCursorPositions[i-1] // this will never trigger at i = 0, because nothing will be larger than Infinity
        }
        else prevDifference = difference
      }

      // Of course, we won't find a bigger difference for the last anchor point.
      return allCursorPositions[allCursorPositions.length - 1]
    },

    currentCursorPosition() {
      const tempo = this.getNearestTempoEvent(this.cursor.iterator.currentTimeStamp.realValue)
      return (
        tempo.usDate +
        4 * (this.cursor.iterator.currentTimeStamp.realValue - tempo.delta)
          * tempo.setTempo.microsecondsPerQuarter
      ) * 0.000001
    },

    moveCursorToSet(setIndex) {
      const cursorPosition = this.currentCursorPosition()
      const desiredPosition = this.cursorAnchors[setIndex]

      while(this.currentCursorPosition() !== desiredPosition) { // thanks to the cursor anchors, we can use equality
        if(this.currentCursorPosition() < desiredPosition) this.cursor.next()
        else if(this.currentCursorPosition() > desiredPosition) this.cursor.previous()
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
    }
  }
}
</script>
