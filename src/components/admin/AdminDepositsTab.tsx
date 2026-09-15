import React, { useMemo } from 'react';
import {
  CreditCard,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Globe,
  DollarSign
} from 'lucide-react';
import { AdminDepositItem } from './adminTypes';
import {
  IOSCard,
  IOSStatCard,
  IOSSegmentedControl,
  IOSBadge,
  IOSSearchBar
} from './IOSComponents';

interface AdminDepositsTabProps {
  deposits: AdminDepositItem[];
  loading: boolean;
  filter: 'all' | 'approved' | 'pending' | 'failed';
  onFilterChange: (filter: 'all' | 'approved' | 'pending' | 'failed') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const AdminDepositsTab: React.FC<AdminDepositsTabProps> = ({
  deposits,
  loading,
  filter,
  onFilterChange,
  searchQuery,
  onSearchChange
}) => {
  const approvedList = useMemo(() => deposits.filter((d) => d.status === 'approved'), [deposits]);
  const pendingList = useMemo(() => deposits.filter((d) => d.status === 'pending'), [deposits]);
  const failedList = useMemo(() => deposits.filter((d) => d.status === 'failed'), [deposits]);

  const totalVolume = useMemo(() => approvedList.reduce((acc, d) => acc + (d.amount || 0), 0), [approvedList]);
  const avgTicket = useMemo(() => (approvedList.length > 0 ? totalVolume / approvedList.length : 0), [totalVolume, approvedList]);

  const withSponsorVolume = useMemo(
    () => approvedList.filter((d) => !!d.referredBy).reduce((acc, d) => acc + (d.amount || 0), 0),
    [approvedList]
  );
  const organicVolume = useMemo(
    () => approvedList.filter((d) => !d.referredBy).reduce((acc, d) => acc + (d.amount || 0), 0),
    [approvedList]
  );

  const filteredDeposits = useMemo(() => {
    return deposits.filter((d) => {
      if (filter !== 'all' && d.status !== filter) return false;
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        (d.userName || '').toLowerCase().includes(q) ||
        (d.userEmail || '').toLowerCase().includes(q) ||
        (d.userPhone || '').toLowerCase().includes(q) ||
        (d.referredBy?.sponsorName || '').toLowerCase().includes(q) ||
        (d.referredBy?.referralCode || '').toLowerCase().includes(q)
      );
    });
  }, [deposits, filter, searchQuery]);

  const filterOptions = [
    { id: 'all' as const, label: 'Todos', count: deposits.length },
    { id: 'approved' as const, label: 'Aprovados', count: approvedList.length },
    { id: 'pending' as const, label: 'Aguardando', count: pendingList.length },
    { id: 'failed' as const, label: 'Expirados/Falhas', count: failedList.length }
  ];

  return (
    <div className="space-y-5">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <IOSStatCard
          title="Volume de Depósitos"
          value={`R$ ${totalVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${approvedList.length} pagamentos aprovados`}
          icon={TrendingUp}
          iconBgColor="bg-[#34C759]"
          isPositive={true}
        />

        <IOSStatCard
          title="Ticket Médio"
          value={`R$ ${avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Valor médio por depósito PIX"
          icon={CreditCard}
          iconBgColor="bg-[#007AFF]"
        />

        <IOSStatCard
          title="Volume c/ Patrocinador"
          value={`R$ ${withSponsorVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${totalVolume > 0 ? ((withSponsorVolume / totalVolume) * 100).toFixed(0) : 0}% vindo de afiliados`}
          icon={Users}
          iconBgColor="bg-[#AF52DE]"
        />

        <IOSStatCard
          title="Volume Orgânico"
          value={`R$ ${organicVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${totalVolume > 0 ? ((organicVolume / totalVolume) * 100).toFixed(0) : 0}% sem patrocinador`}
          icon={Globe}
          iconBgColor="bg-[#5856D6]"
        />
      </div>

      {/* Filter and Search Bar */}
      <IOSCard className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <IOSSegmentedControl
          options={filterOptions}
          value={filter}
          onChange={onFilterChange}
        />

        <div className="w-full sm:w-64">
          <IOSSearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Buscar por usuário ou código..."
          />
        </div>
      </IOSCard>

      {/* Deposits Inset Grouped Table */}
      <IOSCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold">
            Carregando depósitos...
          </div>
        ) : filteredDeposits.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CreditCard className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-800">Nenhum depósito encontrado</p>
            <p className="text-xs text-slate-400 font-medium">Ajuste os filtros para visualizar outros registros.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2F2F7] text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
                <tr>
                  <th className="py-3 px-4">Usuário</th>
                  <th className="py-3 px-4">Origem / Patrocinador</th>
                  <th className="py-3 px-4 text-right">Valor do Depósito</th>
                  <th className="py-3 px-4 text-center">Método</th>
                  <th className="py-3 px-4">Data & Horário</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filteredDeposits.map((item) => {
                  const isApproved = item.status === 'approved';
                  const isPending = item.status === 'pending';

                  return (
                    <tr key={item.id} className="hover:bg-black/[0.015] transition-colors">
                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-[180px]">
                          <div className="font-bold text-slate-900 truncate">{item.userName || 'Jogador'}</div>
                          <div className="text-[11px] text-slate-400 truncate">{item.userEmail}</div>
                          {item.userPhone && (
                            <div className="text-[10px] font-mono text-slate-400">{item.userPhone}</div>
                          )}
                        </div>
                      </td>

                      {/* Origin */}
                      <td className="py-3.5 px-4 text-slate-500">
                        {item.referredBy ? (
                          <div>
                            <span className="font-semibold text-slate-700 block truncate max-w-[130px]">
                              {item.referredBy.sponsorName}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {item.referredBy.referralCode}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 font-medium">Orgânico</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-[#34C759] whitespace-nowrap">
                        +R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Payment Method */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-black/[0.05] text-slate-700">
                          {item.paymentMethod || 'PIX'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        <div className="text-xs font-medium text-slate-700">
                          {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(item.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {isApproved ? (
                          <IOSBadge variant="green">Aprovado</IOSBadge>
                        ) : isPending ? (
                          <IOSBadge variant="orange">Aguardando PIX</IOSBadge>
                        ) : (
                          <IOSBadge variant="red">Expirado</IOSBadge>
                        )}
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
