/**
 * Call Gemini through a pool of models, retrying when Google is busy.
 *
 * Gemini answers 503 "high demand" / 429 quickly when it is overloaded. Trying every model
 * once back-to-back usually hits the same spike, so after a full pass of busy answers we
 * wait (1.5 s, 3 s, 6 s… with jitter) and go round again, as long as the time budget allows.
 * Models that do not exist (404) are dropped for later rounds.
 *
 * call(model, timeoutMs) must return the model's text (or throw).
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isBusyError(err) {
  const msg = String((err && (err.message || err.status)) || err || '');
  return /\b(429|500|502|503|504)\b|UNAVAILABLE|RESOURCE_EXHAUSTED|INTERNAL|high demand|overloaded|try again later|Timeout/i.test(msg);
}

function isMissingModel(err) {
  const msg = String((err && err.message) || err || '');
  return /\b404\b|NOT_FOUND|is not found|not supported/i.test(msg);
}

export async function callWithModelRetry(call, models, { timeoutMs = 20000, totalBudgetMs = 50000, traceId = '', log = console } = {}) {
  const deadline = Date.now() + totalBudgetMs;
  let pool = [...new Set(models.filter(Boolean))];
  let lastError = null;

  for (let round = 0; pool.length; round++) {
    let allBusy = true;
    for (const model of pool.slice()) {
      const remaining = deadline - Date.now();
      if (remaining < 3000) throw lastError || new Error('หมดเวลาประมวลผล AI');
      const attemptMs = Math.min(timeoutMs, remaining);
      let timer;
      try {
        log.log(`[${traceId}] Gemini ${model} (round ${round + 1})`);
        const text = await Promise.race([
          call(model, attemptMs),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Timeout ${Math.round(attemptMs / 1000)}s on model ${model}`)), attemptMs);
          }),
        ]);
        if (text) {
          log.log(`[${traceId}] Success with model: ${model}`);
          return text;
        }
        lastError = new Error(`Empty response from ${model}`);
      } catch (err) {
        lastError = err;
        log.warn(`[${traceId}] Model ${model} failed:`, String(err && err.message).substring(0, 120));
        if (isMissingModel(err)) pool = pool.filter((m) => m !== model);
        else if (!isBusyError(err)) allBusy = false;
      } finally {
        clearTimeout(timer);
      }
    }
    if (!allBusy) break; // a real error (bad request, bad key): retrying will not help
    const wait = Math.min(6000, 1500 * 2 ** round) + Math.floor(Math.random() * 500);
    if (deadline - Date.now() < wait + 5000) break;
    log.log(`[${traceId}] Gemini busy, retrying in ${wait} ms`);
    await sleep(wait);
  }
  throw lastError || new Error('ไม่สามารถประมวลผลผ่านโมเดล Gemini ได้');
}

export const BUSY_MESSAGE_TH = 'ระบบ AI ของ Google มีผู้ใช้งานหนาแน่นชั่วคราว กรุณากด "เริ่มวิเคราะห์ด้วย AI" อีกครั้งในอีก 1-2 นาที (ภาพและข้อมูลยังอยู่ครบ)';
