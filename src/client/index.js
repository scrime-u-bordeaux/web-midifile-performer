import { createApp }      from 'vue';
import { i18n } from './utilities/I18n'

import ioctl, { defaultInputs, DEFAULT_IO_ID } from './utilities/IOController';
import performer          from './utilities/MidifilePerformer';
import synth, { NUMBER_OF_KEYS, NUMBER_OF_SOUNDFILES }  from './utilities/Synth';

import parseMusicXml from './utilities//musicxml/MusicXMLParser'
import getRootFileFromMxl from './utilities/musicxml/MXLParser'

import store              from './store';
import router             from './router';
import App                from './App.vue';

Promise.all([
  performer.initialize(), // WARNING : this is only the "vanilla" performer and will be overwritten by the MFP page as soon as it's constructed
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

  // Utility classes ;
  // They must be provided via injection,
  // Otherwise Vue's "this" prevents class syntax from working.
  // JS is wonderful.

  app.provide('ioctl', ioctl);
  app.provide('performer', performer);
  app.provide('synth', synth);

  // TODO : However, for these, use direct imports from components instead.
  // They are functions and have no this-binding problem.
  app.provide('parseMusicXml', parseMusicXml)
  app.provide('getRootFileFromMxl', getRootFileFromMxl)

  app.mount('#app');
});
