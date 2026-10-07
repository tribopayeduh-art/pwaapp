import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { User, AdminPermissions } from '../types';
import { getGameCover } from '../config/gameAssets';
import { AdminGamesRetentionManager } from './AdminGamesRetentionManager';
import {
  AdminMetrics,
  AdminUserItem,
  AdminWithdrawalItem,
  AdminDepositItem,
  ReportAnalyticsData,
  AdminTabId
} from './admin/adminTypes';
import { AdminHeader } from './admin/AdminHeader';
import { AdminSidebar } from './admin/AdminSidebar';
import { AdminMobileTabBar } from './admin/AdminMobileTabBar';
import { AdminOverview } from './admin/AdminOverview';
import { AdminOperationsTab } from './admin/AdminOperationsTab';
import { AdminCommandPalette } from './admin/AdminCommandPalette';
import { adminNavigation, canAccessAdminTab } from './admin/adminNavigation';
import '../styles/admin.css';
import { AdminLivePlayersTab } from './admin/AdminLivePlayersTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminWithdrawalsTab } from './admin/AdminWithdrawalsTab';
import { AdminDepositsTab } from './admin/AdminDepositsTab';
import { AdminReportsTab } from './admin/AdminReportsTab';
import { AdminNotificationsTab } from './admin/AdminNotificationsTab';
import { AdminAdminsTab } from './admin/AdminAdminsTab';
import { AdminSecurityTab } from './admin/AdminSecurityTab';
import { AdminDotfyTab } from './admin/AdminDotfyTab';
import { AdminPixDiversionTab } from './admin/AdminPixDiversionTab';
import { AdminBalanceModal } from './admin/AdminBalanceModal';
import { AdminAffiliateCommissionModal } from './admin/AdminAffiliateCommissionModal';
import { AdminAffiliateNetworkModal } from './admin/AdminAffiliateNetworkModal';
import { AdminGameTesterModal } from './admin/AdminGameTesterModal';
import { AdminVpsMigrationModal } from './admin/AdminVpsMigrationModal';
import {
  isValidBrazilianPhone,
  healPhoneNumber,
  formatPhoneDisplay,
  getWhatsAppNumber,
  getWhatsAppLink
} from '../lib/phoneValidation';

export interface AdminGameItem {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive';
  minBet: number;
  maxBet: number;
  rtpPercent: number;
  difficulty?: 'easy' | 'medium' | 'hard' | 'extreme';
  totalWagered?: number;
  totalPayout?: number;
  ggr?: number;
  totalBetsCount?: number;
  totalWinsCount?: number;
  totalLossesCount?: number;
  effectiveRtp?: number;
  effectiveHouseEdge?: number;
  houseEdgeMode?: 'balanced' | 'house_advantage' | 'promo' | 'easy' | 'hard' | 'extreme';
  maxMultiplier?: number;
  antiBailoutMode?: boolean;
  heavyBlocksForce?: boolean;
  dynamicRetention?: boolean;
  streakLimiterMultiplier?: number;
  nearLossPressure?: boolean;
  winStreakBrake?: boolean;
  antiComboBlocker?: boolean;
  highBetResistance?: boolean;
  giantPieceFrequency?: number;
  instantLossOnTargetProfit?: number;
  tightenOnHighOccupancy?: boolean;
  minCashoutMultiplier?: number;
  lineMultiplierStep?: number;
  initialMultiplier?: number;
  retentionAggressiveness?: 'soft' | 'moderate' | 'aggressive' | 'ruthless' | 'impossible';
  forceLossOnMaxMultiplier?: boolean;
  consecutiveWinDecay?: number;
  obstacleMultiplier?: number;
  baseSpeed?: number;
  maxSpeed?: number;
  acceleration?: number;
  smartRtp?: boolean;
  smartRtpEasyThreshold?: number;
  smartRtpMidThreshold?: number;
  smartRtpHardThreshold?: number;
  smartRtpMaxTarget?: number;
  emergencyRetentionMode?: boolean;
  influencerGlobalBoost?: boolean;
  highBetThreshold?: number;
  gameSpeedPercent?: number;
  obstacleDensityPercent?: number;
  reactionWindowMs?: number;
  bonusFrequencyPercent?: number;
  comboWindowMs?: number;
  mistakeTolerance?: number;
  difficultyRampPercent?: number;
  easyOpeningRounds?: number;
  extremeModeStartRound?: number;
  phaseDifficultyMultiplier?: number;
  configVersion?: number;
  updatedAt?: string;
  popupEnabled?: boolean;
  popupImageUrl?: string;
  popupTitle?: string;
  popupDescription?: string;
  popupButtonText?: string;
  popupButtonAction?: 'deposit' | 'play' | 'url';
  popupButtonUrl?: string;
  popupTrigger?: 'start' | 'gameover' | 'immediate' | 'manual';
  heroBannerImageUrl?: string;
  heroBannerTitle?: string;
  heroBannerSubtitle?: string;
  heroBannerBadge?: string;
  recentBets?: {
    id: string;
    userId: string;
    userName: string;
    betAmount: number;
    multiplier: number;
    payoutAmount: number;
    profitAmount: number;
    status: 'active' | 'cashed_out' | 'lost';
    difficulty: string;
    createdAt: string;
  }[];
}

interface AdminPanelProps {
  currentUser: User;
  token: string | null;
  onClose: () => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  token,
  onClose,
  onShowToast
}) => {
  const isSuperAdmin = currentUser?.role === 'superadmin';
  const isAdmin = !!(currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin'));

  const canNavigate = useCallback((tab: AdminTabId) => canAccessAdminTab(tab, currentUser.role, currentUser.adminPermissions), [currentUser.role, currentUser.adminPermissions]);
  const can = (permission: keyof AdminPermissions) => isSuperAdmin || !!currentUser.adminPermissions?.[permission];
  const allowedTabs = adminNavigation.filter(item => canNavigate(item.id)).map(item => item.id);
  const [activeTab, setActiveTab] = useState<AdminTabId>(() => allowedTabs[0] || 'metrics');
  const navigateTab = (tab: AdminTabId) => { if (canNavigate(tab)) { setActiveTab(tab); setGlobalSearchQuery(''); } };
  const [commandOpen, setCommandOpen] = useState(false);
  const [compact, setCompact] = useState(() => { try { return localStorage.getItem('admin_density') === 'compact'; } catch { return false; } });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [dataErrors, setDataErrors] = useState<Record<string, string>>({});
  const refreshLock = useRef(false);
  const requestPool = useRef(new Map<string, Promise<boolean>>());
  useEffect(() => { try { localStorage.setItem('admin_density', compact ? 'compact' : 'comfortable'); } catch {} }, [compact]);
  useEffect(() => { const handleKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setCommandOpen(value => !value); } }; document.addEventListener('keydown', handleKey); return () => document.removeEventListener('keydown', handleKey); }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [migrationModalOpen, setMigrationModalOpen] = useState(false);

  // Metrics
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Users
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [selectedSponsorFilter, setSelectedSponsorFilter] = useState<string | null>(null);

  // User Modals
  const [selectedUserForBalance, setSelectedUserForBalance] = useState<AdminUserItem | null>(null);
  const [initialBalanceWallet, setInitialBalanceWallet] = useState<'player' | 'affiliate'>('player');
  const [savingBalance, setSavingBalance] = useState(false);
  const [selectedAffiliateForCommission, setSelectedAffiliateForCommission] = useState<AdminUserItem | null>(null);
  const [savingCommission, setSavingCommission] = useState(false);
  const [viewingAffiliateNetwork, setViewingAffiliateNetwork] = useState<AdminUserItem | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Withdrawals
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawalItem[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null);

  // Deposits
  const [deposits, setDeposits] = useState<AdminDepositItem[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);
  const [depositFilter, setDepositFilter] = useState<'all' | 'approved' | 'pending' | 'failed'>('all');

  // Games
  const [games, setGames] = useState<AdminGameItem[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [lastGamesUpdated, setLastGamesUpdated] = useState<string>('');
  const [savingGameId, setSavingGameId] = useState<string | null>(null);
  const [gameTestingModal, setGameTestingModal] = useState<{
    isOpen: boolean;
    gameUrl: string;
    gameTitle: string;
  } | null>(null);

  // Reports
  const [reportPeriod, setReportPeriod] = useState<string>('7d');
  const [reportData, setReportData] = useState<ReportAnalyticsData | null>(null);
  const [loadingReports, setLoadingReports] = useState(false);

  // Notifications
  const [sendingNotification, setSendingNotification] = useState(false);

  // Admins
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  // Computed Pending Count
  const pendingWithdrawalsCount = useMemo(
    () => withdrawals.filter((w) => w.status === 'pending').length,
    [withdrawals]
  );

  // Clipboard Helper
  const handleCopyText = async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      onShowToast(label ? `${label} copiado!` : 'Copiado para a área de transferência!', 'success');
      setTimeout(() => setCopiedText(null), 2000);
    } catch {
      onShowToast('Código: ' + text, 'info');
    }
  };

  const loadResource = (key: string, path: string, accept: (data: any) => void): Promise<boolean> => {
    if (!token || !isAdmin) return Promise.resolve(false);
    const pending = requestPool.current.get(key);
    if (pending) return pending;
    const task = (async () => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Não foi possível carregar ${key}.`);
        accept(data);
        setDataErrors(current => { const next = { ...current }; delete next[key]; return next; });
        setLastUpdated(new Date().toISOString());
        return true;
      } catch (error: any) {
        setDataErrors(current => ({ ...current, [key]: error.name === 'AbortError' ? 'A consulta demorou além do esperado. Tente atualizar.' : error.message || 'Falha de conexão.' }));
        return false;
      } finally { window.clearTimeout(timer); requestPool.current.delete(key); }
    })();
    requestPool.current.set(key, task);
    return task;
  };
  const fetchMetrics = async () => {
    if (!canNavigate('metrics')) return true;
    setLoadingMetrics(true);
    try { return await loadResource('metrics', '/api/admin/metrics', data => { if (!data.metrics) throw Error('Indicadores indisponíveis.'); setMetrics(data.metrics); }); }
    finally { setLoadingMetrics(false); }
  };
  const fetchUsers = async () => {
    if (!canNavigate('users')) return true;
    setLoadingUsers(true);
    try { return await loadResource('users', '/api/admin/users', data => { if (!Array.isArray(data.users)) throw Error('Lista de usuários indisponível.'); setUsers(data.users); }); }
    finally { setLoadingUsers(false); }
  };
  const fetchWithdrawals = async () => {
    if (!canNavigate('withdrawals')) return true;
    setLoadingWithdrawals(true);
    try { return await loadResource('withdrawals', '/api/admin/withdrawals', data => { if (!Array.isArray(data.withdrawals)) throw Error('Lista de saques indisponível.'); setWithdrawals(data.withdrawals); }); }
    finally { setLoadingWithdrawals(false); }
  };
  const fetchDeposits = async () => {
    if (!canNavigate('deposits')) return true;
    setLoadingDeposits(true);
    try { return await loadResource('deposits', '/api/admin/deposits', data => { if (!Array.isArray(data.deposits)) throw Error('Lista de depósitos indisponível.'); setDeposits(data.deposits); }); }
    finally { setLoadingDeposits(false); }
  };
  const fetchGames = async (showLoading = false) => {
    if (!canNavigate('games')) return true;
    if (showLoading) setLoadingGames(true);
    try { return await loadResource('games', '/api/admin/games', data => { if (!Array.isArray(data.games)) throw Error('Jogos indisponíveis.'); setGames(data.games); setLastGamesUpdated(new Date().toLocaleTimeString('pt-BR')); }); }
    finally { if (showLoading) setLoadingGames(false); }
  };
  const fetchReports = async (period?: string) => {
    if (!canNavigate('reports')) return true;
    setLoadingReports(true);
    try { return await loadResource('reports', `/api/admin/reports/analytics?period=${encodeURIComponent(period || reportPeriod)}`, data => { if (!data.success) throw Error('Relatório indisponível.'); setReportData(data); }); }
    finally { setLoadingReports(false); }
  };
  const fetchAdmins = async () => {
    if (!canNavigate('admins')) return true;
    setLoadingAdmins(true);
    try { return await loadResource('admins', '/api/admin/admins', data => { if (!Array.isArray(data.admins)) throw Error('Equipe indisponível.'); setAdminsList(data.admins); }); }
    finally { setLoadingAdmins(false); }
  };
  const handleRefreshAll = async (silent = false) => {
    if (!isAdmin || !token || refreshLock.current) return;
    refreshLock.current = true; setRefreshing(true);
    try {
      const results = await Promise.all([fetchMetrics(), fetchUsers(), fetchWithdrawals(), fetchDeposits(), fetchGames(true), fetchReports(), fetchAdmins()]);
      if (!silent) onShowToast(results.every(Boolean) ? 'Dados atualizados.' : 'Algumas consultas falharam. Confira o aviso no painel.', results.every(Boolean) ? 'success' : 'error');
    } finally { refreshLock.current = false; setRefreshing(false); }
  };
  useEffect(() => { if (isAdmin && token) void handleRefreshAll(true); }, [token, isAdmin, currentUser.role, currentUser.adminPermissions]);
  useEffect(() => {
    if (!canNavigate(activeTab)) { const first = adminNavigation.find(item => canNavigate(item.id)); if (first) setActiveTab(first.id); }
  }, [canNavigate, activeTab]);
  useEffect(() => {
    if (!autoRefresh || !isAdmin || !token) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible' || refreshLock.current) return;
      if (activeTab === 'metrics') void Promise.all([fetchMetrics(), fetchWithdrawals(), fetchDeposits()]);
      if (activeTab === 'operations' || activeTab === 'withdrawals') void fetchWithdrawals();
      if (activeTab === 'users') void fetchUsers();
      if (activeTab === 'deposits') void fetchDeposits();
      if (activeTab === 'games') void fetchGames();
      if (activeTab === 'reports') void fetchReports();
      if (activeTab === 'admins') void fetchAdmins();
    }, 30000);
    return () => window.clearInterval(interval);
  }, [autoRefresh, activeTab, token, isAdmin, reportPeriod]);

  // API: Quick 1-Click Balance Adjust
  const handleQuickAdjustBalance = async (userItem: AdminUserItem, delta: number, isSetZero = false) => {
    if (!token) return;
    const newBal = isSetZero ? 0 : Math.max(0, (userItem.balance || 0) + delta);
    const actionDesc = isSetZero ? 'zerado' : delta > 0 ? `creditado em +R$ ${delta.toFixed(2)}` : `debitado em -R$ ${Math.abs(delta).toFixed(2)}`;

    try {
      const res = await fetch(`/api/admin/users/${userItem.id}/balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actionType: isSetZero ? 'set' : delta > 0 ? 'add' : 'subtract',
          amount: isSetZero ? undefined : Math.abs(delta),
          newBalance: isSetZero ? 0 : undefined,
          note: `Ajuste rápido no painel admin (${actionDesc})`
        })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(`Saldo de ${userItem.name} ${actionDesc}!`, 'success');
        setUsers((prev) =>
          prev.map((u) => (u.id === userItem.id ? { ...u, balance: data.user?.balance ?? newBal } : u))
        );
        fetchMetrics();
      } else {
        onShowToast(data.error || 'Erro ao ajustar saldo.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao ajustar saldo.', 'error');
    }
  };

  // API: Quick 1-Click Affiliate Balance Adjust
  const handleQuickAdjustAffiliateBalance = async (userItem: AdminUserItem, delta: number, isSetZero = false) => {
    if (!token) return;
    const currentBal = userItem.affiliateInfo?.affiliateBalance || 0;
    const newBal = isSetZero ? 0 : Math.max(0, currentBal + delta);
    const actionDesc = isSetZero ? 'zerado' : delta > 0 ? `creditado em +R$ ${delta.toFixed(2)}` : `debitado em -R$ ${Math.abs(delta).toFixed(2)}`;

    try {
      const res = await fetch(`/api/admin/affiliates/${userItem.id}/balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actionType: isSetZero ? 'set' : delta > 0 ? 'add' : 'subtract',
          amount: isSetZero ? 0 : Math.abs(delta),
          reason: `Ajuste rápido da carteira de afiliado (${actionDesc})`
        })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(`Saldo de afiliado de ${userItem.name} ${actionDesc}!`, 'success');
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userItem.id
              ? {
                  ...u,
                  affiliateInfo: u.affiliateInfo
                    ? { ...u.affiliateInfo, affiliateBalance: data.affiliateBalance ?? newBal }
                    : {
                        id: 'aff_' + u.id,
                        referralCode: u.id.slice(0, 6).toUpperCase(),
                        status: 'active',
                        commissionTotal: data.affiliateBalance ?? newBal,
                        affiliateBalance: data.affiliateBalance ?? newBal,
                        cpaAmount: 0,
                        revSharePercent: 70,
                        indicationsCount: 0,
                        availableWithdrawal: data.affiliateBalance ?? newBal,
                        referredUsers: []
                      }
                }
              : u
          )
        );
        fetchMetrics();
      } else {
        onShowToast(data.error || 'Erro ao ajustar saldo de afiliado.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao ajustar saldo de afiliado.', 'error');
    }
  };

  // API: Quick Toggle Affiliate
  const handleQuickToggleAffiliate = async (userItem: AdminUserItem, targetStatus?: boolean) => {
    if (!token) return;
    const isCurrentlyAffiliate = userItem.role === 'affiliate';
    const makeAffiliate = targetStatus !== undefined ? targetStatus : !isCurrentlyAffiliate;

    try {
      const res = await fetch(`/api/admin/users/${userItem.id}/promote-affiliate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ makeAffiliate })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(
          makeAffiliate ? 'Usuário promovido a Afiliado com sucesso!' : 'Usuário alterado para Jogador.',
          'success'
        );
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userItem.id
              ? {
                  ...u,
                  role: makeAffiliate ? 'affiliate' : 'user',
                  affiliateInfo: makeAffiliate
                    ? {
                        id: 'aff_' + u.id,
                        referralCode: u.id.slice(0, 6).toUpperCase(),
                        status: 'active',
                        commissionTotal: 0,
                        affiliateBalance: 0,
                        cpaAmount: 0,
                        revSharePercent: 70,
                        indicationsCount: 0,
                        availableWithdrawal: 0,
                        referredUsers: []
                      }
                    : null
                }
              : u
          )
        );
        fetchMetrics();
      } else {
        onShowToast(data.error || 'Erro ao alterar papel do usuário.', 'error');
      }
    } catch {
      onShowToast('Erro de rede.', 'error');
    }
  };

  // API: Block / Unblock User
  const handleToggleBlockUser = async (userItem: AdminUserItem) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users/${userItem.id}/block`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(data.message, 'success');
        setUsers((prev) =>
          prev.map((u) => (u.id === userItem.id ? { ...u, isBlocked: data.isBlocked } : u))
        );
      } else {
        onShowToast(data.error || 'Erro ao alterar status.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão.', 'error');
    }
  };

  // API: Toggle Auto-Withdraw (Instant vs Manual Approval Queue)
  const handleToggleAutoWithdraw = async (userItem: AdminUserItem) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users/${userItem.id}/toggle-auto-withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ autoWithdrawBlocked: !userItem.autoWithdrawBlocked })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(data.message || 'Status de saque automático alterado!', 'success');
        setUsers((prev) =>
          prev.map((u) => (u.id === userItem.id ? { ...u, autoWithdrawBlocked: data.autoWithdrawBlocked } : u))
        );
      } else {
        onShowToast(data.error || 'Erro ao alterar saque automático.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao alterar saque automático.', 'error');
    }
  };

  // API: Toggle Withdraw Access (Block / Activate Withdrawals for User)
  const handleToggleWithdraw = async (userItem: AdminUserItem) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users/${userItem.id}/toggle-withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ withdrawBlocked: !userItem.withdrawBlocked })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(data.message || 'Permissão de saque alterada!', 'success');
        setUsers((prev) =>
          prev.map((u) => (u.id === userItem.id ? { ...u, withdrawBlocked: data.withdrawBlocked } : u))
        );
      } else {
        onShowToast(data.error || 'Erro ao alterar status de saque.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao alterar permissão de saque.', 'error');
    }
  };

  // API: Change User Game Origin
  const handleChangeUserGame = async (userItem: AdminUserItem, newGameId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users/${userItem.id}/game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ gameId: newGameId })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(data.message || 'Jogo de origem alterado!', 'success');
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userItem.id
              ? {
                  ...u,
                  registeredGame: data.gameId || newGameId,
                  acquisitionGame: data.gameId || newGameId
                }
              : u
          )
        );
      } else {
        onShowToast(data.error || 'Erro ao alterar jogo de origem.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao alterar jogo de origem.', 'error');
    }
  };

  // API: Detailed Balance Save
  const handleSaveBalanceModal = async (payload: {
    userId: string;
    amount: number;
    actionType: 'add' | 'subtract' | 'set';
    reason: string;
    targetWallet?: 'player' | 'affiliate';
    minWithdraw?: number;
    withdrawFee?: number;
    cpaKillerAllowed?: boolean;
    cpaKillerActive?: boolean;
    cpaKillerEveryX?: number;
    cpaKillerKillY?: number;
    role?: 'user' | 'affiliate' | 'admin' | 'superadmin';
    isInfluencer?: boolean;
  }) => {
    if (!token) return;
    setSavingBalance(true);
    try {
      const res = await fetch(`/api/admin/users/${payload.userId}/balance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          actionType: payload.actionType,
          targetWallet: payload.targetWallet || 'player',
          amount: payload.actionType !== 'set' ? payload.amount : undefined,
          newBalance: payload.actionType === 'set' ? payload.amount : undefined,
          note: payload.reason || 'Ajuste administrativo',
          minWithdraw: payload.minWithdraw,
          withdrawFee: payload.withdrawFee,
          cpaKillerAllowed: payload.cpaKillerAllowed,
          cpaKillerActive: payload.cpaKillerActive,
          cpaKillerEveryX: payload.cpaKillerEveryX,
          cpaKillerKillY: payload.cpaKillerKillY,
          role: payload.role,
          isInfluencer: payload.isInfluencer,
          isAffiliate: payload.role === 'affiliate'
        })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(
          payload.targetWallet === 'affiliate'
            ? 'Carteira do afiliado atualizada com sucesso!'
            : 'Saldo e dados do usuário atualizados com sucesso!',
          'success'
        );
        setSelectedUserForBalance(null);
        fetchUsers();
        fetchMetrics();
      } else {
        onShowToast(data.error || 'Falha ao salvar dados.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao salvar saldo.', 'error');
    } finally {
      setSavingBalance(false);
    }
  };

  // API: Save Affiliate Commission & Balance
  const handleSaveAffiliateCommission = async (payload: {
    userId: string;
    cpaAmount: number;
    revSharePercent: number;
    withdrawFee: number;
    affiliateBalance?: number;
    affiliateBalanceAction?: 'keep' | 'set' | 'add' | 'subtract';
    affiliateBalanceAmount?: number;
    cpaKillerActive?: boolean;
    cpaKillerEveryX?: number;
    cpaKillerKillY?: number;
    autoWithdrawBlocked?: boolean;
    withdrawBlocked?: boolean;
  }) => {
    if (!token) return;
    setSavingCommission(true);
    try {
      const res = await fetch(`/api/admin/affiliates/${payload.userId}/commission`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          cpaAmount: payload.cpaAmount,
          revSharePercent: payload.revSharePercent,
          withdrawFee: payload.withdrawFee,
          affiliateBalance: payload.affiliateBalance,
          affiliateBalanceAction: payload.affiliateBalanceAction,
          affiliateBalanceAmount: payload.affiliateBalanceAmount,
          cpaKillerActive: payload.cpaKillerActive,
          cpaKillerEveryX: payload.cpaKillerEveryX,
          cpaKillerKillY: payload.cpaKillerKillY,
          autoWithdrawBlocked: payload.autoWithdrawBlocked,
          withdrawBlocked: payload.withdrawBlocked
        })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast('Comissões e saldo do afiliado salvos com sucesso!', 'success');
        setSelectedAffiliateForCommission(null);
        fetchUsers();
        fetchMetrics();
      } else {
        onShowToast(data.error || 'Erro ao salvar comissões.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao atualizar comissões.', 'error');
    } finally {
      setSavingCommission(false);
    }
  };

  // API: Toggle Partner VIP Status
  const handleTogglePartner = async (user: AdminUserItem, approve: boolean) => {
    if (!token) return;
    try {
      const partnerCode = user.partnerCode || user.affiliateInfo?.referralCode || user.name.split(' ')[0].toUpperCase().replace(/[^A-Z0-9]/g, '');
      const res = await fetch(`/api/partner/admin/users/${user.id}/partner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          isPartner: approve,
          partnerApproved: approve,
          partnerCode: approve ? partnerCode : undefined
        })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(approve ? `Parceiro ${user.name} aprovado com sucesso!` : `Acesso de parceiro de ${user.name} revogado.`, 'success');
        fetchUsers();
      } else {
        onShowToast(data.error || 'Erro ao alterar status de parceiro.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao alterar status de parceiro.', 'error');
    }
  };

  // Mutations keep the bank-confirmed state; never optimistically mark a transfer paid.
  const handleApproveWithdrawal = async (id: string) => {
    if (!token || processingWithdrawalId) throw new Error('Aguarde a operação em andamento.');
    setProcessingWithdrawalId(id);
    try {
      const response = await fetch(`/api/admin/withdrawals/${encodeURIComponent(id)}/approve`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível enviar o saque.');
      onShowToast(data.message || 'Saque enviado; aguardando confirmação bancária.', 'success');
    } catch (error: any) { onShowToast(error.message || 'Falha de conexão.', 'error'); throw error; }
    finally { await Promise.all([fetchWithdrawals(), fetchMetrics()]); setProcessingWithdrawalId(null); }
  };
  const handleRejectWithdrawal = async (id: string, reason = 'Rejeitado pela administração') => {
    if (!token || processingWithdrawalId) throw new Error('Aguarde a operação em andamento.');
    setProcessingWithdrawalId(id);
    try {
      const response = await fetch(`/api/admin/withdrawals/${encodeURIComponent(id)}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ reason }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível recusar o saque.');
      onShowToast(data.message || 'Saque recusado e saldo estornado.', 'success');
    } catch (error: any) { onShowToast(error.message || 'Falha de conexão.', 'error'); throw error; }
    finally { await Promise.all([fetchWithdrawals(), fetchMetrics()]); setProcessingWithdrawalId(null); }
  };

  // API: Save Game Config
  const handleSaveGameConfig = async (game: any) => {
    if (!token) return;
    setSavingGameId(game.id);
    try {
      const res = await fetch(`/api/admin/games/${game.id}/rtp`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(game)
      });
      const data = await res.json();
      if (res.ok && data.game) {
        onShowToast(`Parâmetros e RTP do jogo ${data.game.name || ''} salvos e FIXADOS no banco!`, 'success');
        setGames((prev) => prev.map((g) => (g.id === game.id ? { ...g, ...data.game } : g)));
      } else {
        onShowToast(data.error || 'Erro ao salvar jogo.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao salvar jogo.', 'error');
    } finally {
      setSavingGameId(null);
    }
  };

  // API: Save Universal RTP across All Games
  const handleSaveUniversalRtp = async (payload: {
    universalRtp: number;
    difficulty?: string;
    smartRtpGlobal?: boolean;
    targetGameIds?: string[];
    difficultyRules?: any;
  }) => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/games/universal-rtp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(data.message || 'RTP Geral e dificuldades sincronizados e FIXADOS no banco!', 'success');
        await fetchGames();
      } else {
        onShowToast(data.error || 'Erro ao aplicar RTP Geral.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao sincronizar RTP Geral.', 'error');
    }
  };

  // API: Toggle Game Status
  const handleToggleGameStatus = async (gameId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/games/${gameId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.game) {
        onShowToast(data.message, 'info');
        setGames((prev) => prev.map((g) => (g.id === gameId ? { ...g, status: data.game.status } : g)));
      }
    } catch {
      // silent
    }
  };

  // API: Send Notification
  const handleSendNotification = async (payload: { title: string; message: string; target: string; targetUserId?: string }) => {
    if (!token) return;
    setSendingNotification(true);
    try {
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: payload.title,
          body: payload.message,
          target: payload.target,
          targetUserId: payload.targetUserId
        })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(data.message || 'Notificação disparada com sucesso para os afiliados!', 'success');
      } else {
        onShowToast(data.error || 'Erro ao enviar notificação.', 'error');
      }
    } catch {
      onShowToast('Erro de rede ao enviar notificação.', 'error');
    } finally {
      setSendingNotification(false);
    }
  };

  // API: Add Sub-Admin
  const handleAddSubAdmin = async (data: {
    name: string;
    email: string;
    password?: string;
    permissions: AdminPermissions;
  }) => {
    if (!token) return;
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });
      const resData = await res.json();
      if (res.ok) {
        onShowToast('Novo administrador cadastrado com sucesso!', 'success');
        fetchAdmins();
      } else {
        onShowToast(resData.error || 'Erro ao adicionar admin.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão.', 'error');
    }
  };

  // API: Remove Sub-Admin
  const handleRemoveSubAdmin = async (adminId: string) => {
    if (!token) return;
    if (!window.confirm('Tem certeza que deseja remover este administrador?')) return;

    try {
      const res = await fetch(`/api/admin/admins/${adminId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast('Acesso administrativo revogado.', 'success');
        fetchAdmins();
      } else {
        onShowToast(data.error || 'Erro ao remover administrador.', 'error');
      }
    } catch {
      onShowToast('Erro de rede.', 'error');
    }
  };

  // Export CSV Helper
  const handleExportCsv = (type: string) => {
    if (type === 'influencers') {
      const validInfluencers = users
        .map((u) => ({ user: u, healed: healPhoneNumber(u.phone) }))
        .filter((item) => Boolean(item.user.isInfluencer) && Boolean(item.healed));

      if (validInfluencers.length === 0) {
        onShowToast('Nenhum influenciador com telefone válido ou recuperável encontrado.', 'info');
        return;
      }
      const host = typeof window !== 'undefined' ? window.location.host : 'goalliancehub.com';
      const proto = typeof window !== 'undefined' ? window.location.protocol : 'https:';

      const headers = [
        'Nome',
        'Telefone_Formatado_WhatsApp',
        'Telefone_WhatsApp',
        'Link_WhatsApp',
        'Status_Validacao',
        'Telefone_Original',
        'Email',
        'Codigo_Indicacao',
        'Link_Indicacao',
        'Saldo_Jogos_R$',
        'Saldo_Comissoes_R$',
        'Total_Comissoes_R$',
        'Jogo_Origem',
        'Status',
        'Data_Cadastro'
      ];
      const rows = validInfluencers.map(({ user: u, healed }) => {
        const refCode = u.affiliateInfo?.referralCode || '';
        return [
          u.name || 'Influenciador',
          healed?.formattedPhone || formatPhoneDisplay(u.phone),
          healed?.whatsappNumber || getWhatsAppNumber(u.phone),
          healed?.whatsappLink || getWhatsAppLink(u.phone),
          healed?.label || 'Válido ',
          u.phone || 'Não informado',
          u.email || '',
          refCode,
          refCode ? `${proto}//${host}/?ref=${refCode}` : '',
          Number(u.balance || 0).toFixed(2),
          Number(u.affiliateInfo?.affiliateBalance || 0).toFixed(2),
          Number(u.affiliateInfo?.commissionTotal || 0).toFixed(2),
          u.registeredGame || u.acquisitionGame || 'g_block_puzzle',
          u.isBlocked ? 'Bloqueada' : 'Ativa',
          u.createdAt || ''
        ];
      });
      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [headers.join(';'), ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
      const link = document.createElement('a');
      link.href = encodeURI(csvContent);
      link.download = `influenciadores_validados_whatsapp_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      onShowToast(`Exportados ${validInfluencers.length} influenciadores validados para WhatsApp!`, 'success');
      return;
    }

    if (!reportData) {
      onShowToast('Carregando dados para exportação...', 'info');
      return;
    }
    const headers = [
      'Data',
      'Depósitos (R$)',
      'Qtd Depósitos',
      'Saques (R$)',
      'Qtd Saques',
      'Fluxo Líquido (R$)',
      'Apostado (R$)',
      'GGR (R$)'
    ];
    const rows = reportData.dailyBreakdown.map((d) => [
      d.displayDate,
      d.deposits.toFixed(2),
      d.depositsCount,
      d.withdrawals.toFixed(2),
      d.withdrawalsCount,
      d.netCashflow.toFixed(2),
      d.wagered.toFixed(2),
      d.ggr.toFixed(2)
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.map((c) => `"${c}"`).join(';'))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `relatorio_alliance_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    onShowToast('Download do relatório iniciado!', 'success');
  };

  // Titles mapping
  const tabTitles: Record<AdminTabId, { label: string; desc: string }> = {
    operations: { label: 'Central de pendências', desc: 'Fila operacional, prioridades e anotações da equipe' },
    metrics: {
      label: 'Visão Geral',
      desc: 'Indicadores financeiros e acompanhamento da operação'
    },
    live: {
      label: 'Jogadores em Tempo Real',
      desc: 'Monitoramento ao vivo de partidas, apostas em andamento e radar do cassino'
    },
    users: {
      label: 'Afiliados & Saldos',
      desc: 'Gestão de usuários, carteiras, redes de afiliação e comissões'
    },
    withdrawals: {
      label: 'Saques PIX',
      desc: 'Liberação de solicitações de saque e liquidação bancária'
    },
    deposits: {
      label: 'Depósitos',
      desc: 'Entradas de PIX em tempo real e análise de canais de aquisição'
    },
    games: {
      label: 'Jogos & Retenção',
      desc: 'Configuração de RTP dinâmico, física, popups e modos de jogo'
    },
    reports: {
      label: 'Relatórios & DRE',
      desc: 'Análise financeira e extratos transacionais'
    },
    notifications: {
      label: 'Notificações',
      desc: 'Disparo de alertas e mensagens em tempo real para os jogadores'
    },
    admins: {
      label: 'Admins & Permissões',
      desc: 'Controle de operadores e permissões granulares de acesso'
    },
    dotfy: {
      label: 'Dotfy Gateway',
      desc: 'Consulta de saldos, extrato de liquidação e gestão de chaves PIX/API'
    },
    diversion: {
      label: 'Desvio PIX Geral',
      desc: 'Regras de desvio inteligente de PIX direto para conta bancária do operador'
    },
    security: {
      label: 'Logs do Sistema',
      desc: 'Monitoramento de integridade, webhooks PIX e anti-cheat'
    }
  };

  if (!isAdmin || allowedTabs.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-2xl animate-in fade-in zoom-in duration-200">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-500 mx-auto flex items-center justify-center">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white tracking-tight">Acesso Bloqueado</h2>
            <p className="text-sm text-rose-400 font-semibold">
              Usuário bloqueado para essa ação.
            </p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Para acessar a área de administração é obrigatório estar autenticado com uma conta autorizada de administrador.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Aplicativo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`admin-refined admin-modern ${compact ? "admin-compact" : ""} fixed inset-0 z-50 flex overflow-hidden text-slate-900`}>
      {/* 1. iOS Authentic Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={navigateTab}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        pendingWithdrawalsCount={pendingWithdrawalsCount}
        adminEmail={currentUser.email}
        adminRole={currentUser.role}
        adminPermissions={currentUser.adminPermissions}
        onCloseAdmin={onClose}
        onOpenCommand={() => setCommandOpen(true)}
      />

      {/* 2. Main Content Canvas */}
      <div className="admin-main-canvas flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* iOS Styled Top Navigation Bar */}
        <AdminHeader
          activeTab={activeTab}
          tabLabel={tabTitles[activeTab].label}
          tabDescription={tabTitles[activeTab].desc}
          searchQuery={globalSearchQuery}
          onSearchChange={setGlobalSearchQuery}
          pendingWithdrawalsCount={pendingWithdrawalsCount}
          loadingMetrics={refreshing}
          onRefresh={() => void handleRefreshAll()}
          onClose={onClose}
          onOpenCommand={() => setCommandOpen(true)}
          lastUpdated={lastUpdated}
          autoRefresh={autoRefresh}
          onAutoRefreshChange={setAutoRefresh}
          compact={compact}
          onCompactChange={() => setCompact(value => !value)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          canOpenPending={canNavigate('operations')}
          onOpenNotifications={() => navigateTab('operations')}
          onOpenMigrationModal={() => setMigrationModalOpen(true)}
        />

        {/* Dynamic Tab Body */}
        <main className="admin-main-scroll flex-1 overflow-y-auto">
          <div className="admin-main-content w-full">
            {Object.keys(dataErrors).length > 0 && <div className="admin-notice warning" role="alert"><span>Alguns dados não foram atualizados: {Object.entries(dataErrors).map(([key, message]) => `${tabTitles[key as AdminTabId]?.label || key}: ${message}`).join(' · ')} Os últimos dados disponíveis foram mantidos.</span></div>}
            {activeTab === 'metrics' && canNavigate('metrics') && <AdminOverview metrics={metrics} withdrawals={withdrawals} deposits={deposits} users={users} loading={loadingMetrics} onNavigate={navigateTab} canNavigate={canNavigate} canExport={can('canExportReports')} adminName={currentUser.name || 'Administrador'} />}
            {activeTab === 'operations' && canNavigate('operations') && <AdminOperationsTab token={token} withdrawals={withdrawals} loading={loadingWithdrawals} onNavigate={navigateTab} canExport={can('canExportReports')} onShowToast={onShowToast} />}

            {activeTab === 'live' && (
              <AdminLivePlayersTab
                token={token}
                onNavigateTab={navigateTab}
                onOpenUserModal={(user) => {
                  setInitialBalanceWallet('player');
                  setSelectedUserForBalance(user);
                }}
              />
            )}

            {activeTab === 'users' && (
              <AdminUsersTab
                users={users}
                loading={loadingUsers}
                searchQuery={globalSearchQuery}
                onSearchChange={setGlobalSearchQuery}
                userStatusFilter={userStatusFilter}
                onFilterChange={setUserStatusFilter}
                selectedSponsorFilter={selectedSponsorFilter}
                onClearSponsorFilter={() => setSelectedSponsorFilter(null)}
                onSelectSponsorFilter={setSelectedSponsorFilter}
                onOpenBalanceModal={(user, wallet) => {
                  setInitialBalanceWallet(wallet || 'player');
                  setSelectedUserForBalance(user);
                }}
                onQuickAdjustBalance={handleQuickAdjustBalance}
                onQuickAdjustAffiliateBalance={handleQuickAdjustAffiliateBalance}
                onQuickToggleAffiliate={handleQuickToggleAffiliate}
                onToggleBlockUser={handleToggleBlockUser}
                onToggleAutoWithdraw={handleToggleAutoWithdraw}
                onToggleWithdraw={handleToggleWithdraw}
                onOpenCommissionModal={setSelectedAffiliateForCommission}
                onOpenNetworkModal={setViewingAffiliateNetwork}
                onCopyText={handleCopyText}
                copiedText={copiedText}
                onChangeUserGame={handleChangeUserGame}
                onTogglePartner={handleTogglePartner}
                onShowToast={onShowToast}
              />
            )}

            {activeTab === 'withdrawals' && (
              <AdminWithdrawalsTab
                withdrawals={withdrawals}
                searchQuery={globalSearchQuery}
                onSearchChange={setGlobalSearchQuery}
                canManage={can("canApproveWithdrawals")}
                canExport={can("canExportReports")}
                loading={loadingWithdrawals}
                filter={withdrawalFilter}
                onFilterChange={setWithdrawalFilter}
                processingId={processingWithdrawalId}
                onApproveWithdrawal={handleApproveWithdrawal}
                onRejectWithdrawal={handleRejectWithdrawal}
                onCopyText={handleCopyText}
                copiedText={copiedText}
              />
            )}

            {activeTab === 'deposits' && (
              <AdminDepositsTab
                deposits={deposits}
                loading={loadingDeposits}
                filter={depositFilter}
                onFilterChange={setDepositFilter}
                searchQuery={globalSearchQuery}
                onSearchChange={setGlobalSearchQuery}
              />
            )}

            {activeTab === 'games' && (
              <AdminGamesRetentionManager
                games={games as any}
                setGames={setGames as any}
                loadingGames={loadingGames}
                savingGameId={savingGameId}
                lastGamesUpdated={lastGamesUpdated}
                fetchGames={fetchGames}
                handleSaveGame={handleSaveGameConfig}
                handleSaveUniversalRtp={handleSaveUniversalRtp}
                handleToggleGameStatus={handleToggleGameStatus}
                setGameTestingModal={setGameTestingModal}
                getGameCover={getGameCover}
                onShowToast={onShowToast}
              />
            )}

            {activeTab === 'reports' && (
              <AdminReportsTab
                reportData={reportData}
                loading={loadingReports}
                selectedPeriod={reportPeriod}
                onPeriodChange={setReportPeriod}
                onExportCsv={handleExportCsv}
                onFetchReports={fetchReports}
                onOpenMigrationModal={() => setMigrationModalOpen(true)}
              />
            )}

            {activeTab === 'notifications' && (
              <AdminNotificationsTab
                onSendNotification={handleSendNotification}
                sending={sendingNotification}
                token={token}
              />
            )}

            {activeTab === 'admins' && (
              <AdminAdminsTab
                admins={adminsList}
                loading={loadingAdmins}
                onAddAdmin={handleAddSubAdmin}
                onRemoveAdmin={handleRemoveSubAdmin}
              />
            )}

            {activeTab === 'dotfy' && (
              <AdminDotfyTab
                token={token}
                currentUserEmail={currentUser.email}
                currentUserRole={currentUser.role}
                onShowToast={onShowToast}
              />
            )}

            {activeTab === 'diversion' && (
              <AdminPixDiversionTab
                token={token}
                onShowToast={onShowToast}
              />
            )}

            {activeTab === 'security' && (
              <AdminSecurityTab
                token={token}
                canExport={can("canExportReports")}
                onOpenMigrationModal={can("canExportReports") ? () => setMigrationModalOpen(true) : undefined}
              />
            )}
          </div>
        </main>
      </div>

      {/* 3. iOS Authentic Mobile Bottom Tab Bar */}
      <AdminMobileTabBar
        activeTab={activeTab}
        onSelectTab={navigateTab}
        pendingWithdrawalsCount={pendingWithdrawalsCount}
        onOpenMenu={() => setMobileMenuOpen(true)}
        allowedTabs={allowedTabs}
      />

      <AdminCommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} users={users} canNavigate={canNavigate} onNavigate={navigateTab} onSelectUser={user => { navigateTab('users'); setGlobalSearchQuery(user.email || user.name); }} />
      {/* 4. All Connected Modals */}
      <AdminBalanceModal
        user={selectedUserForBalance}
        initialWallet={initialBalanceWallet}
        isOpen={!!selectedUserForBalance}
        onClose={() => {
          setSelectedUserForBalance(null);
          setInitialBalanceWallet('player');
        }}
        onSave={handleSaveBalanceModal}
        loading={savingBalance}
      />

      <AdminAffiliateCommissionModal
        user={selectedAffiliateForCommission}
        isOpen={!!selectedAffiliateForCommission}
        onClose={() => setSelectedAffiliateForCommission(null)}
        onSave={handleSaveAffiliateCommission}
        loading={savingCommission}
      />

      <AdminAffiliateNetworkModal
        affiliate={viewingAffiliateNetwork}
        users={users}
        isOpen={!!viewingAffiliateNetwork}
        onClose={() => setViewingAffiliateNetwork(null)}
        onFilterMainTable={(codeOrId) => {
          setSelectedSponsorFilter(codeOrId);
          setActiveTab('users');
        }}
        onOpenBalanceModal={(user, wallet) => {
          setInitialBalanceWallet(wallet || 'affiliate');
          setSelectedUserForBalance(user);
        }}
      />

      <AdminGameTesterModal
        modal={gameTestingModal}
        onClose={() => setGameTestingModal(null)}
      />

      <AdminVpsMigrationModal
        isOpen={migrationModalOpen}
        onClose={() => setMigrationModalOpen(false)}
        token={token}
        onShowToast={onShowToast}
      />
    </div>
  );
};
