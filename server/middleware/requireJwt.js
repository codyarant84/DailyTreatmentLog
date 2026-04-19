import { verifyToken } from '../lib/auth.js';

// OLD: Supabase JWT verification (no profile check — used before profile exists)
// import { supabase } from '../lib/supabase.js';
// export async function requireJwt(req, res, next) {
//   const token = req.headers.authorization?.slice(7);
//   const { data: { user }, error } = await supabase.auth.getUser(token);
//   if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
//   req.userId = user.id;
//   next();
// }

// Now an alias for requireAuth — token already contains schoolId and role.
export function requireJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const payload = verifyToken(authHeader.slice(7));
    req.userId   = payload.userId;
    req.schoolId = payload.schoolId;
    req.role     = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
