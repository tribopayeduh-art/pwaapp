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
        if (onDeposit) onDeposit();
        else onShowToast('Abra a tela de depósito PIX.', 'info');
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
    <div className="fixed inset-0 z-[70] bg-[#0b1329] flex flex-col">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-[90] bg-[#0b1329]/95 border-b border-amber-500/20 px-3 py-2 flex items-center justify-between backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar ao lobby"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/10 text-white font-mono text-xs font-bold hover:bg-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
        >
          <ArrowLeft className="h-4 w-4 text-amber-400" />
          <span>Voltar ao Lobby</span>
        </button>

        {/* Mode Switch: Lobby vs Corrida */}
        <div className="hidden sm:flex items-center bg-black/40 border border-white/10 rounded-xl p-0.5">
          <button
            type="button"
            onClick={() => switchMode('lobby')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'lobby'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Painel</span>
          </button>
          <button
            type="button"
            onClick={() => switchMode('runner')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              mode === 'runner'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Correr (Jogo)</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {onDeposit && (
            <button
              type="button"
              onClick={onDeposit}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md"
            >
              Depositar PIX
            </button>
          )}
          <button
            type="button"
            onClick={handleReload}
            title="Recarregar jogo"
            aria-label="Recarregar jogo"
            className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => window.open(iframeSrc, '_blank')}
            title="Abrir em tela cheia"
            aria-label="Abrir em nova aba"
            className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 w-full h-full overflow-hidden">
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
