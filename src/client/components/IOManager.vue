<template>
  <div class="manager">
    <select @change="selectedInputChanged">
      <option
        v-for="input in inputs"
        :value="input.id"
        :selected="input.id === currentInputId">
        {{ input.name }}
      </option>
    </select>

    <select @change="selectedOutputChanged">
      <option
        v-for="output in outputs"
        :value="output.id"
        :selected="output.id === currentOutputId">
        {{ output.name }}
      </option>
    </select>

    <button @click="refreshInputsAndOutputs">
      refresh device list
    </button>
  </div>
</template>

<style scoped>
.manager { display: block; }
.radio {text-align: left; }
select { display: block; margin: 1em; }
button { display: block; font-size: 1em; }
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
