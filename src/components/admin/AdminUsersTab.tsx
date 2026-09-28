import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  Crown,
  Shield,
  Percent,
  Network,
  Lock,
  Unlock,
  Coins,
  DollarSign,
  UserPlus,
  Copy,
  Check,
  Globe,
  Wallet,
  Gamepad2,
  TrendingUp,
  UserCheck,
  AlertCircle,
  Zap,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  CheckCircle2
} from 'lucide-react';
import { AdminUserItem } from './adminTypes';
import {
  IOSCard,
  IOSSegmentedControl,
  IOSSearchBar,
  IOSBadge,
  IOSButton
} from './IOSComponents';
import { Pagination } from '../Pagination';

interface AdminUsersTabProps {
  users: AdminUserItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  userStatusFilter: string;
  onFilterChange: (filter: any) => void;
  selectedSponsorFilter: string | null;
  onClearSponsorFilter: () => void;
  onSelectSponsorFilter: (sponsorCodeOrId: string) => void;
  onOpenBalanceModal: (user: AdminUserItem, wallet?: 'player' | 'affiliate') => void;
  onQuickAdjustBalance: (user: AdminUserItem, delta: number, isSetZero?: boolean) => Promise<void>;
  onQuickAdjustAffiliateBalance?: (user: AdminUserItem, delta: number, isSetZero?: boolean) => Promise<void>;
  onQuickToggleAffiliate: (user: AdminUserItem, targetStatus?: boolean) => Promise<void>;
  onToggleBlockUser: (user: AdminUserItem) => Promise<void>;
  onToggleAutoWithdraw?: (user: AdminUserItem) => Promise<void>;
  onToggleWithdraw?: (user: AdminUserItem) => Promise<void>;
  onOpenCommissionModal: (user: AdminUserItem) => void;
  onOpenNetworkModal: (user: AdminUserItem) => void;
  onCopyText: (text: string, label?: string) => void;
  copiedText: string | null;
  onChangeUserGame?: (user: AdminUserItem, newGameId: string) => Promise<void>;
  onTogglePartner?: (user: AdminUserItem, approve: boolean) => Promise<void>;
}

// Helper to determine game badge, name and style
export const getGameInfo = (gameId?: string) => {
  const normalized = (gameId || '').toLowerCase().trim();
  if (normalized.includes('zumbla')) {
    return {
      name: 'Zumbla Win',
      short: 'Zumbla',
      emoji: '🐸',
      badgeClass: 'bg-emerald-500/12 text-emerald-800 border-emerald-500/20'
    };
  }
  if (normalized.includes('dino') || normalized.includes('t-rex')) {
    return {
      name: 'Gen Dino',
      short: 'Dino',
      emoji: '🦖',
      badgeClass: 'bg-amber-500/12 text-amber-800 border-amber-500/20'
    };
  }
  if (normalized.includes('subway') || normalized.includes('runner')) {
    return {
      name: 'Subway Pay',
      short: 'Subway',
      emoji: '🏃',
      badgeClass: 'bg-amber-500/12 text-amber-800 border-amber-500/20'
    };
  }
  if (normalized.includes('scratch') || normalized.includes('raspa')) {
    return {
      name: 'Raspa Fortuna',
      short: 'Raspa',
      emoji: '🍀',
      badgeClass: 'bg-teal-500/12 text-teal-800 border-teal-500/20'
    };
  }
  return {
    name: 'Block Win',
    short: 'Block Win',
    emoji: '🧩',
    badgeClass: 'bg-blue-500/12 text-blue-800 border-blue-500/20'
  };
};

export const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  users,
  loading,
  searchQuery,
  onSearchChange,
  userStatusFilter,
  onFilterChange,
  selectedSponsorFilter,
  onClearSponsorFilter,
  onSelectSponsorFilter,
  onOpenBalanceModal,
  onQuickAdjustBalance,
  onQuickAdjustAffiliateBalance,
  onQuickToggleAffiliate,
  onToggleBlockUser,
  onToggleAutoWithdraw,
  onToggleWithdraw,
  onOpenCommissionModal,
  onOpenNetworkModal,
  onCopyText,
  copiedText,
  onChangeUserGame,
  onTogglePartner,
}) => {
  const [activeAdjustingId, setActiveAdjustingId] = useState<string | null>(null);
  const [gameFilter, setGameFilter] = useState<'all' | 'zumbla' | 'block' | 'dino' | 'raspa' | 'subway'>('all');

  const handleQuickBalance = async (userItem: AdminUserItem, delta: number, isSetZero = false) => {
    setActiveAdjustingId(userItem.id);
    try {
      await onQuickAdjustBalance(userItem, delta, isSetZero);
    } finally {
      setActiveAdjustingId(null);
    }
  };

  const handleQuickAffiliateBalance = async (userItem: AdminUserItem, delta: number, isSetZero = false) => {
    if (!onQuickAdjustAffiliateBalance) return;
    setActiveAdjustingId(`aff_${userItem.id}`);
    try {
      await onQuickAdjustAffiliateBalance(userItem, delta, isSetZero);
    } finally {
      setActiveAdjustingId(null);
    }
  };

  const filterOptions = [
    { id: 'all', label: 'Todos' },
    { id: 'players', label: 'Jogadores' },
    { id: 'affiliates', label: 'Afiliados' },
    { id: 'auto_withdraw', label: '⚡ Saque Auto' },
    { id: 'manual_withdraw', label: '⏳ Saque Manual' },
    { id: 'withdraw_blocked', label: '🚫 Saques Bloqueados' },
    { id: 'influencers', label: 'Influenciadores' },
    { id: 'with_sponsor', label: 'Com Patrocinador' },
    { id: 'organic', label: 'Orgânicos' },
    { id: 'blocked', label: 'Bloqueados' }
  ];

  // Summary Metrics calculations
  const metrics = useMemo(() => {
    let totalPlayerBal = 0;
    let totalAffiliateBal = 0;
    let affiliatesCount = 0;
    let influencersCount = 0;

    users.forEach((u) => {
      totalPlayerBal += Number(u.balance || 0);
      if (u.affiliateInfo?.affiliateBalance) {
        totalAffiliateBal += Number(u.affiliateInfo.affiliateBalance);
      }
      if (u.role === 'affiliate') affiliatesCount++;
      if (u.isInfluencer) influencersCount++;
    });

    return {
      totalUsers: users.length,
      affiliatesCount,
      influencersCount,
      totalPlayerBal,
      totalAffiliateBal
    };
  }, [users]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Sponsor drilldown filter
      if (selectedSponsorFilter) {
        const sponsor = u.referredBy;
        if (!sponsor) return false;
        if (
          sponsor.affiliateId !== selectedSponsorFilter &&
          sponsor.referralCode !== selectedSponsorFilter
        ) {
          return false;
        }
      }

      // Status filters
      if (
        userStatusFilter === 'players' &&
        (u.role === 'affiliate' || u.role === 'admin' || u.role === 'superadmin')
      ) {
        return false;
      }
      if (userStatusFilter === 'affiliates' && u.role !== 'affiliate') return false;
      if (userStatusFilter === 'influencers' && !u.isInfluencer) return false;
      if (userStatusFilter === 'with_sponsor' && !u.referredBy) return false;
      if (userStatusFilter === 'organic' && !!u.referredBy) return false;
      if (userStatusFilter === 'blocked' && !u.isBlocked) return false;
      if (userStatusFilter === 'auto_withdraw' && u.autoWithdrawBlocked) return false;
      if (userStatusFilter === 'manual_withdraw' && !u.autoWithdrawBlocked) return false;
      if (userStatusFilter === 'withdraw_blocked' && !u.withdrawBlocked) return false;

      // Game of origin filter
      if (gameFilter !== 'all') {
        const gameId = (u.registeredGame || u.acquisitionGame || '').toLowerCase();
        if (gameFilter === 'subway' && !gameId.includes('subway') && !gameId.includes('runner')) return false;
        if (gameFilter === 'zumbla' && !gameId.includes('zumbla')) return false;
        if (gameFilter === 'dino' && !gameId.includes('dino') && !gameId.includes('t-rex')) return false;
        if (gameFilter === 'raspa' && !gameId.includes('scratch') && !gameId.includes('raspa')) return false;
        if (gameFilter === 'block' && (gameId.includes('subway') || gameId.includes('zumbla') || gameId.includes('dino') || gameId.includes('scratch') || gameId.includes('raspa'))) return false;
      }

      // Query search
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      const sponsor = u.referredBy;
      return (
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phone || '').toLowerCase().includes(q) ||
        (u.id || '').toLowerCase().includes(q) ||
        (u.affiliateInfo?.referralCode || '').toLowerCase().includes(q) ||
        (sponsor?.sponsorName || '').toLowerCase().includes(q) ||
        (sponsor?.referralCode || '').toLowerCase().includes(q)
      );
    });
  }, [users, userStatusFilter, selectedSponsorFilter, searchQuery, gameFilter]);

  // 40 users per page pagination
  const PAGE_SIZE = 40;
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Reset page when any filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [userStatusFilter, selectedSponsorFilter, searchQuery, gameFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, currentPage, PAGE_SIZE]);

  return (
    <div className="space-y-5">
      {/* High-Level Overview Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-black/[0.05] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Usuários Registrados</span>
            <Users className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {metrics.totalUsers}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            {metrics.affiliatesCount} afiliados • {metrics.totalUsers - metrics.affiliatesCount} jogadores
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/[0.05] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Volume em Jogos</span>
            <Gamepad2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-600 mt-1 font-mono">
            R$ {metrics.totalPlayerBal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            Saldos ativos para apostas
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/[0.05] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Carteiras de Afiliados</span>
            <Wallet className="w-4 h-4 text-[#AF52DE]" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-[#AF52DE] mt-1 font-mono">
            R$ {metrics.totalAffiliateBal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            Comissões disponíveis
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-black/[0.05] shadow-xs">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Parceiros Ativos</span>
            <Crown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-600 mt-1">
            {metrics.affiliatesCount}
          </div>
          <div className="text-[11px] text-slate-500 font-medium mt-0.5">
            {metrics.influencersCount} influenciadores VIP
          </div>
        </div>
      </div>

      {/* Active Sponsor Filter Pill Notice */}
      {selectedSponsorFilter && (
        <div className="p-3 bg-[#007AFF]/10 border border-[#007AFF]/20 rounded-2xl flex items-center justify-between text-xs text-[#0062CC]">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            <span>
              Filtrando indicados pelo código ou ID:{' '}
              <strong className="font-mono font-bold">{selectedSponsorFilter}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={onClearSponsorFilter}
            className="text-xs font-bold text-[#007AFF] hover:underline cursor-pointer"
          >
            Limpar filtro
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <IOSCard className="p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="overflow-x-auto pb-1 lg:pb-0">
            <IOSSegmentedControl
              options={filterOptions}
              value={userStatusFilter}
              onChange={onFilterChange}
              className="w-full sm:w-auto"
            />
          </div>

          <div className="w-full lg:w-72">
            <IOSSearchBar
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Buscar por nome, email ou PIX..."
            />
          </div>
        </div>

        {/* Game of Origin Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-black/[0.04]">
          <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Gamepad2 className="w-3.5 h-3.5" /> Jogo de Origem:
          </span>
          <button
            type="button"
            onClick={() => setGameFilter('all')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              gameFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos os Jogos
          </button>
          <button
            type="button"
            onClick={() => setGameFilter('zumbla')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              gameFilter === 'zumbla'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <span>🐸 Zumbla Win</span>
          </button>
          <button
            type="button"
            onClick={() => setGameFilter('block')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              gameFilter === 'block'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
            }`}
          >
            <span>🧩 Block Win</span>
          </button>
          <button
            type="button"
            onClick={() => setGameFilter('dino')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              gameFilter === 'dino'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <span>🦖 Gen Dino</span>
          </button>
          <button
            type="button"
            onClick={() => setGameFilter('raspa')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              gameFilter === 'raspa'
                ? 'bg-teal-600 text-white'
                : 'bg-teal-50 text-teal-800 hover:bg-teal-100'
            }`}
          >
            <span>🍀 Raspa Fortuna</span>
          </button>
          <button
            type="button"
            onClick={() => setGameFilter('subway')}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              gameFilter === 'subway'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <span>🏃 Subway Pay</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-1 border-t border-black/[0.04]">
          <span>
            Mostrando {filteredUsers.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(filteredUsers.length, currentPage * PAGE_SIZE)} de {filteredUsers.length} usuários {filteredUsers.length !== users.length ? `(filtrados de ${users.length})` : ''}
          </span>
          <span>Sincronização em tempo real</span>
        </div>
      </IOSCard>

      {/* Main List Container: Responsive Cards on Mobile + Table on Desktop */}
      <IOSCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold">
            Carregando usuários...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Nenhum usuário encontrado</p>
            <p className="text-xs text-slate-400 font-medium">
              Tente ajustar os filtros ou termo de busca.
            </p>
          </div>
        ) : (
          <div>
            {/* MOBILE VIEW: High-Contrast Touch Cards (< 768px) */}
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedUsers.map((user) => {
                const isSuper = user.role === 'superadmin';
                const isAdmin = user.role === 'admin';
                const isAffiliate = user.role === 'affiliate';
                const isInfluencer = !!user.isInfluencer;
                const isBusy = activeAdjustingId === user.id || activeAdjustingId === `aff_${user.id}`;
                const gameInfo = getGameInfo(user.registeredGame || user.acquisitionGame);

                return (
                  <div key={`mob_${user.id}`} className="p-4 space-y-3.5 hover:bg-slate-50/70 transition-colors">
                    {/* User Header */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#007AFF]/12 text-[#007AFF] font-black text-sm flex items-center justify-center shrink-0">
                          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-slate-900 truncate">{user.name}</h4>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          {user.phone && (
                            <p className="text-[11px] font-mono text-slate-400">{user.phone}</p>
                          )}
                        </div>
                      </div>

                      {/* Origin Game Badge / Selector */}
                      {onChangeUserGame ? (
                        <select
                          value={user.registeredGame || user.acquisitionGame || 'g_block_puzzle'}
                          onChange={(e) => onChangeUserGame(user, e.target.value)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 cursor-pointer outline-none ${gameInfo.badgeClass}`}
                          title="Alterar jogo de origem deste usuário"
                        >
                          <option value="g_subway_pay">🏃 Subway Pay</option>
                          <option value="g_block_puzzle">🧩 Block Win</option>
                          <option value="g_gen_dino">🦖 Gen Dino</option>
                          <option value="g_zumbla">🐸 Zumbla</option>
                          <option value="g_raspa_fortuna">🍀 Raspa</option>
                          <option value="alliance_hub">🏛️ Hub</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${gameInfo.badgeClass}`}
                        >
                          <span>{gameInfo.emoji}</span>
                          <span>{gameInfo.short}</span>
                        </span>
                      )}
                    </div>

                    {/* Roles and Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isSuper ? (
                        <IOSBadge variant="indigo">Super Admin</IOSBadge>
                      ) : isAdmin ? (
                        <IOSBadge variant="blue">Admin</IOSBadge>
                      ) : isAffiliate ? (
                        <IOSBadge variant="purple">Afiliado</IOSBadge>
                      ) : (
                        <IOSBadge variant="gray">Jogador</IOSBadge>
                      )}
                      {isInfluencer && <IOSBadge variant="orange">Influenciador VIP</IOSBadge>}
                      {user.isPartner && user.partnerApproved && (
                        <IOSBadge variant="green">💎 Parceiro ({user.partnerCode || 'VIP'})</IOSBadge>
                      )}
                      {user.partnerRequested && !user.partnerApproved && (
                        <IOSBadge variant="orange">⚠️ Pedido Parceiro</IOSBadge>
                      )}
                      {(user.affiliateInfo?.cpaKillerActive || user.cpaKillerActive) && (
                        <IOSBadge variant="red">
                          Desvio {(user.affiliateInfo?.cpaKillerKillY ?? user.cpaKillerKillY) || 3}/
                          {(user.affiliateInfo?.cpaKillerEveryX ?? user.cpaKillerEveryX) || 10}
                        </IOSBadge>
                      )}
                      {user.autoWithdrawBlocked ? (
                        <IOSBadge variant="orange" title="Saque em análise manual">
                          ⏳ Saque Manual
                        </IOSBadge>
                      ) : (
                        <IOSBadge variant="green" title="Saque automático ativo (Instantâneo)">
                          ⚡ Saque Auto
                        </IOSBadge>
                      )}
                      {user.withdrawBlocked && (
                        <IOSBadge variant="red" title="Saques desativados pelo admin">
                          🚫 Saques Off
                        </IOSBadge>
                      )}
                      {user.isBlocked && <IOSBadge variant="red">Bloqueado</IOSBadge>}
                    </div>

                    {/* Origin / Sponsor info */}
                    <div className="text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Patrocinador / Origem:</span>
                      {user.referredBy ? (
                        <button
                          type="button"
                          onClick={() =>
                            onSelectSponsorFilter(
                              user.referredBy?.referralCode || user.referredBy?.affiliateId || ''
                            )
                          }
                          className="font-bold text-[#007AFF] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>{user.referredBy.sponsorName}</span>
                          <span className="font-mono text-[10px] text-slate-400">
                            ({user.referredBy.referralCode})
                          </span>
                        </button>
                      ) : (
                        <span className="font-medium text-emerald-700 flex items-center gap-1">
                          <Globe className="w-3.5 h-3.5 text-emerald-600" /> Orgânico
                        </span>
                      )}
                    </div>

                    {/* Balances Highlight Card */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* Game Balance */}
                      <div className="p-3 bg-[#34C759]/8 border border-[#34C759]/20 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                            <Gamepad2 className="w-3.5 h-3.5 text-emerald-600" /> Saldo de Jogo
                          </span>
                          <span className="font-mono font-black text-sm text-slate-900">
                            R$ {user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                        {/* Quick adjust touch buttons for Game Balance */}
                        <div className="grid grid-cols-4 gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQuickBalance(user, 10)}
                            className="h-8 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-40"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQuickBalance(user, 50)}
                            className="h-8 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-40"
                          >
                            +50
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQuickBalance(user, 100)}
                            className="h-8 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-40"
                          >
                            +100
                          </button>
                          <button
                            type="button"
                            disabled={isBusy || user.balance === 0}
                            onClick={() => handleQuickBalance(user, 0, true)}
                            className="h-8 rounded-lg bg-white border border-red-200 text-xs font-bold text-[#FF3B30] hover:bg-red-50 transition-all cursor-pointer disabled:opacity-30"
                          >
                            Zerar
                          </button>
                        </div>
                      </div>

                      {/* Affiliate Wallet (if affiliate) */}
                      {isAffiliate && user.affiliateInfo && (
                        <div className="p-3 bg-[#AF52DE]/8 border border-[#AF52DE]/20 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#8944AB] uppercase flex items-center gap-1">
                              <Wallet className="w-3.5 h-3.5 text-[#AF52DE]" /> Carteira Afiliado
                            </span>
                            <span className="font-mono font-black text-sm text-[#AF52DE]">
                              R${' '}
                              {(user.affiliateInfo.affiliateBalance || 0).toLocaleString('pt-BR', {
                                minimumFractionDigits: 2
                              })}
                            </span>
                          </div>

                          {/* Quick adjust touch buttons for Affiliate Wallet */}
                          {onQuickAdjustAffiliateBalance && (
                            <div className="grid grid-cols-4 gap-1.5 pt-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQuickAffiliateBalance(user, 50)}
                                className="h-8 rounded-lg bg-white border border-[#AF52DE]/30 text-xs font-bold text-purple-900 hover:bg-purple-50 transition-all cursor-pointer disabled:opacity-40"
                              >
                                +50
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQuickAffiliateBalance(user, 100)}
                                className="h-8 rounded-lg bg-white border border-[#AF52DE]/30 text-xs font-bold text-purple-900 hover:bg-purple-50 transition-all cursor-pointer disabled:opacity-40"
                              >
                                +100
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQuickAffiliateBalance(user, 500)}
                                className="h-8 rounded-lg bg-white border border-[#AF52DE]/30 text-xs font-bold text-purple-900 hover:bg-purple-50 transition-all cursor-pointer disabled:opacity-40"
                              >
                                +500
                              </button>
                              <button
                                type="button"
                                disabled={isBusy || (user.affiliateInfo.affiliateBalance || 0) === 0}
                                onClick={() => handleQuickAffiliateBalance(user, 0, true)}
                                className="h-8 rounded-lg bg-white border border-red-200 text-xs font-bold text-[#FF3B30] hover:bg-red-50 transition-all cursor-pointer disabled:opacity-30"
                              >
                                Zerar
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Affiliate Management Actions (Mobile) */}
                    {isAffiliate ? (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 space-y-2.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Código REF:</span>
                            <button
                              type="button"
                              onClick={() =>
                                onCopyText(
                                  user.affiliateInfo?.referralCode || '',
                                  'Código de Afiliado'
                                )
                              }
                              className="font-mono font-bold text-slate-800 flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200"
                            >
                              <span>{user.affiliateInfo?.referralCode}</span>
                              {copiedText === user.affiliateInfo?.referralCode ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3 text-slate-400" />
                              )}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => onOpenNetworkModal(user)}
                            className="font-bold text-[#007AFF] hover:underline flex items-center gap-1"
                          >
                            <Network className="w-3.5 h-3.5" />
                            <span>Ver Rede</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenCommissionModal(user)}
                            className="h-9 px-3 rounded-xl bg-[#AF52DE]/12 text-[#AF52DE] font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <Percent className="w-3.5 h-3.5" />
                            <span>Comissão {(user.affiliateInfo?.revSharePercent ?? 70).toFixed(0)}%</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onOpenBalanceModal(user, 'affiliate')}
                            className="h-9 px-3 rounded-xl bg-[#007AFF]/12 text-[#007AFF] font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                          >
                            <Wallet className="w-3.5 h-3.5" />
                            <span>Ajustar Carteira</span>
                          </button>
                        </div>

                        {user.isPartner && (
                          <button
                            type="button"
                            onClick={() => onOpenCommissionModal(user)}
                            className="w-full mt-1.5 py-1.5 px-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs hover:bg-blue-100 transition-all"
                            title="Definir percentual que o parceiro ganha sobre os afiliados dele"
                          >
                            <Crown className="w-3.5 h-3.5 text-blue-600" />
                            <span>Comissão Parceiro s/ Afiliados: {user.partnerCommissionPercent ?? 20}%</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onQuickToggleAffiliate(user, true)}
                        className="w-full py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <UserPlus className="w-3.5 h-3.5 text-purple-500" />
                        <span>Promover este Jogador a Afiliado</span>
                      </button>
                    )}

                    {/* Primary Action Buttons (Mobile) */}
                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <IOSButton
                        size="sm"
                        variant="secondary"
                        onClick={() => onOpenBalanceModal(user, 'player')}
                        className="flex-1 h-9 font-bold"
                      >
                        Ajustar Saldo Completo
                      </IOSButton>

                      {!isSuper && (
                        <button
                          type="button"
                          onClick={() => onToggleBlockUser(user)}
                          className={`h-9 px-3 rounded-xl font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                            user.isBlocked
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {user.isBlocked ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Desbloquear</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>Bloquear</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Withdrawal Financial Controls (Mobile) */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {onToggleAutoWithdraw && (
                        <button
                          type="button"
                          onClick={() => onToggleAutoWithdraw(user)}
                          className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            user.autoWithdrawBlocked
                              ? 'bg-amber-50 text-amber-800 border border-amber-300 hover:bg-emerald-50 hover:text-emerald-800'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-amber-50 hover:text-amber-800'
                          }`}
                          title={user.autoWithdrawBlocked ? 'Ativar Saque Automático Instantâneo' : 'Definir Saque Manual (Fila de Análise)'}
                        >
                          {user.autoWithdrawBlocked ? (
                            <>
                              <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span className="truncate">Ativar Auto</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 text-emerald-600 fill-current shrink-0" />
                              <span className="truncate">Definir Manual</span>
                            </>
                          )}
                        </button>
                      )}

                      {onToggleWithdraw && (
                        <button
                          type="button"
                          onClick={() => onToggleWithdraw(user)}
                          className={`py-2 px-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            user.withdrawBlocked
                              ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-emerald-50 hover:text-emerald-800'
                              : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                          }`}
                          title={user.withdrawBlocked ? 'Reativar saques deste usuário' : 'Desativar / bloquear saques deste usuário'}
                        >
                          {user.withdrawBlocked ? (
                            <>
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                              <span className="truncate">Reativar Saque</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="truncate">Desativar Saque</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Partner VIP Toggle Action (Mobile) */}
                    {onTogglePartner && (
                      <div className="pt-1">
                        {user.isPartner && user.partnerApproved ? (
                          <button
                            type="button"
                            onClick={() => onTogglePartner(user, false)}
                            className="w-full py-2 rounded-xl bg-emerald-50 hover:bg-rose-50 text-emerald-800 hover:text-rose-700 text-xs font-semibold border border-emerald-200 hover:border-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Crown className="w-3.5 h-3.5 text-amber-500" />
                            <span>Parceiro Oficial Ativo (Clique p/ Revogar)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onTogglePartner(user, true)}
                            className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                              user.partnerRequested
                                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 animate-pulse'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            <Crown className="w-3.5 h-3.5 text-amber-500" />
                            <span>{user.partnerRequested ? '⭐ Aprovar Pedido de Parceiro VIP' : 'Promover a Parceiro VIP (Aprovar)'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* DESKTOP VIEW: High-Density Structured Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F2F2F7] text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
                  <tr>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Origem / Patrocinador</th>
                    <th className="py-3 px-4 text-right">Saldos (Jogo & Afil)</th>
                    <th className="py-3 px-4 text-center">Ajuste Rápido</th>
                    <th className="py-3 px-4 text-center">Papel / Afiliado</th>
                    <th className="py-3 px-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {paginatedUsers.map((user) => {
                    const isSuper = user.role === 'superadmin';
                    const isAdmin = user.role === 'admin';
                    const isAffiliate = user.role === 'affiliate';
                    const isInfluencer = !!user.isInfluencer;
                    const isBusy = activeAdjustingId === user.id || activeAdjustingId === `aff_${user.id}`;
                    const gameInfo = getGameInfo(user.registeredGame || user.acquisitionGame);

                    return (
                      <tr key={user.id} className="hover:bg-black/[0.015] transition-colors">
                        {/* User Info Column */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3 min-w-[200px]">
                            <div className="w-9 h-9 rounded-full bg-[#007AFF]/12 text-[#007AFF] font-bold text-xs flex items-center justify-center shrink-0">
                              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 truncate">{user.name}</span>
                                {isSuper ? (
                                  <IOSBadge variant="indigo">Super Admin</IOSBadge>
                                ) : isAdmin ? (
                                  <IOSBadge variant="blue">Admin</IOSBadge>
                                ) : isAffiliate ? (
                                  <IOSBadge variant="purple">Afiliado</IOSBadge>
                                ) : (
                                  <IOSBadge variant="gray">Jogador</IOSBadge>
                                )}
                                {isInfluencer && <IOSBadge variant="orange">Influenciador</IOSBadge>}
                                {(user.affiliateInfo?.cpaKillerActive || user.cpaKillerActive) && (
                                  <IOSBadge
                                    variant="red"
                                    title={`Desvio Ativo: ${(user.affiliateInfo?.cpaKillerKillY ?? user.cpaKillerKillY) || 3} a cada ${(user.affiliateInfo?.cpaKillerEveryX ?? user.cpaKillerEveryX) || 10}`}
                                  >
                                    Desvio
                                  </IOSBadge>
                                )}
                                {user.autoWithdrawBlocked ? (
                                  <IOSBadge
                                    variant="orange"
                                    title="Saques deste usuário vão para aprovação manual"
                                  >
                                    ⏳ Manual
                                  </IOSBadge>
                                ) : (
                                  <IOSBadge
                                    variant="green"
                                    title="Saque automático ativo (Instantâneo padrão)"
                                  >
                                    ⚡ Auto Saque
                                  </IOSBadge>
                                )}
                                {user.withdrawBlocked && (
                                  <IOSBadge
                                    variant="red"
                                    title="Saques desativados pelo administrador para este usuário"
                                  >
                                    🚫 Saques Off
                                  </IOSBadge>
                                )}
                                {user.isBlocked && <IOSBadge variant="red">Bloqueado</IOSBadge>}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                {user.email}
                              </div>
                              {user.phone && (
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {user.phone}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Origin / Sponsor Column */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1 min-w-[140px]">
                            {/* Game Origin Badge / Selector */}
                            {onChangeUserGame ? (
                              <select
                                value={user.registeredGame || user.acquisitionGame || 'g_block_puzzle'}
                                onChange={(e) => onChangeUserGame(user, e.target.value)}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer outline-none ${gameInfo.badgeClass}`}
                                title="Alterar jogo de origem deste usuário"
                              >
                                <option value="g_subway_pay">🏃 Subway Pay</option>
                                <option value="g_block_puzzle">🧩 Block Win</option>
                                <option value="g_gen_dino">🦖 Gen Dino</option>
                                <option value="g_zumbla">🐸 Zumbla Win</option>
                                <option value="g_raspa_fortuna">🍀 Raspa Fortuna</option>
                                <option value="alliance_hub">🏛️ Alliance Hub</option>
                              </select>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${gameInfo.badgeClass}`}
                              >
                                <span>{gameInfo.emoji}</span>
                                <span>{gameInfo.name}</span>
                              </span>
                            )}

                            {user.referredBy ? (
                              <div className="space-y-0.5 pt-0.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onSelectSponsorFilter(
                                      user.referredBy?.referralCode ||
                                        user.referredBy?.affiliateId ||
                                        ''
                                    )
                                  }
                                  className="text-left font-bold text-[#007AFF] hover:underline block truncate cursor-pointer text-xs"
                                  title="Filtrar por este patrocinador"
                                >
                                  {user.referredBy.sponsorName || 'Patrocinador'}
                                </button>
                                <div className="text-[10px] font-mono text-slate-400">
                                  Cód:{' '}
                                  <span className="font-bold text-slate-600">
                                    {user.referredBy.referralCode}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                                <Globe className="w-3.5 h-3.5 text-emerald-500" />
                                <span className="font-medium text-emerald-700">Orgânico</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Balance Column */}
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-slate-900 whitespace-nowrap min-w-[140px]">
                          <div>
                            <span className="text-[10px] font-sans font-semibold text-slate-400 mr-1.5">
                              Jogo:
                            </span>
                            R${' '}
                            {user.balance.toLocaleString('pt-BR', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2
                            })}
                          </div>
                          {user.affiliateInfo && (
                            <button
                              type="button"
                              onClick={() => onOpenBalanceModal(user, 'affiliate')}
                              className="text-right text-[11px] font-mono font-bold text-[#AF52DE] hover:underline flex items-center justify-end gap-1 mt-0.5 ml-auto cursor-pointer"
                              title="Ajustar saldo da carteira de afiliado"
                            >
                              <Wallet className="w-3 h-3 text-[#AF52DE]" />
                              <span>
                                Afil: R${' '}
                                {(user.affiliateInfo.affiliateBalance || 0).toLocaleString('pt-BR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </span>
                            </button>
                          )}
                          {user.totalDeposited !== undefined && user.totalDeposited > 0 && (
                            <div className="text-[10px] font-sans font-medium text-slate-400">
                              Dep: R$ {user.totalDeposited.toFixed(2)}
                            </div>
                          )}
                        </td>

                        {/* 1-Click Quick Adjust */}
                        <td className="py-3.5 px-4 text-center min-w-[170px]">
                          <div className="flex flex-col items-center gap-1.5">
                            {/* Game Balance quick adjustment */}
                            <div className="inline-flex items-center gap-1 p-0.5 bg-[#767680]/10 rounded-lg">
                              <span className="text-[9px] font-bold text-slate-400 pl-1 uppercase">
                                Jogo:
                              </span>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQuickBalance(user, 10)}
                                className="px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-white rounded hover:shadow-xs transition-all cursor-pointer disabled:opacity-40"
                                title="Creditar +R$ 10 no saldo de Jogo"
                              >
                                +10
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQuickBalance(user, 50)}
                                className="px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-white rounded hover:shadow-xs transition-all cursor-pointer disabled:opacity-40"
                                title="Creditar +R$ 50 no saldo de Jogo"
                              >
                                +50
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleQuickBalance(user, 100)}
                                className="px-1.5 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-white rounded hover:shadow-xs transition-all cursor-pointer disabled:opacity-40"
                                title="Creditar +R$ 100 no saldo de Jogo"
                              >
                                +100
                              </button>
                              <button
                                type="button"
                                disabled={isBusy || user.balance === 0}
                                onClick={() => handleQuickBalance(user, 0, true)}
                                className="px-1.5 py-0.5 text-[10px] font-bold text-[#FF3B30] hover:bg-white rounded hover:shadow-xs transition-all cursor-pointer disabled:opacity-30"
                                title="Zerar Saldo de Jogo"
                              >
                                Zerar
                              </button>
                            </div>

                            {/* Affiliate Wallet quick adjustment */}
                            {user.affiliateInfo && onQuickAdjustAffiliateBalance && (
                              <div className="inline-flex items-center gap-1 p-0.5 bg-[#AF52DE]/10 rounded-lg border border-[#AF52DE]/15">
                                <span className="text-[9px] font-bold text-[#AF52DE] pl-1 uppercase">
                                  Afil:
                                </span>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleQuickAffiliateBalance(user, 50)}
                                  className="px-1.5 py-0.5 text-[10px] font-bold text-slate-800 hover:bg-white rounded hover:shadow-xs transition-all cursor-pointer disabled:opacity-40"
                                  title="Creditar +R$ 50 na Carteira de Afiliado"
                                >
                                  +50
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleQuickAffiliateBalance(user, 100)}
                                  className="px-1.5 py-0.5 text-[10px] font-bold text-slate-800 hover:bg-white rounded hover:shadow-xs transition-all cursor-pointer disabled:opacity-40"
                                  title="Creditar +R$ 100 na Carteira de Afiliado"
                                >
                                  +100
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleQuickAffiliateBalance(user, 500)}
                                  className="px-1.5 py-0.5 text-[10px] font-bold text-slate-800 hover:bg-white rounded hover:shadow-xs transition-all cursor-pointer disabled:opacity-40"
                                  title="Creditar +R$ 500 na Carteira de Afiliado"
                                >
                                  +500
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    isBusy || (user.affiliateInfo.affiliateBalance || 0) === 0
                                  }
                                  onClick={() => handleQuickAffiliateBalance(user, 0, true)}
                                  className="px-1.5 py-0.5 text-[10px] font-bold text-[#FF3B30] hover:bg-white rounded hover:shadow-xs transition-all cursor-pointer disabled:opacity-30"
                                  title="Zerar Carteira de Afiliado"
                                >
                                  Zerar
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Role / Affiliate Management */}
                        <td className="py-3.5 px-4 text-center min-w-[140px]">
                          <div className="flex flex-col items-center gap-1">
                            {isAffiliate ? (
                              <div className="space-y-1 w-full max-w-[140px] mx-auto">
                                <button
                                  type="button"
                                  onClick={() => onOpenCommissionModal(user)}
                                  className="px-2.5 py-1 rounded-lg bg-[#AF52DE]/12 hover:bg-[#AF52DE]/20 text-[#AF52DE] text-[11px] font-bold transition-all cursor-pointer block w-full"
                                  title="Editar Comissão sobre Depósito, CPA, Taxa de Saque e Saldo"
                                >
                                  Comissão {(user.affiliateInfo?.revSharePercent ?? 70).toFixed(0)}%
                                </button>

                                <div className="flex items-center justify-center gap-1 text-[9px] font-medium text-slate-500 bg-slate-100/80 rounded py-0.5 px-1">
                                  <span>Taxa Saque:</span>
                                  <span
                                    className={`font-bold font-mono ${
                                      (user.affiliateInfo?.withdrawFee ?? user.withdrawFee ?? 0) > 0
                                        ? 'text-slate-800'
                                        : 'text-emerald-600'
                                    }`}
                                  >
                                    {(user.affiliateInfo?.withdrawFee ?? user.withdrawFee ?? 0) > 0
                                      ? `R$ ${(user.affiliateInfo?.withdrawFee ?? user.withdrawFee ?? 0).toFixed(2)}`
                                      : 'Grátis'}
                                  </span>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => onOpenBalanceModal(user, 'affiliate')}
                                  className="px-2 py-0.5 rounded-lg bg-[#007AFF]/10 hover:bg-[#007AFF]/20 text-[#007AFF] text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer w-full"
                                  title="Ajustar saldo da carteira de afiliado"
                                >
                                  <Wallet className="w-3 h-3" />
                                  <span>Ajustar Saldo Afil</span>
                                </button>

                                {user.affiliateInfo?.referralCode && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onCopyText(
                                        user.affiliateInfo?.referralCode || '',
                                        'Código de Afiliado'
                                      )
                                    }
                                    className="flex items-center justify-center gap-1 text-[10px] font-mono font-bold text-slate-500 hover:text-slate-800 mx-auto"
                                    title="Copiar código de indicação"
                                  >
                                    {copiedText === user.affiliateInfo.referralCode ? (
                                      <Check className="w-3 h-3 text-[#34C759]" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                    <span>{user.affiliateInfo.referralCode}</span>
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => onOpenNetworkModal(user)}
                                  className="text-[10px] font-bold text-[#007AFF] hover:underline flex items-center justify-center gap-1 mx-auto"
                                >
                                  <Network className="w-3 h-3" />
                                  <span>Ver Rede</span>
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onQuickToggleAffiliate(user, true)}
                                className="px-2.5 py-1 rounded-lg bg-[#767680]/10 hover:bg-[#AF52DE]/12 hover:text-[#AF52DE] text-slate-600 text-[11px] font-semibold transition-all cursor-pointer"
                              >
                                Tornar Afiliado
                              </button>
                            )}

                            {onTogglePartner && (
                              user.isPartner && user.partnerApproved ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => onTogglePartner(user, false)}
                                    className="mt-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-rose-50 text-emerald-800 hover:text-rose-700 text-[10px] font-bold border border-emerald-200 transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                    title="Clique para revogar acesso do parceiro"
                                  >
                                    <Crown className="w-3 h-3 text-amber-500" />
                                    <span>Parceiro ({user.partnerCode || 'VIP'})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onOpenCommissionModal(user)}
                                    className="mt-0.5 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold border border-blue-200 transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                    title="Definir comissão deste parceiro sobre os afiliados dele"
                                  >
                                    <Percent className="w-2.5 h-2.5 text-blue-600" />
                                    <span>Comissão: {user.partnerCommissionPercent ?? 20}%</span>
                                  </button>
                                </>
                              ) : user.partnerRequested ? (
                                <button
                                  type="button"
                                  onClick={() => onTogglePartner(user, true)}
                                  className="mt-1 px-2 py-0.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-black border border-amber-300 animate-pulse transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                  title="Clique para aprovar pedido de parceiro"
                                >
                                  <Crown className="w-3 h-3 text-amber-600" />
                                  <span>Aprovar Parceiro</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => onTogglePartner(user, true)}
                                  className="mt-1 px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-200 transition-all flex items-center justify-center gap-1 mx-auto cursor-pointer shadow-2xs active:scale-95"
                                  title="Conceder acesso de Parceiro VIP ao painel parceiro.goalliancehub.com ou /parceiros"
                                >
                                  <Crown className="w-3 h-3 text-amber-600" />
                                  <span>Definir Parceiro</span>
                                </button>
                              )
                            )}
                          </div>
                        </td>

                        {/* Actions Column */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Full Balance & Limit Edit Modal */}
                            <IOSButton
                              size="sm"
                              variant="secondary"
                              onClick={() => onOpenBalanceModal(user)}
                            >
                              Ajustar
                            </IOSButton>

                            {/* Toggle Auto-Withdraw (⚡ Auto vs ⏳ Manual) */}
                            {onToggleAutoWithdraw && (
                              <button
                                type="button"
                                onClick={() => onToggleAutoWithdraw(user)}
                                title={
                                  user.autoWithdrawBlocked
                                    ? 'Saque em modo MANUAL. Clique para ativar Saque Automático instantâneo (padrão)'
                                    : 'Saque AUTOMÁTICO ativo. Clique para colocar saques em aprovação manual'
                                }
                                className={`h-8 px-2 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                  user.autoWithdrawBlocked
                                    ? 'bg-amber-50 hover:bg-emerald-50 text-amber-800 hover:text-emerald-800 border border-amber-300'
                                    : 'bg-emerald-50 hover:bg-amber-50 text-emerald-800 hover:text-amber-800 border border-emerald-300'
                                }`}
                              >
                                {user.autoWithdrawBlocked ? (
                                  <>
                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span className="hidden xl:inline">Manual</span>
                                  </>
                                ) : (
                                  <>
                                    <Zap className="w-3.5 h-3.5 text-emerald-600 fill-current shrink-0" />
                                    <span className="hidden xl:inline">Auto</span>
                                  </>
                                )}
                              </button>
                            )}

                            {/* Toggle Withdraw Access (🚫 Desativar vs ✅ Reativar) */}
                            {onToggleWithdraw && (
                              <button
                                type="button"
                                onClick={() => onToggleWithdraw(user)}
                                title={
                                  user.withdrawBlocked
                                    ? 'Saques estão DESATIVADOS para este usuário. Clique para reativar saques'
                                    : 'Saques estão ATIVOS para este usuário. Clique para desativar/bloquear saques'
                                }
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                  user.withdrawBlocked
                                    ? 'bg-rose-100 text-rose-800 hover:bg-emerald-50 hover:text-emerald-800 border border-rose-300'
                                    : 'bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
                                }`}
                              >
                                {user.withdrawBlocked ? (
                                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                                ) : (
                                  <ArrowUpRight className="w-4 h-4" />
                                )}
                              </button>
                            )}

                            {/* Block/Unblock Button */}
                            {!isSuper && (
                              <button
                                type="button"
                                onClick={() => onToggleBlockUser(user)}
                                title={user.isBlocked ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                  user.isBlocked
                                    ? 'bg-[#34C759]/12 text-[#34C759] hover:bg-[#34C759]/20'
                                    : 'bg-[#FF3B30]/12 text-[#FF3B30] hover:bg-[#FF3B30]/20'
                                }`}
                              >
                                {user.isBlocked ? (
                                  <Unlock className="w-3.5 h-3.5" />
                                ) : (
                                  <Lock className="w-3.5 h-3.5" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 40 per page Pagination Controls */}
            {filteredUsers.length > 0 && (
              <div className="p-4 border-t border-black/[0.05] bg-slate-50/50">
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredUsers.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                  itemLabel="usuários"
                />
              </div>
            )}
          </div>
        )}
      </IOSCard>
    </div>
  );
};
