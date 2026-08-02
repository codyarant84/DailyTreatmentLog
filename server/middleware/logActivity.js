import { query } from '../lib/db.js';

export function logActivity({ schoolId, profileId = null, action, entityType = null, entityId = null, metadata = null }) {
  query(
    `INSERT INTO activity_log (school_id, profile_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      schoolId   ?? null,
      profileId  ?? null,
      action,
      entityType ?? null,
      entityId   ?? null,
      metadata   ? JSON.stringify(metadata) : null,
    ]
  ).catch((err) => console.error('[logActivity] insert failed:', action, err.message));
}
