import { createApp }    from 'vue';
import performer        from './utilities/MidifilePerformer';
import synth            from './utilities/Synth';
import store            from './store';
import router           from './router';
import App              from './App.vue';

// Promise.all([ synth.loadSounds() ])
// .then(() => {
  const app = createApp(App);

  app.use(router);
  app.use(store);
  
  app.provide('performer', performer);
  app.provide('synth', synth);

  app.mount('#app');
// });