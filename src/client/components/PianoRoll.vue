<template>
  <div class="piano-roll-container">
    <midi-visualizer
      class="visualizer"
      ref="visualizer"
      type="piano-roll"
      :config="visualizerConfig">
    </midi-visualizer>
  </div>
</template>

<style scoped>
.piano-roll-container {
  width: var(--score-width)
}
.visualizer {
  width: inherit;
  overflow: auto;
}
</style>

<script>
import { mapState } from 'vuex'
import 'html-midi-player'

import {blobToNoteSequence} from '@magenta/music'

export default {
  data() {
    return {
      visualizerConfig: {
        noteRGB: '102, 102, 102',
        activeNoteRGB: '88, 226, 142'
      },
      noteSequenceCopy: new Map()
    }
  },
  computed: {
    ...mapState(['mfpMidiFile']),
  },
  watch: {
    mfpMidiFile(newFile, oldFile) {
      // Strangely, this works.
      // The watcher itself is apparently async without having to declare it as such,
      // And awaits the blob conversion.
      this.updateNoteSequence(new Blob([newFile.buffer]));
    }
  },
  methods: {
    async updateNoteSequence(file) {
      this.$refs.visualizer.noteSequence = await blobToNoteSequence(file);
      // Let's just hope this has no ill effects on the NoteSequence :))
      this.$refs.visualizer.noteSequence.notes.sort(
        (noteA, noteB) => noteA.startTime - noteB.startTime
      )

      // Do the same thing MFP.js does, but with the NoteSequence's data.
      // This avoids filtering on each note callback.

      this.noteSequenceCopy.clear()
      this.$refs.visualizer.noteSequence.notes.forEach(note => {
        if(!this.noteSequenceCopy.has(note.pitch))
          this.noteSequenceCopy.set(note.pitch, [])

        this.noteSequenceCopy.get(note.pitch).push(note)
      })
    },
    note(note) {

      // In a smart world, this would be enough.

      const referenceNote = this.noteSequenceCopy.get(note.pitch)[note.index]

      // ... but this is JavaScript.
      // The sort operation unavoidably copies all objects in the array.
      // (Regardless of whether it's sorted in place or by copy)
      // And because Magenta uses === to scroll, we need the original object.
      // Therefore, a *second* lookup is necessary.
      // Obviously, the bigger the file (= the more notes there are to compare against)
      // The more this induces lag.
      // This is bad.

      const trueReferenceNote =
        this.$refs.visualizer.noteSequence.notes.find(unsortedNote =>
          // No need for a pitch check anymore
          unsortedNote.startTime === referenceNote.startTime &&
          unsortedNote.endTime === referenceNote.endTime
        )

      this.$refs.visualizer.redraw(!!trueReferenceNote ? trueReferenceNote : note);
    },
    stop() {
      this.$refs.visualizer.clearActiveNotes();
    }
  }
}
</script>
