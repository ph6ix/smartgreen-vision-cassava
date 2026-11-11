import { CONFIG } from './config.js';

/** POST one cassava result row to the cassava-only Apps Script webhook. Returns true when sent. */
export async function sendToGoogleSheets(entry) {
  if (!CONFIG.GOOGLE_SHEETS_WEBHOOK_URL) {
    console.log('[Google Sheets] GOOGLE_SHEETS_WEBHOOK_URL not configured');
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(CONFIG.GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } finally {
    clearTimeout(timer);
  }
}

/** Keep only known, string-ish fields so arbitrary payloads can't be written to the sheet. */
const FIELDS = [
  'timestamp', 'traceId', 'isDemo', 'customerName', 'inspectorName', 'plantAge', 'plantingSeason', 'variety', 'province', 'coordinates',
  'soilType', 'waterStatus', 'soilPh', 'yieldPerRai', 'lastFertilizer', 'observedSymptoms', 'healthScore',
  'primaryIssue', 'nutrientSummary', 'diseaseSummary', 'fertilizerSummary', 'productSummary', 'urgentActions',
  'overallSummary', 'recommendedNextStep', 'confidence',
];

export function sanitizeSheetEntry(input) {
  const out = {};
  for (const k of FIELDS) {
    const v = input && input[k];
    out[k] = v === undefined || v === null ? '' : String(v).slice(0, 2000);
  }
  return out;
}
