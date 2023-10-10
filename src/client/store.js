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

const store = createStore({
  state() {
    return {
      inputs: {},
      outputs: {},
      currentInputId: 0,
      currentOutputId: 0,
      //midiBuffers: {},
      firstStepsMidiFile: { ...midifiles[1], buffer: null },
      mfpMidiFile: { id: 'mfp', title: '', url: '', buffer: null },
      minKeyboardNote,
      maxKeyboardNote,
      keyboardState: Array(maxKeyboardNote - minKeyboardNote).fill(false),
      sequenceLength: 0,
      sequenceStart: 0,
      sequenceEnd: 0,
      sequenceIndex: 0,
      performModeStartedAt: 0
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
    // setMidiBuffer(state, bufferData) {
    //   const { id, ...data } = bufferData;
    //   state.midiBuffers[id] = data;
    //   state.midiBuffers = { ...state.midiBuffers };
    // },
    // setMidiBuffers(state, buffers) {
    //   state.midiBuffers = { ...buffers };
    // },
    setFirstStepsMidiFile(state, file) {
      state.firstStepsMidiFile = { ...file };
    },
    setMfpMidiFile(state, file) {
      state.mfpMidiFile = { ...file };
    },
    noteOn(state, { noteNumber, velocity }) {
      if (noteNumber >= state.minKeyboardNote &&
          noteNumber <= state.maxKeyboardNote) {
        state.keyboardState[noteNumber - state.minKeyboardNote] = velocity > 0;
      }
    },
    noteOff(state, { noteNumber, velocity }) {
      if (noteNumber >= state.minKeyboardNote &&
          noteNumber <= state.maxKeyboardNote) {
        state.keyboardState[noteNumber - state.minKeyboardNote] = false;
      }
    },
    allNotesOff(state) {
      for (let n = 0; n < state.maxKeyboardNote - state.minKeyboardNote; ++n) {
        state.keyboardState[n] = false;
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
    }
    ////////////////////////////////////////////////////////////////////////////
  },
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
