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

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  affiliateId?: string;
  referralCode: string;
  balance: number;
  realBalance?: number;
  promoBalance?: number;
  minWithdraw?: number;
  withdrawFee?: number;
  isInfluencer?: boolean;
  cpaKillerAllowed?: boolean;
  cpaKillerActive?: boolean;
  cpaKillerEveryX?: number;
  cpaKillerKillY?: number;
  cpaCounter?: number;
  role?: 'user' | 'admin' | 'superadmin' | 'affiliate';
  isBlocked?: boolean;
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
  subReferralsCount?: number;
  subNetworkDeposits?: number;
  subNetworkBalances?: number;
  affiliateBalance?: number;
  ftdCount?: number;
  lastGameId?: string;
  lastGameName?: string;
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
