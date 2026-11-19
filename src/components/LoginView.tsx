import React, { useState } from 'react';
import {
  AlertCircle,
  Copy,
  ExternalLink,
  Loader2,
  Lock,
  Server,
} from 'lucide-react';
import { toast } from 'sonner';
import firebaseConfig from '../../firebase-applet-config.json';
import { useAuth } from '../hooks/useAuth';
import { PWAInstallButton } from './pwa/PWAInstallButton';

const SERVER_ROOM_IMAGE = '/src/assets/images/server_room_vault_1795097517027.jpg';

export function LoginView() {
  const {
    signingIn,
    authError,
    unauthorizedDomain,
    signInWithGoogle,
  } = useAuth();

  const [imgError, setImgError] = useState(false);

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
            Masuk ke DigiVault
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your Documents. Your Income. One Vault.
          </p>

          <div className="mt-6 space-y-3">
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

            <PWAInstallButton variant="card" className="w-full" />

            <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-500 dark:text-slate-400">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span>Akses privat untuk akun Google pemilik vault</span>
            </div>
          </div>

          {authError && (
            <div
              role="alert"
              className="mt-4 space-y-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3.5 text-xs text-red-700 dark:text-red-300"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
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
