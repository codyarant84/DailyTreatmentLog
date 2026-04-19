import { Router } from 'express';
import { query, pool } from '../lib/db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { calculateLoadHistory } from '../lib/gpsCalculations.js';

const router = Router();
router.use(requireAuth);

// ── GET /api/gps/dashboard ────────────────────────────────────────────────────
router.get('/dashboard', async (req, res) => {
  const { schoolId } = req;
  try {
    const [athleteRes, historyRes, typeRes, latestSessRes, insightRes, schoolRes] = await Promise.all([
      query('SELECT * FROM gps_athletes WHERE school_id = $1 ORDER BY name', [schoolId]),
      query(
        `SELECT DISTINCT ON (athlete_id) *
         FROM gps_load_history
         WHERE school_id = $1
         ORDER BY athlete_id, week_start DESC`,
        [schoolId]
      ),
      query(
        `SELECT athlete_id, session_type
         FROM gps_sessions
         WHERE school_id = $1 AND data_recorded = true AND session_type IS NOT NULL`,
        [schoolId]
      ),
      query(
        `SELECT DISTINCT ON (athlete_id) athlete_id, new_top_speed
         FROM gps_sessions
         WHERE school_id = $1 AND data_recorded = true
         ORDER BY athlete_id, session_date DESC`,
        [schoolId]
      ),
      query(
        `SELECT insights FROM gps_insights WHERE school_id = $1 ORDER BY generated_at DESC LIMIT 1`,
        [schoolId]
      ),
      query('SELECT name FROM schools WHERE id = $1', [schoolId]),
    ]);

    // Most recent load history per athlete (DISTINCT ON already handles this)
    const historyMap = {};
    historyRes.rows.forEach((h) => { historyMap[h.athlete_id] = h; });

    // Most recent session per athlete — for new_top_speed flag
    const latestSessMap = {};
    latestSessRes.rows.forEach((s) => { latestSessMap[s.athlete_id] = s; });

    // session_type → [athlete_ids] (arrays, not Sets, for JSON serializability)
    const sessionTypeIds = {};
    typeRes.rows.forEach(({ athlete_id, session_type }) => {
      if (!sessionTypeIds[session_type]) sessionTypeIds[session_type] = [];
      if (!sessionTypeIds[session_type].includes(athlete_id)) {
        sessionTypeIds[session_type].push(athlete_id);
      }
    });

    const athletes = athleteRes.rows.map((a) => ({
      ...a,
      ...(historyMap[a.id] ?? {}),
      new_top_speed: latestSessMap[a.id]?.new_top_speed ?? false,
    }));

    res.json({
      athletes,
      sessionTypeIds,
      schoolName: schoolRes.rows[0]?.name ?? '',
      insights:   insightRes.rows[0]?.insights ?? [],
    });
  } catch (err) {
    console.error('[GET /api/gps/dashboard]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/gps/sessions/:athleteId ─────────────────────────────────────────
router.get('/sessions/:athleteId', async (req, res) => {
  const { schoolId } = req;
  const { athleteId } = req.params;
  try {
    const { rows } = await query(
      `SELECT * FROM gps_sessions
       WHERE school_id = $1 AND athlete_id = $2
       ORDER BY session_date DESC
       LIMIT 10`,
      [schoolId, athleteId]
    );
    res.json(rows);
  } catch (err) {
    console.error('[GET /api/gps/sessions/:athleteId]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/gps/import ──────────────────────────────────────────────────────
// Body: { athletes, sessions, zeroData, batchInfo }
// athletes  – array of athlete objects (id, name, position, sport, team, max_speed_mph)
// sessions  – array of session rows with data
// zeroData  – array of session rows with no data recorded
// batchInfo – { filename, rows_total, rows_imported, rows_skipped, rows_zero_data }
router.post('/import', async (req, res) => {
  const { schoolId, userId } = req;
  const { athletes: athleteArr, sessions, zeroData, batchInfo } = req.body;

  if (!Array.isArray(athleteArr) || !Array.isArray(sessions) || !Array.isArray(zeroData) || !batchInfo) {
    return res.status(400).json({ error: 'Invalid import payload' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert batch record
    const { rows: [batchRow] } = await client.query(
      `INSERT INTO gps_import_batches
         (filename, rows_total, rows_imported, rows_skipped, rows_zero_data, imported_by, school_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        batchInfo.filename,
        batchInfo.rows_total,
        batchInfo.rows_imported,
        batchInfo.rows_skipped,
        batchInfo.rows_zero_data,
        userId,
        schoolId,
      ]
    );
    const batchId = batchRow.id;

    // 2. Replace athletes for this import set
    if (athleteArr.length > 0) {
      const athleteIds = athleteArr.map((a) => a.id);
      await client.query(
        `DELETE FROM gps_athletes WHERE school_id = $1 AND id = ANY($2)`,
        [schoolId, athleteIds]
      );
      const athCols = ['id', 'school_id', 'name', 'position', 'sport', 'team', 'max_speed_mph'];
      const athValues = [];
      const athParams = [];
      let p = 1;
      for (const a of athleteArr) {
        athValues.push(`($${p}, $${p+1}, $${p+2}, $${p+3}, $${p+4}, $${p+5}, $${p+6})`);
        athParams.push(
          a.id, schoolId,
          a.name       ?? null,
          a.position   ?? null,
          a.sport      ?? null,
          a.team       ?? null,
          a.max_speed_mph ?? null
        );
        p += 7;
      }
      await client.query(
        `INSERT INTO gps_athletes (${athCols.join(', ')}) VALUES ${athValues.join(', ')}`,
        athParams
      );
    }

    // 3. Replace sessions for these athletes
    const allSessions = [...sessions, ...zeroData];
    if (athleteArr.length > 0) {
      const athleteIds = athleteArr.map((a) => a.id);
      await client.query(
        `DELETE FROM gps_sessions WHERE school_id = $1 AND athlete_id = ANY($2)`,
        [schoolId, athleteIds]
      );
    }
    if (allSessions.length > 0) {
      const sesCols = [
        'athlete_id', 'school_id', 'import_batch_id',
        'session_date', 'week_start_date', 'session_type', 'data_recorded',
        'session_load', 'distance_yds', 'hi_running_yds', 'sprint_distance_yds',
        'new_top_speed', 'top_speed_mph', 'num_sprints', 'accelerations', 'decelerations',
      ];
      const NUM_COLS = sesCols.length; // 16
      const CHUNK = 100;
      for (let i = 0; i < allSessions.length; i += CHUNK) {
        const chunk = allSessions.slice(i, i + CHUNK);
        const sesValues = [];
        const sesParams = [];
        let p = 1;
        for (const s of chunk) {
          const placeholders = Array.from({ length: NUM_COLS }, (_, k) => `$${p + k}`).join(', ');
          sesValues.push(`(${placeholders})`);
          sesParams.push(
            s.athlete_id, schoolId, batchId,
            s.session_date       ?? null,
            s.week_start_date    ?? null,
            s.session_type       ?? null,
            s.data_recorded      ?? false,
            s.session_load       ?? null,
            s.distance_yds       ?? null,
            s.hi_running_yds     ?? null,
            s.sprint_distance_yds ?? null,
            s.new_top_speed      ?? false,
            s.top_speed_mph      ?? null,
            s.num_sprints        ?? null,
            s.accelerations      ?? null,
            s.decelerations      ?? null
          );
          p += NUM_COLS;
        }
        await client.query(
          `INSERT INTO gps_sessions (${sesCols.join(', ')}) VALUES ${sesValues.join(', ')}`,
          sesParams
        );
      }
    }

    // 4. Recalculate load history per athlete from the sessions we just imported
    const sessionsByAthlete = {};
    for (const s of allSessions) {
      if (!sessionsByAthlete[s.athlete_id]) sessionsByAthlete[s.athlete_id] = [];
      sessionsByAthlete[s.athlete_id].push(s);
    }

    const lhCols = [
      'athlete_id', 'school_id', 'week_start',
      'weekly_distance_yds', 'weekly_session_load', 'weekly_hi_yds',
      'weekly_sprint_yds', 'weekly_sessions',
      'acute_load', 'chronic_load', 'acwr', 'risk_status',
    ];

    for (const a of athleteArr) {
      const athSessions = sessionsByAthlete[a.id] ?? [];
      const isInSeason  = athSessions.some((s) => s.session_type === 'Match Session');
      const history     = calculateLoadHistory(a.id, athSessions, isInSeason).map((h) => ({
        ...h,
        school_id: schoolId,
      }));

      if (history.length === 0) continue;

      await client.query(
        `DELETE FROM gps_load_history WHERE school_id = $1 AND athlete_id = $2`,
        [schoolId, a.id]
      );

      const lhValues = [];
      const lhParams = [];
      let p = 1;
      for (const h of history) {
        const placeholders = Array.from({ length: lhCols.length }, (_, k) => `$${p + k}`).join(', ');
        lhValues.push(`(${placeholders})`);
        lhParams.push(
          h.athlete_id,          h.school_id,           h.week_start,
          h.weekly_distance_yds, h.weekly_session_load, h.weekly_hi_yds,
          h.weekly_sprint_yds,   h.weekly_sessions,
          h.acute_load,          h.chronic_load,        h.acwr,  h.risk_status
        );
        p += lhCols.length;
      }
      await client.query(
        `INSERT INTO gps_load_history (${lhCols.join(', ')}) VALUES ${lhValues.join(', ')}`,
        lhParams
      );
    }

    await client.query('COMMIT');

    res.json({
      success:          true,
      batchId,
      athletesImported: athleteArr.length,
      sessionsImported: sessions.length,
      zeroDataSessions: zeroData.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/gps/import]', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── POST /api/gps/insights ────────────────────────────────────────────────────
router.post('/insights', async (req, res) => {
  const { schoolId } = req;
  const { insights } = req.body;
  if (!Array.isArray(insights)) {
    return res.status(400).json({ error: 'insights must be an array' });
  }
  try {
    await query(
      `INSERT INTO gps_insights (insights, school_id) VALUES ($1, $2)`,
      [JSON.stringify(insights), schoolId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[POST /api/gps/insights]', err);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/gps/insights ─────────────────────────────────────────────────────
router.get('/insights', async (req, res) => {
  const { schoolId } = req;
  try {
    const { rows } = await query(
      `SELECT insights FROM gps_insights WHERE school_id = $1 ORDER BY generated_at DESC LIMIT 1`,
      [schoolId]
    );
    res.json(rows[0]?.insights ?? []);
  } catch (err) {
    console.error('[GET /api/gps/insights]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
