import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Loader2, RefreshCw, LayoutGrid, Play } from 'lucide-react';
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

export const BubbleBlastPlayerView: React.FC<Props> = ({
  user,
  onBack,
  onDeposit,
  onBalanceChange,
  onShowToast,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<'game' | 'portal'>('game');
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setTrackedGame('g_bubble_blast', 'bubbleblast_player_view');
  }, []);

  const buildUrl = (targetMode: 'game' | 'portal') => {
    const base = targetMode === 'game' ? GAME_ASSETS.bubbleBlast.app : GAME_ASSETS.bubbleBlast.lobby;
    const separator = base.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    params.set('embedded', '1');
    if (user?.balance !== undefined) {
      params.set('betCents', String(Math.max(500, Math.min(10000, Math.round(Number(user.balance) * 100)))));
    }
    return `${base}${separator}${params.toString()}`;
  };

  const [iframeSrc, setIframeSrc] = useState<string>(() => buildUrl('game'));

  const switchMode = (newMode: 'game' | 'portal') => {
    setMode(newMode);
    setLoaded(false);
    setFailed(false);
    setIframeSrc(buildUrl(newMode));
  };

  const handleReload = () => {
    setLoaded(false);
    setFailed(false);
    if (iframeRef.current) {
      iframeRef.current.src = iframeSrc;
    }
  };

  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-[#110e24] overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="shrink-0 h-14 bg-[#1a1438]/95 backdrop-blur-md border-b border-purple-500/20 px-3 sm:px-4 flex items-center justify-between z-30">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-mono text-xs font-bold transition-all cursor-pointer border border-white/10"
            title="Voltar ao Lobby"
          >
            <ArrowLeft className="w-4 h-4 text-white" />
            <span className="hidden sm:inline">Lobby</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white tracking-wide flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
              Bubble Blast
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
              Oficial
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-black/30 p-0.5 rounded-xl border border-white/10 flex items-center">
            <button
              type="button"
              onClick={() => switchMode('game')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                mode === 'game'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              <Play className="w-3 h-3 fill-current" />
              <span>Jogo</span>
            </button>
            <button
              type="button"
              onClick={() => switchMode('portal')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                mode === 'portal'
                  ? 'bg-pink-600 text-white shadow-xs'
                  : 'text-purple-200 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Painel</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleReload}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95 border border-white/10"
            title="Recarregar Partida"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${!loaded ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Iframe Player */}
      <div className="relative flex-1 w-full h-full bg-[#0a0718]">
        {!loaded && !failed && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[#110e24] text-white">
            <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
            <div className="text-center">
              <p className="text-sm font-bold tracking-wide">Carregando Bubble Blast...</p>
              <p className="text-xs text-purple-300/70 mt-0.5">Preparando tabuleiro e bolhas</p>
            </div>
          </div>
        )}

        {failed && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-[#110e24] text-white">
            <p className="text-sm font-bold text-rose-400 mb-2">Erro ao carregar o jogo</p>
            <p className="text-xs text-purple-200 mb-4 max-w-xs">
              Não foi possível estabelecer a conexão com o motor do jogo.
            </p>
            <button
              type="button"
              onClick={handleReload}
              className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 font-bold text-xs cursor-pointer shadow-md"
            >
              Tentar Novamente
            </button>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={iframeSrc}
          title="Bubble Blast"
          className="w-full h-full border-0 outline-none"
          allow="autoplay; fullscreen; clipboard-write"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
    </div>
  );
};
