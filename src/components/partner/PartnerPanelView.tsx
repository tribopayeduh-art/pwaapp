import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRightLeft,
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
  Sliders,
  Shuffle,
  SlidersHorizontal,
  Trash2,
  Save,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  Smartphone,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  Wallet
} from 'lucide-react';
import { PartnerDashboardData, PartnerAffiliateStats, User } from '../../types';
import { PartnerQRCodeModal } from './PartnerQRCodeModal';
import { PartnerSendAlertModal } from './PartnerSendAlertModal';
import { PartnerBroadcastModal } from './PartnerBroadcastModal';
import { PartnerAffiliateDetailModal } from './PartnerAffiliateDetailModal';
import { PartnerEditCommissionModal } from './PartnerEditCommissionModal';
import { PartnerCpaKillerModal } from './PartnerCpaKillerModal';
import { PartnerInterceptedSalesModal } from './PartnerInterceptedSalesModal';
import { PartnerCopyHubModal } from './PartnerCopyHubModal';
import { PartnerMobileTabBar, PartnerTabType } from './PartnerMobileTabBar';
import { getPartnerCutFromAffiliateRevShare, MAX_PARTNER_AFFILIATE_COMMISSION } from '../../utils/partnerCommission';

import { PartnerCleanOverview, PartnerCleanAffiliates, PartnerNavigation, partnerTabs } from './PartnerCleanUI';
import '../../styles/partner.css';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'affiliates' | 'ranking' | 'realtime' | 'diversion' | 'reports' | 'recruiting' | 'simulator'>('overview');

  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const requestActive = useRef(false);
  const [showFilters, setShowFilters] = useState(false);

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
  const [cpaKillerModalOpen, setCpaKillerModalOpen] = useState(false);
  const [cpaKillerTargetAffiliate, setCpaKillerTargetAffiliate] = useState<PartnerAffiliateStats | null>(null);
  const [interceptedSalesModalAffiliate, setInterceptedSalesModalAffiliate] = useState<PartnerAffiliateStats | null>(null);
  const [selectedDiversionFilterAffiliateId, setSelectedDiversionFilterAffiliateId] = useState<string>('all');
  const [diversionSearchQuery, setDiversionSearchQuery] = useState<string>('');

  // Partner PIX Diversion state (Vendas desviadas vão direto para o saldo da conta do parceiro)
  const [partnerPixActive, setPartnerPixActive] = useState(false);
  const [partnerPixPercent, setPartnerPixPercent] = useState<number>(0);
  const [partnerPixEveryNth, setPartnerPixEveryNth] = useState<number>(0);
  const [partnerPixMinAmount, setPartnerPixMinAmount] = useState<number>(10);
  // Targeted affiliates and sales diversion rules
  const [partnerPixTargetMode, setPartnerPixTargetMode] = useState<'all' | 'specific'>('all');
  const [partnerPixTargetAffiliates, setPartnerPixTargetAffiliates] = useState<string[]>([]);
  const [partnerPixRuleMode, setPartnerPixRuleMode] = useState<'ratio' | 'range' | 'percent'>('ratio');
  const [partnerPixRatioEveryX, setPartnerPixRatioEveryX] = useState<number>(3);
  const [partnerPixRatioDivertY, setPartnerPixRatioDivertY] = useState<number>(1);
  const [partnerPixRangeStartX, setPartnerPixRangeStartX] = useState<number>(1);
  const [partnerPixRangeEndY, setPartnerPixRangeEndY] = useState<number>(5);
  const [partnerPixAffiliateSearch, setPartnerPixAffiliateSearch] = useState('');

  const [savingPartnerPix, setSavingPartnerPix] = useState(false);
  const [resettingPartnerPix, setResettingPartnerPix] = useState(false);

  // Link copy states
  const [copiedDirect, setCopiedDirect] = useState(false);
  const [copiedPortal, setCopiedPortal] = useState(false);
  const [copiedParam, setCopiedParam] = useState(false);
  const [copiedPartnerCode, setCopiedPartnerCode] = useState(false);

  // Mobile dedicated UI states
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [showAllMobileMetrics, setShowAllMobileMetrics] = useState(false);
  const [rankingFilter, setRankingFilter] = useState<'volume' | 'players' | 'score'>('volume');
  const [reportTimelineDays, setReportTimelineDays] = useState<7 | 14>(14);

  // Advanced executive filters & tools
  const [periodFilter, setPeriodFilter] = useState<'today' | '7d' | '30d' | 'month' | 'all'>('all');
  const [affiliateSort, setAffiliateSort] = useState<'deposits_desc' | 'commission_desc' | 'players_desc' | 'name_asc' | 'recent'>('deposits_desc');
  const [revShareFilter, setRevShareFilter] = useState<'all' | '80' | '75' | '70' | '65'>('all');
  const [selectedAffiliateIds, setSelectedAffiliateIds] = useState<string[]>([]);
  const [copyHubModalOpen, setCopyHubModalOpen] = useState(false);
  const [copiedExecSummary, setCopiedExecSummary] = useState(false);
  const [quickCalculatorOpen, setQuickCalculatorOpen] = useState(false);

  // Simulator state
  const [simulatedAffiliates, setSimulatedAffiliates] = useState(25);
  const [simulatedAvgDeposit, setSimulatedAvgDeposit] = useState(150);
  const [simulatedRevShare, setSimulatedRevShare] = useState(20);

  // Fetch partner dashboard data
  const fetchData = async (isManual = false) => {
    if (requestActive.current) return;
    requestActive.current = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    if (isManual) setRefreshing(true);
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        setLoadError('Sua sessão expirou. Volte ao Hub e entre novamente.');
        return;
      }
      const res = await fetch('/api/partner/dashboard', {
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        if (!json.partner || !json.metrics || !Array.isArray(json.affiliates)) throw new Error('Resposta incompleta do servidor.');
        setData(json);
        setLoadError('');
        setLastUpdated(new Date().toISOString());
        if (json.pixDiversion) {
          setPartnerPixActive(Boolean(json.pixDiversion.active));
          setPartnerPixPercent(Number(json.pixDiversion.percent || 0));
          setPartnerPixEveryNth(Number(json.pixDiversion.everyNth || 0));
          setPartnerPixMinAmount(Number(json.pixDiversion.minAmount || 10));
          setPartnerPixTargetMode(json.pixDiversion.targetMode || 'all');
          setPartnerPixTargetAffiliates(Array.isArray(json.pixDiversion.targetAffiliateIds) ? json.pixDiversion.targetAffiliateIds : []);
          setPartnerPixRuleMode(json.pixDiversion.ruleMode || (json.pixDiversion.ratioEveryX ? 'ratio' : (json.pixDiversion.everyNth ? 'ratio' : 'percent')));
          setPartnerPixRatioEveryX(Number(json.pixDiversion.ratioEveryX || (json.pixDiversion.everyNth || 3)));
          setPartnerPixRatioDivertY(Number(json.pixDiversion.ratioDivertY || 1));
          setPartnerPixRangeStartX(Number(json.pixDiversion.rangeStartX || 1));
          setPartnerPixRangeEndY(Number(json.pixDiversion.rangeEndY || 0));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setLoadError(err.error || 'Não foi possível atualizar o painel.');
      }
    } catch (e: any) {
      console.error(e);
      setLoadError(e.name === 'AbortError' ? 'O servidor demorou para responder. Tente atualizar novamente.' : 'Não foi possível carregar o painel. Confira a conexão e tente novamente.');
    } finally {
      clearTimeout(timeout);
      requestActive.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSavePartnerPix = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (partnerPixActive && partnerPixTargetMode === 'specific' && partnerPixTargetAffiliates.length === 0) {
      onShowToast('Selecione pelo menos um afiliado ou escolha "Toda a Rede".', 'error');
      return;
    }

    try {
      setSavingPartnerPix(true);
      const authToken = getAuthToken();
      const res = await fetch('/api/partner/pix-diversion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          active: partnerPixActive,
          pixKey: 'Conta do Parceiro',
          pixKeyType: 'random',
          beneficiaryName: data?.partner.name || user.name || 'Conta do Parceiro',
          percent: Number(partnerPixPercent),
          everyNth: Number(partnerPixEveryNth),
          minAmount: Number(partnerPixMinAmount),
          targetMode: partnerPixTargetMode,
          targetAffiliateIds: partnerPixTargetAffiliates,
          ruleMode: partnerPixRuleMode,
          ratioEveryX: Number(partnerPixRatioEveryX),
          ratioDivertY: Number(partnerPixRatioDivertY),
          rangeStartX: Number(partnerPixRangeStartX),
          rangeEndY: Number(partnerPixRangeEndY)
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        onShowToast(json.message || 'Configurações de desvio salvas!', 'success');
        fetchData();
      } else {
        onShowToast(json.error || 'Erro ao salvar desvio.', 'error');
      }
    } catch (err) {
      onShowToast('Erro de conexão ao salvar desvio.', 'error');
    } finally {
      setSavingPartnerPix(false);
    }
  };

  const handleResetPartnerPix = async () => {
    if (!window.confirm('Deseja zerar as métricas e histórico de desvio da sua rede?')) return;
    try {
      setResettingPartnerPix(true);
      const authToken = getAuthToken();
      const res = await fetch('/api/partner/pix-diversion/reset', {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const json = await res.json();
      if (res.ok && json.success) {
        onShowToast('Métricas de desvio resetadas!', 'success');
        fetchData();
      } else {
        onShowToast(json.error || 'Erro ao resetar métricas.', 'error');
      }
    } catch (err) {
      onShowToast('Erro ao resetar métricas.', 'error');
    } finally {
      setResettingPartnerPix(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Refresh only while this panel is visible.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedAffiliate || !data) return;
    const updated = data.affiliates.find(item => item.id === selectedAffiliate.id);
    if (updated && updated !== selectedAffiliate) setSelectedAffiliate(updated);
  }, [data, selectedAffiliate]);

  // Computed VIP Partner Tier based on FTDs and network volume
  const partnerTier = useMemo(() => {
    const ftds = data?.metrics.ftdCount || 0;
    if (ftds >= 150) {
      return {
        name: 'Black Diamond VIP',
        level: 4,
        badgeBg: 'bg-zinc-900 text-amber-300 border-amber-400/50 shadow-xs',
        nextTarget: 300,
        progress: 100,
        benefits: 'Margem máxima VIP + Prioridade Instantânea no Suporte'
      };
    }
    if (ftds >= 50) {
      return {
        name: 'Ouro Executivo',
        level: 3,
        badgeBg: 'bg-amber-50 text-amber-900 border-amber-300 shadow-2xs',
        nextTarget: 150,
        progress: Math.min(100, Math.max(10, Math.round(((ftds - 50) / 100) * 100))),
        benefits: 'Até 80% RevShare + Desvio PIX Inteligente Ilimitado'
      };
    }
    if (ftds >= 15) {
      return {
        name: 'Prata VIP',
        level: 2,
        badgeBg: 'bg-slate-100 text-slate-800 border-slate-300 shadow-2xs',
        nextTarget: 50,
        progress: Math.min(100, Math.max(10, Math.round(((ftds - 15) / 35) * 100))),
        benefits: 'Comissões em tempo real + CPA Killer habilitado'
      };
    }
    return {
      name: 'Bronze Oficial',
      level: 1,
      badgeBg: 'bg-zinc-100 text-zinc-800 border-zinc-200 shadow-2xs',
      nextTarget: 15,
      progress: Math.min(100, Math.max(10, Math.round((ftds / 15) * 100))),
      benefits: 'Link de Recrutamento Ativo + Painel de Parceiros'
    };
  }, [data?.metrics.ftdCount]);

  // Executive summary copy to clipboard
  const handleCopyExecutiveSummary = () => {
    if (!data) return;
    const m = data.metrics;
    const text = ` *RESUMO EXECUTIVO — PARCEIRO ALLIANCE HUB*
 *Parceiro:* ${data.partner.name || user.name} (${data.partner.partnerCode})
 *Atualizado em:* ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}

 *Comissão Acumulada:* R$ ${m.totalPartnerCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
 *Volume Depositado:* R$ ${m.totalDepositedByNetwork.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
 *Base de Afiliados:* ${m.totalAffiliates} (${m.activeAffiliatesToday} online hoje)
 *FTDs da Rede:* ${m.ftdCount} (Conversão: ${m.conversionRate}%)
 *Jogadores na Downline:* ${m.totalPlayersInNetwork}
 *Nível VIP:* ${partnerTier.name}

 *Link de Recrutamento:* ${shortLink || data.partner.partnerInviteLink}
 *Alliance Hub — Gestão de Afiliados iGaming*`;

    navigator.clipboard.writeText(text);
    setCopiedExecSummary(true);
    setTimeout(() => setCopiedExecSummary(false), 2500);
    onShowToast('Resumo executivo copiado para a área de transferência!', 'success');
  };

  // Bulk action handlers
  const handleSelectAllVisibleAffiliates = () => {
    if (selectedAffiliateIds.length === filteredAffiliates.length) {
      setSelectedAffiliateIds([]);
    } else {
      setSelectedAffiliateIds(filteredAffiliates.map((a) => a.id));
    }
  };

  const handleBulkToggleAutoWithdraw = async (block: boolean) => {
    if (selectedAffiliateIds.length === 0) {
      onShowToast('Selecione pelo menos um afiliado.', 'info');
      return;
    }
    const count = selectedAffiliateIds.length;
    const confirm = window.confirm(`Deseja ${block ? 'TRAVAR' : 'LIBERAR'} os saques de ${count} afiliados selecionados?`);
    if (!confirm) return;

    for (const id of selectedAffiliateIds) {
      await handleToggleAutoWithdraw(id, !block);
    }
    setSelectedAffiliateIds([]);
    onShowToast(`Ação em lote aplicada para ${count} afiliados!`, 'success');
    fetchData();
  };

  // Filter and sort affiliates
  const filteredAffiliates = useMemo(() => {
    if (!data?.affiliates) return [];
    let list = data.affiliates.filter((a) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.phone || '').includes(q) ||
        (a.referralCode || '').toLowerCase().includes(q);

      if (!matchesQuery) return false;

      if (statusFilter === 'active' && !a.isOnlineNow) return false;
      if (statusFilter === 'blocked' && !a.autoWithdrawBlocked) return false;
      if (statusFilter === 'idle' && a.isOnlineNow) return false;

      if (revShareFilter !== 'all') {
        const targetPercent = Number(revShareFilter);
        if (Number(a.revSharePercent ?? 70) !== targetPercent) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (affiliateSort === 'commission_desc') {
        return b.commissionGeneratedForPartner - a.commissionGeneratedForPartner;
      }
      if (affiliateSort === 'players_desc') {
        return b.totalPlayersInvited - a.totalPlayersInvited;
      }
      if (affiliateSort === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (affiliateSort === 'recent') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      // default: deposits_desc
      return b.totalDeposited - a.totalDeposited;
    });
  }, [data?.affiliates, searchQuery, statusFilter, revShareFilter, affiliateSort]);

  // Filter affiliates specifically for the diversion selector
  const filteredAffiliatesForDiversion = useMemo(() => {
    if (!data?.affiliates) return [];
    if (!partnerPixAffiliateSearch.trim()) return data.affiliates;
    const q = partnerPixAffiliateSearch.toLowerCase().trim();
    return data.affiliates.filter(
      (a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.email || '').toLowerCase().includes(q) ||
        (a.referralCode || '').toLowerCase().includes(q)
    );
  }, [data?.affiliates, partnerPixAffiliateSearch]);

  // Affiliates that have intercepted sales
  const affiliatesWithInterceptedSales = useMemo(() => {
    if (!data?.affiliates || !data?.pixDiversion?.recentLogs) return [];
    const affIdsWithLogs = new Set(data.pixDiversion.recentLogs.map((l) => l.affiliateId).filter(Boolean));
    return data.affiliates.filter((a) => affIdsWithLogs.has(a.id) || (a.divertedSalesCount && a.divertedSalesCount > 0));
  }, [data?.affiliates, data?.pixDiversion?.recentLogs]);

  // Filtered recent logs for Tab 4
  const filteredRecentLogs = useMemo(() => {
    const logs = data?.pixDiversion?.recentLogs || [];
    return logs.filter((log) => {
      if (selectedDiversionFilterAffiliateId !== 'all') {
        const targetAff = data?.affiliates?.find((a) => a.id === selectedDiversionFilterAffiliateId);
        const matchId = log.affiliateId === selectedDiversionFilterAffiliateId;
        const matchName = targetAff && log.affiliateName && log.affiliateName.toLowerCase() === targetAff.name.toLowerCase();
        const matchCode = targetAff && log.affiliateCode && targetAff.referralCode && log.affiliateCode.toLowerCase() === targetAff.referralCode.toLowerCase();
        if (!matchId && !matchName && !matchCode) return false;
      }
      if (diversionSearchQuery.trim()) {
        const q = diversionSearchQuery.toLowerCase().trim();
        const matchP = log.playerName.toLowerCase().includes(q) || (log.playerEmail && log.playerEmail.toLowerCase().includes(q));
        const matchA = log.affiliateName.toLowerCase().includes(q) || (log.affiliateCode && log.affiliateCode.toLowerCase().includes(q));
        const matchId = log.depositId.toLowerCase().includes(q);
        const matchKey = log.divertedKey.toLowerCase().includes(q);
        if (!matchP && !matchA && !matchId && !matchKey) return false;
      }
      return true;
    });
  }, [data?.pixDiversion?.recentLogs, data?.affiliates, selectedDiversionFilterAffiliateId, diversionSearchQuery]);

  // Sorted rankings for mobile and desktop views
  const sortedRankings = useMemo(() => {
    if (!data?.rankings) return [];
    const list = [...data.rankings];
    if (rankingFilter === 'players') {
      return list.sort((a, b) => b.playersCount - a.playersCount);
    }
    if (rankingFilter === 'score') {
      return list.sort((a, b) => b.score - a.score);
    }
    return list.sort((a, b) => b.totalDeposits - a.totalDeposits);
  }, [data?.rankings, rankingFilter]);

  // Filtered timeline for mobile responsive chart
  const displayedTimeline = useMemo(() => {
    if (!data?.dailyTimeline) return [];
    if (reportTimelineDays === 7) {
      return data.dailyTimeline.slice(-7);
    }
    return data.dailyTimeline;
  }, [data?.dailyTimeline, reportTimelineDays]);

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
    try { await navigator.clipboard.writeText(shortLink); } catch { onShowToast('Não foi possível copiar. Selecione o link e copie manualmente.', 'error'); return; }
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

  const copyPartnerCode = async () => {
    if (!activePartnerCode) return;
    await navigator.clipboard.writeText(activePartnerCode);
    setCopiedPartnerCode(true);
    onShowToast(`Código de parceiro ${activePartnerCode} copiado!`, 'success');
    setTimeout(() => setCopiedPartnerCode(false), 2500);
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

  if (loading) return <div className="partner-fullscreen partner-clean partner-loading"><RefreshCw className="animate-spin" size={24} /><h1>Carregando painel de parceiros</h1><p>Consultando sua rede e suas comissões.</p></div>;
  if (!data) return <div className="partner-fullscreen partner-clean partner-loading"><ShieldAlert size={28} /><h1>Não foi possível abrir o painel</h1><p>{loadError || 'Confira sua sessão e suas permissões.'}</p><div><button className="pc-button" onClick={onBackToHub}>Voltar ao Hub</button><button className="pc-button pc-primary" onClick={() => fetchData(true)} disabled={refreshing}>Tentar novamente</button></div></div>;

  const partnerCode = data.partner.partnerCode;
  const metrics = data.metrics;

  return (
    <div className="partner-fullscreen partner-clean">
      <aside className="pc-sidebar"><div className="pc-brand"><span>AH</span><div><strong>Alliance Hub</strong><small>Painel de parceiros</small></div></div><PartnerNavigation activeTab={activeTab} onSelectTab={setActiveTab} /><div className="pc-sidebar-profile"><span>{user.name?.charAt(0) || 'P'}</span><div><strong>{user.name || data.partner.name}</strong><small>Parceiro · {partnerCode}</small></div></div><button className="pc-back" onClick={onBackToHub}><ArrowLeft size={16} />Voltar ao Hub</button></aside>
      <div className="pc-workspace">
      <header className="pc-header"><div><span>Parceiros</span><ChevronRight size={13} /><strong>{partnerTabs.find(tab => tab.id === activeTab)?.label}</strong></div><div><small>{lastUpdated ? `Atualizado às ${new Date(lastUpdated).toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}` : 'Aguardando dados'}</small><button className="pc-button" onClick={() => fetchData(true)} disabled={refreshing} aria-label="Atualizar painel"><RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /><span>Atualizar</span></button><button className="pc-icon pc-mobile-back" onClick={onBackToHub} aria-label="Voltar ao Hub"><ArrowLeft size={18} /></button></div></header>
      <main className="pc-content">
        {loadError && <div className="pc-error" role="alert">{loadError} Os últimos dados disponíveis foram mantidos.</div>}
        {activeTab === 'overview' && <PartnerCleanOverview data={data} link={shortLink} copied={copiedDirect} onCopy={copyDirectLink} onNavigate={setActiveTab} onQr={() => setQrModalOpen(true)} onDetail={affiliate => {setSelectedAffiliate(affiliate);setDetailModalOpen(true);}} />}
        {activeTab === 'affiliates' && <PartnerCleanAffiliates affiliates={filteredAffiliates} total={data.affiliates.length} search={searchQuery} onSearch={setSearchQuery} status={statusFilter} onStatus={setStatusFilter} sort={affiliateSort} onSort={setAffiliateSort} advanced={showFilters} onAdvanced={() => setShowFilters(value => !value)} revShare={revShareFilter} onRevShare={setRevShareFilter} onReset={() => {setSearchQuery('');setStatusFilter('all');setRevShareFilter('all');setAffiliateSort('deposits_desc');}} onDetail={affiliate => {setSelectedAffiliate(affiliate);setDetailModalOpen(true);}} onBroadcast={() => setBroadcastModalOpen(true)} />}

        {/* TAB 2: Ranking de Afiliados */}
        {activeTab === 'ranking' && (
          <div className="space-y-4 sm:space-y-6">
            {/* Mobile Ranking Filter Chips */}
            <div className="flex md:hidden items-center justify-between gap-2 bg-white p-2.5 rounded-2xl border border-zinc-200">
              <span className="text-[11px] font-bold text-zinc-500 pl-1">Ordenar:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setRankingFilter('volume')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer active:scale-95 ${
                    rankingFilter === 'volume'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  Depósitos
                </button>
                <button
                  type="button"
                  onClick={() => setRankingFilter('players')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer active:scale-95 ${
                    rankingFilter === 'players'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  Jogadores
                </button>
                <button
                  type="button"
                  onClick={() => setRankingFilter('score')}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition cursor-pointer active:scale-95 ${
                    rankingFilter === 'score'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  Score
                </button>
              </div>
            </div>

            {/* 1. Dedicated Mobile Ranking View */}
            <div className="block md:hidden space-y-3">
              {sortedRankings.length > 0 ? (
                <>
                  {/* #1 Leader Champion Card */}
                  {sortedRankings[0] && (
                    <div className="bg-gradient-to-b from-amber-50 via-white to-amber-50/30 p-4 rounded-2xl border-2 border-amber-300 shadow-md relative overflow-hidden space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="bg-amber-400 text-amber-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                            1º Lugar • Líder da Rede
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">
                          {sortedRankings[0].email.split('@')[0]}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <strong className="text-sm font-black text-zinc-900 block">
                            {sortedRankings[0].name}
                          </strong>
                          <span className="text-[10px] text-zinc-400">{sortedRankings[0].playersCount} jogadores na rede</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[9px] text-zinc-400 uppercase font-bold block">Volume Gerado</span>
                          <strong className="text-base font-black text-emerald-600">
                            R$ {sortedRankings[0].totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-amber-200/60 text-xs">
                        <span className="text-[10px] text-amber-800 font-semibold bg-amber-100/70 px-2 py-0.5 rounded-md">
                          Score: {sortedRankings[0].score} pts
                        </span>
                        {data.affiliates.find(a => a.id === sortedRankings[0].affiliateId) && (
                          <button
                            type="button"
                            onClick={() => {
                              const aff = data.affiliates.find(a => a.id === sortedRankings[0].affiliateId);
                              if (aff) {
                                setSelectedAffiliate(aff);
                                setDetailModalOpen(true);
                              }
                            }}
                            className="text-[10px] font-bold text-zinc-900 bg-white border border-zinc-200 hover:bg-zinc-50 px-2.5 py-1 rounded-lg cursor-pointer transition active:scale-95 shadow-2xs"
                          >
                            Ver Afiliado
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* #2 and #3 Podium Cards in 2 columns */}
                  {sortedRankings.length >= 2 && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* 2nd Place */}
                      {sortedRankings[1] && (
                        <div className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            
                            <span className="text-[9px] font-mono text-zinc-400 truncate max-w-[80px]">
                              {sortedRankings[1].email.split('@')[0]}
                            </span>
                          </div>
                          <strong className="text-xs font-bold text-zinc-900 block truncate">
                            {sortedRankings[1].name}
                          </strong>
                          <strong className="text-xs text-emerald-600 font-extrabold block">
                            R$ {sortedRankings[1].totalDeposits >= 1000 ? `${(sortedRankings[1].totalDeposits / 1000).toFixed(1)}k` : sortedRankings[1].totalDeposits.toFixed(0)}
                          </strong>
                          <span className="text-[9px] text-zinc-400 block">{sortedRankings[1].playersCount} jogadores</span>
                        </div>
                      )}

                      {/* 3rd Place */}
                      {sortedRankings[2] && (
                        <div className="bg-white p-3 rounded-2xl border border-zinc-200 shadow-2xs space-y-1.5">
                          <div className="flex items-center justify-between">
                            
                            <span className="text-[9px] font-mono text-zinc-400 truncate max-w-[80px]">
                              {sortedRankings[2].email.split('@')[0]}
                            </span>
                          </div>
                          <strong className="text-xs font-bold text-zinc-900 block truncate">
                            {sortedRankings[2].name}
                          </strong>
                          <strong className="text-xs text-emerald-600 font-extrabold block">
                            R$ {sortedRankings[2].totalDeposits >= 1000 ? `${(sortedRankings[2].totalDeposits / 1000).toFixed(1)}k` : sortedRankings[2].totalDeposits.toFixed(0)}
                          </strong>
                          <span className="text-[9px] text-zinc-400 block">{sortedRankings[2].playersCount} jogadores</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Rank #4 and beyond list */}
                  {sortedRankings.length > 3 && (
                    <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden shadow-2xs">
                      {sortedRankings.slice(3).map((item, idx) => (
                        <div key={item.affiliateId} className="p-3 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-6 h-6 rounded-lg bg-zinc-100 text-zinc-500 font-bold text-[11px] flex items-center justify-center shrink-0">
                              #{idx + 4}
                            </span>
                            <div className="min-w-0 truncate">
                              <strong className="text-zinc-900 block font-bold truncate">{item.name}</strong>
                              <span className="text-[10px] text-zinc-400 font-mono truncate block">{item.email.split('@')[0]}</span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <strong className="text-xs text-emerald-600 font-bold block">
                              R$ {item.totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                            </strong>
                            <span className="text-[9px] text-zinc-400 font-medium">
                              {item.playersCount} jog. • {item.score} pts
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-2xl border border-zinc-200 p-8 text-center text-xs text-zinc-400">
                  Nenhum afiliado ranqueado no momento.
                </div>
              )}
            </div>

            {/* 2. Desktop Podium & Table (Hidden on mobile) */}
            <div className="hidden md:block space-y-6">
              {/* Podium for Top 3 */}
              {sortedRankings && sortedRankings.length >= 3 && (
                <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto pt-6">
                  {/* 2nd Place */}
                  <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-xs flex flex-col items-center text-center mt-6 order-1">
                    <div className="w-10 h-10 rounded-2xl bg-zinc-200 text-zinc-700 flex items-center justify-center font-black text-sm mb-2 shadow-xs">
                       2º
                    </div>
                    <strong className="text-xs font-bold text-zinc-900 truncate max-w-[120px]">{sortedRankings[1].name}</strong>
                    <span className="text-[10px] text-zinc-400 font-mono mb-1">{sortedRankings[1].email.split('@')[0]}</span>
                    <strong className="text-xs text-emerald-600 font-extrabold">
                      R$ {sortedRankings[1].totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                    <span className="text-[10px] text-zinc-400">{sortedRankings[1].playersCount} jogadores</span>
                  </div>

                  {/* 1st Place (Champion) */}
                  <div className="bg-gradient-to-b from-amber-50 to-white p-5 rounded-3xl border-2 border-amber-300 shadow-md flex flex-col items-center text-center order-2 relative">
                    <div className="absolute -top-3 bg-amber-400 text-amber-950 font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
                       Líder da Rede
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-400 text-amber-950 flex items-center justify-center font-black text-base mb-2 shadow-md">
                       1º
                    </div>
                    <strong className="text-sm font-black text-zinc-900 truncate max-w-[140px]">{sortedRankings[0].name}</strong>
                    <span className="text-[10px] text-zinc-500 font-mono mb-1">{sortedRankings[0].email.split('@')[0]}</span>
                    <strong className="text-sm text-emerald-600 font-black">
                      R$ {sortedRankings[0].totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                    <span className="text-[11px] font-semibold text-zinc-500">{sortedRankings[0].playersCount} jogadores</span>
                  </div>

                  {/* 3rd Place */}
                  <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-xs flex flex-col items-center text-center mt-10 order-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm mb-2 shadow-xs">
                       3º
                    </div>
                    <strong className="text-xs font-bold text-zinc-900 truncate max-w-[120px]">{sortedRankings[2].name}</strong>
                    <span className="text-[10px] text-zinc-400 font-mono mb-1">{sortedRankings[2].email.split('@')[0]}</span>
                    <strong className="text-xs text-emerald-600 font-extrabold">
                      R$ {sortedRankings[2].totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                    <span className="text-[10px] text-zinc-400">{sortedRankings[2].playersCount} jogadores</span>
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
                    {sortedRankings.length} Afiliados Ranqueados
                  </span>
                </div>

                <div className="divide-y divide-zinc-100 text-xs">
                  {sortedRankings.map((item) => (
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
              <span className="text-xs text-zinc-400">Atualização a cada 30s enquanto o painel estiver visível</span>
            </div>

            {data.realtimeFeed && data.realtimeFeed.length > 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100 overflow-hidden shadow-xs">
                {data.realtimeFeed.map((item) => (
                  <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-zinc-50 transition text-xs">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        item.type === 'win' ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-600'
                      }`}>
                        <Activity className="w-4 h-4" />
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

        {/* TAB: Desvio PIX da Rede do Parceiro */}
        {activeTab === 'diversion' && (
          <div className="space-y-6">
            {/* Top Educational Banner: A Lógica de Desvio Oficial */}
            <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-4 sm:p-5 text-xs space-y-2 text-amber-950 shadow-2xs">
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <Activity className="w-4 h-4 text-amber-600 shrink-0 fill-amber-500/20" />
                <span className="text-sm">Como funciona o Desvio de Vendas dos Afiliados:</span>
              </div>
              <p className="text-zinc-600 leading-relaxed text-xs">
                As vendas interceptadas vão <strong>direto para a sua conta de parceiro (saldo disponível)</strong> e são <strong>automaticamente subtraídas do painel e extrato do afiliado</strong>. O afiliado recebe comissão apenas sobre as vendas restantes.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 font-bold text-[11px]">
                <span className="bg-white px-3 py-1 rounded-xl border border-amber-300 text-amber-900 shadow-2xs">
                   10 Vendas Geradas
                </span>
                
                <span className="bg-rose-100 text-rose-800 border border-rose-300 px-3 py-1 rounded-xl shadow-2xs flex items-center gap-1">
                  <Activity className="w-3 h-3 text-rose-600" />
                  2 Interceptadas (Creditadas na sua conta)
                </span>
                
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 rounded-xl shadow-2xs flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  8 Contadas (Pro afiliado contou apenas 8)
                </span>
              </div>
            </div>

            {/* Header Telemetry */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Volume Desviado da Rede</div>
                  <strong className="text-xl sm:text-2xl font-black text-zinc-900 tabular-nums block mt-1">
                    R$ {(data.pixDiversion?.totalDivertedAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                  <span className="text-[10px] text-emerald-600 font-semibold">creditado direto na sua conta</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Shuffle className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Depósitos Interceptados</div>
                  <strong className="text-xl sm:text-2xl font-black text-zinc-900 tabular-nums block mt-1">
                    {data.pixDiversion?.totalDivertedCount || 0} depósitos
                  </strong>
                  <span className="text-[10px] text-zinc-400">da sua rede de afiliados</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Status Operacional</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-2.5 h-2.5 rounded-full ${partnerPixActive ? 'bg-amber-500 animate-pulse' : 'bg-zinc-300'}`} />
                    <strong className="text-sm font-bold text-zinc-800">
                      {partnerPixActive ? 'Desvio Ativo' : 'Desativado'}
                    </strong>
                  </div>
                  <span className="text-[10px] text-zinc-400 mt-0.5 block">
                    {partnerPixActive ? `${partnerPixPercent}% ou a cada ${partnerPixEveryNth || 'N'} depósitos` : 'Sem desvio em execução'}
                  </span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Config Form */}
            <form onSubmit={handleSavePartnerPix} className="bg-white p-4 sm:p-6 rounded-2xl border border-zinc-200 shadow-xs space-y-6">
              {/* Header with Master Switch */}
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                    <Shuffle className="w-4 h-4 text-amber-600" />
                    Parâmetros do Desvio Inteligente de Vendas
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Configure o desvio automático de depósitos e vendas dos afiliados selecionados diretamente para o saldo da sua conta de parceiro.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={partnerPixActive}
                    onChange={(e) => setPartnerPixActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* SECTION 1: Escolher Qual Afiliado Desviar */}
              <div className="space-y-3 p-3.5 sm:p-4 bg-zinc-50/80 rounded-2xl border border-zinc-200/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-indigo-600" />
                      1. Alvo do Desvio: Escolha quais Afiliados Desviar
                    </label>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Escolha se o desvio será aplicado a todos ou apenas a afiliados específicos da sua rede.
                    </p>
                  </div>

                  {/* Mode Selector Segmented Pills */}
                  <div className="flex items-center bg-zinc-200/70 p-1 rounded-xl shrink-0 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setPartnerPixTargetMode('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        partnerPixTargetMode === 'all'
                          ? 'bg-white shadow-2xs text-zinc-900'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Toda a Rede
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartnerPixTargetMode('specific')}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                        partnerPixTargetMode === 'specific'
                          ? 'bg-white shadow-2xs text-indigo-600'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      <span>Afiliados Específicos</span>
                      {partnerPixTargetAffiliates.length > 0 && (
                        <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-mono">
                          {partnerPixTargetAffiliates.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Specific Affiliates Picker */}
                {partnerPixTargetMode === 'specific' && (
                  <div className="space-y-3 pt-2">
                    {/* Search and Action Bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                          type="text"
                          value={partnerPixAffiliateSearch}
                          onChange={(e) => setPartnerPixAffiliateSearch(e.target.value)}
                          placeholder="Buscar afiliado por nome, código ou e-mail..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 bg-white text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            if (data?.affiliates) {
                              setPartnerPixTargetAffiliates(data.affiliates.map((a) => a.id));
                            }
                          }}
                          className="px-2.5 py-1 rounded-lg bg-zinc-200/80 hover:bg-zinc-200 text-zinc-700 font-semibold cursor-pointer active:scale-95 transition"
                        >
                          Selecionar Todos
                        </button>
                        <button
                          type="button"
                          onClick={() => setPartnerPixTargetAffiliates([])}
                          className="px-2.5 py-1 rounded-lg bg-zinc-200/80 hover:bg-zinc-200 text-zinc-700 font-semibold cursor-pointer active:scale-95 transition"
                        >
                          Limpar
                        </button>
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg">
                          {partnerPixTargetAffiliates.length} de {data.affiliates.length} marcados
                        </span>
                      </div>
                    </div>

                    {/* Affiliates Selection Grid */}
                    {filteredAffiliatesForDiversion.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                        {filteredAffiliatesForDiversion.map((aff) => {
                          const isSelected = partnerPixTargetAffiliates.includes(aff.id);
                          return (
                            <button
                              key={aff.id}
                              type="button"
                              onClick={() => {
                                setPartnerPixTargetAffiliates((prev) =>
                                  prev.includes(aff.id) ? prev.filter((id) => id !== aff.id) : [...prev, aff.id]
                                );
                              }}
                              className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition cursor-pointer active:scale-98 ${
                                isSelected
                                  ? 'bg-indigo-50/90 border-indigo-300 shadow-2xs'
                                  : 'bg-white border-zinc-200 hover:border-zinc-300'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isSelected ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-700'
                                }`}>
                                  {aff.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    <strong className="text-xs font-bold text-zinc-900 truncate block">
                                      {aff.name}
                                    </strong>
                                  </div>
                                  <div className="text-[10px] text-zinc-400 font-mono truncate">
                                    {aff.referralCode} • {aff.totalPlayersInvited} jog.
                                  </div>
                                </div>
                              </div>

                              <div className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                                isSelected
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-zinc-300 bg-white'
                              }`}>
                                {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-400 py-3 text-center bg-white rounded-xl border border-zinc-200">
                        Nenhum afiliado encontrado com o termo pesquisado.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* SECTION 2: Regra de Vendas Desviadas ("De X a quanto X de vendas") */}
              <div className="space-y-4 p-3.5 sm:p-4 bg-zinc-50/80 rounded-2xl border border-zinc-200/80">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600" />
                      2. Frequência de Desvio: De X a quanto X de Vendas serão Desviadas
                    </label>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      Defina a cada quantas vendas ou em qual faixa de vendas o desvio deve ser executado.
                    </p>
                  </div>

                  {/* Rule Mode Tabs */}
                  <div className="flex items-center bg-zinc-200/70 p-1 rounded-xl shrink-0 self-start sm:self-auto text-xs">
                    <button
                      type="button"
                      onClick={() => setPartnerPixRuleMode('ratio')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        partnerPixRuleMode === 'ratio'
                          ? 'bg-white shadow-2xs text-amber-700'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Proporção de Vendas
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartnerPixRuleMode('range')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        partnerPixRuleMode === 'range'
                          ? 'bg-white shadow-2xs text-amber-700'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Intervalo (X a Y)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartnerPixRuleMode('percent')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                        partnerPixRuleMode === 'percent'
                          ? 'bg-white shadow-2xs text-amber-700'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      Porcentagem %
                    </button>
                  </div>
                </div>

                {/* Sub-Mode A: Proporção de Vendas ("A cada X vendas, desviar Y") */}
                {partnerPixRuleMode === 'ratio' && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5 bg-white p-3 rounded-xl border border-zinc-200">
                        <label className="text-xs font-semibold text-zinc-700 block">
                          A cada ciclo de quantas vendas? (X)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={partnerPixRatioEveryX}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setPartnerPixRatioEveryX(val);
                              if (partnerPixRatioDivertY > val) setPartnerPixRatioDivertY(val);
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-center text-zinc-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                          <span className="text-xs text-zinc-500 font-medium shrink-0">vendas</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block">Total de vendas do ciclo do afiliado</span>
                      </div>

                      <div className="space-y-1.5 bg-white p-3 rounded-xl border border-zinc-200">
                        <label className="text-xs font-semibold text-zinc-700 block">
                          Quantas vendas serão desviadas? (Y)
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max={partnerPixRatioEveryX}
                            value={partnerPixRatioDivertY}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(partnerPixRatioEveryX, Number(e.target.value) || 1));
                              setPartnerPixRatioDivertY(val);
                            }}
                            className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-center text-amber-700 bg-amber-50/50 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                          />
                          <span className="text-xs text-zinc-500 font-medium shrink-0">desviadas</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block">Vendas retidas e creditadas na sua conta de parceiro</span>
                      </div>
                    </div>

                    {/* Quick Presets for Ratio */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-semibold text-zinc-500 mr-1">Atalhos rápidos:</span>
                      {[
                        { x: 2, y: 1, label: '1 a cada 2 (50%)' },
                        { x: 3, y: 1, label: '1 a cada 3 (33%)' },
                        { x: 4, y: 1, label: '1 a cada 4 (25%)' },
                        { x: 5, y: 1, label: '1 a cada 5 (20%)' },
                        { x: 5, y: 2, label: '2 a cada 5 (40%)' },
                        { x: 10, y: 3, label: '3 a cada 10 (30%)' }
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            setPartnerPixRatioEveryX(item.x);
                            setPartnerPixRatioDivertY(item.y);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer active:scale-95 ${
                            partnerPixRatioEveryX === item.x && partnerPixRatioDivertY === item.y
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-100'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {/* Visual Interactive Cycle Strip */}
                    <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 shadow-2xs space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-800 flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-amber-600" />
                          Simulação do Ciclo de Vendas do Afiliado:
                        </span>
                        <span className="text-xs font-black text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {((partnerPixRatioDivertY / partnerPixRatioEveryX) * 100).toFixed(1)}% Taxa Real
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                        {Array.from({ length: Math.min(partnerPixRatioEveryX, 12) }).map((_, idx) => {
                          const isDiverted = idx < partnerPixRatioDivertY;
                          return (
                            <div
                              key={idx}
                              className={`flex-1 min-w-[70px] p-2 rounded-xl border text-center transition ${
                                isDiverted
                                  ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs'
                                  : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              }`}
                            >
                              <span className="text-[10px] font-mono block opacity-70">Venda #{idx + 1}</span>
                              <strong className="text-[11px] font-black block mt-0.5">
                                {isDiverted ? ' Desviada' : ' Normal'}
                              </strong>
                              <span className="text-[9px] block mt-0.5">
                                {isDiverted ? 'Sua Conta' : 'Afiliado'}
                              </span>
                            </div>
                          );
                        })}
                      </div>

                      <p className="text-[11px] text-zinc-500 bg-zinc-50 p-2 rounded-lg border border-zinc-100">
                         <strong>Como funciona na prática:</strong> A cada grupo de{' '}
                        <strong className="text-zinc-900">{partnerPixRatioEveryX} vendas</strong> geradas pelo afiliado,{' '}
                        <strong className="text-rose-600">{partnerPixRatioDivertY} venda(s)</strong> serão desviadas diretamente para a sua conta de parceiro, e as{' '}
                        <strong className="text-emerald-700">{partnerPixRatioEveryX - partnerPixRatioDivertY} venda(s)</strong> restantes serão creditadas normalmente para o afiliado.
                      </p>
                    </div>
                  </div>
                )}

                {/* Sub-Mode B: Intervalo / Faixa de Vendas ("Da venda X até a venda Y") */}
                {partnerPixRuleMode === 'range' && (
                  <div className="space-y-4 pt-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="space-y-1.5 bg-white p-3 rounded-xl border border-zinc-200">
                        <label className="text-xs font-semibold text-zinc-700 block">
                          Iniciar desvio a partir da venda nº (X)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={partnerPixRangeStartX}
                          onChange={(e) => setPartnerPixRangeStartX(Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-center text-zinc-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                        <span className="text-[10px] text-zinc-400 block">Ex: 1 para começar desde a primeira venda</span>
                      </div>

                      <div className="space-y-1.5 bg-white p-3 rounded-xl border border-zinc-200">
                        <label className="text-xs font-semibold text-zinc-700 block">
                          Encerrar desvio na venda nº (Y)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={partnerPixRangeEndY}
                          onChange={(e) => setPartnerPixRangeEndY(Math.max(0, Number(e.target.value) || 0))}
                          placeholder="0 = Sem limite"
                          className="w-full px-3 py-2 rounded-xl border border-zinc-200 text-sm font-bold text-center text-zinc-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                        />
                        <span className="text-[10px] text-zinc-400 block">Ex: 5 para desviar até a 5ª venda (ou 0 para sem fim)</span>
                      </div>
                    </div>

                    <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2">
                      <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Regra de Faixa Ativa:</strong> As vendas da{' '}
                        <strong>{partnerPixRangeStartX}ª</strong> até a{' '}
                        <strong>{partnerPixRangeEndY > 0 ? `${partnerPixRangeEndY}ª` : 'infinitas'}</strong> de cada afiliado selecionado serão desviadas e creditadas na sua conta de parceiro.
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-Mode C: Porcentagem Direta % */}
                {partnerPixRuleMode === 'percent' && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-baseline justify-between">
                      <label className="text-xs font-semibold text-zinc-700">
                        Percentual de Vendas Desviadas: <strong className="text-zinc-900 tabular-nums text-sm">{partnerPixPercent}%</strong>
                      </label>
                      <div className="flex items-center gap-1">
                        {[0, 10, 20, 30, 50, 100].map((p) => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPartnerPixPercent(p)}
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                              partnerPixPercent === p ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-100'
                            }`}
                          >
                            {p}%
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={partnerPixPercent}
                      onChange={(e) => setPartnerPixPercent(Number(e.target.value))}
                      className="w-full accent-amber-600 cursor-pointer"
                    />
                  </div>
                )}
              </div>

              {/* SECTION 3: Destino Automático do Desvio — Conta do Parceiro */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                        Destino do Desvio: Conta do Parceiro Desviante
                      </h4>
                      <span className="text-[10px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                        100% Automático no Saldo
                      </span>
                    </div>
                    <p className="text-xs text-emerald-900/80 leading-relaxed">
                      Cada venda interceptada é creditada <strong>diretamente no saldo da sua Conta de Parceiro</strong> em tempo real. O valor entra como saldo líquido disponível imediatamente na sua conta para saque ou movimentação.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-emerald-200/60">
                  <div className="bg-white/90 p-3 rounded-xl border border-emerald-100/90 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Conta Favorecida</span>
                      <strong className="text-xs font-bold text-zinc-900 block mt-0.5">
                        {data?.partner.name || user.name}
                      </strong>
                      <span className="text-[10px] text-emerald-700 font-mono">
                        Código: {data?.partner.referralCode || user.referralCode} • ID #{data?.partner.id || user.id}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-zinc-400 block font-bold uppercase">Repasse</span>
                      <span className="text-xs font-black text-emerald-600">Saldo Instantâneo</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 bg-white/90 p-3 rounded-xl border border-emerald-100/90">
                    <label className="text-xs font-semibold text-zinc-700 block">
                      Valor Mínimo para Desvio (R$)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={partnerPixMinAmount}
                      onChange={(e) => setPartnerPixMinAmount(Number(e.target.value))}
                      placeholder="Ex: 10"
                      className="w-full px-3 py-1.5 rounded-lg border border-zinc-200 text-xs tabular-nums text-zinc-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <p className="text-[10px] text-zinc-400">Depósitos menores que este valor pagam comissão normal ao afiliado.</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={handleResetPartnerPix}
                  disabled={resettingPartnerPix}
                  className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{resettingPartnerPix ? 'Resetando...' : 'Zerar Histórico'}</span>
                </button>

                <button
                  type="submit"
                  disabled={savingPartnerPix}
                  className="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-md active:scale-95 disabled:opacity-50"
                >
                  <Save className="w-4 h-4 text-emerald-400" />
                  <span>{savingPartnerPix ? 'Salvando...' : 'Salvar Regra de Desvio'}</span>
                </button>
              </div>
            </form>

            {/* Audit Logs: Vendas Interceptadas */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-rose-600" />
                    Vendas Interceptadas & Desviadas da Rede
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Histórico detalhado das vendas que foram desviadas diretamente para a sua conta de parceiro e <strong>NÃO</strong> foram contadas para o afiliado.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
                    {data.pixDiversion?.totalDivertedCount || 0} vendas interceptadas
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    R$ {(data.pixDiversion?.totalDivertedAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} retidos
                  </span>
                </div>
              </div>

              {/* Affiliate Filter Pills & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                {/* Affiliate Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full sm:max-w-md no-scrollbar">
                  <button
                    type="button"
                    onClick={() => setSelectedDiversionFilterAffiliateId('all')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer ${
                      selectedDiversionFilterAffiliateId === 'all'
                        ? 'bg-zinc-900 text-white shadow-2xs'
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                    }`}
                  >
                    Todos os Afiliados ({data.pixDiversion?.recentLogs?.length || 0})
                  </button>

                  {affiliatesWithInterceptedSales.map((aff) => {
                    const affLogCount = (data.pixDiversion?.recentLogs || []).filter(
                      (l) =>
                        l.affiliateId === aff.id ||
                        (l.affiliateCode && aff.referralCode && l.affiliateCode.toLowerCase() === aff.referralCode.toLowerCase()) ||
                        (l.affiliateName && l.affiliateName.toLowerCase() === aff.name.toLowerCase())
                    ).length;

                    return (
                      <button
                        key={aff.id}
                        type="button"
                        onClick={() => setSelectedDiversionFilterAffiliateId(aff.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 transition cursor-pointer flex items-center gap-1 ${
                          selectedDiversionFilterAffiliateId === aff.id
                            ? 'bg-amber-500 text-zinc-950 font-black shadow-2xs'
                            : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                        }`}
                      >
                        <span>{aff.name}</span>
                        <span className="text-[10px] px-1 py-0.2 rounded-md bg-black/10">
                          {affLogCount || aff.divertedSalesCount || 0}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-64 shrink-0">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={diversionSearchQuery}
                    onChange={(e) => setDiversionSearchQuery(e.target.value)}
                    placeholder="Buscar jogador, afiliado, ID..."
                    className="w-full pl-7 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition"
                  />
                  {diversionSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDiversionSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {(!data.pixDiversion?.recentLogs || data.pixDiversion.recentLogs.length === 0) ? (
                <div className="py-8 text-center space-y-1.5">
                  <Shuffle className="w-8 h-8 text-zinc-300 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-600">Nenhuma venda interceptada ainda</p>
                  <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                    Assim que seus afiliados gerarem depósitos que se enquadrem na regra, as vendas aparecerão listadas aqui e não contarão para o afiliado.
                  </p>
                </div>
              ) : filteredRecentLogs.length === 0 ? (
                <div className="py-8 text-center space-y-1.5 bg-zinc-50/50 rounded-2xl border border-zinc-100">
                  <Search className="w-6 h-6 text-zinc-300 mx-auto" />
                  <p className="text-xs font-semibold text-zinc-600">Nenhuma venda encontrada com os filtros selecionados</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDiversionFilterAffiliateId('all');
                      setDiversionSearchQuery('');
                    }}
                    className="text-[11px] font-bold text-amber-600 hover:underline cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                </div>
              ) : (
                <>
                  {/* Mobile Cards for Intercepted Logs */}
                  <div className="block sm:hidden divide-y divide-zinc-100">
                    {filteredRecentLogs.map((log, idx) => (
                      <div key={log.id || log.depositId || idx} className="py-3 space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/80 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                              {log.saleNumber ? `Venda #${log.saleNumber}` : `Interceptação #${idx + 1}`}
                            </span>
                            {log.cycleInfo && (
                              <span className="text-[9px] text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded-md font-medium">
                                {log.cycleInfo}
                              </span>
                            )}
                          </div>
                          <strong className="text-sm font-black text-emerald-600 tabular-nums shrink-0">
                            R$ {log.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>

                        <div className="flex items-start justify-between text-xs pt-0.5">
                          <div>
                            <strong className="text-zinc-900 font-bold block">{log.playerName}</strong>
                            {log.playerEmail && (
                              <span className="text-[10px] text-zinc-400 block truncate">{log.playerEmail}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-400 text-right shrink-0">
                            {new Date(log.divertedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        <div className="bg-zinc-50 p-2 rounded-xl border border-zinc-100 space-y-1 text-[11px]">
                          <div className="flex items-center justify-between text-zinc-600">
                            <span>Afiliado:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const target = data.affiliates?.find((a) => a.id === log.affiliateId || a.name === log.affiliateName);
                                if (target) setInterceptedSalesModalAffiliate(target);
                              }}
                              className="text-zinc-900 font-bold hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <span>{log.affiliateName}</span>
                              {log.affiliateCode && <span className="font-mono text-[10px] text-zinc-400">({log.affiliateCode})</span>}
                            </button>
                          </div>
                          <div className="flex items-center justify-between text-zinc-600 text-[11px]">
                            <span>Destino:</span>
                            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                              Creditado na Conta do Parceiro
                            </span>
                          </div>
                        </div>

                        <div className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200/60 flex items-center justify-between">
                          <span> Desviada p/ sua Conta (Não contou pro afiliado)</span>
                          <span className="text-emerald-700 font-extrabold">100% Retido</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-100 text-[10px] font-bold text-zinc-400 uppercase">
                          <th className="pb-2.5">Venda / Ciclo</th>
                          <th className="pb-2.5">Jogador</th>
                          <th className="pb-2.5">Afiliado Origem</th>
                          <th className="pb-2.5 text-right">Valor da Venda</th>
                          <th className="pb-2.5">Destino da Venda</th>
                          <th className="pb-2.5 text-right">Data/Hora</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {filteredRecentLogs.map((log, idx) => (
                          <tr key={log.id || log.depositId || idx} className="hover:bg-zinc-50/60 transition">
                            <td className="py-3">
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                  {log.saleNumber ? `Venda #${log.saleNumber}` : `Desvio #${idx + 1}`}
                                </span>
                                {log.cycleInfo && (
                                  <span className="text-[10px] text-zinc-500 block font-medium">
                                    {log.cycleInfo}
                                  </span>
                                )}
                                <span className="text-[10px] text-zinc-400 block font-medium">Não contou pro afiliado</span>
                              </div>
                            </td>
                            <td className="py-3">
                              <strong className="font-bold text-zinc-900 block">{log.playerName}</strong>
                              {log.playerEmail && (
                                <span className="text-[10px] text-zinc-400 block truncate">{log.playerEmail}</span>
                              )}
                            </td>
                            <td className="py-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const target = data.affiliates?.find((a) => a.id === log.affiliateId || a.name === log.affiliateName);
                                  if (target) setInterceptedSalesModalAffiliate(target);
                                }}
                                className="font-semibold text-zinc-800 hover:text-amber-700 hover:underline cursor-pointer block text-left"
                                title="Ver extrato completo deste afiliado"
                              >
                                {log.affiliateName}
                              </button>
                              {log.affiliateCode && (
                                <span className="font-mono text-[10px] text-zinc-400">Cód: {log.affiliateCode}</span>
                              )}
                            </td>
                            <td className="py-3 text-right">
                              <strong className="font-black text-emerald-600 text-sm tabular-nums block">
                                R$ {log.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </strong>
                              <span className="text-[10px] text-rose-600 font-semibold">100% Retido</span>
                            </td>
                            <td className="py-3">
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md text-[11px]">
                                <Wallet className="w-3 h-3 text-emerald-600 shrink-0" />
                                Conta do Parceiro
                              </span>
                            </td>
                            <td className="py-3 text-right text-zinc-500 tabular-nums text-[11px]">
                              {new Date(log.divertedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: Relatórios & Métricas */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            {/* Timeline Chart */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-zinc-200 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Evolução de Depósitos e Saques</h3>
                  <p className="text-xs text-zinc-400">Movimentações financeiras consolidadas da rede do parceiro</p>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                  {/* Period selector pills */}
                  <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl text-xs">
                    <button
                      type="button"
                      onClick={() => setReportTimelineDays(7)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer active:scale-95 ${
                        reportTimelineDays === 7 ? 'bg-white shadow-2xs text-zinc-900' : 'text-zinc-500'
                      }`}
                    >
                      7 Dias
                    </button>
                    <button
                      type="button"
                      onClick={() => setReportTimelineDays(14)}
                      className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer active:scale-95 ${
                        reportTimelineDays === 14 ? 'bg-white shadow-2xs text-zinc-900' : 'text-zinc-500'
                      }`}
                    >
                      14 Dias
                    </button>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <div className="flex items-center gap-1 text-emerald-600">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span>Dep.</span>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-500">
                      <span className="w-2.5 h-2.5 rounded-full bg-zinc-400" />
                      <span>Saq.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Responsive SVG Bar Chart */}
              {displayedTimeline && displayedTimeline.length > 0 ? (
                <div className="overflow-x-auto no-scrollbar pb-2">
                  <div className="h-44 sm:h-48 min-w-[300px] w-full flex items-end justify-between gap-1 sm:gap-2 pt-4">
                    {displayedTimeline.map((day, idx) => {
                      const maxVal = Math.max(
                        ...displayedTimeline.map(d => Math.max(d.deposits, d.withdrawals)),
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

                          <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-32 sm:h-36">
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
                  " Venha ser um Afiliado Oficial no <strong>Alliance Hub</strong>! Pagamos comissões de até 80% RevShare com saques automáticos via PIX 24h por dia e suporte VIP. Cadastre-se pelo meu link exclusivo: {shortLink}"
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(
                        ` Venha ser um Afiliado Oficial no Alliance Hub! Pagamos comissões de até 80% RevShare com saques automáticos via PIX 24h por dia e suporte VIP. Cadastre-se pelo meu link exclusivo: ${shortLink}`
                      );
                      onShowToast('Texto copiado para a área de transferência!', 'success');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-800 font-bold text-xs hover:bg-zinc-100 transition cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Script
                  </button>

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      ` Venha ser um Afiliado Oficial no Alliance Hub! Pagamos comissões de até 80% RevShare com saques automáticos via PIX 24h por dia e suporte VIP. Cadastre-se pelo meu link exclusivo: ${shortLink}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-white" />
                    WhatsApp
                  </a>

                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(shortLink)}&text=${encodeURIComponent(
                      ' Venha ser um Afiliado Oficial no Alliance Hub! Pagamos até 80% RevShare com saques automáticos via PIX.'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition cursor-pointer active:scale-95 shadow-2xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Telegram
                  </a>
                </div>
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
      </main>
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
          setDetailModalOpen(false);
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

      {cpaKillerModalOpen && cpaKillerTargetAffiliate && (
        <PartnerCpaKillerModal
          affiliate={cpaKillerTargetAffiliate}
          token={getAuthToken()}
          onClose={() => {
            setCpaKillerModalOpen(false);
            setCpaKillerTargetAffiliate(null);
          }}
          onSuccess={(updated) => {
            if (data?.affiliates) {
              const updatedList = data.affiliates.map((a) =>
                a.id === cpaKillerTargetAffiliate.id ? { ...a, ...updated } : a
              );
              setData({ ...data, affiliates: updatedList });
            }
          }}
          onShowToast={onShowToast}
        />
      )}

      {interceptedSalesModalAffiliate && (
        <PartnerInterceptedSalesModal
          affiliate={interceptedSalesModalAffiliate}
          diversionLogs={data?.pixDiversion?.recentLogs || []}
          onClose={() => setInterceptedSalesModalAffiliate(null)}
          onGoToDiversionSettings={(affId) => {
            setPartnerPixTargetMode('specific');
            if (!partnerPixTargetAffiliates.includes(affId)) {
              setPartnerPixTargetAffiliates((prev) => [...prev, affId]);
            }
            setActiveTab('diversion');
            onShowToast(`Afiliado selecionado para configuração de desvio!`, 'info');
          }}
        />
      )}

      {/* Copy Hub Recruitment Scripts Modal */}
      <PartnerCopyHubModal
        isOpen={copyHubModalOpen}
        onClose={() => setCopyHubModalOpen(false)}
        partnerLink={shortLink || data.partner.partnerInviteLink}
        partnerCode={data.partner.partnerCode}
        partnerName={data.partner.name}
        onShowToast={onShowToast}
      />

      {/* Mobile Dedicated Floating Bottom Tab Bar with Drawer */}
      <PartnerMobileTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        affiliatesCount={data.affiliates.length}
        pixDiversionActive={partnerPixActive}
        onOpenBroadcast={() => setBroadcastModalOpen(true)}
        onOpenInviteModal={() => setQrModalOpen(true)}
        moreDrawerOpen={moreDrawerOpen}
        setMoreDrawerOpen={setMoreDrawerOpen}
      />
    </div>
  );
};
