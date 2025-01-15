const path = require('path');
const express = require('express');
const history = require('connect-history-api-fallback');
// mimick webpack's dev server hot reload
// const webpack = require('webpack');
// const middleware = require('webpack-dev-middleware'); //webpack hot reloading middleware
// const compiler = webpack({}); //move your `devServer` config from `webpack.config.js`


const Corpora = require('./Corpora.js');
// const guido = require('@grame/guidolib');

const corpora = new Corpora('corpora/').build(path.join(__dirname, '../dependencies/dcml_corpora_musicxml_exports'));

const app = express();

// app.use(middleware(compiler, {
//   // webpack-dev-middleware options
// }));



// app.use(history()); // use this once figured out how to pass env vars to webpack
// app.use(history({
//   rewrites: [
//     // { from: '*', to: '' }
//   ]
// }));

// app.use(express.static(path.join(process.cwd(), 'dist')));
app.use(express.static('dist'));

// our mini corpora API :
// * get the list of corpora at /corpora
// * get files by <corpusname> <filename> requests like /corpora/:corpus/:piece

app.get('/corpora', (req, res) => {
  console.log('corpora required');
  res.send(corpora);
});

app.get('/corpora/:corpus/:piece', (req, res) => {
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
app.get('*', (req, res) => {
  // res.redirect(`${(process.env.PUBLIC_PATH + '/') || '/'}/#/404`);
  res.redirect(`${process.env.PUBLIC_PATH || '/'}/#/404`);
});

const serverPort = process.env.PORT || 8000;

app.listen(serverPort, () => {
  console.log(`.Env port : ${process.env.PORT}`)
  console.log(`Express listening on port ${serverPort}`);
});
