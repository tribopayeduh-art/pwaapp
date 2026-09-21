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
    <div className="bg-white border border-[#E5E5E5] rounded-[24px] p-4 sm:p-6 shadow-sm mb-2 relative overflow-hidden transition-all">
      {/* Responsive Filter Bar Above Balance */}
      <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4 pb-3 border-b border-zinc-100">
        <div className="flex items-center gap-1 bg-zinc-100/80 p-1 rounded-xl overflow-x-auto no-scrollbar max-w-[calc(100%-38px)]">
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

        <button
          onClick={() => setShowBalance(!showBalance)}
          className="text-[#737373] hover:text-[#111111] transition-colors cursor-pointer p-1.5 rounded-lg hover:bg-zinc-100 shrink-0"
          title={showBalance ? 'Ocultar saldo' : 'Mostrar saldo'}
        >
          {showBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>

      <div className="mb-1">
        <span className="text-[10px] sm:text-[11px] font-semibold text-[#737373] tracking-tight uppercase">
          {period === 'hoje'
            ? 'Saldo disponível'
            : period === 'ontem'
            ? 'Saldo acumulado (Ontem)'
            : period === '7d'
            ? 'Saldo acumulado (7 dias)'
            : 'Saldo acumulado (30 dias)'}
        </span>
      </div>

      <div className="mb-4 sm:mb-6 min-w-0">
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#111111] truncate max-w-full">
          <AnimatedBalance value={getPeriodBalance()} showBalance={showBalance} />
        </h2>
      </div>

      {affiliateBalance > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-zinc-50 p-2.5 sm:p-3">
          <div className="min-w-0">
            <small className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-wide text-zinc-400 truncate">Carteira</small>
            <strong className="text-[11px] sm:text-xs font-extrabold text-zinc-900 truncate block">
              R$ {walletBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
          <div className="border-l border-zinc-200 pl-2.5 sm:pl-3 min-w-0">
            <small className="block text-[8px] sm:text-[9px] font-bold uppercase tracking-wide text-zinc-400 truncate">Comissões</small>
            <strong className="text-[11px] sm:text-xs font-extrabold text-emerald-600 truncate block">
              R$ {affiliateBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1 sm:pt-2">
        <button
          onClick={onDeposit}
          className="flex items-center justify-center gap-1.5 sm:gap-2 h-11 sm:h-12 bg-[#111111] text-white rounded-xl font-semibold sm:font-bold text-xs hover:bg-black transition-colors cursor-pointer active:scale-[0.98]"
        >
          <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
          <span>Adicionar</span>
        </button>

        <button
          onClick={onWithdraw}
          className="flex items-center justify-center gap-1.5 sm:gap-2 h-11 sm:h-12 bg-[#F5F5F5] border border-[#E5E5E5] text-[#111111] hover:bg-[#ECECEC] rounded-xl font-semibold sm:font-bold text-xs transition-colors cursor-pointer active:scale-[0.98]"
        >
          <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
          <span>Retirar</span>
        </button>
      </div>
    </div>
  );
};
