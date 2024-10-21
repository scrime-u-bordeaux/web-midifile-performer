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

const TAB_CLEF = 4 // Internal OSMD enum not accessible here

export default {
  computed: {
    ...mapState([
      'mfpMidiFile',
      'sequenceStart', 'sequenceIndex', 'sequenceEnd',
      'noteSequence', 'setStarts', 'setEnds', 'activeNotes', 'highlightPalette',
      'osmdCursorAnchors', 'osmdSetCoordinates',
      'playOnClickInSilentMode', 'playOnClickInPerformMode'
    ]),

    activeNoteRGB() {
      return this.highlightPalette.get(this.isModeSilent ? "darkBlue" : "darkGreen")
    },

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
    },

    // TODO : fix this when mode is unified into store, and make it a store getter.
    // Right now this is gonna work in both perform and play because we can't distinguish them...
    playOnClick() {
      return (this.isModeSilent && this.playOnClickInSilentMode) ||
             (!this.isModeSilent && this.playOnClickInPerformMode)
    }
  },

  data() {
    return {
      osmd: null, // because the OSMD constructor requires a container argument, it cannot just be injected.

      osmdOptions: {
        autoResize: false,
        backend: "svg", // see if we change this later,
        cursorsOptions: [
          // Note that I can't use the palette here :
          // The computed properties of the component aren't accessible in the function.
          {
            alpha: 1,
            color: '#02a7f0',
            follow: false,
            type: 1
          },

          // Note that the alpha and color options of the main cursor are only for setup.
          // They will change with mode.

          {
            alpha: 0.4,
            color: '#02a7f0',
            follow: true,
            type: 0
          },

          {
            alpha: 1,
            color: '#02a7f0',
            follow: false,
            type: 1
          }
        ],
        // Because OSMD uses Element.scrollIntoView() on the cursor to follow it,
        // The *entire page* is scrolled as a result.
        // This is not what we want.
        // followCursor: true
      },

      drawn: false,

      noteRGB: '#000000',

      zoom: 0.5,

      // To be updated by MFP.vue on emit by MFP.js after MusicXML parse
      tempoEvents: [],
      channelChanges: new Map(),
      graceNoteInfo: [], // Only needed because of an OSMD cursor limitation
      // (inability to position cursor over grace notes) when they are adjacent to their principal

      // The list of dates covered by the cursor that correspond to each set.
      // Used to move cursors during refresh.
      cursorAnchors: [],

      // The X and Y coordinate of the main cursor at it passes on each set.
      // Used to move cursors during drag.
      setCoordinates: [],

      // Two-way map (we could use a bijective map lib, but this works too)
      // between graphical notes and their note sequence equivalents.

      gNoteHeadsToNsNotes: new Map(),
      nsNotesToGNoteHeads: new Map(),

      // Simple convenience to avoid redundant switch statements.
      cursorNames: ["start", "index", "end"],

      // temporary !!
      // TODO : Phase out with unification of mode state in store
      isModeSilent: true,

      // Identical role to highlightedNote in PianoRoll
      // However, here, multiple noteheads may share the same stem.
      noteHeadsUnderCursor: [],

      // Additionally, we have to do this instead of querying by active class, because
      // querySelectorAll() is not recursive.
      // We take that opportunity to properly separate notes highlighted from the mouse
      // and notes highlighted because they're active.
      noteHeadsHighlightedByMouse: [],
      noteHeadsHighlightedByRefresh: [],

      ctrlKey: false
    }
  },

  async mounted() {
    if(!this.osmd) this.initOsmd()
    if(!!this.mfpMidiFile.musicXmlString) await this.updateScore(false)

    document.addEventListener('keydown', this.onKeyDown)
    document.addEventListener('keyup', this.onKeyUp)
  },
  beforeUnmount() {
    document.removeEventListener('keydown', this.onKeyDown)
    document.removeEventListener('keyup', this.onKeyUp)

    this.clear()
  },

  watch: {
    async mfpMidiFile(newFile, oldFile) {
      if(newFile.isMidi || !newFile.musicXmlString) return
      await this.updateScore()
    },

    sequenceStart(newStart, oldStart) {
      if(this.drawn) this.moveCursorToSet(newStart, "start")
    },

    sequenceEnd(newEnd, oldEnd) {
      if(this.drawn) this.moveCursorToSet(newEnd + 1, "end")
    },

    noteSequence(newSequence, oldSequence) {
      // This is called AFTER setGraceNoteInfo !!

      this.graceNoteInfo.forEach(info => {
        const graceNote = newSequence[info.graceIndex]
        graceNote.principal = newSequence[info.principalIndex]
      })
    },

    // TODO : implement zoom on wheel like the piano roll.
    // However, this would be *very* costly,
    // since the whole notehead setup would need to be repeated.

    zoom(newZoom, oldZoom) {
      this.osmd.zoom = newZoom;
    }
  },

  methods: {

    ...mapMutations(['setOsmdCursorAnchors', 'setOsmdSetCoordinates']),

    // -------------------------------------------------------------------------
    // ------------------------------MAIN LOGIC---------------------------------
    // -------------------------------------------------------------------------

    initOsmd() {
      this.osmd = new OpenSheetMusicDisplay('osmd-container')
      this.osmd.setOptions(this.osmdOptions)
    },

    async updateScore(calculateAnchors = true) {

      this.clear()

      await this.loadScore(this.mfpMidiFile.musicXmlString)

      // Should be redundant from clear(), but we're never too careful.
      this.drawn = false

      this.displayScore()

      if(calculateAnchors) this.calculateCursorAnchorsAndSetCoordinates()
      // NORMALLY, if called without the setup step, we should already have the anchors/coordinates cached.
      else {
        this.cursorAnchors = this.osmdCursorAnchors
        this.setCoordinates = this.osmdSetCoordinates
      }

      // These operations, however, cannot be cached,
      // Because they rely on instance-specific graphical elements.

      this.setupCursors()
      try {
        this.setupNoteHeads()
      } catch(e) {
        console.error("Error during setup of notehead event listeners.")
        console.error(e.message)
        console.error("Sheet music notes after this index will not react to click and hover.")

        this.cursor.reset()
      }

      this.cursor.show()

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

    refresh(referenceSetIndex, scroll = false) {

      if(!this.drawn) return

      // Each cursor is put through init() internally, which should set its hidden property to true.
      // However in practice, a bug sets it back to undefined.
      // A fix has been made, but not released to OSMD yet, so for now we do this.
      if(this.cursor.hidden === undefined || this.cursor.hidden) this.cursor.show()

      this.paintNotes([...this.activeNotes.values()])

      this.moveCursorToSet(referenceSetIndex)
      if(scroll) this.scrollCursorIntoView()
      // console.log(this.currentCursorDate())
    },

    stop() {
      this.unpaint("refresh")
    },

    clearState() {
      this.noteHeadsHighlightedByMouse = []
      this.noteHeadsHighlightedByRefresh = []

      this.gNoteHeadsToNsNotes.clear()
      this.nsNotesToGNoteHeads.clear()
    },

    clearView() {
      this.$refs.osmdContainer.innerHTML = ''
      this.drawn = false
    },

    clear() {
      this.clearState()
      this.clearView()
    },

    // -------------------------------------------------------------------------
    // -----------------------------LISTENERS-----------------------------------
    //--------------------------------------------------------------------------

    // TODO : is this wrapper really necessary ?

    onIndexJump(index) {
      this.refresh(index, true)
    },

    onIsModeSilent(isIt) {
      if(!this.drawn) return

      this.isModeSilent = isIt
      this.updateCursorColor()
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

    // FIXME : this is very heavily similar to Piano Roll logic.
    // I hate how much duplication this is.

    // FIXME : "hollow" notes (wholes and halves) are not triggered when clicking inside their hollow section.
    // This is because the inside of that hollow section is not part of the graphical note.

    onNoteClick(event) {
      const noteHeads = this.getNoteHeadsFromNoteSvgFamily(event.target)
      // There shouldn't be more than one set assigned to noteheads sharing the same stem...
      const noteIndex = this.getFirstValidNoteIndex(noteHeads)
      if(noteIndex < 0 ) return

      const setIndex = this.getSetIndex(noteIndex)

      if(setIndex < this.sequenceStart) this.$emit('start', setIndex)
      if(setIndex > this.sequenceEnd) this.$emit('end', setIndex)
      this.$emit('index', setIndex)

      this.paintSetOrNote(noteIndex, "mouse")

      if(this.playOnClick) {
        this.$emit('play',
          this.ctrlKey ?
            [this.noteSequence[noteIndex]] :
            this.getSet(setIndex)
        )
        this.clickPlayed = true
      }
    },

    // FIXME : hollow notes are also unlit when passing in their hollow section.

    onNoteHover(event) {
      const noteHeads = this.getNoteHeadsFromNoteSvgFamily(event.target)

      this.noteHeadsUnderCursor = noteHeads

      const noteIndex = this.getFirstValidNoteIndex(noteHeads)
      if(noteIndex < 0) return

      const setIndex = this.getSetIndex(noteIndex)

      this.paintSetOrNote(noteIndex, "mouse")
    },

    onNoteUnClick(event) {
      // Unlike the piano roll, we need to pass the event, to get access to its target...
      this.onNoteLeave(event)
    },

    onNoteLeave(event) {
      // ...so we test its type instead of its existence.
      if(event.type === "mouseleave") this.noteHeadsUnderCursor = []

      const noteHeads = this.getNoteHeadsFromNoteSvgFamily(event.target)
      const noteIndex = this.getFirstValidNoteIndex(noteHeads)
      if(noteIndex < 0) return

      const setIndex = this.getSetIndex(noteIndex)

      this.unpaint()

      if(this.clickPlayed) {
        this.$emit('stop')
        this.clickPlayed = false
      }
    },

    // TODO : Can we factorize these ?
    // (By testing the type of the received event)

    onKeyDown(event) {
      if(event.key === 'Control') {
        this.ctrlKey = true
        this.noteHeadsUnderCursor.forEach(noteHead =>
          noteHead.dispatchEvent(new Event('mouseover', {bubbles: true}))
        )
      }
    },

    onKeyUp(event) {
      if(event.key === 'Control') {
        this.ctrlKey = false
        this.noteHeadsUnderCursor.forEach(noteHead =>
          noteHead.dispatchEvent(new Event('mouseover', {bubbles: true}))
        )
      }
    },

    // -------------------------------------------------------------------------
    // ----------------------------SETUP LOGIC----------------------------------
    //--------------------------------------------------------------------------

    calculateCursorAnchorsAndSetCoordinates() {
      const allCursorDates = []
      const allNotesUnderCursor = []
      const allCursorCoordinates = []

      // This is necessary to get actual X and Y coordinates for the cursor at it moves.
      // I don't like it, but there's no other way.
      // It will probably make no difference to the user anyway : they're unlikely to see this.
      this.cursor.show()

      while(!this.cursor.iterator.endReached) {
        // console.log("Measure : ", this.cursor.iterator.currentMeasureIndex)
        const notesUnderCursor = this.cursor.NotesUnderCursor()
        const eligibleNotes = notesUnderCursor.filter(
          note => this.isEligibleMfpNote(note)
        )
        // console.log(eligibleNotes)

        // Because date approximation is always finicky, we want to put luck on our side
        // So we exclude cursor entries that could never be sets,
        // Because they contain no eligible note.
        if(eligibleNotes.length > 0) {
          allCursorDates.push(this.currentCursorDate())
          allCursorCoordinates.push(this.currentCursorCoordinates())

          const noteMapForPosition = new Map()

          // Not dealing with tabs for this right now.
          // Like, no, I'm not taking into consideration cases with both grace notes and tabs.
          // TODO : we need to find a way to address tabs through the source notes anyway.

          eligibleNotes.forEach(note => {
            const {pitch, channel} = this.getOSMDNoteInformation(note)
            const mapKey = `p${pitch}c${channel}`

            noteMapForPosition.set(
              mapKey,
              noteMapForPosition.has(mapKey) ?
                noteMapForPosition.get(mapKey).add(note) :
                new Set([note])
            )
          })

          allNotesUnderCursor.push(noteMapForPosition)
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

      const searchData = {
        searchIndex: 0,
        dates: allCursorDates,
        notes: allNotesUnderCursor,

        upcomingPrincipal: null
      }

      // console.log("Notes under cursor : ", searchData.notes)

      this.cursorAnchors = this.setStarts.map(startIndex =>
        this.findNearestCursorDate(startIndex, searchData)
      ).concat([endDate]) // push() returns the length instead

      // I'm not very happy with this double array iteration.
      // I *could* do it inside the map for more efficiency,
      // But it would also be less readable.

      this.setCoordinates = allCursorCoordinates.filter((coord, index) =>
        this.cursorAnchors.includes(allCursorDates[index])
      ).concat([endCoordinates])

      this.setOsmdCursorAnchors(this.cursorAnchors)
      this.setOsmdSetCoordinates(this.setCoordinates)

      console.log("All possible positions : ", allCursorDates)
      // console.log("Full note sequence : ", this.noteSequence)
      //
      console.log("Retained anchors : ", this.cursorAnchors)
      console.log("Actual set start times : ", this.setStarts.map(startIndex => this.noteSequence[startIndex].startTime))
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

    setupNoteHeads() {

      // Grace notes and their principals may be left unadressed as the cursor moves forward.
      // They must then be dealt with across set borders.
      const graceAdjacentsLeftBehind = new Map()

      this.setStarts.forEach((start, setIndex) => {
        const set = this.getSet(setIndex)
        // console.log(`Set ${setIndex} :`, set)

        const usedNotesOfSet = new Set()

        // Separate GNotes can share the same stem.
        // In this case, getSVGGElement will return the same root node.
        // This is why getNoteHeadsFromNoteSvgFamily returns an array.
        // To know *which* note head in that array is for which GNote,
        // we use these two trackers :

        let svgRootBuffer = null // the last unique SVG root node returned by getSVGGElement
        let indexInBuffer = 0 // the index of the notehead to pick

        // As well, since listeners cannot be set on every new root node
        // (since some will only contain tie-prolonging noteheads)
        // a set is used to keep track of whether they have been set.
        // As soon as a non-tie-prolonging note is encountered in a buffer,
        // the listeners are set, and the root note enters the set.
        const buffersWithListeners = new Set()

        this.moveCursorToSet(setIndex)

        // console.log(
        //   "All notes under cursor :",
        //   this.cursor.GNotesUnderCursor()
        //     .filter(gnote =>
        //       this.isEligibleMfpNote(gnote.sourceNote, false) &&
        //       gnote.clef.clefType !== TAB_CLEF // There's probably a way to test this with the sourceNote in isEligibleMfpNote instead
        //     )
        // )

        this.cursor.GNotesUnderCursor()
          .filter(gnote =>
            this.isEligibleMfpNote(gnote.sourceNote, false) &&
            gnote.clef.clefType !== TAB_CLEF // There's probably a way to test this with the sourceNote in isEligibleMfpNote instead
          ).forEach(gnote => {

            // console.log("Examining gnote", gnote)

            const gNoteSVGRoot = gnote.getSVGGElement()

            if(gNoteSVGRoot !== svgRootBuffer) {
              svgRootBuffer = gNoteSVGRoot
              indexInBuffer = 0
            } else indexInBuffer++

            // Tie prolongations are necessary for the indexInBuffer to make sense,
            // But they have no ns equivalent, so they are skipped.

            const isTieProlongation = this.isNoteTieProlongation(gnote.sourceNote)
            if(isTieProlongation) return

            // If listeners had not yet been set for this root, set them.

            if(!buffersWithListeners.has(svgRootBuffer)) {
              gNoteSVGRoot.addEventListener("mousedown", this.onNoteClick)
              gNoteSVGRoot.addEventListener("mouseover", this.onNoteHover)
              gNoteSVGRoot.addEventListener("mouseup", this.onNoteUnClick)
              gNoteSVGRoot.addEventListener("mouseleave", this.onNoteLeave)

              buffersWithListeners.add(svgRootBuffer)
            }

            // Determine the information needed to spot the equivalent in the set.

            const { pitch, channel } = this.getOSMDNoteInformation(gnote, true)

            // console.log(pitch, channel)

            // Normally, there should only be one note on of a given pitch and channel in each set.
            // However, due to how the MusicXML parser currently works, this might not be the case.
            // (When files with multiple voices set identical pitches on these voices without using separate channels)
            // I don't yet know if there's a way to translate voices into channels.

            const noteSequenceEquivalent = set.find(candidate =>
              candidate.pitch === pitch && candidate.channel === channel
              && !usedNotesOfSet.has(candidate)
            )

            // console.log("Equivalent for gnote :", noteSequenceEquivalent)

            const gNoteHeads = this.getNoteHeadsFromNoteSvgFamily(svgRootBuffer)
            const gNoteHead = gNoteHeads[indexInBuffer]

            // This precaution is necessary now (16/10/2024)
            // that the left-behind adjacents are considered :
            // indeed, they are deleted from graceAdjacentsLeftBehind on registration (see below),
            // but even if they HAVE already been registered,
            // they may still be found AGAIN, this time with no ns equivalent,
            // since the cursor stays in the same position with different ns sets.
            // But since they were already registered, they should not be tracked as "left behind".

            // This early exit means that the "duplicate registration" message should never appear anymore.

            if(this.gNoteHeadsToNsNotes.has(gNoteHead)) return

            // TODO : this should definitely be a shared function of SheetMusic and PianoRoll.
            const mapKey = `p${pitch}c${channel}`

            if(!noteSequenceEquivalent) {

              // It is normal for a grace cluster to behave strangely.
              // The cursor may indeed stay in place for multiple sets,
              // Over which the gnotes will not biject.
              // This is where we keep track of this occurrence.

              if(this.includesGraceNote(set) || graceAdjacentsLeftBehind.size > 0) {
                const otherAdjacentsForKey = graceAdjacentsLeftBehind.get(mapKey)

                graceAdjacentsLeftBehind.set(
                  mapKey,
                  !!otherAdjacentsForKey ?
                    otherAdjacentsForKey.add(gNoteHead) : new Set([gNoteHead])
                )
              }

              // Outside of grace clusters, however, this is an error,
              // which should halt the whole process.

              else throw new Error(
                `Could not find equivalent for graphical note in set ${setIndex}`
              )

            }

            else {
              this.registerNoteHead(gNoteHead, noteSequenceEquivalent, usedNotesOfSet)

              // Now that this notehead has been registered,
              // It has an equivalent, and must leave the set of left-behinds
              // if it was part of it.

              const adjacentsForKey = graceAdjacentsLeftBehind.get(mapKey)
              adjacentsForKey?.delete(gNoteHead)
            }
        })

        // After dealing with noteheads the normal way,
        // We check if this set does not contain ns equivalents for previously orphan noteheads.

        if(usedNotesOfSet.size != set.length && graceAdjacentsLeftBehind.size > 0) {
          const unaddressedNotes = set.filter(note => !usedNotesOfSet.has(note))

          // console.log("Addressing unadressed notes : ", unaddressedNotes)

          unaddressedNotes.forEach(note => {
            // console.log("Addressing note", note)

            const mapKey = `p${note.pitch}c${note.channel}`
            const candidateNoteHeads = graceAdjacentsLeftBehind.get(mapKey)

            if(!!candidateNoteHeads) {

              // Set values are always listed in order of insertion.
              // As a consequence, we are always looking for the earliest-registered candidate.

              const equivalentNoteHead = Array.from(candidateNoteHeads.values())[0]

              // console.log("Found candidate noteheads for note : ", candidateNoteHeads)
              // console.log("Registering equivalent notehead", equivalentNoteHead)

              this.registerNoteHead(equivalentNoteHead, note)

              // Once a ns equivalent is found, the registered notehead deleted from the candidates.
              // And once there are no candidates left, the key is cleared.

              if(candidateNoteHeads.size == 1) graceAdjacentsLeftBehind.delete(mapKey)
              else candidateNoteHeads.delete(equivalentNoteHead)
            }
          })
        }
      })

      if(this.gNoteHeadsToNsNotes.size !== this.nsNotesToGNoteHeads.size) {
        console.error("Mapping between graphical notes and note sequence failed to biject")
        console.error(
        `The map in direction ${
          this.gNoteHeadsToNsNotes.size > this.nsNotesToGNoteHeads.size ?
          'GNotes => NoteSequence' : 'NoteSequence => GNotes'
        } is of greater size`)

        console.log("GNotes to NoteSequence : ", this.gNoteHeadsToNsNotes)
        console.log("NoteSequence to GNotes : ", this.nsNotesToGNoteHeads)
        console.log(`NoteSequence length : ${this.noteSequence.length}`)
      }

      this.cursor.reset()
    },

    // -------------------------------------------------------------------------
    // ---------------------------SETUP UTILS-----------------------------------
    // -------------------------------------------------------------------------

    getOSMDNoteInformation(noteOrGNote, isGNote = false) {
      const pitch = (isGNote ? noteOrGNote.sourceNote : noteOrGNote)["halfTone"] + 12
      const channel = this.currentChannel(
        (isGNote ?
          noteOrGNote.parentVoiceEntry.parentVoiceEntry :
          noteOrGNote.ParentVoiceEntry
        )["parentVoice"].parent.idString
      )

      return {pitch, channel}
    },

    registerNoteHead(gNoteHead, nsNote, usedNotesOfSet = null) {

      // This case should not occur :
      // Normally, if the gNoteHead was already present, this function was not called.
      // But just in case, warn and skip it.

      if(this.gNoteHeadsToNsNotes.has(gNoteHead)) {
        console.warn("Attempted duplicate registration for", gNoteHead)
        console.warn("Skipping registration...")
        return
      }

      // This case should never happen anymore either :
      // It was only occurring in early tests for setupNoteheads,
      // before the svgRootBuffer system was finalized.

      else if(gNoteHead === undefined) {
        console.error("gNoteHead undefined for equivalent", noteSequenceEquivalent)
        return
      }

      if(!!usedNotesOfSet) usedNotesOfSet.add(nsNote)

      this.gNoteHeadsToNsNotes.set(gNoteHead, nsNote)
      this.nsNotesToGNoteHeads.set(nsNote, gNoteHead)
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

    setChannelChanges(channelChanges) {
      this.channelChanges = channelChanges
    },

    setGraceNoteInfo(graceNoteInfo) {
      this.graceNoteInfo = graceNoteInfo
    },

    getNearestTempoEvent(timeStampInWholeNotes) {
      return this.tempoEvents.findLast(event => event.delta <= timeStampInWholeNotes)
    },

    getNearestChannel(partId, timeStampInWholeNotes) {
      return this.channelChanges.get(partId).findLast(event => event.delta <= timeStampInWholeNotes)
    },

    // FIXME : last commit of mission on 31/05/2024 may have broken this function
    // Though it should only be the case in files with grace notes...
    // Should

    findNearestCursorDate(setStartIndex, searchData) {
      // console.log(`Finding nearest cursor date for set ${this.setStarts.indexOf(setStartIndex)}`)
      const set = this.getSet(this.setStarts.indexOf(setStartIndex))
      // console.log("Set in question is : ", set)

      const referenceStartTime = this.noteSequence[setStartIndex].startTime

      // If we're dealing with a grace note cluster, determine its principal.

      if(this.includesGraceNote(set)) {
        const principals = this.getGraceNotesInSet(set).map(
          graceNote => graceNote.principal
        ).sort(
          (principalA, principalB) => principalA.startTime - principalB.startTime
        )

        // The chosen principal is the latest-occurring one.
        // Just in case we have after-graces and graces with following principal
        // back to back in the same cluster.
        // (Yes, it can actually happen.)

        const relevantPrincipal = principals[principals.length - 1]

        // and if we have only after-graces,
        // (i.e. : the latest-occurring principal is still before this set),
        // then there's no need to consider their principal, since it's behind us.

        if(relevantPrincipal.startTime < referenceStartTime)
          searchData.upcomingPrincipal = null

        else searchData.upcomingPrincipal = relevantPrincipal
      }

      const allCursorDates = searchData.dates

      // If we are dealing with a grace note cluster, the normal search process does not apply.
      // TODO : perhaps move this block to a single-use function.
      // But we have so many functions here already...

      if(!!searchData.upcomingPrincipal) {

        // Ordinary cursor search does not necessitate knowledge of the notes under the cursor,
        // But here, we do need them.
        // This is the entire reason searchData.notes was created.

        const notesUnderCurrentPosition = searchData.notes[searchData.searchIndex]

        // The default action in a grace note cluster is staying in place.
        // So the first thing to know is whether this is possible.
        // See method body for details.

        const moveForced = this.setForcesMove(
          set, searchData.upcomingPrincipal, notesUnderCurrentPosition
        )

        // console.log("moveForced : ", moveForced)

        // Having examined the set and whether it forces a move,
        // Its info in searchData.notes is updated.

        set.forEach(nsNote => {
          const mapKey = `p${nsNote.pitch}c${nsNote.channel}`

          const remainingOSMDNotes = notesUnderCurrentPosition.get(mapKey)

          if(!!remainingOSMDNotes) {
            const notesInInsertionOrder = Array.from(remainingOSMDNotes.values())

            remainingOSMDNotes.delete(notesInInsertionOrder[0])
            if(remainingOSMDNotes.size === 0) notesUnderCurrentPosition.delete(mapKey)
          }
        })

        // We can now determine what to do with the search index :

        // If the current set forces a move, we must advance by one step exactly.
        // So, we increment the index before assignation.

        if(moveForced) searchData.searchIndex++

        // In all cases, the returned index is taken from the search index.

        const returnedIndex = searchData.searchIndex

        // If the current contains the principal and does not force a move,
        // we must of course play that principal, so we stay in place :
        // Hence, we do not increment *before* assigning.
        // However, the cluster is over, so the search index can and must be incremented,
        // To resume the monotonic ordinry search process on the next set.

        if(set.includes(searchData.upcomingPrincipal) && !moveForced) searchData.searchIndex++

        // console.log("Search index", searchData.searchIndex, "vs Returned index", returnedIndex)

        // And this *would* be all...
        // But two tasks remain if we are on the principal-containing set :

        if(set.includes(searchData.upcomingPrincipal)) {

          // 1. Take into account the imperfection of date approximation.
          // Sometimes (rarely, but sometimes), the "next" index is still not far enough,
          // and the increment must take place again.
          // To know if that is the case, we examine notes under the cursor again,
          // But this time, for the following set.

          const nextSet = this.getSet(this.setStarts.indexOf(setStartIndex)+1)
          const notesUnderNextPosition = searchData.notes[searchData.searchIndex]

          // console.log("Principal resolved, examining state of next set")

          if(this.setForcesMove(nextSet, searchData.upcomingPrincipal, notesUnderNextPosition)) {
            // console.log("Incrementing search index after cluster")
            searchData.searchIndex++
          }
          // else console.log("Next set OK, no additional increment")

          // 2. ...null the principal, so monotonic search resumes on the next set.
          // That one happens every time.

          searchData.upcomingPrincipal = null
        }

        return allCursorDates[returnedIndex]
      }

      // If there is no grace note cluster involved, the search process is very simple :
      // Get the cursor position with the closest timestamp to the set's.

      let difference = Infinity;
      let prevDifference = difference

      for(let i = searchData.searchIndex ; i < allCursorDates.length ; i++) {
        difference = Math.abs(referenceStartTime - allCursorDates[i])

        // Since we only ever move forwards in time,
        // once the difference increases, it will never decrease again.

        if(difference > prevDifference) {
          searchData.searchIndex = i
          // console.log("Notes under chosen position :", searchData.notes[i-1])
          return allCursorDates[i-1] // this will never trigger at i = 0,
          // because nothing will be larger than Infinity
        }
        else prevDifference = difference
      }

      // Of course, we won't find a bigger difference for the last anchor point.
      return allCursorDates[allCursorDates.length - 1]
    },

    currentCursorCoordinates(providedCursor = undefined) {
      const cursor = !!providedCursor ? providedCursor : this.cursor

      return {
        x: cursor.cursorElement.offsetLeft,
        topY: cursor.cursorElement.offsetTop,
        bottomY: cursor.cursorElement.offsetTop + cursor.cursorElement.offsetHeight
      }
    },

    // Channel histories carry zero-based channels
    // (since they come from the parser, which targets the lib, which uses zero-based channels)
    // but we use 1-indexed channels in this app,
    // so this is necessary.

    currentChannel(partId, index = 1) {
      return this.getNearestChannel(
        partId,
        this.cursor.iterator.currentTimeStamp.realValue
      ).channel + index
    },

    isNoteTieProlongation(note) {
      return !!note.tie && note.tie.StartNote !== note
    },

    // Discriminator for finding sets in cursor positions,
    // And noteheads eligible for reactivity.

    isEligibleMfpNote(note, ignoreTied = true) {
      return !note.isRest() // MFP doesn't acknowledge rests
      &&
      (!ignoreTied || !this.isNoteTieProlongation(note)) // and ties, aside from starts, are not actual notes
    },

    // Applies to a noteSequence note.
    // Should rather be relocated to the noteSequence util file when it's made,
    // But has no semantic place in PianoRoll.vue,
    // because a note can only be a grace note on the basis of sheet music notation
    isGraceNote(note) {
      return !!note.principal
    },

    includesGraceNote(set) {
      return set.some(note => this.isGraceNote(note))
    },

    getGraceNotesInSet(set) {
      return set.filter(note => this.isGraceNote(note))
    },

    setForcesMove(set, upcomingPrincipal, notesUnderCurrentPosition) {
      // console.log("Examining whether to force move for set", set)
      // console.log("Notes under given cursor position are :", notesUnderCurrentPosition)

      const nonPrincipalNonGraceNotes = set.filter(
        note => !this.isGraceNote(note) && note !== upcomingPrincipal
      )

      // console.log("Non grace-adjacent notes in set :", nonPrincipalNonGraceNotes)

      // The search must move forward in a grace note cluster if :
      // 1. All notes under the current position have expired
      // (indicating that any following notes are at following position)
      // or
      // 2. The current position contains notes that are not part of the cluster,
      // And are not found at the current position.
      // In other words, notes are no longer vertically aligned.

      return (notesUnderCurrentPosition.size === 0
          ||
        (
          nonPrincipalNonGraceNotes.length > 0
            &&
          nonPrincipalNonGraceNotes.some(nsNote => {
            const mapKey = `p${nsNote.pitch}c${nsNote.channel}`
            return notesUnderCurrentPosition.get(mapKey) === undefined
          })
        )
      )
    },

    isFullGraceNoteSet(set) {
      return set.every(note => this.graceNotes.includes(note))
    },

    // -------------------------------------------------------------------------
    // ----------------------------RUNTIME UTILS--------------------------------
    // -------------------------------------------------------------------------

    updateCursorColor() {
      this.cursor.cursorElement.src = this.highlightPalette.get(
        this.isModeSilent ? "cursorBlue" : "cursorGreen"
      )
    },

    moveCursorToSet(setIndex, which = "index") {

      const chosenCursor = this.osmd.cursors[this.cursorNames.indexOf(which)]

      const desiredDate = this.cursorAnchors[setIndex]

      while(this.currentCursorDate(chosenCursor) !== desiredDate) { // thanks to the cursor anchors, we can use equality
        if(this.currentCursorDate(chosenCursor) < desiredDate) chosenCursor.next()
        else if(this.currentCursorDate(chosenCursor) > desiredDate) chosenCursor.previous()
      }

      // OSMD resets the source of the image when moving the cursor,
      // So we must fight this effect on every step.
      // Thankfully, no blinking results from this, or if it does, it's not perceptible.

      this.updateCursorColor()
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

      // Unlike the piano roll, there's only one scrolling alignment,
      // used both on index skip and on normal refresh.
      // This is because scrolling is not continuous.

      if(isOutOfSight) this.$refs.container.scrollTop = cursorTop - cursorHeight / 2
    },

    // Used to initiate index cursor drag.
    // Since the index cursor has to remain on a low z-index, it can't directly be the target of the event.
    // So instead, the container receives the event and decides if the cursor was targeted using this method.

    isWithinIndexCursorBounds(eventX, eventY) {
      if(this.cursor.hidden || this.cursor.hidden === undefined) return false

      const refElem = this.cursor.cursorElement

      const leftX = refElem.offsetLeft
      const rightX = leftX + refElem.offsetWidth
      const topY = refElem.offsetTop
      const bottomY = topY + refElem.offsetHeight

      return leftX <= eventX && eventX <= rightX && topY <= eventY && eventY <= bottomY
    },

    // Among the noteHeads of a given SVG family,
    // some may not be registered in our maps.
    // The only reason for this so far is them being a tie prolongation.

    getFirstValidNoteIndex(noteHeads) {
      const firstValidNoteHead = noteHeads.find(noteHead =>
        this.gNoteHeadsToNsNotes.has(noteHead)
      )

      return !!firstValidNoteHead ?
        this.gNoteHeadsToNsNotes.get(firstValidNoteHead).index :
        -1
    },

    // -------------------------------------------------------------------------
    // ---------------------------SHARED UTILS----------------------------------
    // -------------------------------------------------------------------------

    wholeNotesToSeconds(wholeNoteTimeStamp) {
      const tempo = this.getNearestTempoEvent(wholeNoteTimeStamp)
      return (
        tempo.usDate +
        4 * (wholeNoteTimeStamp - tempo.delta)
          * tempo.setTempo.microsecondsPerQuarter
      ) * 0.000001
    },

    currentCursorDate(providedCursor = undefined) {
      const cursor = !!providedCursor ? providedCursor : this.cursor
      return this.wholeNotesToSeconds(cursor.iterator.currentTimeStamp.realValue)
    },

    // When clicking on a note, multiple elements can be the target.
    // This funnels them all down to the elements registered in our relevant maps : the notehead <path>s.
    // Note that this means we are *not* returning the <g> tag with class "vf-notehead".

    // This method returns an *array*, because a single note svg family, with one single staveNote root,
    // Can share one stem but have multiple noteheads (in fact, it's extremely common).

    getNoteHeadsFromNoteSvgFamily(gNoteSVGFamilyMember) {

      const getNoteHeadsFromStaveNote = (staveNote) => {
        return [...staveNote.firstChild.children].filter(child =>
          child.classList.contains("vf-notehead")
        ).map(gTag => gTag.firstChild)
      }

      switch(gNoteSVGFamilyMember.classList.item(0)) {

        // The highest element in the SVG hierarchy.

        case "vf-stavenote":

          return getNoteHeadsFromStaveNote(gNoteSVGFamilyMember)
          break

        // FIXME : this does not cover the case of grouped notes (eights and above)
        // Because their stems are not drawn as part of their graphical notes.
        // 07/10/24 : Is this still the case or did I just forget to remove this comment ?

        // The stem of the note.

        case "vf-stem":

          // (In practice, this is probably redundant :
          // we probably only ever encounter the <path> of the stem as the target,
          // never the <g>.)

          const staveNote =
            gNoteSVGFamilyMember instanceof SVGPathElement ?
            gNoteSVGFamilyMember.parentNode.parentNode.parentNode :
            gNoteSVGFamilyMember.parentNode.parentNode

          return getNoteHeadsFromStaveNote(staveNote)
          break

        // The <g> of the notehead.

        case "vf-notehead":

          return [gNoteSVGFamilyMember.firstChild]

        default: // an empty classlist : this is for <path> elements

          // They are their own separate list of cases

          switch(gNoteSVGFamilyMember.parentNode.classList.item(0)) {

            // The flag of an isolated eighth (or shorter) note.

            case "vf-flag":

              return getNoteHeadsFromStaveNote(
                gNoteSVGFamilyMember.parentNode.parentNode.parentNode
              )
              break

            // A note accidental.

            case "vf-modifiers":
              return getNoteHeadsFromStaveNote(
                gNoteSVGFamilyMember.parentNode.parentNode
              )

            // The <path> of the notehead : this is the element we seek.

            case "vf-notehead":

              return [gNoteSVGFamilyMember]
              break
          }
      }
    },

    // -------------------------------------------------------------------------
    // ----------------------REPRODUCED FROM PIANO ROLL-------------------------
    // -------------------------------------------------------------------------

    // FIXME : these should be factorized/set to a parent component with overriding
    // Except Vue doesn't have an inheritance model for components.
    // Still, there should be a way to improve this.

    paintSetOrNote(noteIndex) {
      this.paintNotes(
          this.ctrlKey ?
          [this.noteSequence[noteIndex]] :
          this.getSet(this.getSetIndex(noteIndex)),

          "mouse"
        )
    },

    paintNotes(nsNotes, paintType = "refresh") {

      this.unpaint(paintType)

      const highlightGroup =
        paintType === "refresh" ?
        this.noteHeadsHighlightedByRefresh :
        this.noteHeadsHighlightedByMouse

      nsNotes.map(
        nsNote => this.nsNotesToGNoteHeads.get(nsNote)
      ).forEach((gNoteHead, index) => {
        if(!gNoteHead) {
          console.error("Could not find matching notehead for noteSequence note",
            nsNotes[index]
          )
          return
        }
        gNoteHead.setAttribute('fill', this.activeNoteRGB)
        highlightGroup.push(gNoteHead)
      })
    },

    unpaint(paintType = "mouse") {

      const notesToUnpaint =
        paintType === "mouse" ?
        this.noteHeadsHighlightedByMouse :
        this.noteHeadsHighlightedByRefresh

      notesToUnpaint.forEach(gNoteHead =>
        gNoteHead.setAttribute('fill', this.noteRGB)
      )

      if(paintType === "mouse") this.noteHeadsHighlightedByMouse = []
      else this.noteHeadsHighlightedByRefresh = []
    },

    getSet(setIndex) {
      return this.noteSequence.slice(this.setStarts[setIndex], this.setEnds[setIndex]+1)
    },

    getSetIndex(noteIndex) {
      const tentativeSetIndex = this.setStarts.findIndex(i => i > noteIndex)
      return tentativeSetIndex > 0 ? tentativeSetIndex - 1 : this.setStarts.length - 1
    },
  }
}
</script>
