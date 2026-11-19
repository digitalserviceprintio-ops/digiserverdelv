import React, { useState } from 'react';
import { Toaster } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useVaultData } from './hooks/useVaultData';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginView } from './components/LoginView';
import { AppShell } from './components/layout/AppShell';
import { DashboardView } from './components/dashboard/DashboardView';
import { ArchivesView } from './components/archives/ArchivesView';
import { FinanceView } from './components/finance/FinanceView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { NavSection } from './types';
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SERVICE_CATEGORIES,
} from './lib/utils';

function DigiVaultWorkspace() {
  const { user, profile, authLoading } = useAuth();
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [globalSearch, setGlobalSearch] = useState('');

  const {
    folders,
    files,
    incomes,
    loading: dataLoading,
    createFolder,
    renameFolder,
    deleteFolderRecursive,
    createFileRecord,
    renameFile,
    deleteFileRecord,
    createIncome,
    updateIncome,
    toggleIncomeStatus,
    deleteIncomeRecord,
  } = useVaultData(user?.uid);

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-600 dark:text-slate-300 gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-[#172554] dark:text-[#38BDF8]" />
        <p className="text-sm font-medium">Memuat DigiVault...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const maxUploadMb = profile?.maxUploadMb || 20;
  const serviceCategories = profile?.serviceCategories?.length
    ? profile.serviceCategories
    : DEFAULT_SERVICE_CATEGORIES;
  const paymentMethods = profile?.paymentMethods?.length
    ? profile.paymentMethods
    : DEFAULT_PAYMENT_METHODS;
  const appTitle = profile?.appTitle || 'DigiVault';

  return (
    <AppShell
      activeNav={activeNav}
      onNavigate={setActiveNav}
      globalSearch={globalSearch}
      onGlobalSearchChange={setGlobalSearch}
    >
      {activeNav === 'dashboard' && (
        <DashboardView
          folders={folders}
          files={files}
          incomes={incomes}
          loading={dataLoading}
          onNavigate={setActiveNav}
        />
      )}

      {activeNav === 'archives' && (
        <ArchivesView
          folders={folders}
          files={files}
          loading={dataLoading}
          maxUploadMb={maxUploadMb}
          globalSearch={globalSearch}
          onCreateFolder={createFolder}
          onRenameFolder={renameFolder}
          onDeleteFolder={deleteFolderRecursive}
          onCreateFileRecord={createFileRecord}
          onRenameFile={renameFile}
          onDeleteFile={deleteFileRecord}
        />
      )}

      {activeNav === 'finance' && (
        <FinanceView
          incomes={incomes}
          loading={dataLoading}
          serviceCategories={serviceCategories}
          paymentMethods={paymentMethods}
          maxUploadMb={maxUploadMb}
          globalSearch={globalSearch}
          onCreateIncome={createIncome}
          onUpdateIncome={updateIncome}
          onToggleStatus={toggleIncomeStatus}
          onDeleteIncome={deleteIncomeRecord}
        />
      )}

      {activeNav === 'reports' && (
        <ReportsView
          incomes={incomes}
          loading={dataLoading}
          appTitle={appTitle}
        />
      )}

      {activeNav === 'settings' && <SettingsView />}
    </AppShell>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DigiVaultWorkspace />
        <OfflineIndicator />
        <Toaster position="top-right" richColors closeButton />
      </AuthProvider>
    </ErrorBoundary>
  );
}
