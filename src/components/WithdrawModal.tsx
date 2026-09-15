import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { ArrowUpRight, Loader2, AlertCircle, ShieldCheck, Wallet, KeyRound, Plus, CheckCircle2 } from 'lucide-react';

interface PixKeyItem {
  id: string;
  type: string;
  key: string;
  name: string;
  status?: string;
}

interface WithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmWithdraw: (amount: number, pixKeyId: string) => Promise<void>;
  userBalance: number;
  minWithdraw?: number;
  withdrawFee?: number;
  loading: boolean;
  token?: string | null;
  onOpenAddPixKey?: () => void;
}

export const WithdrawModal: React.FC<WithdrawModalProps> = ({
  isOpen,
  onClose,
  onConfirmWithdraw,
  userBalance,
  minWithdraw = 100,
  withdrawFee,
  loading,
  token,
  onOpenAddPixKey,
}) => {
  const limit = typeof minWithdraw === 'number' && !isNaN(minWithdraw) && minWithdraw >= 0 ? minWithdraw : 100;
  const fallbackFee = typeof withdrawFee === 'number' && !isNaN(withdrawFee) && withdrawFee >= 0 ? withdrawFee : 8.0;
  const [liveFee, setLiveFee] = useState<number>(fallbackFee);
  const WITHDRAWAL_FEE = liveFee;
  const [amount, setAmount] = useState<string>(limit.toString());
  const [pixKeys, setPixKeys] = useState<PixKeyItem[]>([]);
  const [selectedPixKeyId, setSelectedPixKeyId] = useState<string>('');
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [manualPixKey, setManualPixKey] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Keep liveFee in sync if prop changes
  useEffect(() => {
    if (typeof withdrawFee === 'number' && !isNaN(withdrawFee) && withdrawFee >= 0) {
      setLiveFee(withdrawFee);
    }
  }, [withdrawFee]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setAmount(limit.toString());
      fetchPixKeys();
      fetchLatestFee();
    }
  }, [isOpen, token, limit]);

  const fetchLatestFee = async () => {
    const authToken = token || localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
    if (!authToken) return;
    try {
      // 1. Try affiliates/info if the user is an affiliate
      const affRes = await fetch('/api/affiliates/info', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (affRes.ok) {
        const affData = await affRes.json();
        if (typeof affData.withdrawFee === 'number' && !isNaN(affData.withdrawFee)) {
          setLiveFee(affData.withdrawFee);
          return;
        }
      }
      // 2. Fallback to auth/me to get the user's updated withdrawFee
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (typeof meData.withdrawFee === 'number' && !isNaN(meData.withdrawFee)) {
          setLiveFee(meData.withdrawFee);
        }
      }
    } catch (_e) {
      // Ignore transient errors and keep current fee
    }
  };

  const fetchPixKeys = async () => {
    if (!token) return;
    setLoadingKeys(true);
    try {
      const res = await fetch('/api/pix-keys', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.pixKeys)) {
        setPixKeys(data.pixKeys);
        if (data.pixKeys.length > 0) {
          // Default select the first key
          setSelectedPixKeyId(data.pixKeys[0].id || data.pixKeys[0].key);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar chaves PIX:', err);
    } finally {
      setLoadingKeys(false);
    }
  };

  const presetAmounts = Array.from(new Set([limit, 50, 100, 200, 500, 1000].filter(a => a >= limit))).sort((a, b) => a - b);

  const handleSelectAllBalance = () => {
    if (userBalance > 0) {
      setAmount(userBalance.toFixed(2));
    }
  };

  const numVal = parseFloat(amount.replace(',', '.')) || 0;
  const netAmountReceivable = Math.max(0, numVal - WITHDRAWAL_FEE);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val < limit) {
      setError(`O valor mínimo para saque é de R$ ${limit.toFixed(2).replace('.', ',')}.`);
      return;
    }

    if (WITHDRAWAL_FEE > 0 && val <= WITHDRAWAL_FEE) {
      setError(`O valor do saque precisa ser maior que a taxa de saque (R$ ${WITHDRAWAL_FEE.toFixed(2).replace('.', ',')}).`);
      return;
    }

    if (val > userBalance) {
      setError('Saldo insuficiente para realizar este saque.');
      return;
    }

    let finalPixKeyId = selectedPixKeyId;
    if (!finalPixKeyId && manualPixKey.trim()) {
      finalPixKeyId = manualPixKey.trim();
    }

    if (!finalPixKeyId) {
      setError('Por favor, selecione ou informe uma chave PIX para recebimento.');
      return;
    }

    try {
      await onConfirmWithdraw(val, finalPixKeyId);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao processar solicitação de saque.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Saque via PIX">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        {/* Error Alert if any */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Saldo Disponível Card */}
        <div className="bg-[#F5F5F5] border border-[#E5E5E5] p-3.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-[#E5E5E5] flex items-center justify-center text-[#111111]">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-semibold text-[#737373] block">
                Saldo Disponível
              </span>
              <span className="text-base font-bold text-[#111111]">
                R$ {userBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSelectAllBalance}
            className="text-[11px] font-bold text-[#111111] bg-white border border-[#E5E5E5] px-2.5 py-1.5 rounded-xl hover:bg-[#ECECEC] transition-colors cursor-pointer"
          >
            Sacar Tudo
          </button>
        </div>

        {/* Input 1: Valor do Saque */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-[#111111] block">
            Valor do saque (R$)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#737373]">
              R$
            </span>
            <input
              type="number"
              min={limit}
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`${limit.toFixed(2).replace('.', ',')}`}
              className="w-full h-12 pl-10 pr-4 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-lg font-bold text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all"
            />
          </div>
          <p className="text-[11px] text-[#737373]">Saque mínimo: R$ {limit.toFixed(2).replace('.', ',')}</p>
        </div>

        {/* Presets */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {presetAmounts.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => setAmount(val.toString())}
              className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                amount === val.toString()
                  ? 'bg-[#111111] text-white border-[#111111]'
                  : 'bg-[#F5F5F5] text-[#111111] border-[#E5E5E5] hover:bg-[#ECECEC]'
              }`}
            >
              R$ {val}
            </button>
          ))}
        </div>

        {/* Section: Chaves PIX Cadastradas */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[#111111] flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#111111]" />
              <span>Chave PIX para Recebimento</span>
            </label>
          </div>

          {loadingKeys ? (
            <div className="p-4 text-center bg-[#F5F5F5] rounded-xl border border-[#E5E5E5] flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#111111]" />
              <span className="text-xs text-[#737373]">Carregando chaves cadastradas...</span>
            </div>
          ) : pixKeys.length > 0 ? (
            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
              {pixKeys.map((item) => {
                const keyId = item.id || item.key;
                const isSelected = selectedPixKeyId === keyId;
                return (
                  <div
                    key={keyId}
                    onClick={() => setSelectedPixKeyId(keyId)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? 'bg-white border-[#111111] shadow-xs'
                        : 'bg-[#F5F5F5] border-[#E5E5E5] hover:border-[#A3A3A3]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-[#111111] bg-[#111111]' : 'border-[#A3A3A3]'
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#111111] truncate">{item.name}</span>
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 bg-[#E5E5E5] text-[#111111] rounded">
                            {item.type}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-[#737373] truncate">{item.key}</p>
                      </div>
                    </div>

                    <div className="shrink-0 pl-2">
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Aprovada
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-3.5 bg-[#FAFAFA] border border-dashed border-[#E5E5E5] rounded-xl text-center space-y-2">
              <p className="text-xs text-[#737373]">Você não possui nenhuma chave PIX salva.</p>
              {onOpenAddPixKey ? (
                <button
                  type="button"
                  onClick={onOpenAddPixKey}
                  className="h-8 px-3 bg-[#111111] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Cadastrar Chave PIX Agora</span>
                </button>
              ) : (
                <input
                  type="text"
                  value={manualPixKey}
                  onChange={(e) => setManualPixKey(e.target.value)}
                  placeholder="Informe sua Chave PIX (CPF, Email, Telefone)"
                  className="w-full h-10 px-3 bg-white border border-[#E5E5E5] rounded-lg text-xs text-[#111111]"
                />
              )}
            </div>
          )}
        </div>

        {/* Resumo de Saque & Taxa de R$ 8,00 */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span>Valor Solicitado</span>
            <span className="font-semibold text-slate-800">
              R$ {numVal > 0 ? numVal.toFixed(2).replace('.', ',') : '0,00'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-500">
            <span>Taxa de Saque (Alliance Hub)</span>
            <span className={`font-semibold px-1.5 py-0.5 rounded text-[11px] border ${
              WITHDRAWAL_FEE > 0
                ? 'text-amber-700 bg-amber-50 border-amber-200'
                : 'text-emerald-700 bg-emerald-50 border-emerald-200'
            }`}>
              {WITHDRAWAL_FEE > 0 ? `R$ ${WITHDRAWAL_FEE.toFixed(2).replace('.', ',')}` : 'Grátis (R$ 0,00)'}
            </span>
          </div>
          <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900">
            <span>Valor Líquido a Receber</span>
            <span className="text-emerald-600 text-sm font-extrabold">
              R$ {netAmountReceivable > 0 ? netAmountReceivable.toFixed(2).replace('.', ',') : '0,00'}
            </span>
          </div>
        </div>

        {/* Informação de Segurança & Política de Saque */}
        <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1 text-[11px] text-zinc-600">
          <div className="flex items-center gap-1.5 font-bold text-zinc-800">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-700" />
            <span>Política de Proteção Antifraude</span>
          </div>
          <p className="leading-snug text-zinc-500">
            O Cashout automático instantâneo via gateway é exclusivo para Afiliados Hub ativos e Administradores. Solicitações de contas de jogos e influenciadores são direcionadas para conferência e aprovação manual da administração.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || (pixKeys.length === 0 && !manualPixKey.trim() && !selectedPixKeyId)}
          className="w-full h-11 bg-[#111111] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-black transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Solicitar Saque PIX</span>
              <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
            </>
          )}
        </button>
      </form>
    </Modal>
  );
};
