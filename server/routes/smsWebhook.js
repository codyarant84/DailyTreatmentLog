import express from 'express';
import twilio from 'twilio';
import { query } from '../lib/db.js';
import { logActivity } from '../middleware/logActivity.js';

const router = express.Router();

// Coarse body-part set for the SMS parsing prompt — intentionally simpler
// than the injury form's BODY_PARTS list (client/src/lib/constants.js),
// since body_part is a free-text column and the AT reviews/edits the draft
// in the app anyway; SelectWithOther falls back to "Other" for any value
// outside its own option list, so this mismatch never breaks anything.
const BODY_PARTS = ['Head', 'Neck', 'Shoulder', 'Elbow', 'Wrist/Hand', 'Back', 'Hip', 'Knee', 'Ankle/Foot', 'Other'];

function escapeLike(str) {
  return str.replace(/[%_\\]/g, (c) => `\\${c}`);
}

function todayDateStr() {
  return new Date().toISOString().split('T')[0];
}

// Calls Claude to extract structured injury data from the raw SMS text.
// Returns null on any failure (missing key, HTTP error, unparseable JSON).
async function parseInjuryMessage(message) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('[sms-webhook] ANTHROPIC_API_KEY not configured');
    return null;
  }

  const prompt = `Parse this athletic trainer's injury report and extract structured data.
Message: "${message}"

Return ONLY a JSON object with these fields:
{
  "athlete_name": "full name or null",
  "body_part": "one of: Head, Neck, Shoulder, Elbow, Wrist/Hand, Back, Hip, Knee, Ankle/Foot, Other",
  "injury_type": "brief description",
  "sport": "sport name or null",
  "notes": "any additional details"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('[sms-webhook] Anthropic error:', response.status, JSON.stringify(data));
      return null;
    }

    const text = (data.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const cleaned = text.replace(/```json|```/g, '').trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch (err) {
    console.error('[sms-webhook] parseInjuryMessage error:', err.message);
    return null;
  }
}

// POST /api/sms/incoming — Twilio webhook, no auth middleware (Twilio calls
// this directly). Signature validated via twilio.webhook(), which requires
// req.body to already be the parsed application/x-www-form-urlencoded
// object — NOT a raw buffer. See server/app.js for why this is mounted
// after the app's normal express.urlencoded() middleware rather than before.
router.post('/incoming', twilio.webhook(), async (req, res) => {
  const from = req.body.From;
  const messageBody = (req.body.Body || '').trim();

  const twiml = new twilio.twiml.MessagingResponse();
  function reply(message) {
    twiml.message(message);
    res.type('text/xml').send(twiml.toString());
  }

  if (!from) {
    return reply('Could not parse your message. Please try again or log the injury manually at fieldsidehealth.com.');
  }

  try {
    const { rows: atRows } = await query(
      `SELECT profile_id, school_id FROM at_phone_numbers WHERE phone_number = $1 AND verified = true`,
      [from]
    );
    const at = atRows[0];

    if (!at) {
      return reply('This number is not registered with Fieldside. Log in at fieldsidehealth.com to register your phone number.');
    }

    const parsed = messageBody ? await parseInjuryMessage(messageBody) : null;
    if (!parsed) {
      return reply('Could not parse your message. Please try again or log the injury manually at fieldsidehealth.com.');
    }

    const bodyPart = BODY_PARTS.includes(parsed.body_part) ? parsed.body_part : 'Other';
    const injuryType = parsed.injury_type?.trim() || 'Unspecified';
    const reportedName = parsed.athlete_name?.trim() || null;

    // Match athlete by name within the school — case-insensitive, partial.
    // injuries has no sport column of its own (sport is always derived via
    // the athlete join elsewhere in the app — see INJURY_SELECT in
    // injuries.js), so the parsed sport is used only to disambiguate
    // multiple name matches, not stored redundantly on the injury row.
    let athleteId = null;
    let athleteName = null;
    let multipleMatches = false;

    if (reportedName) {
      const { rows: matches } = await query(
        `SELECT id, name, sport FROM athletes
         WHERE school_id = $1 AND name ILIKE $2 AND (archived = false OR archived IS NULL)
         ORDER BY name LIMIT 10`,
        [at.school_id, `%${escapeLike(reportedName)}%`]
      );

      if (matches.length > 0) {
        multipleMatches = matches.length > 1;
        const bySport = parsed.sport
          ? matches.find((m) => m.sport?.toLowerCase() === parsed.sport.toLowerCase())
          : null;
        const chosen = bySport ?? matches[0];
        athleteId = chosen.id;
        athleteName = chosen.name;
      }
    }

    const noteParts = [];
    if (parsed.notes?.trim()) noteParts.push(parsed.notes.trim());
    if (!athleteId) {
      noteParts.push(`[SMS draft] Reported athlete: "${reportedName ?? 'not given'}"${parsed.sport ? ` (${parsed.sport})` : ''} — no roster match found.`);
    } else if (multipleMatches) {
      noteParts.push(`[SMS draft] Multiple roster matches for "${reportedName}" — assigned to ${athleteName}; please verify.`);
    }

    const { rows: injuryRows } = await query(
      `INSERT INTO injuries
         (athlete_id, school_id, logged_by, injury_date, body_part, injury_type,
          notes, is_active, logged_via_sms, rtp_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, 'Out')
       RETURNING id`,
      [athleteId, at.school_id, at.profile_id, todayDateStr(), bodyPart, injuryType,
       noteParts.join('\n\n') || null]
    );

    logActivity({
      schoolId: at.school_id, profileId: at.profile_id,
      action: 'injury.created_via_sms', entityType: 'injury', entityId: injuryRows[0].id,
    });

    if (athleteId) {
      return reply(`Draft injury logged for ${athleteName} — ${bodyPart} ${injuryType}. Log in to fieldsidehealth.com to review and complete the record.`);
    }
    return reply(`Injury logged as draft — athlete '${reportedName ?? 'unknown'}' not found in your roster. Log in to fieldsidehealth.com to assign it to the correct athlete.`);
  } catch (err) {
    console.error('POST /sms/incoming error:', err.message);
    return reply('Could not parse your message. Please try again or log the injury manually at fieldsidehealth.com.');
  }
});

export default router;
