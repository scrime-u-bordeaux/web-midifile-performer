import { toRaw } from 'vue'
import { createStore } from 'vuex';
import metaJson from '../../meta.json'
import defaultSettings from './default_settings.json'
import defaultChannelControls from './default_channel_controls.json'

import { getSetUtil, getSetIndexUtil } from './utilities/NoteSequenceUtils'

const minKeyboardNote = 21;
const maxKeyboardNote = 108;

const midifiles = [
  {
    id: 'bach-c-prelude-the-well-tempered-clavier',
    title: 'Bach prélude C - Le Clavier Bien Tempéré',
    url: 'mid/bach-c-prelude-the-well-tempered-clavier.mid',
  },
  {
    id: 'bach-c-prelude-wohltemperierte_klavier',
    title: 'Bach prélude C - Le Clavier Bien Tempéré',
    url: 'mid/bach_wohltemperierte_klavier_i_1_(c)harfesoft.mid',
  },
  {
    id: 'chopin-etude-op10-no4',
    title: 'Chopin - Etude Op10 no4',
    url: 'mid/chopin-etude-op10-no4.mid',
  },
  {
    id: 'debussy-arabesque-2-e',
    title: 'Debussy - Arabesque E no2',
    url: 'mid/debussy_arabesque_2_e_major_schmitz.mid',
  },
];

const mxlfiles = [
  {
    id: 'bach-c-prelude-the-well-tempered-clavier',
    title: 'Bach prélude C - Le Clavier Bien Tempéré',
    url: 'mxl/Prelude_I_in_C_major_BWV_846_-_Well_Tempered_Clavier_First_Book.mxl',
  }
]

// Palette for visualization

const highlightPalette = new Map([

  // These will be used for the play/pause button (not yet), keyboard,
  // And for highlight in the piano roll.
  // Note that they sadly have to be duplicated from CSS definitions

  ["baseBlue", "#02a7f0"], // "Bleu université" / var(--button-blue)
  ["baseGreen", "#58e28e"], // Keyboard active color / var(--play-perform-green)
  ["autoplayDarkYellow", "#cba034"], // Notes of silent unselected channels, etc. / var(--autoplay-dark-yellow)
  ["autoplayLightYellow", "#ffc73b"], // Notes of audible unselected channels, etc. / var(--autoplay-light-yellow)

  // OSMD cursor uses <img> with a base64 RGBa PNG src, so we store that

  // baseBlue with 0.4 alpha
  ["cursorBlue", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAABCAYAAAAB3PQ6AAAAKElEQVQIW2O8+uFv2uqnvxnWPvrNcO3jXwZCQIufmSFYjpUhVJqVAQBQYAwqiJrEUwAAAABJRU5ErkJggg=="],
  // baseGreen with 0.5 alpha
  ["cursorGreen", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAABCAYAAAAB3PQ6AAAAKElEQVQIW2N8/PN1w4kfdxhOfrvF8OTXGwZCQIZNhMGcS43BgkOFAQBeUQxJfg+WeAAAAABJRU5ErkJggg=="],
  ["cursorAutoplay", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAABCAYAAAAB3PQ6AAAABmJLR0QAAwA7AJaPsf2vAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH6AwGBh8fkof+SwAAACZJREFUCNdj/P//fxoDww4Ghl97GBg+PWQgCPjkGRjYXBkYGNgZAJ1mCCX79T5PAAAAAElFTkSuQmCC"],

  // SheetMusic will use a darker variant to highlight notes on click/hover.
  // (To contrast with its cursors)
  // In PianoRoll, it is the opposite, and these will color the current set
  // (Because it has no cursor to show it)

  ["darkBlue", "#0175a8"], // Basic app blue 30% darker
  ["darkGreen", "#1eae56"] // Basic app green 60% darker
]);

const savedSettings = localStorage.getItem('settings')
const startingSettings = !!savedSettings ? JSON.parse(savedSettings) : defaultSettings

const store = createStore({
  state() {
    return {
      locale: "fr",

      inputs: {},
      outputs: {},

      firstStepsMidiFile: { ...midifiles[1], buffer: null },
      mfpMidiFile: { id: 'mfp', title: '', url: '', isMidi: true, buffer: null },

      // The main visualizer model, adapted from Magenta's own.
      // Contains notes with their MFP information,
      // Their start, and end times.

      noteSequence: [],
      usedChannels: new Set(), // cache for channel manager

      // Convenience arrays to switch between noteSequence indexes and set indexes.

      setStarts: [], // index of the first note for each set
      setEnds:[], // index of the last note for each set

      // Shared state of which notes to paint, and in color.

      activeNotes: [],
      highlightPalette: highlightPalette,

      // Model cache for OSMD visualizer alone.
      // I don't really know if it can be put elsewhere.
      osmdCursorAnchors: [],
      osmdSetCoordinates: [],

      minKeyboardNote,
      maxKeyboardNote,
      keyboardState: Array(maxKeyboardNote - minKeyboardNote).fill(0x0),
      keyboardAutoplay: Array(maxKeyboardNote - minKeyboardNote).fill(false),

      sequenceLength: 0,
      sequenceStart: 0,
      sequenceEnd: 0,
      sequenceIndex: 0,
      playbackSpeed: 1,
      currentMode: 'silent',

      // Whether "auto-playback" is active.
      autoplay: false,

      // All set indices where perform mode gives way to "auto-playback",
      // Whether because they only contain events from deselected channels,
      // Are off-beat, or off-measure.
      playbackTriggers: new Set(),

      midiAccessRequested: false,
      userClickOccurred: false,
      synthNotesFetched: 0,
      synthNotesDecoded: 0,

      defaultChannelControls: defaultChannelControls,
      currentChannelControls: structuredClone(defaultChannelControls),

      currentInputIds: startingSettings.io.inputIds,
      currentOutputId: startingSettings.io.outputId,
      currentKeyboardVelocities: startingSettings.io.keyboardRowVelocities,

      preferredVisualizer: startingSettings.visualizer.preferredVisualizer,
      playOnClickInSilentMode: startingSettings.visualizer.clickPlay.silent,
      playOnClickInPerformMode: startingSettings.visualizer.clickPlay.perform,

      looping: startingSettings.performer.looping,
      preferredVelocityStrategy: startingSettings.performer.preferredVelocityStrategy,
      conserveVelocity: startingSettings.performer.conserveVelocity,

      // These options should always packaged together, even here,
      // because modifying *any* of them means reconstructing the performer from scratch.
      performerConstructorOptions: startingSettings.performer.constructorOptions,

      meta: metaJson
    };
  },
  getters: {
    // midiBuffers: state => state.midiBuffers,
    firstStepsMidiFile: state => state.firstStepsMidiFile,
    mfpMidiFile: state => state.mfpMidiFile,
    fileIncludesChannel: (state) => (channel) => {
      return state.usedChannels.has(channel)
    },

    getSet: state => setIndex => {
      return getSetUtil(setIndex, state.noteSequence, state.setStarts, state.setEnds)
    },

    getSetIndex: state => noteIndex => {
      return getSetIndexUtil(noteIndex, state.setStarts)
    },

    isModeSilent: state => state.currentMode === 'silent',
    isModeListen: state => state.currentMode === 'listen',
    isModePerform: state => state.currentMode === 'perform',

    currentSettings: state => {

      // Properties that are objects or arrays need to be converted to raw from Vue's Proxy format
      // because the Settings component needs to clone them, and Proxies cannot be cloned.

      return {
        io: {
          inputIds: toRaw(state.currentInputIds),
          outputId: state.currentOutputId,
          keyboardRowVelocities: { ... state.currentKeyboardVelocities }
        },

        visualizer: {
          preferredVisualizer: state.preferredVisualizer,
          clickPlay: {
            silent: state.playOnClickInSilentMode,
            perform: state.playOnClickInPerformMode
          }
        },

        performer: {
          looping: state.looping,
          preferredVelocityStrategy: state.preferredVelocityStrategy,
          conserveVelocity: state.conserveVelocity,
          constructorOptions: toRaw(state.performerConstructorOptions),
        }
      }
    }
  },
  mutations: {
    setLocale(state, locale) {
      state.locale = locale
      localStorage.setItem('locale', locale)
    },

    setInputs(state, inputs) {
      state.inputs = inputs;
    },
    setOutputs(state, outputs) {
      state.outputs = outputs;
    },

    setFirstStepsMidiFile(state, file) {
      state.firstStepsMidiFile = { ...file };
    },
    setMfpMidiFile(state, file) {
      state.mfpMidiFile = { ...file };
    },
    setNoteSequence(state, sequence) {
      state.noteSequence = sequence;
      state.usedChannels = new Set(state.noteSequence.map(note => note.channel))
    },
    setSetStarts(state, starts) {
      state.setStarts = starts;
    },
    setSetEnds(state, ends) {
      state.setEnds = ends;
    },

    setAutoplay(state, autoplay) {
      state.autoplay = autoplay
    },
    setPlaybackTriggers(state, playbackTriggers) {
      state.playbackTriggers = structuredClone(playbackTriggers)

      state.noteSequence.forEach(note => note.isPlaybackNote = false)

      state.playbackTriggers.forEach(setIndex => {
        const set = getSetUtil(setIndex, state.noteSequence, state.setStarts, state.setEnds)
        set.forEach(note => note.isPlaybackNote = true)
      })
    },

    setActiveNotes(state, notes) {
      state.activeNotes = notes;
    },
    setOsmdCursorAnchors(state, anchors) {
      state.osmdCursorAnchors = anchors;
    },
    setOsmdSetCoordinates(state, coords) {
      state.osmdSetCoordinates = coords;
    },

    updateSettings(state, settings) {

      state.currentInputIds = settings.io.inputIds
      state.currentOutputId = settings.io.outputId
      state.currentKeyboardVelocities = settings.io.keyboardRowVelocities

      state.preferredVisualizer = settings.visualizer.preferredVisualizer
      state.playOnClickInSilentMode = settings.visualizer.clickPlay.silent
      state.playOnClickInPerformMode = settings.visualizer.clickPlay.perform

      state.looping = settings.performer.looping
      state.preferredVelocityStrategy = settings.performer.preferredVelocityStrategy
      state.conserveVelocity = settings.performer.conserveVelocity
      state.performerConstructorOptions = settings.performer.constructorOptions

      localStorage.setItem("settings", JSON.stringify(settings))
    },

    // Channel-based settings are not to be saved, and thus are stored separately.

    updateChannelControls(state, controls) {
      state.currentChannelControls = controls
    },

    resetChannelControls(state) {
      state.currentChannelControls = defaultChannelControls
    },

    animateNoteOn(state, note) {
      if (note.pitch >= state.minKeyboardNote &&
          note.pitch <= state.maxKeyboardNote) {
        const currentPlayingMask = state.keyboardState[note.pitch - state.minKeyboardNote]
        const channelMask = 1 << note.channel

        state.keyboardState[note.pitch - state.minKeyboardNote] =
          note.velocity > 0 ?
            currentPlayingMask | channelMask :
            currentPlayingMask & ~channelMask

        state.keyboardAutoplay[note.pitch - state.minKeyboardNote] =
          state.currentMode !== "silent" && state.playbackTriggers.has(state.sequenceIndex)
      }
    },
    animateNoteOff(state, note) {
      if (note.pitch >= state.minKeyboardNote &&
          note.pitch <= state.maxKeyboardNote) {
        const currentPlayingMask = state.keyboardState[note.pitch - state.minKeyboardNote]
        const channelMask = 1 << note.channel

        state.keyboardState[note.pitch - state.minKeyboardNote] =
          currentPlayingMask & ~channelMask
      }
    },
    animateChannelOff(state, channel) {
      state.keyboardState.forEach((_, index) => state.keyboardState[index] &= ~(1 << channel))
    },
    animateAllNotesOff(state) {
      for (let n = 0; n < state.maxKeyboardNote - state.minKeyboardNote; ++n) {
        state.keyboardState[n] = 0x0;
      }
    },
    ////////////////////////////////////////////////////////////////////////////
    // TO BE USED BY MidifilePerformer CLASS ONLY !!!
    setCurrentMode(state, mode) {
      state.currentMode = mode
    },
    setSequenceLength(state, length) {
      state.sequenceLength = length;
      // todo : update start, end and index
    },
    setSequenceStart(state, start) {
      state.sequenceStart = start;
      // todo : update index
    },
    setSequenceEnd(state, end) {
      state.sequenceEnd = end;
      // todo : update index
    },
    setSequenceIndex(state, index) {
      // console.log('setting index to : ' + index);
      // state.sequenceIndex = index;
      state.sequenceIndex = Math.min(
        Math.max(index, state.sequenceStart),
        state.sequenceEnd
      );
    },
    setPlaybackSpeed(state, speed) {
      state.playbackSpeed = speed
    },
    setMidiAccessRequested(state) {
      state.midiAccessRequested = true;
    },
    setUserClickOccurred(state) {
      state.userClickOccurred = true;
    },
    setSynthNotesFetched(state, amount) {
      state.synthNotesFetched = amount;
    },
    setSynthNotesDecoded(state, amount) {
      state.synthNotesDecoded = amount
    }
    ////////////////////////////////////////////////////////////////////////////
  }
  /*
  actions: {
    async loadMidiBuffers({ commit }) {
      const promises = [];
      const midifiles = [
        {
          id: 'bach-c-prelude-the-well-tempered-clavier',
          title: 'Bach prélude C - Le Clavier Bien Tempéré',
          url: 'mid/bach-c-prelude-the-well-tempered-clavier.mid',
        },
        {
          id: 'chopin-etude-op10-no4',
          title: 'Chopin - Etude Op10 no4',
          url: 'mid/chopin-etude-op10-no4.mid',
        },
        {
          id: 'debussy-arabesque-2-e',
          title: 'Debussy - Arabesque E no2',
          url: 'mid/debussy_arabesque_2_e_major_schmitz.mid',
        },
      ];

      midifiles.forEach(file => {
        // const { id, title, url } = file;
        promises.push(new Promise((resolve, reject) => {
          fetch(file.url)
          .then(res => res.arrayBuffer())
          .then(buffer => {
            // this.setMidiBuffer({ ...file, buffer });
            const { id, ...data } = { ...file, buffer };
            // resolve([ ...file, buffer ]);
            resolve([ id, data ]);
          });
        }));
      });

      const midiData = await Promise.all(promises);
      const midiBuffers = Object.fromEntries(new Map(midiData));
      // console.log(midiBuffers);
      commit('setMidiBuffers', midiBuffers);
    }
  }
  //*/
});

export default store;
