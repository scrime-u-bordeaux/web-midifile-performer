<template lang="html">
  <svg :style="`width: ${size}px; height: ${size}px`" @click="$emit('close')" viewBox="0 0 100 100">
    <line x1="10" y1="10" x2="90" y2="90" />
    <line x1="90" y1="10" x2="10" y2="90" />
  </svg>
</template>

<script>
export default {
  props: ['size']
}
</script>

<style lang="css" scoped>
.close-icon-container {
  width: fit-content;
  height: fit-content;
}
svg {
  stroke: #777;
  stroke-width: 20px;
  stroke-linecap: round;
  cursor: pointer;
}

svg:hover {
  stroke: var(--button-blue-light-90);
}
</style>
