const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL || 'https://oracle-production-bee1.up.railway.app/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(session({
  secret: process.env.SESSION_SECRET || 'oracle-secret-key',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

// Auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => res.redirect('/app')
);

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

app.get('/auth/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ name: req.user.displayName, email: req.user.emails?.[0]?.value, photo: req.user.photos?.[0]?.value });
  } else {
    res.json(null);
  }
});

// Serve app (protected)
app.get('/app', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace('const GROQ_KEY = window.GROQ_KEY;', `const GROQ_KEY = "${process.env.GROQ_KEY || ''}";`);
  html = html.replace('const GOOGLE_USER = window.GOOGLE_USER;', `const GOOGLE_USER = ${JSON.stringify({ name: req.user.displayName, email: req.user.emails?.[0]?.value, photo: req.user.photos?.[0]?.value })};`);
  res.send(html);
});

// Login page
app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/app');
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace('const GROQ_KEY = window.GROQ_KEY;', `const GROQ_KEY = "${process.env.GROQ_KEY || ''}";`);
  html = html.replace('const GOOGLE_USER = window.GOOGLE_USER;', `const GOOGLE_USER = null;`);
  res.send(html);
});

app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`Oracle running on port ${PORT}`));
