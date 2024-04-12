import { createApp }      from 'vue';
import { i18n } from './utilities/I18n'

import ioctl, { defaultInputs, defaultVelocities, DEFAULT_IO_ID } from './utilities/IOController';
import performer          from './utilities/MidifilePerformer';
import synth, { NUMBER_OF_KEYS, NUMBER_OF_SOUNDFILES }  from './utilities/Synth';
import parseMusicXml from './utilities/MusicXMLParser'
import store              from './store';
import router             from './router';
import App                from './App.vue';

Promise.all([
  performer.initialize(),
  // synth.loadSounds(), // not here, we need a user interaction before
])
.then(() => {
  const app = createApp(App);

  // Exterior dependencies

  app.use(i18n);
  app.use(router);
  app.use(store);

  // Constants

  app.provide('DEFAULT_IO_ID', DEFAULT_IO_ID)
  app.provide('NUMBER_OF_KEYS', NUMBER_OF_KEYS)
  app.provide('NUMBER_OF_SOUNDFILES', NUMBER_OF_SOUNDFILES)

  // Default variables

  app.provide('defaultMidiInput', defaultInputs);
  app.provide('defaultKeyboardVelocities', defaultVelocities);


  // Utilities

  app.provide('ioctl', ioctl);
  app.provide('performer', performer);
  app.provide('synth', synth);
  app.provide('parseMusicXml', parseMusicXml)

  app.mount('#app');
});
