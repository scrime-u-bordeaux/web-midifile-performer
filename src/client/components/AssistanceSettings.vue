<script setup>
import PerformGranularity from './PerformGranularity.vue';
import ToggleSwitch from './ToggleSwitch.vue';
</script>

<template>
  <div class="assistance-settings-container">
  <PerformGranularity
    ref="performGranularity"
    :modelValue="currentAssistanceSettings.performGranularity"
    @update:modelValue="setPerformGranularity"
  />
  <ToggleSwitch
    ref="autoAdaptTempo"
    :label="'Auto adapt tempo'"
    :modelValue="currentAssistanceSettings.adaptiveTempo"
    @update:modelValue="setAdaptiveTempo"
  />
  </div>
</template>

<style scoped>
.assistance-settings-container {
  position: absolute;
  right: 0;
  padding: 15px 15px 0 0;
}
</style>

<script>
import { mapGetters, mapMutations } from 'vuex';

export default {
  computed: {
    ...mapGetters([
      // 'performGranularity',
      // 'autoAdaptTempo',
      'currentAssistanceSettings',
    ])
  },
  methods: {
    ...mapMutations([
      'updatePerformGranularity',
      'updateAutoAdaptTempo',
    ]),
    setPerformGranularity(newValue) {
      this.updatePerformGranularity(newValue)
    },
    setAutoAdaptTempo(newValue) {
      this.updateAutoAdaptTempo(newValue)
    },
    updateMeasurePlayIsDisabled(newValue) {
      this.$refs.performGranularity.updateIsMeasurePlayDisabled(newValue)
    },
    updateBeatPlayIsDisabled(newValue) {
      this.$refs.performGranularity.updateIsBeatPlayDisabled(newValue)
    },
  }
};
</script>