/// <reference types="@types/google.maps" />
// src/pages/SellerDashboard.tsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Store, Plus, Package, TrendingUp, DollarSign, List, AlertCircle, CheckCircle, X, Image as ImageIcon, Loader2, MapPin, Play, Video, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { translations } from '../lib/translations.ts';
import { useNotifications } from '../context/NotificationContext.tsx';
import { auth } from '../lib/firebase.ts';
import { fetchWithRetry } from '../lib/api.ts';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import ImageUploadInput from '../components/ImageUploadInput.tsx';
import VideoUploadInput from '../components/VideoUploadInput.tsx';
import { createProductService, updateProductService, deleteProductService } from '../services/api.ts';
import { VideoEncodingProfile } from '../hooks/useVideoProcessor.ts';
import { staggerContainer, fadeInUp, listItem, scaleIn, buttonHover } from '../lib/animations';
import { PaymentModal } from '../components/PaymentModal.tsx';

export default function SellerDashboard() {
  const { dbUser, language, refreshProfile } = useAuth();
  const { showToast } = useNotifications();
  const currentShop = dbUser?.shops?.[0];
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showShopModal, setShowShopModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    categoryId: '',
    images: [''],
    videoUrl: '',
    videoStoragePath: '',
    videoFileName: '',
    videoFileType: '',
    videoFileSize: 0,
    videoUploadStatus: 'COMPLETED'
  });

  const [shopData, setShopData] = useState({
    name: '',
    description: '',
    address: '',
    latitude: 0,
    longitude: 0,
    logoUrl: ''
  });

  const [showEditShopModal, setShowEditShopModal] = useState(false);
  const [editProductModal, setEditProductModal] = useState<any | null>(null);
  const [editShopData, setEditShopData] = useState({
    name: '',
    description: '',
    address: '',
    latitude: 0,
    longitude: 0,
    logoUrl: ''
  });

  const [videoEncodingProfile, setVideoEncodingProfile] = useState<VideoEncodingProfile>(() => {
    return (localStorage.getItem('dreamers_video_profile') as VideoEncodingProfile) || 'speed';
  });

  // Seller Payment & Subscription States
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [lipaNumber, setLipaNumber] = useState('');
  const [lipaAccountName, setLipaAccountName] = useState('');
  const [savingLipa, setSavingLipa] = useState(false);

  useEffect(() => {
    localStorage.setItem('dreamers_video_profile', videoEncodingProfile);
  }, [videoEncodingProfile]);

  const shopAutocompleteRef = useRef<HTMLInputElement>(null);
  const editShopAutocompleteRef = useRef<HTMLInputElement>(null);
  const placesLib = useMapsLibrary('places');

  useEffect(() => {
    if (!placesLib || !shopAutocompleteRef.current || !showShopModal) return;

    const autocomplete = new google.maps.places.Autocomplete(shopAutocompleteRef.current, {
      componentRestrictions: { country: 'tz' },
      fields: ['formatted_address', 'geometry'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (location) {
        setShopData(prev => ({
          ...prev,
          address: place.formatted_address || '',
          latitude: location.lat(),
          longitude: location.lng()
        }));
      }
    });
  }, [placesLib, showShopModal]);

  useEffect(() => {
    if (!placesLib || !editShopAutocompleteRef.current || !showEditShopModal) return;

    const autocomplete = new google.maps.places.Autocomplete(editShopAutocompleteRef.current, {
      componentRestrictions: { country: 'tz' },
      fields: ['formatted_address', 'geometry'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (location) {
        setEditShopData(prev => ({
          ...prev,
          address: place.formatted_address || '',
          latitude: location.lat(),
          longitude: location.lng()
        }));
      }
    });
  }, [placesLib, showEditShopModal]);

  const handleOpenEditShop = () => {
    const currentShop = dbUser?.shops?.[0];
    if (currentShop) {
      setEditShopData({
        name: currentShop.name || '',
        description: currentShop.description || '',
        address: currentShop.address || '',
        latitude: Number(currentShop.latitude) || 0,
        longitude: Number(currentShop.longitude) || 0,
        logoUrl: currentShop.logoUrl || ''
      });
    }
    setShowAddModal(false);
    setShowShopModal(false);
    setShowVerificationModal(false);
    setShowSubscriptionModal(false);
    setShowEditShopModal(true);
  };

  const handleOpenEditProduct = (product: any) => {
    setEditProductModal({
      ...product,
      price: product.price.toString(),
      stock: product.stock.toString(),
      categoryId: product.categoryId.toString(),
    });
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProductModal) return;
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      await updateProductService(
        editProductModal.id,
        {
          ...editProductModal,
          price: Number(editProductModal.price),
          stock: Number(editProductModal.stock),
          categoryId: Number(editProductModal.categoryId),
        },
        token
      );
      showToast('Bidhaa Imesasishwa / Product Updated', 'Mabadiliko yamehifadhiwa!', 'success');
      setEditProductModal(null);
      fetchData();
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to update product', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: number) => {
    if (!confirm('Are you sure you want to remove this product?')) return;
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      await deleteProductService(productId, token);
      showToast('Bidhaa Imeondolewa / Product Removed', 'Bidhaa imeondolewa kikamilifu.', 'success');
      setEditProductModal(null);
      fetchData();
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to delete product', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/seller/shops', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editShopData)
      });
      if (res.ok) {
        await refreshProfile();
        showToast('Duka Limesasishwa / Shop Updated', 'Taarifa za duka zimehifadhiwa kikamilifu!', 'success');
        setShowEditShopModal(false);
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast('Hitilafu / Update Failed', errJson.error || 'Failed to update shop', 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to update shop', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const t = translations[language].sellerDashboard;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const [prodRes, catRes, subRes] = await Promise.all([
        fetchWithRetry('/api/seller/products', { headers: { Authorization: `Bearer ${token}` } }),
        fetchWithRetry('/api/categories'),
        fetchWithRetry('/api/seller/subscription', { headers: { Authorization: `Bearer ${token}` } })
      ]);
      if (prodRes.ok) setProducts(await prodRes.json().catch(() => []));
      if (catRes.ok) setCategories(await catRes.json().catch(() => []));
      if (subRes.ok) setSubscriptionData(await subRes.json().catch(() => null));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/seller/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(shopData)
      });
      if (res.ok) {
        await refreshProfile();
        showToast(t.shopSetupComplete, t.shopSetupCompleteMessage, 'success');
        setShowShopModal(false);
      } else {
        const errJson = await res.json().catch(() => ({}));
        showToast(t.shopSetupFailed, errJson.error || t.shopSetupFailedMessage, 'error');
      }
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to setup shop', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      await createProductService(
        {
          ...formData,
          price: Number(formData.price),
          stock: Number(formData.stock),
          categoryId: Number(formData.categoryId),
          shopId: dbUser.shops?.[0]?.id,
        },
        token
      );
      showToast('Product Uploaded', 'Product uploaded successfully and submitted to Admin for review.', 'success');
      setShowAddModal(false);
      fetchData();
      setFormData({ name: '', description: '', price: '', stock: '', categoryId: '', images: [''], videoUrl: '', videoStoragePath: '', videoFileName: '', videoFileType: '', videoFileSize: 0, videoUploadStatus: 'COMPLETED' });
    } catch (err: any) {
      showToast('Error', err?.message || 'Failed to create product', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeProductCount = Array.isArray(products) ? products.filter(p => p.status !== 'DEACTIVATED').length : 0;
  const hasShop = (dbUser?.shops?.length ?? 0) > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {!hasShop && !loading && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-600 rounded-[3rem] p-12 text-light-green mb-12 shadow-2xl shadow-blue-200 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-light-green/10 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <h2 className="text-4xl font-black uppercase tracking-tight mb-4">{t.setupShop}</h2>
            <p className="text-blue-100 font-bold mb-8">{t.setupShopSub}</p>
            <button 
              onClick={() => {
                setShowAddModal(false);
                setShowEditShopModal(false);
                setShowVerificationModal(false);
                setShowSubscriptionModal(false);
                setShowShopModal(true);
              }}
              className="px-10 py-5 bg-light-green text-blue-600 rounded-2xl font-black uppercase tracking-tight shadow-xl hover:scale-105 transition-transform"
            >
              Get Started
            </button>
          </div>
        </motion.div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-black text-white mb-2 tracking-tight uppercase">{t.hub}</h1>
          <p className="text-slate-400 font-medium">Managing <span className="font-bold text-white underline decoration-blue-500 decoration-2 underline-offset-4">{dbUser?.profile?.businessName || 'Your Business'}</span></p>
        </div>
        
        <div className="flex flex-col items-end gap-2">
           <button 
             onClick={() => {
               setShowShopModal(false);
               setShowEditShopModal(false);
               setShowVerificationModal(false);
               setShowSubscriptionModal(false);
               setShowAddModal(true);
             }}
             disabled={activeProductCount >= 10 || !hasShop}
             className={`flex items-center justify-center space-x-2 px-8 py-4 rounded-2xl font-black uppercase tracking-tight transition-all shadow-xl ${activeProductCount >= 10 || !hasShop ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-light-green hover:bg-blue-700 shadow-blue-200'}`}
           >
             <Plus className="w-5 h-5" />
             <span>{t.addProduct}</span>
           </button>
           <p className={`text-xs font-bold ${activeProductCount >= 10 ? 'text-red-500' : 'text-slate-400'}`}>
              {activeProductCount >= 10 ? t.limitReached : t.productCount.replace('{count}', activeProductCount.toString())}
           </p>
        </div>
      </div>

      {/* Seller Financial Verification & Monthly Subscription Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-6 md:p-8 text-slate-100 mb-12 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">Seller Account Status</span>
            <h2 className="text-xl md:text-2xl font-black text-white mt-1">Verification Fee & Subscription</h2>
            <p className="text-xs text-slate-400 mt-0.5">Initial Verification: TZS 5,000 | Monthly Subscription: TZS 15,000/month</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditProductModal(null);
                setShowShopModal(false);
                setShowEditShopModal(false);
                setShowSubscriptionModal(false);
                setShowVerificationModal(true);
              }}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl transition shadow cursor-pointer"
            >
              Pay Verification Fee (5,000 TZS)
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
                setEditProductModal(null);
                setShowShopModal(false);
                setShowEditShopModal(false);
                setShowVerificationModal(false);
                setShowSubscriptionModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl transition shadow cursor-pointer"
            >
              Renew Monthly Subscription (15,000 TZS)
            </button>
          </div>
        </div>

        {/* Statuses and Lipa Payout Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Verification Fee (TZS 5,000)</span>
            <div className="text-base font-black text-white mt-1 flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${dbUser?.sellerProfile?.verificationFeePaid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{dbUser?.sellerProfile?.verificationFeePaid ? 'VERIFIED & PAID' : 'PENDING VERIFICATION'}</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Monthly Subscription (TZS 15,000)</span>
            <div className="text-base font-black text-white mt-1 flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${subscriptionData?.subscriptionStatus === 'ACTIVE' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>{subscriptionData?.subscriptionStatus === 'ACTIVE' ? 'ACTIVE' : 'PENDING / EXPIRED'}</span>
            </div>
            {subscriptionData?.subscriptionExpiresAt && (
              <p className="text-[10px] text-slate-400 mt-1">Expires: {new Date(subscriptionData.subscriptionExpiresAt).toLocaleDateString()}</p>
            )}
          </div>

          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400">Seller Lipa Number (Payouts)</span>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const numToSave = (lipaNumber || dbUser?.sellerProfile?.lipaNumber || '').trim();
              const nameToSave = (lipaAccountName || dbUser?.sellerProfile?.lipaAccountName || '').trim();
              if (!numToSave || !nameToSave) {
                showToast('Validation Error', 'Please enter both Lipa Number and Account Name.', 'error');
                return;
              }
              try {
                setSavingLipa(true);
                const token = await auth.currentUser?.getIdToken();
                const res = await fetchWithRetry('/api/seller/lipa', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                  body: JSON.stringify({ lipaNumber: numToSave, lipaAccountName: nameToSave })
                });
                if (res.ok) {
                  showToast('Lipa Details Saved', 'Lipa Number submitted to Admin for verification.', 'success');
                  refreshProfile();
                } else {
                  const errData = await res.json().catch(() => ({}));
                  showToast('Error', errData.error || 'Failed to save Lipa details', 'error');
                }
              } catch (err: any) {
                showToast('Error', err.message || 'Failed to save Lipa details', 'error');
              } finally {
                setSavingLipa(false);
              }
            }} className="space-y-2 mt-2">
              <input
                type="text"
                placeholder="Lipa Number (e.g. 5521098)"
                value={lipaNumber || dbUser?.sellerProfile?.lipaNumber || ''}
                onChange={(e) => setLipaNumber(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono text-amber-300 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Registered Account Name"
                value={lipaAccountName || dbUser?.sellerProfile?.lipaAccountName || ''}
                onChange={(e) => setLipaAccountName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-bold text-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={savingLipa}
                className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 font-bold text-xs rounded-lg transition text-white"
              >
                {savingLipa ? 'Saving...' : 'Save Lipa Details'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {showVerificationModal && (
        <PaymentModal
          isOpen={showVerificationModal}
          onClose={() => setShowVerificationModal(false)}
          purpose="SELLER_VERIFICATION"
          amountExpected={5000}
          title="Seller Verification Fee"
          subtitle="TZS 5,000 initial seller verification fee. Verified manually by Admin."
          onPaymentSuccess={() => {
            setShowVerificationModal(false);
            fetchData();
          }}
        />
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && (
        <PaymentModal
          isOpen={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          purpose="SELLER_SUBSCRIPTION"
          amountExpected={15000}
          title="Seller Monthly Subscription"
          subtitle="TZS 15,000 / month seller operating subscription."
          onPaymentSuccess={() => {
            setShowSubscriptionModal(false);
            fetchData();
          }}
        />
      )}

      <motion.div 
        initial="initial"
        animate="animate"
        variants={staggerContainer(0.1)}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
      >
        {[
          { label: t.sales, val: '0 TZS', icon: DollarSign, color: 'bg-green-600', text: 'text-light-green' },
          { label: t.orders, val: '0', icon: Package, color: 'bg-blue-600', text: 'text-light-green' },
          { label: t.activeProducts, val: activeProductCount.toString(), icon: List, color: 'bg-slate-900', text: 'text-light-green' },
          { label: t.revenue, val: '0 TZS', icon: TrendingUp, color: 'bg-purple-600', text: 'text-light-green' },
        ].map((stat, i) => (
          <motion.div 
            variants={fadeInUp}
            whileHover={{ y: -5, scale: 1.02 }}
            key={i} 
            className={`${stat.color} p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-light-green/10 relative overflow-hidden`}
          >
            <div className="absolute top-0 right-0 w-20 h-24 bg-light-green/10 -mr-6 -mt-6 rounded-full" />
            <stat.icon className={`w-8 h-8 ${stat.text} opacity-20 mb-4`} />
            <p className={`text-xs font-black uppercase tracking-widest ${stat.text} opacity-60 mb-1`}>{stat.label}</p>
            <p className={`text-2xl font-black ${stat.text}`}>{stat.val}</p>
          </motion.div>
        ))}
      </motion.div>

      <motion.div 
        initial="initial"
        animate="animate"
        variants={staggerContainer(0.1)}
        className="grid grid-cols-1 lg:grid-cols-3 gap-8"
      >
        <motion.div variants={fadeInUp} className="lg:col-span-2 bg-light-green p-8 rounded-[2.5rem] shadow-sm border border-light-green-border">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Active Products</h2>
            <button className="text-blue-600 font-bold hover:underline text-sm uppercase">View All</button>
          </div>
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map(i => <div key={i} className="h-20 bg-light-green animate-pulse rounded-2xl" />)}
            </div>
          ) : products.length === 0 ? (
            <motion.div variants={scaleIn} className="text-center py-24 bg-light-green rounded-3xl border-2 border-dashed border-light-green-border">
              <List className="w-16 h-16 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">{t.noProducts}</p>
            </motion.div>
          ) : (
            <motion.div variants={staggerContainer(0.05)} className="space-y-4">
              {products.map(p => (
                <motion.div 
                  variants={listItem}
                  key={p.id} 
                  className="flex items-center justify-between p-4 bg-light-green rounded-2xl border border-light-green-border group hover:border-blue-500/30 transition-all"
                >
                   <div className="flex items-center space-x-4">
                      <div className="relative">
                        <img 
                          src={p.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200'} 
                          className="w-12 h-12 rounded-xl object-cover" 
                          alt={p.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200';
                          }}
                        />
                        {p.videoUrl && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                            <Play className="w-4 h-4 text-white fill-white" />
                          </div>
                        )}
                      </div>
                      <div>
                         <p className="font-bold text-slate-900">{p.name}</p>
                         <div className="flex items-center space-x-2">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${p.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                               {p.status}
                            </span>
                            <span className="text-xs text-slate-400 font-bold">{Number(p.price).toLocaleString()} TZS</span>
                         </div>
                      </div>
                   </div>
                   <button 
                     onClick={() => handleOpenEditProduct(p)}
                     className="text-slate-400 hover:text-blue-600 font-bold text-sm cursor-pointer"
                   >
                     Manage
                   </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </motion.div>

        <motion.div variants={fadeInUp} className="bg-light-green p-8 rounded-[2.5rem] shadow-sm border border-light-green-border h-fit">
          <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center uppercase tracking-tight">
            <Store className="w-6 h-6 mr-3 text-blue-600" /> {t.shopProfile}
          </h2>
          <div className="space-y-6">
            <div className="aspect-video bg-light-green rounded-3xl flex items-center justify-center border-2 border-dashed border-light-green-border relative overflow-hidden group">
               {currentShop?.logoUrl || dbUser?.profile?.logoUrl ? (
                 <img 
                   src={currentShop?.logoUrl || dbUser?.profile?.logoUrl} 
                   className="object-cover w-full h-full" 
                   alt={currentShop?.name || 'Shop Logo'} 
                   onError={(e) => {
                     (e.target as HTMLElement).style.display = 'none';
                     const fallback = (e.target as HTMLElement).nextElementSibling;
                     if (fallback) (fallback as HTMLElement).classList.remove('hidden');
                   }}
                 />
               ) : null}
               <div className={`w-full h-full flex flex-col items-center justify-center p-4 ${currentShop?.logoUrl || dbUser?.profile?.logoUrl ? 'hidden' : ''}`}>
                 <Store className="w-12 h-12 text-slate-300 mb-1.5" />
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Logo Uploaded</span>
               </div>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Shop / Business Name</p>
              <p className="text-slate-900 font-black text-lg">{currentShop?.name || dbUser?.profile?.businessName || 'Duka Langu'}</p>
              {currentShop?.address && (
                <p className="text-xs text-slate-500 font-medium flex items-center mt-1">
                  <MapPin className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                  <span className="truncate">{currentShop.address}</span>
                </p>
              )}
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{t.verification}</p>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-tighter ${dbUser?.user?.verificationStatus === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {dbUser?.user?.verificationStatus === 'VERIFIED' ? <CheckCircle className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                {dbUser?.user?.verificationStatus}
              </span>
            </div>
            <motion.button 
              onClick={handleOpenEditShop}
              whileHover={buttonHover.hover}
              whileTap={buttonHover.tap}
              className="w-full py-4 border-2 border-light-green-border rounded-2xl font-black text-sm uppercase tracking-tight text-slate-700 hover:bg-light-green transition-all cursor-pointer"
            >
              {t.editShop}
            </motion.button>
          </div>
        </motion.div>

        <motion.div variants={fadeInUp} className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-blue-500/20 h-fit">
          <h2 className="text-xl font-black text-white mb-6 flex items-center uppercase tracking-tight">
            <Video className="w-5 h-5 mr-3 text-blue-400" /> Video Settings
          </h2>
          <div className="space-y-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-relaxed">
              Choose how your device handles video uploads. Processing happens locally on your phone or computer.
            </p>
            
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setVideoEncodingProfile('speed')}
                className={`p-4 rounded-2xl border-2 transition-all text-left group cursor-pointer ${
                  videoEncodingProfile === 'speed' 
                    ? 'border-blue-600 bg-blue-600/10' 
                    : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-black uppercase tracking-tight ${videoEncodingProfile === 'speed' ? 'text-blue-400' : 'text-slate-400'}`}>Fast Transfer</span>
                  {videoEncodingProfile === 'speed' && <CheckCircle className="w-4 h-4 text-blue-500" />}
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-tight">Optimized for speed and low data usage. Recommended for mobile networks.</p>
              </button>

              <button
                onClick={() => setVideoEncodingProfile('quality')}
                className={`p-4 rounded-2xl border-2 transition-all text-left group cursor-pointer ${
                  videoEncodingProfile === 'quality' 
                    ? 'border-emerald-600 bg-emerald-600/10' 
                    : 'border-slate-800 bg-slate-800/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-black uppercase tracking-tight ${videoEncodingProfile === 'quality' ? 'text-emerald-400' : 'text-slate-400'}`}>High Definition</span>
                  {videoEncodingProfile === 'quality' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                </div>
                <p className="text-[10px] text-slate-500 font-medium leading-tight">Better visual detail with slightly larger files and longer processing time.</p>
              </button>
            </div>
            
            <div className="flex items-center space-x-2 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
              <p className="text-[9px] text-blue-200/70 font-medium italic">
                Tip: Use "Fast Transfer" if you have limited internet data bundles (MBs).
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editProductModal && (
          <div className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setEditProductModal(null)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="bg-light-green w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90dvh] my-auto"
             >
                <div className="p-6 sm:p-8 border-b border-light-green-border flex items-center justify-between bg-blue-600 text-light-green shrink-0">
                   <h2 className="text-2xl font-black uppercase tracking-tight">Edit Product</h2>
                   <button onClick={() => setEditProductModal(null)} className="p-2 bg-light-green/20 rounded-xl hover:bg-light-green/30 transition-all cursor-pointer"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleUpdateProduct} className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-grow min-h-0">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.name}</label>
                         <input required type="text" value={editProductModal.name} onChange={e => setEditProductModal({...editProductModal, name: e.target.value})} className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.category}</label>
                         <select required value={editProductModal.categoryId} onChange={e => setEditProductModal({...editProductModal, categoryId: e.target.value})} className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm">
                            <option className="bg-slate-900 text-white" value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>)}
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.price}</label>
                         <input required type="number" value={editProductModal.price} onChange={e => setEditProductModal({...editProductModal, price: e.target.value})} className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.stock}</label>
                         <input required type="number" value={editProductModal.stock} onChange={e => setEditProductModal({...editProductModal, stock: e.target.value})} className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm" />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.desc}</label>
                      <textarea required rows={3} value={editProductModal.description} onChange={e => setEditProductModal({...editProductModal, description: e.target.value})} placeholder="Describe product details..." className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm resize-none" />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ImageUploadInput
                        label={t.image}
                        required
                        value={editProductModal.images[0]}
                        onChange={(url) => setEditProductModal({ ...editProductModal, images: [url] })}
                        aspectRatio="square"
                      />
                      <VideoUploadInput
                        value={editProductModal.videoUrl || ''}
                        metadata={{
                          videoStoragePath: editProductModal.videoStoragePath,
                          videoFileName: editProductModal.videoFileName,
                          videoFileType: editProductModal.videoFileType,
                          videoFileSize: editProductModal.videoFileSize,
                          videoUploadStatus: editProductModal.videoUploadStatus as any
                        }}
                        onChange={(meta) => setEditProductModal({ 
                          ...editProductModal, 
                          videoUrl: meta.videoUrl,
                          videoStoragePath: meta.videoStoragePath,
                          videoFileName: meta.videoFileName,
                          videoFileType: meta.videoFileType,
                          videoFileSize: meta.videoFileSize,
                          videoUploadStatus: meta.videoUploadStatus
                        })}
                        productId={editProductModal.id}
                        encodingProfile={videoEncodingProfile}
                      />
                   </div>
                   <div className="flex gap-4 pt-6">
                      <button type="button" onClick={() => handleDeleteProduct(editProductModal.id)} className="px-5 py-5 bg-red-500/10 text-red-600 rounded-2xl font-black uppercase tracking-tight hover:bg-red-500/20 transition-all cursor-pointer">Delete</button>
                      <button type="button" onClick={() => setEditProductModal(null)} className="flex-1 py-5 bg-light-green text-slate-600 rounded-2xl font-black uppercase tracking-tight hover:bg-light-green-border transition-all cursor-pointer">{t.cancel}</button>
                      <button disabled={isSubmitting} type="submit" className="flex-1 py-5 bg-blue-600 text-light-green rounded-2xl font-black uppercase tracking-tight shadow-xl shadow-blue-200 hover:bg-blue-700 flex items-center justify-center space-x-2 cursor-pointer">
                         {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Update Product</span>}
                      </button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Shop Modal */}
      <AnimatePresence>
        {showEditShopModal && (
          <div className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditShopModal(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="bg-light-green w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90dvh] my-auto"
             >
                <div className="p-6 sm:p-8 border-b border-light-green-border flex items-center justify-between bg-blue-600 text-light-green shrink-0">
                   <h2 className="text-2xl font-black uppercase tracking-tight">{t.editShop}</h2>
                   <button onClick={() => setShowEditShopModal(false)} className="p-2 bg-light-green/20 rounded-xl hover:bg-light-green/30 transition-all cursor-pointer"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleUpdateShop} className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-grow min-h-0">
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.shopName}</label>
                         <input required type="text" value={editShopData.name} onChange={e => setEditShopData({...editShopData, name: e.target.value})} placeholder="e.g. Mwanza Crafts" className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.shopDesc}</label>
                         <textarea required rows={3} value={editShopData.description} onChange={e => setEditShopData({...editShopData, description: e.target.value})} placeholder="Describe your shop..." className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm resize-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.shopAddress}</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 w-5 h-5 pointer-events-none" />
                          <input 
                            ref={editShopAutocompleteRef}
                            type="text" 
                            required
                            value={editShopData.address}
                            onChange={e => setEditShopData({...editShopData, address: e.target.value})}
                            placeholder="Search for your shop location..." 
                            className="w-full pl-12 pr-4 py-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <ImageUploadInput
                          label="Shop Logo / Picha ya Duka"
                          value={editShopData.logoUrl}
                          onChange={(url) => setEditShopData({ ...editShopData, logoUrl: url })}
                          aspectRatio="video"
                        />
                      </div>
                   </div>
                   <div className="flex gap-4 pt-6">
                      <button type="button" onClick={() => setShowEditShopModal(false)} className="flex-1 py-5 bg-light-green text-slate-600 rounded-2xl font-black uppercase tracking-tight hover:bg-light-green-border transition-all cursor-pointer">{t.cancel}</button>
                      <button disabled={isSubmitting || !editShopData.latitude} type="submit" className="flex-1 py-5 bg-blue-600 text-light-green rounded-2xl font-black uppercase tracking-tight shadow-xl shadow-blue-200 hover:bg-blue-700 flex items-center justify-center space-x-2 cursor-pointer">
                         {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>Save Changes</span>}
                      </button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shop Setup Modal */}
      <AnimatePresence>
        {showShopModal && (
          <div className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowShopModal(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="bg-light-green w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90dvh] my-auto"
             >
                <div className="p-6 sm:p-8 border-b border-light-green-border flex items-center justify-between bg-blue-600 text-light-green shrink-0">
                   <h2 className="text-2xl font-black uppercase tracking-tight">{t.setupShop}</h2>
                   <button onClick={() => setShowShopModal(false)} className="p-2 bg-light-green/20 rounded-xl hover:bg-light-green/30 transition-all cursor-pointer"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleCreateShop} className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-grow min-h-0">
                   <div className="space-y-6">
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.shopName}</label>
                         <input required type="text" value={shopData.name} onChange={e => setShopData({...shopData, name: e.target.value})} placeholder="e.g. Mwanza Crafts" className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.shopDesc}</label>
                         <textarea required rows={3} value={shopData.description} onChange={e => setShopData({...shopData, description: e.target.value})} placeholder="Describe your shop..." className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm resize-none" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.shopAddress}</label>
                        <div className="relative">
                          <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200 w-5 h-5 pointer-events-none" />
                          <input 
                            ref={shopAutocompleteRef}
                            type="text" 
                            required
                            placeholder="Search for your shop location..." 
                            className="w-full pl-12 pr-4 py-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <ImageUploadInput
                          label="Shop Logo / Picha ya Duka"
                          value={shopData.logoUrl}
                          onChange={(url) => setShopData({ ...shopData, logoUrl: url })}
                          aspectRatio="video"
                        />
                      </div>
                   </div>
                   <div className="flex gap-4 pt-6">
                      <button type="button" onClick={() => setShowShopModal(false)} className="flex-1 py-5 bg-light-green text-slate-600 rounded-2xl font-black uppercase tracking-tight hover:bg-light-green-border transition-all">{t.cancel}</button>
                      <button disabled={isSubmitting || !shopData.latitude} type="submit" className="flex-1 py-5 bg-blue-600 text-light-green rounded-2xl font-black uppercase tracking-tight shadow-xl shadow-blue-200 hover:bg-blue-700 flex items-center justify-center space-x-2">
                         {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{t.createShop}</span>}
                      </button>
                   </div>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-md" />
             <motion.div 
               initial={{ scale: 0.95, opacity: 0, y: 20 }} 
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.95, opacity: 0, y: 20 }}
               className="bg-light-green w-full max-w-2xl rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col max-h-[90dvh] my-auto"
             >
                <div className="p-6 sm:p-8 border-b border-light-green-border flex items-center justify-between bg-blue-600 text-light-green shrink-0">
                   <h2 className="text-2xl font-black uppercase tracking-tight">{t.addProduct}</h2>
                   <button onClick={() => setShowAddModal(false)} className="p-2 bg-light-green/20 rounded-xl hover:bg-light-green/30 transition-all"><X className="w-6 h-6" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 sm:p-8 overflow-y-auto space-y-6 flex-grow min-h-0">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.name}</label>
                         <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.category}</label>
                         <select required value={formData.categoryId} onChange={e => setFormData({...formData, categoryId: e.target.value})} className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm">
                            <option className="bg-slate-900 text-white" value="">Select Category</option>
                            {categories.map(c => <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>)}
                         </select>
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.price}</label>
                         <input required type="number" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm" />
                      </div>
                      <div className="space-y-2">
                         <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.stock}</label>
                         <input required type="number" value={formData.stock} onChange={e => setFormData({...formData, stock: e.target.value})} className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm" />
                      </div>
                   </div>
                   <div className="space-y-2">
                      <label className="text-xs font-black text-blue-900 uppercase tracking-widest ml-1">{t.desc}</label>
                      <textarea required rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Describe product details..." className="w-full p-4 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm shadow-sm resize-none" />
                   </div>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <ImageUploadInput
                        label={t.image}
                        required
                        value={formData.images[0]}
                        onChange={(url) => setFormData({ ...formData, images: [url] })}
                        aspectRatio="square"
                      />
                      <VideoUploadInput
                        value={formData.videoUrl || ''}
                        metadata={{
                          videoStoragePath: formData.videoStoragePath,
                          videoFileName: formData.videoFileName,
                          videoFileType: formData.videoFileType,
                          videoFileSize: formData.videoFileSize,
                          videoUploadStatus: formData.videoUploadStatus as any
                        }}
                        onChange={(meta) => setFormData({ 
                          ...formData, 
                          videoUrl: meta.videoUrl,
                          videoStoragePath: meta.videoStoragePath || '',
                          videoFileName: meta.videoFileName || '',
                          videoFileType: meta.videoFileType || '',
                          videoFileSize: meta.videoFileSize || 0,
                          videoUploadStatus: meta.videoUploadStatus || 'COMPLETED'
                        })}
                        productId="new"
                        encodingProfile={videoEncodingProfile}
                      />
                   </div>
                   <div className="flex gap-4 pt-6">
                      <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-5 bg-light-green text-slate-600 rounded-2xl font-black uppercase tracking-tight hover:bg-light-green-border transition-all">{t.cancel}</button>
                      <button disabled={isSubmitting || !formData.images[0]} type="submit" className="flex-1 py-5 bg-blue-600 text-light-green rounded-2xl font-black uppercase tracking-tight shadow-xl shadow-blue-200 hover:bg-blue-700 flex items-center justify-center space-x-2">
                         {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <span>{t.submit}</span>}
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
