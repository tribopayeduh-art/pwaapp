import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, DollarSign, Save, CheckCircle2, User, Wallet, Sparkles, Percent, ShieldCheck, AlertCircle, Crown, ExternalLink } from 'lucide-react';
import { IndicationItem, User as AppUser } from '../types';
import logoImg from './logo.webp';

interface ManageIndicatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  indication: IndicationItem | null;
  affiliateRevShare?: number;
  isAdmin?: boolean;
  onSaveSuccess: (updatedIndication: IndicationItem) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const ManageIndicatedModal: React.FC<ManageIndicatedModalProps> = ({
  isOpen,
  onClose,
  indication,
  affiliateRevShare = 70,
  isAdmin = true,
  onSaveSuccess,
  onShowToast,
}) => {
  const [balanceInput, setBalanceInput] = useState<string>('0');
  const [isInfluencer, setIsInfluencer] = useState<boolean>(false);
  const [influencerRate, setInfluencerRate] = useState<number>(50);
  const [isPartner, setIsPartner] = useState<boolean>(false);
  const [partnerApproved, setPartnerApproved] = useState<boolean>(false);
  const [partnerCode, setPartnerCode] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Regra de Ouro: Sempre deve sobrar no mínimo 10% de margem para o afiliado
  // Ex: se afiliado tem 70%, o máximo que pode dar ao influenciador é 60%
  const maxAllowedRate = Math.max(0, affiliateRevShare - 10);

  useEffect(() => {
    if (indication) {
      setBalanceInput((indication.referredBalance ?? 0).toString());
      setIsInfluencer(!!indication.isInfluencer);
      const initialRate = typeof indication.influencerRate === 'number' 
        ? indication.influencerRate 
        : Math.min(50, Math.max(0, affiliateRevShare - 10));
      setInfluencerRate(Math.min(initialRate, Math.max(0, affiliateRevShare - 10)));

      setIsPartner(Boolean(indication.isPartner || indication.partnerApproved));
      setPartnerApproved(Boolean(indication.partnerApproved));
      const defaultCode = indication.partnerCode || 
        (indication.referredName ? indication.referredName.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '') : 'VIP');
      setPartnerCode(defaultCode);
    }
  }, [indication, affiliateRevShare]);

  if (!isOpen || !indication) return null;

  const handleSave = async () => {
    setLoading(true);
    const numBalance = parseFloat(balanceInput) || 0;
    const targetUserId = indication.referredUserId || indication.id;
    const finalRate = isInfluencer ? Math.min(influencerRate, maxAllowedRate) : undefined;
    const cleanPartnerCode = partnerCode.trim().toUpperCase() || undefined;

    // Validação estrita: Afiliado só pode colocar saldo em jogador no Modo Influenciador
    const isChangingBalance = Math.abs(numBalance - (indication.referredBalance ?? 0)) > 0.001;
    if (!isAdmin && isChangingBalance && !isInfluencer) {
      setLoading(false);
      if (onShowToast) {
        onShowToast('Operação não permitida: Você só pode conceder saldo para jogadores configurados no Modo Influenciador. Ative o Modo Influenciador antes de salvar.', 'error');
      }
      return;
    }

    try {
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('token') || localStorage.getItem('paygateway_token');
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
            influencerRate: finalRate,
            isPartner: isPartner || partnerApproved,
            partnerApproved: partnerApproved,
            partnerCode: cleanPartnerCode,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Falha ao salvar no servidor.');
        }

        // Also call partner admin endpoint if user toggled partner status to guarantee full synchronization
        if (isAdmin) {
          await fetch(`/api/partner/admin/users/${targetUserId}/partner`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              isPartner: isPartner || partnerApproved,
              partnerApproved: partnerApproved,
              partnerCode: cleanPartnerCode,
            }),
          }).catch(() => {});
        }
      }

      const willHaveWithdrawBlocked = (!isAdmin && isChangingBalance) || Boolean(indication.withdrawBlocked) || Boolean(indication.hasAffiliateDemoBalance);

      const updated: IndicationItem = {
        ...indication,
        referredBalance: numBalance,
        isInfluencer: isInfluencer,
        influencerRate: finalRate,
        isPartner: isPartner || partnerApproved,
        partnerApproved: partnerApproved,
        partnerCode: cleanPartnerCode,
        withdrawBlocked: willHaveWithdrawBlocked,
        hasAffiliateDemoBalance: willHaveWithdrawBlocked,
      };

      onSaveSuccess(updated);
      if (onShowToast) {
        const partnerMsg = partnerApproved ? ' e acesso de Parceiro VIP liberado!' : '!';
        onShowToast(`Dados de ${indication.referredName} atualizados com sucesso${partnerMsg}`, 'success');
      }
      onClose();
    } catch (err: any) {
      console.error(err);
      if (onShowToast) {
        onShowToast(err.message || 'Erro ao atualizar dados.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const addPreset = (val: number) => {
    const current = parseFloat(balanceInput) || 0;
    setBalanceInput((current + val).toString());
  };

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 min-h-[100dvh] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm sm:max-w-md bg-white border border-[#E5E5E5] rounded-3xl p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4 my-auto max-h-[85dvh] sm:max-h-[90dvh] overflow-y-auto transform transition-all animate-in zoom-in-95 duration-200 select-none"
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

        {/* Game Origin Identification Card */}
        {(() => {
          const gid = indication.registeredGame || indication.lastGameId || 'g_block_puzzle';
          let gName = 'Block Win';
          let gTag = 'BLOCK WIN';
          let gIcon = '🧩';
          let gBadge = 'bg-cyan-50 border-cyan-200 text-cyan-900';

          if (gid === 'g_bubble_blast' || gid === 'bubbleblast') {
            gName = 'Bubble Blast';
            gTag = 'BUBBLE';
            gIcon = '🫧';
            gBadge = 'bg-purple-50 border-purple-200 text-purple-900';
          } else if (gid === 'g_subway_pay' || gid === 'subwaypay') {
            gName = 'Subway Pay';
            gTag = 'SUBWAY';
            gIcon = '🏃';
            gBadge = 'bg-amber-50 border-amber-200 text-amber-900';
          } else if (gid === 'g_gen_dino') {
            gName = 'GEN DINO';
            gTag = 'DINO';
            gIcon = '🦖';
            gBadge = 'bg-emerald-50 border-emerald-200 text-emerald-900';
          } else if (gid === 'g_raspa_fortuna') {
            gName = 'Raspa Fortuna';
            gTag = 'RASPA';
            gIcon = '🍀';
            gBadge = 'bg-orange-50 border-orange-200 text-orange-900';
          }

          return (
            <div className={`p-3 rounded-2xl border flex items-center justify-between ${gBadge}`}>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl select-none">{gIcon}</span>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Jogo Cadastrado:</span>
                    <span className="text-xs font-black uppercase px-2 py-0.5 rounded-md bg-white/90 border border-current/20 shadow-2xs">
                      {gName}
                    </span>
                    {indication.isFromInfluencer && indication.referredByInfluencerName && (
                      <span className="bg-purple-100 text-purple-900 border border-purple-300 text-[10px] px-2 py-0.5 rounded-md font-extrabold flex items-center gap-1 shrink-0 shadow-2xs">
                        ⭐ Trazido por {indication.referredByInfluencerName}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 font-medium leading-tight">
                    Conta criada via <strong>{gName}</strong>{indication.isFromInfluencer && indication.referredByInfluencerName ? ` através do influenciador ${indication.referredByInfluencerName}` : ''}. Saldo e influenciador são gerenciados diretamente para este jogo.
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Status de Saque & Anti-Fraude Banner if user already has demo balance */}
        {Boolean(indication.withdrawBlocked || indication.hasAffiliateDemoBalance) && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/90 text-rose-950 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-tight">
              <strong className="font-bold block text-rose-900 mb-0.5">🔒 Saques Bloqueados no Sistema</strong>
              Esta conta possui saldo concedido por afiliado e está com saques permanentemente desativados pelo sistema financeiro.
            </div>
          </div>
        )}

        {/* Section 2: Modo Influenciador (Requisito obrigatório para afiliados concederem saldo) */}
        <div className={`p-4 rounded-2xl border transition-all ${
          isInfluencer 
            ? 'bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-white border-amber-300 shadow-2xs' 
            : 'bg-[#F8FAFC] border-slate-200'
        }`}>
          <div className="flex items-center justify-between gap-2">
            <div className="pr-1">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                <Sparkles className={`w-4 h-4 ${isInfluencer ? 'text-amber-500' : 'text-slate-400'}`} />
                Modo Influenciador
                {isInfluencer ? (
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] px-1.5 py-0.5 rounded font-black flex items-center gap-1">
                    ATIVO
                  </span>
                ) : (
                  <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] px-1.5 py-0.5 rounded font-semibold">
                    DESATIVADO
                  </span>
                )}
              </span>
              <span className="text-[11px] text-slate-600 block mt-0.5 leading-tight">
                {isInfluencer 
                  ? 'Jogador habilitado como influenciador. Liberado para receber saldo demo de divulgação e ter link de convite próprio.' 
                  : 'Ative para transformar o jogador em influenciador e liberar a concessão de saldo pelo afiliado.'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                const next = !isInfluencer;
                setIsInfluencer(next);
                if (!next && !isAdmin) {
                  // Se desativar o modo influenciador, reseta o saldo para o original pois afiliado só altera saldo de influenciador
                  setBalanceInput((indication.referredBalance ?? 0).toString());
                }
              }}
              className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border shrink-0 ${
                isInfluencer ? 'bg-amber-500 border-amber-500' : 'bg-slate-200 border-slate-300'
              }`}
              title={isInfluencer ? 'Desativar Modo Influenciador' : 'Ativar Modo Influenciador'}
            >
              <div
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                  isInfluencer ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Influencer Commission Rate Slider */}
          {isInfluencer && (
            <div className="space-y-2 pt-3 mt-3 border-t border-amber-200/60">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <Percent className="w-3 h-3 text-amber-600" />
                  Comissão RevShare do Influenciador
                </label>
                <span className="text-xs font-black font-mono text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                  {influencerRate}%
                </span>
              </div>
              <input
                type="range"
                min="10"
                max={maxAllowedRate}
                step="1"
                value={influencerRate}
                onChange={(e) => setInfluencerRate(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                <span>Mín: 10%</span>
                <span>Sua margem retida: <strong className="text-slate-800 font-bold">{Math.max(10, affiliateRevShare - influencerRate)}%</strong></span>
                <span>Máx: {maxAllowedRate}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Section 1: Saldo do Jogador */}
        <div className={`space-y-2.5 p-4 rounded-2xl border transition-all ${
          !isInfluencer && !isAdmin 
            ? 'bg-slate-50/80 border-slate-200 opacity-90' 
            : 'bg-[#F8FAFC] border-[#E2E8F0]'
        }`}>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Wallet className={`w-4 h-4 ${!isInfluencer && !isAdmin ? 'text-slate-400' : 'text-emerald-600'}`} />
              Saldo do Jogador
              {!isInfluencer && !isAdmin && (
                <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[9px] px-1.5 py-0.2 rounded font-black">
                  BLOQUEADO
                </span>
              )}
            </span>
            <span className="text-[10px] text-slate-400 font-normal normal-case">
              {!isInfluencer && !isAdmin ? 'Requer Modo Influenciador' : 'Saldo de demonstração'}
            </span>
          </label>

          {/* Banner de restrição quando não é influenciador */}
          {!isInfluencer && !isAdmin ? (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-amber-950">Concessão de Saldo Restrita:</strong>
                O afiliado <strong>só pode colocar saldo em contas no Modo Influenciador</strong>. Ative o Modo Influenciador acima para liberar a concessão de saldo para este jogador.
              </div>
            </div>
          ) : (
            /* Banner informativo sobre bloqueio de saque quando influenciador recebe saldo */
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-[11px] font-medium flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold block text-rose-900">Proteção Financeira (Sem Saques):</strong>
                Todo saldo adicionado por afiliado nesta conta é destinado a <strong>demonstração/divulgação</strong>. O jogador <strong>não poderá sacar</strong> este valor.
              </div>
            </div>
          )}

          <div className="relative flex items-center">
            <span className="absolute left-3.5 text-xs font-bold text-slate-400 font-mono">R$</span>
            <input
              type="number"
              step="0.01"
              disabled={!isInfluencer && !isAdmin}
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              className="w-full bg-white border border-[#CBD5E1] focus:border-[#111111] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-[#111111] font-mono text-lg font-bold pl-10 pr-3.5 py-2.5 rounded-xl outline-none shadow-xs transition-all"
              placeholder="0.00"
            />
          </div>

          {/* Preset Buttons */}
          <div className="grid grid-cols-4 gap-1.5 pt-0.5">
            <button
              type="button"
              disabled={!isInfluencer && !isAdmin}
              onClick={() => addPreset(100)}
              className="py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-slate-700 border border-slate-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              +R$ 100
            </button>
            <button
              type="button"
              disabled={!isInfluencer && !isAdmin}
              onClick={() => addPreset(500)}
              className="py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-slate-700 border border-slate-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              +R$ 500
            </button>
            <button
              type="button"
              disabled={!isInfluencer && !isAdmin}
              onClick={() => addPreset(1000)}
              className="py-1.5 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-slate-700 border border-slate-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              +R$ 1.000
            </button>
            <button
              type="button"
              disabled={!isInfluencer && !isAdmin}
              onClick={() => setBalanceInput('0')}
              className="py-1.5 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 disabled:hover:bg-rose-50 disabled:cursor-not-allowed text-rose-700 border border-rose-200 rounded-xl text-[10px] font-bold transition-all cursor-pointer shadow-2xs active:scale-95"
            >
              Zerar
            </button>
          </div>
        </div>


        {/* Section 3: Status de Parceiro VIP (Acesso ao parceiro.goalliancehub.com / /parceiros) */}
        {isAdmin && (
          <div className="space-y-3 bg-gradient-to-br from-amber-500/5 via-emerald-500/5 to-slate-50 p-4 rounded-2xl border border-amber-200/80 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="pr-1">
                <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                  <Crown className="w-4 h-4 text-amber-500" />
                  Definir como Parceiro VIP
                  {partnerApproved ? (
                    <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] px-1.5 py-0.5 rounded font-black">
                      ACESSO LIBERADO
                    </span>
                  ) : isPartner ? (
                    <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] px-1.5 py-0.5 rounded font-black">
                      SOLICITADO
                    </span>
                  ) : (
                    <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[9px] px-1.5 py-0.5 rounded font-semibold">
                      DESATIVADO
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-slate-600 block mt-0.5 leading-tight">
                  Permite acessar o painel <strong className="text-slate-900">parceiro.goalliancehub.com</strong> ou rota <strong className="text-slate-900">/parceiros</strong> para recrutar afiliados.
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const nextApproved = !partnerApproved;
                  setPartnerApproved(nextApproved);
                  setIsPartner(nextApproved);
                }}
                className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer border shrink-0 ${
                  partnerApproved ? 'bg-emerald-600 border-emerald-600' : 'bg-slate-200 border-slate-300'
                }`}
                title={partnerApproved ? 'Revogar status de Parceiro' : 'Aprovar e Liberar Painel de Parceiro'}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                    partnerApproved ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            {partnerApproved && (
              <div className="space-y-2 pt-2 border-t border-amber-200/60">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Código de Parceiro Oficial (Recrutamento de Afiliados)
                  </label>
                  <input
                    type="text"
                    value={partnerCode}
                    onChange={(e) => setPartnerCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                    placeholder="Ex: VIP777, MASTER"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="bg-white/90 border border-amber-200/80 rounded-xl p-2.5 text-[10px] text-slate-600 space-y-1">
                  <div className="flex items-center gap-1 font-bold text-amber-900">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Benefícios ativos deste parceiro:</span>
                  </div>
                  <p>• Acesso ao painel completo em <span className="font-mono text-emerald-700 font-bold">parceiro.goalliancehub.com</span> ou <span className="font-mono text-emerald-700 font-bold">/parceiros</span></p>
                  <p>• Link de recrutamento exclusivo com código: <strong className="font-mono text-slate-900">{partnerCode || 'VIP'}</strong></p>
                  <p>• Visualização ao vivo de saques, depósitos e ranking dos seus afiliados</p>
                </div>
              </div>
            )}
          </div>
        )}

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
    </div>,
    document.body
  );
};
