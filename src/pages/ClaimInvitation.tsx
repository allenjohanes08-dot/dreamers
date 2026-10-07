// src/pages/ClaimInvitation.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { translations } from '../lib/translations.ts';
import { fetchWithRetry } from '../lib/api';
import { auth } from '../lib/firebase';
import { EventInvitationCard } from '../components/EventInvitationCard';
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  MapPin, 
  UserCheck, 
  Lock, 
  LogIn, 
  UserPlus,
  AlertCircle,
  CheckCircle
} from 'lucide-react';

export const ClaimInvitation: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const { user, dbUser, loading: authLoading, language } = useAuth();
  const t = translations[language].claimInvitation;
  const eventT = translations[language].eventInvite;
  const commonT = translations[language].common;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [invitationData, setInvitationData] = useState<any | null>(null);
  const [eventData, setEventData] = useState<any | null>(null);
  const [organizerData, setOrganizerData] = useState<any | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (!token) {
      setErrorMsg('Invalid invitation link. No verification token was provided.');
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await fetchWithRetry(`/api/events/invitations/by-token/${token}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to fetch invitation details.');
        }

        const data = await res.json();
        setInvitationData(data.invitation);
        setEventData(data.event);
        setOrganizerData(data.organizer);
      } catch (err: any) {
        console.error('Fetch claim details error:', err);
        setErrorMsg(err.message || 'Could not load invitation details.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [token]);

  const handleClaim = async () => {
    if (!user || !dbUser) {
      setErrorMsg('You must be signed in to claim this invitation.');
      return;
    }

    try {
      setClaiming(true);
      setErrorMsg('');
      setSuccessMsg('');

      const tokenStr = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry('/api/events/invitations/claim', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(tokenStr ? { Authorization: `Bearer ${tokenStr}` } : {})
        },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Claim verification failed.');
      }

      setSuccessMsg(`🎉 ${t.claimSuccess}`);
      // Refresh state
      setInvitationData(data.invitation);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred while claiming.');
    } finally {
      setClaiming(false);
    }
  };

  const handleRsvp = async (action: 'ACCEPT' | 'DECLINE') => {
    try {
      if (!invitationData) return;
      const tokenStr = await auth.currentUser?.getIdToken();
      const res = await fetchWithRetry(`/api/events/invitations/${invitationData.id}/respond`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(tokenStr ? { Authorization: `Bearer ${tokenStr}` } : {})
        },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        const data = await res.json();
        setInvitationData(data.invitation);
        const statusText = action === 'ACCEPT' ? commonT.attending : commonT.declined;
        setSuccessMsg(`✓ RSVP: ${statusText}!`);
      }
    } catch (err) {
      console.error('RSVP response failed:', err);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-4 text-white">
        <div className="w-12 h-12 rounded-full border-4 border-t-[#febd69] border-gray-800 animate-spin" />
        <p className="text-xs text-slate-400 font-black tracking-widest uppercase">{language === 'sw' ? 'Inafungua Kadi ya Mwaliko...' : 'Opening Invitation Pass...'}</p>
      </div>
    );
  }

  if (errorMsg && !invitationData) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/40 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <h3 className="text-lg font-black text-white uppercase tracking-tight">{t.denied}</h3>
          <p className="text-xs text-slate-300 leading-relaxed">{errorMsg}</p>
          <button
            onClick={() => navigate('/marketplace')}
            className="w-full py-2.5 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-xl text-xs font-black uppercase tracking-wider transition cursor-pointer"
          >
            {language === 'sw' ? 'Vinjari Sokoni' : 'Explore Marketplace'}
          </button>
        </div>
      </div>
    );
  }

  const isClaimed = invitationData?.claimStatus === 'CLAIMED';

  return (
    <div className="min-h-screen py-12 px-4 flex flex-col items-center justify-center relative overflow-hidden bg-transparent">
      {/* Background decorations */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#febd69]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card panel */}
      <div className="max-w-xl w-full space-y-6 relative z-10 animate-fade-in">
        {/* Step 1: Display Event details inside an elegant summary card if NOT claimed */}
        {!isClaimed ? (
          <div className="bg-slate-900 border-2 border-[#febd69]/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-center text-white">
            <div className="inline-flex items-center space-x-1 px-3 py-1 bg-[#febd69]/10 border border-[#febd69]/40 rounded-full text-[#febd69] text-[10px] font-black uppercase tracking-widest">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t.youAreInvited}</span>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                {eventData?.title}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {t.hostedBy} <span className="text-[#febd69] font-bold">{organizerData?.fullName || 'Event Organizer'}</span>
              </p>
            </div>

            {/* Event Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs text-left">
              <div className="p-3.5 bg-slate-800/50 rounded-2xl flex items-start space-x-3">
                <Calendar className="w-4 h-4 text-[#febd69] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t.date}</div>
                  <div className="font-bold text-white mt-0.5">{eventData?.eventDate || t.datePending}</div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-800/50 rounded-2xl flex items-start space-x-3">
                <Clock className="w-4 h-4 text-[#febd69] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t.time}</div>
                  <div className="font-bold text-white mt-0.5">
                    {eventData?.startTime ? `${eventData?.startTime}${eventData?.endTime ? ` - ${eventData?.endTime}` : ''}` : t.asScheduled}
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-slate-800/50 rounded-2xl flex items-start space-x-3 sm:col-span-2">
                <MapPin className="w-4 h-4 text-[#febd69] shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t.venue}</div>
                  <div className="font-bold text-white mt-0.5">{eventData?.venueName || eventData?.deliveryAddress || t.officialVenue}</div>
                  {eventData?.deliveryAddress && eventData?.venueName && (
                    <div className="text-slate-400 text-[11px] mt-0.5">{eventData?.deliveryAddress}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Verification Protection Guard */}
            <div className="p-4 bg-slate-950/80 border border-gray-800 rounded-2xl text-center space-y-3">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center space-x-1.5">
                <Lock className="w-4 h-4 text-amber-500" />
                <span>{t.secureGate}</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-normal max-w-sm mx-auto">
                {t.secureGateSub}
              </p>

              {errorMsg && (
                <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-[10px] flex items-center justify-center space-x-1.5">
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Login Options depending on active session */}
              {!user ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <button
                    onClick={() => navigate(`/register?invite_token=${token}`)}
                    className="py-3 px-4 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition shadow-md shadow-[#febd69]/10 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{t.createAccount}</span>
                  </button>
                  <button
                    onClick={() => navigate(`/login?invite_token=${token}`)}
                    className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{t.signIn}</span>
                  </button>
                </div>
              ) : (
                /* Authenticated claiming */
                <div className="space-y-3 pt-1">
                  <p className="text-xs text-[#febd69] font-bold">
                    {language === 'sw' ? 'Umeingia kama:' : 'Authenticated as:'} <span className="text-white underline">{dbUser?.user?.fullName || user.email}</span>
                  </p>
                  <button
                    onClick={handleClaim}
                    disabled={claiming}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-md cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{claiming ? t.associating : t.claimBtn}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Step 2: Show the real, interactive secure entry invitation card if claimed */
          <div className="space-y-4">
            {successMsg && (
              <div className="p-4 bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs rounded-2xl flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            
            <EventInvitationCard 
              invitation={invitationData}
              event={eventData}
              isGuestView={invitationData.invitedUserId === dbUser?.user?.id}
              onRsvp={handleRsvp}
              onClose={() => navigate('/customer')}
            />
          </div>
        )}
      </div>
    </div>
  );
};
export default ClaimInvitation;
