import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface BannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: () => void;
}

export const BannerModal: React.FC<BannerModalProps> = ({ isOpen, onClose, onAction }) => {
  const [currentStep, setCurrentStep] = useState<'50k' | 'flash'>('50k');

  useEffect(() => {
    if (isOpen) {
      setCurrentStep('50k');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isFlash = currentStep === 'flash';

  const handleNextOrClose = () => {
    if (currentStep === '50k') {
      setCurrentStep('flash');
    } else {
      onClose();
    }
  };

  const handleBannerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFlash) {
      window.open('https://flashproxy.com.br/', '_blank', 'noopener,noreferrer');
    } else {
      if (onAction) {
        onAction();
      }
      setCurrentStep('flash');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={handleNextOrClose}
    >
      {/* Banner Container */}
      <div 
        className="relative max-w-sm sm:max-w-md w-full bg-transparent rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center transform transition-all animate-in zoom-in-95 duration-300 select-none cursor-pointer"
        onClick={handleBannerClick}
      >
        {/* Top Right Close Button (X) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleNextOrClose();
          }}
          className="absolute top-3 right-3 z-30 w-10 h-10 bg-black/70 hover:bg-black/90 border border-white/30 text-white rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xl backdrop-blur-sm"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Banner Image */}
        {isFlash ? (
          <img
            src="/bannerflash.png"
            alt="Flash Proxy"
            className="w-full h-auto max-h-[80vh] object-contain rounded-2xl drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
          />
        ) : (
          <img
            src="/banner50k.png"
            alt="Banner Promoção 50K"
            className="w-full h-auto max-h-[80vh] object-contain rounded-2xl drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = '/banner001.png';
            }}
          />
        )}
      </div>
    </div>
  );
};


