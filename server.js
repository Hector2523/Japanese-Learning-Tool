const express = require('express');
const { serveFile } = require('./modules/serveFile.js');
const fs = require('fs/promises');
const path = require('path');
const app = express();

app.use('/styles', express.static(path.join(__dirname, 'website/styles')));
app.use('/js', express.static(path.join(__dirname, 'website/js')));
app.use('/login', express.static(path.join(__dirname, 'website/pages/login')));

app.use((req, res, next) => {
  const host = req.get('Host');
  const origin = req.get('Origin');

  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) {
    return res.status(403).send('Forbidden: Requisição de origem não permitida');
  }

  console.log('Request received', req.originalUrl);
  next();
});

serveFile()

app.get('/login', async (req, res) => {
  try {
    let url = req.url === '/' ? './website/index.html' : req.url;
    const data = await fs.readFile(url, 'utf-8');
    res.status(200).send(data);
  } catch (err) {
    console.log(err);
    res.status(500).send(err.message);
  }
});

app.get('/', async (req, res) => {
  try {
    let url = req.url === '/' ? './website/index.html' : req.url;
    const data = await fs.readFile(url, 'utf-8');
    res.status(200).send(data);
  } catch (err) {
    console.log(err);
    res.status(500).send(err.message);
  }
});

app.use((req, res) => {
  res.redirect('/');
});

app.listen(8080, () => {
  console.log('Server is running on port 8080');
});