<template>
  <div class="settings-container">
    <PopUp ref="popup" @closed="closed">
      <div class="inner-settings-container">
        <h2>{{ $t('settings.title') }}</h2>
      </div>
    </PopUp>
  </div>
</template>

<style scoped>
.inner-settings-container {
  min-width: var(--content-width);
  height: 500px;
}
h2 {
  color: #666;
  text-align: center;
  font-weight: bold;
  margin-top: -0.25em;
}
</style>

<script>

import PopUp from './PopUp.vue'

export default {
  components: { PopUp },

  methods: {
    open() {
      this.$refs.popup.open()
    },

    close() {
      this.$refs.popup.close()
    },

    closed() {
      this.$emit('closed')
    }
  }
}

</script>
