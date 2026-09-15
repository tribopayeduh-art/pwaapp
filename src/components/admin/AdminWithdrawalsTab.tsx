import React, { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  AlertCircle,
  DollarSign,
  Clock,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Calendar
} from 'lucide-react';
import { AdminWithdrawalItem } from './adminTypes';
import {
  IOSCard,
  IOSStatCard,
  IOSSegmentedControl,
  IOSBadge,
  IOSButton
} from './IOSComponents';

interface AdminWithdrawalsTabProps {
  withdrawals: AdminWithdrawalItem[];
  loading: boolean;
  filter: 'all' | 'pending' | 'approved' | 'rejected';
  onFilterChange: (filter: 'all' | 'pending' | 'approved' | 'rejected') => void;
  processingId: string | null;
  onApproveWithdrawal: (id: string) => Promise<void>;
  onRejectWithdrawal: (id: string) => Promise<void>;
  onCopyText: (text: string, label?: string) => void;
  copiedText: string | null;
}

export const AdminWithdrawalsTab: React.FC<AdminWithdrawalsTabProps> = ({
  withdrawals,
  loading,
  filter,
  onFilterChange,
  processingId,
  onApproveWithdrawal,
  onRejectWithdrawal,
  onCopyText,
  copiedText
}) => {
  const [approvingAll, setApprovingAll] = useState(false);

  // Computed metrics
  const pendingList = useMemo(() => withdrawals.filter((w) => w.status === 'pending'), [withdrawals]);
  const approvedList = useMemo(() => withdrawals.filter((w) => w.status === 'approved'), [withdrawals]);
  const rejectedList = useMemo(() => withdrawals.filter((w) => w.status === 'rejected'), [withdrawals]);

  const pendingTotal = useMemo(() => pendingList.reduce((acc, w) => acc + (w.amount || 0), 0), [pendingList]);
  const approvedTotal = useMemo(() => approvedList.reduce((acc, w) => acc + (w.amount || 0), 0), [approvedList]);

  // Filtered withdrawals
  const filteredWithdrawals = useMemo(() => {
    if (filter === 'all') return withdrawals;
    return withdrawals.filter((w) => w.status === filter);
  }, [withdrawals, filter]);

  // Handle batch approve all pending
  const handleApproveAllPending = async () => {
    if (pendingList.length === 0) return;
    const confirm = window.confirm(
      `Deseja aprovar todos os ${pendingList.length} saques pendentes (Total: R$ ${pendingTotal.toFixed(2)})?`
    );
    if (!confirm) return;

    setApprovingAll(true);
    try {
      for (const w of pendingList) {
        await onApproveWithdrawal(w.id);
      }
    } finally {
      setApprovingAll(false);
    }
  };

  const filterOptions = [
    { id: 'pending' as const, label: 'Pendentes', count: pendingList.length },
    { id: 'approved' as const, label: 'Aprovados', count: approvedList.length },
    { id: 'rejected' as const, label: 'Rejeitados', count: rejectedList.length },
    { id: 'all' as const, label: 'Todos', count: withdrawals.length }
  ];

  return (
    <div className="space-y-5">
      {/* Top 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <IOSStatCard
          title="Saques Pendentes"
          value={`R$ ${pendingTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${pendingList.length} solicitações aguardando liberação`}
          icon={Clock}
          iconBgColor="bg-[#FF9500]"
          change={pendingList.length > 0 ? `${pendingList.length} pendentes` : undefined}
          isPositive={false}
        />

        <IOSStatCard
          title="Saques Aprovados"
          value={`R$ ${approvedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${approvedList.length} pagamentos realizados`}
          icon={CheckCircle2}
          iconBgColor="bg-[#34C759]"
          isPositive={true}
        />

        <IOSStatCard
          title="Total de Solicitações"
          value={withdrawals.length}
          subtitle={`Histórico completo de pedidos de saque`}
          icon={ArrowUpRight}
          iconBgColor="bg-[#007AFF]"
        />
      </div>

      {/* Action & Filter Bar */}
      <IOSCard className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <IOSSegmentedControl
          options={filterOptions}
          value={filter}
          onChange={onFilterChange}
        />

        {pendingList.length > 0 && (
          <IOSButton
            variant="success"
            disabled={approvingAll}
            onClick={handleApproveAllPending}
          >
            {approvingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Aprovar Todos os Pendentes ({pendingList.length})</span>
          </IOSButton>
        )}
      </IOSCard>

      {/* Withdrawals Inset Grouped Table */}
      <IOSCard className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold">
            Carregando saques...
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckCircle2 className="w-10 h-10 text-[#34C759]/60 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              {filter === 'pending'
                ? 'Nenhum saque pendente no momento!'
                : 'Nenhum registro encontrado nesta categoria.'}
            </p>
            <p className="text-xs text-slate-400 font-medium">
              Todos os pedidos de saque foram processados com sucesso.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2F2F7] text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
                <tr>
                  <th className="py-3 px-4">Solicitante</th>
                  <th className="py-3 px-4">Origem</th>
                  <th className="py-3 px-4 text-right">Valor do Saque</th>
                  <th className="py-3 px-4">Chave PIX</th>
                  <th className="py-3 px-4">Data & Horário</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {filteredWithdrawals.map((item) => {
                  const isPending = item.status === 'pending';
                  const isApproved = item.status === 'approved';
                  const isRejected = item.status === 'rejected';
                  const isBusy = processingId === item.id;
                  const pixKeyVal =
                    typeof item.pixKey === 'string'
                      ? item.pixKey
                      : item.pixKey?.key || item.pixKey?.pixKey || 'Não informada';
                  const pixKeyType = item.pixKey?.type || 'PIX';

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
                            <span className="font-semibold text-slate-700 block truncate max-w-[120px]">
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
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-sm text-slate-900 whitespace-nowrap">
                        R$ {item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* PIX Key */}
                      <td className="py-3.5 px-4">
                        <div className="min-w-[180px] space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/[0.05] text-slate-600">
                              {pixKeyType}
                            </span>
                            <button
                              type="button"
                              onClick={() => onCopyText(pixKeyVal, 'Chave PIX')}
                              className="inline-flex items-center gap-1 text-xs font-mono font-semibold text-[#007AFF] hover:underline cursor-pointer"
                              title="Copiar chave PIX"
                            >
                              {copiedText === pixKeyVal ? (
                                <Check className="w-3 h-3 text-[#34C759]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                              <span className="truncate max-w-[130px]">{pixKeyVal}</span>
                            </button>
                          </div>
                        </div>
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
                        {isPending ? (
                          <IOSBadge variant="orange">Pendente</IOSBadge>
                        ) : isApproved ? (
                          <IOSBadge variant="green">Aprovado</IOSBadge>
                        ) : (
                          <IOSBadge variant="red">Rejeitado</IOSBadge>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-center">
                        {isPending ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onApproveWithdrawal(item.id)}
                              className="h-7 px-2.5 rounded-lg bg-[#34C759] hover:bg-[#28A745] text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer active:scale-[0.98] transition-all disabled:opacity-40"
                              title="Aprovar PIX"
                            >
                              {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              <span>Aprovar</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onRejectWithdrawal(item.id)}
                              className="h-7 px-2 rounded-lg bg-[#FF3B30]/12 hover:bg-[#FF3B30]/20 text-[#FF3B30] font-bold text-xs flex items-center gap-1 cursor-pointer active:scale-[0.98] transition-all disabled:opacity-40"
                              title="Rejeitar e Devolver Saldo"
                            >
                              <XCircle className="w-3 h-3" />
                              <span>Rejeitar</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-medium">—</span>
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
