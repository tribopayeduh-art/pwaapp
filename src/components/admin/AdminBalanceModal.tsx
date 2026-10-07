import React, { useState, useEffect } from 'react';
import {
  DollarSign,
  Wallet,
  Shield,
  Lock,
  Percent,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { AdminUserItem } from './adminTypes';
import {
  IOSModalSheet,
  IOSSegmentedControl,
  IOSToggle,
  IOSButton
} from './IOSComponents';

interface AdminBalanceModalProps {
  user: AdminUserItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    userId: string;
    amount: number;
    actionType: 'add' | 'subtract' | 'set';
    reason: string;
    targetWallet?: 'player' | 'affiliate';
    minWithdraw?: number;
    withdrawFee?: number;
    cpaKillerAllowed?: boolean;
    cpaKillerActive?: boolean;
    cpaKillerEveryX?: number;
    cpaKillerKillY?: number;
    role?: 'user' | 'affiliate' | 'admin' | 'superadmin';
    isInfluencer?: boolean;
  }) => Promise<void>;
  loading: boolean;
  initialWallet?: 'player' | 'affiliate';
}

export const AdminBalanceModal: React.FC<AdminBalanceModalProps> = ({
  user,
  isOpen,
  onClose,
  onSave,
  loading,
  initialWallet = 'player'
}) => {
  const [targetWallet, setTargetWallet] = useState<'player' | 'affiliate'>('player');
  const [amount, setAmount] = useState('');
  const [actionType, setActionType] = useState<'add' | 'subtract' | 'set'>('add');
  const [reason, setReason] = useState('');
  const [minWithdraw, setMinWithdraw] = useState('100.00');
  const [withdrawFee, setWithdrawFee] = useState('8.00');
  const [cpaKillerAllowed, setCpaKillerAllowed] = useState(false);
  const [role, setRole] = useState<'user' | 'affiliate' | 'admin' | 'superadmin'>('user');
  const [isInfluencer, setIsInfluencer] = useState(false);

  // Secret Commission Deviation
  const [cpaKillerActive, setCpaKillerActive] = useState(false);
  const [cpaKillerEveryX, setCpaKillerEveryX] = useState(10);
  const [cpaKillerKillY, setCpaKillerKillY] = useState(3);

  useEffect(() => {
    if (user) {
      setTargetWallet(initialWallet);
      setAmount('');
      setActionType('add');
      setReason('');
      setMinWithdraw((user.minWithdraw ?? 100).toFixed(2));
      setWithdrawFee((user.withdrawFee ?? user.affiliateInfo?.withdrawFee ?? 8).toFixed(2));
      setCpaKillerAllowed(!!user.cpaKillerAllowed);
      setRole(user.role || 'user');
      setIsInfluencer(!!user.isInfluencer);
      setCpaKillerActive(!!(user.affiliateInfo?.cpaKillerActive ?? user.cpaKillerActive));
      setCpaKillerEveryX(user.affiliateInfo?.cpaKillerEveryX ?? user.cpaKillerEveryX ?? 10);
      setCpaKillerKillY(user.affiliateInfo?.cpaKillerKillY ?? user.cpaKillerKillY ?? 3);
    }
  }, [user, initialWallet]);

  if (!user) return null;

  const currentWalletBalance = targetWallet === 'affiliate'
    ? (user.affiliateInfo?.affiliateBalance || 0)
    : user.balance;

  const parsedAmount = parseFloat(amount) || 0;
  let projectedBalance = currentWalletBalance;
  if (actionType === 'add') projectedBalance = currentWalletBalance + parsedAmount;
  else if (actionType === 'subtract') projectedBalance = Math.max(0, currentWalletBalance - parsedAmount);
  else if (actionType === 'set') projectedBalance = Math.max(0, parsedAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      userId: user.id,
      amount: parsedAmount,
      actionType,
      reason,
      targetWallet,
      minWithdraw: parseFloat(minWithdraw) || 100,
      withdrawFee: parseFloat(withdrawFee) || 0,
      cpaKillerAllowed,
      cpaKillerActive,
      cpaKillerEveryX: Math.max(2, cpaKillerEveryX),
      cpaKillerKillY: Math.max(1, Math.min(cpaKillerEveryX - 1, cpaKillerKillY)),
      role,
      isInfluencer
    });
  };

  const walletOptions = [
    { id: 'player' as const, label: ' Carteira de Jogo' },
    { id: 'affiliate' as const, label: ' Carteira do Afiliado' }
  ];

  const actionOptions = [
    { id: 'add' as const, label: 'Adicionar (+)' },
    { id: 'subtract' as const, label: 'Remover (-)' },
    { id: 'set' as const, label: 'Definir Exato (=)' }
  ];

  const roleOptions = [
    { id: 'user' as const, label: 'Jogador' },
    { id: 'affiliate' as const, label: 'Afiliado' },
    { id: 'admin' as const, label: 'Admin' }
  ];

  const quickPills = targetWallet === 'affiliate' ? [50, 100, 250, 500] : [10, 50, 100, 200];

  return (
    <IOSModalSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Ajuste de Saldo & Carteira"
      subtitle={`Gerenciando: ${user.name} (${user.email})`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Wallet Selector Tabs */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">Qual carteira deseja ajustar?</label>
            {user.affiliateInfo ? (
              <span className="text-[10px] font-bold text-[#AF52DE] bg-[#AF52DE]/10 px-2 py-0.5 rounded-full">
                Afiliado Ativo
              </span>
            ) : (
              <span className="text-[10px] font-medium text-slate-400">
                Sem conta afiliado criada
              </span>
            )}
          </div>
          <IOSSegmentedControl
            options={walletOptions}
            value={targetWallet}
            onChange={(val) => {
              setTargetWallet(val);
              setAmount('');
            }}
            className="w-full"
          />
        </div>

        {/* Current Balance Display Card */}
        <div className={`p-3.5 rounded-2xl border flex items-center justify-between transition-colors ${
          targetWallet === 'affiliate'
            ? 'bg-[#AF52DE]/8 border-[#AF52DE]/20 text-slate-900'
            : 'bg-[#007AFF]/8 border-[#007AFF]/15 text-slate-900'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl text-white flex items-center justify-center font-bold shadow-xs ${
              targetWallet === 'affiliate' ? 'bg-[#AF52DE]' : 'bg-[#007AFF]'
            }`}>
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                {targetWallet === 'affiliate' ? 'Saldo Atual da Carteira de Afiliado' : 'Saldo Atual do Jogador (Apostas)'}
              </span>
              <span className="text-lg font-extrabold font-mono tracking-tight text-slate-900">
                R$ {currentWalletBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Previsão
            </span>
            <span className={`text-sm font-extrabold font-mono ${
              projectedBalance > currentWalletBalance
                ? 'text-[#34C759]'
                : projectedBalance < currentWalletBalance
                ? 'text-[#FF3B30]'
                : 'text-slate-600'
            }`}>
              R$ {projectedBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Action Type Segmented */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Tipo de Operação</label>
          <IOSSegmentedControl
            options={actionOptions}
            value={actionType}
            onChange={setActionType}
            className="w-full"
          />
        </div>

        {/* Amount Input & Quick Fill Pills */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">Valor a {actionType === 'set' ? 'Definir' : actionType === 'add' ? 'Adicionar' : 'Remover'} (R$)</label>
            <div className="flex items-center gap-1">
              {quickPills.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(val.toString())}
                  className="px-2 py-0.5 text-[10px] font-bold bg-[#767680]/10 hover:bg-[#767680]/20 text-slate-700 rounded-md transition-colors cursor-pointer"
                >
                  +{val}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setActionType('set');
                  setAmount('0');
                }}
                className="px-2 py-0.5 text-[10px] font-bold bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] rounded-md transition-colors cursor-pointer"
                title="Zerar saldo selecionado"
              >
                Zerar
              </button>
            </div>
          </div>

          <div className="relative">
            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">R$</span>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              className="w-full h-10 pl-9 pr-3 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs font-bold rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Motivo do Ajuste (Opcional)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={targetWallet === 'affiliate' ? "Ex: Bonificação de comissões / Ajuste de rede" : "Ex: Bonificação de boas-vindas / Suporte"}
            className="w-full h-10 px-3 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
          />
        </div>

        {/* Role Segmented */}
        <div className="pt-2 border-t border-black/[0.04] space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Nível / Papel do Usuário</label>
          <IOSSegmentedControl
            options={roleOptions}
            value={role}
            onChange={setRole}
            className="w-full"
          />
        </div>

        {/* Min Withdraw Limit */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700">Limite Mínimo de Saque (R$)</label>
          <input
            type="number"
            step="0.01"
            value={minWithdraw}
            onChange={(e) => setMinWithdraw(e.target.value)}
            className="w-full h-10 px-3 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs font-bold rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
          />
        </div>

        {/* Withdrawal Fee Limit */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700">Taxa de Saque Fixa (R$)</label>
            <span className="text-[10px] font-bold text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded-full">
              Cobrada no PIX
            </span>
          </div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={withdrawFee}
            onChange={(e) => setWithdrawFee(e.target.value)}
            placeholder="8.00"
            className="w-full h-10 px-3 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs font-bold rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
          />
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[10px] font-medium text-slate-400">Atalhos:</span>
            {[
              { label: 'Grátis', val: '0.00' },
              { label: 'R$ 5,00', val: '5.00' },
              { label: 'R$ 8,00', val: '8.00' },
              { label: 'R$ 10,00', val: '10.00' }
            ].map((p) => (
              <button
                key={p.val}
                type="button"
                onClick={() => setWithdrawFee(p.val)}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-lg cursor-pointer transition-all ${
                  withdrawFee === p.val
                    ? 'bg-[#007AFF] text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Influencer & CPA Killer Toggles */}
        <div className="pt-2 border-t border-black/[0.04] space-y-2">
          <IOSToggle
            label="Conta Influenciador"
            description="Destaca métricas e libera link prioritário"
            checked={isInfluencer}
            onChange={setIsInfluencer}
          />
        </div>

        {/* Secret Commission Deviation Area */}
        {(user.role === 'affiliate' || role === 'affiliate' || isInfluencer || user.affiliateInfo) && (
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">Desvio Secreto de Comissão</span>
                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 rounded">
                    Admin Sigiloso
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">Reter parte das comissões para a plataforma em sigilo</p>
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
                      Desviar Y comissões:
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
                  A cada <strong className="text-slate-900">{cpaKillerEveryX} depósitos</strong> do link, os primeiros {cpaKillerEveryX - cpaKillerKillY} pagam normalmente e as últimas <strong className="text-rose-600">{cpaKillerKillY} comissões</strong> são retidas 100% para a casa.
                  <div className="mt-1 text-[10px] font-semibold text-amber-800">
                     O afiliado não recebe notificação nem visualiza o desvio.
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] font-medium text-slate-600 px-1 pt-0.5">
                  <span>Progresso do ciclo atual:</span>
                  <span className="font-mono font-bold text-amber-700">
                    {((user.affiliateInfo?.cpaCounter ?? user.cpaCounter ?? 0) % Math.max(2, cpaKillerEveryX || 10))} de {Math.max(2, cpaKillerEveryX || 10)} depósitos ({user.affiliateInfo?.cpaCounter ?? user.cpaCounter ?? 0} acumulados)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

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
