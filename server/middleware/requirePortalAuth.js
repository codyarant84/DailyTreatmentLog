import { verifyToken } from '../lib/auth.js';

export function requirePortalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const payload = verifyToken(authHeader.slice(7));
    if (payload.sub !== 'portal') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.portalUser = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
