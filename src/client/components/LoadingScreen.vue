<template>
  <div class="loading-screen-container">
    <div class="fixed-message">
      {{ $t(userClickOccurred ? 'loading.afterClick' : 'loading.beforeClick') }}
    </div>
    <div class="variable-message">
      <div class="fetching-message">
        {{ userClickOccurred ? `${$t('loading.fetched')} ${synthNotesFetched} / ${NUMBER_OF_KEYS}` : ''}}
      </div>
      <div class="decoding-message">
        {{ userClickOccurred ? `${$t('loading.decoded')} ${synthNotesDecoded} / ${NUMBER_OF_KEYS}` : '' }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.loading-screen-container {
  min-height: 450px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-content: center;
}
.fixed-message {
  color: #555;
  padding-bottom: 0.5rem;
}
.variable-message {
  color: #666;
  padding-top: 0.5rem;
}
.fetching-message, decoding-message {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}
</style>

<script>
import { mapState } from 'vuex';

export default {
  inject: [ 'NUMBER_OF_KEYS' ],
  computed: {
    ...mapState([
      'userClickOccurred',
      'synthNotesFetched',
      'synthNotesDecoded'
    ])
  }
}
</script>
