import twilio from 'twilio';

function toE164(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10)                          return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return raw.startsWith('+') ? raw : `+${digits}`;
}

export async function sendSMS(to, body) {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from  = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    throw new Error('Twilio not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env');
  }
  const client = twilio(sid, token);
  return client.messages.create({ body, from, to: toE164(to) });
}
