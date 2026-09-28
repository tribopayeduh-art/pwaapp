import React, { useState } from 'react';
import {
  Skull,
  ShieldCheck,
  ShieldAlert,
  X,
  Check,
  Save,
  Info,
  Sliders,
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import { PartnerAffiliateStats } from '../../types';

interface PartnerCpaKillerModalProps {
  affiliate: PartnerAffiliateStats;
  token?: string | null;
  onClose: () => void;
  onSuccess: (updatedStats: Partial<PartnerAffiliateStats>) => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PartnerCpaKillerModal: React.FC<PartnerCpaKillerModalProps> = ({
  affiliate,
  token,
  onClose,
  onSuccess,
  onShowToast
}) => {
  const [cpaKillerAllowed, setCpaKillerAllowed] = useState<boolean>(!!affiliate.cpaKillerAllowed);
  const [cpaKillerActive, setCpaKillerActive] = useState<boolean>(!!affiliate.cpaKillerActive);
  const [cpaKillerEveryX, setCpaKillerEveryX] = useState<number>(affiliate.cpaKillerEveryX || 10);
  const [cpaKillerKillY, setCpaKillerKillY] = useState<number>(affiliate.cpaKillerKillY || 3);
  const [saving, setSaving] = useState<boolean>(false);

  const safeEveryX = Math.max(2, cpaKillerEveryX || 10);
  const safeKillY = Math.max(1, Math.min(safeEveryX - 1, cpaKillerKillY || 3));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const authToken =
        token ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('pg_auth_token') ||
            localStorage.getItem('paygateway_token') ||
            localStorage.getItem('token') ||
            ''
          : '');

      const res = await fetch(`/api/partner/affiliates/${affiliate.id}/cpa-killer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          cpaKillerAllowed,
          cpaKillerActive,
          cpaKillerEveryX: safeEveryX,
          cpaKillerKillY: safeKillY
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        onShowToast(json.message || 'CPA Killer configurado com sucesso!', 'success');
        onSuccess({
          cpaKillerAllowed,
          cpaKillerActive,
          cpaKillerEveryX: safeEveryX,
          cpaKillerKillY: safeKillY
        });
        onClose();
      } else {
        onShowToast(json.error || 'Erro ao salvar CPA Killer.', 'error');
      }
    } catch (e) {
      console.error(e);
      onShowToast('Falha na comunicação com o servidor.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200 select-none">
      <div className="bg-white border border-slate-200/80 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl space-y-0">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
              <Skull className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                CPA Killer · Intercepção de Influenciador
              </h2>
              <p className="text-xs text-slate-500">
                {affiliate.name} ({affiliate.referralCode})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          {/* 1. Ativar / Desativar CPA Killer no Afiliado */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-900">Status do CPA Killer</div>
                <div className="text-[11px] text-slate-500">Interromper e reter comissões de depósitos gerados</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={cpaKillerActive}
                  onChange={(e) => setCpaKillerActive(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {cpaKillerActive && (
              <div className="pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-amber-700 font-semibold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Intercepção ativa para depósitos do link deste afiliado!</span>
              </div>
            )}
          </div>

          {/* 2. Permissão de Autonomia (Liberar função para o afiliado controlar) */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
            <div className="pr-3">
              <div className="font-bold text-slate-900">Dar Função ao Afiliado</div>
              <div className="text-[11px] text-slate-500">
                Permitir que este afiliado veja e ative o CPA Killer para matar o CPA de influenciadores abaixo dele
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={cpaKillerAllowed}
                onChange={(e) => setCpaKillerAllowed(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* 3. Frequência Matemática do CPA Killer */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-3">
            <div className="font-bold text-slate-900">Proporção da Intercepção</div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">A cada X depósitos</label>
                <input
                  type="number"
                  min="2"
                  max="100"
                  value={cpaKillerEveryX}
                  onChange={(e) => setCpaKillerEveryX(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-center text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Reter / Matar Y</label>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, safeEveryX - 1)}
                  value={cpaKillerKillY}
                  onChange={(e) => setCpaKillerKillY(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white font-bold text-rose-600 focus:outline-none focus:ring-2 focus:ring-slate-900/10 text-center text-sm"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-[11px] text-slate-600 leading-relaxed">
              A cada <strong className="text-slate-900">{safeEveryX} depósitos</strong> gerados pelo link de {affiliate.name}, os primeiros {safeEveryX - safeKillY} pagam normalmente e as últimas <strong className="text-rose-600">{safeKillY} comissões</strong> são retidas 100% para o parceiro/casa.
            </div>

            {affiliate.cpaCounter !== undefined && (
              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>Progresso atual do ciclo:</span>
                <span className="font-mono font-bold text-slate-800">
                  {(affiliate.cpaCounter % safeEveryX)} de {safeEveryX} ({affiliate.cpaCounter} acumulados)
                </span>
              </div>
            )}
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm disabled:opacity-50"
            >
              {saving ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{saving ? 'Salvando...' : 'Salvar Regra'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
