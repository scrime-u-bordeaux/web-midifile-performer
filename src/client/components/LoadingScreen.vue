<template>
  <div class="loading-screen-container">

    <div class="access-message" v-if='!midiAccessRequested'>
      {{ !midiAccessRequested ? $t('loading.midiAccess') : '' }}
    </div>

    <div class="sample-message" v-if='midiAccessRequested'>
      <div class="fixed-message">
        {{ $t(userClickOccurred ? 'loading.afterClick' : 'loading.beforeClick') }}
      </div>
      <div class="variable-message" v-if='userClickOccurred'>
        <div class="fetching-message">
          {{ userClickOccurred ? `${$t('loading.fetched')} ${synthNotesFetched} / ${NUMBER_OF_SOUNDFILES}` : ''}}
        </div>
        <div class="decoding-message">
          {{ userClickOccurred ? `${$t('loading.decoded')} ${synthNotesDecoded} / ${NUMBER_OF_SOUNDFILES}` : '' }}
        </div>
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
.fixed-message, .access-message {
  color: #555;
  padding-bottom: 0.5rem;
}
.variable-message {
  color: #666;
  padding-top: 0.5rem;
}
.fetching-message {
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
}
</style>

<script>
import { mapState } from 'vuex';

export default {
  inject: [ 'NUMBER_OF_SOUNDFILES' ],
  computed: {
    ...mapState([
      'midiAccessRequested',
      'userClickOccurred',
      'synthNotesFetched',
      'synthNotesDecoded'
    ])
  }
}
</script>
