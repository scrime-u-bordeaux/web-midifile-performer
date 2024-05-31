<template>

  <Settings
    ref="settings"
    @closed="onSettingsClosed"
  />

  <div class="mfp-and-loading-container">
    <LoadingScreen v-if="displayLoadingScreen" :genericCondition="loadingFlag"/>

    <!--Using v-if won't work because we need access to the elements.
    Using v-show won't work because it would make the width 0
    (and sheet music needs an actual width to render)-->

    <div class="mfp-container" :class="displayLoadingScreen ? 'hide' : 'show'"
      @dragover="onDragOver"
      @drop="onDrop">

      <span class="contextualization" v-if="!mfpMidiFile.buffer">
        <p>{{ $t('midiFilePerformer.contextualization.firstLine') }}</p>
        <p>{{ $t('midiFilePerformer.contextualization.secondLine') }}</p>
        <p>{{ $t('midiFilePerformer.contextualization.thirdLine') }}</p>
      </span>

      <div class="visualizer-selector" v-if="!mfpMidiFile.isMidi && !!mfpMidiFile.buffer">
        <img :src="`pics/piano_roll_icon_${
          pianoRollSelected ?
            (currentMode === 'silent' ?
              'enabled_silent' : 'enabled_play_perform'
            ) :
            'disabled'
          }.png`"
          @click="selectedVisualizer = 'piano'"/>
        <img :src="`pics/music_notes_icon_${
          sheetMusicSelected ?
            (currentMode === 'silent' ?
              'enabled_silent' : 'enabled_play_perform'
            ) :
            'disabled'
          }.png`"
          @click="selectedVisualizer = 'sheet'"/>
      </div>

      <SheetMusic
        class="sheet-music"
        :class="!mfpMidiFile.isMidi && mfpMidiFile.buffer && sheetMusicSelected ? 'show' : 'hide'"
        ref="sheetMusic"
        @play="onVisualizerPlay"
        @stop="onVisualizerStop"
        @index="onIndexChange"
        @start="onStartChange"
        @end="onEndChange"
      />

      <PianoRoll
        class="piano-roll"
        :class="mfpMidiFile.buffer && pianoRollSelected ? 'show' : 'hide'"
        ref="pianoRoll"
        @play="onVisualizerPlay"
        @stop="onVisualizerStop"
        @index="onIndexChange"
        @start="onStartChange"
        @end="onEndChange"/>

      <Keyboard
        ref="keyboard"
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
        @end="onEndChange"
        @speed="onSpeedChange"
        @silence="onSilence"/>

      <div class="file-and-control">
        <div class="file-input-wrapper">
          <div class="file-input" :class="!mfpMidiFile.buffer ? 'align-column' : ''">
            <input accept=".mid, .midi, .musicxml, .xml, .mxl" type="file" id="file" class="file" @change="onFileInput" @click="() => { this.value = null; }"/>
            <label for="file" class="file-label">
              {{ $t('midiFilePerformer.upload.' + (!mfpMidiFile.buffer ? 'first' : 'change')) }}
            </label>
            <div class="file-name-container" v-if="mfpMidiFile.buffer">
              <div class="file-name" :title="mfpMidiFile.title">{{ trimmedTitle }}</div>
              <span class="search-score-hint link" @click="$router.push('/look-for-scores')">
                {{ $t('midiFilePerformer.noScores.standalone') }}
              </span>
            </div>
            <div class="search-score-hint" v-else>
              {{ $t('midiFilePerformer.noScores.message') }}
              <span class="link" @click="$router.push('/look-for-scores')">
                {{ $t('midiFilePerformer.noScores.link') }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="mfpMidiFile.buffer">
          <div class="control-button-container">

            <button
              @click="$router.push('/guide')">
              {{ $t("midiFilePerformer.help") }}
            </button>

            <button
              @click="openSettings">
              {{ $t('midiFilePerformer.settings') }}
            </button>

            <button
              style="display: none;"
              @click="onClickExport"
              :disabled="currentMode !== 'silent'">
              {{ $t('midiFilePerformer.export') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mfp-and-loading-container {
  display: flex;
  justify-content: center;
  align-content: center;
  text-align: center;
}
.mfp-container {
  position: absolute;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 500px;
}
.mfp-container.hide {
  z-index: -100;
  opacity: 0;
}
.mfp-container.show {
  z-index: auto;
  opacity: 1;
}
.contextualization {
  color: #777;
  margin-bottom: 12px;
}
.contextualization p {
  margin-top: 4px;
  margin-bottom: 4px;
}
.visualizer-selector {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1em;
}
.visualizer-selector img {
  width: 5%;
  height: 5%;
  cursor: pointer;
}
.file-and-control {
  display: flex;
  align-items: center;
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
.file-name-container {
  margin-bottom: 0.25em;
  padding: 0.5em 1em;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
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
  width: 100%;
}
.piano-roll, .sheet-music {
  height: 70vh; /* Dev approximation, adjust with feedback */
}
.piano-roll.hide, .sheet-music.hide {
  position: absolute;
  top: 0;
  left: 0;
  z-index: -100;
  opacity: 0;
}
.keyboard {
  max-width: var(--score-width);
}
.pseudo-link {
  font-style: italic;
  color: var(--hint-blue);
  text-decoration: underline;
  cursor: pointer;
}
.control-button-container {
  padding-bottom: 12px;
  display: flex;
}
</style>

<script>
import { nextTick } from 'vue';
import { mapMutations, mapState } from 'vuex';
import Keyboard from '../components/Keyboard.vue';
import ScrollBar from '../components/ScrollBar.vue';
import LoadingScreen from '../components/LoadingScreen.vue'
import PianoRoll from '../components/PianoRoll.vue'
import SheetMusic from '../components/SheetMusic.vue'
import Settings from '../components/Settings.vue'

const isEqual = require('lodash.isequal')

const noInputFileMsg = 'Aucun fichier sélectionné';

export default {
  inject: [ 'ioctl', 'performer', 'parseMusicXml', 'getRootFileFromMxl', 'defaultMidiInput', 'defaultKeyboardVelocities', 'DEFAULT_IO_ID', 'NUMBER_OF_KEYS', 'NUMBER_OF_SOUNDFILES' ],
  components: { Keyboard, ScrollBar, LoadingScreen, PianoRoll, SheetMusic, Settings },
  data() {
    return {
      selectedVisualizer: null, // computed properties cannot be accessed in data
      loadingFlag: false,
      fileArrayBuffer: null,
      spacePressed: false,
      pauseWithRelease: false,
      MIDI_FILE_SIGNATURE: [..."MThd"].map(c => c.charCodeAt()),
    };
  },
  computed: {
    ...mapState([
      'mfpMidiFile',
      'performerConstructorOptions',
      'minKeyboardNote',
      'maxKeyboardNote',
      'keyboardState',
      'looping',
      'sequenceStart',
      'sequenceEnd',
      'sequenceIndex',
      'sequenceLength',
      'currentOutputId',
      'synthNotesDecoded',
      'preferredVisualizer',
      'preferredVelocityStrategy',
      'conserveVelocity'
    ]),
    pianoRollSelected() {
      return this.selectedVisualizer === "piano"
    },
    sheetMusicSelected() {
      return this.selectedVisualizer === "sheet"
    },
    trimmedTitle() {
      return this.mfpMidiFile.title.replace(this.fileExtension, '').length < 45 ?
        this.mfpMidiFile.title : this.mfpMidiFile.title.slice(0,45)
        + " ... "
        + this.fileExtension
    },
    fileExtension() {
      return '.' + this.getFileExtension(this.mfpMidiFile.title)
    },
    displayLoadingScreen() {
      return (
        this.currentOutputId === this.DEFAULT_IO_ID &&
        this.synthNotesDecoded !== this.NUMBER_OF_SOUNDFILES
      )
      || this.loadingFlag
    },
    // TODO : we should work towards deprecating mode state duplication.
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
  watch: {

    async performerConstructorOptions(newOptions, oldOptions) {
      if(isEqual(newOptions, oldOptions)) return // necessary because these are objects,
      // so this listener *will* fire every time settings are applied.

      this.performer.constructInnerPerformer(newOptions)
      if(!!this.mfpMidiFile.buffer) { // Should normally always be the case in this listener.
        // (Because it means we modified the settings, and they're inaccessible without loading a file)
        // (...for now.)
        this.loadingFlag = true;
        this.preparePerformerForLoad()
        await this.performer.loadMidifile(this.mfpMidiFile.buffer, this.mfpMidiFile.isMidi);
        this.loadingFlag = false;
      }
    },

    preferredVelocityStrategy(newStrategy, oldStrategy) {
      this.performer.setPreferredVelocityStrategy(newStrategy)
    },

    conserveVelocity(newVal, oldVal) {
      this.performer.setConserveVelocity(newVal)
    },

    mfpMidiFile(newFile, oldFile) {
      this.setDesiredVisualizer()
    },

    looping(newVal, oldVal) {
      this.performer.setLooping(newVal)
    }
  },
  created() {
    document.addEventListener('keydown',this.onKeyDown)
    document.addEventListener('keyup',this.onKeyUp)

    this.performer.setLooping(this.looping)
    // This will override the performer created by index.js.
    this.performer.constructInnerPerformer(this.performerConstructorOptions)
    this.performer.setPreferredVelocityStrategy(this.preferredVelocityStrategy)
    this.performer.setConserveVelocity(this.conserveVelocity)
  },
  async mounted() {
    this.performer.clear();

    this.performer.addListener('chronology', this.onChronology)
    this.performer.addListener('musicXmlTempos', this.onMusicXmlTempos)
    this.performer.addListener('musicXmlChannels', this.onMusicXmlChannels)
    this.performer.addListener('visualizerRefresh', this.onVisualizerRefresh)
    this.performer.addListener('userChangedIndex', this.onIndexJump)
    // temporary !!
    // TODO : phase out with unification of mode state into store
    this.performer.addListener('isModeSilent', this.onIsModeSilent)

    if (this.mfpMidiFile.buffer !== null) {
      console.log('buffer already full');
      this.loadingFlag = true;
      await this.performer.loadMidifile(this.mfpMidiFile.buffer, this.mfpMidiFile.isMidi);
      this.loadingFlag = false;
    } else {
      console.log('no buffer yet');
    }

    // FIXME : delegate speed to the store so it reacts...
    // ...or rather, integrate v-model to the scroll-bar !!
    this.$refs.mainScrollBar?.resetSpeedDisplay();

    // Watchers are not called on mount
    // And we can't do this on create, because otherwise, remounting the page never sets this again
    // (and so no visualizer is displayed)
    this.setDesiredVisualizer()

    this.$emit("canPerform", true)
  },
  beforeUnmount() {
    this.$emit("canPerform",false)
    this.performer.setMode('silent');
    this.ioctl.allNotesOff()

    document.removeEventListener('keydown',this.onKeyDown)
    document.removeEventListener('keyup',this.onKeyUp)

    this.performer.removeListener('chronology', this.onChronology)
    this.performer.removeListener('musicXmlTempos', this.onMusicXmlTempos)
    this.performer.removeListener('musicXmlChannels', this.onMusicXmlChannels)
    this.performer.removeListener('visualizerRefresh', this.onVisualizerRefresh)
    this.performer.removeListener('userChangedIndex', this.onIndexJump)
    this.performer.removeListener('isModeSilent', this.onIsModeSilent)
  },
  methods: {
    ...mapMutations([
      'setMfpMidiFile',
    ]),

    // -------------------------------------------------------------------------
    // -------------------------FILE INPUT LOGIC--------------------------------
    // -------------------------------------------------------------------------

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

      // Sadly, there seems to be no signature for musicxml files.
      // Even MuseScore relies on extension, and so I will too.

      const testForMusicXml = (file) => {
        const extension = this.getFileExtension(file.name)
        return {
          isMusicXml: ["xml", "musicxml", "mxl"].includes(extension),
          isCompressed: extension === "mxl"
        }
      }

      const isFileSignatureMidi = await testForMidiSignature(file);
      const isFileMusicXml = testForMusicXml(file);
      if(!(isFileSignatureMidi || isFileMusicXml.isMusicXml)) return;

      // Begin displaying loading screen immediately, not on loadMfpMidiFile.
      // MusicXML file parsing also needs to be covered by the loading screen.
      this.loadingFlag = true;
      await nextTick();

      this.preparePerformerForLoad()

      const fileContents = await (
        isFileSignatureMidi ? file.arrayBuffer() :
        isFileMusicXml.isCompressed ?
          this.getRootFileFromMxl(file) :
          file.text()
      )

      const mfpFile = {
        id: 'mfp',
        title: file.name,
        url: '',
        isMidi: isFileSignatureMidi,
        musicXmlString: isFileSignatureMidi ? '' : fileContents,
        buffer: isFileSignatureMidi ? fileContents : this.musicXmlToMidi(fileContents)
      };

      this.setMfpMidiFile(mfpFile);
      await this.performer.loadMidifile(mfpFile.buffer, isFileSignatureMidi);

      this.loadingFlag = false;
    },

    musicXmlToMidi(xmlString) {
      try {
        return this.parseMusicXml(xmlString)
      } catch(e) {
        this.loadingFlag = false;
        throw new Error("MusicXML parsing failed", {cause: e});
      }
    },

    // -------------------------------------------------------------------------
    // --------------------------EVENT HANDLERS---------------------------------
    // -------------------------------------------------------------------------

    onModeChange(mode) {
      this.performer.setMode(mode);
      if(mode === 'silent') {
        this.$refs.pianoRoll.stop()
        this.$refs.sheetMusic.stop()
      }
    },
    onChronology(chronology) {
      this.$refs.pianoRoll.updateNoteSequence(chronology)
    },
    onMusicXmlTempos(tempoEvents) {
      this.$refs.sheetMusic.setTempoEvents(tempoEvents)
    },
    onMusicXmlChannels(channelChanges) {
      this.$refs.sheetMusic.setChannelChanges(channelChanges)
    },

    onStartChange(i) {
      this.performer.setSequenceBounds(i, this.sequenceEnd);
    },
    onIndexChange(i) {
      // scrollbar callback, i is chordSequence index
      // do something with it like display a cursor at the right position
      console.log('new index : ' + i);
      this.performer.setSequenceIndex(i);
      this.$refs.pianoRoll.stop()
      this.$refs.sheetMusic.stop()
    },
    onIndexJump(i) { // let piano roll react when index is moved using setSequenceIndex
      this.$refs.pianoRoll.onIndexJump(i)
      if(!this.mfpMidiFile.isMidi) this.$refs.sheetMusic.onIndexJump(i)
    },
    onEndChange(i) {
      this.performer.setSequenceBounds(this.sequenceStart, i);
    },

    onSpeedChange(s) {
      this.performer.setPlaybackSpeed(s);
    },

    onSilence() {
      if (this.performer.mode === 'listen') this.$refs.mainScrollBar.toggleListen() // keep scrollbar state consistent if listen mode
      else this.performer.setMode('silent') // simply silence if perform mode
      this.$refs.pianoRoll.stop()
      this.$refs.sheetMusic.stop()
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
        if(!this.spacePressed) {   // TODO : maybe use the built-in repeat property instead, not sure why I did not originally
          this.spacePressed = true;
          this.$refs.mainScrollBar.toggleListen()
        } else {
          this.pauseWithRelease = true;
        }
      }
    },
    onKeyUp(e) {
      if(e.code === 'Space' && this.spacePressed) {
        this.spacePressed = false;
        if(this.pauseWithRelease) {
          this.pauseWithRelease = false;
          if(this.performer.mode === 'listen') this.$refs.mainScrollBar.toggleListen()
        }
      }
    },

    onIsModeSilent(isIt) {
      this.$refs.keyboard.isModeSilent = isIt

      this.$refs.pianoRoll.onIsModeSilent(isIt)
      this.$refs.sheetMusic.onIsModeSilent(isIt)

      // This whole charade is necessary solely because the mode isn't unified.
      // If it were, all components would read from store and instantly know it changed,
      // Even if the change came from downwards up (i.e. : MFP.js set itself to silent, because loopEnd was reached with loop off)
      // But it's not unified. So we have to pass that information all the way through.

      this.$refs.pianoRoll.stop()
      this.$refs.sheetMusic.stop()

      if(isIt && this.$refs.mainScrollBar?.currentMode === 'listen')
        this.$refs.mainScrollBar.toggleListen()
    },
    onVisualizerRefresh(refreshState) {
      this.$refs.pianoRoll.refresh(refreshState.referenceSetIndex)
      if(!this.mfpMidiFile.isMidi) this.$refs.sheetMusic.refresh(refreshState.referenceSetIndex, refreshState.isStartingSet)
    },
    onVisualizerPlay(notes) { // piano roll requests hearing the sound of the notes the user clicked
      this.ioctl.playNoteEvents(notes)
    },
    onVisualizerStop() {
      this.ioctl.allNotesOff()
    },

    openSettings() {
      this.$refs.settings.open()
      this.$emit("canPerform", false)
    },
    onSettingsClosed() {
      this.$emit("canPerform", true)
    },

    // -------------------------------------------------------------------------
    // -------------------------------MISC--------------------------------------
    // -------------------------------------------------------------------------

    setDesiredVisualizer() {
      if(this.mfpMidiFile.isMidi) this.selectedVisualizer = "piano"
      else this.selectedVisualizer = this.preferredVisualizer
    },

    preparePerformerForLoad() {
      this.currentMode = 'silent';
      // FIXME : delegate mode to store
      this.performer.setMode(this.currentMode);
      this.performer.setPlaybackSpeed(1)
      this.performer.setSequenceIndex(0);
    },

    getFileExtension(fileName) {
      return fileName.split('.').pop().toLowerCase()
    }
  }
};
</script>
