<template>
  <svg viewBox="0 0 100 100" :class="{ silent: silent, enabled: enabled }">
    <rect x="0" y="0" width="45" height="20" />
    <rect x="0" y="40" width="45" height="20" />
    <rect x="0" y="80" width="45" height="20" />
    <rect x="55" y="20" width="45" height="20" />
    <rect x="55" y="60" width="45" height="20" />
  </svg>
</template>

<style scoped>
svg.silent rect {
  fill: #000000;
}
svg.enabled rect {
  fill: var(--play-perform-green);
}
svg.silent.enabled rect {
  fill: var(--button-blue);
}
</style>

<script>
export default {
  props: [ 'silent', 'enabled' ],
};
</script>