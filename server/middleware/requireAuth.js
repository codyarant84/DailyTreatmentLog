import { supabase } from '../lib/supabase.js';

// Verifies the JWT and fetches the user's school_id from their profile.
// Attaches req.userId and req.schoolId for use in route handlers.
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(403).json({ error: 'User profile not found. Please complete signup.' });
  }

  req.userId = user.id;
  req.schoolId = profile.school_id;
  next();
}
