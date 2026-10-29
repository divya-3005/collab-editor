import jwt from 'jsonwebtoken';

/**
 * JWT authentication middleware.
 * Verifies bearer token and ensures it has the 'auth' type claim.
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