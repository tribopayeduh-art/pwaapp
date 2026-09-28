import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Loader2, ExternalLink, RefreshCw, Play, LayoutGrid } from 'lucide-react';
import { GAME_ASSETS } from '../config/gameAssets';
import { User } from '../types';
import { setTrackedGame } from '../lib/gameTracking';

interface Props {
  user?: User;
  onBack: () => void;
  onDeposit?: () => void;
  onBalanceChange?: (balance: number) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const SubwayPayPlayerView: React.FC<Props> = ({
  user,
  onBack,
  onDeposit,
  onBalanceChange,
  onShowToast,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<'lobby' | 'runner'>('runner');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setTrackedGame('g_subway_pay', 'subway_player_view');
  }, []);

  const buildUrl = (targetMode: 'lobby' | 'runner') => {
    const base = targetMode === 'runner' ? GAME_ASSETS.subwayPay.runner : GAME_ASSETS.subwayPay.app;
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('pg_auth_token') ||
          localStorage.getItem('paygateway_token') ||
          localStorage.getItem('token') ||
          ''
        : '';
    const separator = base.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    params.set('embedded', '1');
    if (token) params.set('token', token);
    if (user?.email) params.set('email', user.email);
    if (user?.name) params.set('name', user.name);
    if (typeof user?.balance === 'number') params.set('balance', String(user.balance));
    return `${base}${separator}${params.toString()}`;
  };

  const [iframeSrc, setIframeSrc] = useState<string>(() => buildUrl('runner'));

  const switchMode = (newMode: 'lobby' | 'runner') => {
    setMode(newMode);
    setLoaded(false);
    setFailed(false);
    setIframeSrc(buildUrl(newMode));
  };

  // Send current session / balance to the iframe
  const sendSessionToIframe = () => {
    if (!iframeRef.current?.contentWindow) return;
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('pg_auth_token') ||
          localStorage.getItem('paygateway_token') ||
          localStorage.getItem('token') ||
          ''
        : '';
    try {
      iframeRef.current.contentWindow.postMessage(
        {
          source: 'tribopay-parent',
          event: 'session',
          balance: Number(user?.balance || 0),
          token,
          user: user
            ? {
                id: user.id,
                name: user.name,
                phone: user.phone,
                email: user.email,
                balance: Number(user?.balance || 0),
              }
            : null,
        },
        '*'
      );
    } catch (_) {}
  };

  useEffect(() => {
    if (loaded) {
      sendSessionToIframe();
    }
  }, [user?.balance, loaded]);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!event.data) return;
      const data = event.data;
      if (data.source === 'subway-pay-shell' || data.event === 'balance') {
        const newBalance = Number(data.balance);
        if (!isNaN(newBalance) && user && user.balance !== newBalance && onBalanceChange) {
          onBalanceChange(newBalance);
        }
      }
      if (data.event === 'deposit_success') {
        const newBalance = Number(data.balance);
        if (!isNaN(newBalance) && onBalanceChange) {
          onBalanceChange(newBalance);
        }
        const creditedAmount = Number(data.amount || 0);
        onShowToast(`Depósito de R$ ${creditedAmount.toFixed(2)} confirmado via PIX!`, 'success');
      }
      if (data.event === 'deposit') {
        // Subway Pay has its own native integrated deposit screen, do not open platform modal
        if (mode === 'runner') {
          switchMode('lobby');
        }
        try {
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.location.hash = 'depositar';
          }
        } catch (_) {}
      }
      if (data.event === 'exit') {
        onBack();
      }
    };

    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [user, onBack, onDeposit, onBalanceChange, onShowToast]);

  const handleIframeLoad = () => {
    setLoaded(true);
    setFailed(false);
    sendSessionToIframe();
  };

  const handleReload = () => {
    setLoaded(false);
    setFailed(false);
    const separator = iframeSrc.includes('?') ? '&' : '?';
    setIframeSrc(`${iframeSrc}${separator}_t=${Date.now()}`);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[#0b1329] overflow-hidden select-none">
      {/* Minimal Floating Back Button (iOS translucent style) */}
      <button
        type="button"
        onClick={onBack}
        aria-label="Voltar"
        className="absolute top-3 left-3 z-[90] flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white/90 hover:text-white border border-white/15 backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer text-xs font-semibold"
      >
        <ArrowLeft className="h-4 w-4 text-amber-400" />
        <span className="hidden sm:inline">Voltar</span>
      </button>

      <div className="relative w-full h-full overflow-hidden">
        {!loaded && !failed && (
          <div className="absolute inset-0 z-[80] grid place-items-center bg-[#0b1329] text-white">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
              <span className="text-xs font-bold text-amber-200">Carregando Subway Pay...</span>
            </div>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 z-[80] grid place-items-center bg-[#0b1329] p-6 text-white">
            <div className="max-w-xs text-center space-y-4">
              <p className="font-bold text-slate-200">Não foi possível carregar o Subway Pay no iframe.</p>
              <button
                type="button"
                onClick={() => window.open(GAME_ASSETS.subwayPay.app, '_blank')}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 px-5 text-xs font-black text-slate-950 transition-colors cursor-pointer"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir em nova aba
              </button>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Subway Pay"
          className="w-full h-full border-0 bg-transparent"
          allow="autoplay; fullscreen; clipboard-read; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
          onLoad={handleIframeLoad}
          onError={() => {
            setLoaded(true);
            setFailed(true);
          }}
        />
      </div>
    </div>
  );
};
