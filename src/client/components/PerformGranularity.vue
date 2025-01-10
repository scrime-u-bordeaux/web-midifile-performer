<template lang="html">
  <div class="granularities-container">
    <GranMeasureIcon
      style="width: 200px; height: auto; margin-bottom: 0.5em;"
      :modelValue="modelValue"
    />
    <!--
    <img class="example" :class="{
      all: modelValue === 'all',
      beat: modelValue === 'beat',
      measure: modelValue === 'measure'
    }"/>
    -->
    
    <div class="context">{{ $t('midiFilePerformer.granularities.context') }}</div>
    <OptionTabs
      class="tabs"
      :vertical="true"
      :items="granularities"
      :disabledItems="disabledGranularities"
      :roundBottom="true"
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<style lang="css" scoped>
.granularities-container {
  position: absolute;
  right: 0;
  padding: 15px;
}

img {
  width: 80%;
  height: 8%;
}

.example.all {
  content: url('../assets/pics/gran_all.png')
}

.example.beat {
  content: url('../assets/pics/gran_beat.png')
}

.example.measure {
  content: url('../assets/pics/gran_measure.png')
}

.tabs {
  color: #555;
}

.context {
  margin-bottom: 0.5em;
  color: #777;
  font-style: italic;
}
</style>

<script>
import GranMeasureIcon from './GranMeasureIcon.vue';
import OptionTabs from './OptionTabs.vue';
export default {
  components: { GranMeasureIcon, OptionTabs },

  props: ['modelValue'],
  emits: ['update:modelValue'],

  data() {
    return {
      disabledGranularities: new Set()
    }
  },

  computed: {
    granularities() {
      return [
        { 'id': 'measure', 'text': this.$t('midiFilePerformer.granularities.measure') },
        { 'id': 'beat', 'text': this.$t('midiFilePerformer.granularities.beat') },
        { 'id': 'all', 'text': this.$t('midiFilePerformer.granularities.all') }
      ]
    }
  },

  methods: {

    updateIsMeasurePlayDisabled(isIt) {
      if(isIt) this.disabledGranularities.add('measure')
      else this.disabledGranularities.delete('measure')
    },

    updateIsBeatPlayDisabled(isIt) {
      if(isIt) this.disabledGranularities.add('beat')
      else this.disabledGranularities.delete('beat')
    }

  }
}
</script>
