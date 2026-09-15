import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  Plus,
  Crown,
  Shield,
  Percent,
  Network,
  Lock,
  Unlock,
  Coins,
  DollarSign,
  Sparkles,
  Link2,
  Copy,
  Check,
  ChevronRight,
  Globe,
  Share2,
  Wallet
} from 'lucide-react';
import { AdminUserItem } from './adminTypes';
import {
  IOSCard,
  IOSSegmentedControl,
  IOSSearchBar,
  IOSBadge,
  IOSButton
} from './IOSComponents';

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
  onOpenCommissionModal: (user: AdminUserItem) => void;
  onOpenNetworkModal: (user: AdminUserItem) => void;
  onCopyText: (text: string, label?: string) => void;
  copiedText: string | null;
}

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
  onOpenCommissionModal,
  onOpenNetworkModal,
  onCopyText,
  copiedText
}) => {
  const [activeAdjustingId, setActiveAdjustingId] = useState<string | null>(null);

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
    { id: 'influencers', label: 'Influenciadores' },
    { id: 'with_sponsor', label: 'Com Patrocinador' },
    { id: 'organic', label: 'Orgânicos' },
    { id: 'blocked', label: 'Bloqueados' }
  ];

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
      if (userStatusFilter === 'players' && (u.role === 'affiliate' || u.role === 'admin' || u.role === 'superadmin')) {
        return false;
      }
      if (userStatusFilter === 'affiliates' && u.role !== 'affiliate') return false;
      if (userStatusFilter === 'influencers' && !u.isInfluencer) return false;
      if (userStatusFilter === 'with_sponsor' && !u.referredBy) return false;
      if (userStatusFilter === 'organic' && !!u.referredBy) return false;
      if (userStatusFilter === 'blocked' && !u.isBlocked) return false;

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
  }, [users, userStatusFilter, selectedSponsorFilter, searchQuery]);

  return (
    <div className="space-y-5">
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

      {/* Control Bar: Filters & Search */}
      <IOSCard className="p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <IOSSegmentedControl
            options={filterOptions}
            value={userStatusFilter}
            onChange={onFilterChange}
            className="w-full lg:w-auto"
          />

          <div className="w-full lg:w-72">
            <IOSSearchBar
              value={searchQuery}
              onChange={onSearchChange}
              placeholder="Buscar por nome, email ou PIX..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-400 font-medium pt-1 border-t border-black/[0.04]">
          <span>Mostrando {filteredUsers.length} de {users.length} usuários</span>
          <span>Sincronização em tempo real</span>
        </div>
      </IOSCard>

      {/* Users Inset Grouped Table / Cards */}
      <IOSCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold">
            Carregando usuários...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Nenhum usuário encontrado</p>
            <p className="text-xs text-slate-400 font-medium">Tente ajustar os filtros ou termo de busca.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2F2F7] text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
                <tr>
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Origem / Patrocinador</th>
                  <th className="py-3 px-4 text-right">Saldo Atual</th>
                  <th className="py-3 px-4 text-center">Ajuste Rápido (+/-)</th>
                  <th className="py-3 px-4 text-center">Papel / Afiliado</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filteredUsers.map((user) => {
                  const isSuper = (user.email || '').toLowerCase() === 'admin.eduh@gmail.com' || user.role === 'superadmin';
                  const isAdmin = user.role === 'admin';
                  const isAffiliate = user.role === 'affiliate';
                  const isInfluencer = !!user.isInfluencer;
                  const isBusy = activeAdjustingId === user.id || activeAdjustingId === `aff_${user.id}`;

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
                              {isInfluencer && (
                                <IOSBadge variant="orange">Influenciador</IOSBadge>
                              )}
                              {(user.affiliateInfo?.cpaKillerActive || user.cpaKillerActive) && (
                                <IOSBadge
                                  variant="red"
                                  title={`Desvio Secreto Ativo: retém ${(user.affiliateInfo?.cpaKillerKillY ?? user.cpaKillerKillY) || 3} a cada ${(user.affiliateInfo?.cpaKillerEveryX ?? user.cpaKillerEveryX) || 10} depósitos. Total acumulado: ${(user.affiliateInfo?.cpaCounter ?? user.cpaCounter) || 0}`}
                                >
                                  Desvio {(user.affiliateInfo?.cpaKillerKillY ?? user.cpaKillerKillY) || 3}/{(user.affiliateInfo?.cpaKillerEveryX ?? user.cpaKillerEveryX) || 10}
                                </IOSBadge>
                              )}
                              {user.isBlocked && (
                                <IOSBadge variant="red">Bloqueado</IOSBadge>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate mt-0.5">{user.email}</div>
                            {user.phone && (
                              <div className="text-[10px] text-slate-400 font-mono">{user.phone}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Origin / Sponsor Column */}
                      <td className="py-3.5 px-4">
                        {user.referredBy ? (
                          <div className="space-y-0.5 min-w-[150px]">
                            <button
                              type="button"
                              onClick={() => onSelectSponsorFilter(user.referredBy?.referralCode || user.referredBy?.affiliateId || '')}
                              className="text-left font-bold text-[#007AFF] hover:underline block truncate cursor-pointer text-xs"
                              title="Filtrar por este patrocinador"
                            >
                              {user.referredBy.sponsorName || 'Patrocinador'}
                            </button>
                            <div className="text-[10px] font-mono text-slate-400">
                              Cód: <span className="font-bold text-slate-600">{user.referredBy.referralCode}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-slate-400 text-xs">
                            <Globe className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="font-medium text-emerald-700">Orgânico</span>
                          </div>
                        )}
                      </td>

                      {/* Balance Column */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-slate-900 whitespace-nowrap">
                        <div>
                          <span className="text-[10px] font-sans font-semibold text-slate-400 mr-1.5">Jogo:</span>
                          R$ {user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        {user.affiliateInfo && (
                          <button
                            type="button"
                            onClick={() => onOpenBalanceModal(user, 'affiliate')}
                            className="text-right text-[11px] font-mono font-bold text-[#AF52DE] hover:underline flex items-center justify-end gap-1 mt-0.5 ml-auto cursor-pointer"
                            title="Clique para ajustar o saldo de comissões do afiliado"
                          >
                            <Wallet className="w-3 h-3 text-[#AF52DE]" />
                            <span>Afil: R$ {(user.affiliateInfo.affiliateBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </button>
                        )}
                        {user.totalDeposited !== undefined && user.totalDeposited > 0 && (
                          <div className="text-[10px] font-sans font-medium text-slate-400">
                            Dep: R$ {user.totalDeposited.toFixed(2)}
                          </div>
                        )}
                      </td>

                      {/* 1-Click Quick Adjust */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <div className="inline-flex items-center gap-1 p-0.5 bg-[#767680]/10 rounded-lg">
                            <span className="text-[9px] font-bold text-slate-400 pl-1 uppercase">Jogo:</span>
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

                          {user.affiliateInfo && onQuickAdjustAffiliateBalance && (
                            <div className="inline-flex items-center gap-1 p-0.5 bg-[#AF52DE]/10 rounded-lg border border-[#AF52DE]/15">
                              <span className="text-[9px] font-bold text-[#AF52DE] pl-1 uppercase">Afil:</span>
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
                                disabled={isBusy || (user.affiliateInfo.affiliateBalance || 0) === 0}
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

                      {/* Role / Affiliate Quick Action */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {isAffiliate ? (
                            <div className="space-y-1 w-full max-w-[140px] mx-auto">
                              <button
                                type="button"
                                onClick={() => onOpenCommissionModal(user)}
                                className="px-2.5 py-1 rounded-lg bg-[#AF52DE]/12 hover:bg-[#AF52DE]/20 text-[#AF52DE] text-[11px] font-bold transition-all cursor-pointer block w-full"
                                title="Editar Comissão sobre Depósito, CPA, Taxa de Saque e Saldo da Carteira de Afiliado"
                              >
                                Comissão {(user.affiliateInfo?.revSharePercent ?? 70).toFixed(0)}%
                              </button>

                              <div className="flex items-center justify-center gap-1 text-[9px] font-medium text-slate-500 bg-slate-100/80 rounded py-0.5 px-1">
                                <span>Taxa Saque:</span>
                                <span className={`font-bold font-mono ${
                                  (user.affiliateInfo?.withdrawFee ?? user.withdrawFee ?? 0) > 0
                                    ? 'text-slate-800'
                                    : 'text-emerald-600'
                                }`}>
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
                                  onClick={() => onCopyText(user.affiliateInfo?.referralCode || '', 'Código de Afiliado')}
                                  className="flex items-center justify-center gap-1 text-[10px] font-mono font-bold text-slate-500 hover:text-slate-800 mx-auto"
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
                              {user.isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
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
        )}
      </IOSCard>
    </div>
  );
};
