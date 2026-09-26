import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  TrendingUp,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Copy,
  Check,
  Share2,
  ExternalLink,
  MessageCircle,
  Bell,
  RefreshCw,
  Search,
  Filter,
  Trophy,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Crown,
  Sparkles,
  QrCode,
  Megaphone,
  Download,
  Calculator,
  Target,
  ArrowLeft,
  ChevronRight,
  Info,
  Layers,
  BarChart3,
  Calendar,
  Percent,
  Sliders
} from 'lucide-react';
import { PartnerDashboardData, PartnerAffiliateStats, User } from '../../types';
import { PartnerQRCodeModal } from './PartnerQRCodeModal';
import { PartnerSendAlertModal } from './PartnerSendAlertModal';
import { PartnerBroadcastModal } from './PartnerBroadcastModal';
import { PartnerAffiliateDetailModal } from './PartnerAffiliateDetailModal';
import { PartnerEditCommissionModal } from './PartnerEditCommissionModal';
import { getPartnerCutFromAffiliateRevShare, MAX_PARTNER_AFFILIATE_COMMISSION } from '../../utils/partnerCommission';

interface PartnerPanelViewProps {
  user: User;
  token?: string | null;
  onBackToHub: () => void;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PartnerPanelView: React.FC<PartnerPanelViewProps> = ({
  user,
  token,
  onBackToHub,
  onShowToast
}) => {
  const [data, setData] = useState<PartnerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'affiliates' | 'ranking' | 'realtime' | 'reports' | 'recruiting' | 'simulator'>('affiliates');

  // Token resolution helper supporting all gateway and applet storage keys
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

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked' | 'idle'>('all');

  // Modals state
  const [selectedAffiliate, setSelectedAffiliate] = useState<PartnerAffiliateStats | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [alertTargetAffiliate, setAlertTargetAffiliate] = useState<PartnerAffiliateStats | null>(null);
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [editCommissionModalOpen, setEditCommissionModalOpen] = useState(false);
  const [commissionTargetAffiliate, setCommissionTargetAffiliate] = useState<PartnerAffiliateStats | null>(null);

  // Link copy states
  const [copiedDirect, setCopiedDirect] = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);
  const [copiedParam, setCopiedParam] = useState(false);

  // Simulator state
  const [simulatedAffiliates, setSimulatedAffiliates] = useState(25);
  const [simulatedAvgDeposit, setSimulatedAvgDeposit] = useState(150);
  const [simulatedRevShare, setSimulatedRevShare] = useState(20);

  // Fetch partner dashboard data
  const fetchData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const res = await fetch('/api/partner/dashboard', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        const err = await res.json().catch(() => ({}));
        onShowToast(err.error || 'Erro ao carregar dados do parceiro.', 'error');
      }
    } catch (e: any) {
      console.error(e);
      onShowToast('Falha na conexão com o servidor de parceiros.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh real-time data every 15 seconds
    const interval = setInterval(() => {
      fetchData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filter affiliates
  const filteredAffiliates = useMemo(() => {
    if (!data?.affiliates) return [];
    return data.affiliates.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.referralCode.toLowerCase().includes(q);

      if (!matchesQuery) return false;

      if (statusFilter === 'active') return a.isOnlineNow;
      if (statusFilter === 'blocked') return a.autoWithdrawBlocked;
      if (statusFilter === 'idle') return !a.isOnlineNow;
      return true;
    });
  }, [data?.affiliates, searchQuery, statusFilter]);

  // Toggle Auto-Withdraw Handler
  const handleToggleAutoWithdraw = async (affiliateId: string, currentBlocked: boolean): Promise<boolean> => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        onShowToast('Sessão não encontrada. Por favor faça login novamente.', 'error');
        return false;
      }
      const nextBlocked = !currentBlocked;
      const res = await fetch(`/api/partner/affiliates/${affiliateId}/toggle-auto-withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ blocked: nextBlocked })
      });
      const result = await res.json();
      if (res.ok) {
        onShowToast(result.message || 'Status atualizado com sucesso!', 'success');
        // Update local state instantly
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            affiliates: prev.affiliates.map((a) =>
              a.id === affiliateId ? { ...a, autoWithdrawBlocked: nextBlocked } : a
            )
          };
        });
        if (selectedAffiliate && selectedAffiliate.id === affiliateId) {
          setSelectedAffiliate((prev) => (prev ? { ...prev, autoWithdrawBlocked: nextBlocked } : null));
        }
        return true;
      } else {
        onShowToast(result.error || 'Erro ao alterar bloqueio.', 'error');
        return false;
      }
    } catch (e: any) {
      onShowToast('Erro de rede ao alterar bloqueio de saque.', 'error');
      return false;
    }
  };

  // Commission Update Success Handler
  const handleCommissionSuccess = (affiliateId: string, newRate: number, newPartnerCut: number) => {
    setData((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        affiliates: prev.affiliates.map((a) =>
          a.id === affiliateId
            ? { ...a, revSharePercent: newRate, partnerCutPercent: newPartnerCut }
            : a
        )
      };
    });
    if (selectedAffiliate && selectedAffiliate.id === affiliateId) {
      setSelectedAffiliate((prev) =>
        prev ? { ...prev, revSharePercent: newRate, partnerCutPercent: newPartnerCut } : null
      );
    }
    onShowToast(`Comissão atualizada para ${newRate}%! Sua comissão: ${newPartnerCut}%.`, 'success');
  };

  // Send Single Alert Handler
  const handleSendAlert = async (affiliateId: string, title: string, message: string): Promise<boolean> => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        onShowToast('Sessão não encontrada. Por favor faça login novamente.', 'error');
        return false;
      }
      const res = await fetch(`/api/partner/affiliates/${affiliateId}/send-alert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ title, message })
      });
      const result = await res.json();
      if (res.ok) {
        onShowToast('Alerta enviado com sucesso!', 'success');
        return true;
      } else {
        onShowToast(result.error || 'Erro ao enviar alerta.', 'error');
        return false;
      }
    } catch (e) {
      onShowToast('Falha ao enviar alerta.', 'error');
      return false;
    }
  };

  // Broadcast Handler
  const handleBroadcast = async (title: string, message: string): Promise<boolean> => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        onShowToast('Sessão não encontrada. Por favor faça login novamente.', 'error');
        return false;
      }
      const res = await fetch('/api/partner/broadcast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ title, message })
      });
      const result = await res.json();
      if (res.ok) {
        onShowToast(result.message || 'Transmissão enviada com sucesso!', 'success');
        return true;
      } else {
        onShowToast(result.error || 'Erro ao realizar transmissão.', 'error');
        return false;
      }
    } catch (e) {
      onShowToast('Falha na transmissão.', 'error');
      return false;
    }
  };

  // Dynamic recruitment URLs
  const activePartnerCode = data?.partner.partnerCode || '';
  const shortLink = data?.partner.partnerShortLink || data?.partner.partnerInviteLink || '';
  const paramLink =
    data?.partner.partnerDirectLink ||
    (shortLink.includes('/p/') ? shortLink.replace('/p/', '/register?p=') : shortLink);

  // Copy helpers
  const copyDirectLink = async () => {
    if (!shortLink) return;
    await navigator.clipboard.writeText(shortLink);
    setCopiedDirect(true);
    onShowToast('Link curto de parceiro copiado com sucesso!', 'success');
    setTimeout(() => setCopiedDirect(false), 2500);
  };

  const copyParamLink = async () => {
    if (!paramLink) return;
    await navigator.clipboard.writeText(paramLink);
    setCopiedParam(true);
    onShowToast('Link alternativo copiado com sucesso!', 'success');
    setTimeout(() => setCopiedParam(false), 2500);
  };

  const copyPortalLink = async () => {
    const link = data?.partner.partnerPortalLink || shortLink;
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopiedPortal(true);
    onShowToast('Link do portal de parceiro copiado!', 'success');
    setTimeout(() => setCopiedPortal(false), 2500);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!data?.affiliates || data.affiliates.length === 0) {
      onShowToast('Nenhum afiliado para exportar.', 'info');
      return;
    }
    const headers = ['ID', 'Nome', 'Email', 'Telefone', 'Código', 'Data Cadastro', 'Jogadores na Rede', 'Total Depositado (R$)', 'Volume Apostado (R$)', 'Comissão Parceiro (R$)', 'Saque Bloqueado'];
    const rows = data.affiliates.map(a => [
      a.id,
      `"${a.name.replace(/"/g, '""')}"`,
      a.email,
      a.phone || '',
      a.referralCode,
      a.createdAt,
      a.totalPlayersInvited,
      a.totalDeposited.toFixed(2),
      a.totalVolumeWagered.toFixed(2),
      a.commissionGeneratedForPartner.toFixed(2),
      a.autoWithdrawBlocked ? 'SIM' : 'NÃO'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `afiliados_parceiro_${data.partner.partnerCode}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Relatório CSV baixado com sucesso!', 'success');
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center animate-spin mb-4 shadow-sm">
          <RefreshCw className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-zinc-900">Carregando Painel de Parceiro...</h3>
        <p className="text-xs text-zinc-500 mt-1">Carregando métricas e rede de afiliados exclusiva</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mb-3" />
        <h3 className="text-base font-bold text-zinc-900">Acesso Não Disponível</h3>
        <p className="text-xs text-zinc-500 mt-1 max-w-sm">
          Você não possui autorização ativa para acessar o painel de parceiro ou o token expirou.
        </p>
        <button
          onClick={onBackToHub}
          className="mt-4 px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition"
        >
          Voltar ao Hub
        </button>
      </div>
    );
  }

  const partnerCode = data.partner.partnerCode;
  const metrics = data.metrics;

  return (
    <div className="partner-refined w-full pb-20 animate-fade-in bg-zinc-50/40 min-h-screen">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-zinc-200/80 sticky top-0 z-30 px-4 lg:px-8 py-3.5 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToHub}
              className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition flex items-center gap-1 text-xs font-medium cursor-pointer"
              title="Voltar ao Alliance Hub"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Hub</span>
            </button>

            <div className="h-5 w-px bg-zinc-200 hidden sm:block" />

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1">
                  <Crown className="w-3 h-3 text-amber-500 fill-amber-500" />
                  PAINEL DO PARCEIRO OFICIAL
                </span>
                <span className="text-[10px] text-zinc-400 font-mono hidden md:inline">
                  parceiro.goalliancehub.com
                </span>
              </div>
              <h1 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight flex items-center gap-2">
                {data.partner.name}
                <span className="text-xs font-normal text-zinc-400 font-mono bg-zinc-100 px-2 py-0.5 rounded-md">
                  Código: <strong className="text-zinc-800">{partnerCode}</strong>
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-600 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              title="Atualizar dados"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>

            <button
              onClick={() => setBroadcastModalOpen(true)}
              className="px-3 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
            >
              <Megaphone className="w-3.5 h-3.5 text-amber-600" />
              <span>Transmissão</span>
            </button>

            <button
              onClick={() => setQrModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold transition shadow-sm cursor-pointer flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Convidar Afiliados</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-5 space-y-6">
        {/* Fast Recruitment Banner */}
        <div className="bg-gradient-to-br from-zinc-900 via-zinc-800 to-emerald-950 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-zinc-700/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="space-y-1.5 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Atração e Recrutamento de Afiliados
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Construa sua rede oficial no Alliance Hub
              </h2>
              <p className="text-xs text-zinc-300">
                Qualquer afiliado que criar conta pelo seu link ficará permanentemente atrelado à sua base de parceiro. Você terá controle total sobre seus saques, ranking e relatórios ao vivo.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-2.5 shrink-0">
              <div className="bg-zinc-800/80 backdrop-blur-md p-2 rounded-2xl border border-zinc-700 flex items-center justify-between gap-2 max-w-md">
                <div className="truncate px-2 text-xs font-mono text-emerald-400 font-semibold">
                  {shortLink || data.partner.partnerInviteLink}
                </div>
                <button
                  onClick={copyDirectLink}
                  className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {copiedDirect ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedDirect ? 'Copiado!' : 'Copiar Link Curto'}
                </button>
              </div>

              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `🚀 Oportunidade VIP no Alliance Hub! Cadastre-se como Afiliado Oficial pelo meu link e lucre até 80% RevShare com saques automáticos via PIX: ${shortLink || data.partner.partnerInviteLink}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                Compartilhar WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Executive Metrics Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {/* Card 1: Afiliados Recrutados */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs hover:border-zinc-300 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Afiliados Diretos</span>
              <Users className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl sm:text-2xl font-black text-zinc-900">{metrics.totalAffiliates}</strong>
              <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {metrics.activeAffiliatesToday} online
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1 block">Na sua base exclusiva</span>
          </div>

          {/* Card 2: Jogadores na Rede */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs hover:border-zinc-300 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Jogadores na Rede</span>
              <Layers className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl sm:text-2xl font-black text-zinc-900">{metrics.totalPlayersInNetwork}</strong>
              <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                {metrics.realtimeActivePlayers} ativos
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1 block">Indicados pelos afiliados</span>
          </div>

          {/* Card 3: Depósitos da Rede */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs hover:border-zinc-300 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Depósitos da Rede</span>
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1">
              <strong className="text-lg sm:text-xl font-black text-emerald-600">
                R$ {metrics.totalDepositedByNetwork.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1 block">
              {metrics.ftdCount} FTDs ({metrics.conversionRate}%)
            </span>
          </div>

          {/* Card 4: Saques da Rede & NGR */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs hover:border-zinc-300 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Lucro Líquido (NGR)</span>
              <DollarSign className="w-4 h-4 text-zinc-600" />
            </div>
            <div className="flex items-baseline gap-1">
              <strong className={`text-lg sm:text-xl font-black ${metrics.netRevenue >= 0 ? 'text-zinc-900' : 'text-rose-600'}`}>
                R$ {metrics.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1 block">Depósitos - Saques Pagos</span>
          </div>

          {/* Card 5: Comissões do Parceiro */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs hover:border-zinc-300 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Sua Comissão Total</span>
              <Crown className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <strong className="text-lg sm:text-xl font-black text-amber-600">
                R$ {metrics.totalPartnerCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </strong>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1 block">Ganhos acumulados</span>
          </div>

          {/* Card 6: Saques com Bloqueio Ativo */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs hover:border-zinc-300 transition">
            <div className="flex items-center justify-between text-zinc-400 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Saques Bloqueados</span>
              <Lock className="w-4 h-4 text-rose-500" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <strong className="text-xl sm:text-2xl font-black text-rose-600">{metrics.blockedWithdrawalsCount}</strong>
              <span className="text-[10px] font-semibold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                Travados
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 mt-1 block">Em análise manual</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 border-b border-zinc-200 overflow-x-auto no-scrollbar pb-px">
          {[
            { id: 'affiliates', label: 'Base de Afiliados', icon: Users, badge: metrics.totalAffiliates },
            { id: 'ranking', label: 'Ranking da Rede', icon: Trophy, badge: 'Top' },
            { id: 'realtime', label: 'Jogadores ao Vivo', icon: Activity, pulse: true },
            { id: 'reports', label: 'Relatórios & Gráficos', icon: BarChart3 },
            { id: 'recruiting', label: 'Kit de Recrutamento', icon: Sparkles },
            { id: 'simulator', label: 'Simulador & Metas', icon: Calculator }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'border-emerald-600 text-emerald-600'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 hover:border-zinc-300'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab.pulse ? 'text-emerald-500 animate-pulse' : ''}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-zinc-100 text-zinc-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* TAB 1: Base de Afiliados (Controle Exclusivo) */}
        {activeTab === 'affiliates' && (
          <div className="space-y-4">
            {/* Search, Filter and Actions Bar */}
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar afiliado por nome, email ou código..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                      statusFilter === 'all' ? 'bg-white shadow-xs text-zinc-900 font-bold' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Todos ({data.affiliates.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('active')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                      statusFilter === 'active' ? 'bg-white shadow-xs text-emerald-700 font-bold' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Online
                  </button>
                  <button
                    onClick={() => setStatusFilter('blocked')}
                    className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                      statusFilter === 'blocked' ? 'bg-white shadow-xs text-rose-700 font-bold' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Saque Travado
                  </button>
                </div>

                <button
                  onClick={handleExportCSV}
                  className="p-2 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-zinc-600 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                  title="Exportar base para Excel / CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">CSV</span>
                </button>
              </div>
            </div>

            {/* Affiliates List */}
            {filteredAffiliates.length > 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-100 bg-zinc-50/70 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Afiliado</th>
                        <th className="py-3 px-3">Código</th>
                        <th className="py-3 px-3 text-center">Jogadores</th>
                        <th className="py-3 px-3 text-right">Depósitos da Rede</th>
                        <th className="py-3 px-3 text-center">Comissão</th>
                        <th className="py-3 px-3 text-right">Comissão p/ Você</th>
                        <th className="py-3 px-3 text-center">Saque Automático</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-xs">
                      {filteredAffiliates.map((aff) => {
                        const cleanPhone = (aff.phone || '').replace(/\D/g, '');
                        const waLink = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}` : null;

                        return (
                          <tr key={aff.id} className="hover:bg-zinc-50/80 transition group">
                            {/* Affiliate Name & Status */}
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                                  {aff.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="truncate">
                                  <div className="flex items-center gap-1.5">
                                    <strong className="text-zinc-900 font-bold">{aff.name}</strong>
                                    {aff.isOnlineNow && (
                                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Online agora" />
                                    )}
                                  </div>
                                  <span className="text-[11px] text-zinc-400 block truncate">{aff.email}</span>
                                </div>
                              </div>
                            </td>

                            {/* Referral Code */}
                            <td className="py-3 px-3">
                              <span className="font-mono text-[11px] font-semibold bg-zinc-100 px-2 py-0.5 rounded text-zinc-700">
                                {aff.referralCode}
                              </span>
                            </td>

                            {/* Players in his downline */}
                            <td className="py-3 px-3 text-center">
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                {aff.totalPlayersInvited}
                              </span>
                            </td>

                            {/* Deposits by his downline */}
                            <td className="py-3 px-3 text-right">
                              <strong className="text-emerald-600 font-bold">
                                R$ {aff.totalDeposited.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </strong>
                              <span className="text-[10px] text-zinc-400 block">{aff.paidDepositsCount} depósitos</span>
                            </td>

                            {/* Commission Rates: Affiliate % & Partner Cut */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => {
                                  setCommissionTargetAffiliate(aff);
                                  setEditCommissionModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold transition shadow-2xs cursor-pointer hover:border-indigo-300"
                                title="Clique para alterar a comissão deste afiliado (Máximo 80%)"
                              >
                                <Percent className="w-3 h-3 text-indigo-600" />
                                <span>{aff.revSharePercent ?? 70}%</span>
                              </button>
                              <span className="text-[10px] text-zinc-400 block mt-0.5 font-medium">
                                Você: <strong className="text-emerald-600">{aff.partnerCutPercent ?? getPartnerCutFromAffiliateRevShare(aff.revSharePercent ?? 70)}%</strong>
                              </span>
                            </td>

                            {/* Partner Commission */}
                            <td className="py-3 px-3 text-right">
                              <strong className="text-indigo-600 font-bold">
                                R$ {aff.commissionGeneratedForPartner.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </strong>
                            </td>

                            {/* Auto-Withdraw Circuit Breaker Toggle */}
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleToggleAutoWithdraw(aff.id, aff.autoWithdrawBlocked)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition shadow-2xs cursor-pointer ${
                                  aff.autoWithdrawBlocked
                                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-200'
                                    : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200'
                                }`}
                                title={aff.autoWithdrawBlocked ? 'Clique para desbloquear o saque automático deste afiliado' : 'Clique para bloquear o saque automático deste afiliado'}
                              >
                                {aff.autoWithdrawBlocked ? (
                                  <>
                                    <Lock className="w-3 h-3 text-rose-600" />
                                    <span>BLOQUEADO</span>
                                  </>
                                ) : (
                                  <>
                                    <Unlock className="w-3 h-3 text-emerald-600" />
                                    <span>LIBERADO</span>
                                  </>
                                )}
                              </button>
                            </td>

                            {/* Action Buttons */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {waLink && (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                                    title="Chamar no WhatsApp"
                                  >
                                    <MessageCircle className="w-4 h-4" />
                                  </a>
                                )}

                                <button
                                  onClick={() => {
                                    setCommissionTargetAffiliate(aff);
                                    setEditCommissionModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                  title="Ajustar Comissão (Máximo 80%)"
                                >
                                  <Sliders className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => {
                                    setAlertTargetAffiliate(aff);
                                    setAlertModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                  title="Enviar Notificação Push"
                                >
                                  <Bell className="w-4 h-4" />
                                </button>

                                <button
                                  onClick={() => {
                                    setSelectedAffiliate(aff);
                                    setDetailModalOpen(true);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-semibold text-[11px] transition cursor-pointer"
                                >
                                  Detalhes
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 p-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-zinc-800">Nenhum afiliado encontrado</h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  {searchQuery
                    ? 'Nenhum afiliado correspondeu aos termos da busca.'
                    : 'Você ainda não possui afiliados cadastrados pelo seu link de parceiro. Use seu link de recrutamento para atrair os primeiros afiliados!'}
                </p>
                <button
                  onClick={copyDirectLink}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold hover:bg-zinc-800 transition cursor-pointer"
                >
                  Copiar Meu Link de Parceiro
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Ranking de Afiliados */}
        {activeTab === 'ranking' && (
          <div className="space-y-6">
            {/* Podium for Top 3 */}
            {data.rankings && data.rankings.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto pt-6">
                {/* 2nd Place */}
                <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-xs flex flex-col items-center text-center mt-6 order-1">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-200 text-zinc-700 flex items-center justify-center font-black text-sm mb-2 shadow-xs">
                    🥈 2º
                  </div>
                  <strong className="text-xs font-bold text-zinc-900 truncate max-w-[120px]">{data.rankings[1].name}</strong>
                  <span className="text-[10px] text-zinc-400 font-mono mb-1">{data.rankings[1].email.split('@')[0]}</span>
                  <strong className="text-xs text-emerald-600 font-extrabold">
                    R$ {data.rankings[1].totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-[10px] text-zinc-400">{data.rankings[1].playersCount} jogadores</span>
                </div>

                {/* 1st Place (Champion) */}
                <div className="bg-gradient-to-b from-amber-50 to-white p-5 rounded-3xl border-2 border-amber-300 shadow-md flex flex-col items-center text-center order-2 relative">
                  <div className="absolute -top-3 bg-amber-400 text-amber-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
                    <Crown className="w-3 h-3 fill-amber-950" /> Líder da Rede
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-black text-base mb-2 shadow-md">
                    🥇 1º
                  </div>
                  <strong className="text-sm font-black text-zinc-900 truncate max-w-[140px]">{data.rankings[0].name}</strong>
                  <span className="text-[10px] text-zinc-500 font-mono mb-1">{data.rankings[0].email.split('@')[0]}</span>
                  <strong className="text-sm text-emerald-600 font-black">
                    R$ {data.rankings[0].totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-[11px] font-semibold text-zinc-500">{data.rankings[0].playersCount} jogadores</span>
                </div>

                {/* 3rd Place */}
                <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-xs flex flex-col items-center text-center mt-10 order-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm mb-2 shadow-xs">
                    🥉 3º
                  </div>
                  <strong className="text-xs font-bold text-zinc-900 truncate max-w-[120px]">{data.rankings[2].name}</strong>
                  <span className="text-[10px] text-zinc-400 font-mono mb-1">{data.rankings[2].email.split('@')[0]}</span>
                  <strong className="text-xs text-emerald-600 font-extrabold">
                    R$ {data.rankings[2].totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-[10px] text-zinc-400">{data.rankings[2].playersCount} jogadores</span>
                </div>
              </div>
            )}

            {/* Ranking Table */}
            <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-xs">
              <div className="p-4 border-b border-zinc-100 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Classificação Geral de Desempenho</h3>
                  <p className="text-xs text-zinc-400">Classificado por volume de depósitos gerados no Alliance Hub</p>
                </div>
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  {data.rankings.length} Afiliados Ranqueados
                </span>
              </div>

              <div className="divide-y divide-zinc-100 text-xs">
                {data.rankings.map((item) => (
                  <div key={item.affiliateId} className="p-3.5 flex items-center justify-between hover:bg-zinc-50 transition">
                    <div className="flex items-center gap-3">
                      <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                        item.rank === 1 ? 'bg-amber-400 text-amber-950 font-extrabold' :
                        item.rank === 2 ? 'bg-zinc-200 text-zinc-800' :
                        item.rank === 3 ? 'bg-amber-100 text-amber-800' :
                        'bg-zinc-100 text-zinc-500'
                      }`}>
                        #{item.rank}
                      </span>
                      <div>
                        <strong className="text-zinc-900 block font-bold">{item.name}</strong>
                        <span className="text-[11px] text-zinc-400 font-mono">{item.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Jogadores</span>
                        <strong className="text-zinc-800 font-bold">{item.playersCount}</strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Depósitos</span>
                        <strong className="text-emerald-600 font-extrabold">
                          R$ {item.totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Score</span>
                        <span className="text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">
                          {item.score} pts
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Jogadores em Tempo Real (Live Pulse) */}
        {activeTab === 'realtime' && (
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-sm font-bold text-zinc-900">Radar em Tempo Real da Sua Rede</h3>
              </div>
              <span className="text-xs text-zinc-400">Atualização automática a cada 15s</span>
            </div>

            {data.realtimeFeed && data.realtimeFeed.length > 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden shadow-xs">
                {data.realtimeFeed.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-zinc-50 transition text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        item.type === 'win' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        {item.type === 'win' ? '🏆' : '🎮'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-zinc-900">{item.playerName || 'Jogador da Rede'}</strong>
                          <span className="text-[11px] bg-zinc-100 px-2 py-0.5 rounded text-zinc-600 font-medium">
                            {item.gameName}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-400">
                          Afiliado responsável: <strong className="text-zinc-600">{item.affiliateName}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <strong className={`font-bold block text-sm ${
                        item.type === 'win' ? 'text-emerald-600 font-extrabold' : 'text-zinc-800'
                      }`}>
                        {item.type === 'win' ? '+' : ''}R$ {item.amount?.toFixed(2) || '0.00'}
                      </strong>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(item.timestamp).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-xs text-zinc-400">
                Aguardando novas apostas e partidas da sua rede de jogadores.
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Relatórios & Métricas */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Timeline Chart (SVG 14 Days) */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Evolução de Depósitos e Saques (Últimos 14 Dias)</h3>
                  <p className="text-xs text-zinc-400">Movimentações financeiras consolidadas da rede do parceiro</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-semibold">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <span className="w-3 h-3 rounded-full bg-emerald-500" />
                    Depósitos (R$)
                  </div>
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    <span className="w-3 h-3 rounded-full bg-zinc-400" />
                    Saques (R$)
                  </div>
                </div>
              </div>

              {/* Responsive SVG Bar Chart */}
              {data.dailyTimeline && data.dailyTimeline.length > 0 ? (
                <div className="h-48 w-full flex items-end justify-between gap-1 sm:gap-2 pt-6">
                  {data.dailyTimeline.map((day, idx) => {
                    const maxVal = Math.max(
                      ...data.dailyTimeline!.map(d => Math.max(d.deposits, d.withdrawals)),
                      100
                    );
                    const depHeight = Math.max((day.deposits / maxVal) * 100, 4);
                    const withHeight = Math.max((day.withdrawals / maxVal) * 100, 4);

                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                        {/* Hover Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                          <div className="bg-zinc-900 text-white text-[10px] rounded-lg py-1 px-2 shadow-lg whitespace-nowrap">
                            <strong>{day.date}</strong>
                            <div className="text-emerald-400">Dep: R$ {day.deposits.toFixed(2)}</div>
                            <div className="text-zinc-300">Saq: R$ {day.withdrawals.toFixed(2)}</div>
                          </div>
                        </div>

                        <div className="w-full flex items-end justify-center gap-1 h-36">
                          {/* Deposit Bar */}
                          <div
                            style={{ height: `${depHeight}%` }}
                            className="w-1/2 max-w-[14px] bg-emerald-500 rounded-t-sm transition-all hover:bg-emerald-400"
                          />
                          {/* Withdrawal Bar */}
                          <div
                            style={{ height: `${withHeight}%` }}
                            className="w-1/2 max-w-[14px] bg-zinc-300 rounded-t-sm transition-all hover:bg-zinc-400"
                          />
                        </div>
                        <span className="text-[9px] font-mono text-zinc-400 mt-2 block truncate">
                          {day.displayDate}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-40 flex items-center justify-center text-xs text-zinc-400">
                  Dados insuficientes para gerar histórico diário.
                </div>
              )}
            </div>

            {/* Funnel & Conversion Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-zinc-200">
                <span className="text-xs font-semibold text-zinc-500 block mb-1">Conversão FTD (Primeiro Depósito)</span>
                <strong className="text-2xl font-black text-zinc-900">{metrics.conversionRate}%</strong>
                <p className="text-[11px] text-zinc-400 mt-1">
                  {metrics.ftdCount} de {metrics.totalPlayersInNetwork} jogadores cadastrados já depositaram.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-zinc-200">
                <span className="text-xs font-semibold text-zinc-500 block mb-1">Ticket Médio por Depósito</span>
                <strong className="text-2xl font-black text-emerald-600">
                  R$ {(metrics.ftdCount > 0 ? metrics.totalDepositedByNetwork / metrics.ftdCount : 0).toFixed(2)}
                </strong>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Média gasta por cada jogador pagante na rede.
                </p>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-zinc-200">
                <span className="text-xs font-semibold text-zinc-500 block mb-1">Total de Apostas (GGR)</span>
                <strong className="text-2xl font-black text-indigo-600">
                  R$ {metrics.ggr.toFixed(2)}
                </strong>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Volume apostado menos prêmios pagos nos jogos.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Kit de Recrutamento */}
        {activeTab === 'recruiting' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Box 1: Links e Domínios */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Seus Links Oficiais de Recrutamento</h3>
                  <p className="text-xs text-zinc-400">Envie para atrair afiliados para o Alliance Hub</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                      <span>Link Curto Oficial</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        Recomendado
                      </span>
                    </label>
                    <span className="text-[11px] text-zinc-400">Ideal para redes sociais e WhatsApp</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={shortLink}
                      className="w-full px-3 py-2 bg-emerald-50/50 border border-emerald-200 rounded-xl text-xs font-mono text-emerald-900 font-semibold"
                    />
                    <button
                      onClick={copyDirectLink}
                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-500 transition shrink-0 cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      {copiedDirect ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedDirect ? 'Copiado!' : 'Copiar Curto'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Link Alternativo com Parâmetro</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={paramLink}
                      className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-700"
                    />
                    <button
                      onClick={copyParamLink}
                      className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition shrink-0 cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedParam ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedParam ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {data.partner.partnerPortalLink && (
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 block mb-1">Link Portal do Parceiro</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={data.partner.partnerPortalLink}
                        className="w-full px-3 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-mono text-zinc-700"
                      />
                      <button
                        onClick={copyPortalLink}
                        className="px-3 py-2 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition shrink-0 cursor-pointer flex items-center gap-1.5"
                      >
                        {copiedPortal ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedPortal ? 'Copiado!' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  onClick={() => setQrModalOpen(true)}
                  className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-bold hover:bg-zinc-50 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-4 h-4" />
                  Abrir QR Code (Link Curto)
                </button>
              </div>
            </div>

            {/* Box 2: Scripts Prontos para Divulgação */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 space-y-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-900">Modelos de Mensagem Prontos</h3>
                <p className="text-xs text-zinc-400">Copie e envie em grupos de afiliados no WhatsApp e Telegram</p>
              </div>

              <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-100 text-xs text-zinc-700 relative">
                <p className="font-medium leading-relaxed">
                  "🚀 Venha ser um Afiliado Oficial no <strong>Alliance Hub</strong>! Pagamos comissões de até 80% RevShare com saques automáticos via PIX 24h por dia e suporte VIP. Cadastre-se pelo meu link exclusivo: {shortLink}"
                </p>
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `🚀 Venha ser um Afiliado Oficial no Alliance Hub! Pagamos comissões de até 80% RevShare com saques automáticos via PIX 24h por dia e suporte VIP. Cadastre-se pelo meu link exclusivo: ${shortLink}`
                    );
                    onShowToast('Texto copiado para a área de transferência!', 'success');
                  }}
                  className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-zinc-200 text-zinc-800 font-semibold text-xs hover:bg-zinc-100 transition cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copiar Script de Venda
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: Simulador & Metas do Parceiro */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Simulator Inputs */}
            <div className="bg-white p-5 rounded-2xl border border-zinc-200 space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                  <Calculator className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Simulador de Faturamento do Parceiro</h3>
                  <p className="text-xs text-zinc-400">Projete seus ganhos mensais escalando sua base</p>
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                    <span>Número de Afiliados Ativos</span>
                    <strong className="text-zinc-900">{simulatedAffiliates} afiliados</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="200"
                    step="5"
                    value={simulatedAffiliates}
                    onChange={(e) => setSimulatedAffiliates(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                    <span>Depósito Médio Gerado por Afiliado (Mensal)</span>
                    <strong className="text-zinc-900">R$ {simulatedAvgDeposit}</strong>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="2000"
                    step="50"
                    value={simulatedAvgDeposit}
                    onChange={(e) => setSimulatedAvgDeposit(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold text-zinc-700 mb-1">
                    <span>Sua Fatia de Comissão como Parceiro (%)</span>
                    <strong className="text-zinc-900">{simulatedRevShare}%</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="40"
                    step="5"
                    value={simulatedRevShare}
                    onChange={(e) => setSimulatedRevShare(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>
              </div>
            </div>

            {/* Simulator Results */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white p-6 rounded-2xl border border-zinc-700 flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block mb-1">
                  Projeção Mensal Estimada
                </span>
                <h4 className="text-xs text-zinc-400">Ganhos recorrentes com sua rede de parceiro</h4>

                <div className="my-6">
                  <span className="text-xs text-zinc-400 block">Sua Comissão Projetada:</span>
                  <strong className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight">
                    R$ {(simulatedAffiliates * simulatedAvgDeposit * (simulatedRevShare / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-xs text-zinc-400 block mt-1">/mês em repasses automáticos via PIX</span>
                </div>

                <div className="p-3.5 bg-zinc-800/80 rounded-xl border border-zinc-700 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Volume Total Depositado na Rede:</span>
                    <strong className="text-white">R$ {(simulatedAffiliates * simulatedAvgDeposit).toLocaleString('pt-BR')}</strong>
                  </div>
                </div>
              </div>

              <div className="pt-4 text-[11px] text-zinc-400">
                * As comissões são creditadas em tempo real conforme os jogos ocorrem no Alliance Hub.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Popups & Modals */}
      <PartnerQRCodeModal
        isOpen={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        partnerLink={shortLink || data.partner.partnerInviteLink}
        partnerCode={data.partner.partnerCode}
        partnerName={data.partner.name}
      />

      <PartnerSendAlertModal
        isOpen={alertModalOpen}
        onClose={() => {
          setAlertModalOpen(false);
          setAlertTargetAffiliate(null);
        }}
        affiliate={alertTargetAffiliate}
        onSend={handleSendAlert}
      />

      <PartnerBroadcastModal
        isOpen={broadcastModalOpen}
        onClose={() => setBroadcastModalOpen(false)}
        affiliateCount={data.affiliates.length}
        onBroadcast={handleBroadcast}
      />

      <PartnerAffiliateDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setSelectedAffiliate(null);
        }}
        affiliate={selectedAffiliate}
        onToggleAutoWithdraw={handleToggleAutoWithdraw}
        onOpenSendAlert={(aff) => {
          setDetailModalOpen(false);
          setAlertTargetAffiliate(aff);
          setAlertModalOpen(true);
        }}
        onOpenEditCommission={(aff) => {
          setCommissionTargetAffiliate(aff);
          setEditCommissionModalOpen(true);
        }}
      />

      <PartnerEditCommissionModal
        isOpen={editCommissionModalOpen}
        onClose={() => {
          setEditCommissionModalOpen(false);
          setCommissionTargetAffiliate(null);
        }}
        affiliate={commissionTargetAffiliate}
        onSuccess={handleCommissionSuccess}
      />
    </div>
  );
};
