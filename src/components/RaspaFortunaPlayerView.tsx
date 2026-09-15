import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Loader2, ExternalLink, RefreshCw } from 'lucide-react';
import { GAME_ASSETS } from '../config/gameAssets';
import { User } from '../types';

interface Props {
  user?: User;
  onBack: () => void;
  onDeposit?: () => void;
  onBalanceChange: (balance: number) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const RaspaFortunaPlayerView: React.FC<Props> = ({
  user,
  onBack,
  onDeposit,
  onBalanceChange,
  onShowToast,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [iframeSrc, setIframeSrc] = useState<string>(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('pg_auth_token') ||
          localStorage.getItem('paygateway_token') ||
          localStorage.getItem('token') ||
          ''
        : '';
    const separator = GAME_ASSETS.raspaFortuna.app.includes('?') ? '&' : '?';
    return `${GAME_ASSETS.raspaFortuna.app}${separator}embedded=1${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  });

  // Send current session / balance to the game
  const sendSessionToIframe = () => {
    if (!iframeRef.current?.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        {
          source: 'tribopay-parent',
          event: 'session',
          balance: Number(user?.balance || 0),
          user: user
            ? {
                name: user.name,
                phone: user.phone,
                email: user.email,
              }
            : null,
        },
        '*'
      );
    } catch (_) {}
  };

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (!event.data) return;
      const data = event.data;
      if (data.source !== 'raspa-fortuna-shell') return;

      if (data.event === 'ready') {
        sendSessionToIframe();
      }
      if (data.event === 'balance') {
        const newBalance = Number(data.balance);
        if (!isNaN(newBalance) && user && user.balance !== newBalance) {
          onBalanceChange(newBalance);
        }
      }
      if (data.event === 'deposit') {
        if (onDeposit) onDeposit();
        else onShowToast('Abra a tela de depósito PIX.', 'info');
      }
      if (data.event === 'exit') {
        onBack();
      }
      if (data.event === 'error') {
        onShowToast(String(data.message || 'Erro no Raspa Fortuna.'), 'error');
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
    const separator = GAME_ASSETS.raspaFortuna.app.includes('?') ? '&' : '?';
    setIframeSrc(`${GAME_ASSETS.raspaFortuna.app}${separator}_t=${Date.now()}`);
  };

  return (
    <div className="fixed inset-0 z-[70] bg-[#050706] flex flex-col">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-[90] bg-[#050706]/90 border-b border-emerald-950/40 px-3 py-2 flex items-center justify-between backdrop-blur-md">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar ao lobby"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/10 text-white font-mono text-xs font-bold hover:bg-white/20 transition-all cursor-pointer shadow-lg active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar ao Lobby</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-black tracking-wider text-emerald-400 uppercase bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full">
            Raspa Fortuna
          </span>
          <button
            type="button"
            onClick={handleReload}
            title="Recarregar jogo"
            aria-label="Recarregar jogo"
            className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 w-full h-full overflow-hidden">
        {!loaded && !failed && (
          <div className="absolute inset-0 z-[80] grid place-items-center bg-[#050706] text-white">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
              <span className="text-xs font-bold text-slate-300">Carregando Raspa Fortuna...</span>
            </div>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 z-[80] grid place-items-center bg-[#050706] p-6 text-white">
            <div className="max-w-xs text-center space-y-4">
              <p className="font-bold text-slate-200">Não foi possível carregar o Raspa Fortuna no iframe.</p>
              <button
                type="button"
                onClick={() => window.open(GAME_ASSETS.raspaFortuna.app, '_blank')}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 text-xs font-black text-black transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Abrir em nova aba
              </button>
            </div>
          </div>
        )}

        <iframe
          ref={iframeRef}
          key={iframeSrc}
          src={iframeSrc}
          title="Raspa Fortuna"
          onLoad={handleIframeLoad}
          onError={() => setFailed(true)}
          className="absolute inset-0 z-0 h-full w-full border-0"
          allow="autoplay; fullscreen; clipboard-write"
        />
      </div>
    </div>
  );
};
