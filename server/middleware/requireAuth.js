import { verifyToken } from '../lib/auth.js';

// OLD: Supabase JWT verification + profile lookup
// import { supabase } from '../lib/supabase.js';
// export async function requireAuth(req, res, next) {
//   const token = req.headers.authorization?.slice(7);
//   const { data: { user }, error } = await supabase.auth.getUser(token);
//   if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
//   const { data: profile } = await supabase.from('profiles').select('school_id').eq('id', user.id).single();
//   if (!profile) return res.status(403).json({ error: 'User profile not found. Please complete signup.' });
//   req.userId = user.id;
//   req.schoolId = profile.school_id;
//   next();
// }

// Verifies our custom JWT. userId, schoolId, and role are embedded in the token payload —
// no extra DB round-trip needed on every request.
export function requireAuth(req, res, next) {
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
