import { z } from 'zod';

export const folderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama folder wajib diisi')
    .max(120, 'Nama folder maksimal 120 karakter'),
});

export const renameFileSchema = z.object({
  fileName: z
    .string()
    .trim()
    .min(1, 'Nama file wajib diisi')
    .max(200, 'Nama file maksimal 200 karakter'),
});

export const incomeSchema = z.object({
  transactionDate: z
    .string()
    .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/, 'Format tanggal tidak valid (YYYY-MM-DD)'),
  clientName: z
    .string()
    .trim()
    .min(1, 'Nama klien wajib diisi')
    .max(160, 'Nama klien maksimal 160 karakter'),
  serviceType: z
    .string()
    .trim()
    .min(1, 'Jenis jasa wajib dipilih')
    .max(120, 'Jenis jasa maksimal 120 karakter'),
  description: z
    .string()
    .trim()
    .max(1000, 'Deskripsi maksimal 1000 karakter'),
  amount: z
    .number({ message: 'Nominal harus berupa angka' })
    .positive('Nominal harus lebih besar dari Rp 0'),
  paymentMethod: z
    .string()
    .trim()
    .min(1, 'Metode pembayaran wajib dipilih')
    .max(80, 'Metode pembayaran maksimal 80 karakter'),
  paymentStatus: z.enum(['lunas', 'belum_lunas']),
});

export const profileSettingsSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, 'Nama pengguna wajib diisi')
    .max(120, 'Nama pengguna maksimal 120 karakter'),
  appTitle: z
    .string()
    .trim()
    .min(1, 'Nama aplikasi wajib diisi')
    .max(80, 'Nama aplikasi maksimal 80 karakter'),
  appTagline: z
    .string()
    .trim()
    .max(160, 'Tagline maksimal 160 karakter'),
  maxUploadMb: z
    .number({ message: 'Batas ukuran harus berupa angka' })
    .min(1, 'Minimal 1 MB')
    .max(50, 'Maksimal 50 MB'),
});

export const ALLOWED_ARCHIVE_EXTENSIONS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
  'jpg', 'jpeg', 'png', 'webp', 'txt', 'zip',
];

export const ALLOWED_RECEIPT_EXTENSIONS = ['jpg', 'jpeg', 'png', 'pdf'];

export function hasAllowedExtension(filename: string, allowed: string[]): boolean {
  const parts = filename.toLowerCase().split('.');
  if (parts.length < 2) return false;
  const ext = parts.pop() || '';
  return allowed.includes(ext);
}
