import { sendToGoogleSheets, sanitizeSheetEntry } from '../lib/sheets.js';
import { readJsonBody } from '../lib/readBody.js';

export const config = { maxDuration: 25 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const sent = await sendToGoogleSheets(sanitizeSheetEntry(await readJsonBody(req)));
    return res.status(200).json({ success: true, sheetUpdated: sent });
  } catch (err) {
    console.error('[save-sheet] failed:', err);
    return res.status(502).json({ error: `ส่งข้อมูลไป Google Sheets ไม่สำเร็จ: ${err.message}` });
  }
}
