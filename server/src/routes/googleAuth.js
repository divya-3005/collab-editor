/**
 * googleAuth.js — Google OAuth 2.0 strategy and callback routes.
 *
 * Flow:
 *  1. GET /api/auth/google       → redirects user to Google consent screen
 *  2. Google redirects back to   GET /api/auth/google/callback
 *  3. After success: server issues a one-time exchange code (stored in memory,
 *     60-second TTL, single-use) and redirects the browser to:
 *     CLIENT_URL/auth/callback?code=<hex>
 *  4. The client POSTs the code to POST /api/auth/google/exchange, which
 *     returns the JWT in the response body (never in a URL).
 *
 * Security improvements vs. original:
 *  - JWT is never placed in a URL query parameter (prevents browser history /
 *    server log / Referer header leakage).
 *  - Google OAuth users are stored with a cryptographically random password
 *    placeholder instead of the literal string 'google-oauth', so a database
 *    breach does not reveal which accounts use OAuth.
 *  - Issued tokens carry type: 'auth' for the middleware type-guard.
 */

import express from 'express'
import crypto from 'crypto'
import passport from 'passport'
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'
import jwt from 'jsonwebtoken'
import prisma from '../lib/prisma.js'

const router = express.Router()

// ── One-time code store ───────────────────────────────────────────────────────
// Maps a random hex code → { token, expiresAt }.
// Codes are single-use and expire after 60 seconds.
const pendingCodes = new Map()

function createExchangeCode(token) {
  const code = crypto.randomBytes(32).toString('hex')
  pendingCodes.set(code, {
    token,
    expiresAt: Date.now() + 60_000
  })
  // Auto-cleanup: remove the entry after 70 seconds even if never consumed
  setTimeout(() => pendingCodes.delete(code), 70_000)
  return code
}

// ── Google Strategy ───────────────────────────────────────────────────────────
passport.use(new GoogleStrategy({
  clientID:     (process.env.GOOGLE_CLIENT_ID     || '').trim(),
  clientSecret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
  callbackURL:  (process.env.GOOGLE_CALLBACK_URL  || '').trim(),
  proxy: true
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value
    const name  = profile.displayName

    let user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
      // Use a cryptographically random placeholder — not the literal string
      // 'google-oauth' — so a database dump does not expose OAuth account
      // identifiers and bcrypt.compare will always safely return false.
      const randomPassword = crypto.randomBytes(32).toString('hex')

      user = await prisma.user.create({
        data: { email, name, password: randomPassword }
      })
    }

    return done(null, user)
  } catch (err) {
    console.error('Google Strategy error:', err)
    return done(err, null)
  }
}))

passport.serializeUser((user, done)   => done(null, user))
passport.deserializeUser((user, done) => done(null, user))

// ── GET / — Redirect to Google ────────────────────────────────────────────────
router.get('/', passport.authenticate('google', {
  scope: ['profile', 'email']
}))

// ── GET /callback — Google redirects here after consent ──────────────────────
router.get('/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login`
  }),
  (req, res) => {
    // Issue an auth token with the type claim
    const token = jwt.sign(
      { userId: req.user.id, type: 'auth' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Do NOT put the JWT in the URL. Use a short-lived one-time exchange code
    // so the JWT never appears in browser history, server logs, or Referer headers.
    const code = createExchangeCode(token)

    const user = {
      id:    req.user.id,
      email: req.user.email,
      name:  req.user.name
    }

    // Redirect with only the exchange code and the user JSON (not the token)
    res.redirect(
      `${process.env.CLIENT_URL}/auth/callback` +
      `?code=${code}&user=${encodeURIComponent(JSON.stringify(user))}`
    )
  }
)

// ── POST /exchange — Exchange a one-time code for the JWT ─────────────────────
// The client calls this endpoint from AuthCallback.jsx after reading the ?code
// param from the URL. The response delivers the JWT in the body (never in a URL).
router.post('/exchange', (req, res) => {
  const { code } = req.body

  if (!code) {
    return res.status(400).json({ error: 'Missing exchange code' })
  }

  const entry = pendingCodes.get(code)

  if (!entry) {
    return res.status(401).json({ error: 'Invalid or expired exchange code' })
  }

  if (Date.now() > entry.expiresAt) {
    pendingCodes.delete(code)
    return res.status(401).json({ error: 'Exchange code has expired' })
  }

  // Single-use: delete immediately after consumption
  pendingCodes.delete(code)

  res.json({ token: entry.token })
})

export default router