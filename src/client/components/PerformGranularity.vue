<template lang="html">
  <div class="granularities-container">
    <img class="example" :class="{
      all: modelValue === 'all',
      beat: modelValue === 'beat',
      measure: modelValue === 'measure'
    }"/>
    <div class="context">{{ $t('midiFilePerformer.granularities.context') }}</div>
    <OptionTabs
      class="tabs"
      :vertical="true"
      :items="granularities"
      :roundBottom="true"
      :modelValue="modelValue"
      @update:modelValue="$emit('update:modelValue', $event)"
    />
  </div>
</template>

<style lang="css" scoped>

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
import OptionTabs from './OptionTabs.vue'
export default {
  components: { OptionTabs },

  props: ['modelValue'],
  emits: ['update:modelValue'],

  computed: {
    granularities() {
      return [
        { 'id': 'measure', 'text': this.$t('midiFilePerformer.granularities.measure') },
        { 'id': 'all', 'text': this.$t('midiFilePerformer.granularities.all') }
      ]
    }
  }
}
</script>
