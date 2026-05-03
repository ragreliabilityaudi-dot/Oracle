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
  callbackURL: 'https://oracle-production-bee1.up.railway.app/auth/google/callback'
}, (accessToken, refreshToken, profile, done) => {
  console.log('Google auth success:', profile.displayName);
  return done(null, profile);
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

app.use(session({
  secret: process.env.SESSION_SECRET || 'oracle-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use(passport.initialize());
app.use(passport.session());

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('OAuth error:', err);
      return res.redirect('/?error=oauth');
    }
    if (!user) {
      console.error('No user returned:', info);
      return res.redirect('/?error=nouser');
    }
    req.logIn(user, (err) => {
      if (err) {
        console.error('Login error:', err);
        return res.redirect('/?error=login');
      }
      console.log('Login successful, redirecting to /app');
      return res.redirect('/app');
    });
  })(req, res, next);
});

app.get('/auth/logout', (req, res) => {
  req.logout(() => res.redirect('/'));
});

function serveHtml(req, res, user) {
  let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  html = html.replace('const GROQ_KEY = window.GROQ_KEY;', `const GROQ_KEY = "${process.env.GROQ_KEY || ''}";`);
  html = html.replace('const GOOGLE_USER = window.GOOGLE_USER;', `const GOOGLE_USER = ${JSON.stringify(user)};`);
  res.send(html);
}

app.get('/app', (req, res) => {
  if (!req.isAuthenticated()) return res.redirect('/');
  const user = { name: req.user.displayName, email: req.user.emails?.[0]?.value, photo: req.user.photos?.[0]?.value };
  serveHtml(req, res, user);
});

app.get('/', (req, res) => {
  if (req.isAuthenticated()) return res.redirect('/app');
  serveHtml(req, res, null);
});

app.use(express.static(__dirname));

app.listen(PORT, () => console.log(`Oracle running on port ${PORT}`));
