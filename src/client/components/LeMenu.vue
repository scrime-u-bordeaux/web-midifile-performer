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
        </div>
      </div>

      <!-- menu -->
      <div class="menu-items-wrapper">
        <template v-for="item in items">
          <router-link :to="{ name: item.page }" class="menu-item">
            {{ item.text }}
          </router-link>
        </template>
      </div>
    </div>
  </div>

  <div class="locale-picker">
    <select @change="onLocaleChange" v-model="$i18n.locale">
      <option v-for="lang in langs" :value="lang">
        {{ $t('locales.'+lang) }}
      </option>
    </select>
  </div>
</div>
</template>

<style scoped>
  .whole-header {
    display: grid;
    position: relative;
    grid-template-columns: 15% 72% 13%;
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
  .menu-items-wrapper {
    display: flex;
    justify-content: space-evenly;
    width: fit-content;
    margin: auto;
    color: black;
  }
  .menu-item {
    cursor: pointer;
    text-decoration: none;
    color: #555;
    line-height: 1em;
    margin: 0 0.5em;
    padding: 0.3em 0.5em;
    border: 0;
    border-radius: 0.4em 0.4em 0 0;
    transition: all 0.25s;
  }
  .menu-item.selected,
  .menu-item:hover,
  .menu-item.router-link-active {
    background-color: var(--button-blue);
    color: white;
  }
  .locale-picker {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  select {
    text-align: center;
    font-size: 0.9rem;
    min-height: 2.2rem;
    background-color: #fff;
    border: 1px solid #caced1;
    border-radius: 0.25rem;
    color: #000;
    cursor: pointer;
  }
  option {
    text-align: center;
  }
</style>

<script>
import { mapState, mapMutations } from 'vuex';

export default {
  props: [ 'items' ],
  data() {
    return {
      langs: ["fr", "en"] // Sadly it doesn't seem possible to directly iterate using the i18n object
    };
  },
  computed: {
    ...mapState(['localeChanged'])
  },
  created() {
  },
  beforeUnmount() {
  },
  methods: {
    ...mapMutations(['setLocaleChanged']),
    onLocaleChange(e) {
      this.setLocaleChanged(Date.now()) // Through watching this, the app can update anything that vue-i18n doesn't automatically update itself
    }
  }
};
</script>
