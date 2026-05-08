const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');

passport.use(new GoogleStrategy(
  {
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  process.env.CALLBACK_URL,
  },
  (accessToken, refreshToken, profile, done) => {
    const user = {
      id:    profile.id,
      name:  profile.displayName,
      email: profile.emails?.[0]?.value ?? null,
      photo: profile.photos?.[0]?.value ?? null,
    };
    done(null, user);
  }
));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

module.exports = passport;
