<template>
  <div style="text-align: center;">

    <IOManager
      class="manager"/>

    <div class="file-input-wrapper">
    <div class="file-input">
      <input type="file" id="file" class="file" @change="onFileInput" @click="() => { this.value = null; }"/>
      <label for="file">
        Charger un fichier MIDI
      </label>
      <div class="file-name">{{ mfpMidiFile.title }}</div>
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
      :size="sequenceLength"
      @index="onIndexChange"
      @start="onStartChange"
      @end="onEndChange"/>

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
.manager {
  display: inline-block;
  width: 100%;
  max-width: var(--score-width);
  text-align: left;
}
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
import { mapMutations, mapState } from 'vuex';
import IOManager from '../components/IOManager.vue';
import Keyboard from '../components/Keyboard.vue';
import ScrollBar from '../components/ScrollBar.vue';

const noInputFileMsg = 'Aucun fichier sélectionné';

export default {
  inject: [ 'performer' ],
  components: { IOManager, Keyboard, ScrollBar },
  data() {
    return {
      currentMode: 'silent',
      fileName: noInputFileMsg,
      fileArrayBuffer: null,
    };
  },
  computed: {
    ...mapState([
      'mfpMidiFile',
      'minKeyboardNote',
      'maxKeyboardNote',
      'keyboardState',
      'sequenceStart',
      'sequenceEnd',
      'sequenceIndex',
      'sequenceLength',
    ]),
  },
  async mounted() {
    this.performer.clear();

    if (this.mfpMidiFile.buffer !== null) {
      console.log('buffer already full');
      await this.loadMfpMidiBuffer(this.mfpMidiFile.buffer);
    } else {
      console.log('wtf ? no buffer ?');
    }

  },
  methods: {
    ...mapMutations([
      'setMfpMidiFile',
    ]), 
    async onFileInput(e) {
      return new Promise((resolve, reject) => {
        const file = e.target.files[0];
        this.fileName = file.name;

        const reader = new FileReader();
        const fileByteArray = [];

        reader.addEventListener('loadend', async e => {
          if (e.target.readyState === FileReader.DONE) {
            const mfpFile = {
              id: 'mfp',
              title: file.name,
              url: '',
              buffer: e.target.result,
            };
            console.log(mfpFile);
            this.setMfpMidiFile(mfpFile);
            await this.loadMfpMidiBuffer(mfpFile.buffer);
            resolve();
          }
        });
        reader.readAsArrayBuffer(file);
      });
    },
    async loadMfpMidiBuffer(buffer) {
      await this.performer.loadArrayBuffer(buffer);
      this.currentMode = 'silent';
      this.performer.setMode(this.currentMode);
      this.performer.setSequenceIndex(0);
    },
    onStartChange(i) {
      this.performer.setSequenceBounds(i, this.sequenceEnd);
    },
    onIndexChange(i) {
      // scrollbar callback, i is chordSequence index
      // do something with it like display a cursor at the right position
      console.log('new index : ' + i);
      this.performer.setSequenceIndex(i);
    },
    onEndChange(i) {
      this.performer.setSequenceBounds(this.sequenceStart, i);
    },
    onClickListen() {
      this.currentMode = this.currentMode === 'silent' ? 'listen' : 'silent';
      this.performer.setMode(this.currentMode);
      //this.performer.setSequenceIndex(0);
    },
    onClickPerform() {
      this.currentMode = this.currentMode === 'silent' ? 'perform' : 'silent';
      this.performer.setMode(this.currentMode);
      // this.performer.setSequenceIndex(0);
    },
  }
};
</script>