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
      );
      //
      // // Do the same thing MFP.js does, but with the NoteSequence's data.
      // // This avoids filtering on each note callback.
      //
      // this.noteSequenceCopy.clear();
      // const allPitches = new Set(
      //   this.$refs.visualizer.noteSequence.notes.map(
      //     note => note.pitch
      //   )
      // );
      //
      // allPitches.forEach(pitch => {
      //   this.noteSequenceCopy.set(pitch, this.$refs.visualizer.noteSequence.notes.filter(
      //     note => note.pitch === pitch
      //   ))
      // });
    },
    note(note) {

      const referenceNote =
        this.$refs.visualizer.noteSequence.notes.filter(magentaNote =>
          magentaNote.pitch === note.pitch
        )[note.index]

      // const referenceNote = this.noteSequenceCopy.get(note.pitch)[note.index];

      this.$refs.visualizer.redraw(!!referenceNote ? referenceNote : note);
    },
    stop() {
      this.$refs.visualizer.clearActiveNotes();
    }
  }
}
</script>
