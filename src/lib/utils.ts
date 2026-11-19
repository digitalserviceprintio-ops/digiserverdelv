import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const DEFAULT_SERVICE_CATEGORIES = [
  'Pembuatan aplikasi/software',
  'Pembuatan website',
  'Desain grafis',
  'Jasa legalitas NIB/NPWP',
  'Jasa percetakan',
  'Produk digital',
  'Jasa freelance lainnya',
];

export const DEFAULT_PAYMENT_METHODS = [
  'Cash',
  'Transfer Bank',
  'QRIS',
  'E-Wallet',
  'Lainnya',
];

export const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export function formatIDR(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDateID(dateStr: string): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'dd/MM/yyyy');
  } catch {
    return dateStr;
  }
}

export function formatTimestampID(ts?: Timestamp | null): string {
  if (!ts) return '-';
  try {
    return format(ts.toDate(), 'dd/MM/yyyy HH:mm', { locale: idLocale });
  } catch {
    return '-';
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, i);
  return `${val >= 10 || i === 0 ? val.toFixed(0) : val.toFixed(1)} ${units[i]}`;
}

export function getJakartaTodayISO(): string {
  const now = new Date();
  const jakarta = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return jakarta; // YYYY-MM-DD
}

export function getJakartaYearMonth(): { year: number; month: number } {
  const iso = getJakartaTodayISO();
  const [y, m] = iso.split('-').map(Number);
  return { year: y, month: m };
}
