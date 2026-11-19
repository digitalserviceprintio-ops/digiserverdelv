import React, { useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Plus,
  Search,
  ArrowUpDown,
  Eye,
  Pencil,
  Trash2,
  X,
  Upload,
  Loader2,
  CheckCircle2,
  Hourglass,
  FileText,
  Download,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { IncomeRecord, PaymentStatus } from '../../types';
import {
  formatDateID,
  formatIDR,
  getJakartaTodayISO,
  getJakartaYearMonth,
  MONTHS_ID,
} from '../../lib/utils';
import {
  ALLOWED_RECEIPT_EXTENSIONS,
  hasAllowedExtension,
  incomeSchema,
} from '../../lib/validations';
import {
  deleteFromVault,
  getVaultSignedUrl,
  uploadToVault,
} from '../../lib/vaultStorage';
import { ConfirmModal } from '../ui/ConfirmModal';
import { z } from 'zod';

type IncomeFormValues = z.infer<typeof incomeSchema>;

interface FinanceViewProps {
  incomes: IncomeRecord[];
  loading: boolean;
  serviceCategories: string[];
  paymentMethods: string[];
  maxUploadMb: number;
  globalSearch: string;
  onCreateIncome: (payload: {
    transactionDate: string;
    clientName: string;
    serviceType: string;
    description: string;
    amount: number;
    paymentMethod: string;
    paymentStatus: PaymentStatus;
    receiptPath: string;
    receiptName: string;
    receiptMimeType: string;
  }) => Promise<void>;
  onUpdateIncome: (
    incomeId: string,
    payload: {
      transactionDate: string;
      clientName: string;
      serviceType: string;
      description: string;
      amount: number;
      paymentMethod: string;
      paymentStatus: PaymentStatus;
      receiptPath: string;
      receiptName: string;
      receiptMimeType: string;
    }
  ) => Promise<void>;
  onToggleStatus: (income: IncomeRecord) => Promise<void>;
  onDeleteIncome: (income: IncomeRecord) => Promise<void>;
}

export function FinanceView({
  incomes,
  loading,
  serviceCategories,
  paymentMethods,
  maxUploadMb,
  globalSearch,
  onCreateIncome,
  onUpdateIncome,
  onToggleStatus,
  onDeleteIncome,
}: FinanceViewProps) {
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentStatus>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Form Modal State
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<IncomeRecord | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);

  // Detail & Receipt Preview Modal
  const [detailIncome, setDetailIncome] = useState<IncomeRecord | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<{
    loading: boolean;
    signedUrl: string;
    error: string;
  }>({ loading: false, signedUrl: '', error: '' });

  // Delete Confirm
  const [confirmDelete, setConfirmDelete] = useState<IncomeRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<IncomeFormValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      transactionDate: getJakartaTodayISO(),
      clientName: '',
      serviceType: serviceCategories[0] || 'Pembuatan website',
      description: '',
      amount: 0,
      paymentMethod: paymentMethods[0] || 'Transfer Bank',
      paymentStatus: 'lunas',
    },
  });

  const searchQuery = (localSearch || globalSearch).trim().toLowerCase();

  const filteredIncomes = useMemo(() => {
    const list = incomes.filter((item) => {
      if (statusFilter !== 'all' && item.paymentStatus !== statusFilter) return false;
      if (serviceFilter !== 'all' && item.serviceType !== serviceFilter) return false;
      if (dateFrom && item.transactionDate < dateFrom) return false;
      if (dateTo && item.transactionDate > dateTo) return false;
      if (searchQuery) {
        const match =
          item.clientName.toLowerCase().includes(searchQuery) ||
          item.serviceType.toLowerCase().includes(searchQuery) ||
          item.description.toLowerCase().includes(searchQuery);
        if (!match) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'date') {
        const cmp = a.transactionDate.localeCompare(b.transactionDate);
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const diff = Number(a.amount) - Number(b.amount);
      return sortDir === 'asc' ? diff : -diff;
    });
  }, [incomes, statusFilter, serviceFilter, dateFrom, dateTo, searchQuery, sortBy, sortDir]);

  // Automatic Financial Calculations (strict separation of Lunas vs Belum Lunas)
  const jakartaNow = getJakartaYearMonth();
  const currentMonthPrefix = `${jakartaNow.year}-${String(jakartaNow.month).padStart(2, '0')}`;

  const summary = useMemo(() => {
    const totalSemua = filteredIncomes.reduce((s, i) => s + Number(i.amount), 0);
    const totalLunas = filteredIncomes
      .filter((i) => i.paymentStatus === 'lunas')
      .reduce((s, i) => s + Number(i.amount), 0);
    const totalBelumLunas = filteredIncomes
      .filter((i) => i.paymentStatus === 'belum_lunas')
      .reduce((s, i) => s + Number(i.amount), 0);
    const bulanBerjalan = incomes
      .filter((i) => i.transactionDate.startsWith(currentMonthPrefix))
      .reduce((s, i) => s + Number(i.amount), 0);

    return { totalSemua, totalLunas, totalBelumLunas, bulanBerjalan };
  }, [filteredIncomes, incomes, currentMonthPrefix]);

  const openCreateModal = () => {
    setEditingIncome(null);
    setReceiptFile(null);
    setRemoveExistingReceipt(false);
    reset({
      transactionDate: getJakartaTodayISO(),
      clientName: '',
      serviceType: serviceCategories[0] || 'Pembuatan website',
      description: '',
      amount: undefined as unknown as number,
      paymentMethod: paymentMethods[0] || 'Transfer Bank',
      paymentStatus: 'lunas',
    });
    setFormModalOpen(true);
  };

  const openEditModal = (income: IncomeRecord) => {
    setEditingIncome(income);
    setReceiptFile(null);
    setRemoveExistingReceipt(false);
    reset({
      transactionDate: income.transactionDate,
      clientName: income.clientName,
      serviceType: income.serviceType,
      description: income.description,
      amount: income.amount,
      paymentMethod: income.paymentMethod,
      paymentStatus: income.paymentStatus,
    });
    setFormModalOpen(true);
  };

  const onSubmitForm = async (values: IncomeFormValues) => {
    if (receiptFile) {
      if (!hasAllowedExtension(receiptFile.name, ALLOWED_RECEIPT_EXTENSIONS)) {
        toast.error('Bukti transaksi harus berformat JPG, JPEG, PNG, atau PDF.');
        return;
      }
      if (receiptFile.size > maxUploadMb * 1024 * 1024) {
        toast.error(`Ukuran bukti transaksi maksimal ${maxUploadMb} MB.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      let receiptPath = editingIncome?.receiptPath || '';
      let receiptName = editingIncome?.receiptName || '';
      let receiptMimeType = editingIncome?.receiptMimeType || '';
      const oldReceiptToDelete =
        editingIncome?.receiptPath && (receiptFile || removeExistingReceipt)
          ? editingIncome.receiptPath
          : '';

      if (removeExistingReceipt && !receiptFile) {
        receiptPath = '';
        receiptName = '';
        receiptMimeType = '';
      }

      if (receiptFile) {
        const uploaded = await uploadToVault(receiptFile, 'digivault-receipts', maxUploadMb);
        receiptPath = uploaded.storagePath;
        receiptName = uploaded.originalName;
        receiptMimeType = uploaded.mimeType;
      }

      const payload = {
        transactionDate: values.transactionDate,
        clientName: values.clientName.trim(),
        serviceType: values.serviceType.trim(),
        description: (values.description || '').trim(),
        amount: Number(values.amount),
        paymentMethod: values.paymentMethod.trim(),
        paymentStatus: values.paymentStatus,
        receiptPath,
        receiptName,
        receiptMimeType,
      };

      if (editingIncome) {
        await onUpdateIncome(editingIncome.id, payload);
        if (oldReceiptToDelete) {
          await deleteFromVault('digivault-receipts', oldReceiptToDelete).catch(() => {});
        }
        toast.success('Transaksi pendapatan diperbarui');
      } else {
        await onCreateIncome(payload);
        toast.success('Pendapatan berhasil dicatat');
      }

      setFormModalOpen(false);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menyimpan transaksi');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetailModal = async (income: IncomeRecord) => {
    setDetailIncome(income);
    setReceiptPreview({ loading: false, signedUrl: '', error: '' });
    if (income.receiptPath) {
      setReceiptPreview({ loading: true, signedUrl: '', error: '' });
      try {
        const { signedUrl } = await getVaultSignedUrl(
          'digivault-receipts',
          income.receiptPath,
          'inline',
          income.receiptName || 'bukti-transaksi'
        );
        setReceiptPreview({ loading: false, signedUrl, error: '' });
      } catch (err: unknown) {
        setReceiptPreview({
          loading: false,
          signedUrl: '',
          error: (err as Error).message || 'Gagal memuat bukti pembayaran',
        });
      }
    }
  };

  const handleDownloadReceipt = async (income: IncomeRecord) => {
    if (!income.receiptPath) return;
    try {
      const { signedUrl } = await getVaultSignedUrl(
        'digivault-receipts',
        income.receiptPath,
        'attachment',
        income.receiptName || 'bukti-transaksi'
      );
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = income.receiptName || 'bukti-transaksi';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal mengunduh bukti transaksi');
    }
  };

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await onDeleteIncome(confirmDelete);
      toast.success('Transaksi berhasil dihapus');
      setConfirmDelete(null);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menghapus transaksi');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Finansial · Pendapatan Freelance
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Catat pemasukan jasa, pantau status pelunasan, dan simpan bukti pembayaran secara privat.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-xl bg-[#172554] hover:bg-blue-900 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-4 py-2.5 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          Tambah Pendapatan
        </button>
      </div>

      {/* Automatic Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Pendapatan (Terfilter)</p>
          <p className="mt-2 font-mono text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {formatIDR(summary.totalSemua)}
          </p>
          <p className="mt-1.5 text-xs text-slate-400 tabular-nums">
            {filteredIncomes.length} transaksi
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pendapatan Lunas (Aktual)</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatIDR(summary.totalLunas)}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Dana sudah diterima</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Pendapatan Belum Lunas</span>
            <Hourglass className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
            {formatIDR(summary.totalBelumLunas)}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Belum masuk kas aktual</p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Bulan Berjalan ({MONTHS_ID[jakartaNow.month - 1]})</span>
            <Wallet className="h-4 w-4 text-[#2563EB] dark:text-[#38BDF8]" />
          </div>
          <p className="mt-2 font-mono text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
            {formatIDR(summary.bulanBerjalan)}
          </p>
          <p className="mt-1.5 text-xs text-slate-400">Tahun {jakartaNow.year}</p>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="search"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Cari nama klien, jenis jasa, atau deskripsi..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 pl-9 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <select
            aria-label="Filter Jenis Jasa"
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="all">Semua Jenis Jasa</option>
            {serviceCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <input
            type="date"
            aria-label="Tanggal Mulai"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />

          <input
            type="date"
            aria-label="Tanggal Akhir"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Status Segmented Tabs */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
            {(
              [
                { id: 'all', label: 'Semua Status' },
                { id: 'lunas', label: 'Lunas' },
                { id: 'belum_lunas', label: 'Belum Lunas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (sortBy === 'date') setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                else {
                  setSortBy('date');
                  setSortDir('desc');
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                sortBy === 'date'
                  ? 'border-[#2563EB] text-[#2563EB] dark:text-[#38BDF8]'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Tanggal {sortBy === 'date' ? (sortDir === 'desc' ? '(Terbaru)' : '(Terlama)') : ''}
            </button>

            <button
              type="button"
              onClick={() => {
                if (sortBy === 'amount') setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                else {
                  setSortBy('amount');
                  setSortDir('desc');
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                sortBy === 'amount'
                  ? 'border-[#2563EB] text-[#2563EB] dark:text-[#38BDF8]'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Nominal {sortBy === 'amount' ? (sortDir === 'desc' ? '(Tertinggi)' : '(Terendah)') : ''}
            </button>

            {(localSearch || statusFilter !== 'all' || serviceFilter !== 'all' || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setStatusFilter('all');
                  setServiceFilter('all');
                  setDateFrom('');
                  setDateTo('');
                }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          ))}
        </div>
      ) : filteredIncomes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <Wallet className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-4 font-display text-base font-semibold text-slate-900 dark:text-white">
            Belum ada data pendapatan
          </h3>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            Mulai catat pemasukan freelance Anda untuk memantau rekap dan pelunasan.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#172554] dark:bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Catat Pendapatan Pertama
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Klien</th>
                  <th className="px-4 py-3">Jenis Jasa</th>
                  <th className="px-4 py-3">Metode</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredIncomes.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums whitespace-nowrap">
                      {formatDateID(item.transactionDate)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 dark:text-white">{item.clientName}</p>
                      {item.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                          {item.description}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
                      {item.serviceType}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                      {item.paymentMethod}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900 dark:text-white tabular-nums whitespace-nowrap">
                      {formatIDR(item.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onToggleStatus(item)}
                        title="Klik untuk ubah status pelunasan"
                        className={`inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer hover:underline ${
                          item.paymentStatus === 'lunas'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.paymentStatus === 'lunas' ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <Hourglass className="h-3.5 w-3.5" />
                        )}
                        {item.paymentStatus === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openDetailModal(item)}
                          title="Detail & Bukti Transaksi"
                          className="rounded-lg p-1.5 text-[#2563EB] dark:text-[#38BDF8] hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Edit transaksi"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(item)}
                          title="Hapus transaksi"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Transaction Modal */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmit(onSubmitForm)}
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl my-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {editingIncome ? 'Edit Transaksi Pendapatan' : 'Tambah Pendapatan Freelance'}
              </h3>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Tanggal Transaksi
                </label>
                <input
                  type="date"
                  {...register('transactionDate')}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                {errors.transactionDate && (
                  <p className="mt-1 text-xs text-red-600">{errors.transactionDate.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Nama Klien
                </label>
                <input
                  type="text"
                  {...register('clientName')}
                  placeholder="Nama klien / instansi"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                {errors.clientName && (
                  <p className="mt-1 text-xs text-red-600">{errors.clientName.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Jenis Jasa
                </label>
                <select
                  {...register('serviceType')}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  {serviceCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                {errors.serviceType && (
                  <p className="mt-1 text-xs text-red-600">{errors.serviceType.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Nominal Pendapatan (IDR)
                </label>
                <input
                  type="number"
                  min={1}
                  step="any"
                  {...register('amount', { valueAsNumber: true })}
                  placeholder="1500000"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-mono tabular-nums text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                {errors.amount && (
                  <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Metode Pembayaran
                </label>
                <select
                  {...register('paymentMethod')}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
                {errors.paymentMethod && (
                  <p className="mt-1 text-xs text-red-600">{errors.paymentMethod.message}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Status Pembayaran
                </label>
                <select
                  {...register('paymentStatus')}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                >
                  <option value="lunas">Lunas</option>
                  <option value="belum_lunas">Belum Lunas</option>
                </select>
                {errors.paymentStatus && (
                  <p className="mt-1 text-xs text-red-600">{errors.paymentStatus.message}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Deskripsi Pekerjaan
                </label>
                <textarea
                  rows={2}
                  {...register('description')}
                  placeholder="Catatan singkat lingkup pekerjaan atau nomor invoice..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />
                {errors.description && (
                  <p className="mt-1 text-xs text-red-600">{errors.description.message}</p>
                )}
              </div>

              {/* Receipt Upload */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                  Bukti Pembayaran (Opsional · JPG, PNG, PDF)
                </label>
                <input
                  ref={receiptInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setReceiptFile(f);
                    if (f) setRemoveExistingReceipt(false);
                  }}
                  className="hidden"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-3.5 py-2.5 text-xs">
                  <span className="text-slate-600 dark:text-slate-300 truncate max-w-[260px]">
                    {receiptFile
                      ? receiptFile.name
                      : editingIncome?.receiptPath && !removeExistingReceipt
                      ? `Tersimpan: ${editingIncome.receiptName}`
                      : 'Belum ada file bukti transaksi'}
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {(receiptFile || (editingIncome?.receiptPath && !removeExistingReceipt)) && (
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptFile(null);
                          setRemoveExistingReceipt(true);
                          if (receiptInputRef.current) receiptInputRef.current.value = '';
                        }}
                        className="text-red-600 hover:underline cursor-pointer"
                      >
                        Hapus
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => receiptInputRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Pilih File
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-xl bg-[#172554] dark:bg-[#2563EB] px-5 py-2 text-sm font-medium text-white hover:bg-blue-900 cursor-pointer disabled:opacity-60"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingIncome ? 'Simpan Perubahan' : 'Simpan Transaksi'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Detail Transaction Modal with Signed URL Receipt Preview */}
      {detailIncome && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl my-auto">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Detail Transaksi · {detailIncome.clientName}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {formatDateID(detailIncome.transactionDate)} · {detailIncome.serviceType}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailIncome(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Nominal</p>
                <p className="mt-1 font-mono text-base font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatIDR(detailIncome.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Metode Pembayaran</p>
                <p className="mt-1 font-medium text-slate-900 dark:text-white">
                  {detailIncome.paymentMethod}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Status</p>
                <p
                  className={`mt-1 font-medium ${
                    detailIncome.paymentStatus === 'lunas'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-amber-600 dark:text-amber-400'
                  }`}
                >
                  {detailIncome.paymentStatus === 'lunas' ? 'Lunas' : 'Belum Lunas'}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">Deskripsi Pekerjaan</p>
                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
                  {detailIncome.description || '-'}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span>Bukti Transaksi (Private Storage)</span>
                </div>
                {detailIncome.receiptPath && (
                  <button
                    type="button"
                    onClick={() => handleDownloadReceipt(detailIncome)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] dark:text-[#38BDF8] hover:underline cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Unduh Bukti
                  </button>
                )}
              </div>

              {!detailIncome.receiptPath ? (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-6 text-center text-xs text-slate-500">
                  Tidak ada bukti pembayaran yang dilampirkan pada transaksi ini.
                </div>
              ) : receiptPreview.loading ? (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-8 flex items-center justify-center gap-2 text-xs text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memuat preview aman...
                </div>
              ) : receiptPreview.error ? (
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 p-4 text-xs text-red-600 dark:text-red-400">
                  {receiptPreview.error}
                </div>
              ) : detailIncome.receiptMimeType === 'application/pdf' ||
                detailIncome.receiptName.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={receiptPreview.signedUrl}
                  title={detailIncome.receiptName}
                  className="w-full h-72 rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
                />
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 flex justify-center">
                  <img
                    src={receiptPreview.signedUrl}
                    alt={detailIncome.receiptName}
                    className="max-h-72 object-contain rounded-lg"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(confirmDelete)}
        destructive
        loading={deleting}
        title="Hapus Transaksi Pendapatan?"
        description={
          confirmDelete
            ? `Transaksi dari klien "${confirmDelete.clientName}" sebesar ${formatIDR(
                confirmDelete.amount
              )} beserta bukti pembayarannya akan dihapus secara permanen.`
            : ''
        }
        confirmLabel="Hapus Transaksi"
        onConfirm={confirmDeleteAction}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
