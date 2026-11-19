import React, { useMemo, useState } from 'react';
import {
  FolderOpen,
  FileText,
  HardDrive,
  Clock,
  Wallet,
  CheckCircle2,
  Hourglass,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Upload,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ArchiveFile, ArchiveFolder, IncomeRecord, NavSection } from '../../types';
import {
  formatBytes,
  formatDateID,
  formatIDR,
  formatTimestampID,
  getJakartaYearMonth,
  MONTHS_ID,
} from '../../lib/utils';

interface DashboardViewProps {
  folders: ArchiveFolder[];
  files: ArchiveFile[];
  incomes: IncomeRecord[];
  loading: boolean;
  onNavigate: (nav: NavSection) => void;
}

export function DashboardView({
  folders,
  files,
  incomes,
  loading,
  onNavigate,
}: DashboardViewProps) {
  const jakartaNow = getJakartaYearMonth();
  const [selectedYear, setSelectedYear] = useState<number>(jakartaNow.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(jakartaNow.month);

  const availableYears = useMemo(() => {
    const years = new Set<number>([jakartaNow.year]);
    incomes.forEach((inc) => {
      const y = Number(inc.transactionDate.slice(0, 4));
      if (y) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [incomes, jakartaNow.year]);

  // Archive statistics
  const totalStorageBytes = useMemo(
    () => files.reduce((sum, f) => sum + (Number(f.fileSize) || 0), 0),
    [files]
  );

  const latestUploadedFile = useMemo(() => {
    if (!files.length) return null;
    return [...files].sort(
      (a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)
    )[0];
  }, [files]);

  const latestUpdatedFile = useMemo(() => {
    if (!files.length) return null;
    return [...files].sort(
      (a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0)
    )[0];
  }, [files]);

  const latestIncome = useMemo(() => {
    if (!incomes.length) return null;
    return [...incomes].sort((a, b) => {
      const dateCmp = b.transactionDate.localeCompare(a.transactionDate);
      if (dateCmp !== 0) return dateCmp;
      return (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0);
    })[0];
  }, [incomes]);

  // Financial metrics for selected month & year
  const monthPrefix = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const yearPrefix = `${selectedYear}-`;

  const monthIncomes = useMemo(
    () => incomes.filter((i) => i.transactionDate.startsWith(monthPrefix)),
    [incomes, monthPrefix]
  );

  const yearIncomes = useMemo(
    () => incomes.filter((i) => i.transactionDate.startsWith(yearPrefix)),
    [incomes, yearPrefix]
  );

  const totalMonthIncome = useMemo(
    () => monthIncomes.reduce((sum, i) => sum + Number(i.amount), 0),
    [monthIncomes]
  );

  const totalYearIncome = useMemo(
    () => yearIncomes.reduce((sum, i) => sum + Number(i.amount), 0),
    [yearIncomes]
  );

  const lunasMonthIncome = useMemo(
    () =>
      monthIncomes
        .filter((i) => i.paymentStatus === 'lunas')
        .reduce((sum, i) => sum + Number(i.amount), 0),
    [monthIncomes]
  );

  const belumLunasMonthIncome = useMemo(
    () =>
      monthIncomes
        .filter((i) => i.paymentStatus === 'belum_lunas')
        .reduce((sum, i) => sum + Number(i.amount), 0),
    [monthIncomes]
  );

  // Previous month comparison
  const prevPeriod = useMemo(() => {
    if (selectedMonth === 1) return { year: selectedYear - 1, month: 12 };
    return { year: selectedYear, month: selectedMonth - 1 };
  }, [selectedYear, selectedMonth]);

  const prevMonthPrefix = `${prevPeriod.year}-${String(prevPeriod.month).padStart(2, '0')}`;
  const prevMonthIncome = useMemo(
    () =>
      incomes
        .filter((i) => i.transactionDate.startsWith(prevMonthPrefix))
        .reduce((sum, i) => sum + Number(i.amount), 0),
    [incomes, prevMonthPrefix]
  );

  const momDeltaPct = useMemo(() => {
    if (prevMonthIncome === 0) return totalMonthIncome > 0 ? 100 : 0;
    return ((totalMonthIncome - prevMonthIncome) / prevMonthIncome) * 100;
  }, [totalMonthIncome, prevMonthIncome]);

  // 12-month chart data
  const monthlyChartData = useMemo(() => {
    return MONTHS_ID.map((name, idx) => {
      const mPrefix = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
      const mItems = yearIncomes.filter((i) => i.transactionDate.startsWith(mPrefix));
      const lunas = mItems
        .filter((i) => i.paymentStatus === 'lunas')
        .reduce((sum, i) => sum + Number(i.amount), 0);
      const belumLunas = mItems
        .filter((i) => i.paymentStatus === 'belum_lunas')
        .reduce((sum, i) => sum + Number(i.amount), 0);
      return {
        bulan: name.slice(0, 3),
        fullBulan: name,
        Lunas: lunas,
        'Belum Lunas': belumLunas,
        Total: lunas + belumLunas,
      };
    });
  }, [yearIncomes, selectedYear]);

  // Income by service category chart
  const serviceChartData = useMemo(() => {
    const map = new Map<string, number>();
    yearIncomes.forEach((item) => {
      const key = item.serviceType || 'Lainnya';
      map.set(key, (map.get(key) || 0) + Number(item.amount));
    });
    return Array.from(map.entries())
      .map(([jasa, total]) => ({
        jasa: jasa.length > 22 ? jasa.slice(0, 20) + '…' : jasa,
        fullJasa: jasa,
        Total: total,
      }))
      .sort((a, b) => b.Total - a.Total)
      .slice(0, 7);
  }, [yearIncomes]);

  const momComparisonData = useMemo(
    () => [
      {
        periode: `${MONTHS_ID[prevPeriod.month - 1].slice(0, 3)} ${prevPeriod.year}`,
        Total: prevMonthIncome,
      },
      {
        periode: `${MONTHS_ID[selectedMonth - 1].slice(0, 3)} ${selectedYear}`,
        Total: totalMonthIncome,
      },
    ],
    [prevPeriod, prevMonthIncome, selectedMonth, selectedYear, totalMonthIncome]
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 h-80 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
          <div className="lg:col-span-4 h-80 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Financial Period Filters */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Ringkasan Vault & Finansial
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Pantau kapasitas arsip digital dan arus pendapatan jasa freelance Anda secara real-time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            aria-label="Filter Bulan"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            {MONTHS_ID.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter Tahun"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            {availableYears.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => onNavigate('finance')}
            className="inline-flex items-center gap-2 rounded-xl bg-[#172554] hover:bg-blue-900 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Catat Pendapatan
          </button>
        </div>
      </div>

      {/* Financial KPI Section */}
      <section aria-label="Statistik Finansial">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Statistik Finansial · {MONTHS_ID[selectedMonth - 1]} {selectedYear}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {monthIncomes.length} transaksi bulan ini
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Pendapatan Bulan Ini</span>
              <Wallet className="h-4 w-4 text-[#2563EB] dark:text-[#38BDF8]" />
            </div>
            <p className="mt-3 font-mono text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatIDR(totalMonthIncome)}
            </p>
            <div className="mt-2 flex items-center gap-1 text-xs tabular-nums">
              {momDeltaPct >= 0 ? (
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <ArrowDownRight className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
              )}
              <span
                className={
                  momDeltaPct >= 0
                    ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                    : 'text-red-600 dark:text-red-400 font-medium'
                }
              >
                {momDeltaPct >= 0 ? '+' : ''}
                {momDeltaPct.toFixed(1)}%
              </span>
              <span className="text-slate-400">vs bulan lalu</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Pendapatan Tahun {selectedYear}</span>
              <Wallet className="h-4 w-4 text-[#172554] dark:text-[#38BDF8]" />
            </div>
            <p className="mt-3 font-mono text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatIDR(totalYearIncome)}
            </p>
            <p className="mt-2 text-xs text-slate-400 tabular-nums">
              {yearIncomes.length} total transaksi tahunan
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Pendapatan Lunas</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="mt-3 font-mono text-xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatIDR(lunasMonthIncome)}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Diterima aktual (Lunas)
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Belum Lunas</span>
              <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="mt-3 font-mono text-xl font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatIDR(belumLunasMonthIncome)}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Menunggu pelunasan klien
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total Transaksi</span>
              <Receipt className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
            <p className="mt-3 font-mono text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {monthIncomes.length}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {incomes.length} seluruh riwayat
            </p>
          </div>
        </div>
      </section>

      {/* Archive KPI Section */}
      <section aria-label="Statistik Arsip">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Statistik Arsip Dokumen
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('archives')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] dark:text-[#38BDF8] hover:underline cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            Buka Folder Arsip
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total Folder</span>
              <FolderOpen className="h-4 w-4 text-[#2563EB] dark:text-[#38BDF8]" />
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {folders.length}
            </p>
            <p className="mt-1.5 text-xs text-slate-400">Direktori terstruktur</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total Dokumen</span>
              <FileText className="h-4 w-4 text-[#2563EB] dark:text-[#38BDF8]" />
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {files.length}
            </p>
            <p className="mt-1.5 text-xs text-slate-400">Tersimpan di private bucket</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Total Penyimpanan</span>
              <HardDrive className="h-4 w-4 text-[#2563EB] dark:text-[#38BDF8]" />
            </div>
            <p className="mt-3 font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatBytes(totalStorageBytes)}
            </p>
            <p className="mt-1.5 text-xs text-slate-400">Akumulasi ukuran file</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Dokumen Terbaru</span>
              <Clock className="h-4 w-4 text-[#2563EB] dark:text-[#38BDF8]" />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-white truncate">
              {latestUploadedFile ? latestUploadedFile.fileName : 'Belum ada file'}
            </p>
            <p className="mt-2 text-xs text-slate-400 tabular-nums">
              {latestUploadedFile
                ? `${formatBytes(latestUploadedFile.fileSize)} · ${formatTimestampID(latestUploadedFile.createdAt)}`
                : 'Unggah dokumen pertama Anda'}
            </p>
          </div>
        </div>
      </section>

      {/* Charts Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Monthly Income Chart */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Grafik Pendapatan Bulanan ({selectedYear})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Pemisahan pendapatan lunas dan belum lunas per bulan
              </p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:opacity-20" />
                <XAxis dataKey="bulan" tick={{ fontSize: 12 }} stroke="#64748B" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#64748B"
                  tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${v / 1000}rb` : String(v))}
                />
                <Tooltip
                  formatter={(value) => formatIDR(Number(value ?? 0))}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Lunas" stackId="a" fill="#2563EB" radius={[0, 0, 0, 0]} />
                <Bar dataKey="Belum Lunas" stackId="a" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Month-over-Month Comparison Chart */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
              Perbandingan Antarbulan
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {MONTHS_ID[prevPeriod.month - 1]} vs {MONTHS_ID[selectedMonth - 1]}
            </p>
          </div>

          <div className="h-56 w-full my-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={momComparisonData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:opacity-20" />
                <XAxis dataKey="periode" tick={{ fontSize: 12 }} stroke="#64748B" />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="#64748B"
                  tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${v / 1000}rb` : String(v))}
                />
                <Tooltip
                  formatter={(value) => formatIDR(Number(value ?? 0))}
                  contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="Total" fill="#172554" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Selisih nominal</span>
            <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
              {totalMonthIncome - prevMonthIncome >= 0 ? '+' : ''}
              {formatIDR(totalMonthIncome - prevMonthIncome)}
            </span>
          </div>
        </div>
      </section>

      {/* Income by Service Type + Activity Feed */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Service Breakdown */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Pendapatan Berdasarkan Jenis Jasa ({selectedYear})
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            Kontribusi setiap layanan freelance sepanjang tahun {selectedYear}
          </p>

          {serviceChartData.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Belum ada transaksi pendapatan pada tahun {selectedYear}.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('finance')}
                className="mt-3 text-xs font-medium text-[#2563EB] dark:text-[#38BDF8] hover:underline cursor-pointer"
              >
                Catat Transaksi Pertama
              </button>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={serviceChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:opacity-20" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    stroke="#64748B"
                    tickFormatter={(v) => (v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${v / 1000}rb` : String(v))}
                  />
                  <YAxis
                    type="category"
                    dataKey="jasa"
                    width={150}
                    tick={{ fontSize: 11 }}
                    stroke="#64748B"
                  />
                  <Tooltip
                    formatter={(value) => formatIDR(Number(value ?? 0))}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Bar dataKey="Total" fill="#38BDF8" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Aktivitas Terkini
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
            Catatan pembaruan terbaru di vault dan modul finansial
          </p>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            <div className="py-3.5 first:pt-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">File Terakhir Diupload</p>
              {latestUploadedFile ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {latestUploadedFile.fileName}
                  </p>
                  <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
                    {formatTimestampID(latestUploadedFile.createdAt)}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-400">Belum ada file diupload</p>
              )}
            </div>

            <div className="py-3.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Pendapatan Terakhir Dicatat</p>
              {latestIncome ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                      {latestIncome.clientName} · {latestIncome.serviceType}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatDateID(latestIncome.transactionDate)} ·{' '}
                      {latestIncome.paymentStatus === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white whitespace-nowrap shrink-0 tabular-nums">
                    {formatIDR(latestIncome.amount)}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-400">Belum ada pendapatan dicatat</p>
              )}
            </div>

            <div className="py-3.5 last:pb-0">
              <p className="text-xs text-slate-500 dark:text-slate-400">Dokumen Terakhir Diperbarui</p>
              {latestUpdatedFile ? (
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {latestUpdatedFile.fileName}
                  </p>
                  <span className="text-xs text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
                    {formatTimestampID(latestUpdatedFile.updatedAt)}
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-400">Belum ada dokumen diperbarui</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
