const express = require('express');
const registerRoutes = require('./server/addons/routing.js');
const app = express();

registerRoutes(app);

app.listen(8080, () => {
  console.log('Server is running on port 8080');
});