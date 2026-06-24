import jwt from 'jsonwebtoken';

/**
 * Express middleware: JWT Bearer token authentication.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the token using
 * the server's JWT_SECRET, and attaches the decoded `userId` to `req` so that
 * downstream route handlers know which user is making the request.
 *
 * Returns 401 if the header is missing, malformed, or the token is invalid/expired.
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
    req.userId = decoded.userId; // Attach userId so routes don't need to re-decode
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};