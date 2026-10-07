// src/hooks/useVideoProcessor.ts
import { useState, useCallback } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

export interface VideoStats {
  originalSize: number;
  compressedSize: number;
  reduction: number;
}

export type VideoEncodingProfile = 'speed' | 'quality';

export function useVideoProcessor() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<VideoStats | null>(null);

  const compressVideo = useCallback(async (file: File, profile: VideoEncodingProfile = 'speed'): Promise<File> => {
    setIsProcessing(true);
    setProgress(0);
    setError(null);
    setStats(null);

    const ffmpeg = new FFmpeg();

    try {
      // Check for SharedArrayBuffer support (required for multithreaded FFmpeg v0.12)
      if (typeof SharedArrayBuffer === 'undefined') {
        console.warn('SharedArrayBuffer is not available. Video optimization will be skipped to ensure authentication reliability.');
        return file;
      }

      // Load FFmpeg
      await ffmpeg.load({
        coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg Log]', message);
      });

      ffmpeg.on('progress', ({ progress: p }) => {
        setProgress(Math.round(p * 100));
      });

      // Write file to FFmpeg's virtual file system
      const inputName = 'input.mp4';
      const outputName = 'output.mp4';
      await ffmpeg.writeFile(inputName, await fetchFile(file));

      // Profile settings
      // Speed: higher CRF (more compression), faster preset
      // Quality: lower CRF (better visuals), medium preset
      const crf = profile === 'speed' ? '30' : '22';
      const preset = profile === 'speed' ? 'ultrafast' : 'medium';

      // Execute compression
      // -vcodec libx264: Use H.264 codec
      // -crf: Constant Rate Factor (higher = more compression)
      // -preset: Encoding speed vs compression ratio
      // -vf scale: Ensure even dimensions
      // -movflags +faststart: Move metadata for instant web playback
      await ffmpeg.exec([
        '-i', inputName,
        '-vcodec', 'libx264',
        '-crf', crf,
        '-preset', preset,
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-max_muxing_queue_size', '1024',
        '-movflags', '+faststart',
        outputName
      ]);

      // Read the output
      const data = await ffmpeg.readFile(outputName);
      const compressedBlob = new Blob([data as any], { type: 'video/mp4' });
      
      const compressedFile = new File([compressedBlob], file.name, {
        type: 'video/mp4',
        lastModified: Date.now(),
      });

      setStats({
        originalSize: file.size,
        compressedSize: compressedFile.size,
        reduction: Math.round(((file.size - compressedFile.size) / file.size) * 100),
      });

      return compressedFile;
    } catch (err: any) {
      console.error('Video compression error:', err);
      setError(err.message || 'Failed to compress video');
      return file; // Fallback to original
    } finally {
      setIsProcessing(false);
      setProgress(0);
      try {
        await ffmpeg.terminate();
      } catch (e) {
        // ignore termination errors
      }
    }
  }, []);

  return {
    compressVideo,
    isProcessing,
    progress,
    error,
    stats,
  };
}
