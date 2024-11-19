<template>
  <div
    class="tabs-wrapper"
    :class="[
      routerMode ? 'router' : 'generic',
      vertical ? 'vertical' : 'horizontal'
    ]"
  >
    <div class="tab"
        :class="[
          routerMode ? 'router' : 'generic',
          !routerMode && index === 0 ? 'first-tab' : '',
          !allowNone ? 'color-on-hover' : ''
        ]"
        v-for="(item, index) in items"
    >
      <router-link v-if="routerMode" :to="{ name: item.page }">
        {{ item.text }}
      </router-link>

      <div v-else
        :class="[
          selectedTabId === item.id ? 'selected' : '',
          !!roundBottom ? 'round-bottom': ''
        ]"
        :data-item-id="item.id"
        @click="onTabClick"
      >
        {{ item.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs-wrapper {
  display: flex;
  height: fit-content;
  justify-content: space-evenly;
  margin: auto;
  color: black;
}
.tabs-wrapper.router {
  padding: 0.3em 0;
  width: fit-content;
}
.tabs-wrapper.generic {
  width: 100%;
}
.tabs-wrapper.vertical {
  flex-direction: column;
  align-items: center;
}
.tabs-wrapper.horizontal {
  flex-direction: row;
}

.tab {
  margin: 0 0.5em;
}
.tab > * {
  cursor: pointer;
  text-decoration: none;
  line-height: 1em;
  border: 0;
  border-radius: 0.4em 0.4em 0 0;
  transition: all 0.25s;
}
.tab > .round-bottom {
  border-radius: 1em;
}
.tab.router > * {
  color: #555;
  padding: 0.3em 0.5em;
}
.tab.generic > * {
  padding: 0.5em;
}

/* CSS is such a fun language. */
.tab.router > *.selected,
.tab.router.color-on-hover > *:hover,
.tab.router > *.router-link-active,
.tab > *.selected,
.tab.color-on-hover > *:hover,
.tab > *.router-link-active {
  background-color: var(--button-blue);
  color: white;
}


</style>

<script>
export default {
  props: ['items', 'vertical', 'routerMode', 'roundBottom', 'modelValue', 'allowNone'],
  emits: ['update:modelValue'],

  computed: {
    selectedTabId: {
      get() {
        return this.modelValue
      },
      set(value) {
        this.$emit('update:modelValue', value)
      }
    }
  },

  methods: {
    onTabClick(event) {
      const tab = event.target
      const itemId = tab.dataset.itemId

      if(this.selectedTabId !== itemId || !this.allowNone) this.selectedTabId = itemId
      else this.selectedTabId = null
    }
  }
}
</script>
