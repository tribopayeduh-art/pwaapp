import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Game, User, AffiliateInfo } from '../types';
import { IGamingPlayerView } from './IGamingPlayerView';
import { ZumblaPlayerView } from './ZumblaPlayerView';
import { GenDinoPlayerView } from './GenDinoPlayerView';
import { RaspaFortunaPlayerView } from './RaspaFortunaPlayerView';
import { SubwayPayPlayerView } from './SubwayPayPlayerView';
import { BubbleBlastPlayerView } from './BubbleBlastPlayerView';
import { GAME_ASSETS } from '../config/gameAssets';
import { setTrackedGame } from '../lib/gameTracking';
import { applyGameSEO } from '../lib/seo';
import {
  Search,
  Send,
  ArrowLeft,
  Users,
  Settings,
  UserPlus,
  CheckCircle2,
  BadgeDollarSign,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from 'lucide-react';

interface GamesViewProps {
  games?: Game[];
  user: User;
  affiliateInfo?: AffiliateInfo | null;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
  onDeposit?: (gameId?: string) => void;
  onWithdraw?: () => void;
  onPlayGame?: (betAmount: number) => void;
  onBalanceChange?: (balance: number) => void;
  onOpenReferral?: () => void;
  onOpenProfile?: () => void;
}

interface GameCatalogItem {
  id: string;
  title: string;
  category: 'originais' | 'slots' | 'crash' | 'mesa';
  multiplier: string;
  badge?: 'POPULAR' | 'HOT' | 'NOVO' | 'EXCLUSIVO' | 'EM BREVE';
  playersOnline: number;
  image: string;
  accentColor: string;
}

const GAMES_LIST: GameCatalogItem[] = [
  {
    id: 'subwaypay',
    title: 'Subway Pay',
    category: 'originais',
    multiplier: 'x10.00',
    badge: 'NOVO',
    playersOnline: 412,
    image: GAME_ASSETS.subwayPay.cover,
    accentColor: 'from-amber-500 to-yellow-600',
  },
  {
    id: 'blockwin',
    title: 'Block Win',
    category: 'originais',
    multiplier: 'x2.90',
    badge: 'EXCLUSIVO',
    playersOnline: 487,
    image: GAME_ASSETS.blockWin.cover,
    accentColor: 'from-cyan-500 to-blue-600',
  },
  {
    id: 'zumbla',
    title: 'Zumbla Win',
    category: 'originais',
    multiplier: 'x5.00',
    badge: 'NOVO',
    playersOnline: 316,
    image: GAME_ASSETS.zumbla.cover,
    accentColor: 'from-lime-500 to-green-700',
  },
  {
    id: 'gen-dino',
    title: 'GEN DINO',
    category: 'originais',
    multiplier: 'R$ 1 por moeda',
    badge: 'NOVO',
    playersOnline: 228,
    image: GAME_ASSETS.genDino.cover,
    accentColor: 'from-orange-500 to-cyan-600',
  },
  {
    id: 'raspa-fortuna',
    title: 'Raspa Fortuna',
    category: 'originais',
    multiplier: 'x10.00',
    badge: 'NOVO',
    playersOnline: 195,
    image: GAME_ASSETS.raspaFortuna.cover,
    accentColor: 'from-emerald-600 to-green-950',
  },
  {
    id: 'bubble-blast',
    title: 'Bubble Blast',
    category: 'originais',
    multiplier: 'x5.00',
    badge: 'NOVO',
    playersOnline: 264,
    image: GAME_ASSETS.bubbleBlast.cover,
    accentColor: 'from-fuchsia-500 to-pink-600',
  },
];

export const GamesView: React.FC<GamesViewProps> = ({
  games = [],
  user,
  affiliateInfo,
  onShowToast,
  onDeposit,
  onWithdraw,
  onPlayGame,
  onBalanceChange,
  onOpenReferral,
  onOpenProfile,
}) => {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<'todos' | 'originais' | 'slots' | 'crash' | 'mesa'>('todos');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [coverflowIndex, setCoverflowIndex] = useState<number>(0);
  const [metricsGame, setMetricsGame] = useState<GameCatalogItem | null>(null);
  const dragStartX = useRef<number | null>(null);

  const referralCode = user?.referralCode || (user?.id ? user.id.substring(0, 8).toUpperCase() : '') || 'BLOCK';
  const catalogGames = useMemo<GameCatalogItem[]>(() => {
    const builtinAliases = new Set([
      'blockwin', 'block-puzzle', 'g_block', 'g_block_puzzle',
      'zumbla', 'g_zumbla',
      'gen-dino', 'gen_dino', 'g_gen_dino',
      'raspa-fortuna', 'raspa_fortuna', 'g_raspa_fortuna', 'raspafortuna',
      'subwaypay', 'subway-pay', 'subway_pay', 'g_subway_pay', 'g-subway-pay',
      'bubble-blast', 'bubbleblast', 'bubble_blast', 'g_bubble_blast'
    ]);
    const dynamicGames = games
      .filter((game) => !builtinAliases.has(String(game.id).toLowerCase()))
      .map((game) => ({
        id: game.id,
        title: game.name,
        category: (['originais', 'slots', 'crash', 'mesa'].includes(String(game.category).toLowerCase())
          ? String(game.category).toLowerCase()
          : 'originais') as GameCatalogItem['category'],
        multiplier: 'Disponível',
        playersOnline: 0,
        image: game.imageUrl,
        accentColor: 'from-slate-700 to-slate-950',
      }));
    return [...GAMES_LIST, ...dynamicGames];
  }, [games]);

  const handleIndicateGame = async (e: React.MouseEvent | undefined, game: GameCatalogItem) => {
    e?.stopPropagation();
    const normalizedGame = normalizeGameId(game.id);
    const gameDomain = normalizedGame === 'raspa-fortuna'
      ? 'https://raspadinhaadasorte.site'
      : normalizedGame === 'gen-dino'
        ? 'https://dinopay.site'
        : normalizedGame === 'blockwin'
          ? 'https://blockwinner.site'
          : normalizedGame === 'subwaypay'
            ? 'https://joguesubway.surf'
            : normalizedGame === 'bubble-blast' || normalizedGame === 'zumbla'
              ? 'https://zumblapay.site'
              : window.location.origin;
    const gameReferralUrl = `${gameDomain}/cadastro?ref=${encodeURIComponent(referralCode)}&game=${encodeURIComponent(normalizedGame)}`;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(gameReferralUrl);
      } else {
        const input = document.createElement('textarea');
        input.value = gameReferralUrl;
        input.setAttribute('readonly', '');
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.select();
        const copied = document.execCommand('copy');
        input.remove();
        if (!copied) throw new Error('copy_failed');
      }
      const commPercent = affiliateInfo?.revSharePercent ?? 70;
      onShowToast(`Link de indicação do ${game.title} copiado! Comissão configurada: ${commPercent}%.`, 'success');
    } catch {
      window.prompt(`Copie seu link de indicação do ${game.title}:`, gameReferralUrl);
      onShowToast('Seu link está pronto para copiar.', 'info');
    }
  };

  const filteredGames = catalogGames.filter((game) => {
    const matchesCategory = activeCategory === 'todos' || game.category === activeCategory;
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    setCoverflowIndex(0);
  }, [activeCategory, searchQuery]);

  useEffect(() => {
    if (coverflowIndex > Math.max(0, filteredGames.length - 1)) setCoverflowIndex(0);
  }, [coverflowIndex, filteredGames.length]);

  useEffect(() => {
    if (selectedGameId) {
      applyGameSEO(selectedGameId);
    } else {
      applyGameSEO('alliance-hub');
    }
    return () => {
      applyGameSEO('alliance-hub');
    };
  }, [selectedGameId]);

  const normalizeGameId = (rawId: string) => {
    const id = String(rawId || '').trim().toLowerCase().replace(/_/g, '-');
    if (['blockwin', 'block-puzzle', 'g-block', 'g-block-puzzle'].includes(id)) return 'blockwin';
    if (['zumbla', 'zumbla-win', 'g-zumbla'].includes(id)) return 'zumbla';
    if (['gen-dino', 'gendino', 'g-gen-dino'].includes(id)) return 'gen-dino';
    if (['raspa-fortuna', 'raspafortuna', 'raspa_fortuna', 'g-raspa-fortuna'].includes(id)) return 'raspa-fortuna';
    if (['subwaypay', 'subway-pay', 'subway_pay', 'g-subway-pay', 'g_subway_pay', 'subway'].includes(id)) return 'subwaypay';
    if (['bubble-blast', 'bubbleblast', 'bubble_blast', 'g-bubble-blast', 'g_bubble_blast'].includes(id)) return 'bubble-blast';
    return rawId;
  };

  const indicationMatchesGame = (lastGameId: string | undefined, gameId: string) => {
    if (!lastGameId) return false;
    return normalizeGameId(lastGameId) === normalizeGameId(gameId);
  };

  const getGameAffiliateMetrics = (game: GameCatalogItem) => {
    const indications = affiliateInfo?.indications || [];
    const matched = indications.filter((item) => indicationMatchesGame(item.lastGameId, game.id));
    const influencers = matched.filter((item) => item.isInfluencer);
    const directPlayers = matched.filter((item) => !item.isInfluencer);
    const registrations = influencers.reduce((total, item) => total + Number(item.subReferralsCount || 0), 0) + directPlayers.length;
    const ftds = influencers.reduce((total, item) => total + Number(item.ftdCount || 0), 0) + directPlayers.filter((item) => Number(item.totalDeposited || 0) > 0).length;
    const deposits = influencers.reduce((total, item) => total + Number(item.subNetworkDeposits || 0), 0) + directPlayers.reduce((total, item) => total + Number(item.totalDeposited || 0), 0);
    return {
      registrations,
      ftds,
      influencers: influencers.length,
      deposits,
      conversion: registrations > 0 ? (ftds / registrations) * 100 : 0,
      rows: matched,
    };
  };

  const launchGame = (game: GameCatalogItem) => {
    const normalizedId = normalizeGameId(game.id);
    dragStartX.current = null;
    setSelectedGameId(normalizedId);
    if (normalizedId) {
      setTrackedGame(normalizedId, 'lobby_launch_click');
    }
  };

  // If a game is explicitly selected by clicking "JOGAR", show that specific game view with a Back button
  if (selectedGameId === 'blockwin') {
    return (
      <div className="relative">
        {/* Top Back Navigation Bar */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
          <button
            onClick={() => setSelectedGameId(null)}
            type="button"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-[#111111] font-mono text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-[#111111]" />
            <span>Voltar ao Lobby de Jogos</span>
          </button>

          <span className="text-xs font-bold font-mono text-slate-800 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            Block Win
          </span>
        </div>

        <IGamingPlayerView
          user={user}
          onDeposit={() => {
            if (onDeposit) onDeposit('g_block_puzzle');
            else onShowToast('Abre o modal de depósito PIX.', 'info');
          }}
          onWithdraw={() => {
            if (onWithdraw) onWithdraw();
            else onShowToast('Abre o modal de saque PIX.', 'info');
          }}
          onPlayGame={(betAmount) => {
            if (onPlayGame) {
              onPlayGame(betAmount);
            } else {
              onShowToast(`Aposta de R$ ${betAmount.toFixed(2)} iniciada!`, 'success');
            }
          }}
          onOpenReferral={() => {
            if (onOpenReferral) onOpenReferral();
            else onShowToast('Área de indicação.', 'info');
          }}
          onOpenProfile={() => {
            if (onOpenProfile) onOpenProfile();
            else onShowToast('Perfil do usuário.', 'info');
          }}
          onShowToast={onShowToast}
        />
      </div>
    );
  }

  if (normalizeGameId(selectedGameId || '') === 'zumbla') {
    return (
      <ZumblaPlayerView
        user={user}
        onBack={() => setSelectedGameId(null)}
        onDeposit={() => onDeposit?.('g_zumbla')}
        onBalanceChange={(balance) => onBalanceChange?.(balance)}
        onShowToast={onShowToast}
      />
    );
  }

  if (normalizeGameId(selectedGameId || '') === 'subwaypay') {
    return (
      <SubwayPayPlayerView
        user={user}
        onBack={() => setSelectedGameId(null)}
        onDeposit={() => onDeposit?.('g_subway_pay')}
        onBalanceChange={(balance) => onBalanceChange?.(balance)}
        onShowToast={onShowToast}
      />
    );
  }

  if (normalizeGameId(selectedGameId || '') === 'gen-dino') {
    return (
      <GenDinoPlayerView
        user={user}
        onBack={() => setSelectedGameId(null)}
        onBalanceChange={(balance) => onBalanceChange?.(balance)}
        onShowToast={onShowToast}
      />
    );
  }

  if (normalizeGameId(selectedGameId || '') === 'raspa-fortuna') {
    return (
      <RaspaFortunaPlayerView
        user={user}
        onBack={() => setSelectedGameId(null)}
        onDeposit={() => onDeposit?.('g_raspa_fortuna')}
        onBalanceChange={(balance) => onBalanceChange?.(balance)}
        onShowToast={onShowToast}
      />
    );
  }

  if (normalizeGameId(selectedGameId || '') === 'bubble-blast') {
    return (
      <BubbleBlastPlayerView
        user={user}
        onBack={() => setSelectedGameId(null)}
        onDeposit={() => onDeposit?.('g_bubble_blast')}
        onBalanceChange={(balance) => onBalanceChange?.(balance)}
        onShowToast={onShowToast}
      />
    );
  }

  // If another game ID is selected
  if (selectedGameId !== null && selectedGameId !== 'blockwin') {
    const selectedGame = catalogGames.find((g) => g.id === selectedGameId);
    return (
      <div className="min-h-screen bg-slate-50 text-[#111111] p-4 flex flex-col items-center justify-center space-y-6">
        <button
          onClick={() => setSelectedGameId(null)}
          type="button"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-[#111111] font-mono text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 text-[#111111]" />
          <span>Voltar ao Lobby de Jogos</span>
        </button>

        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 text-center space-y-4 shadow-sm">
          <div className="w-24 h-24 mx-auto rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
            <img src={selectedGame?.image} alt={selectedGame?.title} className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-black font-mono text-[#111111]">{selectedGame?.title}</h2>
          <p className="text-xs text-slate-600 font-mono">
            Multiplicador de até <strong className="text-amber-600 font-bold">{selectedGame?.multiplier}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              if (onPlayGame) onPlayGame(10);
              else onShowToast(`Entrando no jogo ${selectedGame?.title}...`, 'success');
            }}
            className="w-full py-3.5 bg-[#111111] hover:bg-black text-white font-bold font-mono text-sm rounded-2xl uppercase tracking-wider shadow-sm cursor-pointer"
          >
            Iniciar Rodada
          </button>
        </div>
      </div>
    );
  }

  const playSlideSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(360, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(520, context.currentTime + 0.055);
      gain.gain.setValueAtTime(0.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.075);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
      oscillator.addEventListener('ended', () => context.close());
    } catch (_) {
      // Navegadores que bloqueiam WebAudio continuam com o carrossel normalmente.
    }
  };

  const selectCoverflowGame = (index: number) => {
    if (!filteredGames.length) return;
    const normalized = (index + filteredGames.length) % filteredGames.length;
    if (normalized === coverflowIndex) return;
    setCoverflowIndex(normalized);
    playSlideSound();
  };

  const coverflowDistance = (index: number) => {
    const total = filteredGames.length;
    if (!total) return 0;
    let distance = index - coverflowIndex;
    if (distance > total / 2) distance -= total;
    if (distance < -total / 2) distance += total;
    return distance;
  };

  const categories = [
    { id: 'todos', label: 'Todos' },
    { id: 'originais', label: 'Originais' },
    { id: 'crash', label: 'Crash' },
    { id: 'slots', label: 'Slots' },
    { id: 'mesa', label: 'Mesa' },
  ];

  return (
    <div className="games-view relative min-h-screen select-none overflow-hidden bg-[#f5f7fa] px-3 pb-28 pt-3 text-[#111827] sm:px-4">
      <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 top-64 h-52 w-52 rounded-full bg-violet-200/25 blur-3xl" />

      <div className="relative mx-auto max-w-md space-y-3.5">
        {/* Coverflow / Center Mode — "Escolha seu próximo jogo" */}
        {filteredGames.length > 0 ? (
          <section aria-label="Jogos em destaque" className="games-coverflow-section relative overflow-hidden rounded-[28px] border border-white bg-white/90 py-4 shadow-[0_18px_50px_rgba(15,23,42,.09)] backdrop-blur-xl">
            <div className="mb-2 flex items-start justify-between px-4">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[.18em] text-cyan-600"><span className="h-1.5 w-1.5 rounded-full bg-cyan-500" /> Destaques</div>
                <h2 className="text-[17px] font-black tracking-[-.025em] text-slate-950">Escolha seu próximo jogo</h2>
                <p className="mt-0.5 text-[10px] font-medium text-slate-400">Deslize para navegar pelo catálogo</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-black tabular-nums text-slate-500">
                {String(coverflowIndex + 1).padStart(2, '0')} / {String(filteredGames.length).padStart(2, '0')}
              </span>
            </div>

            <div
              className="games-coverflow-viewport relative w-full cursor-grab touch-pan-y overflow-hidden active:cursor-grabbing"
              onPointerDown={(event) => {
                if ((event.target as HTMLElement).closest('button')) return;
                dragStartX.current = event.clientX;
                event.currentTarget.setPointerCapture?.(event.pointerId);
              }}
              onPointerUp={(event) => {
                if (dragStartX.current === null) return;
                const delta = event.clientX - dragStartX.current;
                dragStartX.current = null;
                if (Math.abs(delta) < 35) return;
                selectCoverflowGame(coverflowIndex + (delta < 0 ? 1 : -1));
              }}
              onPointerCancel={() => { dragStartX.current = null; }}
            >
              {filteredGames.map((game, index) => {
                const distance = coverflowDistance(index);
                const absoluteDistance = Math.abs(distance);
                const isActive = distance === 0;
                const isVisible = absoluteDistance <= 2;
                return (
                  <article
                    key={game.id}
                    aria-hidden={!isVisible}
                    onClick={() => !isActive && selectCoverflowGame(index)}
                    className={`games-coverflow-card absolute left-1/2 top-2 w-[62%] max-w-[255px] overflow-hidden rounded-[25px] border bg-white transition-all duration-[380ms] ease-[cubic-bezier(.2,.8,.2,1)] ${isActive ? 'is-active border-white shadow-[0_22px_40px_rgba(15,23,42,.22)]' : 'cursor-pointer border-white/70 shadow-lg'}`}
                    style={{
                      transform: `translateX(calc(-50% + ${distance * 69}%)) scale(${isActive ? 1 : absoluteDistance === 1 ? 0.78 : 0.63}) perspective(900px) rotateY(${distance * -13}deg)`,
                      zIndex: 20 - absoluteDistance,
                      opacity: isVisible ? (isActive ? 1 : absoluteDistance === 1 ? 0.66 : 0.28) : 0,
                      filter: isActive ? 'none' : 'saturate(.72) brightness(.9)',
                      pointerEvents: isVisible ? 'auto' : 'none',
                    }}
                  >
                    <div className="relative aspect-[3/4.35] overflow-hidden bg-slate-100">
                      <img src={game.image} alt={game.title} loading={isActive ? 'eager' : 'lazy'} draggable={false} className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/5 to-black/10" />
                      {game.badge && <span className="absolute left-3 top-3 rounded-full border border-white/25 bg-black/50 px-2.5 py-1 text-[8px] font-black tracking-[.12em] text-white backdrop-blur-md">{game.badge}</span>}
                      {isActive && (
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setMetricsGame(game); }}
                          aria-label={`Ver métricas do ${game.title}`}
                          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/75 cursor-pointer"
                          title="Ver métricas de indicação"
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isActive && (
                        <div className="games-coverflow-actions absolute inset-x-0 bottom-0 p-4 text-white">
                          <h3 className="text-[19px] font-black leading-tight tracking-[-.02em] drop-shadow-md">{game.title}</h3>
                          <div className="mt-1.5 flex items-center justify-between text-[9px] font-bold text-white/75">
                            <span className="rounded-full bg-white/15 px-2 py-1 backdrop-blur-md">
                              {game.multiplier.toLowerCase().includes('breve') ? game.multiplier : `Até ${game.multiplier}`}
                            </span>
                            {game.playersOnline > 0 && <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /><Users className="h-3 w-3" />{game.playersOnline}</span>}
                          </div>
                          <div className="mt-3 flex items-center">
                            <button
                              type="button"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => { event.preventDefault(); event.stopPropagation(); void handleIndicateGame(event, game); }}
                              className="w-full flex h-11 items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs shadow-lg shadow-cyan-950/40 border border-white/25 transition-all active:translate-y-px cursor-pointer"
                            >
                              <Send className="h-3.5 w-3.5 text-white" />
                              <span>Indicar</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-0 flex items-center justify-center gap-3 px-4">
              <button type="button" onClick={() => selectCoverflowGame(coverflowIndex - 1)} aria-label="Jogo anterior" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 active:scale-95">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5" aria-label="Paginação dos jogos">
                {filteredGames.map((game, index) => (
                  <button key={game.id} type="button" onClick={() => selectCoverflowGame(index)} aria-label={`Selecionar ${game.title}`} className={`h-1.5 rounded-full transition-all duration-300 ${index === coverflowIndex ? 'w-7 bg-cyan-500' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}`} />
                ))}
              </div>
              <button type="button" onClick={() => selectCoverflowGame(coverflowIndex + 1)} aria-label="Próximo jogo" className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:bg-slate-100 active:scale-95">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : (
          <div className="rounded-[26px] border border-dashed border-slate-300 bg-white/90 px-6 py-12 text-center shadow-sm">
            <Search className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-black text-slate-700">Nenhum jogo encontrado</p>
            <p className="mt-1 text-[10px] font-medium text-slate-400">Tente outro nome ou selecione a categoria Todos.</p>
            <button type="button" onClick={() => { setSearchQuery(''); setActiveCategory('todos'); }} className="mt-4 rounded-xl bg-slate-950 px-4 py-2 text-[10px] font-black text-white">Limpar filtros</button>
          </div>
        )}

        {/* Área de Pesquisa e Categorias — posicionada abaixo de Escolha seu próximo jogo */}
        <div id="games-search-area" className="rounded-[22px] border border-white bg-white/80 p-2.5 shadow-[0_10px_30px_rgba(15,23,42,.055)] backdrop-blur-xl">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Qual jogo você procura?"
              className="h-11 w-full rounded-[15px] border border-slate-200 bg-slate-50/80 pl-10 pr-10 text-xs font-semibold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100/70"
            />
            {searchQuery ? (
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Limpar busca" className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-200/70">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : (
              <SlidersHorizontal className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
            )}
          </div>

          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id as typeof activeCategory)}
                type="button"
                className={`h-8 shrink-0 rounded-xl px-3.5 text-[10px] font-extrabold transition-all duration-300 ${
                  activeCategory === cat.id
                    ? 'bg-[#101827] text-white shadow-[0_6px_16px_rgba(15,23,42,.2)]'
                    : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {metricsGame && (() => {
          const metrics = getGameAffiliateMetrics(metricsGame);
          return (
            <div className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center bg-slate-950/60 p-3 sm:p-5 backdrop-blur-xs min-h-[100dvh]" role="dialog" aria-modal="true" aria-label={`Métricas do ${metricsGame.title}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setMetricsGame(null); }}>
              <section className="game-affiliate-metrics-sheet max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/20 bg-white p-5 my-auto shadow-2xl">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3"><img src={metricsGame.image} alt="" className="h-14 w-14 rounded-2xl object-cover shadow-md"/><div className="min-w-0"><span className="text-[9px] font-black uppercase tracking-[.16em] text-cyan-600">Operação do afiliado</span><h2 className="truncate text-lg font-black text-slate-950">{metricsGame.title}</h2><p className="text-[10px] font-semibold text-slate-400">Dados atribuídos a este jogo</p></div></div>
                  <button type="button" onClick={() => setMetricsGame(null)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600" aria-label="Fechar"><X className="h-4 w-4"/></button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  <article className="rounded-2xl bg-slate-50 p-3"><UserPlus className="mb-3 h-4 w-4 text-blue-600"/><span className="block text-[9px] font-bold text-slate-400">Cadastros</span><strong className="text-xl font-black text-slate-950">{metrics.registrations}</strong></article>
                  <article className="rounded-2xl bg-slate-50 p-3"><CheckCircle2 className="mb-3 h-4 w-4 text-violet-600"/><span className="block text-[9px] font-bold text-slate-400">FTDs</span><strong className="text-xl font-black text-slate-950">{metrics.ftds}</strong></article>
                  <article className="rounded-2xl bg-slate-50 p-3"><Users className="mb-3 h-4 w-4 text-orange-600"/><span className="block text-[9px] font-bold text-slate-400">Influenciadores</span><strong className="text-xl font-black text-slate-950">{metrics.influencers}</strong></article>
                  <article className="rounded-2xl bg-slate-50 p-3"><TrendingUp className="mb-3 h-4 w-4 text-emerald-600"/><span className="block text-[9px] font-bold text-slate-400">Conversão</span><strong className="text-xl font-black text-slate-950">{metrics.conversion.toFixed(1)}%</strong></article>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-slate-950 p-4 text-white"><span><small className="block text-[9px] font-bold text-white/55">Depósitos atribuídos</small><strong className="text-lg font-black">R$ {metrics.deposits.toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></span><BadgeDollarSign className="h-6 w-6 text-emerald-400"/></div>
                <div className="mt-4"><div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-black text-slate-900">Atividade vinculada</h3><span className="text-[9px] font-bold text-slate-400">{metrics.rows.length} registros</span></div>{metrics.rows.length ? <div className="max-h-48 space-y-2 overflow-y-auto">{metrics.rows.slice(0,20).map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"><span className="min-w-0"><b className="block truncate text-[11px] text-slate-900">{item.referredName}</b><small className="block truncate text-[9px] text-slate-400">{item.isInfluencer ? 'Influenciador' : 'Jogador'} • {item.referredEmail}</small></span><strong className="shrink-0 text-[10px] text-emerald-600">R$ {Number(item.isInfluencer ? item.subNetworkDeposits : item.totalDeposited || 0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</strong></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-[10px] font-semibold text-slate-400">Ainda não existem dados atribuídos a este jogo.</div>}</div>
                <button type="button" onClick={(event) => void handleIndicateGame(event, metricsGame)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 text-xs font-black text-white"><Send className="h-4 w-4"/>Copiar link para indicar</button>
              </section>
            </div>
          );
        })()}
      </div>
    </div>
  );
};
