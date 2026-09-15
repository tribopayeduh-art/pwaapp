import React, { useState, useEffect, useMemo } from 'react';
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
import { AdminMetricsTab } from './admin/AdminMetricsTab';
import { AdminUsersTab } from './admin/AdminUsersTab';
import { AdminWithdrawalsTab } from './admin/AdminWithdrawalsTab';
import { AdminDepositsTab } from './admin/AdminDepositsTab';
import { AdminReportsTab } from './admin/AdminReportsTab';
import { AdminNotificationsTab } from './admin/AdminNotificationsTab';
import { AdminAdminsTab } from './admin/AdminAdminsTab';
import { AdminSecurityTab } from './admin/AdminSecurityTab';
import { AdminDotfyTab } from './admin/AdminDotfyTab';
import { AdminBalanceModal } from './admin/AdminBalanceModal';
import { AdminAffiliateCommissionModal } from './admin/AdminAffiliateCommissionModal';
import { AdminAffiliateNetworkModal } from './admin/AdminAffiliateNetworkModal';
import { AdminGameTesterModal } from './admin/AdminGameTesterModal';
import { AdminVpsMigrationModal } from './admin/AdminVpsMigrationModal';

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
  const isSuperAdmin = (currentUser?.email || '').toLowerCase() === 'admin.eduh@gmail.com' || (currentUser?.email || '').toLowerCase() === 'tribopayeduh@gmail.com' || currentUser?.role === 'superadmin';
  const isAdmin = !!(currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || isSuperAdmin));

  const [activeTab, setActiveTab] = useState<AdminTabId>('metrics');
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
  const [games, setGames] = useState<AdminGameItem[]>([
    {
      id: 'g_gen_dino',
      name: 'GEN DINO (Arcade Runner PIX)',
      category: 'Runner & Habilidade',
      status: 'active',
      minBet: 1.0,
      maxBet: 500.0,
      rtpPercent: 95.0,
      difficulty: 'medium',
      totalWagered: 245300.0,
      totalPayout: 233035.0,
      ggr: 12265.0,
      totalBetsCount: 6120,
      totalWinsCount: 5740,
      totalLossesCount: 380,
      effectiveRtp: 95.0,
      effectiveHouseEdge: 5.0,
      houseEdgeMode: 'balanced',
      maxMultiplier: 100.0
    },
    {
      id: 'g_block_puzzle',
      name: 'Block Win (Block Puzzle iGaming)',
      category: 'Estratégia & Habilidade',
      status: 'active',
      minBet: 1.0,
      maxBet: 500.0,
      rtpPercent: 96.0,
      difficulty: 'easy',
      totalWagered: 184200.0,
      totalPayout: 176832.0,
      ggr: 7368.0,
      totalBetsCount: 4210,
      totalWinsCount: 3950,
      totalLossesCount: 260,
      effectiveRtp: 96.0,
      effectiveHouseEdge: 4.0,
      houseEdgeMode: 'easy',
      maxMultiplier: 100.0
    },
    {
      id: 'g_zumbla',
      name: 'Zumbla Win (Marble Shooter)',
      category: 'Arcade & Pontaria',
      status: 'active',
      minBet: 1.0,
      maxBet: 500.0,
      rtpPercent: 95.0,
      difficulty: 'medium',
      totalWagered: 129400.0,
      totalPayout: 122930.0,
      ggr: 6470.0,
      totalBetsCount: 3100,
      totalWinsCount: 2890,
      totalLossesCount: 210,
      effectiveRtp: 95.0,
      effectiveHouseEdge: 5.0,
      houseEdgeMode: 'balanced',
      maxMultiplier: 100.0
    }
  ]);
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
  const handleCopyText = (text: string, label?: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedText(text);
      onShowToast(label ? `${label} copiado!` : 'Copiado para a área de transferência!', 'success');
      setTimeout(() => setCopiedText(null), 2000);
    } catch {
      onShowToast('Código: ' + text, 'info');
    }
  };

  // Initial Data Fetching
  useEffect(() => {
    if (!isAdmin) {
      onShowToast('Usuário bloqueado para essa ação.', 'error');
      const timer = setTimeout(() => {
        onClose();
      }, 2000);
      return () => clearTimeout(timer);
    }
    fetchMetrics();
    fetchUsers();
    fetchWithdrawals();
    fetchDeposits();
    fetchGames();
    fetchReports('7d');
    fetchAdmins();
  }, [token, isAdmin]);

  // Background polling for games when in games tab
  useEffect(() => {
    if (!isAdmin || activeTab !== 'games' || !token) return;
    const timer = window.setInterval(() => fetchGames(false), 8000);
    return () => window.clearInterval(timer);
  }, [activeTab, token, isAdmin]);

  // Master Refresh
  const handleRefreshAll = () => {
    if (!isAdmin) {
      onShowToast('Usuário bloqueado para essa ação.', 'error');
      onClose();
      return;
    }
    fetchMetrics();
    fetchUsers();
    fetchWithdrawals();
    fetchDeposits();
    fetchGames(true);
    fetchReports();
    fetchAdmins();
    onShowToast('Dados sincronizados em tempo real!', 'success');
  };

  // API: Fetch Metrics
  const fetchMetrics = async () => {
    if (!token) return;
    setLoadingMetrics(true);
    try {
      const res = await fetch('/api/admin/metrics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401 || res.status === 403) {
        onShowToast('Usuário bloqueado para essa ação.', 'error');
        onClose();
        return;
      }
      const data = await res.json();
      if (res.ok && data.metrics) {
        setMetrics(data.metrics);
      }
    } catch {
      // Keep existing data
    } finally {
      setLoadingMetrics(false);
    }
  };

  // API: Fetch Users
  const fetchUsers = async () => {
    if (!token) return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch {
      onShowToast('Erro ao listar usuários.', 'error');
    } finally {
      setLoadingUsers(false);
    }
  };

  // API: Fetch Withdrawals
  const fetchWithdrawals = async () => {
    if (!token) return;
    setLoadingWithdrawals(true);
    try {
      const res = await fetch('/api/admin/withdrawals', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.withdrawals)) {
        setWithdrawals(data.withdrawals);
      }
    } catch {
      onShowToast('Erro de rede ao buscar saques.', 'error');
    } finally {
      setLoadingWithdrawals(false);
    }
  };

  // API: Fetch Deposits
  const fetchDeposits = async () => {
    if (!token) return;
    setLoadingDeposits(true);
    try {
      const res = await fetch('/api/admin/deposits', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.deposits)) {
        setDeposits(data.deposits);
      }
    } catch {
      // silent fallback
    } finally {
      setLoadingDeposits(false);
    }
  };

  // API: Fetch Games
  const fetchGames = async (showToast = false) => {
    if (!token) return;
    if (showToast) setLoadingGames(true);
    try {
      const res = await fetch('/api/admin/games', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.games)) {
        setGames((prev) => {
          if (!prev || prev.length === 0) return data.games;
          return data.games.map((serverGame: AdminGameItem) => {
            const localGame = prev.find((g) => g.id === serverGame.id);
            if (!localGame) return serverGame;
            return {
              ...serverGame,
              rtpPercent: localGame.rtpPercent,
              difficulty: localGame.difficulty,
              minBet: localGame.minBet,
              maxBet: localGame.maxBet,
              houseEdgeMode: localGame.houseEdgeMode,
              maxMultiplier: localGame.maxMultiplier
            };
          });
        });
        setLastGamesUpdated(new Date().toLocaleTimeString('pt-BR'));
      }
    } catch {
      // silent
    } finally {
      if (showToast) setLoadingGames(false);
    }
  };

  // API: Fetch Reports
  const fetchReports = async (period?: string) => {
    if (!token) return;
    setLoadingReports(true);
    try {
      const p = period || reportPeriod;
      const res = await fetch(`/api/admin/reports/analytics?period=${p}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReportData(data);
      }
    } catch {
      // silent
    } finally {
      setLoadingReports(false);
    }
  };

  // API: Fetch Admins
  const fetchAdmins = async () => {
    if (!token) return;
    setLoadingAdmins(true);
    try {
      const res = await fetch('/api/admin/admins', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.admins)) {
        setAdminsList(data.admins);
      }
    } catch {
      // silent
    } finally {
      setLoadingAdmins(false);
    }
  };

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
          cpaKillerKillY: payload.cpaKillerKillY
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

  // API: Approve Withdrawal
  const handleApproveWithdrawal = async (id: string) => {
    if (!token) return;
    setProcessingWithdrawalId(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(data.message || 'Saque aprovado e liquidado via PIX!', 'success');
        setWithdrawals((prev) =>
          prev.map((w) => (w.id === id ? { ...w, status: 'approved' } : w))
        );
        fetchMetrics();
      } else {
        onShowToast(data.error || 'Erro ao aprovar saque.', 'error');
      }
    } catch {
      onShowToast('Erro de rede ao aprovar saque.', 'error');
    } finally {
      setProcessingWithdrawalId(null);
    }
  };

  // API: Reject Withdrawal
  const handleRejectWithdrawal = async (id: string) => {
    if (!token) return;
    const reason = prompt('Informe o motivo da rejeição do saque (opcional):') || 'Rejeitado pela administração';
    setProcessingWithdrawalId(id);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (res.ok) {
        onShowToast(data.message || 'Saque rejeitado e saldo estornado!', 'success');
        setWithdrawals((prev) =>
          prev.map((w) => (w.id === id ? { ...w, status: 'rejected' } : w))
        );
        fetchMetrics();
      } else {
        onShowToast(data.error || 'Erro ao rejeitar saque.', 'error');
      }
    } catch {
      onShowToast('Erro de rede.', 'error');
    } finally {
      setProcessingWithdrawalId(null);
    }
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
        onShowToast('Parâmetros e RTP do jogo sincronizados ao vivo!', 'success');
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
  const handleSendNotification = async (payload: { title: string; message: string; target: string }) => {
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
          target: payload.target
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
    metrics: {
      label: 'Visão Geral',
      desc: 'Indicadores financeiros consolidados, margem líquida e liquidez'
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
      desc: 'Inteligência analítica, DRE contábil e extratos transacionais'
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
    security: {
      label: 'Logs do Sistema',
      desc: 'Monitoramento de integridade, webhooks PIX e anti-cheat'
    }
  };

  if (!isAdmin) {
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
    <div className="fixed inset-0 z-50 bg-[#F2F2F7] flex overflow-hidden font-sans text-slate-900 select-none">
      {/* 1. iOS Authentic Sidebar */}
      <AdminSidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
        pendingWithdrawalsCount={pendingWithdrawalsCount}
        adminEmail={currentUser.email}
        adminPermissions={currentUser.adminPermissions}
        onCloseAdmin={onClose}
      />

      {/* 2. Main Content Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F2F2F7]">
        {/* iOS Styled Top Navigation Bar */}
        <AdminHeader
          activeTab={activeTab}
          tabLabel={tabTitles[activeTab].label}
          tabDescription={tabTitles[activeTab].desc}
          searchQuery={globalSearchQuery}
          onSearchChange={setGlobalSearchQuery}
          pendingWithdrawalsCount={pendingWithdrawalsCount}
          loadingMetrics={loadingMetrics}
          onRefresh={handleRefreshAll}
          onClose={onClose}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenNotifications={() => setActiveTab('notifications')}
          onOpenMigrationModal={() => setMigrationModalOpen(true)}
        />

        {/* Dynamic Tab Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-8">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'metrics' && (
              <AdminMetricsTab
                metrics={metrics}
                loading={loadingMetrics}
                onNavigateTab={setActiveTab}
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
                onOpenCommissionModal={setSelectedAffiliateForCommission}
                onOpenNetworkModal={setViewingAffiliateNetwork}
                onCopyText={handleCopyText}
                copiedText={copiedText}
              />
            )}

            {activeTab === 'withdrawals' && (
              <AdminWithdrawalsTab
                withdrawals={withdrawals}
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
                onShowToast={onShowToast}
              />
            )}

            {activeTab === 'security' && (
              <AdminSecurityTab
                onOpenMigrationModal={() => setMigrationModalOpen(true)}
              />
            )}
          </div>
        </main>
      </div>

      {/* 3. iOS Authentic Mobile Bottom Tab Bar */}
      <AdminMobileTabBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        pendingWithdrawalsCount={pendingWithdrawalsCount}
      />

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
