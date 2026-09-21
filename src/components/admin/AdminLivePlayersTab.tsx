import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Radio,
  Gamepad2,
  Users,
  Flame,
  TrendingUp,
  DollarSign,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Play,
  Pause,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  ChevronRight,
  Sparkles,
  Zap,
  Smartphone,
  Monitor,
  Trophy,
  Sliders,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { AdminLivePlayersData, LivePlayerSession, LiveBetOutcome, LiveGameSummary, AdminTabId } from './adminTypes';
import { IOSCard, IOSButton, IOSBadge, IOSSearchBar } from './IOSComponents';

interface AdminLivePlayersTabProps {
  onNavigateTab: (tab: AdminTabId) => void;
  onOpenUserModal?: (user: any) => void;
  token?: string | null;
}

export const AdminLivePlayersTab: React.FC<AdminLivePlayersTabProps> = ({
  onNavigateTab,
  onOpenUserModal,
  token
}) => {
  const [data, setData] = useState<AdminLivePlayersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<LivePlayerSession | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settlingId, setSettlingId] = useState<string | null>(null);

  const timerRef = useRef<any>(null);

  // Helper to extract stored auth token
  const getAuthToken = () => {
    return (
      token ||
      (typeof window !== 'undefined'
        ? localStorage.getItem('pg_auth_token') ||
          localStorage.getItem('paygateway_token') ||
          localStorage.getItem('token') ||
          localStorage.getItem('auth_token')
        : '')
    );
  };

  // Fetch live players data from backend
  const fetchLivePlayers = async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      const authToken = getAuthToken();
      const headers: Record<string, string> = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/admin/live-players', { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}`);
      }
      const json: AdminLivePlayersData = await res.json();
      setData(json);
      setErrorMessage(null);
    } catch (err: any) {
      console.error('[AdminLivePlayersTab] Error fetching live data:', err);
      setErrorMessage(err.message || 'Falha ao sincronizar dados dos jogadores em tempo real.');
    } finally {
      setLoading(false);
      if (isManual) setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLivePlayers();
  }, [token]);

  // Polling loop every 4 seconds for high-fidelity live tracking
  useEffect(() => {
    if (!autoRefresh) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      fetchLivePlayers(false);
    }, 4000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefresh, token]);

  // Handle Force Settle / Cashout action
  const handleForceSettle = async (session: LivePlayerSession, action: 'cashout' | 'lost') => {
    try {
      setSettlingId(session.id);
      const authToken = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch(`/api/admin/live-players/${session.id}/settle`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action,
          multiplier: action === 'cashout' ? Math.max(1.1, session.multiplier || 1.1) : 0
        })
      });
      const resJson = await res.json();
      if (res.ok) {
        setActionSuccessMessage(resJson.message || 'Partida encerrada com sucesso!');
        setTimeout(() => setActionSuccessMessage(null), 4000);
        setSelectedSession(null);
        fetchLivePlayers(true);
      } else {
        alert(resJson.error || 'Erro ao forçar encerramento.');
      }
    } catch (err: any) {
      console.error('Error settling live session:', err);
      alert('Erro de conexão ao finalizar partida.');
    } finally {
      setSettlingId(null);
    }
  };

  // Filtered active sessions
  const filteredSessions = useMemo(() => {
    if (!data?.activeSessions) return [];
    return data.activeSessions.filter((s) => {
      const matchesGame =
        selectedGameFilter === 'all' ||
        s.gameId === selectedGameFilter ||
        (selectedGameFilter === 'g_block_puzzle' && s.gameId === 'block_puzzle') ||
        (selectedGameFilter === 'g_gen_dino' && (s.gameId === 'gen_dino' || s.gameId === 'dino')) ||
        (selectedGameFilter === 'g_zumbla' && s.gameId === 'zumbla') ||
        (selectedGameFilter === 'g_raspa_fortuna' && s.gameId === 'raspa_fortuna') ||
        (selectedGameFilter === 'g_subway_pay' && (s.gameId === 'subway_pay' || s.gameId === 'subway' || s.gameId === 'g_subway_pay'));

      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (s.userName && s.userName.toLowerCase().includes(q)) ||
        (s.userEmail && s.userEmail.toLowerCase().includes(q)) ||
        (s.gameName && s.gameName.toLowerCase().includes(q));
      return matchesGame && matchesSearch;
    });
  }, [data?.activeSessions, selectedGameFilter, searchQuery]);

  // Format currency
  const formatCurrency = (val: number) => {
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Game icons & colors map
  const getGameBadge = (gameId: string) => {
    switch (gameId) {
      case 'g_block_puzzle':
      case 'block_puzzle':
        return {
          color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
          dot: 'bg-blue-500',
          name: 'Block Win'
        };
      case 'g_gen_dino':
      case 'gen_dino':
      case 'dino':
        return {
          color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
          dot: 'bg-amber-500',
          name: 'GEN DINO'
        };
      case 'g_zumbla':
      case 'zumbla':
        return {
          color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
          dot: 'bg-purple-500',
          name: 'Zumbla Win'
        };
      case 'g_raspa_fortuna':
      case 'raspa_fortuna':
        return {
          color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
          dot: 'bg-emerald-500',
          name: 'Raspa Fortuna'
        };
      case 'g_subway_pay':
      case 'subway_pay':
      case 'subway':
        return {
          color: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
          dot: 'bg-amber-500',
          name: 'Subway Pay'
        };
      default:
        return {
          color: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
          dot: 'bg-slate-500',
          name: 'Jogo PIX'
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP PULSE BAR & CONTROLS */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-black/[0.04] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-ping" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Radar de Jogadores em Tempo Real
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/60 tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                AO VIVO
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Sincronização contínua a cada 4 segundos • Exibição instantânea de apostas ativas
            </p>
          </div>
        </div>

        {/* Action buttons & Auto-refresh toggle */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            {autoRefresh ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pausar Radar</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Retomar Radar</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => fetchLivePlayers(true)}
            disabled={refreshing}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Atualizar Agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#007AFF]' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('games')}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#007AFF] hover:bg-[#0062CC] text-white flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Gerenciar RTP & Jogos</span>
          </button>
        </div>
      </div>

      {actionSuccessMessage && (
        <div className="bg-emerald-500 text-white px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {errorMessage && !data && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-900 px-4 py-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchLivePlayers(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-700 transition-all cursor-pointer shrink-0"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* 2. REAL-TIME KPI HUD */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Jogadores Ativos */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-black/[0.04] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Jogadores Ao Vivo
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {data?.activePlayersCount ?? 0}
            </span>
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
              em partida
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Sessões simultâneas no momento
          </p>
        </div>

        {/* Metric 2: Volume em Aposta Ao Vivo */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-black/[0.04] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Volume em Jogo
            </span>
            <DollarSign className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#007AFF]">
            {formatCurrency(data?.totalVolumeInPlay ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Montante de apostas ativas em andamento
          </p>
        </div>

        {/* Metric 3: GGR Retido Hoje */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-black/[0.04] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              GGR Retido Hoje
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-[#30D158]">
            {formatCurrency(data?.todayGgrTotal ?? 0)}
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Margem gerada pelos jogos hoje
          </p>
        </div>

        {/* Metric 4: Média por Aposta & Win Rate */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-black/[0.04] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Ticket Médio
            </span>
            <Trophy className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
              {formatCurrency(data?.averageBet ?? 15)}
            </span>
            <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md">
              {data?.winRateLive ?? 45}% Win
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            {data?.todayGamesCount ?? 0} rodadas registradas hoje
          </p>
        </div>
      </div>

      {/* 3. LIVE GAMES BREAKDOWN (CARDS) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-slate-500" />
            <h3 className="text-sm font-bold text-slate-900">Distribuição por Jogo</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Clique para filtrar</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data?.gamesSummary?.map((game) => {
            const badge = getGameBadge(game.gameId);
            const isSelected = selectedGameFilter === game.gameId;

            return (
              <button
                key={game.gameId}
                type="button"
                onClick={() => setSelectedGameFilter(isSelected ? 'all' : game.gameId)}
                className={`p-4 rounded-2xl text-left transition-all border cursor-pointer ${
                  isSelected
                    ? 'bg-[#007AFF]/10 border-[#007AFF] shadow-sm ring-1 ring-[#007AFF]'
                    : 'bg-white border-black/[0.04] hover:border-slate-300 hover:shadow-2xs'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                    {game.name}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-slate-700">
                      {game.activeSessions} online
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  <div className="text-xs text-slate-500 font-medium">{game.category}</div>
                  <div className="text-sm font-bold text-slate-900">
                    Volume: {formatCurrency(game.totalWageredLive)}
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-black/[0.04] flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span>RTP: {(Number(game.rtpPercent) || 95.0).toFixed(1)}%</span>
                  <span className="text-slate-600 font-semibold">{game.difficulty}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. MAIN ACTIVE PLAYERS TABLE & LIVE FEED */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Players Table */}
        <div className="xl:col-span-2 space-y-4">
          <IOSCard className="p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.04] pb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#007AFF]" />
                  <span>Sessões Ativas em Execução</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                    {filteredSessions.length} jogadores
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Monitoramento instantâneo de apostas e multiplicadores
                </p>
              </div>

              {/* Quick Filters */}
              <div className="flex items-center gap-2">
                <div className="w-48 sm:w-56">
                  <IOSSearchBar
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Filtrar por jogador..."
                  />
                </div>
                {selectedGameFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedGameFilter('all')}
                    className="text-xs font-semibold text-[#007AFF] hover:underline cursor-pointer shrink-0"
                  >
                    Ver Todos
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center space-y-3">
                <RefreshCw className="w-8 h-8 text-[#007AFF] animate-spin mx-auto" />
                <p className="text-xs text-slate-400 font-medium">
                  Sintonizando satélites de dados dos jogos...
                </p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <Gamepad2 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-semibold text-slate-700">
                  Nenhum jogador encontrado com os filtros atuais
                </p>
                <p className="text-xs text-slate-400">
                  Tente limpar a busca ou selecionar outro jogo.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-black/[0.06] text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                      <th className="py-3 px-3">Jogador</th>
                      <th className="py-3 px-3">Jogo / Dispositivo</th>
                      <th className="py-3 px-3">Aposta</th>
                      <th className="py-3 px-3">Multiplicador Atual</th>
                      <th className="py-3 px-3">Ganho Potencial</th>
                      <th className="py-3 px-3">Tempo</th>
                      <th className="py-3 px-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/[0.04]">
                    {filteredSessions.map((s) => {
                      const badge = getGameBadge(s.gameId);
                      const isHighRisk = s.betAmount >= 30;

                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-slate-50/80 transition-colors group"
                        >
                          {/* Player */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs uppercase shrink-0 border border-black/[0.05]">
                                {s.userName ? s.userName.charAt(0) : 'U'}
                              </div>
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                  <span>{s.userName}</span>
                                  {s.isInfluencer && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                                      INFLUENCER
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                  {s.userEmail}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Game & Action */}
                          <td className="py-3 px-3">
                            <div>
                              <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.color}`}>
                                {s.gameName}
                              </span>
                              <div className="text-[10px] text-slate-400 font-medium truncate max-w-[140px] mt-0.5">
                                {s.lastAction || s.device || 'Partida Ativa'}
                              </div>
                            </div>
                          </td>

                          {/* Bet Amount */}
                          <td className="py-3 px-3">
                            <div className={`font-bold ${isHighRisk ? 'text-rose-600 font-extrabold' : 'text-slate-900'}`}>
                              {formatCurrency(s.betAmount)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Saldo: {formatCurrency(s.userBalance)}
                            </div>
                          </td>

                          {/* Multiplier */}
                          <td className="py-3 px-3">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-extrabold text-xs border border-emerald-200">
                              <Zap className="w-3 h-3 text-emerald-600 fill-emerald-500 animate-pulse" />
                              <span>{(Number(s.multiplier) || 1.0).toFixed(2)}x</span>
                            </div>
                          </td>

                          {/* Potential Payout */}
                          <td className="py-3 px-3">
                            <div className="font-bold text-emerald-600 text-xs">
                              {formatCurrency(s.potentialPayout)}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              RTP {s.rtpPercent}%
                            </span>
                          </td>

                          {/* Duration */}
                          <td className="py-3 px-3 text-slate-500 font-medium whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{s.durationSeconds}s</span>
                            </div>
                          </td>

                          {/* Quick Admin Actions */}
                          <td className="py-3 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedSession(s)}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
                            >
                              Inspecionar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </IOSCard>

          {/* Hourly chart summary */}
          <IOSCard className="p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-black/[0.04] pb-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                Pico de Sessões por Hora (Hoje)
              </h4>
              <span className="text-xs font-semibold text-slate-400">
                Atividade acumulada
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 pt-2">
              {data?.hourlyActivity?.map((hourItem) => (
                <div
                  key={hourItem.hour}
                  className="bg-slate-50 rounded-xl p-2 text-center border border-black/[0.02]"
                >
                  <div className="text-[10px] font-bold text-slate-400">
                    {hourItem.hour}
                  </div>
                  <div className="text-sm font-extrabold text-[#007AFF] mt-0.5">
                    {hourItem.players}
                  </div>
                  <div className="text-[9px] text-slate-500 font-medium truncate">
                    {formatCurrency(hourItem.wagered)}
                  </div>
                </div>
              ))}
            </div>
          </IOSCard>
        </div>

        {/* Right Col: Live Settled Bets Feed & Session Inspector */}
        <div className="space-y-6">
          {/* Selected Session Inspector Modal/Card if clicked */}
          {selectedSession ? (
            <IOSCard className="p-5 space-y-4 border-2 border-[#007AFF]/30 bg-blue-50/20">
              <div className="flex items-center justify-between border-b border-blue-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#007AFF]" />
                  <h4 className="font-bold text-sm text-slate-900">
                    Controle de Sessão Ao Vivo
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSession(null)}
                  className="text-xs text-slate-400 hover:text-slate-700 font-bold"
                >
                  Fechar
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-black/[0.03]">
                  <span className="text-slate-500 font-medium">Jogador:</span>
                  <span className="font-bold text-slate-900">{selectedSession.userName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-black/[0.03]">
                  <span className="text-slate-500 font-medium">E-mail:</span>
                  <span className="text-slate-600">{selectedSession.userEmail}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-black/[0.03]">
                  <span className="text-slate-500 font-medium">Jogo:</span>
                  <span className="font-bold text-slate-900">{selectedSession.gameName}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-black/[0.03]">
                  <span className="text-slate-500 font-medium">Aposta:</span>
                  <span className="font-bold text-slate-900">{formatCurrency(selectedSession.betAmount)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-black/[0.03]">
                  <span className="text-slate-500 font-medium">Multiplicador:</span>
                  <span className="font-bold text-emerald-600">{(Number(selectedSession.multiplier) || 1.0).toFixed(2)}x</span>
                </div>
                <div className="flex justify-between py-1 border-b border-black/[0.03]">
                  <span className="text-slate-500 font-medium">Ganho Potencial:</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(selectedSession.potentialPayout)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-black/[0.03]">
                  <span className="text-slate-500 font-medium">Duração:</span>
                  <span className="font-bold text-slate-700">{selectedSession.durationSeconds}s</span>
                </div>
              </div>

              {/* Admin Actions */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Intervenção Administrativa
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={settlingId === selectedSession.id}
                    onClick={() => handleForceSettle(selectedSession, 'cashout')}
                    className="py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer disabled:opacity-50"
                  >
                    {settlingId === selectedSession.id ? 'Processando...' : 'Forçar Cashout'}
                  </button>
                  <button
                    type="button"
                    disabled={settlingId === selectedSession.id}
                    onClick={() => handleForceSettle(selectedSession, 'lost')}
                    className="py-2 px-3 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer disabled:opacity-50"
                  >
                    {settlingId === selectedSession.id ? 'Processando...' : 'Finalizar Derrota'}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onNavigateTab('users');
                  }}
                  className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer text-center"
                >
                  Ver Perfil Completo & Ajustar Saldo
                </button>
              </div>
            </IOSCard>
          ) : null}

          {/* Live Settled Outcomes Feed */}
          <IOSCard className="p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-black/[0.04] pb-3">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm text-slate-900">
                  Feed de Resultados Recentes
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold uppercase">
                Últimas Rodadas
              </span>
            </div>

            <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
              {data?.recentOutcomes && data.recentOutcomes.length > 0 ? (
                data.recentOutcomes.slice(0, 18).map((outcome) => {
                  const isWon = outcome.status === 'cashed_out' || outcome.profitAmount > 0;

                  return (
                    <div
                      key={outcome.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-black/[0.03] flex items-center justify-between gap-3 text-xs transition-colors hover:bg-slate-100/80"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 truncate max-w-[110px]">
                            {outcome.userName}
                          </span>
                          <span className="text-[10px] text-slate-400">• {outcome.gameName}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Apostou {formatCurrency(outcome.betAmount)} {outcome.multiplier > 0 && `• ${outcome.multiplier.toFixed(2)}x`}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div
                          className={`font-extrabold ${
                            isWon ? 'text-emerald-600' : 'text-slate-400'
                          }`}
                        >
                          {isWon ? `+${formatCurrency(outcome.payoutAmount)}` : 'Perdeu'}
                        </div>
                        <span className="text-[9px] text-slate-400">
                          {outcome.timeAgo}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  Aguardando encerramento das primeiras rodadas...
                </div>
              )}
            </div>
          </IOSCard>
        </div>
      </div>
    </div>
  );
};
