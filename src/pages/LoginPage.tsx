// src/pages/LoginPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { translations } from '../lib/translations.ts';
import { useNotifications } from '../context/NotificationContext.tsx';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, LogIn, AlertCircle, ShieldCheck, Eye, EyeOff, X, CheckCircle2, ArrowRight } from 'lucide-react';
import { auth } from '../lib/firebase.ts';
import { fetchWithRetry } from '../lib/api.ts';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { staggerContainer, fadeInUp, buttonHover } from '../lib/animations';

export default function LoginPage() {
  const { language, login, refreshProfile } = useAuth();
  const { showToast } = useNotifications();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isCheckoutAction = searchParams.get('action') === 'checkout' || searchParams.get('redirect') === 'marketplace';
  const redirectParam = searchParams.get('redirect');
  const targetRedirect = redirectParam ? (redirectParam.startsWith('/') ? redirectParam : `/${redirectParam}`) : '/';

  const t = translations[language].loginPage;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (email.trim() && password.trim()) {
        try {
          await signInWithEmailAndPassword(auth, email.trim(), password);
        } catch (emailErr: any) {
          // Fallback to Google if account exists with Google
          if (emailErr?.code === 'auth/user-not-found' || emailErr?.code === 'auth/wrong-password') {
            throw emailErr;
          }
          const { redirected } = await login();
          if (redirected) return;
        }
      } else {
        const { redirected } = await login();
        if (redirected) return;
      }
      await refreshProfile();
      
      // Direct dashboard redirection logic
      const profile = await (await fetchWithRetry('/api/auth/me', {
        headers: { Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` }
      })).json().catch(() => null);
      
      if (!profile?.user || profile?.isNewUser) {
        showToast('Karibu DREAMERS / Welcome!', 'Tafadhali kamilisha usajili wa wasifu wako ili kuanza.', 'info');
        navigate(`/register${location.search}`, { replace: true });
        return;
      }

      const role = profile?.user?.role;
      const adminEmail = 'allenjohanes08@gmail.com';
      let dashboardPath = targetRedirect;
      
      if (targetRedirect === '/' || targetRedirect === '/login') {
        if (role === 'ADMIN' || auth.currentUser?.email === adminEmail) dashboardPath = '/admin';
        else if (role === 'SELLER') dashboardPath = '/seller';
        else if (role === 'LOGISTICS') dashboardPath = '/logistics';
        else dashboardPath = '/customer';
      }

      showToast('Karibu Tena / Welcome Back!', 'Umeingia kwenye akaunti yako kikamilifu.', 'success');
      navigate(dashboardPath, { replace: true });
    } catch (err: any) {
      console.error(err);
      const errMsg = err?.message || t.error;
      setError(errMsg);
      showToast('Imeshindikana Kuingia / Login Failed', errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const { redirected } = await login();
      if (redirected) return; // Wait for redirect to happen
      
      await refreshProfile();
      
      // Direct dashboard redirection logic
      const profile = await (await fetchWithRetry('/api/auth/me', {
        headers: { Authorization: `Bearer ${await auth.currentUser?.getIdToken()}` }
      })).json().catch(() => null);
      
      if (!profile?.user || profile?.isNewUser) {
        showToast('Karibu DREAMERS / Welcome!', 'Tafadhali kamilisha usajili wa wasifu wako ili kuanza.', 'info');
        navigate(`/register${location.search}`, { replace: true });
        return;
      }

      const role = profile?.user?.role;
      const adminEmail = 'allenjohanes08@gmail.com';
      let dashboardPath = targetRedirect;
      
      if (targetRedirect === '/' || targetRedirect === '/login') {
        if (role === 'ADMIN' || auth.currentUser?.email === adminEmail) dashboardPath = '/admin';
        else if (role === 'SELLER') dashboardPath = '/seller';
        else if (role === 'LOGISTICS') dashboardPath = '/logistics';
        else dashboardPath = '/customer';
      }

      showToast('Karibu Tena / Welcome Back!', 'Akaunti yako ya Google imeunganishwa.', 'success');
      navigate(dashboardPath, { replace: true });
    } catch (err: any) {
      console.error('Google Login Error:', err);
      if (err?.code === 'auth/popup-closed-by-user') {
        showToast('Imekatishwa / Sign-in Cancelled', 'Dirisha la kuingia lilifungwa kabla ya kukamilisha.', 'info');
      } else if (err?.code === 'auth/network-request-failed') {
        const netErrMsg = language === 'sw' 
          ? 'Shida ya mtandao. Tafadhali kagua intaneti yako na jaribu tena.' 
          : 'Network error. Please check your internet connection and try again.';
        setError(netErrMsg);
        showToast('Mtandao / Network Error', netErrMsg, 'error');
      } else {
        setError(t.error);
        showToast('Imeshindikana / Login Failed', t.error, 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetLoading(true);
    setResetError('');
    setResetSuccess(false);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSuccess(true);
      showToast('Kiungo Kimetumwa / Password Reset Sent', 'Fungua barua pepe yako ili kuweka nenosiri jipya.', 'success');
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset email');
      showToast('Imeshindikana / Reset Failed', err.message || 'Failed to send reset email', 'error');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-surface-secondary px-4 py-8">
        <motion.div 
          initial="initial"
          animate="animate"
          variants={staggerContainer(0.1)}
          className="max-w-md w-full bg-surface rounded-[2.5rem] shadow-2xl shadow-primary/5 p-8 sm:p-10 border border-border-dim"
        >
          {isCheckoutAction && (
            <motion.div variants={fadeInUp} className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center space-x-3 text-xs text-blue-200 font-bold">
              <ShieldCheck className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="font-black uppercase tracking-tight text-white">
                  {language === 'sw' ? 'Kamilisha Oda Yako' : 'Complete Your Order'}
                </p>
                <p className="text-[11px] text-blue-200 font-medium">
                  {language === 'sw'
                    ? 'Ingia au tengeneza akaunti ili kukamilisha malipo yako ya Escrow.'
                    : 'Sign in or register below to finalize your secure Escrow order.'}
                </p>
              </div>
            </motion.div>
          )}

          <motion.div variants={fadeInUp} className="text-center mb-8">
            <motion.div 
              whileHover={{ rotate: 10, scale: 1.1 }}
              className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20 ring-4 ring-primary-light"
            >
              <LogIn className="text-light-green w-8 h-8" />
            </motion.div>
            <h2 className="text-3xl font-black text-text-primary uppercase tracking-tight leading-tight">{t.title}</h2>
            <p className="text-text-secondary mt-2 font-medium">{t.subtitle}</p>
          </motion.div>

          {error && (
            <motion.div 
              variants={fadeInUp}
              className="mb-6 p-4 bg-red-950/80 border border-red-500/40 rounded-2xl flex items-center text-red-200 text-xs font-bold"
            >
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0 text-red-400" />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <motion.div variants={fadeInUp}>
              <label className="block text-xs font-black text-blue-100 uppercase tracking-widest mb-2">
                {t.email} <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-blue-200" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-14 pr-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white placeholder:text-blue-100 transition-all outline-none font-bold text-sm shadow-sm"
                  placeholder="habari@example.com"
                />
              </div>
            </motion.div>

            <motion.div variants={fadeInUp}>
              <div className="flex justify-between mb-2">
                <label className="block text-xs font-black text-blue-100 uppercase tracking-widest">
                  {t.password} <span className="text-red-400">*</span>
                </label>
                <button 
                  type="button" 
                  onClick={() => {
                    setResetEmail(email);
                    setResetSuccess(false);
                    setResetError('');
                    setShowForgotModal(true);
                  }}
                  className="text-[11px] font-black text-blue-300 uppercase tracking-widest hover:text-white transition-colors"
                >
                  {t.forgot}
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-blue-200" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-14 pr-12 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white placeholder:text-blue-100 transition-all outline-none font-bold text-sm shadow-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-blue-200 hover:text-white transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </motion.div>

            <motion.button
              variants={fadeInUp}
              whileHover={buttonHover.hover}
              whileTap={buttonHover.tap}
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-light-green py-5 rounded-2xl font-black uppercase tracking-tight text-lg hover:bg-primary-hover transition-all shadow-xl shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer"
            >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-light-green" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : t.signIn}
          </motion.button>
          </form>
          
          <motion.div variants={fadeInUp} className="mt-8">
            <div className="relative flex items-center">
              <div className="flex-grow border-t border-border-dim"></div>
              <span className="flex-shrink mx-4 text-text-muted text-[10px] font-black uppercase tracking-widest">{t.or}</span>
              <div className="flex-grow border-t border-border-dim"></div>
            </div>
            
            <motion.button 
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(30, 41, 59, 0.5)' }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={handleGoogleLogin}
              className="mt-6 w-full flex items-center justify-center px-5 py-4 border border-border-dim rounded-2xl text-text-secondary bg-surface hover:bg-surface-secondary transition-all font-black uppercase tracking-tight text-sm shadow-sm cursor-pointer"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-3" alt="Google" />
              {t.google}
            </motion.button>
          </motion.div>

          <motion.p variants={fadeInUp} className="mt-8 text-center text-text-muted font-bold text-sm">
            {t.new} <Link to={`/register${location.search}`} className="text-primary font-black hover:underline underline-offset-4">{t.create}</Link>
          </motion.p>
        </motion.div>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForgotModal(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface border border-border-dim p-6 sm:p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full relative z-10 max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black uppercase tracking-tight text-text-primary">
                  {t.forgotTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="p-2 text-text-muted hover:text-white rounded-xl bg-surface-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {resetSuccess ? (
                <div className="space-y-6 text-center py-4">
                  <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <p className="text-sm font-bold text-white leading-relaxed">
                    {t.resetSuccessMsg}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-full py-4 bg-primary text-light-green rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-hover"
                  >
                    {t.close}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendReset} className="space-y-6">
                  <p className="text-xs text-text-secondary leading-relaxed font-medium">
                    {t.forgotSub}
                  </p>

                  {resetError && (
                    <div className="p-3 bg-red-950/80 border border-red-500/40 rounded-xl text-xs text-red-200 font-bold flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2 text-red-400 shrink-0" />
                      <span>{resetError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-black text-blue-100 uppercase tracking-widest mb-2">
                      {t.email} <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 w-5 h-5 pointer-events-none" />
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="habari@example.com"
                        className="block w-full pl-12 pr-4 py-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white font-bold text-sm shadow-sm outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 py-4 bg-surface-secondary text-text-muted hover:text-white rounded-2xl font-black uppercase text-xs tracking-widest"
                    >
                      {t.close}
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading || !resetEmail.trim()}
                      className="flex-1 py-4 bg-primary text-light-green hover:bg-primary-hover rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center space-x-1 disabled:opacity-50"
                    >
                      <span>{resetLoading ? 'Sending...' : t.sendReset}</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

