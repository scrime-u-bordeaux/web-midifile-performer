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
  forte: 75,
  mezzo: 55,
  piano: 30,
  pianissimo: 15,
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

    document.addEventListener('keydown', this.onKeyDown.bind(this));
    document.addEventListener('keyup', this.onKeyUp.bind(this));

    this.keyCommandsState = new Map(); // TODO : this map seems awkward and could potentially be ditched for a combination of a currentVelocities object and the universalLayout object

    // This is necessary to be able to add and remove the listener at will
    // Otherwise, calling bind() on the fly creates a new function reference, and removal is never applied...
    // I would say there has to be a smarter way to do this, but hey, it's JavaScript
    this.boundOnMidiListener = this.onMIDIMessage.bind(this)
    // List of input IDs whose event listeners cannot be removed.
    this.inputsAwaitingUnplug = new Set()

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

      if (!pressed) { // should always be the case, due to e.repeat condition above
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

  async updateInputsAndOutputs() {
    // see https://developer.mozilla.org/en-US/docs/Web/API/Web_MIDI_API
    try {
      const midiAccess = await navigator.requestMIDIAccess()
      this.onMIDISuccess(midiAccess)
    } catch (err) {
      this.onMIDIFailure();
    } finally {

      if(!!this.inputs) this.inputsAwaitingUnplug.forEach(inputID => {
        if(this.inputs[inputID] !== undefined)
          this.inputs[inputID].removeEventListener(
            'midimessage',
            this.boundOnMidiListener
          )
      })

      if(!!this.inputs && this.inputs[this.currentInputId] === undefined)
        this.currentInputId = DEFAULT_IO_ID
      if(!!this.outputs && this.outputs[this.currentOutputId] === undefined)
        this.currentOutputId = DEFAULT_IO_ID
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
    if(this.inputs[inputId] === undefined) return;

    if (this.currentInputId !== DEFAULT_IO_ID) {
      if(this.inputs[this.currentInputId] !== undefined)
        this.inputs[this.currentInputId].removeEventListener(
          'midimessage',
          this.boundOnMidiListener,
        );

      else this.inputsAwaitingUnplug.add(this.currentInputId)
    }

    this.currentInputId = inputId;
    localStorage.setItem('input', inputId)

    if (this.currentInputId !== DEFAULT_IO_ID) {
      this.inputs[this.currentInputId].addEventListener(
        'midimessage',
        this.boundOnMidiListener,
      );
    }

    this.emit('currentInputId', this.currentInputId);
  }

  setOutput(outputId) {
    // this.allNotesOff();
    // outputId = `${outputId}`;
    // send all notes off before clearing ?

    if(this.outputs[outputId] === undefined) return;

    if (this.currentOutputId !== DEFAULT_IO_ID) {
      console.log(this.currentOutputId);
      console.log(this.outputs[this.currentOutputId]);
      // this.outputs[this.currentOutputId].clear();
    }

    this.currentOutputId = outputId;
    localStorage.setItem('output',outputId)

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
          this.outputs[this.currentOutputId].send(msg.data) // Simply pass non-note messages to the output
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

  getCurrentVelocities() {
    const velocityTemplate = { ...defaultVelocities }

    Object.keys(velocityTemplate).forEach(category =>
      velocityTemplate[category] = this.keyCommandsState.get(universalLayout[category][0]).velocity
    )

    return velocityTemplate
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

    if(velocities !== defaultVelocities) // Object identity by address ; one rare case where this is useful
      localStorage.setItem("velocities", JSON.stringify(!!velocities.target ? velocities.target : velocities))
  }

  // Update the necessary labels. This is semantically unrelated to the component and looks very ugly here.

  changeLocale(defaultInputLabel, defaultOutputLabel) {
    defaultInputs[0].name = defaultInputLabel;
    defaultOutputs[0].name = defaultOutputLabel;
  }
};

const ioctl = new IOController()

export { ioctl as default, defaultInputs, defaultVelocities, DEFAULT_IO_ID }
