const TREATMENT_CPT = {
  'Ice':       { code: '97010', description: 'Hot/Cold Packs',                    rate: 22 },
  'Heat':      { code: '97010', description: 'Hot/Cold Packs',                    rate: 22 },
  'Ultrasound':{ code: '97035', description: 'Ultrasound',                        rate: 35 },
  'E-Stim':   { code: '97014', description: 'Electrical Stimulation (unattended)',rate: 28 },
  'Massage':   { code: '97124', description: 'Massage Therapy',                   rate: 50 },
  'Cupping':   { code: '97039', description: 'Unlisted Therapeutic Procedure',    rate: 35 },
  'Exercise':  { code: '97110', description: 'Therapeutic Exercise',              rate: 55 },
};

const TAPING_CPT = {
  'Shoulder':        { code: '29240', description: 'Strapping — Shoulder',       rate: 28 },
  'Upper Arm':       { code: '29240', description: 'Strapping — Shoulder',       rate: 28 },
  'Elbow':           { code: '29260', description: 'Strapping — Elbow/Wrist',    rate: 26 },
  'Forearm':         { code: '29260', description: 'Strapping — Elbow/Wrist',    rate: 26 },
  'Wrist':           { code: '29260', description: 'Strapping — Elbow/Wrist',    rate: 26 },
  'Hand / Fingers':  { code: '29280', description: 'Strapping — Hand/Finger',    rate: 24 },
  'Hip':             { code: '29520', description: 'Strapping — Hip',             rate: 28 },
  'Groin':           { code: '29520', description: 'Strapping — Hip',             rate: 28 },
  'Quadriceps':      { code: '29530', description: 'Strapping — Knee',           rate: 30 },
  'Hamstring':       { code: '29530', description: 'Strapping — Knee',           rate: 30 },
  'Knee':            { code: '29530', description: 'Strapping — Knee',           rate: 30 },
  'Shin':            { code: '29540', description: 'Strapping — Ankle/Foot',     rate: 30 },
  'Ankle':           { code: '29540', description: 'Strapping — Ankle/Foot',     rate: 30 },
  'Foot / Toes':     { code: '29550', description: 'Strapping — Foot/Toes',      rate: 26 },
};

const TAPING_DEFAULT = { code: '29799', description: 'Strapping — Unlisted',     rate: 26 };

export function calculateSavings(treatmentType, bodyPart) {
  if (!treatmentType) return { total: 0, breakdown: [] };

  const types = treatmentType.split(',').map((t) => t.trim()).filter(Boolean);
  const breakdown = [];

  for (const type of types) {
    if (type === 'Taping') {
      const cpt = TAPING_CPT[bodyPart] ?? TAPING_DEFAULT;
      breakdown.push({ type, ...cpt });
    } else if (TREATMENT_CPT[type]) {
      breakdown.push({ type, ...TREATMENT_CPT[type] });
    }
  }

  const total = breakdown.reduce((sum, item) => sum + item.rate, 0);
  return { total, breakdown };
}

export function formatDollars(amount) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
}
