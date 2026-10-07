// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { NotificationProvider, useNotifications } from './context/NotificationContext.tsx';
import { ShoppingAIProvider } from './context/ShoppingAIContext.tsx';
import { useEffect, useState, lazy, Suspense } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';

// Lazy load page components for code splitting
const LandingPage = lazy(() => import('./pages/LandingPage.tsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.tsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.tsx'));
const Marketplace = lazy(() => import('./pages/Marketplace.tsx'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard.tsx'));
const SellerDashboard = lazy(() => import('./pages/SellerDashboard.tsx'));
const AdminConsole = lazy(() => import('./pages/AdminConsole.tsx'));
const LogisticsDashboard = lazy(() => import('./pages/LogisticsDashboard.tsx'));
const ClaimInvitation = lazy(() => import('./pages/ClaimInvitation.tsx'));

import Navbar from './components/Navbar.tsx';
import GlobalBackgroundSlideshow from './components/GlobalBackgroundSlideshow.tsx';
const NotificationModal = lazy(() => import('./components/NotificationModal.tsx'));
const CartDrawer = lazy(() => import('./components/CartDrawer.tsx'));
const ShoppingAIModal = lazy(() => import('./components/ShoppingAIModal.tsx'));
import { SystemHealthErrorBoundary } from './components/SystemHealthGuard.tsx';
import { CartProvider } from './context/CartContext.tsx';

// Loading Skeleton Component
function PageSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-pulse bg-slate-950/20 backdrop-blur-sm rounded-3xl m-4">
      <div className="w-16 h-16 bg-slate-800 rounded-2xl" />
      <div className="h-4 bg-slate-800 rounded w-48" />
      <div className="h-4 bg-slate-800 rounded w-32" />
    </div>
  );
}

function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: string }) {
  const { user, dbUser, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-950 text-blue-400 font-black animate-pulse uppercase tracking-widest">Dreamers Loading...</div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} />;
  
  if (role && dbUser?.user?.role !== role) {
     return <Navigate to="/" />;
  }

  return <>{children}</>;
}

function RoleRedirect() {
  const { user, dbUser, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || !user) return;

    const isRootOrAuth = ['/', '/login', '/register'].includes(location.pathname);
    const role = dbUser?.user?.role;

    if (isRootOrAuth) {
      if (role) {
        // Logged in with profile: Go to dashboard
        switch (role) {
          case 'ADMIN': navigate('/admin', { replace: true }); break;
          case 'SELLER': navigate('/seller', { replace: true }); break;
          case 'LOGISTICS': navigate('/logistics', { replace: true }); break;
          case 'CUSTOMER': navigate('/customer', { replace: true }); break;
        }
      } else if (location.pathname !== '/register') {
        // Logged in but NO profile: Force register (where Admin bypass lives)
        navigate('/register', { replace: true });
      }
    }
  }, [user, dbUser, loading, navigate, location.pathname]);

  return null;
}

import { motion, AnimatePresence } from 'motion/react';

function AppContent() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const { showRegistry, setShowRegistry } = useNotifications();
  const [isQuotaExceeded, setQuotaExceededState] = useState(false);
  const [loadMaps, setLoadMaps] = useState(false);

  useEffect(() => {
    if (location.pathname === '/wedding') {
      setShowRegistry(true);
    }
  }, [location.pathname, setShowRegistry]);

  useEffect(() => {
    const handler = () => setQuotaExceededState(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  // Smart Deferral of Google Maps Script to boost First-Contentful-Paint
  useEffect(() => {
    const isMapRoute = location.pathname.includes('/customer') || 
                       location.pathname.includes('/logistics') || 
                       location.pathname.includes('/seller');
    if (isMapRoute) {
      setLoadMaps(true);
    } else {
      const timer = setTimeout(() => {
        setLoadMaps(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // Dismiss full screen loader once initial app and auth state are truly ready
  useEffect(() => {
    if (!loading) {
      if (typeof window !== 'undefined' && (window as any).__appLoader) {
        (window as any).__appLoader.hide();
      }
    }
  }, [loading]);
  
  const mainContent = (
    <div className="min-h-screen text-slate-100 flex flex-col relative bg-transparent overflow-x-hidden">
      <GlobalBackgroundSlideshow />
      {isQuotaExceeded && (
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-[100] shadow-sm font-bold uppercase tracking-tight"
        >
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-black text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            to update your account.
          </span>
        </motion.div>
      )}
      <Navbar />
      <Suspense fallback={null}>
        <NotificationModal />
        <CartDrawer />
        <ShoppingAIModal />
      </Suspense>
      <RoleRedirect />
      
      <AnimatePresence mode="wait">
        <motion.main 
          key={location.pathname}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          className="flex-grow relative"
        >
          <Suspense fallback={<PageSkeleton />}>
            <Routes location={location}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={user ? <Navigate to="/" /> : <LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/claim-invitation" element={<ClaimInvitation />} />
              <Route path="/wedding" element={<LandingPage />} />
              
              <Route path="/customer/*" element={<ProtectedRoute role="CUSTOMER"><CustomerDashboard /></ProtectedRoute>} />
              <Route path="/seller/*" element={<ProtectedRoute role="SELLER"><SellerDashboard /></ProtectedRoute>} />
              <Route path="/logistics/*" element={<ProtectedRoute role="LOGISTICS"><LogisticsDashboard /></ProtectedRoute>} />
              <Route path="/admin/*" element={<ProtectedRoute role="ADMIN"><AdminConsole /></ProtectedRoute>} />
              <Route path="*" element={<Navigate to="/marketplace" replace />} />
            </Routes>
          </Suspense>
        </motion.main>
      </AnimatePresence>
    </div>
  );

  if (loadMaps) {
    return (
      <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}>
        {mainContent}
      </APIProvider>
    );
  }

  return mainContent;
}

export default function App() {
  return (
    <SystemHealthErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <CartProvider>
            <ShoppingAIProvider>
              <BrowserRouter>
                <AppContent />
              </BrowserRouter>
            </ShoppingAIProvider>
          </CartProvider>
        </NotificationProvider>
      </AuthProvider>
    </SystemHealthErrorBoundary>
  );
}
