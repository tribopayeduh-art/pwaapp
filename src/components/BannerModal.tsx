import React from 'react';
import { X } from 'lucide-react';

interface BannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAction?: () => void;
}

export const BannerModal: React.FC<BannerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      {/* Banner Container */}
      <div 
        className="relative max-w-sm sm:max-w-md w-full bg-transparent rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center transform transition-all animate-in zoom-in-95 duration-300 select-none cursor-pointer"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        {/* Top Right Close Button (X) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 z-30 w-10 h-10 bg-black/70 hover:bg-black/90 border border-white/30 text-white rounded-full flex items-center justify-center transition-all active:scale-90 cursor-pointer shadow-xl backdrop-blur-sm"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Banner Image */}
        <img
          src="/banner50k.png"
          alt="Banner Promoção 50K"
          className="w-full h-auto max-h-[80vh] object-contain rounded-2xl drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)]"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = '/banner001.png';
          }}
        />
      </div>
    </div>
  );
};


