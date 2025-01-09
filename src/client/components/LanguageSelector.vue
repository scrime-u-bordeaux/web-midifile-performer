<template>
  <div class="language-selector-wrapper">
    <template v-for="(lang, i) in langs">
      <template v-if="lang == $i18n.locale"></template>
        <div
          class="language-selector-item"
          :class="lang == $i18n.locale ? 'current' : ''" :id="lang"
          @click="() => { if (lang != $i18n.locale) onClick(lang); }">
          {{ lang.toUpperCase() }}
        </div>
        <template v-if="i < langs.length - 1"> / </template>
    </template>
    <!--
    <div
      id="fr"
      class="language-selector-item"
      @click="onClick('fr')">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 30">
        <path fill="#CE1126" d="M0 0h50v30H0"/>
        <path fill="#fff" d="M0 0h34v30H0"/>
        <path fill="#002654" d="M0 0h16v30H0"/>
      </svg>
    </div>
    <div
      id="en"
      class="language-selector-item"
      @click="onClick('en')">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 30">
	      <clipPath id="t">
          <path d="M25,15h25v15zv15h-25zh-25v-15zv-15h25z"/>
        </clipPath>
        <path d="M0,0v30h50v-30z" fill="#012169"/>
        <path d="M0,0 50,30M50,0 0,30" stroke="#fff" stroke-width="6"/>
        <path d="M0,0 50,30M50,0 0,30" clip-path="url(#t)" stroke="#C8102E" stroke-width="4"/>
        <path d="M-1 11h22v-12h8v12h22v8h-22v12h-8v-12h-22z" fill="#C8102E" stroke="#FFF" stroke-width="2"/>
      </svg>
    </div>
    -->

    <!--
    <div class="locale-picker">
      <select @change="onLocaleChange" v-model="$i18n.locale">
        <option v-for="lang in langs" :value="lang">
          {{ $t('locales.'+lang) }}
        </option>
      </select>
    </div>
    -->
  </div>
</template>

<style scoped>
.language-selector-wrapper {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}
.language-selector-item {
  display: inline-block;
  /* width: 2.5em; */
  /* height: 1.5em; */
  margin: 0.2em;
  cursor: pointer;
}
.language-selector-item.current {
  font-weight: bold;
  cursor: default;
}
svg {
  margin: 0;
  padding: 0;
}


/* FROM ORIGINAL RBLARD'S CODE */
.locale-picker {
  flex-grow: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
select {
  flex-shrink: 1;
  text-align: center;
  font-size: 1.2em;
  /* font-size: 0.9rem; */
  min-height: 2.2rem;
  background: none;
  background-image: none;
  padding: 0;
  /* background-color: #fff; */
  /* border: 1px solid #caced1; */
  /* border-radius: 0.25rem; */
  color: #000;
  cursor: pointer;
  outline: 0;
  border: 0;
}
option {
  text-align: center;
}
</style>

<script>
import { mapMutations } from 'vuex'

export default {
  data() {
    return {
      langs: ["fr", "en"] // Sadly it doesn't seem possible to directly iterate using the i18n object
    };
  },
  methods: {
    ...mapMutations(['setLocale']),
    onClick(locale) {
      this.$i18n.locale = locale;
      this.setLocale(locale);
    },
  },
};
</script>