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
          <select ref="outputSelect" @change="selectedOutputChanged">
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
import { toRaw } from 'vue'
import { mapState, mapGetters } from 'vuex';
import defaultSettings from '../default_settings.json'

export default {
  inject: [ 'ioctl', 'DEFAULT_IO_ID', 'NUMBER_OF_KEYS', 'NUMBER_OF_SOUNDFILES' ],

  computed: {
    ...mapState([
      'inputs',
      'outputs',
      'currentInputIds',
      'currentOutputId',
      'synthNotesDecoded',
      'currentKeyboardVelocities',
      'currentChannelControls'
    ]),

    ...mapGetters(['currentSettings']),

    amountOfInputs() {
      return [...Object.keys(this.inputs)].length
    }
  },

  watch: {
    currentKeyboardVelocities(newVels, oldVels) {
      this.ioctl.refreshKeyboardVelocities(newVels)
    },

    currentChannelControls(newControls, oldControls) {
      this.ioctl.refreshChannelControls({
        channelVelocityOffsets: toRaw(newControls.channelVelocityOffsets),
        channelActive: toRaw(newControls.channelActive),
        channelPerformed: toRaw(newControls.channelPerformed)
      })
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

    // Writers don't trigger on store create
    // So we refresh every property we control when the component is first initiated
    // (Velocities, inputs, output, and channel controls)

    this.ioctl.refreshKeyboardVelocities(this.currentKeyboardVelocities);
    // Not needed for channel controls now that they are unsaved i.e. always default when loading
    // this.ioctl.refreshChannelControls(toRaw(this.currentChannelControls));

    // But refreshing I/O is not so simple.
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

    onInputsChanged(ids) {
      this.ioctl.setInputs(ids)
    },

    onOutputChanged(id) {
      this.ioctl.allNotesOff();
      this.ioctl.setOutput(id);
    },

    // Because this is a special component that doesn't use v-model, it provides this reset function instead.
    // This is specific to this component and should NOT be imitated anywhere.

    resetControls(mode) {
      const referenceIoState = mode === "current" ? this.currentSettings.io : defaultSettings.io

      // Here, the spread operator causes an unexpected token error.
      // Why ? I don't know !
      // Just using Array.from instead.
      Array.from(this.$refs.inputCheckboxes.children).map(child =>
        child.firstChild
      ).forEach(checkbox =>
        checkbox.checked = referenceIoState.inputIds.includes(checkbox.value)
      )
      this.$refs.outputSelect.value = referenceIoState.outputId
    }
  }
};
</script>
