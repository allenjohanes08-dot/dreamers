// src/pages/LogisticsDashboard.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Truck, MapPin, Package, CheckCircle, Navigation, Clock, Shield, AlertCircle, Map as MapIcon, X, FileText, UserCheck, Send, Crosshair, Maximize2, Minimize2, RotateCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { translations } from '../lib/translations.ts';
import { useNotifications } from '../context/NotificationContext.tsx';
import { auth } from '../lib/firebase.ts';
import { fetchWithRetry } from '../lib/api.ts';
import { Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import RouteMap from '../components/RouteMap.tsx';
import { staggerContainer, fadeInUp, listItem, buttonHover, scaleIn } from '../lib/animations';

export default function LogisticsDashboard() {
  const { user, dbUser, loading: authLoading, language } = useAuth();
  const { notifications, showToast } = useNotifications();
  const [data, setData] = useState<any>({ myDeliveries: [], availableTasks: [] });
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState<any>(null);

  // Logistic Officer GPS Geolocation Tracking state
  const [officerLocation, setOfficerLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [officerAccuracy, setOfficerAccuracy] = useState<number | null>(null);
  const [geoPermission, setGeoPermission] = useState<'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable'>('idle');
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [nearArrivalAlert, setNearArrivalAlert] = useState<{ isNear: boolean; distanceMeters: number } | null>(null);

  // Delivery status update modal state
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [activeAssignment, setActiveAssignment] = useState<any>(null);
  const [updateStatus, setUpdateStatus] = useState('DELIVERED');
  const [recipientName, setRecipientName] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [updating, setUpdating] = useState(false);
  const [acceptingTaskId, setAcceptingTaskId] = useState<number | null>(null);

  const t = translations[language].logisticsDashboard;

  // Function to actively request and stream officer's real-time device GPS location
  const requestOfficerLocation = () => {
    if (!navigator.geolocation) {
      setGeoPermission('unavailable');
      setGeoError(language === 'sw' ? 'Kifaa hakina huduma ya GPS' : 'Device does not support GPS geolocation');
      return null;
    }

    setGeoPermission('requesting');
    setGeoError(null);

    const tryStandardAccuracy = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOfficerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setOfficerAccuracy(pos.coords.accuracy);
          setGeoPermission('granted');
          setGeoError(null);
        },
        (err) => {
          console.warn('Geolocation standard fallback error:', err);
          if (err.code === 1) {
            setGeoPermission('denied');
            setGeoError(language === 'sw' ? 'Ruhusa ya eneo imekataliwa. Bofya kurudia.' : 'Location permission denied. Click to retry.');
          } else {
            setGeoPermission('unavailable');
            setGeoError(language === 'sw' ? 'Eneo la GPS halipatikani' : 'GPS position temporarily unavailable');
          }
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOfficerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOfficerAccuracy(pos.coords.accuracy);
        setGeoPermission('granted');
        setGeoError(null);
      },
      (err) => {
        console.warn('Geolocation initial request error:', err);
        if (err.code === 1) {
          setGeoPermission('denied');
          setGeoError(language === 'sw' ? 'Ruhusa ya eneo imekataliwa. Bofya kurudia.' : 'Location permission denied. Click to retry.');
        } else {
          // If high accuracy timed out or unavailable, try standard accuracy fallback
          tryStandardAccuracy();
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );

    // Watch position as officer moves
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setOfficerLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOfficerAccuracy(pos.coords.accuracy);
        setGeoPermission('granted');
      },
      (err) => {
        console.warn('Geolocation continuous watch error:', err);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 4000 }
    );

    return watchId;
  };

  // Manage geolocation watcher lifecycle when map is shown
  useEffect(() => {
    let watchId: number | null = null;
    if (showMap) {
      watchId = requestOfficerLocation();
    } else {
      setNearArrivalAlert(null);
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [showMap]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchDeliveries();
    }
  }, [authLoading, user, notifications.length]);

  const fetchDeliveries = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/logistics/deliveries', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setData(await res.json());
      }
    } finally {
      setLoading(false);
    }
  };

  const handleViewRoute = (delivery: any) => {
    setShowUpdateModal(false);
    setSelectedDelivery(delivery);
    setShowMap(true);
  };

  const openUpdateModal = (delivery: any) => {
    setShowMap(false);
    setActiveAssignment(delivery);
    setUpdateStatus('DELIVERED');
    setRecipientName(delivery.customer?.fullName || '');
    setDeliveryNotes('');
    setShowUpdateModal(true);
  };

  const handleAcceptTask = async (orderId: number) => {
    try {
      setAcceptingTaskId(orderId);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/logistics/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ orderId })
      });
      if (res.ok) {
        showToast('Kazi Imepokelewa / Task Accepted', `Oda #${orderId} imeongezwa kwenye mizigo yako.`, 'success');
        fetchDeliveries();
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast('Imeshindikana / Task Error', errJson.error || 'Could not accept task', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error', err?.message || 'Could not accept task', 'error');
    } finally {
      setAcceptingTaskId(null);
    }
  };

  const handleConfirmStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignment) return;
    setUpdating(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/logistics/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          assignmentId: activeAssignment.assignment.id, 
          status: updateStatus,
          recipientName,
          notes: deliveryNotes
        })
      });
      if (res.ok) {
        showToast('Hali Imesasishwa / Delivery Updated', `Hali ya Oda #${activeAssignment.order.id} imesasishwa kuwa ${updateStatus}.`, 'success');
        setShowUpdateModal(false);
        fetchDeliveries();
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast('Imeshindikana / Update Error', errJson.error || 'Failed to update delivery status', 'error');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Error', err?.message || 'Failed to update delivery status', 'error');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-text-primary mb-2 tracking-tighter uppercase">{t.title}</h1>
          <p className="text-text-secondary font-bold uppercase tracking-widest text-[10px]">Officer: {dbUser?.user?.fullName}</p>
        </div>
        <div className="flex items-center bg-success/10 px-6 py-3 rounded-2xl border border-success/20">
           <div className="w-3 h-3 bg-success rounded-full animate-pulse mr-3" />
           <span className="text-success font-black text-xs uppercase tracking-widest">Active & Online</span>
        </div>
      </div>

      <motion.div 
        initial="initial"
        animate="animate"
        variants={staggerContainer(0.1)}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <div className="lg:col-span-2 space-y-8">
          {/* Active Deliveries */}
          <motion.div variants={fadeInUp} className="bg-surface p-8 rounded-[2.5rem] shadow-xl shadow-primary/5 border border-border-dim">
             <h2 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center text-text-primary">
                <Navigation className="w-6 h-6 mr-3 text-primary" /> {t.active}
             </h2>
             {authLoading || loading ? (
               <div className="space-y-4">
                 {[1,2,3].map(i => <div key={i} className="h-24 bg-surface-secondary animate-pulse rounded-3xl" />)}
               </div>
             ) : data.myDeliveries.length === 0 ? (
               <motion.div variants={scaleIn} className="text-center py-20 bg-surface-secondary rounded-[2rem] border-2 border-dashed border-border-dim">
                  <Truck className="w-12 h-12 text-text-muted/30 mx-auto mb-4" />
                  <p className="text-text-muted font-bold uppercase text-xs tracking-widest">No active deliveries</p>
               </motion.div>
             ) : (
               <motion.div variants={staggerContainer(0.08)} className="space-y-6">
                  {data.myDeliveries.map((d: any) => (
                    <motion.div 
                      variants={listItem}
                      key={d.assignment.id} 
                      className="p-6 bg-surface-secondary rounded-3xl border border-border-dim relative overflow-hidden group hover:border-primary/30 transition-all"
                    >
                       <div className="absolute top-0 right-0 p-4">
                          <span className="bg-primary text-light-green text-[8px] font-black px-3 py-1 rounded-full uppercase">{d.assignment.status}</span>
                       </div>
                       <div className="flex items-start space-x-6">
                          <motion.div 
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            className="w-14 h-14 bg-surface rounded-2xl flex items-center justify-center shadow-sm"
                          >
                             <Package className="w-7 h-7 text-primary" />
                          </motion.div>
                          <div className="flex-grow">
                             <p className="text-lg font-black text-text-primary leading-tight">Order #{d.order.id}</p>
                             <p className="text-xs font-bold text-text-secondary uppercase mt-1">Customer: {d.customer.fullName}</p>
                             
                             <div className="mt-6 flex flex-col sm:flex-row gap-4 sm:items-center">
                                <div className="flex items-center text-xs font-bold text-text-secondary">
                                   <MapPin className="w-4 h-4 mr-1 text-text-muted" /> {d.order.deliveryAddress}
                                </div>
                                <div className="flex items-center text-xs font-bold text-text-secondary">
                                   <Clock className="w-4 h-4 mr-1 text-text-muted" /> Est. 25 mins
                                </div>
                             </div>
                          </div>
                       </div>
                       <div className="mt-8 grid grid-cols-2 gap-4">
                          <motion.button 
                            whileHover={buttonHover.hover}
                            whileTap={buttonHover.tap}
                            onClick={() => handleViewRoute(d)} 
                            className="py-4 bg-primary text-light-green rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 flex items-center justify-center cursor-pointer"
                          >
                             <MapIcon className="w-4 h-4 mr-2" /> {t.route}
                          </motion.button>
                          <motion.button 
                             whileHover={buttonHover.hover}
                             whileTap={buttonHover.tap}
                             onClick={() => openUpdateModal(d)}
                             className="py-4 bg-primary text-light-green rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 cursor-pointer"
                           >
                             Update Delivery
                           </motion.button>
                       </div>
                    </motion.div>
                  ))}
               </motion.div>
             )}
          </motion.div>

          {/* Available Tasks */}
          <motion.div variants={fadeInUp} className="bg-surface p-8 rounded-[2.5rem] shadow-xl shadow-primary/5 border border-border-dim">
             <h2 className="text-xl font-black uppercase tracking-tight mb-8 flex items-center text-text-primary">
                <Truck className="w-6 h-6 mr-3 text-primary" /> {t.tasks}
             </h2>
             <motion.div variants={staggerContainer(0.05)} className="space-y-4">
                {data.availableTasks.length === 0 ? (
                  <p className="text-text-muted font-bold uppercase text-[10px] text-center py-8 bg-surface-secondary rounded-2xl border-2 border-dashed border-border-dim">Scanning for new orders...</p>
                ) : (
                  data.availableTasks.map((o: any) => (
                    <motion.div 
                      variants={listItem}
                      key={o.id} 
                      className="flex items-center justify-between p-5 bg-surface-secondary rounded-2xl border border-border-dim hover:border-primary/30 transition-all group"
                    >
                       <div>
                          <p className="font-black text-sm uppercase text-text-primary">Order #{o.id}</p>
                          <p className="text-[10px] text-text-secondary font-bold uppercase truncate max-w-[200px]">{o.deliveryAddress}</p>
                       </div>
                       <motion.button 
                         whileHover={{ scale: 1.05 }}
                         whileTap={{ scale: 0.95 }}
                         disabled={acceptingTaskId === o.id}
                         onClick={() => handleAcceptTask(o.id)}
                         className="px-6 py-3 bg-surface text-primary border-2 border-primary/20 rounded-xl font-black uppercase text-[10px] hover:bg-primary hover:text-light-green transition-all shadow-sm cursor-pointer disabled:opacity-50"
                       >
                         {acceptingTaskId === o.id ? 'Accepting...' : 'Accept Task'}
                       </motion.button>
                    </motion.div>
                  ))
                )}
             </motion.div>
          </motion.div>
        </div>

        <motion.div variants={staggerContainer(0.1)} className="space-y-8">
           {/* Officer Profile */}
          <motion.div variants={fadeInUp} className="bg-text-primary text-light-green p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 w-32 h-32 bg-primary rounded-full -mr-16 -mt-16 opacity-20 blur-2xl" />
             <div className="relative z-10">
                <motion.div 
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="w-16 h-16 bg-light-green/10 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md"
                >
                   <Shield className="w-8 h-8 text-primary" />
                </motion.div>
                <h3 className="text-2xl font-black uppercase tracking-tight mb-1">{dbUser?.user?.fullName}</h3>
                <p className="text-primary font-bold text-xs uppercase tracking-[0.2em] mb-8">Verified Officer</p>
                
                <div className="space-y-4 pt-8 border-t border-light-green-border/10">
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-light-green/40 uppercase tracking-widest">Vehicle</span>
                      <span className="text-xs font-bold uppercase">{dbUser?.profile?.vehicleType || 'Motorcycle'}</span>
                   </div>
                   <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black text-light-green/40 uppercase tracking-widest">Plates</span>
                      <span className="text-xs font-bold uppercase">{dbUser?.profile?.licensePlate || 'T 432 ABC'}</span>
                   </div>
                </div>
             </div>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Driver Delivery Update Form Modal */}
      <AnimatePresence>
        {showUpdateModal && activeAssignment && (
          <div className="fixed inset-0 z-[120] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUpdateModal(false)}
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
                    <Truck className="w-5 h-5 mr-2 text-primary" /> Delivery Completion Form
                  </h3>
                  <p className="text-xs font-bold text-text-muted uppercase mt-1">
                    Order #{activeAssignment.order.id} • {activeAssignment.customer.fullName}
                  </p>
                </div>
                <button onClick={() => setShowUpdateModal(false)} className="p-2 text-text-muted hover:text-white rounded-xl bg-surface-secondary">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConfirmStatusUpdate} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-blue-100 uppercase tracking-widest mb-2">
                    Delivery Status <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={updateStatus}
                    onChange={(e) => setUpdateStatus(e.target.value)}
                    className="w-full px-4 py-3.5 bg-blue-600 border border-blue-400 text-white rounded-2xl focus:ring-2 focus:ring-blue-300 font-bold text-sm outline-none cursor-pointer"
                  >
                    <option className="bg-slate-900 text-white" value="OUT_FOR_DELIVERY">OUT_FOR_DELIVERY (Nipo Njia)</option>
                    <option className="bg-slate-900 text-white" value="DELIVERED">DELIVERED (Nimemkabidhi Mteja)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-blue-100 uppercase tracking-widest mb-2">
                    Recipient / Confirmation Name
                  </label>
                  <div className="relative">
                    <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 w-5 h-5 pointer-events-none" />
                    <input
                      type="text"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Jina la aliyepokea mzigo..."
                      className="w-full pl-12 pr-4 py-3.5 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 font-bold text-sm outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-blue-100 uppercase tracking-widest mb-2">
                    Delivery Proof Notes / Handover Details
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-4 top-4 text-blue-200 w-5 h-5 pointer-events-none" />
                    <textarea
                      rows={3}
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      placeholder="Maelezo ya ziada ya uwasilishaji au sehemu ilipoachwa..."
                      className="w-full pl-12 pr-4 py-3.5 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 font-bold text-sm outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUpdateModal(false)}
                    className="flex-1 py-4 bg-surface-secondary text-text-muted hover:text-white rounded-2xl font-black uppercase text-xs tracking-widest"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="flex-1 py-4 bg-primary text-light-green hover:bg-primary-hover rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center space-x-2 shadow-lg cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{updating ? 'Saving...' : 'Submit Status'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Map Modal */}
      <AnimatePresence>
        {showMap && selectedDelivery && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-6">
             <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }} 
               onClick={() => setShowMap(false)} 
               className="absolute inset-0 bg-text-primary/75 backdrop-blur-md" 
             />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className={`bg-surface w-full ${isMapFullscreen ? 'max-w-none h-full max-h-none rounded-none' : 'max-w-6xl h-full max-h-[90vh] rounded-[2.5rem]'} shadow-2xl relative z-10 overflow-hidden flex flex-col border border-border-dim transition-all duration-300`}
             >
                {/* Header with Navigation Telemetry & Quick Action */}
                <div className="p-4 sm:p-6 border-b border-border-dim flex flex-wrap items-center justify-between gap-4 bg-surface relative z-10">
                   <div className="flex-1 min-w-[240px]">
                      <div className="flex items-center space-x-2">
                        <span className="p-1.5 rounded-lg bg-primary/10 text-primary font-black text-xs uppercase">
                          Oda #{selectedDelivery.order.id}
                        </span>
                        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-text-primary truncate">
                          {t.mapTitle}: {selectedDelivery.customer?.fullName}
                        </h2>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                        <span className="text-text-muted font-bold truncate max-w-[280px] flex items-center">
                          <MapPin className="w-3.5 h-3.5 text-red-500 mr-1 shrink-0" />
                          {selectedDelivery.order.deliveryAddress}
                        </span>

                        {/* Officer Live Geolocation Status Badge */}
                        {geoPermission === 'granted' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>GPS Yako Ipo Hewani {officerAccuracy ? `(±${Math.round(officerAccuracy)}m)` : ''}</span>
                          </span>
                        )}

                        {geoPermission === 'requesting' && (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
                            <span>Inaunganisha GPS ya kifaa...</span>
                          </span>
                        )}

                        {(geoPermission === 'denied' || geoPermission === 'unavailable') && (
                          <button
                            type="button"
                            onClick={requestOfficerLocation}
                            className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 hover:text-white hover:bg-red-500 font-black text-[10px] transition cursor-pointer"
                          >
                            <AlertCircle className="w-3 h-3 mr-0.5" />
                            <span>GPS Imezimwa (Bofya Kuruhusu)</span>
                          </button>
                        )}
                      </div>
                   </div>

                   {/* Quick Action & Viewport Toggles */}
                   <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => openUpdateModal(selectedDelivery)}
                        className="px-4 py-2.5 bg-primary text-light-green hover:bg-primary-hover rounded-xl font-black uppercase text-xs tracking-wider transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
                      >
                        <CheckCircle className="w-4 h-4" />
                        <span className="hidden sm:inline">Update Delivery</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsMapFullscreen(!isMapFullscreen)}
                        title={isMapFullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
                        className="p-2.5 bg-surface-secondary hover:bg-border-dim rounded-xl transition text-text-muted hover:text-white cursor-pointer"
                      >
                        {isMapFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                      </button>

                      <button 
                        type="button"
                        onClick={() => setShowMap(false)} 
                        className="p-2.5 bg-surface-secondary hover:bg-border-dim rounded-xl transition-all text-text-muted hover:text-white cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                   </div>
                </div>

                {/* Interactive Map Viewport */}
                <div className="flex-grow relative bg-surface-secondary min-h-[350px]">
                   <Map
                      defaultZoom={14}
                      defaultCenter={
                        officerLocation || { 
                          lat: Number(selectedDelivery.order?.deliveryLatitude) || -6.8162, 
                          lng: Number(selectedDelivery.order?.deliveryLongitude) || 39.2804 
                        }
                      }
                      mapId="DEMO_MAP_ID"
                      internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
                      className="w-full h-full"
                      gestureHandling="greedy"
                      mapTypeControl={true}
                      fullscreenControl={false}
                      streetViewControl={false}
                   >
                      <RouteMap 
                        origin={
                          officerLocation || { 
                            lat: Number(selectedDelivery.shop?.latitude) || -6.7924, 
                            lng: Number(selectedDelivery.shop?.longitude) || 39.2083 
                          }
                        }
                        destination={{ 
                          lat: Number(selectedDelivery.order?.deliveryLatitude) || -6.8162, 
                          lng: Number(selectedDelivery.order?.deliveryLongitude) || 39.2804 
                        }}
                        originLabel={officerLocation ? (language === 'sw' ? 'Eneo Lako la Sasa (Afisa)' : 'Your current location') : (language === 'sw' ? 'Kituo cha Mzigo (Hub)' : 'Pickup Hub')}
                        destinationLabel={language === 'sw' ? `Mteja: ${selectedDelivery.customer?.fullName || 'Eneo la Uwasilishaji'}` : `Customer: ${selectedDelivery.customer?.fullName || 'Destination'}`}
                        customerName={selectedDelivery.customer?.fullName}
                        orderId={selectedDelivery.order?.id}
                        deliveryAddress={selectedDelivery.order?.deliveryAddress}
                        officerAccuracy={officerAccuracy}
                        isOfficerTracking={!!officerLocation}
                        language={language}
                        onArrivedThreshold={(isNear, dist) => setNearArrivalAlert({ isNear, distanceMeters: dist })}
                      />
                   </Map>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
