import EventEmitter from 'events';
import { i18n } from './I18n.js';
const { t } = i18n.global

const universalLayout = {
  forte: ["Digit1","Digit2","Digit3","Digit4","Digit5","Digit6","Digit7","Digit8","Digit9","Digit0"],
  mezzo: ["KeyQ","KeyW","KeyE","KeyR","KeyT","KeyY","KeyU","KeyI","KeyO","KeyP"],
  piano: ["KeyA","KeyS","KeyD","KeyF","KeyG","KeyH","KeyJ","KeyK","KeyL","Semicolon"],
  pianissimo: ["KeyZ","KeyX","KeyC","KeyV","KeyB","KeyN","KeyM","Comma","Period","Slash"]
}

const defaultVelocities = {
  forte: 127,
  mezzo: 100,
  piano: 64,
  pianissimo: 32,
};

const DEFAULT_IO_ID = '0'

const MIDI_COMMAND_MASK = 0xF0;
const MIDI_CHANNEL_MASK = 0x0F

const MIDI_NOTE_ON_COMMAND = 144
const MIDI_NOTE_OFF_COMMAND = 128

// Using vue-i18n t here is sadly not sufficient for it to change on locale change
// A separate method deals with updating these labels
// TODO : should we just put them elsewhere and inject them ?

const defaultInputs = {
  0: { id: DEFAULT_IO_ID, name: t('ioController.defaultInput') }
};

const defaultOutputs = {
  0: { id: DEFAULT_IO_ID, name: t('ioController.defaultOutput') }
};

////////////////////////////////////////////////////////////////////////////////

class IOController extends EventEmitter {
  constructor() {
    super();

    this.midiAccess = null;

    this.currentInputId = DEFAULT_IO_ID;
    this.currentOutputId = DEFAULT_IO_ID;
    this.updateInputsAndOutputs();

    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    this.keyCommandsState = new Map();

    this.refreshVelocities(defaultVelocities)
  }

  setInternalSampler(sampler) {
    this.sampler = sampler;
  }

  onKeyDown(e) {
    if (this.currentInputId !== DEFAULT_IO_ID
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
    if (this.currentInputId !== DEFAULT_IO_ID) return;

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
    if (this.currentInputId !== DEFAULT_IO_ID) {
      this.inputs[this.currentInputId].removeEventListener(
        'midimessage',
        this.onMIDIMessage,
      );
    }

    this.currentInputId = inputId;

    if (this.currentInputId !== DEFAULT_IO_ID) {
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
    if (this.currentOutputId !== DEFAULT_IO_ID) {
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
    if (this.currentOutputId !== DEFAULT_IO_ID) {
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

    const status = (e & MIDI_COMMAND_MASK);
    const channel = (e & MIDI_CHANNEL_MASK);
    // This is actually a simplification : messages above Fx are individually numbered without channels
    // For instance : FE is not "command Fx on channel E" but the individual message "active sensing", and FF is "System reset", etc
    // For now, we won't transmit messages above F, so we can always assume the lower nibble is the channel.

    switch (status) {
      case MIDI_NOTE_OFF_COMMAND:
        this.emit('command', {
          pressed: false,
          id,
          velocity: value,
          channel,
        });
        break;
      case MIDI_NOTE_ON_COMMAND:
        this.emit('command', {
          pressed: value > 0, // a note on with a null velocity is a note off
          id,
          velocity: value,
          channel,
        });
        break;
      default:
        if(this.currentOutputId !== DEFAULT_IO_ID)
          this.outputs[this.this.currentOutputId].send(msg.data) // Simply pass non-note messages to the output 
    }
  }

  // Direct note events rendered from the MFP into the chosen audio output

  playNoteEvents(events) { // "events" is an array of { on, pitch, velocity, channel } objects
    events.forEach(e => {
      const { on, pitch, velocity, channel } = e;
      this.emit(on ? "noteOn" : "noteOff", e)

      if (this.currentOutputId !== DEFAULT_IO_ID) { // external audio output
        // Convert JS object to MIDI bytes

        const note = [
          // we only manipulate channels between 1 and 16 in the JS code.
          // we increment them directly when parsing the MIDI file and set them
          // back to between 0 and 15 here.
          (on ? 0x90 : 0x80) | ((channel - 1) & 0xF),
          pitch & 0x7F, // clip between 0 and 127
          velocity & 0x7F, // clip between 0 and 127
        ];

        this.outputs[this.currentOutputId].send(note);
      } else { // internal sampler
        // It takes in JS objects without conversion

        if(on) this.sampler.noteOn({noteNumber: pitch, velocity, channel})
        else this.sampler.noteOff({noteNumber: pitch, velocity, channel})
      }
    })
  }

  refreshVelocities(velocities) {
    Object.keys(universalLayout).forEach((k, catIndex) => {
      const velocityCategory = universalLayout[k];

      velocityCategory.forEach((key, keyIndex) =>
        this.keyCommandsState.set(key,
          { pressed: false, id: parseInt(""+catIndex+keyIndex), velocity: velocities[k] }
        )
      )
    });
  }

  // Update the necessary labels. This is semantically unrelated to the component and looks very ugly here.

  changeLocale(defaultInputLabel, defaultOutputLabel) {
    defaultInputs[0].name = defaultInputLabel;
    defaultOutputs[0].name = defaultOutputLabel;
  }
};

const ioctl = new IOController()

export { ioctl as default, defaultInputs, defaultVelocities }
