import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { cn } from '../../lib/utils';

interface PWAInstallButtonProps {
  variant?: 'topbar' | 'card';
  className?: string;
}

export function PWAInstallButton({
  variant = 'topbar',
  className,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState<'android' | 'ios' | null>(null);

  if (isInstalled) {
    return null;
  }

  const handleNativeInstall = async () => {
    const accepted = await install();
    if (accepted) {
      toast.success('DigiVault berhasil dipasang ke perangkat Anda');
    }
  };

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={handleNativeInstall}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer',
          variant === 'topbar'
            ? 'bg-[#172554] hover:bg-blue-900 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-3 py-1.5 text-xs text-white'
            : 'bg-[#172554] hover:bg-blue-900 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-4 py-2.5 text-sm text-white',
          className
        )}
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>Install Aplikasi</span>
      </button>
    );
  }

  if (isIOS || isAndroid) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(isIOS ? 'ios' : 'android')}
          className={cn(
            'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer',
            variant === 'topbar' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
            className
          )}
        >
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>{isIOS ? 'Install di iOS' : 'Install di Android'}</span>
        </button>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  {showGuide === 'ios'
                    ? 'Install DigiVault di iPhone / iPad'
                    : 'Install DigiVault di Android'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(null)}
                  aria-label="Tutup panduan"
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {showGuide === 'ios' ? (
                <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
                  <li>
                    Ketuk ikon <strong>Bagikan (Share)</strong> pada toolbar Safari.
                  </li>
                  <li>
                    Gulir ke bawah lalu pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                  </li>
                  <li>
                    Ketuk <strong>Tambah</strong> untuk memasang DigiVault.
                  </li>
                </ol>
              ) : (
                <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300 list-decimal list-inside">
                  <li>
                    Buka halaman ini menggunakan browser <strong>Google Chrome</strong> di Android.
                  </li>
                  <li>
                    Ketuk ikon menu titik tiga (<strong>⋮</strong>) di pojok kanan atas Chrome.
                  </li>
                  <li>
                    Pilih <strong>Tambahkan ke Layar Utama</strong> atau <strong>Install aplikasi</strong>.
                  </li>
                </ol>
              )}

              <button
                type="button"
                onClick={() => setShowGuide(null)}
                className="mt-5 w-full rounded-xl bg-[#172554] dark:bg-[#2563EB] py-2.5 text-sm font-medium text-white hover:bg-blue-900 transition-colors cursor-pointer"
              >
                Mengerti
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
