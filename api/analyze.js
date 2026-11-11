import { handleCassavaRequest } from '../lib/cassavaService.js';
import { readJsonBody } from '../lib/readBody.js';

export const config = {
  api: { bodyParser: { sizeLimit: '4.5mb' } },
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { status, body } = await handleCassavaRequest(await readJsonBody(req));
  return res.status(status).json(body);
}
