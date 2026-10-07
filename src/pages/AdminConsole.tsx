// src/pages/AdminConsole.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNotifications } from '../context/NotificationContext.tsx';
import {
  Users,
  Store,
  ShieldAlert,
  BarChart3,
  Settings,
  Activity,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Clock,
  Truck,
  Search,
  Filter,
  UserCheck,
  UserX,
  Shield,
  ShieldCheck,
  Layers,
  ShoppingBag,
  Package,
  DollarSign,
  AlertTriangle,
  RotateCcw,
  Sliders,
  SlidersHorizontal,
  Edit,
  Trash2,
  Eye,
  Check,
  X,
  FileText,
  TrendingUp,
  MapPin,
  RefreshCw,
  Lock,
  Zap,
  Save,
  Play,
  Gift,
  ClipboardList,
  Calendar,
  CreditCard
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { translations } from '../lib/translations.ts';
import { auth, db as firestoreDb } from '../lib/firebase.ts';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { fetchWithRetry } from '../lib/api.ts';
import ImageUploadInput from '../components/ImageUploadInput.tsx';
import VideoUploadInput from '../components/VideoUploadInput.tsx';
import { staggerContainer, fadeInUp, listItem, scaleIn, buttonHover } from '../lib/animations';

type TabType = 'overview' | 'finance' | 'users' | 'products' | 'orders' | 'giftcards' | 'registries' | 'logs' | 'activities' | 'settings' | 'diagnostics';

interface RealtimeAlert {
  id: string; // Firestore doc ID
  sqlId: number;
  type: 'GIFT_CARD' | 'REGISTRY';
  title: string;
  requesterName: string;
  requesterEmail: string;
  details: string;
  amount?: number;
  createdAt?: string;
}

export default function AdminConsole() {
  const { language, dbUser } = useAuth();
  const { showToast } = useNotifications();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);

  // Data states
  const [overview, setOverview] = useState<any>(null);
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [userList, setUserList] = useState<any[]>([]);
  const [productList, setProductList] = useState<any[]>([]);
  const [orderList, setOrderList] = useState<any[]>([]);
  const [giftCardList, setGiftCardList] = useState<any[]>([]);
  const [registryList, setRegistryList] = useState<any[]>([]);
  const [logList, setLogList] = useState<any[]>([]);
  const [activityList, setActivityList] = useState<any[]>([]);
  const [logisticsAgents, setLogisticsAgents] = useState<any[]>([]);
  const [financeSummary, setFinanceSummary] = useState<any>(null);
  const [paymentList, setPaymentList] = useState<any[]>([]);
  const [moneyLedgerList, setMoneyLedgerList] = useState<any[]>([]);
  const [flowSettings, setFlowSettings] = useState<any>({
    requireEscrow: 'true',
    sellerAutoApproval: 'false',
    productAutoApproval: 'false',
    logisticsAutoDispatch: 'true',
    registrationOpen: 'true',
    maxProductsPerSeller: '10',
    platformCommissionRate: '5',
    maintenanceMode: 'false',
  });

  // Filter & Search states
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('ALL');
  const [userStatusFilter, setUserStatusFilter] = useState('ALL');

  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('ALL');

  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('ALL');

  const [giftCardSearch, setGiftCardSearch] = useState('');
  const [giftCardFilter, setGiftCardFilter] = useState('ALL');

  const [registrySearch, setRegistrySearch] = useState('');
  const [registryFilter, setRegistryFilter] = useState('ALL');

  const [pendingGiftCardsCount, setPendingGiftCardsCount] = useState<number>(0);
  const [pendingRegistriesCount, setPendingRegistriesCount] = useState<number>(0);
  const [processingPaymentId, setProcessingPaymentId] = useState<number | null>(null);

  // Real-time Notification for Admin
  const [realtimeAlert, setRealtimeAlert] = useState<RealtimeAlert | null>(null);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem('dreamers_admin_dismissed_alerts');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch (e) {
      return new Set();
    }
  });

  const [actionReasonModal, setActionReasonModal] = useState<{
    id: number;
    type: 'GIFT_CARD' | 'REGISTRY';
    action: 'REJECT' | 'COMPLETE';
    title: string;
  } | null>(null);
  const [actionReasonText, setActionReasonText] = useState('');

  const [logSearch, setLogSearch] = useState('');
  const [activitySearch, setActivitySearch] = useState('');
  const [activityActionFilter, setActivityActionFilter] = useState('ALL');

  // Modals / Actions
  const [editUserModal, setEditUserModal] = useState<any | null>(null);
  const [editProductModal, setEditProductModal] = useState<any | null>(null);
  const [assignOrderModal, setAssignOrderModal] = useState<any | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [rejectReasonModal, setRejectReasonModal] = useState<{ id: number; type: 'USER' | 'PRODUCT' } | null>(null);
  const [customReason, setCustomReason] = useState('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const t = translations[language].adminConsole;

  const triggerToast = (msg: string) => {
    setActionSuccess(msg);
    showToast(t.adminAlert, msg, 'success');
    setTimeout(() => setActionSuccess(null), 3000);
  };

  useEffect(() => {
    fetchAllData();
  }, [activeTab]);

  // Real-time Firestore sync for incoming Gift Card & Registry requests
  useEffect(() => {
    if (!auth.currentUser) return;

    // Listen to gift card requests in real-time
    const qGift = query(collection(firestoreDb, 'giftCardRequests'));
    const unsubGift = onSnapshot(qGift, (snapshot) => {
      let pendingCount = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status === 'PENDING') pendingCount++;
      });
      setPendingGiftCardsCount(pendingCount);

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const docId = change.doc.id;
          const data = change.doc.data();
          if (data.status === 'PENDING' && !dismissedAlertIds.has(docId)) {
            setRealtimeAlert({
              id: docId,
              sqlId: data.sqlId || parseInt(docId, 10),
              type: 'GIFT_CARD',
              title: 'New Gift Card Request',
              requesterName: data.userName || data.userEmail || 'Customer',
              requesterEmail: data.userEmail || '',
              details: `${Number(data.amount || 0).toLocaleString()} TZS (Code: ${data.code || 'N/A'})`,
              amount: data.amount,
              createdAt: data.createdAt,
            });
          }
        }
      });
    }, (err) => {
      console.warn('Real-time gift cards listener (handled):', err.message);
    });

    // Listen to registry requests in real-time
    const qReg = query(collection(firestoreDb, 'registryRequests'));
    const unsubReg = onSnapshot(qReg, (snapshot) => {
      let pendingCount = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status === 'PENDING') pendingCount++;
      });
      setPendingRegistriesCount(pendingCount);

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const docId = change.doc.id;
          const data = change.doc.data();
          if (data.status === 'PENDING' && !dismissedAlertIds.has(docId)) {
            setRealtimeAlert({
              id: docId,
              sqlId: data.sqlId || parseInt(docId, 10),
              type: 'REGISTRY',
              title: 'New Registry Request',
              requesterName: data.userName || data.userEmail || 'Customer',
              requesterEmail: data.userEmail || '',
              details: `"${data.title || 'Untitled'}" (${data.category || 'Wedding'})`,
              createdAt: data.createdAt,
            });
          }
        }
      });
    }, (err) => {
      console.warn('Real-time registry listener (handled):', err.message);
    });

    return () => {
      unsubGift();
      unsubReg();
    };
  }, [dismissedAlertIds]);

  const dismissAlert = (id: string) => {
    setDismissedAlertIds(prev => {
      const next = new Set(prev).add(id);
      try {
        sessionStorage.setItem('dreamers_admin_dismissed_alerts', JSON.stringify(Array.from(next)));
      } catch (e) {}
      return next;
    });
    setRealtimeAlert(null);
  };

  const handleGiftCardAction = async (id: number, action: 'APPROVE' | 'REJECT' | 'COMPLETE', adminNote?: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/admin/gift-cards/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, adminNote }),
      });
      if (res.ok) {
        triggerToast(`Gift Card #${id} ${action === 'APPROVE' ? 'Approved & Activated' : action === 'REJECT' ? 'Rejected' : 'Completed'}`);
        if (realtimeAlert?.sqlId === id) setRealtimeAlert(null);
        setActionReasonModal(null);
        setActionReasonText('');
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRegistryAction = async (id: number, action: 'APPROVE' | 'REJECT' | 'COMPLETE', adminNote?: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/admin/registry/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, adminNote }),
      });
      if (res.ok) {
        triggerToast(`Registry #${id} ${action === 'APPROVE' ? 'Approved & Published' : action === 'REJECT' ? 'Rejected' : 'Completed'}`);
        if (realtimeAlert?.sqlId === id) setRealtimeAlert(null);
        setActionReasonModal(null);
        setActionReasonText('');
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const headers = { Authorization: `Bearer ${token}` };

      if (activeTab === 'overview') {
        const res = await fetchWithRetry('/api/admin/overview', { headers });
        if (res.ok) {
          const ov = await res.json().catch(() => null);
          setOverview(ov);
          if (ov?.stats?.pendingGiftCards !== undefined) setPendingGiftCardsCount(ov.stats.pendingGiftCards);
          if (ov?.stats?.pendingRegistries !== undefined) setPendingRegistriesCount(ov.stats.pendingRegistries);
        }
      } else if (activeTab === 'finance') {
        const [sumRes, payRes, ledRes] = await Promise.all([
          fetchWithRetry('/api/admin/finance/summary', { headers }),
          fetchWithRetry('/api/admin/payments', { headers }),
          fetchWithRetry('/api/admin/money-ledger', { headers }),
        ]);
        if (sumRes.ok) setFinanceSummary(await sumRes.json().catch(() => null));
        if (payRes.ok) setPaymentList(await payRes.json().catch(() => []));
        if (ledRes.ok) setMoneyLedgerList(await ledRes.json().catch(() => []));
      } else if (activeTab === 'users') {
        const res = await fetchWithRetry('/api/admin/users', { headers });
        if (res.ok) setUserList(await res.json().catch(() => []));
      } else if (activeTab === 'products') {
        const res = await fetchWithRetry('/api/admin/products', { headers });
        if (res.ok) setProductList(await res.json().catch(() => []));
      } else if (activeTab === 'orders') {
        const [ordRes, logRes] = await Promise.all([
          fetchWithRetry('/api/admin/orders', { headers }),
          fetchWithRetry('/api/admin/logistics-agents', { headers }),
        ]);
        if (ordRes.ok) setOrderList(await ordRes.json().catch(() => []));
        if (logRes.ok) setLogisticsAgents(await logRes.json().catch(() => []));
      } else if (activeTab === 'giftcards') {
        const res = await fetchWithRetry('/api/admin/gift-cards', { headers });
        if (res.ok) setGiftCardList(await res.json().catch(() => []));
      } else if (activeTab === 'registries') {
        const res = await fetchWithRetry('/api/admin/registry', { headers });
        if (res.ok) setRegistryList(await res.json().catch(() => []));
      } else if (activeTab === 'logs') {
        const res = await fetchWithRetry('/api/admin/audit-logs', { headers });
        if (res.ok) setLogList(await res.json().catch(() => []));
      } else if (activeTab === 'activities') {
        const res = await fetchWithRetry('/api/admin/activities', { headers });
        if (res.ok) setActivityList(await res.json().catch(() => []));
      } else if (activeTab === 'settings') {
        const res = await fetchWithRetry('/api/admin/settings', { headers });
        if (res.ok) setFlowSettings(await res.json().catch(() => ({})));
      } else if (activeTab === 'diagnostics') {
        const res = await fetchWithRetry('/api/system/diagnose', { headers });
        if (res.ok) setDiagnostics(await res.json().catch(() => null));
      }
    } catch (e) {
      console.error('Error fetching admin data:', e);
    } finally {
      setLoading(false);
    }
  };

  // User Actions
  const handleVerifyRole = async (id: number, action: 'APPROVE' | 'REJECT') => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/admin/users/${id}/verify-role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        triggerToast(action === 'APPROVE' ? 'Role approved & activated!' : 'Role request rejected (remains Customer).');
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateUser = async (id: number, payload: any) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        triggerToast('User updated successfully');
        setEditUserModal(null);
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSuspendUser = async (id: number) => {
    if (!confirm('Are you sure you want to suspend this user?')) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerToast('User suspended');
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Product Actions
  const handleUpdateProduct = async (id: number, payload: any) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/admin/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        triggerToast('Product status updated');
        setEditProductModal(null);
        setRejectReasonModal(null);
        // Instantly update local state without full reload
        setProductList(prev => prev.map(p => p.product.id === id ? { ...p, product: { ...p.product, ...payload } } : p));
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Archive this product listing from the marketplace?')) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/admin/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        triggerToast('Product archived');
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Order & Dispatch Actions
  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        triggerToast(`Order #${orderId} set to ${status}`);
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAssignDriver = async (orderId: number, logisticsId: string) => {
    if (!logisticsId) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/admin/orders/${orderId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ logisticsId }),
      });
      if (res.ok) {
        triggerToast(`Driver assigned to Order #${orderId}`);
        setAssignOrderModal(null);
        setSelectedAgentId('');
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Save System Flow Settings
  const handleSaveFlowSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(flowSettings),
      });
      if (res.ok) {
        triggerToast('Platform flow settings saved successfully');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Filtered Lists
  const filteredUsers = userList.filter((u) => {
    const matchesSearch =
      u.fullName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phone?.toLowerCase().includes(userSearch.toLowerCase());
    const matchesRole = userRoleFilter === 'ALL' || u.role === userRoleFilter;
    const matchesStatus = userStatusFilter === 'ALL' || u.verificationStatus === userStatusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredProducts = productList.filter((p) => {
    const matchesSearch =
      p.product?.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.shop?.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
      p.seller?.email?.toLowerCase().includes(productSearch.toLowerCase());
    const matchesStatus = productStatusFilter === 'ALL' || p.product?.status === productStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredOrders = orderList.filter((o) => {
    const matchesSearch =
      o.order?.id?.toString().includes(orderSearch) ||
      o.order?.deliveryAddress?.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customer?.email?.toLowerCase().includes(orderSearch.toLowerCase());
    const matchesStatus = orderStatusFilter === 'ALL' || o.order?.status === orderStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredLogs = logList.filter((l) => {
    return (
      l.log?.action?.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.log?.details?.toLowerCase().includes(logSearch.toLowerCase()) ||
      l.user?.email?.toLowerCase().includes(logSearch.toLowerCase())
    );
  });

  const filteredGiftCards = giftCardList.filter((item) => {
    const r = item.request || item;
    const u = item.user || {};
    const matchesSearch =
      r.code?.toLowerCase().includes(giftCardSearch.toLowerCase()) ||
      r.userName?.toLowerCase().includes(giftCardSearch.toLowerCase()) ||
      r.userEmail?.toLowerCase().includes(giftCardSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(giftCardSearch.toLowerCase()) ||
      r.recipientName?.toLowerCase().includes(giftCardSearch.toLowerCase()) ||
      r.recipientEmail?.toLowerCase().includes(giftCardSearch.toLowerCase());
    const matchesFilter = giftCardFilter === 'ALL' || r.status === giftCardFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredRegistries = registryList.filter((item) => {
    const r = item.request || item;
    const u = item.user || {};
    const matchesSearch =
      r.title?.toLowerCase().includes(registrySearch.toLowerCase()) ||
      r.category?.toLowerCase().includes(registrySearch.toLowerCase()) ||
      r.userName?.toLowerCase().includes(registrySearch.toLowerCase()) ||
      r.userEmail?.toLowerCase().includes(registrySearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(registrySearch.toLowerCase()) ||
      r.deliveryAddress?.toLowerCase().includes(registrySearch.toLowerCase());
    const matchesFilter = registryFilter === 'ALL' || r.status === registryFilter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {actionSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-[100] bg-emerald-600 text-light-green px-5 py-3 rounded-2xl shadow-xl font-bold text-xs flex items-center space-x-2"
          >
            <CheckCircle2 className="w-4 h-4 text-light-green" />
            <span>{actionSuccess}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Real-time Notification Popup to Admin for New/Pending Requests */}
      <AnimatePresence>
        {realtimeAlert && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-6 right-6 z-[160] max-w-md w-full bg-slate-900 border-2 border-amber-400 text-white p-6 rounded-[2rem] shadow-2xl shadow-amber-500/20 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-500/20 rounded-2xl text-amber-400">
                  {realtimeAlert.type === 'GIFT_CARD' ? <Gift className="w-6 h-6" /> : <ClipboardList className="w-6 h-6" />}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-amber-400 text-slate-950 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse">
                      Pending Action
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">Real-time</span>
                  </div>
                  <h4 className="text-base font-black uppercase tracking-tight text-white mt-0.5">
                    {realtimeAlert.title}
                  </h4>
                </div>
              </div>
              <button
                onClick={() => dismissAlert(realtimeAlert.id)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 space-y-1 text-xs font-bold">
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Requester:</span>
                <span className="text-white font-black">{realtimeAlert.requesterName}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Email:</span>
                <span className="text-blue-300 truncate max-w-[200px]">{realtimeAlert.requesterEmail}</span>
              </div>
              <div className="flex justify-between text-slate-400 text-[11px]">
                <span>Details:</span>
                <span className="text-amber-300 font-black">{realtimeAlert.details}</span>
              </div>
              {realtimeAlert.createdAt && (
                <div className="flex justify-between text-slate-500 text-[10px] pt-1 border-t border-slate-700/60">
                  <span>Date/Time:</span>
                  <span>{new Date(realtimeAlert.createdAt).toLocaleString()}</span>
                </div>
              )}
            </div>

            {/* View / Approve / Reject actions */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                onClick={() => {
                  const alert = realtimeAlert;
                  dismissAlert(alert.id);
                  if (alert.type === 'GIFT_CARD') {
                    setActiveTab('giftcards');
                    setGiftCardFilter('ALL');
                    setGiftCardSearch(alert.requesterEmail || '');
                  } else {
                    setActiveTab('registries');
                    setRegistryFilter('ALL');
                    setRegistrySearch(alert.requesterEmail || '');
                  }
                }}
                className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer transition-all shadow-md"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>

              <button
                onClick={async () => {
                  const alert = realtimeAlert;
                  dismissAlert(alert.id);
                  if (alert.type === 'GIFT_CARD') {
                    await handleGiftCardAction(alert.sqlId, 'APPROVE');
                  } else {
                    await handleRegistryAction(alert.sqlId, 'APPROVE');
                  }
                }}
                className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer transition-all shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve</span>
              </button>

              <button
                onClick={() => {
                  const alert = realtimeAlert;
                  dismissAlert(alert.id);
                  setActionReasonModal({
                    id: alert.sqlId,
                    type: alert.type,
                    action: 'REJECT',
                    title: alert.title,
                  });
                }}
                className="py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1 cursor-pointer transition-all shadow-md"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reject</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-light-green p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-light-green/10 rounded-full text-[10px] font-black uppercase tracking-widest text-blue-300">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span>Super Administrator Mode</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">{t.title}</h1>
          <p className="text-slate-400 text-xs font-medium max-w-2xl">{t.subtitle}</p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 self-start md:self-auto">
          {/* 🎁 Gift Card Requests Button */}
          <button
            onClick={() => setActiveTab('giftcards')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-md cursor-pointer ${
              activeTab === 'giftcards'
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40'
            }`}
          >
            <Gift className="w-4 h-4 text-amber-400" />
            <span>🎁 Gift Card Requests</span>
            {pendingGiftCardsCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-amber-500 text-slate-950 rounded-full text-[10px] font-black animate-pulse">
                {pendingGiftCardsCount}
              </span>
            )}
          </button>

          {/* 📋 Registry Requests Button */}
          <button
            onClick={() => setActiveTab('registries')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-2 transition-all shadow-md cursor-pointer ${
              activeTab === 'registries'
                ? 'bg-purple-400 text-slate-950 ring-2 ring-purple-300'
                : 'bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40'
            }`}
          >
            <ClipboardList className="w-4 h-4 text-purple-400" />
            <span>📋 Registry Requests</span>
            {pendingRegistriesCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-purple-500 text-white rounded-full text-[10px] font-black animate-pulse">
                {pendingRegistriesCount}
              </span>
            )}
          </button>

          <button
            onClick={fetchAllData}
            className="p-3 bg-light-green/10 hover:bg-light-green/20 text-light-green rounded-2xl text-xs font-bold flex items-center space-x-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
          <div className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>App Flow Active</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto space-x-2 bg-light-green p-2 rounded-2xl border border-slate-200/80 shadow-xs no-scrollbar">
        {[
          { id: 'overview', label: t.tabOverview, icon: BarChart3 },
          { id: 'finance', label: `💳 Finance & Payments ${financeSummary?.countPending > 0 ? `(${financeSummary.countPending})` : ''}`, icon: DollarSign },
          { id: 'giftcards', label: `🎁 Gift Cards ${pendingGiftCardsCount > 0 ? `(${pendingGiftCardsCount})` : ''}`, icon: Gift },
          { id: 'registries', label: `📋 Registries ${pendingRegistriesCount > 0 ? `(${pendingRegistriesCount})` : ''}`, icon: ClipboardList },
          { id: 'users', label: t.tabUsers, icon: Users },
          { id: 'products', label: t.tabProducts, icon: Store },
          { id: 'orders', label: t.tabOrders, icon: Truck },
          { id: 'logs', label: t.tabLogs, icon: Activity },
          { id: 'activities', label: 'Activity Control', icon: ShieldAlert },
          { id: 'settings', label: t.tabSettings, icon: SlidersHorizontal },
          { id: 'diagnostics', label: 'System Health', icon: Zap },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center space-x-2 px-5 py-3 rounded-xl font-black text-xs uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-light-green shadow-md shadow-blue-500/20'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW & KPIS */}
      {activeTab === 'overview' && (
        <motion.div 
          initial="initial"
          animate="animate"
          variants={staggerContainer(0.1)}
          className="space-y-8"
        >
          {/* Stats Grid */}
          <motion.div variants={staggerContainer(0.08)} className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
            {[
              {
                label: t.totalUsers,
                val: overview?.stats?.totalUsers || 0,
                sub: `${overview?.stats?.pendingUsers || 0} Pending Verification`,
                icon: Users,
                color: 'bg-blue-600 text-light-green',
              },
              {
                label: t.totalSellers,
                val: overview?.stats?.totalSellers || 0,
                sub: `${overview?.stats?.totalShops || 0} Registered Shops`,
                icon: Store,
                color: 'bg-purple-600 text-light-green',
              },
              {
                label: t.activeLogistics,
                val: overview?.stats?.totalLogistics || 0,
                sub: 'Active Delivery Agents',
                icon: Truck,
                color: 'bg-indigo-600 text-light-green',
              },
              {
                label: t.totalGMV,
                val: `${Number(overview?.stats?.totalGMV || 0).toLocaleString()} TZS`,
                sub: `${overview?.stats?.totalOrders || 0} Total Orders`,
                icon: DollarSign,
                color: 'bg-emerald-600 text-light-green',
              },
            ].map((st, i) => {
              const Icon = st.icon;
              return (
                <motion.div
                  variants={fadeInUp}
                  whileHover={{ y: -5, scale: 1.02 }}
                  key={i}
                  className={`${st.color} p-6 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between`}
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-light-green/10 rounded-full -mr-8 -mt-8 pointer-events-none" />
                  <Icon className="w-7 h-7 opacity-80 mb-3" />
                  <div>
                    <p className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
                      {st.val}
                    </p>
                    <p className="text-xs font-black uppercase tracking-wider opacity-90 mt-1">
                      {st.label}
                    </p>
                    <p className="text-[10px] font-medium opacity-75 mt-0.5">{st.sub}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* Dedicated Quick Action Banners for Gift Cards & Registries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -3 }}
              onClick={() => setActiveTab('giftcards')}
              className="bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 p-6 rounded-3xl shadow-lg flex items-center justify-between cursor-pointer border border-amber-300 transition-transform"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3.5 bg-slate-950 text-amber-400 rounded-2xl shrink-0">
                  <Gift className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-900 bg-amber-300/90 px-2 py-0.5 rounded-md">
                    Customer Requests
                  </span>
                  <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-slate-950 mt-1">
                    🎁 Gift Card Requests
                  </h3>
                  <p className="text-xs font-bold text-slate-900/80">
                    {pendingGiftCardsCount} Pending Verification & Activation
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="px-3.5 py-2 bg-slate-950 text-white rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center space-x-1 shadow-sm">
                  <span>Manage</span>
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
            </motion.div>

            <motion.div
              variants={fadeInUp}
              whileHover={{ y: -3 }}
              onClick={() => setActiveTab('registries')}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 rounded-3xl shadow-lg flex items-center justify-between cursor-pointer border border-purple-400 transition-transform"
            >
              <div className="flex items-center space-x-4">
                <div className="p-3.5 bg-white text-purple-700 rounded-2xl shrink-0">
                  <ClipboardList className="w-8 h-8" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-200 bg-purple-900/50 px-2 py-0.5 rounded-md">
                    Customer Registries
                  </span>
                  <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white mt-1">
                    📋 Registry Requests
                  </h3>
                  <p className="text-xs font-bold text-purple-100">
                    {pendingRegistriesCount} Pending Review & Approval
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="px-3.5 py-2 bg-white text-purple-900 rounded-xl font-black text-xs uppercase tracking-wider inline-flex items-center space-x-1 shadow-sm">
                  <span>Manage</span>
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
            </motion.div>
          </div>

          {/* Quick Flow Status & Recent Activities */}
          <motion.div variants={staggerContainer(0.1)} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* System Flow Configuration Snapshot */}
            <motion.div variants={fadeInUp} className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-base flex items-center">
                  <Zap className="w-5 h-5 mr-2 text-amber-500" />
                  App Flow Engine
                </h3>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="text-xs font-black text-blue-600 hover:underline uppercase"
                >
                  Configure
                </button>
              </div>

              <div className="space-y-3">
                {[
                  {
                    label: 'Escrow Protection Flow',
                    val: overview?.settings?.requireEscrow === 'true' ? 'Enforced' : 'Disabled',
                    active: overview?.settings?.requireEscrow === 'true',
                  },
                  {
                    label: 'Seller Auto-Approval',
                    val: overview?.settings?.sellerAutoApproval === 'true' ? 'Instant' : 'Manual Vetting',
                    active: overview?.settings?.sellerAutoApproval === 'true',
                  },
                  {
                    label: 'Product Catalog Review',
                    val: overview?.settings?.productAutoApproval === 'true' ? 'Instant' : 'Strict Review',
                    active: overview?.settings?.productAutoApproval !== 'true',
                  },
                  {
                    label: 'Logistics Auto-Dispatch',
                    val: overview?.settings?.logisticsAutoDispatch === 'true' ? 'Automated' : 'Manual',
                    active: overview?.settings?.logisticsAutoDispatch === 'true',
                  },
                  {
                    label: 'Registration Gateway',
                    val: overview?.settings?.registrationOpen === 'true' ? 'Open to Public' : 'Restricted',
                    active: overview?.settings?.registrationOpen === 'true',
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3.5 bg-emerald-50/50 rounded-2xl border border-slate-100 text-xs"
                  >
                    <span className="font-bold text-slate-700">{item.label}</span>
                    <span
                      className={`font-black px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider ${
                        item.active
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {item.val}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Live Activity Feed */}
            <motion.div variants={fadeInUp} className="lg:col-span-2 bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 uppercase tracking-tight text-base flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-blue-600" />
                  Live Platform Audit Trail
                </h3>
                <button
                  onClick={() => setActiveTab('logs')}
                  className="text-xs font-black text-blue-600 hover:underline uppercase"
                >
                  View All Logs
                </button>
              </div>

              <motion.div variants={staggerContainer(0.05)} className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {overview?.recentLogs?.length === 0 ? (
                  <p className="text-slate-400 text-xs text-center py-8">No recent logs recorded.</p>
                ) : (
                  overview?.recentLogs?.map((l: any, i: number) => (
                    <motion.div
                      variants={listItem}
                      key={i}
                      className="p-3.5 bg-emerald-50/50 rounded-2xl border border-slate-100 flex items-start justify-between space-x-3"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-[9px] font-black uppercase tracking-wider">
                            {l.log?.action}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400">
                            {l.user?.email || 'System'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 truncate max-w-lg">
                          {l.log?.details || 'Activity occurred'}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 shrink-0">
                        {new Date(l.log?.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </motion.div>
                  ))
                )}
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}

      {/* TAB 1.5: FINANCE & PAYMENTS MANAGEMENT */}
      {activeTab === 'finance' && (
        <div className="space-y-8">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 text-slate-100 shadow-md">
              <span className="text-xs uppercase font-bold text-slate-400 tracking-wider">Total Verified Revenue</span>
              <div className="text-2xl font-black text-emerald-400 tracking-tight mt-1">
                {(financeSummary?.totalVerified || 0).toLocaleString()} <span className="text-xs text-slate-400">TZS</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Confirmed & ledger recorded</p>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 text-slate-100 shadow-md">
              <span className="text-xs uppercase font-bold text-amber-400 tracking-wider">Pending Proof Submissions</span>
              <div className="text-2xl font-black text-amber-300 tracking-tight mt-1">
                {(financeSummary?.totalPending || 0).toLocaleString()} <span className="text-xs text-slate-400">TZS</span>
              </div>
              <p className="text-[10px] text-amber-400/80 mt-1 font-bold">{financeSummary?.countPending || 0} proof(s) awaiting review</p>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 text-slate-100 shadow-md">
              <span className="text-xs uppercase font-bold text-blue-400 tracking-wider">Under / Overpaid Flags</span>
              <div className="text-2xl font-black text-blue-300 tracking-tight mt-1">
                {financeSummary?.countUnderpaid || 0} <span className="text-xs font-normal text-slate-400">under</span> / {financeSummary?.countOverpaid || 0} <span className="text-xs font-normal text-slate-400">over</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Automatic mismatch detection</p>
            </div>

            <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 text-slate-100 shadow-md">
              <span className="text-xs uppercase font-bold text-purple-400 tracking-wider">Welcome Bonuses Awarded</span>
              <div className="text-2xl font-black text-purple-300 tracking-tight mt-1">
                {(financeSummary?.totalWelcomeBonusDistributed || 0).toLocaleString()} <span className="text-xs text-slate-400">TZS</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">TZS 500 per 1st order</p>
            </div>
          </div>

          {/* Primary Bank Account Reference Banner */}
          <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-emerald-300">Official Payment Destination Account</h3>
                <p className="text-xs text-slate-400 mt-0.5">Primary Manual Deposit Account for NMB & Mobile Money</p>
              </div>
            </div>

            <div className="flex items-center space-x-6 bg-slate-950 px-5 py-3 rounded-2xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 uppercase font-bold text-[10px]">Bank</span>
                <p className="font-bold text-white text-sm">NMB Bank</p>
              </div>
              <div className="border-l border-slate-800 pl-6">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Account Number</span>
                <p className="font-mono font-black text-amber-300 text-sm">33510020641</p>
              </div>
              <div className="border-l border-slate-800 pl-6">
                <span className="text-slate-400 uppercase font-bold text-[10px]">Account Name</span>
                <p className="font-bold text-white text-sm">ALLEN JOHAS</p>
              </div>
            </div>
          </div>

          {/* Submitted Payments Table */}
          <div className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span>Manual Payment Proof Verifications ({paymentList.length})</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Review submitted mobile money/NMB transfer references and approve to activate user entitlements.
                </p>
              </div>
              <button
                onClick={fetchAllData}
                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs flex items-center space-x-1.5 transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-3">Transaction Ref & Verification Time</th>
                    <th className="py-3 px-3">Payer & Sender</th>
                    <th className="py-3 px-3">Requested Service</th>
                    <th className="py-3 px-3">Quota (Req / Cur)</th>
                    <th className="py-3 px-3">Channel & Amount</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                  {paymentList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-10 text-slate-400">
                        No payment submissions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    paymentList.map((pItem: any) => {
                      const p = pItem.payment;
                      const u = pItem.user;
                      const s = pItem.service;
                      const isVerified = p.status === 'VERIFIED';
                      const isRejected = p.status === 'REJECTED';
                      const isSubmitted = p.status === 'SUBMITTED' || p.status === 'UNDER_REVIEW' || p.status === 'VERIFYING';

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 transition">
                          <td className="py-3.5 px-3">
                            <span className="font-mono font-bold text-slate-900 block">{p.transactionId}</span>
                            <span className="font-mono text-[10px] text-amber-600 font-extrabold block">{p.referenceNumber || 'No ref code'}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">
                              {p.verifiedAt ? `Verified: ${new Date(p.verifiedAt).toLocaleString()}` : `Created: ${new Date(p.createdAt).toLocaleString()}`}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-bold text-slate-900 block">{p.senderName || u?.fullName || 'Payer'}</span>
                            <span className="text-[10px] text-slate-500">{u?.email}</span>
                          </td>
                          <td className="py-3.5 px-3 font-bold text-slate-800">
                            <span className="px-2 py-0.5 rounded-md text-[10px] uppercase tracking-wider bg-slate-200 font-extrabold block w-fit">
                              {p.purpose}
                            </span>
                            {s?.title && (
                              <span className="text-[11px] text-slate-600 block mt-1 font-bold">
                                👰 Event: {s.title}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3 font-bold">
                            {s ? (
                              <div className="space-y-0.5 text-slate-600">
                                <div>Req: <span className="text-slate-900 font-black">{s.expectedGuests || 50} Guests</span></div>
                                <div className="text-[10px]">Cur: <span className="text-slate-500">{s.guestQuotaPurchased || 0} Purchased</span></div>
                              </div>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className="font-black text-slate-900 block">{(p.amountSubmitted || 0).toLocaleString()} TZS</span>
                            <span className="text-[10px] text-slate-500 block">Exp: {p.amountExpected?.toLocaleString()} TZS ({p.paymentMethod})</span>
                            {p.isUnderpayment && <span className="block text-[9px] font-bold text-rose-600 uppercase">Underpaid</span>}
                            {p.isOverpayment && <span className="block text-[9px] font-bold text-blue-600 uppercase">Overpaid</span>}
                          </td>
                          <td className="py-3.5 px-3">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              isVerified ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                              isRejected ? 'bg-rose-100 text-rose-800 border border-rose-300' :
                              'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}>
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            {isSubmitted ? (
                              <div className="flex items-center justify-end space-x-2">
                                <button
                                  type="button"
                                  disabled={processingPaymentId === p.id}
                                  onClick={async () => {
                                    const confirmVerify = window.confirm(`Are you sure you want to VERIFY and confirm payment ${p.transactionId} of ${(p.amountSubmitted || 0).toLocaleString()} TZS?`);
                                    if (!confirmVerify) return;
                                    try {
                                      setProcessingPaymentId(p.id);
                                      const token = await auth.currentUser?.getIdToken();
                                      const res = await fetchWithRetry(`/api/admin/payments/${p.id}/action`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ action: 'VERIFY' }),
                                      });
                                      if (res.ok) {
                                        showToast('Verified', `Payment #${p.id} confirmed and entitlement unlocked!`, 'success');
                                        fetchAllData();
                                      } else {
                                        const err = await res.json().catch(() => ({}));
                                        showToast('Error', err.error || 'Failed to verify payment', 'error');
                                      }
                                    } catch (e: any) {
                                      showToast('Error', e.message || 'Failed to verify payment', 'error');
                                    } finally {
                                      setProcessingPaymentId(null);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-50 cursor-pointer"
                                >
                                  {processingPaymentId === p.id ? 'Processing...' : 'Verify Payment'}
                                </button>
                                <button
                                  type="button"
                                  disabled={processingPaymentId === p.id}
                                  onClick={async () => {
                                    const reason = window.prompt('Enter rejection reason for this payment submission:', 'Invalid reference code or proof amount mismatch');
                                    if (!reason || !reason.trim()) return;
                                    try {
                                      setProcessingPaymentId(p.id);
                                      const token = await auth.currentUser?.getIdToken();
                                      const res = await fetchWithRetry(`/api/admin/payments/${p.id}/action`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                        body: JSON.stringify({ action: 'REJECT', rejectionReason: reason.trim() }),
                                      });
                                      if (res.ok) {
                                        showToast('Rejected', `Payment #${p.id} rejected.`, 'info');
                                        fetchAllData();
                                      } else {
                                        const err = await res.json().catch(() => ({}));
                                        showToast('Error', err.error || 'Failed to reject payment', 'error');
                                      }
                                    } catch (e: any) {
                                      showToast('Error', e.message || 'Failed to reject payment', 'error');
                                    } finally {
                                      setProcessingPaymentId(null);
                                    }
                                  }}
                                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition disabled:opacity-50 cursor-pointer"
                                >
                                  {processingPaymentId === p.id ? 'Processing...' : 'Reject'}
                                </button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-bold uppercase">
                                Processed
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Immutable Money Ledger Table */}
          <div className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <span>Immutable Money Ledger Audit ({moneyLedgerList.length})</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Cryptographically trackable financial inflow and outflow audit trail.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 font-black uppercase text-slate-500 text-[10px]">
                    <th className="py-2.5 px-3">Ledger Code</th>
                    <th className="py-2.5 px-3">Tx Ref</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Direction</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {moneyLedgerList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No financial ledger entries recorded yet.
                      </td>
                    </tr>
                  ) : (
                    moneyLedgerList.map((entry: any) => {
                      const m = entry.ledger;
                      const u = entry.user;
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{m.ledgerCode}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">{m.transactionId}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">{u?.fullName || `User #${m.userId}`}</td>
                          <td className="py-2.5 px-3 uppercase font-extrabold text-[10px] text-slate-700">{m.type}</td>
                          <td className="py-2.5 px-3 font-black text-slate-900">
                            {Number(m.amount).toLocaleString()} TZS
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              m.direction === 'CREDIT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                            }`}>
                              {m.direction}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {new Date(m.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {t.tabUsers} ({filteredUsers.length})
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Change roles, verify sellers, assign drivers, or suspend malicious accounts.
              </p>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-blue-200 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t.searchUsers}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 w-56 shadow-sm"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer shadow-sm"
              >
                <option value="ALL">All Roles</option>
                <option value="CUSTOMER">Customer</option>
                <option value="SELLER">Seller</option>
                <option value="LOGISTICS">Logistics</option>
                <option value="ADMIN">Admin</option>
              </select>

              <select
                value={userStatusFilter}
                onChange={(e) => setUserStatusFilter(e.target.value)}
                className="px-3 py-2 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer shadow-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="VERIFIED">Verified</option>
                <option value="PENDING">Pending</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* User Table */}
          <div className="table-responsive">
            <table className="w-full text-left text-xs min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-2">User / Email</th>
                  <th className="py-3 px-2">Requested Role</th>
                  <th className="py-3 px-2">Verified Role</th>
                  <th className="py-3 px-2">Status</th>
                  <th className="py-3 px-2">Phone</th>
                  <th className="py-3 px-2">Shop / Business</th>
                  <th className="py-3 px-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-emerald-50/50/80 transition-colors">
                    <td className="py-4 px-2">
                      <p className="text-slate-900 font-black">{u.fullName || 'No Name'}</p>
                      <p className="text-slate-400 text-[11px] font-medium">{u.email}</p>
                      <p className="text-slate-400 text-[9px] font-normal">
                        Joined: {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}
                      </p>
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          u.requestedRole === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : u.requestedRole === 'SELLER'
                            ? 'bg-blue-100 text-blue-800'
                            : u.requestedRole === 'LOGISTICS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.requestedRole || u.role}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'SELLER'
                            ? 'bg-blue-100 text-blue-800'
                            : u.role === 'LOGISTICS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-4 px-2">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tight ${
                          u.verificationStatus === 'VERIFIED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.verificationStatus === 'PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.verificationStatus}
                      </span>
                    </td>
                    <td className="py-4 px-2 text-slate-600">{u.phone || '—'}</td>
                    <td className="py-4 px-2 text-slate-600">
                      {u.sellerProfile?.businessName || (u.shops?.[0]?.name ? u.shops[0].name : '—')}
                    </td>
                    <td className="py-4 px-2 text-right space-x-1.5 whitespace-nowrap">
                      {u.verificationStatus === 'PENDING' && u.requestedRole && u.requestedRole !== 'CUSTOMER' && (
                        <>
                          <button
                            onClick={() => handleVerifyRole(u.id, 'APPROVE')}
                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-light-green rounded-lg text-[10px] font-black uppercase transition-all shadow-xs"
                            title="Approve requested role"
                          >
                            Approve {u.requestedRole === 'LOGISTICS' ? 'Logistics' : 'Seller'}
                          </button>
                          <button
                            onClick={() => handleVerifyRole(u.id, 'REJECT')}
                            className="px-2 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg text-[10px] font-black uppercase transition-all"
                            title="Reject role request (remains Customer)"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setEditUserModal(u)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-600 rounded-lg text-[10px] font-black uppercase transition-all"
                      >
                        Edit Role / Status
                      </button>
                      {u.verificationStatus === 'SUSPENDED' && (
                        <button
                          onClick={() => handleUpdateUser(u.id, { verificationStatus: 'VERIFIED' })}
                          className="px-2.5 py-1.5 bg-emerald-600 text-light-green rounded-lg text-[10px] font-black uppercase transition-all"
                        >
                          Reactivate
                        </button>
                      )}
                      {u.verificationStatus !== 'SUSPENDED' && u.role !== 'ADMIN' && (
                        <button
                          onClick={() => handleSuspendUser(u.id)}
                          className="px-2.5 py-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-light-green rounded-lg text-[10px] font-black uppercase transition-all"
                        >
                          Suspend
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: PRODUCT CATALOG & MODERATION */}
      {activeTab === 'products' && (
        <div className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {t.tabProducts} ({filteredProducts.length})
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Approve, reject with feedback, adjust prices or remove listings.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-blue-200 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder={t.searchProducts}
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 w-56 shadow-sm"
                />
              </div>

              <select
                value={productStatusFilter}
                onChange={(e) => setProductStatusFilter(e.target.value)}
                className="px-3 py-2 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer shadow-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="APPROVED">Approved</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="REJECTED">Rejected</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProducts.map((p) => {
              const item = p.product;
              return (
                <div
                  key={item.id}
                  className="p-4 bg-emerald-50/50 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start space-x-3">
                    <div className="relative shrink-0">
                      <img
                        src={item.images?.[0] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200'}
                        className="w-16 h-16 rounded-xl object-cover bg-light-green"
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200';
                        }}
                      />
                      {item.videoUrl && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-xl">
                          <Play className="w-5 h-5 text-white fill-white" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-grow">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                          item.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'PENDING_REVIEW'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status}
                      </span>
                      <h4 className="font-black text-slate-900 text-xs truncate mt-1">{item.name}</h4>
                      <p className="text-blue-600 font-black text-xs">
                        {Number(item.price).toLocaleString()} TZS
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold truncate">
                        Shop: {p.shop?.name || 'Unassigned'} • Seller: {p.seller?.fullName || 'N/A'}
                      </p>
                      <p className="text-[10px] text-slate-400 font-bold truncate">
                        Stock: {item.stock} • Video: {item.videoUploadStatus || (item.videoUrl ? 'COMPLETED' : 'NONE')}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex space-x-1">
                      {item.status !== 'APPROVED' && (
                        <button
                          onClick={() => handleUpdateProduct(item.id, { status: 'APPROVED' })}
                          className="px-2.5 py-1 bg-emerald-600 text-light-green rounded-lg text-[10px] font-black uppercase"
                        >
                          Approve
                        </button>
                      )}
                      {item.status !== 'REJECTED' && (
                        <button
                          onClick={() => setRejectReasonModal({ id: item.id, type: 'PRODUCT' })}
                          className="px-2.5 py-1 bg-amber-500 text-light-green rounded-lg text-[10px] font-black uppercase"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => setEditProductModal(item)}
                        className="p-1.5 bg-light-green border border-slate-200 text-slate-600 rounded-lg hover:text-blue-600"
                        title="Edit Price & Stock"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(item.id)}
                        className="p-1.5 bg-light-green border border-slate-200 text-red-600 rounded-lg hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: ORDERS & LOGISTICS FLOW OVERSIGHT */}
      {activeTab === 'orders' && (
        <div className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {t.tabOrders} ({filteredOrders.length})
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Live dispatch monitoring, escrow payment states, and force driver assignment.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder={t.searchOrders}
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="px-3 py-2 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 w-56 shadow-sm"
              />
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-300 cursor-pointer shadow-sm"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="PAID">Paid (Escrow Secured)</option>
                <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
                <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                <option value="DELIVERED">Delivered</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {filteredOrders.map((o) => {
              const order = o.order;
              const customer = o.customer;
              const items = o.items || [];
              const assignment = o.assignment;

              return (
                <div
                  key={order.id}
                  className="p-5 bg-[#0B1F3A] rounded-2xl border border-blue-900/60 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-black text-white text-sm">Order #{order.id}</span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          order.status === 'DELIVERED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : order.status === 'OUT_FOR_DELIVERY'
                            ? 'bg-blue-100 text-blue-800'
                            : order.status === 'CANCELLED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-slate-300">
                      Customer: {customer?.fullName || customer?.email} • Total:{' '}
                      <span className="text-blue-300 font-black">
                        {Number(order.totalAmount).toLocaleString()} TZS
                      </span>
                    </p>

                    <p className="text-[11px] text-slate-300 flex items-center">
                      <MapPin className="w-3.5 h-3.5 mr-1 text-blue-400 shrink-0" />
                      <span className="truncate">{order.deliveryAddress}</span>
                    </p>

                    <div className="flex flex-wrap gap-2 pt-1">
                      {items.map((it: any, idx: number) => (
                        <span
                          key={idx}
                          className="text-[10px] font-bold bg-blue-950 text-blue-200 px-2 py-0.5 rounded border border-blue-800"
                        >
                          {it.product?.name} x{it.item?.quantity}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <select
                      value={order.status}
                      onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                      className="px-3 py-2 bg-light-green border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="PAID">Paid</option>
                      <option value="READY_FOR_DELIVERY">Ready for Delivery</option>
                      <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                      <option value="DELIVERED">Delivered</option>
                      <option value="CANCELLED">Cancelled</option>
                    </select>

                    <button
                      onClick={() => setAssignOrderModal(order)}
                      className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-light-green rounded-xl text-xs font-black uppercase tracking-tight flex items-center space-x-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>{assignment ? 'Reassign Driver' : 'Assign Driver'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 5: AUDIT TRAIL & ACTIVITY LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                {t.tabLogs} ({filteredLogs.length})
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Cryptographically-tracked real-time audit log of every user, order, seller, and admin action.
              </p>
            </div>

            <input
              type="text"
              placeholder={t.searchLogs}
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="px-3 py-2 bg-emerald-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none w-64"
            />
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {filteredLogs.map((l, i) => (
              <div
                key={i}
                className="p-4 bg-emerald-50/50 rounded-2xl border border-slate-100 flex items-start justify-between space-x-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 bg-blue-600 text-light-green rounded-full text-[9px] font-black uppercase tracking-wider">
                      {l.log?.action}
                    </span>
                    {l.log?.entityType && (
                      <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold">
                        {l.log?.entityType} #{l.log?.entityId}
                      </span>
                    )}
                    <span className="text-slate-400 font-bold text-[10px]">
                      By: {l.user?.email || 'System'}
                    </span>
                  </div>
                  <p className="font-bold text-slate-800 text-xs">{l.log?.details}</p>
                </div>
                <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                  {new Date(l.log?.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: ACTIVITY CONTROL & MONITORING */}
      {activeTab === 'activities' && (
        <div className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                Admin Activity Control Center ({activityList.filter(item => {
                  const s = activitySearch.toLowerCase();
                  const matchesSearch = !s || 
                    item.log?.action?.toLowerCase().includes(s) ||
                    item.log?.details?.toLowerCase().includes(s) ||
                    item.user?.email?.toLowerCase().includes(s);
                  const matchesAction = activityActionFilter === 'ALL' || item.log?.action === activityActionFilter;
                  return matchesSearch && matchesAction;
                }).length})
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Complete centralized monitoring and control over user actions, uploads, authentication events, and transactions.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Search user actions, email, details..."
                value={activitySearch}
                onChange={(e) => setActivitySearch(e.target.value)}
                className="px-3 py-2 bg-emerald-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none w-60"
              />
              <select
                value={activityActionFilter}
                onChange={(e) => setActivityActionFilter(e.target.value)}
                className="px-3 py-2 bg-emerald-50/50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">All Actions</option>
                <option value="SELLER_PRODUCT_CREATED">Product Created</option>
                <option value="SELLER_PRODUCT_UPDATED">Product Updated</option>
                <option value="ORDER_PLACED">Order Placed</option>
                <option value="ADMIN_ROLE_CHANGE">Admin Role Change</option>
                <option value="ADMIN_USER_SUSPENDED">User Suspended</option>
              </select>
              <button
                onClick={() => {
                  fetchAllData();
                  triggerToast('Activity feed refreshed successfully');
                }}
                className="px-3 py-2 bg-blue-600 text-light-green rounded-xl text-xs font-black uppercase hover:bg-blue-700 transition-all cursor-pointer"
              >
                Refresh
              </button>
              <button
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.parse(JSON.stringify(activityList)));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", `admin_audit_trail_${Date.now()}.json`);
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                  triggerToast('Audit trail exported successfully');
                }}
                className="px-3 py-2 bg-slate-800 text-light-green rounded-xl text-xs font-black uppercase hover:bg-slate-900 transition-all cursor-pointer"
              >
                Export Trail
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {activityList
              .filter((item: any) => {
                const s = activitySearch.toLowerCase();
                const matchesSearch = !s || 
                  item.log?.action?.toLowerCase().includes(s) ||
                  item.log?.details?.toLowerCase().includes(s) ||
                  item.user?.email?.toLowerCase().includes(s);
                const matchesAction = activityActionFilter === 'ALL' || item.log?.action === activityActionFilter;
                return matchesSearch && matchesAction;
              })
              .map((l: any, i: number) => (
                <div
                  key={i}
                  className="p-4 bg-emerald-50/50 rounded-2xl border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <span className="px-2.5 py-0.5 bg-blue-600 text-light-green rounded-full text-[9px] font-black uppercase tracking-wider">
                        {l.log?.action}
                      </span>
                      {l.log?.entityType && (
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[9px] font-bold">
                          {l.log?.entityType} #{l.log?.entityId}
                        </span>
                      )}
                      <span className="text-slate-600 font-black text-[11px]">
                        User: {l.user?.fullName || l.user?.email || 'System User'}
                      </span>
                    </div>
                    <p className="font-bold text-slate-800 text-xs">{l.log?.details || 'Activity executed'}</p>
                  </div>
                  <div className="flex items-center space-x-3 self-end sm:self-center">
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black uppercase tracking-wider">
                      Active / Verified
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                      {new Date(l.log?.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB 6: APP FLOW & RULES CONFIGURATION */}
      {activeTab === 'settings' && (
        <form
          onSubmit={handleSaveFlowSettings}
          className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8"
        >
          <div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              {t.tabSettings}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Control the operational workflow, verification pipelines, escrow safety, and platform rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Escrow Enforcement Toggle */}
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-slate-200 flex items-start justify-between">
              <div className="pr-4 space-y-1">
                <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                  Enforce Escrow Protection
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Holds customer payments in secure platform escrow until delivery is verified by driver and buyer.
                </p>
              </div>
              <input
                type="checkbox"
                checked={flowSettings.requireEscrow === 'true'}
                onChange={(e) =>
                  setFlowSettings({ ...flowSettings, requireEscrow: e.target.checked ? 'true' : 'false' })
                }
                className="w-5 h-5 text-blue-600 rounded mt-1 cursor-pointer"
              />
            </div>

            {/* Seller Auto-Approval */}
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-slate-200 flex items-start justify-between">
              <div className="pr-4 space-y-1">
                <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                  Seller Auto-Approval Flow
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  When enabled, newly registered sellers are instantly VERIFIED without requiring admin manual review.
                </p>
              </div>
              <input
                type="checkbox"
                checked={flowSettings.sellerAutoApproval === 'true'}
                onChange={(e) =>
                  setFlowSettings({
                    ...flowSettings,
                    sellerAutoApproval: e.target.checked ? 'true' : 'false',
                  })
                }
                className="w-5 h-5 text-blue-600 rounded mt-1 cursor-pointer"
              />
            </div>

            {/* Product Auto-Approval */}
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-slate-200 flex items-start justify-between">
              <div className="pr-4 space-y-1">
                <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                  Product Catalog Instant Publish
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Automatically publish seller listings to marketplace immediately instead of holding for review.
                </p>
              </div>
              <input
                type="checkbox"
                checked={flowSettings.productAutoApproval === 'true'}
                onChange={(e) =>
                  setFlowSettings({
                    ...flowSettings,
                    productAutoApproval: e.target.checked ? 'true' : 'false',
                  })
                }
                className="w-5 h-5 text-blue-600 rounded mt-1 cursor-pointer"
              />
            </div>

            {/* Logistics Auto-Dispatch */}
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-slate-200 flex items-start justify-between">
              <div className="pr-4 space-y-1">
                <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                  Logistics Auto-Dispatch Algorithm
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Automatically ping nearest available registered logistics drivers when order reaches ready status.
                </p>
              </div>
              <input
                type="checkbox"
                checked={flowSettings.logisticsAutoDispatch === 'true'}
                onChange={(e) =>
                  setFlowSettings({
                    ...flowSettings,
                    logisticsAutoDispatch: e.target.checked ? 'true' : 'false',
                  })
                }
                className="w-5 h-5 text-blue-600 rounded mt-1 cursor-pointer"
              />
            </div>

            {/* Open User Registration */}
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-slate-200 flex items-start justify-between">
              <div className="pr-4 space-y-1">
                <span className="text-xs font-black uppercase tracking-tight text-slate-900">
                  Allow Public User Registration
                </span>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Allow open registration for new customers and sellers across Tanzania.
                </p>
              </div>
              <input
                type="checkbox"
                checked={flowSettings.registrationOpen === 'true'}
                onChange={(e) =>
                  setFlowSettings({
                    ...flowSettings,
                    registrationOpen: e.target.checked ? 'true' : 'false',
                  })
                }
                className="w-5 h-5 text-blue-600 rounded mt-1 cursor-pointer"
              />
            </div>

            {/* Commission Rate (%) */}
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black uppercase tracking-tight text-slate-900 block">
                Platform Commission Fee (%)
              </label>
              <input
                type="number"
                min="0"
                max="30"
                value={flowSettings.platformCommissionRate || '5'}
                onChange={(e) =>
                  setFlowSettings({ ...flowSettings, platformCommissionRate: e.target.value })
                }
                className="w-full p-3 bg-light-green border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-[10px] text-slate-400">Percentage deducted from completed seller payouts.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={isSavingSettings}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-light-green rounded-2xl font-black uppercase tracking-tight text-xs shadow-xl shadow-blue-500/20 flex items-center space-x-2 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingSettings ? 'Saving Settings...' : t.saveChanges}</span>
            </button>
          </div>
        </form>
      )}

      {/* DEDICATED PANEL: SYSTEM DIAGNOSTICS & AUTO-HEALING */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] border border-slate-700 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full -mr-32 -mt-32 blur-3xl" />
            <div className="relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-[10px] font-black uppercase tracking-wider mb-2 border border-blue-500/30">
                    <Zap className="w-3 h-3" />
                    <span>Live Infrastructure Monitoring</span>
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-tight">System Health & Diagnostics</h2>
                  <p className="text-slate-400 text-sm mt-2 max-w-xl">
                    Real-time monitoring of Dreamers platform infrastructure, including database connectivity, AI pipelines, and auto-healing error logs.
                  </p>
                </div>
                <button 
                  onClick={fetchAllData}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-600/30 transition-all flex items-center space-x-2 shrink-0 self-start md:self-center"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Run Deep Scan</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Health Checklist */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-light-green p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mb-6 flex items-center">
                  <ShieldCheck className="w-5 h-5 mr-2 text-blue-600" />
                  Service Health Checklist
                </h3>
                <div className="space-y-4">
                  {diagnostics?.diagnostics ? (
                    diagnostics.diagnostics.map((check: any, idx: number) => (
                      <div key={idx} className="p-5 bg-white rounded-2xl border border-slate-100 flex items-start justify-between group hover:border-blue-200 transition-all">
                        <div className="flex items-start space-x-4">
                          <div className={`p-2 rounded-xl ${check.status === 'pass' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {check.status === 'pass' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm uppercase">{check.component}</p>
                            <p className="text-xs text-slate-500 mt-0.5">{check.message}</p>
                            <div className="mt-2 flex items-center space-x-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Auto-Remedy:</span>
                              <span className="text-[9px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded-md">{check.autoRemediation}</span>
                            </div>
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${check.status === 'pass' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {check.status === 'pass' ? 'Optimal' : 'Issues Detected'}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center text-slate-400 font-bold uppercase text-xs">
                      {loading ? 'Performing scan...' : 'No diagnostic data available.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Errors / Auto-Healing Log */}
            <div className="space-y-6">
              <div className="bg-slate-950 text-light-green p-6 rounded-[2rem] border border-slate-800 shadow-xl min-h-[400px] flex flex-col">
                <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center text-white">
                  <Activity className="w-5 h-5 mr-2 text-red-500" />
                  Auto-Healing Log
                </h3>
                <div className="flex-grow space-y-4 overflow-y-auto pr-1 max-h-[500px] no-scrollbar">
                  {diagnostics?.recentErrors && diagnostics.recentErrors.length > 0 ? (
                    diagnostics.recentErrors.map((err: any, idx: number) => (
                      <div key={idx} className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 group">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase text-red-400">{err.type}</span>
                          <span className="text-[9px] text-slate-500">{new Date(err.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-[11px] font-mono text-slate-300 break-all">{err.message}</p>
                        <div className="pt-2 border-t border-slate-800 flex items-center space-x-2">
                          <RotateCcw className="w-3 h-3 text-emerald-500" />
                          <span className="text-[9px] font-bold text-emerald-500 uppercase">{err.autoRemedy}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex-grow flex flex-col items-center justify-center text-center space-y-3 py-12">
                      <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800">
                        <ShieldCheck className="w-6 h-6 text-emerald-500/30" />
                      </div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">System Stable: No active exceptions</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DEDICATED PANEL: GIFT CARD REQUESTS */}
      {activeTab === 'giftcards' && (
        <div className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                <Gift className="w-3.5 h-3.5 text-amber-600" />
                <span>Gift Card Requests & Redemption Control</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                Gift Card Requests ({filteredGiftCards.length})
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Review, approve, reject, and complete gift card requests from customers across Tanzania.
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-blue-200 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search code, requester, email..."
                  value={giftCardSearch}
                  onChange={(e) => setGiftCardSearch(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 w-56 shadow-sm"
                />
              </div>

              {/* Status Filter */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setGiftCardFilter(st)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      giftCardFilter === st
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table of Gift Cards */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Requester Details</th>
                  <th className="py-3 px-3">Card Code & Value</th>
                  <th className="py-3 px-3">Recipient & Message</th>
                  <th className="py-3 px-3">Date / Time</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Required Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredGiftCards.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                      No gift card requests found matching current filter.
                    </td>
                  </tr>
                ) : (
                  filteredGiftCards.map((item) => {
                    const r = item.request || item;
                    const u = item.user || {};
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-3">
                          <p className="font-black text-slate-900 leading-tight">
                            {r.userName || u.fullName || 'Customer'}
                          </p>
                          <p className="text-[11px] text-blue-600 font-bold">{r.userEmail || u.email}</p>
                          {u.phone && <p className="text-[10px] text-slate-400">{u.phone}</p>}
                        </td>

                        <td className="py-4 px-3">
                          <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {r.code}
                          </span>
                          <p className="font-black text-emerald-600 text-sm mt-1">
                            {Number(r.amount).toLocaleString()} TZS
                          </p>
                        </td>

                        <td className="py-4 px-3 max-w-xs">
                          {r.recipientName || r.recipientEmail ? (
                            <>
                              <p className="font-bold text-slate-800 text-[11px]">
                                To: {r.recipientName || 'N/A'} {r.recipientEmail ? `(${r.recipientEmail})` : ''}
                              </p>
                              {r.personalMessage && (
                                <p className="text-[10px] text-slate-500 italic mt-0.5 line-clamp-2">
                                  "{r.personalMessage}"
                                </p>
                              )}
                            </>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-bold">Self / Personal Card</span>
                          )}
                          {r.adminNote && (
                            <p className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded mt-1 border border-amber-200">
                              Admin: {r.adminNote}
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-3 whitespace-nowrap text-slate-500 font-medium text-[11px]">
                          <p className="font-bold text-slate-700">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>

                        <td className="py-4 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              r.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : r.status === 'COMPLETED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}
                          >
                            {r.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {r.status === 'REJECTED' && <XCircle className="w-3 h-3 text-red-600" />}
                            {r.status === 'COMPLETED' && <Check className="w-3 h-3 text-blue-600" />}
                            {r.status === 'PENDING' && <Clock className="w-3 h-3 text-amber-600" />}
                            <span>{r.status}</span>
                          </span>
                        </td>

                        <td className="py-4 px-3 text-right whitespace-nowrap">
                          {r.status === 'PENDING' ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleGiftCardAction(r.id, 'APPROVE')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                                title="Approve Gift Card"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => setActionReasonModal({
                                  id: r.id,
                                  type: 'GIFT_CARD',
                                  action: 'REJECT',
                                  title: `Reject Gift Card #${r.id} (${r.code})`,
                                })}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                                title="Reject Gift Card"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : r.status === 'APPROVED' ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleGiftCardAction(r.id, 'COMPLETE')}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition-all"
                              >
                                <Check className="w-3 h-3" />
                                <span>Mark Completed</span>
                              </button>
                              <button
                                onClick={() => setActionReasonModal({
                                  id: r.id,
                                  type: 'GIFT_CARD',
                                  action: 'REJECT',
                                  title: `Revoke Gift Card #${r.id}`,
                                })}
                                className="px-2.5 py-1.5 bg-slate-200 hover:bg-red-100 text-slate-700 hover:text-red-700 rounded-xl font-black text-[10px] uppercase cursor-pointer"
                              >
                                Revoke
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleGiftCardAction(r.id, 'APPROVE')}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl font-bold text-[10px] uppercase cursor-pointer"
                            >
                              Re-Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DEDICATED PANEL: REGISTRY REQUESTS */}
      {activeTab === 'registries' && (
        <div className="bg-light-green p-6 sm:p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-2 px-3 py-1 bg-purple-100 text-purple-900 rounded-full text-[10px] font-black uppercase tracking-wider mb-2">
                <ClipboardList className="w-3.5 h-3.5 text-purple-600" />
                <span>Wedding & Celebration Registry Management</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                Registry Requests ({filteredRegistries.length})
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Review and approve custom registries for weddings, baby showers, graduations, and celebrations.
              </p>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 text-blue-200 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search title, category, requester..."
                  value={registrySearch}
                  onChange={(e) => setRegistrySearch(e.target.value)}
                  className="pl-9 pr-3 py-2 bg-blue-600 border border-blue-400 rounded-xl text-xs font-bold text-white placeholder:text-blue-100 outline-none focus:ring-2 focus:ring-blue-300 w-56 shadow-sm"
                />
              </div>

              {/* Status Filter */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setRegistryFilter(st)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      registryFilter === st
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table of Registry Requests */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Requester Details</th>
                  <th className="py-3 px-3">Registry Details</th>
                  <th className="py-3 px-3">Event & Target</th>
                  <th className="py-3 px-3">Delivery Address</th>
                  <th className="py-3 px-3">Date Submitted</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Required Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRegistries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                      No registry requests found matching current filter.
                    </td>
                  </tr>
                ) : (
                  filteredRegistries.map((item) => {
                    const r = item.request || item;
                    const u = item.user || {};
                    return (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-4 px-3">
                          <p className="font-black text-slate-900 leading-tight">
                            {r.userName || u.fullName || 'Customer'}
                          </p>
                          <p className="text-[11px] text-blue-600 font-bold">{r.userEmail || u.email}</p>
                          {u.phone && <p className="text-[10px] text-slate-400">{u.phone}</p>}
                        </td>

                        <td className="py-4 px-3 max-w-xs">
                          <p className="font-black text-slate-900 text-sm leading-tight">{r.title}</p>
                          <span className="inline-block px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md text-[9px] font-black uppercase mt-1">
                            {r.category || 'WEDDING'}
                          </span>
                          {r.description && (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                              {r.description}
                            </p>
                          )}
                          {r.adminNote && (
                            <p className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded mt-1 border border-amber-200">
                              Admin: {r.adminNote}
                            </p>
                          )}
                        </td>

                        <td className="py-4 px-3 whitespace-nowrap">
                          {r.eventDate && (
                            <p className="text-xs font-bold text-slate-800 flex items-center">
                              <Calendar className="w-3.5 h-3.5 mr-1 text-slate-400" />
                              {r.eventDate}
                            </p>
                          )}
                          <p className="text-xs font-bold text-slate-800 mt-0.5">
                            👥 Guests: {r.expectedGuests || Math.round(Number(r.targetAmount || 0) / 500) || 50} People
                          </p>
                          <p className="text-[11px] font-black text-emerald-600">
                            💰 Fee Request: {Number(r.targetAmount || ((r.expectedGuests || 50) * 500)).toLocaleString()} TZS
                          </p>
                        </td>

                        <td className="py-4 px-3 max-w-xs">
                          {r.deliveryAddress ? (
                            <p className="text-[11px] text-slate-700 font-bold flex items-start">
                              <MapPin className="w-3.5 h-3.5 mr-1 text-blue-500 shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{r.deliveryAddress}</span>
                            </p>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-medium">Standard Delivery</span>
                          )}
                        </td>

                        <td className="py-4 px-3 whitespace-nowrap text-slate-500 font-medium text-[11px]">
                          <p className="font-bold text-slate-700">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </td>

                        <td className="py-4 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              r.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.status === 'REJECTED'
                                ? 'bg-red-100 text-red-800'
                                : r.status === 'COMPLETED'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-amber-100 text-amber-800 animate-pulse'
                            }`}
                          >
                            {r.status === 'APPROVED' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                            {r.status === 'REJECTED' && <XCircle className="w-3 h-3 text-red-600" />}
                            {r.status === 'COMPLETED' && <Check className="w-3 h-3 text-blue-600" />}
                            {r.status === 'PENDING' && <Clock className="w-3 h-3 text-amber-600" />}
                            <span>{r.status}</span>
                          </span>
                        </td>

                        <td className="py-4 px-3 text-right whitespace-nowrap">
                          {r.status === 'PENDING' ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleRegistryAction(r.id, 'APPROVE')}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                                title="Approve Registry"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve</span>
                              </button>
                              <button
                                onClick={() => setActionReasonModal({
                                  id: r.id,
                                  type: 'REGISTRY',
                                  action: 'REJECT',
                                  title: `Reject Registry #${r.id} ("${r.title}")`,
                                })}
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-[11px] uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition-all shadow-xs"
                                title="Reject Registry"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>Reject</span>
                              </button>
                            </div>
                          ) : r.status === 'APPROVED' ? (
                            <div className="flex items-center justify-end space-x-2">
                              <button
                                onClick={() => handleRegistryAction(r.id, 'COMPLETE')}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center space-x-1 cursor-pointer transition-all"
                              >
                                <Check className="w-3 h-3" />
                                <span>Mark Completed</span>
                              </button>
                              <button
                                onClick={() => setActionReasonModal({
                                  id: r.id,
                                  type: 'REGISTRY',
                                  action: 'REJECT',
                                  title: `Revoke Registry #${r.id}`,
                                })}
                                className="px-2.5 py-1.5 bg-slate-200 hover:bg-red-100 text-slate-700 hover:text-red-700 rounded-xl font-black text-[10px] uppercase cursor-pointer"
                              >
                                Revoke
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleRegistryAction(r.id, 'APPROVE')}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-xl font-bold text-[10px] uppercase cursor-pointer"
                            >
                              Re-Approve
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACTION REASON MODAL (for Reject or custom admin note) */}
      <AnimatePresence>
        {actionReasonModal && (
          <div className="fixed inset-0 z-[200] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setActionReasonModal(null); setActionReasonText(''); }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-light-green border border-slate-200 text-slate-900 p-6 sm:p-8 rounded-[2.5rem] shadow-2xl max-w-md w-full relative z-10 space-y-4 max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-base font-black uppercase tracking-tight text-slate-900">
                  {actionReasonModal.title}
                </h3>
                <button
                  onClick={() => { setActionReasonModal(null); setActionReasonText(''); }}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 font-medium">
                Provide an optional reason or message for the customer. This decision will be saved to Cloud SQL and Firebase, and sent directly to the customer.
              </p>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">
                  Admin Reason / Notes
                </label>
                <textarea
                  value={actionReasonText}
                  onChange={(e) => setActionReasonText(e.target.value)}
                  placeholder="e.g. Incomplete event details or invalid parameters..."
                  rows={3}
                  className="w-full p-3 bg-blue-600 border border-blue-400 text-white placeholder:text-blue-100 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setActionReasonModal(null); setActionReasonText(''); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const { id, type, action } = actionReasonModal;
                    if (type === 'GIFT_CARD') {
                      handleGiftCardAction(id, action, actionReasonText);
                    } else {
                      handleRegistryAction(id, action, actionReasonText);
                    }
                  }}
                  className={`flex-1 py-3 rounded-xl font-black text-xs uppercase text-white cursor-pointer shadow-md ${
                    actionReasonModal.action === 'REJECT'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Confirm {actionReasonModal.action}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT USER MODAL */}
      <AnimatePresence>
        {editUserModal && (
          <div className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditUserModal(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-light-green rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full relative z-10 shadow-2xl space-y-6 max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  Edit User Permissions
                </h3>
                <button onClick={() => setEditUserModal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-bold">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    User Email / Identity
                  </label>
                  <p className="text-slate-800 font-bold bg-emerald-50/50 p-3 rounded-xl border border-slate-200">
                    {editUserModal.email}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={editUserModal.fullName || ''}
                    onChange={(e) => setEditUserModal({ ...editUserModal, fullName: e.target.value })}
                    className="w-full p-3.5 bg-blue-600 border border-blue-400 rounded-xl font-bold text-white placeholder-blue-100 outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Requested Role
                  </label>
                  <select
                    value={editUserModal.requestedRole || editUserModal.role}
                    onChange={(e) => setEditUserModal({ ...editUserModal, requestedRole: e.target.value })}
                    className="w-full p-3.5 bg-blue-600 border border-blue-400 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option className="bg-slate-900 text-white" value="CUSTOMER">CUSTOMER (Customer Shopper)</option>
                    <option className="bg-slate-900 text-white" value="SELLER">SELLER (Merchant Store)</option>
                    <option className="bg-slate-900 text-white" value="LOGISTICS">LOGISTICS (Logistic Officer)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Verified Active Role
                  </label>
                  <select
                    value={editUserModal.role}
                    onChange={(e) => setEditUserModal({ ...editUserModal, role: e.target.value })}
                    className="w-full p-3.5 bg-blue-600 border border-blue-400 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option className="bg-slate-900 text-white" value="CUSTOMER">CUSTOMER (Shopper)</option>
                    <option className="bg-slate-900 text-white" value="SELLER">SELLER (Merchant)</option>
                    <option className="bg-slate-900 text-white" value="LOGISTICS">LOGISTICS (Delivery Agent)</option>
                    <option className="bg-slate-900 text-white" value="ADMIN">ADMIN (Full Control)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Verification Status
                  </label>
                  <select
                    value={editUserModal.verificationStatus}
                    onChange={(e) =>
                      setEditUserModal({ ...editUserModal, verificationStatus: e.target.value })
                    }
                    className="w-full p-3.5 bg-blue-600 border border-blue-400 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option className="bg-slate-900 text-white" value="VERIFIED">VERIFIED (Approved)</option>
                    <option className="bg-slate-900 text-white" value="PENDING">PENDING (Under Review)</option>
                    <option className="bg-slate-900 text-white" value="SUSPENDED">SUSPENDED (Restricted)</option>
                    <option className="bg-slate-900 text-white" value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditUserModal(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateUser(editUserModal.id, {
                      fullName: editUserModal.fullName,
                      role: editUserModal.role,
                      verificationStatus: editUserModal.verificationStatus,
                    })
                  }
                  className="flex-1 py-3 bg-blue-600 text-light-green rounded-xl font-black text-xs uppercase shadow-md shadow-blue-500/20"
                >
                  {t.saveChanges}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EDIT PRODUCT PRICE & STOCK MODAL */}
      <AnimatePresence>
        {editProductModal && (
          <div className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditProductModal(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-light-green rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full relative z-10 shadow-2xl space-y-6 max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
                  Moderate Product
                </h3>
                <button onClick={() => setEditProductModal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-bold">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Product Title
                  </label>
                  <input
                    type="text"
                    value={editProductModal.name}
                    onChange={(e) => setEditProductModal({ ...editProductModal, name: e.target.value })}
                    className="w-full p-3.5 bg-blue-600 border border-blue-400 rounded-xl font-bold text-white placeholder-blue-100 outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Price (TZS)
                    </label>
                    <input
                      type="number"
                      value={editProductModal.price}
                      onChange={(e) =>
                        setEditProductModal({ ...editProductModal, price: e.target.value })
                      }
                      className="w-full p-3.5 bg-blue-600 border border-blue-400 rounded-xl font-bold text-white placeholder-blue-100 outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                      Stock Count
                    </label>
                    <input
                      type="number"
                      value={editProductModal.stock}
                      onChange={(e) =>
                        setEditProductModal({ ...editProductModal, stock: e.target.value })
                      }
                      className="w-full p-3.5 bg-blue-600 border border-blue-400 rounded-xl font-bold text-white placeholder-blue-100 outline-none focus:ring-2 focus:ring-blue-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Approval Status
                  </label>
                  <select
                    value={editProductModal.status}
                    onChange={(e) =>
                      setEditProductModal({ ...editProductModal, status: e.target.value })
                    }
                    className="w-full p-3.5 bg-blue-600 border border-blue-400 rounded-xl font-bold text-white outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option className="bg-slate-900 text-white" value="APPROVED">APPROVED (Live in Market)</option>
                    <option className="bg-slate-900 text-white" value="PENDING_REVIEW">PENDING REVIEW</option>
                    <option className="bg-slate-900 text-white" value="REJECTED">REJECTED</option>
                    <option className="bg-slate-900 text-white" value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ImageUploadInput
                    label="Product Photo"
                    value={editProductModal.images?.[0] || ''}
                    onChange={(imgVal) => {
                      setEditProductModal({
                        ...editProductModal,
                        images: imgVal ? [imgVal] : []
                      });
                    }}
                  />
                  <VideoUploadInput
                    label="Product Video"
                    value={editProductModal.videoUrl || ''}
                    metadata={{
                      videoStoragePath: editProductModal.videoStoragePath,
                      videoFileName: editProductModal.videoFileName,
                      videoFileType: editProductModal.videoFileType,
                      videoFileSize: editProductModal.videoFileSize,
                      videoUploadStatus: editProductModal.videoUploadStatus
                    }}
                    onChange={(meta) => {
                      setEditProductModal({
                        ...editProductModal,
                        videoUrl: meta.videoUrl,
                        videoStoragePath: meta.videoStoragePath,
                        videoFileName: meta.videoFileName,
                        videoFileType: meta.videoFileType,
                        videoFileSize: meta.videoFileSize,
                        videoUploadStatus: meta.videoUploadStatus
                      });
                    }}
                    productId={editProductModal.id}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditProductModal(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateProduct(editProductModal.id, {
                      ...editProductModal,
                      price: Number(editProductModal.price),
                      stock: Number(editProductModal.stock),
                    })
                  }
                  className="flex-1 py-3 bg-blue-600 text-light-green rounded-xl font-black text-xs uppercase shadow-md shadow-blue-500/20"
                >
                  {t.saveChanges}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ASSIGN DRIVER MODAL */}
      <AnimatePresence>
        {assignOrderModal && (
          <div className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAssignOrderModal(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-light-green rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full relative z-10 shadow-2xl space-y-6 max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 flex items-center">
                  <Truck className="w-5 h-5 mr-2 text-blue-600" />
                  Dispatch Order #{assignOrderModal.id}
                </h3>
                <button onClick={() => setAssignOrderModal(null)} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs font-bold">
                <p className="text-slate-600 font-medium">
                  Select an active logistics delivery partner in Tanzania to fulfill and deliver this order:
                </p>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                    Select Logistics Driver
                  </label>
                  <select
                    value={selectedAgentId}
                    onChange={(e) => setSelectedAgentId(e.target.value)}
                    className="w-full p-3.5 bg-emerald-50/50 border border-slate-200 rounded-xl font-bold outline-none"
                  >
                    <option value="">-- Choose a Driver --</option>
                    {logisticsAgents.map((ag) => (
                      <option key={ag.profile.id} value={ag.profile.id}>
                        {ag.user?.fullName} ({ag.user?.phone || ag.user?.email}) - {ag.profile.vehicleType}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignOrderModal(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase cursor-pointer"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  disabled={!selectedAgentId}
                  onClick={() => handleAssignDriver(assignOrderModal.id, selectedAgentId)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-light-green rounded-xl font-black text-xs uppercase shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {t.assignDriver}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REJECT WITH FEEDBACK MODAL */}
      <AnimatePresence>
        {rejectReasonModal && (
          <div className="fixed inset-0 z-[130] flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setRejectReasonModal(null)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-light-green rounded-[2.5rem] p-6 sm:p-8 max-w-md w-full relative z-10 shadow-2xl space-y-6 max-h-[90dvh] overflow-y-auto my-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-lg font-black uppercase tracking-tight text-slate-900 text-red-600 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2 text-red-600" />
                  Reject Listing Feedback
                </h3>
                <button onClick={() => setRejectReasonModal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <p className="text-slate-600 font-medium">
                  Provide feedback to the seller explaining why this item was rejected:
                </p>
                <textarea
                  rows={3}
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="e.g. Image quality is unclear, or product description requires more details..."
                  className="w-full p-3 bg-emerald-50/50 border border-slate-200 rounded-xl font-bold outline-none resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectReasonModal(null)}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-black text-xs uppercase"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleUpdateProduct(rejectReasonModal.id, {
                      status: 'REJECTED',
                      rejectionReason: customReason || 'Does not meet catalog guidelines',
                    })
                  }
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-light-green rounded-xl font-black text-xs uppercase shadow-md shadow-red-500/20"
                >
                  Confirm Reject
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
