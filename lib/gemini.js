import { GoogleGenAI } from '@google/genai';
import { CONFIG } from './config.js';
import { callWithModelRetry } from './modelRetry.js';

let aiClient = null;

function getAiClient() {
  if (!aiClient) {
    if (!CONFIG.GEMINI_API_KEY) {
      throw new Error('ยังไม่ได้กำหนด GEMINI_API_KEY (กรุณาตั้งค่าใน Vercel Environment Variables หรือไฟล์ .env)');
    }
    aiClient = new GoogleGenAI({ apiKey: CONFIG.GEMINI_API_KEY });
  }
  return aiClient;
}

/** Normalize SmartGreen product spelling in AI text. */
export function normalizeSmartGreenProductText(text) {
  if (!text || typeof text !== 'string') return text;
  return text
    .replace(/เพาเวอร์\s*กรีน/g, 'พาวเวอร์กรีน')
    .replace(/พาวเวอร์\s+กรีน/g, 'พาวเวอร์กรีน')
    .replace(/สมาร์ท\s+เอ็น/g, 'สมาร์ทเอ็น')
    .replace(/สมาร์ท\s+นาโน/g, 'สมาร์ทนาโน')
    .replace(/สมาร์ท\s+ยิลด์/g, 'สมาร์ทยิลด์')
    .replace(/สมาร์ท\s+กรีน/g, 'สมาร์ทกรีน')
    .replace(/สมาร์ท\s+ไบโอ/g, 'สมาร์ทไบโอ')
    .replace(/สมาร์ท-ไบโอ/g, 'สมาร์ทไบโอ');
}

/**
 * Calls Gemini with a fallback model pool and parses a JSON reply.
 * Retries with backoff while Google answers "busy" (see modelRetry.js).
 * timeoutMs caps each model attempt; totalBudgetMs caps the whole call
 * (keeps us under Vercel's 60s function limit).
 */
export async function generateJsonWithFallback(contents, traceId, { timeoutMs = 22000, totalBudgetMs = 55000 } = {}) {
  const client = getAiClient();
  const text = await callWithModelRetry(async (model) => {
    const response = await client.models.generateContent({
      model,
      contents,
      config: { temperature: 0.2, responseMimeType: 'application/json' },
    });
    return response && response.text;
  }, CONFIG.FALLBACK_MODELS, { timeoutMs, totalBudgetMs, traceId });

  const raw = text || '';
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
  }
}
