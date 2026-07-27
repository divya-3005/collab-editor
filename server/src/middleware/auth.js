import jwt from 'jsonwebtoken';

/**
 * Express middleware: JWT Bearer token authentication.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the token using
 * the server's JWT_SECRET, and attaches the decoded `userId` to `req`.
 *
 * Security: also asserts that `decoded.type === 'auth'` to prevent share tokens
 * (which carry { documentId, permission, type: 'share' }) from being accepted
 * as authentication credentials on API routes.
 *
 * Returns 401 if the header is missing, malformed, expired, or the token is
 * not an auth token.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  // Strip the "Bearer " prefix to isolate the raw JWT string
  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Type guard: only accept tokens that were explicitly issued as auth tokens.
    // Share tokens (type: 'share') must not pass this middleware.
    if (decoded.type !== 'auth') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};