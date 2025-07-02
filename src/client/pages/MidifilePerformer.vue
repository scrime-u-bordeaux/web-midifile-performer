<template>

  <Settings
    ref="settings"
    @closed="onSettingsClosed"
  />

  <div class="mfp-and-loading-container">
    <LoadingScreen class="loading-screen" v-if="displayLoadingScreen" :genericCondition="loadingFlag"/>

    <!--Using v-if won't work because we need access to the elements.
    Using v-show won't work because it would make the width 0
    (and sheet music needs an actual width to render)-->

    <ChannelManager
        ref="channelManager"
        class="channel-manager"
        v-if="!!mfpMidiFile.buffer"

        @noUpdateTriggers='noUpdateTriggers = true'
        @updateTriggers='noUpdateTriggers = false'
      />
    <div
      class="mfp-and-controls"
      :class="[
        displayLoadingScreen ? 'hide' : 'show',
        mfpMidiFile.buffer ? 'with-channels' : '',
        !!$refs.channelManager && $refs.channelManager.velocitiesDisplayed ? 'side-view' : 'normal-view'
      ]">

      <div class="mfp-container" :class="mfpMidiFile.isMidi ? 'midi' : 'musicxml'"
        @dragover="onDragOver"
        @drop="onDrop">

        <div class="contextualization tooltip" v-if="true || !mfpMidiFile.buffer">
          <span>
            <p>{{ $t('midiFilePerformer.contextualization.firstLine') }}</p>
            <p>{{ $t('midiFilePerformer.contextualization.secondLine') }}</p>
            <p>{{ $t('midiFilePerformer.contextualization.thirdLine') }}</p>
          </span>
          <span class="tooltiptext">utilisez les 4 rangées de touches alphanumériques de votre clavier d'ordinateur</span>
        </div>

        <div class="corpora-navigation">
          <div class="corpora-selectors">
            <select id="corpus-selector" ref="corpus-selector" @change="onCorpusChanged">
              <option v-for="corpus in Object.keys(corpora)" :value="corpus">
                {{ corpus }}
              </option>
            </select>
            <select ref="piece-selector">
              <option v-for="piece in corpora[selectedCorpus]" :value="piece.name">
                {{ piece.name }}
              </option>
            </select>
          </div>
          <div class="corpora-buttons">
            <button
              @click="loadSelectedPiece">
              <!-- @click="$router.push('/guide')"> -->
              <!-- {{ $t("midiFilePerformer.help") }} -->
              Charger
            </button>            
          </div>
        </div>

        <div v-if="!!mfpMidiFile.buffer && mfpMidiFile.isMidi"
          class="file-name"
          :title="mfpMidiFile.title"
        >
          {{ trimmedTitle }}
        </div>

        <div class="visualizer-selector" v-if="!mfpMidiFile.isMidi && !!mfpMidiFile.buffer">
          <PianoRollBtn
            class="icon piano-roll"
            style="width: 25px; height: auto; cursor: pointer;"
            :silent="isModeSilent"
            :enabled="pianoRollSelected"
            @click="selectedVisualizer = 'piano'"/>

          <div class="file-name" :title="mfpMidiFile.title">{{ trimmedTitle }}</div>

          <SheetMusicBtn
            class="icon sheet-music"
            style="width: 40px; height: auto; cursor: pointer;"
            :silent="isModeSilent"
            :enabled="sheetMusicSelected"
            @click="selectedVisualizer = 'sheet'"/>
        </div>

        <SheetMusic
          class="sheet-music"
          :class="!mfpMidiFile.isMidi && mfpMidiFile.buffer && sheetMusicSelected ? 'show' : 'hide'"
          ref="sheetMusic"
          @drawn="loadingFlag = false"
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
          @end="onEndChange"
        />
      </div>

      <div class="mfp-bottom-controls">
        <Keyboard
          ref="keyboard"
          class="keyboard"
          :whiteNoteWidth="15"/>

        <scroll-bar
          ref="mainScrollBar"
          v-if="mfpMidiFile.buffer"
          class="index-scroll"
          :has-bounds="true"
          :start="sequenceStart"
          :end="sequenceEnd"
          :index="sequenceIndex"
          :speed="playbackSpeed"
          :size="sequenceLength"
          @toggleListen="onToggleListen"
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
              <div class="search-score-hint" v-if="!mfpMidiFile.buffer">
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
                :disabled="isModeSilent">
                {{ $t('midiFilePerformer.export') }}
              </button>
            </div>
          </div>
        </div>

        <div v-if="!!mfpMidiFile.buffer" class="search-score-hint link" @click="$router.push('/look-for-scores')">
          {{ $t('midiFilePerformer.noScores.standalone') }}
        </div>
      </div>
    </div>
    
    <PerformGranularity
        v-show="!mfpMidiFile.isMidi"
        ref="performGranularity"
        class="perform-granularity"
        :modelValue="musicXmlGranularity"
        @update:modelValue="changeMusicXmlGranularity"
      />
  </div>
</template>

<style scoped>
.loading-screen {
  position: absolute;
  width: 100%;
}

.mfp-and-loading-container {
  /* position: absolute; */
  /* left: 0; */
  /* right: 0; */
  position: relative;
  display: flex;
  justify-content: center;
  /* align-content: center; */
  text-align: center;
  align-items: stretch;
  flex-grow: 1;
  overflow: hidden;
  margin-top: -15px;
}

.mfp-and-controls {
  width: 100%;
  display: flex;
  justify-content: center;
  flex-direction: column;
}

/*
.mfp-and-controls.with-channels.side-view {
  display: grid;
  grid-template-columns: 47% 53%;
  
}
.mfp-and-controls.with-channels.normal-view {
  width: 100%;
  display: flex;
  justify-content: center;
}
.mfp-and-controls.with-channels.normal-view .channel-manager {
  margin-left: 3em;
  width: 20vw;
}
.mfp-and-controls.with-channels.normal-view .mfp-container {
  margin-left: 2.5em;
}
*/

.mfp-container {
  /* position: relative; */
  /* left: 0; */
  /* right: 0; */
  /* top: 0;
  /* bottom: 0; */
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  /* min-height: 500px; */
  /* max-height: 60vh; */
  overflow: auto;
  flex-grow: 1;
}

.corpora-navigation {
  display: flex;
  flex-direction: row;
}

.corpora-selectors {
  display: flex;
  flex-direction: column;
}

#corpus-selector {
  margin-bottom: .25em;
}

.corpora-buttons {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.mfp-bottom-controls {
  margin: 0 auto;
}

.mfp-and-controls.hide {
  z-index: -100;
  opacity: 0;
}
.mfp-container.show {
  z-index: auto;
  opacity: 1;
}
.contextualization {
  color: #777;
  margin-top: 1em;
  margin-bottom: 2em;
}
.contextualization p {
  margin-top: 4px;
  margin-bottom: 4px;
}
.visualizer-selector {
  width: var(--score-width);
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1em;
}
.visualizer-selector img {
  width: 30px;
  height: 30px;
  cursor: pointer;
}

.icon.piano-roll.disabled {
  content: url('../assets/pics/piano_roll_icon_disabled.png')
}

.icon.piano-roll.enabled.silent, .icon.piano-roll.disabled.silent:hover {
  content: url('../assets/pics/piano_roll_icon_enabled_silent.png')
}

.icon.piano-roll.enabled.play-perform, .icon.piano-roll.disabled.play-perform:hover {
  content: url('../assets/pics/piano_roll_icon_enabled_play_perform.png')
}

.icon.sheet-music.disabled {
  content: url('../assets/pics/music_notes_icon_disabled.png')
}

.icon.sheet-music.enabled.silent, .icon.sheet-music.disabled.silent:hover {
  content: url('../assets/pics/music_notes_icon_enabled_silent.png')
}

.icon.sheet-music.enabled.play-perform, .icon.sheet-music.disabled.play-perform:hover  {
  content: url('../assets/pics/music_notes_icon_enabled_play_perform.png')
}

.file-and-control {
  margin-top: 8px;
  display: flex;
  justify-content: center;
}
.file-input-wrapper {
  width: fit-content;
  /* margin: 0 auto; */
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
  height: fit-content;
  display: inline-block;
  color: #777;
  font-style: italic;
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
.link {
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
  max-width: var(--controls-width);
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
/*
.perform-granularity {
  width: 26vw;
}
*/
</style>

<script>
import { nextTick } from 'vue';
import { mapMutations, mapGetters, mapState } from 'vuex';
import Keyboard from '../components/Keyboard.vue';
import ScrollBar from '../components/ScrollBar.vue';
import ChannelManager from '../components/ChannelManager.vue';
import PerformGranularity from '../components/PerformGranularity.vue';
import LoadingScreen from '../components/LoadingScreen.vue';
import SheetMusicBtn from '../components/SheetMusicBtn.vue';
import SheetMusic from '../components/SheetMusic.vue';
import PianoRollBtn from '../components/PianoRollBtn.vue';
import PianoRoll from '../components/PianoRoll.vue';
import Settings from '../components/Settings.vue';

// const isEqual = require('lodash.isequal');
import isEqual from 'lodash/isEqual';

const MIDI_FILE_SIGNATURE = [..."MThd"].map(c => c.charCodeAt())

export default {
  inject: [
    'ioctl',
    'performer',
    'parseMusicXml',
    'getRootFileFromMxl',
    'defaultMidiInput',
    'defaultKeyboardVelocities',
    'DEFAULT_IO_ID',
    'NUMBER_OF_KEYS',
    'NUMBER_OF_SOUNDFILES'
  ],
  components: {
    Keyboard,
    ScrollBar,
    ChannelManager,
    PerformGranularity,
    LoadingScreen,
    SheetMusicBtn,
    SheetMusic,
    PianoRollBtn,
    PianoRoll,
    Settings
  },
  data() {
    return {
      selectedVisualizer: null, // computed properties cannot be accessed in data
      loadingFlag: false,
      fileArrayBuffer: null,
      spacePressed: false,
      pauseWithRelease: false,

      musicXmlGranularity: 'all',
      noUpdateTriggers: false,
      corpora: {},
      selectedCorpus: undefined,
    };
  },
  computed: {
    ...mapState([
      'mfpMidiFile',
      'currentChannelControls',
      'performerConstructorOptions',
      'looping',
      'sequenceStart',
      'sequenceEnd',
      'sequenceIndex',
      'sequenceLength',
      'playbackSpeed',
      'currentOutputId',
      'synthNotesDecoded',
      'preferredVisualizer',
      'preferredVelocityStrategy',
      'conserveVelocity'
    ]),

    ...mapGetters([
      'isModeSilent'
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
    }
  },
  watch: {
    currentChannelControls(newControls, oldControls) {
      if(isEqual(newControls, oldControls)) return // necessary because these are objects,
      // so this listener *will* fire every time settings are applied.

      if(!this.noUpdateTriggers) this.updatePlaybackTriggers()
    },

    async performerConstructorOptions(newOptions, oldOptions) {
      if(isEqual(newOptions, oldOptions)) return // same as above

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
    this.preloadAllImages()
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

    this.performer.addListener('mode', this.setCurrentMode)

    this.performer.addListener('noteSequenceInfo', this.onNoteSequenceInfo)

    this.performer.addListener('musicXmlTempos', this.onMusicXmlTempos)
    this.performer.addListener('musicXmlChannels', this.onMusicXmlChannels)
    this.performer.addListener('musicXmlGraceNoteInfo', this.onMusicXmlGraceNoteInfo)
    this.performer.addListener('musicXmlArpeggioInfo', this.onMusicXmlArpeggioInfo)

    this.performer.addListener('visualizerRefresh', this.onVisualizerRefresh)
    this.performer.addListener('updateVisualizerIndex', this.onIndexJump)

    this.performer.addListener('autoplay', this.setAutoplay)
    this.performer.addListener('playbackTriggers', this.setPlaybackTriggers)
    this.performer.addListener('enablePerformChoice', this.reenablePerformChoice)
    this.performer.addListener('disableMeasurePlay', this.onIsMeasurePlayDisabled)
    this.performer.addListener('disableBeatPlay', this.onIsBeatPlayDisabled)

    const res2 = await fetch('corpora');
    const blob2 = await res2.blob();
    const json = await blob2.text();
    // this.$nextTick(() => {
      this.corpora = JSON.parse(json);
      // const corpsel = this.$refs['corpus-selector'];
      // corpsel.selectedIndex = 0;
      this.$refs['corpus-selector'].selectedIndex = 0;
      // corpsel.value = corpsel.options[0].value;
      await nextTick();
      this.onCorpusChanged();
      // console.log('MOUNTING !!!!!!!!!!!!!!!!!!!!!!!!!!!');
    // })

    // this code loads latest file on tab change
    if (this.mfpMidiFile.buffer !== null) {
      console.log('buffer already full');
      this.loadingFlag = true;
      await this.performer.loadMidifile(this.mfpMidiFile.buffer, this.mfpMidiFile.isMidi);
      this.setDesiredVisualizer();
      this.loadingFlag = false;
    } else {
      console.log('no buffer yet');
      this.loadingFlag = true;
      // load default mxl prelude in C (kinf of new integrated first steps page)
      const res = await fetch('mxl/Prelude_I_in_C_major_BWV_846_-_Well_Tempered_Clavier_First_Book.mxl');
      const blob = await res.blob();
      blob.name = 'Prelude_I_in_C_major_BWV_846_-_Well_Tempered_Clavier_First_Book.mxl';
      await this.loadFile(blob);
      this.setAppropriateVisualizer();
      this.loadingFlag = false;
    }

    this.$emit("canPerform", true)
  },
  beforeUnmount() {
    this.$emit("canPerform",false)
    this.performer.setMode('silent');
    this.ioctl.allNotesOff()

    document.removeEventListener('keydown',this.onKeyDown)
    document.removeEventListener('keyup',this.onKeyUp)

    this.performer.removeListener('noteSequenceInfo', this.onNoteSequenceInfo)

    this.performer.removeListener('musicXmlTempos', this.onMusicXmlTempos)
    this.performer.removeListener('musicXmlChannels', this.onMusicXmlChannels)
    this.performer.removeListener('musicXmlGraceNoteInfo', this.onMusicXmlGraceNoteInfo)
    this.performer.removeListener('musicXmlArpeggioInfo', this.onMusicXmlArpeggioInfo)

    this.performer.removeListener('visualizerRefresh', this.onVisualizerRefresh)
    this.performer.removeListener('updateVisualizerIndex', this.onIndexJump)

    this.performer.removeListener('autoplay', this.setAutoplay)
    this.performer.removeListener('playbackTriggers', this.setPlaybackTriggers)
    this.performer.removeListener('enablePerformChoice', this.reenablePerformChoice)
    this.performer.removeListener('disableMeasurePlay', this.onIsMeasurePlayDisabled)
    this.performer.removeListener('disableBeatPlay', this.onIsBeatPlayDisabled)
  },
  methods: {
    ...mapMutations([
      'setMfpMidiFile',
      'setCurrentMode',
      'setNoteSequence',
      'setSetStarts',
      'setSetEnds',

      'setAutoplay',
      'setPlaybackTriggers',

      'resetChannelControls'
    ]),

    // -------------------------------------------------------------------------
    // -------------------------FILE INPUT LOGIC--------------------------------
    // -------------------------------------------------------------------------

    async onFileInput(e) {

      // if e.target.files is defined, the user uploaded through the button
      // otherwise it's a drop event and we use the dataTransfer property
      const file = e.target.files ? e.target.files[0] : e.dataTransfer.files[0];
      await this.loadFile(file);
    },
    async loadFile(file) {
      // test based on initial characters "MThd" rather than file extension or MIME
      const testForMidiSignature = async (file) => {
        const matchesMidiSignature = (buffer) => {
          return buffer.every((byte, index) => byte === MIDI_FILE_SIGNATURE[index])
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

      this.resetChannelControls()

      // Otherwise wait for the SheetMusic to finish rendering
      if(mfpFile.isMidi) this.loadingFlag = false;
      // (no, await'ing this.$refs.sheetMusic.updateScore() here instead of doing it in a watcher
      // will not work ; I tried.)
    },

    musicXmlToMidi(xmlString) {
      try {
        return this.parseMusicXml(xmlString)
      } catch(e) {
        this.loadingFlag = false;
        throw new Error("MusicXML parsing failed", {cause: e});
      }
    },

    async loadSelectedPiece() {
      const corpus = this.$refs['corpus-selector'].value;
      const piece = this.$refs['piece-selector'].value;

      this.loadingFlag = true;
      const res = await fetch(`corpora/${corpus}/${piece}`);
      const blob = await res.blob();
      blob.name = piece;
      await this.loadFile(blob);
      this.setAppropriateVisualizer();
      this.loadingFlag = false;
    },

    // -------------------------------------------------------------------------
    // --------------------------EVENT HANDLERS---------------------------------
    // -------------------------------------------------------------------------

    onCorpusChanged() {
      const select = this.$refs['corpus-selector'];
      console.log(select);
      const corpus = select.value || select.options[select.selectedIndex].value;
      this.$refs['piece-selector'].selectedIndex = 0;
      this.selectedCorpus = corpus;
    },

    onToggleListen() {
      this.performer.toggleListen()
    },

    onNoteSequenceInfo({noteSequence, setStarts, setEnds}) {
      this.setNoteSequence(noteSequence)
      this.setSetStarts(setStarts)
      this.setSetEnds(setEnds)
    },

    onMusicXmlTempos(tempoEvents) {
      this.$refs.sheetMusic.setTempoEvents(tempoEvents)
    },
    onMusicXmlChannels(channelChanges) {
      this.$refs.sheetMusic.setChannelChanges(channelChanges)
    },
    onMusicXmlGraceNoteInfo(graceNoteInfo) {
      this.$refs.sheetMusic.setGraceNoteInfo(graceNoteInfo)
    },
    onMusicXmlArpeggioInfo(arpeggioInfo) {
      this.$refs.sheetMusic.setArpeggioInfo(arpeggioInfo)
    },

    onStartChange(i) {
      this.performer.setSequenceBounds(i, this.sequenceEnd);
    },
    onIndexChange(i) {
      // scrollbar callback, i is chordSequence index
      // do something with it like display a cursor at the right position
      console.log('new index : ' + i);
      this.performer.markIndexJump()
      this.performer.setSequenceIndex(i, true, true);

      this.$refs.pianoRoll.stop()
      this.$refs.sheetMusic.stop()
    },
    onIndexJump({index, fromUser}) { // let piano roll react when index is moved using setSequenceIndex
      this.$refs.pianoRoll.onIndexJump({index, fromUser})
      if(!this.mfpMidiFile.isMidi) this.$refs.sheetMusic.onIndexJump({index, fromUser})
    },
    onEndChange(i) {
      this.performer.setSequenceBounds(this.sequenceStart, i);
    },

    onSpeedChange(s) {
      this.performer.setPlaybackSpeed(s);
    },

    onSilence() {
      this.performer.setMode('silent')
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

    onIsMeasurePlayDisabled(isIt) {
      this.$refs.performGranularity.updateIsMeasurePlayDisabled(isIt)
    },

    onIsBeatPlayDisabled(isIt) {
      this.$refs.performGranularity.updateIsBeatPlayDisabled(isIt)

      // Tell OSMD not to draw time signatures if the file has none,
      // Because it would give it a 4/4 time signature by default :
      // See OSMD issue 1574 :
      // https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/issues/1574
      this.$refs.sheetMusic.updateHideTimeSignatures(isIt)
    },

    // -------------------------------------------------------------------------
    // -------------------------------MISC--------------------------------------
    // -------------------------------------------------------------------------

    // FIXME : this has been confirmed not to work in prod.
    // Although tested browsers do report the resources as cached,
    // They fetch them again when it's time to display them.
    // We need another solution.

    preloadAllImages() {
      /*
      const keys = require.context('../assets/pics/', false, /\.png$/).keys()

      // Separate each request by a delay
      // so we minimize changes of them being denied.
      function preloadImageRecursive(imageIndex) {
        if(imageIndex > keys.length - 1) return

        const img = new Image()
        img.src = keys[imageIndex]

        setTimeout(
          () => preloadImageRecursive(imageIndex+1),
          200
        )
      }
      
      preloadImageRecursive(0)
      */
    },

    setAppropriateVisualizer() {
      this.selectedVisualizer = this.mfpMidiFile.isMidi ? 'piano' : 'sheet';
    },

    setDesiredVisualizer() {
      if(this.mfpMidiFile.isMidi) this.selectedVisualizer = "piano"
      else this.selectedVisualizer = this.preferredVisualizer
    },

    preparePerformerForLoad() {
      this.performer.setMode('silent');
      this.performer.setPlaybackSpeed(1)
      this.performer.setSequenceIndex(0, true, true);
    },

    updatePlaybackTriggers() {
      this.performer.updatePlaybackTriggers({
        triggerType: "channels",
        triggerCriteria: new Set(
          this.currentChannelControls.channelPerformed.map(
            (isPerformed, index) => isPerformed ? index+1 : null
          ).filter(
            indexOrNull => indexOrNull !== null
          )
        )
      })
    },

    changeMusicXmlGranularity(granularity) {
      this.musicXmlGranularity = granularity

      this.performer.updatePlaybackTriggers({
        triggerType: "tempo",
        triggerCriteria: granularity
      })

      if(granularity !== 'all') this.$refs.channelManager.disablePerformChoice()
      else this.$refs.channelManager.enablePerformChoice()
    },

    // Most notably called when a MIDI is loaded in after a MusicXML.

    reenablePerformChoice() {
      this.musicXmlGranularity = 'all'
      this.$refs.channelManager.enablePerformChoice()
    },

    getFileExtension(fileName) {
      return fileName.split('.').pop().toLowerCase()
    }
  }
};
</script>
