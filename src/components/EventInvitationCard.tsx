// src/components/EventInvitationCard.tsx
import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { jsPDF } from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Download, 
  CheckCircle, 
  XCircle, 
  X,
  FileText,
  Navigation,
  Map as MapIcon,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Map, AdvancedMarker, Pin, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useNotifications } from '../context/NotificationContext';

export interface EventInvitationData {
  id: number | string;
  invitationCode: string;
  verificationToken: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | string;
  arrivalStatus: 'PENDING' | 'ARRIVED' | string;
  arrivedAt?: string | null;
  invitedUserName: string;
  invitedUserEmail?: string;
  customNote?: string | null;
  createdAt?: string;
}

export interface EventData {
  id: number | string;
  title: string;
  category?: string;
  eventDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venueName?: string | null;
  deliveryAddress?: string | null;
  deliveryLatitude?: number | string | null;
  deliveryLongitude?: number | string | null;
  eventInstructions?: string | null;
  description?: string | null;
  userName?: string | null;
}

// Corner Blossom SVG Accent to match reference design
const FloralBlossom: React.FC<{ className?: string; flipped?: boolean; verticalFlipped?: boolean }> = ({ 
  className = "w-10 h-10", 
  flipped = false,
  verticalFlipped = false
}) => {
  const transform = `${flipped ? 'scaleX(-1) ' : ''}${verticalFlipped ? 'scaleY(-1)' : ''}`.trim() || undefined;
  return (
    <svg 
      viewBox="0 0 60 60" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      style={{ transform }}
    >
      {/* Olive green leaves */}
      <path d="M12 38C12 38 18 30 28 32C32 20 22 14 22 14C22 14 34 16 38 28C48 20 54 26 54 26C54 26 44 32 40 40C46 50 38 56 38 56C38 56 34 46 26 44C20 50 12 38 12 38Z" fill="#5F7A61" opacity="0.85" />
      <path d="M24 35C24 35 14 25 10 12C20 14 26 24 26 24" stroke="#465E47" strokeWidth="1.5" strokeLinecap="round" />
      {/* Big flower petals */}
      <circle cx="28" cy="22" r="7" fill="#F4A8B8" />
      <circle cx="38" cy="20" r="6" fill="#F6B6C4" />
      <circle cx="34" cy="30" r="7.5" fill="#F299AC" />
      <circle cx="22" cy="28" r="6" fill="#F8C0CC" />
      <circle cx="30" cy="24" r="3.5" fill="#FBBF24" />
      {/* Small secondary blossom */}
      <circle cx="46" cy="38" r="4.5" fill="#F4A8B8" />
      <circle cx="52" cy="42" r="4" fill="#F8C0CC" />
      <circle cx="48" cy="40" r="2" fill="#F59E0B" />
    </svg>
  );
};

// Divider with blossom accents and golden center diamond
const OrnamentalDivider: React.FC = () => (
  <div className="flex items-center justify-center space-x-3 my-2.5 px-6">
    <div className="flex items-center space-x-1.5">
      <div className="w-2.5 h-2.5 rounded-full bg-[#F4A8B8] shadow-xs" />
      <div className="w-8 sm:w-16 h-[1.5px] bg-gradient-to-r from-[#5F7A61] to-[#C5A059]" />
    </div>
    <div className="w-2.5 h-2.5 bg-[#C5A059] rotate-45 shadow-xs" />
    <div className="flex items-center space-x-1.5">
      <div className="w-8 sm:w-16 h-[1.5px] bg-gradient-to-r from-[#C5A059] to-[#5F7A61]" />
      <div className="w-2.5 h-2.5 rounded-full bg-[#F4A8B8] shadow-xs" />
    </div>
  </div>
);

interface EventLocationMapProps {
  venueName?: string | null;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  eventTitle: string;
}

const EventLocationMap: React.FC<EventLocationMapProps> = ({
  venueName,
  address,
  latitude,
  longitude,
  eventTitle,
}) => {
  const geocodingLib = useMapsLibrary('geocoding');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(() => {
    const lat = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : NaN;
    const lng = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : NaN;
    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
      return { lat, lng };
    }
    return null;
  });
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    const lat = latitude !== undefined && latitude !== null && latitude !== '' ? Number(latitude) : NaN;
    const lng = longitude !== undefined && longitude !== null && longitude !== '' ? Number(longitude) : NaN;
    if (!isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0)) {
      setCoords({ lat, lng });
      return;
    }

    const addressToGeocode = address?.trim() || venueName?.trim();
    if (!addressToGeocode || !geocodingLib) {
      return;
    }

    let isMounted = true;
    setIsGeocoding(true);
    const geocoder = new google.maps.Geocoder();
    const query = addressToGeocode.toLowerCase().includes('tanzania') 
      ? addressToGeocode 
      : `${addressToGeocode}, Tanzania`;

    geocoder.geocode({ address: query }, (results, status) => {
      if (!isMounted) return;
      setIsGeocoding(false);
      if (status === google.maps.GeocoderStatus.OK && results && results[0]?.geometry?.location) {
        const loc = results[0].geometry.location;
        setCoords({ lat: loc.lat(), lng: loc.lng() });
      }
    });

    return () => {
      isMounted = false;
    };
  }, [latitude, longitude, address, venueName, geocodingLib]);

  const venueDisplayName = venueName || address || eventTitle;

  return (
    <div className="p-4 bg-slate-900 border border-slate-700/80 rounded-2xl space-y-3 shadow-lg">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0" />
          <span className="font-bold text-white uppercase tracking-wider text-[11px]">
            Event Area & Venue Location
          </span>
        </div>
        {venueDisplayName && (
          <span className="text-[10px] text-gray-300 font-medium truncate max-w-[200px]">
            {venueDisplayName}
          </span>
        )}
      </div>

      <AnimatePresence mode="wait">
        {coords ? (
          <motion.div
            key="map-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full h-52 sm:h-60 rounded-xl overflow-hidden border border-slate-700 shadow-inner"
          >
            <Map
              defaultZoom={15}
              defaultCenter={coords}
              center={coords}
              mapId="DEMO_MAP_ID"
              internalUsageAttributionIds={["gmp_mcp_codeassist_v1_aistudio"]}
              className="w-full h-full"
              gestureHandling="greedy"
              zoomControl={true}
              mapTypeControl={false}
              streetViewControl={false}
              fullscreenControl={true}
            >
              <AdvancedMarker position={coords} title={venueDisplayName}>
                <Pin background={'#D4AF37'} borderColor={'#78350F'} glyphColor={'#0F172A'} />
              </AdvancedMarker>
            </Map>

            <div className="absolute bottom-2.5 left-2.5 right-2.5 bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 px-3 py-1.5 rounded-xl text-[11px] flex items-center justify-between pointer-events-none shadow-md">
              <div className="flex items-center space-x-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></span>
                <span className="font-bold text-white truncate">{venueDisplayName}</span>
              </div>
              <span className="text-[9px] text-[#D4AF37] font-black uppercase shrink-0 ml-2">Event Pin</span>
            </div>
          </motion.div>
        ) : isGeocoding ? (
          <div className="w-full h-32 rounded-xl bg-slate-800/60 border border-slate-700 flex flex-col items-center justify-center p-4 text-center space-y-2">
            <div className="w-5 h-5 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-slate-300 font-medium">Locating event venue on Google Maps...</p>
          </div>
        ) : (
          <div className="w-full p-4 rounded-xl bg-slate-800/60 border border-dashed border-slate-700 text-center space-y-1">
            <MapPin className="w-5 h-5 text-gray-400 mx-auto" />
            <p className="text-xs font-bold text-slate-200">Venue Map Pin</p>
            <p className="text-[11px] text-slate-400">
              {address || venueName 
                ? `Venue: ${venueName ? venueName + ' - ' : ''}${address || ''}` 
                : 'Official Venue details specified in invitation.'}
            </p>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface EventInvitationCardProps {
  invitation: EventInvitationData;
  event: EventData;
  isGuestView?: boolean;
  onRsvp?: (action: 'ACCEPT' | 'DECLINE') => Promise<void>;
  onClose?: () => void;
}

export const EventInvitationCard: React.FC<EventInvitationCardProps> = ({
  invitation,
  event,
  isGuestView = false,
  onRsvp,
  onClose,
}) => {
  const { showToast } = useNotifications();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [showLocationMap, setShowLocationMap] = useState(false);

  useEffect(() => {
    // Generate high-reliability standards-compliant QR code with error correction level H (30% recovery)
    const token = invitation.verificationToken || invitation.invitationCode;
    QRCode.toDataURL(token, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#0B1320',
        light: '#FFFFFF',
      },
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.warn('QR code generation notice:', err));
  }, [invitation.verificationToken, invitation.invitationCode]);

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      // Standard 9:16 portrait ratio card format (135mm x 240mm)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [135, 240],
      });

      // 1. Card Background - Elegant Ivory / Warm Cream (#FAF7EE)
      doc.setFillColor(250, 247, 238);
      doc.rect(0, 0, 135, 240, 'F');

      // 2. Double Gold Frame Border
      doc.setDrawColor(197, 160, 89); // Outer Gold #C5A059
      doc.setLineWidth(0.8);
      doc.rect(6, 6, 123, 228);
      doc.setLineWidth(0.3);
      doc.rect(8, 8, 119, 224);

      // 3. Top Midnight Navy Banner (#0E1626)
      doc.setFillColor(14, 22, 38);
      doc.rect(9, 9, 117, 28, 'F');

      // Top Header Title: Dreamers (Serif Bold)
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('times', 'bold');
      doc.text('Dreamers', 67.5, 22, { align: 'center' });

      // Tagline in Gold
      doc.setTextColor(229, 184, 105);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('CONNECT  •  CELEBRATE  •  TOGETHER', 67.5, 29, { align: 'center' });

      // 4. Invitation Lead Text
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('YOU ARE CORDIALLY INVITED TO', 67.5, 45, { align: 'center' });

      // 5. Event Title
      doc.setTextColor(14, 22, 38);
      doc.setFontSize(18);
      doc.setFont('times', 'bold');
      const splitTitle = doc.splitTextToSize(event.title || 'Event Celebration', 105);
      doc.text(splitTitle, 67.5, 54, { align: 'center' });

      // Ornamental Divider Line with Diamond
      doc.setDrawColor(197, 160, 89);
      doc.setLineWidth(0.4);
      doc.line(35, 62, 63, 62);
      doc.line(72, 62, 100, 62);
      doc.setFillColor(197, 160, 89);
      doc.rect(66.5, 61, 2, 2, 'F');

      // Category Pill (#0E1626 background with Gold text)
      doc.setFillColor(14, 22, 38);
      doc.roundedRect(48, 67, 39, 7.5, 3.5, 3.5, 'F');
      doc.setTextColor(229, 184, 105);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text((event.category || 'BIRTHDAY').toUpperCase(), 67.5, 72, { align: 'center' });

      // 6. Invited Guest Container Card
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 216, 195);
      doc.setLineWidth(0.4);
      doc.roundedRect(14, 79, 107, 28, 3, 3, 'FD');

      // Golden Header Bar on Guest Card
      doc.setFillColor(212, 175, 55);
      doc.roundedRect(14, 79, 107, 7.5, 3, 3, 'F');
      doc.rect(14, 83, 107, 3.5, 'F'); // square bottom of banner
      doc.setTextColor(66, 32, 6);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text('I N V I T E D   G U E S T', 67.5, 84, { align: 'center' });

      // Guest Name (Prominent Serif)
      doc.setTextColor(14, 22, 38);
      doc.setFontSize(14);
      doc.setFont('times', 'bold');
      doc.text(invitation.invitedUserName || 'Honored Guest', 67.5, 95, { align: 'center' });

      // Dreamers ID Subtitle
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      const guestIdString = `Dreamers ID: DRM-${invitation.id || '19'}`;
      doc.text(guestIdString, 67.5, 101.5, { align: 'center' });

      // 7. Event Details 3-Column Box (Date, Time, Location)
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 216, 195);
      doc.roundedRect(14, 111, 107, 18, 3, 3, 'FD');

      // Vertical dividers inside box
      doc.setDrawColor(226, 216, 195);
      doc.line(49, 113, 49, 127);
      doc.line(85, 113, 85, 127);

      // Col 1: DATE
      doc.setTextColor(163, 131, 70);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('DATE', 31.5, 116.5, { align: 'center' });
      doc.setTextColor(14, 22, 38);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.text(event.eventDate || '2026-10-21', 31.5, 123.5, { align: 'center', maxWidth: 30 });

      // Col 2: TIME
      doc.setTextColor(163, 131, 70);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('TIME', 67, 116.5, { align: 'center' });
      doc.setTextColor(14, 22, 38);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      const timeStr = event.startTime ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}` : '18:00 - 22:00';
      doc.text(timeStr, 67, 123.5, { align: 'center', maxWidth: 32 });

      // Col 3: LOCATION
      doc.setTextColor(163, 131, 70);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.text('LOCATION', 102, 116.5, { align: 'center' });
      doc.setTextColor(14, 22, 38);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      const locationStr = event.venueName || event.deliveryAddress || 'Mwanza Jubilee';
      doc.text(locationStr, 102, 123.5, { align: 'center', maxWidth: 30 });

      // Hosted By Row
      doc.setTextColor(140, 115, 62);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text(`HOSTED BY: ${event.userName || 'Event Organizer'}`, 67.5, 134, { align: 'center' });

      // 8. Invitation Verification Dark Container (#0E1626)
      doc.setFillColor(14, 22, 38);
      doc.roundedRect(14, 139, 107, 72, 4, 4, 'F');
      doc.setDrawColor(30, 41, 59);
      doc.setLineWidth(0.6);
      doc.roundedRect(14, 139, 107, 72, 4, 4, 'D');

      // Title
      doc.setTextColor(229, 184, 105);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('INVITATION VERIFICATION', 67.5, 147, { align: 'center' });

      // Left Box: Pure White QR Code Container
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(19, 151, 46, 46, 3, 3, 'F');
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', 21, 153, 42, 42);
      }
      doc.setTextColor(148, 163, 184);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Scan to verify invitation', 42, 202.5, { align: 'center' });

      // Right Box: Invitation Code & Pass Box
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(70, 151, 46, 46, 3, 3, 'F');

      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('INVITATION CODE', 93, 161, { align: 'center' });

      doc.setTextColor(14, 22, 38);
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.text(invitation.invitationCode || 'INV-4AB8D818', 93, 175, { align: 'center' });

      doc.setTextColor(16, 185, 129);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      const passBadgeText = invitation.arrivalStatus === 'ARRIVED' ? 'VERIFIED: ARRIVED' : 'SECURE PASS';
      doc.text(passBadgeText, 93, 189, { align: 'center' });

      // 9. Card Footer
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.text('DREAMERS  •  MORE THAN AN APP', 67.5, 223, { align: 'center' });

      doc.save(`Dreamers_Invitation_${invitation.invitationCode || 'Pass'}.pdf`);
      showToast('PDF Downloaded', 'Invitation card PDF downloaded successfully!', 'success');
    } catch (err) {
      console.warn('Failed to generate PDF:', err);
      showToast('PDF Error', 'Could not generate PDF. Please try again.', 'error');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleRsvpAction = async (action: 'ACCEPT' | 'DECLINE') => {
    if (!onRsvp) return;
    try {
      setRsvpLoading(true);
      await onRsvp(action);
    } finally {
      setRsvpLoading(false);
    }
  };

  const isArrived = invitation.arrivalStatus === 'ARRIVED';
  const timeDisplay = event.startTime 
    ? `${event.startTime}${event.endTime ? ` - ${event.endTime}` : ''}` 
    : '18:54 - 18:54';

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center space-y-4">
      {/* =========================================================================
          AUTHENTIC INVITATION CARD (Exact Match to Reference Image)
          ========================================================================= */}
      <div 
        id="dreamers-invitation-card"
        className="relative w-full max-w-[440px] sm:max-w-[460px] bg-[#FAF7EE] border-[2.5px] border-[#C5A059] rounded-[2rem] p-2.5 sm:p-3 shadow-2xl text-slate-900 select-text overflow-hidden transition-all"
      >
        {/* Inner Gold Thin Inset Border */}
        <div className="relative w-full h-full border border-[#D4AF37]/50 rounded-[1.6rem] p-3 sm:p-4 flex flex-col justify-between overflow-hidden bg-[#FAF7EE]">
          
          {/* Corner Floral Blossoms */}
          <FloralBlossom className="absolute top-1 left-1 w-10 h-10 sm:w-12 sm:h-12 pointer-events-none z-10" />
          <FloralBlossom className="absolute top-1 right-1 w-10 h-10 sm:w-12 sm:h-12 pointer-events-none z-10" flipped />
          <FloralBlossom className="absolute bottom-1 left-1 w-10 h-10 sm:w-12 sm:h-12 pointer-events-none z-10" verticalFlipped />
          <FloralBlossom className="absolute bottom-1 right-1 w-10 h-10 sm:w-12 sm:h-12 pointer-events-none z-10" flipped verticalFlipped />

          {/* Close button if modal provided */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-900/80 hover:bg-slate-900 transition cursor-pointer z-20"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* 1. TOP NAVY HEADER BANNER */}
          <div className="relative w-full bg-[#0E1626] rounded-xl sm:rounded-2xl py-5 px-3 text-center text-white shadow-md overflow-hidden">
            {/* Header left/right flower sprays */}
            <div className="absolute left-2 top-1/2 -translate-y-1/2 opacity-75 hidden xs:block pointer-events-none">
              <FloralBlossom className="w-8 h-8" />
            </div>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-75 hidden xs:block pointer-events-none">
              <FloralBlossom className="w-8 h-8" flipped />
            </div>

            <h1 className="font-serif text-3xl sm:text-4xl font-black tracking-wide text-white drop-shadow-xs">
              Dreamers
            </h1>
            <p className="text-[#E5B869] text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] mt-1">
              CONNECT • CELEBRATE • TOGETHER
            </p>
          </div>

          {/* 2. INVITATION LEAD & EVENT TITLE */}
          <div className="text-center pt-5 pb-1">
            <p className="text-[#64748B] text-[10px] sm:text-[11px] font-black uppercase tracking-[0.18em]">
              YOU ARE CORDIALLY INVITED TO
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl font-black text-[#0E1626] tracking-tight mt-1 leading-tight px-2 break-words">
              {event.title || 'All'}
            </h2>

            {/* Ornamental Floral Divider */}
            <OrnamentalDivider />

            {/* Event Category Pill */}
            <div className="flex justify-center mt-1">
              <span className="inline-block bg-[#0E1626] text-[#E5B869] text-[10px] sm:text-xs font-black uppercase tracking-[0.22em] px-5 py-1 rounded-full shadow-sm">
                {(event.category || 'BIRTHDAY').toUpperCase()}
              </span>
            </div>
          </div>

          {/* 3. INVITED GUEST CARD */}
          <div className="mt-4 bg-white border border-[#E2D8C3] rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-gradient-to-r from-[#C5A059] via-[#D4AF37] to-[#C5A059] py-1 text-center text-[#3D2605] text-[10px] sm:text-xs font-black uppercase tracking-[0.22em]">
              INVITED GUEST
            </div>
            <div className="p-3 text-center space-y-0.5">
              <h3 className="font-serif text-xl sm:text-2xl font-black text-[#0E1626] tracking-tight">
                {invitation.invitedUserName || 'Honored Guest'}
              </h3>
              <p className="text-[#64748B] text-xs font-bold">
                Dreamers ID: DRM-{invitation.id || '19'}
              </p>
            </div>
          </div>

          {/* 4. DATE, TIME, LOCATION 3-COLUMN BOX */}
          <div className="mt-3 bg-white border border-[#E2D8C3] rounded-2xl p-3 sm:p-3.5 shadow-xs">
            <div className="grid grid-cols-3 divide-x divide-[#E2D8C3] text-center">
              <div className="px-1.5">
                <span className="text-[#A38346] text-[9px] sm:text-[10px] font-black uppercase tracking-wider block">
                  DATE
                </span>
                <span className="text-[#0E1626] text-xs sm:text-[13px] font-black mt-1 block truncate">
                  {event.eventDate || '2026-10-21'}
                </span>
              </div>
              <div className="px-1.5">
                <span className="text-[#A38346] text-[9px] sm:text-[10px] font-black uppercase tracking-wider block">
                  TIME
                </span>
                <span className="text-[#0E1626] text-xs sm:text-[13px] font-black mt-1 block truncate">
                  {timeDisplay}
                </span>
              </div>
              <div className="px-1.5">
                <span className="text-[#A38346] text-[9px] sm:text-[10px] font-black uppercase tracking-wider block">
                  LOCATION
                </span>
                <span className="text-[#0E1626] text-xs sm:text-[13px] font-black mt-1 block truncate">
                  {event.venueName || event.deliveryAddress || 'Mwanza jubilee'}
                </span>
              </div>
            </div>
          </div>

          {/* Hosted By Label */}
          <p className="text-[#8C733E] text-[10px] sm:text-[11px] font-black uppercase tracking-widest text-center mt-2.5">
            HOSTED BY: {event.userName || 'Event Organizer'}
          </p>

          {/* 5. INVITATION VERIFICATION DARK CARD */}
          <div className="mt-3 bg-[#0E1626] border-2 border-[#1E293B] rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 text-center shadow-md">
            <h4 className="text-[#E5B869] text-xs sm:text-[13px] font-black uppercase tracking-[0.18em] pb-2.5">
              INVITATION VERIFICATION
            </h4>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 items-stretch">
              {/* QR Code Container (Left) */}
              <div className="flex flex-col items-center">
                <div className="w-full aspect-square bg-white rounded-xl sm:rounded-2xl p-2 sm:p-2.5 shadow-sm flex items-center justify-center">
                  {qrDataUrl ? (
                    <img 
                      src={qrDataUrl} 
                      alt="Verification QR Code" 
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 rounded-lg animate-pulse flex items-center justify-center text-[9px] text-slate-400 font-bold">
                      Loading QR...
                    </div>
                  )}
                </div>
                <span className="text-slate-400 text-[8.5px] sm:text-[9.5px] font-medium mt-1.5 block">
                  Scan to verify invitation
                </span>
              </div>

              {/* Code & Pass Badge Container (Right) */}
              <div className="bg-white rounded-xl sm:rounded-2xl p-2.5 sm:p-3 shadow-sm flex flex-col items-center justify-between text-center min-h-[120px]">
                <span className="text-[#64748B] text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
                  INVITATION CODE
                </span>

                <div className="font-mono text-xs sm:text-sm font-black text-[#0E1626] tracking-wider select-all break-all my-auto px-1 py-1 bg-slate-50 rounded-lg border border-slate-200/60 w-full">
                  {invitation.invitationCode || 'INV-4AB8D818'}
                </div>

                <div className="w-full">
                  {isArrived ? (
                    <span className="block text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100/90 py-1 px-2 rounded-full border border-emerald-300">
                      ✓ ARRIVED
                    </span>
                  ) : (
                    <span className="block text-[8.5px] sm:text-[9.5px] font-black uppercase tracking-widest text-[#059669] bg-emerald-50 py-1 px-2 rounded-full border border-emerald-200">
                      SECURE PASS
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 6. CARD FOOTER */}
          <div className="text-center pt-3 pb-1">
            <p className="text-[#64748B] text-[9.5px] sm:text-[10.5px] font-black uppercase tracking-[0.22em]">
              DREAMERS  •  MORE THAN AN APP
            </p>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE CONTROLS (RSVP, Location Map, PDF Download)
          ========================================================================= */}
      <div className="w-full max-w-[440px] sm:max-w-[460px] space-y-3">
        {/* RSVP Actions if viewing own invite */}
        {isGuestView && invitation.status !== 'REVOKED' && (
          <div className="p-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-center space-y-3 shadow-lg">
            <div className="text-xs font-bold text-slate-300">
              Your RSVP Status:{' '}
              <span
                className={`font-black uppercase px-2 py-0.5 rounded-md ${
                  invitation.status === 'ACCEPTED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : invitation.status === 'DECLINED'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {invitation.status}
              </span>
            </div>

            <div className="flex items-center justify-center gap-2.5">
              <button
                onClick={() => handleRsvpAction('ACCEPT')}
                disabled={rsvpLoading || invitation.status === 'ACCEPTED'}
                className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition cursor-pointer shadow-md"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{invitation.status === 'ACCEPTED' ? 'Attending Confirmed' : 'Accept & Attend'}</span>
              </button>
              <button
                onClick={() => handleRsvpAction('DECLINE')}
                disabled={rsvpLoading || invitation.status === 'DECLINED'}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center space-x-1.5 transition cursor-pointer border border-slate-700"
              >
                <XCircle className="w-4 h-4" />
                <span>Decline</span>
              </button>
            </div>
          </div>
        )}

        {/* Toggle Interactive Google Map for Venue */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setShowLocationMap(!showLocationMap)}
            className="w-full py-2.5 px-4 bg-slate-900/80 hover:bg-slate-800/90 text-slate-200 border border-slate-700/70 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-between transition cursor-pointer"
          >
            <span className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-[#D4AF37]" />
              <span>{showLocationMap ? 'Hide Venue Map' : 'View Venue Map & Directions'}</span>
            </span>
            {showLocationMap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showLocationMap && (
            <EventLocationMap
              venueName={event.venueName}
              address={event.deliveryAddress}
              latitude={event.deliveryLatitude}
              longitude={event.deliveryLongitude}
              eventTitle={event.title}
            />
          )}
        </div>

        {/* Action Buttons: PDF Download & Close */}
        <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
          <button
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="w-full flex-1 py-3.5 px-6 bg-gradient-to-r from-[#C5A059] via-[#D4AF37] to-[#C5A059] hover:brightness-110 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition shadow-lg shadow-[#D4AF37]/25 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>{isGeneratingPdf ? 'Generating PDF...' : 'Download Invitation PDF'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="w-full sm:w-auto py-3.5 px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition cursor-pointer border border-slate-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventInvitationCard;
