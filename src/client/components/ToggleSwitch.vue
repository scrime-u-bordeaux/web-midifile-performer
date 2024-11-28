<template>
  <div
    class="switch-container"
    :class="
      vertical ? 'vertical' : 'horizontal',
      disabled ? 'disabled' : 'enabled'
    ">
    <span v-if="!!label" class="text-label">{{ label }}</span>

    <label
      class="switch"
      :class="
        vertical ? 'vertical' : 'horizontal',
        disabled ? 'disabled' : 'enabled'
      "
    >
      <input
        type="checkbox"
        :disabled="disabled"
        class="hidden-checkbox"
        v-model="modelValue"
        @input="$emit('update:modelValue', $event.target.checked)"
      />
      <span class="background" :class="vertical ? 'vertical' : 'horizontal'"></span>
    </label>
  </div>
</template>

<style scoped>

.switch-container {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.switch-container.vertical {
  flex-direction: column;
  justify-content: center;
}

.switch-container.disabled {
  opacity: 0.4
}

.switch {
  position: relative;
  display: inline-block;
  overflow: hidden;
}

.switch.enabled {
  cursor: pointer;
}

.switch.horizontal {
  height: 2em;
  width: 3.6em;
}

.switch.vertical {
  width: 2em;
  height: 3.6em;
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

  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  background: white;

  transition: all .3s;
}

.hidden-checkbox + .background.horizontal:before {
  top: 50%;
  left: 0.25em;
  transform: translateY(-50%);
}

.hidden-checkbox + .background.vertical:before {
  left: 50%;
  top: 1.85em;
  transform: translateX(-50%);
}

.hidden-checkbox:checked + .background.horizontal:before {
  left: 1.85em;
}

.hidden-checkbox:checked + .background.vertical:before {
  top: 0.2em;
}

.text-label {
  color: #888;
}
</style>

<script>
export default {
  props: ['label', 'modelValue', 'vertical', 'disabled'],
  emits: ['update:modelValue']
}
</script>
