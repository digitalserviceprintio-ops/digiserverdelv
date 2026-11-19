# DigiVault — Personal Digital Archive & Income Tracker

**Tagline:** Your Documents. Your Income. One Vault.

DigiVault adalah aplikasi web pribadi untuk mengelola arsip dokumen digital secara hierarkis dan mencatat pendapatan jasa freelance dalam satu dashboard aman berbahasa Indonesia (IDR, zona waktu Asia/Jakarta, format tanggal `DD/MM/YYYY`).

## Arsitektur & Teknologi

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React, Recharts, React Hook Form + Zod, jsPDF + jspdf-autotable, SheetJS (`xlsx`), Sonner.
- **Database & Autentikasi:** Firebase Authentication (Google Sign-In terverifikasi) & Cloud Firestore dengan aturan keamanan `firestore.rules` yang mengisolasi seluruh data berdasarkan `request.auth.uid`.
- **Private Vault Storage:** Express backend (`server.ts`) memverifikasi Firebase ID Token melalui `firebase-admin/auth`, memvalidasi MIME type & ukuran file, menyimpan file ke dua private bucket lokal terisolasi (`digivault-files` & `digivault-receipts`), serta menerbitkan HMAC-SHA256 Signed URL sementara untuk preview PDF/gambar dan unduhan.

## Fitur Utama

1. **Dashboard Analitik:** Statistik arsip (folder, dokumen, total penyimpanan, dokumen terbaru), statistik finansial terfilter bulan & tahun (total pendapatan, lunas aktual, belum lunas, transaksi), grafik Recharts (bulanan, perbandingan antarbulan, jenis jasa), dan umpan aktivitas terkini.
2. **Folder Arsip:** Pembuatan folder & subfolder, ubah nama, hapus rekursif dengan konfirmasi, upload single & multiple file (PDF, Office, Gambar, TXT, ZIP), preview PDF/gambar via Signed URL, unduh aman, breadcrumb, pencarian, sorting nama/tanggal, dan tampilan Grid/List.
3. **Finansial (Pendapatan Freelance):** Pencatatan pemasukan jasa dengan kalkulasi otomatis pemisahan status `Lunas` dan `Belum Lunas`, filter tanggal/jasa/status, pencarian, detail transaksi, dan lampiran bukti pembayaran privat (`JPG/PNG/PDF`).
4. **Rekap Bulanan:** Laporan resmi periode bulan/tahun lengkap dengan ekspor **PDF**, **Excel (.xlsx)**, serta mode **Cetak** (`window.print()`).
5. **Pengaturan:** Profil pemilik, judul & tagline aplikasi, tema Light/Dark, batas maksimal upload (1–50 MB), kustomisasi kategori jasa, dan metode pembayaran.

## Menjalankan Secara Lokal

1. Instal dependensi:
   ```bash
   npm install
   ```
2. Salin `.env.example` menjadi `.env` jika ingin menetapkan `VAULT_SIGNING_SECRET` secara eksplisit.
3. Jalankan server pengembangan (Express + Vite pada port 3000):
   ```bash
   npm run dev
   ```
4. Verifikasi tipe & build produksi:
   ```bash
   npm run lint
   npm run build
   ```
