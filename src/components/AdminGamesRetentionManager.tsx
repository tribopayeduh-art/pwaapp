import React, { useState } from 'react';
import {
  Sliders,
  Sparkles,
  Zap,
  ShieldAlert,
  Flame,
  Gauge,
  Play,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  SlidersHorizontal,
  Layers,
  Image as ImageIcon,
  Activity,
  DollarSign,
  TrendingUp,
  Cpu,
  Target,
  Award,
  Lock,
  Unlock,
  Radio,
  Clock,
  Sparkle,
  Globe
} from 'lucide-react';

export interface AdminGameItem {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive';
  maintenance?: boolean;
  minBet: number;
  maxBet: number;
  rtpPercent: number;
  difficulty?: 'ultra_easy' | 'easy' | 'medium' | 'moderate' | 'hard' | 'heavy' | 'extreme' | 'impossible' | string;
  totalWagered?: number;
  totalPayout?: number;
  ggr?: number;
  totalBetsCount?: number;
  totalWinsCount?: number;
  totalLossesCount?: number;
  effectiveRtp?: number;
  effectiveHouseEdge?: number;
  houseEdgeMode?: 'balanced' | 'house_advantage' | 'promo' | 'easy' | 'hard' | 'extreme';
  maxMultiplier?: number;
  antiBailoutMode?: boolean;
  heavyBlocksForce?: boolean;
  dynamicRetention?: boolean;
  streakLimiterMultiplier?: number;
  nearLossPressure?: boolean;
  winStreakBrake?: boolean;
  antiComboBlocker?: boolean;
  highBetResistance?: boolean;
  highBetThreshold?: number;
  giantPieceFrequency?: number;
  instantLossOnTargetProfit?: number;
  tightenOnHighOccupancy?: boolean;
  minCashoutMultiplier?: number;
  lineMultiplierStep?: number;
  initialMultiplier?: number;
  retentionAggressiveness?: 'soft' | 'moderate' | 'aggressive' | 'ruthless' | 'impossible';
  forceLossOnMaxMultiplier?: boolean;
  consecutiveWinDecay?: number;
  // Advanced Physics & Obstacle Controls
  obstacleMultiplier?: number;
  baseSpeed?: number;
  maxSpeed?: number;
  acceleration?: number;
  smartRtp?: boolean;
  smartRtpEasyThreshold?: number;
  smartRtpMidThreshold?: number;
  smartRtpHardThreshold?: number;
  smartRtpMaxTarget?: number;
  emergencyRetentionMode?: boolean;
  influencerGlobalBoost?: boolean;
  gameSpeedPercent?: number;
  obstacleDensityPercent?: number;
  reactionWindowMs?: number;
  bonusFrequencyPercent?: number;
  comboWindowMs?: number;
  mistakeTolerance?: number;
  difficultyRampPercent?: number;
  easyOpeningRounds?: number;
  extremeModeStartRound?: number;
  phaseDifficultyMultiplier?: number;
  configVersion?: number;
  updatedAt?: string;
  popupEnabled?: boolean;
  popupImageUrl?: string;
  popupTitle?: string;
  popupDescription?: string;
  popupButtonText?: string;
  popupButtonAction?: 'deposit' | 'play' | 'url';
  popupButtonUrl?: string;
  popupTrigger?: 'start' | 'gameover' | 'immediate' | 'manual';
  heroBannerImageUrl?: string;
  heroBannerTitle?: string;
  heroBannerSubtitle?: string;
  heroBannerBadge?: string;
  recentBets?: {
    id: string;
    userId: string;
    userName: string;
    betAmount: number;
    multiplier: number;
    payoutAmount: number;
    profitAmount: number;
    status: 'active' | 'cashed_out' | 'lost';
    createdAt: string;
  }[];
}

interface AdminGamesRetentionManagerProps {
  games: AdminGameItem[];
  setGames: React.Dispatch<React.SetStateAction<AdminGameItem[]>>;
  loadingGames: boolean;
  savingGameId: string | null;
  lastGamesUpdated: string;
  fetchGames: (manual?: boolean) => Promise<void>;
  handleSaveGame: (game: AdminGameItem) => Promise<void>;
  handleSaveUniversalRtp?: (payload: {
    universalRtp: number;
    smartRtpGlobal?: boolean;
    targetGameIds?: string[];
    difficultyRules?: any;
  }) => Promise<void>;
  handleToggleGameStatus: (gameId: string) => Promise<void>;
  setGameTestingModal: (modal: { isOpen: boolean; gameUrl: string; gameTitle: string } | null) => void;
  getGameCover: (gameId: string) => string;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminGamesRetentionManager: React.FC<AdminGamesRetentionManagerProps> = ({
  games,
  setGames,
  loadingGames,
  savingGameId,
  lastGamesUpdated,
  fetchGames,
  handleSaveGame,
  handleSaveUniversalRtp,
  handleToggleGameStatus,
  setGameTestingModal,
  getGameCover,
  onShowToast
}) => {
  const [selectedGameId, setSelectedGameId] = useState<string>('g_gen_dino');
  const [activeSubTab, setActiveSubTab] = useState<
    'difficulty' | 'smart_rtp' | 'physics' | 'retention' | 'popups' | 'bets'
  >('difficulty');

  // Estado do RTP Geral & Controle Universal
  const [universalRtp, setUniversalRtp] = useState<number>(() => {
    const saved = localStorage.getItem('admin_universal_rtp_fixed');
    if (saved && !isNaN(Number(saved))) return Number(saved);
    if (games && games.length > 0) {
      return Number(games[0].rtpPercent) || 88;
    }
    return 88;
  });
  const [smartRtpGlobal, setSmartRtpGlobal] = useState<boolean>(true);
  const [selectedUniversalGames, setSelectedUniversalGames] = useState<Record<string, boolean>>({
    g_gen_dino: true,
    g_block_puzzle: true,
    g_zumbla: true,
    g_raspa_fortuna: true,
    g_subway_pay: true
  });
  const [difficultyRules, setDifficultyRules] = useState({
    antiStreak: true,
    highBetResistance: true,
    heavyObstacles: true,
    dynamicRetention: true,
    forceLossCap: true
  });
  const [savingUniversal, setSavingUniversal] = useState<boolean>(false);

  const handleApplyUniversalRtp = async () => {
    setSavingUniversal(true);
    try {
      const targetGameIds = Object.keys(selectedUniversalGames).filter(
        (id) => selectedUniversalGames[id]
      );
      if (targetGameIds.length === 0) {
        onShowToast('Selecione ao menos um jogo para aplicar o RTP Geral.', 'error');
        setSavingUniversal(false);
        return;
      }

      // Salva permanentemente no localStorage
      localStorage.setItem('admin_universal_rtp_fixed', String(universalRtp));

      if (handleSaveUniversalRtp) {
        await handleSaveUniversalRtp({
          universalRtp,
          smartRtpGlobal,
          targetGameIds,
          difficultyRules
        });
      } else {
        const res = await fetch('/api/admin/games/universal-rtp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            universalRtp,
            smartRtpGlobal,
            targetGameIds,
            difficultyRules
          })
        });
        if (!res.ok) throw new Error('Falha ao salvar');
        await fetchGames(true);
      }
      onShowToast(`RTP Geral de ${universalRtp.toFixed(1)}% e Dificuldades FIXADOS no banco de dados! Ele NÃO voltará para fácil sozinho.`, 'success');
    } catch (e) {
      onShowToast('Erro ao sincronizar RTP Geral com o banco de dados.', 'error');
    } finally {
      setSavingUniversal(false);
    }
  };

  const selectedGame = games.find((g) => g.id === selectedGameId) || games[0] || {
    id: 'g_gen_dino',
    name: 'GEN DINO (Arcade Runner PIX)',
    category: 'Runner & Habilidade',
    status: 'active',
    minBet: 1,
    maxBet: 500,
    rtpPercent: 88,
    difficulty: 'medium'
  };

  const updateGameField = <K extends keyof AdminGameItem>(field: K, value: AdminGameItem[K]) => {
    setGames((prev) =>
      prev.map((g) => (g.id === selectedGame.id ? { ...g, [field]: value } : g))
    );
  };

  const toggleAndAutoSave = async <K extends keyof AdminGameItem>(
    field: K,
    currentValue: AdminGameItem[K],
    label: string
  ) => {
    const nextVal = typeof currentValue === 'boolean' ? !currentValue : !Boolean(currentValue);
    const updatedGame = { ...selectedGame, [field]: nextVal };

    // Update UI state immediately
    setGames((prev) =>
      prev.map((g) => (g.id === selectedGame.id ? updatedGame : g))
    );

    // Auto-save instantly to database
    try {
      await handleSaveGame(updatedGame);
      onShowToast(`${label} ${nextVal ? 'ativado' : 'desativado'} e salvo em tempo real!`, 'success');
    } catch (err) {
      onShowToast(`Erro ao sincronizar ${label}.`, 'error');
    }
  };

  const updateAllGamesField = <K extends keyof AdminGameItem>(field: K, value: AdminGameItem[K]) => {
    setGames((prev) => prev.map((g) => ({ ...g, [field]: value })));
  };

  // Difficulty presets definitions (8 comprehensive levels)
  const difficultyPresets = [
    {
      id: 'ultra_easy',
      name: 'Ultra Fácil / Demo',
      rtp: 98.5,
      houseEdge: 1.5,
      color: 'from-emerald-500 to-teal-600',
      badgeBg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      description: 'Retenção leve de 1.5%. Pista aberta, moedas constantes, vitória praticamente garantida.',
      speed: 4.8,
      obstacles: 0.5,
      antiBailout: false,
      heavyBlocks: false
    },
    {
      id: 'easy',
      name: 'Fácil / Bônus Promo',
      rtp: 95.0,
      houseEdge: 5.0,
      color: 'from-emerald-600 to-green-600',
      badgeBg: 'bg-green-500/10 text-green-600 border-green-500/20',
      description: 'Retenção de 5%. Excelente para ativação de novos cadastros e streamers.',
      speed: 5.5,
      obstacles: 0.8,
      antiBailout: false,
      heavyBlocks: false
    },
    {
      id: 'medium',
      name: 'Equilibrado / iGaming',
      rtp: 88.0,
      houseEdge: 12.0,
      color: 'from-blue-600 to-indigo-600',
      badgeBg: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      description: 'Padrão da indústria de cassinos (12% casa). Partidas divertidas com quebra suave.',
      speed: 6.0,
      obstacles: 1.0,
      antiBailout: false,
      heavyBlocks: false
    },
    {
      id: 'moderate',
      name: 'Moderado / Vantagem Casa',
      rtp: 70.0,
      houseEdge: 30.0,
      color: 'from-amber-500 to-orange-600',
      badgeBg: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      description: 'Retenção de 30%. Aceleração progressiva e escalada firme de obstáculos.',
      speed: 7.0,
      obstacles: 1.35,
      antiBailout: true,
      heavyBlocks: false
    },
    {
      id: 'hard',
      name: 'Difícil / Alta Retenção',
      rtp: 45.0,
      houseEdge: 55.0,
      color: 'from-orange-600 to-rose-600',
      badgeBg: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      description: 'Retenção de 55%. Cortes bruscos de brecha, cactos duplos frequentes.',
      speed: 8.0,
      obstacles: 1.8,
      antiBailout: true,
      heavyBlocks: true
    },
    {
      id: 'heavy',
      name: 'Pesado / Casa Agressiva',
      rtp: 20.0,
      houseEdge: 80.0,
      color: 'from-rose-600 to-red-700',
      badgeBg: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
      description: 'Retenção de 80%. Aceleração violenta e redução da distância de reação.',
      speed: 9.5,
      obstacles: 2.5,
      antiBailout: true,
      heavyBlocks: true
    },
    {
      id: 'extreme',
      name: 'Extremo / Mata-Banca',
      rtp: 5.0,
      houseEdge: 95.0,
      color: 'from-purple-700 to-rose-800',
      badgeBg: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
      description: 'Retenção de 95%. Densidade extrema de 4.0x, tolerância zero a atrasos.',
      speed: 12.0,
      obstacles: 4.0,
      antiBailout: true,
      heavyBlocks: true
    },
    {
      id: 'impossible',
      name: 'Impossível / Dreno Total',
      rtp: 0.1,
      houseEdge: 99.9,
      color: 'from-slate-900 via-rose-950 to-black',
      badgeBg: 'bg-rose-950/20 text-rose-500 border-rose-900/40',
      description: 'Retenção de 99.9%. Derrota em segundos com parede contínua de cactos.',
      speed: 16.0,
      obstacles: 6.0,
      antiBailout: true,
      heavyBlocks: true
    }
  ];

  const applyDifficultyPreset = async (preset: typeof difficultyPresets[0]) => {
    const updatedGame: AdminGameItem = {
      ...selectedGame,
      rtpPercent: preset.rtp,
      difficulty: preset.id,
      baseSpeed: preset.speed,
      obstacleMultiplier: preset.obstacles,
      antiBailoutMode: preset.antiBailout,
      heavyBlocksForce: preset.heavyBlocks
    };

    setGames((prev) =>
      prev.map((g) => (g.id === selectedGame.id ? updatedGame : g))
    );

    try {
      await handleSaveGame(updatedGame);
      onShowToast(`Perfil "${preset.name}" (${preset.rtp}% RTP) aplicado e salvo com sucesso!`, 'success');
    } catch (err) {
      onShowToast(`Erro ao sincronizar perfil ${preset.name}.`, 'error');
    }
  };

  const getGameUrl = (gameId: string) => {
    if (gameId === 'g_gen_dino') return '/gen-dino/index.html?test=admin';
    if (gameId === 'g_zumbla') return '/zumbla/app/index.html?test=admin';
    if (gameId === 'g_raspa_fortuna') return '/raspafortuna/index.html?test=admin';
    if (gameId === 'g_subway_pay') return '/subwaypay/jogar/index.html?test=admin';
    return '/blockwin';
  };

  const totalWageredAll = games.reduce((acc, g) => acc + (g.totalWagered || 0), 0);
  const totalGgrAll = games.reduce((acc, g) => acc + (g.ggr || 0), 0);
  const avgRtpAll = games.length ? games.reduce((acc, g) => acc + g.rtpPercent, 0) / games.length : 88;
  const avgHouseEdgeAll = 100 - avgRtpAll;

  // Emergency Global Retention Mode Active Status
  const isEmergencyGlobal = games.every((g) => g.emergencyRetentionMode);
  const isInfluencerGlobal = games.every((g) => g.influencerGlobalBoost);

  const handleToggleEmergencyGlobal = async () => {
    const nextState = !isEmergencyGlobal;
    const updatedGames = games.map((g) => ({
      ...g,
      emergencyRetentionMode: nextState,
      ...(nextState ? { rtpPercent: 0.1 } : {})
    }));
    setGames(updatedGames);
    try {
      await Promise.all(updatedGames.map((g) => handleSaveGame(g)));
      onShowToast(
        nextState
          ? '🚨 TRAVA DE EMERGÊNCIA ATIVADA: Retenção global forçada para 99.9% e salva no banco!'
          : 'Trava de emergência desativada. Regras normais restauradas e salvas.',
        nextState ? 'error' : 'info'
      );
    } catch (e) {
      onShowToast('Erro ao sincronizar trava global de emergência.', 'error');
    }
  };

  const handleToggleInfluencerGlobal = async () => {
    const nextState = !isInfluencerGlobal;
    const updatedGames = games.map((g) => ({
      ...g,
      influencerGlobalBoost: nextState
    }));
    setGames(updatedGames);
    try {
      await Promise.all(updatedGames.map((g) => handleSaveGame(g)));
      onShowToast(
        nextState
          ? '👑 MODO INFLUENCIADOR GLOBAL ATIVADO: Facilitador salvo em todos os jogos!'
          : 'Modo influenciador global desativado e salvo.',
        'success'
      );
    } catch (e) {
      onShowToast('Erro ao sincronizar modo influenciador global.', 'error');
    }
  };

  return (
    <div id="admin-games-retention-root" className="space-y-6">
      {/* Top Hub: Header & Quick Actions */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 lg:p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black font-heading text-slate-900 tracking-tight">
                  Central de Jogos & Retenção (RTP Engine)
                </h2>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  MOTOR ONLINE
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Controle de probabilidade algorítmica, física em tempo real, RTP Inteligente e alavancas de retenção da banca.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="admin-btn-refresh-games"
              type="button"
              onClick={() => fetchGames(true)}
              disabled={loadingGames}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${loadingGames ? 'animate-spin' : ''}`} />
              <span>{loadingGames ? 'Sincronizando...' : 'Atualizar Dados'}</span>
              {lastGamesUpdated && (
                <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">({lastGamesUpdated})</span>
              )}
            </button>

            <button
              id="admin-btn-save-active-game"
              type="button"
              onClick={() => handleSaveGame(selectedGame)}
              disabled={savingGameId === selectedGame.id}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition-all cursor-pointer flex items-center gap-2 shadow-md shadow-indigo-600/25 active:scale-98 disabled:opacity-50"
            >
              {savingGameId === selectedGame.id ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{savingGameId === selectedGame.id ? 'Salvando...' : 'Salvar Alterações'}</span>
            </button>
          </div>
        </div>

        {/* Global Security & Live Levers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          {/* Emergency Dreno Master Switch */}
          <div
            id="admin-card-emergency-switch"
            onClick={handleToggleEmergencyGlobal}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
              isEmergencyGlobal
                ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
                : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isEmergencyGlobal ? 'bg-rose-600 text-white animate-bounce' : 'bg-slate-200 text-slate-600'
                }`}
              >
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">🚨 Trava de Emergência Global</span>
                  {isEmergencyGlobal && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white">
                      ATIVADA (Dreno 100%)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Bloqueia qualquer ganho em todos os jogos imediatamente para proteção do cofre.
                </p>
              </div>
            </div>
            <div
              className={`w-11 h-6 rounded-full p-1 transition-colors ${
                isEmergencyGlobal ? 'bg-rose-600' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isEmergencyGlobal ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>

          {/* Global Influencer VIP Mode */}
          <div
            id="admin-card-influencer-switch"
            onClick={handleToggleInfluencerGlobal}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
              isInfluencerGlobal
                ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  isInfluencerGlobal ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">👑 Modo Influenciador / Lives</span>
                  {isInfluencerGlobal && (
                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500 text-white">
                      ATIVO (Física VIP)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Física suave, velocidade reduzida e moedas em abundância para transmissões ao vivo.
                </p>
              </div>
            </div>
            <div
              className={`w-11 h-6 rounded-full p-1 transition-colors ${
                isInfluencerGlobal ? 'bg-amber-500' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  isInfluencerGlobal ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Global Financial Metrics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              Volume Total Apostado
            </span>
            <div className="text-lg lg:text-xl font-black font-heading text-slate-900">
              R$ {totalWageredAll.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Acumulado em todos os jogos</p>
          </div>

          <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-100 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
              GGR Retido (Lucro Casa)
            </span>
            <div className="text-lg lg:text-xl font-black font-heading text-emerald-700">
              R$ {totalGgrAll.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-emerald-600 font-bold">Gross Gaming Revenue</p>
          </div>

          <div className="bg-indigo-50/70 p-4 rounded-2xl border border-indigo-100 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
              RTP Teórico Médio
            </span>
            <div className="text-lg lg:text-xl font-black font-heading text-indigo-700">
              {avgRtpAll.toFixed(1)}%
            </div>
            <p className="text-[10px] text-indigo-600 font-medium">Média ponderada dos jogos</p>
          </div>

          <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-100 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
              Margem Global da Casa
            </span>
            <div className="text-lg lg:text-xl font-black font-heading text-amber-700">
              {avgHouseEdgeAll.toFixed(1)}%
            </div>
            <p className="text-[10px] text-amber-600 font-bold">House Edge Operacional</p>
          </div>
        </div>
      </div>

      {/* PAINEL DE RTP GERAL & CONTROLE UNIVERSAL (TODOS OS JOGOS) */}
      <div className="bg-white rounded-3xl border-2 border-indigo-200/80 shadow-md p-5 lg:p-7 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="text-lg font-black font-heading text-slate-900 tracking-tight">
                  RTP Geral & Controle Universal (Todos os Jogos)
                </h3>
                <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Banco de Dados Fixado
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Configure o RTP padrão da banca através da scroll bar. O valor fica <strong>FIXO no banco de dados</strong> e não volta para fácil sozinho até o admin alterar novamente.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleApplyUniversalRtp}
            disabled={savingUniversal}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs transition-all shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 shrink-0"
          >
            {savingUniversal ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{savingUniversal ? 'Gravando no Banco...' : 'Salvar e Fixar RTP Geral no Banco'}</span>
          </button>
        </div>

        {/* Universal RTP Scroll Bar / Slider */}
        <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-black text-slate-900 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                <span>Scroll Bar de RTP Geral ({universalRtp.toFixed(1)}%)</span>
              </label>
              <p className="text-xs text-slate-500">
                Ajuste fino da porcentagem teórica de retorno para todos os jogos selecionados.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-center">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">RTP Jogador</span>
                <strong className="text-lg font-black text-indigo-600 font-heading">
                  {universalRtp.toFixed(1)}%
                </strong>
              </div>
              <div className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-center">
                <span className="text-[10px] text-slate-400 block font-bold uppercase">Margem Casa</span>
                <strong className="text-lg font-black text-amber-600 font-heading">
                  {(100 - universalRtp).toFixed(1)}%
                </strong>
              </div>
              <div className="hidden sm:block">
                <span
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase inline-block border ${
                    universalRtp >= 95
                      ? 'bg-purple-100 text-purple-800 border-purple-200'
                      : universalRtp >= 85
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : universalRtp >= 65
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : universalRtp >= 35
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-rose-100 text-rose-800 border-rose-200'
                  }`}
                >
                  {universalRtp >= 95
                    ? '🎁 Promoção / VIP'
                    : universalRtp >= 85
                    ? '✅ Padrão iGaming'
                    : universalRtp >= 65
                    ? '⚖️ Equilibrado'
                    : universalRtp >= 35
                    ? '⚠️ Retenção Pesada'
                    : '🚨 Modo Dreno Total'}
                </span>
              </div>
            </div>
          </div>

          <input
            type="range"
            min="0.1"
            max="99.9"
            step="0.1"
            value={universalRtp}
            onChange={(e) => setUniversalRtp(parseFloat(e.target.value))}
            className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />

          <div className="flex justify-between text-[10px] font-bold text-slate-400">
            <span>0.1% (Dreno Extremo)</span>
            <span>25% (Pesado)</span>
            <span>50% (50/50)</span>
            <span>75% (Equilibrado)</span>
            <span>88% (Padrão Oficial)</span>
            <span>99.9% (Ultra Fácil)</span>
          </div>

          {/* Presets Rápidos */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-slate-500 mr-1">Presets Rápidos:</span>
            {[
              { label: '15% (Dreno)', val: 15.0 },
              { label: '35% (Pesado)', val: 35.0 },
              { label: '50% (50/50)', val: 50.0 },
              { label: '75% (Equilibrado)', val: 75.0 },
              { label: '88% (Padrão iGaming)', val: 88.0 },
              { label: '95% (Promoção)', val: 95.0 },
              { label: '98.5% (Influencer VIP)', val: 98.5 }
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setUniversalRtp(p.val)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                  Math.abs(universalRtp - p.val) < 0.1
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Global Smart RTP Button & Targets */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Botão de RTP Inteligente Geral */}
          <div
            onClick={() => setSmartRtpGlobal(!smartRtpGlobal)}
            className={`p-4 rounded-2xl border transition-all cursor-pointer select-none flex items-center justify-between gap-4 ${
              smartRtpGlobal
                ? 'bg-emerald-50/70 border-emerald-300 ring-2 ring-emerald-500/20'
                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  smartRtpGlobal ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                }`}
              >
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900">
                    ⚡ Botão de RTP Inteligente Geral
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      smartRtpGlobal
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {smartRtpGlobal ? 'ATIVADO' : 'DESATIVADO'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Aplica rampas anti-saque automáticas para todos os jogos conforme o saldo do jogador evolui.
                </p>
              </div>
            </div>

            <div
              className={`w-11 h-6 rounded-full p-1 transition-colors shrink-0 ${
                smartRtpGlobal ? 'bg-emerald-500' : 'bg-slate-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  smartRtpGlobal ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>

          {/* Seleção de Jogos Participantes */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="text-xs font-black text-slate-800 block">
              🎮 Jogos que Recebem o RTP Geral:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'g_gen_dino', label: 'Gen Dino (Runner PIX)' },
                { id: 'g_block_puzzle', label: 'Block Win (Puzzle)' },
                { id: 'g_zumbla', label: 'Zumbla Win (Shooter)' },
                { id: 'g_raspa_fortuna', label: 'Raspa Fortuna (Raspadinha)' },
                { id: 'g_subway_pay', label: 'Subway Pay (Subway Surfers PIX)' }
              ].map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-2 p-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer hover:bg-slate-50 select-none"
                >
                  <input
                    type="checkbox"
                    checked={Boolean(selectedUniversalGames[g.id])}
                    onChange={(e) =>
                      setSelectedUniversalGames((prev) => ({
                        ...prev,
                        [g.id]: e.target.checked
                      }))
                    }
                    className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer"
                  />
                  <span className="truncate">{g.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Marcar e Desmarcar as Dificuldades Globais */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-indigo-600" />
              <span>Opções de Dificuldade Global (Marcar / Desmarcar Regras):</span>
            </span>
            <span className="text-[10px] text-slate-400">Personalize as travas operacionais ativas</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {[
              {
                key: 'antiStreak' as const,
                label: 'Trava Win Streak',
                desc: 'Corta odds após 2-3 vitórias'
              },
              {
                key: 'highBetResistance' as const,
                label: 'Resistência Aposta Alta',
                desc: 'Aperta em apostas elevadas'
              },
              {
                key: 'heavyObstacles' as const,
                label: 'Peças Pesadas / Cactos',
                desc: 'Aumenta pressão e densidade'
              },
              {
                key: 'dynamicRetention' as const,
                label: 'Retenção Dinâmica',
                desc: 'Acelera com saldo alto'
              },
              {
                key: 'forceLossCap' as const,
                label: 'Forçar Derrota no Teto',
                desc: 'Trava máxima antes de sacar'
              }
            ].map((rule) => {
              const isChecked = Boolean(difficultyRules[rule.key]);
              return (
                <label
                  key={rule.key}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 select-none ${
                    isChecked
                      ? 'bg-indigo-50/70 border-indigo-300 text-indigo-950 ring-1 ring-indigo-400/30'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-black truncate">{rule.label}</span>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) =>
                        setDifficultyRules((prev) => ({
                          ...prev,
                          [rule.key]: e.target.checked
                        }))
                      }
                      className="w-4 h-4 rounded text-indigo-600 accent-indigo-600 cursor-pointer shrink-0"
                    />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">{rule.desc}</p>
                </label>
              );
            })}
          </div>
        </div>

        {/* Painel Dinâmico: O que tem atualmente de difícil naquele % de RTP */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" />
              <span>O que tem atualmente de difícil em {universalRtp.toFixed(1)}% de RTP (Adaptado por Jogo):</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-400">Cálculo algorítmico em tempo real</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {/* Gen Dino */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-xs font-black text-slate-900">🦖 Gen Dino</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  {universalRtp >= 90 ? 'Suave' : universalRtp >= 75 ? 'Médio' : universalRtp >= 45 ? 'Difícil' : 'Extremo'}
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Velocidade Base:</span>
                  <strong className="text-slate-900 font-mono">{(4.5 + (100 - universalRtp) * 0.08).toFixed(1)}x</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Cactos Agrupados:</span>
                  <strong className="text-slate-900 font-mono">{(0.5 + (100 - universalRtp) * 0.03).toFixed(2)}x</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Janela de Reação:</span>
                  <strong className="text-indigo-600 font-mono">{Math.round(Math.max(450, 1300 - (100 - universalRtp) * 7))}ms</strong>
                </div>
              </div>
            </div>

            {/* Block Win */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-xs font-black text-slate-900">🧱 Block Win</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  {universalRtp >= 85 ? 'Comum' : 'Apertado'}
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Peças Gigantes (3x3):</span>
                  <strong className="text-slate-900 font-mono">
                    {Math.round(Math.min(85, Math.max(10, 15 + (100 - universalRtp) * 0.6)))}%
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Corte em Tabuleiro Cheio:</span>
                  <strong className={universalRtp < 85 ? 'text-rose-600' : 'text-emerald-600'}>
                    {universalRtp < 85 ? 'Ativo (Sem Brecha)' : 'Desativado'}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Resistência Aposta Alta:</span>
                  <strong className={difficultyRules.highBetResistance ? 'text-amber-600' : 'text-slate-400'}>
                    {difficultyRules.highBetResistance ? 'Ativa' : 'Desativada'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Zumbla Win */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-xs font-black text-slate-900">🐸 Zumbla Win</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                  {universalRtp >= 85 ? 'Padrão' : 'Rápido'}
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Velocidade da Fila:</span>
                  <strong className="text-slate-900 font-mono">{(4.5 + (100 - universalRtp) * 0.08).toFixed(1)}x</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tolerância a Erros:</span>
                  <strong className="text-indigo-600 font-mono">
                    {universalRtp >= 85 ? '2 erros' : universalRtp >= 50 ? '1 erro' : '0 erros (eliminatório)'}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Janela de Mira Combo:</span>
                  <strong className="text-slate-900 font-mono">{Math.round(Math.max(500, 1500 - (100 - universalRtp) * 8))}ms</strong>
                </div>
              </div>
            </div>

            {/* Raspa Fortuna */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-xs font-black text-slate-900">☘️ Raspa Fortuna</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-teal-100 text-teal-800">
                  {universalRtp >= 80 ? 'Equilibrada' : 'Baixa Odd'}
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Cartelas Premiadas:</span>
                  <strong className="text-slate-900 font-mono">{(universalRtp * 0.38).toFixed(1)}%</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Teto Multiplicador:</span>
                  <strong className="text-indigo-600 font-mono">
                    {universalRtp >= 80 ? '100x' : universalRtp >= 50 ? '50x' : '15x'}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sensibilidade da Raspagem:</span>
                  <strong className="text-emerald-600 font-mono">50% para revelar</strong>
                </div>
              </div>
            </div>

            {/* Subway Pay */}
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <span className="text-xs font-black text-slate-900">🛹 Subway Pay</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                  {universalRtp >= 85 ? 'Normal' : universalRtp >= 60 ? 'Rápido' : 'Extremo'}
                </span>
              </div>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between text-slate-600">
                  <span>Velocidade Base:</span>
                  <strong className="text-slate-900 font-mono">{(5.0 + (100 - universalRtp) * 0.08).toFixed(1)}x</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Densidade de Trens:</span>
                  <strong className="text-slate-900 font-mono">{Math.round(Math.min(95, Math.max(20, 20 + (100 - universalRtp) * 0.75)))}%</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Teto Multiplicador:</span>
                  <strong className="text-indigo-600 font-mono">
                    {universalRtp >= 90 ? '4.0x' : universalRtp >= 70 ? '3.5x' : universalRtp >= 50 ? '2.5x' : '2.0x'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé explicativo e botão de fixação permanente */}
        <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-indigo-950 font-medium">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Garantia de Persistência:</strong> Ao clicar em salvar, a configuração é gravada permanentemente no Firestore. Ela <strong>NÃO</strong> voltará para fácil sozinha.
            </span>
          </div>
          <button
            type="button"
            onClick={handleApplyUniversalRtp}
            disabled={savingUniversal}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-all shadow-md shadow-indigo-600/20 active:scale-98 disabled:opacity-50 shrink-0 cursor-pointer"
          >
            {savingUniversal ? 'Sincronizando...' : 'Confirmar e Fixar Tudo'}
          </button>
        </div>
      </div>

      {/* Game Selector Carousel / Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
              Selecione o Jogo para Configuração Individual
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {games.length} Jogos Integrados na Plataforma
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {games.map((game) => {
            const isSelected = selectedGame.id === game.id;
            const cover = getGameCover(game.id);
            const gameUrl = getGameUrl(game.id);

            return (
              <div
                key={game.id}
                id={`admin-game-card-${game.id}`}
                onClick={() => setSelectedGameId(game.id)}
                className={`relative rounded-3xl p-4.5 border transition-all cursor-pointer select-none space-y-3 ${
                  isSelected
                    ? 'bg-indigo-50/60 border-indigo-500 shadow-md ring-2 ring-indigo-500/20'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-900 border border-slate-200/80 shrink-0 shadow-2xs">
                    <img
                      src={cover}
                      alt={game.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = '/logoalliance.png';
                      }}
                    />
                    {game.status === 'active' ? (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                    ) : (
                      <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-slate-400 ring-2 ring-white" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-black text-slate-900 truncate">{game.name}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate">{game.category}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-100/70 text-indigo-800 border border-indigo-200/60">
                        RTP {game.rtpPercent.toFixed(1)}%
                      </span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                          game.status === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {game.status === 'active' ? 'ATIVO' : 'INATIVO'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">GGR Acumulado</span>
                    <span className="font-extrabold text-emerald-600 font-heading">
                      R$ {(game.ggr || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">House Edge</span>
                    <span className="font-extrabold text-slate-700">
                      {(100 - game.rtpPercent).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Quick Actions per game */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setGameTestingModal({
                        isOpen: true,
                        gameUrl: gameUrl,
                        gameTitle: `Testar ${game.name}`
                      });
                    }}
                    className="flex-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-emerald-400" />
                    <span>Testar Jogo</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleGameStatus(game.id);
                    }}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                      game.status === 'active'
                        ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {game.status === 'active' ? 'Pausar' : 'Ativar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Studio: Categorized Sub-Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* Active Game Banner & Tab Bar */}
        <div className="p-5 lg:p-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-black/40 border border-white/10 shrink-0">
                <img
                  src={getGameCover(selectedGame.id)}
                  alt={selectedGame.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black tracking-tight">{selectedGame.name}</h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-500/30 text-indigo-300 border border-indigo-400/30">
                    Regra v{selectedGame.configVersion || 1}
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-medium">
                  ID: <code className="text-indigo-300 font-mono">{selectedGame.id}</code> • Multiplicador Máx: {selectedGame.maxMultiplier || 100}x
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setGameTestingModal({
                    isOpen: true,
                    gameUrl: getGameUrl(selectedGame.id),
                    gameTitle: `Testar ${selectedGame.name}`
                  })
                }
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-98 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simular / Jogar Agora</span>
              </button>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={() => setActiveSubTab('difficulty')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'difficulty'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <Gauge className="w-3.5 h-3.5 text-indigo-500" />
              <span>1. RTP & Dificuldade</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('smart_rtp')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'smart_rtp'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>2. RTP Inteligente</span>
              {selectedGame.smartRtp !== false && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('physics')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'physics'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-orange-500" />
              <span>3. Física & Motor</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('retention')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'retention'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>4. Travas & Levers</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('popups')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'popups'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-purple-500" />
              <span>5. Popups & Banners</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('bets')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                activeSubTab === 'bets'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span>6. Auditoria & Rodadas</span>
            </button>
          </div>
        </div>

        {/* Tab Content Container */}
        <div className="p-5 lg:p-6 space-y-6">
          {/* TAB 1: RTP & DIFICULDADE */}
          {activeSubTab === 'difficulty' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-indigo-600" />
                    <span>Perfis de Dificuldade Algorítmica & RTP Teórico</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Selecione um preset instantâneo ou ajuste a precisão com o controle deslizante abaixo.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-xs font-black text-slate-700">
                  <span>RTP Atual:</span>
                  <strong className="text-indigo-600 font-heading text-sm">{selectedGame.rtpPercent.toFixed(1)}%</strong>
                  <span className="text-slate-400">|</span>
                  <span>Casa:</span>
                  <strong className="text-amber-600 font-heading text-sm">{(100 - selectedGame.rtpPercent).toFixed(1)}%</strong>
                </div>
              </div>

              {/* 8 Preset Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {difficultyPresets.map((preset) => {
                  const isActive = Math.abs(selectedGame.rtpPercent - preset.rtp) < 1.0;

                  return (
                    <div
                      key={preset.id}
                      onClick={() => applyDifficultyPreset(preset)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-3 ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-indigo-500/40'
                          : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="text-xs font-black truncate">{preset.name}</span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                              isActive ? 'bg-white/20 text-white border-white/30' : preset.badgeBg
                            }`}
                          >
                            RTP {preset.rtp}%
                          </span>
                        </div>
                        <p className={`text-[11px] leading-snug ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                          {preset.description}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/20 flex items-center justify-between text-[11px]">
                        <span className={isActive ? 'text-slate-400' : 'text-slate-500'}>
                          Casa: <strong>{preset.houseEdge}%</strong>
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            ATIVO
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fine continuous slider */}
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-900 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                    <span>Ajuste Fino Contínuo de RTP (0.1% a 99.0%)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Jogador:</span>
                    <span className="text-sm font-black text-indigo-600 font-heading">
                      {selectedGame.rtpPercent.toFixed(1)}%
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs text-slate-500">Retenção Casa:</span>
                    <span className="text-sm font-black text-amber-600 font-heading">
                      {(100 - selectedGame.rtpPercent).toFixed(1)}%
                    </span>
                  </div>
                </div>

                <input
                  type="range"
                  min="0.1"
                  max="99"
                  step="0.1"
                  value={selectedGame.rtpPercent}
                  onChange={(e) => updateGameField('rtpPercent', parseFloat(e.target.value))}
                  className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />

                <div className="flex justify-between text-[10px] font-bold text-slate-400">
                  <span>0.1% (Dreno Total)</span>
                  <span>25% (Agressivo)</span>
                  <span>50% (50/50)</span>
                  <span>75% (Vantagem Casa)</span>
                  <span>88% (Padrão iGaming)</span>
                  <span>99% (Ultra Fácil)</span>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await handleSaveGame(selectedGame);
                        onShowToast(`Configuração FIXADA: RTP de ${selectedGame.rtpPercent.toFixed(1)}% gravado permanentemente no banco para ${selectedGame.name}!`, 'success');
                      } catch {
                        onShowToast('Erro ao salvar RTP do jogo.', 'error');
                      }
                    }}
                    disabled={savingGameId === selectedGame.id}
                    className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {savingGameId === selectedGame.id
                        ? 'Gravando no Banco de Dados...'
                        : `Salvar e Fixar RTP de ${selectedGame.rtpPercent.toFixed(1)}% deste Jogo no Banco de Dados`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Economic Bounds (Bets & Multipliers) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">Aposta Mínima (R$)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={selectedGame.minBet}
                    onChange={(e) => updateGameField('minBet', parseFloat(e.target.value) || 1)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400">Valor mínimo para entrada na rodada</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">Aposta Máxima (R$)</label>
                  <input
                    type="number"
                    step="50"
                    min="10"
                    value={selectedGame.maxBet}
                    onChange={(e) => updateGameField('maxBet', parseFloat(e.target.value) || 500)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400">Teto máximo permitido por aposta</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">Multiplicador Máximo Teto</label>
                  <input
                    type="number"
                    step="10"
                    min="2"
                    value={selectedGame.maxMultiplier || 100}
                    onChange={(e) => updateGameField('maxMultiplier', parseFloat(e.target.value) || 100)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400">Multiplicador de vitória máximo absoluto</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RTP INTELIGENTE & RAMPAS ANTI-SAQUE */}
          {activeSubTab === 'smart_rtp' && (
            <div className="space-y-6">
              {/* Smart RTP Master Card */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-indigo-500/10 to-purple-500/10 border border-amber-500/20 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <span>Motor de RTP Inteligente com Rampa Anti-Saque</span>
                        {selectedGame.smartRtp !== false && (
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                            ATIVO
                          </span>
                        )}
                      </h4>
                      <p className="text-xs text-slate-600 font-medium">
                        Ajusta a física em tempo real conforme os lucros acumulados do jogador se aproximam dos limites de saque da plataforma.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleAndAutoSave('smartRtp', selectedGame.smartRtp !== false, 'RTP Inteligente')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                      selectedGame.smartRtp !== false
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                        : 'bg-slate-200 text-slate-700 border-slate-300'
                    }`}
                  >
                    {selectedGame.smartRtp !== false ? 'Desativar RTP Inteligente' : 'Ativar RTP Inteligente'}
                  </button>
                </div>
              </div>

              {/* 5-Zone Visual Escalation Ramp */}
              <div className="space-y-3">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Régua Algorítmica das 5 Faixas de Retenção Dinâmica
                </h5>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {/* Zone 1 */}
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-emerald-800">1. Onboarding</span>
                      <span className="text-[10px] font-bold text-emerald-600">R$ 0 a R$ {selectedGame.smartRtpEasyThreshold || 30}</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 leading-tight">
                      Física relaxada (96% RTP). Moedas abundantes e obstáculos espaçados para encantar o usuário.
                    </p>
                    <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                      Modo Fidelização
                    </span>
                  </div>

                  {/* Zone 2 */}
                  <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-800">2. Escalada</span>
                      <span className="text-[10px] font-bold text-blue-600">
                        R$ {selectedGame.smartRtpEasyThreshold || 30} a R$ {selectedGame.smartRtpMidThreshold || 60}
                      </span>
                    </div>
                    <p className="text-[11px] text-blue-700 leading-tight">
                      Aceleração suave (+15% velocidade) e frequência de obstáculos moderada (+40%).
                    </p>
                    <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded bg-blue-200 text-blue-900">
                      Curva de Retenção
                    </span>
                  </div>

                  {/* Zone 3 */}
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-800">3. Zona Alerta</span>
                      <span className="text-[10px] font-bold text-amber-600">
                        R$ {selectedGame.smartRtpMidThreshold || 60} a R$ {selectedGame.smartRtpHardThreshold || 85}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-700 leading-tight">
                      2.5x de densidade de cactos. Aumento de velocidade e eliminação de moedas duplas.
                    </p>
                    <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                      Aperto Seguro
                    </span>
                  </div>

                  {/* Zone 4 */}
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-rose-800">4. Zona Crítica (Quase 100)</span>
                      <span className="text-[10px] font-bold text-rose-600">
                        R$ {selectedGame.smartRtpHardThreshold || 85} a R$ {selectedGame.smartRtpMaxTarget || 100}
                      </span>
                    </div>
                    <p className="text-[11px] text-rose-700 leading-tight">
                      Curva exponencial ultra-precisa: quanto mais perto de 100, mais impossível. Obstáculos quádruplos e janela de reação milimétrica.
                    </p>
                    <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded bg-rose-200 text-rose-900">
                      Anti-Cashout Exponencial
                    </span>
                  </div>

                  {/* Zone 5 */}
                  <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-purple-900">5. Muro Absoluto (100)</span>
                      <span className="text-[10px] font-bold text-purple-700">&ge; R$ {selectedGame.smartRtpMaxTarget || 100}</span>
                    </div>
                    <p className="text-[11px] text-purple-700 leading-tight">
                      Teto máximo inultrapassável. Sequência intransponível com 100% de retenção da casa.
                    </p>
                    <span className="inline-block text-[9px] font-black px-2 py-0.5 rounded bg-purple-200 text-purple-900">
                      Bloqueio Definitivo
                    </span>
                  </div>
                </div>
              </div>

              {/* Threshold Customization Sliders / Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">Faixa 1: Teto Onboarding (R$)</label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={selectedGame.smartRtpEasyThreshold || 30}
                    onChange={(e) => updateGameField('smartRtpEasyThreshold', parseFloat(e.target.value) || 30)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400">Até este valor o jogador ganha com facilidade</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">Faixa 2: Início Alerta (R$)</label>
                  <input
                    type="number"
                    min="30"
                    max="80"
                    value={selectedGame.smartRtpMidThreshold || 60}
                    onChange={(e) => updateGameField('smartRtpMidThreshold', parseFloat(e.target.value) || 60)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400">A partir deste saldo a dificuldade acelera</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">Faixa 3: Zona Crítica (R$)</label>
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={selectedGame.smartRtpHardThreshold || 85}
                    onChange={(e) => updateGameField('smartRtpHardThreshold', parseFloat(e.target.value) || 85)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400">Aperto máximo antes da meta de saque</p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <label className="text-xs font-black text-slate-700 block">Faixa 4: Muro Teto Máximo (R$)</label>
                  <input
                    type="number"
                    min="70"
                    max="200"
                    value={selectedGame.smartRtpMaxTarget || 100}
                    onChange={(e) => updateGameField('smartRtpMaxTarget', parseFloat(e.target.value) || 100)}
                    className="w-full h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                  />
                  <p className="text-[10px] text-slate-400">Teto impossível de ultrapassar</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: FÍSICA & MOTOR DO JOGO */}
          {activeSubTab === 'physics' && (
            selectedGame.id === 'g_raspa_fortuna' ? (
              <div className="space-y-6">
                {/* Header Raspa Fortuna */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-emerald-950 via-teal-900 to-slate-900 text-white shadow-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Motor Probabilístico da Raspadinha
                      </span>
                      <span className="text-[10px] font-bold text-slate-300">Sync Instantâneo Ativo</span>
                    </div>
                    <h4 className="text-lg font-black text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      <span>Probabilidades, Cartelas & Prêmios (Raspa Fortuna)</span>
                    </h4>
                    <p className="text-xs text-slate-200 max-w-2xl">
                      Ajuste a frequência de cartelas premiadas, multiplicadores de PIX, sensibilidade de raspagem e travas de lucratividade da banca.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateGameField('bonusFrequencyPercent', 25);
                        updateGameField('rtpPercent', 88);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar Padrão</span>
                    </button>
                  </div>
                </div>

                {/* Module: Frequência de Cartelas Premiadas */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <Target className="w-4 h-4 text-emerald-600" />
                        <span>Taxa de Cartelas Premiadas (% de Bilhetes com Vitória)</span>
                      </h5>
                      <p className="text-[11px] text-slate-500">
                        Determina a porcentagem das cartelas geradas que conterão combinações premiadas.
                      </p>
                    </div>
                    <span className="text-base font-black text-emerald-600 font-heading">
                      {selectedGame.bonusFrequencyPercent ?? 25}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="1"
                    max="60"
                    step="1"
                    value={selectedGame.bonusFrequencyPercent ?? 25}
                    onChange={(e) => updateGameField('bonusFrequencyPercent', parseInt(e.target.value, 10))}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { label: '5% (Dreno Rápido)', val: 5 },
                      { label: '15% (Retenção Alta)', val: 15 },
                      { label: '25% (Padrão Equilibrado)', val: 25 },
                      { label: '38% (Giro Amigável)', val: 38 },
                      { label: '50% (Promoção / Demo)', val: 50 }
                    ].map((p) => (
                      <button
                        key={p.val}
                        type="button"
                        onClick={() => updateGameField('bonusFrequencyPercent', p.val)}
                        className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                          (selectedGame.bonusFrequencyPercent ?? 25) === p.val
                            ? 'bg-emerald-600 text-white border-emerald-700'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Module: Teto de Multiplicador & Revelação */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-900 block">
                        Teto Máximo de Multiplicador por Cartela
                      </label>
                      <span className="text-xs font-black text-indigo-600">
                        Até {selectedGame.rtpPercent >= 80 ? '100x' : selectedGame.rtpPercent >= 50 ? '50x' : '15x'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Multiplicador máximo que um bilhete individual pode pagar sobre o valor da aposta.
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {['15x (Seguro)', '50x (Médio)', '100x (Alto)'].map((opt) => (
                        <div key={opt} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs font-bold text-slate-800">
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-900 block">
                        Sensibilidade de Revelação Automática
                      </label>
                      <span className="text-xs font-black text-emerald-600">
                        50% raspado
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Quando o jogador raspa 50% da área do prêmio, o canvas auto-revela com efeito de brilho suave para garantir agilidade.
                    </p>
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Auto-conclusão inteligente ativada (Mobile & Desktop)</span>
                    </div>
                  </div>
                </div>

                {/* Module: Salvar Configurações do Raspa Fortuna */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-slate-600">
                    Clique abaixo para gravar e fixar permanentemente todas as regras do Raspa Fortuna no banco de dados.
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await handleSaveGame(selectedGame);
                        onShowToast('Regras e probabilidades do Raspa Fortuna FIXADAS no banco de dados com sucesso!', 'success');
                      } catch {
                        onShowToast('Erro ao salvar regras do Raspa Fortuna.', 'error');
                      }
                    }}
                    disabled={savingGameId === selectedGame.id}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingGameId === selectedGame.id ? 'Gravando...' : 'Salvar Regras do Raspa Fortuna'}</span>
                  </button>
                </div>
              </div>
            ) : selectedGame.id === 'g_subway_pay' ? (
              <div className="space-y-6">
                {/* Header Subway Pay */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-amber-950 via-slate-900 to-indigo-950 text-white shadow-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        Motor Subway Surfers PIX
                      </span>
                      <span className="text-[10px] font-bold text-slate-300">Sync Instantâneo Ativo</span>
                    </div>
                    <h4 className="text-lg font-black text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-400" />
                      <span>Física, Velocidades & Multiplicadores (Subway Pay)</span>
                    </h4>
                    <p className="text-xs text-slate-300 max-w-2xl">
                      Ajuste instantaneamente a velocidade dos trilhos, densidade de trens, multiplicador teto da corrida e o limite exato de moedas para liberar o botão de Cashout.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        updateGameField('baseSpeed', 180);
                        updateGameField('maxSpeed', 320);
                        updateGameField('acceleration', 0.0015);
                        updateGameField('gameSpeedPercent', 100);
                        updateGameField('obstacleDensityPercent', 50);
                        updateGameField('bonusFrequencyPercent', 40);
                        updateGameField('maxMultiplier', 4.0);
                        updateGameField('minCashoutMultiplier', 2.0);
                        updateGameField('rtpPercent', 88);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restaurar Padrão</span>
                    </button>
                  </div>
                </div>

                {/* Presets Rápidos de Dificuldade Subway Pay */}
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-500 block">
                    Presets Rápidos de Dificuldade & RTP (Subway Pay)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      {
                        label: 'Fácil / Onboarding',
                        desc: 'Velocidade suave, trens espaçados e cashout em 1.5x.',
                        badge: '🟢 95% RTP',
                        baseSpeed: 120,
                        maxSpeed: 280,
                        speedPct: 85,
                        density: 35,
                        bonusFreq: 55,
                        maxMult: 4.0,
                        minCashout: 1.5,
                        rtp: 95,
                        color: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/50'
                      },
                      {
                        label: 'Equilibrado (iGaming)',
                        desc: 'Velocidade padrão, moedas equilibradas e cashout em 2.0x.',
                        badge: '🟡 88% RTP',
                        baseSpeed: 180,
                        maxSpeed: 320,
                        speedPct: 100,
                        density: 50,
                        bonusFreq: 40,
                        maxMult: 3.5,
                        minCashout: 2.0,
                        rtp: 88,
                        color: 'border-blue-200 hover:border-blue-400 bg-blue-50/50'
                      },
                      {
                        label: 'Desafio / Retenção',
                        desc: 'Alta velocidade, trens frequentes e cashout em 2.5x.',
                        badge: '🟠 60% RTP',
                        baseSpeed: 245,
                        maxSpeed: 360,
                        speedPct: 125,
                        density: 75,
                        bonusFreq: 25,
                        maxMult: 2.5,
                        minCashout: 2.5,
                        rtp: 60,
                        color: 'border-amber-200 hover:border-amber-400 bg-amber-50/50'
                      },
                      {
                        label: 'Mata-Banca / Dreno',
                        desc: 'Velocidade extrema, reflexo sobre-humano e cashout 3.0x.',
                        badge: '🔴 15% RTP',
                        baseSpeed: 300,
                        maxSpeed: 420,
                        speedPct: 160,
                        density: 90,
                        bonusFreq: 10,
                        maxMult: 2.0,
                        minCashout: 3.0,
                        rtp: 15,
                        color: 'border-rose-200 hover:border-rose-400 bg-rose-50/50'
                      }
                    ].map((preset) => {
                      const isActive =
                        Math.abs(selectedGame.rtpPercent - preset.rtp) < 2.0 &&
                        (selectedGame.baseSpeed ?? 180) === preset.baseSpeed;

                      return (
                        <div
                          key={preset.label}
                          onClick={() => {
                            updateGameField('baseSpeed', preset.baseSpeed);
                            updateGameField('maxSpeed', preset.maxSpeed);
                            updateGameField('gameSpeedPercent', preset.speedPct);
                            updateGameField('obstacleDensityPercent', preset.density);
                            updateGameField('bonusFrequencyPercent', preset.bonusFreq);
                            updateGameField('maxMultiplier', preset.maxMult);
                            updateGameField('minCashoutMultiplier', preset.minCashout);
                            updateGameField('rtpPercent', preset.rtp);
                            onShowToast(`Preset "${preset.label}" aplicado ao Subway Pay!`, 'info');
                          }}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-3 ${
                            isActive
                              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-amber-500/40'
                              : `${preset.color} text-slate-800`
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className="text-xs font-black truncate">{preset.label}</span>
                              <span
                                className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                  isActive ? 'bg-white/20 text-white border-white/30' : 'bg-white/80 text-slate-700 border-slate-200'
                                }`}
                              >
                                {preset.badge}
                              </span>
                            </div>
                            <p className={`text-[11px] leading-snug ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                              {preset.desc}
                            </p>
                          </div>

                          <div className="pt-2 border-t border-slate-200/20 flex items-center justify-between text-[11px]">
                            <span className={isActive ? 'text-slate-300' : 'text-slate-500'}>
                              Velocidade: <strong>{preset.baseSpeed}</strong> | Max: <strong>{preset.maxMult}x</strong>
                            </span>
                            {isActive && (
                              <span className="text-[10px] font-black text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                ATIVO
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Módulo 1: Velocidade dos Trilhos & Esteira */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-black">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <label className="text-sm font-black text-slate-900 block">
                        Velocidade dos Trilhos & Esteira de Corrida
                      </label>
                      <p className="text-xs text-slate-500">
                        Controle a velocidade inicial (base), velocidade limite e a aceleração contínua por frame da corrida.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                    {/* Base Speed */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800">Velocidade Base (Inicial)</label>
                        <span className="text-sm font-black text-indigo-600 font-heading">
                          {selectedGame.baseSpeed ?? 180}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="80"
                        max="350"
                        step="5"
                        value={selectedGame.baseSpeed ?? 180}
                        onChange={(e) => updateGameField('baseSpeed', parseFloat(e.target.value))}
                        className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="80"
                          max="350"
                          step="5"
                          value={selectedGame.baseSpeed ?? 180}
                          onChange={(e) => updateGameField('baseSpeed', parseFloat(e.target.value) || 180)}
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                        />
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">unid/motor</span>
                      </div>
                      <p className="text-[10px] text-slate-400">120 = Fácil | 180 = Médio | 245 = Rápido</p>
                    </div>

                    {/* Max Speed */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800">Velocidade Máxima (Teto)</label>
                        <span className="text-sm font-black text-orange-600 font-heading">
                          {selectedGame.maxSpeed ?? 320}
                        </span>
                      </div>
                      <input
                        type="range"
                        min="180"
                        max="450"
                        step="10"
                        value={selectedGame.maxSpeed ?? 320}
                        onChange={(e) => updateGameField('maxSpeed', parseFloat(e.target.value))}
                        className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="180"
                          max="450"
                          step="10"
                          value={selectedGame.maxSpeed ?? 320}
                          onChange={(e) => updateGameField('maxSpeed', parseFloat(e.target.value) || 320)}
                          className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600"
                        />
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">unid/motor</span>
                      </div>
                      <p className="text-[10px] text-slate-400">Velocidade máxima inalcançável sem bater (padrão: 320)</p>
                    </div>

                    {/* Game Speed % */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-black text-slate-800">Velocidade da Esteira (%)</label>
                        <span className="text-sm font-black text-emerald-600 font-heading">
                          {selectedGame.gameSpeedPercent ?? 100}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="50"
                        max="200"
                        step="5"
                        value={selectedGame.gameSpeedPercent ?? 100}
                        onChange={(e) => updateGameField('gameSpeedPercent', parseInt(e.target.value, 10))}
                        className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                      />
                      <div className="grid grid-cols-4 gap-1 pt-1">
                        {[75, 100, 125, 150].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => updateGameField('gameSpeedPercent', pct)}
                            className={`py-1 px-1 rounded-lg text-[10px] font-bold border ${
                              (selectedGame.gameSpeedPercent ?? 100) === pct
                                ? 'bg-emerald-600 text-white border-emerald-700'
                                : 'bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Módulo 2: Multiplicador Teto & Liberação do Cashout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Multiplicador Teto */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-slate-900 block">
                          Multiplicador Teto Máximo da Corrida
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Teto limite que o jogador pode acumular na partida antes de encerrar automaticamente.
                        </p>
                      </div>
                      <span className="text-lg font-black text-indigo-600 font-heading">
                        {(selectedGame.maxMultiplier ?? 4.0).toFixed(1)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1.5"
                      max="10.0"
                      step="0.5"
                      value={selectedGame.maxMultiplier ?? 4.0}
                      onChange={(e) => updateGameField('maxMultiplier', parseFloat(e.target.value))}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />

                    <div className="grid grid-cols-5 gap-1.5 pt-1">
                      {[2.0, 3.0, 3.5, 4.0, 5.0].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateGameField('maxMultiplier', val)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                            (selectedGame.maxMultiplier ?? 4.0) === val
                              ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {val.toFixed(1)}x
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Multiplicador Mínimo para Cashout */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-slate-900 block">
                          Multiplicador Mínimo para Liberar Cashout
                        </label>
                        <p className="text-[11px] text-slate-500">
                          O botão de Cashout só é desbloqueado quando o jogador atinge este multiplicador.
                        </p>
                      </div>
                      <span className="text-lg font-black text-emerald-600 font-heading">
                        {((selectedGame as any).minCashoutMultiplier ?? 2.0).toFixed(1)}x
                      </span>
                    </div>

                    <input
                      type="range"
                      min="1.1"
                      max="4.0"
                      step="0.1"
                      value={(selectedGame as any).minCashoutMultiplier ?? 2.0}
                      onChange={(e) => updateGameField('minCashoutMultiplier', parseFloat(e.target.value))}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />

                    <div className="grid grid-cols-5 gap-1.5 pt-1">
                      {[1.2, 1.5, 2.0, 2.5, 3.0].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updateGameField('minCashoutMultiplier', val)}
                          className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                            ((selectedGame as any).minCashoutMultiplier ?? 2.0) === val
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {val.toFixed(1)}x
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Módulo 3: Densidade de Trens & Frequência de Moedas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Densidade de Trens */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-slate-900 block">
                          Densidade de Trens & Barreiras (%)
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Porcentagem de ocupação dos 3 trilhos com trens em movimento e obstáculos.
                        </p>
                      </div>
                      <span className="text-sm font-black text-rose-600 font-heading">
                        {selectedGame.obstacleDensityPercent ?? 50}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="15"
                      max="95"
                      step="5"
                      value={selectedGame.obstacleDensityPercent ?? 50}
                      onChange={(e) => updateGameField('obstacleDensityPercent', parseInt(e.target.value, 10))}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600"
                    />

                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>20% (Trilhos Livres)</span>
                      <span>50% (Padrão)</span>
                      <span>85%+ (Muralha de Trens)</span>
                    </div>
                  </div>

                  {/* Frequência de Moedas */}
                  <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-xs font-black text-slate-900 block">
                          Frequência de Moedas nos Trilhos (%)
                        </label>
                        <p className="text-[11px] text-slate-500">
                          Quantidade de moedas e ímãs spawnados para o jogador coletar e subir o acumulado.
                        </p>
                      </div>
                      <span className="text-sm font-black text-amber-600 font-heading">
                        {selectedGame.bonusFrequencyPercent ?? 40}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="10"
                      max="80"
                      step="5"
                      value={selectedGame.bonusFrequencyPercent ?? 40}
                      onChange={(e) => updateGameField('bonusFrequencyPercent', parseInt(e.target.value, 10))}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                    />

                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>10% (Escasso)</span>
                      <span>40% (Equilibrado)</span>
                      <span>70%+ (Chuva de Moedas)</span>
                    </div>
                  </div>
                </div>

                {/* Módulo: Salvar Configurações do Subway Pay */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs text-slate-600">
                    Ao salvar, a nova velocidade, multiplicador teto e regras de cashout serão sincronizadas instantaneamente com a partida do jogador.
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await handleSaveGame(selectedGame);
                        onShowToast('Regras de velocidade, multiplicador e RTP do Subway Pay FIXADAS no banco com sucesso!', 'success');
                      } catch {
                        onShowToast('Erro ao salvar regras do Subway Pay.', 'error');
                      }
                    }}
                    disabled={savingGameId === selectedGame.id}
                    className="px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 shrink-0"
                  >
                    <Save className="w-4 h-4" />
                    <span>{savingGameId === selectedGame.id ? 'Gravando...' : 'Salvar Regras do Subway Pay'}</span>
                  </button>
                </div>
              </div>
            ) : (
            <div className="space-y-6">
              {/* Header with Live Telemetry */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Motor de Física em Tempo Real
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">Sync Instantâneo Ativo</span>
                  </div>
                  <h4 className="text-lg font-black text-white flex items-center gap-2">
                    <Flame className="w-5 h-5 text-orange-400" />
                    <span>Painel de Dificuldade & Velocidade dos Obstáculos (Gen Dino)</span>
                  </h4>
                  <p className="text-xs text-slate-300 max-w-2xl">
                    Ajuste instantaneamente em tempo real a velocidade de corrida, a cadência dos cactos e a janela de tempo de reação exigida do jogador.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateGameField('reactionWindowMs', 850);
                      updateGameField('baseSpeed', 6.0);
                      updateGameField('maxSpeed', 13.0);
                      updateGameField('acceleration', 0.001);
                      updateGameField('obstacleMultiplier', 1.0);
                      updateGameField('gameSpeedPercent', 100);
                      updateGameField('obstacleDensityPercent', 50);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar Padrão</span>
                  </button>
                </div>
              </div>

              {/* Quick Presets for Game Difficulty & Physics */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-500 block">
                  Presets Rápidos de Física & Dificuldade
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  {[
                    {
                      label: 'Demo / Onboarding',
                      desc: 'Super Lento & Fácil',
                      badge: '🟢 1400ms Reação',
                      speed: 4.5,
                      maxSpd: 7.0,
                      accel: 0.0005,
                      reaction: 1400,
                      obsMult: 0.5,
                      spdPct: 85,
                      density: 30,
                      color: 'border-emerald-200 hover:border-emerald-400 bg-emerald-50/50'
                    },
                    {
                      label: 'Equilibrado (iGaming)',
                      desc: 'Padrão da Indústria',
                      badge: '🟡 850ms Reação',
                      speed: 6.0,
                      maxSpd: 13.0,
                      accel: 0.0010,
                      reaction: 850,
                      obsMult: 1.0,
                      spdPct: 100,
                      density: 50,
                      color: 'border-indigo-200 hover:border-indigo-400 bg-indigo-50/50'
                    },
                    {
                      label: 'Desafio Gamer',
                      desc: 'Velocidade Alta',
                      badge: '🟠 600ms Reação',
                      speed: 8.5,
                      maxSpd: 18.0,
                      accel: 0.0018,
                      reaction: 600,
                      obsMult: 1.8,
                      spdPct: 125,
                      density: 75,
                      color: 'border-amber-200 hover:border-amber-400 bg-amber-50/50'
                    },
                    {
                      label: 'Hardcore / Retenção',
                      desc: 'Aperto Agressivo',
                      badge: '🔴 380ms Reação',
                      speed: 12.0,
                      maxSpd: 24.0,
                      accel: 0.0030,
                      reaction: 380,
                      obsMult: 3.0,
                      spdPct: 150,
                      density: 110,
                      color: 'border-rose-200 hover:border-rose-400 bg-rose-50/50'
                    },
                    {
                      label: 'Muro Travado / Impossível',
                      desc: 'Bloqueio Imediato',
                      badge: '💀 180ms Reação',
                      speed: 18.0,
                      maxSpd: 32.0,
                      accel: 0.0060,
                      reaction: 180,
                      obsMult: 5.5,
                      spdPct: 200,
                      density: 150,
                      color: 'border-purple-300 hover:border-purple-500 bg-purple-50/60'
                    }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        updateGameField('baseSpeed', preset.speed);
                        updateGameField('maxSpeed', preset.maxSpd);
                        updateGameField('acceleration', preset.accel);
                        updateGameField('reactionWindowMs', preset.reaction);
                        updateGameField('obstacleMultiplier', preset.obsMult);
                        updateGameField('gameSpeedPercent', preset.spdPct);
                        updateGameField('obstacleDensityPercent', preset.density);
                      }}
                      className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${preset.color} ${
                        (selectedGame.reactionWindowMs ?? 850) === preset.reaction &&
                        (selectedGame.baseSpeed ?? 6.0) === preset.speed
                          ? 'ring-2 ring-indigo-600 shadow-md font-bold'
                          : ''
                      }`}
                    >
                      <div>
                        <div className="text-xs font-black text-slate-900">{preset.label}</div>
                        <div className="text-[10px] text-slate-500">{preset.desc}</div>
                      </div>
                      <div className="mt-2 text-[10px] font-black text-indigo-700 bg-white/80 px-2 py-1 rounded-lg border border-slate-200/60 inline-block">
                        {preset.badge}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* MODULE 1: TEMPO DE REAÇÃO DO JOGADOR (HUMAN REACTION WINDOW) */}
              <div className="p-5 rounded-2xl bg-white border-2 border-indigo-100 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <label className="text-sm font-black text-slate-900 block">
                        Tempo de Reação do Jogador (Janela de Reflexo Humano)
                      </label>
                      <p className="text-xs text-slate-500">
                        Define a distância e o intervalo temporal mínimo em milissegundos para o jogador avistar e saltar sobre os obstáculos.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black text-indigo-600 font-heading">
                      {selectedGame.reactionWindowMs ?? 850} <span className="text-xs font-bold text-slate-400">ms</span>
                    </span>
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-black uppercase ${
                        (selectedGame.reactionWindowMs ?? 850) >= 1200
                          ? 'bg-emerald-100 text-emerald-800'
                          : (selectedGame.reactionWindowMs ?? 850) >= 800
                          ? 'bg-blue-100 text-blue-800'
                          : (selectedGame.reactionWindowMs ?? 850) >= 500
                          ? 'bg-amber-100 text-amber-800'
                          : (selectedGame.reactionWindowMs ?? 850) >= 280
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-purple-100 text-purple-900 ring-1 ring-purple-400'
                      }`}
                    >
                      {(selectedGame.reactionWindowMs ?? 850) >= 1200
                        ? '🟢 Treino / Lento'
                        : (selectedGame.reactionWindowMs ?? 850) >= 800
                        ? '🟡 Casual / Médio'
                        : (selectedGame.reactionWindowMs ?? 850) >= 500
                        ? '🟠 Rápido / Gamer'
                        : (selectedGame.reactionWindowMs ?? 850) >= 280
                        ? '🔴 Hardcore / Extremo'
                        : '💀 Impossível / Bloqueio'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2 pt-1">
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="10"
                    value={selectedGame.reactionWindowMs ?? 850}
                    onChange={(e) => updateGameField('reactionWindowMs', parseInt(e.target.value, 10))}
                    className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] font-bold text-slate-400">
                    <span>100ms (Sobre-humano / Impossível)</span>
                    <span>500ms (Reflexo Rápido)</span>
                    <span>850ms (Equilibrado)</span>
                    <span>1400ms (Relaxado)</span>
                    <span>2000ms (Treino)</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
                  {[
                    { label: '180ms Fatal', ms: 180 },
                    { label: '380ms Extremo', ms: 380 },
                    { label: '600ms Gamer', ms: 600 },
                    { label: '850ms Padrão', ms: 850 },
                    { label: '1200ms Amigável', ms: 1200 },
                    { label: '1600ms Demo', ms: 1600 }
                  ].map((btn) => (
                    <button
                      key={btn.ms}
                      type="button"
                      onClick={() => updateGameField('reactionWindowMs', btn.ms)}
                      className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                        (selectedGame.reactionWindowMs ?? 850) === btn.ms
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* MODULE 2: VELOCIDADE DOS OBSTÁCULOS & ESTEIRA */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-600/10 text-orange-600 flex items-center justify-center font-black">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <label className="text-sm font-black text-slate-900 block">
                      Velocidade dos Obstáculos & Esteira do Gen Dino
                    </label>
                    <p className="text-xs text-slate-500">
                      Controle a velocidade inicial de deslocamento dos cactos e a velocidade limite durante a corrida.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                  {/* Base Speed */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-800">Velocidade Base (Inicial)</label>
                      <span className="text-sm font-black text-indigo-600 font-heading">
                        {(selectedGame.baseSpeed ?? 6.0).toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="3.0"
                      max="20.0"
                      step="0.5"
                      value={selectedGame.baseSpeed ?? 6.0}
                      onChange={(e) => updateGameField('baseSpeed', parseFloat(e.target.value))}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="3.0"
                        max="25.0"
                        step="0.5"
                        value={selectedGame.baseSpeed ?? 6.0}
                        onChange={(e) => updateGameField('baseSpeed', parseFloat(e.target.value) || 6.0)}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">px/frame</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Velocidade logo no primeiro pulo (padrão: 6.0)</p>
                  </div>

                  {/* Max Speed */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-800">Velocidade Máxima (Teto)</label>
                      <span className="text-sm font-black text-orange-600 font-heading">
                        {(selectedGame.maxSpeed ?? 13.0).toFixed(1)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="6.0"
                      max="35.0"
                      step="1.0"
                      value={selectedGame.maxSpeed ?? 13.0}
                      onChange={(e) => updateGameField('maxSpeed', parseFloat(e.target.value))}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="6.0"
                        max="40.0"
                        step="1.0"
                        value={selectedGame.maxSpeed ?? 13.0}
                        onChange={(e) => updateGameField('maxSpeed', parseFloat(e.target.value) || 13.0)}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">px/frame</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Limite de velocidade da esteira (padrão: 13.0)</p>
                  </div>

                  {/* Acceleration */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-black text-slate-800">Aceleração por Frame</label>
                      <span className="text-sm font-black text-purple-600 font-heading">
                        {(selectedGame.acceleration ?? 0.001).toFixed(4)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.0002"
                      max="0.0080"
                      step="0.0002"
                      value={selectedGame.acceleration ?? 0.001}
                      onChange={(e) => updateGameField('acceleration', parseFloat(e.target.value))}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.0001"
                        max="0.02"
                        step="0.0005"
                        value={selectedGame.acceleration ?? 0.001}
                        onChange={(e) => updateGameField('acceleration', parseFloat(e.target.value) || 0.001)}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">Δv/s</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Ganho de aceleração contínuo (padrão: 0.001)</p>
                  </div>
                </div>
              </div>

              {/* MODULE 3: DENSIDADE & FREQUÊNCIA DE OBSTÁCULOS */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-600/10 text-amber-600 flex items-center justify-center font-black">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <label className="text-sm font-black text-slate-900 block">
                      Multiplicador de Obstáculos & Frequência de Cactos
                    </label>
                    <p className="text-xs text-slate-500">
                      Determine a quantidade de cactos agrupados e o espaçamento entre as barreiras de colisão.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  {/* Obstacle Multiplier */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800">
                        Multiplicador de Obstáculos (Tamanho do Grupo)
                      </label>
                      <span className="text-sm font-black text-indigo-600 font-heading">
                        {(selectedGame.obstacleMultiplier ?? 1.0).toFixed(2)}x
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.4"
                      max="6.0"
                      step="0.1"
                      value={selectedGame.obstacleMultiplier ?? 1.0}
                      onChange={(e) => updateGameField('obstacleMultiplier', parseFloat(e.target.value))}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      {[
                        { label: '0.5x Mínimo', val: 0.5 },
                        { label: '1.0x Padrão', val: 1.0 },
                        { label: '2.5x Alto', val: 2.5 },
                        { label: '5.0x Chuva', val: 5.0 }
                      ].map((p) => (
                        <button
                          key={p.val}
                          type="button"
                          onClick={() => updateGameField('obstacleMultiplier', p.val)}
                          className={`py-1.5 px-2 rounded-lg text-[11px] font-black transition-all border cursor-pointer ${
                            Math.abs((selectedGame.obstacleMultiplier ?? 1.0) - p.val) < 0.1
                              ? 'bg-indigo-600 text-white border-indigo-700'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Obstacle Density Percent */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800">
                        Densidade da Trilha (%)
                      </label>
                      <span className="text-sm font-black text-amber-600 font-heading">
                        {selectedGame.obstacleDensityPercent ?? 50}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="150"
                      step="5"
                      value={selectedGame.obstacleDensityPercent ?? 50}
                      onChange={(e) => updateGameField('obstacleDensityPercent', parseInt(e.target.value, 10))}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={selectedGame.obstacleDensityPercent ?? 50}
                        onChange={(e) => updateGameField('obstacleDensityPercent', parseInt(e.target.value, 10) || 50)}
                        className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                      <span className="text-[10px] text-slate-400 whitespace-nowrap">% densidade</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* MODULE 4: TELEMETRIA CALCULADA EM TEMPO REAL */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white shadow-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                      Telemetria de Física Estimada em Tempo Real
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                    60 FPS Engine
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] font-bold text-slate-400 block">Velocidade Linear</span>
                    <span className="text-lg font-black text-white">
                      {Math.round((selectedGame.baseSpeed ?? 6.0) * 60)} <span className="text-xs font-normal text-slate-400">px/s</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] font-bold text-slate-400 block">Tempo de Reação</span>
                    <span className="text-lg font-black text-indigo-300">
                      {selectedGame.reactionWindowMs ?? 850} <span className="text-xs font-normal text-slate-400">ms</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] font-bold text-slate-400 block">Espaçamento Mínimo</span>
                    <span className="text-lg font-black text-orange-300">
                      {Math.round((selectedGame.reactionWindowMs ?? 850) * (selectedGame.baseSpeed ?? 6.0) * 0.06)} <span className="text-xs font-normal text-slate-400">px</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <span className="text-[10px] font-bold text-slate-400 block">Velocidade Máxima Estimada</span>
                    <span className="text-lg font-black text-emerald-300">
                      {Math.round((selectedGame.maxSpeed ?? 13.0) * 60)} <span className="text-xs font-normal text-slate-400">px/s</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            )
          )}

          {/* TAB 4: ALAVANCAS DE RETENÇÃO (HOUSE LEVERS) */}
          {activeSubTab === 'retention' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Alavancas Algorítmicas de Retenção (House Levers)</span>
                </h4>
                <p className="text-xs text-slate-500">
                  Travas ativas e proteções para impedir sangrias de banca, sequências viciadas e apostas desbalanceadas.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Anti-Bailout */}
                <div
                  onClick={() => toggleAndAutoSave('antiBailoutMode', selectedGame.antiBailoutMode, 'Anti-Bailout')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    selectedGame.antiBailoutMode
                      ? 'bg-rose-50 border-rose-300 ring-2 ring-rose-500/20'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-900">🛡️ Anti-Bailout (Sem Salvação)</span>
                    <div
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                        selectedGame.antiBailoutMode ? 'bg-rose-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          selectedGame.antiBailoutMode ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Elimina qualquer peça ou brecha de salvação quando o jogador está em situação apertada.
                  </p>
                </div>

                {/* 2. Peças Pesadas */}
                <div
                  onClick={() => toggleAndAutoSave('heavyBlocksForce', selectedGame.heavyBlocksForce, 'Peças Pesadas / Cactos Duplos')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    selectedGame.heavyBlocksForce
                      ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-500/20'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-900">🧱 Peças Pesadas / Cactos Duplos</span>
                    <div
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                        selectedGame.heavyBlocksForce ? 'bg-amber-500' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          selectedGame.heavyBlocksForce ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Injeta padrões mortíferos (cactos triplos, peças 3x3) para saturar o espaço rapidamente.
                  </p>
                </div>

                {/* 3. Retenção Dinâmica por Multiplicador */}
                <div
                  onClick={() =>
                    toggleAndAutoSave(
                      'dynamicRetention',
                      selectedGame.dynamicRetention ?? true,
                      'Retenção por Multiplicador'
                    )
                  }
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    selectedGame.dynamicRetention ?? true
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-900">📈 Retenção por Multiplicador</span>
                    <div
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                        (selectedGame.dynamicRetention ?? true) ? 'bg-indigo-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          (selectedGame.dynamicRetention ?? true) ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Aumenta a dificuldade proporcionalmente a cada multiplicador 1.5x, 2.0x, 3.0x atingido.
                  </p>
                </div>

                {/* 4. Freio de Win Streak */}
                <div
                  onClick={() => toggleAndAutoSave('winStreakBrake', selectedGame.winStreakBrake ?? true, 'Freio de Win Streak')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    selectedGame.winStreakBrake ?? true
                      ? 'bg-purple-50 border-purple-300 ring-2 ring-purple-500/20'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-900">⚡ Freio de Sequência Vencedora</span>
                    <div
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                        (selectedGame.winStreakBrake ?? true) ? 'bg-purple-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          (selectedGame.winStreakBrake ?? true) ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Se o jogador vencer 2 ou 3 rodadas seguidas, a próxima rodada tem 95% de chance de corte.
                  </p>
                </div>

                {/* 5. Resistência em Apostas Altas */}
                <div
                  onClick={() => toggleAndAutoSave('highBetResistance', selectedGame.highBetResistance ?? true, 'Proteção de Aposta Alta')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    selectedGame.highBetResistance ?? true
                      ? 'bg-emerald-50 border-emerald-300 ring-2 ring-emerald-500/20'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-900">💰 Proteção de Aposta Alta</span>
                    <div
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                        (selectedGame.highBetResistance ?? true) ? 'bg-emerald-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          (selectedGame.highBetResistance ?? true) ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Aumenta a margem de retenção automaticamente caso a aposta seja superior a R$ 20.
                  </p>
                </div>

                {/* 6. Pressão de Quase-Derrota */}
                <div
                  onClick={() => toggleAndAutoSave('nearLossPressure', selectedGame.nearLossPressure, 'Pressão de Quase-Derrota')}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
                    selectedGame.nearLossPressure
                      ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500/20'
                      : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-black text-slate-900">🎯 Pressão de Quase-Derrota</span>
                    <div
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors ${
                        selectedGame.nearLossPressure ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          selectedGame.nearLossPressure ? 'translate-x-4' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Cria sensação de emoção intensa raspando o obstáculo milimetricamente.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: POPUPS & BANNERS */}
          {activeSubTab === 'popups' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-purple-600" />
                    <span>Popups Promocionais & Banners In-Game</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Ative popups de depósito, ofertas de rodadas e recarga dentro da tela do jogo.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => toggleAndAutoSave('popupEnabled', selectedGame.popupEnabled, 'Popup no Jogo')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                    selectedGame.popupEnabled
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                      : 'bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  {selectedGame.popupEnabled ? 'Popup Ativado no Jogo' : 'Ativar Popup no Jogo'}
                </button>
              </div>

              {/* 4 One-Click Presets */}
              <div className="space-y-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Modelos Prontos de Alta Conversão (1 Clique)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  {[
                    {
                      name: '🎁 100% Bônus Primeiro Depósito',
                      title: 'DOBRE SEU SALDO AGORA!',
                      desc: 'Deposite R$ 20 e jogue com R$ 40 + 50 rodadas bônus no PIX!',
                      btn: 'DEPOSITAR E DOBRAR SALDO',
                      action: 'deposit' as const,
                      img: '/assets/popups/banner_bonus_100.png'
                    },
                    {
                      name: '⚡ Modo Turbo 2x Multiplicador',
                      title: 'MODO TURBO ATIVADO!',
                      desc: 'Recarregue qualquer valor agora para duplicar os pontos na corrida.',
                      btn: 'ATIVAR TURBO NO PIX',
                      action: 'deposit' as const,
                      img: '/assets/popups/banner_turbo_2x.png'
                    },
                    {
                      name: '🏆 Baú Dourado Premiado',
                      title: 'VOCÊ DESBLOQUEOU UM BAÚ!',
                      desc: 'Deposite R$ 10 ou mais para abrir e resgatar até R$ 500 no PIX.',
                      btn: 'ABRIR MEU BAÚ PIX',
                      action: 'deposit' as const,
                      img: '/assets/popups/banner_bau_dourado.png'
                    },
                    {
                      name: '💎 Recarga Relâmpago VIP',
                      title: 'BÔNUS EXCLUSIVO LIBERADO',
                      desc: 'Oferta válida pelos próximos 5 minutos para alavancar sua banca.',
                      btn: 'GARANTIR BÔNUS VIP',
                      action: 'deposit' as const,
                      img: '/assets/popups/banner_recarga_premiada.png'
                    }
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        updateGameField('popupTitle', preset.title);
                        updateGameField('popupDescription', preset.desc);
                        updateGameField('popupButtonText', preset.btn);
                        updateGameField('popupButtonAction', preset.action);
                        updateGameField('popupImageUrl', preset.img);
                        updateGameField('popupEnabled', true);
                        onShowToast(`Modelo "${preset.name}" aplicado!`, 'success');
                      }}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 transition-all text-left space-y-1.5 cursor-pointer"
                    >
                      <span className="text-xs font-black text-slate-900 block truncate">{preset.name}</span>
                      <p className="text-[10px] text-slate-500 line-clamp-2">{preset.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Form & Live Mockup Split */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                {/* Inputs */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 block">Título do Popup</label>
                    <input
                      type="text"
                      value={selectedGame.popupTitle || ''}
                      onChange={(e) => updateGameField('popupTitle', e.target.value)}
                      placeholder="Ex: DOBRE SEU SALDO AGORA!"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 block">Descrição Promocional</label>
                    <textarea
                      rows={3}
                      value={selectedGame.popupDescription || ''}
                      onChange={(e) => updateGameField('popupDescription', e.target.value)}
                      placeholder="Ex: Deposite via PIX e ganhe 100% de bônus instantâneo na banca..."
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-600 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 block">Texto do Botão (CTA)</label>
                      <input
                        type="text"
                        value={selectedGame.popupButtonText || ''}
                        onChange={(e) => updateGameField('popupButtonText', e.target.value)}
                        placeholder="Ex: DEPOSITAR VIA PIX"
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 block">Ação do Botão</label>
                      <select
                        value={selectedGame.popupButtonAction || 'deposit'}
                        onChange={(e) => updateGameField('popupButtonAction', e.target.value as any)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-indigo-600"
                      >
                        <option value="deposit">Abrir Modal de Depósito PIX</option>
                        <option value="play">Jogar / Continuar</option>
                        <option value="url">Abrir Link Externo</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700 block">URL da Imagem / Banner</label>
                    <input
                      type="text"
                      value={selectedGame.popupImageUrl || ''}
                      onChange={(e) => updateGameField('popupImageUrl', e.target.value)}
                      placeholder="Ex: /assets/popups/banner_bonus_100.png"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-none focus:border-indigo-600"
                    />
                  </div>
                </div>

                {/* Live Mobile Mockup */}
                <div className="bg-slate-900 p-5 rounded-3xl text-white flex flex-col items-center justify-center space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Eye className="w-4 h-4 text-emerald-400" />
                    <span>Pré-Visualização em Tempo Real In-Game</span>
                  </div>

                  <div className="w-full max-w-[280px] bg-slate-950 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3 text-center">
                    <div className="w-full h-24 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center">
                      {selectedGame.popupImageUrl ? (
                        <img
                          src={selectedGame.popupImageUrl}
                          alt="Popup preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getGameCover(selectedGame.id);
                          }}
                        />
                      ) : (
                        <span className="text-xs text-slate-500">Sem imagem configurada</span>
                      )}
                    </div>

                    <h5 className="text-xs font-black text-white uppercase tracking-tight">
                      {selectedGame.popupTitle || 'TÍTULO DO POPUP'}
                    </h5>

                    <p className="text-[10px] text-slate-400 leading-snug">
                      {selectedGame.popupDescription || 'Descrição promocional que incentiva o jogador a recarregar...'}
                    </p>

                    <button
                      type="button"
                      className="w-full py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-slate-950 font-black text-[11px] rounded-xl shadow-md uppercase tracking-wider"
                    >
                      {selectedGame.popupButtonText || 'BOTAO CTA'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: AUDITORIA & HISTÓRICO DE RODADAS */}
          {activeSubTab === 'bets' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    <span>Auditoria & Rodadas Recentes em Tempo Real</span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Monitoramento de apostas, lucros da casa e multiplicadores sacados.
                  </p>
                </div>
                <span className="text-xs font-bold text-slate-400">
                  {selectedGame.recentBets?.length || 0} rodadas registradas
                </span>
              </div>

              {selectedGame.recentBets && selectedGame.recentBets.length > 0 ? (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Jogador</th>
                        <th className="px-4 py-3">Valor Apostado</th>
                        <th className="px-4 py-3">Multiplicador</th>
                        <th className="px-4 py-3">Prêmio Pago</th>
                        <th className="px-4 py-3">Retenção Casa</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Horário</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {selectedGame.recentBets.map((bet, idx) => (
                        <tr key={bet.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-bold text-slate-900">{bet.userName}</td>
                          <td className="px-4 py-3">R$ {bet.betAmount.toFixed(2)}</td>
                          <td className="px-4 py-3 font-bold text-indigo-600">{bet.multiplier.toFixed(2)}x</td>
                          <td className="px-4 py-3">R$ {bet.payoutAmount.toFixed(2)}</td>
                          <td className="px-4 py-3 font-bold text-emerald-600">
                            + R$ {Math.max(0, bet.betAmount - bet.payoutAmount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                bet.status === 'lost'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-emerald-100 text-emerald-700'
                              }`}
                            >
                              {bet.status === 'lost' ? 'RETIDO (CASA)' : 'SACADO'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-400">
                            {new Date(bet.createdAt).toLocaleTimeString('pt-BR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-500 space-y-2">
                  <Activity className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold">Nenhuma aposta registrada nesta sessão.</p>
                  <p className="text-[11px] text-slate-400">
                    As apostas em dinheiro real e modo teste aparecerão aqui instantaneamente.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
