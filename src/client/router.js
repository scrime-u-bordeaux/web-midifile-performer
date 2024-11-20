import Vue from 'vue';
import {
  createWebHistory,
  createWebHashHistory,
  createRouter,
} from 'vue-router';
import pages from './pages';

const router = createRouter({
  // '/' seems sufficient for local dev and prod with nginx reverse proxy :
  history: createWebHashHistory('/'),
  // history: createWebHashHistory(process.env.PUBLIC_PATH),

  // history: createWebHistory(process.env.PUBLIC_PATH),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: pages.Home,
    },
    {
      path: '/first-steps',
      name: 'FirstSteps',
      component: pages.FirstSteps,
    },
    {
      path: '/midifile-performer',
      name: 'MidifilePerformer',
      component: pages.MidifilePerformer,
    },
    {
      path: '/credits',
      name: 'Credits',
      component: pages.Credits
    },
    {
      path: '/guide',
      name: 'Guide',
      component: pages.Guide,
    },
    {
      path: '/look-for-scores',
      name: 'LookForScores',
      component: pages.LookForScores,
    },
    {
      path: '/:catchAll(.*)',
      name: 'NotFound',
      component: pages.NotFound,
    }
  ],
});

export default router;
