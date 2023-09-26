<template>
  <div class="mfp-container">

    <IOManager
      class="manager"
      v-if="mfpMidiFile.buffer"/>

    <div class="file-input-wrapper">
      <div class="file-input" :class="{'align-column': !mfpMidiFile.buffer}">
        <input type="file" id="file" class="file" @change="onFileInput" @click="() => { this.value = null; }"/>
        <label for="file" class="file-label">
          {{!mfpMidiFile.buffer ? "Charger un fichier MIDI" : "Changer de fichier"}}
        </label>
        <div class="file-name" v-if="mfpMidiFile.buffer">{{ trimmedTitle }}</div>
        <div class="search-score-hint" v-else>
          Vous n'avez pas de partitions ? Trouvez-en de nouvelles
          <span class="link" @click="$router.push('/look-for-scores')">
            ici !
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
      v-if="mfpMidiFile.buffer"
      class="scroll"
      :start="sequenceStart"
      :end="sequenceEnd"
      :index="sequenceIndex"
      :size="sequenceLength"
      @index="onIndexChange"
      @start="onStartChange"
      @end="onEndChange"/>

    <div v-if="mfpMidiFile.buffer">
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
.mfp-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  justify-items: center;
  align-items: center;
  min-height: 500px;
}
.manager {
  width: fit-content;
  max-width: var(--score-width);
  padding-bottom: 12px;
}
.file-input-wrapper {
  width: fit-content;
  margin: 0 auto;
  text-align: left;
}
.file-input {
  display: flex;
  align-items: center;
  width: fit-content;
}
.file-input.align-column {
  flex-direction: column;
}
.file-name {
  margin: 0.25em;
  padding: 0.5em 1em;
  height: fit-content;
}
.file-name {
  display: inline-block;
  color: #999;
}
.file-label {
  margin-bottom: 12px;
  margin-left: 0;
  width: fit-content;
}
.search-score-hint {
  color: var(--hint-blue);
  font-style: italic;
  width: fit-content;
  height: fit-content;
  margin-bottom: 12px;
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
    trimmedTitle() {
      return this.mfpMidiFile.title.length < 45 ? this.mfpMidiFile.title : this.mfpMidiFile.title.slice(0,40)+"....mid"
    }
  },
  async mounted() {
    console.log(this)
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
