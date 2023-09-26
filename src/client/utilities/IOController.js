import EventEmitter from 'events';

const universalLayout = {
  forte: ["Digit1","Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9","Digit0"],
  mezzo: ["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP"],
  piano: ["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon"],
  pianissimo: ["KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash"]
}

const velocities = {
  forte: 127,
  mezzo: 100,
  piano: 64,
  pianissimo: 32,
};

const defaultInputs = {
  0: { id: '0', name: 'Computer keyboard' }
};

const defaultOutputs = {
  0: { id: '0', name: 'Internal sampler' }
};

////////////////////////////////////////////////////////////////////////////////

class IOController extends EventEmitter {
  constructor() {
    super();

    this.midiAccess = null;

    this.currentInputId = '0';
    this.currentOutputId = '0';
    this.updateInputsAndOutputs();

    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    this.keyCommandsState = new Map();

    Object.keys(universalLayout).forEach((k, catIndex) => {
      const velocityCategory = universalLayout[k];

      velocityCategory.forEach((key, keyIndex) =>
        this.keyCommandsState.set(key,
          { pressed: false, id: parseInt(""+catIndex+keyIndex), velocity: velocities[k] }
        )
      )
    });
  }

  setInternalSampler(sampler) {
    this.sampler = sampler;
  }

  onKeyDown(e) {
    if (this.currentInputId !== '0'
        || e.repeat)
      return;

    if (this.keyCommandsState.has(e.code)) {
      let { pressed, id, velocity } = this.keyCommandsState.get(e.code);

      if (!pressed) { // should never be true due to e.repeat condition above
        pressed = true;
        this.keyCommandsState.set(e.code, { pressed, id, velocity });
        this.emit('command', {
          pressed,
          id,
          velocity,
          channel: 0,
        });
      }
    }
  }

  onKeyUp(e) {
    if (this.currentInputId !== '0') return;

    if (this.keyCommandsState.has(e.code)) {
      let { pressed, id, velocity } = this.keyCommandsState.get(e.code);

      if (pressed) { // this check is probably not needed
        pressed = false;
        this.keyCommandsState.set(e.code, { pressed, id, velocity });
        this.emit('command', {
          pressed,
          id,
          velocity: 0,
          channel: 0,
        });
      }
    }
  }

  updateInputsAndOutputs() {
    // see https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API
    try {
      navigator.requestMIDIAccess().then(
        this.onMIDISuccess.bind(this),
        this.onMIDIFailure.bind(this)
      );
    } catch (err) {
      // console.error(err);
      this.onMIDIFailure();
    }
  }

  onMIDISuccess(midiAccess) {
    this.midiAccess = midiAccess;

    const inputs = {};
    for (let entry of this.midiAccess.inputs) {
      inputs[entry[0]] = entry[1];
    }
    this.inputs = { ...defaultInputs, ...inputs };
    this.emit('inputs', this.inputs);

    const outputs = {};
    for (let entry of this.midiAccess.outputs) {
      outputs[entry[0]] = entry[1];
    }
    this.outputs = { ...defaultOutputs, ...outputs };
    this.emit('outputs', this.outputs);
  }

  onMIDIFailure() {
    this.inputs = { ...defaultInputs };
    this.emit('inputs', this.inputs);

    this.outputs = { ...defaultOutputs };
    this.emit('outputs', this.outputs);
  }

  setInput(inputId) {
    // this.allNotesOff();
    // inputId = `${inputId}`;
    console.log(inputId);
    console.log(this.currentInputId);
    if (this.currentInputId !== '0') {
      this.inputs[this.currentInputId].removeEventListener(
        'midimessage',
        this.onMIDIMessage,
      );
    }

    this.currentInputId = inputId;

    if (this.currentInputId !== '0') {
      console.log(this.currentInputId);
      console.log(this.inputs[this.currentInputId]);
      this.inputs[this.currentInputId].addEventListener(
        'midimessage',
        this.onMIDIMessage.bind(this),
      );
    }

    this.emit('currentInputId', this.currentInputId);
  }

  setOutput(outputId) {
    // this.allNotesOff();
    // outputId = `${outputId}`;
    // send all notes off before clearing ?
    if (this.currentOutputId !== '0') {
      console.log(this.currentOutputId);
      console.log(this.outputs[this.currentOutputId]);
      // this.outputs[this.currentOutputId].clear();
    }
    this.currentOutputId = outputId;

    this.emit('currentOutputId', this.currentOutputId);
  }

  allNotesOff() {
    this.emit('allnotesoff');
    console.log("calling all sound off");
    if (this.currentOutputId !== '0') {
      const id = this.currentOutputId;
      for (let channel = 0; channel < 16; ++channel) {
        let msg;
        // 0xBF is CC
        // 0x78 is "all sound off"
        // msg = [ (0xB0 | (channel & 0xF)), 0x78, 0x00 ];
        // this.outputs[id].send(msg);
        // 0x7B is "all notes off"
        // msg = [ (0xB0 | (channel & 0xF)), 0x7B, 0x00 ];
        // this.outputs[id].send(msg);
        for (let n = 0; n < 128; ++n) {
          msg = [ (0x80 | (channel & 0xF)), (n & 0x7F), 0x00 ]
          this.outputs[id].send(msg);
        }
      }
    } else {
      this.sampler.allNotesOff();
    }
  }

  onMIDIMessage(msg) {
    const [ e, id, value ] = msg.data;
    const status = e  >> 4;
    const channel = (e & 0x0F);

    switch (status) {
      case 8:
        this.emit('command', {
          pressed: false,
          id,
          velocity: value,
          channel,
        });
        break;
      case 9:
        this.emit('command', {
          pressed: value > 0, // a note on with a null velocity is a note off
          id,
          velocity: value,
          channel,
        });
        break;
      case 11:
        // emit control changes ? (sustain pedal is CC 64)
        break;
      default:
        // emit other messages ?
        break;
    }
  }

  noteEvents(events) { // e is an array of { on, pitch, velocity, channel } objects
    if (this.currentOutputId !== '0') {
      for (const e of events) {
        const { on, pitch, velocity, channel } = e;
        const note = [
          // we only manipulate channels between 1 and 16 in the JS code.
          // we increment them directly when parsing the MIDI file and set them
          // back to between 0 and 15 here.
          (on ? 0x90 : 0x80) | ((channel - 1) & 0xF),
          pitch & 0x7F, // clip between 0 and 127
          velocity & 0x7F, // clip between 0 and 127
        ];
        this.outputs[this.currentOutputId].send(note);
      }
    } else {
      //console.log('received note events', events);
      for (const e of events) {
        const { on, pitch, velocity, channel } = e;
        if (on) {
          this.sampler.noteOn({ noteNumber: pitch, velocity });
        } else {
          this.sampler.noteOff({ noteNumber: pitch, velocity });
        }
      }
    }
  }
};

export default new IOController();
