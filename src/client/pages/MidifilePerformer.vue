<template>
  <LoadingScreen v-if="displayLoadingScreen"/>

  <div v-else class="mfp-container"
    @drop="onDrop"
    @dragover="onDragOver">

    <span class="contextualization" v-if="!mfpMidiFile.buffer">
      <p>{{ $t('midiFilePerformer.contextualization.firstLine') }}</p>
      <p>{{ $t('midiFilePerformer.contextualization.secondLine') }}</p>
      <p>{{ $t('midiFilePerformer.contextualization.thirdLine') }}</p>
    </span>

    <IOManager
      class="manager"
      v-if="mfpMidiFile.buffer"
      @inputChange="onInputChange"/>

    <div class="file-input-wrapper">
      <div class="file-input" :class="!mfpMidiFile.buffer ? 'align-column' : ''">
        <input accept=".mid, .midi" type="file" id="file" class="file" @change="onFileInput" @click="() => { this.value = null; }"/>
        <label for="file" class="file-label">
          {{ $t('midiFilePerformer.upload.' + (!mfpMidiFile.buffer ? 'first' : 'change')) }}
        </label>
        <div class="file-name" v-if="mfpMidiFile.buffer">{{ trimmedTitle }}</div>
        <div class="search-score-hint" v-else>
          {{ $t('midiFilePerformer.noScores.message') }}
          <span class="link" @click="$router.push('/look-for-scores')">
            {{ $t('midiFilePerformer.noScores.link') }}
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
      ref="mainScrollBar"
      v-if="mfpMidiFile.buffer"
      class="index-scroll"
      :has-bounds="true"
      :start="sequenceStart"
      :end="sequenceEnd"
      :index="sequenceIndex"
      :size="sequenceLength"
      @modeChange="onModeChange"
      @index="onIndexChange"
      @start="onStartChange"
      @end="onEndChange"/>

    <div v-if="mfpMidiFile.buffer">
      <div class="control-button-container">

        <button
          @click="$router.push('/guide')">
          {{ $t("midiFilePerformer.help") }}
        </button>

        <button
          style="display: none;"
          @click="onClickExport"
          :disabled="currentMode !== 'silent'">
          {{ $t('midiFilePerformer.export') }}
        </button>
      </div>

      <div v-if="isInputKeyboard">
        <span class="settings-toggle pseudo-link" @click="displayKeyboardSettings = !displayKeyboardSettings">
          {{ $t('midiFilePerformer.keyboardVelocity.' + (!displayKeyboardSettings ? 'display' : 'hide')) }}
        </span>
        <div v-if="displayKeyboardSettings">
          <div v-for="(velocity, category) in currentKeyboardVelocities" class="velocity-slider">
            <scroll-bar class="velocity-scroll"
              :hasBounds="false"
              :start="MIN_VELOCITY"
              :end="MAX_VELOCITY"
              :index="velocity"
              :size="MAX_VELOCITY+1"
              :indexLabel="$t('midiFilePerformer.velocitySliders.'+category)"
              @index="setRowVelocity($event, category)"
              @reset="setRowVelocity(defaultKeyboardVelocities[category], category)"
              />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mfp-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 500px;
}
.contextualization {
  color: #777;
  margin-bottom: 12px;
}
.contextualization p {
  margin-top: 4px;
  margin-bottom: 4px;
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
  margin: 0 0.25em 0.25em;
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
.index-scroll, .keyboard {
  display: inline-block;
  max-width: var(--score-width);
  width: 100%;
}
.velocity-slider {
  display: flex;
  flex-direction: column;
  padding-bottom: 12px;
}
.velocity-scroll {
  display: inline-block;
  width: var(--score-width);
}
.pseudo-link {
  font-style: italic;
  color: var(--hint-blue);
  text-decoration: underline;
  cursor: pointer;
}
.control-button-container {
  padding-bottom: 12px;
}
</style>

<script>
import { mapMutations, mapState } from 'vuex';
import IOManager from '../components/IOManager.vue';
import Keyboard from '../components/Keyboard.vue';
import ScrollBar from '../components/ScrollBar.vue';
import LoadingScreen from '../components/LoadingScreen.vue'

const noInputFileMsg = 'Aucun fichier sélectionné';

export default {
  inject: [ 'ioctl', 'performer', 'defaultMidiInput', 'defaultKeyboardVelocities', 'DEFAULT_IO_ID', 'NUMBER_OF_KEYS' ],
  components: { IOManager, Keyboard, ScrollBar, LoadingScreen },
  data() {
    return {
      fileName: noInputFileMsg,
      fileArrayBuffer: null,
      currentKeyboardVelocities: { ...this.ioctl.getCurrentVelocities() },
      isInputKeyboard: true,
      displayKeyboardSettings: false,
      MIN_VELOCITY: 0,
      MAX_VELOCITY: 127,
      MIDI_FILE_SIGNATURE: [..."MThd"].map(c => c.charCodeAt()),
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
      'synthNotesDecoded'
    ]),
    trimmedTitle() {
      return this.mfpMidiFile.title.length < 45 ?
        this.mfpMidiFile.title : this.mfpMidiFile.title.slice(0,40)+"... .mid"
    },
    displayLoadingScreen() {
      return (!localStorage.getItem('output') || localStorage.getItem('output') === this.DEFAULT_IO_ID)
        && this.synthNotesDecoded !== this.NUMBER_OF_KEYS
    },
    currentMode: {
      // Instead of putting guards here, we could use v-show to hide the scroll bar and not v-if,
      // But if we do that, we need the scroll-bar to get its bound rectangle after mounting
      // (Because an element hidden with v-show is mounted right away, even if hidden, so it would get 0 and never work)
      // This seems more legible to me.

      get() {
        return this.$refs.mainScrollBar ? this.$refs.mainScrollBar.currentMode : 'silent'
      },
      set(mode) {
        if(!!this.$refs.mainScrollBar) this.$refs.mainScrollBar.currentMode = mode
      }
    }
  },
  created() {
    document.addEventListener('keydown',this.onKeyDown)
  },
  async mounted() {
    console.log(this)
    this.performer.clear();
    this.$emit("canPerform",true)

    if (this.mfpMidiFile.buffer !== null) {
      console.log('buffer already full');
      await this.loadMfpMidiBuffer(this.mfpMidiFile.buffer);
    } else {
      console.log('wtf ? no buffer ?');
    }

  },
  beforeUnmount() {
    console.log("MFP unmount")
    this.$emit("canPerform",false)
    this.performer.setMode('silent');
    this.ioctl.allNotesOff()

    document.removeEventListener('keydown',this.onKeyDown)
  },
  methods: {
    ...mapMutations([
      'setMfpMidiFile',
    ]),
    async onFileInput(e) {

      // if e.target.files is defined, the user uploaded through the button
      // otherwise it's a drop event and we use the dataTransfer property
      const file = e.target.files ? e.target.files[0] : e.dataTransfer.files[0];

      // test based on initial characters "MThd" rather than file extension or MIME
      const testForMidiSignature = async (file) => {
        const matchesMidiSignature = (buffer) => {
          return buffer.every((byte, index) => byte === this.MIDI_FILE_SIGNATURE[index])
        }

        const signatureSlice = new Uint8Array(await file.slice(0,4).arrayBuffer())
        return matchesMidiSignature(signatureSlice)
      }

      const isFileSignatureMidi = await testForMidiSignature(file);
      if(!isFileSignatureMidi) return;

      this.fileName = file.name;

      const reader = new FileReader();
      reader.addEventListener('loadend', async readerEvent => {
        if (readerEvent.target.readyState === FileReader.DONE) {

          const mfpFile = {
            id: 'mfp',
            title: file.name,
            url: '',
            buffer: readerEvent.target.result,
          };

          this.setMfpMidiFile(mfpFile);
          await this.loadMfpMidiBuffer(mfpFile.buffer);
        }
      });

      reader.readAsArrayBuffer(file);
    },
    async loadMfpMidiBuffer(buffer) {
      this.currentMode = 'silent';
      this.performer.setMode(this.currentMode);
      await this.performer.loadArrayBuffer(buffer);
      this.performer.setSequenceIndex(0);
    },
    onModeChange(mode) {
      this.performer.setMode(mode);
    },
    onInputChange(input) {
      this.isInputKeyboard = (input === this.DEFAULT_IO_ID)
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
    setRowVelocity(i, category) {
      this.currentKeyboardVelocities[category] = i
      this.ioctl.refreshVelocities(this.currentKeyboardVelocities) // maybe we'd want to delegate this to the IOManager instead of injecting the ioctl here ?
    },
    async onDrop(e) {
      e.preventDefault()
      await this.onFileInput(e)
    },
    onDragOver(e) {
      e.preventDefault()
    },
    onKeyDown(e) {
      if(e.code === 'Space') {
        e.preventDefault()
        this.$refs.mainScrollBar.onClickListen()
      }
    }
  }
};
</script>
