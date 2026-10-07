import React from 'react';
import { Transaction } from '../types';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  XCircle,
  AlertCircle,
  Gamepad2,
  BadgeDollarSign
} from 'lucide-react';

interface TransactionItemProps {
  transaction: Transaction;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const isDeposit = transaction.type === 'deposit';
  const isCommission = transaction.type === 'commission';
  const isWithdrawal = transaction.type === 'withdrawal';

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();

    const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `Hoje, ${time}`;
    }
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time}`;
  };

  const cleanMethod = (method?: string) => {
    if (!method) return 'Pagamento via Pix';
    const cleaned = method.replace(/\(Dotfy\)/gi, '').trim();
    if (cleaned.toLowerCase().includes('pix')) return 'Pagamento via Pix';
    return cleaned;
  };

  const desc = transaction.description || '';
  const isFromBlockWin = desc.toLowerCase().includes('blockwin') || desc.toLowerCase().includes('block win');

  const statusInfo = (() => {
    const s = (transaction.status || 'pending').toLowerCase();
    if (s === 'approved' || s === 'completed' || s === 'paid') {
      return {
        label: 'Aprovado',
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
        icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" />
      };
    }
    if (s === 'pending' || s === 'processing') {
      return {
        label: 'Pendente',
        color: 'text-amber-700 bg-amber-50 border-amber-200/60',
        icon: <Clock3 className="w-3 h-3 text-amber-600" />
      };
    }
    if (s === 'rejected' || s === 'failed') {
      return {
        label: 'Recusado',
        color: 'text-rose-700 bg-rose-50 border-rose-200/60',
        icon: <XCircle className="w-3 h-3 text-rose-600" />
      };
    }
    return {
      label: 'Cancelado',
      color: 'text-zinc-600 bg-zinc-100 border-zinc-200',
      icon: <AlertCircle className="w-3 h-3 text-zinc-500" />
    };
  })();

  return (
    <div className="flex items-center justify-between py-3 px-3.5 bg-white rounded-xl border border-[#E5E5E5] hover:border-zinc-300 transition-all shadow-2xs">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
            isCommission
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : isDeposit
              ? 'bg-emerald-50/50 border-emerald-100 text-emerald-700'
              : 'bg-zinc-100 border-zinc-200 text-zinc-800'
          }`}
        >
          {isCommission ? (
            <BadgeDollarSign className="w-5 h-5 stroke-[2] text-emerald-600" />
          ) : isDeposit ? (
            <ArrowDownLeft className="w-5 h-5 stroke-[2]" />
          ) : (
            <ArrowUpRight className="w-5 h-5 stroke-[2]" />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-bold text-xs text-[#111111] leading-tight truncate">
              {isCommission ? 'Comissão recebida' : isDeposit ? 'Depósito via Pix' : 'Saque PIX'}
            </h4>
            {isFromBlockWin && (
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-bold rounded-md flex items-center gap-0.5">
                <Gamepad2 className="w-2.5 h-2.5 text-emerald-600" /> Origem: Block Win
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-[10px] text-[#737373] font-normal">
              {formatDate(transaction.createdAt)}
            </span>
            <span className="text-zinc-300">•</span>
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${statusInfo.color}`}>
              {statusInfo.icon}
              <span>{statusInfo.label}</span>
            </span>
          </div>
          {transaction.description && (
            <p className="mt-1 max-w-[280px] sm:max-w-md truncate text-[10px] text-zinc-500 font-medium">
              {transaction.description}
            </p>
          )}
        </div>
      </div>

      <div className="text-right shrink-0 pl-2">
        <span
          className={`font-black text-xs sm:text-sm tabular-nums block ${
            isDeposit || isCommission ? 'text-emerald-600' : 'text-zinc-900'
          }`}
        >
          {isDeposit || isCommission ? '+ ' : '- '}{formatCurrency(transaction.amount)}
        </span>
        <div className="text-[10px] text-[#737373] mt-0.5 uppercase tracking-wider font-medium">
          {cleanMethod(transaction.paymentMethod)}
        </div>
      </div>
    </div>
  );
};
