import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ArchiveFile, ArchiveFolder, IncomeRecord, PaymentStatus } from '../types';
import { deleteFromVault } from '../lib/vaultStorage';

export function useVaultData(uid: string | undefined) {
  const [folders, setFolders] = useState<ArchiveFolder[]>([]);
  const [files, setFiles] = useState<ArchiveFile[]>([]);
  const [incomes, setIncomes] = useState<IncomeRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setFolders([]);
      setFiles([]);
      setIncomes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    let foldersLoaded = false;
    let filesLoaded = false;
    let incomesLoaded = false;

    const checkReady = () => {
      if (foldersLoaded && filesLoaded && incomesLoaded) {
        setLoading(false);
      }
    };

    const foldersQuery = query(collection(db, 'folders'), where('userId', '==', uid));
    const unsubFolders = onSnapshot(
      foldersQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ArchiveFolder, 'id'>),
        }));
        items.sort((a, b) => a.name.localeCompare(b.name, 'id'));
        setFolders(items);
        foldersLoaded = true;
        checkReady();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'folders');
      }
    );

    const filesQuery = query(collection(db, 'files'), where('userId', '==', uid));
    const unsubFiles = onSnapshot(
      filesQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ArchiveFile, 'id'>),
        }));
        items.sort((a, b) => {
          const tA = a.createdAt?.toMillis() ?? Date.now();
          const tB = b.createdAt?.toMillis() ?? Date.now();
          return tB - tA;
        });
        setFiles(items);
        filesLoaded = true;
        checkReady();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'files');
      }
    );

    const incomesQuery = query(collection(db, 'incomes'), where('userId', '==', uid));
    const unsubIncomes = onSnapshot(
      incomesQuery,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<IncomeRecord, 'id'>),
        }));
        items.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
        setIncomes(items);
        incomesLoaded = true;
        checkReady();
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'incomes');
      }
    );

    return () => {
      unsubFolders();
      unsubFiles();
      unsubIncomes();
    };
  }, [uid]);

  // --- Folder CRUD ---
  const createFolder = async (name: string, parentId: string | null) => {
    if (!uid) return;
    try {
      await addDoc(collection(db, 'folders'), {
        userId: uid,
        parentId: parentId || null,
        name: name.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'folders');
    }
  };

  const renameFolder = async (folderId: string, name: string) => {
    try {
      await updateDoc(doc(db, 'folders', folderId), {
        name: name.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `folders/${folderId}`);
    }
  };

  const deleteFolderRecursive = async (folderId: string) => {
    if (!uid) return;
    // Collect all descendant folder IDs
    const folderIdsToDelete = new Set<string>([folderId]);
    let added = true;
    while (added) {
      added = false;
      for (const f of folders) {
        if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
          folderIdsToDelete.add(f.id);
          added = true;
        }
      }
    }

    const filesToDelete = files.filter((f) => f.folderId && folderIdsToDelete.has(f.folderId));

    // Delete file metadata first in Firestore (atomic permission & ownership validation)
    try {
      const batch = writeBatch(db);
      for (const file of filesToDelete) {
        batch.delete(doc(db, 'files', file.id));
      }
      for (const id of folderIdsToDelete) {
        batch.delete(doc(db, 'folders', id));
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `folders/${folderId}`);
    }

    // Only delete physical storage files after Firestore metadata deletion succeeds
    await Promise.allSettled(
      filesToDelete.map((file) => deleteFromVault('digivault-files', file.storagePath))
    );
  };

  // --- File CRUD ---
  const createFileRecord = async (payload: {
    folderId: string | null;
    fileName: string;
    originalName: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
  }) => {
    if (!uid) return;
    try {
      await addDoc(collection(db, 'files'), {
        userId: uid,
        folderId: payload.folderId || null,
        fileName: payload.fileName.trim(),
        originalName: payload.originalName,
        storagePath: payload.storagePath,
        mimeType: payload.mimeType,
        fileSize: payload.fileSize,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'files');
    }
  };

  const renameFile = async (fileId: string, fileName: string) => {
    try {
      await updateDoc(doc(db, 'files', fileId), {
        fileName: fileName.trim(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `files/${fileId}`);
    }
  };

  const deleteFileRecord = async (file: ArchiveFile) => {
    try {
      await deleteDoc(doc(db, 'files', file.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `files/${file.id}`);
    }
    await deleteFromVault('digivault-files', file.storagePath);
  };

  // --- Income CRUD ---
  const createIncome = async (payload: {
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
  }) => {
    if (!uid) return;
    try {
      await addDoc(collection(db, 'incomes'), {
        userId: uid,
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'incomes');
    }
  };

  const updateIncome = async (
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
  ) => {
    try {
      await updateDoc(doc(db, 'incomes', incomeId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incomes/${incomeId}`);
    }
  };

  const toggleIncomeStatus = async (income: IncomeRecord) => {
    const nextStatus: PaymentStatus = income.paymentStatus === 'lunas' ? 'belum_lunas' : 'lunas';
    try {
      await updateDoc(doc(db, 'incomes', income.id), {
        paymentStatus: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incomes/${income.id}`);
    }
  };

  const deleteIncomeRecord = async (income: IncomeRecord) => {
    try {
      await deleteDoc(doc(db, 'incomes', income.id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `incomes/${income.id}`);
    }
    if (income.receiptPath) {
      await deleteFromVault('digivault-receipts', income.receiptPath);
    }
  };

  return {
    folders,
    files,
    incomes,
    loading,
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
  };
}
