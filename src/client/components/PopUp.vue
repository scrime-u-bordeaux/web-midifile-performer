<template>
  <div class="pop-up" v-bind:class="hidden ? 'hidden' : ''">
    <svg @click="clickedCloseBtn" viewBox="0 0 100 100">
      <line x1="10" y1="10" x2="90" y2="90" />
      <line x1="90" y1="10" x2="10" y2="90" />
    </svg>

    <div class="pop-up-wrapper">
      <slot />
    </div>
  </div>
</template>

<style scoped>
  svg {
    position: absolute;
    top: 15px;
    right: 15px;
    width: 20px;
    stroke: black;
    stroke-width: 20px;
    stroke-linecap: round;
    cursor: pointer;
  }
  h1 { text-align: center; }
  .green-italic {
    text-align: center;
    color: #0C0;
    font-style: italic; 
  }
  .pop-up-wrapper {
    font-size: 0.85em;
    max-width: var(--score-width);
    margin: 0 auto;
  }
</style>

<script>
export default {
  data() {
    return {
      hidden: false,
    };
  },
  methods: {
    clickedCloseBtn() {
      console.log('closing');
      this.hidden = true;
    },
  },
};
</script>