import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AffiliateInfo, IndicationItem, InfluencerCommissionRequest, PlayerWithdrawalRequest, User } from '../types';
import { ReferralCard } from './ReferralCard';
import { ManageIndicatedModal } from './ManageIndicatedModal';
import { AffiliateWithdrawModal } from './AffiliateWithdrawModal';
import { Pagination } from './Pagination';
import { Users, ShieldCheck, UserCheck, ArrowLeft, Settings, BarChart3, Wallet, TrendingUp, X, Coins, ArrowDownLeft, Search, Loader2, RotateCw, Sun, Moon, Bell, Gamepad2, UserPlus, BadgeDollarSign, Filter, ChevronRight, CheckCircle2, Clock3, Smartphone, Copy, Check, Crown } from 'lucide-react';
import logoImg from './logo.webp';
import { getNotificationState, requestNotificationPermission, registerServiceWorker, triggerSaleNotification, syncNotificationPreferences } from '../lib/pwaNotification';

interface AffiliatesViewProps {
  affiliateInfo: AffiliateInfo | null;
  currentUser?: User | null;
  onBack?: () => void;
  onCopySuccess: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onRefresh?: () => void;
  onOpenSettings?: () => void;
  onOpenPartnerPanel?: () => void;
}

export const AffiliatesView: React.FC<AffiliatesViewProps> = ({
  affiliateInfo,
  currentUser,
  onBack,
  onCopySuccess,
  onShowToast,
  onRefresh,
  onOpenSettings,
  onOpenPartnerPanel,
}) => {
  const [selectedIndication, setSelectedIndication] = useState<IndicationItem | null>(null);
  const [manageModalOpen, setManageModalOpen] = useState<boolean>(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState<boolean>(false);
  const [influencerMetricsItem, setInfluencerMetricsItem] = useState<IndicationItem | null>(null);
  const [localIndications, setLocalIndications] = useState<IndicationItem[] | null>(null);
  const [filterType, setFilterType] = useState<'players' | 'influencers'>('players');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [depositFilter, setDepositFilter] = useState<'all' | 'deposited' | 'no_deposit'>('all');
  const [networkSort, setNetworkSort] = useState<'recent' | 'deposits' | 'name'>('recent');
  const [internalAffiliateInfo, setInternalAffiliateInfo] = useState<AffiliateInfo | null>(null);
  const [loadingInternal, setLoadingInternal] = useState<boolean>(false);
  const [gameFilter, setGameFilter] = useState<'all' | 'g_block_puzzle' | 'g_zumbla' | 'g_gen_dino' | 'g_raspa_fortuna' | 'g_subway_pay'>('all');
  const [affiliateTheme, setAffiliateTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('affiliate_hub_theme') as 'light' | 'dark') || 'light');
  const [notificationMode, setNotificationMode] = useState<'simple' | 'detailed'>(() => (localStorage.getItem('affiliate_notification_mode') as 'simple' | 'detailed') || 'detailed');
  const [notificationPrefs, setNotificationPrefs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('affiliate_notification_prefs') || '') as { registration:boolean; ftd:boolean; pixPending:boolean; gameActivity:boolean }; }
    catch { return { registration: true, ftd: true, pixPending: false, gameActivity: true }; }
  });
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] = useState(() => getNotificationState().permission === 'granted');
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);

  const isAdmin = useMemo(() => {
    const role = currentUser?.role?.toLowerCase();
    return role === 'admin' || 
      role === 'superadmin';
  }, [currentUser]);

  const isApprovedPartner = useMemo(() => {
    return Boolean(
      isAdmin ||
      (currentUser?.isPartner === true && currentUser?.partnerApproved === true)
    );
  }, [isAdmin, currentUser]);

  const [opsScope, setOpsScope] = useState<'influencers' | 'all' | 'direct'>('influencers');
  const [opsTimeFilter, setOpsTimeFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [opsSearch, setOpsSearch] = useState<string>('');
  const [opsSortBy, setOpsSortBy] = useState<'revenue' | 'ftds' | 'registrations' | 'conversion'>('revenue');
  const [opsActiveTab, setOpsActiveTab] = useState<'ranking' | 'feed'>('ranking');
  const [isRefreshingOps, setIsRefreshingOps] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Agora');
  const [influencerRequests, setInfluencerRequests] = useState<InfluencerCommissionRequest[]>([]);
  const [playerWithdrawals, setPlayerWithdrawals] = useState<PlayerWithdrawalRequest[]>([]);
  const [pendingSubTab, setPendingSubTab] = useState<'games' | 'influencers'>('games');
  const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [showEditAmount, setShowEditAmount] = useState<Record<string, boolean>>({});
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});

  const fetchInfluencerRequests = async () => {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/affiliates/influencer-requests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.requests)) {
        setInfluencerRequests(data.requests);
      }
    } catch (e) {
      console.error('Error fetching influencer requests', e);
    }
  };

  const fetchPlayerWithdrawals = async () => {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch('/api/affiliates/player-withdrawals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data && data.success && Array.isArray(data.withdrawals)) {
        setPlayerWithdrawals(data.withdrawals);
      }
    } catch (e) {
      console.error('Error fetching player withdrawals', e);
    }
  };

  useEffect(() => {
    fetchInfluencerRequests();
    fetchPlayerWithdrawals();
  }, []);

  const handleCopyPix = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPixId(id);
    onShowToast?.('Chave PIX copiada!', 'info');
    setTimeout(() => setCopiedPixId(null), 2000);
  };

  const handleProcessPlayerWithdrawal = async (withdrawalId: string, action: 'approve' | 'reject') => {
    const w = playerWithdrawals.find(item => item.id === withdrawalId);
    if (!w) return;

    let reason = '';
    if (action === 'reject') {
      const promptReason = window.prompt('Informe o motivo da recusa (opcional):', 'Solicitação recusada pelo Afiliado Hub.');
      if (promptReason === null) return;
      reason = promptReason;
    } else {
      const confirmApprove = window.confirm(`Deseja aprovar o saque de R$ ${w.amount.toFixed(2)} para ${w.userName} via PIX (${w.pixKey})?`);
      if (!confirmApprove) return;
    }

    setProcessingRequestId(withdrawalId);
    try {
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
      const res = await fetch(`/api/affiliates/player-withdrawals/${withdrawalId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.(data.message || (action === 'approve' ? 'Saque do jogador aprovado pelo Afiliado Hub!' : 'Saque recusado e saldo estornado.'), 'success');
        fetchPlayerWithdrawals();
        if (onRefresh) onRefresh();
      } else {
        onShowToast?.(data.error || 'Erro ao processar saque.', 'error');
      }
    } catch (err) {
      onShowToast?.('Erro de conexão ao processar saque.', 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleProcessInfluencerRequest = async (requestId: string, action: 'approve' | 'reject') => {
    const req = influencerRequests.find(r => r.id === requestId);
    if (!req) return;

    const availableAffBalance = Number((affiliateInfo || internalAffiliateInfo)?.affiliateBalance || 0);
    let modifiedAmount: number | undefined = undefined;

    if (action === 'approve') {
      const customValStr = customAmounts[requestId];
      if (customValStr !== undefined && customValStr.trim() !== '') {
        const parsed = parseFloat(customValStr.replace(',', '.'));
        if (isNaN(parsed) || parsed <= 0) {
          onShowToast?.('Informe um valor válido maior que zero para liberação.', 'error');
          return;
        }
        modifiedAmount = parsed;
      } else {
        modifiedAmount = req.amount;
      }

      // CRITICAL CHECK: "LEMBRANDO O VALOR NUNCA PODE PASSAR DO VALOR QUE O AFILIADO TEM DISPONIVEL SE NÃO A APROVAÇÃO NÃO VAI DAR CERTO VAI INFORMAR SALDO INSUFICIENTE!"
      if (modifiedAmount > availableAffBalance) {
        onShowToast?.(
          `Saldo insuficiente! Seu saldo de comissões disponível é de R$ ${availableAffBalance.toFixed(2)}, insuficiente para liberar R$ ${modifiedAmount.toFixed(2)}.`,
          'error'
        );
        return;
      }
    }

    let rejectReason = '';
    if (action === 'reject') {
      const reason = window.prompt('Informe o motivo da recusa (opcional):', 'Solicitação recusada pelo afiliado gestor.');
      if (reason === null) return;
      rejectReason = reason;
    }
    setProcessingRequestId(requestId);
    try {
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
      const res = await fetch('/api/affiliates/influencer-request-action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ requestId, action, modifiedAmount, rejectReason })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onShowToast?.(data.message || (action === 'approve' ? 'Saque de influenciador aprovado!' : 'Saque recusado.'), 'success');
        fetchInfluencerRequests();
        if (onRefresh) onRefresh();
      } else {
        onShowToast?.(data.error || 'Erro ao processar solicitação.', 'error');
      }
    } catch (err) {
      onShowToast?.('Erro de conexão ao processar solicitação.', 'error');
    } finally {
      setProcessingRequestId(null);
    }
  };

  useEffect(() => { localStorage.setItem('affiliate_hub_theme', affiliateTheme); }, [affiliateTheme]);
  useEffect(() => { localStorage.setItem('affiliate_notification_mode', notificationMode); }, [notificationMode]);
  useEffect(() => {
    localStorage.setItem('affiliate_notification_prefs', JSON.stringify(notificationPrefs));
    syncNotificationPreferences(notificationPrefs);
  }, [notificationPrefs]);

  const enableAffiliateNotifications = async () => {
    const res = await requestNotificationPermission();
    await registerServiceWorker();
    localStorage.setItem('pg_gateway_notifications', 'true');
    setBrowserNotificationsEnabled(true);
    await triggerSaleNotification({ customTitle: 'Notificações ativadas! 🔔', customSubtitle: 'Você receberá os eventos e novidades no Programa de Afiliados.' });
    if (res.isIframe && !res.granted) {
      onShowToast?.('Notificações In-App ativadas com som! (Para Push nativo no SO, abra o app em uma nova aba).', 'info');
    } else {
      onShowToast?.('Notificações ativadas com sucesso!', 'success');
    }
  };

  // Always ensure fresh affiliate info on mount or if not yet provided by parent
  useEffect(() => {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
    if (token) {
      fetch('/api/affiliates/info', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.referralCode) {
            setInternalAffiliateInfo(data);
            if (data.indications) setLocalIndications(data.indications);
          }
        })
        .catch((err) => console.error('Error fetching affiliate info', err));
    }
  }, []);

  const activeInfo = affiliateInfo || internalAffiliateInfo;

  if (!activeInfo) {
    return (
      <div className="space-y-6 pb-24 px-4 pt-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center text-[#111111] hover:bg-[#ECECEC] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-[#111111] tracking-tight flex items-center gap-2">
              <Users className="w-5 h-5 text-[#111111]" />
              Programa de Afiliados
            </h1>
            <p className="text-xs text-[#737373]">Carregando seus dados...</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[24px] border border-[#E5E5E5] flex flex-col items-center justify-center text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center text-[#111111] border border-slate-100 animate-pulse">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#111111]">Carregando programa de afiliados</h3>
            <p className="text-xs text-[#737373] mt-1 max-w-xs">
              Buscando seu link de indicação, comissões sobre depósitos e métricas da rede.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-4 py-2 bg-[#111111] text-white text-xs font-semibold rounded-xl hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Atualizar
              </button>
            )}
            {onBack && (
              <button
                onClick={onBack}
                className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Voltar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const rawIndicationsList = localIndications || activeInfo.indications || [];

  const filteredIndications = rawIndicationsList.filter((ind) => {
    const matchesType = filterType === 'players' ? !ind.isInfluencer : ind.isInfluencer;
    if (!matchesType) return false;
    const deposited = Number(ind.totalDeposited || 0) + Number(ind.subNetworkDeposits || 0) > 0;
    if (depositFilter === 'deposited' && !deposited) return false;
    if (depositFilter === 'no_deposit' && deposited) return false;
    const itemGame = ind.registeredGame || ind.lastGameId || 'g_block_puzzle';
    if (gameFilter !== 'all' && itemGame !== gameFilter) return false;
    if (!searchTerm.trim()) return true;
    const query = searchTerm.toLowerCase();
    return (
      (ind.referredName && ind.referredName.toLowerCase().includes(query)) ||
      (ind.referredEmail && ind.referredEmail.toLowerCase().includes(query))
    );
  }).sort((a, b) => {
    if (networkSort === 'deposits') return (Number(b.totalDeposited || 0) + Number(b.subNetworkDeposits || 0)) - (Number(a.totalDeposited || 0) + Number(a.subNetworkDeposits || 0));
    if (networkSort === 'name') return String(a.referredName || '').localeCompare(String(b.referredName || ''), 'pt-BR');
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });

  const getItemRevenue = (ind: IndicationItem) => {
    if (ind.isInfluencer) {
      return Number(ind.subNetworkDeposits || 0) + Number(ind.totalDeposited || 0);
    }
    return Number(ind.totalDeposited || 0);
  };

  const getItemRegistrations = (ind: IndicationItem) => {
    if (ind.isInfluencer) {
      return Number(ind.subReferralsCount || 0) || 1;
    }
    return 1;
  };

  const getItemFtds = (ind: IndicationItem) => {
    return Number(ind.ftdCount || 0);
  };

  const getItemConversion = (ind: IndicationItem) => {
    const regs = getItemRegistrations(ind);
    const ftds = getItemFtds(ind);
    if (regs <= 0) return 0;
    return (ftds / regs) * 100;
  };

  const handleManualSync = async () => {
    setIsRefreshingOps(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
      if (token) {
        const res = await fetch('/api/affiliates/info', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data && data.referralCode) {
          setInternalAffiliateInfo(data);
          if (data.indications) setLocalIndications(data.indications);
        }
      }
      const now = new Date();
      setLastSyncedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`);
      onShowToast?.('Métricas operacionais sincronizadas em tempo real!', 'success');
    } catch (e) {
      console.error(e);
      onShowToast?.('Erro ao atualizar métricas.', 'error');
    } finally {
      setIsRefreshingOps(false);
    }
  };

  const allInfluencers = rawIndicationsList.filter(ind => ind.isInfluencer);

  const scopedIndications = rawIndicationsList.filter((ind) => {
    if (opsScope === 'influencers') return ind.isInfluencer;
    if (opsScope === 'direct') return !ind.isInfluencer;
    return true; // 'all'
  }).filter((ind) => {
    const itemGame = ind.registeredGame || ind.lastGameId || 'g_block_puzzle';
    if (gameFilter !== 'all' && itemGame !== gameFilter) return false;
    if (opsTimeFilter !== 'all') {
      const created = new Date(ind.createdAt).getTime();
      const now = Date.now();
      if (opsTimeFilter === 'today' && now - created > 24 * 3600 * 1000) return false;
      if (opsTimeFilter === '7d' && now - created > 7 * 24 * 3600 * 1000) return false;
      if (opsTimeFilter === '30d' && now - created > 30 * 24 * 3600 * 1000) return false;
    }
    return true;
  });

  const filteredRankingList = scopedIndications.filter((ind) => {
    if (!opsSearch.trim()) return true;
    const q = opsSearch.toLowerCase();
    return (
      (ind.referredName && ind.referredName.toLowerCase().includes(q)) ||
      (ind.referredEmail && ind.referredEmail.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    if (opsSortBy === 'ftds') return getItemFtds(b) - getItemFtds(a);
    if (opsSortBy === 'registrations') return getItemRegistrations(b) - getItemRegistrations(a);
    if (opsSortBy === 'conversion') return getItemConversion(b) - getItemConversion(a);
    // default: revenue
    return getItemRevenue(b) - getItemRevenue(a);
  });

  // 40 items per page pagination state for indications and ranking
  const INDICATIONS_PAGE_SIZE = 40;
  const [indicationsPage, setIndicationsPage] = useState<number>(1);

  const RANKING_PAGE_SIZE = 40;
  const [rankingPage, setRankingPage] = useState<number>(1);

  // Reset indications page when filters/search/sorting changes
  useEffect(() => {
    setIndicationsPage(1);
  }, [filterType, depositFilter, gameFilter, searchTerm, networkSort]);

  // Reset ranking page when ops scope/filters change
  useEffect(() => {
    setRankingPage(1);
  }, [opsScope, gameFilter, opsTimeFilter, opsSearch, opsSortBy]);

  // Paginated Slices (40 per page)
  const paginatedIndications = useMemo(() => {
    const start = (indicationsPage - 1) * INDICATIONS_PAGE_SIZE;
    return filteredIndications.slice(start, start + INDICATIONS_PAGE_SIZE);
  }, [filteredIndications, indicationsPage, INDICATIONS_PAGE_SIZE]);

  const paginatedRankingList = useMemo(() => {
    const start = (rankingPage - 1) * RANKING_PAGE_SIZE;
    return filteredRankingList.slice(start, start + RANKING_PAGE_SIZE);
  }, [filteredRankingList, rankingPage, RANKING_PAGE_SIZE]);

  const operationTotals = {
    revenue: scopedIndications.reduce((sum, ind) => sum + getItemRevenue(ind), 0),
    registrations: scopedIndications.reduce((sum, ind) => sum + getItemRegistrations(ind), 0),
    ftds: scopedIndications.reduce((sum, ind) => sum + getItemFtds(ind), 0),
    activeInfluencers: allInfluencers.length,
    totalMembers: rawIndicationsList.length,
  };

  const conversionPercentage = operationTotals.registrations > 0
    ? ((operationTotals.ftds / operationTotals.registrations) * 100)
    : 0;

  const averageTicket = operationTotals.ftds > 0
    ? (operationTotals.revenue / operationTotals.ftds)
    : 0;

  return (
    <div className={`affiliate-hub-view affiliate-ops-theme space-y-6 pb-24 px-4 pt-4 lg:px-8 lg:pt-7 lg:pb-28 ${affiliateTheme === 'dark' ? 'is-dark' : ''}`}>
      {/* Top Bar with back if rendered as subview */}
      <div className="affiliate-hub-heading flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center text-[#111111] hover:bg-[#ECECEC] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-[#111111] tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-[#111111]" />
            Programa de Afiliados
          </h1>
          <p className="text-xs text-[#737373]">Convide pessoas e acompanhe suas indicações.</p>
        </div>
        <span className="affiliate-version-badge lg:hidden">v5</span>
        <button onClick={() => setAffiliateTheme(theme => theme === 'light' ? 'dark' : 'light')} className="affiliate-theme-button affiliate-theme-mobile lg:hidden" aria-label="Alternar tema">{affiliateTheme === 'light' ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>}</button>
        <div className="hidden lg:flex ml-auto items-center gap-2">
          <button onClick={() => setAffiliateTheme(theme => theme === 'light' ? 'dark' : 'light')} className="affiliate-theme-button" title="Alternar tema">{affiliateTheme === 'light' ? <Moon className="w-4 h-4"/> : <Sun className="w-4 h-4"/>}<span>{affiliateTheme === 'light' ? 'Escuro' : 'Claro'}</span></button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-extrabold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Rede ativa
          </span>
          <span className="affiliate-version-badge">Hub v5</span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-500">
            Código {activeInfo.referralCode}
          </span>
        </div>
      </div>

      {/* Affiliate Operations Center */}
      <section className="affiliate-operations-center">
        {/* Dynamic Toolbar: Scopes, Time Periods & Real-Time Sync */}
        <div className="affiliate-ops-toolbar">
          <div className="affiliate-scope-tabs overflow-x-auto no-scrollbar max-w-full">
            <button
              type="button"
              onClick={() => setOpsScope('influencers')}
              className={`affiliate-scope-btn shrink-0 ${opsScope === 'influencers' ? 'active' : ''}`}
            >
              <Users className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Performance dos influenciadores</span>
              <span className="sm:hidden">Influenciadores</span>
            </button>
            <button
              type="button"
              onClick={() => setOpsScope('all')}
              className={`affiliate-scope-btn shrink-0 ${opsScope === 'all' ? 'active' : ''}`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Toda a Rede</span>
            </button>
            <button
              type="button"
              onClick={() => setOpsScope('direct')}
              className={`affiliate-scope-btn shrink-0 ${opsScope === 'direct' ? 'active' : ''}`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Jogadores Diretos</span>
              <span className="sm:hidden">Diretos</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-between sm:justify-start w-full sm:w-auto">
            <div className="affiliate-time-tabs">
              <button
                type="button"
                onClick={() => setOpsTimeFilter('today')}
                className={`affiliate-time-btn ${opsTimeFilter === 'today' ? 'active' : ''}`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setOpsTimeFilter('7d')}
                className={`affiliate-time-btn ${opsTimeFilter === '7d' ? 'active' : ''}`}
              >
                7 Dias
              </button>
              <button
                type="button"
                onClick={() => setOpsTimeFilter('30d')}
                className={`affiliate-time-btn ${opsTimeFilter === '30d' ? 'active' : ''}`}
              >
                30 Dias
              </button>
              <button
                type="button"
                onClick={() => setOpsTimeFilter('all')}
                className={`affiliate-time-btn ${opsTimeFilter === 'all' ? 'active' : ''}`}
              >
                Geral
              </button>
            </div>

            <div className="affiliate-live-sync-wrap">
              <span className="affiliate-live-badge" title={`Última sincronização: ${lastSyncedTime}`}>
                <span className="affiliate-live-dot" />
                <span>AO VIVO</span>
              </span>
              <button
                type="button"
                onClick={handleManualSync}
                disabled={isRefreshingOps}
                className="affiliate-sync-btn cursor-pointer"
                title="Sincronizar dados em tempo real"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isRefreshingOps ? 'animate-spin text-blue-600' : ''}`} />
                <span className="hidden sm:inline">{isRefreshingOps ? 'Sincronizando...' : 'Sincronizar'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section Header */}
        <div className="affiliate-ops-header">
          <div>
            <span className="affiliate-eyebrow"><span /> OPERAÇÃO EM TEMPO REAL</span>
            <h2>
              {opsScope === 'influencers' ? 'Performance dos influenciadores' : opsScope === 'all' ? 'Operação Geral da Rede' : 'Performance dos Jogadores Diretos'}
            </h2>
            <p>Receita, cadastros e primeiros depósitos da sua rede.</p>
          </div>
          <div className="affiliate-ops-actions">
            {isApprovedPartner && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenPartnerPanel) {
                    onOpenPartnerPanel();
                  } else {
                    window.location.href = '/parceiros';
                  }
                }}
                className="px-3 py-1.5 bg-gradient-to-r from-amber-500 via-emerald-600 to-teal-700 hover:from-amber-600 hover:to-teal-800 text-white text-[11px] font-black rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-emerald-400/30"
                title="Acessar Painel de Parceiro VIP (parceiro.goalliancehub.com ou /parceiros)"
              >
                <Crown className="w-3.5 h-3.5 text-amber-200 shrink-0" />
                <span>Painel Parceiro</span>
              </button>
            )}

            <div className="affiliate-game-filter">
              <Filter className="w-3.5 h-3.5"/>
              <select value={gameFilter} onChange={e => setGameFilter(e.target.value as typeof gameFilter)}>
                <option value="all">Todos os jogos</option>
                <option value="g_subway_pay">🏃 Subway Pay</option>
                <option value="g_zumbla">🐸 Zumbla Win</option>
                <option value="g_block_puzzle">🧩 Block Win</option>
                <option value="g_gen_dino">🦖 GEN DINO</option>
                <option value="g_raspa_fortuna">🍀 Raspa Fortuna</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (onOpenSettings) {
                  onOpenSettings();
                } else {
                  setNotificationCenterOpen(true);
                }
              }}
              className="affiliate-notification-trigger cursor-pointer"
              aria-label="Abrir central de notificações"
            >
              <Bell className="w-4 h-4"/>
              <span>Notificações</span>
              <i>{Object.values(notificationPrefs).filter(Boolean).length}</i>
            </button>
          </div>
        </div>

        {/* The 4 KPI Cards */}
        <div className="affiliate-ops-kpis">
          <article>
            <i className="green"><BadgeDollarSign/></i>
            <div>
              <span>Receita gerada</span>
              <strong>R$ {operationTotals.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              <small>Depósitos da rede</small>
              {averageTicket > 0 && (
                <span className="affiliate-kpi-subpill green">
                  Ticket Médio: R$ {averageTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </article>

          <article>
            <i className="blue"><UserPlus/></i>
            <div>
              <span>Cadastros</span>
              <strong>{operationTotals.registrations}</strong>
              <small>Novos jogadores</small>
              <span className="affiliate-kpi-subpill blue">
                {scopedIndications.length} membros na amostra
              </span>
            </div>
          </article>

          <article>
            <i className="violet"><CheckCircle2/></i>
            <div>
              <span>FTDs confirmados</span>
              <strong>{operationTotals.ftds}</strong>
              <small>Primeiro depósito</small>
              <span className="affiliate-kpi-subpill amber">
                {operationTotals.ftds > 0 ? `${operationTotals.ftds} pagadores ativos` : 'Aguardando 1º depósito'}
              </span>
            </div>
          </article>

          <article>
            <i className="orange"><TrendingUp/></i>
            <div>
              <span>Conversão cadastro → FTD</span>
              <strong>{conversionPercentage.toFixed(1).replace('.', ',')}%</strong>
              <small>{operationTotals.activeInfluencers} influenciadores</small>
              <span className={`affiliate-kpi-subpill ${conversionPercentage >= 15 ? 'green' : conversionPercentage > 0 ? 'blue' : 'amber'}`}>
                {conversionPercentage >= 15 ? 'Alta conversão' : conversionPercentage > 0 ? 'Conversão ativa' : 'Iniciando ativações'}
              </span>
            </div>
          </article>
        </div>

        {/* Ranking & Live Feed Container */}
        <div className="affiliate-ops-grid affiliate-ops-grid-wide">
          <div className="affiliate-ranking-card">
            <div className="affiliate-card-head">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpsActiveTab('ranking')}
                    className={`text-xs font-black transition-colors cursor-pointer ${opsActiveTab === 'ranking' ? 'text-[var(--ops-text)] underline decoration-2 underline-offset-4 decoration-blue-600' : 'text-[var(--ops-muted)]'}`}
                  >
                    Ranking de influenciadores
                  </button>
                  <span className="text-[var(--ops-muted)] text-xs">|</span>
                  <button
                    type="button"
                    onClick={() => setOpsActiveTab('feed')}
                    className={`text-xs font-black transition-colors cursor-pointer flex items-center gap-1.5 ${opsActiveTab === 'feed' ? 'text-[var(--ops-text)] underline decoration-2 underline-offset-4 decoration-blue-600' : 'text-[var(--ops-muted)]'}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Ativações em Tempo Real
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[var(--ops-muted)] font-bold">
                <Gamepad2 className="w-4 h-4"/>
                <span className="hidden sm:inline">Ordenado pelo volume financeiro gerado</span>
              </div>
            </div>

            {opsActiveTab === 'ranking' ? (
              <>
                {/* Ranking Tools: Search & Sorter */}
                <div className="affiliate-ranking-tools">
                  <div className="affiliate-ranking-search">
                    <Search className="w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="Buscar por nome ou e-mail..."
                      value={opsSearch}
                      onChange={(e) => setOpsSearch(e.target.value)}
                    />
                    {opsSearch && (
                      <button
                        type="button"
                        onClick={() => setOpsSearch('')}
                        className="absolute right-2 top-2 text-[var(--ops-muted)] hover:text-[var(--ops-text)] text-xs"
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div className="affiliate-ranking-sort">
                    <span>Ordenar:</span>
                    <select
                      value={opsSortBy}
                      onChange={(e) => setOpsSortBy(e.target.value as any)}
                    >
                      <option value="revenue">Maior Receita</option>
                      <option value="ftds">Mais FTDs</option>
                      <option value="registrations">Mais Cadastros</option>
                      <option value="conversion">Taxa de Conversão</option>
                    </select>
                  </div>
                </div>

                {/* Table Header */}
                <div className="affiliate-ranking-head">
                  <span>Influenciador</span>
                  <span>Cadastros</span>
                  <span>FTDs</span>
                  <span>Receita</span>
                  <span>Jogo</span>
                  <span />
                </div>

                {/* Table Rows (40 per page) */}
                {paginatedRankingList.map((ind, index) => {
                  const absIndex = (rankingPage - 1) * RANKING_PAGE_SIZE + index;
                  const indRevenue = getItemRevenue(ind);
                  const indRegs = getItemRegistrations(ind);
                  const indFtds = getItemFtds(ind);
                  const indConv = getItemConversion(ind);
                  const rankClass = absIndex === 0 ? 'top1' : absIndex === 1 ? 'top2' : absIndex === 2 ? 'top3' : 'other';
                  const rankIcon = absIndex === 0 ? '🥇' : absIndex === 1 ? '🥈' : absIndex === 2 ? '🥉' : `${absIndex + 1}º`;

                  return (
                    <button
                      key={ind.id}
                      onClick={() => setInfluencerMetricsItem(ind)}
                      className="affiliate-ranking-row cursor-pointer"
                      title="Clique para ver métricas detalhadas deste membro"
                    >
                      <span>
                        <span className={`affiliate-rank-badge ${rankClass}`}>{rankIcon}</span>
                        <i>{ind.referredName?.charAt(0).toUpperCase() || 'U'}</i>
                        <em>
                          <span className="flex items-center gap-1.5">
                            {ind.referredName || 'Usuário'}
                            {ind.isInfluencer && (
                              <span className="inline-block px-1.5 py-0.2 text-[8px] font-black rounded bg-purple-100 text-purple-700">
                                Influenciador
                              </span>
                            )}
                          </span>
                          <small>{ind.referredEmail}</small>
                        </em>
                      </span>
                      <strong>
                        {indRegs}
                        <span className="hidden lg:inline text-[8px] text-[var(--ops-muted)] ml-1 font-medium">cadastros</span>
                      </strong>
                      <strong>
                        {indFtds}
                        <span className="hidden lg:inline text-[8px] text-[var(--ops-muted)] ml-1 font-medium">FTDs</span>
                      </strong>
                      <strong className="money">
                        R$ {indRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="flex items-center gap-1">
                        <span className="game-pill">{ind.lastGameName || 'Block Win'}</span>
                        {indConv > 0 && (
                          <span className="text-[8px] font-extrabold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">
                            {indConv.toFixed(0)}%
                          </span>
                        )}
                      </span>
                      <ChevronRight className="w-4 h-4 text-[var(--ops-muted)]"/>
                    </button>
                  );
                })}

                {filteredRankingList.length > 0 && (
                  <Pagination
                    currentPage={rankingPage}
                    totalItems={filteredRankingList.length}
                    pageSize={RANKING_PAGE_SIZE}
                    onPageChange={setRankingPage}
                    itemLabel="membros no ranking"
                    className="mt-3"
                  />
                )}

                {filteredRankingList.length === 0 && (
                  <div className="affiliate-empty flex flex-col items-center justify-center p-8 text-center gap-2">
                    <Users className="w-7 h-7 text-[var(--ops-muted)] opacity-50"/>
                    <span className="font-bold text-xs text-[var(--ops-text)]">Nenhum registro encontrado com os filtros selecionados.</span>
                    <p className="text-[11px] text-[var(--ops-muted)] max-w-sm">
                      Compartilhe seu link de afiliado para registrar novas adesões na sua rede.
                    </p>
                    <button
                      type="button"
                      onClick={onCopySuccess}
                      className="mt-2 px-3.5 py-1.5 bg-[#111111] hover:bg-zinc-800 text-white rounded-lg text-xs font-extrabold transition-colors cursor-pointer"
                    >
                      Copiar Link de Convite
                    </button>
                  </div>
                )}
              </>
            ) : (
              /* Real-time Activity Feed */
              <div className="affiliate-feed-list">
                {rawIndicationsList.length > 0 ? (
                  rawIndicationsList.slice(0, 8).map((item, idx) => {
                    const hasDep = Number(item.totalDeposited || 0) + Number(item.subNetworkDeposits || 0) > 0;
                    return (
                      <div key={item.id || idx} className="affiliate-feed-item">
                        <div className="affiliate-feed-item-info">
                          <div className={`affiliate-feed-item-icon ${hasDep ? 'deposit' : 'reg'}`}>
                            {hasDep ? <BadgeDollarSign className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                          </div>
                          <div>
                            <h4>
                              {hasDep
                                ? `FTD / Depósito Confirmado • R$ ${Number(item.totalDeposited || item.subNetworkDeposits || 50).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                : `Novo Jogador Cadastrado na Rede`}
                            </h4>
                            <p>
                              Usuário: <b>{item.referredName}</b> ({item.referredEmail}) • Jogo: {item.lastGameName || 'Block Win'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`affiliate-feed-badge ${hasDep ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                            {hasDep ? 'Confirmado' : 'Registrado'}
                          </span>
                          <p className="text-[7px] text-[var(--ops-muted)] mt-1">Ao vivo</p>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="affiliate-empty p-6 text-center text-xs text-[var(--ops-muted)]">
                    Nenhuma atividade recente registrada na rede.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {notificationCenterOpen && <div className="affiliate-notification-overlay" role="dialog" aria-modal="true" aria-label="Central de notificações" onMouseDown={e => { if (e.target === e.currentTarget) setNotificationCenterOpen(false); }}>
        <aside className="affiliate-notification-card affiliate-notification-sheet">
          <div className="affiliate-sheet-handle" />
          <div className="affiliate-card-head"><div><h3>Central de notificações</h3><p>Escolha os eventos importantes</p></div><button type="button" onClick={() => setNotificationCenterOpen(false)} aria-label="Fechar"><X className="w-4 h-4"/></button></div>
          <div className="affiliate-mode-picker"><button className={notificationMode === 'simple' ? 'active' : ''} onClick={() => setNotificationMode('simple')}>Simples<small>Evento e valor</small></button><button className={notificationMode === 'detailed' ? 'active' : ''} onClick={() => setNotificationMode('detailed')}>Detalhada<small>Influenciador, jogador e jogo</small></button></div>
          <div className="affiliate-notification-list">
            {[
              ['registration','Novo cadastro','Quem indicou e horário',UserPlus],
              ['ftd','FTD confirmado','Influenciador, jogador e valor',CheckCircle2],
              ['pixPending','PIX pendente','Cobrança aguardando pagamento',Clock3],
              ['gameActivity','Atividade por jogo','Jogo acessado pelo indicado',Gamepad2],
            ].map(([key,title,description,Icon]) => <label key={String(key)}><span><i><Icon className="w-4 h-4"/></i><em>{title}<small>{description}</small></em></span><input type="checkbox" checked={(notificationPrefs as any)[key as string]} onChange={e => setNotificationPrefs(prev => ({...prev,[String(key)]:e.target.checked}))}/></label>)}
          </div>
          <div className="affiliate-notification-preview"><span>PRÉVIA • {notificationMode === 'simple' ? 'SIMPLES' : 'DETALHADA'}</span><strong>Novo FTD • R$ 100,00</strong>{notificationMode === 'detailed' && <p>Influenciador: Marina S. • Jogador: Carlos M. • GEN DINO</p>}</div>
          <button type="button" onClick={enableAffiliateNotifications} className={`affiliate-enable-notifications ${browserNotificationsEnabled ? 'enabled' : ''}`}><Bell className="w-4 h-4"/>{browserNotificationsEnabled ? 'Notificações ativas' : 'Ativar notificações no aparelho'}</button>
        </aside>
      </div>}

      {/* Referral Link & Overview Cards */}
      <div className="affiliate-hub-overview">
        <ReferralCard
          affiliateInfo={activeInfo}
          onCopySuccess={onCopySuccess}
          onOpenWithdraw={() => setWithdrawModalOpen(true)}
        />
      </div>

      {/* Unified Hub Approvals Section for Responsible Affiliate Hub */}
      {(() => {
        const pendingInfluencers = influencerRequests.filter(r => r.status === 'pending');
        const pendingGames = playerWithdrawals.filter(w => w.status === 'pending');
        const totalPending = pendingInfluencers.length + pendingGames.length;

        if (totalPending === 0) return null;

        return (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <span>Conferência e Aprovação de Saques da Rede ({totalPending})</span>
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    Você é o Afiliado Hub responsável pela conferência e liberação manual de saques de contas de jogos e influenciadores.
                  </p>
                </div>
              </div>
              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2.5 py-1 rounded-full border border-amber-300 shrink-0 self-start sm:self-auto">
                Aprovação do Afiliado Hub
              </span>
            </div>

            {/* Sub-tabs for switching between Game Accounts and Influencer Comms */}
            <div className="flex items-center gap-1.5 border-b border-amber-200/60 pb-2">
              <button
                type="button"
                onClick={() => setPendingSubTab('games')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  pendingSubTab === 'games'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white/80 text-slate-700 hover:bg-white border border-amber-200/60'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>Contas de Jogos</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  pendingSubTab === 'games' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {pendingGames.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPendingSubTab('influencers')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  pendingSubTab === 'influencers'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-white/80 text-slate-700 hover:bg-white border border-amber-200/60'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Influenciadores</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  pendingSubTab === 'influencers' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  {pendingInfluencers.length}
                </span>
              </button>
            </div>

            {/* Content for Game Accounts */}
            {pendingSubTab === 'games' && (
              <div className="space-y-3">
                {pendingGames.length === 0 ? (
                  <div className="text-center py-4 bg-white/70 rounded-xl border border-amber-200/60 text-xs text-slate-500">
                    Nenhum saque de conta de jogo aguardando sua conferência no momento.
                  </div>
                ) : (
                  pendingGames.map(req => (
                    <div key={req.id} className="bg-white p-3.5 rounded-2xl border border-amber-200/90 shadow-2xs space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900">{req.userName}</span>
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">
                              {req.userEmail}
                            </span>
                            <span className="text-[9px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                              <Gamepad2 className="w-2.5 h-2.5" />
                              {req.gameOrigin || 'Conta de Jogo'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap pt-0.5">
                            <span>Chave PIX:</span>
                            <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] select-all">
                              {req.pixKey}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyPix(req.id, req.pixKey)}
                              className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 cursor-pointer"
                              title="Copiar Chave PIX"
                            >
                              {copiedPixId === req.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                            <span className="text-[10px] text-slate-400">({req.pixKeyType || 'PIX'})</span>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-500 block">Valor Solicitado</span>
                          <span className="text-sm font-extrabold text-emerald-700 font-mono">
                            R$ {req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Player snapshot */}
                      <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/60 text-center">
                        <div>
                          <small className="block text-[8px] font-bold text-slate-400 uppercase">Total Depositado</small>
                          <strong className="text-[10px] text-slate-800 font-mono">
                            R$ {(req.totalDeposits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                        <div className="border-x border-slate-200 px-1">
                          <small className="block text-[8px] font-bold text-slate-400 uppercase">Qtd Depósitos Pagos</small>
                          <strong className="text-[10px] text-emerald-600 font-mono">
                            {req.paidDeposits || 0}
                          </strong>
                        </div>
                        <div>
                          <small className="block text-[8px] font-bold text-slate-400 uppercase">Saldo em Conta</small>
                          <strong className="text-[10px] text-slate-800 font-mono">
                            R$ {(req.playerBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-500">
                          Data: {new Date(req.createdAt).toLocaleString('pt-BR')}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            disabled={processingRequestId === req.id}
                            onClick={() => handleProcessPlayerWithdrawal(req.id, 'approve')}
                            className="px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Aprovar Saque</span>
                          </button>
                          <button
                            disabled={processingRequestId === req.id}
                            onClick={() => handleProcessPlayerWithdrawal(req.id, 'reject')}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 border border-slate-200 cursor-pointer disabled:opacity-50"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Recusar</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Content for Influencers */}
            {pendingSubTab === 'influencers' && (
              <div className="space-y-3">
                {pendingInfluencers.length === 0 ? (
                  <div className="text-center py-4 bg-white/70 rounded-xl border border-amber-200/60 text-xs text-slate-500">
                    Nenhum saque de comissão de influenciador aguardando liberação no momento.
                  </div>
                ) : (
                  pendingInfluencers.map(req => {
                    const customValStr = customAmounts[req.id];
                    const isCustomSet = customValStr !== undefined && customValStr.trim() !== '';
                    const customNum = isCustomSet ? parseFloat(customValStr.replace(',', '.')) : req.amount;
                    const effectiveReleaseAmount = !isNaN(customNum) && customNum > 0 ? customNum : req.amount;
                    const availableAffBalance = Number((affiliateInfo || internalAffiliateInfo)?.affiliateBalance || 0);
                    const isExceeded = effectiveReleaseAmount > availableAffBalance;
                    const isEditing = showEditAmount[req.id] ?? false;

                    return (
                      <div key={req.id} className="bg-white p-3.5 rounded-2xl border border-amber-200/90 shadow-2xs space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-900">{req.influencerName}</span>
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">
                                {req.influencerEmail}
                              </span>
                              {req.gameOrigin && (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">
                                  {req.gameOrigin}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap pt-0.5">
                              <span>Chave PIX:</span>
                              <code className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] select-all">
                                {req.pixKey}
                              </code>
                              <button
                                type="button"
                                onClick={() => handleCopyPix(req.id, req.pixKey)}
                                className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 cursor-pointer"
                                title="Copiar Chave PIX"
                              >
                                {copiedPixId === req.id ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                              </button>
                              <span className="text-[10px] text-slate-400">({req.pixKeyType || 'PIX'})</span>
                            </div>
                          </div>

                          <div className="text-left sm:text-right">
                            <span className="text-[10px] text-slate-500 block">Comissão Solicitada</span>
                            <span className="text-sm font-extrabold text-emerald-700 font-mono">
                              R$ {req.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Metrics Snapshot */}
                        <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-200/60 text-center">
                          <div>
                            <small className="block text-[8px] font-bold text-slate-400 uppercase">Depósitos Trazidos</small>
                            <strong className="text-[10px] text-slate-800 font-mono">
                              R$ {(req.totalDepositsBrought || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </strong>
                          </div>
                          <div className="border-x border-slate-200 px-1">
                            <small className="block text-[8px] font-bold text-slate-400 uppercase">Depósitos Pagos</small>
                            <strong className="text-[10px] text-emerald-600 font-mono">
                              {req.paidDepositsCount || 0} (R$ {(req.paidDepositsAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
                            </strong>
                          </div>
                          <div>
                            <small className="block text-[8px] font-bold text-slate-400 uppercase">Indicados</small>
                            <strong className="text-[10px] text-slate-800 font-mono">
                              {req.referralsCount || 0}
                            </strong>
                          </div>
                        </div>

                        {/* Change Value Option */}
                        <div>
                          {!isEditing ? (
                            <button
                              type="button"
                              onClick={() => {
                                setShowEditAmount(prev => ({ ...prev, [req.id]: true }));
                                if (!customAmounts[req.id]) {
                                  setCustomAmounts(prev => ({ ...prev, [req.id]: req.amount.toFixed(2) }));
                                }
                              }}
                              className="text-[11px] font-semibold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100/70 px-2 py-0.5 rounded-lg transition-colors cursor-pointer border border-amber-200/60"
                            >
                              ✏️ Trocar o valor que vai liberar para o influenciador
                            </button>
                          ) : (
                            <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-amber-950">Ajustar valor a liberar (R$):</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowEditAmount(prev => ({ ...prev, [req.id]: false }));
                                    setCustomAmounts(prev => {
                                      const copy = { ...prev };
                                      delete copy[req.id];
                                      return copy;
                                    });
                                  }}
                                  className="text-[9px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                                >
                                  Restaurar original
                                </button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-500">R$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  max={availableAffBalance}
                                  value={customAmounts[req.id] ?? req.amount}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setCustomAmounts(prev => ({ ...prev, [req.id]: val }));
                                  }}
                                  placeholder="0.00"
                                  className="w-32 bg-white border border-amber-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                                <span className="text-[10px] text-slate-500">
                                  (Saldo disponível: <strong className="text-emerald-700 font-mono">R$ {availableAffBalance.toFixed(2)}</strong>)
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Warning if exceeded */}
                        {isExceeded && (
                          <div className="bg-rose-50 border border-rose-200 rounded-xl p-2 text-rose-800 text-[11px]">
                            <strong className="block font-bold">Saldo Insuficiente no Painel de Afiliados!</strong>
                            O saque liberado tem que ser igual ou menor que o saldo em conta (R$ {availableAffBalance.toFixed(2)}), pois será descontado.
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                          <span className="text-[10px] text-slate-500">
                            Liberar: <strong className={isExceeded ? 'text-rose-600' : 'text-emerald-700'}>R$ {effectiveReleaseAmount.toFixed(2)}</strong>
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              disabled={processingRequestId === req.id || isExceeded}
                              onClick={() => handleProcessInfluencerRequest(req.id, 'approve')}
                              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer ${
                                isExceeded
                                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                              }`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{isExceeded ? 'Saldo Insuficiente' : `Aprovar (R$ ${effectiveReleaseAmount.toFixed(2)})`}</span>
                            </button>
                            <button
                              disabled={processingRequestId === req.id}
                              onClick={() => handleProcessInfluencerRequest(req.id, 'reject')}
                              className="px-2.5 py-1.5 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 border border-slate-200 cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Recusar</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Indications List */}
      <div className="affiliate-network-panel space-y-3 pt-2">
        {/* Controls Bar: Category Filters + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white p-2.5 rounded-2xl border border-[#E5E5E5] shadow-2xs">
          {/* Filters for Jogadores / Influenciadores */}
          <div className="flex items-center bg-[#F5F5F5] p-1 rounded-xl border border-[#E5E5E5] gap-1 self-start sm:self-auto shrink-0 max-w-full overflow-x-auto no-scrollbar">
            <button
              onClick={() => setFilterType('players')}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer shrink-0 ${
                filterType === 'players' ? 'bg-[#111111] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Jogadores ({rawIndicationsList.filter(i => !i.isInfluencer).length})
            </button>
            <button
              onClick={() => setFilterType('influencers')}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                filterType === 'influencers' ? 'bg-[#111111] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <img src={logoImg} alt="Logo" className="h-3.5 max-w-[20px] object-contain" />
              Influenciadores ({rawIndicationsList.filter(i => i.isInfluencer).length})
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full sm:w-auto">
            <select value={gameFilter} onChange={(e) => setGameFilter(e.target.value as typeof gameFilter)} className="bg-[#F5F5F5] border border-[#E5E5E5] text-[11px] font-semibold text-[#111111] px-2.5 py-1.5 rounded-xl outline-none">
              <option value="all">🎮 Todos os Jogos</option>
              <option value="g_subway_pay">🏃 Subway Pay</option>
              <option value="g_zumbla">🐸 Zumbla Win</option>
              <option value="g_block_puzzle">🧩 Block Win</option>
              <option value="g_gen_dino">🦖 GEN DINO</option>
              <option value="g_raspa_fortuna">🍀 Raspa Fortuna</option>
            </select>
            <select value={depositFilter} onChange={(e) => setDepositFilter(e.target.value as typeof depositFilter)} className="bg-[#F5F5F5] border border-[#E5E5E5] text-[11px] font-semibold text-[#111111] px-2.5 py-1.5 rounded-xl outline-none">
              <option value="all">Todos da minha rede</option>
              <option value="deposited">Com depósito</option>
              <option value="no_deposit">Sem depósito</option>
            </select>
            <select value={networkSort} onChange={(e) => setNetworkSort(e.target.value as typeof networkSort)} className="bg-[#F5F5F5] border border-[#E5E5E5] text-[11px] font-semibold text-[#111111] px-2.5 py-1.5 rounded-xl outline-none">
              <option value="recent">Mais recentes</option>
              <option value="deposits">Maior depósito</option>
              <option value="name">Nome A–Z</option>
            </select>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-full sm:max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou e-mail..."
              className="w-full bg-[#F5F5F5] focus:bg-white border border-[#E5E5E5] focus:border-[#111111] text-xs font-medium text-[#111111] pl-8 pr-7 py-1.5 rounded-xl outline-none transition-all placeholder:text-slate-400"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <h3 className="font-semibold text-[11px] uppercase tracking-wider text-[#737373]">
            Exibindo {filteredIndications.length} usuário{filteredIndications.length !== 1 ? 's' : ''}
          </h3>
        </div>

        {filteredIndications.length > 0 ? (
          <>
            <div className="affiliate-network-list space-y-1.5">
              {paginatedIndications.map((ind) => (
                <div
                  key={ind.id}
                  onClick={() => {
                    setSelectedIndication(ind);
                    setManageModalOpen(true);
                  }}
                  className="affiliate-network-row p-2 sm:p-2.5 rounded-xl bg-white hover:bg-slate-50/90 border border-[#E5E5E5] hover:border-slate-300 transition-all cursor-pointer shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                {/* User Info */}
                <div className="flex items-center gap-2.5 min-w-[180px]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[11px] border p-1 bg-[#F5F5F5] text-[#111111] border-[#E5E5E5] shrink-0">
                    {ind.isInfluencer ? (
                      <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      ind.referredName ? ind.referredName.charAt(0).toUpperCase() : 'U'
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap leading-tight">
                      <h4 className="font-bold text-[#111111] text-xs truncate max-w-[150px]">
                        {ind.referredName}
                      </h4>
                      {/* Jogo de Origem */}
                      {(() => {
                        const gid = ind.registeredGame || ind.lastGameId || 'g_block_puzzle';
                        if (gid === 'g_subway_pay' || gid.includes('subway')) {
                          return (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[8px] px-1.5 py-0.5 rounded-md font-extrabold flex items-center gap-0.5 shrink-0 shadow-2xs">
                              <span>🏃</span> Subway Pay
                            </span>
                          );
                        }
                        if (gid === 'g_zumbla') {
                          return (
                            <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[8px] px-1.5 py-0.5 rounded-md font-extrabold flex items-center gap-0.5 shrink-0 shadow-2xs">
                              <span>🐸</span> Zumbla
                            </span>
                          );
                        }
                        if (gid === 'g_gen_dino') {
                          return (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[8px] px-1.5 py-0.5 rounded-md font-extrabold flex items-center gap-0.5 shrink-0 shadow-2xs">
                              <span>🦖</span> Dino
                            </span>
                          );
                        }
                        if (gid === 'g_raspa_fortuna') {
                          return (
                            <span className="bg-orange-100 text-orange-900 border border-orange-300 text-[8px] px-1.5 py-0.5 rounded-md font-extrabold flex items-center gap-0.5 shrink-0 shadow-2xs">
                              <span>🍀</span> Raspa
                            </span>
                          );
                        }
                        return (
                          <span className="bg-cyan-100 text-cyan-900 border border-cyan-300 text-[8px] px-1.5 py-0.5 rounded-md font-extrabold flex items-center gap-0.5 shrink-0 shadow-2xs">
                            <span>🧩</span> Block Win
                          </span>
                        );
                      })()}

                      {ind.isInfluencer ? (
                        <span className="bg-amber-50 text-amber-900 border border-amber-200/80 text-[8px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 shrink-0">
                          <img src={logoImg} alt="Logo" className="h-2 max-w-[12px] object-contain" /> Influenciador ({ind.influencerRate ?? 50}%)
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-600 border border-slate-200 text-[8px] px-1.5 py-0.5 rounded-md font-bold shrink-0">
                          Jogador
                        </span>
                      )}

                      {/* Tag de Parceiro VIP */}
                      {ind.partnerApproved ? (
                        <span className="bg-gradient-to-r from-amber-100 to-emerald-100 text-emerald-950 border border-emerald-300 text-[8px] px-1.5 py-0.5 rounded-md font-extrabold flex items-center gap-0.5 shrink-0 shadow-2xs" title={`Parceiro Oficial VIP (${ind.partnerCode || 'VIP'})`}>
                          <Crown className="w-2.5 h-2.5 text-amber-600" /> Parceiro ({ind.partnerCode || 'VIP'})
                        </span>
                      ) : ind.partnerRequested ? (
                        <span className="bg-amber-100 text-amber-900 border border-amber-300 text-[8px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 shrink-0" title="Solicitou acesso ao Painel de Parceiros">
                          <span>⏳</span> Pedido Parceiro
                        </span>
                      ) : null}

                      {/* Tag de Influenciador Responsável quando o jogador veio de um influenciador */}
                      {!ind.isInfluencer && (ind.isFromInfluencer || ind.referredByInfluencerName) && (
                        <span 
                          className="bg-purple-100 text-purple-900 border border-purple-300 text-[8px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 shrink-0 shadow-2xs"
                          title={`Jogador trazido pelo influenciador ${ind.referredByInfluencerName || 'da rede'}`}
                        >
                          <span className="text-[9px]">⭐</span> Via {ind.referredByInfluencerName || 'Influenciador'}
                        </span>
                      )}
                      {/* Tag de Saque Bloqueado / Saldo de Afiliado */}
                      {(ind.withdrawBlocked || ind.hasAffiliateDemoBalance) && (
                        <span 
                          className="bg-rose-50 text-rose-800 border border-rose-200 text-[8px] px-1.5 py-0.5 rounded-md font-bold flex items-center gap-0.5 shrink-0 shadow-2xs"
                          title="Saque bloqueado pelo sistema: saldo concedido por afiliado / modo influenciador"
                        >
                          <span>🔒</span> Saque Bloqueado
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#737373] block truncate max-w-[180px]">
                      {ind.referredEmail}
                    </span>
                  </div>
                </div>

                {/* Metrics & Action Buttons */}
                <div className="flex items-center gap-2 sm:gap-2.5 pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 justify-between sm:justify-end">
                  {ind.isInfluencer ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap sm:flex-nowrap">
                      <span className="text-emerald-700 font-bold bg-emerald-50/80 px-2 py-0.5 rounded-lg border border-emerald-100/80 text-[10px] sm:text-[11px]">
                        Rede: <strong className="font-extrabold">R$ {(ind.subNetworkDeposits ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                      <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200/80 text-[10px] sm:text-[11px]">
                        Comissão: <strong className="font-extrabold">R$ {(ind.affiliateBalance ?? ind.influencerBalance ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono">
                      <span className="text-emerald-700 font-bold bg-emerald-50/80 px-2 py-0.5 rounded-lg border border-emerald-100/80 text-[10px] sm:text-[11px]">
                        Dep: <strong className="font-extrabold">R$ {(ind.totalDeposited ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                      <span className="text-slate-800 font-bold bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200/80 text-[10px] sm:text-[11px]">
                        Saldo: <strong className="font-extrabold">R$ {(ind.referredBalance ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIndication(ind);
                          setManageModalOpen(true);
                        }}
                        className={`px-2 py-1 text-[10px] font-extrabold rounded-lg transition-all flex items-center gap-1 cursor-pointer border shadow-2xs active:scale-95 ${
                          ind.partnerApproved
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                        }`}
                        title="Definir este usuário como Parceiro VIP com acesso a parceiro.goalliancehub.com ou /parceiros"
                      >
                        <Crown className="w-3 h-3 text-amber-600 shrink-0" />
                        <span className="hidden xs:inline">{ind.partnerApproved ? 'Parceiro' : 'Tornar Parceiro'}</span>
                      </button>
                    )}

                    {ind.isInfluencer ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setInfluencerMetricsItem(ind);
                          }}
                          className="px-2 py-1 bg-[#111111] hover:bg-black text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 shadow-2xs cursor-pointer active:scale-95"
                        >
                          <BarChart3 className="w-3 h-3 text-amber-400" />
                          <span>Métricas</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedIndication(ind);
                            setManageModalOpen(true);
                          }}
                          className="p-1 bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#111111] border border-[#E5E5E5] rounded-lg transition-all cursor-pointer"
                          title="Gerenciar"
                        >
                          <Settings className="w-3.5 h-3.5 text-[#111111]" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedIndication(ind);
                          setManageModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#111111] border border-[#E5E5E5] rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                      >
                        <Settings className="w-3 h-3 text-[#111111]" />
                        <span>Gerenciar</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 40 per page Pagination for Indications */}
          <Pagination
            currentPage={indicationsPage}
            totalItems={filteredIndications.length}
            pageSize={INDICATIONS_PAGE_SIZE}
            onPageChange={setIndicationsPage}
            itemLabel={filterType === 'players' ? 'jogadores' : 'influenciadores'}
            className="mt-3"
          />
        </>
      ) : (
          <div className="p-6 bg-[#F5F5F5] rounded-2xl border border-dashed border-[#E5E5E5] text-center text-xs text-[#737373] space-y-1">
            <ShieldCheck className="w-6 h-6 mx-auto text-[#737373] mb-1" />
            <p className="font-medium text-[#111111]">Nenhum usuário nesta categoria</p>
            <p>Alterne entre os filtros ou compartilhe seu link de indicação.</p>
          </div>
        )}
      </div>

      {/* POPUP INFLUENCER METRICS MODAL */}
      {influencerMetricsItem && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 min-h-[100dvh] animate-in fade-in duration-200"
          onClick={() => setInfluencerMetricsItem(null)}
        >
          <div
            className="relative w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-[#E5E5E5] max-h-[88dvh] overflow-y-auto space-y-4 my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto -mt-1 mb-1" />

            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img src={logoImg} alt="Logo" className="h-8 max-w-[120px] object-contain shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-[#111111]">{influencerMetricsItem.referredName}</h3>
                    <span className="bg-amber-50 text-amber-900 border border-amber-200/80 text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <img src={logoImg} alt="Logo" className="h-2.5 max-w-[14px] object-contain" /> Influenciador
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{influencerMetricsItem.referredEmail}</p>
                </div>
              </div>
              <button
                onClick={() => setInfluencerMetricsItem(null)}
                className="p-1.5 rounded-full bg-[#F5F5F5] hover:bg-[#EBEBEB] text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title / Description */}
            <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-700 shrink-0" />
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                Desempenho da rede de indicados vinculados a este influenciador.
              </p>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {/* Total Depósitos da Rede */}
              <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> Depósitos Gerados na Rede
                  </span>
                  <span className="text-lg font-extrabold text-emerald-700 font-mono">
                    R$ {(influencerMetricsItem.subNetworkDeposits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Volume acumulado depositado pelos indicados do influenciador
                  </span>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-[#111111] text-emerald-400 flex items-center justify-center shadow-2xs shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>

              {/* Saldo Total Trazido Pela Rede */}
              <div className="bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#E2E8F0] col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5 text-slate-800" /> Saldo Total Trazido Pela Rede
                  </span>
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    R$ {(influencerMetricsItem.subNetworkBalances || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Soma dos saldos atuais nas contas dos jogadores indicados
                  </span>
                </div>
                <div className="w-9 h-9 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
              </div>

              {/* Total Cadastros / Indicados */}
              <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0]">
                <div className="w-6 h-6 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center mb-1.5">
                  <Users className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 block">Cadastros na Rede</span>
                <span className="text-sm font-bold text-[#111111] block font-mono mt-0.5">
                  {influencerMetricsItem.subReferralsCount || 0} <span className="text-[10px] font-normal text-slate-500">jogadores</span>
                </span>
              </div>

              {/* Saldo de Comissão de Afiliado */}
              <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0]">
                <div className="w-6 h-6 rounded-lg bg-amber-100 p-1 flex items-center justify-center mb-1.5">
                  <img src={logoImg} alt="Logo" className="w-full h-full object-contain" />
                </div>
                <span className="text-[10px] font-semibold text-slate-500 block">Saldo de Comissão</span>
                <span className="text-sm font-bold text-[#111111] block font-mono mt-0.5">
                  R$ {(influencerMetricsItem.affiliateBalance || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Taxa de Comissão & Margem Garantida */}
              <div className="bg-[#F8FAFC] p-3 rounded-2xl border border-[#E2E8F0] col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-0.5">
                    Acordo de Comissão (RevShare)
                  </span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100 font-mono">
                      Influenciador: {influencerMetricsItem.influencerRate ?? 50}%
                    </span>
                    <span className="text-xs font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 font-mono">
                      Sua Margem: {Math.max(10, (activeInfo.revSharePercent ?? 70) - (influencerMetricsItem.influencerRate ?? 50))}%
                    </span>
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-500">
                  <span>Margem mínima: <strong>10%</strong></span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 flex items-center gap-2">
              <button
                onClick={() => {
                  const current = influencerMetricsItem;
                  setInfluencerMetricsItem(null);
                  setSelectedIndication(current);
                  setManageModalOpen(true);
                }}
                className="flex-1 py-2.5 bg-[#111111] hover:bg-black text-white rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Gerenciar Permissões / Saldo</span>
              </button>

              <button
                onClick={() => setInfluencerMetricsItem(null)}
                className="px-4 py-2.5 bg-[#F5F5F5] hover:bg-[#EBEBEB] text-[#111111] border border-[#E5E5E5] rounded-xl font-bold text-xs transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ManageIndicatedModal
        isOpen={manageModalOpen}
        onClose={() => setManageModalOpen(false)}
        indication={selectedIndication}
        affiliateRevShare={activeInfo.revSharePercent ?? 70}
        isAdmin={isAdmin}
        onShowToast={onShowToast}
        onSaveSuccess={(updated) => {
          const updatedList = rawIndicationsList.map((item) =>
            (item.id === updated.id || item.referredUserId === updated.referredUserId)
              ? updated
              : item
          );
          setLocalIndications(updatedList);
        }}
      />

      <AffiliateWithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        affiliateBalance={activeInfo.affiliateBalance || 0}
        withdrawFee={activeInfo.withdrawFee ?? 0}
        onWithdrawSuccess={(newBalance) => {
          if (internalAffiliateInfo) {
            setInternalAffiliateInfo((prev) => prev ? { ...prev, affiliateBalance: newBalance } : null);
          }
          if (onRefresh) onRefresh();
        }}
        onShowToast={onShowToast}
      />
    </div>
  );
};
