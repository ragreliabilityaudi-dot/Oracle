const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'oracle-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

// Simple in-memory user store (resets on redeploy — fine for now)
const users = {};

function hash(password) {
  return crypto.createHash('sha256').update(password + 'oracle-salt').digest('hex');
}

function serveHtml(req, res) {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace('const GROQ_KEY = window.GROQ_KEY;', `const GROQ_KEY = "${process.env.GROQ_KEY || ''}";`);
  const user = req.session.user || null;
  html = html.replace('const GOOGLE_USER = window.GOOGLE_USER;', `const GOOGLE_USER = ${JSON.stringify(user)};`);
  res.send(html);
}

// Auth routes
app.post('/auth/signup', (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.json({ error: 'All fields required' });
  if (users[email]) return res.json({ error: 'Email already registered' });
  users[email] = { email, name, password: hash(password) };
  req.session.user = { email, name };
  res.json({ success: true });
});

app.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = users[email];
  if (!user || user.password !== hash(password)) return res.json({ error: 'Invalid email or password' });
  req.session.user = { email, name: user.name };
  res.json({ success: true });
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/app', (req, res) => {
  if (!req.session.user) return res.redirect('/');
  serveHtml(req, res);
});

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/app');
  serveHtml(req, res);
});

app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`Oracle running on port ${PORT}`));
