import React, { useState } from 'react';
import {
  AlertCircle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  MailCheck,
  RefreshCw,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAuth } from '../hooks/useAuth';
import { loginSchema, registerSchema } from '../lib/validations';
import { PWAInstallButton } from './pwa/PWAInstallButton';

const SERVER_ROOM_IMAGE = '/src/assets/images/server_room_vault_1795097517027.jpg';

type AuthMode = 'login' | 'register' | 'reset';

export function LoginView() {
  const {
    user,
    signingIn,
    authError,
    unauthorizedDomain,
    emailProviderDisabled,
    needsEmailVerification,
    clearAuthError,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    resendVerificationEmail,
    refreshVerificationStatus,
    signInWithGoogle,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);
  const [imgError, setImgError] = useState(false);

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setFormError(null);
    setResetSent(false);
    clearAuthError();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearAuthError();

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Periksa kembali email dan password.');
      return;
    }

    await signInWithEmail(parsed.data.email, parsed.data.password);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearAuthError();

    const parsed = registerSchema.safeParse({
      fullName,
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message || 'Periksa kembali data pendaftaran.');
      return;
    }

    await registerWithEmail(parsed.data.fullName, parsed.data.email, parsed.data.password);
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    clearAuthError();

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setFormError('Masukkan alamat email yang valid untuk reset password.');
      return;
    }

    const ok = await resetPassword(trimmed);
    if (ok) {
      setResetSent(true);
    }
  };

  const activeError = formError || authError;

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 items-stretch bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Left Auth Column */}
      <div className="lg:col-span-5 flex flex-col justify-between p-6 sm:p-10 lg:p-14">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#172554] text-white">
            <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="16" rx="3" />
              <circle cx="12" cy="12" r="3" />
              <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2" />
            </svg>
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-[#172554] dark:text-white whitespace-nowrap shrink-0">
            DigiVault
          </span>
        </div>

        <div className="my-auto w-full max-w-sm mx-auto py-8">
          {/* Mobile Server Room Preview */}
          <div className="lg:hidden mb-6 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 aspect-[16/9] relative bg-[#0F172A]">
            {!imgError ? (
              <img
                src={SERVER_ROOM_IMAGE}
                alt="Ruang server pribadi DigiVault"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#172554] to-slate-900 text-slate-300">
                <Server className="h-8 w-8" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
            <span className="absolute bottom-3 left-4 text-xs font-medium text-white">
              Ruang Server DigiVault
            </span>
          </div>

          {needsEmailVerification ? (
            <div className="space-y-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#38BDF8]">
                <MailCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Verifikasi Email Anda
                </h1>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Tautan verifikasi telah dikirim ke{' '}
                  <strong className="text-slate-800 dark:text-slate-200">{user?.email}</strong>.
                  Buka kotak masuk (atau folder Spam), klik tautan tersebut, lalu lanjutkan di bawah.
                </p>
              </div>

              <div className="space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={refreshVerificationStatus}
                  disabled={signingIn}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#172554] hover:bg-blue-950 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  {signingIn ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Saya Sudah Verifikasi
                </button>

                <button
                  type="button"
                  onClick={resendVerificationEmail}
                  disabled={signingIn}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  Kirim Ulang Email Verifikasi
                </button>

                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-4 cursor-pointer"
                >
                  Keluar & gunakan akun lain
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
                {mode === 'register'
                  ? 'Daftar Akun DigiVault'
                  : mode === 'reset'
                  ? 'Reset Password'
                  : 'Masuk ke DigiVault'}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {mode === 'register'
                  ? 'Buat akun dengan email dan password untuk mengakses brankas Anda.'
                  : mode === 'reset'
                  ? 'Masukkan email terdaftar untuk menerima tautan reset password.'
                  : 'Your Documents. Your Income. One Vault.'}
              </p>

              {/* Mode Switcher: Login / Register */}
              {mode !== 'reset' && (
                <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`rounded-lg py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      mode === 'login'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className={`rounded-lg py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      mode === 'register'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Daftar Akun
                  </button>
                </div>
              )}

              {/* Login Form */}
              {mode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="mt-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => switchMode('reset')}
                        className="text-xs font-medium text-[#2563EB] dark:text-[#38BDF8] hover:underline cursor-pointer"
                      >
                        Lupa password?
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={signingIn}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#172554] hover:bg-blue-950 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {signingIn && <Loader2 className="h-4 w-4 animate-spin" />}
                    {signingIn ? 'Memproses...' : 'Masuk'}
                  </button>

                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    Belum punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="font-semibold text-[#2563EB] dark:text-[#38BDF8] hover:underline cursor-pointer"
                    >
                      Daftar terlebih dahulu
                    </button>
                  </p>
                </form>
              )}

              {/* Register Form */}
              {mode === 'register' && (
                <form onSubmit={handleRegisterSubmit} className="mt-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Nama Lengkap
                    </label>
                    <input
                      type="text"
                      required
                      autoComplete="name"
                      maxLength={120}
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Nama pemilik vault"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimal 6 karakter"
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3.5 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Konfirmasi Password
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi password"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={signingIn}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#172554] hover:bg-blue-950 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {signingIn && <Loader2 className="h-4 w-4 animate-spin" />}
                    {signingIn ? 'Mendaftarkan Akun...' : 'Daftar Akun'}
                  </button>

                  <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                    Sudah punya akun?{' '}
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="font-semibold text-[#2563EB] dark:text-[#38BDF8] hover:underline cursor-pointer"
                    >
                      Masuk di sini
                    </button>
                  </p>
                </form>
              )}

              {/* Reset Password Form */}
              {mode === 'reset' && (
                <form onSubmit={handleResetSubmit} className="mt-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                      Email Terdaftar
                    </label>
                    <input
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nama@email.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  {resetSent && (
                    <p className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                      Link reset password telah dikirim ke {email.trim()}. Periksa kotak masuk atau folder Spam Anda.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={signingIn}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#172554] hover:bg-blue-950 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {signingIn && <Loader2 className="h-4 w-4 animate-spin" />}
                    Kirim Link Reset Password
                  </button>

                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="w-full py-2 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-4 cursor-pointer"
                  >
                    Kembali ke halaman Masuk
                  </button>
                </form>
              )}

              {/* Secondary Google Sign-In Option */}
              {mode !== 'reset' && (
                <>
                  <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                    <span>atau</span>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  </div>

                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={signingIn}
                    className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
                      />
                    </svg>
                    Lanjutkan dengan Google
                  </button>
                </>
              )}

              <div className="mt-3">
                <PWAInstallButton variant="card" className="w-full" />
              </div>
            </>
          )}

          {activeError && (
            <div
              role="alert"
              className="mt-4 space-y-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3.5 text-xs text-red-700 dark:text-red-300"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{activeError}</span>
              </div>

              {emailProviderDisabled && (
                <div className="space-y-1.5 border-t border-red-200/70 dark:border-red-800/60 pt-2">
                  <p className="text-[11px] leading-relaxed">
                    Aktifkan <strong>Email/Password</strong> di{' '}
                    <strong>Firebase Console → Authentication → Sign-in method</strong>:
                  </p>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold underline underline-offset-4 hover:opacity-80"
                  >
                    Buka Sign-in Method di Firebase Console
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}

              {unauthorizedDomain && (
                <div className="space-y-2 border-t border-red-200/70 dark:border-red-800/60 pt-2">
                  <p className="text-[11px] leading-relaxed text-red-700/90 dark:text-red-200/90">
                    Tambahkan domain di bawah ini ke{' '}
                    <strong>Firebase Console → Authentication → Settings → Authorized domains</strong>:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded-lg bg-white/80 dark:bg-slate-900/80 px-2.5 py-1.5 font-mono text-[11px] text-slate-900 dark:text-slate-100 border border-red-200 dark:border-red-800">
                      {unauthorizedDomain}
                    </code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(unauthorizedDomain);
                        toast.success('Domain disalin ke clipboard');
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800 px-2.5 py-1.5 text-[11px] font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 cursor-pointer shrink-0"
                    >
                      <Copy className="h-3 w-3" />
                      Salin
                    </button>
                  </div>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold underline underline-offset-4 hover:opacity-80"
                  >
                    Buka Authorized Domains di Firebase Console
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          DigiVault · Asia/Jakarta (WIB)
        </p>
      </div>

      {/* Right Server Room Showcase */}
      <div className="hidden lg:block lg:col-span-7 relative overflow-hidden bg-[#0F172A]">
        {!imgError ? (
          <img
            src={SERVER_ROOM_IMAGE}
            alt="Ruang server pribadi DigiVault"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#172554] to-[#0B1120] text-slate-300">
            <Server className="h-12 w-12 text-[#38BDF8]" />
            <span className="font-display text-lg font-semibold">Ruang Server DigiVault</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <h2 className="font-display text-2xl font-semibold leading-snug [text-wrap:balance]">
            Ruang Server Pribadi
          </h2>
          <p className="mt-1.5 text-sm text-slate-300 max-w-md">
            Arsip dokumen digital dan rekap pendapatan freelance tersimpan aman dalam satu brankas privat.
          </p>
        </div>
      </div>
    </div>
  );
}
