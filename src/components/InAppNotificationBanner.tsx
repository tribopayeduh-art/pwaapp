import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, ExternalLink, Sparkles } from 'lucide-react';
import { InAppNotificationItem } from '../lib/pwaNotification';

export const InAppNotificationBanner: React.FC = () => {
  const [currentNotif, setCurrentNotif] = useState<InAppNotificationItem | null>(null);

  useEffect(() => {
    const handleInAppNotification = (e: Event) => {
      const customEvent = e as CustomEvent<InAppNotificationItem>;
      if (customEvent.detail) {
        setCurrentNotif(customEvent.detail);
      }
    };

    window.addEventListener('alliance:in-app-notification', handleInAppNotification);
    return () => {
      window.removeEventListener('alliance:in-app-notification', handleInAppNotification);
    };
  }, []);

  // Auto-dismiss after 7 seconds
  useEffect(() => {
    if (!currentNotif) return;
    const timer = setTimeout(() => {
      setCurrentNotif(null);
    }, 7000);
    return () => clearTimeout(timer);
  }, [currentNotif]);

  const handleAction = () => {
    if (!currentNotif) return;
    const targetUrl = currentNotif.url || '/?tab=affiliates';
    setCurrentNotif(null);

    if (targetUrl.includes('tab=affiliates')) {
      window.dispatchEvent(new CustomEvent('app-navigate-tab', { detail: { tab: 'affiliates' } }));
    } else {
      window.location.href = targetUrl;
    }
  };

  return (
    <div id="in-app-pwa-notification-container" className="fixed top-3 sm:top-5 left-0 right-0 z-[99999] pointer-events-none flex justify-center px-3">
      <AnimatePresence>
        {currentNotif && (
          <motion.div
            id={`notif-card-${currentNotif.id}`}
            initial={{ opacity: 0, y: -70, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -60, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 450, damping: 30 }}
            className="pointer-events-auto w-full max-w-md bg-[#121316]/95 backdrop-blur-2xl border border-white/15 rounded-2xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-white select-none cursor-pointer hover:border-emerald-500/40 transition-colors"
            onClick={handleAction}
          >
            <div className="flex items-start gap-3">
              {/* App Icon */}
              <div className="relative flex-shrink-0">
                <img
                  src="/allifavicon.png"
                  alt="Alliance Hub"
                  className="w-10 h-10 rounded-xl object-cover border border-white/10 shadow-sm"
                  onError={(e) => {
                    // Fallback to stylized icon
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center text-[9px] text-black font-bold">
                  <Sparkles className="w-2.5 h-2.5 text-black" />
                </div>
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center justify-between gap-2 mb-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold tracking-wider text-emerald-400 uppercase">
                      ALLIANCE HUB
                    </span>
                    <span className="text-[10px] text-zinc-500">• agora</span>
                  </div>
                  <button
                    id="btn-close-in-app-notif"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentNotif(null);
                    }}
                    className="p-1 -mr-1 -mt-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                    aria-label="Fechar notificação"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <h4 className="text-[14px] font-bold text-white tracking-tight leading-snug truncate">
                  {currentNotif.title}
                </h4>
                <p className="text-[12px] text-zinc-300 leading-relaxed mt-0.5 line-clamp-2">
                  {currentNotif.body}
                </p>

                <div className="flex items-center gap-1 mt-2 text-[11px] font-semibold text-emerald-400">
                  <span>Toque para ver detalhes</span>
                  <ExternalLink className="w-3 h-3" />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
