import { createApp }      from 'vue';
import { createI18n } from "vue-i18n";
import fr from './locales/fr.json'
import en from './locales/en.json'

import ioctl, { defaultInputs, defaultVelocities } from './utilities/IOController';
import performer          from './utilities/MidifilePerformer';
import synth              from './utilities/Synth';
import store              from './store';
import router             from './router';
import App                from './App.vue';

const i18n = createI18n({
  locale: "fr",
  fallbackLocale: "en",
  messages: { fr, en },
});

Promise.all([
  performer.initialize(),
  // synth.loadSounds(), // not here, we need a user interaction before
])
.then(() => {
  const app = createApp(App);

  app.use(i18n);
  app.use(router);
  app.use(store);

  app.provide('ioctl', ioctl);
  app.provide('defaultMidiInput', defaultInputs);
  app.provide('defaultKeyboardVelocities', defaultVelocities);
  app.provide('performer', performer);
  app.provide('synth', synth);

  app.mount('#app');
});
