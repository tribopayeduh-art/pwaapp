import React, { useState } from 'react';
import { User, Transaction, AffiliateInfo } from '../types';
import { TransactionItem } from './TransactionItem';
import { EmptyState } from './EmptyState';
import { ArrowDownRight, ArrowUpRight, Filter } from 'lucide-react';
import { AnimatedBalance } from './AnimatedBalance';

interface FinanceViewProps {
  user: User;
  transactions: Transaction[];
  onDeposit: () => void;
  onWithdraw: () => void;
  affiliateInfo?: AffiliateInfo | null;
}

type PeriodFilter = 'hoje' | 'ontem' | '7d' | '30d';

export const FinanceView: React.FC<FinanceViewProps> = ({
  user,
  transactions,
  onDeposit,
  onWithdraw,
  affiliateInfo,
}) => {
  const [filter, setFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'commission'>('all');
  const [period, setPeriod] = useState<PeriodFilter>('hoje');

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
  const commissionsInPeriod = periodTransactions.filter((tx) => tx.type === 'commission').reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="finance-view space-y-6 pb-24 px-4 pt-4">
      <div>
        <h1 className="text-lg font-bold text-[#111111] tracking-tight">Financeiro</h1>
        <p className="text-xs text-[#737373]">Gerencie seus depósitos, saques e extrato.</p>
      </div>

      {/* Available Balance Overview */}
      <div className="bg-white rounded-[24px] p-6 border border-[#E5E5E5] shadow-xs space-y-4">
        {/* Discreet Period Filter Bar */}
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPeriod('hoje')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
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
              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all cursor-pointer ${
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
          <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider block mb-1">
            Saldo total disponível
          </span>
          <h2 className="text-3xl font-extrabold text-[#111111] tracking-tight">
            <AnimatedBalance value={consolidatedBalance} />
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-50 p-3"><div><small className="block text-[9px] font-bold uppercase text-zinc-400">Carteira</small><strong className="text-xs text-zinc-900">{formatCurrency(user.balance)}</strong></div><div className="border-l border-zinc-200 pl-3"><small className="block text-[9px] font-bold uppercase text-zinc-400">Comissões disponíveis</small><strong className="text-xs text-emerald-600">{formatCurrency(affiliateBalance)}</strong></div></div>
          <p className="mt-2 text-[10px] font-semibold text-zinc-400">Comissões no período: <strong className="text-emerald-600">{formatCurrency(commissionsInPeriod)}</strong></p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            onClick={onDeposit}
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-[#111111] text-white font-medium text-xs hover:bg-black transition-colors cursor-pointer active:scale-[0.98]"
          >
            <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
            Depositar
          </button>

          <button
            onClick={onWithdraw}
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-[#F5F5F5] text-[#111111] font-medium text-xs hover:bg-[#ECECEC] transition-colors border border-[#E5E5E5] cursor-pointer active:scale-[0.98]"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            Sacar
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
          <div className="space-y-2">
            {filteredTransactions.map((tx) => (
              <TransactionItem key={tx.id} transaction={tx} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
