import React, { useState, useEffect } from 'react';
import {
  Bell,
  Send,
  Smartphone,
  Users,
  CheckCircle2,
  Clock,
  MessageSquare,
  Sparkles,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Award,
  Flame,
  Radio,
  History,
  AlertCircle,
  ExternalLink,
  Volume2
} from 'lucide-react';
import {
  IOSCard,
  IOSSegmentedControl,
  IOSBadge,
  IOSButton
} from './IOSComponents';
import {
  getNotificationState,
  requestNotificationPermission,
  triggerInAppNotification,
  isInsideIframe
} from '../../lib/pwaNotification';

interface AdminNotificationsTabProps {
  onSendNotification: (payload: {
    title: string;
    message: string;
    target: string;
    scheduledFor?: string;
  }) => Promise<void>;
  notificationsList?: any[];
  sending: boolean;
  token?: string;
}

interface NotificationHistoryItem {
  id: string;
  title: string;
  body: string;
  target: string;
  targetLabel: string;
  sentCount: number;
  totalEligibleAffiliates: number;
  createdAt: string;
  sentBy: string;
}

export const AdminNotificationsTab: React.FC<AdminNotificationsTabProps> = ({
  onSendNotification,
  sending,
  token
}) => {
  const [title, setTitle] = useState('🔥 Nova Campanha de Comissões Liberada!');
  const [message, setMessage] = useState('Aproveite as novas taxas de CPA deste fim de semana. Compartilhe seu link exclusivo e turbine seus lucros agora!');
  const [target, setTarget] = useState<'all_affiliates' | 'active_affiliates' | 'influencers'>('all_affiliates');
  const [testingSelf, setTestingSelf] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [stats, setStats] = useState<{
    totalAffiliates: number;
    subscribedAffiliates: number;
    history: NotificationHistoryItem[];
  }>({
    totalAffiliates: 0,
    subscribedAffiliates: 0,
    history: []
  });
  const [loadingStats, setLoadingStats] = useState(false);

  const notifState = getNotificationState();
  const inIframe = isInsideIframe();

  const fetchStats = async () => {
    try {
      const authToken = token || localStorage.getItem('token') || localStorage.getItem('auth_token') || localStorage.getItem('pg_auth_token');
      if (!authToken) return;
      setLoadingStats(true);
      const res = await fetch('/api/admin/notifications', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setStats({
          totalAffiliates: data.totalAffiliates || 0,
          subscribedAffiliates: data.subscribedAffiliates || 0,
          history: data.history || []
        });
      }
    } catch {
      // silent
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [token]);

  const targetOptions = [
    { id: 'all_affiliates' as const, label: 'Todos os Afiliados' },
    { id: 'active_affiliates' as const, label: 'Afiliados Ativos' },
    { id: 'influencers' as const, label: 'Influenciadores VIP' }
  ];

  const quickTemplates = [
    {
      title: '🔥 Nova Bonificação de CPA!',
      message: 'Comissões turbinadas ativadas para todos os depósitos das próximas 48 horas. Acelere seus disparos!',
      target: 'all_affiliates' as const
    },
    {
      title: '📈 Meta Batida = Bônus Extra!',
      message: 'Parabéns pelos resultados! Os afiliados com mais de 5 indicações ativas receberão bonificação no saldo.',
      target: 'active_affiliates' as const
    },
    {
      title: '⭐ Material Exclusivo VIP Liberado',
      message: 'Criativos em alta resolução e copies de alta conversão já estão disponíveis no seu painel.',
      target: 'influencers' as const
    }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    await onSendNotification({ title, message, target });
    fetchStats();
  };

  const handleTestSelf = async () => {
    setTestingSelf(true);
    setTestResult(null);
    try {
      const authToken = token || localStorage.getItem('pg_auth_token');
      const endpoint = localStorage.getItem('pg_push_endpoint');

      // 1. Trigger in-app local notification banner and sound immediately
      triggerInAppNotification({
        title: title || 'Teste: Você vendeu! 💰',
        body: message || 'Comissão de R$ 75,00 creditada na sua conta!',
        url: '/?tab=affiliates'
      });

      // 2. Also send push request to backend
      const res = await fetch('/api/push/test-self', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          title: title || 'Teste: Você vendeu! 💰',
          body: message || 'Comissão de R$ 75,00 creditada no seu saldo!',
          endpoint,
          forceAll: true
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTestResult(`Notificação disparada com sucesso! (${data.sentDevices || 1} dispositivo(s) acionado(s) + som emitido)`);
      } else {
        setTestResult('Notificação in-app emitida com som!');
      }
    } catch (err: any) {
      setTestResult('Disparado localmente com som!');
    } finally {
      setTestingSelf(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Affiliate Audience Stats Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Afiliados Cadastrados
            </span>
            <div className="text-xl font-black text-slate-900 flex items-center gap-2">
              {stats.totalAffiliates}
              <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full">
                Exclusivo
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Dispositivos com Push Ativo
            </span>
            <div className="text-xl font-black text-slate-900 flex items-center gap-2">
              {stats.subscribedAffiliates}
              <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                Prontos
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">
              Blindagem de Público
            </span>
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 mt-1">
              <span>Apenas Afiliados</span>
              <span className="text-[10px] font-medium text-slate-500">(Zero jogadores comuns)</span>
            </div>
          </div>
        </div>
      </div>

      {/* PWA & Notification Diagnostics Card */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 border border-slate-800 shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white">Diagnóstico de Entrega PWA</h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  Camada Dupla Ativa (OS Push + In-App PWA)
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Permissão: <span className="font-semibold text-slate-200">{notifState.permission === 'granted' ? 'Liberada' : notifState.permission}</span> • 
                Service Worker: <span className="font-semibold text-slate-200">{notifState.swRegistered ? 'Ativo' : 'Registrando'}</span> • 
                Áudio (/venda.mp3): <span className="font-semibold text-emerald-400">Pronto</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {inIframe && (
              <a
                href={window.location.href}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Abrir em nova aba para testar Push nativo de tela de bloqueio do sistema operacional"
              >
                <span>Abrir em Nova Aba</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
            <button
              type="button"
              onClick={handleTestSelf}
              disabled={testingSelf}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              {testingSelf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>Testar neste Aparelho Agora</span>
            </button>
          </div>
        </div>

        {testResult && (
          <div className="mt-3 p-2.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{testResult}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Form + iPhone Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Compose Form */}
        <div className="lg:col-span-7 space-y-5">
          <IOSCard className="p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-black/[0.04] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF9500]/20 text-[#D97706] flex items-center justify-center font-bold">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Disparo de Push para Afiliados
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-800 rounded-md">
                      Somente Afiliados
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Envie alertas instantâneos diretamente para os afiliados da plataforma
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Templates */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Modelos Rápidos de Campanha:
              </label>
              <div className="flex flex-wrap gap-2">
                {quickTemplates.map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTitle(item.title);
                      setMessage(item.message);
                      setTarget(item.target);
                    }}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-amber-50 hover:border-amber-300 text-slate-700 hover:text-amber-900 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>{item.title}</span>
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Público-Alvo dos Afiliados</span>
                  <span className="text-[10px] font-medium text-amber-700">
                    Restrito a membros com programa de afiliados ativo
                  </span>
                </label>
                <IOSSegmentedControl
                  options={targetOptions}
                  value={target}
                  onChange={setTarget}
                  className="w-full"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Título da Notificação</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: 🚀 Bônus Especial de Afiliado Liberado!"
                  className="w-full h-10 px-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs font-medium rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Mensagem</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Digite a mensagem que aparecerá na tela do afiliado..."
                  className="w-full p-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs font-medium rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all resize-none"
                  required
                />
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Segurança Garantida:</strong> Jogadores normais não recebem esta mensagem. O sistema filtra estritamente os IDs associados a afiliados, influenciadores e seus dispositivos inscritos.
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <IOSButton
                  type="submit"
                  variant="primary"
                  disabled={sending}
                  className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Disparar Notificação Exclusiva para os Afiliados</span>
                </IOSButton>
              </div>
            </form>
          </IOSCard>
        </div>

        {/* Right: Realistic iPhone Lockscreen Live Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="w-full max-w-xs bg-[#1C1C1E] p-4 rounded-[44px] shadow-2xl border-4 border-[#3A3A3C] relative overflow-hidden text-white flex flex-col justify-between aspect-[9/18]">
            {/* iPhone Dynamic Island */}
            <div className="w-24 h-6 bg-black rounded-full mx-auto mb-6 flex items-center justify-between px-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#1C1C1E]" />
              <div className="w-2 h-2 rounded-full bg-amber-500/80" />
            </div>

            {/* iPhone Clock */}
            <div className="text-center space-y-1 my-auto">
              <div className="text-[11px] font-medium text-white/60">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </div>
              <div className="text-5xl font-light tracking-tight text-white">
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            {/* Push Notification Banner */}
            <div className="bg-white/20 backdrop-blur-xl border border-white/25 rounded-2xl p-3.5 text-slate-900 shadow-xl space-y-1 text-left mb-12">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md bg-amber-500 text-white flex items-center justify-center text-[9px] font-bold">
                    ★
                  </div>
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">ALLIANCE • AFILIADOS</span>
                </div>
                <span className="text-[9px] text-white/70">agora</span>
              </div>
              <div className="text-xs font-bold text-white tracking-tight">
                {title || 'Título da Notificação'}
              </div>
              <div className="text-[11px] text-white/90 leading-tight">
                {message || 'Corpo da mensagem aparecerá aqui para o afiliado.'}
              </div>
            </div>

            {/* iPhone Home Bar */}
            <div className="w-28 h-1 bg-white/40 rounded-full mx-auto mb-2" />
          </div>
        </div>
      </div>

      {/* History of Dispatches to Affiliates */}
      {stats.history.length > 0 && (
        <IOSCard className="p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-black/[0.04] pb-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-bold text-slate-900">
                Histórico de Disparos para Afiliados
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-medium">
              Últimos {stats.history.length} envios
            </span>
          </div>

          <div className="space-y-2.5">
            {stats.history.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900">
                      {item.title}
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                      {item.targetLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2">
                    {item.body}
                  </p>
                </div>

                <div className="text-left sm:text-right shrink-0 space-y-0.5">
                  <div className="text-[11px] font-bold text-emerald-700 flex items-center sm:justify-end gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{item.sentCount} push entregues</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </IOSCard>
      )}
    </div>
  );
};
