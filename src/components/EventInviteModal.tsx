// src/components/EventInviteModal.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Search, 
  UserCheck, 
  UserPlus, 
  X, 
  Send, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  ShieldCheck,
  Sparkles,
  Share2,
  Copy,
  Check,
  RefreshCw,
  Phone,
  MessageSquare
} from 'lucide-react';
import { fetchWithRetry } from '../lib/api';
import { auth } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { translations } from '../lib/translations';
import { PaymentModal } from './PaymentModal';

export interface RegisteredUser {
  id: number;
  fullName: string;
  email: string;
  avatarUrl?: string | null;
  role?: string;
  verificationStatus?: string;
}

export interface ExistingInvitation {
  id: number;
  invitedUserId: number;
  invitedUserName: string;
  invitedUserEmail: string;
  invitationCode: string;
  verificationToken?: string;
  status: string;
  arrivalStatus: string;
  createdAt: string;
  isWhatsAppGuest?: boolean;
  guestPhone?: string | null;
  claimStatus?: string;
}

interface EventInviteModalProps {
  eventId: number;
  eventTitle: string;
  eventStatus: string;
  isFinished?: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EventInviteModal: React.FC<EventInviteModalProps> = ({
  eventId,
  eventTitle,
  eventStatus,
  isFinished = false,
  onClose,
  onSuccess,
}) => {
  const { language } = useAuth();
  const t = translations[language]?.eventInvite || translations.en.eventInvite;

  const [activeTab, setActiveTab] = useState<'REGISTERED' | 'WHATSAPP'>('REGISTERED');
  const [listTab, setListTab] = useState<'REGISTERED' | 'WHATSAPP'>('REGISTERED');

  // Registered User States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RegisteredUser[]>([]);
  const [allEligibleUsers, setAllEligibleUsers] = useState<RegisteredUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<RegisteredUser[]>([]);

  // WhatsApp Guest States
  const [whatsappPhone, setWhatsAppPhone] = useState('');
  const [whatsappCountry, setWhatsAppCountry] = useState('+255');
  const [whatsappGuestName, setWhatsAppGuestName] = useState('');
  const [generatedInvitation, setGeneratedInvitation] = useState<any | null>(null);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Common States
  const [customNote, setCustomNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [eventDetails, setEventDetails] = useState<any | null>(null);

  // Already invited list
  const [existingInvitations, setExistingInvitations] = useState<ExistingInvitation[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(true);

  // Guest Quota Purchasing
  const [showBuyQuotaModal, setShowBuyQuotaModal] = useState(false);
  const [additionalGuestCount, setAdditionalGuestCount] = useState<number>(10);

  const isApproved = eventStatus === 'APPROVED';

  // Helper to retrieve auth header
  const getAuthHeader = useCallback(async () => {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  // Load existing invitations and event details
  const loadInvitations = useCallback(async () => {
    try {
      setLoadingExisting(true);
      const authHeader = await getAuthHeader();
      const res = await fetchWithRetry(`/api/events/${eventId}/invitations`, {
        headers: { ...authHeader },
      });
      if (res.ok) {
        const data = await res.json();
        setExistingInvitations(data.invitations || []);
        setEventDetails(data.event);
      }
    } catch (err) {
      console.error('Failed to load existing invitations:', err);
    } finally {
      setLoadingExisting(false);
    }
  }, [eventId, getAuthHeader]);

  useEffect(() => {
    if (eventId) {
      loadInvitations();
    }
  }, [eventId, loadInvitations]);

  // Load initial registered Dreamers users so the inviter immediately sees them
  const loadInitialUsers = useCallback(async () => {
    try {
      setSearching(true);
      const authHeader = await getAuthHeader();
      const res = await fetchWithRetry(`/api/users/search-eligible`, {
        headers: { ...authHeader },
      });
      if (res.ok) {
        const data: RegisteredUser[] = await res.json();
        setAllEligibleUsers(data);
        setSearchResults(data);
      }
    } catch (err) {
      console.error('Failed to load eligible users:', err);
    } finally {
      setSearching(false);
    }
  }, [getAuthHeader]);

  useEffect(() => {
    if (isApproved && !isFinished) {
      loadInitialUsers();
    }
  }, [isApproved, isFinished, loadInitialUsers]);

  // Live search when user types in the search query
  useEffect(() => {
    const queryStr = searchQuery.trim();
    if (!queryStr) {
      // Show all eligible users if query is empty
      setSearchResults(allEligibleUsers);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        setErrorMsg('');
        const authHeader = await getAuthHeader();
        const res = await fetchWithRetry(`/api/users/search-eligible?q=${encodeURIComponent(queryStr)}`, {
          headers: { ...authHeader },
        });
        if (res.ok) {
          const data: RegisteredUser[] = await res.json();
          setSearchResults(data);
        }
      } catch (err) {
        console.error('User search error:', err);
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, allEligibleUsers, getAuthHeader]);

  // Toggle user selection
  const handleToggleSelectUser = (user: RegisteredUser) => {
    const alreadySelected = selectedUsers.some((u) => u.id === user.id);
    if (alreadySelected) {
      setSelectedUsers(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      setSelectedUsers([...selectedUsers, user]);
    }
  };

  const handleRemoveSelected = (userId: number) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  // Send Invitations to selected registered users
  const handleSendInvitations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0) {
      setErrorMsg(language === 'sw' ? 'Tafadhali chagua angalau mtumiaji mmoja wa kualika.' : 'Please select at least one registered user to invite.');
      return;
    }

    if (!isApproved) {
      setErrorMsg(t.unverifiedWarning);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');

      const authHeader = await getAuthHeader();
      const res = await fetchWithRetry('/api/events/invitations/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({
          eventId,
          invitedUserIds: selectedUsers.map((u) => u.id),
          customNote: customNote.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (language === 'sw' ? 'Imeshindikana kutuma mialiko.' : 'Failed to send invitations.'));
      }

      setSuccessMsg(language === 'sw' ? `🎉 Mialiko ${data.sentCount} imetumwa kikamilifu!` : `🎉 Successfully sent ${data.sentCount} invitation(s)!`);
      setSelectedUsers([]);
      setCustomNote('');
      setSearchQuery('');

      // Refresh list of invitations and eligible users
      await loadInvitations();
      await loadInitialUsers();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || (language === 'sw' ? 'Hitilafu imetokea wakati wa kutuma mialiko.' : 'An error occurred while sending invitations.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Send WhatsApp Invitation to an unregistered guest
  const handleSendWhatsAppInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappPhone.trim()) {
      setErrorMsg(language === 'sw' ? 'Tafadhali weka namba ya simu ya WhatsApp.' : 'Please enter a WhatsApp phone number.');
      return;
    }

    if (!isApproved) {
      setErrorMsg(t.unverifiedWarning);
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');
      setSuccessMsg('');
      setGeneratedInvitation(null);

      const fullPhone = `${whatsappCountry}${whatsappPhone.replace(/\D/g, '')}`;
      const authHeader = await getAuthHeader();

      const res = await fetchWithRetry('/api/events/invitations/send-whatsapp', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...authHeader
        },
        body: JSON.stringify({
          eventId,
          phone: fullPhone,
          guestName: whatsappGuestName.trim() || undefined,
          customNote: customNote.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || (language === 'sw' ? 'Imeshindikana kutengeneza mwaliko wa WhatsApp.' : 'Failed to generate WhatsApp invitation.'));
      }

      if (data.duplicate) {
        setErrorMsg(t.duplicateWarning);
        setGeneratedInvitation(data.invitation);
        return;
      }

      setSuccessMsg(t.successLabel);
      setGeneratedInvitation(data.invitation);
      setWhatsAppPhone('');
      setWhatsAppGuestName('');

      // Refresh list of invitations
      await loadInvitations();

      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || (language === 'sw' ? 'Hitilafu imetokea wakati wa kutengeneza mwaliko.' : 'An error occurred while creating WhatsApp invitation.'));
    } finally {
      setSubmitting(false);
    }
  };

  const getClaimUrl = () => {
    if (!generatedInvitation) return '';
    return `${window.location.origin}/claim-invitation?token=${generatedInvitation.verificationToken}`;
  };

  const getWhatsAppMessageText = () => {
    if (!generatedInvitation || !eventDetails) return '';
    const claimUrl = getClaimUrl();
    const dateStr = eventDetails.eventDate || (language === 'sw' ? 'Itatangazwa' : 'To be announced');
    const timeStr = eventDetails.startTime ? `${eventDetails.startTime}${eventDetails.endTime ? ` - ${eventDetails.endTime}` : ''}` : (language === 'sw' ? 'Kama ilivyopangwa' : 'As scheduled');
    const venueStr = eventDetails.venueName || eventDetails.deliveryAddress || (language === 'sw' ? 'Ukumbi Rasmi' : 'Official Venue');
    const hostName = eventDetails.userName || (language === 'sw' ? 'Mwaandaji wa Tukio' : 'Event Organizer');

    if (language === 'sw') {
      return `Habari! Umealikwa Kipekee 🎉\n\n*${eventDetails.title}*\n\nUmepokea mwaliko rasmi wa kibinafsi kwa ajili ya tukio hili.\n\n📅 Tarehe: ${dateStr}\n🕐 Muda: ${timeStr}\n📍 Ukumbi / Mahali: ${venueStr}\n\nUmealikwa na: ${hostName}\n\nNamba ya Mwaliko: *${generatedInvitation.invitationCode}*\n\nFungua mwaliko wako & pakua kadi salama ya kuingilia:\n${claimUrl}\n\nTafadhali tumia link hiyo hapo juu kuthibitisha mahudhurio (RSVP) na kupakua kadi yako rasmi.`;
    }

    return `You're Invited 🎉\n\n*${eventDetails.title}*\n\nYou have received an official personal invitation to this event.\n\n📅 Date: ${dateStr}\n🕐 Time: ${timeStr}\n📍 Venue: ${venueStr}\n\nInvited by: ${hostName}\n\nInvitation Code: *${generatedInvitation.invitationCode}*\n\nView your invitation & download your secure entry pass:\n${claimUrl}\n\nPlease use the official link above to view, verify, and RSVP your invitation.`;
  };

  const getWhatsAppShareLink = () => {
    if (!generatedInvitation) return '#';
    const fullPhone = `${generatedInvitation.guestPhone || ''}`.replace(/\+/g, '').replace(/\s+/g, '');
    const text = encodeURIComponent(getWhatsAppMessageText());
    return `https://wa.me/${fullPhone}?text=${text}`;
  };

  const handleCopyMessage = () => {
    const text = getWhatsAppMessageText();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2000);
  };

  const handleCopyLinkOnly = () => {
    const link = getClaimUrl();
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const registeredInvitations = existingInvitations.filter(i => !i.isWhatsAppGuest);
  const whatsappInvitations = existingInvitations.filter(i => i.isWhatsAppGuest);

  // Set of already invited registered user IDs
  const alreadyInvitedUserIds = new Set(registeredInvitations.map(i => i.invitedUserId));

  return (
    <div className="fixed inset-0 z-[220] bg-black/85 backdrop-blur-md flex items-start sm:items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#131921] border border-gray-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-white my-auto max-h-[90dvh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-white rounded-full bg-slate-800 border border-slate-700 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center space-x-3 pb-4 border-b border-gray-800">
          <div className="p-3 bg-[#febd69]/10 border border-[#febd69]/40 rounded-2xl text-[#febd69]">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-white">{language === 'sw' ? 'Mualike Mtu' : 'Invite People'}</h3>
            <p className="text-xs text-gray-400">
              {language === 'sw' ? 'Tukio:' : 'Event:'} <span className="font-bold text-[#febd69]">{eventTitle}</span>
            </p>
          </div>
        </div>

        {/* Admin Verification Notice if NOT Approved */}
        {!isApproved && (
          <div className="mt-5 p-4 bg-amber-950/60 border border-amber-600/50 rounded-2xl flex items-start space-x-3 text-amber-200 text-xs">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-black text-sm text-amber-300">
                {language === 'sw' ? 'Inasubiri Idhini ya Msimamizi (Admin Approval)' : 'Admin Approval Required'}
              </div>
              <p className="mt-1 leading-relaxed text-amber-200/90">
                {t.unverifiedWarning}
              </p>
            </div>
          </div>
        )}

        {isFinished && (
          <div className="mt-5 p-4 bg-blue-950/60 border border-blue-600/50 rounded-2xl flex items-start space-x-3 text-blue-200 text-xs">
            <CheckCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-black text-sm text-blue-300">
                {language === 'sw' ? 'Tukio Limeshakamilika' : 'Event Concluded'}
              </div>
              <p className="mt-1 leading-relaxed text-blue-200/90">
                {t.concludedWarning}
              </p>
            </div>
          </div>
        )}

        {/* Alerts */}
        {errorMsg && (
          <div className="mt-4 p-3.5 bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-200 text-xs flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Guest Quota Bar */}
        {isApproved && !isFinished && (
          <div className="mt-4 p-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Paid Guest Invitation Quota</span>
              <div className="flex items-center space-x-3 mt-1">
                <span className="text-xs font-bold text-slate-300">
                  Purchased: <strong className="text-white">{eventDetails?.guestQuotaPurchased || 0}</strong>
                </span>
                <span className="text-xs font-bold text-slate-300">
                  Used: <strong className="text-amber-400">{eventDetails?.guestQuotaUsed || 0}</strong>
                </span>
                <span className="text-xs font-bold text-slate-300">
                  Remaining: <strong className={(eventDetails?.guestQuotaRemaining || 0) > 0 ? 'text-emerald-400' : 'text-rose-400'}>{eventDetails?.guestQuotaRemaining || 0}</strong>
                </span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="1"
                max="500"
                value={additionalGuestCount}
                onChange={(e) => setAdditionalGuestCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-center text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowBuyQuotaModal(true)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs rounded-xl shadow transition"
              >
                + Buy Guests ({additionalGuestCount * 500} TZS)
              </button>
            </div>
          </div>
        )}

        {/* Payment Modal for Guest Quota */}
        {showBuyQuotaModal && (
          <PaymentModal
            isOpen={showBuyQuotaModal}
            onClose={() => setShowBuyQuotaModal(false)}
            purpose="EVENT_INVITATION"
            relatedEntityType="EVENT"
            relatedEntityId={String(eventId)}
            amountExpected={additionalGuestCount * 500}
            title={`Buy ${additionalGuestCount} Guest Invitations`}
            subtitle={`Calculated: ${additionalGuestCount} guests × TZS 500 = ${(additionalGuestCount * 500).toLocaleString()} TZS`}
            onPaymentSuccess={() => {
              loadInvitations();
              setShowBuyQuotaModal(false);
            }}
          />
        )}

        {/* Tab Selection */}
        {isApproved && !isFinished && (
          <div className="flex bg-[#232f3e] p-1 rounded-2xl border border-gray-800 text-xs mb-6 mt-4">
            <button
              onClick={() => { setActiveTab('REGISTERED'); setGeneratedInvitation(null); setErrorMsg(''); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl font-black transition cursor-pointer flex items-center justify-center space-x-2 ${activeTab === 'REGISTERED' ? 'bg-[#febd69] text-slate-900 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <Users className="w-4 h-4" />
              <span>{t.inviteDreamers}</span>
            </button>
            <button
              onClick={() => { setActiveTab('WHATSAPP'); setGeneratedInvitation(null); setErrorMsg(''); setSuccessMsg(''); }}
              className={`flex-1 py-2.5 rounded-xl font-black transition cursor-pointer flex items-center justify-center space-x-2 ${activeTab === 'WHATSAPP' ? 'bg-[#febd69] text-slate-900 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              <MessageSquare className="w-4 h-4 text-[#25D366]" />
              <span>{t.inviteWhatsApp}</span>
            </button>
          </div>
        )}

        {/* TAB 1: FORM TO SEARCH & SELECT REGISTERED USERS */}
        {isApproved && !isFinished && activeTab === 'REGISTERED' && (
          <form onSubmit={handleSendInvitations} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider">
                  {language === 'sw' ? 'Tafuta Watumiaji Waliosajiliwa Dreamers' : 'Search Registered Dreamers Users'}
                </label>
                <button
                  type="button"
                  onClick={loadInitialUsers}
                  className="text-[10px] text-[#febd69] hover:underline flex items-center space-x-1 cursor-pointer"
                  title="Refresh users"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{language === 'sw' ? 'Onyesha Wote' : 'Browse All'}</span>
                </button>
              </div>

              {/* Search input field */}
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder={language === 'sw' ? 'Andika jina, barua pepe, au namba ya mtumiaji...' : 'Type user name, email, or identifier...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 bg-[#232f3e] border border-gray-700 text-white placeholder:text-gray-500 rounded-2xl text-xs font-bold outline-none focus:border-[#febd69] focus:ring-1 focus:ring-[#febd69]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-3.5 text-gray-400 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {searching && (
                <div className="text-[11px] text-[#febd69] font-bold mt-1.5 flex items-center space-x-1.5 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span>{language === 'sw' ? 'Inatafuta watumiaji wa Dreamers...' : 'Searching Dreamers user directory...'}</span>
                </div>
              )}

              {/* SEARCH RESULTS DISPLAYED IMMEDIATELY BELOW THE SEARCH FIELD */}
              <div className="mt-2.5">
                <div className="text-[10px] font-black uppercase tracking-wider text-gray-400 mb-1 flex items-center justify-between">
                  <span>{language === 'sw' ? 'Matokeo ya Watumiaji' : 'Search Results & Directory'} ({searchResults.length})</span>
                  <span className="text-gray-500 font-normal">{language === 'sw' ? 'Bofya mtumiaji kumchagua' : 'Click to toggle selection'}</span>
                </div>

                {searchResults.length === 0 ? (
                  <div className="p-4 bg-[#232f3e]/40 border border-gray-800 rounded-2xl text-center text-xs text-gray-400">
                    {searchQuery ? (
                      <span>{language === 'sw' ? `Hakuna mtumiaji aliyepatikana kwa "${searchQuery}"` : `No registered user found matching "${searchQuery}"`}</span>
                    ) : (
                      <span>{language === 'sw' ? 'Hakuna watumiaji wengine waliosajiliwa kwa sasa.' : 'No other registered users found in directory.'}</span>
                    )}
                  </div>
                ) : (
                  <div className="bg-[#232f3e] border border-gray-700 rounded-2xl p-2 max-h-56 overflow-y-auto space-y-1.5 shadow-xl divide-y divide-gray-800/40">
                    {searchResults.map((user) => {
                      const isInvited = alreadyInvitedUserIds.has(user.id);
                      const isSelected = selectedUsers.some((u) => u.id === user.id);

                      return (
                        <div
                          key={user.id}
                          onClick={() => {
                            if (!isInvited) {
                              handleToggleSelectUser(user);
                            }
                          }}
                          className={`p-2.5 rounded-xl flex items-center justify-between transition ${
                            isInvited 
                              ? 'opacity-50 bg-slate-900/40 cursor-not-allowed' 
                              : isSelected
                              ? 'bg-[#febd69]/15 border border-[#febd69]/40 cursor-pointer'
                              : 'hover:bg-slate-700/80 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center space-x-3 min-w-0 pr-2">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                              isSelected 
                                ? 'bg-[#febd69] text-slate-900' 
                                : 'bg-blue-600/30 border border-blue-400 text-blue-300'
                            }`}>
                              {user.fullName ? user.fullName[0].toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-white truncate flex items-center space-x-2">
                                <span>{user.fullName}</span>
                                {user.role && user.role !== 'CUSTOMER' && (
                                  <span className="px-1.5 py-0.2 bg-blue-950 text-blue-300 border border-blue-600/30 rounded text-[9px] font-black uppercase">
                                    {user.role}
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-[#febd69] font-mono font-bold truncate">
                                Dreamers ID: DRM-{user.id}
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0">
                            {isInvited ? (
                              <span className="text-[10px] font-bold text-gray-400 bg-gray-800 px-2 py-1 rounded-lg">
                                {language === 'sw' ? 'Amekwisha Alikwa' : 'Already Invited'}
                              </span>
                            ) : isSelected ? (
                              <span className="text-[11px] font-black text-[#febd69] bg-[#febd69]/20 border border-[#febd69]/50 px-2.5 py-1 rounded-xl flex items-center space-x-1 shadow-sm">
                                <Check className="w-3.5 h-3.5" />
                                <span>{language === 'sw' ? 'Amechaguliwa ✓' : 'Selected ✓'}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-300 bg-slate-800 hover:bg-[#febd69] hover:text-slate-900 border border-gray-600 px-2.5 py-1 rounded-xl flex items-center space-x-1 transition">
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>{language === 'sw' ? '+ Chagua' : '+ Select'}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SELECTED INVITEES CHIPS TRAY */}
            {selectedUsers.length > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-black uppercase text-[#febd69] tracking-wider">
                    {language === 'sw' ? 'Waalikwa Waliochaguliwa' : 'Selected Invitees'} ({selectedUsers.length})
                  </label>
                  <button
                    type="button"
                    onClick={() => setSelectedUsers([])}
                    className="text-[10px] text-gray-400 hover:text-red-400"
                  >
                    {language === 'sw' ? 'Ondoa Wote' : 'Clear All'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 p-3 bg-[#232f3e]/80 border border-gray-700 rounded-2xl max-h-32 overflow-y-auto">
                  {selectedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="inline-flex items-center space-x-2 px-3 py-1.5 bg-[#febd69]/20 border border-[#febd69]/50 text-[#febd69] rounded-xl text-xs font-bold"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{user.fullName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSelected(user.id)}
                        className="text-gray-400 hover:text-white transition cursor-pointer p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Optional Custom Note */}
            <div>
              <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1.5">
                {language === 'sw' ? 'Ujumbe wa Kibinafsi (Si lazima)' : 'Personal Invitation Note (Optional)'}
              </label>
              <textarea
                placeholder={language === 'sw' ? 'Andika ujumbe au salamu maalum kwa ajili ya waalikwa wako...' : 'Add a personalized greeting for your selected guests...'}
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                rows={2}
                className="w-full p-3.5 bg-[#232f3e] border border-gray-700 text-white placeholder:text-gray-500 rounded-2xl text-xs font-medium outline-none focus:border-[#febd69]"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting || selectedUsers.length === 0}
              className="w-full py-3.5 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-md cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>
                {submitting 
                  ? (language === 'sw' ? 'Inatuma Mialiko...' : 'Sending Official Invitations...') 
                  : (language === 'sw' ? `Tuma Mialiko Rasmi (${selectedUsers.length})` : `Send Official Invitations (${selectedUsers.length})`)}
              </span>
            </button>
          </form>
        )}

        {/* TAB 2: INVITE VIA WHATSAPP (FOR UNREGISTERED GUESTS) */}
        {isApproved && !isFinished && activeTab === 'WHATSAPP' && (
          <div className="space-y-4">
            {!generatedInvitation ? (
              <form onSubmit={handleSendWhatsAppInvitation} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* WhatsApp Contact Input */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1.5">
                      {t.enterPhone} *
                    </label>
                    <div className="flex">
                      <select
                        value={whatsappCountry}
                        onChange={(e) => setWhatsAppCountry(e.target.value)}
                        className="px-3 bg-[#232f3e] border-y border-l border-gray-700 text-white text-xs font-bold rounded-l-2xl outline-none focus:border-[#febd69]"
                      >
                        <option value="+255">+255 (TZ)</option>
                        <option value="+254">+254 (KE)</option>
                        <option value="+256">+256 (UG)</option>
                        <option value="+1">+1 (US)</option>
                        <option value="+44">+44 (UK)</option>
                      </select>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 712345678"
                        value={whatsappPhone}
                        onChange={(e) => setWhatsAppPhone(e.target.value)}
                        className="flex-1 px-4 py-3 bg-[#232f3e] border border-gray-700 text-white placeholder:text-gray-500 rounded-r-2xl text-xs font-bold outline-none focus:border-[#febd69]"
                      />
                    </div>
                  </div>

                  {/* Temporary Guest Label Name */}
                  <div>
                    <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1.5">
                      {t.guestName}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Baraka Mwangi"
                      value={whatsappGuestName}
                      onChange={(e) => setWhatsAppGuestName(e.target.value)}
                      className="w-full px-4 py-3 bg-[#232f3e] border border-gray-700 text-white placeholder:text-gray-500 rounded-2xl text-xs font-bold outline-none focus:border-[#febd69]"
                    />
                  </div>
                </div>

                {/* Custom Note */}
                <div>
                  <label className="block text-[11px] font-black uppercase text-gray-400 tracking-wider mb-1.5">
                    {language === 'sw' ? 'Ujumbe au Namba ya Meza (Si lazima)' : 'Personal Note or Table Number (Optional)'}
                  </label>
                  <textarea
                    placeholder={language === 'sw' ? 'Weka namba ya meza au maelekezo maalum...' : 'Enter any special notes, table numbers, or instructions...'}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    rows={2}
                    className="w-full p-3.5 bg-[#232f3e] border border-gray-700 text-white placeholder:text-gray-500 rounded-2xl text-xs font-medium outline-none focus:border-[#febd69]"
                  />
                </div>

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={submitting || !whatsappPhone.trim()}
                  className="w-full py-3.5 bg-[#febd69] hover:bg-[#f3a847] text-slate-900 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{submitting ? (language === 'sw' ? 'Inatengeneza Namba ya Mwaliko...' : 'Generating Secure Pass...') : t.generateBtn}</span>
                </button>
              </form>
            ) : (
              /* Success & Share Flow */
              <div className="p-5 bg-slate-900/90 border border-[#febd69]/50 rounded-3xl space-y-4">
                <div className="text-center space-y-1.5 pb-3 border-b border-gray-800">
                  <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500 flex items-center justify-center text-emerald-400 mx-auto text-xl font-black">
                    ✓
                  </div>
                  <h4 className="text-sm font-black uppercase text-white">
                    {language === 'sw' ? 'Kadi ya Mwaliko Imetengenezwa!' : 'Secure Pass Generated!'}
                  </h4>
                  <p className="text-xs text-gray-400 font-medium">
                    {language === 'sw' ? 'Namba ya mwaliko na link salama zimehifadhiwa tayari kushirikishwa.' : 'The invitation code and secure claims link are ready to share.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-gray-400 uppercase font-black">{t.codeLabel}</span>
                    <div className="text-base font-mono font-black text-[#febd69] mt-1">{generatedInvitation.invitationCode}</div>
                  </div>
                  <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800">
                    <span className="text-[10px] text-gray-400 uppercase font-black">{language === 'sw' ? 'Simu ya Mgeni' : 'Guest Phone'}</span>
                    <div className="text-xs font-mono font-bold text-white mt-1.5">{generatedInvitation.guestPhone}</div>
                  </div>
                </div>

                {/* Share message preview block */}
                <div className="p-3 bg-slate-950 border border-gray-800 rounded-2xl text-xs max-h-36 overflow-y-auto space-y-1.5 select-all">
                  <span className="text-[10px] text-gray-400 uppercase font-black block">
                    {language === 'sw' ? 'Ujumbe Uliotayarishwa wa Mwaliko' : 'Prepared Invitation Message'}
                  </span>
                  <p className="text-slate-300 font-sans leading-relaxed whitespace-pre-wrap text-[11px]">
                    {getWhatsAppMessageText()}
                  </p>
                </div>

                {/* Sharing actions */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
                  {/* Share on WhatsApp */}
                  <a
                    href={getWhatsAppShareLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 px-4 bg-[#25D366] hover:bg-[#20ba5a] text-slate-900 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition"
                  >
                    <Share2 className="w-4 h-4 shrink-0" />
                    <span>{t.shareWhatsApp}</span>
                  </a>

                  {/* Copy Message */}
                  <button
                    onClick={handleCopyMessage}
                    className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    {copiedMsg ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{language === 'sw' ? 'Imenakiliwa!' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>{t.copyMsg}</span>
                      </>
                    )}
                  </button>

                  {/* Copy Link Only */}
                  <button
                    onClick={handleCopyLinkOnly}
                    className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center space-x-1.5 transition cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>{language === 'sw' ? 'Link Imenakiliwa!' : 'Link Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>{t.copyLink}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Back button */}
                <div className="text-center pt-2">
                  <button
                    onClick={() => { setGeneratedInvitation(null); setCustomNote(''); }}
                    className="text-xs text-[#febd69] hover:underline font-black cursor-pointer"
                  >
                    ← {language === 'sw' ? 'Tengeneza Mwaliko Mwingine wa WhatsApp' : 'Create Another WhatsApp Invitation'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EXISTING INVITATIONS LIST */}
        <div className="mt-8 pt-6 border-t border-gray-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-gray-800/60">
            <h4 className="font-black text-xs uppercase tracking-wider text-gray-400 flex items-center space-x-1.5">
              <UserCheck className="w-4.5 h-4.5 text-[#febd69]" />
              <span>{language === 'sw' ? 'Orodha ya Waalikwa' : 'Admission Directories'} ({existingInvitations.length})</span>
            </h4>

            {/* List selector */}
            <div className="flex bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-[10px]">
              <button
                onClick={() => setListTab('REGISTERED')}
                className={`px-3 py-1.5 rounded-lg font-black transition cursor-pointer ${listTab === 'REGISTERED' ? 'bg-[#febd69] text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                Dreamers Users ({registeredInvitations.length})
              </button>
              <button
                onClick={() => setListTab('WHATSAPP')}
                className={`px-3 py-1.5 rounded-lg font-black transition cursor-pointer ${listTab === 'WHATSAPP' ? 'bg-[#febd69] text-slate-900' : 'text-slate-400 hover:text-white'}`}
              >
                WhatsApp Guests ({whatsappInvitations.length})
              </button>
            </div>
          </div>

          {loadingExisting ? (
            <div className="py-6 text-center text-xs text-gray-500 animate-pulse">
              {language === 'sw' ? 'Inapakia orodha ya wageni...' : 'Loading guest directories...'}
            </div>
          ) : (listTab === 'REGISTERED' ? registeredInvitations : whatsappInvitations).length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500 bg-[#232f3e]/30 rounded-2xl border border-gray-800">
              {language === 'sw' ? 'Bado hakuna mwaliko uliotumwa katika sehemu hii.' : 'No entries found in this directory.'}
            </div>
          ) : (
            <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
              {(listTab === 'REGISTERED' ? registeredInvitations : whatsappInvitations).map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 bg-[#232f3e]/80 border border-gray-700/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <div className="font-black text-white flex items-center flex-wrap gap-1.5">
                      <span>{inv.invitedUserName}</span>
                      <span className="font-mono text-[10px] text-[#febd69]">({inv.invitationCode})</span>
                      {inv.isWhatsAppGuest && (
                        <span className="px-1.5 py-0.5 rounded bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-[9px] font-black tracking-wider uppercase">
                          WhatsApp
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                      {inv.isWhatsAppGuest ? `Phone: ${inv.guestPhone}` : `Email: ${inv.invitedUserEmail}`}
                    </div>
                    {inv.isWhatsAppGuest && (
                      <div className="mt-1 flex items-center space-x-1">
                        <span className="text-[10px] text-gray-400 uppercase font-black">{t.claimStatus}:</span>
                        <span className={`text-[10px] font-black uppercase ${inv.claimStatus === 'CLAIMED' ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {inv.claimStatus}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {/* RSVP Status */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        inv.status === 'ACCEPTED'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : inv.status === 'DECLINED'
                          ? 'bg-red-950 text-red-300 border border-red-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {inv.status}
                    </span>

                    {/* Arrival Status */}
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        inv.arrivalStatus === 'ARRIVED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500'
                          : 'bg-slate-800 text-gray-400 border border-gray-700'
                      }`}
                    >
                      {inv.arrivalStatus === 'ARRIVED' ? '🟢 Arrived' : 'Pending'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default EventInviteModal;
