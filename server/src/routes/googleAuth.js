import express from 'express'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

const router = express.Router()

passport.use(new GoogleStrategy({
  clientID: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
  callbackURL: (process.env.GOOGLE_CALLBACK_URL || '').trim(),
  proxy: true
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value
    const name = profile.displayName

    let user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          password: 'google-oauth' // placeholder — Google users never use password login
        }
      })
    }

    return done(null, user)
  } catch (err) {
    console.error('Error in Google Strategy Verify Callback:', err)
    return done(err, null)
  }
}))

passport.serializeUser((user, done) => done(null, user))
passport.deserializeUser((user, done) => done(null, user))

// redirect to Google
router.get('/', passport.authenticate('google', {
  scope: ['profile', 'email']
}))

// Google redirects back here
router.get('/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login` }),
  (req, res) => {
    const token = jwt.sign(
      { userId: req.user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    const user = {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name
    }

    // redirect to frontend with token in URL
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(user))}`)
  }
)

export default router