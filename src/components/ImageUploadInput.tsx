// src/components/ImageUploadInput.tsx
import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, X, RefreshCw, Check, Link as LinkIcon, Camera, RotateCw, Sparkles, SlidersHorizontal, Eye } from 'lucide-react';

interface ImageUploadInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  aspectRatio?: 'square' | 'video' | 'wide' | 'auto';
}

export default function ImageUploadInput({
  value,
  onChange,
  label = 'Upload Image',
  placeholder = 'Select image from device or enter URL',
  required = false,
  className = '',
  aspectRatio = 'square',
}: ImageUploadInputProps) {
  const [mode, setMode] = useState<'device' | 'url'>('device');
  const [urlInput, setUrlInput] = useState(value && !value.startsWith('data:') ? value : '');
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Client-side image adjustments state
  const [originalBase64, setOriginalBase64] = useState<string | null>(null);
  const [rotation, setRotation] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<string>('none');
  const [outputFormat, setOutputFormat] = useState<string>('image/jpeg');
  const [outputQuality, setOutputQuality] = useState<number>(0.8);
  const [estimatedSizeKB, setEstimatedSizeKB] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Measure size of output base64
  useEffect(() => {
    if (value && value.startsWith('data:')) {
      const stringLength = value.length - value.indexOf(',') - 1;
      const sizeInBytes = 4 * Math.ceil(stringLength / 3) * 0.562489633434383; // approx decode
      setEstimatedSizeKB(Math.round(sizeInBytes / 1024));
    } else {
      setEstimatedSizeKB(0);
    }
  }, [value]);

  // Apply all selected adjustments to the original source using a high-performance HTML Canvas
  const applyAdjustments = (rawBase64: string, rot: number, filter: string, fmt: string, qual: number) => {
    setIsProcessing(true);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        onChange(rawBase64);
        setIsProcessing(false);
        return;
      }

      // Max dimension capping for device efficiency
      const MAX_DIM = 1000;
      let width = img.width;
      let height = img.height;

      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        } else {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      // Swap dimensions if rotated 90 or 270 degrees
      const is90or270 = rot % 180 !== 0;
      canvas.width = is90or270 ? height : width;
      canvas.height = is90or270 ? width : height;

      // Handle translation and rotation
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((rot * Math.PI) / 180);

      // Draw image centered
      ctx.drawImage(img, -width / 2, -height / 2, width, height);

      // Apply browser-native Canvas Filter effects for sub-millisecond execution
      let canvasFilter = 'none';
      if (filter === 'grayscale') canvasFilter = 'grayscale(100%)';
      else if (filter === 'vintage') canvasFilter = 'sepia(60%) contrast(120%) brightness(95%)';
      else if (filter === 'warm') canvasFilter = 'saturate(130%) sepia(20%)';
      else if (filter === 'cool') canvasFilter = 'saturate(110%) hue-rotate(-10deg) brightness(105%)';
      else if (filter === 'enhance') canvasFilter = 'contrast(115%) saturate(120%)';

      // Redraw with filters applied if supported
      if ('filter' in ctx) {
        ctx.filter = canvasFilter;
        ctx.clearRect(-width / 2, -height / 2, width, height);
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
      }

      const outputDataUrl = canvas.toDataURL(fmt, qual);
      onChange(outputDataUrl);
      setIsProcessing(false);
    };

    img.onerror = () => {
      setIsProcessing(false);
      setErrorMsg('Error rendering image adjustments.');
    };

    img.src = rawBase64;
  };

  // Process selected file from device
  const processFile = (file: File) => {
    setErrorMsg(null);
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      const rawResult = e.target?.result as string;
      setOriginalBase64(rawResult);
      setRotation(0);
      setActiveFilter('none');
      // Apply baseline compression
      applyAdjustments(rawResult, 0, 'none', outputFormat, outputQuality);
    };

    reader.onerror = () => {
      setIsProcessing(false);
      setErrorMsg('Failed to read file from your device.');
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      setOriginalBase64(null);
      onChange(urlInput.trim());
    }
  };

  const handleClear = () => {
    onChange('');
    setOriginalBase64(null);
    setRotation(0);
    setActiveFilter('none');
    setUrlInput('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper trigger to adjust properties in real time
  const triggerAdjustmentChange = (newRot: number, newFilter: string, newFmt: string, newQual: number) => {
    if (originalBase64) {
      applyAdjustments(originalBase64, newRot, newFilter, newFmt, newQual);
    }
  };

  const aspectClass =
    aspectRatio === 'square'
      ? 'aspect-square'
      : aspectRatio === 'video'
      ? 'aspect-video'
      : aspectRatio === 'wide'
      ? 'aspect-[21/9]'
      : 'min-h-[200px]';

  return (
    <div className={`space-y-4 bg-slate-900/50 p-5 rounded-3xl border border-slate-800 shadow-md ${className}`}>
      <div className="flex items-center justify-between">
        {label && (
          <label className="block text-xs font-black text-blue-200 uppercase tracking-widest">
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        )}
        <div className="flex items-center space-x-1 bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-[10px] font-black uppercase">
          <button
            type="button"
            onClick={() => setMode('device')}
            className={`px-3 py-1 rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
              mode === 'device' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Upload className="w-3 h-3" />
            <span>Device</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('url')}
            className={`px-3 py-1 rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
              mode === 'url' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LinkIcon className="w-3 h-3" />
            <span>Web URL</span>
          </button>
        </div>
      </div>

      {value ? (
        <div className="space-y-4">
          {/* Preview Panel */}
          <div className="relative rounded-2xl overflow-hidden border-2 border-blue-500 bg-slate-950 group">
            <div className={`${aspectClass} w-full relative flex items-center justify-center`}>
              <img 
                src={value} 
                alt="Preview" 
                className="w-full h-full object-contain" 
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=400';
                  setErrorMsg('Picha haikupatikana kwenye URL uliyoweka. Tafadhali hakiki au pakia kutoka kwenye kifaa chako.');
                }}
              />
              <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-3 backdrop-blur-xs">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-tight flex items-center space-x-1 shadow-lg hover:bg-blue-700 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-tight flex items-center space-x-1 shadow-lg hover:bg-red-700 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
            <div className="bg-slate-900/90 text-light-green px-3 py-2 text-[10px] font-bold flex items-center justify-between border-t border-slate-800">
              <span className="flex items-center text-green-400">
                <Check className="w-3.5 h-3.5 mr-1" /> Image Processed ({estimatedSizeKB ? `${estimatedSizeKB} KB` : 'Dynamic'})
              </span>
              <button
                type="button"
                onClick={handleClear}
                className="text-slate-400 hover:text-red-400 uppercase font-black tracking-widest text-[9px] cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          {/* Real-time Client-side Editing Panel */}
          {originalBase64 && (
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">
                <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                <span>Client-Side Device Image Editor</span>
              </div>

              {/* Rotation & Filters Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Rotate Button */}
                <div className="space-y-1">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Orientation</span>
                  <button
                    type="button"
                    onClick={() => {
                      const nextRot = (rotation + 90) % 360;
                      setRotation(nextRot);
                      triggerAdjustmentChange(nextRot, activeFilter, outputFormat, outputQuality);
                    }}
                    className="w-full py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                    <span>Rotate 90° ({rotation}°)</span>
                  </button>
                </div>

                {/* Filters */}
                <div className="space-y-1">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Artisan Filters</span>
                  <select
                    value={activeFilter}
                    onChange={(e) => {
                      const filterVal = e.target.value;
                      setActiveFilter(filterVal);
                      triggerAdjustmentChange(rotation, filterVal, outputFormat, outputQuality);
                    }}
                    className="w-full p-2.5 bg-slate-900 border border-slate-800 text-white font-bold rounded-xl text-xs outline-none cursor-pointer"
                  >
                    <option value="none">Normal (Raw Selection)</option>
                    <option value="grayscale">Noir (Grayscale)</option>
                    <option value="vintage">Heritage (Vintage)</option>
                    <option value="warm">Serengeti Warm</option>
                    <option value="cool">Kilimanjaro Cool</option>
                    <option value="enhance">Vivid Enhance</option>
                  </select>
                </div>
              </div>

              {/* Compression Slider & Format Row */}
              <div className="grid grid-cols-2 gap-3">
                {/* Format Output */}
                <div className="space-y-1">
                  <span className="block text-[9px] font-bold text-slate-500 uppercase">Format Output</span>
                  <div className="flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-black uppercase">
                    {(['image/jpeg', 'image/png', 'image/webp'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => {
                          setOutputFormat(fmt);
                          triggerAdjustmentChange(rotation, activeFilter, fmt, outputQuality);
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-center cursor-pointer ${
                          outputFormat === fmt ? 'bg-blue-600 text-white font-black' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {fmt.split('/')[1]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compression Level Slider */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Quality</span>
                    <span className="text-[9px] font-black text-blue-400 uppercase">{Math.round(outputQuality * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={outputQuality}
                    onChange={(e) => {
                      const qual = parseFloat(e.target.value);
                      setOutputQuality(qual);
                      triggerAdjustmentChange(rotation, activeFilter, outputFormat, qual);
                    }}
                    className="w-full accent-blue-500 cursor-pointer h-2 bg-slate-800 rounded-lg outline-none"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : mode === 'device' ? (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer border-2 border-dashed rounded-2xl p-6 text-center transition-all flex flex-col items-center justify-center ${
            dragActive
              ? 'border-blue-600 bg-blue-500/10 scale-[1.01]'
              : 'border-slate-800 bg-slate-950/40 hover:bg-slate-950 hover:border-blue-500'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="w-14 h-14 rounded-2xl bg-slate-800 text-blue-400 flex items-center justify-center mb-3 shadow-inner">
            {isProcessing ? (
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
          </div>

          <p className="text-sm font-black text-slate-200 uppercase tracking-tight">
            {isProcessing ? 'Processing image...' : 'Select image from device'}
          </p>
          <p className="text-xs text-slate-500 font-medium mt-1">
            JPEG, PNG, WebP or direct Camera Capture
          </p>

          <div className="mt-3 inline-flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black shadow-xs uppercase tracking-wider transition-colors">
            <Camera className="w-3.5 h-3.5" />
            <span>Capture with Device</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 pointer-events-none" />
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUrlSubmit();
                }
              }}
              placeholder="https://example.com/product-photo.jpg"
              className="w-full pl-12 pr-24 py-4 bg-slate-950 border border-slate-850 rounded-2xl focus:ring-2 focus:ring-blue-300 focus:border-white outline-none font-bold text-sm text-white placeholder:text-slate-500 shadow-sm"
            />
            <button
              type="button"
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-tight hover:bg-blue-700 disabled:opacity-50 transition-all cursor-pointer"
            >
              Set
            </button>
          </div>
          <p className="text-[10px] text-slate-500 font-medium ml-1">
            Tip: You can paste high-res Unsplash or direct image URLs.
          </p>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-between text-xs text-red-400 font-bold">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
