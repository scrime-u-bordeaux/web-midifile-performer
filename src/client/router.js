import * as Vue from 'vue';
import {
  createWebHistory,
  createWebHashHistory,
  createRouter,
} from 'vue-router';
import pages from './pages';

const router = createRouter({
  // '/' seems sufficient for local dev and prod with nginx reverse proxy :
  // history: createWebHashHistory('/'),
  // history: createWebHashHistory(import.meta.env.BASE_URL),

  // history: createWebHistory('/'),
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'MidifilePerformer',
      component: pages.MidifilePerformer,
    },
    {
      path: '/doc',
      name: 'Guide',
      component: pages.Guide,
    },
    {
      path: '/about',
      name: 'About',
      component: pages.About,
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
    },
  ],
});

export default router;
