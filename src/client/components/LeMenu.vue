<template>
<div class="whole-header">

  <div class="logo-icon">
    <a href="https://scrime.u-bordeaux.fr/" target="_blank">
      <img src="pics/scrime-ubx.png" height="45"/>
    </a>
  </div>

  <div class="menubar-centerer">
    <div class="menubar-container">
      <div class="title-wrapper">

        <div class="main-title" @click="$router.push('/')">
          Midifile Performer
          <!-- Métapiano -->
        </div>
      </div>

      <!-- menu -->
      <OptionTabs :routerMode="true" :items="items"/>
    </div>
  </div>

  <!-- the language selector has the side effect -->
  <LanguageSelector @change="onLocaleChange"/>
</div>
</template>

<style scoped>
  .whole-header {
    display: grid;
    position: relative;
    grid-template-columns: 13% 74% 13%;
    text-align: center;
    padding: 0 15px;
    background-color: transparent;
    border-bottom: 1px solid var(--button-blue);
  }
  .logo-icon {
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .logo-icon a {
    display: inline-block;
  }
  .menubar-centerer {
    height: fit-content;
    display: flex;
    justify-content: center;
  }
  .title-wrapper {
    position: relative;
    height: 50px;
    max-width: var(--content-width);
    margin: 0 auto;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
  }
  .main-title {
    color: black;
    font-size: 1.7em;
    padding: 0.1em 0.3em;
    padding-right: 0.3em;
    display: inline-block;
    cursor: pointer;
    flex: 0 1 auto;
  }
</style>

<script>

import { mapMutations } from 'vuex'

import OptionTabs from './OptionTabs.vue'
import LanguageSelector from './LanguageSelector.vue';

export default {
  props: [ 'items' ],
  components: { OptionTabs, LanguageSelector },
  data() {
    return {
      langs: ["fr", "en"] // Sadly it doesn't seem possible to directly iterate using the i18n object
    };
  },
  created() {
  },
  beforeUnmount() {
  },
  methods: {

    ...mapMutations(['setLocale']),

    onLocaleChange() {
      console.log(e);
      // Through watching this, the app can update anything that vue-i18n doesn't automatically update itself
      this.setLocale(this.$i18n.locale)
    }
  }
};
</script>
