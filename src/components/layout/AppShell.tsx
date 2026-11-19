import React, { useState } from 'react';
import {
  LayoutDashboard,
  FolderOpen,
  Wallet,
  BarChart3,
  Settings,
  LogOut,
  Search,
  Sun,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react';
import { NavSection } from '../../types';
import { DEFAULT_AVATAR_PATH, useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

interface AppShellProps {
  activeNav: NavSection;
  onNavigate: (nav: NavSection) => void;
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  children: React.ReactNode;
}

const NAV_ITEMS: { id: NavSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'archives', label: 'Folder Arsip', icon: FolderOpen },
  { id: 'finance', label: 'Finansial', icon: Wallet },
  { id: 'reports', label: 'Rekap Bulanan', icon: BarChart3 },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

const NAV_TITLES: Record<NavSection, string> = {
  dashboard: 'Dashboard',
  archives: 'Folder Arsip',
  finance: 'Finansial',
  reports: 'Rekap Bulanan',
  settings: 'Pengaturan',
};

export function AppShell({
  activeNav,
  onNavigate,
  globalSearch,
  onGlobalSearchChange,
  children,
}: AppShellProps) {
  const { profile, user, resolvedAvatarUrl, logout, toggleTheme } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const appTitle = profile?.appTitle || 'DigiVault';
  const displayName = profile?.fullName || user?.displayName || 'Pemilik Vault';
  const displayEmail = profile?.email || user?.email || '';
  const avatarUrl = resolvedAvatarUrl || user?.photoURL || DEFAULT_AVATAR_PATH;
  const isDark = profile?.theme === 'dark';

  const handleNavClick = (id: NavSection) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex h-full flex-col justify-between bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
      <div>
        {/* Logo & Collapse Row */}
        <div className="flex h-16 items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className="flex items-center gap-2.5 overflow-hidden text-left cursor-pointer"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#172554] text-white">
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="16" rx="3" />
                <circle cx="12" cy="12" r="3" />
                <path d="M12 9v-2M12 17v-2M9 12H7M17 12h-2" />
              </svg>
            </div>
            {(!collapsed || isMobile) && (
              <span className="font-display text-lg font-bold tracking-tight text-[#172554] dark:text-white whitespace-nowrap truncate">
                {appTitle}
              </span>
            )}
          </button>

          {isMobile ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Tutup menu"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1" aria-label="Navigasi Utama">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                title={collapsed && !isMobile ? item.label : undefined}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer',
                  active
                    ? 'bg-[#172554] text-white dark:bg-[#2563EB] dark:text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
                  collapsed && !isMobile && 'justify-center px-2'
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {(!collapsed || isMobile) && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="border-t border-slate-200 dark:border-slate-800 p-3 space-y-2">
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl p-2',
            collapsed && !isMobile && 'justify-center'
          )}
        >
          <img
            src={avatarUrl}
            alt={displayName}
            referrerPolicy="no-referrer"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR_PATH;
            }}
            className="h-9 w-9 shrink-0 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
          />
          {(!collapsed || isMobile) && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {displayName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {displayEmail}
              </p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={logout}
          title={collapsed && !isMobile ? 'Keluar' : undefined}
          className={cn(
            'w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors whitespace-nowrap cursor-pointer',
            collapsed && !isMobile && 'justify-center px-2'
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {(!collapsed || isMobile) && <span>Keluar</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0B1120] text-[#0F172A] dark:text-[#F8FAFC]">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          'hidden md:block shrink-0 transition-all duration-200 no-print',
          collapsed ? 'w-[76px]' : 'w-[256px]'
        )}
      >
        <div className="sticky top-0 h-screen">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden no-print">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 z-10">
            <SidebarContent isMobile />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 h-16 flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm px-4 sm:px-6 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu navigasi"
              className="md:hidden rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span className="hidden sm:inline">{appTitle}</span>
                <span className="hidden sm:inline" aria-hidden="true">/</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {NAV_TITLES[activeNav]}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative hidden sm:block w-64 lg:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={globalSearch}
                onChange={(e) => onGlobalSearchChange(e.target.value)}
                placeholder="Cari dokumen atau klien..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 pl-9 pr-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <PWAInstallButton variant="topbar" />

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Aktifkan mode terang' : 'Aktifkan mode gelap'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <img
                src={avatarUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = DEFAULT_AVATAR_PATH;
                }}
                className="h-6 w-6 rounded-lg object-cover"
              />
              <span className="hidden lg:inline text-xs font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                {displayName}
              </span>
            </button>
          </div>
        </header>

        {/* Global Search Quick Results Bar when user types in topbar */}
        {globalSearch.trim().length > 0 && activeNav !== 'archives' && activeNav !== 'finance' && (
          <div className="border-b border-slate-200 dark:border-slate-800 bg-blue-50/70 dark:bg-blue-950/30 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs no-print">
            <span className="text-slate-700 dark:text-slate-300">
              Filter pencarian aktif: <strong className="font-semibold">"{globalSearch}"</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigate('archives')}
                className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 font-medium text-[#2563EB] dark:text-[#38BDF8] hover:bg-slate-50 cursor-pointer"
              >
                Lihat di Folder Arsip
              </button>
              <button
                type="button"
                onClick={() => onNavigate('finance')}
                className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 font-medium text-[#2563EB] dark:text-[#38BDF8] hover:bg-slate-50 cursor-pointer"
              >
                Lihat di Finansial
              </button>
              <button
                type="button"
                onClick={() => onGlobalSearchChange('')}
                className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-1.5 py-1 cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>
        )}

        {/* Page Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
