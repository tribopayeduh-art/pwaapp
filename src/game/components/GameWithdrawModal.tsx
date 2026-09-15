import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Loader2, ArrowUpRight } from 'lucide-react';

interface GameWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmWithdraw: (amount: number, pixKey: string) => Promise<void>;
  userBalance: number;
  minWithdraw?: number;
  loading: boolean;
}

export const GameWithdrawModal: React.FC<GameWithdrawModalProps> = ({
  isOpen,
  onClose,
  onConfirmWithdraw,
  userBalance,
  minWithdraw = 100,
  loading,
}) => {
  const [amount, setAmount] = useState<string>('');
  const [pixKey, setPixKey] = useState<string>('');
  const [cpf, setCpf] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAmount('');
      setPixKey('');
      setCpf('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelectAllBalance = () => {
    if (userBalance > 0) {
      setAmount(userBalance.toFixed(2));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amount.replace(',', '.'));
    const limit = minWithdraw ?? 100;
    if (isNaN(val) || val < limit) {
      setError(`O valor mínimo para saque é de R$ ${limit.toFixed(2).replace('.', ',')}.`);
      return;
    }

    if (val > userBalance) {
      setError('Saldo insuficiente para realizar este saque.');
      return;
    }

    if (!pixKey.trim()) {
      setError('Por favor, informe a chave PIX.');
      return;
    }

    if (!cpf.trim()) {
      setError('Por favor, informe o CPF do titular.');
      return;
    }

    try {
      await onConfirmWithdraw(val, pixKey.trim());
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao processar solicitação de saque.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#070D1E] border border-[#1A284D] rounded-t-[32px] sm:rounded-[32px] p-4 sm:p-5 shadow-2xl text-white space-y-4 max-h-[95vh] overflow-y-auto no-scrollbar transform transition-all animate-in slide-in-from-bottom duration-300 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between pb-2 border-b border-[#182955]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <ArrowUpRight className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black font-mono uppercase tracking-wider text-white">
                Solicitar Saque
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Receba via PIX instantâneo
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#14234C] hover:bg-[#1A2D62] text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-cyan-500/30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-950/50 border border-rose-500/50 text-rose-300 rounded-2xl text-xs font-mono font-bold flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* SALDO DISPONÍVEL */}
          <div className="bg-[#0B1428] border border-[#182955] rounded-2xl p-3.5 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00E676]/20 border border-[#00E676]/40 flex items-center justify-center text-[#00E676] font-black font-mono text-sm shrink-0">
                R$
              </div>
              <div>
                <span className="text-[10px] sm:text-xs font-bold font-mono text-slate-400 uppercase tracking-wider block">
                  Saldo Disponível
                </span>
                <span className="text-lg sm:text-xl font-black font-mono text-white tracking-tight">
                  R$ {userBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSelectAllBalance}
              className="text-[10px] font-bold font-mono text-cyan-300 bg-[#14234C] hover:bg-cyan-500 hover:text-black border border-cyan-500/40 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
            >
              Tudo
            </button>
          </div>

          {/* INPUT 1: Valor (Mínimo R$ 30,00) */}
          <div className="bg-[#0B1428] border border-[#182955] focus-within:border-emerald-500 rounded-2xl flex items-center px-4 py-3 gap-3 transition-colors">
            <span className="font-mono font-black text-slate-300 text-sm sm:text-base border-r border-[#182955] pr-3 shrink-0 select-none">
              R$
            </span>
            <input
              type="number"
              min={minWithdraw ?? 100}
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Mínimo R$ ${(minWithdraw ?? 100).toFixed(2).replace('.', ',')}`}
              className="w-full bg-transparent text-white font-mono font-bold text-sm sm:text-base placeholder:text-slate-500 outline-none"
            />
          </div>

          {/* INPUT 2: Chave PIX */}
          <div className="bg-[#0B1428] border border-[#182955] focus-within:border-emerald-500 rounded-2xl flex items-center px-4 py-3 gap-3 transition-colors">
            <span className="font-mono font-black text-slate-300 text-xs sm:text-sm border-r border-[#182955] pr-3 shrink-0 select-none">
              PIX
            </span>
            <input
              type="text"
              required
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="Chave PIX (e-mail, telefone ou chave aleat...)"
              className="w-full bg-transparent text-white font-mono font-medium text-xs sm:text-sm placeholder:text-slate-500 outline-none"
            />
          </div>

          {/* INPUT 3: CPF */}
          <div className="bg-[#0B1428] border border-[#182955] focus-within:border-emerald-500 rounded-2xl flex items-center px-4 py-3 gap-3 transition-colors">
            <span className="font-mono font-black text-slate-300 text-xs sm:text-sm border-r border-[#182955] pr-3 shrink-0 select-none">
              CPF
            </span>
            <input
              type="text"
              required
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="CPF do titular (somente números)"
              className="w-full bg-transparent text-white font-mono font-medium text-xs sm:text-sm placeholder:text-slate-500 outline-none"
            />
          </div>

          {/* NOTICE BOX */}
          <div className="bg-[#1A180B] border border-[#423812] rounded-2xl p-3 sm:p-3.5 text-amber-300 text-xs font-mono font-medium leading-relaxed">
            Saques processados em até 24h úteis. Sem taxa de saque no momento.
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 sm:py-4 bg-[#00E676] hover:bg-[#00C853] active:scale-98 text-[#031C0B] font-black text-sm sm:text-base rounded-2xl sm:rounded-3xl shadow-xl shadow-[#00E676]/20 transition-all flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider font-mono disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin text-[#031C0B]" />
            ) : (
              <span>Solicitar Saque</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
