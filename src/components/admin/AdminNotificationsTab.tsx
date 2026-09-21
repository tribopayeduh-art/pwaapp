import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bell,
  Send,
  Users,
  Radio,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Volume2,
  ExternalLink,
  Loader2,
  History,
  Smartphone,
  Search,
  UserCheck,
  Award,
  Wallet,
  Copy,
  Check,
  Target,
  ArrowRight,
  Filter,
  X
} from 'lucide-react';
import {
  triggerInAppNotification,
  getNotificationState,
  isInsideIframe
} from '../../lib/pwaNotification';
import {
  IOSCard,
  IOSSegmentedControl,
  IOSButton,
  IOSSearchBar,
  IOSBadge
} from './IOSComponents';

export interface AffiliateNotificationTarget {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  referralCode: string;
  isInfluencer: boolean;
  hasPush: boolean;
  affiliateBalance: number;
  commissionTotal: number;
  indicationsCount: number;
  registeredGame?: string;
  createdAt?: string;
}

interface AdminNotificationsTabProps {
  onSendNotification: (payload: {
    title: string;
    message: string;
    target: string;
    targetUserId?: string;
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
  const formRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('🔥 Nova Campanha de Comissões Liberada!');
  const [message, setMessage] = useState(
    'Aproveite as novas taxas de CPA deste fim de semana. Compartilhe seu link exclusivo e turbine seus lucros agora!'
  );
  const [target, setTarget] = useState<'all_affiliates' | 'active_affiliates' | 'influencers' | 'single_affiliate'>('all_affiliates');
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateNotificationTarget | null>(null);

  const [testingSelf, setTestingSelf] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testingDiscord, setTestingDiscord] = useState(false);
  const [discordResult, setDiscordResult] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Affiliates list state
  const [affiliates, setAffiliates] = useState<AffiliateNotificationTarget[]>([]);
  const [affiliateSearch, setAffiliateSearch] = useState('');
  const [affiliateFilter, setAffiliateFilter] = useState<'all' | 'push_only' | 'influencers' | 'with_balance'>('all');

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
      const authToken =
        token ||
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        localStorage.getItem('pg_auth_token');
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
        if (Array.isArray(data.affiliates)) {
          setAffiliates(data.affiliates);
        }
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
    { id: 'influencers' as const, label: 'Influenciadores VIP' },
    { id: 'single_affiliate' as const, label: '🎯 Afiliado Específico' }
  ];

  const quickTemplates = [
    {
      title: '🔥 Nova Bonificação de CPA!',
      message: 'Comissões turbinadas ativadas para todos os depósitos das próximas 48 horas. Acelere seus disparos!',
      target: 'all_affiliates' as const
    },
    {
      title: '📈 Meta Batida = Bônus Extra!',
      message: 'Parabéns pelos seus resultados! Como parceiro destaque, liberamos um bônus exclusivo na sua carteira.',
      target: 'active_affiliates' as const
    },
    {
      title: '⭐ Material VIP Liberado para Disparo',
      message: 'Novos criativos em alta definição e roteiros prontos de alta conversão disponíveis no seu painel.',
      target: 'influencers' as const
    }
  ];

  // Filtered affiliates list for selection table
  const filteredAffiliates = useMemo(() => {
    return affiliates.filter((a) => {
      if (affiliateFilter === 'push_only' && !a.hasPush) return false;
      if (affiliateFilter === 'influencers' && !a.isInfluencer) return false;
      if (affiliateFilter === 'with_balance' && a.affiliateBalance <= 0) return false;

      if (!affiliateSearch) return true;
      const q = affiliateSearch.toLowerCase().trim();
      return (
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.referralCode.toLowerCase().includes(q) ||
        (a.phone && a.phone.toLowerCase().includes(q))
      );
    });
  }, [affiliates, affiliateSearch, affiliateFilter]);

  const handleSelectAffiliateForPush = (aff: AffiliateNotificationTarget) => {
    setSelectedAffiliate(aff);
    setTarget('single_affiliate');
    // Smooth scroll to compose form
    if (formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    if (target === 'single_affiliate' && !selectedAffiliate) {
      alert('Por favor, selecione um afiliado na lista abaixo para fazer o disparo exclusivo.');
      return;
    }

    await onSendNotification({
      title,
      message,
      target,
      targetUserId: target === 'single_affiliate' && selectedAffiliate ? selectedAffiliate.userId : undefined
    });
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
        setTestResult(
          `Notificação disparada com sucesso! (${data.sentDevices || 1} dispositivo(s) acionado(s) + som emitido)`
        );
      } else {
        setTestResult('Notificação in-app emitida com som!');
      }
    } catch {
      setTestResult('Disparado localmente com som!');
    } finally {
      setTestingSelf(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  };

  const handleTestDiscord = async () => {
    setTestingDiscord(true);
    setDiscordResult(null);
    try {
      const authToken = token || localStorage.getItem('pg_auth_token');
      const res = await fetch('/api/admin/notifications/test-discord', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
        },
        body: JSON.stringify({
          title: title || 'Teste de Notificação de Afiliado',
          body: message || 'Comissão de R$ 75,00 creditada no seu saldo de afiliado!'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDiscordResult('Notificação entregue com sucesso ao Webhook do Discord!');
      } else {
        setDiscordResult(data.error || 'Falha ao entregar no Webhook do Discord.');
      }
    } catch {
      setDiscordResult('Erro de rede ao conectar ao servidor.');
    } finally {
      setTestingDiscord(false);
      setTimeout(() => setDiscordResult(null), 5000);
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
              <span>Segmentação Direta</span>
              <span className="text-[10px] font-medium text-slate-500">(Geral ou Individual)</span>
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
                Permissão:{' '}
                <span className="font-semibold text-slate-200">
                  {notifState.permission === 'granted' ? 'Liberada' : notifState.permission}
                </span>{' '}
                • Service Worker:{' '}
                <span className="font-semibold text-slate-200">
                  {notifState.swRegistered ? 'Ativo' : 'Registrando'}
                </span>{' '}
                • Áudio (/venda.mp3): <span className="font-semibold text-emerald-400">Pronto</span>
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

      {/* Discord Affiliate Webhook Card */}
      <div className="bg-[#5865F2]/10 border border-[#5865F2]/30 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#5865F2] text-white flex items-center justify-center font-black text-sm shadow-xs">
              DC
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-900">Webhook Discord de Afiliados</h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#5865F2]/20 text-[#5865F2]">
                  Espelhamento em Tempo Real Ativo ✓
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5 font-mono truncate max-w-md sm:max-w-xl">
                https://discordapp.com/api/webhooks/1550213351211139112/4i7vDlRDs4...
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Toda notificação de comissão, novo cadastro, saque ou push disparada para afiliados é enviada automaticamente para este webhook.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestDiscord}
            disabled={testingDiscord}
            className="px-3.5 py-1.5 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0 self-start sm:self-auto"
          >
            {testingDiscord ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>Testar Webhook Discord</span>
          </button>
        </div>

        {discordResult && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
            discordResult.includes('sucesso')
              ? 'bg-emerald-50 border border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border border-rose-300 text-rose-800'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{discordResult}</span>
          </div>
        )}
      </div>

      {/* Main Grid: Form + iPhone Live Preview */}
      <div ref={formRef} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Compose Form */}
        <div className="lg:col-span-7 space-y-5">
          <IOSCard className="p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-black/[0.04] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#FF9500]/20 text-[#D97706] flex items-center justify-center font-bold">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-900 tracking-tight">
                      Disparo de Notificação Push
                    </h2>
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-800 rounded-md">
                      Afiliados
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Envie alertas para todos ou selecione um afiliado específico
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
              {/* Target Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Público-Alvo do Disparo</span>
                  <span className="text-[10px] font-medium text-amber-700">
                    {target === 'single_affiliate'
                      ? '🎯 Disparo exclusivo individual'
                      : 'Restrito a parceiros afiliados'}
                  </span>
                </label>
                <IOSSegmentedControl
                  options={targetOptions}
                  value={target}
                  onChange={(val: any) => {
                    setTarget(val);
                    if (val !== 'single_affiliate') {
                      setSelectedAffiliate(null);
                    }
                  }}
                  className="w-full"
                />
              </div>

              {/* Specific Affiliate Selected Card or Picker */}
              {target === 'single_affiliate' && (
                <div className="p-3.5 bg-[#007AFF]/8 border-2 border-[#007AFF]/30 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#0062CC] flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-[#007AFF]" />
                      <span>Afiliado Destinatário Selecionado:</span>
                    </span>
                    {selectedAffiliate && (
                      <button
                        type="button"
                        onClick={() => setSelectedAffiliate(null)}
                        className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                        <span>Trocar</span>
                      </button>
                    )}
                  </div>

                  {selectedAffiliate ? (
                    <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#007AFF]/20 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#007AFF]/15 text-[#007AFF] font-black text-sm flex items-center justify-center">
                          {selectedAffiliate.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <strong className="text-xs text-slate-900">{selectedAffiliate.name}</strong>
                            {selectedAffiliate.hasPush ? (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                                📱 Push Ativo
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-600">
                                ⏳ Push Pendente
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500">{selectedAffiliate.email}</div>
                          <div className="text-[10px] font-mono text-slate-400">
                            Cód: <span className="font-bold text-slate-700">{selectedAffiliate.referralCode}</span> • Saldo: R$ {selectedAffiliate.affiliateBalance.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-[#34C759]/15 text-[#248A3D] text-[11px] font-bold">
                        Selecionado ✓
                      </span>
                    </div>
                  ) : (
                    <div className="p-3 bg-white rounded-xl border border-dashed border-[#007AFF]/40 text-center space-y-2">
                      <p className="text-xs font-semibold text-slate-700">
                        Nenhum afiliado selecionado ainda.
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Escolha um afiliado na tabela abaixo clicando no botão{' '}
                        <strong className="text-[#007AFF]">"🎯 Disparar para este Afiliado"</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}

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
                  <strong>Segurança e Isolamento:</strong> Jogadores normais não recebem esta mensagem. O sistema
                  filtra com precisão os IDs de afiliados cadastrados no sistema.
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
                <IOSButton
                  type="submit"
                  variant="primary"
                  disabled={sending || (target === 'single_affiliate' && !selectedAffiliate)}
                  className="flex-1 h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>
                    {target === 'single_affiliate' && selectedAffiliate
                      ? `Disparar Push para ${selectedAffiliate.name}`
                      : 'Disparar Notificação para os Afiliados'}
                  </span>
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
                  <span className="text-[10px] font-bold text-white uppercase tracking-wider">
                    {target === 'single_affiliate' && selectedAffiliate
                      ? `AFILIADO • ${selectedAffiliate.name.toUpperCase().slice(0, 14)}`
                      : 'ALLIANCE • AFILIADOS'}
                  </span>
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

      {/* Dedicated Section: List of Affiliates for Instant Targeting */}
      <IOSCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.04] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#007AFF]/12 text-[#007AFF] flex items-center justify-center font-bold">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Lista de Afiliados Disponíveis para Disparo ({filteredAffiliates.length})
              </h3>
            </div>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Clique em <strong>"Disparar"</strong> em qualquer afiliado para enviar uma mensagem exclusiva para ele
            </p>
          </div>

          <div className="w-full sm:w-72">
            <IOSSearchBar
              value={affiliateSearch}
              onChange={setAffiliateSearch}
              placeholder="Buscar por nome, email ou código..."
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filtrar:
          </span>
          <button
            type="button"
            onClick={() => setAffiliateFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              affiliateFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todos ({affiliates.length})
          </button>
          <button
            type="button"
            onClick={() => setAffiliateFilter('push_only')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              affiliateFilter === 'push_only'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <span>📱 Com Push Ativo</span>
            <span className="opacity-80 font-bold">
              ({affiliates.filter((a) => a.hasPush).length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAffiliateFilter('influencers')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              affiliateFilter === 'influencers'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <span>⭐ Influenciadores VIP</span>
            <span className="opacity-80 font-bold">
              ({affiliates.filter((a) => a.isInfluencer).length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => setAffiliateFilter('with_balance')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
              affiliateFilter === 'with_balance'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 text-purple-800 hover:bg-purple-100'
            }`}
          >
            <span>💰 Com Saldo de Comissão</span>
            <span className="opacity-80 font-bold">
              ({affiliates.filter((a) => a.affiliateBalance > 0).length})
            </span>
          </button>
        </div>

        {/* Affiliates Grid / Table */}
        {filteredAffiliates.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs font-bold text-slate-700">Nenhum afiliado encontrado</p>
            <p className="text-[11px] text-slate-400">Tente ajustar o termo de busca ou filtro selecionado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#F2F2F7] text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
                  <tr>
                    <th className="py-2.5 px-3">Afiliado</th>
                    <th className="py-2.5 px-3">Código REF</th>
                    <th className="py-2.5 px-3 text-center">Status Push</th>
                    <th className="py-2.5 px-3 text-right">Saldo Comissão</th>
                    <th className="py-2.5 px-3 text-center">Indicações</th>
                    <th className="py-2.5 px-3 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/[0.04]">
                  {filteredAffiliates.map((aff) => {
                    const isSelected = selectedAffiliate?.userId === aff.userId && target === 'single_affiliate';
                    return (
                      <tr
                        key={aff.userId}
                        className={`transition-colors ${
                          isSelected ? 'bg-[#007AFF]/8' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#007AFF]/12 text-[#007AFF] font-black text-xs flex items-center justify-center shrink-0">
                              {aff.name ? aff.name.charAt(0).toUpperCase() : 'A'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 truncate">{aff.name}</span>
                                {aff.isInfluencer && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                    VIP
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">{aff.email}</div>
                              {aff.phone && (
                                <div className="text-[10px] font-mono text-slate-400">{aff.phone}</div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(aff.referralCode)}
                            className="inline-flex items-center gap-1 font-mono font-bold text-xs text-slate-700 hover:text-[#007AFF] cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md"
                            title="Copiar Código"
                          >
                            <span>{aff.referralCode || 'N/A'}</span>
                            {copiedCode === aff.referralCode ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                          </button>
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          {aff.hasPush ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Push Ativo
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">
                              Pendente
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-xs text-[#AF52DE]">
                          R$ {aff.affiliateBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-700 font-bold">
                          {aff.indicationsCount}
                        </td>

                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleSelectAffiliateForPush(aff)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 mx-auto ${
                              isSelected
                                ? 'bg-[#34C759] text-white shadow-xs'
                                : 'bg-[#007AFF]/12 hover:bg-[#007AFF] text-[#007AFF] hover:text-white'
                            }`}
                          >
                            {isSelected ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Selecionado</span>
                              </>
                            ) : (
                              <>
                                <Target className="w-3.5 h-3.5" />
                                <span>Disparar Push</span>
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for Affiliates */}
            <div className="md:hidden space-y-2.5">
              {filteredAffiliates.map((aff) => {
                const isSelected = selectedAffiliate?.userId === aff.userId && target === 'single_affiliate';
                return (
                  <div
                    key={aff.userId}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isSelected
                        ? 'bg-[#007AFF]/8 border-[#007AFF]/40 shadow-xs'
                        : 'bg-white border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-[#007AFF]/15 text-[#007AFF] font-bold text-xs flex items-center justify-center shrink-0">
                          {aff.name ? aff.name.charAt(0).toUpperCase() : 'A'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-bold text-slate-900">{aff.name}</h4>
                            {aff.isInfluencer && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                VIP
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">{aff.email}</p>
                        </div>
                      </div>

                      {aff.hasPush ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                          📱 Ativo
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500 shrink-0">
                          ⏳ Pendente
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Código REF:</span>
                        <span className="font-mono font-bold text-slate-800">{aff.referralCode}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 block">Saldo Comissões:</span>
                        <span className="font-mono font-bold text-[#AF52DE]">
                          R$ {aff.affiliateBalance.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => handleSelectAffiliateForPush(aff)}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#34C759] text-white shadow-xs'
                            : 'bg-[#007AFF] hover:bg-[#0062CC] text-white'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Afiliado Selecionado para Disparo</span>
                          </>
                        ) : (
                          <>
                            <Target className="w-3.5 h-3.5" />
                            <span>Disparar Notificação para este Afiliado</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </IOSCard>

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
                    <span className="text-xs font-bold text-slate-900">{item.title}</span>
                    <span className="px-2 py-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 rounded">
                      {item.targetLabel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2">{item.body}</p>
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
