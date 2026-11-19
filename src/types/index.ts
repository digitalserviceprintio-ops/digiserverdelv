import { Timestamp } from 'firebase/firestore';

export type PaymentStatus = 'lunas' | 'belum_lunas';

export type VaultBucket = 'digivault-files' | 'digivault-receipts';

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  avatarUrl: string;
  appTitle: string;
  appTagline: string;
  theme: 'light' | 'dark';
  maxUploadMb: number;
  serviceCategories: string[];
  paymentMethods: string[];
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ArchiveFolder {
  id: string;
  userId: string;
  parentId: string | null;
  name: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface ArchiveFile {
  id: string;
  userId: string;
  folderId: string | null;
  fileName: string;
  originalName: string;
  storagePath: string;
  mimeType: string;
  fileSize: number;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface IncomeRecord {
  id: string;
  userId: string;
  transactionDate: string; // YYYY-MM-DD
  clientName: string;
  serviceType: string;
  description: string;
  amount: number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  receiptPath: string;
  receiptName: string;
  receiptMimeType: string;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export type NavSection = 'dashboard' | 'archives' | 'finance' | 'reports' | 'settings';
