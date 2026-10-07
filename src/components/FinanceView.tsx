import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, AffiliateInfo, InfluencerCommissionRequest } from '../types';
import { TransactionItem } from './TransactionItem';
import { EmptyState } from './EmptyState';
import { Pagination } from './Pagination';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  Percent,
  Clock,
  Search,
  FileText,
  Calendar,
  ChevronRight,
  BarChart2,
  Coins,
  CheckCircle2,
  X,
  AlertTriangle,
  Edit3,
} from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [chartPeriod, setChartPeriod] = useState<'30d' | '15d' | '7d'>('30d');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const PAGE_SIZE = 40;

  // Influencer Commission Requests State
  const [influencerRequests, setInfluencerRequests] = useState<InfluencerCommissionRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [showEditAmount, setShowEditAmount] = useState<Record<string, boolean>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const affiliateBalance = Number(affiliateInfo?.affiliateBalance || 0);
  const consolidatedBalance = user.balance + affiliateBalance;
  const commissionTransactions: Transaction[] = (affiliateInfo?.commissions || []).map((commission) => ({
    id: commission.id,
    userId: user.id,
    type: 'commission',
    amount: commission.amount,
    status: 'approved',
    paymentMethod: commission.gameName || 'Afiliados',
    description: `Comissão de ${commission.buyerName}${commission.gameName ? ` • ${commission.gameName}` : ''}`,
    createdAt: commission.createdAt,
  }));
  const allTransactions = useMemo(
    () => [...transactions, ...commissionTransactions].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [transactions, commissionTransactions]
  );

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const fetchInfluencerRequests = async () => {
    const token =
      localStorage.getItem('pg_auth_token') ||
      localStorage.getItem('paygateway_token') ||
      localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/affiliates/influencer-requests', {
        headers: { Authorization: `Bearer ${token}` },
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
    const req = influencerRequests.find((r) => r.id === requestId);
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

      if (modifiedAmount > affiliateBalance) {
        onShowToast?.(
          `Saldo insuficiente! Seu saldo disponível é de ${formatCurrency(
            affiliateBalance
          )}, insuficiente para liberar ${formatCurrency(modifiedAmount)}.`,
          'error'
        );
        return;
      }
    }

    let rejectReason = '';
    if (action === 'reject') {
      const reason = window.prompt(
        'Informe o motivo da recusa (opcional):',
        'Solicitação recusada pelo afiliado gestor.'
      );
      if (reason === null) return;
      rejectReason = reason;
    }

    setProcessingRequestId(requestId);
    try {
      const token =
        localStorage.getItem('pg_auth_token') ||
        localStorage.getItem('paygateway_token') ||
        localStorage.getItem('token');
      const res = await fetch('/api/affiliates/influencer-request-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          requestId,
          action,
          modifiedAmount,
          rejectReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.(
          data.message || (action === 'approve' ? 'Saque liberado com sucesso!' : 'Saque recusado.'),
          'success'
        );
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

  const periodStart = (() => {
    const now = new Date();
    if (period === 'hoje') return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (period === 'ontem')
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
    return now.getTime() - (period === '7d' ? 7 : 30) * 86400000;
  })();
  const periodEnd = period === 'ontem' ? periodStart + 86400000 : Number.POSITIVE_INFINITY;

  const periodTransactions = useMemo(() => {
    return allTransactions.filter((t) => {
      const timestamp = Date.parse(t.createdAt);
      return timestamp >= periodStart && timestamp < periodEnd;
    });
  }, [allTransactions, periodStart, periodEnd]);

  const filteredTransactions = useMemo(() => {
    return periodTransactions.filter((t) => {
      if (filter === 'deposit' && t.type !== 'deposit') return false;
      if (filter === 'withdrawal' && t.type !== 'withdrawal') return false;
      if (filter === 'commission' && t.type !== 'commission') return false;

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchDesc = (t.description || '').toLowerCase().includes(query);
        const matchId = (t.id || '').toLowerCase().includes(query);
        const matchAmount = (t.amount || 0).toString().includes(query);
        return matchDesc || matchId || matchAmount;
      }
      return true;
    });
  }, [periodTransactions, filter, searchQuery]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, period, searchQuery]);

  // Paginate transactions: 40 items per page
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage, PAGE_SIZE]);

  // Metric sums for the selected period
  const confirmedDepositsList = useMemo(
    () => periodTransactions.filter((tx) => tx.type === 'deposit' && tx.status === 'approved'),
    [periodTransactions]
  );
  const confirmedDepositsSum = useMemo(
    () => confirmedDepositsList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [confirmedDepositsList]
  );

  const paidWithdrawalsList = useMemo(
    () => periodTransactions.filter((tx) => tx.type === 'withdrawal' && tx.status === 'approved'),
    [periodTransactions]
  );
  const paidWithdrawalsSum = useMemo(
    () => paidWithdrawalsList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [paidWithdrawalsList]
  );

  const commissionList = useMemo(
    () => periodTransactions.filter((tx) => tx.type === 'commission'),
    [periodTransactions]
  );
  const commissionsInPeriod = useMemo(
    () => commissionList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [commissionList]
  );

  const pendingList = useMemo(
    () => periodTransactions.filter((tx) => tx.status === 'pending'),
    [periodTransactions]
  );
  const pendingValuesSum = useMemo(
    () => pendingList.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [pendingList]
  );

  const pendingInfluencerRequests = influencerRequests.filter((r) => r.status === 'pending');

  // Chart date baseline points (matching screenshot: 1 ago, 5 ago, 9 ago, 13 ago, 17 ago, 21 ago, 25 ago, 29 ago)
  const chartDays = useMemo(() => {
    return ['1 ago', '5 ago', '9 ago', '13 ago', '17 ago', '21 ago', '25 ago', '29 ago'];
  }, []);

  const hasChartMovement = confirmedDepositsSum > 0 || paidWithdrawalsSum > 0;

  return (
    <div className="finance-view pb-36 px-4 sm:px-6 lg:px-8 xl:px-12 pt-4 sm:pt-6 w-full max-w-[1880px] mx-auto space-y-6">
      {/* Top Header */}
      <div className="w-full">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-zinc-950 tracking-tight">Financeiro</h1>
        <p className="text-xs sm:text-sm text-zinc-500 font-normal mt-0.5">
          Gerencie seus depósitos, saques, aprovações e extrato.
        </p>
      </div>

      {/* Influencer Commission Withdrawal Requests Panel (if any) */}
      {pendingInfluencerRequests.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-amber-500/20">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-2xs">
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
                  className="bg-white p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-zinc-900">{req.influencerName}</span>
                        <span className="text-[9px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-mono">
                          {req.influencerEmail}
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-600">
                        Chave PIX: <strong className="font-mono text-zinc-800 bg-zinc-100 px-1.5 py-0.5 rounded">{req.pixKey}</strong> ({req.pixKeyType || 'PIX'})
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-zinc-500 block font-semibold">Valor Solicitado</span>
                      <span className="text-sm font-black text-emerald-700 font-mono">
                        {formatCurrency(req.amount)}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1">
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowEditAmount((prev) => ({ ...prev, [req.id]: true }));
                          if (!customAmounts[req.id]) {
                            setCustomAmounts((prev) => ({ ...prev, [req.id]: req.amount.toFixed(2) }));
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
                            Ajustar valor a liberar (R$):
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setShowEditAmount((prev) => ({ ...prev, [req.id]: false }));
                              setCustomAmounts((prev) => {
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
                              setCustomAmounts((prev) => ({ ...prev, [req.id]: val }));
                            }}
                            placeholder="0.00"
                            className="w-36 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs font-bold text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {isExceeded && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-start gap-2 text-rose-800">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div className="text-[11px]">
                        <strong className="block font-bold">Saldo Insuficiente!</strong>
                        Seu saldo disponível de comissões é de <strong>{formatCurrency(affiliateBalance)}</strong>, insuficiente para liberar <strong>{formatCurrency(effectiveReleaseAmount)}</strong>.
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <span className="text-[10px] text-zinc-500">
                      Valor a debitar: <strong className={isExceeded ? 'text-rose-600' : 'text-emerald-600'}>{formatCurrency(effectiveReleaseAmount)}</strong>
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
                        <span>{isExceeded ? 'Saldo Insuficiente' : `Aprovar (${formatCurrency(effectiveReleaseAmount)})`}</span>
                      </button>

                      <button
                        type="button"
                        disabled={processingRequestId === req.id}
                        onClick={() => handleProcessInfluencerRequest(req.id, 'reject')}
                        className="px-3 py-2 bg-zinc-100 hover:bg-rose-50 hover:text-rose-700 text-zinc-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1 border border-zinc-200 cursor-pointer disabled:opacity-50"
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

      {/* =========================================================================
          DESKTOP VERSION (Only for computers - hidden on mobile / visible lg:)
         ========================================================================= */}
      <div className="hidden lg:block space-y-6">
        {/* Row 1: Saldo Total Disponível (Left) + Histórico de Transações (Right) */}
        <div className="grid grid-cols-12 gap-6 items-stretch">
          {/* Left Card: Saldo Total Disponível */}
          <div className="col-span-12 lg:col-span-4 bg-white p-5 lg:p-6 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              {/* Filter Pills */}
              <div className="flex items-center gap-1 bg-zinc-100/70 p-1 rounded-xl w-fit">
                {(['hoje', 'ontem', '7d', '30d'] as const).map((p) => {
                  const label = p === 'hoje' ? 'Hoje' : p === 'ontem' ? 'Ontem' : p === '7d' ? '7 dias' : '30 dias';
                  const isActive = period === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        isActive
                          ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                          : 'text-zinc-500 hover:text-zinc-900'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Saldo Total Disponível Label & Value */}
              <div className="mt-5 mb-4">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  SALDO TOTAL DISPONÍVEL
                </span>
                <strong className="text-3xl xl:text-4xl font-black text-zinc-950 tracking-tight tabular-nums block">
                  <AnimatedBalance value={consolidatedBalance} />
                </strong>
              </div>

              {/* Breakdown Cards: Carteira & Comissões */}
              <div className="grid grid-cols-2 gap-3 rounded-2xl bg-zinc-50/70 p-3.5 border border-zinc-100/80">
                <div>
                  <small className="block text-[9px] font-bold uppercase text-zinc-400 tracking-wider">CARTEIRA</small>
                  <strong className="text-sm xl:text-base text-zinc-900 font-extrabold block mt-0.5">
                    {formatCurrency(user.balance)}
                  </strong>
                </div>
                <div>
                  <small className="block text-[9px] font-bold uppercase text-zinc-400 tracking-wider">COMISSÕES DISPONÍVEIS</small>
                  <strong className="text-sm xl:text-base text-zinc-900 font-extrabold block mt-0.5">
                    {formatCurrency(affiliateBalance)}
                  </strong>
                </div>
              </div>

              <p className="mt-3 text-xs font-medium text-zinc-500">
                Comissões no período: <strong className="text-zinc-800 font-bold">{formatCurrency(commissionsInPeriod)}</strong>
              </p>
            </div>

            {/* Bottom Actions: Depositar & Sacar */}
            <div className="grid grid-cols-2 gap-3 mt-5 pt-2">
              <button
                type="button"
                onClick={onDeposit}
                className="w-full py-3 px-4 rounded-xl bg-zinc-950 hover:bg-black text-white font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] shadow-2xs cursor-pointer"
              >
                <ArrowDownRight className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Depositar</span>
              </button>

              <button
                type="button"
                onClick={onWithdraw}
                className="w-full py-3 px-4 rounded-xl bg-zinc-100/80 hover:bg-zinc-200/70 text-zinc-900 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] border border-zinc-200/80 cursor-pointer"
              >
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Sacar</span>
              </button>
            </div>
          </div>

          {/* Right Card: Histórico de Transações */}
          <div className="col-span-12 lg:col-span-8 bg-white p-5 lg:p-6 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between min-h-[300px]">
            <div>
              {/* Header: Title, Search & Filter Pills */}
              <div className="pb-3.5 border-b border-zinc-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700 whitespace-nowrap">
                  HISTÓRICO DE TRANSAÇÕES
                </h2>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar por descrição, ID ou referência..."
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200/80 bg-zinc-50/50 text-xs w-60 xl:w-72 focus:outline-none focus:ring-1 focus:ring-zinc-400 text-zinc-800 placeholder:text-zinc-400"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 bg-zinc-100/70 p-0.5 rounded-xl">
                    {(['all', 'deposit', 'withdrawal', 'commission'] as const).map((f) => {
                      const label = f === 'all' ? 'Todas' : f === 'deposit' ? 'Depósitos' : f === 'withdrawal' ? 'Saques' : 'Comissões';
                      const isActive = filter === f;
                      return (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setFilter(f)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            isActive
                              ? 'bg-white text-zinc-900 shadow-2xs font-bold'
                              : 'text-zinc-500 hover:text-zinc-900'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Transactions List or Empty State */}
              <div className="mt-4">
                {filteredTransactions.length === 0 ? (
                  <div className="py-14 text-center flex flex-col items-center justify-center">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-100/80 flex items-center justify-center mx-auto mb-3 text-zinc-400">
                      <FileText className="w-6 h-6 text-zinc-400" />
                    </div>
                    <strong className="text-sm font-bold text-zinc-800 block mb-1">
                      Nenhuma transação neste período
                    </strong>
                    <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                      Suas movimentações financeiras aparecerão aqui quando forem realizadas.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                    {paginatedTransactions.map((tx) => (
                      <TransactionItem key={tx.id} transaction={tx} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {filteredTransactions.length > PAGE_SIZE && (
              <div className="pt-3 border-t border-zinc-100 mt-2">
                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredTransactions.length}
                  pageSize={PAGE_SIZE}
                  onPageChange={setCurrentPage}
                  itemLabel="transações"
                />
              </div>
            )}
          </div>
        </div>

        {/* Row 2: 4 Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Depósitos confirmados */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ArrowDown className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-zinc-600 block">Depósitos confirmados</span>
              <strong className="text-2xl font-black text-zinc-950 tabular-nums block my-0.5 truncate">
                {formatCurrency(confirmedDepositsSum)}
              </strong>
              <span className="text-[11px] text-zinc-400 block truncate">
                Total de depósitos que entraram na sua conta.
              </span>
            </div>
          </div>

          {/* Card 2: Saques pagos */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <ArrowUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-zinc-600 block">Saques pagos</span>
              <strong className="text-2xl font-black text-zinc-950 tabular-nums block my-0.5 truncate">
                {formatCurrency(paidWithdrawalsSum)}
              </strong>
              <span className="text-[11px] text-zinc-400 block truncate">
                Total de saques enviados para sua conta.
              </span>
            </div>
          </div>

          {/* Card 3: Comissões recebidas */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-zinc-600 block">Comissões recebidas</span>
              <strong className="text-2xl font-black text-zinc-950 tabular-nums block my-0.5 truncate">
                {formatCurrency(commissionsInPeriod)}
              </strong>
              <span className="text-[11px] text-zinc-400 block truncate">
                Total de comissões creditadas.
              </span>
            </div>
          </div>

          {/* Card 4: Valores pendentes */}
          <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-2xs flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-medium text-zinc-600 block">Valores pendentes</span>
              <strong className="text-2xl font-black text-zinc-950 tabular-nums block my-0.5 truncate">
                {formatCurrency(pendingValuesSum)}
              </strong>
              <span className="text-[11px] text-zinc-400 block truncate">
                Depósitos e comissões em processamento.
              </span>
            </div>
          </div>
        </div>

        {/* Row 3: Entradas e saídas (Left) + Resumo financeiro (Right) */}
        <div className="grid grid-cols-12 gap-6 items-stretch">
          {/* Left: Entradas e saídas */}
          <div className="col-span-12 lg:col-span-8 bg-white p-5 lg:p-6 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between min-h-[300px]">
            <div>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3">
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Entradas e saídas</h3>
                  <p className="text-xs text-zinc-400 font-normal mt-0.5">
                    Visualize o volume de depósitos e saques no seu período selecionado.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 bg-white border border-zinc-200/80 rounded-xl px-3 py-1.5 text-xs font-semibold text-zinc-700 shadow-2xs">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <select
                    value={chartPeriod}
                    onChange={(e) => setChartPeriod(e.target.value as any)}
                    className="bg-transparent border-none focus:outline-none cursor-pointer text-xs font-semibold text-zinc-700"
                  >
                    <option value="30d">Últimos 30 dias</option>
                    <option value="15d">Últimos 15 dias</option>
                    <option value="7d">Últimos 7 dias</option>
                  </select>
                </div>
              </div>

              {/* Chart Body */}
              <div className="relative pt-6 pb-2 min-h-[210px] flex flex-col justify-between">
                {/* Y-Axis dashed guide lines */}
                <div className="space-y-6 text-[10px] text-zinc-400 font-mono">
                  {['R$ 1.000', 'R$ 750', 'R$ 500', 'R$ 250', 'R$ 0'].map((label) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-14 text-right shrink-0">{label}</span>
                      <div className="flex-1 border-b border-dashed border-zinc-100" />
                    </div>
                  ))}
                </div>

                {/* Empty State Banner in Middle */}
                {!hasChartMovement && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-100/80 flex items-center justify-center mx-auto mb-2 text-zinc-400">
                      <BarChart2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs text-zinc-400 font-medium">
                      Os dados aparecem quando houver movimentações.
                    </span>
                  </div>
                )}

                {/* Baseline Axis with Dots & Dates */}
                <div className="relative mt-2 pl-16 pr-2">
                  <div className="h-0.5 bg-zinc-200 rounded-full w-full relative flex items-center justify-between">
                    {chartDays.map((dLabel, i) => (
                      <div key={i} className="relative flex flex-col items-center">
                        <span className="w-2 h-2 rounded-full bg-zinc-300 -mt-0.5 border border-white" />
                        <span className="text-[10px] text-zinc-400 font-mono absolute top-2.5 whitespace-nowrap">
                          {dLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Resumo financeiro */}
          <div className="col-span-12 lg:col-span-4 bg-white p-5 lg:p-6 rounded-2xl border border-zinc-200/80 shadow-2xs flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="pb-3 border-b border-zinc-100">
                <h3 className="text-base font-bold text-zinc-900">Resumo financeiro</h3>
                <p className="text-xs text-zinc-400 font-normal mt-0.5">
                  Visão geral das movimentações no período.
                </p>
              </div>

              {/* Rows */}
              <div className="divide-y divide-zinc-100 py-2">
                {/* Row 1: Total de depósitos */}
                <div className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <ArrowDown className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 block leading-tight">Total de depósitos</span>
                      <strong className="text-base font-black text-zinc-900 block mt-1 leading-tight">
                        {formatCurrency(confirmedDepositsSum)}
                      </strong>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-400 font-medium">
                    {confirmedDepositsList.length} transaç{confirmedDepositsList.length === 1 ? 'ão' : 'ões'}
                  </span>
                </div>

                {/* Row 2: Total de saques */}
                <div className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <ArrowUp className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 block leading-tight">Total de saques</span>
                      <strong className="text-base font-black text-zinc-900 block mt-1 leading-tight">
                        {formatCurrency(paidWithdrawalsSum)}
                      </strong>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-400 font-medium">
                    {paidWithdrawalsList.length} transaç{paidWithdrawalsList.length === 1 ? 'ão' : 'ões'}
                  </span>
                </div>

                {/* Row 3: Total de comissões */}
                <div className="py-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <Percent className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 block leading-tight">Total de comissões</span>
                      <strong className="text-base font-black text-zinc-900 block mt-1 leading-tight">
                        {formatCurrency(commissionsInPeriod)}
                      </strong>
                    </div>
                  </div>
                  <span className="text-xs text-zinc-400 font-medium">
                    {commissionList.length} transaç{commissionList.length === 1 ? 'ão' : 'ões'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE VERSION (Maintained for mobile screens < lg:)
         ========================================================================= */}
      <div className="lg:hidden space-y-4">
        {/* Available Balance Overview */}
        <div className="bg-white rounded-[24px] p-4 sm:p-6 border border-[#E5E5E5] shadow-xs space-y-3 sm:space-y-4 transition-all">
          {/* Discreet Period Filter Bar */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <div className="flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-full">
              {(['hoje', 'ontem', '7d', '30d'] as const).map((p) => {
                const label = p === 'hoje' ? 'Hoje' : p === 'ontem' ? 'Ontem' : p === '7d' ? '7 dias' : '30 dias';
                const isActive = period === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPeriod(p)}
                    className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer shrink-0 whitespace-nowrap ${
                      isActive ? 'bg-white text-zinc-900 shadow-xs font-bold' : 'text-zinc-500 hover:text-zinc-800'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="text-[10px] sm:text-[11px] font-semibold text-[#737373] uppercase tracking-wider block mb-1">
              Saldo total disponível
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#111111] tracking-tight truncate max-w-full">
              <AnimatedBalance value={consolidatedBalance} />
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-50 p-2.5 sm:p-3">
              <div className="min-w-0">
                <small className="block text-[8px] sm:text-[9px] font-bold uppercase text-zinc-400 truncate">Carteira</small>
                <strong className="text-[11px] sm:text-xs text-zinc-900 font-extrabold truncate block">
                  {formatCurrency(user.balance)}
                </strong>
              </div>
              <div className="border-l border-zinc-200 pl-2.5 sm:pl-3 min-w-0">
                <small className="block text-[8px] sm:text-[9px] font-bold uppercase text-zinc-400 truncate">Comissões disponíveis</small>
                <strong className="text-[11px] sm:text-xs text-emerald-600 font-extrabold truncate block">
                  {formatCurrency(affiliateBalance)}
                </strong>
              </div>
            </div>
            <p className="mt-2 text-[10px] font-semibold text-zinc-400 truncate">
              Comissões no período: <strong className="text-emerald-600">{formatCurrency(commissionsInPeriod)}</strong>
            </p>
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
              <button
                onClick={() => setFilter('commission')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                  filter === 'commission' ? 'bg-white text-[#111111] shadow-xs font-semibold' : 'text-[#737373]'
                }`}
              >
                Comissões
              </button>
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
    </div>
  );
};
