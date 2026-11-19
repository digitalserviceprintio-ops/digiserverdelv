import React from 'react';
import { ShieldAlert, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let message = error.message || 'Terjadi kesalahan pada aplikasi.';
    try {
      const parsed = JSON.parse(message);
      if (parsed && parsed.error) {
        message = parsed.error;
      }
    } catch {
      // plain string message
    }
    return { hasError: true, message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120] p-6">
          <div className="max-w-md w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Terjadi Gangguan Sistem
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#172554] px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-900 transition-colors cursor-pointer"
            >
              <RotateCcw className="h-4 w-4" />
              Muat Ulang DigiVault
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
