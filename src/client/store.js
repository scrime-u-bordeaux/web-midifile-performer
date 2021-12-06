import { createStore } from 'vuex';

const minKeyboardNote = 21;
const maxKeyboardNote = 108;

const store = createStore({
  state() {
    return {
      midiBuffers: {},
      minKeyboardNote,
      maxKeyboardNote,
      keyboardState: Array(maxKeyboardNote - minKeyboardNote).fill(false),
      sequenceLength: 0,
      sequenceStart: 0,
      sequenceEnd: 0,
      sequenceIndex: 0,
    };
  },
  mutations: {
    setMidiBuffer(state, bufferData) {
      const { id, ...data } = bufferData;
      state.midiBuffers[id] = data;
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
    setSequenceIndex(state, end) {
      state.sequenceIndex = end;
      // todo : update index
    },
    ////////////////////////////////////////////////////////////////////////////
  }
});

export default store;