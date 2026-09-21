import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, AffiliateInfo, InfluencerCommissionRequest } from '../types';
import { TransactionItem } from './TransactionItem';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import { ArrowDownRight, ArrowUpRight, Filter, Coins, CheckCircle2, X, AlertTriangle, Edit3, Sparkles } from 'lucide-react';
import { AnimatedBalance } from './AnimatedBalance';

interface FinanceViewProps {
  user: User;
  transactions: Transaction[];
  onDeposit: () => void;
  onWithdraw: () => void;
  affiliateInfo?: AffiliateInfo | null;
  onRefresh?: () => void;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

type PeriodFilter = 'hoje' | 'ontem' | '7d' | '30d';

export const FinanceView: React.FC<FinanceViewProps> = ({
  user,
  transactions,
  onDeposit,
  onWithdraw,
  affiliateInfo,
  onRefresh,
  onShowToast,
}) => {
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'commission'>('all');
  const [period, setPeriod] = useState<PeriodFilter>('hoje');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 40;

  // Influencer Commission Requests State
  const [influencerRequests, setInfluencerRequests] = useState<InfluencerCommissionRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [showEditAmount, setShowEditAmount] = useState<Record<string, boolean>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const affiliateBalance = Number(affiliateInfo?.affiliateBalance || 0);
  const consolidatedBalance = user.balance + affiliateBalance;
  const commissionTransactions: Transaction[] = (affiliateInfo?.commissions || []).map((commission) => ({ id: commission.id, userId: user.id, type: 'commission', amount: commission.amount, status: 'approved', paymentMethod: commission.gameName || 'Afiliados', description: `Comissão de ${commission.buyerName}${commission.gameName ? ` • ${commission.gameName}` : ''}`, createdAt: commission.createdAt }));
  const allTransactions = [...transactions, ...commissionTransactions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const fetchInfluencerRequests = async () => {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/affiliates/influencer-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.requests)) {
        setInfluencerRequests(data.requests);
      }
    } catch (e) {
      console.error('Error fetching influencer requests in FinanceView', e);
    }
  };

  useEffect(() => {
    fetchInfluencerRequests();
  }, []);

  const handleProcessInfluencerRequest = async (requestId: string, action: 'approve' | 'reject') => {
    const req = influencerRequests.find(r => r.id === requestId);
    if (!req) return;

    let modifiedAmount: number | undefined = undefined;

    if (action === 'approve') {
      const customValStr = customAmounts[requestId];
      if (customValStr !== undefined && customValStr.trim() !== '') {
        const parsed = parseFloat(customValStr.replace(',', '.'));
        if (isNaN(parsed) || parsed <= 0) {
          onShowToast?.('Informe um valor válido maior que zero para liberação.', 'error');
          return;
        }
        modifiedAmount = parsed;
      } else {
        modifiedAmount = req.amount;
      }

      // CRITICAL CHECK: "LEMBRANDO O VALOR NUNCA PODE PASSAR DO VALOR QUE O AFILIADO TEM DISPONIVEL SE NÃO A APROVAÇÃO NÃO VAI DAR CERTO VAI INFORMAR SALDO INSUFICIENTE!"
      if (modifiedAmount > affiliateBalance) {
        onShowToast?.(
          `Saldo insuficiente! Seu saldo disponível é de ${formatCurrency(affiliateBalance)}, insuficiente para liberar ${formatCurrency(modifiedAmount)}.`,
          'error'
        );
        return;
      }
    }

    let rejectReason = '';
    if (action === 'reject') {
      const reason = window.prompt('Informe o motivo da recusa (opcional):', 'Solicitação recusada pelo afiliado gestor.');
      if (reason === null) return;
      rejectReason = reason;
    }

    setProcessingRequestId(requestId);
    try {
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
      const res = await fetch('/api/affiliates/influencer-request-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          requestId,
          action,
          modifiedAmount,
          rejectReason
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.(data.message || (action === 'approve' ? 'Saque liberado com sucesso!' : 'Saque recusado.'), 'success');
        await fetchInfluencerRequests();
        if (onRefresh) onRefresh();
      } else {
        onShowToast?.(data.error || 'Erro ao processar solicitação.', 'error');
      }
    } catch (err) {
      onShowToast?.('Erro de conexão ao processar solicitação.', 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const periodStart = (() => { const now = new Date(); if (period === 'hoje') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); if (period === 'ontem') return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime(); return now.getTime() - (period === '7d' ? 7 : 30) * 86400000; })();
  const periodEnd = period === 'ontem' ? periodStart + 86400000 : Number.POSITIVE_INFINITY;
  const periodTransactions = allTransactions.filter((t) => {
    const timestamp = Date.parse(t.createdAt);
    return timestamp >= periodStart && timestamp < periodEnd;
  });
  const filteredTransactions = periodTransactions.filter((t) => {
    if (filter === 'deposit') return t.type === 'deposit';
    if (filter === 'withdrawal') return t.type === 'withdrawal';
    if (filter === 'commission') return t.type === 'commission';
    return true;
  });

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, period]);

  // Paginate transactions: 40 items per page
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage, PAGE_SIZE]);

  const commissionsInPeriod = periodTransactions.filter((tx) => tx.type === 'commission').reduce((sum, tx) => sum + tx.amount, 0);

  const pendingInfluencerRequests = influencerRequests.filter(r => r.status === 'pending');

  return (
    <div className="finance-view space-y-6 pb-24 px-4 pt-4">
      <div>
        <h1 className="text-lg font-bold text-[#111111] tracking-tight">Financeiro</h1>
        <p className="text-xs text-[#737373]">Gerencie seus depósitos, saques, aprovações e extrato.</p>
      </div>

      {/* Available Balance Overview */}
      <div className="bg-white rounded-[24px] p-4 sm:p-6 border border-[#E5E5E5] shadow-xs space-y-3 sm:space-y-4 transition-all">
        {/* Discreet Period Filter Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setPeriod('hoje')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                period === 'hoje'
                  ? 'bg-white text-zinc-900 shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => setPeriod('ontem')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                period === 'ontem'
                  ? 'bg-white text-zinc-900 shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              Ontem
            </button>
            <button
              type="button"
              onClick={() => setPeriod('7d')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                period === '7d'
                  ? 'bg-white text-zinc-900 shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              7 dias
            </button>
            <button
              type="button"
              onClick={() => setPeriod('30d')}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                period === '30d'
                  ? 'bg-white text-zinc-900 shadow-xs font-bold'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              30 dias
            </button>
          </div>
        </div>

        <div>
          <span className="text-[10px] sm:text-[11px] font-semibold text-[#737373] uppercase tracking-wider block mb-1">
            Saldo total disponível
          </span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#111111] tracking-tight truncate max-w-full">
            <AnimatedBalance value={consolidatedBalance} />
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-50 p-2.5 sm:p-3">
            <div className="min-w-0">
              <small className="block text-[8px] sm:text-[9px] font-bold uppercase text-zinc-400 truncate">Carteira</small>
              <strong className="text-[11px] sm:text-xs text-zinc-900 font-extrabold truncate block">{formatCurrency(user.balance)}</strong>
            </div>
            <div className="border-l border-zinc-200 pl-2.5 sm:pl-3 min-w-0">
              <small className="block text-[8px] sm:text-[9px] font-bold uppercase text-zinc-400 truncate">Comissões disponíveis</small>
              <strong className="text-[11px] sm:text-xs text-emerald-600 font-extrabold truncate block">{formatCurrency(affiliateBalance)}</strong>
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-zinc-400 truncate">Comissões no período: <strong className="text-emerald-600">{formatCurrency(commissionsInPeriod)}</strong></p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1 sm:pt-2">
          <button
            onClick={onDeposit}
            className="flex items-center justify-center gap-1.5 sm:gap-2 h-11 sm:h-12 rounded-xl bg-[#111111] text-white font-semibold sm:font-bold text-xs hover:bg-black transition-colors cursor-pointer active:scale-[0.98]"
          >
            <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
            <span>Depositar</span>
          </button>

          <button
            onClick={onWithdraw}
            className="flex items-center justify-center gap-1.5 sm:gap-2 h-11 sm:h-12 rounded-xl bg-[#F5F5F5] text-[#111111] font-semibold sm:font-bold text-xs hover:bg-[#ECECEC] transition-colors border border-[#E5E5E5] cursor-pointer active:scale-[0.98]"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            <span>Sacar</span>
          </button>
        </div>
      </div>

      {/* Influencer Commission Withdrawal Requests (Approval Panel in Finance Area) */}
      {pendingInfluencerRequests.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-[24px] p-5 space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                  <span>Aprovação de Saque de Comissões dos Influenciadores</span>
                  <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                    {pendingInfluencerRequests.length} pendente{pendingInfluencerRequests.length > 1 ? 's' : ''}
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-600">
                  Influenciadores sob sua gestão solicitaram resgate de comissões. Você pode aprovar, trocar o valor a liberar ou recusar.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-semibold text-zinc-500 block">Seu Saldo Disponível de Comissões</span>
              <span className="text-xs font-black text-emerald-700 font-mono">
                {formatCurrency(affiliateBalance)}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {pendingInfluencerRequests.map((req) => {
              const customValStr = customAmounts[req.id];
              const isCustomSet = customValStr !== undefined && customValStr.trim() !== '';
              const customNum = isCustomSet ? parseFloat(customValStr.replace(',', '.')) : req.amount;
              const effectiveReleaseAmount = !isNaN(customNum) && customNum > 0 ? customNum : req.amount;
              const isExceeded = effectiveReleaseAmount > affiliateBalance;
              const isEditing = showEditAmount[req.id] ?? false;

              return (
                <div
                  key={req.id}
                  className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs space-y-3"
                >
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-zinc-900">{req.influencerName}</span>
                        <span className="text-[9px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-mono">
                          {req.influencerEmail}
                        </span>
                        {req.gameOrigin === 'g_gen_dino' && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md flex items-center gap-1">
                            🦖 GEN DINO
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-600 flex items-center gap-2 flex-wrap">
                        <span>Chave PIX: <strong className="font-mono text-zinc-800 bg-zinc-100 px-1.5 py-0.5 rounded">{req.pixKey}</strong> ({req.pixKeyType || 'PIX'})</span>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-zinc-500 block font-semibold">Valor Solicitado Inicial</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">
                        {formatCurrency(req.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Influencer Metrics Snapshot */}
                  <div className="grid grid-cols-3 gap-2 bg-zinc-50 p-2.5 rounded-xl border border-zinc-150 text-center">
                    <div>
                      <small className="block text-[9px] font-bold text-zinc-400 uppercase tracking-tight">Depósitos Trazidos</small>
                      <strong className="text-[11px] text-zinc-800 font-mono">
                        {formatCurrency(req.totalDepositsBrought || 0)}
                      </strong>
                    </div>
                    <div className="border-x border-zinc-200 px-1">
                      <small className="block text-[9px] font-bold text-zinc-400 uppercase tracking-tight">Depósitos Pagos</small>
                      <strong className="text-[11px] text-emerald-600 font-mono">
                        {req.paidDepositsCount || 0} ({formatCurrency(req.paidDepositsAmount || 0)})
                      </strong>
                    </div>
                    <div>
                      <small className="block text-[9px] font-bold text-zinc-400 uppercase tracking-tight">Qtd Indicados</small>
                      <strong className="text-[11px] text-zinc-800 font-mono">
                        {req.referralsCount || 0} jogador{(req.referralsCount || 0) !== 1 ? 'es' : ''}
                      </strong>
                    </div>
                  </div>

                  {/* Change Value Section */}
                  <div className="pt-1">
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditAmount(prev => ({ ...prev, [req.id]: true }));
                          if (!customAmounts[req.id]) {
                            setCustomAmounts(prev => ({ ...prev, [req.id]: req.amount.toFixed(2) }));
                          }
                        }}
                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-amber-200/60"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Trocar o valor que vai liberar para o influenciador</span>
                      </button>
                    ) : (
                      <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-amber-950 flex items-center gap-1">
                            <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                            Ajustar valor a liberar para o influenciador (R$):
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowEditAmount(prev => ({ ...prev, [req.id]: false }));
                              setCustomAmounts(prev => {
                                const copy = { ...prev };
                                delete copy[req.id];
                                return copy;
                              });
                            }}
                            className="text-[10px] text-zinc-500 hover:text-zinc-800 underline cursor-pointer"
                          >
                            Restaurar valor original
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-500">R$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            max={affiliateBalance}
                            value={customAmounts[req.id] ?? req.amount}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCustomAmounts(prev => ({ ...prev, [req.id]: val }));
                            }}
                            placeholder="0.00"
                            className="w-36 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <span className="text-[10px] text-zinc-500">
                            (Seu saldo disponível: <strong className="text-emerald-700">{formatCurrency(affiliateBalance)}</strong>)
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Strict Balance Check Warning */}
                  {isExceeded && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2 text-rose-800">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-[11px]">
                        <strong className="block font-bold">Saldo Insuficiente!</strong>
                        Seu saldo disponível de comissões é de <strong>{formatCurrency(affiliateBalance)}</strong>, insuficiente para liberar <strong>{formatCurrency(effectiveReleaseAmount)}</strong>. A aprovação não pode ser realizada.
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <span className="text-[10px] text-zinc-500">
                      Valor a debitar das suas comissões: <strong className={isExceeded ? 'text-rose-600' : 'text-emerald-600'}>{formatCurrency(effectiveReleaseAmount)}</strong>
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={processingRequestId === req.id || isExceeded}
                        onClick={() => handleProcessInfluencerRequest(req.id, 'approve')}
                        className={`px-3.5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                          isExceeded
                            ? 'bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{isExceeded ? 'Saldo Insuficiente' : `Aprovar e Liberar (${formatCurrency(effectiveReleaseAmount)})`}</span>
                      </button>

                      <button
                        type="button"
                        disabled={processingRequestId === req.id}
                        onClick={() => handleProcessInfluencerRequest(req.id, 'reject')}
                        className="px-3 py-2 bg-zinc-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-zinc-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 border border-zinc-200 cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-4 h-4" />
                        <span>Recusar</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transactions History Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-xs uppercase tracking-wider text-[#737373]">
            Histórico de transações
          </h3>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-[#F5F5F5] p-1 rounded-xl border border-[#E5E5E5]">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                filter === 'all' ? 'bg-white text-[#111111] shadow-xs font-semibold' : 'text-[#737373]'
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter('deposit')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                filter === 'deposit' ? 'bg-white text-[#111111] shadow-xs font-semibold' : 'text-[#737373]'
              }`}
            >
              Depósitos
            </button>
            <button
              onClick={() => setFilter('withdrawal')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                filter === 'withdrawal' ? 'bg-white text-[#111111] shadow-xs font-semibold' : 'text-[#737373]'
              }`}
            >
              Saques
            </button>
            <button onClick={() => setFilter('commission')} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${filter === 'commission' ? 'bg-white text-[#111111] shadow-xs font-semibold' : 'text-[#737373]'}`}>Comissões</button>
          </div>
        </div>

        {/* List */}
        {filteredTransactions.length === 0 ? (
          <EmptyState
            message={
              filter === 'all'
                ? 'Você ainda não possui movimentações no seu histórico.'
                : 'Nenhuma transação encontrada para este filtro.'
            }
          />
        ) : (
          <>
            <div className="space-y-2">
              {paginatedTransactions.map((tx) => (
                <TransactionItem key={tx.id} transaction={tx} />
              ))}
            </div>

            {/* 40 per page Pagination */}
            <Pagination
              currentPage={currentPage}
              totalItems={filteredTransactions.length}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              itemLabel="transações"
              className="mt-3"
            />
          </>
        )}
      </div>
    </div>
  );
};
