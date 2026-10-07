// src/components/VideoUploadInput.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, X, Loader2, Play, FileVideo, CheckCircle2, WifiOff, Link as LinkIcon, AlertCircle, RefreshCw, Sparkles, Sliders, CloudUpload } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL, UploadTask } from 'firebase/storage';
import { storage, auth } from '../lib/firebase.ts';
import { motion, AnimatePresence } from 'motion/react';
import { useVideoProcessor, VideoEncodingProfile } from '../hooks/useVideoProcessor.ts';

export interface VideoMetadata {
  videoUrl: string;
  videoStoragePath?: string | null;
  videoFileName?: string | null;
  videoFileType?: string | null;
  videoFileSize?: number | null;
  videoUploadStatus?: 'PREPARING' | 'UPLOADING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
}

interface VideoUploadInputProps {
  value: string;
  metadata?: Partial<VideoMetadata>;
  onChange: (metadata: VideoMetadata) => void;
  label?: string;
  productId?: string | number;
  encodingProfile?: VideoEncodingProfile;
}

const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];
const ALLOWED_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'];

export default function VideoUploadInput({
  value,
  metadata,
  onChange,
  label = 'Product Video (Max 15s)',
  productId = 'new',
  encodingProfile = 'speed'
}: VideoUploadInputProps) {
  const [mode, setMode] = useState<'device' | 'url'>('device');
  const [urlInput, setUrlInput] = useState(value && !value.startsWith('blob:') && !value.startsWith('data:') ? value : '');
  const [isUploading, setIsUploading] = useState(false);
  const [isWaitingNetwork, setIsWaitingNetwork] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState(false);

  const { compressVideo, isProcessing: isCompressing, progress: compressionProgress, stats: compressionStats } = useVideoProcessor();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTaskRef = useRef<UploadTask | null>(null);
  const retryCountRef = useRef(0);
  const pendingFileRef = useRef<File | null>(null);

  // Sync external value changes into urlInput
  useEffect(() => {
    if (value && !value.startsWith('blob:') && !value.startsWith('data:')) {
      setUrlInput(value);
    }
    setPlaybackError(false);
  }, [value]);

  // Clean up any ongoing upload task when unmounting
  useEffect(() => {
    return () => {
      if (activeTaskRef.current) {
        try {
          activeTaskRef.current.cancel();
          onChange({
            videoUrl: value,
            ...metadata,
            videoUploadStatus: 'CANCELLED'
          });
        } catch {
          // ignore cleanup cancel
        }
      }
    };
  }, []);

  // Listen to network changes to automatically resume interrupted uploads
  useEffect(() => {
    const handleOnline = () => {
      setIsWaitingNetwork(false);
      if (activeTaskRef.current) {
        try {
          activeTaskRef.current.resume();
        } catch {
          // If task can't be resumed, retry upload from file
          if (pendingFileRef.current && retryCountRef.current < 3) {
            retryCountRef.current++;
            startUpload(pendingFileRef.current);
          }
        }
      }
    };

    const handleOffline = () => {
      if (isUploading) {
        setIsWaitingNetwork(true);
        if (activeTaskRef.current) {
          try {
            activeTaskRef.current.pause();
          } catch {
            // ignore pause error
          }
        }
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isUploading]);

  const startUpload = useCallback((file: File) => {
    setIsUploading(true);
    setIsWaitingNetwork(false);
    setIsRetrying(false);
    setError(null);
    setPlaybackError(false);

    // Sanitize filename: remove unsafe path traversal or special chars
    const cleanBaseName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
    const uniquePrefix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const safeFileName = `${uniquePrefix}_${cleanBaseName}`;
    
    // Secure path including user UID for ownership enforcement in storage rules
    const userId = auth.currentUser?.uid;
    if (!userId) {
      setError('Authentication required to upload videos.');
      setIsUploading(false);
      return;
    }
    
    const storagePath = `users/${userId}/products/${productId}/videos/${safeFileName}`;
    const storageRef = ref(storage, storagePath);

    onChange({
      videoUrl: value,
      ...metadata,
      videoUploadStatus: 'UPLOADING',
      videoStoragePath: storagePath,
      videoFileName: file.name,
      videoFileType: file.type,
      videoFileSize: file.size
    });

    // Create resilient resumable upload task
    const uploadTask = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'video/mp4',
      cacheControl: 'public, max-age=31536000',
    });

    activeTaskRef.current = uploadTask;

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (snapshot.totalBytes > 0) {
          const p = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setProgress(Math.round(p));
        }
        if (snapshot.state === 'paused') {
          setIsWaitingNetwork(true);
        } else if (snapshot.state === 'running') {
          setIsWaitingNetwork(false);
          setIsRetrying(false);
        }
      },
      (err: any) => {
        console.warn('Video upload notice:', err?.code, err?.message);
        const isUnauthorized = err?.code === 'storage/unauthorized' || err?.message?.includes('permission');

        if (isUnauthorized) {
          setError('Storage permission restricted. You can paste a direct video URL or sample link instead.');
          setMode('url');
          setIsUploading(false);
          setIsWaitingNetwork(false);
          setIsRetrying(false);
          activeTaskRef.current = null;
          onChange({
            videoUrl: '',
            videoUploadStatus: 'FAILED'
          });
          return;
        }

        // Automatic retry with exponential backoff on transient errors
        if (retryCountRef.current < 2 && pendingFileRef.current) {
          retryCountRef.current++;
          setIsRetrying(true);
          const retryDelay = retryCountRef.current * 1500;
          setTimeout(() => {
            if (pendingFileRef.current) {
              startUpload(pendingFileRef.current);
            }
          }, retryDelay);
        } else {
          setError('Upload failed. Check connection or paste a direct video URL.');
          setIsUploading(false);
          setIsWaitingNetwork(false);
          setIsRetrying(false);
          activeTaskRef.current = null;
          onChange({
            videoUrl: '',
            videoUploadStatus: 'FAILED'
          });
        }
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setIsUploading(false);
          setIsWaitingNetwork(false);
          setIsRetrying(false);
          activeTaskRef.current = null;
          pendingFileRef.current = null;
          
          onChange({
            videoUrl: downloadURL,
            videoStoragePath: storagePath,
            videoFileName: file.name,
            videoFileType: file.type,
            videoFileSize: file.size,
            videoUploadStatus: 'COMPLETED'
          });
        } catch {
          setError('Failed to retrieve video URL. Please try pasting a direct video link.');
          setIsUploading(false);
          setIsWaitingNetwork(false);
          setIsRetrying(false);
          onChange({
            videoUrl: '',
            videoUploadStatus: 'FAILED'
          });
        }
      }
    );
  }, [productId, onChange, value, metadata]);

  const validateAndUpload = async (file: File) => {
    setError(null);
    setPlaybackError(false);
    setProgress(0);

    // Validate extension & type
    const lowerName = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    const hasValidMime = ALLOWED_VIDEO_TYPES.includes(file.type) || file.type.startsWith('video/');

    if (!hasValidExt && !hasValidMime) {
      setError('Please select a valid video format (MP4, WebM, MOV).');
      return;
    }

    // Validate size (25MB max for original)
    if (file.size > 25 * 1024 * 1024) {
      setError('Video file is too large (max 25MB).');
      return;
    }

    // Validate duration (15s with slight margin)
    const video = document.createElement('video');
    video.preload = 'metadata';
    const objectUrl = URL.createObjectURL(file);

    video.onloadedmetadata = async () => {
      URL.revokeObjectURL(objectUrl);
      if (video.duration > 16.5) {
        setError('Video must be 15 seconds or less.');
        return;
      }
      
      onChange({
        videoUrl: value,
        ...metadata,
        videoUploadStatus: 'PREPARING'
      });

      let fileToUpload = file;
      
      // Attempt compression if file is > 1MB or resolution is unknown
      // This ensures optimized storage usage
      try {
        if (file.size > 1 * 1024 * 1024) {
          onChange({
            videoUrl: value,
            ...metadata,
            videoUploadStatus: 'PROCESSING'
          });
          fileToUpload = await compressVideo(file, encodingProfile);
        }
      } catch (e) {
        console.error('Compression failed, uploading original', e);
      }

      retryCountRef.current = 0;
      pendingFileRef.current = fileToUpload;
      startUpload(fileToUpload);
    };

    video.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setError('Unable to read video file. Please check format or paste a video link.');
    };

    video.src = objectUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const handleApplyUrl = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setError('Please enter a video URL.');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setError('Video URL must start with http:// or https://');
      return;
    }
    setError(null);
    setPlaybackError(false);
    onChange({
      videoUrl: trimmed,
      videoUploadStatus: 'COMPLETED'
    });
  };

  const clearVideo = () => {
    if (activeTaskRef.current) {
      try {
        activeTaskRef.current.cancel();
      } catch {
        // ignore cancel error
      }
      activeTaskRef.current = null;
    }
    pendingFileRef.current = null;
    setIsUploading(false);
    setIsWaitingNetwork(false);
    setProgress(0);
    setError(null);
    setPlaybackError(false);
    setUrlInput('');
    onChange({
      videoUrl: '',
      videoUploadStatus: 'CANCELLED'
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-3 bg-slate-900/50 p-5 rounded-3xl border border-slate-800 shadow-md">
      <div className="flex items-center justify-between">
        {label && (
          <label className="block text-xs font-black text-blue-200 uppercase tracking-widest ml-1">
            {label}
          </label>
        )}

        {/* Mode Selector */}
        {!value && (
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => { setMode('device'); setError(null); }}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer ${
                mode === 'device' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Upload className="w-3 h-3" />
              <span>Device</span>
            </button>
            <button
              type="button"
              onClick={() => { setMode('url'); setError(null); }}
              className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center space-x-1 cursor-pointer ${
                mode === 'url' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3 h-3" />
              <span>URL</span>
            </button>
          </div>
        )}
      </div>

      {value ? (
        <div className="relative rounded-2xl overflow-hidden border-2 border-blue-500 bg-slate-950 group aspect-video">
          <video 
            src={value} 
            className="w-full h-full object-contain" 
            controls 
            playsInline
            onError={() => {
              setPlaybackError(true);
            }}
          />
          <div className="absolute top-2 right-2 flex space-x-2 z-10">
            <button
              type="button"
              onClick={clearVideo}
              className="p-2 bg-red-600 text-white rounded-xl shadow-lg hover:bg-red-700 transition-all cursor-pointer"
              title="Remove Video"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {playbackError ? (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-4 text-center z-10">
              <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
              <p className="text-xs font-bold text-white mb-1">Unable to play video from this URL</p>
              <p className="text-[10px] text-slate-400 max-w-xs mb-3">Ensure the URL points directly to an MP4 or WebM video file accessible over HTTPS.</p>
              <button
                type="button"
                onClick={clearVideo}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Change Video
              </button>
            </div>
          ) : (
            <div className="absolute bottom-2 left-2 flex flex-col space-y-1">
              <div className="flex items-center bg-blue-600/90 text-white px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-md pointer-events-none w-fit">
                <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-300" />
                Video Attached
              </div>
              {compressionStats && compressionStats.reduction > 0 && (
                <div className="flex items-center bg-emerald-600/90 text-white px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-md pointer-events-none w-fit animate-pulse">
                  <Sparkles className="w-2.5 h-2.5 mr-1" />
                  Optimized ({compressionStats.reduction}% Smaller)
                </div>
              )}
            </div>
          )}
        </div>
      ) : mode === 'url' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-grow">
              <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-xs font-medium"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplyUrl();
                  }
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => handleApplyUrl()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer shrink-0"
            >
              Attach
            </button>
          </div>
          <p className="text-[10px] text-slate-500 font-medium ml-1">
            Paste any direct MP4 or WebM video URL (max 15 seconds recommended).
          </p>
        </div>
      ) : (
        <div
          onClick={() => {
            if (isUploading || isCompressing) return;
            if (error && pendingFileRef.current) {
              startUpload(pendingFileRef.current);
            } else {
              fileInputRef.current?.click();
            }
          }}
          className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center min-h-[160px] ${
            isUploading || isCompressing
              ? 'border-blue-600 bg-blue-500/5' 
              : 'border-slate-800 bg-slate-950/40 hover:bg-slate-950 hover:border-blue-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-2xl bg-slate-800 text-blue-400 flex items-center justify-center mb-3">
            {isWaitingNetwork ? (
              <WifiOff className="w-6 h-6 animate-pulse text-amber-400" />
            ) : isRetrying ? (
              <RefreshCw className="w-6 h-6 animate-spin text-amber-400" />
            ) : isCompressing ? (
              <Sliders className="w-6 h-6 animate-pulse text-emerald-400" />
            ) : isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
            ) : error && pendingFileRef.current ? (
              <RefreshCw className="w-6 h-6 animate-spin text-red-400" />
            ) : (
              <FileVideo className="w-6 h-6" />
            )}
          </div>

          <p className="text-sm font-black text-slate-200 uppercase tracking-tight">
            {isWaitingNetwork
              ? 'Reconnecting... upload paused'
              : isRetrying
              ? 'Retrying transfer...'
              : isCompressing
              ? `Optimizing... ${compressionProgress}%`
              : isUploading
              ? `Uploading... ${progress}%`
              : error && pendingFileRef.current
              ? 'Upload Interrupted'
              : 'Upload Product Video'}
          </p>
          <p className="text-[10px] text-slate-500 font-medium mt-1">
            {error && pendingFileRef.current 
              ? 'Tap to attempt resuming the transfer'
              : 'Max 15 seconds • MP4, WebM, MOV • Resumable & Optimized'}
          </p>

          {(isUploading || isCompressing) && (
            <div className="w-full mt-6 space-y-2">
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <div className="flex items-center space-x-1.5">
                  {isRetrying ? (
                    <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" />
                  ) : isCompressing ? (
                    <Sliders className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <CloudUpload className="w-3 h-3 text-blue-400 animate-bounce" />
                  )}
                  <span className={isRetrying ? 'text-amber-400' : isCompressing ? 'text-emerald-400' : 'text-blue-400'}>
                    {isRetrying ? 'Retrying Transfer' : isCompressing ? `Phase 1: ${encodingProfile === 'speed' ? 'Fast' : 'High Quality'} Optimization` : 'Phase 2: Firebase Upload'}
                  </span>
                </div>
                <span className="text-slate-400">
                  {isCompressing ? compressionProgress : progress}%
                </span>
              </div>
              <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: isCompressing ? `${compressionProgress}%` : `${progress}%` }}
                  transition={{ type: 'spring', damping: 15, stiffness: 100 }}
                  className={`h-full relative ${
                    isWaitingNetwork || isRetrying ? 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]' : isCompressing ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                  }`}
                >
                  {/* Animated striped pattern overlay */}
                  <div className="absolute inset-0 opacity-20 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-[progress-stripe_1s_linear_infinite]" />
                </motion.div>
              </div>
              <p className="text-[9px] text-center text-slate-500 font-medium italic">
                {isCompressing 
                  ? 'Compressing video on your device to save data...' 
                  : isWaitingNetwork 
                    ? 'Waiting for stable connection to resume upload...' 
                    : 'Transmitting encrypted bits to Tanzania cloud storage...'}
              </p>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col space-y-3"
          >
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-grow">
                <p className="text-xs text-red-400 font-bold">{error}</p>
                <p className="text-[10px] text-red-300/70 mt-1">Interrupted transfers can often be resumed without starting over.</p>
              </div>
            </div>
            
            {pendingFileRef.current && (
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => startUpload(pendingFileRef.current!)}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center space-x-2 shadow-lg"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Resume Transfer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setProgress(0);
                    pendingFileRef.current = null;
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
