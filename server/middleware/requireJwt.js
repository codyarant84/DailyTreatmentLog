import { supabase } from '../lib/supabase.js';

// Verifies the Supabase JWT — does NOT require a profile to exist.
// Use this for endpoints that run before a profile is created (e.g. setup-profile).
export async function requireJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.userId = user.id;
  next();
}
