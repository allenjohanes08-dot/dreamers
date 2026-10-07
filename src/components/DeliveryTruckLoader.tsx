// src/components/DeliveryTruckLoader.tsx
import React from 'react';
import { motion } from 'motion/react';
import { fadeIn, scaleIn } from '../lib/animations';

interface DeliveryTruckLoaderProps {
  text?: string;
  detail?: string;
  progress?: number;
  fullScreen?: boolean;
}

export default function DeliveryTruckLoader({
  text = 'DELIVERING CONTENT...',
  detail,
  progress,
  fullScreen = false,
}: DeliveryTruckLoaderProps) {
  const content = (
    <motion.div 
      initial="initial"
      animate="animate"
      variants={fadeIn}
      className="flex flex-col items-center justify-center p-6 select-none"
    >
      <motion.div variants={scaleIn} className="animation-container">
        {/* Custom Truck SVG */}
        <svg className="delivery-truck" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80">
          {/* Chassis / Wheels Background */}
          <rect x="25" y="58" width="80" height="6" fill="#2d2d2d" rx="2" />
          {/* Cargo Box */}
          <rect x="52" y="16" width="60" height="42" fill="#ffffff" stroke="#e0e0e0" strokeWidth="1.5" rx="2" />
          <line x1="110" y1="16" x2="110" y2="58" stroke="#d5d5d5" strokeWidth="1" />
          {/* Truck Cab */}
          <path d="M52,32 L36,32 C30,32 24,38 21,44 L20,58 L52,58 Z" fill="#ffffff" />
          {/* Front Grille & Bumper */}
          <path d="M20,48 L17,49 C16,50 16,54 18,57 L20,58 Z" fill="#131921" />
          <rect x="16" y="52" width="4" height="4" fill="#febd69" rx="1" />
          {/* Windshield & Side Window */}
          <path d="M26,43 L34,35 L48,35 L48,45 Z" fill="#232f3e" opacity="0.8" />
          <path d="M25,44 L32,36 L35,36 L28,45 Z" fill="#718096" opacity="0.5" />
          {/* Front Wheel */}
          <circle cx="35" cy="58" r="9" fill="#1a1a1a" />
          <circle cx="35" cy="58" r="4" fill="#cccccc" />
          {/* Rear Wheel */}
          <circle cx="90" cy="58" r="9" fill="#1a1a1a" />
          <circle cx="90" cy="58" r="4" fill="#cccccc" />
        </svg>

        {/* Moving Road Lines */}
        <div className="road-line"></div>
      </motion.div>
      <p className="loading-text">{text}</p>

      {typeof progress === 'number' && (
        <>
          <div className="loader-progress-track">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 0.5 }}
              className="loader-progress-fill"
            />
          </div>
          <div className="loader-status-row">
            <span className="loader-status-detail">{detail || 'Processing...'}</span>
            <span className="loader-progress-percent">{Math.round(progress)}%</span>
          </div>
        </>
      )}
    </motion.div>
  );

  if (fullScreen) {
    return (
      <div id="loader-wrapper" className="fixed inset-0 z-[9999] flex flex-col justify-center items-center bg-gray-50">
        {content}
      </div>
    );
  }

  return content;
}
