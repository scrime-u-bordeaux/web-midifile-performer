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
      }
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
      console.log(this.$refs.visualizer.config)
      this.$refs.visualizer.noteSequence = await blobToNoteSequence(file);
    },
    note(note) {

      const referenceNote =
        this.$refs.visualizer.noteSequence.notes
          .filter(magentaNote => magentaNote.pitch === note.pitch)
          .find(magentaNote =>
            // 20 ms delay, just like for sets
            // Of course, this is arbitrary, and it works in some places and not others
            Math.abs(magentaNote.startTime - note.startTime).toFixed(2) <= 0.02
          );

      this.$refs.visualizer.redraw(!!referenceNote ? referenceNote : note);
    },
    stop() {
      this.$refs.visualizer.clearActiveNotes();
    }
  }
}
</script>
