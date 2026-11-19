import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Server,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { PWAInstallButton } from './pwa/PWAInstallButton';

const SERVER_ROOM_IMAGE = '/src/assets/images/server_room_vault_1795097517027.jpg';

export function LoginView() {
  const {
    user,
    vaultLocked,
    pinVerified,
    signingIn,
    authError,
    clearAuthError,
    signInWithGoogle,
    verifyVaultPin,
    logout,
  } = useAuth();

  const [mode, setMode] = useState<'pin' | 'google'>('pin');
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [showPin, setShowPin] = useState(false);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const pinValue = digits.join('');
  const isLockedExistingSession = Boolean(user && vaultLocked);

  const handleDigitChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    setPinError(null);

    if (!cleaned) {
      const next = [...digits];
      next[index] = '';
      setDigits(next);
      return;
    }

    if (cleaned.length > 1) {
      const next = [...digits];
      for (let i = 0; i < 6; i++) {
        next[i] = cleaned[i] || next[i];
      }
      setDigits(next);
      const focusIdx = Math.min(cleaned.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleDigitKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleDigitPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setPinError(null);
    inputRefs.current[Math.min(pasted.length, 5)]?.focus();
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinValue.length !== 6) {
      setPinError('Masukkan lengkap 6 digit PIN.');
      return;
    }

    setVerifyingPin(true);
    setPinError(null);
    const result = await verifyVaultPin(pinValue);
    setVerifyingPin(false);

    if (!result.ok) {
      setPinError(result.error || 'PIN salah.');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 items-stretch bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Left Login Column */}
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

          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
            {isLockedExistingSession ? 'Vault Terkunci' : 'Masuk ke DigiVault'}
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {isLockedExistingSession
              ? 'Masukkan 6 digit PIN untuk membuka kembali ruang arsip Anda.'
              : 'Your Documents. Your Income. One Vault.'}
          </p>

          {/* Segmented Method Switcher */}
          {!isLockedExistingSession && (
            <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('pin');
                  setPinError(null);
                  clearAuthError();
                }}
                className={`rounded-lg py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'pin'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Login dengan PIN
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('google');
                  setPinError(null);
                  clearAuthError();
                }}
                className={`rounded-lg py-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  mode === 'google'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Akun Google
              </button>
            </div>
          )}

          {/* PIN Login Panel */}
          {(mode === 'pin' || isLockedExistingSession) && (
            <div className="mt-6">
              {pinVerified && !user ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      PIN terverifikasi. Lanjutkan masuk dengan akun Google pemilik untuk menyinkronkan data cloud lintas perangkat.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={signingIn}
                    className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-[#172554] hover:bg-blue-950 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {signingIn ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#ffffff"
                          d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
                        />
                      </svg>
                    )}
                    {signingIn ? 'Membuka Vault...' : 'Lanjutkan dengan Google'}
                  </button>
                </div>
              ) : (
                <form onSubmit={handlePinSubmit} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Masukkan PIN Akses (6 Digit)
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPin((s) => !s)}
                      className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showPin ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {showPin ? 'Sembunyikan' : 'Tampilkan'}
                    </button>
                  </div>

                  <div className="grid grid-cols-6 gap-2">
                    {digits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        type={showPin ? 'text' : 'password'}
                        inputMode="numeric"
                        maxLength={1}
                        autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                        aria-label={`Digit PIN ke-${idx + 1}`}
                        value={digit}
                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                        onKeyDown={(e) => handleDigitKeyDown(idx, e)}
                        onPaste={handleDigitPaste}
                        className="h-12 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-center font-mono text-lg font-semibold tabular-nums text-slate-900 dark:text-white focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                      />
                    ))}
                  </div>

                  {pinError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400"
                    >
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{pinError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={verifyingPin || pinValue.length !== 6}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#172554] hover:bg-blue-950 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {verifyingPin ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <KeyRound className="h-4 w-4" />
                    )}
                    {verifyingPin ? 'Memverifikasi PIN...' : 'Masuk dengan PIN'}
                  </button>

                  {isLockedExistingSession && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={logout}
                        className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 underline underline-offset-4 cursor-pointer"
                      >
                        Keluar & ganti akun Google
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          )}

          {/* Google Direct Login Panel */}
          {mode === 'google' && !isLockedExistingSession && (
            <div className="mt-6 space-y-4">
              <button
                type="button"
                onClick={signInWithGoogle}
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-3 rounded-xl bg-[#172554] hover:bg-blue-950 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {signingIn ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#ffffff"
                      d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81z"
                    />
                  </svg>
                )}
                {signingIn ? 'Memverifikasi Sesi...' : 'Masuk dengan Akun Google'}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Akses privat untuk akun terverifikasi pemilik DigiVault.
              </p>
            </div>
          )}

          {authError && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="mt-4">
            <PWAInstallButton variant="card" className="w-full" />
          </div>
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
