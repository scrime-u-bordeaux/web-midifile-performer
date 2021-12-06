# Midifile Performer

### website and online application

This is a minimal website about Jean Haury's MetaPiano and the Midifile
Performer software.

It also includes a simplified JavaScript version of Midifile Performer which is
playable in the browser.

### building

The website is a SPA (single page application) mostly written with VueJS and bundled
with Webpack.

To develop, run `npm run dev` :

This will launch a local server that will hot-reload your page on any change
during development.

To build, run `npm run build` :

This will result in the creation of a `dist` folder which will contain an
`index.html` and all the necessary resources, on which you can run any static
http server.

To get rid of the hashtag before all the SPA's routes in the browser's url bar :

* `vue-router` needs to be initialized with `history: createWebHistory()` instead
of `history: createWebHashHistory()` in `src/router.js`
* the website needs to be served with e.g. `node src/server/index.js` to provide
support for the browser's history api upon which the SPA relies to have multiple
routes.

see [`vue-router`'s history modes](https://next.router.vuejs.org/guide/essentials/history-mode.html)

### todo's

define clean dev and prod env files