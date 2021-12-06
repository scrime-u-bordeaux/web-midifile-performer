<template>
  <div style="text-align: center;">

    <div class="file-input-wrapper">
    <div class="file-input">
      <input type="file" id="file" class="file" @change="onFileInput"/>
      <label for="file">
        Charger un fichier MIDI
      </label>
      <div class="file-name">{{ fileName }}</div>
      <div class="search-score-hint">
        Vous n'avez pas de partitions ? Trouvez-en de nouvelles
        <span class="link" @click="$router.push('/look-for-scores')">
          ici
        </span>
      </div>
    </div>
    </div>

    <Keyboard
      class="keyboard"
      :minNote="minKeyboardNote"
      :maxNote="maxKeyboardNote"
      :state="keyboardState"
      :whiteNoteWidth="15"/>

    <scroll-bar
      class="scroll"
      :start="sequenceStart"
      :end="sequenceEnd"
      :index="sequenceIndex"
      @index="onIndexChange"/>

    <div>
      <button
        @click="onClickListen"
        :disabled="currentMode !== 'silent' && currentMode !== 'listen'">
        Écouter
      </button>

      <button
        @click="onClickPerform"
        :disabled="currentMode !== 'silent' && currentMode !== 'perform'">
        Interpréter
      </button>

      <button
        @click="$router.push('/guide')"
        :disabled="currentMode !== 'silent'">
        ? Aide
      </button>

      <button
        style="display: none;"
        @click="onClickExport"
        :disabled="currentMode !== 'silent'">
        Exporter
      </button>
    </div>
  </div>
</template>

<style scoped>
.file-input-wrapper {
  max-width: var(--score-width);
  margin: 0 auto;
  text-align: left;
}
.file-name, .search-score-hint {
  margin: 0.25em;
  padding: 0.5em 1em;
}
.file-name {
  display: inline-block;
  color: #999;
}
.search-score-hint {
  color: var(--hint-blue);
}
span.link {
  text-decoration: underline;
  cursor: pointer;
}
.scroll, .keyboard {
  display: inline-block;
  max-width: var(--score-width);
  width: 100%;
}
</style>

<script>
import { mapState } from 'vuex';
import Keyboard from '../components/Keyboard.vue';
import ScrollBar from '../components/ScrollBar.vue';

const noInputFileMsg = 'Aucun fichier sélectionné';

export default {
  inject: [ 'performer' ],
  components: { Keyboard, ScrollBar },
  data() {
    return {
      currentMode: 'silent',
      fileName: noInputFileMsg,
      fileArrayBuffer: null,
    };
  },
  computed: {
    ...mapState([
      'minKeyboardNote',
      'maxKeyboardNote',
      'keyboardState',
      'sequenceStart',
      'sequenceEnd',
      'sequenceIndex',
    ]),
  },
  methods: {
    async onFileInput(e) {
      return new Promise((resolve, reject) => {
        const file = e.target.files[0];
        this.fileName = file.name;

        const reader = new FileReader();
        const fileByteArray = [];

        reader.addEventListener('loadend', async e => {
          if (e.target.readyState === FileReader.DONE) {
            await this.performer.loadArrayBuffer(e.target.result);
            this.currentMode = 'silent';
            this.performer.setMode(this.currentMode);
            this.performer.setSequenceIndex(0);
            resolve();
          }
        });
        reader.readAsArrayBuffer(file);
      });
    },
    onIndexChange(i) {
      // scrollbar callback, i is chordSequence index
      // do something with i like display a cursor at the right position
    },
    onClickListen() {
      this.currentMode = this.currentMode === 'silent' ? 'listen' : 'silent';
      this.performer.setMode(this.currentMode);
      this.performer.setSequenceIndex(0);
    },
    onClickPerform() {
      this.currentMode = this.currentMode === 'silent' ? 'perform' : 'silent';
      this.performer.setMode(this.currentMode);
      this.performer.setSequenceIndex(0);
    },
  }
};
</script>