import dotenv from 'dotenv';

dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || '8080', 10),
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  FALLBACK_MODELS: [
    process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
  ],
  // Apps Script Web App URL of the cassava-only spreadsheet (see gas/Code.gs)
  GOOGLE_SHEETS_WEBHOOK_URL: process.env.GOOGLE_SHEETS_WEBHOOK_URL || '',
};
