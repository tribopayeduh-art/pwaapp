import React from 'react';
import { Transaction } from '../types';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Gamepad2, BadgeDollarSign } from 'lucide-react';

interface TransactionItemProps {
  transaction: Transaction;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const isDeposit = transaction.type === 'deposit';
  const isCommission = transaction.type === 'commission';

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

  return (
    <div className="flex items-center justify-between py-3 px-3.5 bg-white rounded-xl border border-[#E5E5E5] hover:border-zinc-300 transition-all">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            isDeposit ? 'bg-[#F5F5F5] text-[#111111]' : 'bg-[#F5F5F5] text-[#111111]'
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

        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <h4 className="font-semibold text-xs text-[#111111] leading-tight">
              {isCommission ? 'Comissão recebida' : isDeposit ? 'Depósito via Pix' : 'Saque efetuado'}
            </h4>
            {isFromBlockWin && (
              <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-bold rounded-md flex items-center gap-0.5">
                <Gamepad2 className="w-2.5 h-2.5 text-emerald-600" /> Origem: Block Win
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-[#737373] font-normal">
              {formatDate(transaction.createdAt)}
            </span>
            <span className="text-zinc-300">•</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#737373]">
              <CheckCircle2 className="w-3 h-3 text-[#111111]" />
              {transaction.status === 'approved' ? 'Aprovado' : transaction.status}
            </span>
          </div>
          {isCommission && <p className="mt-1 max-w-[210px] truncate text-[9px] font-medium text-emerald-700">{transaction.description}</p>}
        </div>
      </div>

      <div className="text-right">
        <span
          className={`font-bold text-xs ${
            isDeposit || isCommission ? 'text-green-600' : 'text-[#111111]'
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
