import React from 'react';
import {
  Network,
  Users,
  DollarSign,
  Percent,
  Filter,
  X,
  ChevronRight
} from 'lucide-react';
import { AdminUserItem } from './adminTypes';
import {
  IOSModalSheet,
  IOSBadge,
  IOSButton
} from './IOSComponents';

interface AdminAffiliateNetworkModalProps {
  affiliate: AdminUserItem | null;
  users: AdminUserItem[];
  isOpen: boolean;
  onClose: () => void;
  onFilterMainTable: (codeOrId: string) => void;
  onOpenBalanceModal: (user: AdminUserItem, wallet?: 'player' | 'affiliate') => void;
}

export const AdminAffiliateNetworkModal: React.FC<AdminAffiliateNetworkModalProps> = ({
  affiliate,
  users,
  isOpen,
  onClose,
  onFilterMainTable,
  onOpenBalanceModal
}) => {
  if (!affiliate) return null;

  const networkPlayers = users.filter((u) => {
    return (
      u.referredBy?.referralCode === affiliate.affiliateInfo?.referralCode ||
      u.referredBy?.affiliateId === affiliate.id
    );
  });

  const totalDeposits = networkPlayers.reduce((acc, u) => acc + (u.totalDeposited || 0), 0);
  const totalBalance = networkPlayers.reduce((acc, u) => acc + (u.balance || 0), 0);

  return (
    <IOSModalSheet
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-3xl"
      title="Rede de Jogadores Indicados"
      subtitle={`Afiliado: ${affiliate.name} • Código: ${affiliate.affiliateInfo?.referralCode || 'N/A'}`}
    >
      <div className="space-y-4">
        {/* Network Metrics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-[#F2F2F7] rounded-xl space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Indicados
            </span>
            <span className="text-base font-bold text-slate-900 font-mono block">
              {networkPlayers.length} jogadores
            </span>
          </div>

          <div className="p-3 bg-[#34C759]/10 rounded-xl space-y-0.5">
            <span className="text-[10px] font-bold text-[#248A3D] uppercase tracking-wider block">
              Depósitos da Rede
            </span>
            <span className="text-base font-bold text-slate-900 font-mono block">
              R$ {totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="p-3 bg-[#AF52DE]/10 rounded-xl space-y-0.5">
            <span className="text-[10px] font-bold text-[#8944AB] uppercase tracking-wider block">
              Comissão Depósitos
            </span>
            <span className="text-base font-bold text-slate-900 font-mono block">
              {(affiliate.affiliateInfo?.revSharePercent ?? 70).toFixed(0)}%
            </span>
          </div>

          <div className="p-3 bg-[#007AFF]/10 rounded-xl space-y-0.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#0062CC] uppercase tracking-wider block">
                Saldo da Carteira
              </span>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBalanceModal(affiliate, 'affiliate');
                }}
                className="text-[10px] font-bold text-[#007AFF] hover:underline cursor-pointer"
                title="Clique para ajustar o saldo desta carteira de afiliado"
              >
                Ajustar
              </button>
            </div>
            <span className="text-base font-bold text-slate-900 font-mono block">
              R$ {(affiliate.affiliateInfo?.affiliateBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Players List */}
        <div className="border border-black/[0.06] rounded-2xl overflow-hidden max-h-[360px] overflow-y-auto">
          {networkPlayers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-semibold">
              Nenhum jogador cadastrado nesta rede até o momento.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2F2F7] text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">Jogador</th>
                  <th className="py-2.5 px-3 text-right">Saldo</th>
                  <th className="py-2.5 px-3 text-right">Depósitos</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {networkPlayers.map((player) => (
                  <tr key={player.id} className="hover:bg-black/[0.015]">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-slate-900 truncate">{player.name}</div>
                      <div className="text-[10px] text-slate-400 truncate">{player.email}</div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      R$ {player.balance.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#34C759]">
                      R$ {(player.totalDeposited || 0).toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <IOSBadge variant={player.isBlocked ? 'red' : 'green'}>
                        {player.isBlocked ? 'Bloqueado' : 'Ativo'}
                      </IOSBadge>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenBalanceModal(player);
                        }}
                        className="px-2 py-1 bg-[#767680]/10 hover:bg-[#767680]/20 text-slate-700 text-[10px] font-bold rounded-md cursor-pointer transition-all"
                      >
                        Gerenciar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between gap-3">
          <IOSButton
            variant="primary"
            size="sm"
            onClick={() => {
              onFilterMainTable(affiliate.affiliateInfo?.referralCode || affiliate.id);
              onClose();
            }}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Filtrar na Tabela Principal</span>
          </IOSButton>

          <IOSButton variant="secondary" size="sm" onClick={onClose}>
            <span>Fechar</span>
          </IOSButton>
        </div>
      </div>
    </IOSModalSheet>
  );
};
