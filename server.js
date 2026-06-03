const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

function serveHtml(req, res) {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace('const GROQ_KEY = window.GROQ_KEY;', `const GROQ_KEY = "${process.env.GROQ_KEY || ''}";`);
  html = html.replace('const GOOGLE_USER = window.GOOGLE_USER;', `const GOOGLE_USER = ${JSON.stringify({ name: 'Guest', email: 'guest@oracle.app' })};`);
  res.send(html);
}

app.get('/', (req, res) => serveHtml(req, res));
app.get('/app', (req, res) => serveHtml(req, res));
app.get('/auth/logout', (req, res) => res.redirect('/'));
app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`Oracle running on port ${PORT}`));
