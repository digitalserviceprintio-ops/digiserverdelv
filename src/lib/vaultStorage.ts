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

async function getBearerToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Sesi autentikasi tidak ditemukan. Silakan login kembali.');
  }
  return await user.getIdToken();
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
  const token = await user.getIdToken();
  const formData = new FormData();
  formData.append('file', file);
  formData.append('bucket', bucket);
  formData.append('maxSizeMb', String(maxSizeMb));

  const res = await fetch('/api/vault/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Gagal mengunggah file ke private storage.');
  }
  const uploaded = data as UploadedVaultFile;

  // Persist binary chunks in Cloud Firestore so file is available across all devices and server restarts
  await persistChunksToFirestore(user.uid, bucket, uploaded.storagePath, file);

  return uploaded;
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
  const token = await user.getIdToken();

  const requestSigned = async () =>
    fetch('/api/vault/signed-url', {
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

  let res = await requestSigned();

  // If file is missing on this server instance (new device / container restart), hydrate from Cloud Firestore
  if (res.status === 404) {
    const blob = await reconstructFileFromFirestore(user.uid, storagePath);
    if (blob) {
      try {
        const restoreForm = new FormData();
        restoreForm.append('file', blob, downloadName || 'dokumen');
        restoreForm.append('bucket', bucket);
        restoreForm.append('storagePath', storagePath);
        const restoreRes = await fetch('/api/vault/restore', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: restoreForm,
        });
        if (restoreRes.ok) {
          res = await requestSigned();
        }
      } catch {
        // Fallback to direct in-memory Blob URL when offline or unreachable
        return {
          signedUrl: URL.createObjectURL(blob),
          expiresAt: Date.now() + 5 * 60 * 1000,
        };
      }
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Gagal membuat signed URL untuk mengakses file.');
  }
  return data as { signedUrl: string; expiresAt: number };
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
  }

  const token = await getBearerToken();
  const res = await fetch('/api/vault/delete', {
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

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Gagal menghapus file fisik dari private storage.');
  }
}
