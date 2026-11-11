/** Read a JSON body from a Vercel / Node request (Vercel may already have parsed it). */
export async function readJsonBody(req) {
  let body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body) && Object.keys(body).length) return body;
  if (typeof body === 'string') {
    try { return JSON.parse(body); } catch { return {}; }
  }
  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') : {};
  } catch {
    return {};
  }
}
