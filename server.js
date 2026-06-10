const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Create users table if not exists
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => console.log('DB ready')).catch(e => console.log('DB error:', e.message));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'oracle-secret-2026',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function hash(password) {
  return crypto.createHash('sha256').update(password + 'oracle-salt-2026').digest('hex');
}

function serveHtml(req, res) {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace('const GROQ_KEY = window.GROQ_KEY;', `const GROQ_KEY = "${process.env.GROQ_KEY || ''}";`);
  const user = req.session.user || null;
  html = html.replace('const GOOGLE_USER = window.GOOGLE_USER;', `const GOOGLE_USER = ${JSON.stringify(user)};`);
  res.send(html);
}

// Signup
app.post('/auth/signup', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name) return res.json({ error: 'All fields required' });
  if (password.length < 6) return res.json({ error: 'Password must be at least 6 characters' });
  try {
    const existing = await pool.query('SELECT id FROM users WHERE email=$1', [email.toLowerCase()]);
    if (existing.rows.length > 0) return res.json({ error: 'Email already registered' });
    await pool.query('INSERT INTO users (name, email, password) VALUES ($1,$2,$3)', [name, email.toLowerCase(), hash(password)]);
    req.session.user = { email: email.toLowerCase(), name };
    res.json({ success: true });
  } catch(e) {
    console.error(e);
    res.json({ error: 'Server error, please try again' });
  }
});

// Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.json({ error: 'All fields required' });
  try {
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email.toLowerCase()]);
    if (result.rows.length === 0) return res.json({ error: 'No account found with this email' });
    const user = result.rows[0];
    if (user.password !== hash(password)) return res.json({ error: 'Incorrect password' });
    req.session.user = { email: user.email, name: user.name };
    res.json({ success: true });
  } catch(e) {
    console.error(e);
    res.json({ error: 'Server error, please try again' });
  }
});

// Logout
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
