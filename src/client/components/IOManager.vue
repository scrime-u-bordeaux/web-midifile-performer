<template>
  <div class="manager">

    <!-- We run into quite the naming issue, because we're dealing with INPUTS and OUTPUTS here,
    But then, what do we call checkboxes and select dropdowns, except "inputs" ?
    I chose "controls". But still, the checkboxes have to be <input> tags.
    Nothing I can do about that, sadly. -->

    <div class="controls-and-labels">
      <div class="label-grid">
        <div class="control-label">{{ $t('ioManager.input') }}</div>
        <div class="control-label">{{ $t('ioManager.output') }}</div>
      </div>
      <div class="control-grid">
        <div class="control-container">
          <div class="checkboxes-container" ref="inputCheckboxes">
            <div v-for="(input, key, index) in inputs"
              class="checkbox-container"
              :class="index < amountOfInputs - 1 ? 'checkbox-padding' : ''"
            >
              <input type="checkbox"
                :value="input.id"
                :checked="currentInputIds.includes(input.id) && inputs[input.id] !== undefined"
                :disabled="inputs[input.id] === undefined"
                @change="selectedInputsChanged"
              >
              
              <!-- Intentional fallback to avoid ternary logic :
              for everything but the default IO, this key won't exist and will just display as-is. -->
              <span>{{ $t(input.name) }}</span>
            </div>
          </div>
          <!-- <select multiple @change="selectedInputChanged">
            <option
              v-for="input in inputs"
              :value="input.id"
              :selected="input.id === currentInputId">
              {{ input.name }}
            </option>
          </select> -->
        </div>

        <div class="control-container">
          <select @change="selectedOutputChanged">
            <!-- Ugly inline style hack that only works in Chromium family. Yuck ! -->
            <!-- Why in the Lord's holy name can we not just style option normally like any other element ??? -->
            <option
              style="font-family: 'DejaVu Serif'"
              v-for="output in outputs"
              :disabled="preventUnloadedSynthSelect(output)"
              :value="output.id"
              :selected="output.id === currentOutputId">

              <!-- Intentional fallback to avoid ternary logic :
              for everything but the default IO, this key won't exist and will just display as-is. -->
              {{ $t(output.name) }}
            </option>
          </select>
        </div>
      </div>
    </div>

    <button @click="refreshInputsAndOutputs">
      {{ $t('ioManager.refresh') }}
    </button>
  </div>
</template>

<style scoped>
.manager {
  display: flex;
  flex-direction:
  row; align-items: center;
}

.controls-and-labels {
  display: flex;
  flex-direction: column;
}

.label-grid {
  display: grid;
  grid-template-columns: 50% 50%
}

.control-grid {
  display: flex;
  flex-direction: row;
  justify-content: center;
}

.control-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.control-label {
  color: #999;
  font-style: italic;
}

.checkboxes-container {
  margin: 1em;
}
.checkbox-container {
  display: flex;
  justify-content: start;
  font-size: 0.9em;
}
input[type=checkbox] {
  margin-right: 0.5em;
  margin-bottom: 0;
  margin-top: 0;
}
.checkbox-padding {
  padding-bottom: 0.5em;
}

select {
  display: block;
  margin: 1em;
}

button {
  display: block;
  font-size: 1em;
  height: fit-content;
}
</style>

<script>
import { mapState } from 'vuex';

export default {
  inject: [ 'ioctl', 'DEFAULT_IO_ID', 'NUMBER_OF_KEYS', 'NUMBER_OF_SOUNDFILES' ],

  computed: {
    ...mapState([
      'inputs',
      'outputs',
      'currentInputIds',
      'currentOutputId',
      'synthNotesDecoded',
      'currentKeyboardVelocities'
    ]),

    amountOfInputs() {
      return [...Object.keys(this.inputs)].length
    }
  },

  watch: {
    currentKeyboardVelocities(newVels, oldVels) {
      this.ioctl.refreshVelocities(newVels)
    },

    currentInputIds(newIds, oldIds) {
      this.onInputsChanged(newIds)
    },

    currentOutputId(newId, oldId) {
      this.onOutputChanged(newId)
    }
  },

  async created() {
    await this.ioctl.updateInputsAndOutputs();

    this.ioctl.addListener('command', this.onCommand);

    // Writers don't trigger on store create
    // So we refresh every property we control when the component is first initiated
    // (Velocities, inputs, and output)

    this.ioctl.refreshVelocities(this.currentKeyboardVelocities);

    // If inputs were disconnected between sessions,
    // Only at this stage can we detect it.
    // (Because we've run the update, and the store has not)

    let availableInputs = this.currentInputIds.filter(inputId => this.inputs[inputId] !== undefined)

    // At this stage, however, the Settings component isn't properly initialized.
    // So we create a special event telling it to queue this update until it can handle it.

    if(!this.currentInputIds.every(inputId => availableInputs.includes(inputId))) { // only fire it if some inputs are missing

      // If all external inputs were disconnected and the keyboard had been disabled,
      // Re-enable it.
      if(availableInputs.length === 0) availableInputs = [this.DEFAULT_IO_ID]

      // Let the Settings component queue. It will then force-write the store when it initializes.
      this.$emit('delayedInputsChange', availableInputs)
    }

    this.onInputsChanged(availableInputs);
    this.onOutputChanged(this.currentOutputId);
  },

  beforeUnmount() {
    this.ioctl.removeListener('command', this.onCommand);
  },

  methods: {
    // With the manager gated behind the sample loading screen, this should never happen again.
    // Let's still keep it here just in case.
    preventUnloadedSynthSelect(output) {
      return output.id === this.DEFAULT_IO_ID && this.synthNotesDecoded !== this.NUMBER_OF_SOUNDFILES
    },

    // For some reason, if this is defined as a computed property, it is immediately cached after the first call,
    // Such that it never actually updates, and cannot be used.
    // I do not know why. A list of children is reactive and should not be eligible for caching.
    selectedInputs() {
      return [...this.$refs.inputCheckboxes.children].filter(
        child => child.firstChild.checked
      ).map(
        child => child.firstChild.value
      )
    },

    selectedInputsChanged(e) {
      const newlySelectedInputs = this.selectedInputs()
      this.$emit('inputsChange', newlySelectedInputs)
    },
    selectedOutputChanged(e) {
      const id = e.target.value;
      this.$emit("outputChange", id)
    },

    refreshInputsAndOutputs(e) {
      this.ioctl.updateInputsAndOutputs();
    },

    onCommand(cmd) {
      const { pressed, id, velocity, channel } = cmd;
      //console.log(`received command ${pressed} ${id} ${velocity} ${channel}`);
    },

    onInputsChanged(ids) {
      this.ioctl.setInputs(ids)
    },

    onOutputChanged(id) {
      this.ioctl.allNotesOff();
      this.ioctl.setOutput(id);
    }
  }
};
</script>
