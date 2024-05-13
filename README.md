# Midifile Performer

### About

This is a VueJS implementation of the Midifile
Performer software, as described in [Serpette, Haury et al.](https://dl.acm.org/doi/10.1145/3471872.3472968).

### Setup

The application keeps track of the current date on every git commit, and displays it.

For this to work, please take the following steps when you set up the repository, before you commit any code :

1. If such is not already the case, make the `config_hooks.sh` file executable through the following command :

```bash
chmod 744 config_hooks.sh
```

2. Run the following npm script :

```bash
npm run init_hooks
```

After this, the process is automatic, and the commit date will be automatically registered.
Note : to ensure this information remains meaningful, please **do not** manually modify or interact with the `meta.json` file, and only let the git hook do it.

### Building

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

### Todo

define clean dev and prod env files
