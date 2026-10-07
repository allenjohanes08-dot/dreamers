// src/pages/RegisterPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { translations } from '../lib/translations.ts';
import { useNotifications } from '../context/NotificationContext.tsx';
import { motion } from 'motion/react';
import { User, Store, Truck, ShieldCheck, ArrowRight, UserPlus, CheckCircle2 } from 'lucide-react';
import { auth } from '../lib/firebase.ts';
import { fetchWithRetry } from '../lib/api.ts';
import { staggerContainer, fadeInUp, buttonHover } from '../lib/animations';

export default function RegisterPage() {
  const { language, login, refreshProfile, dbUser } = useAuth();
  const { showToast } = useNotifications();
  const [step, setStep] = useState(2);
  const [role, setRole] = useState<'CUSTOMER' | 'SELLER' | 'LOGISTICS' | null>('CUSTOMER');

  const navigate = useNavigate();

  useEffect(() => {
    if (dbUser?.user?.role === 'ADMIN' || auth.currentUser?.email === 'allenjohanes08@gmail.com') {
      navigate('/admin', { replace: true });
    }
  }, [dbUser, navigate]);
  
  // Profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Customer specific
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    try {
      return localStorage.getItem('dreamers_delivery_address') || '';
    } catch (e) {
      return '';
    }
  });
  const [paymentMethod, setPaymentMethod] = useState('M-Pesa');
  
  // Seller specific
  const [businessName, setBusinessName] = useState('');
  const [businessCategory, setBusinessCategory] = useState('Vifaa vya Elektroniki');
  const [shopAddress, setShopAddress] = useState('');
  
  // Logistics specific
  const [vehicleType, setVehicleType] = useState('MOTORCYCLE');
  const [licensePlate, setLicensePlate] = useState('');

  const [loading, setLoading] = useState(false);
  const [authComplete, setAuthSuccess] = useState(false);
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isCheckoutAction = searchParams.get('action') === 'checkout';

  const t = translations[language].registerPage;

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      await login();
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        const res = await fetchWithRetry('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          if (data.user?.role === 'ADMIN') {
            showToast('Admin Access Granted', 'Redirecting to Admin Dashboard...', 'success');
            navigate('/admin', { replace: true });
            return;
          }
        }
      }
      setAuthSuccess(true);
      showToast('Akaunti Imeunganishwa / Account Linked', 'Sasa kamilisha wasifu wako ili kuanza.', 'success');
    } catch (error: any) {
      console.error('Registration auth failed:', error);
      if (error?.code === 'auth/popup-closed-by-user') {
        showToast('Imekatishwa / Cancelled', 'Dirisha la Google lilifungwa. Tafadhali jaribu tena.', 'info');
      } else {
        showToast('Hitilafu / Error', 'Imeshindikana kuunganisha na Google.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) {
      handleGoogleAuth();
      return;
    }
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetchWithRetry('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName,
          phone,
          role,
          language,
          deliveryAddress,
          paymentMethod,
          businessName: role === 'SELLER' ? businessName : undefined,
          businessCategory: role === 'SELLER' ? businessCategory : undefined,
          shopAddress: role === 'SELLER' ? shopAddress : undefined,
          vehicleType: role === 'LOGISTICS' ? vehicleType : undefined,
          licensePlate: role === 'LOGISTICS' ? licensePlate : undefined
        })
      });

      if (res.ok) {
        await refreshProfile();
        showToast('Usajili Umekamilika / Account Created!', 'Akaunti yako ya DREAMERS ipo tayari.', 'success');

        const searchParams = new URLSearchParams(location.search);
        const inviteToken = searchParams.get('invite_token');
        const redirect = searchParams.get('redirect');

        if (inviteToken) {
          navigate(`/claim-invitation?token=${inviteToken}`, { replace: true });
          return;
        }

        if (redirect) {
          navigate(redirect.startsWith('/') ? redirect : `/${redirect}`, { replace: true });
          return;
        }

        let hasPendingCheckout = false;
        try {
          hasPendingCheckout = localStorage.getItem('dreamers_pending_checkout') === 'true';
        } catch (e) {}

        if (hasPendingCheckout || isCheckoutAction) {
          navigate('/marketplace');
          return;
        }

        if (role === 'SELLER' || role === 'LOGISTICS') navigate('/customer');
        else navigate('/customer');
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast('Usajili Imeshindikana / Registration Error', errData.error || 'Failed to create account', 'error');
      }
    } catch (error: any) {
      console.error('Registration failed:', error);
      showToast('Usajili Imeshindikana / Registration Error', error?.message || 'Failed to create account', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-surface-secondary px-4 py-12">
      <div className="max-w-3xl w-full">
        {isCheckoutAction && (
          <div className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center space-x-3 text-xs text-blue-900 font-bold max-w-lg mx-auto text-left shadow-sm">
            <ShieldCheck className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div>
              <p className="font-black uppercase tracking-tight">
                {language === 'sw' ? 'Kamilisha Usajili wa Oda Yako' : 'Register to Complete Your Order'}
              </p>
              <p className="text-[11px] text-blue-700 font-medium">
                {language === 'sw'
                  ? 'Chagua "Mimi ni Mteja" (Customer) ili oda yako ikamilishwe haraka na ifikishwe mlangoni kwako.'
                  : 'Select "I\'m a Customer" to finalize your order with 100% Escrow protection and fast delivery.'}
              </p>
            </div>
          </div>
        )}

        <motion.div 
          initial="initial"
          animate="animate"
          variants={staggerContainer(0.08)}
          className="bg-surface p-10 rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-border-dim"
        >
          <motion.div variants={fadeInUp} className="flex items-center space-x-4 mb-8">
            <span className="text-text-muted font-black uppercase text-[10px] tracking-widest">
              DREAMERS CUSTOMER ACCOUNT
            </span>
          </motion.div>

          <motion.h2 variants={fadeInUp} className="text-3xl font-black text-text-primary mb-8 flex items-center uppercase tracking-tight text-center md:text-left">
            <UserPlus className="w-8 h-8 mr-3 text-primary shrink-0" /> {t.complete}
          </motion.h2>

          <div className="space-y-8">
            {/* Auth Step */}
            {!auth.currentUser ? (
              <motion.div variants={fadeInUp} className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black uppercase text-amber-200">Step 1: Identity Verification</h4>
                    <p className="text-[10px] text-slate-400 font-medium">Link your Google account to secure your DREAMERS profile.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-3 py-4 bg-white text-slate-900 rounded-2xl font-black uppercase text-sm shadow-xl hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                  <span>{loading ? 'Connecting...' : 'Connect Google Account'}</span>
                </button>
              </motion.div>
            ) : (
              <motion.div variants={fadeInUp} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-emerald-400">Step 1 Complete</h4>
                    <p className="text-[11px] text-white font-bold truncate max-w-[150px] sm:max-w-none">{auth.currentUser.email}</p>
                  </div>
                </div>
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/60 mr-2">Linked</span>
              </motion.div>
            )}

            {/* Profile Step (Only active when auth'd) */}
            <div className={!auth.currentUser ? 'opacity-40 pointer-events-none' : ''}>
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-8 h-8 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                  <span className="font-black text-xs">2</span>
                </div>
                <h4 className="text-xs font-black uppercase text-blue-200">Step 2: Business & Profile Details</h4>
              </div>
              
              <form onSubmit={handleRegister} className="space-y-6">
              <motion.div variants={fadeInUp} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2">
                    {t.name} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="block w-full px-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white placeholder:text-blue-100 transition-all outline-none font-bold text-sm shadow-sm"
                    placeholder="Juma Kassim"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2">
                    {t.phone} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full px-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white placeholder:text-blue-100 transition-all outline-none font-bold text-sm shadow-sm"
                    placeholder="0712 345 678"
                  />
                </div>
              </motion.div>

              {/* Customer Extra Information */}
              {role === 'CUSTOMER' && (
                <motion.div variants={fadeInUp} className="space-y-6 pt-4 border-t border-border-dim">
                  <div>
                    <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2">
                      {t.deliveryAddress} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="block w-full px-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white placeholder:text-blue-100 transition-all outline-none font-bold text-sm shadow-sm"
                      placeholder="Mtaa wa Uhuru, Ilala, Dar es Salaam"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2">
                      {t.paymentMethod} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="block w-full px-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white transition-all outline-none font-bold text-sm shadow-sm cursor-pointer"
                    >
                      <option className="bg-slate-900 text-white" value="M-Pesa">Vodacom M-Pesa</option>
                      <option className="bg-slate-900 text-white" value="Tigo Pesa">Tigo Pesa</option>
                      <option className="bg-slate-900 text-white" value="Airtel Money">Airtel Money</option>
                      <option className="bg-slate-900 text-white" value="Cash on Delivery">Malipo Unapopokea (Cash on Delivery)</option>
                    </select>
                  </div>
                </motion.div>
              )}

              {/* Seller Extra Information */}
              {role === 'SELLER' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-4 border-t border-border-dim">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2">
                        {t.business} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="block w-full px-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white placeholder:text-blue-100 transition-all outline-none font-bold text-sm shadow-sm"
                        placeholder="Dreamers Electronics Store"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2">
                        {t.category} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={businessCategory}
                        onChange={(e) => setBusinessCategory(e.target.value)}
                        className="block w-full px-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white transition-all outline-none font-bold text-sm shadow-sm cursor-pointer"
                      >
                        <option className="bg-slate-900 text-white" value="Vifaa vya Elektroniki">Vifaa vya Elektroniki & Simu</option>
                        <option className="bg-slate-900 text-white" value="Mavazi & Mitindo">Mavazi, Vitenge & Mitindo</option>
                        <option className="bg-slate-900 text-white" value="Vyakula & Kilimo">Vyakula & Mazao ya Kilimo</option>
                        <option className="bg-slate-900 text-white" value="Vifaa vya Nyumbani">Vifaa vya Nyumbani & Samani</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2">
                      {t.shopAddress} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                      className="block w-full px-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white placeholder:text-blue-100 transition-all outline-none font-bold text-sm shadow-sm"
                      placeholder="Soko Kuu la Kariakoo, Duka No. 42"
                    />
                  </div>
                </motion.div>
              )}

              {/* Logistics Officer (Afisa Usafirishaji) Extra Information */}
              {role === 'LOGISTICS' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pt-4 border-t border-border-dim">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2">
                        {t.vehicle} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={vehicleType}
                        onChange={(e) => setVehicleType(e.target.value)}
                        className="block w-full px-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white transition-all outline-none font-bold text-sm shadow-sm cursor-pointer"
                      >
                        <option className="bg-slate-900 text-white" value="MOTORCYCLE">Pikipiki (Boda Boda)</option>
                        <option className="bg-slate-900 text-white" value="THREE_WHEELER">Bajaji</option>
                        <option className="bg-slate-900 text-white" value="VAN">Gari Ndogo / Van</option>
                        <option className="bg-slate-900 text-white" value="TRUCK">Lori / Truck</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-800 uppercase tracking-widest mb-2">
                        {t.license} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={licensePlate}
                        onChange={(e) => setLicensePlate(e.target.value)}
                        className="block w-full px-5 py-4 border border-blue-400 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white bg-blue-600 text-white placeholder:text-blue-100 transition-all outline-none font-bold text-sm shadow-sm"
                        placeholder="T 123 ABC au Leseni No."
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              <motion.div variants={fadeInUp} className="bg-primary-light p-5 rounded-2xl flex items-start text-primary font-bold text-xs leading-relaxed border border-primary/10">
                <ShieldCheck className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                <p>{t.terms}</p>
              </motion.div>

              <motion.button
                variants={fadeInUp}
                whileHover={buttonHover.hover}
                whileTap={buttonHover.tap}
                type="submit"
                disabled={loading}
                className={`w-full ${
                  role === 'SELLER' 
                    ? 'bg-light-green hover:bg-emerald-50 text-slate-900' 
                    : role === 'LOGISTICS' 
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-light-green' 
                    : 'bg-primary hover:bg-primary-hover text-light-green'
                } py-5 rounded-2xl font-black uppercase tracking-tight text-lg transition-all shadow-xl shadow-primary/20 flex items-center justify-center cursor-pointer`}
              >
                {loading ? 'Creating Account...' : t.confirm}
              </motion.button>
            </form>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
}
