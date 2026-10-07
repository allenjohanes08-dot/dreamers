// src/components/EventInvitationDashboardPopup.tsx
import React, { useEffect, useState } from 'react';
import { 
  PartyPopper, 
  Sparkles, 
  Calendar, 
  MapPin, 
  X, 
  Download, 
  Eye, 
  CheckCircle,
  FileText
} from 'lucide-react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestoreDb, auth } from '../lib/firebase';
import { fetchWithRetry } from '../lib/api';
import { EventInvitationCard, EventInvitationData, EventData } from './EventInvitationCard';
import { useNotifications } from '../context/NotificationContext';

interface EventInvitationDashboardPopupProps {
  userUid: string;
  userDbId: number;
}

export const EventInvitationDashboardPopup: React.FC<EventInvitationDashboardPopupProps> = ({
  userUid,
  userDbId,
}) => {
  const { showToast } = useNotifications();
  const [activeInvitation, setActiveInvitation] = useState<EventInvitationData | null>(null);
  const [activeEvent, setActiveEvent] = useState<EventData | null>(null);
  const [showPopup, setShowPopup] = useState(false);
  const [showFullCard, setShowFullCard] = useState(false);

  // Track dismissed invitation IDs in localStorage to prevent duplicate popups on page loads
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dreamers_dismissed_invitation_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!userUid) return;

    // Listen to real-time eventInvitations targeted at this user
    const q = query(
      collection(firestoreDb, 'eventInvitations'),
      where('invitedUserUid', '==', userUid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Find the first invitation that is 'PENDING' (not accepted or declined yet) and has not been dismissed
      let newInvDoc: any = null;
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.status === 'PENDING' && !dismissedIds.includes(doc.id)) {
          newInvDoc = { id: doc.id, ...data };
        }
      });

      if (newInvDoc) {
        // Map to Invitation Data
        const mappedInvitation: EventInvitationData = {
          id: newInvDoc.sqlId || newInvDoc.id,
          invitationCode: newInvDoc.invitationCode,
          verificationToken: newInvDoc.verificationToken,
          status: newInvDoc.status,
          arrivalStatus: newInvDoc.arrivalStatus,
          arrivedAt: newInvDoc.arrivedAt,
          invitedUserName: newInvDoc.invitedUserName,
          invitedUserEmail: newInvDoc.invitedUserEmail,
          customNote: newInvDoc.customNote,
          createdAt: newInvDoc.createdAt,
        };

        const mappedEvent: EventData = {
          id: newInvDoc.eventId,
          title: newInvDoc.eventTitle,
          category: newInvDoc.eventCategory,
          eventDate: newInvDoc.eventDate,
          startTime: newInvDoc.startTime,
          endTime: newInvDoc.endTime,
          venueName: newInvDoc.venueName,
          deliveryAddress: newInvDoc.deliveryAddress,
          deliveryLatitude: newInvDoc.deliveryLatitude,
          deliveryLongitude: newInvDoc.deliveryLongitude,
          eventInstructions: newInvDoc.eventInstructions,
          userName: newInvDoc.inviterName,
        };

        setActiveInvitation(mappedInvitation);
        setActiveEvent(mappedEvent);
        setShowPopup(true);
      } else {
        setShowPopup(false);
      }
    }, (error) => {
      console.warn('Real-time event notification sync error (handled):', error);
    });

    return () => unsubscribe();
  }, [userUid, dismissedIds]);

  const handleDismiss = () => {
    if (activeInvitation) {
      const nextDismissed = [...dismissedIds, String(activeInvitation.id)];
      setDismissedIds(nextDismissed);
      localStorage.setItem('dreamers_dismissed_invitation_ids', JSON.stringify(nextDismissed));
    }
    setShowPopup(false);
  };

  const handleRsvp = async (action: 'ACCEPT' | 'DECLINE') => {
    if (!activeInvitation) return;
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/events/invitations/${activeInvitation.id}/respond`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        // Success
        handleDismiss();
        setShowFullCard(false);
        showToast('RSVP Status', `🎉 You have successfully ${action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED'} the invitation!`, 'success');
      } else {
        showToast('RSVP Error', 'Failed to submit RSVP response.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('RSVP Error', 'Error updating RSVP.', 'error');
    }
  };

  if (!showPopup || !activeInvitation || !activeEvent) return null;

  return (
    <>
      {/* 1. Real-time Toast/Popup Banner */}
      {!showFullCard && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#131921] border-2 border-[#febd69] rounded-3xl p-5 shadow-2xl text-white overflow-hidden animate-bounce-short">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#febd69]/10 rounded-full blur-2xl pointer-events-none" />
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-[#febd69]">
              <PartyPopper className="w-5 h-5 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-wider">New Invitation Received!</span>
            </div>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-gray-400 hover:text-white rounded-full bg-slate-800 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="mt-3 space-y-2">
            <h4 className="font-black text-base text-white tracking-tight leading-snug">
              {activeEvent.title}
            </h4>
            <p className="text-xs text-gray-300">
              You are cordially invited as an Honored Guest by <span className="font-bold text-[#febd69]">{activeEvent.userName}</span>.
            </p>

            <div className="space-y-1.5 pt-1 text-[11px] text-gray-400">
              <div className="flex items-center space-x-2">
                <Calendar className="w-3.5 h-3.5 text-[#febd69]" />
                <span>{activeEvent.eventDate || 'Date to be confirmed'}</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="w-3.5 h-3.5 text-[#febd69]" />
                <span className="truncate">{activeEvent.venueName || activeEvent.deliveryAddress || 'Official Venue'}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setShowFullCard(true)}
              className="flex-1 py-2 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1 transition cursor-pointer shadow-md"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View & RSVP</span>
            </button>
            <button
              onClick={handleDismiss}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-gray-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* 2. Interactive Backdrop Modal for detailed EventInvitationCard */}
      {showFullCard && (
        <div className="fixed inset-0 z-[220] bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl my-auto max-h-[90dvh] overflow-y-auto">
            <EventInvitationCard
              invitation={activeInvitation}
              event={activeEvent}
              isGuestView={true}
              onRsvp={handleRsvp}
              onClose={() => setShowFullCard(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};
export default EventInvitationDashboardPopup;
