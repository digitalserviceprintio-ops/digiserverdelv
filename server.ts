import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const firebaseConfig = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'firebase-applet-config.json'), 'utf8')
) as { projectId: string };

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();

function resolveWritableStorageRoot(): string {
  const preferred = path.resolve(__dirname, '.digivault_storage');
  try {
    fs.mkdirSync(preferred, { recursive: true });
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    const fallback = path.join(os.tmpdir(), 'digivault_storage');
    fs.mkdirSync(fallback, { recursive: true });
    return fallback;
  }
}

const STORAGE_ROOT = resolveWritableStorageRoot();
const ALLOWED_BUCKETS = new Set(['digivault-files', 'digivault-receipts']);

const FILE_ALLOWED_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.webp', '.txt', '.zip',
]);

const RECEIPT_ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

const FILE_ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]);

const RECEIPT_ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'application/pdf',
]);

// Stable runtime secret derived from env or persisted local key file (never exposed to client)
function getSigningSecret(): string {
  if (process.env.VAULT_SIGNING_SECRET && process.env.VAULT_SIGNING_SECRET.length >= 16) {
    return process.env.VAULT_SIGNING_SECRET;
  }
  const secretPath = path.join(STORAGE_ROOT, '.signing_secret');
  try {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim();
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, generated, { mode: 0o600 });
    return generated;
  } catch {
    return crypto.createHash('sha256').update(firebaseConfig.projectId).digest('hex');
  }
}

const SIGNING_SECRET = getSigningSecret();

interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak: token autentikasi tidak ditemukan.' });
  }
  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Akses ditolak: token kosong.' });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email_verified) {
      return res.status(403).json({ error: 'Email akun belum terverifikasi.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(401).json({ error: 'Sesi tidak valid atau telah kedaluwarsa. Silakan login kembali.' });
  }
}

function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^\w.\-() ]+/g, '_').replace(/\s+/g, '_');
  return base.slice(0, 140) || 'dokumen';
}

function resolveSafeStoragePath(bucket: string, storagePath: string): string | null {
  if (!ALLOWED_BUCKETS.has(bucket)) return null;
  if (!storagePath || storagePath.includes('..') || storagePath.startsWith('/')) return null;
  const bucketRoot = path.resolve(STORAGE_ROOT, bucket);
  const resolved = path.resolve(bucketRoot, storagePath);
  if (!resolved.startsWith(bucketRoot + path.sep)) return null;
  return resolved;
}

interface SignedPayload {
  uid: string;
  bucket: string;
  storagePath: string;
  disposition: 'inline' | 'attachment';
  downloadName: string;
  exp: number;
}

function signAccessPayload(payload: SignedPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SIGNING_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyAccessToken(token: string): SignedPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SIGNING_SECRET).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SignedPayload;
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!ALLOWED_BUCKETS.has(payload.bucket)) return null;
    if (!payload.storagePath.startsWith(payload.uid + '/')) return null;
    return payload;
  } catch {
    return null;
  }
}

const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // Hard server cap 50MB; dynamic user cap checked per request
    files: 1,
  },
});

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'DigiVault', timestamp: new Date().toISOString() });
  });

  // In-memory rate limiter for PIN login attempts
  const pinAttemptTracker = new Map<string, { count: number; resetAt: number }>();

  app.post('/api/auth/verify-pin', (req: Request, res: Response) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const record = pinAttemptTracker.get(clientIp);
    if (record && now < record.resetAt && record.count >= 10) {
      const waitSec = Math.ceil((record.resetAt - now) / 1000);
      return res.status(429).json({
        valid: false,
        error: `Terlalu banyak percobaan PIN. Coba lagi dalam ${waitSec} detik.`,
      });
    }

    const rawPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    const expectedPin = (process.env.VAULT_PIN || '505155').trim();

    if (!/^\d{6}$/.test(rawPin)) {
      return res.status(400).json({
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
      return res.status(401).json({
        valid: false,
        error: 'PIN salah. Periksa kembali 6 digit PIN Anda.',
      });
    }

    pinAttemptTracker.delete(clientIp);
    return res.json({ valid: true });
  });

  // Upload file to private vault storage
  app.post('/api/vault/upload', requireAuth, (req: AuthRequest, res: Response) => {
    uploadMiddleware.single('file')(req, res, async (multerErr) => {
      if (multerErr) {
        if (multerErr instanceof multer.MulterError && multerErr.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'Ukuran file melebihi batas maksimal server (50 MB).' });
        }
        return res.status(400).json({ error: multerErr.message || 'Gagal memproses file upload.' });
      }

      try {
        const file = req.file;
        const bucket = String(req.body.bucket || '');
        const maxSizeMbRaw = Number(req.body.maxSizeMb || 20);
        const maxSizeMb = Number.isFinite(maxSizeMbRaw) ? Math.min(Math.max(maxSizeMbRaw, 1), 50) : 20;

        if (!file) {
          return res.status(400).json({ error: 'File wajib disertakan.' });
        }
        if (!ALLOWED_BUCKETS.has(bucket)) {
          return res.status(400).json({ error: 'Target bucket penyimpanan tidak valid.' });
        }
        if (file.size <= 0) {
          return res.status(400).json({ error: 'File kosong tidak dapat diunggah.' });
        }
        if (file.size > maxSizeMb * 1024 * 1024) {
          return res.status(413).json({
            error: `Ukuran file melebihi batas maksimal ${maxSizeMb} MB yang dikonfigurasi.`,
          });
        }

        const ext = path.extname(file.originalname).toLowerCase();
        const allowedExts = bucket === 'digivault-receipts' ? RECEIPT_ALLOWED_EXTS : FILE_ALLOWED_EXTS;
        const allowedMimes = bucket === 'digivault-receipts' ? RECEIPT_ALLOWED_MIMES : FILE_ALLOWED_MIMES;

        if (!allowedExts.has(ext)) {
          return res.status(415).json({
            error: `Format file ${ext || 'tanpa ekstensi'} tidak didukung pada penyimpanan ini.`,
          });
        }
        if (file.mimetype && !allowedMimes.has(file.mimetype)) {
          return res.status(415).json({
            error: `Tipe MIME (${file.mimetype}) tidak diizinkan.`,
          });
        }

        const uid = req.user!.uid;
        const safeName = sanitizeFileName(file.originalname);
        const uniqueKey = `${crypto.randomUUID()}_${safeName}`;
        const storagePath = `${uid}/${uniqueKey}`;
        const fullPath = resolveSafeStoragePath(bucket, storagePath);

        if (!fullPath) {
          return res.status(400).json({ error: 'Path penyimpanan tidak valid.' });
        }

        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, file.buffer);

        return res.status(201).json({
          bucket,
          storagePath,
          originalName: file.originalname,
          mimeType: file.mimetype || 'application/octet-stream',
          fileSize: file.size,
        });
      } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: 'Terjadi kesalahan saat menyimpan file ke vault.' });
      }
    });
  });

  // Generate short-lived signed URL for private preview or download
  app.post('/api/vault/signed-url', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { bucket, storagePath, disposition = 'inline', downloadName } = req.body || {};
      if (!ALLOWED_BUCKETS.has(bucket) || typeof storagePath !== 'string') {
        return res.status(400).json({ error: 'Parameter signed URL tidak valid.' });
      }

      const uid = req.user!.uid;
      if (!storagePath.startsWith(`${uid}/`)) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin mengakses file ini.' });
      }

      const fullPath = resolveSafeStoragePath(bucket, storagePath);
      if (!fullPath) {
        return res.status(400).json({ error: 'Path file tidak valid.' });
      }

      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'File fisik tidak ditemukan di private vault storage.' });
      }

      const safeDisposition = disposition === 'attachment' ? 'attachment' : 'inline';
      const safeDownloadName = sanitizeFileName(typeof downloadName === 'string' && downloadName ? downloadName : path.basename(storagePath));
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes TTL

      const token = signAccessPayload({
        uid,
        bucket,
        storagePath,
        disposition: safeDisposition,
        downloadName: safeDownloadName,
        exp: expiresAt,
      });

      return res.json({
        signedUrl: `/api/vault/access?token=${encodeURIComponent(token)}`,
        expiresAt,
      });
    } catch (error) {
      console.error('Signed URL error:', error);
      return res.status(500).json({ error: 'Gagal membuat signed URL akses file.' });
    }
  });

  // Serve file via verified signed URL only (private bucket protection)
  app.get('/api/vault/access', (req: Request, res: Response) => {
    const token = String(req.query.token || '');
    const payload = verifyAccessToken(token);
    if (!payload) {
      return res.status(403).json({ error: 'Signed URL tidak valid atau telah kedaluwarsa.' });
    }

    const fullPath = resolveSafeStoragePath(payload.bucket, payload.storagePath);
    if (!fullPath || !fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Dokumen tidak ditemukan.' });
    }

    const ext = path.extname(fullPath).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.txt': 'text/plain; charset=utf-8',
      '.zip': 'application/zip',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };

    res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `${payload.disposition}; filename="${payload.downloadName}"`
    );
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    return res.sendFile(fullPath);
  });

  // Restore file to local server cache from client-verified Firestore chunks (cross-device sync)
  app.post('/api/vault/restore', requireAuth, (req: AuthRequest, res: Response) => {
    uploadMiddleware.single('file')(req, res, async (multerErr) => {
      if (multerErr) {
        return res.status(400).json({ error: multerErr.message || 'Gagal memulihkan file.' });
      }
      try {
        const file = req.file;
        const bucket = String(req.body.bucket || '');
        const storagePath = String(req.body.storagePath || '');
        const uid = req.user!.uid;

        if (!file || !ALLOWED_BUCKETS.has(bucket) || !storagePath.startsWith(`${uid}/`)) {
          return res.status(403).json({ error: 'Permintaan pemulihan file tidak valid.' });
        }

        const fullPath = resolveSafeStoragePath(bucket, storagePath);
        if (!fullPath) {
          return res.status(400).json({ error: 'Path penyimpanan tidak valid.' });
        }

        await fsp.mkdir(path.dirname(fullPath), { recursive: true });
        await fsp.writeFile(fullPath, file.buffer);
        return res.status(200).json({ restored: true });
      } catch (error) {
        console.error('Restore error:', error);
        return res.status(500).json({ error: 'Gagal memulihkan file ke cache server.' });
      }
    });
  });

  // Delete physical file from private storage after metadata & ownership validation
  app.post('/api/vault/delete', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { bucket, storagePath } = req.body || {};
      if (!ALLOWED_BUCKETS.has(bucket) || typeof storagePath !== 'string') {
        return res.status(400).json({ error: 'Parameter penghapusan tidak valid.' });
      }

      const uid = req.user!.uid;
      if (!storagePath.startsWith(`${uid}/`)) {
        return res.status(403).json({ error: 'Anda tidak memiliki izin menghapus file ini.' });
      }

      const fullPath = resolveSafeStoragePath(bucket, storagePath);
      if (!fullPath) {
        return res.status(400).json({ error: 'Path penyimpanan tidak valid.' });
      }

      if (fs.existsSync(fullPath)) {
        await fsp.unlink(fullPath);
      }

      return res.json({ deleted: true });
    } catch (error) {
      console.error('Delete file error:', error);
      return res.status(500).json({ error: 'Gagal menghapus file fisik dari vault storage.' });
    }
  });

  app.use('/api/*', (_req, res) => {
    return res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result) return next();
        const patched = result.code
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled in AI Studio preview */'
          )
          .replace(
            'else throw new SendBeforeConnectError("send was called before connect");',
            'else return;'
          )
          .replace(
            'else throw new SendBeforeConnectError("invoke was called before connect");',
            'else return;'
          );
        res.setHeader('Content-Type', 'application/javascript');
        return res.send(patched);
      } catch {
        return next();
      }
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DigiVault server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
