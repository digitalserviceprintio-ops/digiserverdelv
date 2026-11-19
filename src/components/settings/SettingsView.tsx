import React, { useEffect, useRef, useState } from 'react';
import {
  Save,
  Plus,
  Trash2,
  Sun,
  Moon,
  ShieldCheck,
  Loader2,
  Upload,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_AVATAR_PATH, useAuth } from '../../hooks/useAuth';
import { profileSettingsSchema } from '../../lib/validations';
import { uploadToVault } from '../../lib/vaultStorage';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export function SettingsView() {
  const { profile, user, resolvedAvatarUrl, updateProfileSettings, toggleTheme, logout } = useAuth();
  const { isInstalled, isInstallable } = usePWAInstall();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [appTitle, setAppTitle] = useState(profile?.appTitle || 'DigiVault');
  const [appTagline, setAppTagline] = useState(
    profile?.appTagline || 'Your Documents. Your Income. One Vault.'
  );
  const [maxUploadMb, setMaxUploadMb] = useState<number>(profile?.maxUploadMb || 20);
  const [serviceCategories, setServiceCategories] = useState<string[]>(
    profile?.serviceCategories || []
  );
  const [paymentMethods, setPaymentMethods] = useState<string[]>(
    profile?.paymentMethods || []
  );

  const [newCategory, setNewCategory] = useState('');
  const [newMethod, setNewMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.fullName);
      setAppTitle(profile.appTitle);
      setAppTagline(profile.appTagline);
      setMaxUploadMb(profile.maxUploadMb);
      setServiceCategories(profile.serviceCategories);
      setPaymentMethods(profile.paymentMethods);
    }
  }, [profile]);

  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = profileSettingsSchema.safeParse({
      fullName,
      appTitle,
      appTagline,
      maxUploadMb,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Periksa kembali input pengaturan');
      return;
    }

    setSaving(true);
    try {
      await updateProfileSettings({
        fullName: parsed.data.fullName,
        appTitle: parsed.data.appTitle,
        appTagline: parsed.data.appTagline,
        maxUploadMb: parsed.data.maxUploadMb,
      });
      toast.success('Pengaturan profil & aplikasi tersimpan');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
      toast.error('Foto profil harus berformat JPG, PNG, atau WEBP.');
      return;
    }
    setUploadingAvatar(true);
    try {
      const uploaded = await uploadToVault(file, 'digivault-files', 5);
      const vaultAvatarUri = `vault://digivault-files/${uploaded.storagePath}`;
      await updateProfileSettings({ avatarUrl: vaultAvatarUri });
      toast.success('Foto profil diperbarui');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal mengunggah foto profil');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAddCategory = async () => {
    const val = newCategory.trim();
    if (!val) return;
    if (serviceCategories.includes(val)) {
      toast.error('Kategori jasa sudah ada');
      return;
    }
    if (serviceCategories.length >= 30) {
      toast.error('Maksimal 30 kategori jasa');
      return;
    }
    const next = [...serviceCategories, val];
    setServiceCategories(next);
    setNewCategory('');
    await updateProfileSettings({ serviceCategories: next });
    toast.success('Kategori jasa ditambahkan');
  };

  const handleRemoveCategory = async (cat: string) => {
    if (serviceCategories.length <= 1) {
      toast.error('Minimal harus tersedia 1 kategori jasa');
      return;
    }
    const next = serviceCategories.filter((c) => c !== cat);
    setServiceCategories(next);
    await updateProfileSettings({ serviceCategories: next });
    toast.success('Kategori jasa dihapus');
  };

  const handleAddMethod = async () => {
    const val = newMethod.trim();
    if (!val) return;
    if (paymentMethods.includes(val)) {
      toast.error('Metode pembayaran sudah ada');
      return;
    }
    if (paymentMethods.length >= 20) {
      toast.error('Maksimal 20 metode pembayaran');
      return;
    }
    const next = [...paymentMethods, val];
    setPaymentMethods(next);
    setNewMethod('');
    await updateProfileSettings({ paymentMethods: next });
    toast.success('Metode pembayaran ditambahkan');
  };

  const handleRemoveMethod = async (method: string) => {
    if (paymentMethods.length <= 1) {
      toast.error('Minimal harus tersedia 1 metode pembayaran');
      return;
    }
    const next = paymentMethods.filter((m) => m !== method);
    setPaymentMethods(next);
    await updateProfileSettings({ paymentMethods: next });
    toast.success('Metode pembayaran dihapus');
  };

  const isDark = profile?.theme === 'dark';

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Pengaturan DigiVault
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kelola identitas pemilik, tema tampilan, batas unggahan, kategori jasa, dan metode pembayaran.
        </p>
      </div>

      {/* General Profile & App Settings */}
      <form
        onSubmit={handleSaveGeneral}
        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-center gap-4">
            <img
              src={resolvedAvatarUrl}
              alt={fullName}
              referrerPolicy="no-referrer"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR_PATH;
              }}
              className="h-16 w-16 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
            />
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Profil Pemilik & Identitas Vault
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile?.email || user?.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={avatarInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingAvatar}
              onClick={() => avatarInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              Ganti Foto
            </button>
            <button
              type="button"
              onClick={async () => {
                const fallback = user?.photoURL || DEFAULT_AVATAR_PATH;
                await updateProfileSettings({ avatarUrl: fallback });
                toast.success('Foto profil dikembalikan ke default');
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Default
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Nama Pengguna
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Email Akun (Terverifikasi)
            </label>
            <input
              type="email"
              readOnly
              value={profile?.email || user?.email || ''}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3.5 py-2.5 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Nama Aplikasi
            </label>
            <input
              type="text"
              required
              maxLength={80}
              value={appTitle}
              onChange={(e) => setAppTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Batas Maksimal Upload (1–50 MB)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={maxUploadMb}
              onChange={(e) => setMaxUploadMb(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Tagline Aplikasi
            </label>
            <input
              type="text"
              maxLength={160}
              value={appTagline}
              onChange={(e) => setAppTagline(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#172554] dark:bg-[#2563EB] px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-900 transition-colors cursor-pointer disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Simpan Pengaturan
          </button>
        </div>
      </form>

      {/* Appearance Theme */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Tema Tampilan
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Pilih mode Light atau Dark untuk kenyamanan kerja siang dan malam.
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1 shrink-0">
          <button
            type="button"
            onClick={() => isDark && toggleTheme()}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
              !isDark
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            Light Mode
          </button>
          <button
            type="button"
            onClick={() => !isDark && toggleTheme()}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors cursor-pointer ${
              isDark
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            Dark Mode
          </button>
        </div>
      </div>

      {/* Service Categories & Payment Methods */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Kategori Jasa Freelance
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pilihan jenis jasa yang muncul saat mencatat pendapatan.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Tambah kategori jasa..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
            <button
              type="button"
              onClick={handleAddCategory}
              className="inline-flex items-center gap-1 rounded-xl bg-[#172554] dark:bg-[#2563EB] px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-900 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {serviceCategories.map((cat) => (
              <li key={cat} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-700 dark:text-slate-200">{cat}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveCategory(cat)}
                  aria-label={`Hapus ${cat}`}
                  className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Metode Pembayaran
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kanal pembayaran klien yang tersedia pada form finansial.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newMethod}
              onChange={(e) => setNewMethod(e.target.value)}
              placeholder="Tambah metode pembayaran..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
            <button
              type="button"
              onClick={handleAddMethod}
              className="inline-flex items-center gap-1 rounded-xl bg-[#172554] dark:bg-[#2563EB] px-3.5 py-2 text-sm font-medium text-white hover:bg-blue-900 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Tambah
            </button>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {paymentMethods.map((method) => (
              <li key={method} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-slate-700 dark:text-slate-200">{method}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveMethod(method)}
                  aria-label={`Hapus ${method}`}
                  className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* PWA Android / Desktop Installation */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Instalasi Aplikasi (Android & Desktop)
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
            {isInstalled
              ? 'DigiVault sedang berjalan sebagai aplikasi mandiri (Standalone PWA) di perangkat Anda.'
              : isInstallable
              ? 'Perangkat Anda mendukung pemasangan langsung. Klik tombol di samping untuk menginstal DigiVault ke layar utama.'
              : 'Buka DigiVault melalui Google Chrome di Android lalu pilih menu titik tiga (⋮) → "Install aplikasi" atau "Tambahkan ke Layar Utama" untuk memasang aplikasi.'}
          </p>
        </div>

        <div className="shrink-0">
          {isInstalled ? (
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              Terpasang di Perangkat
            </span>
          ) : (
            <PWAInstallButton variant="card" />
          )}
        </div>
      </div>

      {/* Security & Session Info */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Keamanan & Sesi Akun
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
              Autentikasi dikelola oleh Firebase Authentication (Email/Password & Google Sign-In terverifikasi). Pengaturan provider login dan kata sandi dapat dikelola melalui menu reset password pada layar login atau Firebase Console proyek Anda.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Keluar dari Sesi
        </button>
      </div>
    </div>
  );
}
