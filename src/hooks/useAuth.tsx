import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { toast } from 'sonner';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { getVaultSignedUrl } from '../lib/vaultStorage';
import { UserProfile } from '../types';
import {
  DEFAULT_PAYMENT_METHODS,
  DEFAULT_SERVICE_CATEGORIES,
} from '../lib/utils';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  resolvedAvatarUrl: string;
  authLoading: boolean;
  signingIn: boolean;
  authError: string | null;
  pinVerified: boolean;
  vaultLocked: boolean;
  clearAuthError: () => void;
  signInWithGoogle: () => Promise<void>;
  verifyVaultPin: (pin: string) => Promise<{ ok: boolean; error?: string }>;
  lockVault: () => void;
  logout: () => Promise<void>;
  updateProfileSettings: (updates: Partial<Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const DEFAULT_AVATAR_PATH = '/src/assets/images/avatar_default_owner_1795095756137.jpg';
const VAULT_AVATAR_PREFIX = 'vault://digivault-files/';
const LOCK_STORAGE_KEY = 'digivault_vault_locked';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string>(DEFAULT_AVATAR_PATH);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [pinVerified, setPinVerified] = useState(false);
  const [vaultLocked, setVaultLocked] = useState(
    () => localStorage.getItem(LOCK_STORAGE_KEY) === 'true'
  );

  const clearAuthError = () => setAuthError(null);

  // Sync theme to document root
  useEffect(() => {
    const theme = profile?.theme || (localStorage.getItem('digivault_theme') as 'light' | 'dark') || 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('digivault_theme', theme);
  }, [profile?.theme]);

  // Resolve persistent vault:// avatar reference into a usable signed/blob URL across devices
  useEffect(() => {
    let active = true;
    const rawAvatar = profile?.avatarUrl || user?.photoURL || DEFAULT_AVATAR_PATH;

    if (!rawAvatar.startsWith(VAULT_AVATAR_PREFIX)) {
      setResolvedAvatarUrl(rawAvatar);
      return;
    }

    if (!user) {
      setResolvedAvatarUrl(DEFAULT_AVATAR_PATH);
      return;
    }

    const storagePath = rawAvatar.slice(VAULT_AVATAR_PREFIX.length);
    getVaultSignedUrl('digivault-files', storagePath, 'inline', 'avatar')
      .then(({ signedUrl }) => {
        if (active) setResolvedAvatarUrl(signedUrl);
      })
      .catch(() => {
        if (active) setResolvedAvatarUrl(user.photoURL || DEFAULT_AVATAR_PATH);
      });

    return () => {
      active = false;
    };
  }, [profile?.avatarUrl, user]);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setResolvedAvatarUrl(DEFAULT_AVATAR_PATH);
        setAuthLoading(false);
        return;
      }

      setUser(firebaseUser);
      const profilePath = `profiles/${firebaseUser.uid}`;
      const profileRef = doc(db, 'profiles', firebaseUser.uid);

      try {
        // Always check the server first so an offline or cold cache never overwrites existing cloud settings
        const serverSnap = await getDocFromServer(profileRef);
        if (!serverSnap.exists()) {
          const initialTheme =
            localStorage.getItem('digivault_theme') === 'dark' ? 'dark' : 'light';
          const initialProfile = {
            uid: firebaseUser.uid,
            fullName: firebaseUser.displayName || 'Pemilik DigiVault',
            email: firebaseUser.email || '',
            avatarUrl: firebaseUser.photoURL || DEFAULT_AVATAR_PATH,
            appTitle: 'DigiVault',
            appTagline: 'Your Documents. Your Income. One Vault.',
            theme: initialTheme,
            maxUploadMb: 20,
            serviceCategories: DEFAULT_SERVICE_CATEGORIES,
            paymentMethods: DEFAULT_PAYMENT_METHODS,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(profileRef, initialProfile);
        }
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        const msg = err instanceof Error ? err.message : '';
        const isOfflineError =
          code === 'unavailable' ||
          msg.toLowerCase().includes('offline') ||
          msg.toLowerCase().includes('network');
        if (!isOfflineError) {
          console.error('Profile bootstrap error:', profilePath, err);
          setAuthError('Gagal memuat profil Firestore. Pastikan domain & aturan Firestore aktif.');
        }
      }

      unsubProfile = onSnapshot(
        profileRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
          setAuthLoading(false);
        },
        (err) => {
          setAuthLoading(false);
          handleFirestoreError(err, OperationType.GET, profilePath);
        }
      );
    });

    return () => {
      unsubAuth();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  const signInWithGoogle = async () => {
    setSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleAuthProvider);
      localStorage.removeItem(LOCK_STORAGE_KEY);
      setVaultLocked(false);
      setPinVerified(true);
      toast.success('Berhasil masuk ke DigiVault');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        toast.info('Proses login dibatalkan.');
      } else if (code === 'auth/popup-blocked') {
        const msg = 'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.';
        setAuthError(msg);
        toast.error(msg);
      } else if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : '';
        const msg = `Domain "${host}" belum terdaftar di Authorized Domains Firebase Auth. Tambahkan domain ini di Firebase Console → Authentication → Settings → Authorized domains.`;
        setAuthError(msg);
        toast.error(msg);
      } else if (code === 'auth/network-request-failed') {
        const msg = 'Koneksi ke layanan autentikasi gagal. Periksa jaringan internet Anda.';
        setAuthError(msg);
        toast.error(msg);
      } else {
        const msg = `Gagal autentikasi Google${code ? ` (${code})` : ''}.`;
        setAuthError(msg);
        toast.error(msg);
      }
    } finally {
      setSigningIn(false);
    }
  };

  const verifyVaultPin = async (pin: string): Promise<{ ok: boolean; error?: string }> => {
    setAuthError(null);
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.valid) {
        return {
          ok: false,
          error: data.error || `Verifikasi PIN gagal (HTTP ${res.status}).`,
        };
      }

      setPinVerified(true);
      if (user) {
        localStorage.removeItem(LOCK_STORAGE_KEY);
        setVaultLocked(false);
        toast.success('Vault berhasil dibuka dengan PIN');
      }
      return { ok: true };
    } catch {
      return {
        ok: false,
        error: 'Gagal terhubung ke server verifikasi PIN. Periksa koneksi Anda.',
      };
    }
  };

  const lockVault = () => {
    localStorage.setItem(LOCK_STORAGE_KEY, 'true');
    setVaultLocked(true);
    setPinVerified(false);
    toast.info('DigiVault dikunci. Masukkan PIN untuk membuka kembali.');
  };

  const logout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem(LOCK_STORAGE_KEY);
      setVaultLocked(false);
      setPinVerified(false);
      toast.success('Anda telah keluar dari DigiVault');
    } catch {
      toast.error('Gagal keluar dari sesi.');
    }
  };

  const updateProfileSettings = async (
    updates: Partial<Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>>
  ) => {
    if (!user || !profile) return;
    const profilePath = `profiles/${user.uid}`;
    const profileRef = doc(db, 'profiles', user.uid);
    try {
      await updateDoc(profileRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, profilePath);
    }
  };

  const toggleTheme = async () => {
    const nextTheme = profile?.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    localStorage.setItem('digivault_theme', nextTheme);
    if (user && profile) {
      await updateProfileSettings({ theme: nextTheme });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        resolvedAvatarUrl,
        authLoading,
        signingIn,
        authError,
        pinVerified,
        vaultLocked,
        clearAuthError,
        signInWithGoogle,
        verifyVaultPin,
        lockVault,
        logout,
        updateProfileSettings,
        toggleTheme,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus digunakan di dalam AuthProvider');
  }
  return ctx;
}
