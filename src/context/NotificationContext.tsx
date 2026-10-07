// src/context/NotificationContext.tsx
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, firestoreDb } from '../lib/firebase.ts';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  showRegistry: boolean;
  setShowRegistry: (open: boolean) => void;
  addNotification: (notification: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  showToast: (title: string, message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([
    {
      id: 'welcome-1',
      title: 'Karibu DREAMERS!',
      message: 'Soko kuu la kidijitali Tanzania - Escrow malipo salama na usafirishaji wa uhakika.',
      type: 'info',
      timestamp: new Date(),
      read: false,
    },
  ]);
  const [isOpen, setIsOpen] = useState(false);
  const [showRegistry, setShowRegistry] = useState(false);
  const [activeToast, setActiveToast] = useState<ToastMessage | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const showToast = (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setActiveToast({ id, title, message, type });
    
    // Also save to notifications drawer
    addNotification({ title, message, type });
  };

  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 4500);
    return () => clearTimeout(timer);
  }, [activeToast]);

  // Real-time Firestore notification listener for the active user
  const seenNotifIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    let unsubSnap: (() => void) | null = null;
    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      if (unsubSnap) {
        unsubSnap();
        unsubSnap = null;
      }

      if (!currentUser) return;

      const q = query(
        collection(firestoreDb, 'notifications'),
        where('userId', '==', currentUser.uid)
      );

      unsubSnap = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const docId = change.doc.id;
            const data = change.doc.data();

            if (!seenNotifIds.current.has(docId)) {
              seenNotifIds.current.add(docId);
              
              // Determine notification type
              const notifType: 'info' | 'success' | 'warning' | 'error' = 
                data.title?.toLowerCase().includes('approved') ? 'success'
                : data.title?.toLowerCase().includes('reject') ? 'error'
                : 'info';

              // Show real-time popup toast to user explaining Admin action
              setActiveToast({
                id: docId,
                title: data.title || 'Dreamers Admin Update',
                message: data.message || '',
                type: notifType,
              });

              // Add to notification history
              setNotifications((prev) => [
                {
                  id: docId,
                  title: data.title || 'Dreamers Update',
                  message: data.message || '',
                  type: notifType,
                  timestamp: data.createdAt ? new Date(data.createdAt) : new Date(),
                  read: data.read || false,
                },
                ...prev.filter((p) => p.id !== docId),
              ]);

              // Dispatch real-time notification event for auto profile refresh
              window.dispatchEvent(new CustomEvent('dreamers-notification-received'));
            }
          }
        });
      }, (err) => {
        console.warn('Real-time notifications listener (handled):', err.message);
      });
    });

    return () => {
      unsubAuth();
      if (unsubSnap) {
        unsubSnap();
      }
    };
  }, []);

  const addNotification = (item: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...item,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        isOpen,
        setIsOpen,
        showRegistry,
        setShowRegistry,
        addNotification,
        showToast,
        markAsRead,
        markAllAsRead,
        clearNotifications,
      }}
    >
      {children}

      {/* GLOBAL TOAST STATUS MESSAGE BANNER */}
      <AnimatePresence>
        {activeToast && (
          <div className="fixed top-20 right-4 sm:right-6 z-[200] max-w-sm w-full pointer-events-none px-2 sm:px-0">
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`pointer-events-auto p-4 rounded-2xl shadow-2xl backdrop-blur-md border flex items-start space-x-3 text-xs font-bold leading-relaxed ${
                activeToast.type === 'success'
                  ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-100 shadow-emerald-900/30'
                  : activeToast.type === 'error'
                  ? 'bg-red-950/95 border-red-500/50 text-red-100 shadow-red-900/30'
                  : activeToast.type === 'warning'
                  ? 'bg-amber-950/95 border-amber-500/50 text-amber-100 shadow-amber-900/30'
                  : 'bg-blue-950/95 border-blue-500/50 text-blue-100 shadow-blue-900/30'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {activeToast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                {activeToast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                {activeToast.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400" />}
                {activeToast.type === 'info' && <Info className="w-5 h-5 text-blue-400" />}
              </div>

              <div className="flex-grow min-w-0 pr-1">
                <h5 className="font-black uppercase tracking-tight text-white text-xs mb-0.5">
                  {activeToast.title}
                </h5>
                <p className="text-[11px] opacity-90">{activeToast.message}</p>
              </div>

              <button
                onClick={() => setActiveToast(null)}
                className="shrink-0 p-1 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    console.warn('useNotifications used outside of NotificationProvider, returning default fallback.');
    return {
      notifications: [],
      unreadCount: 0,
      isOpen: false,
      setIsOpen: () => {},
      showRegistry: false,
      setShowRegistry: () => {},
      addNotification: () => {},
      markAsRead: () => {},
      markAllAsRead: () => {},
      clearNotifications: () => {},
      showToast: () => {},
    };
  }
  return context;
}

