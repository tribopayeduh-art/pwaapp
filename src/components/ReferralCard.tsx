import React, { useState } from 'react';
import { Copy, Check, Share2, Users, DollarSign, Wallet, ArrowUpRight } from 'lucide-react';
import { AffiliateInfo } from '../types';

interface ReferralCardProps {
  affiliateInfo: AffiliateInfo;
  onCopySuccess?: () => void;
  onOpenWithdraw?: () => void;
}

export const ReferralCard: React.FC<ReferralCardProps> = ({ affiliateInfo, onCopySuccess, onOpenWithdraw }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(affiliateInfo.referralLink);
    } catch {
      const input = document.createElement('textarea');
      input.value = affiliateInfo.referralLink;
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    if (onCopySuccess) onCopySuccess();
    setTimeout(() => setCopied(false), 2000);
  };

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  return (
    <div className="affiliate-referral-card space-y-4">
      {/* Stats Overview Grid */}
      <div className="affiliate-commission-banner bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3 flex items-center justify-between text-emerald-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold">Comissão sobre Depósitos</span>
        </div>
        <span className="text-xs font-extrabold bg-emerald-600 text-white px-2.5 py-0.5 rounded-full shadow-xs">
          {affiliateInfo.revSharePercent ?? 70}% em todos os depósitos
        </span>
      </div>

      <div className="affiliate-stat-grid grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E5E5] text-center">
          <div className="w-8 h-8 rounded-xl bg-[#F5F5F5] flex items-center justify-center mx-auto mb-1.5 text-[#111111]">
            <Users className="w-4 h-4 stroke-[2]" />
          </div>
          <span className="text-[10px] text-[#737373] font-medium block">Indicações</span>
          <span className="font-bold text-sm text-[#111111]">{affiliateInfo.indicationsCount}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E5E5] text-center">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-1.5 text-emerald-600">
            <Wallet className="w-4 h-4 stroke-[2]" />
          </div>
          <span className="text-[10px] text-[#737373] font-medium block">Depósitos da Rede</span>
          <span className="font-bold text-xs text-emerald-600">{formatCurrency(affiliateInfo.totalNetworkDeposits || 0)}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E5E5] text-center">
          <div className="w-8 h-8 rounded-xl bg-[#F5F5F5] flex items-center justify-center mx-auto mb-1.5 text-[#111111]">
            <DollarSign className="w-4 h-4 stroke-[2]" />
          </div>
          <span className="text-[10px] text-[#737373] font-medium block">Comissão Total</span>
          <span className="font-bold text-xs text-[#111111]">{formatCurrency(affiliateInfo.commissionTotal)}</span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-[#E5E5E5] text-center flex flex-col justify-between">
          <div>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center mx-auto mb-1.5 text-emerald-600">
              <Wallet className="w-4 h-4 stroke-[2]" />
            </div>
            <span className="text-[10px] text-[#737373] font-medium block">Saldo de Afiliado</span>
            <span className="font-bold text-xs text-emerald-700">{formatCurrency(affiliateInfo.affiliateBalance)}</span>
          </div>
          {onOpenWithdraw && (
            <button
              onClick={onOpenWithdraw}
              type="button"
              className="mt-1.5 py-1 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer shadow-2xs"
            >
              <ArrowUpRight className="w-3 h-3" />
              Sacar
            </button>
          )}
        </div>
      </div>

      {/* Referral Link Box */}
      <div className="affiliate-link-card bg-white text-[#111111] rounded-[24px] p-5 border border-[#E5E5E5] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#111111] flex items-center gap-1.5">
            <Share2 className="w-3.5 h-3.5 text-[#737373]" />
            Meu link de indicação
          </span>
          <span className="text-[10px] font-mono font-bold uppercase bg-[#F5F5F5] text-[#111111] px-2 py-0.5 rounded-md border border-[#E5E5E5]">
            {affiliateInfo.referralCode}
          </span>
        </div>

        <div className="bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl p-3 flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-[#111111] truncate select-all">
            {affiliateInfo.referralLink}
          </span>
        </div>

        <button
          onClick={handleCopy}
          className={`w-full h-11 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            copied
              ? 'bg-[#111111] text-white'
              : 'bg-[#111111] text-white hover:bg-black active:scale-[0.98]'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400 stroke-[2.5]" />
              Link copiado com sucesso!
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 stroke-[2]" />
              Copiar link
            </>
          )}
        </button>
      </div>
    </div>
  );
};
