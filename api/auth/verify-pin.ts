import crypto from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';

type VercelReq = IncomingMessage & {
  body?: unknown;
};

const pinAttemptTracker = new Map<string, { count: number; resetAt: number }>();

async function readJsonBody(req: VercelReq): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelReq, res: ServerResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { valid: false, error: 'Metode tidak diizinkan.' });
  }

  const forwarded = req.headers['x-forwarded-for'];
  const clientIp =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const now = Date.now();
  const record = pinAttemptTracker.get(clientIp);
  if (record && now < record.resetAt && record.count >= 10) {
    const waitSec = Math.ceil((record.resetAt - now) / 1000);
    return sendJson(res, 429, {
      valid: false,
      error: `Terlalu banyak percobaan PIN. Coba lagi dalam ${waitSec} detik.`,
    });
  }

  const body = await readJsonBody(req);
  const rawPin = typeof body.pin === 'string' ? body.pin.trim() : '';
  const expectedPin = (process.env.VAULT_PIN || '505155').trim();

  if (!/^\d{6}$/.test(rawPin)) {
    return sendJson(res, 400, {
      valid: false,
      error: 'PIN harus terdiri dari 6 digit angka.',
    });
  }

  const pinBuf = Buffer.from(rawPin, 'utf8');
  const expectedBuf = Buffer.from(expectedPin, 'utf8');
  const isMatch =
    pinBuf.length === expectedBuf.length && crypto.timingSafeEqual(pinBuf, expectedBuf);

  if (!isMatch) {
    const nextCount = record && now < record.resetAt ? record.count + 1 : 1;
    pinAttemptTracker.set(clientIp, {
      count: nextCount,
      resetAt: record && now < record.resetAt ? record.resetAt : now + 5 * 60 * 1000,
    });
    return sendJson(res, 401, {
      valid: false,
      error: 'PIN salah. Periksa kembali 6 digit PIN Anda.',
    });
  }

  pinAttemptTracker.delete(clientIp);
  return sendJson(res, 200, { valid: true });
}
