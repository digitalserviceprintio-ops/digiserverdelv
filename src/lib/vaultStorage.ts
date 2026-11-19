import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { VaultBucket } from '../types';

export interface UploadedVaultFile {
  bucket: VaultBucket;
  storagePath: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
}

const CHUNK_BYTE_SIZE = 450 * 1024; // 450 KB raw -> ~600 KB base64 (safely below Firestore 1 MB doc limit)

const FILE_ALLOWED_EXTS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.jpg', '.jpeg', '.png', '.webp', '.txt', '.zip',
]);

const RECEIPT_ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.pdf']);

const MIME_BY_EXT: Record<string, string> = {
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

function getExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx).toLowerCase() : '';
}

function inferMimeType(fileNameOrPath: string, fallback = 'application/octet-stream'): string {
  const ext = getExtension(fileNameOrPath);
  return MIME_BY_EXT[ext] || fallback;
}

function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() || 'dokumen';
  return base.replace(/[^\w.\-() ]+/g, '_').replace(/\s+/g, '_').slice(0, 140) || 'dokumen';
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function persistChunksToFirestore(
  uid: string,
  bucket: VaultBucket,
  storagePath: string,
  file: File
): Promise<void> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const totalChunks = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTE_SIZE));

  // Commit in batches of 5 chunks to stay comfortably below Firestore 10 MiB write request cap
  const BATCH_LIMIT = 5;
  for (let start = 0; start < totalChunks; start += BATCH_LIMIT) {
    const batch = writeBatch(db);
    const end = Math.min(totalChunks, start + BATCH_LIMIT);
    for (let idx = start; idx < end; idx++) {
      const slice = bytes.subarray(idx * CHUNK_BYTE_SIZE, (idx + 1) * CHUNK_BYTE_SIZE);
      const dataBase64 = uint8ToBase64(slice);
      const chunkRef = doc(collection(db, 'vaultChunks'));
      batch.set(chunkRef, {
        userId: uid,
        bucket,
        storagePath,
        chunkIndex: idx,
        totalChunks,
        dataBase64,
        createdAt: serverTimestamp(),
      });
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'vaultChunks');
    }
  }
}

async function reconstructFileFromFirestore(
  uid: string,
  storagePath: string,
  mimeType = 'application/octet-stream'
): Promise<Blob | null> {
  try {
    const q = query(
      collection(db, 'vaultChunks'),
      where('userId', '==', uid),
      where('storagePath', '==', storagePath)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const chunks = snap.docs
      .map((d) => d.data() as { chunkIndex: number; totalChunks: number; dataBase64: string })
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    const arrays = chunks.map((c) => base64ToUint8(c.dataBase64));
    const totalLen = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const merged = new Uint8Array(totalLen);
    let offset = 0;
    for (const arr of arrays) {
      merged.set(arr, offset);
      offset += arr.length;
    }
    return new Blob([merged], { type: mimeType });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'vaultChunks');
  }
}

export async function uploadToVault(
  file: File,
  bucket: VaultBucket,
  maxSizeMb: number
): Promise<UploadedVaultFile> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sesi autentikasi tidak ditemukan. Silakan login kembali.');
  }

  const safeLimitMb = Math.min(Math.max(maxSizeMb || 20, 1), 50);
  if (file.size <= 0) {
    throw new Error('File kosong tidak dapat diunggah.');
  }
  if (file.size > safeLimitMb * 1024 * 1024) {
    throw new Error(`Ukuran file melebihi batas maksimal ${safeLimitMb} MB.`);
  }

  const ext = getExtension(file.name);
  const allowedExts = bucket === 'digivault-receipts' ? RECEIPT_ALLOWED_EXTS : FILE_ALLOWED_EXTS;
  if (!allowedExts.has(ext)) {
    throw new Error(`Format file ${ext || 'tanpa ekstensi'} tidak didukung pada penyimpanan ini.`);
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `${user.uid}/${generateUuid()}_${safeName}`;
  const mimeType = file.type || inferMimeType(file.name);

  // Persist binary chunks directly in Cloud Firestore (works on Vercel serverless up to 50 MB without payload limits)
  await persistChunksToFirestore(user.uid, bucket, storagePath, file);

  // Best-effort warm local Express server cache when available & under serverless body limit
  if (file.size <= 3.5 * 1024 * 1024) {
    try {
      const token = await user.getIdToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bucket', bucket);
      formData.append('storagePath', storagePath);
      await fetch('/api/vault/restore', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    } catch {
      // Optional local cache; Cloud Firestore chunks are authoritative
    }
  }

  return {
    bucket,
    storagePath,
    originalName: file.name,
    mimeType,
    fileSize: file.size,
  };
}

export async function getVaultSignedUrl(
  bucket: VaultBucket,
  storagePath: string,
  disposition: 'inline' | 'attachment' = 'inline',
  downloadName?: string
): Promise<{ signedUrl: string; expiresAt: number }> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sesi autentikasi tidak ditemukan. Silakan login kembali.');
  }

  // Try Express signed URL first when running on persistent backend
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/vault/signed-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        bucket,
        storagePath,
        disposition,
        downloadName,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.signedUrl) {
        return data as { signedUrl: string; expiresAt: number };
      }
    }
  } catch {
    // Fall back to direct Cloud Firestore reconstruction (Vercel / offline / cold container)
  }

  const mimeType = inferMimeType(downloadName || storagePath);
  const blob = await reconstructFileFromFirestore(user.uid, storagePath, mimeType);
  if (!blob) {
    throw new Error('File tidak ditemukan di penyimpanan cloud.');
  }

  return {
    signedUrl: URL.createObjectURL(blob),
    expiresAt: Date.now() + 15 * 60 * 1000,
  };
}

export async function deleteFromVault(
  bucket: VaultBucket,
  storagePath: string
): Promise<void> {
  if (!storagePath) return;
  const user = auth.currentUser;
  if (user) {
    try {
      const q = query(
        collection(db, 'vaultChunks'),
        where('userId', '==', user.uid),
        where('storagePath', '==', storagePath)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'vaultChunks');
    }

    try {
      const token = await user.getIdToken();
      await fetch('/api/vault/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bucket,
          storagePath,
        }),
      });
    } catch {
      // Optional local cache cleanup
    }
  }
}
