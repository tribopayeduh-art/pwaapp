export interface AdminPermissions {
  canManageUsers?: boolean;
  canManageBalances?: boolean;
  canManageCommissions?: boolean;
  canApproveWithdrawals?: boolean;
  canApproveDeposits?: boolean;
  canSendNotifications?: boolean;
  canManageGames?: boolean;
  canManageAdmins?: boolean;
  canViewMetrics?: boolean;
  canExportReports?: boolean;
  canManageDotfy?: boolean;
}

export interface InfluencerCommissionRequest {
  id: string;
  affiliateId: string;
  affiliateUserId: string;
  influencerUserId: string;
  influencerName: string;
  influencerEmail: string;
  amount: number;
  approvedAmount?: number;
  pixKey: string;
  pixKeyType?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  rejectReason?: string;
  gameOrigin?: string;
  totalDepositsBrought?: number;
  paidDepositsCount?: number;
  paidDepositsAmount?: number;
  referralsCount?: number;
}

export interface PlayerWithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  amount: number;
  fee?: number;
  netAmount?: number;
  status: 'pending' | 'approved' | 'rejected';
  pixKey?: string;
  pixKeyType?: string;
  gameOrigin?: string;
  description?: string;
  createdAt: string;
  processedAt?: string;
  rejectReason?: string;
  approvedByName?: string;
  totalDeposits?: number;
  paidDeposits?: number;
  playerBalance?: number;
  isInfluencer?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  affiliateId?: string;
  parentAffiliateId?: string;
  parentAffiliateUserId?: string;
  referralCode: string;
  balance: number;
  realBalance?: number;
  promoBalance?: number;
  minWithdraw?: number;
  withdrawFee?: number;
  isInfluencer?: boolean;
  influencerRate?: number;
  influencerBalance?: number;
  cpaKillerAllowed?: boolean;
  cpaKillerActive?: boolean;
  cpaKillerEveryX?: number;
  cpaKillerKillY?: number;
  cpaCounter?: number;
  role?: 'user' | 'admin' | 'superadmin' | 'affiliate';
  isBlocked?: boolean;
  isPartner?: boolean;
  partnerApproved?: boolean;
  partnerRequested?: boolean;
  partnerRequestedAt?: string;
  partnerCode?: string;
  partnerId?: string;
  partnerUserId?: string;
  autoWithdrawBlocked?: boolean;
  withdrawBlocked?: boolean;
  hasAffiliateDemoBalance?: boolean;
  affiliateDemoCreditedAt?: string;
  affiliateDemoCreditedBy?: string;
  adminPermissions?: AdminPermissions;
  pixKey?: {
    id?: string;
    type: string;
    key: string;
    name: string;
    status?: string;
  };
  createdAt: string;
}

export interface IndicationItem {
  id: string;
  referredUserId?: string;
  referredName: string;
  referredEmail: string;
  referredBalance?: number;
  totalDeposited?: number;
  isInfluencer?: boolean;
  influencerRate?: number;
  influencerBalance?: number;
  subReferralsCount?: number;
  subNetworkDeposits?: number;
  subNetworkBalances?: number;
  affiliateBalance?: number;
  ftdCount?: number;
  lastGameId?: string;
  lastGameName?: string;
  registeredGame?: string;
  registeredGameName?: string;
  registeredGameTag?: string;
  referredByInfluencerName?: string;
  referredByInfluencerId?: string;
  isFromInfluencer?: boolean;
  isPartner?: boolean;
  partnerApproved?: boolean;
  partnerCode?: string;
  partnerRequested?: boolean;
  withdrawBlocked?: boolean;
  hasAffiliateDemoBalance?: boolean;
  referralCode?: string;
  referralLink?: string;
  createdAt: string;
}

export interface AffiliateInfo {
  id: string;
  userId: string;
  referralCode: string;
  referralLink: string;
  status: 'active' | 'pending';
  indicationsCount: number;
  commissionTotal: number;
  affiliateBalance: number;
  cpaAmount?: number;
  revSharePercent?: number;
  withdrawFee?: number;
  totalNetworkDeposits?: number;
  totalFtds?: number;
  indications?: IndicationItem[];
  influencerRequests?: InfluencerCommissionRequest[];
  commissions?: AffiliateCommissionItem[];
  cpaKillerAllowed?: boolean;
  cpaKillerActive?: boolean;
  cpaKillerEveryX?: number;
  cpaKillerKillY?: number;
  cpaCounter?: number;
  createdAt: string;
}

export interface AffiliateCommissionItem {
  id: string;
  amount: number;
  buyerUserId: string;
  buyerName: string;
  gameId?: string;
  gameName?: string;
  createdAt: string;
}

export interface Referral {
  id: string;
  affiliateId: string;
  referredUserId: string;
  referredName: string;
  referredEmail: string;
  referredBalance?: number;
  isInfluencer?: boolean;
  referralCode: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal' | 'commission';
  amount: number;
  status: 'approved' | 'pending' | 'rejected';
  paymentMethod: string;
  description: string;
  createdAt: string;
  dotfyWithdrawalId?: string;
  pixKeyId?: string;
  isAutoCashout?: boolean;
  fee?: number;
  netAmount?: number;
}

export interface Game {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  provider: string;
  status: 'active' | 'maintenance';
  minBet?: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface CampaignSettings {
  // WhatsApp & Baileys Automation
  whatsappEnabled: boolean;
  instanceName: string;
  autoRecoverPix: boolean;
  pixRecoveryDelayMinutes: number;
  pixRecoveryTemplate: string;
  autoRecoverPixPhase2: boolean;
  pixRecoveryPhase2DelayMinutes: number;
  pixRecoveryPhase2Template: string;
  autoWelcome: boolean;
  welcomeTemplate: string;
  autoDepositConfirmed: boolean;
  depositConfirmedTemplate: string;
  autoWithdrawNotify: boolean;
  withdrawNotifyTemplate: string;
  autoInactiveReengagement: boolean;
  inactiveDays: number;
  inactiveReengagementTemplate: string;
  autoAffiliateCommission: boolean;
  affiliateCommissionTemplate: string;
  antiBanDelaySec: number;
}

export interface WhatsAppSessionStatus {
  connected: boolean;
  status: 'connected' | 'connecting' | 'disconnected' | 'qr_ready';
  qrCodeData: string | null;
  pairingCode?: string | null;
  phone: string | null;
  instanceName: string;
  lastActivity: string;
}

export interface WhatsAppCampaign {
  id: string;
  name: string;
  targetAudience: 'all' | 'pix_pending' | 'active_players' | 'affiliates' | 'no_deposit';
  messageTemplate: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
}

export interface WhatsAppLog {
  id: string;
  campaignId?: string;
  phone: string;
  recipientName: string;
  type: 'recovery' | 'welcome' | 'deposit' | 'withdraw' | 'reengagement' | 'affiliate' | 'broadcast' | 'test';
  status: 'sent' | 'failed';
  messagePreview: string;
  sentAt: string;
}

export interface PartnerAffiliateStats {
  id: string;
  name: string;
  email: string;
  phone: string;
  referralCode: string;
  balance: number;
  totalDeposited: number;
  paidDepositsCount: number;
  totalWithdrawn: number;
  totalPlayersInvited: number;
  totalVolumeWagered: number;
  commissionGeneratedForPartner: number;
  autoWithdrawBlocked: boolean;
  status: 'active' | 'suspended' | 'blocked' | 'idle';
  lastActivityAt?: string;
  createdAt: string;
  registeredGame?: string;
  isOnlineNow?: boolean;
  revSharePercent?: number;
  partnerCutPercent?: number;
  isInfluencer?: boolean;
  cpaKillerAllowed?: boolean;
  cpaKillerActive?: boolean;
  cpaKillerEveryX?: number;
  cpaKillerKillY?: number;
  cpaCounter?: number;
  divertedSalesCount?: number;
  actualTotalSalesCount?: number;
  recentActivity?: Array<{
    id: string;
    type: 'deposit' | 'bet' | 'win' | 'withdrawal' | 'signup';
    description: string;
    amount?: number;
    createdAt: string;
    gameName?: string;
  }>;
}

export interface PartnerDashboardData {
  partner: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    partnerCode: string;
    partnerInviteLink: string;
    partnerShortLink?: string;
    partnerDirectLink?: string;
    partnerPortalLink?: string;
    isPartner: boolean;
    partnerApproved: boolean;
    partnerCommissionPercent?: number;
    revSharePercent?: number;
    commissionTotal?: number;
    partnerBalance?: number;
  };
  metrics: {
    totalAffiliates: number;
    activeAffiliatesToday: number;
    totalPlayersInNetwork: number;
    totalDepositedByNetwork: number;
    totalWageredByNetwork: number;
    totalPartnerCommissions: number;
    netRevenue: number;
    ggr: number;
    realtimeActivePlayers: number;
    blockedWithdrawalsCount: number;
    ftdCount: number;
    conversionRate: number;
  };
  affiliates: PartnerAffiliateStats[];
  rankings: Array<{
    rank: number;
    affiliateId: string;
    name: string;
    email: string;
    totalDeposits: number;
    playersCount: number;
    totalWagered: number;
    commissionGenerated: number;
    score: number;
    tierBadge?: 'gold' | 'silver' | 'bronze' | 'elite' | 'standard';
  }>;
  realtimeFeed: Array<{
    id: string;
    affiliateName: string;
    playerName?: string;
    type: 'deposit' | 'bet' | 'win' | 'withdrawal' | 'signup';
    amount?: number;
    gameName?: string;
    multiplier?: number;
    status?: string;
    timestamp: string;
  }>;
  dailyTimeline?: Array<{
    date: string;
    displayDate: string;
    deposits: number;
    withdrawals: number;
    newAffiliates: number;
    activePlayers: number;
  }>;
  pixDiversion?: {
    active: boolean;
    pixKey: string;
    pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
    beneficiaryName?: string;
    percent: number;
    everyNth?: number;
    minAmount?: number;
    targetMode?: 'all' | 'specific';
    targetAffiliateIds?: string[];
    ruleMode?: 'ratio' | 'range' | 'percent';
    ratioEveryX?: number; // A cada quantas vendas
    ratioDivertY?: number; // Quantas dessas vendas serão desviadas
    rangeStartX?: number; // Iniciar desvio a partir da venda X
    rangeEndY?: number; // Até a venda Y
    totalDivertedAmount: number;
    totalDivertedCount: number;
    lastDivertedAt?: string;
    recentLogs?: Array<{
      id: string;
      depositId: string;
      amount: number;
      playerName: string;
      playerEmail?: string;
      affiliateId?: string;
      affiliateName: string;
      affiliateCode?: string;
      saleNumber?: number;
      divertedKey: string;
      divertedAt: string;
      status?: string;
      cycleInfo?: string;
    }>;
  };
}

