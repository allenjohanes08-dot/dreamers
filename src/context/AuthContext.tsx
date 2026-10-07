// src/context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { fetchWithRetry } from '../lib/api.ts';

interface AuthContextType {
  user: User | null;
  dbUser: any | null;
  loading: boolean;
  login: () => Promise<{ redirected: boolean }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  language: 'en' | 'sw';
  updateLanguage: (lang: 'en' | 'sw') => Promise<void>;
  updateAvatar: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [language, setLanguage] = useState<'en' | 'sw'>('en');

  const updateLanguage = async (lang: 'en' | 'sw') => {
    setLanguage(lang);
    if (user) {
      const token = await user.getIdToken();
      fetchWithRetry('/api/auth/language', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ language: lang })
      });
    }
  };

  const updateAvatar = async (avatarUrl: string) => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetchWithRetry('/api/auth/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ avatarUrl })
    });
    if (res.ok) await refreshProfile();
  };

  const refreshProfile = async () => {
    if (!auth.currentUser) return;
    const token = await auth.currentUser.getIdToken();
    try {
      const res = await fetchWithRetry('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) {
          setDbUser(data);
          if (data.user?.language) setLanguage(data.user.language);
        } else {
          setDbUser(null);
        }
      } else {
        setDbUser(null);
      }
    } catch (error) {
      console.error('Failed to refresh profile:', error);
    }
  };

  useEffect(() => {
    const handleNotification = () => {
      refreshProfile();
    };
    window.addEventListener('dreamers-notification-received', handleNotification);
    return () => window.removeEventListener('dreamers-notification-received', handleNotification);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__appLoader) {
      (window as any).__appLoader.setProgress(70, 'Connecting secure authentication...');
    }

    // Check for redirect result on mount
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        if (typeof window !== 'undefined' && (window as any).__appLoader) {
          (window as any).__appLoader.setProgress(85, 'Finalizing Google sign-in...');
        }
        await refreshProfile();
      }
    }).catch((error) => {
      console.error('AuthContext: Redirect result failed:', error);
    });

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        if (typeof window !== 'undefined' && (window as any).__appLoader) {
          (window as any).__appLoader.setProgress(85, 'Loading user profile & sessions...');
        }
        await refreshProfile();
      } else {
        setDbUser(null);
      }
      if (typeof window !== 'undefined' && (window as any).__appLoader) {
        (window as any).__appLoader.setProgress(95, 'Preparing marketplace catalog...');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (): Promise<{ redirected: boolean }> => {
    try {
      // First try popup
      await signInWithPopup(auth, googleAuthProvider);
      return { redirected: false };
    } catch (error: any) {
      console.error('AuthContext: Login attempt failed:', error?.code, error?.message);
      
      const errorCode = error?.code;
      if (errorCode === 'auth/unauthorized-domain') {
        throw new Error('This domain is not authorized in Firebase Console. Please ensure the app origin is added to Firebase Auth authorized domains.');
      }
      
      if (errorCode === 'auth/popup-blocked' || errorCode === 'auth/popup-closed-by-user') {
        try {
          await signInWithRedirect(auth, googleAuthProvider);
          return { redirected: true };
        } catch (redirectError: any) {
          console.error('AuthContext: Fallback redirect failed:', redirectError);
          throw redirectError;
        }
      }

      // If network request failed or running in an iframe, try redirect fallback
      const isNetworkError = errorCode === 'auth/network-request-failed';
      const isIframe = typeof window !== 'undefined' && window.top !== window;

      if (isNetworkError || isIframe) {
        console.warn('Attempting fallback to signInWithRedirect due to environment constraints.');
        try {
          await signInWithRedirect(auth, googleAuthProvider);
          return { redirected: true };
        } catch (redirectError) {
          console.error('AuthContext: Fallback redirect failed:', redirectError);
          throw error;
        }
      } else {
        throw error;
      }
    }
  };
  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, dbUser, loading, login, logout, refreshProfile, language, updateLanguage, updateAvatar }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    console.warn('useAuth used outside of AuthProvider, returning default fallback.');
    return {
      user: null,
      dbUser: null,
      loading: false,
      login: async () => ({ redirected: false }),
      logout: async () => {},
      refreshProfile: async () => {},
      language: 'en' as const,
      updateLanguage: async () => {},
      updateAvatar: async () => {},
    };
  }
  return context;
};
