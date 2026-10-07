// src/components/InstallPWAButton.tsx
import { useState, useEffect } from 'react';
import { Download, MonitorSmartphone } from 'lucide-react';
import { motion } from 'motion/react';
import { buttonHover } from '../lib/animations';

interface InstallPWAButtonProps {
  variant?: 'navbar' | 'hero' | 'default';
}

export default function InstallPWAButton({ variant = 'default' }: InstallPWAButtonProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      setIsInstallable(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstallable(false);
    }
    setDeferredPrompt(null);
  };

  if (!isInstallable) return null;

  if (variant === 'navbar') {
    return (
      <motion.button
        whileHover={buttonHover.hover}
        whileTap={buttonHover.tap}
        onClick={handleInstallClick}
        className="flex items-center space-x-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-md text-[10px] font-bold uppercase tracking-wider transition-all border border-white/20"
        title="Pakua DREAMERS (Download APK/App)"
      >
        <MonitorSmartphone className="w-3.5 h-3.5 text-amazon-orange" />
        <span className="hidden xs:inline">Install App</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      whileHover={buttonHover.hover}
      whileTap={buttonHover.tap}
      onClick={handleInstallClick}
      className="inline-flex items-center space-x-2 px-6 py-3 bg-amazon-orange hover:bg-amazon-orange-hover text-amazon-navy rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md"
    >
      <Download className="w-4 h-4" />
      <span>Install App</span>
    </motion.button>
  );
}
