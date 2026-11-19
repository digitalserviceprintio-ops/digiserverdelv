import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
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
  unauthorizedDomain: string | null;
  emailProviderDisabled: boolean;
  needsEmailVerification: boolean;
  clearAuthError: () => void;
  signInWithEmail: (email: string, password: string) => Promise<boolean>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<boolean>;
  resetPassword: (email: string) => Promise<boolean>;
  resendVerificationEmail: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateProfileSettings: (updates: Partial<Omit<UserProfile, 'uid' | 'createdAt' | 'updatedAt'>>) => Promise<void>;
  toggleTheme: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const DEFAULT_AVATAR_PATH = '/src/assets/images/avatar_default_owner_1795095756137.jpg';
const VAULT_AVATAR_PREFIX = 'vault://digivault-files/';

function mapAuthErrorMessage(code: string): {
  message: string;
  unauthorizedHost?: string;
  providerDisabled?: boolean;
} {
  switch (code) {
    case 'auth/email-already-in-use':
      return {
        message: 'Email ini sudah terdaftar. Silakan masuk menggunakan tab Masuk atau reset password.',
      };
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return {
        message: 'Email atau password salah, atau akun belum terdaftar. Silakan daftar terlebih dahulu.',
      };
    case 'auth/invalid-email':
      return { message: 'Format alamat email tidak valid.' };
    case 'auth/weak-password':
      return { message: 'Password terlalu lemah. Gunakan minimal 6 karakter.' };
    case 'auth/too-many-requests':
      return {
        message: 'Terlalu banyak percobaan gagal. Silakan tunggu beberapa menit lalu coba lagi.',
      };
    case 'auth/operation-not-allowed':
      return {
        message:
          'Metode login Email/Password belum diaktifkan di Firebase Console proyek Anda.',
        providerDisabled: true,
      };
    case 'auth/popup-blocked':
      return {
        message: 'Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.',
      };
    case 'auth/unauthorized-domain': {
      const host = typeof window !== 'undefined' ? window.location.hostname : '';
      return {
        message: `Domain "${host}" belum terdaftar di Authorized Domains Firebase Authentication.`,
        unauthorizedHost: host || undefined,
      };
    }
    case 'auth/network-request-failed':
      return {
        message: 'Koneksi ke layanan autentikasi gagal. Periksa jaringan internet Anda.',
      };
    default:
      return {
        message: `Gagal melakukan autentikasi${code ? ` (${code})` : ''}.`,
      };
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resolvedAvatarUrl, setResolvedAvatarUrl] = useState<string>(DEFAULT_AVATAR_PATH);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [emailProviderDisabled, setEmailProviderDisabled] = useState(false);
  const [verificationTick, setVerificationTick] = useState(0);

  const clearAuthError = () => {
    setAuthError(null);
    setUnauthorizedDomain(null);
    setEmailProviderDisabled(false);
  };

  useEffect(() => {
    localStorage.removeItem('digivault_vault_locked');
  }, []);

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

    if (!user || !user.emailVerified) {
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

  // Track Firebase Auth state
  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setProfile(null);
        setResolvedAvatarUrl(DEFAULT_AVATAR_PATH);
        setAuthLoading(false);
        return;
      }

      setUser(firebaseUser);
      if (!firebaseUser.emailVerified) {
        setProfile(null);
        setAuthLoading(false);
      }
    });

    return () => {
      unsubAuth();
    };
  }, []);

  // Bootstrap and subscribe to Firestore profile only when user is authenticated AND email-verified
  useEffect(() => {
    if (!user || !user.emailVerified) {
      return;
    }

    let active = true;
    let unsubProfile: (() => void) | null = null;
    const profilePath = `profiles/${user.uid}`;
    const profileRef = doc(db, 'profiles', user.uid);

    const initProfile = async () => {
      try {
        await user.getIdToken(true);
        const serverSnap = await getDocFromServer(profileRef);
        if (!serverSnap.exists() && active) {
          const initialTheme =
            localStorage.getItem('digivault_theme') === 'dark' ? 'dark' : 'light';
          const initialProfile = {
            uid: user.uid,
            fullName: user.displayName || user.email?.split('@')[0] || 'Pemilik DigiVault',
            email: user.email || '',
            avatarUrl: user.photoURL || DEFAULT_AVATAR_PATH,
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
        if (!isOfflineError && active) {
          console.error('Profile bootstrap error:', profilePath, err);
          setAuthError('Gagal memuat profil Firestore. Pastikan domain & aturan Firestore aktif.');
        }
      }

      if (!active) return;

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
    };

    void initProfile();

    return () => {
      active = false;
      if (unsubProfile) unsubProfile();
    };
  }, [user, user?.emailVerified, verificationTick]);

  const handleAuthFailure = (err: unknown) => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      toast.info('Proses login dibatalkan.');
      return;
    }
    const mapped = mapAuthErrorMessage(code);
    setAuthError(mapped.message);
    setUnauthorizedDomain(mapped.unauthorizedHost || null);
    setEmailProviderDisabled(Boolean(mapped.providerDisabled));
    toast.error(mapped.message);
  };

  const signInWithEmail = async (email: string, password: string): Promise<boolean> => {
    setSigningIn(true);
    clearAuthError();
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!cred.user.emailVerified) {
        toast.info('Email Anda belum terverifikasi. Periksa kotak masuk email Anda.');
      } else {
        toast.success('Berhasil masuk ke DigiVault');
      }
      return true;
    } catch (err: unknown) {
      handleAuthFailure(err);
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const registerWithEmail = async (
    fullName: string,
    email: string,
    password: string
  ): Promise<boolean> => {
    setSigningIn(true);
    clearAuthError();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (fullName.trim()) {
        await updateProfile(cred.user, { displayName: fullName.trim() });
      }
      await sendEmailVerification(cred.user);
      toast.success('Pendaftaran berhasil! Link verifikasi telah dikirim ke email Anda.');
      return true;
    } catch (err: unknown) {
      handleAuthFailure(err);
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const resetPassword = async (email: string): Promise<boolean> => {
    setSigningIn(true);
    clearAuthError();
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success('Link reset password telah dikirim ke email Anda.');
      return true;
    } catch (err: unknown) {
      handleAuthFailure(err);
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const resendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    setSigningIn(true);
    clearAuthError();
    try {
      await sendEmailVerification(auth.currentUser);
      toast.success('Email verifikasi baru telah dikirim. Periksa kotak masuk atau folder Spam.');
    } catch (err: unknown) {
      handleAuthFailure(err);
    } finally {
      setSigningIn(false);
    }
  };

  const refreshVerificationStatus = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    setSigningIn(true);
    clearAuthError();
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      const reloaded = auth.currentUser;
      setUser(reloaded);
      if (reloaded.emailVerified) {
        setVerificationTick((t) => t + 1);
        toast.success('Email berhasil diverifikasi! Membuka DigiVault...');
        return true;
      }
      toast.info('Email belum terverifikasi. Silakan klik link verifikasi di kotak masuk Anda.');
      return false;
    } catch (err: unknown) {
      handleAuthFailure(err);
      return false;
    } finally {
      setSigningIn(false);
    }
  };

  const signInWithGoogle = async () => {
    setSigningIn(true);
    clearAuthError();
    try {
      await signInWithPopup(auth, googleAuthProvider);
      toast.success('Berhasil masuk ke DigiVault');
    } catch (err: unknown) {
      handleAuthFailure(err);
    } finally {
      setSigningIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      clearAuthError();
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

  const needsEmailVerification = Boolean(user && !user.emailVerified);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        resolvedAvatarUrl,
        authLoading,
        signingIn,
        authError,
        unauthorizedDomain,
        emailProviderDisabled,
        needsEmailVerification,
        clearAuthError,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        resendVerificationEmail,
        refreshVerificationStatus,
        signInWithGoogle,
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
