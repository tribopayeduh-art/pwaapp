import React, { useState } from 'react';
import {
  X,
  User,
  Mail,
  Phone,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  MessageCircle,
  Bell,
  Clock,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Percent,
  Sliders
} from 'lucide-react';
import { PartnerAffiliateStats } from '../../types';
import { getPartnerCutFromAffiliateRevShare, MAX_PARTNER_AFFILIATE_COMMISSION } from '../../utils/partnerCommission';

interface PartnerAffiliateDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  affiliate: PartnerAffiliateStats | null;
  onToggleAutoWithdraw: (affiliateId: string, currentBlocked: boolean) => Promise<boolean>;
  onOpenSendAlert: (affiliate: PartnerAffiliateStats) => void;
  onOpenEditCommission?: (affiliate: PartnerAffiliateStats) => void;
}

export const PartnerAffiliateDetailModal: React.FC<PartnerAffiliateDetailModalProps> = ({
  isOpen,
  onClose,
  affiliate,
  onToggleAutoWithdraw,
  onOpenSendAlert,
  onOpenEditCommission
}) => {
  const [toggling, setToggling] = useState(false);

  if (!isOpen || !affiliate) return null;

  const handleToggleLock = async () => {
    setToggling(true);
    await onToggleAutoWithdraw(affiliate.id, affiliate.autoWithdrawBlocked);
    setToggling(false);
  };

  const cleanPhone = (affiliate.phone || '').replace(/\D/g, '');
  const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}` : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-zinc-200 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Affiliate Profile Header */}
        <div className="flex items-start gap-3.5 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center text-lg font-bold shadow-md shadow-emerald-500/20">
            {affiliate.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-zinc-900">{affiliate.name}</h3>
              {affiliate.isOnlineNow ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600">
                  Offline
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
              <Mail className="w-3.5 h-3.5" />
              {affiliate.email}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[11px] font-mono bg-zinc-100 px-2 py-0.5 rounded text-zinc-700 font-semibold">
                Ref: {affiliate.referralCode}
              </span>
              <span className="text-[11px] text-zinc-400">
                Cadastro: {new Date(affiliate.createdAt).toLocaleDateString('pt-BR')}
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold border border-emerald-200/80 transition shadow-2xs active:scale-95"
            >
              <MessageCircle className="w-4 h-4 text-emerald-600" />
              WhatsApp Direto
            </a>
          ) : (
            <div className="flex items-center justify-center py-2.5 px-3 rounded-xl bg-zinc-50 border border-zinc-200/60 text-zinc-400 text-xs font-medium">
              Sem WhatsApp
            </div>
          )}
          <button
            onClick={() => onOpenSendAlert(affiliate)}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition cursor-pointer shadow-2xs active:scale-95"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            Enviar Notificação
          </button>
        </div>

        {/* Commission Dynamics Control */}
        <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/50 mb-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Comissão e Margem
                </h4>
                <div className="flex items-center gap-3 mt-1.5 text-xs">
                  <div>
                    <span className="text-zinc-500 text-[10px] block font-semibold uppercase tracking-wider">Comissão Afiliado:</span>
                    <strong className="text-emerald-700 font-black text-sm tabular-nums">
                      {affiliate.revSharePercent ?? 70}%
                    </strong>
                  </div>
                  <div className="h-6 w-px bg-indigo-200" />
                  <div>
                    <span className="text-zinc-500 text-[10px] block font-semibold uppercase tracking-wider">Sua Margem Parceiro:</span>
                    <strong className="text-indigo-700 font-black text-sm tabular-nums">
                      {getPartnerCutFromAffiliateRevShare(affiliate.revSharePercent ?? 70)}%
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {onOpenEditCommission && (
              <button
                onClick={() => onOpenEditCommission(affiliate)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-2xs cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 active:scale-95 self-start sm:self-auto shrink-0"
              >
                <Sliders className="w-3.5 h-3.5" />
                Alterar Taxa
              </button>
            )}
          </div>
        </div>

        {/* Security Control: Auto-Withdraw Circuit Breaker */}
        <div className={`p-4 rounded-2xl border transition-all mb-4 shadow-2xs ${
          affiliate.autoWithdrawBlocked
            ? 'bg-rose-50/70 border-rose-200 text-rose-900'
            : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              {affiliate.autoWithdrawBlocked ? (
                <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <Lock className="w-4 h-4" />
                </div>
              ) : (
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Unlock className="w-4 h-4" />
                </div>
              )}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider">
                  Saque Automático PIX
                </h4>
                <p className="text-xs mt-0.5 opacity-90 leading-relaxed">
                  {affiliate.autoWithdrawBlocked
                    ? 'BLOQUEADO: Saques deste afiliado passam por análise manual de compliance.'
                    : 'LIBERADO: Saques rápidos processados automaticamente via PIX na Dotfy.'}
                </p>
              </div>
            </div>

            <button
              onClick={handleToggleLock}
              disabled={toggling}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer whitespace-nowrap active:scale-95 self-start sm:self-auto shrink-0 ${
                affiliate.autoWithdrawBlocked
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {toggling
                ? 'Atualizando...'
                : affiliate.autoWithdrawBlocked
                ? 'Desbloquear Saques'
                : 'Bloquear Saque'}
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Jogadores na Rede Dele</span>
            <div className="flex items-baseline gap-1 mt-1">
              <strong className="text-lg font-extrabold text-zinc-900">{affiliate.totalPlayersInvited}</strong>
              <span className="text-xs text-zinc-500">jogadores</span>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Total Depositado</span>
            <div className="flex items-baseline gap-1 mt-1">
              <strong className="text-lg font-extrabold text-emerald-600">
                R$ {affiliate.totalDeposited.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Volume Apostado</span>
            <div className="flex items-baseline gap-1 mt-1">
              <strong className="text-lg font-extrabold text-zinc-900">
                R$ {affiliate.totalVolumeWagered.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
            <span className="text-[10px] uppercase font-semibold text-zinc-500 block">Comissão p/ Você</span>
            <div className="flex items-baseline gap-1 mt-1">
              <strong className="text-lg font-extrabold text-indigo-600">
                R$ {affiliate.commissionGeneratedForPartner.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        </div>

        {/* Recent Downline Activity */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-zinc-500" />
              Atividades Recentes da Rede
            </h4>
            <span className="text-[11px] text-zinc-400">Últimos eventos</span>
          </div>

          {affiliate.recentActivity && affiliate.recentActivity.length > 0 ? (
            <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-100 overflow-hidden">
              {affiliate.recentActivity.map((act) => (
                <div key={act.id} className="p-3 bg-white flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      act.type === 'deposit' ? 'bg-emerald-500' : 'bg-rose-500'
                    }`} />
                    <span className="font-medium text-zinc-800">{act.description}</span>
                  </div>
                  <div className="text-right">
                    {act.amount !== undefined && (
                      <span className={`font-bold block ${
                        act.type === 'deposit' ? 'text-emerald-600' : 'text-zinc-900'
                      }`}>
                        R$ {act.amount.toFixed(2)}
                      </span>
                    )}
                    <span className="text-[10px] text-zinc-400">
                      {new Date(act.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 bg-zinc-50 rounded-2xl text-center text-xs text-zinc-400 border border-zinc-100">
              Nenhuma movimentação recente registrada na rede deste afiliado.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
