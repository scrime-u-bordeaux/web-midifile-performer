import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import history from 'connect-history-api-fallback'; // for vue-router history mode
import ViteExpress from 'vite-express'; // for vite hot reloading, if needed

import buildCorpora from './buildCorpora.js';


const basePath = process.env.PUBLIC_PATH || '/';

const __dirname = import.meta.dirname;

const demoCorpus = buildCorpora(
  path.join(__dirname, '../demo-corpus'),
);

const whiteList = {
  mozart_piano_sonatas: [ // todo: check other safe files and add them
    'K331-1.musicxml',
    'K331-2.musicxml',
    'K331-3.musicxml',
  ],
};

const blackList = {
  ABC: '*', // exclude ABC corpus completely
  liszt_pelerinage: [
    // these doesn't even try to load
    '160.01_Chapelle_de_Guillaume_Tell.musicxml',
    '160.04_Au_Bord_dUne_Source.musicxml',
    '160.06_Vallee_dObermann.musicxml',
    '160.07_Eglogue.musicxml',
    '160.09_Les_Cloches_de_Geneve_(Nocturne).musicxml',
    '161.01_Sposalizio.musicxml',
    // this one takes too long to load
    '162.03_Tarantella_da_Guillaume_Louis_Cottrau._Presto_e_canzone_napolitana.musicxml',
  ],
};

const dcmlCorpora = buildCorpora(
  path.join(__dirname, '../dependencies/dcml_corpora_musicxml_exports'),
  whiteList,
  blackList
);

const corpora = {
  ...demoCorpus,
  ...dcmlCorpora
};

const app = express();

// app.use(middleware(compiler, {
//   // webpack-dev-middleware options
// }));

// our mini corpora API :
// * get the list of corpora at /corpora
// * get files by <corpusname> <filename> requests like /corpora/:corpus/:piece

app.get(`/corpora`, (req, res) => {
  // console.log('corpora required');
  res.send(corpora);
});

app.get(`/corpora/:corpus/:piece`, (req, res) => {
  const { piece, corpus } = req.params;
  // console.log(`piece ${piece} required from corpus ${corpus}`);
  const filePath = path.join(
    corpora[corpus].find(p => p.name === piece).path,
    piece
  );

  // console.log(`sending file at location : ${filePath}`);
  res.sendFile(filePath);
});

// '/' seems to default to the index.html in the static folder (?)
if (process.env.NODE_ENV === 'production') { 
  // app.use(`${basePath}`, express.static(path.join(__dirname, '../../dist')));
  app.use('/', express.static(path.join(__dirname, '../../dist')));
  // app.get(`${basePath}`, (req, res) => {
  app.get('/', (req, res) => {
  //   console.log(req.url);
    res.sendFile(path.join(__dirname, '../../dist/index.html'))
  });
  // app.get('/{*any}', (req, res) => {
  //   console.log('redirecting to 404');
  //   res.redirect(`${basePath}/doc`);
  //   // res.redirect('/404');
  // });
} else {
  // app.get(/\/.+/, (req, res, next) => {
  //   console.log(req.url);
  //   res.redirect(`${basePath}/#/404`);
  // });
}

app.use(history({
  disableDotRule: true,
  htmlAcceptHeaders: [
    'text/html',
    'application/xhtml+xml'
  ],
  rewrites: [
    {
      from: /^.*$/,
      to: function(ctx) {
        // console.log(ctx.parsedUrl);
        // console.log('redirecting to 404');
        return `${basePath}/404`; // redirect to 404 page
      },
    }
  ]
}));

const serverPort = process.env.PORT || 8000;

ViteExpress.listen(app, serverPort, () => {
  console.log(`.Env port : ${process.env.PORT}`);
  console.log(`Server is listening on port ${serverPort}...`)
});
