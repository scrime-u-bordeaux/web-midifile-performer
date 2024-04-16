<template>
  <div class="sheet-music-container">
    <div ref="osmdContainer" class="osmd-container" id="osmd-container"></div>
  </div>
</template>

<style scoped>
.sheet-music-container {
  width: var(--score-width);
  height: fit-content;
  overflow: auto;
}
</style>

<script>

import { mapState } from 'vuex'
import { OpenSheetMusicDisplay } from 'opensheetmusicdisplay'

export default {
  computed: {
    ...mapState(['mfpMidiFile'])
  },

  data() {
    return {
      zoom: 0.5,
      osmd: null, // because the OSMD constructor requires a container argument, it cannot just be injected.
      osmdOptions: {
        backend: "svg" // see if we change this later
      }
    }
  },

  async mounted() {
    if(!this.osmd) this.initOsmd()
    if(!!this.mfpMidiFile.musicXmlString) await this.refreshScore()
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
      await this.refreshScore()
    },

    // TODO : implement zoom on wheel like the piano roll.

    zoom(newZoom, oldZoom) {
      this.osmd.zoom = newZoom;
    }
  },

  methods: {

    initOsmd() {
      this.osmd = new OpenSheetMusicDisplay('osmd-container')
      this.osmd.setOptions(this.osmdOptions)
    },

    async refreshScore() {
      await this.loadScore(this.mfpMidiFile.musicXmlString)
      this.displayScore()
    },

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

    clearView() {
      this.$refs.osmdContainer.innerHTML = ''
    }
  }
}
</script>
