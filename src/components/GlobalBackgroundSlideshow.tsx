// src/components/GlobalBackgroundSlideshow.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const BACKGROUND_IMAGES = [
  '/assets/images/tanzania_local_market_1790671377629.jpg',
  '/assets/images/tanzania_clothing_market_1790671677559.jpg',
  '/assets/images/tanzania_heritage_dreamers_branded_1790675519503.jpg',
  '/assets/images/tanzania_heritage_showcase_1790674290804.jpg',
  '/assets/images/tanzania_heritage_clean_1790674653954.jpg'
];

export default function GlobalBackgroundSlideshow() {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Preload next images to ensure smooth transitions
  useEffect(() => {
    BACKGROUND_IMAGES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Smooth slow crossfade rotation every 20 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % BACKGROUND_IMAGES.length);
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  const currentImage = BACKGROUND_IMAGES[currentIndex];

  return (
    <div className="fixed inset-0 pointer-events-none z-[-1] overflow-hidden bg-slate-950">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentImage}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.55 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: 'easeInOut' }}
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url("${currentImage}")`,
            filter: 'brightness(0.9) contrast(1.1) saturate(1.15)',
          }}
        />
      </AnimatePresence>

      {/* Translucent overlay that allows the vibrant market scenes to be seen clearly */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/50 via-slate-950/35 to-slate-950/65 backdrop-blur-[0.5px]" />
    </div>
  );
}
