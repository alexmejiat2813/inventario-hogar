const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const db = require('./database');

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.CALLBACK_URL,
  },
  (accessToken, refreshToken, profile, done) => {
    try {
      const result = db.upsertUser({
        google_id: profile.id,
        name:      profile.displayName,
        email:     profile.emails?.[0]?.value ?? null,
        photo:     profile.photos?.[0]?.value ?? null,
      });
      if (result.is_new) db.createDefaultInventory(result.id);
      const { is_new, ...user } = result;
      done(null, user);
    } catch (err) {
      done(err);
    }
  }
));

passport.serializeUser((user, done)   => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;
