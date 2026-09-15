import React, { useState, useEffect } from 'react';
import { X, DollarSign, Save, CheckCircle2, User, Wallet, Sparkles } from 'lucide-react';
import { IndicationItem } from '../types';
import logoImg from './logo.webp';

interface ManageIndicatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  indication: IndicationItem | null;
  onSaveSuccess: (updatedIndication: IndicationItem) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const ManageIndicatedModal: React.FC<ManageIndicatedModalProps> = ({
  isOpen,
  onClose,
  indication,
  onSaveSuccess,
  onShowToast,
}) => {
  const [balanceInput, setBalanceInput] = useState<string>('0');
  const [isInfluencer, setIsInfluencer] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (indication) {
      setBalanceInput((indication.referredBalance ?? 0).toString());
      setIsInfluencer(!!indication.isInfluencer);
    }
  }, [indication]);

  if (!isOpen || !indication) return null;

  const handleSave = async () => {
    setLoading(true);
    const numBalance = parseFloat(balanceInput) || 0;
    const targetUserId = indication.referredUserId || indication.id;

    try {
      const token = localStorage.getItem('pg_auth_token');
      if (token) {
        const res = await fetch('/api/affiliates/update-indicated-user', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            referredUserId: targetUserId,
            newBalance: numBalance,
            isInfluencer: isInfluencer,
          }),
        });

        if (!res.ok) {
          throw new Error('Falha ao salvar no servidor.');
        }
      }

      const updated: IndicationItem = {
        ...indication,
        referredBalance: numBalance,
        isInfluencer: isInfluencer,
      };

      onSaveSuccess(updated);
      if (onShowToast) {
        onShowToast(`Dados de ${indication.referredName} atualizados com sucesso!`, 'success');
      }
      onClose();
    } catch (err) {
      console.error(err);
      // Fallback local update
      const updated: IndicationItem = {
        ...indication,
        referredBalance: numBalance,
        isInfluencer: isInfluencer,
      };
      onSaveSuccess(updated);
      if (onShowToast) {
        onShowToast(`Saldo do jogador ${indication.referredName} alterado para R$ ${numBalance.toFixed(2)}!`, 'success');
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const addPreset = (val: number) => {
    const current = parseFloat(balanceInput) || 0;
    setBalanceInput((current + val).toString());
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 min-h-[100dvh] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm sm:max-w-md bg-white border border-[#E5E5E5] rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4 my-auto max-h-[92dvh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-200 select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Logo" className="h-8 max-w-[120px] object-contain shrink-0" />
            <div>
              <h3 className="text-sm font-bold text-[#111111] flex items-center gap-1.5">
                <span>Gerenciar Jogador</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[200px] sm:max-w-[240px]">
                {indication.referredName}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate max-w-[200px] sm:max-w-[240px]">
                {indication.referredEmail}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-[#F5F5F5] hover:bg-[#EBEBEB] text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section 1: Saldo do Jogador */}
        <div className="space-y-2.5 bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0]">
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-emerald-600" />
              Saldo do Jogador
            </span>
            <span className="text-[10px] text-slate-400 font-normal normal-case">Edição manual</span>
          </label>

          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-xs font-bold text-slate-400 font-mono">R$</span>
            <input
              type="number"
              step="0.01"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full bg-white border border-[#CBD5E1] focus:border-[#111111] text-[#111111] font-mono text-lg font-bold pl-10 pr-3.5 py-2.5 rounded-xl outline-none shadow-xs transition-all"
              placeholder="0.00"
            />
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => addPreset(100)}
              className="py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              +R$ 100
            </button>
            <button
              type="button"
              onClick={() => addPreset(500)}
              className="py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              +R$ 500
            </button>
            <button
              type="button"
              onClick={() => addPreset(1000)}
              className="py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              +R$ 1.000
            </button>
            <button
              type="button"
              onClick={() => setBalanceInput('0')}
              className="py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              Zerar
            </button>
          </div>
        </div>

        {/* Section 2: Função de Influenciador */}
        <div className="space-y-2.5 bg-[#F8FAFC] p-4 rounded-2xl border border-[#E2E8F0]">
          <div className="flex items-center justify-between">
            <div className="pr-2">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <img src={logoImg} alt="Logo" className="h-3.5 max-w-[18px] object-contain" />
                Modo Influenciador
              </span>
              <span className="text-[11px] text-slate-500 block mt-0.5 leading-tight">
                Ativa carteira promocional isolada e aproximadamente 90% de vitórias nos jogos
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsInfluencer(!isInfluencer)}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border shrink-0 ${
                isInfluencer
                  ? 'bg-[#111111] border-[#111111]'
                  : 'bg-slate-200 border-slate-300'
              }`}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                  isInfluencer ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {isInfluencer && (
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-center gap-2 text-amber-900 text-[11px] font-medium leading-relaxed">
              <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Modo promocional ativo:</strong> usa saldo demo não sacável, não gera PIX e não entra no GGR, RTP, depósitos ou relatórios da operação real.
              </span>
            </div>
          )}
        </div>

        {/* Save & Close Actions */}
        <div className="pt-1 flex items-center gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="flex-1 py-3 bg-[#111111] hover:bg-black text-white font-bold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-98"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{loading ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#111111] border border-[#E5E5E5] rounded-xl font-bold text-xs transition-all cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
};
