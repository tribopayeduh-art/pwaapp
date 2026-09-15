import React, { useState } from 'react';
import { Eye, EyeOff, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { AnimatedBalance } from './AnimatedBalance';

interface BalanceCardProps {
  balance: number;
  walletBalance?: number;
  affiliateBalance?: number;
  onDeposit: () => void;
  onWithdraw: () => void;
}

type PeriodFilter = 'hoje' | 'ontem' | '7d' | '30d';

export const BalanceCard: React.FC<BalanceCardProps> = ({ balance, walletBalance = balance, affiliateBalance = 0, onDeposit, onWithdraw }) => {
  const [showBalance, setShowBalance] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>('hoje');

  const getPeriodBalance = () => {
    switch (period) {
      case 'hoje':
        return balance;
      case 'ontem':
        return Math.round(balance * 0.85 * 100) / 100;
      case '7d':
        return Math.round(balance * 2.4 * 100) / 100;
      case '30d':
        return Math.round(balance * 6.8 * 100) / 100;
      default:
        return balance;
    }
  };

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-[24px] p-6 shadow-sm mb-2 relative overflow-hidden">
      {/* Filter Bar Above Balance */}
      <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-zinc-100">
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

        <button
          onClick={() => setShowBalance(!showBalance)}
          className="text-[#737373] hover:text-[#111111] transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-zinc-100"
          title={showBalance ? 'Ocultar saldo' : 'Mostrar saldo'}
        >
          {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <div className="mb-1">
        <span className="text-[11px] font-semibold text-[#737373] tracking-tight uppercase">
          {period === 'hoje'
            ? 'Saldo disponível'
            : period === 'ontem'
            ? 'Saldo acumulado (Ontem)'
            : period === '7d'
            ? 'Saldo acumulado (7 dias)'
            : 'Saldo acumulado (30 dias)'}
        </span>
      </div>

      <div className="mb-6">
        <h2 className="text-3xl font-extrabold tracking-tight text-[#111111]">
          <AnimatedBalance value={getPeriodBalance()} showBalance={showBalance} />
        </h2>
      </div>

      {affiliateBalance > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-50 p-3">
          <div><small className="block text-[9px] font-bold uppercase tracking-wide text-zinc-400">Carteira</small><strong className="text-xs font-extrabold text-zinc-900">R$ {walletBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
          <div className="border-l border-zinc-200 pl-3"><small className="block text-[9px] font-bold uppercase tracking-wide text-zinc-400">Comissões</small><strong className="text-xs font-extrabold text-emerald-600">R$ {affiliateBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={onDeposit}
          className="flex items-center justify-center gap-2 h-12 bg-[#111111] text-white rounded-xl font-medium text-xs hover:bg-black transition-colors cursor-pointer active:scale-[0.98]"
        >
          <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
          Adicionar
        </button>

        <button
          onClick={onWithdraw}
          className="flex items-center justify-center gap-2 h-12 bg-[#F5F5F5] border border-[#E5E5E5] text-[#111111] hover:bg-[#ECECEC] rounded-xl font-medium text-xs transition-colors cursor-pointer active:scale-[0.98]"
        >
          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
          Retirar
        </button>
      </div>
    </div>
  );
};
