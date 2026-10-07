import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Toast } from '../components/Toast';
import { ArrowLeft } from 'lucide-react';

interface DinoGameAppProps {
  onReturnToPortal?: () => void;
}

export const DinoGameApp: React.FC<DinoGameAppProps> = ({ onReturnToPortal }) => {
  const [refCode, setRefCode] = useState<string>('');
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
  };

  // Check if we are on standalone Dino domain
  const host = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isStandaloneDinoDomain =
    host.includes('dinopay.site') ||
    host.includes('dinopay') ||
    host.includes('dinoplay.site') ||
    host.includes('dinoplay') ||
    host.includes('dinipay');

  // 1. Configure page head, favicon and title for dinopay.site
  useEffect(() => {
    document.title = 'DINO PAY | CORRA E GANHE NO PIX';
    const favicons = document.querySelectorAll("link[rel*='icon']");
    favicons.forEach((el) => {
      (el as HTMLLinkElement).href = '/gen-dino/images/fav_icon.png';
    });
  }, []);

  // 2. Capture referral code from URL search param (?ref=CODE)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('refCode') || params.get('r');

    if (ref) {
      const cleanRef = ref.toUpperCase().trim();
      setRefCode(cleanRef);
      try {
        sessionStorage.setItem('dino_ref_code', cleanRef);
        localStorage.setItem('dino_ref_code', cleanRef);
        sessionStorage.setItem('alliance_ref_code', cleanRef);
        localStorage.setItem('alliance_ref_code', cleanRef);
      } catch (e) {}
      showToast(`Bônus de Indicação ativado para o código: ${cleanRef}`, 'success');
    } else {
      try {
        const stored =
          localStorage.getItem('dino_ref_code') ||
          sessionStorage.getItem('dino_ref_code') ||
          localStorage.getItem('alliance_ref_code');
        if (stored) {
          setRefCode(stored);
        }
      } catch (e) {}
    }
  }, []);

  // 3. Stable iframe src construction evaluated once on mount
  const [iframeSrc] = useState<string>(() => {
    const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    searchParams.set('embedded', '1');
    const existingToken = typeof window !== 'undefined'
      ? localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || ''
      : '';
    if (existingToken) {
      searchParams.set('token', existingToken);
    }
    const cleanRef = typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('ref') ||
         localStorage.getItem('dino_ref_code') ||
         sessionStorage.getItem('dino_ref_code') ||
         '')
      : '';
    if (cleanRef) {
      searchParams.set('ref', cleanRef);
    }
    return `/gen-dino/index.html?${searchParams.toString()}`;
  });

  // 4. Bidirectional message synchronization with iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      const data = event.data;
      if (data.source !== 'gen-dino-shell' && data.event !== 'balance' && data.event !== 'exit' && data.event !== 'auth') {
        return;
      }
      if (data.event === 'auth' && data.token) {
        try {
          localStorage.setItem('pg_auth_token', data.token);
          localStorage.setItem('paygateway_token', data.token);
          localStorage.setItem('token', data.token);
        } catch (_) {}
      }
      if (data.event === 'exit' && onReturnToPortal) {
        onReturnToPortal();
      }
      if (data.event === 'toast' && data.message) {
        showToast(String(data.message), data.type || 'info');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onReturnToPortal]);

  const handleIframeLoad = () => {
    const currentToken = typeof window !== 'undefined'
      ? localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || ''
      : '';
    if (iframeRef.current && iframeRef.current.contentWindow && currentToken) {
      iframeRef.current.contentWindow.postMessage({
        source: 'gen-dino-parent',
        token: currentToken,
        type: 'set-session'
      }, '*');
    }
  };

  return (
    <div className="fixed inset-0 w-screen h-screen bg-[#070b14] overflow-hidden m-0 p-0 select-none z-50">
      {/* Toast notifications */}
      {toast && (
        <div className="absolute top-4 right-4 z-50">
          <Toast
            message={toast.message}
            type={toast.type}
            duration={3000}
            onClose={() => setToast(null)}
          />
        </div>
      )}

      {/* If accessed via the Gateway Panel "JOGAR" button (and not standalone domain), show a floating back button */}
      {onReturnToPortal && !isStandaloneDinoDomain && (
        <button
          onClick={onReturnToPortal}
          type="button"
          className="absolute top-3 left-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white/90 text-xs font-semibold backdrop-blur-md border border-slate-700/60 shadow-lg transition-all cursor-pointer"
          title="Voltar ao Painel"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Voltar ao Painel</span>
        </button>
      )}

      {/* Main Full-Screen Game Frame */}
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Dino Pay Game"
        onLoad={handleIframeLoad}
        className="w-full h-full border-0 block m-0 p-0"
        allow="autoplay; fullscreen; accelerometer; gyroscope; clipboard-write"
        id="dino-game-frame"
      />
    </div>
  );
};
