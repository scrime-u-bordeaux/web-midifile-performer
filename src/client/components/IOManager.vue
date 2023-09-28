<template>
  <div class="manager">
    <div class="select-container">
      <span class="select-label">Input</span>
      <select @change="selectedInputChanged">
        <option
          v-for="input in inputs"
          :value="input.id"
          :selected="input.id === currentInputId">
          {{ input.name }}
        </option>
      </select>
    </div>

    <div class="select-container">
      <span class="select-label">Output</span>
      <select @change="selectedOutputChanged">
        <option
          v-for="output in outputs"
          :value="output.id"
          :selected="output.id === currentOutputId">
          {{ output.name }}
        </option>
      </select>
    </div>

    <button @click="refreshInputsAndOutputs">
      Refresh device list
    </button>
  </div>
</template>

<style scoped>
.manager { display: flex; flex-direction: row; align-items: center;}
.select-container { display: flex; flex-direction: column; align-content: center;}
.select-label { color: #999; font-style: italic;}
select { display: block; margin: 1em; }
button { display: block; font-size: 1em; height: fit-content;}
</style>

<script>
import { mapState } from 'vuex';

export default {
  inject: [ 'ioctl' ],
  computed: {
    ...mapState([
      'inputs',
      'outputs',
      'currentInputId',
      'currentOutputId',
    ]),
  },
  created() {
    this.ioctl.addListener('command', this.onCommand);
  },
  beforeUnmount() {
    this.ioctl.removeListener('command', this.onCommand);
  },
  methods: {
    selectedInputChanged(e) {
      const id = e.target.value;
      this.ioctl.setInput(id);
      this.$emit("inputChange", id)
    },
    selectedOutputChanged(e) {
      const id = e.target.value;
      this.ioctl.allNotesOff();
      this.ioctl.setOutput(id);
    },
    refreshInputsAndOutputs(e) {
      this.ioctl.updateInputsAndOutputs();
    },
    onCommand(cmd) {
      const { pressed, id, velocity, channel } = cmd;
      //console.log(`received command ${pressed} ${id} ${velocity} ${channel}`);
    }
  }
};
</script>
