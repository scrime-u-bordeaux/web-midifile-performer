<template>
  <div
    class="tabs-wrapper"
    :class="[
      routerMode ? 'router' : 'generic',
      vertical ? 'vertical' : 'horizontal'
    ]"
  >
    <div class="tab color-on-hover"
        :class="[
          !!disabledItems && disabledItems.has(item.id) ? 'disabled' : 'enabled',
          routerMode ? 'router' : 'generic',
          !routerMode && index === 0 ? 'first-tab' : '',
          forceSize ? 'force-size' : ''
        ]"
        v-for="(item, index) in items"
    >
      <router-link v-if="routerMode" :to="{ name: item.page }">
        {{ item.text }}
      </router-link>

      <div v-else
        class = "tab-text"
        :class="[
          !!disabledItems && disabledItems.has(item.id) ? 'disabled' : '',
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
.tab.force-size {
  width: 2em;
  /* forcing height is not needed */
}

.tab > * {
  text-decoration: none;
  line-height: 1em;
  border: 0;
  border-radius: 0.4em 0.4em 0 0;
}
.tab.enabled > * {
  cursor: pointer;
  transition: all 0.25s;
}
.tab.disabled > * {
  opacity: 0.4
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
.tab.enabled.router > *.selected,
.tab.enabled.router.color-on-hover > *:hover,
.tab.enabled.router > *.router-link-active,
.tab.enabled > *.selected,
.tab.enabled.color-on-hover > *:hover,
.tab.enabled > *.router-link-active {
  background-color: var(--button-blue);
  color: white;
}

.tab-text {
  text-align: center;
}

</style>

<script>
export default {
  props: ['items', 'disabledItems', 'vertical', 'routerMode', 'roundBottom', 'forceSize', 'modelValue', 'allowNone'],
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

      if(this.selectedTabId !== itemId || !this.allowNone) {
        if(this.disabledItems?.has(itemId)) return

        this.selectedTabId = itemId
      }
      else this.selectedTabId = null
    }
  }
}
</script>
