import React, { useMemo, useState } from 'react';
import { FileDown, FileSpreadsheet, Printer } from 'lucide-react';
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
import { IncomeRecord } from '../../types';
import {
  formatDateID,
  formatIDR,
  getJakartaYearMonth,
  MONTHS_ID,
} from '../../lib/utils';
import {
  exportMonthlyReportExcel,
  exportMonthlyReportPDF,
} from '../../lib/exportReports';
import { toast } from 'sonner';

interface ReportsViewProps {
  incomes: IncomeRecord[];
  loading: boolean;
  appTitle: string;
}

export function ReportsView({ incomes, loading, appTitle }: ReportsViewProps) {
  const jakartaNow = getJakartaYearMonth();
  const [selectedYear, setSelectedYear] = useState<number>(jakartaNow.year);
  const [selectedMonth, setSelectedMonth] = useState<number>(jakartaNow.month); // 0 = full year

  const availableYears = useMemo(() => {
    const yrs = new Set<number>([jakartaNow.year]);
    incomes.forEach((inc) => {
      const y = Number(inc.transactionDate.slice(0, 4));
      if (y) yrs.add(y);
    });
    return Array.from(yrs).sort((a, b) => b - a);
  }, [incomes, jakartaNow.year]);

  const filteredRecords = useMemo(() => {
    const prefix =
      selectedMonth === 0
        ? `${selectedYear}-`
        : `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    return incomes
      .filter((i) => i.transactionDate.startsWith(prefix))
      .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));
  }, [incomes, selectedYear, selectedMonth]);

  const summary = useMemo(() => {
    const totalPendapatan = filteredRecords.reduce((s, i) => s + Number(i.amount), 0);
    const pendapatanLunas = filteredRecords
      .filter((i) => i.paymentStatus === 'lunas')
      .reduce((s, i) => s + Number(i.amount), 0);
    const belumLunas = filteredRecords
      .filter((i) => i.paymentStatus === 'belum_lunas')
      .reduce((s, i) => s + Number(i.amount), 0);

    return {
      totalPendapatan,
      pendapatanLunas,
      belumLunas,
      jumlahTransaksi: filteredRecords.length,
    };
  }, [filteredRecords]);

  // 12-month chart for selected year
  const yearlyChartData = useMemo(() => {
    const yearPrefix = `${selectedYear}-`;
    const yearItems = incomes.filter((i) => i.transactionDate.startsWith(yearPrefix));
    return MONTHS_ID.map((mName, idx) => {
      const mPrefix = `${selectedYear}-${String(idx + 1).padStart(2, '0')}`;
      const rows = yearItems.filter((i) => i.transactionDate.startsWith(mPrefix));
      const lunas = rows
        .filter((i) => i.paymentStatus === 'lunas')
        .reduce((s, i) => s + Number(i.amount), 0);
      const belumLunas = rows
        .filter((i) => i.paymentStatus === 'belum_lunas')
        .reduce((s, i) => s + Number(i.amount), 0);
      return {
        bulan: mName.slice(0, 3),
        Lunas: lunas,
        'Belum Lunas': belumLunas,
      };
    });
  }, [incomes, selectedYear]);

  const periodLabel =
    selectedMonth === 0
      ? `Tahun ${selectedYear}`
      : `${MONTHS_ID[selectedMonth - 1]} ${selectedYear}`;

  const handleExportPDF = () => {
    exportMonthlyReportPDF({
      year: selectedYear,
      month: selectedMonth,
      ...summary,
      records: filteredRecords,
      appTitle,
    });
    toast.success('Laporan PDF berhasil diekspor');
  };

  const handleExportExcel = () => {
    exportMonthlyReportExcel({
      year: selectedYear,
      month: selectedMonth,
      ...summary,
      records: filteredRecords,
      appTitle,
    });
    toast.success('Laporan Excel (.xlsx) berhasil diekspor');
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-72 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className="h-96 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls (hidden when printing) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Rekap Bulanan & Laporan
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Analisis perbandingan pendapatan bulanan serta ekspor laporan resmi ke PDF, Excel, atau Cetak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <select
            aria-label="Pilih Bulan Laporan"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value={0}>Semua Bulan (Tahunan)</option>
            {MONTHS_ID.map((name, idx) => (
              <option key={name} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>

          <select
            aria-label="Pilih Tahun Laporan"
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
            onClick={handleExportPDF}
            className="inline-flex items-center gap-2 rounded-xl bg-[#172554] hover:bg-blue-900 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileDown className="h-4 w-4" />
            Export PDF
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Excel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            Cetak
          </button>
        </div>
      </div>

      {/* Yearly Comparison Chart (hidden when printing) */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 no-print">
        <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
          Perbandingan Pendapatan Bulanan · {selectedYear}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          Distribusi pendapatan lunas vs belum lunas sepanjang 12 bulan
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:opacity-20" />
              <XAxis dataKey="bulan" tick={{ fontSize: 12 }} stroke="#64748B" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#64748B"
                tickFormatter={(v) =>
                  v >= 1000000 ? `${(v / 1000000).toFixed(1)}jt` : v >= 1000 ? `${v / 1000}rb` : String(v)
                }
              />
              <Tooltip
                formatter={(value) => formatIDR(Number(value ?? 0))}
                contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="Lunas" stackId="a" fill="#2563EB" />
              <Bar dataKey="Belum Lunas" stackId="a" fill="#F59E0B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Printable / Formal Report Sheet */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        {/* Report Header */}
        <div className="bg-[#172554] px-6 py-6 text-white">
          <p className="font-display text-lg font-bold tracking-wide">
            {appTitle.toUpperCase()}
          </p>
          <p className="mt-1 text-sm font-medium text-sky-200">
            LAPORAN PENDAPATAN FREELANCE
          </p>
          <p className="mt-2 text-xs text-slate-200">Periode: {periodLabel}</p>
        </div>

        {/* Report Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Total Pendapatan</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {formatIDR(summary.totalPendapatan)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Pendapatan Lunas</p>
            <p className="mt-1 font-mono text-lg font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatIDR(summary.pendapatanLunas)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Belum Lunas</p>
            <p className="mt-1 font-mono text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">
              {formatIDR(summary.belumLunas)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Jumlah Transaksi</p>
            <p className="mt-1 font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums">
              {summary.jumlahTransaksi}
            </p>
          </div>
        </div>

        {/* Report Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <tr>
                <th className="px-4 py-3 w-14 text-center">No</th>
                <th className="px-4 py-3">Tanggal</th>
                <th className="px-4 py-3">Klien</th>
                <th className="px-4 py-3">Jenis Jasa</th>
                <th className="px-4 py-3 text-right">Nominal</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                    Tidak ada transaksi pada periode {periodLabel}.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-center text-xs text-slate-500 tabular-nums">
                      {idx + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {formatDateID(item.transactionDate)}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {item.clientName}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                      {item.serviceType}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                      {formatIDR(item.amount)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs font-medium whitespace-nowrap">
                      <span
                        className={
                          item.paymentStatus === 'lunas'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }
                      >
                        {item.paymentStatus === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Report Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Dicetak melalui DigiVault.</span>
          <span className="tabular-nums">Zona Waktu: Asia/Jakarta (WIB)</span>
        </div>
      </div>
    </div>
  );
}
