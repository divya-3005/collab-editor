/**
 * Auth routes — /api/auth
 *
 * POST /register  → create account (email + bcrypt-hashed password), return JWT
 * POST /login     → verify credentials, return JWT
 * DELETE /me      → delete the authenticated user's account (cascades to documents)
 *
 * Tokens are signed JWTs with a 7-day expiry. The client stores the token in
 * localStorage and sends it as "Authorization: Bearer <token>" on every request.
 */

// ── Imports ───────────────────────────────────────────────────────────────────
import express from 'express';
import bcrypt from 'bcryptjs';       // Password hashing (never store plaintext)
import jwt from 'jsonwebtoken';       // Stateless auth tokens
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// ── POST /register ────────────────────────────────────────────────────────────
// Creates a new user. Passwords are hashed with bcrypt (cost factor 10) before
// being stored — we never persist the raw password.
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Prevent duplicate accounts for the same email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Hash the password: cost=10 is the bcrypt default — secure & reasonably fast
    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, password: hashed, name }
    });

    // Sign a JWT so the client is immediately authenticated after registration
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // 7-day session — long enough to be practical, short enough to be safe
    );

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /login ───────────────────────────────────────────────────────────────
// Verifies credentials and returns a fresh JWT.
// We return the same generic error for bad email and bad password to avoid
// leaking whether an account exists (a security best practice).
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // bcrypt.compare safely compares the plaintext input against the stored hash
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /me ────────────────────────────────────────────────────────────────
// Permanently deletes the authenticated user's account. Prisma cascades the
// delete to their documents (configured in the Prisma schema).
router.delete('/me', authenticate, async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.userId }
    });
    res.json({ message: 'Account deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error during account deletion' });
  }
});

export default router;