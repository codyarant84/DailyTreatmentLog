import { verifyToken } from '../lib/auth.js';

// OLD: Supabase JWT verification + is_admin check
// import { supabase } from '../lib/supabase.js';
// export async function requireAdmin(req, res, next) {
//   const token = req.headers.authorization?.slice(7);
//   const { data: { user }, error } = await supabase.auth.getUser(token);
//   if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
//   const { data: profile } = await supabase.from('profiles').select('is_admin, role').eq('id', user.id).single();
//   if (!profile?.is_admin) return res.status(403).json({ error: 'Admin access required' });
//   req.userId = user.id;
//   req.role   = profile.role ?? 'trainer';
//   next();
// }

// isAdmin is embedded in the JWT payload at login time.
export function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const payload = verifyToken(authHeader.slice(7));
    if (!payload.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.userId   = payload.userId;
    req.schoolId = payload.schoolId;
    req.role     = payload.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
