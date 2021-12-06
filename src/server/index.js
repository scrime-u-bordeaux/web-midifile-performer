const path = require('path');
const express = require('express');
const history = require('connect-history-api-fallback');
const guido = require('@grame/guidolib');

const app = express();
app.use(history());
app.use(express.static(path.join(process.cwd(), 'dist')));

const serverPort = 8000;

guido()
.then((res) => {
  console.log(res);
  app.listen(serverPort, () => {
    console.log(`Express listening on port ${serverPort}`);
  });
});
