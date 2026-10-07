// src/components/InviterEventDashboardModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  QrCode, 
  Keyboard, 
  Users, 
  CheckSquare, 
  UserX, 
  Clock, 
  ShieldCheck, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  Flag,
  FileSpreadsheet,
  Download,
  Camera,
  RefreshCw
} from 'lucide-react';
import { collection, query, where, onSnapshot, doc, getDocs } from 'firebase/firestore';
import { firestoreDb, auth } from '../lib/firebase';
import { fetchWithRetry } from '../lib/api';
import { jsPDF } from 'jspdf';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { QRScanner } from './QRScanner';
import { getTranslation } from '../lib/translations';

interface GuestRecord {
  id: number | string;
  invitedUserName: string;
  invitedUserEmail: string;
  invitationCode: string;
  verificationToken: string;
  status: string;
  arrivalStatus: string;
  arrivedAt?: string | null;
  verificationMethod?: string | null;
  invitedUserId?: number | null;
  createdAt?: string | null;
}

interface EventDetails {
  id: number;
  title: string;
  category: string;
  eventDate: string;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  deliveryAddress?: string | null;
  eventInstructions?: string | null;
  isFinished: boolean;
  status: string;
  userName: string;
  userId: number;
}

interface InviterEventDashboardModalProps {
  eventId: number;
  onClose: () => void;
  onRefreshEvent?: () => void;
}

export const InviterEventDashboardModal: React.FC<InviterEventDashboardModalProps> = ({
  eventId,
  onClose,
  onRefreshEvent,
}) => {
  const { language, dbUser } = useAuth();
  const { showToast } = useNotifications();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [guests, setGuests] = useState<GuestRecord[]>([]);
  const [firestoreGuestData, setFirestoreGuestData] = useState<Map<string, any>>(new Map());
  const [loading, setLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const isAdmin = dbUser?.user?.role === 'ADMIN';

  // Verification Input States
  const [manualCode, setManualCode] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [verifyMethod, setVerifyMethod] = useState<'QR' | 'MANUAL'>('QR');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    success: boolean;
    message: string;
    guestName?: string;
    alreadyArrived?: boolean;
  } | null>(null);

  const t = (section: string, key: string) => getTranslation(language, section as any, key);

  // Admin finish state
  const [finishing, setFinishing] = useState(false);

  // Load Event and Guest List initially
  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setLoading(true);
        const token = await auth.currentUser?.getIdToken();
        const res = await fetchWithRetry(`/api/events/${eventId}/invitations`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const data = await res.json();
          setEvent(data.event);
          setGuests(data.invitations || []);
        }
      } catch (err) {
        console.error('Failed to load event dashboard:', err);
      } finally {
        setLoading(false);
      }
    };

    if (eventId) {
      fetchEventData();
    }
  }, [eventId]);

  // Real-time Firestore synchronization for arrivals and RSVPs without page refresh!
  useEffect(() => {
    if (!eventId) return;

    // 1. Listen to eventInvitations collection
    const qInv = query(
      collection(firestoreDb, 'eventInvitations'),
      where('eventId', '==', eventId)
    );

    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const updatedGuestsMap = new Map<string, any>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        updatedGuestsMap.set(String(data.sqlId || doc.id), data);
      });

      if (updatedGuestsMap.size > 0) {
        setFirestoreGuestData(updatedGuestsMap);
      }
    }, (error) => {
      console.warn('Firestore real-time invitations sync error:', error);
    });

    // 2. Listen to the registryRequest itself for status/completion changes
    const unsubEvent = onSnapshot(
      doc(firestoreDb, 'registryRequests', String(eventId)),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setEvent((prev) => prev ? {
            ...prev,
            status: data.status || prev.status,
            isFinished: data.isFinished !== undefined ? !!data.isFinished : prev.isFinished,
          } : null);
        }
      },
      (error) => {
        console.warn('Firestore real-time registry sync error:', error);
      }
    );

    return () => {
      unsubInv();
      unsubEvent();
    };
  }, [eventId]);

  const handleVerifyGuest = useCallback(async (e: React.FormEvent | null, isQr: boolean, customToken?: string) => {
    if (e) e.preventDefault();
    if (verifyLoading) return;

    const codeOrToken = customToken || (isQr ? qrToken : manualCode);
    if (!codeOrToken || !codeOrToken.trim()) return;

    try {
      setVerifyLoading(true);
      setVerifyResult(null);

      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/events/invitations/verify', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          eventId,
          codeOrToken: codeOrToken.trim(),
          method: isQr ? 'QR' : 'MANUAL'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setVerifyResult({
          success: false,
          message: data.error || 'Verification failed. Invalid invitation code or QR token.'
        });
      } else {
        setVerifyResult({
          success: true,
          message: data.message,
          guestName: data.invitation?.invitedUserName,
          alreadyArrived: data.alreadyArrived
        });

        // Clear inputs on success
        if (isQr) {
          setQrToken('');
        } else {
          setManualCode('');
        }
      }
    } catch (err: any) {
      setVerifyResult({
        success: false,
        message: err.message || 'Verification system offline. Please try again.'
      });
    } finally {
      setVerifyLoading(false);
    }
  }, [eventId, manualCode, qrToken, verifyLoading]);

  const handleFinishEvent = async () => {
    if (!window.confirm('Are you absolutely sure you want to conclude and FINISH this event? This action will stop new guest invitation issuance and lock the guest check-in portal.')) {
      return;
    }

    try {
      setFinishing(true);
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/events/${eventId}/finish`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        setEvent(data.event);
        if (onRefreshEvent) onRefreshEvent();
        showToast('Event Concluded', '🎉 Event Concluded Successfully! High-security attendance logs and PDF report are locked and preserved.', 'success');
      } else {
        showToast('Error', 'Failed to conclude event.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error', 'Error concluding event.', 'error');
    } finally {
      setFinishing(false);
    }
  };

  // Merge SQL and Firestore data for display
  const mergedGuests = React.useMemo(() => {
    return guests.map((g) => {
      const fsData = firestoreGuestData.get(String(g.id));
      if (fsData) {
        return {
          ...g,
          status: fsData.status || g.status,
          arrivalStatus: fsData.arrivalStatus || g.arrivalStatus,
          arrivedAt: fsData.arrivedAt || g.arrivedAt,
          verificationMethod: fsData.verificationMethod || g.verificationMethod
        };
      }
      return g;
    });
  }, [guests, firestoreGuestData]);

  const handleDownloadReportPdf = async () => {
    if (!event || isDownloading) return;

    try {
      setIsDownloading(true);
      setDownloadStatus('Preparing guest list...');

      // 1. Explicitly fetch latest Firestore data to ensure PDF is absolute latest
      const qInv = query(
        collection(firestoreDb, 'eventInvitations'),
        where('eventId', '==', eventId)
      );
      const fsSnapshot = await getDocs(qInv);
      const fsDataMap = new Map();
      fsSnapshot.forEach(docSnap => {
        const data = docSnap.data();
        fsDataMap.set(String(data.sqlId || docSnap.id), data);
      });

      // Merge with base guest list (SQL records)
      const finalReportGuests = guests.map(g => {
        const fsData = fsDataMap.get(String(g.id));
        if (fsData) {
          return {
            ...g,
            status: fsData.status || g.status,
            arrivalStatus: fsData.arrivalStatus || g.arrivalStatus,
            arrivedAt: fsData.arrivedAt || g.arrivedAt,
            verificationMethod: fsData.verificationMethod || g.verificationMethod
          };
        }
        return g;
      });

      setDownloadStatus('Generating PDF...');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // ... existing PDF generation logic using finalReportGuests ...
      // Background styling
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, 'F');

      // Top Header
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 45, 'F');

      doc.setTextColor(254, 189, 105);
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('DREAMERS TANZANIA', 15, 18);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text('EVENT COMPLEX COMPLETION & ATTENDANCE AUDIT', 15, 26);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on ${new Date().toLocaleString()} | Cryptographic Security Seal: SEC-VERIFIED`, 15, 33);

      // Event Info Panel
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 52, 180, 40, 2, 2, 'FD');

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('EVENT METADATA SUMMARY', 20, 59);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Event Title: ${event.title}`, 20, 66);
      doc.text(`Category: ${event.category}  |  Organizer: ${event.userName}`, 20, 72);
      doc.text(`Date & Schedule: ${event.eventDate} @ ${event.startTime || 'N/A'} - ${event.endTime || 'N/A'}`, 20, 78);
      doc.text(`Venue Name & Address: ${event.venueName || 'N/A'}, ${event.deliveryAddress || 'Tanzania'}`, 20, 84);

      // Stat cards on PDF
      const total = finalReportGuests.length;
      const accepted = finalReportGuests.filter(g => g.status === 'ACCEPTED').length;
      const arrived = finalReportGuests.filter(g => g.arrivalStatus === 'ARRIVED').length;
      const absent = finalReportGuests.filter(g => g.arrivalStatus !== 'ARRIVED').length;

      doc.setFillColor(241, 245, 249);
      doc.roundedRect(15, 98, 42, 18, 1.5, 1.5, 'F');
      doc.roundedRect(61, 98, 42, 18, 1.5, 1.5, 'F');
      doc.roundedRect(107, 98, 42, 18, 1.5, 1.5, 'F');
      doc.roundedRect(153, 98, 42, 18, 1.5, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(String(total), 36, 105, { align: 'center' });
      doc.text(String(accepted), 82, 105, { align: 'center' });
      doc.setTextColor(16, 185, 129);
      doc.text(String(arrived), 128, 105, { align: 'center' });
      doc.setTextColor(239, 68, 68);
      doc.text(String(absent), 174, 105, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text('TOTAL INVITATIONS', 36, 112, { align: 'center' });
      doc.text('ACCEPTED RSVPS', 82, 112, { align: 'center' });
      doc.text('ARRIVED GUESTS', 128, 112, { align: 'center' });
      doc.text('NOT ARRIVED / ABSENT', 174, 112, { align: 'center' });

      // Table Header
      doc.setFillColor(15, 23, 42);
      doc.rect(15, 124, 180, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text('GUEST NAME', 17, 129.5);
      doc.text('DREAMERS ID', 55, 129.5);
      doc.text('INVITE CODE', 78, 129.5);
      doc.text('INVITED ON', 103, 129.5);
      doc.text('RSVP', 130, 129.5);
      doc.text('ARRIVAL', 148, 129.5);
      doc.text('CHECK-IN / METHOD', 168, 129.5);

      // Table Rows
      let y = 132;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(51, 65, 85);

      finalReportGuests.forEach((g, index) => {
        if (y > 275) {
          doc.addPage();
          doc.setFillColor(248, 250, 252);
          doc.rect(0, 0, 210, 297, 'F');
          y = 20;

          doc.setFillColor(15, 23, 42);
          doc.rect(15, y, 180, 8, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFont('helvetica', 'bold');
          doc.text('GUEST NAME', 17, y + 5.5);
          doc.text('DREAMERS ID', 55, y + 5.5);
          doc.text('INVITE CODE', 78, y + 5.5);
          doc.text('INVITED ON', 103, y + 5.5);
          doc.text('RSVP', 130, y + 5.5);
          doc.text('ARRIVAL', 148, y + 5.5);
          doc.text('CHECK-IN / METHOD', 168, y + 5.5);
          y += 11;
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(51, 65, 85);
        }

        if (index % 2 === 0) {
          doc.setFillColor(241, 245, 249);
          doc.rect(15, y - 3, 180, 6, 'F');
        }

        const dId = g.invitedUserId ? `DRM-${g.invitedUserId}` : 'N/A';
        const inviteDate = g.createdAt ? new Date(g.createdAt).toLocaleDateString() : 'N/A';
        const checkInInfo = g.arrivedAt 
          ? `${new Date(g.arrivedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} (${g.verificationMethod || '?'})`
          : '---';

        doc.text(String(g.invitedUserName || 'N/A').substring(0, 22), 17, y);
        doc.text(dId, 55, y);
        doc.text(g.invitationCode || 'N/A', 78, y);
        doc.text(inviteDate, 103, y);
        doc.text(g.status || 'PENDING', 130, y);
        doc.text(g.arrivalStatus || 'PENDING', 148, y);
        doc.text(checkInInfo, 168, y);

        y += 6;
      });

      // Signature & Seal block
      if (y > 255) {
        doc.addPage();
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, 210, 297, 'F');
        y = 30;
      }

      doc.setDrawColor(203, 213, 225);
      doc.line(15, y + 10, 195, y + 10);

      doc.setTextColor(148, 163, 184);
      doc.setFontSize(7.5);
      doc.text('AUTHENTICATED BY DREAMERS SECURITY MODULES', 15, y + 15);
      doc.text('ALL GUEST IDENTITY AUDITS ARE BOUND BY TANZANIA DATA PRIVACY GUARANTEES.', 15, y + 19);

      setDownloadStatus('Downloading...');
      const safeTitle = (event.title || 'Event').replace(/[^a-z0-9]/gi, '_').toLowerCase();
      doc.save(`Dreamers_Attendance_Report_${safeTitle}.pdf`);
      
      setDownloadStatus('Guest list downloaded successfully.');
      setTimeout(() => setDownloadStatus(null), 5000);
    } catch (err) {
      console.error('PDF Download Error:', err);
      setDownloadStatus('Failed to generate report.');
    } finally {
      setIsDownloading(false);
    }
  };

  // Stats calculation using merged data
  const totalInvited = mergedGuests.length;
  const pendingRsvps = mergedGuests.filter(g => g.status === 'PENDING').length;
  const acceptedRsvps = mergedGuests.filter(g => g.status === 'ACCEPTED').length;
  const arrivedGuests = mergedGuests.filter(g => g.arrivalStatus === 'ARRIVED').length;
  const absentGuests = mergedGuests.filter(g => g.arrivalStatus !== 'ARRIVED').length;

  return (
    <div className="fixed inset-0 z-[220] bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-white my-auto max-h-[90dvh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white rounded-full bg-slate-800 border border-slate-700 transition cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Dashboard Title */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-[#febd69]/10 border border-[#febd69]/30 rounded-2xl text-[#febd69]">
              <QrCode className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-xl sm:text-2xl font-black text-white">{t('scanner', 'dashboardTitle')}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                  {t('scanner', 'entrancePortal')}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-medium">
                {t('scanner', 'managePortal')} <span className="font-bold text-[#febd69]">{event?.title || 'your event'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {event && (event.userId === dbUser?.user?.id || isAdmin) && (
              <button
                onClick={handleDownloadReportPdf}
                disabled={isDownloading || loading}
                className="flex-1 sm:flex-initial py-2.5 px-4 bg-[#febd69] hover:bg-[#f3a847] border border-slate-700 text-slate-900 rounded-xl text-xs font-black flex items-center justify-center space-x-2 transition cursor-pointer shadow-lg disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                <span>{isDownloading ? 'Downloading...' : t('scanner', 'attendanceReport')}</span>
              </button>
            )}
            {/* Download Status Message */}
            {downloadStatus && (
              <div className="absolute top-full left-0 right-0 mt-2 p-2 bg-slate-800 text-slate-200 text-[10px] rounded-lg text-center animate-pulse">
                {downloadStatus}
              </div>
            )}

            {event && !event.isFinished && String(event.status).toUpperCase() !== 'COMPLETED' && (
              <button
                onClick={handleFinishEvent}
                disabled={finishing}
                className="flex-1 sm:flex-initial py-2.5 px-4 bg-red-600/20 hover:bg-red-600 border border-red-500/40 text-red-200 hover:text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition cursor-pointer"
              >
                <Flag className="w-4 h-4" />
                <span>{finishing ? t('scanner', 'concluding') : t('scanner', 'finishEvent')}</span>
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center animate-pulse text-xs text-slate-400">
            Initialising Event Dashboard... Please wait.
          </div>
        ) : !event ? (
          <div className="py-20 text-center text-xs text-red-400">
            Failed to retrieve event configuration. Please reload.
          </div>
        ) : (
          <div className="space-y-6 mt-6">
            
            {/* 1. Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <div className="text-2xl font-black text-[#febd69]">{totalInvited}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{t('scanner', 'metricsTotal')}</div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <div className="text-2xl font-black text-amber-400">{pendingRsvps}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{t('scanner', 'metricsPending')}</div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center">
                <div className="text-2xl font-black text-blue-400">{acceptedRsvps}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{t('scanner', 'metricsAccepted')}</div>
              </div>
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl text-center">
                <div className="text-2xl font-black text-emerald-400">{arrivedGuests}</div>
                <div className="text-[10px] text-emerald-400 font-bold uppercase mt-1 tracking-wider">{t('scanner', 'metricsArrived')}</div>
              </div>
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-center col-span-2 sm:col-span-1">
                <div className="text-2xl font-black text-slate-400">{absentGuests}</div>
                <div className="text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-wider">{t('scanner', 'metricsAbsent')}</div>
              </div>
            </div>

            {/* 2. Entrance Verification Panel */}
            {(event.isFinished || event.status === 'COMPLETED') ? (
              <div className="p-5 bg-blue-950/40 border border-blue-500/30 rounded-2xl text-center space-y-2">
                <CheckCircle className="w-10 h-10 text-blue-400 mx-auto" />
                <h4 className="font-black text-base text-blue-300">Concluded Event Logs</h4>
                <p className="text-xs text-blue-200/80 max-w-lg mx-auto">
                  This event is finished. The entry verification gate is deactivated. All check-in logs, arrival timestamps, and verifier credentials are permanently archived for report downloads.
                </p>
              </div>
            ) : (
              <div className="p-5 sm:p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h4 className="font-black text-sm uppercase tracking-wider text-[#febd69] flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4" />
                    <span>{t('scanner', 'gateVerification')}</span>
                  </h4>
                  
                  {/* Selector tab */}
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                    <button
                      onClick={() => { setVerifyMethod('QR'); setVerifyResult(null); }}
                      className={`px-3 py-1.5 rounded-lg font-black transition cursor-pointer ${verifyMethod === 'QR' ? 'bg-[#febd69] text-slate-900' : 'text-slate-400 hover:text-white'}`}
                    >
                      {t('scanner', 'qrScannerTab')}
                    </button>
                    <button
                      onClick={() => { setVerifyMethod('MANUAL'); setVerifyResult(null); }}
                      className={`px-3 py-1.5 rounded-lg font-black transition cursor-pointer ${verifyMethod === 'MANUAL' ? 'bg-[#febd69] text-slate-900' : 'text-slate-400 hover:text-white'}`}
                    >
                      {t('scanner', 'manualCodeTab')}
                    </button>
                  </div>
                </div>

                {/* Verification result notification (Primary for Manual, Secondary for QR) */}
                {verifyResult && verifyMethod === 'MANUAL' && (
                  <div className={`p-4 rounded-xl border flex items-start space-x-3 text-xs ${
                    verifyResult.success 
                      ? verifyResult.alreadyArrived
                        ? 'bg-amber-950/50 border-amber-500/40 text-amber-200'
                        : 'bg-emerald-950/50 border-emerald-500/40 text-emerald-200'
                      : 'bg-red-950/50 border-red-500/40 text-red-200'
                  }`}>
                    {verifyResult.success ? (
                      <CheckCircle className={`w-5 h-5 shrink-0 ${verifyResult.alreadyArrived ? 'text-amber-400' : 'text-emerald-400'}`} />
                    ) : (
                      <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                    )}
                    <div>
                      <div className="font-black text-sm uppercase tracking-tight">
                        {verifyResult.success ? t('scanner', 'verifySuccess') : t('scanner', 'verifyDenied')}
                      </div>
                      <p className="mt-1 font-medium">{verifyResult.message}</p>
                      {verifyResult.guestName && (
                        <div className="mt-1.5 inline-flex items-center space-x-1 px-2.5 py-0.5 rounded bg-black/40 text-[10px] font-black font-mono">
                          <span>{t('scanner', 'guestName')}:</span>
                          <span className="text-[#febd69]">{verifyResult.guestName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Method A: QR Scan token */}
                {verifyMethod === 'QR' && (
                  <div className="space-y-4">
                    <div className="bg-black/60 rounded-3xl p-1 sm:p-2 border border-slate-800 overflow-hidden">
                      <QRScanner
                        language={language}
                        onClose={() => setVerifyMethod('MANUAL')}
                        onScan={(token) => handleVerifyGuest(null, true, token)}
                        isPaused={verifyLoading || !!verifyResult}
                        isLoading={verifyLoading}
                        result={verifyResult}
                        onScanAgain={() => setVerifyResult(null)}
                      />
                    </div>
                    
                    <div className="flex items-center space-x-3 px-2">
                      <div className="h-px flex-1 bg-slate-800"></div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('common', 'or')}</span>
                      <div className="h-px flex-1 bg-slate-800"></div>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Paste QR token manually..."
                        value={qrToken}
                        onChange={(e) => setQrToken(e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-[#febd69] outline-none focus:border-[#febd69]"
                      />
                      <button
                        onClick={(e) => handleVerifyGuest(e, true)}
                        disabled={verifyLoading || !qrToken}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black transition cursor-pointer disabled:opacity-50"
                      >
                        Verify
                      </button>
                    </div>
                  </div>
                )}
                {/* Method B: Manual Code (INV-XXXXXXXX) */}
                {verifyMethod === 'MANUAL' && (
                  <form onSubmit={(e) => handleVerifyGuest(e, false)} className="space-y-3">
                    <p className="text-xs text-slate-400">
                      {t('scanner', 'manualInstruction')}
                    </p>
                    <div className="flex gap-2.5">
                      <input
                        type="text"
                        required
                        placeholder="Enter Code (e.g. INV-ABC123XY)..."
                        value={manualCode}
                        onChange={(e) => setManualCode(e.target.value)}
                        className="flex-1 px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-xs font-black uppercase tracking-widest text-[#febd69] outline-none focus:border-[#febd69]"
                      />
                      <button
                        type="submit"
                        disabled={verifyLoading}
                        className="px-5 py-3 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <Keyboard className="w-4 h-4 shrink-0" />
                        <span>{verifyLoading ? t('common', 'submitting') : t('scanner', 'checkInBtn')}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}


            {/* 3. Real-Time Attendance Logs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-xs uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Users className="w-4.5 h-4.5 text-[#febd69]" />
                  <span>{t('scanner', 'admissionDirectory')} ({mergedGuests.length})</span>
                </h4>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 uppercase tracking-wider font-bold text-[10px] border-b border-slate-800">
                      <th className="p-4">{t('scanner', 'tableGuestName')}</th>
                      <th className="p-4">{t('scanner', 'tableInviteCode')}</th>
                      <th className="p-4">{t('scanner', 'tableRSVP')}</th>
                      <th className="p-4">{t('scanner', 'tableArrival')}</th>
                      <th className="p-4">{t('scanner', 'tableTimestamp')}</th>
                      <th className="p-4">{t('scanner', 'tableAdmission')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {mergedGuests.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                          No guests invited yet. Close this modal and click "Invite Registered Users" to begin.
                        </td>
                      </tr>
                    ) : (
                      mergedGuests.map((g) => (
                        <tr key={g.id} className="hover:bg-slate-800/30 transition">
                          <td className="p-4 font-black text-white">{g.invitedUserName}</td>
                          <td className="p-4 font-mono font-bold text-[#febd69]">{g.invitationCode}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              g.status === 'ACCEPTED'
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                : g.status === 'DECLINED'
                                ? 'bg-red-950 text-red-300 border border-red-500/40'
                                : 'bg-slate-800 text-slate-300 border border-slate-700'
                            }`}>
                              {g.status}
                            </span>
                          </td>
                          <td className="p-4">
                            {g.arrivalStatus === 'ARRIVED' ? (
                              <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500 text-emerald-400 rounded-full text-[9px] font-black uppercase tracking-wider">
                                🟢 {t('scanner', 'arrived')}
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-800 text-slate-400 rounded-full text-[9px] font-bold uppercase tracking-wider">
                                {t('scanner', 'pending')}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-400 font-mono text-[11px]">
                            {g.arrivedAt ? (
                              <div className="flex items-center space-x-1.5">
                                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                <span>{new Date(g.arrivedAt).toLocaleTimeString()}</span>
                              </div>
                            ) : (
                              '---'
                            )}
                          </td>
                          <td className="p-4">
                            {g.verificationMethod ? (
                              <span className="text-[10px] bg-slate-950 border border-slate-800 p-1.5 rounded-xl font-mono text-slate-300">
                                via {g.verificationMethod}
                              </span>
                            ) : (
                              '---'
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
export default InviterEventDashboardModal;
