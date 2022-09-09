import { createApp }      from 'vue';
// import MidifilePerformer  from 'midifile-performer';
// import performer          from './utilities/NaiveMidifilePerformer';
import ioctl              from './utilities/IOController';
import performer          from './utilities/MidifilePerformer';
import synth              from './utilities/Synth';
import store              from './store';
import router             from './router';
import App                from './App.vue';

Promise.all([
  performer.initialize(),
  // synth.loadSounds(), // not here, we need a user interaction before
])
.then(() => {
  const app = createApp(App);

  app.use(router);
  app.use(store);
  
  app.provide('ioctl', ioctl);
  app.provide('performer', performer);
  app.provide('synth', synth);
  
  app.mount('#app');
});