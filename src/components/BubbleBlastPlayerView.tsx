import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw } from 'lucide-react';
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

/** Bubble Blast is a self-contained demo with virtual credits, not the account wallet. */
export const BubbleBlastPlayerView: React.FC<Props> = ({ user, onBack }) => {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => {
    const url = new URL(GAME_ASSETS.bubbleBlast.app, window.location.href);
    url.searchParams.set('embedded', '1');
    if (user?.id != null) url.searchParams.set('player', String(user.id));
    url.searchParams.set('v', String(attempt));
    return url.toString();
  }, [attempt, user?.id]);

  useEffect(() => {
    setTrackedGame('g_bubble_blast', 'bubbleblast_player_view');
  }, []);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== 'bubbleblast:back') return;
      if (event.source !== document.querySelector<HTMLIFrameElement>('#bubbleblast-frame')?.contentWindow) return;
      onBack();
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onBack]);

  useEffect(() => {
    if (loaded) return;
    const timer = window.setTimeout(() => setFailed(true), 15000);
    return () => window.clearTimeout(timer);
  }, [loaded, attempt]);

  const retry = () => { setLoaded(false); setFailed(false); setAttempt(value => value + 1); };

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#110e24] text-white">
      <header className="z-10 flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#1a1438] px-3 safe-area-inset-top">
        <button type="button" onClick={onBack} className="flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-bold" aria-label="Voltar aos jogos">
          <ArrowLeft size={18} /> <span>Voltar</span>
        </button>
        <div className="min-w-0 text-center"><strong className="block truncate text-sm">Bubble Blast</strong><small className="block text-[10px] text-purple-200">Créditos virtuais de teste</small></div>
        <button type="button" onClick={retry} className="grid min-h-11 min-w-11 place-items-center rounded-xl bg-white/10" aria-label="Recarregar jogo"><RefreshCw size={18} /></button>
      </header>
      <div className="relative min-h-0 flex-1">
        {!loaded && !failed && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[#110e24]"><Loader2 className="animate-spin text-sky-400" /><span>Carregando o jogo…</span></div>}
        {failed && <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#110e24] p-6 text-center"><p>Não foi possível carregar o jogo.</p><button type="button" onClick={retry} className="rounded-xl bg-sky-500 px-5 py-3 font-bold">Tentar novamente</button></div>}
        <iframe id="bubbleblast-frame" key={src} src={src} title="Bubble Blast — créditos virtuais" className="h-full w-full border-0" allow="autoplay; fullscreen" onLoad={() => {setLoaded(true);setFailed(false);}} onError={() => setFailed(true)} />
      </div>
    </div>
  );
};
