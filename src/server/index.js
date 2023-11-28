const path = require('path');
const express = require('express');
const history = require('connect-history-api-fallback');
const config = require('../../config');

// const guido = require('@grame/guidolib');

const app = express();

// app.use(history());
// app.use(history({
//   rewrites: [
//     // { from: '*', to: '' }
//   ]
// }));

// app.use(express.static(path.join(process.cwd(), 'dist')));
app.use(express.static('dist'));

// '/' seems to default to the index.html in the static folder (?)
app.get('*', (req, res) => {
  res.redirect(`${config.publicPath}/#/404`);
});

const serverPort = 8000;

// guido()
// .then((res) => {
  // console.log(res);
  app.listen(serverPort, () => {
    console.log(`Express listening on port ${serverPort}`);
  });
// });
