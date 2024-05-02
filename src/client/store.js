import { createStore } from 'vuex';

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

// Palette for visualization

const highlightPalette = new Map([

  // These will be used for the play/pause button (not yet), keyboard (not yet),
  // And for the current set of the piano roll (not yet), which has no cursor.
  // Note that they sadly have to be duplicated from CSS definitions

  ["baseBlue", "#02a7f0"], // "Bleu université" / var(--button-blue)
  ["baseGreen", "#58e28e"], // Keyboard active color / var(--play-perform-green)

  // OSMD cursor uses <img> with a base64 RGBa PNG src, so we store that

  // baseBlue with 0.4 alpha
  ["cursorBlue", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAABCAYAAAAB3PQ6AAAAKElEQVQIW2O8+uFv2uqnvxnWPvrNcO3jXwZCQIufmSFYjpUhVJqVAQBQYAwqiJrEUwAAAABJRU5ErkJggg=="],
  // baseBlue with 0.5 alpha
  ["cursorGreen", "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAABCAYAAAAB3PQ6AAAAKElEQVQIW2N8/PN1w4kfdxhOfrvF8OTXGwZCQIZNhMGcS43BgkOFAQBeUQxJfg+WeAAAAABJRU5ErkJggg=="],

  // Both visualizers will use a darker variant to highlight notes on click/hover.
  // (For now only SheetMusic does)

  ["darkBlue", "#0175a8"], // Basic app blue 30% darker
  ["darkGreen", "#1eae56"] // Basic app green 60% darker
]);

const store = createStore({
  state() {
    return {
      inputs: {},
      outputs: {},
      currentInputId: 0,
      currentOutputId: 0,

      firstStepsMidiFile: { ...midifiles[1], buffer: null },
      mfpMidiFile: { id: 'mfp', title: '', url: '', isMidi: true, buffer: null },

      // Model shared by visualizers.
      // TODO : move it in a more logical place.
      // setStarts and setEnds register the indices where sets start and begin in noteSequence
      noteSequence: [],
      setStarts: [],
      setEnds: [],
      highlightPalette: highlightPalette,

      // Model cache for OSMD visualizer alone.
      // I don't really know if it can be put elsewhere.
      osmdCursorAnchors: [],
      osmdSetCoordinates: [],

      minKeyboardNote,
      maxKeyboardNote,
      keyboardState: Array(maxKeyboardNote - minKeyboardNote).fill(0x0),

      sequenceLength: 0,
      sequenceStart: 0,
      sequenceEnd: 0,
      sequenceIndex: 0,

      performModeStartedAt: 0, // hack, aim to remove by storing mode here instead
      midiAccessRequested: false,
      userClickOccurred: false,
      synthNotesFetched: 0,
      synthNotesDecoded: 0,
    };
  },
  getters: {
    // midiBuffers: state => state.midiBuffers,
    firstStepsMidiFile: state => state.firstStepsMidiFile,
    mfpMidiFile: state => state.mfpMidiFile,
  },
  mutations: {
    setInputs(state, inputs) {
      state.inputs = inputs;
    },
    setOutputs(state, outputs) {
      state.outputs = outputs;
    },
    setCurrentInputId(state, id) {
      state.currentInputId = id;
    },
    setCurrentOutputId(state, id) {
      state.currentOutputId = id;
    },
    setFirstStepsMidiFile(state, file) {
      state.firstStepsMidiFile = { ...file };
    },
    setMfpMidiFile(state, file) {
      state.mfpMidiFile = { ...file };
    },
    setNoteSequence(state, sequence) {
      state.noteSequence = sequence;
    },
    setSetStarts(state, starts) {
      state.setStarts = starts;
    },
    setSetEnds(state, ends) {
      state.setEnds = ends;
    },
    setOsmdCursorAnchors(state, anchors) {
      state.osmdCursorAnchors = anchors;
    },
    setOsmdSetCoordinates(state, coords) {
      state.osmdSetCoordinates = coords;
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
    allNotesOff(state) {
      for (let n = 0; n < state.maxKeyboardNote - state.minKeyboardNote; ++n) {
        state.keyboardState[n] = 0x0;
      }
    },
    ////////////////////////////////////////////////////////////////////////////
    // TO BE USED BY MidifilePerformer CLASS ONLY !!!
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
    setPerformModeStartedAt(state, time) {
      state.performModeStartedAt = time;
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
