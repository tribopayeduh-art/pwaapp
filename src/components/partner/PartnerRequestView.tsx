import React, { useState } from 'react';
import {
  ShieldCheck,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
  Users,
  Activity,
  Sliders,
  DollarSign,
  Loader2,
  ArrowLeft,
  Crown
} from 'lucide-react';
import { User } from '../../types';

interface PartnerRequestViewProps {
  user: User;
  token?: string | null;
  onBack: () => void;
  onRequestSubmitted: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PartnerRequestView: React.FC<PartnerRequestViewProps> = ({
  user,
  token,
  onBack,
  onRequestSubmitted,
  onShowToast
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const isAlreadyRequested = Boolean(user.partnerRequested);

  const getAuthToken = () => {
    return (
      token ||
      localStorage.getItem('pg_auth_token') ||
      localStorage.getItem('paygateway_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('pg_auth_token') ||
      ''
    );
  };

  const handleCheckApproval = async () => {
    setChecking(true);
    try {
      onRequestSubmitted();
    } finally {
      setTimeout(() => setChecking(false), 800);
    }
  };

  const handleRequest = async () => {
    setSubmitting(true);
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        onShowToast('Sessão expirada. Por favor, faça login novamente.', 'error');
        return;
      }
      const res = await fetch('/api/partner/request-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        onShowToast('Solicitação de acesso enviada com sucesso! Aguarde a liberação pelo Administrador.', 'success');
        onRequestSubmitted();
      } else {
        onShowToast(data.error || 'Erro ao solicitar acesso.', 'error');
      }
    } catch (e: any) {
      onShowToast('Erro de conexão ao enviar solicitação.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 bg-zinc-50/50">
      <div className="max-w-md w-full bg-white rounded-3xl border border-zinc-200/80 p-6 md:p-8 shadow-xl relative overflow-hidden text-center">
        {/* Top Gradient Banner */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600" />

        <div className="flex justify-start mb-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Hub
          </button>
        </div>

        <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
          <Crown className="w-8 h-8" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-3 border border-emerald-100">
          <Sparkles className="w-3.5 h-3.5" />
          Programa Oficial de Parceiros
        </div>

        <h2 className="text-2xl font-black text-zinc-900 tracking-tight">
          Painel de Parceiro VIP
        </h2>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
          Portal exclusivo <span className="font-mono font-semibold text-zinc-700">parceiro.goalliancehub.com</span>.
          O acesso requer aprovação prévia do Administrador do Alliance Hub.
        </p>

        {/* Feature Highlights */}
        <div className="my-6 space-y-2.5 text-left">
          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-start gap-3">
            <div className="p-1.5 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-xs font-bold text-zinc-800 block">Recrutamento Exclusivo</strong>
              <span className="text-[11px] text-zinc-500">
                Links personalizados para atrair sua própria base de afiliados para o Hub.
              </span>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-start gap-3">
            <div className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700 shrink-0 mt-0.5">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-xs font-bold text-zinc-800 block">Controle Total da Base</strong>
              <span className="text-[11px] text-zinc-500">
                Acompanhe o que cada afiliado faz, ranking de faturamento e bloqueie saques automáticos com 1 clique.
              </span>
            </div>
          </div>

          <div className="p-3 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-start gap-3">
            <div className="p-1.5 rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <strong className="text-xs font-bold text-zinc-800 block">Jogadores & Métricas ao Vivo</strong>
              <span className="text-[11px] text-zinc-500">
                Radar em tempo real com apostas, vitórias e conversão FTD da sua rede.
              </span>
            </div>
          </div>
        </div>

        {/* Status / Request Button */}
        {isAlreadyRequested ? (
          <div className="space-y-3">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs">
              <div className="flex items-center justify-center gap-2 font-bold mb-1">
                <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                Solicitação em Análise
              </div>
              <p className="text-[11px] text-amber-700">
                Sua solicitação foi enviada e está sendo avaliada pelo Administrador. Se o admin já liberou sua conta, clique abaixo para atualizar seu acesso imediatamente.
              </p>
            </div>

            <button
              onClick={handleCheckApproval}
              disabled={checking}
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10 transition cursor-pointer disabled:opacity-50"
            >
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando Permissão...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  Já Fui Liberado pelo Admin (Entrar no Painel)
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            <button
              onClick={handleRequest}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/10 transition active:scale-98 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enviando Solicitação...
                </>
              ) : (
                <>
                  <Crown className="w-4 h-4 text-amber-400" />
                  Solicitar Liberação de Parceiro
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <button
              onClick={handleCheckApproval}
              disabled={checking}
              className="w-full py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {checking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  O Admin já liberou minha conta (Verificar Agora)
                </>
              )}
            </button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-zinc-100 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Permissão controlada com segurança pelo Admin
        </div>
      </div>
    </div>
  );
};

// Clock helper
function Clock(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
