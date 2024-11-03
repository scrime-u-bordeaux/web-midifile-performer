const path = require('path');
const express = require('express');
const history = require('connect-history-api-fallback');
// const guido = require('@grame/guidolib');

const app = express();

app.use(history());
// app.use(history({
//   rewrites: [
//     // { from: '*', to: '' }
//   ]
// }));

// app.use(express.static(path.join(process.cwd(), 'dist')));
app.use(express.static('dist'));

// '/' seems to default to the index.html in the static folder (?)
app.get('*', (req, res) => {
  // res.redirect(`${(process.env.PUBLIC_PATH + '/') || '/'}/#/404`);
  res.redirect(`${process.env.PUBLIC_PATH || '/'}/#/404`);
});

const serverPort = process.env.PORT || 8000;

// guido()
// .then((res) => {
  // console.log(res);
  app.listen(serverPort, () => {
    console.log(`.Env port : ${process.env.PORT}`)
    console.log(`Express listening on port ${serverPort}`);
  });
// });
