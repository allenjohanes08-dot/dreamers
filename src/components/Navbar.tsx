// src/components/Navbar.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.tsx';
import { translations } from '../lib/translations.ts';
import { useShoppingAI } from '../context/ShoppingAIContext.tsx';
import { useCart } from '../context/CartContext.tsx';
import { useNotifications } from '../context/NotificationContext.tsx';
import {
  ShoppingBag,
  User,
  LogOut,
  LayoutDashboard,
  ShoppingCart,
  Truck,
  Search,
  Store,
  Home,
  Sparkles,
  Gift,
  ClipboardList,
  CheckCircle2,
  Clock,
  XCircle,
  X,
  MapPin,
  Calendar,
  Check,
  RefreshCw
} from 'lucide-react';
import InstallPWAButton from './InstallPWAButton.tsx';
import { auth, db as firestoreDb } from '../lib/firebase.ts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { fetchWithRetry } from '../lib/api.ts';

import { motion, AnimatePresence } from 'motion/react';
import { EventInvitationDashboardPopup } from './EventInvitationDashboardPopup.tsx';
import { EventInviteModal } from './EventInviteModal.tsx';
import { InviterEventDashboardModal } from './InviterEventDashboardModal.tsx';
import { EventInvitationCard } from './EventInvitationCard.tsx';
import { PaymentModal } from './PaymentModal.tsx';

export default function Navbar() {
  const { user, dbUser, logout, language, updateLanguage } = useAuth();
  const { openShoppingAI, setIsOpen: setShoppingAIOpen } = useShoppingAI();
  const { cartCount, openCart, closeCart } = useCart();
  const { showRegistry, setShowRegistry, showToast, isOpen: isNotificationOpen, setIsOpen: setNotificationOpen } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const closeAllOverlays = () => {
    setShowRegistry(false);
    setShowGiftCards(false);
    setShowCustomerService(false);
    closeCart();
    if (typeof setNotificationOpen === 'function') setNotificationOpen(false);
    if (typeof setShoppingAIOpen === 'function') setShoppingAIOpen(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getDashboardLink = () => {
    if (!dbUser?.user?.role) return '/register';
    switch (dbUser.user.role) {
      case 'ADMIN': return '/admin';
      case 'SELLER': return '/seller';
      case 'LOGISTICS': return '/logistics';
      case 'CUSTOMER': return '/customer';
      default: return '/';
    }
  };

  const t = translations[language].navbar;
  const commonT = translations[language].common;

  // Don't show complex navbar on some pages
  const isAuthPage = ['/login', '/register'].includes(location.pathname);

  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerService, setShowCustomerService] = useState(false);
  const [showGiftCards, setShowGiftCards] = useState(false);

  // Gift Card State
  const [giftCardTab, setGiftCardTab] = useState<'redeem' | 'request' | 'my'>('request');
  const [giftCardCode, setGiftCardCode] = useState('');
  const [giftCardAmount, setGiftCardAmount] = useState('25000');
  const [giftRecipientSearch, setGiftRecipientSearch] = useState('');
  const [giftRecipientResults, setGiftRecipientResults] = useState<any[]>([]);
  const [giftRecipientSearching, setGiftRecipientSearching] = useState(false);
  const [selectedGiftRecipient, setSelectedGiftRecipient] = useState<any | null>(null);
  const [giftPersonalMessage, setGiftPersonalMessage] = useState('');
  const [giftCardMsg, setGiftCardMsg] = useState('');
  const [giftCardError, setGiftCardError] = useState('');
  const [submittingGift, setSubmittingGift] = useState(false);
  const [myGiftCards, setMyGiftCards] = useState<any[]>([]);

  // Registry State
  const [registryTab, setRegistryTab] = useState<'create' | 'my' | 'invitations'>('create');
  const [registryTitle, setRegistryTitle] = useState('');
  const [registryCategory, setRegistryCategory] = useState('WEDDING');
  const [registryDate, setRegistryDate] = useState('');
  const [registryStartTime, setRegistryStartTime] = useState('');
  const [registryEndTime, setRegistryEndTime] = useState('');
  const [registryVenueName, setRegistryVenueName] = useState('');
  const [registryInstructions, setRegistryInstructions] = useState('');
  const [registryAddress, setRegistryAddress] = useState('');
  const [registryDesc, setRegistryDesc] = useState('');
  const [registryExpectedGuests, setRegistryExpectedGuests] = useState('50');
  const [registrySuccess, setRegistrySuccess] = useState(false);
  const [registryError, setRegistryError] = useState('');
  const [submittingReg, setSubmittingReg] = useState(false);
  const [myRegistries, setMyRegistries] = useState<any[]>([]);

  // Payment Modal state for Events
  const [activePaymentModal, setActivePaymentModal] = useState<{
    isOpen: boolean;
    eventId?: string;
    amount: number;
    title: string;
  }>({ isOpen: false, amount: 0, title: '' });

  // Event Invitation States
  const [myInvitations, setMyInvitations] = useState<any[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [activeInviteEvent, setActiveInviteEvent] = useState<any | null>(null);
  const [activeDashboardEvent, setActiveDashboardEvent] = useState<any | null>(null);
  const [activeViewInvitation, setActiveViewInvitation] = useState<any | null>(null);

  // Fetch my invitations
  const fetchMyInvitations = async () => {
    if (!auth.currentUser) return;
    try {
      setLoadingInvitations(true);
      const token = await auth.currentUser.getIdToken();
      const res = await fetchWithRetry('/api/events/my-invitations', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMyInvitations(await res.json().catch(() => []));
      }
    } catch (e) {
      console.error('Error fetching invitations:', e);
    } finally {
      setLoadingInvitations(false);
    }
  };

  useEffect(() => {
    if (showRegistry && user && registryTab === 'invitations') {
      fetchMyInvitations();
    }
  }, [showRegistry, user, registryTab]);

  // Fetch my gift cards when modal opens or user logs in
  const fetchMyGiftCards = async () => {
    if (!auth.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetchWithRetry('/api/gift-cards/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMyGiftCards(await res.json().catch(() => []));
    } catch (e) {}
  };

  // Fetch my registries when modal opens
  const fetchMyRegistries = async () => {
    if (!auth.currentUser) return;
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetchWithRetry('/api/registry/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setMyRegistries(await res.json().catch(() => []));
      } else {
        console.error('Failed to fetch registries:', res.statusText);
        setRegistryError('Failed to load events.');
      }
    } catch (e) {
      console.error('Error fetching registries:', e);
      setRegistryError('Error loading events.');
    }
  };

  useEffect(() => {
    if (showGiftCards && user) {
      fetchMyGiftCards();
    }
  }, [showGiftCards, user]);

  useEffect(() => {
    if (showRegistry && user) {
      fetchMyRegistries();
    }
  }, [showRegistry, user]);

  // Real-time Firestore sync for user's gift cards & registries so any Admin approval/rejection updates instantly
  useEffect(() => {
    if (!user) return;

    const qGift = query(collection(firestoreDb, 'giftCardRequests'), where('userId', '==', user.uid));
    const unsubGift = onSnapshot(qGift, () => {
      fetchMyGiftCards();
    }, () => {});

    const qReg = query(collection(firestoreDb, 'registryRequests'), where('userId', '==', user.uid));
    const unsubReg = onSnapshot(qReg, () => {
      fetchMyRegistries();
    }, () => {});

    return () => {
      unsubGift();
      unsubReg();
    };
  }, [user]);

  const searchGiftRecipients = async (queryStr: string) => {
    if (!auth.currentUser) return;
    try {
      setGiftRecipientSearching(true);
      const token = await auth.currentUser.getIdToken();
      const res = await fetchWithRetry(`/api/gift-cards/search-recipients?q=${encodeURIComponent(queryStr.trim())}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setGiftRecipientResults(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        console.error('Gift recipient search error:', err);
      }
    } finally {
      setGiftRecipientSearching(false);
    }
  };

  useEffect(() => {
    if (showGiftCards && giftCardTab === 'request' && user) {
      const timer = setTimeout(() => {
        searchGiftRecipients(giftRecipientSearch);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [showGiftCards, giftCardTab, giftRecipientSearch, user]);

  const handleRequestGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    setSubmittingGift(true);
    setGiftCardError('');
    setGiftCardMsg('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/gift-cards/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          amount: giftCardAmount,
          recipientUserId: selectedGiftRecipient?.id || undefined,
          personalMessage: giftPersonalMessage.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGiftCardMsg(`Gift card request submitted! Code ${data.giftCard?.code} (${Number(data.giftCard?.amount).toLocaleString()} TZS) is PENDING Admin verification.`);
        fetchMyGiftCards();
        setSelectedGiftRecipient(null);
        setGiftRecipientSearch('');
        setGiftPersonalMessage('');
      } else {
        setGiftCardError(data.error || 'Failed to submit gift card request');
      }
    } catch (err: any) {
      setGiftCardError(err.message || 'Error submitting request');
    } finally {
      setSubmittingGift(false);
    }
  };

  const handleRedeemGiftCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    if (!giftCardCode.trim()) {
      setGiftCardError('Please enter a gift card code');
      return;
    }
    setSubmittingGift(true);
    setGiftCardError('');
    setGiftCardMsg('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/gift-cards/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: giftCardCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setGiftCardMsg(data.message || 'Gift card redeemed successfully!');
        setGiftCardCode('');
        fetchMyGiftCards();
      } else {
        setGiftCardError(data.error || 'Redemption failed');
      }
    } catch (err: any) {
      setGiftCardError(err.message || 'Error redeeming code');
    } finally {
      setSubmittingGift(false);
    }
  };

  const handleCreateRegistry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login');
      return;
    }
    setSubmittingReg(true);
    setRegistryError('');
    setRegistrySuccess(false);
    try {
      const token = await auth.currentUser?.getIdToken();
      const numGuests = Math.max(1, parseInt(registryExpectedGuests, 10) || 50);
      const res = await fetchWithRetry('/api/registry/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: registryTitle,
          category: registryCategory,
          eventDate: registryDate,
          startTime: registryStartTime,
          endTime: registryEndTime,
          venueName: registryVenueName,
          deliveryAddress: registryAddress,
          eventInstructions: registryInstructions,
          description: registryDesc,
          expectedGuests: numGuests,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setRegistrySuccess(true);
        fetchMyRegistries();
        const eventId = data.event?.id || data.saved?.id;
        const totalCost = numGuests * 500;
        
        showToast('Event Created', `🎉 Event created! Payment Request: ${totalCost.toLocaleString()} TZS`, 'success');
        
        const titleCopy = registryTitle;
        setRegistryTitle('');
        setRegistryAddress('');
        setRegistryStartTime('');
        setRegistryEndTime('');
        setRegistryVenueName('');
        setRegistryInstructions('');
        setRegistryDesc('');
        setRegistryExpectedGuests('50');

        // Trigger payment request modal automatically & close creation modal
        setShowRegistry(false);
        setActivePaymentModal({
          isOpen: true,
          eventId: String(eventId || ''),
          amount: totalCost,
          title: `Payment Request: ${titleCopy || 'Wedding & Event'}`
        });
      } else {
        setRegistryError(data.error || 'Failed to submit registry request');
      }
    } catch (err: any) {
      setRegistryError(err.message || 'Error creating registry');
    } finally {
      setSubmittingReg(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/marketplace?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/marketplace');
    }
  };

  return (
    <>
      {/* Primary Amazon-Style Navigation Header */}
      <motion.nav 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-[#131921] sticky top-0 z-50 py-2.5 px-4 flex flex-col md:flex-row items-center justify-between shadow-md text-white select-none"
      >
        <div className="max-w-8xl mx-auto w-full flex flex-col md:flex-row items-center gap-3">
          
          {/* Brand Logo & Deliver Pin */}
          <div className="flex items-center justify-between w-full md:w-auto gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Link to="/" className="flex flex-col relative group px-2 py-1.5 border border-transparent hover:border-white rounded-sm transition-all shrink-0">
                <div className="flex items-baseline space-x-0.5">
                  <span className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase leading-none">Dreamers</span>
                  <span className="text-[10px] text-[#febd69] font-black uppercase">.tz</span>
                </div>
                {/* Amazon Signature Gold Smile Arrow */}
                <svg className="w-24 h-2.5 text-[#febd69] -mt-0.5 fill-current" viewBox="0 0 100 12" xmlns="http://www.w3.org/2000/svg">
                  <path d="M 2 2 C 30 11, 70 11, 98 2" stroke="currentColor" strokeWidth="2.5" fill="transparent" strokeLinecap="round" />
                  <path d="M 95 0 L 99 3 L 95 6 Z" />
                </svg>
              </Link>
            </motion.div>

            {/* Deliver To Location Pin */}
            <motion.div 
              whileHover={{ scale: 1.02 }}
              className="hidden xs:flex items-center px-2 py-1.5 border border-transparent hover:border-white rounded-sm cursor-pointer transition-all leading-tight"
            >
              <span className="text-white mr-1.5 shrink-0">
                <svg className="w-5 h-5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <div className="flex flex-col">
                <span className="text-[11px] text-gray-400 font-bold">Deliver to</span>
                <span className="text-xs font-black text-white">Tanzania</span>
              </div>
            </motion.div>
          </div>

          {/* Amazon-Style Gold Search Bar */}
          {!isAuthPage && (
            <motion.form 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              onSubmit={handleSearchSubmit} 
              className="flex-1 w-full max-w-3xl flex items-center bg-white rounded-md overflow-hidden focus-within:ring-3 focus-within:ring-[#f3a847] shadow-sm h-10"
            >
              <div className="bg-gray-100 text-slate-700 text-xs px-3 border-r border-gray-300 h-full flex items-center font-bold select-none cursor-pointer hover:bg-gray-200">
                All
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Dreamers Tanzania..."
                className="flex-1 w-full bg-white py-2 px-3 text-slate-900 font-semibold text-sm outline-none placeholder:text-gray-400 border-none h-full"
              />
              <motion.button
                whileHover={{ backgroundColor: '#f3a847' }}
                whileTap={{ scale: 0.95 }}
                type="submit"
                className="bg-[#febd69] text-slate-900 h-full w-12 flex items-center justify-center cursor-pointer transition-all border-none"
                aria-label="Search"
              >
                <Search className="w-5 h-5 stroke-[2.5]" />
              </motion.button>
            </motion.form>
          )}

          {/* Language, Account & Orders, Cart */}
          <div className="flex items-center justify-between w-full md:w-auto gap-4 ml-auto">
            {/* Install PWA Button */}
            <InstallPWAButton variant="navbar" />

            {/* Language Selector */}
            <div className="flex items-center gap-1 px-2 py-1.5 border border-transparent hover:border-white rounded-sm cursor-pointer transition-all font-black text-xs">
              <span className="text-gray-300 font-bold">TZ</span>
              <motion.button whileHover={{ color: '#febd69' }} onClick={() => updateLanguage('en')} className={`${language === 'en' ? 'text-[#febd69]' : 'text-gray-400'}`}>EN</motion.button>
              <span className="text-gray-600">/</span>
              <motion.button whileHover={{ color: '#febd69' }} onClick={() => updateLanguage('sw')} className={`${language === 'sw' ? 'text-[#febd69]' : 'text-gray-400'}`}>SW</motion.button>
            </div>

            {/* Account & Lists */}
            <motion.div whileHover={{ scale: 1.02 }}>
              <Link to={user ? getDashboardLink() : "/login"} className="flex flex-col px-2 py-1.5 border border-transparent hover:border-white rounded-sm cursor-pointer transition-all leading-tight text-left">
                <span className="text-[11px] text-gray-400 font-bold truncate max-w-[100px]">
                  {user ? `Hello, ${dbUser?.user?.fullName?.split(' ')[0] || 'User'}` : 'Hello, Sign in'}
                </span>
                <span className="text-xs font-black text-white flex items-center">
                  <span>Account & Lists</span>
                  <svg className="w-2.5 h-2.5 ml-1 text-gray-400" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 16.5l-6-6h12z" />
                  </svg>
                </span>
              </Link>
            </motion.div>

            {/* Returns & Orders */}
            <motion.div whileHover={{ scale: 1.02 }}>
              <Link to={user ? "/customer/orders" : "/login"} className="hidden sm:flex flex-col px-2 py-1.5 border border-transparent hover:border-white rounded-sm cursor-pointer transition-all leading-tight text-left">
                <span className="text-[11px] text-gray-400 font-bold">Returns</span>
                <span className="text-xs font-black text-white">& Orders</span>
              </Link>
            </motion.div>

            {/* Shopping Cart */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { closeAllOverlays(); openCart(); }}
              aria-label="Open shopping cart"
              className="flex items-end px-2 py-1.5 border border-transparent hover:border-white rounded-sm cursor-pointer transition-all relative"
            >
              <div className="relative flex items-center mr-1">
                <ShoppingCart className="w-7 h-7 text-white" />
                {/* Amazon sit-on-top yellow items count indicator */}
                <motion.span 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  key={cartCount}
                  className="absolute -top-1 left-[11px] bg-[#ffd814] text-[#131921] text-xs font-black w-5 h-5 rounded-full flex items-center justify-center shadow-xs"
                >
                  {cartCount}
                </motion.span>
              </div>
              <span className="text-xs font-black text-white hidden xs:inline mt-2.5">Cart</span>
            </motion.button>

            {/* Logout (if authenticated) */}
            {user && (
              <motion.button 
                whileHover={{ color: '#f87171', scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleLogout} 
                className="p-2 text-gray-400 transition-colors hidden md:block" title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </motion.button>
            )}
          </div>

        </div>
      </motion.nav>

      {/* Secondary Amazon-Style Sub-Navigation Bar */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-[#232f3e] text-white text-xs px-4 py-2 flex items-center justify-between border-t border-[#19222d] shadow-sm select-none"
      >
        <div className="max-w-8xl mx-auto w-full flex items-center justify-between">
          <div className="flex items-center space-x-4 font-bold overflow-x-auto no-scrollbar py-0.5">
            <motion.div whileHover={{ scale: 1.02 }}>
              <Link to="/marketplace" className="flex items-center space-x-1 hover:text-[#febd69] whitespace-nowrap px-2 py-1 border border-transparent hover:border-white rounded-sm transition-all">
                <svg className="w-4 h-4 mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <span>All</span>
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.02 }}>
              <Link to="/marketplace" className="hover:text-[#febd69] whitespace-nowrap px-2 py-1 border border-transparent hover:border-white rounded-sm transition-all">{t.marketplace}</Link>
            </motion.div>
            <span className="text-gray-500">|</span>
            <motion.button type="button" whileHover={{ textDecoration: 'underline' }} onClick={() => navigate('/marketplace?deal=true')} className="hover:text-[#febd69] whitespace-nowrap cursor-pointer px-2 py-1 border border-transparent hover:border-white rounded-sm transition-all bg-transparent">{t.todaysDeals}</motion.button>
            <motion.button type="button" whileHover={{ textDecoration: 'underline' }} onClick={() => { closeAllOverlays(); setShowCustomerService(true); }} className="hover:text-[#febd69] whitespace-nowrap cursor-pointer px-2 py-1 border border-transparent hover:border-white rounded-sm transition-all bg-transparent">{t.customerService}</motion.button>
            <motion.button type="button" whileHover={{ textDecoration: 'underline' }} onClick={() => { closeAllOverlays(); setShowGiftCards(true); }} className="hover:text-[#febd69] whitespace-nowrap cursor-pointer px-2 py-1 border border-transparent hover:border-white rounded-sm transition-all bg-transparent">{t.giftCards}</motion.button>
            <motion.button type="button" whileHover={{ textDecoration: 'underline' }} onClick={() => { closeAllOverlays(); setShowRegistry(true); }} className="hover:text-[#febd69] whitespace-nowrap cursor-pointer px-2 py-1 border border-transparent hover:border-white rounded-sm transition-all bg-transparent">{t.registry}</motion.button>
            <motion.div whileHover={{ scale: 1.02 }}>
              <Link to="/register" className="hover:text-[#febd69] whitespace-nowrap px-2 py-1 border border-transparent hover:border-white rounded-sm transition-all">{t.sellOnDreamers}</Link>
            </motion.div>
          </div>

          {/* Interactive Shopping AI trigger block in subnav */}
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 15px rgba(255,153,0,0.3)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { closeAllOverlays(); openShoppingAI(); }}
            className="flex items-center space-x-1 px-3 py-1 bg-gradient-to-r from-amber-500 to-[#ff9900] text-slate-900 rounded-md shadow-md text-[11px] font-black shrink-0 cursor-pointer border-none"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>{t.shoppingAI}</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Mobile Bottom Navigation Bar - Visible on all small/mobile devices */}
      {!isAuthPage && (
        <motion.div 
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#131921] border-t border-gray-800 z-[100] pb-safe shadow-2xl"
        >
          <div className="flex justify-around items-center h-16 text-gray-300">
            <Link to="/" className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${location.pathname === '/' ? 'text-[#febd69]' : 'hover:text-white'}`}>
              <Home className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase">Home</span>
            </Link>
            <Link to="/marketplace" className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${location.pathname === '/marketplace' ? 'text-[#febd69]' : 'hover:text-white'}`}>
              <Search className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase">Shop</span>
            </Link>
            <button type="button" onClick={() => { closeAllOverlays(); openCart(); }} className="flex flex-col items-center justify-center w-full h-full space-y-1 text-gray-300 hover:text-white relative cursor-pointer">
              <div className="relative">
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-[#ffd814] text-slate-900 text-[9px] font-black px-1 rounded-full min-w-[14px] text-center">
                    {cartCount}
                  </span>
                )}
              </div>
              <span className="text-[9px] font-black uppercase">Cart</span>
            </button>
            <Link to={user ? getDashboardLink() : "/login"} className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${location.pathname.includes('/dashboard') || location.pathname.includes('/console') || location.pathname.includes('/seller') || location.pathname.includes('/customer') || location.pathname.includes('/admin') || location.pathname === '/login' ? 'text-[#febd69]' : 'hover:text-white'}`}>
              <User className="w-5 h-5" />
              <span className="text-[9px] font-black uppercase">{user ? 'Account' : 'Sign In'}</span>
            </Link>
            {user ? (
              <motion.button type="button" whileTap={{ scale: 0.9 }} onClick={handleLogout} className="flex flex-col items-center justify-center w-full h-full space-y-1 text-gray-400 hover:text-red-400 cursor-pointer">
                <LogOut className="w-5 h-5" />
                <span className="text-[9px] font-black uppercase">Logout</span>
              </motion.button>
            ) : (
              <button type="button" onClick={() => openShoppingAI()} className="flex flex-col items-center justify-center w-full h-full space-y-1 text-[#febd69] hover:text-amber-300 cursor-pointer">
                <Sparkles className="w-5 h-5" />
                <span className="text-[9px] font-black uppercase">Ask AI</span>
              </button>
            )}
          </div>
        </motion.div>
      )}

      {/* Customer Service Modal */}
      <AnimatePresence>
        {showCustomerService && (
          <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCustomerService(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#131921] border border-gray-800 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full relative z-10 my-auto max-h-[90dvh] overflow-y-auto">
              <h3 className="text-xl font-black uppercase text-[#febd69] mb-4">Dreamers Customer Service</h3>
              <p className="text-sm text-gray-300 mb-6">Need help with your order, payment, or delivery in Tanzania? We are here 24/7.</p>
              <div className="space-y-4 mb-6">
                <a href="https://wa.me/255714202298" target="_blank" rel="noopener noreferrer" className="block p-4 bg-[#232f3e] hover:bg-[#1f2a36] transition-colors rounded-2xl border border-gray-700 cursor-pointer">
                  <p className="text-xs text-gray-400 font-bold uppercase">WhatsApp Support</p>
                  <p className="text-sm font-black text-[#febd69] hover:underline">+255 714 202 298</p>
                </a>
                <div className="p-4 bg-[#232f3e] rounded-2xl border border-gray-700">
                  <p className="text-xs text-gray-400 font-bold uppercase">Support Email</p>
                  <p className="text-sm font-black text-white">support@dreamers.tz</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setShowCustomerService(false); openShoppingAI('I need customer support with my order'); }} className="flex-1 py-3.5 bg-[#febd69] text-slate-900 rounded-2xl font-black text-xs uppercase cursor-pointer">Ask Shopping AI</button>
                <button onClick={() => setShowCustomerService(false)} className="flex-1 py-3.5 bg-gray-800 text-white rounded-2xl font-black text-xs uppercase cursor-pointer">Close</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Gift Cards Modal */}
      <AnimatePresence>
        {showGiftCards && (
          <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowGiftCards(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#131921] border border-gray-800 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-2xl max-w-lg w-full relative z-10 max-h-[90dvh] overflow-y-auto space-y-6 my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <div className="flex items-center space-x-2">
                  <Gift className="w-5 h-5 text-[#febd69]" />
                  <h3 className="text-xl font-black uppercase text-[#febd69]">Dreamers Gift Cards</h3>
                </div>
                <button onClick={() => setShowGiftCards(false)} className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex bg-[#232f3e] p-1 rounded-2xl border border-gray-700">
                <button
                  onClick={() => { setGiftCardTab('request'); setGiftCardMsg(''); setGiftCardError(''); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    giftCardTab === 'request' ? 'bg-[#febd69] text-slate-900 shadow-sm' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Request Card
                </button>
                <button
                  onClick={() => { setGiftCardTab('redeem'); setGiftCardMsg(''); setGiftCardError(''); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    giftCardTab === 'redeem' ? 'bg-[#febd69] text-slate-900 shadow-sm' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Redeem Code
                </button>
                <button
                  onClick={() => { setGiftCardTab('my'); fetchMyGiftCards(); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                    giftCardTab === 'my' ? 'bg-[#febd69] text-slate-900 shadow-sm' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  My Cards ({myGiftCards.length})
                </button>
              </div>

              {giftCardMsg && (
                <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-2xl text-xs font-bold flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{giftCardMsg}</span>
                </div>
              )}

              {giftCardError && (
                <div className="p-4 bg-red-950/80 border border-red-500/50 text-red-200 rounded-2xl text-xs font-bold flex items-start space-x-2">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <span>{giftCardError}</span>
                </div>
              )}

              {/* TAB 1: REQUEST CARD */}
              {giftCardTab === 'request' && (
                <form onSubmit={handleRequestGiftCard} className="space-y-4">
                  <p className="text-xs text-gray-300">
                    Request a gift card for shopping on Dreamers Tanzania. All gift card requests are reviewed and activated by Admin.
                  </p>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1.5">
                      Card Value (TZS)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {['10000', '25000', '50000', '100000', '250000', '500000'].map((amt) => (
                        <button
                          type="button"
                          key={amt}
                          onClick={() => setGiftCardAmount(amt)}
                          className={`py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            giftCardAmount === amt
                              ? 'bg-[#febd69] text-slate-900 border-[#febd69]'
                              : 'bg-[#232f3e] text-white border-gray-700 hover:border-gray-500'
                          }`}
                        >
                          {Number(amt).toLocaleString()} TZS
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Recipient User Search & Selection by Full Name and Dreamers ID */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1.5 flex items-center justify-between">
                      <span>Recipient (Registered Dreamers User)</span>
                      {selectedGiftRecipient && (
                        <span className="text-[#febd69] font-bold text-[10px]">Recipient Selected ✓</span>
                      )}
                    </label>

                    {selectedGiftRecipient ? (
                      <div className="p-3.5 bg-[#febd69]/15 border border-[#febd69]/50 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center space-x-3 min-w-0 pr-2">
                          <div className="w-8 h-8 rounded-full bg-[#febd69] text-slate-900 font-black text-xs flex items-center justify-center shrink-0">
                            {selectedGiftRecipient.fullName ? selectedGiftRecipient.fullName[0].toUpperCase() : 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-white truncate">{selectedGiftRecipient.fullName}</div>
                            <div className="text-[10px] text-[#febd69] font-mono font-bold">Dreamers ID: {selectedGiftRecipient.dreamersId}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedGiftRecipient(null)}
                          className="px-2.5 py-1 text-[10px] font-bold text-gray-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-gray-600 transition cursor-pointer"
                        >
                          Change Recipient
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Search input field */}
                        <div className="relative">
                          <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search recipient by Full Name or Dreamers ID (e.g. DRM-4821)..."
                            value={giftRecipientSearch}
                            onChange={(e) => setGiftRecipientSearch(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 bg-[#232f3e] border border-gray-700 text-white placeholder:text-gray-500 rounded-2xl text-xs font-bold outline-none focus:border-[#febd69]"
                          />
                          {giftRecipientSearch && (
                            <button
                              type="button"
                              onClick={() => setGiftRecipientSearch('')}
                              className="absolute right-3 top-2.5 text-gray-400 hover:text-white cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {giftRecipientSearching && (
                          <div className="text-[11px] text-[#febd69] font-bold flex items-center space-x-1.5 animate-pulse pl-1">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Searching Dreamers users...</span>
                          </div>
                        )}

                        {/* Search results displayed directly below the search field */}
                        <div className="bg-[#232f3e] border border-gray-700 rounded-2xl p-2 max-h-48 overflow-y-auto space-y-1.5 shadow-xl divide-y divide-gray-800/40">
                          {giftRecipientResults.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-400">
                              {giftRecipientSearch ? `No registered user found matching "${giftRecipientSearch}"` : 'Type a name or Dreamers ID to search'}
                            </div>
                          ) : (
                            giftRecipientResults.map((u) => (
                              <div
                                key={u.id}
                                className="p-2 rounded-xl flex items-center justify-between hover:bg-slate-700/80 transition cursor-pointer"
                                onClick={() => {
                                  setSelectedGiftRecipient(u);
                                  setGiftRecipientSearch('');
                                }}
                              >
                                <div className="flex items-center space-x-3 min-w-0 pr-2">
                                  <div className="w-8 h-8 rounded-full bg-blue-600/30 border border-blue-400 text-blue-300 flex items-center justify-center text-xs font-black shrink-0">
                                    {u.fullName ? u.fullName[0].toUpperCase() : 'U'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-xs text-white truncate">{u.fullName}</div>
                                    <div className="text-[10px] text-[#febd69] font-mono font-bold">Dreamers ID: {u.dreamersId}</div>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedGiftRecipient(u);
                                    setGiftRecipientSearch('');
                                  }}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-[#febd69] hover:text-slate-900 border border-gray-600 text-slate-200 text-[11px] font-bold rounded-xl transition shrink-0 cursor-pointer"
                                >
                                  Select
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                      Personal Message / Note (Optional)
                    </label>
                    <textarea
                      placeholder="e.g. Happy Birthday! Enjoy shopping on Dreamers Tanzania."
                      value={giftPersonalMessage}
                      onChange={(e) => setGiftPersonalMessage(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-[#232f3e] border border-gray-700 text-white placeholder:text-gray-500 rounded-2xl font-bold text-xs outline-none focus:border-[#febd69]"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingGift}
                    className="w-full py-3.5 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                  >
                    <Gift className="w-4 h-4" />
                    <span>{submittingGift ? 'Submitting to Admin...' : 'Submit Gift Card Request'}</span>
                  </button>
                </form>
              )}

              {/* TAB 2: REDEEM CODE */}
              {giftCardTab === 'redeem' && (
                <form onSubmit={handleRedeemGiftCard} className="space-y-4">
                  <p className="text-xs text-gray-300">
                    Enter your approved Dreamers Gift Card Code to redeem the balance to your account.
                  </p>
                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                      Gift Card Code
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. DRM-GC-AB12CD"
                      value={giftCardCode}
                      onChange={(e) => setGiftCardCode(e.target.value)}
                      className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl font-mono font-black text-sm uppercase outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingGift}
                    className="w-full py-3.5 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{submittingGift ? 'Verifying...' : 'Redeem Gift Card'}</span>
                  </button>
                </form>
              )}

              {/* TAB 3: MY GIFT CARDS */}
              {giftCardTab === 'my' && (
                <div className="space-y-3">
                  {myGiftCards.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-xs">
                      No gift cards requested yet. Request one above!
                    </div>
                  ) : (
                    myGiftCards.map((card) => (
                      <div key={card.id} className="p-4 bg-[#232f3e] rounded-2xl border border-gray-700 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-black text-sm text-[#febd69]">
                            {card.code}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              card.status === 'APPROVED'
                                ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/40'
                                : card.status === 'REJECTED'
                                ? 'bg-red-900/60 text-red-300 border border-red-500/40'
                                : card.status === 'COMPLETED'
                                ? 'bg-blue-900/60 text-blue-300 border border-blue-500/40'
                                : 'bg-amber-900/60 text-amber-300 border border-amber-500/40 animate-pulse'
                            }`}
                          >
                            {card.status}
                          </span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Value:</span>
                          <span className="font-black text-white">{Number(card.amount).toLocaleString()} TZS</span>
                        </div>
                        {card.recipientName && (
                          <div className="flex justify-between text-[11px]">
                            <span className="text-gray-400">Recipient:</span>
                            <span className="text-gray-300">{card.recipientName}</span>
                          </div>
                        )}
                        {card.adminNote && (
                          <p className="text-[10px] text-amber-300 bg-black/30 p-2 rounded-xl border border-amber-500/20">
                            Admin Note: {card.adminNote}
                          </p>
                        )}
                        <p className="text-[10px] text-gray-500 text-right">
                          {new Date(card.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Registry Modal */}
      <AnimatePresence>
        {showRegistry && (
          <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowRegistry(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-[#131921] border border-gray-800 text-white p-6 sm:p-8 rounded-[2.5rem] shadow-2xl max-w-xl w-full relative z-10 max-h-[90dvh] overflow-y-auto space-y-6 my-auto">
              <div className="flex items-center justify-between pb-3 border-b border-gray-800">
                <div className="flex items-center space-x-2">
                  <ClipboardList className="w-5 h-5 text-[#febd69]" />
                  <h3 className="text-xl font-black uppercase text-[#febd69]">Wedding & Event Center</h3>
                </div>
                <button onClick={() => { console.log('Closing registry'); setShowRegistry(false); }} className="p-1.5 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs Selector */}
              <div className="flex bg-[#232f3e] p-1 rounded-2xl border border-gray-700 text-xs">
                <button
                  onClick={() => { console.log('Registry Tab: create'); setRegistryTab('create'); setRegistrySuccess(false); setRegistryError(''); }}
                  className={`flex-1 py-2 rounded-xl font-black uppercase tracking-wider transition-all cursor-pointer ${
                    registryTab === 'create' ? 'bg-[#febd69] text-slate-900 shadow-sm' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  Create Event
                </button>
                <button
                  onClick={() => { console.log('Registry Tab: my'); setRegistryTab('my'); fetchMyRegistries(); }}
                  className={`flex-1 py-2 rounded-xl font-black uppercase tracking-wider transition-all cursor-pointer ${
                    registryTab === 'my' ? 'bg-[#febd69] text-slate-900 shadow-sm' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  My Events ({myRegistries.length})
                </button>
                <button
                  onClick={() => { console.log('Registry Tab: invitations'); setRegistryTab('invitations'); fetchMyInvitations(); }}
                  className={`flex-1 py-2 rounded-xl font-black uppercase tracking-wider transition-all cursor-pointer ${
                    registryTab === 'invitations' ? 'bg-[#febd69] text-slate-900 shadow-sm' : 'text-gray-300 hover:text-white'
                  }`}
                >
                  My RSVPs ({myInvitations.length})
                </button>
              </div>

              {registrySuccess && (
                <div className="p-4 bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 rounded-2xl text-xs font-bold flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    Event and gift registry request submitted successfully! It is now PENDING Admin review and will be approved and active shortly.
                  </span>
                </div>
              )}

              {registryError && (
                <div className="p-4 bg-red-950/80 border border-red-500/50 text-red-200 rounded-2xl text-xs font-bold flex items-start space-x-2">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <span>{registryError}</span>
                </div>
              )}

              {/* TAB 1: CREATE REGISTRY & EVENT */}
              {registryTab === 'create' && (
                <form onSubmit={handleCreateRegistry} className="space-y-4">
                  <p className="text-xs text-gray-300">
                    Host a wedding, graduation, holiday gathering, or birthday in Tanzania. Create a custom gift registry and generate secure, verifiable invitations for registered users once approved.
                  </p>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                      Event & Registry Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Juma & Aisha Wedding Celebration"
                      value={registryTitle}
                      onChange={(e) => setRegistryTitle(e.target.value)}
                      className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                        Category
                      </label>
                      <select
                        value={registryCategory}
                        onChange={(e) => setRegistryCategory(e.target.value)}
                        className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white rounded-2xl font-bold text-xs outline-none cursor-pointer"
                      >
                        <option className="bg-slate-900 text-white" value="WEDDING">Wedding</option>
                        <option className="bg-slate-900 text-white" value="BIRTHDAY">Birthday</option>
                        <option className="bg-slate-900 text-white" value="BABY_SHOWER">Baby Shower</option>
                        <option className="bg-slate-900 text-white" value="GRADUATION">Graduation</option>
                        <option className="bg-slate-900 text-white" value="HOLIDAY">Holiday Celebration</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                        Event Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={registryDate}
                        onChange={(e) => setRegistryDate(e.target.value)}
                        className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white rounded-2xl font-bold text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        value={registryStartTime}
                        onChange={(e) => setRegistryStartTime(e.target.value)}
                        className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white rounded-2xl font-bold text-xs outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        value={registryEndTime}
                        onChange={(e) => setRegistryEndTime(e.target.value)}
                        className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white rounded-2xl font-bold text-xs outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                      Venue Name (e.g. Diamond Jubilee Hall)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mlimani City Conference Hall"
                      value={registryVenueName}
                      onChange={(e) => setRegistryVenueName(e.target.value)}
                      className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                      Town / City / Street Address
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Masaki, Dar es Salaam"
                      value={registryAddress}
                      onChange={(e) => setRegistryAddress(e.target.value)}
                      className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                      Number of People / Expected Guests *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="e.g. 100"
                      value={registryExpectedGuests}
                      onChange={(e) => setRegistryExpectedGuests(e.target.value)}
                      className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    <div className="mt-2 p-3 bg-slate-900/90 border border-[#febd69]/40 rounded-2xl flex items-center justify-between text-xs text-blue-100 font-bold">
                      <span className="flex items-center text-gray-300">
                        💳 Event Payment Request:
                      </span>
                      <span className="text-[#febd69] font-black text-sm">
                        {(Math.max(1, parseInt(registryExpectedGuests, 10) || 0) * 500).toLocaleString()} TZS
                      </span>
                    </div>
                    <p className="text-[10px] text-blue-200 mt-1">
                      (500 TZS per guest invitation quota. Payment request is sent to NMB Bank upon submission)
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                      Important Entrance Instructions
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Wear formal attire. Verification required at entrance."
                      value={registryInstructions}
                      onChange={(e) => setRegistryInstructions(e.target.value)}
                      className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1">
                      Registry Description & Note for Guests
                    </label>
                    <textarea
                      placeholder="Tell your guests what gifts or registry items you would appreciate most..."
                      value={registryDesc}
                      onChange={(e) => setRegistryDesc(e.target.value)}
                      rows={2}
                      className="w-full px-4 py-3 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingReg}
                    className="w-full py-3.5 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider cursor-pointer shadow-md disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>{submittingReg ? 'Submitting to Admin...' : 'Create Event & Request Verification'}</span>
                  </button>
                </form>
              )}

              {/* TAB 2: MY EVENTS */}
              {registryTab === 'my' && (
                <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                  {myRegistries.length === 0 ? (
                    <div className="py-8 text-center text-gray-400 text-xs">
                      No events created yet. Use the first tab to host one!
                    </div>
                  ) : (
                    myRegistries.map((reg) => (
                      <div key={reg.id} className="p-4 bg-[#232f3e] rounded-3xl border border-gray-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-sm text-white">
                            {reg.title}
                          </h4>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              reg.status === 'APPROVED'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40 animate-pulse'
                                : reg.status === 'REJECTED'
                                ? 'bg-red-950 text-red-400 border border-red-500/40'
                                : reg.status === 'COMPLETED'
                                ? 'bg-blue-950 text-blue-400 border border-blue-500/40'
                                : 'bg-amber-955 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {reg.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-300">
                          <div>
                            <span className="text-gray-400">Category:</span>{' '}
                            <span className="font-bold text-[#febd69]">{reg.category}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">Number of People:</span>{' '}
                            <span className="font-bold text-white">{reg.expectedGuests || 50} Guests</span>
                          </div>
                          {reg.eventDate && (
                            <div>
                              <span className="text-gray-400">Date:</span>{' '}
                              <span className="font-bold">{reg.eventDate}</span>
                            </div>
                          )}
                          {reg.venueName && (
                            <div>
                              <span className="text-gray-400">Venue:</span>{' '}
                              <span className="font-bold text-white">{reg.venueName}</span>
                            </div>
                          )}
                        </div>

                        {/* HIGH VISIBILITY PAYMENT REQUEST STATE GATEWAY */}
                        {reg.status !== 'APPROVED' ? (
                          (() => {
                            const pStatus = reg.payment?.status || 'PENDING';
                            const refNum = reg.payment?.referenceNumber || '';
                            const rejReason = reg.payment?.rejectionReason || '';

                            if (pStatus === 'SUBMITTED' || pStatus === 'UNDER_REVIEW' || pStatus === 'VERIFYING') {
                              return (
                                <div className="p-4 bg-slate-950 border border-blue-500/50 rounded-2xl space-y-2.5 shadow-inner">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase text-blue-300 tracking-wider flex items-center space-x-1">
                                      <span>⏳ Payment pending verification</span>
                                    </span>
                                    <span className="text-xs font-black text-[#febd69]">
                                      {Number(reg.targetAmount || ((reg.expectedGuests || 50) * 500)).toLocaleString()} TZS
                                    </span>
                                  </div>
                                  <p className="text-[10px] leading-relaxed text-slate-300">
                                    Admin is verifying your bank reference <strong className="text-white font-mono">{refNum || 'N/A'}</strong>. Once confirmed, your wedding event and invitation quota will unlock automatically.
                                  </p>
                                  <button
                                    type="button"
                                    disabled
                                    className="w-full py-2 bg-slate-800 text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-wider cursor-not-allowed flex items-center justify-center space-x-1"
                                  >
                                    <span>Verifying payment proof...</span>
                                  </button>
                                </div>
                              );
                            } else if (pStatus === 'REJECTED') {
                              return (
                                <div className="p-4 bg-red-950/60 border border-red-500/50 rounded-2xl space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase text-red-300 tracking-wider flex items-center">
                                      ❌ Payment failed / rejected
                                    </span>
                                    <span className="text-xs font-black text-white">
                                      {Number(reg.targetAmount || ((reg.expectedGuests || 50) * 500)).toLocaleString()} TZS
                                    </span>
                                  </div>
                                  <p className="text-[10px] leading-relaxed text-red-200">
                                    <strong>Reason:</strong> {rejReason || 'Verification failed. Reference mismatch.'}
                                  </p>
                                  <p className="text-[10px] text-gray-300">
                                    Please take corrective action and resubmit your payment details below.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowRegistry(false);
                                      setActivePaymentModal({
                                        isOpen: true,
                                        eventId: String(reg.id),
                                        amount: Number(reg.targetAmount || ((reg.expectedGuests || 50) * 500)),
                                        title: `Correct & Resubmit: ${reg.title}`
                                      });
                                    }}
                                    className="w-full py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-[10px] uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-1"
                                  >
                                    <span>Correct Details / Resubmit Proof</span>
                                  </button>
                                </div>
                              );
                            } else {
                              // PENDING, EXPIRED, CANCELLED, etc. (PAYMENT REQUIRED)
                              return (
                                <div className="p-4 bg-slate-900 border border-amber-500/50 rounded-2xl space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-black uppercase text-amber-300 tracking-wider flex items-center">
                                      🔴 Payment required
                                    </span>
                                    <span className="text-xs font-black text-[#febd69]">
                                      {Number(reg.targetAmount || ((reg.expectedGuests || 50) * 500)).toLocaleString()} TZS
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-300">
                                    Bank Account: <strong className="text-white">NMB 33510020641 (ALLEN JOHAS)</strong>
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowRegistry(false);
                                      setActivePaymentModal({
                                        isOpen: true,
                                        eventId: String(reg.id),
                                        amount: Number(reg.targetAmount || ((reg.expectedGuests || 50) * 500)),
                                        title: `Payment Request: ${reg.title}`
                                      });
                                    }}
                                    className="w-full py-2 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-xl font-black text-[10px] uppercase tracking-wider transition cursor-pointer flex items-center justify-center space-x-1"
                                  >
                                    <span>Pay Event Fee / Submit Payment Proof</span>
                                  </button>
                                </div>
                              );
                            }
                          })()
                        ) : (
                          <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl space-y-1 text-emerald-200">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black uppercase tracking-wider flex items-center">
                                🛡️ Payment verified — Service unlocked
                              </span>
                              <span className="px-2 py-0.5 bg-emerald-500 text-slate-900 rounded-md text-[9px] font-black uppercase">
                                UNLOCKED
                              </span>
                            </div>
                            <p className="text-[10px] text-emerald-300/80 leading-relaxed font-bold">
                              Guest invitation quota unlocked: {reg.guestQuotaRemaining || 0} remaining.
                            </p>
                          </div>
                        )}

                        {reg.adminNote && (
                          <p className="text-[10px] text-amber-300 bg-black/40 p-2.5 rounded-xl border border-amber-500/20">
                            Admin Note: {reg.adminNote}
                          </p>
                        )}

                        {/* Event Invitation Controls based on status */}
                        <div className="pt-2 border-t border-gray-800 flex flex-wrap gap-2">
                          {reg.status === 'APPROVED' ? (
                            <>
                              <button
                                onClick={() => {
                                  setActiveInviteEvent(reg);
                                  setShowRegistry(false);
                                }}
                                className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1 transition cursor-pointer"
                              >
                                <span>👥 Invite Guests</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveDashboardEvent(reg);
                                  setShowRegistry(false);
                                }}
                                className="flex-1 py-2 px-3 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1 transition cursor-pointer"
                              >
                                <span>📋 {translations[language].scanner.gatePortal}</span>
                              </button>
                            </>
                          ) : (reg.status?.toUpperCase() === 'COMPLETED' || reg.isFinished) ? (
                            <>
                              <button
                                onClick={() => {
                                  setActiveDashboardEvent(reg);
                                  setShowRegistry(false);
                                }}
                                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition cursor-pointer"
                              >
                                <span>📋 {translations[language].scanner.viewReport}</span>
                              </button>
                            </>
                          ) : (
                            <div className="w-full p-2 bg-slate-950/60 border border-slate-800 rounded-xl text-center text-[10px] text-slate-400 font-medium">
                              🔒 Invitations and security gates unlock once Admin approves this event.
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: MY EVENT RSVPS */}
              {registryTab === 'invitations' && (
                <div className="space-y-3.5 max-h-[60vh] overflow-y-auto pr-1">
                  {loadingInvitations ? (
                    <div className="py-12 text-center text-xs text-gray-500 animate-pulse">
                      Retrieving your personal invitations...
                    </div>
                  ) : myInvitations.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 text-xs">
                      No invitations received yet.
                    </div>
                  ) : (
                    myInvitations.map((item) => (
                      <div key={item.invitation.id} className="p-4 bg-[#232f3e] rounded-3xl border border-gray-700 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-950 text-blue-400 border border-blue-500/20">
                            {item.event.category || 'EVENT'}
                          </span>
                          <div className="flex items-center space-x-1.5">
                            {/* RSVP Status */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                item.invitation.status === 'ACCEPTED'
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                  : item.invitation.status === 'DECLINED'
                                  ? 'bg-red-950 text-red-400 border border-red-500/30'
                                  : 'bg-amber-955 text-amber-400 border border-amber-500/30 animate-pulse'
                              }`}
                            >
                              {item.invitation.status}
                            </span>
                            {/* Arrival */}
                            {item.invitation.arrivalStatus === 'ARRIVED' && (
                              <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500 text-emerald-400 rounded-full text-[9px] font-black uppercase">
                                🟢 Arrived
                              </span>
                            )}
                          </div>
                        </div>

                        <div>
                          <h4 className="font-black text-sm text-white">
                            {item.event.title}
                          </h4>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            Invited by <span className="font-bold text-[#febd69]">{item.inviter.fullName}</span>
                          </p>
                        </div>

                        <div className="space-y-1 text-[11px] text-gray-300">
                          {item.event.eventDate && (
                            <div>
                              <span className="text-gray-400">Date:</span> {item.event.eventDate}
                            </div>
                          )}
                          {item.event.venueName && (
                            <div>
                              <span className="text-gray-400">Venue:</span> {item.event.venueName}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setActiveViewInvitation({
                              invitation: item.invitation,
                              event: {
                                id: item.event.id,
                                title: item.event.title,
                                category: item.event.category,
                                eventDate: item.event.eventDate,
                                startTime: item.event.startTime,
                                endTime: item.event.endTime,
                                venueName: item.event.venueName,
                                deliveryAddress: item.event.deliveryAddress,
                                eventInstructions: item.event.eventInstructions,
                                userName: item.inviter.fullName,
                              }
                            });
                            setShowRegistry(false);
                          }}
                          className="w-full py-2 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1 transition cursor-pointer"
                        >
                          <span>View Invitation & Pass</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time event notifications toast popup */}
      {user && (
        <EventInvitationDashboardPopup userUid={user.uid} userDbId={dbUser?.user?.id || 0} />
      )}

      {/* Invite Modal */}
      {activeInviteEvent && (
        <EventInviteModal
          eventId={activeInviteEvent.id}
          eventTitle={activeInviteEvent.title}
          eventStatus={activeInviteEvent.status}
          isFinished={activeInviteEvent.isFinished}
          onClose={() => setActiveInviteEvent(null)}
        />
      )}

      {/* Entrance Gate Dashboard Modal */}
      {activeDashboardEvent && (
        <InviterEventDashboardModal
          eventId={activeDashboardEvent.id}
          onClose={() => setActiveDashboardEvent(null)}
          onRefreshEvent={fetchMyRegistries}
        />
      )}

      {/* Detailed Guest Invitation Card Modal */}
      {activeViewInvitation && (
        <div className="fixed inset-0 z-[250] bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl my-auto max-h-[90dvh] overflow-y-auto">
            <EventInvitationCard
              invitation={activeViewInvitation.invitation}
              event={activeViewInvitation.event}
              isGuestView={true}
              onRsvp={async (action) => {
                try {
                  const token = await auth.currentUser?.getIdToken();
                  const res = await fetchWithRetry(`/api/events/invitations/${activeViewInvitation.invitation.id}/respond`, {
                    method: 'POST',
                    headers: { 
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ action }),
                  });
                  if (res.ok) {
                    fetchMyInvitations();
                    setActiveViewInvitation(null);
                    showToast('RSVP Confirmed', `🎉 You have successfully ${action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED'} the invitation!`, 'success');
                  } else {
                    showToast('RSVP Failed', 'Failed to submit RSVP response.', 'error');
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
              onClose={() => setActiveViewInvitation(null)}
            />
          </div>
        </div>
      )}

      {/* Payment Modal for Event Fee */}
      <PaymentModal
        isOpen={activePaymentModal.isOpen}
        onClose={() => setActivePaymentModal(prev => ({ ...prev, isOpen: false }))}
        purpose="EVENT_INVITATION"
        relatedEntityType="EVENT"
        relatedEntityId={activePaymentModal.eventId}
        amountExpected={activePaymentModal.amount}
        title={activePaymentModal.title}
        subtitle="Submit payment proof to activate event invitation keys & entrance gates"
        onPaymentSuccess={() => {
          fetchMyRegistries();
          showToast('Payment Proof Submitted', '🎉 Payment proof sent! Admin will verify shortly.', 'success');
        }}
      />
    </>
  );
}
