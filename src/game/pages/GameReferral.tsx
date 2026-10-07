import React, { useState, useEffect } from 'react';
import { GameUser } from '../types';
import { IndicationItem } from '../../types';
import { ManageIndicatedModal } from '../../components/ManageIndicatedModal';
import { AffiliateWithdrawModal } from '../../components/AffiliateWithdrawModal';
import {
  Users,
  Copy,
  CheckCircle2,
  Share2,
  ArrowLeft,
  ArrowUpRight,
  Gift,
  Coins,
  X,
  Crown,
  Settings,
  DollarSign,
  UserCheck,
} from 'lucide-react';

interface GameReferralProps {
  user: GameUser | null;
  onBack: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onOpenWithdraw?: () => void;
}

interface AffiliateData {
  id: string;
  referralCode: string;
  referralLink: string;
  indicationsCount: number;
  commissionTotal: number;
  affiliateBalance: number;
  revSharePercent?: number;
  indications: IndicationItem[];
}

export const GameReferral: React.FC<GameReferralProps> = ({
  user,
  onBack,
  onShowToast,
  onOpenWithdraw,
}) => {
  const [data, setData] = useState<AffiliateData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedIndication, setSelectedIndication] = useState<IndicationItem | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState<boolean>(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const token = localStorage.getItem('pg_auth_token');
    if (token) {
      fetch('/api/affiliates/info', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((resData) => {
          if (resData) setData(resData);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const referralCode =
    data?.referralCode ||
    user?.referralCode ||
    (user?.id ? user.id.substring(0, 8).toUpperCase() : '') ||
    'b6a9fa03';

  // Construct referral link for blockwinner.site pointing directly to /cadastro
  const isBlockDomain =
    typeof window !== 'undefined' &&
    (window.location.hostname.toLowerCase().includes('blockwinner') ||
      window.location.hostname.toLowerCase().includes('blockwinn'));
  const baseUrl = isBlockDomain ? window.location.origin : 'https://blockwinner.site';
  const referralLink = `${baseUrl}/cadastro?ref=${referralCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    if (onShowToast) onShowToast('Link de indicação copiado com sucesso!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWithdrawClick = () => {
    if (onOpenWithdraw) {
      onOpenWithdraw();
    } else {
      setWithdrawModalOpen(true);
    }
  };

  const formattedBalance = (data?.affiliateBalance || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedTotalReceived = (data?.commissionTotal || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const totalIndicados = data?.indicationsCount || 0;

  return (
    <div className="min-h-screen bg-[#070D22] text-white p-3 sm:p-4 pb-28 relative overflow-hidden select-none bg-[linear-gradient(to_right,#15234A20_1px,transparent_1px),linear-gradient(to_bottom,#15234A20_1px,transparent_1px)] bg-[size:24px_24px]">
      {/* Background Ambient Glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -right-20 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md mx-auto space-y-4 relative z-10">
        
        {/* Top Navigation Bar */}
        <div className="flex items-center justify-between pt-1">
          <button
            onClick={onBack}
            type="button"
            className="px-3.5 py-1.5 rounded-xl bg-[#0A122A] border border-[#182955] text-slate-300 hover:text-white hover:border-cyan-400 transition-all cursor-pointer font-mono text-xs font-bold flex items-center gap-1.5 shadow-md active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 text-cyan-400" />
            <span>Voltar</span>
          </button>

          <span className="text-xs font-black font-mono text-cyan-300 uppercase tracking-wider bg-cyan-500/10 px-3.5 py-1 rounded-full border border-cyan-500/30">
            INDICAÇÕES & AFILIADOS ({data?.revSharePercent ?? 70}%)
          </span>
        </div>

        {/* Commission Notice Banner */}
        <div className="bg-[#0A122A] border border-[#00E676]/40 rounded-2xl p-3 flex items-center justify-between text-xs font-mono font-bold text-[#00E676]">
          <span className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400 fill-current" />
            COMISSÃO SOBRE DEPÓSITOS
          </span>
          <span className="bg-[#00E676] text-black font-black px-2.5 py-0.5 rounded-full text-[11px]">
            {data?.revSharePercent ?? 70}% EM TODOS OS DEPÓSITOS
          </span>
        </div>

        {/* Green Main Balance Card (SALDO DE COMISSÕES) */}
        <div className="bg-gradient-to-br from-[#00C853] via-[#00B048] to-[#008A38] rounded-3xl p-5 shadow-2xl text-white space-y-4 relative overflow-hidden border border-[#00E676]/40">
          <div className="flex items-start justify-between">
            {/* Left: Saldo de Comissões */}
            <div className="space-y-0.5">
              <span className="block text-[10px] font-extrabold text-emerald-100 uppercase tracking-wider font-mono">
                SALDO DE COMISSÕES
              </span>
              <p className="text-3xl font-black font-mono tracking-tight drop-shadow-md text-white">
                R$ {formattedBalance}
              </p>
              <p className="text-[11px] font-bold text-emerald-100 font-mono">
                total recebido: R$ {formattedTotalReceived}
              </p>
            </div>

            {/* Right: Indicados */}
            <div className="text-right space-y-0.5">
              <span className="block text-[10px] font-extrabold text-emerald-100 uppercase tracking-wider font-mono">
                INDICADOS
              </span>
              <p className="text-3xl font-black font-mono tracking-tight drop-shadow-md text-white">
                {totalIndicados}
              </p>
              <p className="text-[11px] font-bold text-emerald-100 font-mono">
                no total
              </p>
            </div>
          </div>

          {/* Button: Sacar Comissões */}
          <button
            type="button"
            onClick={handleWithdrawClick}
            className="w-full py-3 px-4 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-2xl text-white font-extrabold text-sm font-mono tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 border border-white/30 shadow-md"
          >
            <span>↑ Sacar Comissões</span>
          </button>
        </div>

        {/* SEU LINK EXCLUSIVO Card */}
        <div className="bg-[#0A122A] border border-[#182955] rounded-3xl p-5 space-y-3.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-black text-[#00E676] uppercase tracking-wider font-mono">
              SEU LINK EXCLUSIVO
            </label>
            <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
              blockwinner.site
            </span>
          </div>

          {/* Link Container Box */}
          <div className="bg-[#050A1A] border border-[#00E676]/40 rounded-2xl p-3.5 text-center text-xs font-mono font-extrabold text-[#00E5FF] truncate shadow-inner select-all">
            {referralLink}
          </div>

          {/* Copiar Button */}
          <button
            type="button"
            onClick={handleCopyLink}
            className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 font-mono shadow-lg active:scale-98 ${
              copied
                ? 'bg-emerald-400 text-black shadow-emerald-400/30'
                : 'bg-[#00E676] hover:bg-[#00C853] text-[#031C0B] shadow-[#00E676]/40'
            }`}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                <span>LINK COPIADO!</span>
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                <span>COPIAR</span>
              </>
            )}
          </button>
        </div>

        {/* Level Grid Cards (N1, N2, N3, N4) */}
        <div className="grid grid-cols-2 gap-3">
          {/* N1 */}
          <div className="bg-[#0A122A] border border-[#182955] rounded-3xl p-4 text-center space-y-2 shadow-xl backdrop-blur-md">
            <div>
              <span className="text-xl font-black text-[#00E676] font-mono block">N1</span>
              <span className="text-[10px] text-slate-400 font-bold font-mono">diretos</span>
            </div>

            <div className="pt-1">
              <span className="text-2xl font-black text-white font-mono block">
                {totalIndicados}
              </span>
              <span className="text-[9px] text-slate-400 font-extrabold font-mono tracking-wider block uppercase">
                INDICADOS
              </span>
            </div>

            <div className="pt-1">
              <span className="text-sm font-black text-white font-mono block">
                R$ {formattedTotalReceived}
              </span>
              <span className="text-[9px] text-slate-400 font-extrabold font-mono tracking-wider block uppercase">
                VOLUME DEPOSITADO
              </span>
            </div>
          </div>

          {/* N2 */}
          <div className="bg-[#0A122A] border border-[#182955] rounded-3xl p-4 text-center space-y-2 shadow-xl backdrop-blur-md">
            <div>
              <span className="text-xl font-black text-[#00E676] font-mono block">N2</span>
              <span className="text-[10px] text-slate-400 font-bold font-mono">2º nível</span>
            </div>

            <div className="pt-1">
              <span className="text-2xl font-black text-white font-mono block">0</span>
              <span className="text-[9px] text-slate-400 font-extrabold font-mono tracking-wider block uppercase">
                INDICADOS
              </span>
            </div>

            <div className="pt-1">
              <span className="text-sm font-black text-white font-mono block">R$ 0,00</span>
              <span className="text-[9px] text-slate-400 font-extrabold font-mono tracking-wider block uppercase">
                VOLUME DEPOSITADO
              </span>
            </div>
          </div>

          {/* N3 */}
          <div className="bg-[#0A122A] border border-[#182955] rounded-3xl p-4 text-center space-y-2 shadow-xl backdrop-blur-md">
            <div>
              <span className="text-xl font-black text-[#00E676] font-mono block">N3</span>
              <span className="text-[10px] text-slate-400 font-bold font-mono">3º nível</span>
            </div>

            <div className="pt-1">
              <span className="text-2xl font-black text-white font-mono block">0</span>
              <span className="text-[9px] text-slate-400 font-extrabold font-mono tracking-wider block uppercase">
                INDICADOS
              </span>
            </div>

            <div className="pt-1">
              <span className="text-sm font-black text-white font-mono block">R$ 0,00</span>
              <span className="text-[9px] text-slate-400 font-extrabold font-mono tracking-wider block uppercase">
                VOLUME DEPOSITADO
              </span>
            </div>
          </div>

          {/* N4 */}
          <div className="bg-[#0A122A] border border-[#182955] rounded-3xl p-4 text-center space-y-2 shadow-xl backdrop-blur-md">
            <div>
              <span className="text-xl font-black text-[#00E676] font-mono block">N4</span>
              <span className="text-[10px] text-slate-400 font-bold font-mono">4º nível</span>
            </div>

            <div className="pt-1">
              <span className="text-2xl font-black text-white font-mono block">0</span>
              <span className="text-[9px] text-slate-400 font-extrabold font-mono tracking-wider block uppercase">
                INDICADOS
              </span>
            </div>

            <div className="pt-1">
              <span className="text-sm font-black text-white font-mono block">R$ 0,00</span>
              <span className="text-[9px] text-slate-400 font-extrabold font-mono tracking-wider block uppercase">
                VOLUME DEPOSITADO
              </span>
            </div>
          </div>
        </div>

        {/* USUÁRIOS INDICADOS LIST WITH MODAL TRIGGER */}
        <div className="bg-[#0A122A] border border-[#182955] rounded-3xl p-5 space-y-3.5 shadow-xl backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-[#00E676] uppercase tracking-wider font-mono flex items-center gap-2">
              <Users className="w-4 h-4" />
              Usuários Indicados ({data?.indications?.length || 0})
            </h3>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
              Clique para alterar saldo/influenciador
            </span>
          </div>

          {data?.indications && data.indications.length > 0 ? (
            <div className="space-y-2.5">
              {data.indications.map((ind) => (
                <div
                  key={ind.id}
                  onClick={() => {
                    setSelectedIndication(ind);
                    setManageModalOpen(true);
                  }}
                  className="p-3 bg-[#050A1A] hover:bg-[#08122E] border border-[#182955] hover:border-cyan-400/60 rounded-2xl flex items-center justify-between text-xs transition-all cursor-pointer group shadow-sm active:scale-98"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold uppercase font-mono group-hover:scale-105 transition-transform">
                      {ind.referredName ? ind.referredName.charAt(0) : 'U'}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-white font-mono text-xs group-hover:text-cyan-300 transition-colors">
                          {ind.referredName}
                        </h4>
                        {ind.isInfluencer && (
                          <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[9px] px-1.5 py-0.2 rounded-full font-bold font-mono flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5 fill-amber-300 text-amber-300" /> Influenciador
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono block">
                        {ind.referredEmail}
                      </span>
                    </div>
                  </div>

                  <div className="text-right space-y-0.5">
                    <span className="text-xs font-black font-mono text-emerald-400 block">
                      R$ {(ind.referredBalance ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] bg-[#15234A] text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-mono font-bold inline-flex items-center gap-1 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                      <Settings className="w-2.5 h-2.5" /> Alterar
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-5 bg-[#050A1A] rounded-2xl border border-dashed border-[#182955] text-center text-xs text-slate-400 space-y-1">
              <Users className="w-6 h-6 mx-auto text-slate-500 mb-1" />
              <p className="font-bold text-slate-200 font-mono">Nenhum jogador indicado ainda</p>
              <p className="text-[11px]">Compartilhe seu link exclusivo para começar a receber indicações.</p>
            </div>
          )}
        </div>

      </div>

      {/* Modal para Gerenciar Jogador Indicado (Modificar Saldo e Influenciador) */}
      <ManageIndicatedModal
        isOpen={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        indication={selectedIndication}
        onShowToast={onShowToast}
        onSaveSuccess={(updated) => {
          if (data) {
            const newIndications = data.indications.map((item) =>
              (item.id === updated.id || item.referredUserId === updated.referredUserId)
                ? updated
                : item
            );
            setData({
              ...data,
              indications: newIndications,
            });
          }
        }}
      />

      <AffiliateWithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        affiliateBalance={data?.affiliateBalance || 0}
        withdrawFee={data?.withdrawFee ?? 0}
        onWithdrawSuccess={(newBalance) => {
          if (data) {
            setData({
              ...data,
              affiliateBalance: newBalance,
            });
          }
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};
