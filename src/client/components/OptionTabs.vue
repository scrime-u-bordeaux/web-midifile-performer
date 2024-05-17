<template>
  <div class="tabs-wrapper" :class="routerMode ? 'router' : 'generic'">
    <div class="tab" :class="routerMode ? 'router' : 'generic'" v-for="item in items">
      <router-link v-if="routerMode" :to="{ name: item.page }">
        {{ item.text }}
      </router-link>

      <div v-else
        :class="[
          selectedTabId === item.id ? 'selected' : '',
          !!fullRound ? 'full-round': ''
        ]"
        @click="selectedTabId = item.id"
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
.tab > .full-round {
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
.tab.router > *:hover,
.tab.router > *.router-link-active,
.tab > *.selected,
.tab > *:hover,
.tab > *.router-link-active {
  background-color: var(--button-blue);
  color: white;
}


</style>

<script>
export default {
  props: ['items', 'routerMode', 'fullRound', 'modelValue'],
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
  }
}
</script>
