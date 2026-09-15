import { AdminPermissions } from '../../types';

export interface AdminMetrics {
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
    deposits: number;
    withdrawals: number;
    netBalance: number;
  }>;
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
  adminPermissions: AdminPermissions;
  createdAt: string;
  pixKeys?: any[];
  totalDeposited?: number;
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

export type AdminTabId =
  | 'metrics'
  | 'users'
  | 'withdrawals'
  | 'deposits'
  | 'games'
  | 'reports'
  | 'notifications'
  | 'admins'
  | 'dotfy'
  | 'security';
