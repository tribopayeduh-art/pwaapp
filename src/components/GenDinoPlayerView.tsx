import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { GAME_ASSETS } from '../config/gameAssets';
import { User } from '../types';

interface Props {
  user?: User;
  onBack: () => void;
  onDeposit?: () => void;
  onBalanceChange: (balance: number) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const GenDinoPlayerView: React.FC<Props> = ({ user, onBack, onDeposit, onBalanceChange, onShowToast }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const lastSentSessionRef = useRef<string>('');

  // 1. Stable initial URL constructed once on mount so the iframe NEVER force-reloads on auth/balance updates
  const [iframeSrc] = useState<string>(() => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || ''
      : '';
    const separator = GAME_ASSETS.genDino.app.includes('?') ? '&' : '?';
    return `${GAME_ASSETS.genDino.app}${separator}embedded=1${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  });

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!event.data) return;
      const data = event.data;
      if (data.source !== 'gen-dino-shell' && data.event !== 'balance' && data.event !== 'balance_updated' && data.event !== 'exit' && data.event !== 'auth' && data.event !== 'deposit') {
        return;
      }
      if (data.event === 'auth' && data.token) {
        try {
          localStorage.setItem('pg_auth_token', data.token);
          localStorage.setItem('paygateway_token', data.token);
          localStorage.setItem('token', data.token);
        } catch (_) {}
      }
      if (data.event === 'balance' || data.event === 'balance_updated') {
        const newBalance = Number(data.balance);
        if (!isNaN(newBalance)) {
          const currentToken = typeof window !== 'undefined'
            ? localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || ''
            : '';
          lastSentSessionRef.current = `${currentToken}_${newBalance}_${Boolean(user?.isInfluencer)}_${user?.referralCode || ''}`;
          if (user?.balance !== newBalance) {
            onBalanceChange(newBalance);
          }
        }
      }
      if (data.event === 'deposit' && onDeposit) {
        onDeposit();
      }
      if (data.event === 'navigate-affiliates' || data.event === 'open-affiliates' || data.action === 'more') {
        onBack();
        try {
          window.dispatchEvent(new CustomEvent('app-navigate-tab', { detail: { tab: 'affiliates' } }));
        } catch (_) {}
      }
      if (data.event === 'exit') onBack();
      if (data.event === 'error') {
        onShowToast(String(data.message || 'Erro no GEN DINO.'), 'error');
      }
      if (data.event === 'toast' && data.message) {
        onShowToast(String(data.message), data.type || 'info');
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onBack, onDeposit, onBalanceChange, onShowToast, user?.isInfluencer]);

  // Synchronize balance & session into the iframe whenever user profile or token changes without reloading iframe
  useEffect(() => {
    const currentToken = typeof window !== 'undefined'
      ? localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || ''
      : '';
    const iframeEl = iframeRef.current;
    if (iframeEl && iframeEl.contentWindow && loaded) {
      const sessionKey = `${currentToken}_${user?.balance}_${Boolean(user?.isInfluencer)}_${user?.referralCode || ''}`;
      if (lastSentSessionRef.current !== sessionKey) {
        lastSentSessionRef.current = sessionKey;
        iframeEl.contentWindow.postMessage({
          source: 'gen-dino-parent',
          token: currentToken,
          type: 'set-session',
          balance: user?.balance,
          isInfluencer: Boolean(user?.isInfluencer),
          referralCode: user?.referralCode
        }, '*');
      }
    }
  }, [loaded, user?.balance, user?.isInfluencer, user?.referralCode]);

  const handleIframeLoad = () => {
    setLoaded(true);
    setFailed(false);
    const currentToken = typeof window !== 'undefined'
      ? localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || ''
      : '';
    const iframeEl = iframeRef.current;
    if (iframeEl && iframeEl.contentWindow) {
      lastSentSessionRef.current = `${currentToken}_${user?.balance}_${Boolean(user?.isInfluencer)}_${user?.referralCode || ''}`;
      iframeEl.contentWindow.postMessage({
        source: 'gen-dino-parent',
        token: currentToken,
        type: 'set-session',
        balance: user?.balance,
        isInfluencer: Boolean(user?.isInfluencer),
        referralCode: user?.referralCode
      }, '*');
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[#070816]">
      <button
        type="button"
        onClick={onBack}
        aria-label="Voltar ao lobby"
        className="fixed left-3 top-[max(12px,env(safe-area-inset-top))] z-[80] grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/55 text-white shadow-xl backdrop-blur-md cursor-pointer"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      {!loaded && !failed && <div className="absolute inset-0 z-[80] grid place-items-center bg-[#070816] text-white"><div className="flex flex-col items-center gap-3"><Loader2 className="h-7 w-7 animate-spin"/><span className="text-xs font-bold">Abrindo GEN DINO...</span></div></div>}
      {failed && <div className="absolute inset-0 z-[80] grid place-items-center bg-[#070816] p-6 text-white"><div className="max-w-xs text-center"><p className="font-bold">Não foi possível carregar o GEN DINO.</p><button type="button" onClick={() => window.location.assign(iframeSrc)} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-black cursor-pointer"><ExternalLink className="h-4 w-4"/>Abrir diretamente</button></div></div>}
      <iframe
        ref={iframeRef}
        id="gen-dino-iframe"
        key="gen-dino-v16"
        src={iframeSrc}
        title="GEN DINO"
        onLoad={handleIframeLoad}
        onError={() => setFailed(true)}
        className="absolute inset-0 z-0 h-full w-full border-0"
        allow="autoplay; fullscreen; clipboard-write"
      />
    </div>
  );
};
