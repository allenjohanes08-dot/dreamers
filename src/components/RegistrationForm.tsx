// src/components/RegistrationForm.tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { translations } from '../lib/translations.ts';
import { useNotifications } from '../context/NotificationContext.tsx';
import { motion } from 'motion/react';
import { UserPlus, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { auth } from '../lib/firebase.ts';
import { fetchWithRetry } from '../lib/api.ts';
import { fadeInUp, buttonHover } from '../lib/animations';

interface RegistrationFormProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function RegistrationForm({ onComplete, onCancel }: RegistrationFormProps) {
  const { language, login, refreshProfile, dbUser } = useAuth();
  const { showToast } = useNotifications();
  const [role, setRole] = useState<'CUSTOMER' | 'SELLER' | 'LOGISTICS' | null>('CUSTOMER');
  
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
  const [isAdminBypassing, setIsAdminBypassing] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const isCheckoutAction = searchParams.get('action') === 'checkout';

  const adminEmail = 'allenjohanes08@gmail.com';

  const t = translations[language].registrationForm;

  // Admin Bypass Logic: If the user is the admin, auto-complete the form
  useEffect(() => {
    const handleAdminBypass = async () => {
      if (auth.currentUser?.email === adminEmail && !dbUser && !isAdminBypassing) {
        setIsAdminBypassing(true);
        setLoading(true);
        try {
          const token = await auth.currentUser.getIdToken();
          const res = await fetchWithRetry('/api/auth/register', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              fullName: auth.currentUser.displayName || 'Admin User',
              phone: '0000000000',
              role: 'CUSTOMER', // Server-side will promote to ADMIN anyway
              language,
              deliveryAddress: 'Admin HQ',
              paymentMethod: 'Admin Billing'
            })
          });

          if (res.ok) {
            await refreshProfile();
            showToast('Admin Access', 'Profile bypassed successfully.', 'success');
            navigate('/admin', { replace: true }); 
          }
        } catch (error) {
          console.error('Admin bypass failed:', error);
        } finally {
          setLoading(false);
          setIsAdminBypassing(false);
        }
      }
    };
    handleAdminBypass();
  }, [auth.currentUser, dbUser, isAdminBypassing, language, navigate, refreshProfile, showToast]);

  const handleGoogleAuth = async () => {
    setLoading(true);
    try {
      await login();
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
        const isAdmin = auth.currentUser?.email === adminEmail;
        if (isAdmin) {
          showToast('Admin Access', 'Akaunti ya Msimamizi imethibitishwa.', 'success');
          if (onComplete) onComplete();
          navigate('/admin');
          return;
        }

        if (role === 'SELLER' || role === 'LOGISTICS') {
          showToast(
            'Usajili Umekamilika / Registration Complete',
            language === 'sw'
              ? 'Akaunti yako imeundwa kama Mteja. Ombi lako la jukumu linasubiri uhakiki wa Msimamizi.'
              : 'Account created as Customer. Your requested role is pending Admin verification.',
            'info'
          );
        } else {
          showToast('Usajili Umekamilika / Account Created!', 'Akaunti yako ya DREAMERS ipo tayari.', 'success');
        }
        
        if (onComplete) {
          onComplete();
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

        navigate('/customer');
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
    <div className="space-y-6 max-w-2xl mx-auto">
      <motion.div variants={fadeInUp} className="flex items-center space-x-4 mb-2">
        <span className="text-slate-500 font-black uppercase text-[10px] tracking-widest">
          DREAMERS IDENTITY & PROFILE
        </span>
      </motion.div>

      <motion.h2 variants={fadeInUp} className="text-2xl font-black text-slate-900 mb-4 flex items-center uppercase tracking-tight">
        <UserPlus className="w-7 h-7 mr-3 text-blue-600 shrink-0" /> {t.complete}
      </motion.h2>

      <div className="space-y-6">
        {/* Auth Step */}
        {!auth.currentUser ? (
          <motion.div variants={fadeInUp} className="p-6 bg-amber-500/5 border border-amber-500/20 rounded-3xl space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase text-amber-600">Step 1: Identity Verification</h4>
                <p className="text-[10px] text-slate-500 font-medium">Link your Google account to secure your DREAMERS profile.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 py-3.5 bg-white text-slate-900 rounded-2xl font-black uppercase text-xs shadow-lg hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50 border border-slate-200"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              <span>{loading ? 'Connecting...' : 'Connect Google Account'}</span>
            </button>
          </motion.div>
        ) : (
          <motion.div variants={fadeInUp} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-[10px] font-black uppercase text-emerald-600">Step 1 Complete</h4>
                <p className="text-[11px] text-slate-900 font-bold truncate max-w-[200px]">{auth.currentUser.email}</p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600/60 mr-2">Linked</span>
          </motion.div>
        )}

        {/* Profile Step */}
        <div className={( !auth.currentUser || isAdminBypassing) ? 'opacity-40 pointer-events-none' : ''}>
          {isAdminBypassing && (
            <div className="mb-6 p-4 bg-blue-600 text-white rounded-2xl animate-pulse font-black uppercase text-[10px] tracking-widest flex items-center shadow-lg">
              <ShieldCheck className="w-5 h-5 mr-3" />
              {t.adminBypass}
            </div>
          )}
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-7 h-7 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-600">
              <span className="font-black text-xs">2</span>
            </div>
            <h4 className="text-xs font-black uppercase text-blue-600">Step 2: Profile Details</h4>
          </div>
          
          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-1 gap-5">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                  {t.role} <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['CUSTOMER', 'SELLER', 'LOGISTICS'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all border ${
                        role === r 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400'
                      }`}
                    >
                      {t[r.toLowerCase() as keyof typeof t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    {t.name} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm bg-slate-50"
                    placeholder="Juma Kassim"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                    {t.phone} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="block w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm bg-slate-50"
                    placeholder="0712 345 678"
                  />
                </div>
              </div>

              {role === 'CUSTOMER' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      {t.deliveryAddress} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm bg-slate-50"
                      placeholder="Mtaa wa Uhuru, Ilala, Dar es Salaam"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      {t.paymentMethod} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm bg-slate-50 cursor-pointer"
                    >
                      <option value="M-Pesa">Vodacom M-Pesa</option>
                      <option value="Tigo Pesa">Tigo Pesa</option>
                      <option value="Airtel Money">Airtel Money</option>
                      <option value="Cash on Delivery">Malipo Unapopokea (Cash on Delivery)</option>
                    </select>
                  </div>
                </div>
              )}

              {role === 'SELLER' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                        {t.business} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="block w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm bg-slate-50"
                        placeholder="Dreamers Electronics"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                        {t.category} <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={businessCategory}
                        onChange={(e) => setBusinessCategory(e.target.value)}
                        className="block w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm bg-slate-50 cursor-pointer"
                      >
                        <option value="Vifaa vya Elektroniki">Vifaa vya Elektroniki & Simu</option>
                        <option value="Mavazi & Mitindo">Mavazi, Vitenge & Mitindo</option>
                        <option value="Vyakula & Kilimo">Vyakula & Mazao ya Kilimo</option>
                        <option value="Vifaa vya Nyumbani">Vifaa vya Nyumbani & Samani</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      {t.shopAddress} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={shopAddress}
                      onChange={(e) => setShopAddress(e.target.value)}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm bg-slate-50"
                      placeholder="Kariakoo, Duka No. 42"
                    />
                  </div>
                </div>
              )}

              {role === 'LOGISTICS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      {t.vehicle} <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={vehicleType}
                      onChange={(e) => setVehicleType(e.target.value)}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm bg-slate-50 cursor-pointer"
                    >
                      <option value="MOTORCYCLE">Pikipiki (Boda Boda)</option>
                      <option value="THREE_WHEELER">Bajaji</option>
                      <option value="VAN">Gari Ndogo / Van</option>
                      <option value="TRUCK">Lori / Truck</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1.5">
                      {t.license} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={licensePlate}
                      onChange={(e) => setLicensePlate(e.target.value)}
                      className="block w-full px-4 py-3 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none font-bold text-sm bg-slate-50"
                      placeholder="T 123 ABC"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-blue-50 p-4 rounded-2xl flex items-start text-blue-700 font-bold text-[9px] leading-relaxed border border-blue-100">
              <ShieldCheck className="w-4 h-4 mr-2.5 mt-0.5 flex-shrink-0" />
              <p>{t.terms}</p>
            </div>

            <div className="flex gap-3 pt-2">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-4 border border-slate-200 text-slate-500 rounded-2xl font-black uppercase tracking-tight text-xs hover:bg-slate-50 transition-all"
                >
                  {t.back}
                </button>
              )}
              <motion.button
                whileHover={buttonHover.hover}
                whileTap={buttonHover.tap}
                type="submit"
                disabled={loading}
                className="flex-[2] bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black uppercase tracking-tight text-sm transition-all shadow-xl shadow-blue-500/20 flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Processing...' : t.confirm}
              </motion.button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

