import React, { useMemo, useRef, useState } from 'react';
import {
  Folder,
  FolderPlus,
  Upload,
  Search,
  LayoutGrid,
  List,
  ChevronRight,
  Home,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileArchive,
  File as FileIcon,
  Eye,
  Download,
  Pencil,
  Trash2,
  X,
  Loader2,
  ArrowUpDown,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { ArchiveFile, ArchiveFolder } from '../../types';
import { formatBytes, formatTimestampID } from '../../lib/utils';
import {
  ALLOWED_ARCHIVE_EXTENSIONS,
  folderSchema,
  hasAllowedExtension,
  renameFileSchema,
} from '../../lib/validations';
import { getVaultSignedUrl, uploadToVault } from '../../lib/vaultStorage';
import { ConfirmModal } from '../ui/ConfirmModal';

interface ArchivesViewProps {
  folders: ArchiveFolder[];
  files: ArchiveFile[];
  loading: boolean;
  maxUploadMb: number;
  globalSearch: string;
  onCreateFolder: (name: string, parentId: string | null) => Promise<void>;
  onRenameFolder: (folderId: string, name: string) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onCreateFileRecord: (payload: {
    folderId: string | null;
    fileName: string;
    originalName: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
  }) => Promise<void>;
  onRenameFile: (fileId: string, fileName: string) => Promise<void>;
  onDeleteFile: (file: ArchiveFile) => Promise<void>;
}

type SortField = 'name' | 'date';
type SortDir = 'asc' | 'desc';

function getFileIcon(mime: string, name: string) {
  const lower = name.toLowerCase();
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/.test(lower)) {
    return <FileImage className="h-5 w-5 text-sky-600 dark:text-sky-400" />;
  }
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) {
    return <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />;
  }
  if (/\.(xls|xlsx)$/.test(lower)) {
    return <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
  }
  if (/\.zip$/.test(lower)) {
    return <FileArchive className="h-5 w-5 text-amber-600 dark:text-amber-400" />;
  }
  if (/\.(doc|docx|ppt|pptx|txt)$/.test(lower)) {
    return <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
  }
  return <FileIcon className="h-5 w-5 text-slate-500" />;
}

function isPreviewable(mime: string, name: string): 'pdf' | 'image' | null {
  const lower = name.toLowerCase();
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (mime.startsWith('image/') || /\.(jpg|jpeg|png|webp)$/.test(lower)) return 'image';
  return null;
}

export function ArchivesView({
  folders,
  files,
  loading,
  maxUploadMb,
  globalSearch,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onCreateFileRecord,
  onRenameFile,
  onDeleteFile,
}: ArchivesViewProps) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Folder Modal
  const [folderModal, setFolderModal] = useState<{
    open: boolean;
    mode: 'create' | 'rename';
    folder?: ArchiveFolder;
    name: string;
  }>({ open: false, mode: 'create', name: '' });
  const [savingFolder, setSavingFolder] = useState(false);

  // Rename File Modal
  const [renameFileModal, setRenameFileModal] = useState<{
    open: boolean;
    file?: ArchiveFile;
    fileName: string;
  }>({ open: false, fileName: '' });
  const [savingFileName, setSavingFileName] = useState(false);

  // Delete Confirmations
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<ArchiveFolder | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<ArchiveFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview Modal (Signed URL)
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    file?: ArchiveFile;
    kind: 'pdf' | 'image' | null;
    signedUrl: string;
    loading: boolean;
  }>({ open: false, kind: null, signedUrl: '', loading: false });

  const searchQuery = (localSearch || globalSearch).trim().toLowerCase();

  // Build breadcrumb path
  const breadcrumbs = useMemo(() => {
    const chain: ArchiveFolder[] = [];
    let pointer = currentFolderId;
    const guard = new Set<string>();
    while (pointer && !guard.has(pointer)) {
      guard.add(pointer);
      const found = folders.find((f) => f.id === pointer);
      if (!found) break;
      chain.unshift(found);
      pointer = found.parentId;
    }
    return chain;
  }, [folders, currentFolderId]);

  const visibleFolders = useMemo(() => {
    let list = searchQuery
      ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery))
      : folders.filter((f) => (f.parentId || null) === currentFolderId);

    list = [...list].sort((a, b) => {
      if (sortField === 'name') {
        const cmp = a.name.localeCompare(b.name, 'id');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const tA = a.createdAt?.toMillis() || 0;
      const tB = b.createdAt?.toMillis() || 0;
      return sortDir === 'asc' ? tA - tB : tB - tA;
    });
    return list;
  }, [folders, currentFolderId, searchQuery, sortField, sortDir]);

  const visibleFiles = useMemo(() => {
    let list = searchQuery
      ? files.filter(
          (f) =>
            f.fileName.toLowerCase().includes(searchQuery) ||
            f.originalName.toLowerCase().includes(searchQuery)
        )
      : files.filter((f) => (f.folderId || null) === currentFolderId);

    list = [...list].sort((a, b) => {
      if (sortField === 'name') {
        const cmp = a.fileName.localeCompare(b.fileName, 'id');
        return sortDir === 'asc' ? cmp : -cmp;
      }
      const tA = a.createdAt?.toMillis() || 0;
      const tB = b.createdAt?.toMillis() || 0;
      return sortDir === 'asc' ? tA - tB : tB - tA;
    });
    return list;
  }, [files, currentFolderId, searchQuery, sortField, sortDir]);

  const folderDeleteStats = useMemo(() => {
    if (!confirmDeleteFolder) return { subfolders: 0, files: 0 };
    const ids = new Set<string>([confirmDeleteFolder.id]);
    let added = true;
    while (added) {
      added = false;
      for (const f of folders) {
        if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
          ids.add(f.id);
          added = true;
        }
      }
    }
    const subCount = ids.size - 1;
    const fileCount = files.filter((f) => f.folderId && ids.has(f.folderId)).length;
    return { subfolders: subCount, files: fileCount };
  }, [confirmDeleteFolder, folders, files]);

  const handleFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = folderSchema.safeParse({ name: folderModal.name });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Nama folder tidak valid');
      return;
    }

    setSavingFolder(true);
    try {
      if (folderModal.mode === 'create') {
        await onCreateFolder(parsed.data.name, currentFolderId);
        toast.success('Folder berhasil dibuat');
      } else if (folderModal.folder) {
        await onRenameFolder(folderModal.folder.id, parsed.data.name);
        toast.success('Nama folder diperbarui');
      }
      setFolderModal({ open: false, mode: 'create', name: '' });
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menyimpan folder');
    } finally {
      setSavingFolder(false);
    }
  };

  const handleFileRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameFileModal.file) return;
    const parsed = renameFileSchema.safeParse({ fileName: renameFileModal.fileName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Nama file tidak valid');
      return;
    }

    setSavingFileName(true);
    try {
      await onRenameFile(renameFileModal.file.id, parsed.data.fileName);
      toast.success('Nama file diperbarui');
      setRenameFileModal({ open: false, fileName: '' });
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal mengganti nama file');
    } finally {
      setSavingFileName(false);
    }
  };

  const handleUploadFiles = async (selectedFiles: FileList | File[]) => {
    const fileArr = Array.from(selectedFiles);
    if (!fileArr.length) return;

    // Pre-validate locally before hitting server
    const maxBytes = maxUploadMb * 1024 * 1024;
    for (const file of fileArr) {
      if (!hasAllowedExtension(file.name, ALLOWED_ARCHIVE_EXTENSIONS)) {
        toast.error(`Format file "${file.name}" tidak didukung.`);
        return;
      }
      if (file.size > maxBytes) {
        toast.error(`File "${file.name}" melebihi batas ${maxUploadMb} MB.`);
        return;
      }
    }

    setUploading(true);
    let successCount = 0;
    try {
      for (const file of fileArr) {
        const uploaded = await uploadToVault(file, 'digivault-files', maxUploadMb);
        await onCreateFileRecord({
          folderId: currentFolderId,
          fileName: uploaded.originalName,
          originalName: uploaded.originalName,
          storagePath: uploaded.storagePath,
          mimeType: uploaded.mimeType,
          fileSize: uploaded.fileSize,
        });
        successCount += 1;
      }
      toast.success(`${successCount} dokumen berhasil diupload ke vault`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Sebagian atau seluruh unggahan gagal.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePreviewFile = async (file: ArchiveFile) => {
    const kind = isPreviewable(file.mimeType, file.fileName);
    if (!kind) {
      toast.info('Preview langsung tersedia untuk PDF dan gambar. Mengunduh file...');
      await handleDownloadFile(file);
      return;
    }

    setPreviewState({ open: true, file, kind, signedUrl: '', loading: true });
    try {
      const { signedUrl } = await getVaultSignedUrl(
        'digivault-files',
        file.storagePath,
        'inline',
        file.fileName
      );
      setPreviewState({ open: true, file, kind, signedUrl, loading: false });
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal membuka preview file');
      setPreviewState({ open: false, kind: null, signedUrl: '', loading: false });
    }
  };

  const handleDownloadFile = async (file: ArchiveFile) => {
    try {
      const { signedUrl } = await getVaultSignedUrl(
        'digivault-files',
        file.storagePath,
        'attachment',
        file.fileName
      );
      const a = document.createElement('a');
      a.href = signedUrl;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success(`Mengunduh ${file.fileName}`);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal mengunduh file');
    }
  };

  const confirmDeleteFolderAction = async () => {
    if (!confirmDeleteFolder) return;
    setDeleting(true);
    try {
      const deletedId = confirmDeleteFolder.id;
      await onDeleteFolder(deletedId);
      if (currentFolderId === deletedId) {
        setCurrentFolderId(confirmDeleteFolder.parentId || null);
      }
      toast.success('Folder beserta seluruh isinya berhasil dihapus');
      setConfirmDeleteFolder(null);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menghapus folder');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeleteFileAction = async () => {
    if (!confirmDeleteFile) return;
    setDeleting(true);
    try {
      await onDeleteFile(confirmDeleteFile);
      toast.success('Dokumen berhasil dihapus');
      setConfirmDeleteFile(null);
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Gagal menghapus file');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Folder Arsip Digital
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola dokumen pribadi Anda dengan private bucket dan akses Signed URL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setFolderModal({ open: true, mode: 'create', name: '' })}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderPlus className="h-4 w-4" />
            Folder Baru
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ALLOWED_ARCHIVE_EXTENSIONS.map((e) => `.${e}`).join(',')}
            onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
            className="hidden"
          />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#172554] hover:bg-blue-900 dark:bg-[#2563EB] dark:hover:bg-blue-700 px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {uploading ? 'Mengunggah...' : 'Upload File'}
          </button>
        </div>
      </div>

      {/* Breadcrumb & Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-sm">
            <button
              type="button"
              onClick={() => setCurrentFolderId(null)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium transition-colors cursor-pointer ${
                currentFolderId === null
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              Vault Utama
            </button>
            {breadcrumbs.map((folder, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <React.Fragment key={folder.id}>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                  <button
                    type="button"
                    onClick={() => setCurrentFolderId(folder.id)}
                    className={`rounded-lg px-2 py-1 font-medium transition-colors cursor-pointer truncate max-w-[180px] ${
                      isLast
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {folder.name}
                  </button>
                </React.Fragment>
              );
            })}
          </nav>

          {/* Controls: Search, Sort, View Switch */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Cari dokumen/folder..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (sortField === 'name') {
                  setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                } else {
                  setSortField('name');
                  setSortDir('asc');
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                sortField === 'name'
                  ? 'border-[#2563EB] text-[#2563EB] dark:text-[#38BDF8] bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Nama {sortField === 'name' ? (sortDir === 'asc' ? '(A-Z)' : '(Z-A)') : ''}
            </button>

            <button
              type="button"
              onClick={() => {
                if (sortField === 'date') {
                  setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
                } else {
                  setSortField('date');
                  setSortDir('desc');
                }
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                sortField === 'date'
                  ? 'border-[#2563EB] text-[#2563EB] dark:text-[#38BDF8] bg-blue-50/50 dark:bg-blue-950/30'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              Tanggal {sortField === 'date' ? (sortDir === 'desc' ? '(Terbaru)' : '(Terlama)') : ''}
            </button>

            <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
              <button
                type="button"
                aria-label="Tampilan Grid"
                onClick={() => setViewMode('grid')}
                className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Tampilan List"
                onClick={() => setViewMode('list')}
                className={`rounded-lg p-1.5 transition-colors cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Drag & Drop Upload Strip */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files?.length) {
              void handleUploadFiles(e.dataTransfer.files);
            }
          }}
          className={`rounded-xl border border-dashed px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-2 transition-colors ${
            dragOver
              ? 'border-[#2563EB] bg-blue-50/70 dark:bg-blue-950/30 text-[#2563EB]'
              : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>
            Seret & lepas satu atau beberapa file di sini (maks. <strong className="tabular-nums">{maxUploadMb} MB</strong>/file · PDF, Office, Gambar, TXT, ZIP)
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="font-medium text-[#2563EB] dark:text-[#38BDF8] hover:underline cursor-pointer"
          >
            Pilih dari perangkat
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
            />
          ))}
        </div>
      ) : visibleFolders.length === 0 && visibleFiles.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center">
          <Folder className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <h3 className="mt-4 font-display text-base font-semibold text-slate-900 dark:text-white">
            {searchQuery ? 'Tidak ada dokumen atau folder yang cocok' : 'Folder ini masih kosong'}
          </h3>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            {searchQuery
              ? 'Coba kata kunci pencarian lain atau reset pencarian.'
              : 'Buat folder baru untuk mengorganisir arsip atau unggah dokumen langsung ke lokasi ini.'}
          </p>
          {!searchQuery && (
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setFolderModal({ open: true, mode: 'create', name: '' })}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Buat Folder
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl bg-[#172554] dark:bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 cursor-pointer"
              >
                Upload Dokumen
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="space-y-6">
          {/* Folders Grid */}
          {visibleFolders.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Folder ({visibleFolders.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleFolders.map((folder) => {
                  const childFileCount = files.filter((f) => f.folderId === folder.id).length;
                  const childFolderCount = folders.filter((f) => f.parentId === folder.id).length;
                  return (
                    <div
                      key={folder.id}
                      className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-[#2563EB]/50 transition-colors flex flex-col justify-between"
                    >
                      <button
                        type="button"
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="flex items-start gap-3 text-left w-full cursor-pointer"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-[#2563EB] dark:text-[#38BDF8]">
                          <Folder className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {folder.name}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {childFolderCount} subfolder · {childFileCount} file
                          </p>
                        </div>
                      </button>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setFolderModal({
                              open: true,
                              mode: 'rename',
                              folder,
                              name: folder.name,
                            })
                          }
                          title="Ubah nama folder"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteFolder(folder)}
                          title="Hapus folder"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Files Grid */}
          {visibleFiles.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Dokumen ({visibleFiles.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visibleFiles.map((file) => {
                  const previewType = isPreviewable(file.mimeType, file.fileName);
                  return (
                    <div
                      key={file.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                          {getFileIcon(file.mimeType, file.fileName)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            title={file.fileName}
                            className="text-sm font-semibold text-slate-900 dark:text-white truncate"
                          >
                            {file.fileName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {formatBytes(file.fileSize)} · {formatTimestampID(file.createdAt)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          {previewType && (
                            <button
                              type="button"
                              onClick={() => handlePreviewFile(file)}
                              title="Preview dokumen"
                              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#2563EB] dark:text-[#38BDF8] hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(file)}
                            title="Unduh file"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setRenameFileModal({ open: true, file, fileName: file.fileName })
                            }
                            title="Rename file"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFile(file)}
                            title="Hapus file"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* List Table View */
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3 text-right">Ukuran</th>
                  <th className="px-4 py-3">Tanggal Upload</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visibleFolders.map((folder) => (
                  <tr
                    key={folder.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setCurrentFolderId(folder.id)}
                        className="flex items-center gap-2.5 font-medium text-slate-900 dark:text-white hover:text-[#2563EB] cursor-pointer"
                      >
                        <Folder className="h-4.5 w-4.5 text-[#2563EB] dark:text-[#38BDF8]" />
                        <span>{folder.name}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">Folder</td>
                    <td className="px-4 py-3 text-right text-xs text-slate-400">-</td>
                    <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                      {formatTimestampID(folder.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setFolderModal({
                              open: true,
                              mode: 'rename',
                              folder,
                              name: folder.name,
                            })
                          }
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteFolder(folder)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {visibleFiles.map((file) => {
                  const previewType = isPreviewable(file.mimeType, file.fileName);
                  return (
                    <tr
                      key={file.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 font-medium text-slate-900 dark:text-white">
                          {getFileIcon(file.mimeType, file.fileName)}
                          <span className="truncate max-w-xs">{file.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {file.originalName.split('.').pop()?.toUpperCase() || 'FILE'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-slate-600 dark:text-slate-300 font-mono tabular-nums">
                        {formatBytes(file.fileSize)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                        {formatTimestampID(file.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {previewType && (
                            <button
                              type="button"
                              onClick={() => handlePreviewFile(file)}
                              title="Preview"
                              className="rounded-lg p-1.5 text-[#2563EB] dark:text-[#38BDF8] hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadFile(file)}
                            title="Download"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRenameFileModal({ open: true, file, fileName: file.fileName })
                            }
                            title="Rename"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFile(file)}
                            title="Hapus"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Folder Create / Rename Modal */}
      {folderModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleFolderSubmit}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {folderModal.mode === 'create' ? 'Buat Folder Baru' : 'Ubah Nama Folder'}
              </h3>
              <button
                type="button"
                onClick={() => setFolderModal({ open: false, mode: 'create', name: '' })}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Nama Folder
              </label>
              <input
                type="text"
                autoFocus
                required
                maxLength={120}
                value={folderModal.name}
                onChange={(e) => setFolderModal((s) => ({ ...s, name: e.target.value }))}
                placeholder="Contoh: Kontrak Klien 2026"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setFolderModal({ open: false, mode: 'create', name: '' })}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingFolder}
                className="inline-flex items-center gap-2 rounded-xl bg-[#172554] dark:bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 cursor-pointer disabled:opacity-60"
              >
                {savingFolder && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Rename File Modal */}
      {renameFileModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleFileRenameSubmit}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                Ubah Nama Dokumen
              </h3>
              <button
                type="button"
                onClick={() => setRenameFileModal({ open: false, fileName: '' })}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
                Nama Dokumen
              </label>
              <input
                type="text"
                autoFocus
                required
                maxLength={200}
                value={renameFileModal.fileName}
                onChange={(e) => setRenameFileModal((s) => ({ ...s, fileName: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRenameFileModal({ open: false, fileName: '' })}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingFileName}
                className="inline-flex items-center gap-2 rounded-xl bg-[#172554] dark:bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-900 cursor-pointer disabled:opacity-60"
              >
                {savingFileName && <Loader2 className="h-4 w-4 animate-spin" />}
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Signed URL Preview Modal (PDF & Images) */}
      {previewState.open && previewState.file && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl h-[85vh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {previewState.file.fileName}
                </h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Akses melalui Signed URL privat sementara</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => previewState.file && handleDownloadFile(previewState.file)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  Unduh
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setPreviewState({ open: false, kind: null, signedUrl: '', loading: false })
                  }
                  aria-label="Tutup preview"
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-auto p-4">
              {previewState.loading ? (
                <div className="flex flex-col items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
                  <span>Membuat Signed URL aman...</span>
                </div>
              ) : previewState.kind === 'pdf' ? (
                <iframe
                  src={previewState.signedUrl}
                  title={previewState.file.fileName}
                  className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white"
                />
              ) : (
                <img
                  src={previewState.signedUrl}
                  alt={previewState.file.fileName}
                  className="max-h-full max-w-full object-contain rounded-xl shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Confirmation */}
      <ConfirmModal
        open={Boolean(confirmDeleteFolder)}
        destructive
        loading={deleting}
        title="Hapus Folder & Seluruh Isinya?"
        description={
          confirmDeleteFolder
            ? `Folder "${confirmDeleteFolder.name}" memiliki ${folderDeleteStats.subfolders} subfolder dan ${folderDeleteStats.files} dokumen. Seluruh isi folder akan dihapus secara permanen dari database dan private storage.`
            : ''
        }
        confirmLabel="Hapus Permanen"
        onConfirm={confirmDeleteFolderAction}
        onCancel={() => setConfirmDeleteFolder(null)}
      />

      {/* Delete File Confirmation */}
      <ConfirmModal
        open={Boolean(confirmDeleteFile)}
        destructive
        loading={deleting}
        title="Hapus Dokumen?"
        description={
          confirmDeleteFile
            ? `Dokumen "${confirmDeleteFile.fileName}" akan dihapus secara permanen dari arsip dan private vault storage.`
            : ''
        }
        confirmLabel="Hapus Dokumen"
        onConfirm={confirmDeleteFileAction}
        onCancel={() => setConfirmDeleteFile(null)}
      />
    </div>
  );
}
