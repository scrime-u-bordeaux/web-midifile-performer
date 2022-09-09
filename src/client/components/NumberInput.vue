<template>
  <div class="number-container">
    <input
      ref="number"
      type="number"
      :min="min" :max="max" :value="value" />
    <div class="number-arrows-container">
      <svg viewBox="0 0 100 200">
        <polygon
          points="50,10 90,85 10,85"
          @click="onUpArrowClick"/>
        <polygon
          points="50,190 10,115 90,115"
          @click="onDownArrowClick"/>
      </svg>
    </div>
  </div>
</template>

<style scoped>
input[type="number"] {
  pointer-events: none;
}
.number-container {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.number-arrows-container {
  flex: 100% 0 1;
  display: flex;
  flex-direction: row;
  align-items: center
}
</style>

<script>
export default {
  props: [ 'min', 'max', 'value' ],
  methods: {
    onUpArrowClick(e) {
      console.log('clicked up arrow');
    },
    onDownArrowClick(e) {
      console.log('clicked down arrow');
    }
  },
};
</script>