// src/components/QRScanner.tsx
import React, { useEffect, useRef, useState, useCallback, useId } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats, Html5QrcodeCameraScanConfig } from 'html5-qrcode';
import { Camera, X, RefreshCw, AlertCircle, CheckCircle, VideoOff, ShieldAlert, Zap, ZapOff } from 'lucide-react';
import { Language, getTranslation } from '../lib/translations';

interface QRScannerProps {
  onScan: (decodedText: string) => void;
  onClose: () => void;
  language: Language;
  isPaused?: boolean;
  isLoading?: boolean;
  result?: {
    success: boolean;
    message: string;
    guestName?: string;
    alreadyArrived?: boolean;
  } | null;
  onScanAgain?: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ 
  onScan, 
  onClose, 
  language, 
  isPaused = false, 
  isLoading = false,
  result = null,
  onScanAgain
}) => {
  // Stable unique element ID for html5-qrcode
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const elementIdRef = useRef<string>(`qr-reader-${reactId}`);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const isStartingRef = useRef<boolean>(false);
  const isStoppingRef = useRef<boolean>(false);
  const isProcessingScanRef = useRef<boolean>(false);
  const activeTrackRef = useRef<MediaStreamTrack | null>(null);

  // Keep latest props in refs to prevent unnecessary scanner re-initialization on parent re-renders
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  const resultRef = useRef(result);
  resultRef.current = result;

  const languageRef = useRef(language);
  languageRef.current = language;

  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'permission' | 'notFound' | 'inUse' | 'insecure' | 'generic' | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isInitializing, setIsInitializing] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const t = useCallback((key: string) => getTranslation(language, 'scanner', key), [language]);

  // Safe stop and release of camera hardware
  const stopAndClearScanner = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    // Turn off torch if active
    if (activeTrackRef.current) {
      try {
        const capabilities: any = activeTrackRef.current.getCapabilities?.() || {};
        if (capabilities.torch) {
          await (activeTrackRef.current as any).applyConstraints({
            advanced: [{ torch: false }]
          });
        }
      } catch (e) {}
      activeTrackRef.current = null;
    }

    const scanner = scannerRef.current;
    if (scanner) {
      try {
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {
        console.warn('QR Scanner stop notice:', err);
      }

      try {
        await scanner.clear();
      } catch (err) {
        console.warn('QR Scanner clear notice:', err);
      }

      scannerRef.current = null;
    }

    if (isMountedRef.current) {
      setIsCameraActive(false);
      setIsTorchOn(false);
      setIsTorchSupported(false);
    }
    isStoppingRef.current = false;
  }, []);

  // Lightweight Pause / Resume handling on prop changes WITHOUT tearing down camera stream
  useEffect(() => {
    const scanner = scannerRef.current;
    if (!scanner || !scanner.isScanning) return;

    if (isPaused || isLoading || !!result) {
      try {
        scanner.pause(true);
      } catch (e) {}
    } else if (!isProcessingScanRef.current) {
      try {
        scanner.resume();
      } catch (e) {}
    }
  }, [isPaused, isLoading, result]);

  // Toggle Torch / Flashlight on supported devices
  const toggleTorch = async () => {
    if (!activeTrackRef.current || !isTorchSupported) return;
    try {
      const nextState = !isTorchOn;
      await (activeTrackRef.current as any).applyConstraints({
        advanced: [{ torch: nextState }]
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle notice:', err);
    }
  };

  // Helper to extract clean token
  const normalizeQrPayload = (rawPayload: string): string => {
    const trimmed = rawPayload.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.token) return String(parsed.token).trim();
        if (parsed.verificationToken) return String(parsed.verificationToken).trim();
        if (parsed.code) return String(parsed.code).trim();
        if (parsed.invitationCode) return String(parsed.invitationCode).trim();
      } catch (e) {}
    }

    if (trimmed.includes('token=')) {
      try {
        const urlObj = new URL(trimmed);
        const tokenParam = urlObj.searchParams.get('token');
        if (tokenParam) return tokenParam.trim();
      } catch (e) {}
    }

    return trimmed;
  };

  // Main start scanner routine
  const startScanner = useCallback(async (userTriggered = false) => {
    if (!isMountedRef.current || isStartingRef.current) return;

    // Check secure context
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setErrorType('insecure');
      setError(
        languageRef.current === 'sw'
          ? 'Kamera inahitaji muunganisho salama wa HTTPS. Tafadhali fungua tovuti kwa HTTPS.'
          : 'Camera access requires a secure HTTPS connection. Please use HTTPS.'
      );
      setIsInitializing(false);
      return;
    }

    try {
      isStartingRef.current = true;
      setIsInitializing(true);
      setError(null);
      setErrorType(null);
      isProcessingScanRef.current = false;

      // Clean up previous instance cleanly
      await stopAndClearScanner();

      if (!isMountedRef.current) {
        isStartingRef.current = false;
        return;
      }

      // If user clicked Retry, request getUserMedia directly first to prompt native permission popup
      if (userTriggered && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const testStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } }
          });
          // Immediately release test tracks so Html5Qrcode can bind
          testStream.getTracks().forEach(t => t.stop());
        } catch (promptErr: any) {
          console.warn('Native permission prompt notice:', promptErr);
        }
      }

      const elementId = elementIdRef.current;
      let domContainer = document.getElementById(elementId);
      if (!domContainer) {
        await new Promise((resolve) => setTimeout(resolve, 80));
        domContainer = document.getElementById(elementId);
      }

      if (!isMountedRef.current || !domContainer) {
        isStartingRef.current = false;
        return;
      }

      // Initialize Html5Qrcode
      const html5QrCode = new Html5Qrcode(elementId, {
        verbose: false,
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
      });
      scannerRef.current = html5QrCode;

      // Generous responsive scanning zone (75% minEdge, minimum 200px)
      const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
        const edge = Math.min(viewfinderWidth || 300, viewfinderHeight || 300);
        const qrboxSize = Math.max(200, Math.floor(edge * 0.75));
        return {
          width: qrboxSize,
          height: qrboxSize,
        };
      };

      const scanConfig: Html5QrcodeCameraScanConfig = {
        fps: 20,
        qrbox: qrboxFunction,
        aspectRatio: undefined,
        disableFlip: false,
      };

      const handleSuccess = (decodedText: string) => {
        if (!isMountedRef.current) return;
        
        // Single-execution guard: if already processing a scan, paused, loading, or displaying result, block additional frames immediately
        if (
          isProcessingScanRef.current || 
          isPausedRef.current || 
          isLoadingRef.current || 
          resultRef.current
        ) {
          return;
        }

        const cleanToken = normalizeQrPayload(decodedText);
        if (!cleanToken) return;

        // Lock processing
        isProcessingScanRef.current = true;

        // Immediately pause decoder to stop camera frame CPU processing
        try {
          html5QrCode.pause(true);
        } catch (e) {}

        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(80);
          } catch (e) {}
        }

        // Fire scan handler asynchronously without blocking UI frame
        Promise.resolve().then(() => {
          if (onScanRef.current) {
            onScanRef.current(cleanToken);
          }
        });
      };

      const handleError = () => {
        // Normal non-matching frame callback
      };

      // 1. Try standard environment (rear) camera
      try {
        await html5QrCode.start(
          { facingMode: 'environment' },
          scanConfig,
          handleSuccess,
          handleError
        );
      } catch (envErr: any) {
        console.warn('Environment camera start notice, attempting front/user camera or device list:', envErr?.message || envErr);

        // 2. Try user (front/webcam) camera
        try {
          await html5QrCode.start(
            { facingMode: 'user' },
            scanConfig,
            handleSuccess,
            handleError
          );
        } catch (userErr: any) {
          // 3. Fallback to camera enumeration
          const cameras = await Html5Qrcode.getCameras().catch(() => []);
          if (!isMountedRef.current) {
            await html5QrCode.stop().catch(() => {});
            return;
          }

          if (cameras && cameras.length > 0) {
            await html5QrCode.start(
              cameras[0].id,
              scanConfig,
              handleSuccess,
              handleError
            );
          } else {
            throw envErr || userErr;
          }
        }
      }

      // Check track capabilities for continuous focus and torch support
      if (isMountedRef.current) {
        try {
          const videoElem = document.querySelector(`#${elementId} video`) as HTMLVideoElement;
          if (videoElem && videoElem.srcObject) {
            const stream = videoElem.srcObject as MediaStream;
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
              activeTrackRef.current = videoTrack;
              const capabilities: any = videoTrack.getCapabilities?.() || {};

              // Auto-enable continuous autofocus & exposure where supported
              if (capabilities.focusMode?.includes('continuous') || capabilities.exposureMode?.includes('continuous')) {
                const advancedConstraints: any = {};
                if (capabilities.focusMode?.includes('continuous')) advancedConstraints.focusMode = 'continuous';
                if (capabilities.exposureMode?.includes('continuous')) advancedConstraints.exposureMode = 'continuous';
                videoTrack.applyConstraints({ advanced: [advancedConstraints] }).catch(() => {});
              }

              if (capabilities.torch) {
                setIsTorchSupported(true);
              }
            }
          }
        } catch (e) {}

        setPermissionStatus('granted');
        setIsCameraActive(true);
        setIsInitializing(false);
      }
    } catch (err: any) {
      console.warn('QR Scanner initialization error:', err?.name, err?.message || err);

      if (!isMountedRef.current) return;

      const errStr = (err?.name || '') + ' ' + (err?.message || '') + ' ' + String(err);
      const isDenied = 
        err?.name === 'NotAllowedError' || 
        err?.name === 'PermissionDeniedError' || 
        errStr.includes('NotAllowedError') || 
        errStr.includes('Permission denied') ||
        errStr.includes('permission');

      const isNotFound = 
        err?.name === 'NotFoundError' || 
        err?.name === 'DevicesNotFoundError' || 
        errStr.includes('NotFoundError') || 
        errStr.includes('No camera');

      const isInUse = 
        err?.name === 'NotReadableError' || 
        err?.name === 'TrackStartError' || 
        errStr.includes('NotReadableError') || 
        errStr.includes('Could not start video source');

      if (isDenied) {
        setPermissionStatus('denied');
        setErrorType('permission');
        setError(t('permissionDenied'));
      } else if (isNotFound) {
        setErrorType('notFound');
        setError(t('noCamera') || 'No camera detected on this device.');
      } else if (isInUse) {
        setErrorType('inUse');
        setError(
          languageRef.current === 'sw'
            ? 'Kamera inatumiwa na programu nyingine. Tafadhali funga programu hiyo kisha ujaribu tena.'
            : 'Camera is currently in use by another application. Please close other camera apps and retry.'
        );
      } else {
        setErrorType('generic');
        setError(
          languageRef.current === 'sw'
            ? 'Haikuweza kuwasha kamera. Tafadhali bonyeza Jaribu Tena.'
            : 'Unable to start camera. Please tap Retry Camera.'
        );
      }

      setIsCameraActive(false);
      setIsInitializing(false);
    } finally {
      isStartingRef.current = false;
    }
  }, [stopAndClearScanner, t]);

  // Mount / Unmount lifecycle runs strictly once on component mount
  useEffect(() => {
    isMountedRef.current = true;
    startScanner(false);

    return () => {
      isMountedRef.current = false;
      stopAndClearScanner();
    };
  }, [startScanner, stopAndClearScanner]);

  const handleRetry = () => {
    isProcessingScanRef.current = false;
    startScanner(true);
  };

  const handleScanAgain = () => {
    isProcessingScanRef.current = false;
    if (onScanAgain) {
      onScanAgain();
    }
    const scanner = scannerRef.current;
    if (scanner && scanner.isScanning) {
      try {
        scanner.resume();
      } catch (e) {}
    } else {
      startScanner(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center space-y-4 w-full">
      {/* Scanner Viewport Container */}
      <div className="relative w-full max-w-2xl aspect-[3/4] sm:aspect-video bg-black rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl">
        
        {/* The DOM element required by Html5Qrcode */}
        <div id={elementIdRef.current} className="w-full h-full" />

        {/* Torch Toggle Button (top right inside camera viewfinder when available) */}
        {isCameraActive && isTorchSupported && !isInitializing && !error && !isLoading && !result && (
          <button
            type="button"
            onClick={toggleTorch}
            className={`absolute top-4 right-4 z-30 p-2.5 rounded-full backdrop-blur-md transition-all cursor-pointer shadow-lg ${
              isTorchOn 
                ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300' 
                : 'bg-black/60 hover:bg-black/80 text-white border border-white/20'
            }`}
            title={isTorchOn ? 'Turn Flash Off' : 'Turn Flash On'}
          >
            {isTorchOn ? <Zap className="w-4 h-4 fill-current" /> : <ZapOff className="w-4 h-4" />}
          </button>
        )}

        {/* Overlay states: Initializing, Verifying, Results, Errors */}
        {(isInitializing || error || isLoading || result) && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/95 p-6 text-center backdrop-blur-xs">
            
            {/* 1. Loading & Verifying States */}
            {isLoading ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                <RefreshCw className="w-10 h-10 text-[#febd69] animate-spin mx-auto" />
                <p className="text-xs font-black text-[#febd69] tracking-widest uppercase">
                  {t('verifying')}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">
                  {language === 'sw' ? 'Tafadhali subiri kidogo...' : 'Please wait a moment...'}
                </p>
              </div>
            ) : result ? (
              /* 2. Verification Result Display */
              <div className="space-y-4 max-w-sm w-full animate-in fade-in zoom-in-95 duration-200">
                {result.success ? (
                  <CheckCircle className={`w-16 h-16 mx-auto ${result.alreadyArrived ? 'text-amber-400' : 'text-emerald-400'}`} />
                ) : (
                  <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
                )}
                
                <div className="space-y-1.5">
                  <h4 className={`text-base font-black uppercase tracking-tight ${result.success ? (result.alreadyArrived ? 'text-amber-400' : 'text-emerald-400') : 'text-red-400'}`}>
                    {result.success ? t('verifySuccess') : t('verifyDenied')}
                  </h4>
                  <p className="text-xs font-semibold text-slate-200 px-2 leading-relaxed">
                    {result.message}
                  </p>
                </div>

                {result.guestName && (
                  <div className="bg-slate-900/90 px-4 py-2 rounded-xl border border-slate-700/80">
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('guestName')}</p>
                    <p className="text-sm font-black text-[#febd69] mt-0.5">{result.guestName}</p>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleScanAgain}
                    className="w-full py-3.5 bg-gradient-to-r from-[#febd69] to-[#f3a847] hover:brightness-110 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all shadow-lg cursor-pointer active:scale-98"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>{t('scanAgain')}</span>
                  </button>
                </div>
              </div>
            ) : isInitializing && !error ? (
              /* 3. Camera Initializing */
              <div className="space-y-3">
                <RefreshCw className="w-10 h-10 text-slate-500 animate-spin mx-auto" />
                <p className="text-xs font-bold text-slate-300 tracking-wider uppercase">{t('initializing')}</p>
                <p className="text-[10px] text-slate-500">{t('permissionRequest')}</p>
              </div>
            ) : error ? (
              /* 4. Error & Permission States with Clear Recovery Actions */
              <div className="space-y-4 max-w-md w-full animate-in fade-in duration-200">
                {errorType === 'permission' ? (
                  <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto" />
                ) : errorType === 'notFound' ? (
                  <VideoOff className="w-12 h-12 text-slate-400 mx-auto" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-amber-400 mx-auto" />
                )}

                <div className="space-y-1">
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                    {errorType === 'permission' 
                      ? (language === 'sw' ? 'Ruhusa ya Kamera Inahitajika' : 'Camera Access Needed') 
                      : (language === 'sw' ? 'Taarifa ya Scanner' : 'Scanner Notice')}
                  </h4>
                  <p className="text-xs font-semibold text-slate-300 leading-relaxed px-2">{error}</p>
                </div>
                
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="px-6 py-2.5 bg-[#febd69] hover:bg-[#f3a847] text-slate-950 rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-md active:scale-98"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>{language === 'sw' ? 'Ruhusu / Jaribu Kamera' : 'Allow / Retry Camera'}</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* 5. Live Scanning Viewfinder Frame (Active when camera is broadcasting) */}
        {!isInitializing && !error && !isLoading && !result && isCameraActive && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[78%] aspect-square border-2 border-[#febd69]/50 relative rounded-2xl shadow-[0_0_0_9999px_rgba(10,15,28,0.55)]">
              {/* Gold Corner Brackets */}
              <div className="absolute -top-0.5 -left-0.5 w-7 h-7 border-t-4 border-l-4 border-[#febd69] rounded-tl-xl" />
              <div className="absolute -top-0.5 -right-0.5 w-7 h-7 border-t-4 border-r-4 border-[#febd69] rounded-tr-xl" />
              <div className="absolute -bottom-0.5 -left-0.5 w-7 h-7 border-b-4 border-l-4 border-[#febd69] rounded-bl-xl" />
              <div className="absolute -bottom-0.5 -right-0.5 w-7 h-7 border-b-4 border-r-4 border-[#febd69] rounded-br-xl" />
              
              {/* Smooth animated scanning laser bar */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#febd69] to-transparent animate-scan shadow-[0_0_12px_rgba(254,189,105,0.8)]" />
            </div>
          </div>
        )}
      </div>

      {/* Action shortcuts under scanner */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center space-x-1.5 border border-slate-700 cursor-pointer shadow-xs"
        >
          <X className="w-4 h-4 text-slate-400" />
          <span>{t('close')}</span>
        </button>
      </div>

      <div className="text-center px-4 max-w-sm">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
          {t('instruction')}
        </p>
      </div>

      <style>{`
        @keyframes scan {
          0% { top: 0%; opacity: 0.1; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: 100%; opacity: 0.1; }
        }
        .animate-scan {
          animation: scan 2.2s ease-in-out infinite alternate;
        }
        #${elementIdRef.current} video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 1.5rem !important;
        }
        #${elementIdRef.current}__scan_region {
          background: transparent !important;
        }
        #${elementIdRef.current}__dashboard {
          display: none !important;
        }
        #${elementIdRef.current} {
          border: none !important;
        }
      `}</style>
    </div>
  );
};

export default QRScanner;
