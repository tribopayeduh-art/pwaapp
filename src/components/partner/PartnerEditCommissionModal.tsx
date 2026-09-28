import React, { useState, useEffect } from 'react';
import { X, Percent, TrendingUp, DollarSign, ShieldAlert, Sparkles, CheckCircle2, ArrowRight, Check } from 'lucide-react';
import { PartnerAffiliateStats } from '../../types';
import {
  getPartnerCutFromAffiliateRevShare,
  MAX_PARTNER_AFFILIATE_COMMISSION,
  MIN_PARTNER_AFFILIATE_COMMISSION
} from '../../utils/partnerCommission';

interface PartnerEditCommissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  affiliate: PartnerAffiliateStats | null;
  onSuccess: (affiliateId: string, newRate: number, newPartnerCut: number) => void;
}

export const PartnerEditCommissionModal: React.FC<PartnerEditCommissionModalProps> = ({
  isOpen,
  onClose,
  affiliate,
  onSuccess
}) => {
  const [rate, setRate] = useState<number>(70);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (affiliate) {
      const currentRate = typeof affiliate.revSharePercent === 'number'
        ? Math.min(MAX_PARTNER_AFFILIATE_COMMISSION, affiliate.revSharePercent)
        : 70;
      setRate(currentRate);
      setError(null);
      setSuccessMessage(null);
    }
  }, [affiliate]);

  if (!isOpen || !affiliate) return null;

  const currentPartnerCut = getPartnerCutFromAffiliateRevShare(rate);

  const quickPresets = [
    { label: '65%', val: 65, partnerCut: 18, desc: 'Maior margem' },
    { label: '70%', val: 70, partnerCut: 15, desc: 'Padrão' },
    { label: '75%', val: 75, partnerCut: 10, desc: 'Competitivo' },
    { label: '80%', val: 80, partnerCut: 7.5, desc: 'Teto Máximo' },
  ];

  const handleSave = async () => {
    if (rate > MAX_PARTNER_AFFILIATE_COMMISSION) {
      setError(`A comissão máxima que você pode definir para um afiliado é de ${MAX_PARTNER_AFFILIATE_COMMISSION}%.`);
      return;
    }
    if (rate < 1) {
      setError('A comissão mínima permitida é de 1%.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/partner/affiliates/${affiliate.id}/commission`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ revSharePercent: rate })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao atualizar comissão.');
      }

      setSuccessMessage(data.message || 'Comissão atualizada com sucesso!');
      onSuccess(affiliate.id, data.revSharePercent, data.partnerCutPercent);

      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar ao servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-zinc-200 relative overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">Ajustar Comissão do Afiliado</h3>
            <p className="text-xs text-zinc-500">
              Gerencie a taxa de comissão de <strong className="text-zinc-800">{affiliate.name}</strong>
            </p>
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Affiliate Quick Profile */}
        <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between mb-5">
          <div>
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Afiliado da sua rede</span>
            <strong className="text-sm font-bold text-zinc-900">{affiliate.name}</strong>
            <span className="text-[11px] text-zinc-500 block">{affiliate.email}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">Código Ref</span>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-200 text-zinc-800">
              {affiliate.referralCode}
            </span>
          </div>
        </div>

        {/* Commission Slider & Input */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-zinc-800 uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              Comissão do Afiliado (% dos depósitos)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max={MAX_PARTNER_AFFILIATE_COMMISSION}
                step="1"
                value={rate}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                    setRate(Math.min(MAX_PARTNER_AFFILIATE_COMMISSION, Math.max(1, val)));
                  }
                }}
                className="w-16 px-2 py-1 text-center font-bold text-sm bg-indigo-50 text-indigo-900 border border-indigo-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm font-bold text-indigo-900">%</span>
            </div>
          </div>

          <input
            type="range"
            min="10"
            max={MAX_PARTNER_AFFILIATE_COMMISSION}
            step="1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="w-full h-2.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-hidden"
          />

          <div className="flex justify-between text-[11px] text-zinc-400 mt-1 font-medium">
            <span>Mín: 10%</span>
            <span className="text-indigo-600 font-bold">Máximo Permitido: {MAX_PARTNER_AFFILIATE_COMMISSION}%</span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-5">
          <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block mb-2">
            Valores Rápidos Recomendados
          </span>
          <div className="grid grid-cols-4 gap-2">
            {quickPresets.map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => setRate(preset.val)}
                className={`py-2 px-1 rounded-xl text-center border transition cursor-pointer flex flex-col items-center justify-center ${
                  rate === preset.val
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700'
                }`}
              >
                <span className="text-xs font-extrabold">{preset.label}</span>
                <span className={`text-[10px] ${rate === preset.val ? 'text-indigo-100 font-semibold' : 'text-zinc-500'}`}>
                  Você: {preset.partnerCut}%
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Split Summary Card */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-900 to-zinc-950 text-white mb-5 shadow-inner">
          <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-indigo-300 block tracking-wider">
                Comissão do Afiliado
              </span>
              <strong className="text-2xl font-black text-emerald-400">{rate}%</strong>
            </div>

            <div className="flex items-center text-zinc-400">
              <ArrowRight className="w-5 h-5 text-indigo-400" />
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-indigo-300 block tracking-wider">
                Sua Comissão (Parceiro)
              </span>
              <strong className="text-2xl font-black text-indigo-400">{currentPartnerCut}%</strong>
            </div>
          </div>

          <div className="text-xs text-zinc-300 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-zinc-400">Exemplo para cada depósito de R$ 100:</span>
              <span className="font-mono text-zinc-200 font-bold">R$ 100,00</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-emerald-400">• Afiliado recebe:</span>
              <span className="font-mono font-bold text-emerald-400">
                R$ {(100 * (rate / 100)).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-indigo-300">• Você recebe automaticamente:</span>
              <span className="font-mono font-bold text-indigo-300">
                R$ {(100 * (currentPartnerCut / 100)).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Dynamic Rules Explanatory Box */}
        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs mb-5">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="block font-bold">Dinâmica Oficial de Comissões:</strong>
              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] opacity-90">
                <span>• Afiliado 85% ➔ Parceiro 5%</span>
                <span>• Afiliado 75% ➔ Parceiro 10%</span>
                <span>• Afiliado 80% ➔ Parceiro 7.5%</span>
                <span>• Afiliado 70% ➔ Parceiro 15%</span>
                <span className="col-span-2">• Afiliado 65% ➔ Parceiro 18%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-600 hover:bg-zinc-100 transition cursor-pointer border border-zinc-200/80 active:scale-95"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2 active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>{loading ? 'Salvando...' : `Confirmar Taxa (${rate}%)`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
