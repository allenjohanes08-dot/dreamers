// src/pages/CustomerDashboard.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Package, MapPin, Heart, History, Settings, Bell, Clock, CheckCircle2, Truck, X, User, Phone, CreditCard, Save, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { translations } from '../lib/translations.ts';
import { useNotifications } from '../context/NotificationContext.tsx';
import { auth } from '../lib/firebase.ts';
import { fetchWithRetry } from '../lib/api.ts';
import { Map } from '@vis.gl/react-google-maps';
import RouteMap from '../components/RouteMap.tsx';
import { staggerContainer, fadeInUp, listItem, buttonHover, scaleIn } from '../lib/animations';

export default function CustomerDashboard() {
  const { dbUser, language, refreshProfile } = useAuth();
  const { unreadCount, setIsOpen, showToast } = useNotifications();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Profile / Address Edit Modal state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('M-Pesa');
  const [savingProfile, setSavingProfile] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const t = translations[language].customerDashboard;

  useEffect(() => {
    fetchOrders();
  }, []);

  const openEditModal = () => {
    setEditFullName(dbUser?.user?.fullName || '');
    setEditPhone(dbUser?.user?.phone || '');
    setEditAddress(dbUser?.profile?.deliveryAddress || '');
    setEditPaymentMethod(dbUser?.profile?.paymentMethod || 'M-Pesa');
    setSaveSuccess(false);
    setShowRoleModal(false);
    setShowMap(false);
    setShowProfileModal(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/customer/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          fullName: editFullName,
          phone: editPhone,
          deliveryAddress: editAddress,
          paymentMethod: editPaymentMethod
        })
      });
      if (res.ok) {
        await refreshProfile();
        setSaveSuccess(true);
        showToast('Taarifa Zimesasishwa / Profile Updated', 'Taarifa na anwani yako imehifadhiwa kikamilifu.', 'success');
        setTimeout(() => setShowProfileModal(false), 1200);
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast('Imeshindikana / Update Failed', errJson.error || 'Failed to update profile', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error', err?.message || 'Failed to update profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Role Request state
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [targetRole, setTargetRole] = useState<'SELLER' | 'LOGISTICS'>('SELLER');
  const [roleReason, setRoleReason] = useState('');
  const [submittingRole, setSubmittingRole] = useState(false);

  const targetTag = (r: string) => r === 'SELLER' ? 'Muuzaji (Seller)' : 'Afisa Usafirishaji (Logistic Officer)';

  const handleRoleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRole(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/user/request-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ requestedRole: targetRole, reason: roleReason })
      });
      if (res.ok) {
        showToast('Ombi Limetumwa / Role Requested', `Ombi lako la kuwa ${targetTag(targetRole)} limepokelewa. Linasubiri uhakiki wa Admin.`, 'success');
        setShowRoleModal(false);
        setRoleReason('');
        refreshProfile();
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast('Imeshindikana / Failed', errJson.error || 'Failed to submit role request', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to submit role request', 'error');
    } finally {
      setSubmittingRole(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/customer/orders', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setOrders(await res.json().catch(() => []));
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return <Clock className="w-5 h-5 text-amber-500" />;
      case 'READY_FOR_DELIVERY': return <Package className="w-5 h-5 text-blue-500" />;
      case 'OUT_FOR_DELIVERY': return <Truck className="w-5 h-5 text-purple-500" />;
      case 'DELIVERED': return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      default: return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const handleTrackOrder = (order: any) => {
    setSelectedOrder(order);
    setShowProfileModal(false);
    setShowRoleModal(false);
    setShowMap(true);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-text-primary mb-2 tracking-tighter uppercase">{t.title}</h1>
          <p className="text-text-secondary font-bold uppercase tracking-widest text-[10px]">{t.welcome}, {dbUser?.user?.fullName}</p>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsOpen(true)}
            className="p-3 bg-surface rounded-2xl shadow-soft border border-border-dim text-text-muted hover:text-primary transition-all relative cursor-pointer"
            title="Arifa na Matangazo"
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-red-500 text-light-green text-[10px] font-black flex items-center justify-center rounded-full ring-2 ring-surface shadow-xs animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          <button onClick={openEditModal} className="p-3 bg-surface rounded-2xl shadow-soft border border-border-dim text-text-muted hover:text-primary transition-all cursor-pointer" title="Settings / Profile">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Pending Role Verification Banner */}
      {dbUser?.user?.requestedRole && dbUser?.user?.requestedRole !== 'CUSTOMER' && dbUser?.user?.verificationStatus === 'PENDING' && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-gradient-to-r from-amber-500/10 via-amber-600/10 to-transparent border border-amber-500/30 rounded-3xl flex items-start space-x-4 shadow-sm"
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1 text-xs">
            <h4 className="font-black uppercase tracking-wider text-amber-600">
              {language === 'sw' ? 'Uhakiki wa Jukumu Unasubiri' : 'Role Verification Pending'} ({dbUser.user.requestedRole === 'LOGISTICS' ? 'Logistic Officer' : 'Seller'})
            </h4>
            <p className="text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              {language === 'sw'
                ? `Ombi lako la akaunti ya ${dbUser.user.requestedRole === 'LOGISTICS' ? 'Afisa Usafirishaji (Logistics)' : 'Muuzaji (Seller)'} linakaguliwa na Msimamizi. Wakati uhakiki unaendelea, unaweza kutumia mfumo huu kama Mteja.`
                : `Your requested role (${dbUser.user.requestedRole === 'LOGISTICS' ? 'Logistic Officer' : 'Seller'}) is currently pending review by the Administrator. You can continue shopping and managing orders as a Customer.`}
            </p>
          </div>
        </motion.div>
      )}

      <motion.div 
        initial="initial"
        animate="animate"
        variants={staggerContainer(0.1)}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Orders */}
          <motion.div variants={fadeInUp} className="bg-surface p-8 rounded-[2.5rem] shadow-xl shadow-primary/5 border border-border-dim">
            <h2 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center text-text-primary">
              <History className="w-6 h-6 mr-3 text-primary" /> {t.orders}
            </h2>
            
            {loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-surface-secondary animate-pulse rounded-3xl" />)}
              </div>
            ) : orders.length === 0 ? (
              <motion.div 
                variants={scaleIn}
                className="text-center py-20 bg-surface-secondary rounded-[2rem] border-2 border-dashed border-border-dim"
              >
                <Package className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
                <p className="text-text-muted font-bold uppercase text-xs tracking-widest">{t.empty}</p>
              </motion.div>
            ) : (
              <motion.div 
                variants={staggerContainer(0.08)}
                className="space-y-6"
              >
                {orders.map((o, idx) => (
                  <motion.div 
                    variants={listItem}
                    key={`cust-order-${o.order.id}-${idx}`} 
                    className="p-6 bg-surface-secondary rounded-3xl border border-border-dim flex items-center justify-between group hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center space-x-6">
                      <motion.div 
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center shadow-sm"
                      >
                        {getStatusIcon(o.order.status)}
                      </motion.div>
                      <div>
                        <p className="font-black text-text-primary leading-tight text-lg">Order #{o.order.id}</p>
                        <p className="text-xs font-bold text-text-muted uppercase mt-1">{new Date(o.order.createdAt).toLocaleDateString()}</p>
                        <p className="text-sm font-black text-primary mt-2">{Number(o.order.totalAmount).toLocaleString()} TZS</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-4 py-1.5 bg-surface rounded-full text-[10px] font-black uppercase tracking-widest text-text-secondary border border-border-dim mb-4">{o.order.status}</span>
                      {o.shop && (
                        <motion.button 
                          whileHover={{ scale: 1.05, color: '#3b82f6' }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleTrackOrder(o)}
                          className="block w-full text-primary font-black text-[10px] uppercase tracking-widest hover:underline cursor-pointer"
                        >
                          {t.tracking}
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>
        </div>

        <motion.div variants={staggerContainer(0.1)} className="space-y-8">
          <motion.div variants={fadeInUp} className="bg-light-green text-slate-900 p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-light-green-border">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary rounded-full -mr-16 -mt-16 opacity-10 blur-2xl" />
            <h3 className="text-2xl font-black uppercase tracking-tight mb-1 relative z-10">{dbUser?.user?.fullName}</h3>
            <p className="text-blue-600 font-bold text-xs uppercase tracking-[0.2em] mb-8 relative z-10 opacity-80">Customer Since 2026</p>
            
            <div className="grid grid-cols-2 gap-4 relative z-10">
              <div className="bg-black/5 p-4 rounded-2xl backdrop-blur-md border border-black/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Orders</p>
                <p className="text-xl font-black">{orders.length}</p>
              </div>
              <div className="bg-black/5 p-4 rounded-2xl backdrop-blur-md border border-black/5">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Spent</p>
                <p className="text-sm font-black truncate">{orders.reduce((s, o) => s + Number(o.order.totalAmount), 0).toLocaleString()} TZS</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeInUp} className="bg-surface p-8 rounded-[2.5rem] shadow-xl shadow-primary/5 border border-border-dim">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-6 flex items-center">
              <MapPin className="w-4 h-4 mr-2" /> Delivery Address
            </h3>
            <p className="text-text-primary font-bold text-sm mb-6 leading-relaxed">{dbUser?.profile?.deliveryAddress || 'No address set'}</p>
            <motion.button 
              whileHover={buttonHover.hover}
              whileTap={buttonHover.tap}
              onClick={openEditModal} 
              className="w-full py-4 bg-surface-secondary text-text-primary rounded-2xl font-black uppercase text-xs tracking-widest border border-border-dim hover:bg-surface hover:border-primary hover:text-primary transition-all cursor-pointer"
            >
              Update Profile & Address
            </motion.button>
          </motion.div>

          <motion.div variants={fadeInUp} className="bg-surface p-8 rounded-[2.5rem] shadow-xl shadow-primary/5 border border-border-dim">
            <h3 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-6 flex items-center">
              <ShieldCheck className="w-4 h-4 mr-2 text-primary" /> Role & Verification
            </h3>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted font-bold uppercase">Current Role:</span>
                <span className="font-black text-text-primary uppercase bg-surface-secondary px-3 py-1 rounded-lg">{dbUser?.user?.role || 'CUSTOMER'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-text-muted font-bold uppercase">Status:</span>
                <span className={`font-black uppercase px-3 py-1 rounded-lg ${dbUser?.user?.verificationStatus === 'VERIFIED' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'}`}>
                  {dbUser?.user?.verificationStatus || 'PENDING'}
                </span>
              </div>
              {dbUser?.user?.requestedRole && dbUser?.user?.requestedRole !== 'CUSTOMER' && dbUser?.user?.role !== dbUser?.user?.requestedRole && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-text-muted font-bold uppercase">Requested Role:</span>
                  <span className="font-black text-primary uppercase bg-primary/10 px-3 py-1 rounded-lg">{dbUser?.user?.requestedRole} (Pending)</span>
                </div>
              )}
            </div>

            {dbUser?.user?.role === 'CUSTOMER' && (!dbUser?.user?.requestedRole || dbUser?.user?.requestedRole === 'CUSTOMER') && (
              <motion.button 
                whileHover={buttonHover.hover}
                whileTap={buttonHover.tap}
                onClick={() => {
                  setShowProfileModal(false);
                  setShowMap(false);
                  setShowRoleModal(true);
                }} 
                className="w-full py-4 bg-primary text-light-green rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all cursor-pointer"
              >
                Request Seller / Logistic Officer Role
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Edit Profile & Address Modal */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowProfileModal(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface border border-border-dim p-6 sm:p-8 rounded-[2.5rem] shadow-2xl max-w-lg w-full relative z-10 max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-black uppercase tracking-tight text-text-primary flex items-center">
                  <User className="w-5 h-5 mr-2 text-primary" /> Profile & Address Settings
                </h3>
                <button onClick={() => setShowProfileModal(false)} className="p-2 text-text-muted hover:text-white rounded-xl bg-surface-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {saveSuccess ? (
                <div className="text-center py-8 space-y-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-bounce" />
                  <p className="text-lg font-black text-white">Profile Updated Successfully!</p>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-6">
                  <div>
                    <label className="block text-xs font-black text-blue-100 uppercase tracking-widest mb-2">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 w-5 h-5 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 font-bold text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-blue-100 uppercase tracking-widest mb-2">
                      Phone Number
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 w-5 h-5 pointer-events-none" />
                      <input
                        type="tel"
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 font-bold text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-blue-100 uppercase tracking-widest mb-2">
                      Delivery Address (Location)
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 w-5 h-5 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={editAddress}
                        onChange={(e) => setEditAddress(e.target.value)}
                        placeholder="e.g. Kariakoo Market, Dar es Salaam"
                        className="w-full pl-12 pr-4 py-3.5 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 font-bold text-sm outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-blue-100 uppercase tracking-widest mb-2">
                      Preferred Payment Method
                    </label>
                    <select
                      value={editPaymentMethod}
                      onChange={(e) => setEditPaymentMethod(e.target.value)}
                      className="w-full px-4 py-3.5 bg-blue-600 border border-blue-400 text-white rounded-2xl focus:ring-2 focus:ring-blue-300 font-bold text-sm outline-none cursor-pointer"
                    >
                      <option className="bg-slate-900 text-white" value="M-Pesa">Vodacom M-Pesa</option>
                      <option className="bg-slate-900 text-white" value="Tigo Pesa">Tigo Pesa</option>
                      <option className="bg-slate-900 text-white" value="Airtel Money">Airtel Money</option>
                      <option className="bg-slate-900 text-white" value="Cash on Delivery">Cash on Delivery</option>
                    </select>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowProfileModal(false)}
                      className="flex-1 py-4 bg-surface-secondary text-text-muted hover:text-white rounded-2xl font-black uppercase text-xs tracking-widest"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="flex-1 py-4 bg-primary text-light-green hover:bg-primary-hover rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center space-x-2 shadow-lg cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Track Map Modal */}
      <AnimatePresence>
        {showMap && selectedOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMap(false)} className="absolute inset-0 bg-text-primary/60 backdrop-blur-md" />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="bg-surface w-full max-w-5xl h-full max-h-[80vh] rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col"
             >
                <div className="p-8 border-b border-border-dim flex items-center justify-between">
                   <div>
                      <h2 className="text-2xl font-black uppercase tracking-tight text-text-primary">{t.mapTitle}</h2>
                      <p className="text-xs font-bold text-text-muted uppercase tracking-widest">Order #{selectedOrder.order.id} • {selectedOrder.order.status}</p>
                   </div>
                   <button onClick={() => setShowMap(false)} className="p-3 bg-surface-secondary rounded-2xl hover:bg-border-dim transition-all text-text-muted"><X className="w-6 h-6" /></button>
                </div>
                <div className="flex-grow relative bg-surface-secondary">
                   {(() => {
                      const originLat = !isNaN(Number(selectedOrder.shop?.latitude)) && Number(selectedOrder.shop?.latitude) !== 0
                        ? Number(selectedOrder.shop?.latitude)
                        : -6.7924;
                      const originLng = !isNaN(Number(selectedOrder.shop?.longitude)) && Number(selectedOrder.shop?.longitude) !== 0
                        ? Number(selectedOrder.shop?.longitude)
                        : 39.2083;
                      const destLat = !isNaN(Number(selectedOrder.order?.deliveryLatitude)) && Number(selectedOrder.order?.deliveryLatitude) !== 0
                        ? Number(selectedOrder.order?.deliveryLatitude)
                        : -6.8162;
                      const destLng = !isNaN(Number(selectedOrder.order?.deliveryLongitude)) && Number(selectedOrder.order?.deliveryLongitude) !== 0
                        ? Number(selectedOrder.order?.deliveryLongitude)
                        : 39.2804;

                      return (
                        <Map
                          defaultZoom={13}
                          defaultCenter={{ lat: originLat, lng: originLng }}
                          mapId="DEMO_MAP_ID"
                          internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                          className="w-full h-full"
                        >
                          <RouteMap 
                            origin={{ lat: originLat, lng: originLng }}
                            destination={{ lat: destLat, lng: destLng }}
                            originLabel={selectedOrder.shop?.name || "Kituo cha Muuzaji (Shop)"}
                            destinationLabel="Eneo Lako la Kupokelea (You)"
                            orderId={selectedOrder.order?.id}
                            deliveryAddress={selectedOrder.order?.deliveryAddress}
                            isOfficerTracking={false}
                          />
                        </Map>
                      );
                   })()}
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Role Request Modal */}
      <AnimatePresence>
        {showRoleModal && (
          <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowRoleModal(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-surface border border-border-dim p-6 sm:p-8 rounded-[2.5rem] shadow-2xl max-w-lg w-full relative z-10 max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight text-text-primary flex items-center">
                    <ShieldCheck className="w-5 h-5 mr-2 text-primary" /> Request Privilege Role
                  </h3>
                  <p className="text-xs font-bold text-text-muted uppercase mt-1">
                    Apply for Seller or Logistic Officer verification
                  </p>
                </div>
                <button onClick={() => setShowRoleModal(false)} className="p-2 text-text-muted hover:text-white rounded-xl bg-surface-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleRoleRequest} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-text-muted uppercase tracking-widest mb-2">
                    Select Role <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value as any)}
                    className="w-full px-4 py-3.5 bg-surface-secondary border border-border-dim text-text-primary rounded-2xl font-bold text-sm outline-none cursor-pointer"
                  >
                    <option value="SELLER">Muuzaji (Seller) - Sell products on Dreamers</option>
                    <option value="LOGISTICS">Afisa Usafirishaji (Logistic Officer) - Deliver assigned orders</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-text-muted uppercase tracking-widest mb-2">
                    Reason / Business Summary (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={roleReason}
                    onChange={(e) => setRoleReason(e.target.value)}
                    placeholder="Weka maelezo mafupi kuhusu duka au huduma yako..."
                    className="w-full px-4 py-3.5 bg-surface-secondary border border-border-dim text-text-primary placeholder:text-text-muted rounded-2xl font-bold text-sm outline-none resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowRoleModal(false)}
                    className="flex-1 py-4 bg-surface-secondary text-text-muted hover:text-white rounded-2xl font-black uppercase text-xs tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRole}
                    className="flex-1 py-4 bg-primary text-light-green hover:bg-primary-hover rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center space-x-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    <span>{submittingRole ? 'Submitting...' : 'Submit Request'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

