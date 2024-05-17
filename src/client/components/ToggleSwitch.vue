<template>
  <div class="switch-container">
    <span class="text-label">{{ label }}</span>

    <label class="switch">
      <input
        type="checkbox"
        class="hidden-checkbox"
        v-model="modelValue"
        @input="$emit('update:modelValue', $event.target.checked)"
      />
      <span class="background"></span>
    </label>
  </div>
</template>

<style scoped>

.switch-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.switch {
  position: relative;
  display: inline-block;
  height: 2em;
  width: 3.6em;
  cursor: pointer;
  overflow: hidden;
}

.hidden-checkbox {
  position: absolute;
  left: -2em;
}

.background {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 20px;
  transition: all .3s
}

.hidden-checkbox + .background {
  background-color: #666;
}

.hidden-checkbox:checked + .background {
  background-color: var(--button-blue);
}

.hidden-checkbox + .background:before {
  content: "";
  display: inline-block;
	position: absolute;
	top: 50%;
  left: 0.25em;

  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  background: white;

  transform: translateY(-50%);
  transition: all .3s;
}

.hidden-checkbox:checked + .background:before {
  left: 1.85em;
}

.text-label {
  color: #888;
}
</style>

<script>
export default {
  props: ['label', 'modelValue'],
  emits: ['update:modelValue']
}
</script>
