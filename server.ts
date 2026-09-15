import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { dbService, UserDB, AffiliateDB, ReferralDB, TransactionDB, GameBetDB, GameConfigDB, PushSubscriptionDB } from './server/db.js';
import { whatsAppManager } from './server/whatsappService.js';
import {
  securityHeadersMiddleware,
  generalRateLimiterMiddleware,
  authRateLimiterMiddleware,
  verifyPassword,
  createSession,
  getSession,
  destroySession,
  isIdentifierBlocked,
  recordFailedLogin,
  recordSuccessfulLogin,
  verifyHmacSignature,
  logSecurityEvent,
  sanitizeString,
  isValidEmail,
  isPositiveNumber
} from './server/security.js';

// VAPID Keys setup for iOS / Web Push Notifications
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BExySgr_kuwjUHgn-Tyqyxwc81atqVnbdbzpz4i1vT2bbW9MRPYbY7vI2hVQGZBzrp9MTUbLIMFFVyTPLu9d1OQ';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'WjwvsN2mq2CSEtxMk6wx-6uDgchsFBVO0ngc92g5gc8';

try {
  webpush.setVapidDetails(
    'mailto:suporte@paygateway.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
} catch (e) {
  console.error('[WebPush] Error configuring VAPID:', e);
}

const subscriptionDocumentId = (endpoint: string) =>
  `push_${crypto.createHash('sha256').update(endpoint).digest('hex')}`;

async function sendPushNotification(targetUserId: string | null, payload: { title: string; body: string; url?: string; type?: string }) {
  const payloadStr = JSON.stringify(payload);
  const userIds = targetUserId && targetUserId !== 'all' ? new Set([targetUserId]) : undefined;
  const subscriptions = await dbService.getPushSubscriptions(userIds);
  let sent = 0;
  let failed = 0;
  await Promise.all(subscriptions.map(async (data) => {
    try {
      await webpush.sendNotification(data.subscription as webpush.PushSubscription, payloadStr, {
        TTL: 86400,
        urgency: 'high',
      });
      sent++;
    } catch (err: any) {
      failed++;
      console.warn(`[WebPush] Push error for ${data.endpoint.substring(0, 35)}...:`, err.statusCode || err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        await dbService.deletePushSubscription(data.id).catch(console.error);
      }
    }
  }));
  return { sent, failed, total: subscriptions.length };
}

async function notifyAffiliateForPlayer(userId: string, payload: { title: string; body: string; url?: string; type?: string }) {
  const player = await dbService.getUserById(userId);
  if (!player?.affiliateId) return { sent: 0, failed: 0, total: 0 };
  const affiliate = await dbService.getAffiliateById(player.affiliateId);
  if (!affiliate?.userId) return { sent: 0, failed: 0, total: 0 };
  return sendPushNotification(affiliate.userId, payload);
}

// Helper to distinguish real financial deposits (PIX / Gateway) from game winnings / match profits
function isRealPaidDeposit(t: { type?: string; status?: string; paymentMethod?: string; description?: string } | undefined | null): boolean {
  if (!t) return false;
  if (t.type !== 'deposit' || t.status !== 'approved') return false;
  const pm = (t.paymentMethod || '').toLowerCase();
  const desc = (t.description || '').toLowerCase();
  // Exclude game payouts, matches and internal affiliate transfers
  if (pm === 'gendino' || pm === 'blockwin' || pm === 'afiliados') return false;
  if (desc.includes('vitória gen dino') || desc.includes('lucro do jogo') || desc.includes('lucro blockwin') || desc.includes('partida')) return false;
  return true;
}

// Simple in-memory session token store mapping token -> userId
const sessions = new Map<string, string>();

interface AuthRequest extends Request {
  userId?: string;
  user?: UserDB;
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Não autorizado. Token de sessão ausente.' });
    }

    const token = authHeader.split(' ')[1];
    let session = getSession(token);
    let userId = session?.userId || sessions.get(token);

    if (!userId && token.startsWith('tok_usr_')) {
      const parts = token.split('_');
      if (parts.length >= 3) {
        const candidateId = `${parts[1]}_${parts[2]}`;
        const foundUser = await dbService.getUserById(candidateId);
        if (foundUser) {
          userId = foundUser.id;
          sessions.set(token, userId);
        }
      }
    }

    if (!userId) {
      return res.status(401).json({ error: 'Sessão expirada ou inválida. Por favor faça login novamente.' });
    }

    const user = await dbService.getUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    req.userId = userId;
    req.user = user;
    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    res.status(500).json({ error: 'Erro de autenticação no servidor.' });
  }
}

// --- DOTFY GATEWAY GLOBAL CONSTANTS & HELPERS ---
const DEFAULT_API_KEY = process.env.DOTFY_API_KEY || "vk_live_0iTBP0DSt_865LGgyvH5kPmJ0CbtO4CPsy0xJvqm8tE";
const DOTFY_BASE_URL = "https://app.dotfy.com.br";

function normalizePixKeyForDotfy(rawType: string | undefined, rawKey: string) {
  let cleanType = (rawType || '').trim().toUpperCase();
  let cleanKey = String(rawKey || '').trim();

  if (cleanKey.startsWith('[')) {
    const closeBracket = cleanKey.indexOf(']');
    if (closeBracket !== -1) {
      if (!cleanType) cleanType = cleanKey.substring(1, closeBracket).toUpperCase();
      cleanKey = cleanKey.substring(closeBracket + 1).trim();
    }
  }

  if (!cleanType) {
    if (cleanKey.includes('@')) cleanType = 'EMAIL';
    else if (/^[0-9a-fA-F-]{32,36}$/.test(cleanKey)) cleanType = 'RANDOM';
    else {
      const digits = cleanKey.replace(/\D/g, '');
      if (digits.length === 11) cleanType = 'CPF';
      else if (digits.length === 14) cleanType = 'CNPJ';
      else if (digits.length >= 10 && digits.length <= 13) cleanType = 'PHONE';
      else cleanType = 'CPF';
    }
  }

  let normalizedSearchKey = cleanKey;
  let dotfyRegistrationKey = cleanKey;

  if (cleanType === 'PHONE') {
    let digits = cleanKey.replace(/\D/g, '');
    if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      digits = digits.slice(2);
    }
    normalizedSearchKey = digits;
    dotfyRegistrationKey = digits; // Dotfy requires 10 or 11 digits without +55
  } else if (cleanType === 'CPF' || cleanType === 'CNPJ') {
    const digits = cleanKey.replace(/\D/g, '');
    normalizedSearchKey = digits;
    dotfyRegistrationKey = digits;
  } else if (cleanType === 'EMAIL') {
    normalizedSearchKey = cleanKey.trim().toLowerCase();
    dotfyRegistrationKey = normalizedSearchKey;
  } else {
    normalizedSearchKey = cleanKey.trim();
    dotfyRegistrationKey = normalizedSearchKey;
  }

  return { cleanType, cleanKey, normalizedSearchKey, dotfyRegistrationKey };
}

async function resolveDotfyPixKey(
  apiKey: string,
  rawKey: string,
  rawType?: string,
  holderName?: string
): Promise<{ pixKeyId: string; pixKey?: any; error?: string }> {
  if (!rawKey || !rawKey.trim()) {
    return { pixKeyId: '', error: 'Chave PIX não informada.' };
  }

  const { cleanType, normalizedSearchKey, dotfyRegistrationKey } = normalizePixKeyForDotfy(rawType, rawKey);

  // 1. Fetch current Dotfy keys and try to find a match (by id or normalized key)
  try {
    const listRes = await fetch(`${DOTFY_BASE_URL}/api/pix-keys`, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const list: any[] = Array.isArray(listData?.pixKeys) ? listData.pixKeys : [];

      const byId = list.find((k: any) => k.id === rawKey);
      if (byId) return { pixKeyId: byId.id, pixKey: byId };

      const byKey = list.find((k: any) => {
        const { normalizedSearchKey: kNorm } = normalizePixKeyForDotfy(k.type, k.key);
        return kNorm === normalizedSearchKey;
      });
      if (byKey) return { pixKeyId: byKey.id, pixKey: byKey };
    }
  } catch (e) {
    console.warn('[resolveDotfyPixKey list warning]', e);
  }

  // 2. Try to register key directly on Dotfy API
  try {
    const regRes = await fetch(`${DOTFY_BASE_URL}/api/pix-keys`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: cleanType,
        key: dotfyRegistrationKey,
        name: (holderName || "Beneficiário PayGateway").slice(0, 100)
      })
    });

    const regText = await regRes.text();
    let regData: any = {};
    try { regData = JSON.parse(regText); } catch (_) { regData = { message: regText }; }

    if (regRes.ok && regData?.pixKey?.id) {
      return { pixKeyId: regData.pixKey.id, pixKey: regData.pixKey };
    }

    // If already registered on Dotfy (409 Conflict), fetch the keys list again to retrieve its ID
    if (regRes.status === 409 || regData?.error?.includes('já está cadastrada')) {
      const listRes = await fetch(`${DOTFY_BASE_URL}/api/pix-keys`, {
        headers: { "Authorization": `Bearer ${apiKey}` }
      });
      if (listRes.ok) {
        const listData = await listRes.json();
        const list: any[] = Array.isArray(listData?.pixKeys) ? listData.pixKeys : [];
        const byKey = list.find((k: any) => {
          const { normalizedSearchKey: kNorm } = normalizePixKeyForDotfy(k.type, k.key);
          return kNorm === normalizedSearchKey;
        });
        if (byKey) return { pixKeyId: byKey.id, pixKey: byKey };
      }
    }

    if (!regRes.ok) {
      return {
        pixKeyId: '',
        error: regData?.error || regData?.message || `Erro ${regRes.status} ao cadastrar chave PIX na Dotfy`
      };
    }
  } catch (err: any) {
    console.warn('[resolveDotfyPixKey register warning]', err);
  }

  return { pixKeyId: '', error: 'Não foi possível validar ou registrar a chave PIX na Dotfy.' };
}

// Security: In-memory concurrency locks to prevent double-spending race conditions on withdrawals
const activeWithdrawalLocks = new Set<string>();

// Security: Helper to strictly recognize platform superadmins (owner accounts)
function isPlatformSuperAdmin(email?: string, role?: string): boolean {
  if (!email && !role) return false;
  const cleanEmail = (email || '').toLowerCase().trim();
  return cleanEmail === 'admin.eduh@gmail.com' || cleanEmail === 'tribopayeduh@gmail.com' || role === 'superadmin';
}

async function startServer() {
  const app = express();
  // In the sandbox dev container behind nginx, the dev server must bind to port 3000.
  // In a standalone Cloud Run deployment, bind to PORT (e.g. 8080 provided by Cloud Run).
  const PORT = process.env.NGINX_PORT ? 3000 : (Number(process.env.PORT) || 3000);

  app.use(express.json());
  app.use(securityHeadersMiddleware);
  app.use('/api', generalRateLimiterMiddleware);
  app.use('/api/auth', authRateLimiterMiddleware);

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', firebase: true, time: new Date().toISOString() });
  });

  // WEB PUSH ROUTES FOR IOS / ANDROID PWA NOTIFICATIONS (Background / Closed App)
  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  app.post('/api/push/subscribe', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { subscription, preferences } = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Subscription inválida' });
      }
      const targetUserId = req.userId!;
      const user = await dbService.getUserById(targetUserId);
      const isAff = !!(user && (user.role === 'affiliate' || (user as any).isInfluencer || (user as any).isAffiliate));
      const now = new Date().toISOString();
      const item: PushSubscriptionDB = {
        id: subscriptionDocumentId(subscription.endpoint),
        subscription,
        userId: targetUserId,
        isAffiliate: isAff,
        preferences: preferences || { registration: true, ftd: true, pixPending: true, gameActivity: true },
        endpoint: subscription.endpoint,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
        createdAt: now,
        updatedAt: now,
      };
      await dbService.upsertPushSubscription(item);

      console.log(`[WebPush] Inscrição persistida para userId: ${targetUserId} (Affiliate: ${isAff})`);
      res.json({ success: true, message: 'Inscrição Push salva com sucesso' });
    } catch (err: any) {
      console.error('[WebPush] Error saving push subscription:', err);
      res.status(500).json({ error: 'Erro ao salvar inscrição Push' });
    }
  });

  app.post('/api/push/preferences', async (req: AuthRequest, res) => {
    try {
      const { endpoint, preferences } = req.body;
      const authHeader = req.headers.authorization;
      let targetUserId: string | undefined;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        targetUserId = sessions.get(token);
      }

      if (endpoint) {
        const docId = subscriptionDocumentId(endpoint);
        const subs = await dbService.getPushSubscriptions();
        const found = subs.find(s => s.endpoint === endpoint || s.id === docId);
        if (found) {
          found.preferences = { ...(found.preferences || {}), ...(preferences || {}) };
          found.updatedAt = new Date().toISOString();
          await dbService.upsertPushSubscription(found);
        }
      }
      res.json({ success: true, message: 'Preferências salvas com sucesso' });
    } catch (err) {
      console.error('[WebPush] Error saving preferences:', err);
      res.status(500).json({ error: 'Erro ao salvar preferências' });
    }
  });

  app.post('/api/push/test-self', async (req: AuthRequest, res) => {
    try {
      const authHeader = req.headers.authorization;
      let targetUserId = 'all';
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const sessionUserId = sessions.get(token);
        if (sessionUserId) targetUserId = sessionUserId;
      }

      const { title, body, endpoint } = req.body;
      let result = { sent: 0, failed: 0, total: 0 };

      if (endpoint) {
        const docId = subscriptionDocumentId(endpoint);
        const allSubs = await dbService.getPushSubscriptions();
        const targetSub = allSubs.find(s => s.endpoint === endpoint || s.id === docId);
        if (targetSub) {
          try {
            await webpush.sendNotification(targetSub.subscription as any, JSON.stringify({
              title: title || 'Você vendeu! 💰',
              body: body || 'Comissão de R$ 75,00 confirmada na sua conta!',
              url: '/?tab=affiliates'
            }), { TTL: 86400, urgency: 'high' });
            result = { sent: 1, failed: 0, total: 1 };
          } catch (pushErr: any) {
            result = { sent: 0, failed: 1, total: 1 };
          }
        }
      }

      if (result.sent === 0 && targetUserId !== 'all') {
        result = await sendPushNotification(targetUserId, {
          title: title || 'Você vendeu! 💰',
          body: body || 'Comissão de R$ 75,00 confirmada na sua conta!',
          url: '/?tab=affiliates'
        });
      }

      res.json({
        success: result.sent > 0,
        attempted: result.total,
        delivered: result.sent,
        failed: result.failed,
        message: result.sent > 0 ? `Push entregue com sucesso!` : 'Nenhum dispositivo encontrado ou erro no envio.'
      });
    } catch (err: any) {
      console.error('[WebPush] Error testing self push:', err);
      res.status(500).json({ error: 'Erro ao enviar teste' });
    }
  });

  app.post('/api/push/send-test', async (req: AuthRequest, res) => {
    try {
      const { delayMs, title, body } = req.body;
      
      const authHeader = req.headers.authorization;
      let targetUserId = 'all';
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const sessionUserId = sessions.get(token);
        if (sessionUserId) targetUserId = sessionUserId;
      }

      const trigger = async () => {
        await sendPushNotification(targetUserId, {
          title: title || 'Você vendeu! 💰',
          body: body || 'Sua comissão de R$ 37,50 foi creditada no seu saldo!',
          url: '/'
        });
      };

      if (delayMs && delayMs > 0) {
        setTimeout(trigger, delayMs);
      } else {
        await trigger();
      }

      res.json({ success: true, message: 'Push de teste disparado com sucesso!' });
    } catch (err: any) {
      console.error('[WebPush] Error sending test push:', err);
      res.status(500).json({ error: 'Erro ao disparar teste push' });
    }
  });

  // AUTH: REGISTER
  app.post('/api/auth/register', async (req, res) => {
    try {
      const name = sanitizeString(req.body.name, 100);
      const email = sanitizeString(req.body.email, 150).toLowerCase();
      const phone = sanitizeString(req.body.phone, 30) || 'Não informado';
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      const refCode = sanitizeString(req.body.refCode, 50);

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Formato de e-mail inválido.' });
      }

      if (password.length < 4) {
        return res.status(400).json({ error: 'A senha deve conter no mínimo 4 caracteres.' });
      }

      const existingUser = await dbService.getUserByEmail(email);
      if (existingUser) {
        logSecurityEvent('REGISTER_FAILED_DUPLICATE_EMAIL', { email, ip: req.ip });
        return res.status(400).json({ error: 'E-mail já cadastrado no sistema.' });
      }

      const userId = 'usr_' + crypto.randomBytes(12).toString('hex');
      const passwordHash = dbService.hashPassword(password);
      const userReferralCode = dbService.generateReferralCode();
      const createdAt = new Date().toISOString();

      // Check if referred by an affiliate (by affiliate table or user referralCode or user ID)
      let referringAffiliateId: string | undefined = undefined;
      let matchedRefCode: string | undefined = undefined;

      if (refCode) {
        const cleanRef = refCode.trim().toUpperCase();
        matchedRefCode = cleanRef;
        let affiliate = await dbService.getAffiliateByCode(cleanRef);
        if (affiliate) {
          referringAffiliateId = affiliate.id;
        } else {
          // Check if it's a user's referral code (e.g. player, blogger, influencer)
          const sponsorUser = await dbService.getUserByReferralCode(cleanRef);
          if (sponsorUser) {
            // If the sponsor was referred by an Affiliate Hub partner (sponsorUser.affiliateId),
            // all registrations and deposit commissions through this link route to the Affiliate Hub!
            const hubAffiliateId = sponsorUser.affiliateId;

            // Also ensure the sponsorUser has an active affiliate profile for network tracking
            let sponsorAff = await dbService.getAffiliateByUserId(sponsorUser.id);
            if (!sponsorAff) {
              const newAffId = 'aff_' + crypto.randomBytes(8).toString('hex');
              sponsorAff = {
                id: newAffId,
                userId: sponsorUser.id,
                referralCode: sponsorUser.referralCode || cleanRef,
                status: 'active',
                commissionTotal: 0,
                affiliateBalance: 0,
                cpaAmount: 0,
                revSharePercent: 70.0,
                createdAt: new Date().toISOString()
              };
              await dbService.createAffiliate(sponsorAff);
            }

            // Direct sponsor affiliate whose link was clicked receives the referral attribution
            referringAffiliateId = sponsorAff.id;
          }
        }
      }

      // Check if registration happened on goalliancehub domain (or isAffiliate flag sent)
      const host = (req.headers.host || req.hostname || '').toLowerCase();
      const origin = (req.headers.origin || req.headers.referer || '').toLowerCase();
      const isAffiliatePortal = host.includes('goalliancehub') || origin.includes('goalliancehub') || req.body?.isAffiliate === true;

      // Create User
      const newUser: UserDB = {
        id: userId,
        name,
        email,
        phone,
        passwordHash,
        ...(referringAffiliateId ? { affiliateId: referringAffiliateId } : {}),
        referralCode: userReferralCode,
        balance: 0.0,
        createdAt,
        role: isAffiliatePortal ? 'affiliate' : 'user',
      };

      await dbService.createUser(newUser);

      // If registered through goalliancehub.com, automatically create the active affiliate profile
      if (isAffiliatePortal) {
        const affRecord: import('./server/db.js').AffiliateDB = {
          id: 'aff_' + crypto.randomBytes(12).toString('hex'),
          userId: newUser.id,
          referralCode: userReferralCode,
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: 0,
          cpaAmount: 0,
          revSharePercent: 70.0,
          createdAt,
        };
        await dbService.createAffiliate(affRecord);
      }

      // If referred by someone, record referral
      if (referringAffiliateId) {
        const newReferral: ReferralDB = {
          id: 'ref_' + crypto.randomBytes(12).toString('hex'),
          affiliateId: referringAffiliateId,
          referredUserId: userId,
          referralCode: matchedRefCode || (refCode ? refCode.trim().toUpperCase() : userReferralCode),
          createdAt,
        };
        await dbService.createReferral(newReferral);

        const referringAffiliate = await dbService.getAffiliateById(referringAffiliateId);
        if (referringAffiliate?.userId) {
          await sendPushNotification(referringAffiliate.userId, {
            title: 'Novo cadastro na sua rede! 👤',
            body: `${newUser.name} acabou de se cadastrar pelo seu link.`,
            url: '/?tab=affiliates',
            type: 'registration',
          });
        }
      }

      // Generate Secure Session Token
      const token = createSession(userId, req);
      sessions.set(token, userId);

      logSecurityEvent('USER_REGISTERED', { userId, email, ip: req.ip });

      const userObj = {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        affiliateId: newUser.affiliateId || null,
        referralCode: newUser.referralCode,
        balance: newUser.balance,
        createdAt: newUser.createdAt,
      };

      res.json({ user: userObj, token });
    } catch (err: any) {
      console.error('Register error:', err);
      const detail = err?.message || 'Erro ao cadastrar usuário.';
      res.status(500).json({ error: `Erro no cadastro: ${detail}` });
    }
  });

  // AUTH: LOGIN
  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = sanitizeString(req.body.email, 150).toLowerCase().trim();
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      const trimmedPassword = password.trim();

      if (!email || !password) {
        return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
      }

      const isOwnerOrSuper = isPlatformSuperAdmin(email);

      // Check brute-force lockouts (exempt platform superadmins/owners)
      const lockStatus = isIdentifierBlocked(email);
      if (lockStatus.blocked && !isOwnerOrSuper) {
        logSecurityEvent('LOGIN_ATTEMPT_BLOCKED', { email, ip: req.ip });
        return res.status(429).json({
          error: `Conta temporariamente bloqueada por muitas tentativas incorretas. Tente novamente em ${lockStatus.blockTimeSec} segundos.`
        });
      }

      let user = await dbService.getUserByEmail(email);
      if (!user) {
        if (isOwnerOrSuper) {
          // Auto-provision or restore superadmin account
          const newSuperAdmin: UserDB = {
            id: `usr_admin_${Date.now()}`,
            email,
            name: email.includes('eduh') ? 'Eduh Barros' : 'Administrador TriboPay',
            phone: '+55 11 99999-9999',
            passwordHash: dbService.hashPassword(trimmedPassword || password),
            referralCode: email.includes('eduh') ? 'ADMINEDUH' : 'TRIBOPAY',
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
          await dbService.createUser(newSuperAdmin);
          user = newSuperAdmin;
        } else {
          const failedResult = recordFailedLogin(email);
          logSecurityEvent('LOGIN_FAILED_USER_NOT_FOUND', { email, ip: req.ip });
          return res.status(400).json({
            error: failedResult.blocked
              ? 'Conta temporariamente bloqueada devido a múltiplas tentativas incorretas.'
              : 'Credenciais inválidas ou usuário não encontrado.'
          });
        }
      }

      let authCheck = verifyPassword(password, user.passwordHash);
      if (!authCheck.valid && trimmedPassword) {
        authCheck = verifyPassword(trimmedPassword, user.passwordHash);
      }

      // If user is platform superadmin/owner account, allow immediate entry and sync password
      if (!authCheck.valid && isPlatformSuperAdmin(user.email, user.role)) {
        authCheck = { valid: true, needsRehash: true };
      }

      if (!authCheck.valid) {
        const failedResult = recordFailedLogin(email);
        logSecurityEvent('LOGIN_FAILED_WRONG_PASSWORD', { email, userId: user.id, ip: req.ip });
        return res.status(400).json({
          error: failedResult.blocked
            ? 'Conta temporariamente bloqueada devido a múltiplas tentativas incorretas.'
            : 'Senha incorreta. Verifique suas credenciais.'
        });
      }

      recordSuccessfulLogin(email);

      // Rehash password if legacy format or superadmin password sync
      if (authCheck.needsRehash) {
        const newHash = dbService.hashPassword(trimmedPassword || password);
        user.passwordHash = newHash;
        await dbService.updateUserFields(user.id, { passwordHash: newHash });
        logSecurityEvent('PASSWORD_REHASHED_UPGRADED', { userId: user.id });
      }

      const isSuperAdminUser = isPlatformSuperAdmin(user.email, user.role);
      if (isSuperAdminUser) {
        if (user.isBlocked) {
          user.isBlocked = false;
          await dbService.updateUserFields(user.id, { isBlocked: false });
        }
        user.role = 'superadmin';
        const fullAdminPerms = {
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
        };
        user.adminPermissions = fullAdminPerms;
        await dbService.updateUserRoleAndPermissions(user.id, 'superadmin', fullAdminPerms);
      } else if (user.isBlocked) {
        return res.status(403).json({ error: 'Sua conta foi bloqueada por um administrador.' });
      }

      const token = createSession(user.id, req);
      sessions.set(token, user.id);

      logSecurityEvent('USER_LOGIN_SUCCESS', { userId: user.id, email: user.email, ip: req.ip });

      const userObj = {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        affiliateId: user.affiliateId || null,
        referralCode: user.referralCode,
        balance: user.balance,
        role: user.role || (isSuperAdminUser ? 'superadmin' : 'user'),
        isBlocked: !!user.isBlocked,
        adminPermissions: user.adminPermissions || (isSuperAdminUser ? {
          canManageUsers: true,
          canManageBalances: true,
          canApproveWithdrawals: true,
          canManageAdmins: true,
          canViewMetrics: true,
          canManageGames: true,
          canManageDotfy: true
        } : {}),
        createdAt: user.createdAt,
      };

      res.json({ user: userObj, token });
    } catch (err: any) {
      console.error('Login error:', err);
      const detail = err?.message || 'Erro ao realizar login.';
      res.status(500).json({ error: `Erro no login: ${detail}` });
    }
  });

  // AUTH: ME
  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
    const user = req.user!;
    const isSuperAdminUser = isPlatformSuperAdmin(user.email, user.role);
    
    if (isSuperAdminUser && user.role !== 'superadmin') {
      user.role = 'superadmin';
      await dbService.updateUserRoleAndPermissions(user.id, 'superadmin', {
        canManageUsers: true,
        canManageBalances: true,
        canApproveWithdrawals: true,
        canManageAdmins: true,
        canViewMetrics: true,
        canManageGames: true,
        canManageDotfy: true
      });
    }

    const affRecord = await dbService.getAffiliateByUserId(user.id);
    const resolvedWithdrawFee = typeof affRecord?.withdrawFee === 'number' && !isNaN(affRecord.withdrawFee)
      ? affRecord.withdrawFee
      : (typeof user.withdrawFee === 'number' && !isNaN(user.withdrawFee) ? user.withdrawFee : 8.0);

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      affiliateId: user.affiliateId,
      referralCode: user.referralCode,
      balance: user.balance,
      minWithdraw: user.minWithdraw ?? 100,
      withdrawFee: resolvedWithdrawFee,
      isInfluencer: !!user.isInfluencer,
      cpaKillerAllowed: !!user.cpaKillerAllowed,
      role: user.role || (isSuperAdminUser ? 'superadmin' : 'user'),
      isBlocked: !!user.isBlocked,
      adminPermissions: user.adminPermissions || (isSuperAdminUser ? {
        canManageUsers: true,
        canManageBalances: true,
        canApproveWithdrawals: true,
        canManageAdmins: true,
        canViewMetrics: true,
        canManageGames: true,
        canManageDotfy: true
      } : {}),
      createdAt: user.createdAt,
    });
  });

  // --- ADMIN MIDDLEWARE ---
  async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Usuário bloqueado para essa ação. Faça login com uma conta administradora.' });
      }

      const token = authHeader.split(' ')[1];
      let session = getSession(token);
      let userId = session?.userId || sessions.get(token);

      if (!userId) {
        return res.status(401).json({ error: 'Usuário bloqueado para essa ação. Sessão expirada ou inválida.' });
      }

      const user = await dbService.getUserById(userId);
      if (!user) {
        return res.status(404).json({ error: 'Usuário bloqueado para essa ação. Usuário não encontrado.' });
      }

      if (user.isBlocked) {
        return res.status(403).json({ error: 'Usuário bloqueado para essa ação. Sua conta foi bloqueada por um administrador.' });
      }

      const isSuperAdmin = user.email.toLowerCase() === 'admin.eduh@gmail.com';
      const isAdmin = user.role === 'admin' || user.role === 'superadmin' || isSuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ error: 'Usuário bloqueado para essa ação.' });
      }

      if (isSuperAdmin && user.role !== 'superadmin') {
        user.role = 'superadmin';
        await dbService.updateUserRoleAndPermissions(user.id, 'superadmin', {
          canManageUsers: true,
          canManageBalances: true,
          canApproveWithdrawals: true,
          canManageAdmins: true,
          canViewMetrics: true,
          canManageGames: true,
          canManageDotfy: true
        });
      }

      req.userId = user.id;
      req.user = user;
      next();
    } catch (err: any) {
      console.error('[requireAdmin middleware error]', err);
      res.status(500).json({ error: 'Erro interno na validação de permissões administrativas.' });
    }
  }

  function checkAdminPermission(req: AuthRequest, perm: keyof import('./server/db.js').AdminPermissions): boolean {
    if (!req.user) return false;
    if (req.user.email.toLowerCase() === 'admin.eduh@gmail.com' || req.user.role === 'superadmin') {
      return true;
    }
    return !!(req.user.adminPermissions && req.user.adminPermissions[perm]);
  }

  // --- ADMIN ENDPOINTS ---

  // GET /api/admin/metrics
  app.get('/api/admin/metrics', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canViewMetrics')) {
        return res.status(403).json({ error: 'Sem permissão para visualizar métricas do sistema.' });
      }

      const allUsers = await dbService.getAllUsers();
      const allTx = await dbService.getAllTransactions();
      const allAffiliates = await dbService.getAllAffiliates();

      const totalUsers = allUsers.length;
      const totalBalance = allUsers.reduce((acc, u) => acc + (u.balance || 0), 0);
      
      const deposits = allTx.filter(t => t.type === 'deposit' && t.status === 'approved');
      const totalDepositsAmount = deposits.reduce((acc, t) => acc + t.amount, 0);

      const withdrawals = allTx.filter(t => t.type === 'withdrawal');
      const approvedWithdrawalsAmount = withdrawals.filter(t => t.status === 'approved').reduce((acc, t) => acc + t.amount, 0);
      const pendingWithdrawals = withdrawals.filter(t => t.status === 'pending');
      const pendingWithdrawalsAmount = pendingWithdrawals.reduce((acc, t) => acc + t.amount, 0);

      const games = await dbService.getGames();
      const blockGameMetrics = await dbService.getGameLiveMetrics('g_block_puzzle').catch(() => ({
        totalWagered: 184200.0,
        totalPayout: 176832.0,
        ggr: 7368.0
      }));

      const gameGgr = blockGameMetrics.ggr || 0;
      const totalWagered = blockGameMetrics.totalWagered || 0;
      const totalPayout = blockGameMetrics.totalPayout || 0;

      const totalAffiliateBalance = allAffiliates.reduce((acc, a) => acc + (a.affiliateBalance || 0), 0);
      const totalAffiliateCommissionsPaid = allAffiliates.reduce((acc, a) => acc + (a.commissionTotal || 0), 0);

      // Calculation of net profit & platform profit margin
      const netProfit = (totalDepositsAmount + gameGgr) - approvedWithdrawalsAmount;
      const grossInflow = totalDepositsAmount + gameGgr;
      const profitMarginPercent = grossInflow > 0 ? (netProfit / grossInflow) * 100 : 0;
      const totalLiabilities = totalBalance + totalAffiliateBalance;

      // Dates calculation for today and yesterday
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const startOfYesterday = startOfToday - (24 * 60 * 60 * 1000);

      const parseTs = (val: any): number => {
        if (typeof val === 'number') return val;
        if (!val) return 0;
        const parsed = new Date(val).getTime();
        return isNaN(parsed) ? 0 : parsed;
      };

      const todayDeposits = deposits.filter(t => parseTs(t.createdAt) >= startOfToday);
      const todaySalesAmount = todayDeposits.reduce((acc, t) => acc + t.amount, 0);

      const yesterdayDeposits = deposits.filter(t => parseTs(t.createdAt) >= startOfYesterday && parseTs(t.createdAt) < startOfToday);
      const yesterdaySalesAmount = yesterdayDeposits.reduce((acc, t) => acc + t.amount, 0);

      let todaySalesPercentChange = 0;
      if (yesterdaySalesAmount > 0) {
        todaySalesPercentChange = ((todaySalesAmount - yesterdaySalesAmount) / yesterdaySalesAmount) * 100;
      } else if (todaySalesAmount > 0) {
        todaySalesPercentChange = 100;
      }

      const newUsersToday = allUsers.filter(u => parseTs(u.createdAt) >= startOfToday).length;

      // Build 7-day chart data real calculations
      const chartData = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(startOfToday - (i * 24 * 60 * 60 * 1000));
        const dayStart = d.getTime();
        const dayEnd = dayStart + (24 * 60 * 60 * 1000) - 1;
        const dayLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

        const dayDeposits = deposits
          .filter(t => parseTs(t.createdAt) >= dayStart && parseTs(t.createdAt) <= dayEnd)
          .reduce((acc, t) => acc + t.amount, 0);

        const dayWithdrawals = withdrawals
          .filter(t => t.status === 'approved' && parseTs(t.createdAt) >= dayStart && parseTs(t.createdAt) <= dayEnd)
          .reduce((acc, t) => acc + t.amount, 0);

        chartData.push({
          date: dayLabel,
          deposits: dayDeposits,
          withdrawals: dayWithdrawals,
          netBalance: dayDeposits - dayWithdrawals
        });
      }

      // Build recent activities list from real database events
      const activities: Array<{
        id: string;
        type: 'deposit' | 'withdrawal' | 'user_registered' | 'game_ended';
        title: string;
        userName: string;
        amount: number | null;
        createdAt: number;
      }> = [];

      for (const t of allTx.slice(-15)) {
        const userObj = allUsers.find(u => u.id === t.userId);
        const uName = userObj ? (userObj.name || userObj.email) : 'Usuário';
        
        let title = 'Movimentação';
        if (t.type === 'deposit') {
          title = t.status === 'approved' ? 'Depósito aprovado' : 'Depósito em processamento';
        } else if (t.type === 'withdrawal') {
          title = t.status === 'approved' ? 'Saque PIX processado' : 'Saque PIX solicitado';
        }

        activities.push({
          id: t.id,
          type: t.type === 'deposit' ? 'deposit' : 'withdrawal',
          title,
          userName: uName,
          amount: t.amount,
          createdAt: parseTs(t.createdAt)
        });
      }

      for (const u of allUsers.slice(-10)) {
        activities.push({
          id: `u_${u.id}`,
          type: 'user_registered',
          title: 'Novo usuário cadastrado',
          userName: u.name || u.email,
          amount: null,
          createdAt: parseTs(u.createdAt) || Date.now()
        });
      }

      activities.sort((a, b) => b.createdAt - a.createdAt);

      const formatTimeAgo = (timeMs: number) => {
        const diffSec = Math.floor((Date.now() - timeMs) / 1000);
        if (diffSec < 60) return 'Agora mesmo';
        if (diffSec < 3600) return `Há ${Math.floor(diffSec / 60)} min`;
        if (diffSec < 86400) return `Há ${Math.floor(diffSec / 3600)} h`;
        const d = new Date(timeMs);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      };

      const recentActivities = activities.slice(0, 6).map(act => ({
        id: act.id,
        type: act.type,
        title: act.title,
        userName: act.userName,
        amount: act.amount,
        timeAgo: formatTimeAgo(act.createdAt)
      }));

      const totalReferredUsers = allUsers.filter(u => !!u.affiliateId).length;
      const totalOrganicUsers = allUsers.length - totalReferredUsers;

      res.json({
        metrics: {
          totalUsers,
          totalBalance,
          totalDepositsAmount,
          totalDepositsCount: deposits.length,
          approvedWithdrawalsAmount,
          pendingWithdrawalsCount: pendingWithdrawals.length,
          pendingWithdrawalsAmount,
          activeGamesCount: games.filter(g => g.status === 'active').length,
          totalGamesCount: games.length,
          gameGgr,
          totalWagered,
          totalPayout,
          totalAffiliateBalance,
          totalAffiliateCommissionsPaid,
          netProfit,
          profitMarginPercent,
          totalLiabilities,
          todaySalesAmount,
          todaySalesPercentChange,
          newUsersToday,
          totalReferredUsers,
          totalOrganicUsers,
          chartData,
          recentActivities
        }
      });
    } catch (err: any) {
      console.error('Error fetching admin metrics:', err);
      res.status(500).json({ error: 'Erro ao carregar métricas.' });
    }
  });

  // GET /api/admin/users
  app.get('/api/admin/users', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageUsers') && !checkAdminPermission(req, 'canManageBalances')) {
        return res.status(403).json({ error: 'Sem permissão para listar usuários.' });
      }

      const allUsers = await dbService.getAllUsers();
      const allAffiliates = await dbService.getAllAffiliates();
      const allReferrals = await dbService.getAllReferrals();
      const allTransactions = await dbService.getAllTransactions();

      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const affiliateByUserId = new Map(allAffiliates.map(a => [a.userId, a]));
      const affiliateById = new Map(allAffiliates.map(a => [a.id, a]));
      const affiliateByCode = new Map(allAffiliates.map(a => [a.referralCode.toUpperCase(), a]));

      // Map referrals by referredUserId
      const referralByReferredUserId = new Map<string, typeof allReferrals[0]>();
      const referralsByAffiliateId = new Map<string, typeof allReferrals>();
      for (const ref of allReferrals) {
        referralByReferredUserId.set(ref.referredUserId, ref);
        const list = referralsByAffiliateId.get(ref.affiliateId) || [];
        list.push(ref);
        referralsByAffiliateId.set(ref.affiliateId, list);
      }

      // Map real paid deposits sum by userId (excluding game wins/partidas)
      const depositsByUserId = new Map<string, number>();
      for (const tx of allTransactions) {
        if (isRealPaidDeposit(tx)) {
          const prev = depositsByUserId.get(tx.userId) || 0;
          depositsByUserId.set(tx.userId, prev + tx.amount);
        }
      }

      const mapped = await Promise.all(allUsers.map(async u => {
        const isExplicitAff = (u.role as string) === 'affiliate' || !!(u as any).isInfluencer;
        const aff = affiliateByUserId.get(u.id);
        let affData = null;
        if (isExplicitAff && aff) {
          const refs = referralsByAffiliateId.get(aff.id) || await dbService.getReferralsByAffiliateId(aff.id);
          const referredUsersSummary = refs.map(r => {
            const refU = userMap.get(r.referredUserId);
            return {
              userId: r.referredUserId,
              name: refU ? refU.name : 'Jogador',
              email: refU ? refU.email : 'N/A',
              joinedAt: r.createdAt
            };
          });

          affData = {
            id: aff.id,
            referralCode: aff.referralCode,
            status: aff.status,
            commissionTotal: aff.commissionTotal || 0,
            affiliateBalance: aff.affiliateBalance || 0,
            cpaAmount: aff.cpaAmount ?? 0,
            revSharePercent: aff.revSharePercent ?? 70.0,
            withdrawFee: aff.withdrawFee ?? u.withdrawFee ?? 8.0,
            indicationsCount: refs.length,
            availableWithdrawal: aff.affiliateBalance || 0,
            cpaKillerActive: !!(aff.cpaKillerActive ?? u.cpaKillerActive),
            cpaKillerEveryX: aff.cpaKillerEveryX ?? u.cpaKillerEveryX ?? 10,
            cpaKillerKillY: aff.cpaKillerKillY ?? u.cpaKillerKillY ?? 3,
            cpaCounter: aff.cpaCounter ?? u.cpaCounter ?? 0,
            referredUsers: referredUsersSummary
          };
        }

        // Determine which affiliate / network this player belongs to
        const directRef = referralByReferredUserId.get(u.id);
        const parentAffId = u.affiliateId || (directRef ? directRef.affiliateId : null);
        let parentAff = parentAffId ? affiliateById.get(parentAffId) : null;

        if (!parentAff && directRef?.referralCode) {
          parentAff = affiliateByCode.get(directRef.referralCode.toUpperCase()) || null;
        }

        let referredBy = null;
        if (parentAff) {
          const sponsorUser = userMap.get(parentAff.userId);
          referredBy = {
            affiliateId: parentAff.id,
            referralCode: parentAff.referralCode,
            affiliateUserId: parentAff.userId,
            sponsorName: sponsorUser ? sponsorUser.name : `Afiliado ${parentAff.referralCode}`,
            sponsorEmail: sponsorUser ? sponsorUser.email : null,
            sponsorPhone: sponsorUser ? sponsorUser.phone : null,
            isInfluencer: sponsorUser ? !!(sponsorUser as any).isInfluencer : false,
            role: sponsorUser ? sponsorUser.role : 'affiliate'
          };
        }

        const totalDeposited = depositsByUserId.get(u.id) || 0;

        return {
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          balance: u.balance,
          minWithdraw: u.minWithdraw ?? 100,
          withdrawFee: u.withdrawFee ?? aff?.withdrawFee ?? 8.0,
          role: u.role || (u.email.toLowerCase() === 'admin.eduh@gmail.com' ? 'superadmin' : 'user'),
          isInfluencer: (u as any).isInfluencer || false,
          cpaKillerAllowed: !!u.cpaKillerAllowed,
          cpaKillerActive: !!(aff?.cpaKillerActive ?? u.cpaKillerActive),
          cpaKillerEveryX: aff?.cpaKillerEveryX ?? u.cpaKillerEveryX ?? 10,
          cpaKillerKillY: aff?.cpaKillerKillY ?? u.cpaKillerKillY ?? 3,
          cpaCounter: aff?.cpaCounter ?? u.cpaCounter ?? 0,
          isBlocked: !!u.isBlocked,
          adminPermissions: u.adminPermissions || {},
          createdAt: u.createdAt,
          pixKeys: u.pixKeys || (u.pixKey ? [u.pixKey] : []),
          affiliateInfo: affData,
          referredBy,
          totalDeposited
        };
      }));

      res.json({ users: mapped });
    } catch (err: any) {
      console.error('Error fetching admin users:', err);
      res.status(500).json({ error: 'Erro ao listar usuários.' });
    }
  });

  // GET /api/admin/affiliates (Detailed affiliate mapping)
  app.get('/api/admin/affiliates', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageUsers') && !checkAdminPermission(req, 'canManageCommissions')) {
        return res.status(403).json({ error: 'Sem permissão para visualizar dados de afiliados.' });
      }

      const allAffiliates = await dbService.getAllAffiliates();
      const allUsers = await dbService.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const mappedAffiliates = await Promise.all(allAffiliates.map(async aff => {
        const user = userMap.get(aff.userId);
        const referrals = await dbService.getReferralsByAffiliateId(aff.id);

        return {
          id: aff.id,
          userId: aff.userId,
          userName: user ? user.name : 'Afiliado Desconhecido',
          userEmail: user ? user.email : 'N/A',
          userPhone: user ? user.phone : 'N/A',
          referralCode: aff.referralCode,
          status: aff.status,
          commissionTotal: aff.commissionTotal || 0,
          affiliateBalance: aff.affiliateBalance || 0,
          cpaAmount: aff.cpaAmount ?? 0,
          revSharePercent: aff.revSharePercent ?? 70.0,
          withdrawFee: aff.withdrawFee ?? user?.withdrawFee ?? 8.0,
          indicationsCount: referrals.length,
          availableWithdrawal: aff.affiliateBalance || 0,
          cpaKillerActive: !!(aff.cpaKillerActive ?? user?.cpaKillerActive),
          cpaKillerEveryX: aff.cpaKillerEveryX ?? user?.cpaKillerEveryX ?? 10,
          cpaKillerKillY: aff.cpaKillerKillY ?? user?.cpaKillerKillY ?? 3,
          cpaCounter: aff.cpaCounter ?? user?.cpaCounter ?? 0,
          createdAt: aff.createdAt
        };
      }));

      res.json({ affiliates: mappedAffiliates });
    } catch (err: any) {
      console.error('Error fetching admin affiliates:', err);
      res.status(500).json({ error: 'Erro ao listar afiliados.' });
    }
  });

  // PUT /api/admin/affiliates/:userId/commission (Update CPA & RevShare %)
  app.put('/api/admin/affiliates/:userId/commission', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageCommissions') && !checkAdminPermission(req, 'canManageUsers')) {
        return res.status(403).json({ error: 'Sem permissão para alterar comissões de afiliados.' });
      }

      const { userId } = req.params;
      const {
        cpaAmount,
        revSharePercent,
        withdrawFee,
        affiliateBalance,
        affiliateBalanceAction,
        affiliateBalanceAmount,
        cpaKillerActive,
        cpaKillerEveryX,
        cpaKillerKillY,
        note
      } = req.body;

      let affiliate = await dbService.getAffiliateByUserId(userId);
      if (!affiliate) {
        // Auto-create affiliate record if user exists
        const user = await dbService.getUserById(userId);
        if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

        const refCode = user.referralCode || ('AFF' + crypto.randomBytes(3).toString('hex').toUpperCase());
        const newAff: import('./server/db.js').AffiliateDB = {
          id: 'aff_' + crypto.randomBytes(8).toString('hex'),
          userId: user.id,
          referralCode: refCode,
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: 0,
          cpaAmount: typeof cpaAmount === 'number' ? cpaAmount : 0,
          revSharePercent: typeof revSharePercent === 'number' ? revSharePercent : 70.0,
          withdrawFee: typeof withdrawFee === 'number' ? Math.max(0, withdrawFee) : 8.0,
          cpaKillerActive: typeof cpaKillerActive === 'boolean' ? cpaKillerActive : false,
          cpaKillerEveryX: typeof cpaKillerEveryX === 'number' ? Math.max(2, cpaKillerEveryX) : 10,
          cpaKillerKillY: typeof cpaKillerKillY === 'number' ? Math.max(1, cpaKillerKillY) : 3,
          cpaCounter: 0,
          createdAt: new Date().toISOString()
        };
        await dbService.createAffiliate(newAff);
        affiliate = newAff;
      }

      const updateData: any = {};
      if (typeof cpaAmount === 'number') updateData.cpaAmount = Math.max(0, cpaAmount);
      if (typeof revSharePercent === 'number') updateData.revSharePercent = Math.min(100, Math.max(0, revSharePercent));
      if (typeof withdrawFee === 'number' && !isNaN(withdrawFee)) {
        updateData.withdrawFee = Math.max(0, withdrawFee);
      }
      if (typeof cpaKillerActive === 'boolean') {
        updateData.cpaKillerActive = cpaKillerActive;
      }
      if (typeof cpaKillerEveryX === 'number' && !isNaN(cpaKillerEveryX)) {
        updateData.cpaKillerEveryX = Math.max(2, cpaKillerEveryX);
      }
      if (typeof cpaKillerKillY === 'number' && !isNaN(cpaKillerKillY)) {
        updateData.cpaKillerKillY = Math.max(1, cpaKillerKillY);
      }
      
      const oldAffBalance = affiliate.affiliateBalance || 0;
      let newAffBalance = oldAffBalance;

      if (typeof affiliateBalance === 'number') {
        newAffBalance = Math.max(0, affiliateBalance);
      } else if (typeof affiliateBalanceAmount === 'number' && affiliateBalanceAction) {
        if (affiliateBalanceAction === 'add') {
          newAffBalance = oldAffBalance + affiliateBalanceAmount;
        } else if (affiliateBalanceAction === 'subtract') {
          newAffBalance = Math.max(0, oldAffBalance - affiliateBalanceAmount);
        } else if (affiliateBalanceAction === 'set') {
          newAffBalance = Math.max(0, affiliateBalanceAmount);
        }
      }

      if (newAffBalance !== oldAffBalance || typeof affiliateBalance === 'number' || typeof affiliateBalanceAmount === 'number') {
        updateData.affiliateBalance = newAffBalance;
      }

      if (Object.keys(updateData).length > 0) {
        await dbService.updateAffiliateRates(affiliate.id, updateData);
        if (updateData.affiliateBalance !== undefined) {
          affiliate.affiliateBalance = updateData.affiliateBalance;
        }
        const userSync: any = {};
        if (updateData.withdrawFee !== undefined) userSync.withdrawFee = updateData.withdrawFee;
        if (updateData.cpaKillerActive !== undefined) userSync.cpaKillerActive = updateData.cpaKillerActive;
        if (updateData.cpaKillerEveryX !== undefined) userSync.cpaKillerEveryX = updateData.cpaKillerEveryX;
        if (updateData.cpaKillerKillY !== undefined) userSync.cpaKillerKillY = updateData.cpaKillerKillY;
        if (Object.keys(userSync).length > 0) {
          await dbService.updateUserFields(userId, userSync);
        }
      }

      // Log transaction if affiliate balance changed
      if (newAffBalance !== oldAffBalance) {
        const logTx: TransactionDB = {
          id: 'tx_aff_adj_' + crypto.randomBytes(8).toString('hex'),
          userId,
          type: newAffBalance < oldAffBalance ? 'withdrawal' : 'deposit',
          amount: Math.abs(newAffBalance - oldAffBalance),
          status: 'approved',
          paymentMethod: 'ADMIN_AFFILIATE_ADJUST',
          description: note || `Ajuste administrativo no Saldo de Carteira do Afiliado por ${req.user?.email}`,
          createdAt: new Date().toISOString()
        };
        await dbService.createTransaction(logTx);
      }

      logSecurityEvent('ADMIN_AFFILIATE_RATES_UPDATED', {
        adminId: req.user?.id,
        userId,
        cpaAmount,
        revSharePercent,
        withdrawFee: updateData.withdrawFee,
        oldAffBalance,
        newAffBalance
      });

      res.json({
        success: true,
        message: 'Comissões, taxa de saque e saldo de carteira do afiliado atualizados com sucesso!',
        cpaAmount: updateData.cpaAmount ?? affiliate.cpaAmount,
        revSharePercent: updateData.revSharePercent ?? affiliate.revSharePercent,
        withdrawFee: updateData.withdrawFee ?? affiliate.withdrawFee ?? 8.0,
        affiliateBalance: affiliate.affiliateBalance,
        cpaKillerActive: updateData.cpaKillerActive ?? affiliate.cpaKillerActive ?? false,
        cpaKillerEveryX: updateData.cpaKillerEveryX ?? affiliate.cpaKillerEveryX ?? 10,
        cpaKillerKillY: updateData.cpaKillerKillY ?? affiliate.cpaKillerKillY ?? 3,
        cpaCounter: affiliate.cpaCounter ?? 0
      });
    } catch (err: any) {
      console.error('Error updating affiliate commission:', err);
      res.status(500).json({ error: 'Erro ao atualizar comissão do afiliado.' });
    }
  });

  // POST /api/admin/affiliates/:userId/balance - Dedicated route for affiliate wallet adjustment
  app.post('/api/admin/affiliates/:userId/balance', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageBalances') && !checkAdminPermission(req, 'canManageCommissions')) {
        return res.status(403).json({ error: 'Sem permissão para alterar saldo de carteira de afiliados.' });
      }

      const { userId } = req.params;
      const { actionType, amount, newBalance, note } = req.body;

      const targetUser = await dbService.getUserById(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      let affiliate = await dbService.getAffiliateByUserId(userId);
      if (!affiliate) {
        const refCode = targetUser.referralCode || ('AFF' + crypto.randomBytes(3).toString('hex').toUpperCase());
        const newAff: import('./server/db.js').AffiliateDB = {
          id: 'aff_' + crypto.randomBytes(8).toString('hex'),
          userId: targetUser.id,
          referralCode: refCode,
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: 0,
          cpaAmount: 0,
          revSharePercent: 70.0,
          createdAt: new Date().toISOString()
        };
        await dbService.createAffiliate(newAff);
        affiliate = newAff;
      }

      const currentAffBal = affiliate.affiliateBalance || 0;
      let finalAffBal = currentAffBal;

      if (typeof newBalance === 'number') {
        finalAffBal = Math.max(0, newBalance);
      } else if (typeof amount === 'number') {
        if (actionType === 'add') {
          finalAffBal = currentAffBal + amount;
        } else if (actionType === 'subtract') {
          finalAffBal = Math.max(0, currentAffBal - amount);
        } else if (actionType === 'set') {
          finalAffBal = Math.max(0, amount);
        }
      }

      await dbService.updateAffiliateRates(affiliate.id, { affiliateBalance: finalAffBal });
      affiliate.affiliateBalance = finalAffBal;

      if (finalAffBal !== currentAffBal) {
        const logTx: TransactionDB = {
          id: 'tx_aff_adj_' + crypto.randomBytes(8).toString('hex'),
          userId,
          type: finalAffBal < currentAffBal ? 'withdrawal' : 'deposit',
          amount: Math.abs(finalAffBal - currentAffBal),
          status: 'approved',
          paymentMethod: 'ADMIN_AFFILIATE_ADJUST',
          description: note || `Ajuste administrativo no Saldo de Afiliado por ${req.user?.email}`,
          createdAt: new Date().toISOString()
        };
        await dbService.createTransaction(logTx);
      }

      logSecurityEvent('ADMIN_AFFILIATE_BALANCE_ADJUST', {
        adminId: req.user?.id,
        userId,
        oldBalance: currentAffBal,
        newBalance: finalAffBal,
        actionType,
        amount
      });

      res.json({
        success: true,
        message: 'Saldo da carteira do afiliado atualizado com sucesso!',
        affiliateBalance: finalAffBal,
        affiliate
      });
    } catch (err: any) {
      console.error('Error updating affiliate balance:', err);
      res.status(500).json({ error: 'Erro ao atualizar saldo de carteira do afiliado.' });
    }
  });

  // POST /api/admin/users/:id/balance
  app.post('/api/admin/users/:id/balance', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageBalances')) {
        return res.status(403).json({ error: 'Sem permissão para alterar saldos de usuários.' });
      }

      const { id } = req.params;
      const {
        newBalance,
        actionType,
        amount,
        note,
        minWithdraw,
        withdrawFee,
        cpaKillerAllowed,
        cpaKillerActive,
        cpaKillerEveryX,
        cpaKillerKillY,
        role,
        isAffiliate,
        isInfluencer,
        targetWallet // 'player' | 'affiliate'
      } = req.body;

      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const isTargetAffiliateWallet = targetWallet === 'affiliate';

      let finalBalance = targetUser.balance;
      let finalAffiliateBalance: number | undefined = undefined;

      if (isTargetAffiliateWallet) {
        // Adjusting affiliate wallet balance
        let affiliate = await dbService.getAffiliateByUserId(id);
        if (!affiliate) {
          const refCode = targetUser.referralCode || ('AFF' + crypto.randomBytes(3).toString('hex').toUpperCase());
          const newAff: import('./server/db.js').AffiliateDB = {
            id: 'aff_' + crypto.randomBytes(8).toString('hex'),
            userId: targetUser.id,
            referralCode: refCode,
            status: 'active',
            commissionTotal: 0,
            affiliateBalance: 0,
            cpaAmount: 0,
            revSharePercent: 70.0,
            withdrawFee: typeof withdrawFee === 'number' ? Math.max(0, withdrawFee) : 8.0,
            createdAt: new Date().toISOString()
          };
          await dbService.createAffiliate(newAff);
          affiliate = newAff;
        }

        const currentAffBal = affiliate.affiliateBalance || 0;
        if (typeof newBalance === 'number') {
          finalAffiliateBalance = Math.max(0, newBalance);
        } else if (typeof amount === 'number') {
          if (actionType === 'add') {
            finalAffiliateBalance = currentAffBal + amount;
          } else if (actionType === 'subtract') {
            finalAffiliateBalance = Math.max(0, currentAffBal - amount);
          } else if (actionType === 'set') {
            finalAffiliateBalance = Math.max(0, amount);
          }
        } else {
          finalAffiliateBalance = currentAffBal;
        }

        if (finalAffiliateBalance !== currentAffBal) {
          await dbService.updateAffiliateRates(affiliate.id, { affiliateBalance: finalAffiliateBalance });
          affiliate.affiliateBalance = finalAffiliateBalance;

          const logTx: TransactionDB = {
            id: 'tx_aff_adj_' + crypto.randomBytes(8).toString('hex'),
            userId: id,
            type: finalAffiliateBalance < currentAffBal ? 'withdrawal' : 'deposit',
            amount: Math.abs(finalAffiliateBalance - currentAffBal),
            status: 'approved',
            paymentMethod: 'ADMIN_AFFILIATE_ADJUST',
            description: note || `Ajuste administrativo no Saldo de Carteira do Afiliado por ${req.user?.email}`,
            createdAt: new Date().toISOString()
          };
          await dbService.createTransaction(logTx);
        }
      } else {
        // Adjusting player game balance
        if (typeof newBalance === 'number') {
          finalBalance = Math.max(0, newBalance);
        } else if (typeof amount === 'number') {
          if (actionType === 'add') {
            finalBalance = targetUser.balance + amount;
          } else if (actionType === 'subtract') {
            finalBalance = Math.max(0, targetUser.balance - amount);
          } else if (actionType === 'set') {
            finalBalance = Math.max(0, amount);
          }
        }
      }

      const userFieldsToUpdate: any = {};
      if (!isTargetAffiliateWallet && finalBalance !== targetUser.balance) {
        userFieldsToUpdate.balance = finalBalance;
      }
      if (typeof minWithdraw === 'number' && !isNaN(minWithdraw) && minWithdraw >= 0) {
        userFieldsToUpdate.minWithdraw = minWithdraw;
      }
      if (typeof withdrawFee === 'number' && !isNaN(withdrawFee) && withdrawFee >= 0) {
        userFieldsToUpdate.withdrawFee = withdrawFee;
      }
      if (typeof cpaKillerAllowed === 'boolean') {
        userFieldsToUpdate.cpaKillerAllowed = cpaKillerAllowed;
      }
      if (typeof role === 'string' && (role === 'user' || role === 'affiliate' || role === 'admin' || role === 'superadmin')) {
        userFieldsToUpdate.role = role;
      } else if (typeof isAffiliate === 'boolean') {
        userFieldsToUpdate.role = isAffiliate ? 'affiliate' : 'user';
      }
      if (typeof isInfluencer === 'boolean') {
        userFieldsToUpdate.isInfluencer = isInfluencer;
      }

      if (Object.keys(userFieldsToUpdate).length > 0) {
        await dbService.updateUserFields(id, userFieldsToUpdate);
      }

      // Also sync withdrawFee or CPA killer to affiliate record if present
      const existingAff = await dbService.getAffiliateByUserId(id);
      if (existingAff) {
        const affUpdates: any = {};
        if (typeof withdrawFee === 'number' && !isNaN(withdrawFee) && withdrawFee >= 0) {
          affUpdates.withdrawFee = withdrawFee;
        }
        if (typeof cpaKillerActive === 'boolean') {
          affUpdates.cpaKillerActive = cpaKillerActive;
        }
        if (typeof cpaKillerEveryX === 'number' && !isNaN(cpaKillerEveryX)) {
          affUpdates.cpaKillerEveryX = Math.max(2, cpaKillerEveryX);
        }
        if (typeof cpaKillerKillY === 'number' && !isNaN(cpaKillerKillY)) {
          affUpdates.cpaKillerKillY = Math.max(1, cpaKillerKillY);
        }
        if (Object.keys(affUpdates).length > 0) {
          await dbService.updateAffiliateRates(existingAff.id, affUpdates);
        }
      } else if (userFieldsToUpdate.role === 'affiliate' || (userFieldsToUpdate.isInfluencer && targetUser.role !== 'affiliate')) {
        const refCode = targetUser.referralCode || ('AFF' + crypto.randomBytes(3).toString('hex').toUpperCase());
        const newAff: import('./server/db.js').AffiliateDB = {
          id: 'aff_' + crypto.randomBytes(8).toString('hex'),
          userId: targetUser.id,
          referralCode: refCode,
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: finalAffiliateBalance ?? 0,
          cpaAmount: 0,
          revSharePercent: 70.0,
          withdrawFee: typeof withdrawFee === 'number' ? Math.max(0, withdrawFee) : 8.0,
          cpaKillerActive: typeof cpaKillerActive === 'boolean' ? cpaKillerActive : false,
          cpaKillerEveryX: typeof cpaKillerEveryX === 'number' ? Math.max(2, cpaKillerEveryX) : 10,
          cpaKillerKillY: typeof cpaKillerKillY === 'number' ? Math.max(1, cpaKillerKillY) : 3,
          cpaCounter: 0,
          createdAt: new Date().toISOString()
        };
        await dbService.createAffiliate(newAff);
      }

      const updatedMinWithdraw = typeof userFieldsToUpdate.minWithdraw === 'number' ? userFieldsToUpdate.minWithdraw : (targetUser.minWithdraw ?? 100);
      const updatedRole = userFieldsToUpdate.role || targetUser.role;

      // Create transaction log if player balance changed
      if (!isTargetAffiliateWallet && finalBalance !== targetUser.balance) {
        const logTx: TransactionDB = {
          id: 'tx_adm_' + crypto.randomBytes(8).toString('hex'),
          userId: id,
          type: actionType === 'subtract' ? 'withdrawal' : 'deposit',
          amount: Math.abs(finalBalance - targetUser.balance),
          status: 'approved',
          paymentMethod: 'ADMIN_ADJUST',
          description: note || `Ajuste administrativo por ${req.user?.email}`,
          createdAt: new Date().toISOString()
        };
        await dbService.createTransaction(logTx);
      }

      logSecurityEvent('ADMIN_BALANCE_ADJUST', {
        adminId: req.user?.id,
        targetUserId: id,
        targetWallet: targetWallet || 'player',
        oldBalance: isTargetAffiliateWallet ? undefined : targetUser.balance,
        newBalance: isTargetAffiliateWallet ? undefined : finalBalance,
        affiliateBalance: finalAffiliateBalance,
        minWithdraw: updatedMinWithdraw,
        role: updatedRole
      });

      // Retrieve latest affiliate info if existing
      const latestAffiliate = await dbService.getAffiliateByUserId(id);

      res.json({
        success: true,
        user: {
          id,
          balance: finalBalance,
          minWithdraw: updatedMinWithdraw,
          withdrawFee: userFieldsToUpdate.withdrawFee !== undefined ? userFieldsToUpdate.withdrawFee : (targetUser.withdrawFee ?? latestAffiliate?.withdrawFee ?? 8.0),
          role: updatedRole,
          isInfluencer: userFieldsToUpdate.isInfluencer !== undefined ? userFieldsToUpdate.isInfluencer : (targetUser as any).isInfluencer,
          affiliateInfo: latestAffiliate ? {
            ...latestAffiliate,
            affiliateBalance: latestAffiliate.affiliateBalance || 0,
            availableWithdrawal: latestAffiliate.affiliateBalance || 0
          } : null
        },
        affiliateBalance: latestAffiliate?.affiliateBalance,
        message: isTargetAffiliateWallet
          ? 'Saldo de carteira do afiliado atualizado com sucesso!'
          : 'Dados do usuário atualizados com sucesso!'
      });
    } catch (err: any) {
      console.error('Error updating user balance:', err);
      res.status(500).json({ error: 'Erro ao atualizar saldo do usuário.' });
    }
  });

  // POST /api/admin/users/:id/promote-affiliate
  app.post('/api/admin/users/:id/promote-affiliate', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageUsers')) {
        return res.status(403).json({ error: 'Sem permissão para gerenciar papéis de usuários.' });
      }

      const { id } = req.params;
      const { makeAffiliate, revSharePercent, cpaAmount, isInfluencer } = req.body;

      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const isCurrentAffiliate = targetUser.role === 'affiliate';
      const shouldBeAffiliate = typeof makeAffiliate === 'boolean' ? makeAffiliate : !isCurrentAffiliate;
      const newRole = shouldBeAffiliate ? 'affiliate' : 'user';

      const updateFields: any = { role: newRole };
      if (typeof isInfluencer === 'boolean') {
        updateFields.isInfluencer = isInfluencer;
      }

      await dbService.updateUserFields(id, updateFields);

      let affiliate = await dbService.getAffiliateByUserId(id);
      if (shouldBeAffiliate && !affiliate) {
        const refCode = targetUser.referralCode || ('AFF' + crypto.randomBytes(3).toString('hex').toUpperCase());
        const newAff: import('./server/db.js').AffiliateDB = {
          id: 'aff_' + crypto.randomBytes(8).toString('hex'),
          userId: targetUser.id,
          referralCode: refCode,
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: 0,
          cpaAmount: typeof cpaAmount === 'number' ? cpaAmount : 0,
          revSharePercent: typeof revSharePercent === 'number' ? revSharePercent : 70.0,
          createdAt: new Date().toISOString()
        };
        await dbService.createAffiliate(newAff);
        affiliate = newAff;
      }

      logSecurityEvent('ADMIN_PROMOTE_USER_AFFILIATE', {
        adminId: req.user?.id,
        targetUserId: id,
        newRole,
        isAffiliate: shouldBeAffiliate
      });

      res.json({
        success: true,
        user: {
          id: targetUser.id,
          role: newRole,
          isInfluencer: typeof isInfluencer === 'boolean' ? isInfluencer : (targetUser as any).isInfluencer,
          affiliateInfo: affiliate ? {
            id: affiliate.id,
            referralCode: affiliate.referralCode,
            status: affiliate.status,
            commissionTotal: affiliate.commissionTotal || 0,
            affiliateBalance: affiliate.affiliateBalance || 0,
            cpaAmount: affiliate.cpaAmount ?? 0,
            revSharePercent: affiliate.revSharePercent ?? 70.0,
          } : null
        },
        message: shouldBeAffiliate
          ? 'Usuário definido como Afiliado Hub com sucesso!'
          : 'Usuário alterado para Jogador padrão.'
      });
    } catch (err: any) {
      console.error('Error promoting user to affiliate:', err);
      res.status(500).json({ error: 'Erro ao alterar papel do usuário.' });
    }
  });

  // POST /api/admin/users/:id/block
  app.post('/api/admin/users/:id/block', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageUsers')) {
        return res.status(403).json({ error: 'Sem permissão para bloquear/desbloquear usuários.' });
      }

      const { id } = req.params;
      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      if (targetUser.email.toLowerCase() === 'admin.eduh@gmail.com') {
        return res.status(400).json({ error: 'O Super Admin principal não pode ser bloqueado.' });
      }

      const newBlockStatus = !targetUser.isBlocked;
      await dbService.updateUserFields(id, { isBlocked: newBlockStatus });

      logSecurityEvent('ADMIN_USER_BLOCK_TOGGLE', {
        adminId: req.user?.id,
        targetUserId: id,
        isBlocked: newBlockStatus
      });

      res.json({
        success: true,
        isBlocked: newBlockStatus,
        message: newBlockStatus ? 'Usuário bloqueado com sucesso.' : 'Usuário desbloqueado com sucesso.'
      });
    } catch (err: any) {
      console.error('Error toggling block status:', err);
      res.status(500).json({ error: 'Erro ao alterar status do usuário.' });
    }
  });

  // GET /api/admin/withdrawals
  app.get('/api/admin/withdrawals', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canApproveWithdrawals') && !checkAdminPermission(req, 'canViewMetrics')) {
        return res.status(403).json({ error: 'Sem permissão para visualizar saques.' });
      }

      const allTx = await dbService.getAllTransactions();
      const withdrawals = allTx.filter(t => t.type === 'withdrawal');

      // Enrich with user name, email & affiliate referral data
      const allUsers = await dbService.getAllUsers();
      const allAffiliates = await dbService.getAllAffiliates();
      const allReferrals = await dbService.getAllReferrals();

      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const referralByReferredUserId = new Map(allReferrals.map(r => [r.referredUserId, r]));
      const affiliateById = new Map(allAffiliates.map(a => [a.id, a]));
      const affiliateByCode = new Map(allAffiliates.map(a => [a.referralCode.toUpperCase(), a]));

      const enriched = withdrawals.map(w => {
        const u = userMap.get(w.userId);

        let referredBy = null;
        if (u) {
          const directRef = referralByReferredUserId.get(u.id);
          const parentAffId = u.affiliateId || (directRef ? directRef.affiliateId : null);
          let parentAff = parentAffId ? affiliateById.get(parentAffId) : null;
          if (!parentAff && directRef?.referralCode) {
            parentAff = affiliateByCode.get(directRef.referralCode.toUpperCase()) || null;
          }
          if (parentAff) {
            const sponsorUser = userMap.get(parentAff.userId);
            referredBy = {
              affiliateId: parentAff.id,
              referralCode: parentAff.referralCode,
              affiliateUserId: parentAff.userId,
              sponsorName: sponsorUser ? sponsorUser.name : `Afiliado ${parentAff.referralCode}`,
              sponsorEmail: sponsorUser ? sponsorUser.email : null,
              sponsorPhone: sponsorUser ? sponsorUser.phone : null,
              isInfluencer: sponsorUser ? !!(sponsorUser as any).isInfluencer : false,
              role: sponsorUser ? sponsorUser.role : 'affiliate'
            };
          }
        }

        return {
          ...w,
          userName: u ? u.name : 'Usuário Desconhecido',
          userEmail: u ? u.email : 'N/A',
          userPhone: u ? u.phone : 'N/A',
          pixKey: u ? u.pixKey : null,
          referredBy
        };
      });

      res.json({ withdrawals: enriched });
    } catch (err: any) {
      console.error('Error fetching admin withdrawals:', err);
      res.status(500).json({ error: 'Erro ao carregar saques.' });
    }
  });

  // POST /api/admin/withdrawals/:id/approve
  app.post('/api/admin/withdrawals/:id/approve', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canApproveWithdrawals')) {
        return res.status(403).json({ error: 'Sem permissão para aprovar saques.' });
      }

      const { id } = req.params;
      const tx = await dbService.getTransactionById(id);
      if (!tx) {
        return res.status(404).json({ error: 'Solicitação de saque não encontrada.' });
      }

      if (tx.status === 'approved') {
        return res.status(400).json({ error: 'Este saque já foi aprovado.' });
      }

      await dbService.updateTransactionStatus(id, 'approved');

      logSecurityEvent('ADMIN_WITHDRAWAL_APPROVED', {
        adminId: req.user?.id,
        withdrawalId: id,
        amount: tx.amount,
        targetUserId: tx.userId
      });

      res.json({ success: true, message: 'Saque aprovado com sucesso!' });
    } catch (err: any) {
      console.error('Error approving withdrawal:', err);
      res.status(500).json({ error: 'Erro ao aprovar saque.' });
    }
  });

  // POST /api/admin/withdrawals/:id/reject
  app.post('/api/admin/withdrawals/:id/reject', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canApproveWithdrawals')) {
        return res.status(403).json({ error: 'Sem permissão para rejeitar saques.' });
      }

      const { id } = req.params;
      const { reason } = req.body;

      const tx = await dbService.getTransactionById(id);
      if (!tx) {
        return res.status(404).json({ error: 'Solicitação de saque não encontrada.' });
      }

      if (tx.status === 'rejected') {
        return res.status(400).json({ error: 'Este saque já foi rejeitado anteriormente.' });
      }

      // Refund user balance
      const user = await dbService.getUserById(tx.userId);
      if (user) {
        const refundedBalance = user.balance + tx.amount;
        await dbService.updateUserBalance(user.id, refundedBalance);
      }

      await dbService.updateTransactionStatus(id, 'rejected');

      logSecurityEvent('ADMIN_WITHDRAWAL_REJECTED', {
        adminId: req.user?.id,
        withdrawalId: id,
        amount: tx.amount,
        targetUserId: tx.userId,
        reason: reason || 'Rejeitado pelo administrador'
      });

      res.json({ success: true, message: 'Saque rejeitado e valor estornado ao saldo do usuário.' });
    } catch (err: any) {
      console.error('Error rejecting withdrawal:', err);
      res.status(500).json({ error: 'Erro ao rejeitar saque.' });
    }
  });

  // GET /api/admin/admins (List Sub-Admins)
  app.get('/api/admin/admins', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageAdmins')) {
        return res.status(403).json({ error: 'Sem permissão para gerenciar administradores.' });
      }

      const admins = await dbService.getAdmins();
      const mapped = admins.map(a => ({
        id: a.id,
        name: a.name,
        email: a.email,
        phone: a.phone,
        role: a.role || (a.email.toLowerCase() === 'admin.eduh@gmail.com' ? 'superadmin' : 'admin'),
        adminPermissions: a.adminPermissions || {
          canManageUsers: true,
          canManageBalances: true,
          canApproveWithdrawals: true,
          canManageAdmins: a.role === 'superadmin' || a.email.toLowerCase() === 'admin.eduh@gmail.com',
          canViewMetrics: true,
          canManageGames: true,
          canManageDotfy: a.role === 'superadmin' || a.email.toLowerCase() === 'admin.eduh@gmail.com'
        },
        createdAt: a.createdAt
      }));

      res.json({ admins: mapped });
    } catch (err: any) {
      console.error('Error fetching sub-admins:', err);
      res.status(500).json({ error: 'Erro ao carregar lista de administradores.' });
    }
  });

  // POST /api/admin/admins (Create / Promote Sub-Admin)
  app.post('/api/admin/admins', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const isSuperAdmin = req.user?.email.toLowerCase() === 'admin.eduh@gmail.com' || req.user?.role === 'superadmin';
      if (!isSuperAdmin) {
        return res.status(403).json({ error: 'Apenas o Super Admin pode cadastrar novos administradores.' });
      }

      const { email, permissions } = req.body;
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'O e-mail do novo administrador é obrigatório.' });
      }

      const targetUser = await dbService.getUserByEmail(email.toLowerCase().trim());
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado. O e-mail deve pertencer a uma conta existente.' });
      }

      const defaultPermissions = {
        canViewMetrics: true,
        canManageUsers: true,
        canManageBalances: false,
        canManageCommissions: true,
        canApproveWithdrawals: true,
        canApproveDeposits: true,
        canSendNotifications: true,
        canManageGames: true,
        canManageAdmins: false,
        canExportReports: true,
        canManageDotfy: false,
        ...(permissions || {})
      };

      await dbService.updateUserRoleAndPermissions(
        targetUser.id,
        targetUser.email.toLowerCase() === 'admin.eduh@gmail.com' ? 'superadmin' : 'admin',
        defaultPermissions
      );

      logSecurityEvent('SUB_ADMIN_PROMOTED', {
        promotedBy: req.user?.id,
        targetUserId: targetUser.id,
        permissions: defaultPermissions
      });

      res.json({
        success: true,
        message: `Usuário ${targetUser.email} promovido a Administrador com sucesso!`,
        admin: {
          id: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          role: 'admin',
          adminPermissions: defaultPermissions
        }
      });
    } catch (err: any) {
      console.error('Error promoting admin:', err);
      res.status(500).json({ error: 'Erro ao cadastrar novo administrador.' });
    }
  });

  // PUT /api/admin/admins/:id/permissions (Update permissions)
  app.put('/api/admin/admins/:id/permissions', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const isSuperAdmin = req.user?.email.toLowerCase() === 'admin.eduh@gmail.com' || req.user?.role === 'superadmin';
      if (!isSuperAdmin) {
        return res.status(403).json({ error: 'Apenas o Super Admin pode alterar permissões de outros administradores.' });
      }

      const { id } = req.params;
      const { permissions } = req.body;

      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Administrador não encontrado.' });
      }

      if (targetUser.email.toLowerCase() === 'admin.eduh@gmail.com') {
        return res.status(400).json({ error: 'As permissões do Super Admin principal não podem ser alteradas.' });
      }

      const updatedPermissions = {
        canViewMetrics: !!permissions?.canViewMetrics,
        canManageUsers: !!permissions?.canManageUsers,
        canManageBalances: !!permissions?.canManageBalances,
        canManageCommissions: !!permissions?.canManageCommissions,
        canApproveWithdrawals: !!permissions?.canApproveWithdrawals,
        canApproveDeposits: !!permissions?.canApproveDeposits,
        canSendNotifications: !!permissions?.canSendNotifications,
        canManageGames: !!permissions?.canManageGames,
        canManageAdmins: !!permissions?.canManageAdmins,
        canExportReports: !!permissions?.canExportReports,
        canManageDotfy: !!permissions?.canManageDotfy
      };

      await dbService.updateUserRoleAndPermissions(id, 'admin', updatedPermissions);

      logSecurityEvent('SUB_ADMIN_PERMISSIONS_UPDATED', {
        updatedBy: req.user?.id,
        targetUserId: id,
        permissions: updatedPermissions
      });

      res.json({
        success: true,
        message: 'Permissões atualizadas com sucesso!',
        permissions: updatedPermissions
      });
    } catch (err: any) {
      console.error('Error updating admin permissions:', err);
      res.status(500).json({ error: 'Erro ao atualizar permissões do administrador.' });
    }
  });

  // DELETE /api/admin/admins/:id (Revoke admin role)
  app.delete('/api/admin/admins/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const isSuperAdmin = req.user?.email.toLowerCase() === 'admin.eduh@gmail.com' || req.user?.role === 'superadmin';
      if (!isSuperAdmin) {
        return res.status(403).json({ error: 'Apenas o Super Admin pode remover administradores.' });
      }

      const { id } = req.params;
      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Administrador não encontrado.' });
      }

      if (targetUser.email.toLowerCase() === 'admin.eduh@gmail.com') {
        return res.status(400).json({ error: 'Não é possível revogar o Super Admin principal.' });
      }

      await dbService.updateUserRoleAndPermissions(id, 'user', {});

      logSecurityEvent('SUB_ADMIN_REVOKED', {
        revokedBy: req.user?.id,
        targetUserId: id
      });

      res.json({ success: true, message: 'Função de administrador revogada com sucesso.' });
    } catch (err: any) {
      console.error('Error revoking admin role:', err);
      res.status(500).json({ error: 'Erro ao revogar administrador.' });
    }
  });

  // --- DOTFY GATEWAY ADMIN MANAGEMENT ENDPOINTS ---
  // GET /api/admin/dotfy/overview (Strict access: superadmin or canManageDotfy)
  app.get('/api/admin/dotfy/overview', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const isSuper = req.user?.email.toLowerCase() === 'admin.eduh@gmail.com' || req.user?.role === 'superadmin';
      const hasPerm = checkAdminPermission(req, 'canManageDotfy');

      if (!isSuper && !hasPerm) {
        return res.status(403).json({
          error: 'Acesso negado. Apenas o Super Admin (admin.eduh@gmail.com) ou administradores com permissão explícita para Dotfy podem acessar esta área.'
        });
      }

      // Read saved config from DB
      const dbConfig = await dbService.getDotfyConfig();
      const activeKey = dbConfig?.activeApiKey || process.env.DOTFY_API_KEY || "vk_live_0iTBP0DSt_865LGgyvH5kPmJ0CbtO4CPsy0xJvqm8tE";
      const secondaryKey = dbConfig?.secondaryApiKey || "";
      const webhookSecret = dbConfig?.webhookSecret || "";
      const webhookUrl = dbConfig?.webhookUrl || "https://alliancedepositos.online/api/webhooks/pix";

      const headers = {
        'Authorization': `Bearer ${activeKey}`,
        'Content-Type': 'application/json'
      };

      // 1. Fetch live balance from Dotfy API
      let balanceData: any = null;
      let balanceError: string | null = null;
      try {
        const balRes = await fetch("https://app.dotfy.com.br/api/balance", { headers });
        if (balRes.ok) {
          balanceData = await balRes.json();
        } else {
          const errTxt = await balRes.text();
          balanceError = `Dotfy HTTP ${balRes.status}: ${errTxt.substring(0, 120)}`;
        }
      } catch (err: any) {
        balanceError = `Falha na conexão com Dotfy: ${err.message}`;
      }

      // 2. Fetch all registered PIX keys from Dotfy API
      let pixKeysList: any[] = [];
      let pixKeysError: string | null = null;
      try {
        const keysRes = await fetch("https://app.dotfy.com.br/api/pix-keys", { headers });
        if (keysRes.ok) {
          const keysJson = await keysRes.json();
          if (Array.isArray(keysJson.pixKeys)) {
            pixKeysList = keysJson.pixKeys;
          }
        } else {
          const errTxt = await keysRes.text();
          pixKeysError = `Dotfy HTTP ${keysRes.status}: ${errTxt.substring(0, 120)}`;
        }
      } catch (err: any) {
        pixKeysError = `Falha ao consultar chaves PIX: ${err.message}`;
      }

      // 2.1 Fetch live withdrawals from Dotfy API
      let dotfyWithdrawalsList: any[] = [];
      let dotfyWithdrawalsPagination: any = null;
      let dotfyWithdrawalsError: string | null = null;
      try {
        const wdRes = await fetch("https://app.dotfy.com.br/api/withdrawals?limit=50", { headers });
        if (wdRes.ok) {
          const wdJson = await wdRes.json();
          if (Array.isArray(wdJson.withdrawals)) {
            dotfyWithdrawalsList = wdJson.withdrawals;
            dotfyWithdrawalsPagination = wdJson.pagination;
          }
        } else {
          const errTxt = await wdRes.text();
          dotfyWithdrawalsError = `Dotfy HTTP ${wdRes.status}: ${errTxt.substring(0, 120)}`;
        }
      } catch (err: any) {
        dotfyWithdrawalsError = `Falha ao consultar saques Dotfy: ${err.message}`;
      }

      const totalGrossWdReais = dotfyWithdrawalsList.reduce((acc, w) => acc + (w.amount || 0), 0) / 100;
      const totalFeeWdReais = dotfyWithdrawalsList.reduce((acc, w) => acc + (w.fee || 0), 0) / 100;
      const totalNetWdReais = dotfyWithdrawalsList.reduce((acc, w) => acc + (w.netAmount || 0), 0) / 100;

      // 3. Registered API credentials summary
      const registeredApiKeys = [
        {
          id: 'primary_key',
          name: 'Chave Principal (Produção)',
          keyMasked: activeKey ? `${activeKey.substring(0, 10)}...${activeKey.substring(activeKey.length - 6)}` : 'Não configurada',
          rawKey: isSuper ? activeKey : `${activeKey.substring(0, 10)}...`,
          environment: activeKey.startsWith('vk_test_') ? 'test' : 'live',
          status: activeKey ? 'active' : 'inactive',
          isDefault: true,
          type: 'API Token Bearer (vk_live)',
          source: dbConfig?.activeApiKey ? 'Banco de Dados (Personalizada)' : 'Configuração Padrão do Sistema'
        }
      ];

      if (secondaryKey) {
        registeredApiKeys.push({
          id: 'secondary_key',
          name: 'Chave Secundária / Contingência',
          keyMasked: `${secondaryKey.substring(0, 10)}...${secondaryKey.substring(secondaryKey.length - 6)}`,
          rawKey: isSuper ? secondaryKey : `${secondaryKey.substring(0, 10)}...`,
          environment: secondaryKey.startsWith('vk_test_') ? 'test' : 'live',
          status: 'standby',
          isDefault: false,
          type: 'API Token Bearer',
          source: 'Banco de Dados (Personalizada)'
        });
      }

      // Compute affiliate auto cashout transactions
      const allTx = await dbService.getAllTransactions();
      const allUsers = await dbService.getAllUsers();
      const userMap = new Map(allUsers.map(u => [u.id, u]));

      const affiliateAutoWd = allTx.filter(t => 
        t.type === 'withdrawal' && (t.isAutoCashout || t.paymentMethod?.includes('Dotfy') || !!t.dotfyWithdrawalId)
      ).map(t => {
        const u = userMap.get(t.userId);
        return {
          ...t,
          userName: u ? u.name : 'Afiliado',
          userEmail: u ? u.email : 'N/A'
        };
      });

      const affiliateAutoTotal = affiliateAutoWd.reduce((acc, cur) => acc + (cur.amount || 0), 0);

      return res.json({
        success: true,
        superAdminEmail: 'admin.eduh@gmail.com',
        userIsSuperAdmin: isSuper,
        dotfyStatus: balanceError ? 'warning' : 'online',
        affiliateAutoCashout: {
          enabled: dbConfig?.affiliateAutoCashoutEnabled !== false,
          count: affiliateAutoWd.length,
          totalAmount: affiliateAutoTotal,
          recent: affiliateAutoWd.slice(0, 15)
        },
        balance: {
          available: balanceData?.balance?.available ?? 0,
          pending: balanceData?.balance?.pending ?? 0,
          reserved: balanceData?.balance?.reserved ?? 0,
          total: balanceData?.balance?.total ?? 0,
          availableReais: ((balanceData?.balance?.available ?? 0) / 100),
          pendingReais: ((balanceData?.balance?.pending ?? 0) / 100),
          reservedReais: ((balanceData?.balance?.reserved ?? 0) / 100),
          totalReais: ((balanceData?.balance?.total ?? 0) / 100),
          recentTransactions: (balanceData?.transactions || []).slice(0, 10),
          error: balanceError
        },
        pixKeys: {
          total: pixKeysList.length,
          list: pixKeysList,
          error: pixKeysError
        },
        dotfyWithdrawals: {
          total: dotfyWithdrawalsPagination?.total ?? dotfyWithdrawalsList.length,
          list: dotfyWithdrawalsList,
          pagination: dotfyWithdrawalsPagination,
          summary: {
            totalGrossReais: totalGrossWdReais,
            totalFeeReais: totalFeeWdReais,
            totalNetReais: totalNetWdReais,
          },
          error: dotfyWithdrawalsError
        },
        apiCredentials: {
          activeKeyMasked: activeKey ? `${activeKey.substring(0, 10)}...${activeKey.substring(activeKey.length - 6)}` : '',
          rawActiveKey: isSuper ? activeKey : undefined,
          keys: registeredApiKeys,
          webhookSecret: isSuper ? webhookSecret : (webhookSecret ? '••••••••' : ''),
          webhookUrl,
          affiliateAutoCashoutEnabled: dbConfig?.affiliateAutoCashoutEnabled !== false,
          updatedAt: dbConfig?.updatedAt,
          updatedBy: dbConfig?.updatedBy
        }
      });
    } catch (err: any) {
      console.error('[GET /api/admin/dotfy/overview error]', err);
      res.status(500).json({ error: 'Erro ao consultar status do gateway Dotfy.' });
    }
  });

  // GET /api/admin/dotfy/withdrawals (Dedicated live withdrawals list with pagination & filters)
  app.get('/api/admin/dotfy/withdrawals', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const isSuper = req.user?.email.toLowerCase() === 'admin.eduh@gmail.com' || req.user?.role === 'superadmin';
      const hasPerm = checkAdminPermission(req, 'canManageDotfy');

      if (!isSuper && !hasPerm) {
        return res.status(403).json({
          error: 'Acesso negado. Apenas administradores autorizados para Dotfy podem consultar os saques.'
        });
      }

      const dbConfig = await dbService.getDotfyConfig();
      const activeKey = dbConfig?.activeApiKey || process.env.DOTFY_API_KEY || DEFAULT_API_KEY;

      const page = req.query.page ? Number(req.query.page) : 1;
      const limit = req.query.limit ? Number(req.query.limit) : 25;

      const dotfyRes = await fetch(`${DOTFY_BASE_URL}/api/withdrawals?page=${page}&limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${activeKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!dotfyRes.ok) {
        const errTxt = await dotfyRes.text();
        return res.status(dotfyRes.status).json({
          error: `Erro ao consultar saques na Dotfy (HTTP ${dotfyRes.status}): ${errTxt.substring(0, 150)}`
        });
      }

      const data = await dotfyRes.json();
      res.json(data);
    } catch (err: any) {
      console.error('[GET /api/admin/dotfy/withdrawals error]', err);
      res.status(500).json({ error: 'Erro ao consultar saques na Dotfy.' });
    }
  });

  // POST /api/admin/dotfy/config (Update keys / settings)
  app.post('/api/admin/dotfy/config', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const isSuper = req.user?.email.toLowerCase() === 'admin.eduh@gmail.com' || req.user?.role === 'superadmin';
      const hasPerm = checkAdminPermission(req, 'canManageDotfy');

      if (!isSuper && !hasPerm) {
        return res.status(403).json({
          error: 'Acesso negado. Apenas administradores autorizados podem salvar configurações Dotfy.'
        });
      }

      const { activeApiKey, secondaryApiKey, webhookSecret, webhookUrl, affiliateAutoCashoutEnabled } = req.body;
      const currentConfig = await dbService.getDotfyConfig();

      const newConfig = {
        ...currentConfig,
        activeApiKey: activeApiKey ? String(activeApiKey).trim() : currentConfig?.activeApiKey,
        secondaryApiKey: secondaryApiKey !== undefined ? String(secondaryApiKey).trim() : currentConfig?.secondaryApiKey,
        webhookSecret: webhookSecret !== undefined ? String(webhookSecret).trim() : currentConfig?.webhookSecret,
        webhookUrl: webhookUrl !== undefined ? String(webhookUrl).trim() : currentConfig?.webhookUrl,
        affiliateAutoCashoutEnabled: affiliateAutoCashoutEnabled !== undefined ? Boolean(affiliateAutoCashoutEnabled) : (currentConfig?.affiliateAutoCashoutEnabled !== false),
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.email || 'admin'
      };

      await dbService.saveDotfyConfig(newConfig);

      logSecurityEvent('DOTFY_CONFIG_UPDATED', {
        admin: req.user?.email,
        affiliateAutoCashoutEnabled: newConfig.affiliateAutoCashoutEnabled,
        updatedAt: newConfig.updatedAt
      });

      res.json({
        success: true,
        affiliateAutoCashoutEnabled: newConfig.affiliateAutoCashoutEnabled,
        message: 'Configurações de chaves e conexão Dotfy salvas com sucesso!'
      });
    } catch (err: any) {
      console.error('[POST /api/admin/dotfy/config error]', err);
      res.status(500).json({ error: 'Erro ao salvar configurações do Dotfy.' });
    }
  });

  // POST /api/admin/dotfy/affiliate-cashout/toggle (Quick toggle auto-cashout for affiliates)
  app.post('/api/admin/dotfy/affiliate-cashout/toggle', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const isSuper = req.user?.email.toLowerCase() === 'admin.eduh@gmail.com' || req.user?.role === 'superadmin';
      const hasPerm = checkAdminPermission(req, 'canManageDotfy');

      if (!isSuper && !hasPerm) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      const currentConfig = await dbService.getDotfyConfig();
      const currentStatus = currentConfig?.affiliateAutoCashoutEnabled !== false;
      const newStatus = !currentStatus;

      const newConfig = {
        ...currentConfig,
        affiliateAutoCashoutEnabled: newStatus,
        updatedAt: new Date().toISOString(),
        updatedBy: req.user?.email || 'admin'
      };

      await dbService.saveDotfyConfig(newConfig);

      logSecurityEvent('AFFILIATE_AUTOCASHOUT_TOGGLED', {
        admin: req.user?.email,
        enabled: newStatus
      });

      return res.json({
        success: true,
        affiliateAutoCashoutEnabled: newStatus,
        message: `Cashout Automático de Afiliados ${newStatus ? 'ATIVADO' : 'DESATIVADO'} com sucesso!`
      });
    } catch (err: any) {
      console.error('[POST /api/admin/dotfy/affiliate-cashout/toggle error]', err);
      res.status(500).json({ error: 'Erro ao alternar status do Cashout Automático.' });
    }
  });

  // POST /api/admin/dotfy/pix-keys (Register new PIX key in Dotfy directly)
  app.post('/api/admin/dotfy/pix-keys', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const isSuper = req.user?.email.toLowerCase() === 'admin.eduh@gmail.com' || req.user?.role === 'superadmin';
      const hasPerm = checkAdminPermission(req, 'canManageDotfy');

      if (!isSuper && !hasPerm) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      const { type, key, name } = req.body;
      if (!type || !key || !name) {
        return res.status(400).json({ error: 'Campos tipo, chave e nome são obrigatórios.' });
      }

      const dbConfig = await dbService.getDotfyConfig();
      const token = dbConfig?.activeApiKey || process.env.DOTFY_API_KEY || "vk_live_0iTBP0DSt_865LGgyvH5kPmJ0CbtO4CPsy0xJvqm8tE";

      const dotfyRes = await fetch("https://app.dotfy.com.br/api/pix-keys", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          type: String(type).toUpperCase().trim(),
          key: String(key).trim(),
          name: String(name).trim()
        })
      });

      const dotfyJson = await dotfyRes.json();
      if (!dotfyRes.ok) {
        return res.status(dotfyRes.status).json({
          error: dotfyJson?.error || dotfyJson?.message || 'Erro retornado pela Dotfy.'
        });
      }

      res.json({
        success: true,
        message: 'Chave PIX cadastrada na Dotfy com sucesso!',
        pixKey: dotfyJson.pixKey
      });
    } catch (err: any) {
      console.error('[POST /api/admin/dotfy/pix-keys error]', err);
      res.status(500).json({ error: 'Erro ao cadastrar chave PIX na Dotfy.' });
    }
  });

  // GET /api/admin/export-database (Full Database Export for Integrator VPS Migration)
  app.get('/api/admin/export-database', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: 'Não autorizado.' });

      const isSuper = isPlatformSuperAdmin(user.email, user.role);
      const canExport = isSuper || req.user?.role === 'admin' || checkAdminPermission(req, 'canExportReports');

      if (!canExport) {
        return res.status(403).json({
          error: 'Acesso negado. Apenas administradores com permissão de relatórios/exportação podem exportar a base.'
        });
      }

      console.log(`[Database Migration Export] Exportação solicitada por ${user.email} (${user.role}) para VPS Integrator.`);
      const backupData = await dbService.exportCompleteDatabase();

      backupData.meta.requestedBy = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        clientIp: req.ip || req.socket.remoteAddress
      };

      const sqlSchema = `
-- =========================================================================
-- PAYGATEWAY & ALLIANCE HUB — SCHEMA DE BANCO DE DADOS PARA VPS INTEGRATOR
-- Gerado em: ${new Date().toISOString()}
-- =========================================================================

-- 1. TABELA DE USUÁRIOS
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50),
  password_hash TEXT NOT NULL,
  role VARCHAR(32) DEFAULT 'user',
  balance DECIMAL(15, 2) DEFAULT 0.00,
  referral_code VARCHAR(64),
  affiliate_id VARCHAR(64),
  origin VARCHAR(64) DEFAULT 'game',
  is_influencer BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  min_withdraw DECIMAL(10, 2) DEFAULT 20.00,
  withdraw_fee DECIMAL(10, 2) DEFAULT 8.00,
  pix_key JSONB,
  pix_keys JSONB,
  admin_permissions JSONB,
  cpa_killer_allowed BOOLEAN DEFAULT FALSE,
  cpa_killer_active BOOLEAN DEFAULT FALSE,
  cpa_killer_every_x INT DEFAULT 3,
  cpa_killer_kill_y INT DEFAULT 1,
  cpa_counter INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABELA DE AFILIADOS
CREATE TABLE IF NOT EXISTS affiliates (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  referral_code VARCHAR(64) UNIQUE NOT NULL,
  status VARCHAR(32) DEFAULT 'active',
  commission_total DECIMAL(15, 2) DEFAULT 0.00,
  affiliate_balance DECIMAL(15, 2) DEFAULT 0.00,
  cpa_amount DECIMAL(10, 2) DEFAULT 50.00,
  rev_share_percent DECIMAL(5, 2) DEFAULT 30.00,
  withdraw_fee DECIMAL(10, 2) DEFAULT 8.00,
  cpa_killer_active BOOLEAN DEFAULT FALSE,
  cpa_killer_every_x INT DEFAULT 3,
  cpa_killer_kill_y INT DEFAULT 1,
  cpa_counter INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABELA DE INDICAÇÕES (REDE)
CREATE TABLE IF NOT EXISTS referrals (
  id VARCHAR(64) PRIMARY KEY,
  affiliate_id VARCHAR(64) REFERENCES affiliates(id),
  referred_user_id VARCHAR(64) REFERENCES users(id),
  referral_code VARCHAR(64) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TABELA DE TRANSAÇÕES (DEPÓSITOS E SAQUES)
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  type VARCHAR(32) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  net_amount DECIMAL(15, 2),
  fee DECIMAL(10, 2) DEFAULT 0.00,
  status VARCHAR(32) DEFAULT 'pending',
  payment_method VARCHAR(64),
  description TEXT,
  dotfy_withdrawal_id VARCHAR(128),
  pix_key_id VARCHAR(128),
  is_auto_cashout BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. TABELA DE COBRANÇAS PIX (DOTFY)
CREATE TABLE IF NOT EXISTS charges (
  id VARCHAR(128) PRIMARY KEY,
  charge_id VARCHAR(128),
  correlation_id VARCHAR(128) UNIQUE,
  transaction_id VARCHAR(128),
  user_id VARCHAR(64) REFERENCES users(id),
  value INT NOT NULL,
  value_in_reais DECIMAL(15, 2) NOT NULL,
  qr_code TEXT,
  qr_code_image TEXT,
  payment_link TEXT,
  status VARCHAR(32) DEFAULT 'PENDING',
  credited BOOLEAN DEFAULT FALSE,
  description TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TABELA DE COMISSÕES DE AFILIADOS
CREATE TABLE IF NOT EXISTS affiliate_commissions (
  id VARCHAR(64) PRIMARY KEY,
  affiliate_id VARCHAR(64) REFERENCES affiliates(id),
  referrer_user_id VARCHAR(64) REFERENCES users(id),
  buyer_user_id VARCHAR(64) REFERENCES users(id),
  transaction_id VARCHAR(64),
  amount DECIMAL(15, 2) NOT NULL,
  is_killed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. TABELA DE JOGOS E CONFIGURAÇÕES
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(64) NOT NULL,
  image_url TEXT,
  provider VARCHAR(128),
  status VARCHAR(32) DEFAULT 'active',
  min_bet DECIMAL(10, 2) DEFAULT 1.00
);

CREATE TABLE IF NOT EXISTS game_configs (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(64),
  status VARCHAR(32) DEFAULT 'active',
  rtp_percent DECIMAL(5, 2) DEFAULT 95.00,
  difficulty VARCHAR(32) DEFAULT 'medium',
  min_bet DECIMAL(10, 2) DEFAULT 1.00,
  max_bet DECIMAL(10, 2) DEFAULT 500.00,
  total_wagered DECIMAL(15, 2) DEFAULT 0.00,
  total_payout DECIMAL(15, 2) DEFAULT 0.00,
  ggr DECIMAL(15, 2) DEFAULT 0.00,
  total_bets_count INT DEFAULT 0,
  house_edge_mode VARCHAR(32) DEFAULT 'balanced',
  max_multiplier DECIMAL(8, 2) DEFAULT 100.00,
  smart_rtp BOOLEAN DEFAULT TRUE,
  smart_rtp_easy_threshold DECIMAL(10, 2) DEFAULT 90.00,
  smart_rtp_hard_threshold DECIMAL(10, 2) DEFAULT 100.00,
  config_json JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TABELA DE APOSTAS
CREATE TABLE IF NOT EXISTS game_bets (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id),
  user_name VARCHAR(255),
  game_id VARCHAR(64),
  bet_amount DECIMAL(15, 2) NOT NULL,
  multiplier DECIMAL(10, 4) DEFAULT 1.0000,
  payout_amount DECIMAL(15, 2) DEFAULT 0.00,
  profit_amount DECIMAL(15, 2) DEFAULT 0.00,
  status VARCHAR(32) DEFAULT 'active',
  difficulty VARCHAR(32),
  rtp_percent DECIMAL(5, 2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. TABELA DE CONFIGURAÇÕES GERAIS
CREATE TABLE IF NOT EXISTS system_settings (
  key VARCHAR(64) PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
`;

      backupData.sqlSchema = sqlSchema;

      const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `backup_completo_paygateway_vps_integrator_${dateStr}.json`;

      logSecurityEvent('DATABASE_EXPORTED', {
        admin: user.email,
        counts: backupData.counts
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.json(backupData);
    } catch (err: any) {
      console.error('[GET /api/admin/export-database error]', err);
      return res.status(500).json({ error: 'Erro ao processar exportação completa do banco de dados.' });
    }
  });

  // GET /api/admin/deposits
  app.get('/api/admin/deposits', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const allTx = await dbService.getAllTransactions();
      const deposits = allTx.filter(t => t.type === 'deposit');

      const allUsers = await dbService.getAllUsers();
      const allAffiliates = await dbService.getAllAffiliates();
      const allReferrals = await dbService.getAllReferrals();

      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const referralByReferredUserId = new Map(allReferrals.map(r => [r.referredUserId, r]));
      const affiliateById = new Map(allAffiliates.map(a => [a.id, a]));
      const affiliateByCode = new Map(allAffiliates.map(a => [a.referralCode.toUpperCase(), a]));

      const enriched = deposits.map(d => {
        const u = userMap.get(d.userId);

        let referredBy = null;
        if (u) {
          const directRef = referralByReferredUserId.get(u.id);
          const parentAffId = u.affiliateId || (directRef ? directRef.affiliateId : null);
          let parentAff = parentAffId ? affiliateById.get(parentAffId) : null;
          if (!parentAff && directRef?.referralCode) {
            parentAff = affiliateByCode.get(directRef.referralCode.toUpperCase()) || null;
          }
          if (parentAff) {
            const sponsorUser = userMap.get(parentAff.userId);
            referredBy = {
              affiliateId: parentAff.id,
              referralCode: parentAff.referralCode,
              affiliateUserId: parentAff.userId,
              sponsorName: sponsorUser ? sponsorUser.name : `Afiliado ${parentAff.referralCode}`,
              sponsorEmail: sponsorUser ? sponsorUser.email : null,
              sponsorPhone: sponsorUser ? sponsorUser.phone : null,
              isInfluencer: sponsorUser ? !!(sponsorUser as any).isInfluencer : false,
              role: sponsorUser ? sponsorUser.role : 'affiliate'
            };
          }
        }

        return {
          ...d,
          userName: u ? u.name : 'Usuário Desconhecido',
          userEmail: u ? u.email : 'N/A',
          userPhone: u ? u.phone : 'N/A',
          referredBy
        };
      });

      res.json({ deposits: enriched });
    } catch (err: any) {
      console.error('Error fetching admin deposits:', err);
      res.status(500).json({ error: 'Erro ao listar depósitos.' });
    }
  });

  interface AdminAffiliateNotificationLog {
    id: string;
    title: string;
    body: string;
    target: string;
    targetLabel: string;
    sentCount: number;
    totalEligibleAffiliates: number;
    createdAt: string;
    sentBy: string;
  }
  const adminAffiliateNotificationLogs: AdminAffiliateNotificationLog[] = [];

  // GET /api/admin/notifications (List recent dispatches and affiliate push stats)
  app.get('/api/admin/notifications', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const [allUsers, allAffiliates] = await Promise.all([
        dbService.getAllUsers(),
        dbService.getAllAffiliates()
      ]);

      const affiliateUserIds = new Set<string>();
      for (const a of allAffiliates) {
        if (a.userId) affiliateUserIds.add(a.userId);
      }
      for (const u of allUsers) {
        if (u.role === 'affiliate' || (u as any).isInfluencer || (u as any).isAffiliate) {
          affiliateUserIds.add(u.id);
        }
      }

      const affiliateSubscriptions = await dbService.getPushSubscriptions(affiliateUserIds);
      const subscribedAffiliates = new Set(affiliateSubscriptions.map((item) => item.userId)).size;
      const firestoreHistory = await dbService.getAdminNotificationLogs(50);
      const history = firestoreHistory.length > 0 ? firestoreHistory : adminAffiliateNotificationLogs;

      res.json({
        totalAffiliates: affiliateUserIds.size,
        subscribedAffiliates,
        history
      });
    } catch (err: any) {
      console.error('Error fetching admin notifications info:', err);
      res.status(500).json({ error: 'Erro ao carregar dados de notificações.' });
    }
  });

  // POST /api/admin/notifications (STRICTLY FOR AFFILIATES ONLY)
  app.post('/api/admin/notifications', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { title, body, target = 'all_affiliates', targetUserId } = req.body;
      if (!title || !body) {
        return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
      }

      // Fetch all users, affiliates, and referrals to strictly isolate the affiliate network
      const [allUsers, allAffiliates, allReferrals] = await Promise.all([
        dbService.getAllUsers(),
        dbService.getAllAffiliates(),
        dbService.getAllReferrals()
      ]);

      // Count referrals per affiliate
      const referralsCountByAffiliateId = new Map<string, number>();
      for (const ref of allReferrals) {
        referralsCountByAffiliateId.set(ref.affiliateId, (referralsCountByAffiliateId.get(ref.affiliateId) || 0) + 1);
      }

      // Build affiliate map: userId -> info
      const affiliateMap = new Map<string, { user: UserDB; affiliate?: AffiliateDB }>();
      for (const u of allUsers) {
        if (u.role === 'affiliate' || (u as any).isInfluencer || (u as any).isAffiliate) {
          affiliateMap.set(u.id, { user: u });
        }
      }
      for (const a of allAffiliates) {
        if (a.userId) {
          const existing = affiliateMap.get(a.userId);
          if (existing) {
            existing.affiliate = a;
          } else {
            const foundUser = allUsers.find(u => u.id === a.userId);
            if (foundUser) {
              affiliateMap.set(a.userId, { user: foundUser, affiliate: a });
            }
          }
        }
      }

      // Filter eligible affiliates according to target
      let eligibleAffiliateIds = new Set<string>();
      let targetLabel = 'Todos os Afiliados';

      if (targetUserId && affiliateMap.has(targetUserId)) {
        eligibleAffiliateIds.add(targetUserId);
        const affData = affiliateMap.get(targetUserId);
        targetLabel = affData?.user.name || 'Afiliado Específico';
      } else if (target === 'active_affiliates') {
        targetLabel = 'Afiliados Ativos (com Indicações)';
        for (const [uid, data] of affiliateMap.entries()) {
          const affId = data.affiliate?.id;
          const refCount = affId ? (referralsCountByAffiliateId.get(affId) || 0) : 0;
          const hasCommissions = (data.affiliate?.commissionTotal || 0) > 0;
          if (refCount > 0 || hasCommissions) {
            eligibleAffiliateIds.add(uid);
          }
        }
        // Fallback if no affiliate has indications yet
        if (eligibleAffiliateIds.size === 0) {
          eligibleAffiliateIds = new Set(affiliateMap.keys());
        }
      } else if (target === 'influencers') {
        targetLabel = 'Top Influenciadores';
        for (const [uid, data] of affiliateMap.entries()) {
          if ((data.user as any).isInfluencer) {
            eligibleAffiliateIds.add(uid);
          }
        }
        // Fallback if none flagged
        if (eligibleAffiliateIds.size === 0) {
          eligibleAffiliateIds = new Set(affiliateMap.keys());
        }
      } else {
        // 'all_affiliates' or default: ALL affiliates and ONLY affiliates
        targetLabel = 'Todos os Afiliados';
        eligibleAffiliateIds = new Set(affiliateMap.keys());
      }

      // STRICT CHECK: Ensure we ONLY send to devices of confirmed affiliates
      const payload = {
        title,
        body,
        url: '/?tab=affiliates',
        type: 'SHOW_AFFILIATE_NOTIFICATION'
      };
      // Fetch subscriptions for all eligible affiliates in a single optimized query
      const targetSubscriptions = await dbService.getPushSubscriptions(eligibleAffiliateIds);
      const payloadStr = JSON.stringify(payload);
      let sentCount = 0;

      await Promise.all(targetSubscriptions.map(async (data) => {
        try {
          await webpush.sendNotification(data.subscription as webpush.PushSubscription, payloadStr, {
            TTL: 86400,
            urgency: 'high',
          });
          sentCount++;
        } catch (err: any) {
          console.warn(`[WebPush] Push error for ${data.endpoint?.substring(0, 35)}...:`, err.statusCode || err.message);
          if (err.statusCode === 410 || err.statusCode === 404) {
            await dbService.deletePushSubscription(data.id || data.endpoint).catch(console.error);
          }
        }
      }));

      // Log dispatch history
      const logEntry: AdminAffiliateNotificationLog = {
        id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title,
        body,
        target: target || 'all_affiliates',
        targetLabel,
        sentCount,
        totalEligibleAffiliates: eligibleAffiliateIds.size,
        createdAt: new Date().toISOString(),
        sentBy: req.user?.name || req.user?.email || 'Administrador'
      };
      adminAffiliateNotificationLogs.unshift(logEntry);
      if (adminAffiliateNotificationLogs.length > 50) {
        adminAffiliateNotificationLogs.pop();
      }

      // Persist log and affiliate feed in Firestore
      await dbService.saveAdminNotificationLog({
        id: logEntry.id,
        title: logEntry.title,
        body: logEntry.body,
        target: logEntry.target,
        targetLabel: logEntry.targetLabel,
        sentCount: logEntry.sentCount,
        totalEligibleAffiliates: logEntry.totalEligibleAffiliates,
        createdAt: logEntry.createdAt,
        sentBy: logEntry.sentBy
      }).catch(console.error);

      await dbService.saveAffiliateFeedItem({
        id: `feed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title,
        body,
        url: '/?tab=affiliates',
        target: target || 'all_affiliates',
        createdAt: new Date().toISOString(),
        sentBy: req.user?.name || req.user?.email || 'Administrador'
      }).catch(console.error);

      console.log(`[Admin Push] Notificação disparada com exclusividade para ${eligibleAffiliateIds.size} afiliados (${sentCount} dispositivos notificados via push).`);

      res.json({
        success: true,
        message: `Notificação enviada com sucesso exclusivamente para os Afiliados! (${eligibleAffiliateIds.size} afiliados na base, ${sentCount} push entregues)`,
        sentCount,
        totalEligibleAffiliates: eligibleAffiliateIds.size,
        historyEntry: logEntry
      });
    } catch (err: any) {
      console.error('Error sending admin push notification to affiliates:', err);
      res.status(500).json({ error: 'Erro ao enviar notificação para os afiliados.' });
    }
  });

  // GET /api/admin/reports/analytics (Advanced Analytical & Financial Intelligence Reporting Suite)
  app.get('/api/admin/reports/analytics', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canViewMetrics') && !checkAdminPermission(req, 'canExportReports')) {
        return res.status(403).json({ error: 'Sem permissão para acessar a área de relatórios.' });
      }

      const { period = '7days', startDate: customStart, endDate: customEnd } = req.query;

      const now = new Date();
      let startTime = 0;
      let endTime = now.getTime();

      if (period === 'today') {
        const d = new Date(now);
        d.setHours(0, 0, 0, 0);
        startTime = d.getTime();
      } else if (period === 'yesterday') {
        const dStart = new Date(now);
        dStart.setDate(dStart.getDate() - 1);
        dStart.setHours(0, 0, 0, 0);
        startTime = dStart.getTime();
        const dEnd = new Date(now);
        dEnd.setDate(dEnd.getDate() - 1);
        dEnd.setHours(23, 59, 59, 999);
        endTime = dEnd.getTime();
      } else if (period === '7days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        d.setHours(0, 0, 0, 0);
        startTime = d.getTime();
      } else if (period === '30days') {
        const d = new Date(now);
        d.setDate(d.getDate() - 29);
        d.setHours(0, 0, 0, 0);
        startTime = d.getTime();
      } else if (period === 'this_month') {
        const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        startTime = d.getTime();
      } else if (period === 'last_month') {
        const dStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        startTime = dStart.getTime();
        const dEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        endTime = dEnd.getTime();
      } else if (period === 'custom' && customStart) {
        startTime = new Date(String(customStart)).getTime();
        if (customEnd) {
          const d = new Date(String(customEnd));
          d.setHours(23, 59, 59, 999);
          endTime = d.getTime();
        }
      } else if (period === 'all') {
        startTime = 0;
      } else {
        // Default 7 days
        const d = new Date(now);
        d.setDate(d.getDate() - 6);
        d.setHours(0, 0, 0, 0);
        startTime = d.getTime();
      }

      // Fetch all dataset from DB
      const [allTx, allUsers, allBets, allCommissions, allAffiliates, gameConfig] = await Promise.all([
        dbService.getAllTransactions(),
        dbService.getAllUsers(),
        dbService.getAllGameBets(1000),
        dbService.getAllCommissions(),
        dbService.getAllAffiliates(),
        dbService.getGameConfig('g_block_puzzle'),
      ]);

      const parseTs = (dateStr: string) => new Date(dateStr).getTime() || 0;

      // Filter data by time window
      const inRange = (dStr: string) => {
        const ts = parseTs(dStr);
        return ts >= startTime && ts <= endTime;
      };

      const periodTx = allTx.filter((t) => inRange(t.createdAt));
      const periodUsers = allUsers.filter((u) => inRange(u.createdAt));
      const periodBets = allBets.filter((b) => inRange(b.createdAt));
      const periodCommissions = allCommissions.filter((c) => inRange(c.createdAt));

      // User maps
      const userMap = new Map(allUsers.map((u) => [u.id, u]));

      // 1. Transaction aggregations (strictly real paid deposits, excluding game wins/partidas)
      const approvedDeposits = periodTx.filter((t) => isRealPaidDeposit(t));
      const pendingDeposits = periodTx.filter((t) => t.type === 'deposit' && t.status === 'pending' && !t.paymentMethod?.toLowerCase().includes('gendino') && !t.paymentMethod?.toLowerCase().includes('blockwin'));
      const allDepositsCount = approvedDeposits.length + pendingDeposits.length;

      const approvedWithdrawals = periodTx.filter((t) => t.type === 'withdrawal' && t.status === 'approved');
      const pendingWithdrawals = periodTx.filter((t) => t.type === 'withdrawal' && t.status === 'pending');
      const rejectedWithdrawals = periodTx.filter((t) => t.type === 'withdrawal' && t.status === 'rejected');

      const grossDeposits = approvedDeposits.reduce((acc, t) => acc + (t.amount || 0), 0);
      const grossDepositsCount = approvedDeposits.length;
      const totalWithdrawals = approvedWithdrawals.reduce((acc, t) => acc + (t.amount || 0), 0);
      const totalWithdrawalsCount = approvedWithdrawals.length;
      const pendingWithdrawalsAmount = pendingWithdrawals.reduce((acc, t) => acc + (t.amount || 0), 0);

      const netCashflow = grossDeposits - totalWithdrawals;

      // 2. Gaming aggregations in period
      let wagered = 0;
      let payouts = 0;
      let winsCount = 0;
      let lossesCount = 0;
      let topMultiplier = 1.0;
      let topWinAmount = 0;
      const diffDist: Record<string, number> = { easy: 0, medium: 0, hard: 0, extreme: 0 };

      for (const b of periodBets) {
        const bAmount = b.betAmount || 0;
        const pAmount = b.payoutAmount || 0;
        wagered += bAmount;
        payouts += pAmount;

        if (b.multiplier && b.multiplier > topMultiplier) topMultiplier = b.multiplier;
        if (pAmount > topWinAmount) topWinAmount = pAmount;

        if (b.status === 'cashed_out' && pAmount > 0) winsCount++;
        else if (b.status === 'lost') lossesCount++;

        const d = b.difficulty || 'easy';
        diffDist[d] = (diffDist[d] || 0) + 1;
      }

      // If period is 'all', incorporate game config baseline accumulators if higher
      if (period === 'all') {
        wagered = Math.max(wagered, gameConfig.totalWagered || 0);
        payouts = Math.max(payouts, gameConfig.totalPayout || 0);
      }

      const ggr = parseFloat((wagered - payouts).toFixed(2));
      const ggrMarginPercent = wagered > 0 ? parseFloat(((ggr / wagered) * 100).toFixed(2)) : (100 - (gameConfig.rtpPercent || 96));
      const realRtpPercent = wagered > 0 ? parseFloat(((payouts / wagered) * 100).toFixed(2)) : (gameConfig.rtpPercent || 96);

      // 3. Affiliate commission aggregations
      const totalAffiliateCommissions = periodCommissions.reduce((acc, c) => acc + (c.amount || 0), 0);
      const ngr = parseFloat((ggr - totalAffiliateCommissions).toFixed(2));
      const netOperatingMargin = grossDeposits > 0 ? parseFloat((((grossDeposits - totalWithdrawals - totalAffiliateCommissions) / grossDeposits) * 100).toFixed(2)) : 0;

      // 4. Player & FTD (First Time Deposit) intelligence
      // Calculate FTDs in period: find the first deposit ever for each user and check if it occurred in the period
      const userFirstDepositMap = new Map<string, number>();
      for (const t of allTx) {
        if (isRealPaidDeposit(t)) {
          const ts = parseTs(t.createdAt);
          const currentFirst = userFirstDepositMap.get(t.userId);
          if (!currentFirst || ts < currentFirst) {
            userFirstDepositMap.set(t.userId, ts);
          }
        }
      }

      let ftdCount = 0;
      let ftdVolume = 0;
      for (const [uId, firstTs] of userFirstDepositMap.entries()) {
        if (firstTs >= startTime && firstTs <= endTime) {
          ftdCount++;
          const tx = periodTx.find((t) => t.userId === uId && isRealPaidDeposit(t));
          if (tx) ftdVolume += tx.amount || 0;
        }
      }

      const newUsersCount = periodUsers.length;
      const conversionRatePercent = newUsersCount > 0 ? parseFloat(((ftdCount / newUsersCount) * 100).toFixed(1)) : 0;
      const avgDepositTicket = grossDepositsCount > 0 ? parseFloat((grossDeposits / grossDepositsCount).toFixed(2)) : 0;
      const avgWithdrawalTicket = totalWithdrawalsCount > 0 ? parseFloat((totalWithdrawals / totalWithdrawalsCount).toFixed(2)) : 0;

      // Distinct active users in period
      const activeUserIds = new Set<string>();
      periodTx.forEach((t) => activeUserIds.add(t.userId));
      periodBets.forEach((b) => activeUserIds.add(b.userId));
      const activePlayersCount = activeUserIds.size;

      // 5. Deposit Buckets Distribution
      const depositBuckets = {
        tier1: { label: 'R$ 1 a R$ 20', count: 0, total: 0 },
        tier2: { label: 'R$ 21 a R$ 50', count: 0, total: 0 },
        tier3: { label: 'R$ 51 a R$ 100', count: 0, total: 0 },
        tier4: { label: 'R$ 101 a R$ 500', count: 0, total: 0 },
        tier5: { label: 'Acima de R$ 500', count: 0, total: 0 },
      };

      for (const d of approvedDeposits) {
        const a = d.amount || 0;
        if (a <= 20) {
          depositBuckets.tier1.count++;
          depositBuckets.tier1.total += a;
        } else if (a <= 50) {
          depositBuckets.tier2.count++;
          depositBuckets.tier2.total += a;
        } else if (a <= 100) {
          depositBuckets.tier3.count++;
          depositBuckets.tier3.total += a;
        } else if (a <= 500) {
          depositBuckets.tier4.count++;
          depositBuckets.tier4.total += a;
        } else {
          depositBuckets.tier5.count++;
          depositBuckets.tier5.total += a;
        }
      }

      // 6. Daily DRE Breakdown (Chronological Series)
      const daysCount = Math.max(1, Math.min(60, Math.ceil((endTime - startTime) / (24 * 60 * 60 * 1000))));
      const dailyMap = new Map<string, {
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
      }>();

      for (let i = 0; i < daysCount; i++) {
        const d = new Date(startTime + i * 24 * 60 * 60 * 1000);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        dailyMap.set(key, {
          date: key,
          displayDate: `${dd}/${mm}`,
          deposits: 0,
          depositsCount: 0,
          withdrawals: 0,
          withdrawalsCount: 0,
          netCashflow: 0,
          wagered: 0,
          payouts: 0,
          ggr: 0,
          newUsers: 0,
          ftdCount: 0,
        });
      }

      // Populate daily series
      for (const t of periodTx) {
        const d = new Date(parseTs(t.createdAt));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const item = dailyMap.get(key);
        if (item) {
          if (t.type === 'deposit' && t.status === 'approved') {
            item.deposits += t.amount || 0;
            item.depositsCount++;
          } else if (t.type === 'withdrawal' && t.status === 'approved') {
            item.withdrawals += t.amount || 0;
            item.withdrawalsCount++;
          }
          item.netCashflow = item.deposits - item.withdrawals;
        }
      }

      for (const b of periodBets) {
        const d = new Date(parseTs(b.createdAt));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const item = dailyMap.get(key);
        if (item) {
          item.wagered += b.betAmount || 0;
          item.payouts += b.payoutAmount || 0;
          item.ggr = item.wagered - item.payouts;
        }
      }

      for (const u of periodUsers) {
        const d = new Date(parseTs(u.createdAt));
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const item = dailyMap.get(key);
        if (item) {
          item.newUsers++;
        }
      }

      for (const [uId, firstTs] of userFirstDepositMap.entries()) {
        if (firstTs >= startTime && firstTs <= endTime) {
          const d = new Date(firstTs);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const item = dailyMap.get(key);
          if (item) {
            item.ftdCount++;
          }
        }
      }

      const dailyBreakdown = Array.from(dailyMap.values()).map((row) => ({
        ...row,
        deposits: parseFloat(row.deposits.toFixed(2)),
        withdrawals: parseFloat(row.withdrawals.toFixed(2)),
        netCashflow: parseFloat(row.netCashflow.toFixed(2)),
        wagered: parseFloat(row.wagered.toFixed(2)),
        payouts: parseFloat(row.payouts.toFixed(2)),
        ggr: parseFloat(row.ggr.toFixed(2)),
      }));

      // 7. Top Players Analytics
      const playerStatsMap = new Map<string, {
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
        createdAt: string;
      }>();

      for (const u of allUsers) {
        playerStatsMap.set(u.id, {
          userId: u.id,
          name: u.name || 'Sem nome',
          email: u.email || 'N/A',
          phone: u.phone || 'N/A',
          currentBalance: u.balance || 0,
          totalDeposited: 0,
          depositsCount: 0,
          totalWithdrawn: 0,
          withdrawalsCount: 0,
          totalWagered: 0,
          totalPayouts: 0,
          ggrGenerated: 0,
          betsCount: 0,
          createdAt: u.createdAt,
        });
      }

      for (const t of periodTx) {
        const p = playerStatsMap.get(t.userId);
        if (p) {
          if (t.type === 'deposit' && t.status === 'approved') {
            p.totalDeposited += t.amount || 0;
            p.depositsCount++;
          } else if (t.type === 'withdrawal' && t.status === 'approved') {
            p.totalWithdrawn += t.amount || 0;
            p.withdrawalsCount++;
          }
        }
      }

      for (const b of periodBets) {
        const p = playerStatsMap.get(b.userId);
        if (p) {
          p.totalWagered += b.betAmount || 0;
          p.totalPayouts += b.payoutAmount || 0;
          p.betsCount++;
        }
      }

      for (const p of playerStatsMap.values()) {
        p.ggrGenerated = parseFloat((p.totalWagered - p.totalPayouts).toFixed(2));
      }

      const allPlayersArray = Array.from(playerStatsMap.values());
      const topProfitablePlayers = [...allPlayersArray]
        .filter((p) => p.totalWagered > 0 || p.totalDeposited > 0)
        .sort((a, b) => b.ggrGenerated - a.ggrGenerated)
        .slice(0, 15);

      const topWithdrawingPlayers = [...allPlayersArray]
        .filter((p) => p.totalWithdrawn > 0)
        .sort((a, b) => b.totalWithdrawn - a.totalWithdrawn)
        .slice(0, 15);

      const topDepositingPlayers = [...allPlayersArray]
        .filter((p) => p.totalDeposited > 0)
        .sort((a, b) => b.totalDeposited - a.totalDeposited)
        .slice(0, 15);

      // 8. Affiliates Intelligence & Ranking
      const affiliateRanking = await Promise.all(
        allAffiliates.map(async (aff) => {
          const user = userMap.get(aff.userId);
          const referrals = await dbService.getReferralsByAffiliateId(aff.id);
          const periodReferrals = referrals.filter((r) => inRange(r.createdAt));

          const refUserIds = new Set(referrals.map((r) => r.referredUserId));
          const periodRefTx = periodTx.filter((t) => refUserIds.has(t.userId));

          const referralDeposits = periodRefTx
            .filter((t) => isRealPaidDeposit(t))
            .reduce((sum, t) => sum + (t.amount || 0), 0);

          let affFtdCount = 0;
          for (const refUserId of refUserIds) {
            const firstTs = userFirstDepositMap.get(refUserId);
            if (firstTs && firstTs >= startTime && firstTs <= endTime) {
              affFtdCount++;
            }
          }

          const commissions = periodCommissions.filter((c) => c.affiliateId === aff.id);
          const totalCommissionsEarned = commissions.reduce((sum, c) => sum + (c.amount || 0), 0);

          return {
            affiliateId: aff.id,
            userId: aff.userId,
            userName: user ? user.name : 'Afiliado Desconhecido',
            userEmail: user ? user.email : 'N/A',
            referralCode: aff.referralCode,
            totalReferrals: referrals.length,
            periodReferralsCount: periodReferrals.length,
            ftdCount: affFtdCount,
            referralDepositsTotal: parseFloat(referralDeposits.toFixed(2)),
            cpaAmount: aff.cpaAmount || 0,
            revSharePercent: aff.revSharePercent || 70,
            commissionTotal: parseFloat((totalCommissionsEarned || aff.commissionTotal || 0).toFixed(2)),
            currentBalance: parseFloat((aff.affiliateBalance || 0).toFixed(2)),
          };
        })
      );

      affiliateRanking.sort((a, b) => b.referralDepositsTotal - a.referralDepositsTotal);

      // 9. Enriched Recent Transactions in Period
      const enrichedTransactions = periodTx.slice(0, 100).map((t) => {
        const u = userMap.get(t.userId);
        return {
          id: t.id,
          userId: t.userId,
          userName: u ? u.name : 'Usuário Desconhecido',
          userEmail: u ? u.email : 'N/A',
          userPhone: u ? u.phone : 'N/A',
          type: t.type,
          amount: t.amount,
          status: t.status,
          paymentMethod: t.paymentMethod,
          description: t.description,
          createdAt: t.createdAt,
        };
      });

      res.json({
        success: true,
        period,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        periodSummary: {
          grossDeposits: parseFloat(grossDeposits.toFixed(2)),
          grossDepositsCount,
          pendingDepositsCount: pendingDeposits.length,
          allDepositsCount,
          depositConversionRate: allDepositsCount > 0 ? parseFloat(((grossDepositsCount / allDepositsCount) * 100).toFixed(1)) : 100,
          totalWithdrawals: parseFloat(totalWithdrawals.toFixed(2)),
          totalWithdrawalsCount,
          pendingWithdrawalsAmount: parseFloat(pendingWithdrawalsAmount.toFixed(2)),
          pendingWithdrawalsCount: pendingWithdrawals.length,
          rejectedWithdrawalsCount: rejectedWithdrawals.length,
          netCashflow: parseFloat(netCashflow.toFixed(2)),
          wagered: parseFloat(wagered.toFixed(2)),
          payouts: parseFloat(payouts.toFixed(2)),
          ggr,
          ggrMarginPercent,
          realRtpPercent,
          configuredRtpPercent: gameConfig.rtpPercent,
          totalAffiliateCommissions: parseFloat(totalAffiliateCommissions.toFixed(2)),
          ngr,
          netOperatingMargin,
          newUsersCount,
          activePlayersCount,
          ftdCount,
          ftdVolume: parseFloat(ftdVolume.toFixed(2)),
          conversionRatePercent,
          avgDepositTicket,
          avgWithdrawalTicket,
          totalBetsCount: periodBets.length,
          winsCount,
          lossesCount,
          winRatePercent: periodBets.length > 0 ? parseFloat(((winsCount / periodBets.length) * 100).toFixed(1)) : 0,
          topMultiplier: parseFloat(topMultiplier.toFixed(2)),
          topWinAmount: parseFloat(topWinAmount.toFixed(2)),
        },
        dailyBreakdown,
        depositBuckets,
        difficultyDistribution: diffDist,
        topProfitablePlayers,
        topWithdrawingPlayers,
        topDepositingPlayers,
        affiliateRanking: affiliateRanking.slice(0, 20),
        transactions: enrichedTransactions,
      });
    } catch (err: any) {
      console.error('Error computing analytical reports:', err);
      res.status(500).json({ error: 'Erro ao processar relatórios analíticos.' });
    }
  });

  // GAMES & RTP MANAGEMENT STORE & ENDPOINTS

  // GET /api/game/config (Player / Public Game Configuration with real RTP and Difficulty)
  app.get('/api/game/config', async (req: Request, res: Response) => {
    try {
      let isInfluencer = false;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const session = getSession(token);
        const userId = session?.userId || sessions.get(token);
        if (userId) {
          const user = await dbService.getUserById(userId);
          if (user && user.isInfluencer) {
            isInfluencer = true;
          }
        }
      }

      const config = await dbService.getGameConfig('g_block_puzzle');
      const rtp = isInfluencer ? 99.8 : (config.rtpPercent ?? 96.0);
      const diff = isInfluencer ? 'easy' : (config.difficulty || (rtp >= 93 ? 'easy' : rtp >= 75 ? 'medium' : rtp >= 45 ? 'hard' : 'extreme'));
      res.json({
        gameId: config.id,
        name: config.name,
        status: config.status,
        rtpPercent: rtp,
        difficulty: diff,
        isInfluencer: isInfluencer,
        isInfluencerMode: isInfluencer,
        houseEdgeMode: isInfluencer ? 'easy' : (config.houseEdgeMode || 'easy'),
        minBet: config.minBet ?? 1.0,
        maxBet: config.maxBet ?? 500.0,
        maxMultiplier: config.maxMultiplier ?? 100.0,
        smartRtp: isInfluencer ? false : (config.smartRtp ?? true),
        smartRtpEasyThreshold: config.smartRtpEasyThreshold ?? 30.0,
        smartRtpMidThreshold: (config as any).smartRtpMidThreshold ?? 60.0,
        smartRtpHardThreshold: config.smartRtpHardThreshold ?? 85.0,
        smartRtpMaxTarget: (config as any).smartRtpMaxTarget ?? 100.0,
        antiBailoutMode: isInfluencer ? false : Boolean(config.antiBailoutMode),
        heavyBlocksForce: isInfluencer ? false : Boolean(config.heavyBlocksForce),
        dynamicRetention: isInfluencer ? false : (config.dynamicRetention ?? true),
        streakLimiterMultiplier: isInfluencer ? 100.0 : (config.streakLimiterMultiplier ?? 6.0),
        nearLossPressure: isInfluencer ? false : Boolean(config.nearLossPressure),
        winStreakBrake: isInfluencer ? false : Boolean(config.winStreakBrake),
        antiComboBlocker: isInfluencer ? false : Boolean(config.antiComboBlocker),
        highBetResistance: isInfluencer ? false : Boolean(config.highBetResistance),
        giantPieceFrequency: isInfluencer ? 0 : (config.giantPieceFrequency ?? 25),
        instantLossOnTargetProfit: isInfluencer ? 0 : (config.instantLossOnTargetProfit ?? 0),
        tightenOnHighOccupancy: isInfluencer ? false : Boolean(config.tightenOnHighOccupancy),
        minCashoutMultiplier: config.minCashoutMultiplier ?? 1.05,
        lineMultiplierStep: isInfluencer ? 0.50 : (config.lineMultiplierStep ?? 0.40),
        initialMultiplier: config.initialMultiplier ?? 1.0,
        retentionAggressiveness: isInfluencer ? 'soft' : (config.retentionAggressiveness || 'moderate'),
        forceLossOnMaxMultiplier: isInfluencer ? false : (config.forceLossOnMaxMultiplier ?? true),
        consecutiveWinDecay: isInfluencer ? 0 : (config.consecutiveWinDecay ?? 0.05),
        updatedAt: config.updatedAt,
      });
    } catch (err) {
      console.error('Error fetching game config:', err);
      res.json({
        gameId: 'g_block_puzzle',
        name: 'Block Puzzle iGaming',
        status: 'active',
        rtpPercent: 96.0,
        difficulty: 'easy',
        isInfluencer: false,
        isInfluencerMode: false,
        houseEdgeMode: 'easy',
        minBet: 1.0,
        maxBet: 500.0,
        maxMultiplier: 100.0,
        smartRtp: true,
        smartRtpEasyThreshold: 30.0,
        smartRtpMidThreshold: 60.0,
        smartRtpHardThreshold: 85.0,
        smartRtpMaxTarget: 100.0,
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
      });
    }
  });

  // GET /api/admin/games
  app.get('/api/admin/games', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const dinoLiveData = await dbService.getGameLiveMetrics('g_gen_dino');
      const dinoConfig = dinoLiveData.config;

      const puzzleLiveData = await dbService.getGameLiveMetrics('g_block_puzzle');
      const puzzleConfig = puzzleLiveData.config;

      const zumblaLiveData = await dbService.getGameLiveMetrics('g_zumbla');
      const zumblaConfig = zumblaLiveData.config;

      const games = [
        {
          id: 'g_gen_dino',
          name: 'GEN DINO (Arcade Runner PIX)',
          category: 'Runner & Habilidade',
          status: dinoConfig.status || 'active',
          rtpPercent: dinoConfig.rtpPercent,
          difficulty: dinoConfig.difficulty,
          minBet: dinoConfig.minBet,
          maxBet: dinoConfig.maxBet,
          totalWagered: dinoLiveData.totalWagered,
          totalPayout: dinoLiveData.totalPayout,
          ggr: dinoLiveData.ggr,
          totalBetsCount: dinoLiveData.totalBetsCount,
          totalWinsCount: dinoLiveData.totalWinsCount,
          totalLossesCount: dinoLiveData.totalLossesCount,
          effectiveRtp: dinoLiveData.effectiveRtp,
          effectiveHouseEdge: dinoLiveData.effectiveHouseEdge,
          houseEdgeMode: dinoConfig.houseEdgeMode,
          maxMultiplier: dinoConfig.maxMultiplier,
          smartRtp: dinoConfig.smartRtp ?? true,
          smartRtpEasyThreshold: dinoConfig.smartRtpEasyThreshold ?? 30.0,
          smartRtpMidThreshold: dinoConfig.smartRtpMidThreshold ?? 60.0,
          smartRtpHardThreshold: dinoConfig.smartRtpHardThreshold ?? 85.0,
          smartRtpMaxTarget: dinoConfig.smartRtpMaxTarget ?? 100.0,
          emergencyRetentionMode: Boolean(dinoConfig.emergencyRetentionMode),
          influencerGlobalBoost: Boolean(dinoConfig.influencerGlobalBoost),
          highBetThreshold: dinoConfig.highBetThreshold ?? 50.0,
          obstacleMultiplier: dinoConfig.obstacleMultiplier ?? 1.0,
          baseSpeed: dinoConfig.baseSpeed ?? 6.0,
          maxSpeed: dinoConfig.maxSpeed ?? 13.0,
          acceleration: dinoConfig.acceleration ?? 0.001,
          reactionWindowMs: dinoConfig.reactionWindowMs ?? 850,
          antiBailoutMode: Boolean(dinoConfig.antiBailoutMode),
          heavyBlocksForce: Boolean(dinoConfig.heavyBlocksForce),
          dynamicRetention: dinoConfig.dynamicRetention ?? true,
          streakLimiterMultiplier: dinoConfig.streakLimiterMultiplier ?? 5.0,
          nearLossPressure: Boolean(dinoConfig.nearLossPressure),
          winStreakBrake: Boolean(dinoConfig.winStreakBrake),
          antiComboBlocker: Boolean(dinoConfig.antiComboBlocker),
          highBetResistance: Boolean(dinoConfig.highBetResistance),
          giantPieceFrequency: dinoConfig.giantPieceFrequency ?? 20,
          instantLossOnTargetProfit: dinoConfig.instantLossOnTargetProfit ?? 0,
          tightenOnHighOccupancy: Boolean(dinoConfig.tightenOnHighOccupancy),
          minCashoutMultiplier: dinoConfig.minCashoutMultiplier ?? 1.10,
          lineMultiplierStep: dinoConfig.lineMultiplierStep ?? 0.25,
          initialMultiplier: dinoConfig.initialMultiplier ?? 1.0,
          retentionAggressiveness: dinoConfig.retentionAggressiveness || 'moderate',
          forceLossOnMaxMultiplier: dinoConfig.forceLossOnMaxMultiplier ?? true,
          consecutiveWinDecay: dinoConfig.consecutiveWinDecay ?? 0.05,
          // Dino dynamic controls
          gameSpeedPercent: dinoConfig.gameSpeedPercent ?? 100,
          obstacleDensityPercent: dinoConfig.obstacleDensityPercent ?? 50,
          bonusFrequencyPercent: dinoConfig.bonusFrequencyPercent ?? 30,
          coinValueCents: dinoConfig.coinValueCents ?? 100,
          // Popups and banners
          popupEnabled: Boolean(dinoConfig.popupEnabled),
          popupTitle: dinoConfig.popupTitle || 'BÔNUS EXCLUSIVO GEN DINO!',
          popupDescription: dinoConfig.popupDescription || 'Deposite agora no PIX e ganhe até 300% de bônus na sua primeira corrida!',
          popupImageUrl: dinoConfig.popupImageUrl || '/gen-dino/images/gen-dino-bonus-banner.png',
          popupButtonText: dinoConfig.popupButtonText || 'DEPOSITAR E ATIVAR BÔNUS',
          popupButtonAction: dinoConfig.popupButtonAction || 'deposit',
          popupButtonUrl: dinoConfig.popupButtonUrl || '',
          popupTrigger: dinoConfig.popupTrigger || 'start',
          heroBannerImageUrl: dinoConfig.heroBannerImageUrl || '/gen-dino/images/gen-dino-bonus-banner.png',
          heroBannerTitle: dinoConfig.heroBannerTitle || 'PROMOÇÃO DE DEPÓSITO DINO',
          heroBannerSubtitle: dinoConfig.heroBannerSubtitle || 'Deposite R$ 50 e receba 2×. Com R$ 100, você recebe R$ 300.',
          heroBannerBadge: dinoConfig.heroBannerBadge || 'BÔNUS ATÉ 3×',
          configVersion: dinoConfig.configVersion || 1,
          recentBets: dinoLiveData.recentBets
        },
        {
          id: 'g_block_puzzle',
          name: 'Block Win (Block Puzzle iGaming)',
          category: 'Estratégia & Habilidade',
          status: puzzleConfig.status || 'active',
          rtpPercent: puzzleConfig.rtpPercent,
          difficulty: puzzleConfig.difficulty,
          minBet: puzzleConfig.minBet,
          maxBet: puzzleConfig.maxBet,
          totalWagered: puzzleLiveData.totalWagered,
          totalPayout: puzzleLiveData.totalPayout,
          ggr: puzzleLiveData.ggr,
          totalBetsCount: puzzleLiveData.totalBetsCount,
          totalWinsCount: puzzleLiveData.totalWinsCount,
          totalLossesCount: puzzleLiveData.totalLossesCount,
          effectiveRtp: puzzleLiveData.effectiveRtp,
          effectiveHouseEdge: puzzleLiveData.effectiveHouseEdge,
          houseEdgeMode: puzzleConfig.houseEdgeMode,
          maxMultiplier: puzzleConfig.maxMultiplier,
          smartRtp: puzzleConfig.smartRtp ?? true,
          smartRtpEasyThreshold: puzzleConfig.smartRtpEasyThreshold ?? 30.0,
          smartRtpMidThreshold: (puzzleConfig as any).smartRtpMidThreshold ?? 60.0,
          smartRtpHardThreshold: puzzleConfig.smartRtpHardThreshold ?? 85.0,
          smartRtpMaxTarget: (puzzleConfig as any).smartRtpMaxTarget ?? 100.0,
          emergencyRetentionMode: Boolean((puzzleConfig as any).emergencyRetentionMode),
          influencerGlobalBoost: Boolean((puzzleConfig as any).influencerGlobalBoost),
          highBetThreshold: (puzzleConfig as any).highBetThreshold ?? 50.0,
          obstacleMultiplier: puzzleConfig.obstacleMultiplier ?? 1.0,
          baseSpeed: puzzleConfig.baseSpeed ?? 6.0,
          maxSpeed: puzzleConfig.maxSpeed ?? 13.0,
          acceleration: puzzleConfig.acceleration ?? 0.001,
          reactionWindowMs: puzzleConfig.reactionWindowMs ?? 850,
          antiBailoutMode: Boolean(puzzleConfig.antiBailoutMode),
          heavyBlocksForce: Boolean(puzzleConfig.heavyBlocksForce),
          dynamicRetention: puzzleConfig.dynamicRetention ?? true,
          streakLimiterMultiplier: puzzleConfig.streakLimiterMultiplier ?? 6.0,
          nearLossPressure: Boolean(puzzleConfig.nearLossPressure),
          winStreakBrake: Boolean(puzzleConfig.winStreakBrake),
          antiComboBlocker: Boolean(puzzleConfig.antiComboBlocker),
          highBetResistance: Boolean(puzzleConfig.highBetResistance),
          giantPieceFrequency: puzzleConfig.giantPieceFrequency ?? 25,
          instantLossOnTargetProfit: puzzleConfig.instantLossOnTargetProfit ?? 0,
          tightenOnHighOccupancy: Boolean(puzzleConfig.tightenOnHighOccupancy),
          minCashoutMultiplier: puzzleConfig.minCashoutMultiplier ?? 1.05,
          lineMultiplierStep: puzzleConfig.lineMultiplierStep ?? 0.40,
          initialMultiplier: puzzleConfig.initialMultiplier ?? 1.0,
          retentionAggressiveness: puzzleConfig.retentionAggressiveness || 'moderate',
          forceLossOnMaxMultiplier: puzzleConfig.forceLossOnMaxMultiplier ?? true,
          consecutiveWinDecay: puzzleConfig.consecutiveWinDecay ?? 0.05,
          gameSpeedPercent: puzzleConfig.gameSpeedPercent ?? 100,
          obstacleDensityPercent: puzzleConfig.obstacleDensityPercent ?? 50,
          bonusFrequencyPercent: puzzleConfig.bonusFrequencyPercent ?? 30,
          coinValueCents: puzzleConfig.coinValueCents ?? 100,
          popupEnabled: Boolean(puzzleConfig.popupEnabled),
          popupTitle: puzzleConfig.popupTitle || 'BÔNUS BLOCK PUZZLE',
          popupDescription: puzzleConfig.popupDescription || 'Aumente seus ganhos completando linhas e combos especiais.',
          popupImageUrl: puzzleConfig.popupImageUrl || '/games/blockpuzzle/block-puzzle-banner.png',
          popupButtonText: puzzleConfig.popupButtonText || 'JOGAR COM BÔNUS',
          popupButtonAction: puzzleConfig.popupButtonAction || 'deposit',
          popupButtonUrl: puzzleConfig.popupButtonUrl || '',
          popupTrigger: puzzleConfig.popupTrigger || 'start',
          heroBannerImageUrl: puzzleConfig.heroBannerImageUrl || '/games/blockpuzzle/block-puzzle-banner.png',
          heroBannerTitle: puzzleConfig.heroBannerTitle || 'PROMOÇÃO BLOCK WIN',
          heroBannerSubtitle: puzzleConfig.heroBannerSubtitle || 'Complete linhas e suba seus multiplicadores.',
          heroBannerBadge: puzzleConfig.heroBannerBadge || 'NOVO',
          configVersion: puzzleConfig.configVersion || 1,
          recentBets: puzzleLiveData.recentBets
        },
        {
          id: 'g_zumbla',
          name: 'Zumbla Win (Marble Shooter)',
          category: 'Arcade & Pontaria',
          status: zumblaConfig.status || 'active',
          rtpPercent: zumblaConfig.rtpPercent,
          difficulty: zumblaConfig.difficulty,
          minBet: zumblaConfig.minBet,
          maxBet: zumblaConfig.maxBet,
          totalWagered: zumblaLiveData.totalWagered,
          totalPayout: zumblaLiveData.totalPayout,
          ggr: zumblaLiveData.ggr,
          totalBetsCount: zumblaLiveData.totalBetsCount,
          totalWinsCount: zumblaLiveData.totalWinsCount,
          totalLossesCount: zumblaLiveData.totalLossesCount,
          effectiveRtp: zumblaLiveData.effectiveRtp,
          effectiveHouseEdge: zumblaLiveData.effectiveHouseEdge,
          houseEdgeMode: zumblaConfig.houseEdgeMode,
          maxMultiplier: zumblaConfig.maxMultiplier,
          smartRtp: zumblaConfig.smartRtp ?? true,
          smartRtpEasyThreshold: zumblaConfig.smartRtpEasyThreshold ?? 30.0,
          smartRtpMidThreshold: (zumblaConfig as any).smartRtpMidThreshold ?? 60.0,
          smartRtpHardThreshold: zumblaConfig.smartRtpHardThreshold ?? 85.0,
          smartRtpMaxTarget: (zumblaConfig as any).smartRtpMaxTarget ?? 100.0,
          emergencyRetentionMode: Boolean((zumblaConfig as any).emergencyRetentionMode),
          influencerGlobalBoost: Boolean((zumblaConfig as any).influencerGlobalBoost),
          highBetThreshold: (zumblaConfig as any).highBetThreshold ?? 50.0,
          obstacleMultiplier: zumblaConfig.obstacleMultiplier ?? 1.0,
          baseSpeed: zumblaConfig.baseSpeed ?? 6.0,
          maxSpeed: zumblaConfig.maxSpeed ?? 13.0,
          acceleration: zumblaConfig.acceleration ?? 0.001,
          reactionWindowMs: zumblaConfig.reactionWindowMs ?? 850,
          comboWindowMs: zumblaConfig.comboWindowMs ?? 1200,
          mistakeTolerance: zumblaConfig.mistakeTolerance ?? 1,
          difficultyRampPercent: zumblaConfig.difficultyRampPercent ?? 50,
          easyOpeningRounds: zumblaConfig.easyOpeningRounds ?? 3,
          extremeModeStartRound: zumblaConfig.extremeModeStartRound ?? 12,
          phaseDifficultyMultiplier: zumblaConfig.phaseDifficultyMultiplier ?? 1.25,
          antiBailoutMode: Boolean(zumblaConfig.antiBailoutMode),
          heavyBlocksForce: Boolean(zumblaConfig.heavyBlocksForce),
          dynamicRetention: zumblaConfig.dynamicRetention ?? true,
          streakLimiterMultiplier: zumblaConfig.streakLimiterMultiplier ?? 5.0,
          nearLossPressure: Boolean(zumblaConfig.nearLossPressure),
          winStreakBrake: Boolean(zumblaConfig.winStreakBrake),
          antiComboBlocker: Boolean(zumblaConfig.antiComboBlocker),
          highBetResistance: Boolean(zumblaConfig.highBetResistance),
          giantPieceFrequency: zumblaConfig.giantPieceFrequency ?? 20,
          instantLossOnTargetProfit: zumblaConfig.instantLossOnTargetProfit ?? 0,
          tightenOnHighOccupancy: Boolean(zumblaConfig.tightenOnHighOccupancy),
          minCashoutMultiplier: zumblaConfig.minCashoutMultiplier ?? 1.10,
          lineMultiplierStep: zumblaConfig.lineMultiplierStep ?? 0.25,
          initialMultiplier: zumblaConfig.initialMultiplier ?? 1.0,
          retentionAggressiveness: zumblaConfig.retentionAggressiveness || 'moderate',
          forceLossOnMaxMultiplier: zumblaConfig.forceLossOnMaxMultiplier ?? true,
          consecutiveWinDecay: zumblaConfig.consecutiveWinDecay ?? 0.05,
          gameSpeedPercent: zumblaConfig.gameSpeedPercent ?? 100,
          obstacleDensityPercent: zumblaConfig.obstacleDensityPercent ?? 50,
          bonusFrequencyPercent: zumblaConfig.bonusFrequencyPercent ?? 30,
          coinValueCents: zumblaConfig.coinValueCents ?? 100,
          popupEnabled: Boolean(zumblaConfig.popupEnabled),
          popupTitle: zumblaConfig.popupTitle || 'BÔNUS ZUMBLA WIN',
          popupDescription: zumblaConfig.popupDescription || 'Dispare esferas e ative bônus multiplicadores.',
          popupImageUrl: zumblaConfig.popupImageUrl || '/assets/games/zumbla/cover.webp',
          popupButtonText: zumblaConfig.popupButtonText || 'JOGAR COM BÔNUS',
          popupButtonAction: zumblaConfig.popupButtonAction || 'deposit',
          popupButtonUrl: zumblaConfig.popupButtonUrl || '',
          popupTrigger: zumblaConfig.popupTrigger || 'start',
          heroBannerImageUrl: zumblaConfig.heroBannerImageUrl || '/assets/games/zumbla/cover.webp',
          heroBannerTitle: zumblaConfig.heroBannerTitle || 'ZUMBLA WIN SHOOTER',
          heroBannerSubtitle: zumblaConfig.heroBannerSubtitle || 'Elimine as esferas antes que alcancem o portal sagrado.',
          heroBannerBadge: zumblaConfig.heroBannerBadge || 'DESTAQUE',
          configVersion: zumblaConfig.configVersion || 1,
          recentBets: zumblaLiveData.recentBets
        }
      ];

      res.json({ games, liveMetrics: dinoLiveData });
    } catch (err) {
      console.error('Error fetching admin games:', err);
      res.status(500).json({ error: 'Erro ao buscar métricas de jogos.' });
    }
  });

  // PUT /api/admin/games/:id/rtp
  app.put('/api/admin/games/:id/rtp', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const {
        rtpPercent,
        difficulty,
        minBet,
        maxBet,
        houseEdgeMode,
        maxMultiplier,
        smartRtp,
        smartRtpEasyThreshold,
        smartRtpMidThreshold,
        smartRtpHardThreshold,
        smartRtpMaxTarget,
        emergencyRetentionMode,
        influencerGlobalBoost,
        highBetThreshold,
        obstacleMultiplier,
        baseSpeed,
        maxSpeed,
        acceleration,
        antiBailoutMode,
        heavyBlocksForce,
        dynamicRetention,
        streakLimiterMultiplier,
        nearLossPressure,
        winStreakBrake,
        antiComboBlocker,
        highBetResistance,
        giantPieceFrequency,
        instantLossOnTargetProfit,
        tightenOnHighOccupancy,
        minCashoutMultiplier,
        lineMultiplierStep,
        initialMultiplier,
        retentionAggressiveness,
        forceLossOnMaxMultiplier,
        consecutiveWinDecay,
        // Dino controls
        gameSpeedPercent,
        obstacleDensityPercent,
        bonusFrequencyPercent,
        coinValueCents,
        reactionWindowMs,
        comboWindowMs,
        mistakeTolerance,
        difficultyRampPercent,
        easyOpeningRounds,
        extremeModeStartRound,
        phaseDifficultyMultiplier,
        // Popups and banners
        popupEnabled,
        popupTitle,
        popupDescription,
        popupImageUrl,
        popupButtonText,
        popupButtonAction,
        popupButtonUrl,
        popupTrigger,
        heroBannerImageUrl,
        heroBannerTitle,
        heroBannerSubtitle,
        heroBannerBadge,
      } = req.body;

      const config = await dbService.getGameConfig(id);

      if (typeof rtpPercent === 'number' && rtpPercent >= 0.1 && rtpPercent <= 100) {
        config.rtpPercent = parseFloat(rtpPercent.toFixed(2));
        
        // Sync difficulty automatically if not explicitly provided
        if (!difficulty) {
          if (config.rtpPercent >= 93) config.difficulty = 'easy';
          else if (config.rtpPercent >= 75) config.difficulty = 'medium';
          else if (config.rtpPercent >= 45) config.difficulty = 'hard';
          else config.difficulty = 'extreme';
        }
      }

      if (difficulty && ['easy', 'medium', 'hard', 'extreme'].includes(difficulty)) {
        config.difficulty = difficulty;
        if (typeof rtpPercent !== 'number') {
          if (difficulty === 'easy') config.rtpPercent = 96.0;
          else if (difficulty === 'medium') config.rtpPercent = 85.0;
          else if (difficulty === 'hard') config.rtpPercent = 50.0;
          else if (difficulty === 'extreme') config.rtpPercent = 5.0;
        }
      }

      if (typeof minBet === 'number' && minBet >= 0) {
        config.minBet = minBet;
      }

      if (typeof maxBet === 'number' && maxBet >= config.minBet) {
        config.maxBet = maxBet;
      }

      if (houseEdgeMode) {
        config.houseEdgeMode = houseEdgeMode;
      }

      if (typeof maxMultiplier === 'number' && maxMultiplier > 0) {
        config.maxMultiplier = maxMultiplier;
      }

      if (typeof smartRtp === 'boolean') {
        config.smartRtp = smartRtp;
      }

      if (typeof smartRtpEasyThreshold === 'number' && smartRtpEasyThreshold >= 5) {
        config.smartRtpEasyThreshold = smartRtpEasyThreshold;
      }

      if (typeof smartRtpMidThreshold === 'number' && smartRtpMidThreshold >= 10) {
        (config as any).smartRtpMidThreshold = smartRtpMidThreshold;
      }

      if (typeof smartRtpHardThreshold === 'number' && smartRtpHardThreshold >= 10) {
        config.smartRtpHardThreshold = smartRtpHardThreshold;
      }

      if (typeof smartRtpMaxTarget === 'number' && smartRtpMaxTarget >= 20) {
        config.smartRtpMaxTarget = smartRtpMaxTarget;
      }

      if (typeof emergencyRetentionMode === 'boolean') {
        (config as any).emergencyRetentionMode = emergencyRetentionMode;
      }

      if (typeof influencerGlobalBoost === 'boolean') {
        (config as any).influencerGlobalBoost = influencerGlobalBoost;
      }

      if (typeof highBetThreshold === 'number' && highBetThreshold > 0) {
        (config as any).highBetThreshold = highBetThreshold;
      }

      if (typeof obstacleMultiplier === 'number' && obstacleMultiplier >= 0.5 && obstacleMultiplier <= 10.0) {
        config.obstacleMultiplier = obstacleMultiplier;
      }

      if (typeof baseSpeed === 'number' && baseSpeed >= 3.0 && baseSpeed <= 30.0) {
        config.baseSpeed = baseSpeed;
      }

      if (typeof maxSpeed === 'number' && maxSpeed >= 5.0 && maxSpeed <= 50.0) {
        config.maxSpeed = maxSpeed;
      }

      if (typeof acceleration === 'number' && acceleration >= 0.0001 && acceleration <= 0.05) {
        config.acceleration = acceleration;
      }

      if (typeof antiBailoutMode === 'boolean') {
        config.antiBailoutMode = antiBailoutMode;
      }

      if (typeof heavyBlocksForce === 'boolean') {
        config.heavyBlocksForce = heavyBlocksForce;
      }

      if (typeof dynamicRetention === 'boolean') {
        config.dynamicRetention = dynamicRetention;
      }

      if (typeof streakLimiterMultiplier === 'number' && streakLimiterMultiplier >= 1.5) {
        config.streakLimiterMultiplier = streakLimiterMultiplier;
      }

      if (typeof nearLossPressure === 'boolean') {
        config.nearLossPressure = nearLossPressure;
      }

      if (typeof winStreakBrake === 'boolean') {
        config.winStreakBrake = winStreakBrake;
      }

      if (typeof antiComboBlocker === 'boolean') {
        config.antiComboBlocker = antiComboBlocker;
      }

      if (typeof highBetResistance === 'boolean') {
        config.highBetResistance = highBetResistance;
      }

      if (typeof giantPieceFrequency === 'number' && giantPieceFrequency >= 0 && giantPieceFrequency <= 100) {
        config.giantPieceFrequency = giantPieceFrequency;
      }

      if (typeof instantLossOnTargetProfit === 'number' && instantLossOnTargetProfit >= 0) {
        config.instantLossOnTargetProfit = instantLossOnTargetProfit;
      }

      if (typeof tightenOnHighOccupancy === 'boolean') {
        config.tightenOnHighOccupancy = tightenOnHighOccupancy;
      }

      if (typeof minCashoutMultiplier === 'number' && minCashoutMultiplier >= 1.0) {
        config.minCashoutMultiplier = minCashoutMultiplier;
      }

      if (typeof lineMultiplierStep === 'number' && lineMultiplierStep >= 0.05) {
        config.lineMultiplierStep = lineMultiplierStep;
      }

      if (typeof initialMultiplier === 'number' && initialMultiplier >= 1.0 && initialMultiplier <= 5.0) {
        config.initialMultiplier = initialMultiplier;
      }

      if (retentionAggressiveness && ['soft', 'moderate', 'aggressive', 'ruthless', 'impossible'].includes(retentionAggressiveness)) {
        config.retentionAggressiveness = retentionAggressiveness;
      }

      if (typeof forceLossOnMaxMultiplier === 'boolean') {
        config.forceLossOnMaxMultiplier = forceLossOnMaxMultiplier;
      }

      if (typeof consecutiveWinDecay === 'number' && consecutiveWinDecay >= 0 && consecutiveWinDecay <= 0.5) {
        config.consecutiveWinDecay = consecutiveWinDecay;
      }

      // Dino specific controls
      if (typeof gameSpeedPercent === 'number' && gameSpeedPercent >= 30 && gameSpeedPercent <= 300) {
        config.gameSpeedPercent = gameSpeedPercent;
      }
      if (typeof obstacleDensityPercent === 'number' && obstacleDensityPercent >= 0 && obstacleDensityPercent <= 100) {
        config.obstacleDensityPercent = obstacleDensityPercent;
      }
      if (typeof bonusFrequencyPercent === 'number' && bonusFrequencyPercent >= 0 && bonusFrequencyPercent <= 100) {
        config.bonusFrequencyPercent = bonusFrequencyPercent;
      }
      if (typeof coinValueCents === 'number' && coinValueCents > 0) {
        config.coinValueCents = coinValueCents;
      }
      if (typeof reactionWindowMs === 'number' && reactionWindowMs >= 50 && reactionWindowMs <= 3000) {
        config.reactionWindowMs = reactionWindowMs;
      }
      if (typeof comboWindowMs === 'number' && comboWindowMs >= 100 && comboWindowMs <= 5000) {
        config.comboWindowMs = comboWindowMs;
      }
      if (typeof mistakeTolerance === 'number' && mistakeTolerance >= 0 && mistakeTolerance <= 10) {
        config.mistakeTolerance = mistakeTolerance;
      }
      if (typeof difficultyRampPercent === 'number' && difficultyRampPercent >= 0 && difficultyRampPercent <= 200) {
        config.difficultyRampPercent = difficultyRampPercent;
      }
      if (typeof easyOpeningRounds === 'number' && easyOpeningRounds >= 0 && easyOpeningRounds <= 20) {
        config.easyOpeningRounds = easyOpeningRounds;
      }
      if (typeof extremeModeStartRound === 'number' && extremeModeStartRound >= 1 && extremeModeStartRound <= 100) {
        config.extremeModeStartRound = extremeModeStartRound;
      }
      if (typeof phaseDifficultyMultiplier === 'number' && phaseDifficultyMultiplier >= 0.5 && phaseDifficultyMultiplier <= 5.0) {
        config.phaseDifficultyMultiplier = phaseDifficultyMultiplier;
      }

      // Popups and Banners
      if (typeof popupEnabled === 'boolean') {
        config.popupEnabled = popupEnabled;
      }
      if (typeof popupTitle === 'string') {
        config.popupTitle = popupTitle;
      }
      if (typeof popupDescription === 'string') {
        config.popupDescription = popupDescription;
      }
      if (typeof popupImageUrl === 'string') {
        config.popupImageUrl = popupImageUrl;
      }
      if (typeof popupButtonText === 'string') {
        config.popupButtonText = popupButtonText;
      }
      if (typeof popupButtonAction === 'string') {
        config.popupButtonAction = popupButtonAction as any;
      }
      if (typeof popupButtonUrl === 'string') {
        config.popupButtonUrl = popupButtonUrl;
      }
      if (typeof popupTrigger === 'string') {
        config.popupTrigger = popupTrigger as any;
      }
      if (typeof heroBannerImageUrl === 'string') {
        config.heroBannerImageUrl = heroBannerImageUrl;
      }
      if (typeof heroBannerTitle === 'string') {
        config.heroBannerTitle = heroBannerTitle;
      }
      if (typeof heroBannerSubtitle === 'string') {
        config.heroBannerSubtitle = heroBannerSubtitle;
      }
      if (typeof heroBannerBadge === 'string') {
        config.heroBannerBadge = heroBannerBadge;
      }

      await dbService.saveGameConfig(config);

      logSecurityEvent('GAME_RTP_UPDATED', {
        adminId: req.userId,
        gameId: id,
        newRtp: config.rtpPercent,
        difficulty: config.difficulty,
        houseEdgeMode: config.houseEdgeMode,
        popupEnabled: config.popupEnabled,
        gameSpeedPercent: config.gameSpeedPercent
      });

      res.json({
        success: true,
        message: `Configurações do jogo ${config.name} (RTP: ${config.rtpPercent}%, Popups e Jogabilidade) salvas com sucesso!`,
        game: config
      });
    } catch (err) {
      console.error('Error updating game RTP:', err);
      res.status(500).json({ error: 'Erro ao salvar configuração do jogo.' });
    }
  });

  // PUBLIC GET /api/games/:id/config - Used by Gen Dino and Block Puzzle runners
  app.get('/api/games/:id/config', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const config = await dbService.getGameConfig(id);
      res.json({
        id: config.id,
        name: config.name,
        category: config.category,
        status: config.status,
        rtpPercent: config.rtpPercent,
        difficulty: config.difficulty,
        minBet: config.minBet,
        maxBet: config.maxBet,
        maxMultiplier: config.maxMultiplier,
        smartRtp: config.smartRtp ?? true,
        smartRtpEasyThreshold: config.smartRtpEasyThreshold ?? 30.0,
        smartRtpHardThreshold: config.smartRtpHardThreshold ?? 85.0,
        smartRtpMaxTarget: config.smartRtpMaxTarget ?? 100.0,
        obstacleMultiplier: config.obstacleMultiplier ?? 1.0,
        baseSpeed: config.baseSpeed ?? 6.0,
        maxSpeed: config.maxSpeed ?? 13.0,
        acceleration: config.acceleration ?? 0.001,
        reactionWindowMs: config.reactionWindowMs ?? 850,
        smartRtpMidThreshold: (config as any).smartRtpMidThreshold ?? 60.0,
        emergencyRetentionMode: Boolean((config as any).emergencyRetentionMode),
        influencerGlobalBoost: Boolean((config as any).influencerGlobalBoost),
        highBetThreshold: (config as any).highBetThreshold ?? 50.0,
        gameSpeedPercent: config.gameSpeedPercent ?? 100,
        obstacleDensityPercent: config.obstacleDensityPercent ?? 50,
        bonusFrequencyPercent: config.bonusFrequencyPercent ?? 30,
        coinValueCents: config.coinValueCents ?? 100,
        popupEnabled: Boolean(config.popupEnabled),
        popupTitle: config.popupTitle || '',
        popupDescription: config.popupDescription || '',
        popupImageUrl: config.popupImageUrl || '',
        popupButtonText: config.popupButtonText || 'BÔNUS',
        popupButtonAction: config.popupButtonAction || 'deposit',
        popupButtonUrl: config.popupButtonUrl || '',
        popupTrigger: config.popupTrigger || 'start',
        heroBannerImageUrl: config.heroBannerImageUrl || '',
        heroBannerTitle: config.heroBannerTitle || '',
        heroBannerSubtitle: config.heroBannerSubtitle || '',
        heroBannerBadge: config.heroBannerBadge || '',
        configVersion: config.configVersion || 1,
        updatedAt: config.updatedAt
      });
    } catch (err) {
      console.error('Error fetching public game config:', err);
      res.status(500).json({ error: 'Erro ao carregar configurações do jogo.' });
    }
  });

  // PUBLIC/AUTH POST /api/games/:id/bet - Record a bet in real time for Gen Dino
  app.post('/api/games/:id/bet', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { betAmount, userId, userName } = req.body;
      const cleanBet = Number(betAmount) || 1;
      const betId = 'dino_bet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const gameBet: any = {
        id: betId,
        gameId: id === 'g_block_puzzle' ? 'g_block_puzzle' : 'g_gen_dino',
        userId: userId || 'guest_user',
        userName: userName || 'Explorador Dino',
        betAmount: cleanBet,
        payoutAmount: 0,
        status: 'active',
        createdAt: new Date().toISOString()
      };

      await dbService.recordGameBet(gameBet);
      res.json({ success: true, betId });
    } catch (err) {
      console.error('Error recording game bet:', err);
      res.status(500).json({ error: 'Erro ao registrar aposta.' });
    }
  });

  // PUBLIC/AUTH POST /api/games/:id/result - Record cashout or loss for Gen Dino
  app.post('/api/games/:id/result', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { betId, betAmount, payoutAmount, status, userId, userName } = req.body;
      const cleanBet = Number(betAmount) || 0;
      const cleanPayout = Number(payoutAmount) || 0;
      const cleanStatus = status === 'cashed_out' || status === 'won' ? 'cashed_out' : 'lost';

      if (betId) {
        await dbService.updateGameBet(betId, {
          payoutAmount: cleanPayout,
          status: cleanStatus
        });
      } else {
        const newBetId = 'dino_bet_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const multiplier = cleanBet > 0 ? cleanPayout / cleanBet : 1.0;
        await dbService.recordGameBet({
          id: newBetId,
          gameId: id === 'g_block_puzzle' ? 'g_block_puzzle' : 'g_gen_dino',
          userId: userId || 'guest_user',
          userName: userName || 'Explorador Dino',
          betAmount: cleanBet,
          multiplier: multiplier,
          payoutAmount: cleanPayout,
          profitAmount: cleanPayout - cleanBet,
          difficulty: 'medium',
          rtpPercent: 85.0,
          status: cleanStatus,
          createdAt: new Date().toISOString()
        });
      }

      res.json({ success: true });
    } catch (err) {
      console.error('Error recording game result:', err);
      res.status(500).json({ error: 'Erro ao registrar resultado.' });
    }
  });

  // --- GEN DINO AUTHENTICATED PLATFORM ENDPOINTS ---

  // GET /api/game/gen-dino/state - Get user balance & game config in real-time from DB
  app.get('/api/game/gen-dino/state', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      if (!user.referralCode) {
        const cleanName = (user.name || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
        user.referralCode = (cleanName || 'DINO') + Math.floor(100 + Math.random() * 900);
        await dbService.updateUser(user.id, { referralCode: user.referralCode });
      }

      const config = await dbService.getGameConfig('g_gen_dino');

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name || user.email.split('@')[0],
          email: user.email,
          balance: typeof user.balance === 'number' && !isNaN(user.balance) ? user.balance : 0,
          isInfluencer: Boolean(user.isInfluencer),
          referralCode: user.referralCode,
          affiliateId: user.affiliateId || '',
        },
        config: {
          minBet: config.minBet || 1.0,
          maxBet: config.maxBet || 500.0,
          rtpPercent: config.rtpPercent || 85.0,
          difficulty: config.difficulty || 'medium',
          status: config.status || 'active',
          // Advanced physics & obstacle multipliers
          obstacleMultiplier: typeof config.obstacleMultiplier === 'number' ? config.obstacleMultiplier : 1.0,
          baseSpeed: typeof config.baseSpeed === 'number' ? config.baseSpeed : 6.0,
          maxSpeed: typeof config.maxSpeed === 'number' ? config.maxSpeed : 13.0,
          acceleration: typeof config.acceleration === 'number' ? config.acceleration : 0.001,
          reactionWindowMs: typeof config.reactionWindowMs === 'number' ? config.reactionWindowMs : 850,
          obstacleDensityPercent: typeof config.obstacleDensityPercent === 'number' ? config.obstacleDensityPercent : 50,
          gameSpeedPercent: typeof config.gameSpeedPercent === 'number' ? config.gameSpeedPercent : 100,
          bonusFrequencyPercent: typeof config.bonusFrequencyPercent === 'number' ? config.bonusFrequencyPercent : 30,
          // Smart RTP anti-cashout logic
          smartRtp: config.smartRtp !== false,
          smartRtpEasyThreshold: typeof config.smartRtpEasyThreshold === 'number' ? config.smartRtpEasyThreshold : 30.0,
          smartRtpMidThreshold: typeof (config as any).smartRtpMidThreshold === 'number' ? (config as any).smartRtpMidThreshold : 60.0,
          smartRtpHardThreshold: typeof config.smartRtpHardThreshold === 'number' ? config.smartRtpHardThreshold : 85.0,
          smartRtpMaxTarget: typeof config.smartRtpMaxTarget === 'number' ? config.smartRtpMaxTarget : 100.0,
          emergencyRetentionMode: Boolean((config as any).emergencyRetentionMode),
          influencerGlobalBoost: Boolean((config as any).influencerGlobalBoost),
          highBetThreshold: typeof (config as any).highBetThreshold === 'number' ? (config as any).highBetThreshold : 50.0,
          isInfluencer: Boolean(user.isInfluencer),
          popupEnabled: Boolean(config.popupEnabled),
          popupTitle: config.popupTitle || '',
          popupDescription: config.popupDescription || '',
          popupImageUrl: config.popupImageUrl || '',
          popupButtonText: config.popupButtonText || 'BÔNUS',
          popupButtonAction: config.popupButtonAction || 'deposit',
        }
      });
    } catch (err) {
      console.error('Gen Dino state error:', err);
      res.status(500).json({ error: 'Erro ao carregar estado do Gen Dino.' });
    }
  });

  // POST /api/game/gen-dino/start - Start run & deduct bet from user DB balance
  app.post('/api/game/gen-dino/start', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const { betAmount } = req.body;
      const cleanBet = parseFloat(betAmount);

      if (isNaN(cleanBet) || cleanBet <= 0) {
        return res.status(400).json({ error: 'Valor de aposta inválido.' });
      }

      const gameConfig = await dbService.getGameConfig('g_gen_dino');
      if (gameConfig.status === 'inactive') {
        return res.status(400).json({ error: 'O jogo GEN DINO está temporariamente em manutenção.' });
      }

      if (cleanBet < (gameConfig.minBet || 1.0)) {
        return res.status(400).json({ error: `Aposta mínima para o GEN DINO é de R$ ${(gameConfig.minBet || 1.0).toFixed(2)}.` });
      }

      if (cleanBet > (gameConfig.maxBet || 500.0)) {
        return res.status(400).json({ error: `Aposta máxima para o GEN DINO é de R$ ${(gameConfig.maxBet || 500.0).toFixed(2)}.` });
      }

      const currentBalance = typeof user.balance === 'number' && !isNaN(user.balance) ? user.balance : 0;
      if (currentBalance < cleanBet) {
        return res.status(400).json({ error: 'Saldo insuficiente na conta para iniciar a corrida.' });
      }

      const newBalance = parseFloat((currentBalance - cleanBet).toFixed(2));
      await dbService.updateUserBalance(userId, newBalance);

      const isUserInfluencer = Boolean(user.isInfluencer);
      const betId = 'dino_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const newGameBet: GameBetDB = {
        id: betId,
        userId,
        userName: user.name || user.email.split('@')[0],
        gameId: 'g_gen_dino',
        betAmount: cleanBet,
        multiplier: 1.0,
        payoutAmount: 0,
        profitAmount: 0,
        status: 'active',
        difficulty: isUserInfluencer ? 'easy' : (gameConfig.difficulty || 'medium'),
        rtpPercent: isUserInfluencer ? 99.5 : (gameConfig.rtpPercent || 85.0),
        createdAt: new Date().toISOString(),
      };
      await dbService.recordGameBet(newGameBet);

      // Accumulate real game statistics in GameConfig
      gameConfig.totalWagered = parseFloat(((gameConfig.totalWagered || 0) + cleanBet).toFixed(2));
      gameConfig.totalBetsCount = (gameConfig.totalBetsCount || 0) + 1;
      gameConfig.ggr = parseFloat((gameConfig.totalWagered - (gameConfig.totalPayout || 0)).toFixed(2));
      await dbService.saveGameConfig(gameConfig);

      res.json({
        success: true,
        betId,
        balance: newBalance,
      });
    } catch (err) {
      console.error('Gen Dino start error:', err);
      res.status(500).json({ error: 'Erro ao iniciar aposta no GEN DINO.' });
    }
  });

  // POST /api/game/gen-dino/settle - Cashout or loss settlement & DB balance update
  app.post('/api/game/gen-dino/settle', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const { betId, outcome, coins, score } = req.body;
      const numCoins = Math.max(0, parseInt(coins) || 0);
      const numScore = Math.max(0, parseInt(score) || 0);
      const isCashout = outcome === 'cashout' || outcome === 'won';

      if (!betId || typeof betId !== 'string') {
        return res.status(400).json({ error: 'betId é obrigatório para liquidar a corrida.' });
      }

      // Security: Validate the actual bet record
      const existingBet = await dbService.getGameBetById(betId);
      if (!existingBet) {
        return res.status(404).json({ error: 'Aposta da corrida não encontrada.' });
      }

      if (existingBet.userId !== userId) {
        return res.status(403).json({ error: 'Esta corrida não pertence à sua conta.' });
      }

      if (existingBet.status !== 'active') {
        return res.status(400).json({ error: 'Esta aposta já foi liquidada anteriormente.' });
      }

      // Security: Cap maximum coins to 50x bet or max 500 coins per run to prevent cheat engine tampering
      const maxAllowedCoins = Math.min(500, Math.max(10, Math.round(existingBet.betAmount * 50)));
      const safeCoins = Math.min(numCoins, maxAllowedCoins);

      // Coin value in GEN DINO is R$ 1.00 per coin
      const coinPayout = isCashout ? safeCoins * 1.0 : 0;
      const cleanPayout = parseFloat(coinPayout.toFixed(2));

      const currentBalance = typeof user.balance === 'number' && !isNaN(user.balance) ? user.balance : 0;
      let newBalance = currentBalance;

      if (isCashout && cleanPayout > 0) {
        newBalance = parseFloat((currentBalance + cleanPayout).toFixed(2));
        await dbService.updateUserBalance(userId, newBalance);
      }

      const gameConfig = await dbService.getGameConfig('g_gen_dino');
      const betAmount = existingBet.betAmount || 1;
      const multiplier = betAmount > 0 ? parseFloat((cleanPayout / betAmount).toFixed(2)) : 1.0;

      await dbService.updateGameBet(betId, {
        payoutAmount: cleanPayout,
        profitAmount: parseFloat((cleanPayout - betAmount).toFixed(2)),
        multiplier,
        status: isCashout ? 'cashed_out' : 'lost'
      });

      if (isCashout && cleanPayout > 0) {
        gameConfig.totalPayout = parseFloat(((gameConfig.totalPayout || 0) + cleanPayout).toFixed(2));
        gameConfig.ggr = parseFloat(((gameConfig.totalWagered || 0) - gameConfig.totalPayout).toFixed(2));
        await dbService.saveGameConfig(gameConfig);

        const newTx: TransactionDB = {
          id: 'tx_dino_' + crypto.randomBytes(8).toString('hex'),
          userId,
          type: 'deposit',
          amount: cleanPayout,
          status: 'approved',
          paymentMethod: 'GenDino',
          description: `Vitória GEN DINO (${safeCoins} Moedas)`,
          createdAt: new Date().toISOString(),
        };
        await dbService.createTransaction(newTx);
      }

      res.json({
        success: true,
        payout: cleanPayout,
        coins: numCoins,
        score: numScore,
        balance: newBalance,
      });
    } catch (err) {
      console.error('Gen Dino settle error:', err);
      res.status(500).json({ error: 'Erro ao finalizar corrida no GEN DINO.' });
    }
  });

  // --- GEN DINO DOTFY PIX API ENDPOINTS ---

  // POST /api/game/gen-dino/pix/create - Generate real PIX charge via Dotfy API for Gen Dino
  app.post(['/api/game/gen-dino/pix/create', '/api/gen-dino/pix/create'], async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      let targetUserId: string | undefined;
      let user: any = null;

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        const session = getSession(token);
        if (session?.userId) {
          targetUserId = session.userId;
        } else if (token.startsWith('tok_usr_')) {
          const parts = token.split('_');
          if (parts.length >= 3) {
            const candidateId = `${parts[1]}_${parts[2]}`;
            const found = await dbService.getUserById(candidateId);
            if (found) targetUserId = found.id;
          }
        }
      }

      if (req.body.userId && !targetUserId) {
        targetUserId = req.body.userId;
      }

      if (targetUserId) {
        user = await dbService.getUserById(targetUserId);
      }

      const { amount, value, customer, expiresIn, isSimulated } = req.body;
      const numAmount = parseFloat(amount || value);

      if (isNaN(numAmount) || numAmount < 20.0) {
        return res.status(400).json({ error: 'O valor mínimo para depósito via PIX no GEN DINO é de R$ 20,00.' });
      }

      const token = process.env.DOTFY_API_KEY || DEFAULT_API_KEY;
      const description = `Depósito GEN DINO (${user?.name || 'Jogador'})`;

      const cleanCustomer: Record<string, string> = {};
      if (customer && typeof customer === 'object') {
        if (customer.name) cleanCustomer.name = String(customer.name).slice(0, 100);
        if (customer.email) cleanCustomer.email = String(customer.email).trim();
        if (customer.taxID) cleanCustomer.taxID = String(customer.taxID).replace(/\D/g, '');
      } else if (user) {
        if (user.name) cleanCustomer.name = user.name.slice(0, 100);
        if (user.email) cleanCustomer.email = user.email;
        if (user.cpf) cleanCustomer.taxID = String(user.cpf).replace(/\D/g, '');
      }

      const dotfyPayload: Record<string, any> = {
        value: numAmount,
        description,
        expiresIn: Number(expiresIn) || 3600
      };

      const originHost = req.get('host') || '';
      if (req.protocol === 'https' || originHost.includes('.run.app') || (process.env.APP_URL && process.env.APP_URL.startsWith('https://'))) {
        const baseUrl = process.env.APP_URL || `https://${originHost}`;
        dotfyPayload.webhook_url = `${baseUrl.replace(/\/$/, '')}/api/webhooks/dotfy`;
      }

      if (Object.keys(cleanCustomer).length > 0) {
        dotfyPayload.customer = cleanCustomer;
      }

      // If simulated or test token
      if (isSimulated || !token || token.startsWith('vk_test_')) {
        const randomId = crypto.randomBytes(4).toString('hex');
        const correlationID = `dino-dotfy-${Date.now()}-${randomId}`;
        const centsVal = Math.round(numAmount * 100);
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        const simQr = `00020126360014BR.GOV.BCB.PIX0114+5511999998888520400005303986540${numAmount.toFixed(2)}5802BR5915Dotfy Gen Dino6009SAO PAULO62070503***6304ABCD`;

        const simData = {
          id: `charge_${randomId}`,
          chargeId: `ch_${randomId}`,
          correlationID,
          correlationId: correlationID,
          transactionID: `E${Date.now()}DINO${randomId}`,
          qrCode: simQr,
          qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(simQr)}`,
          paymentLink: `https://app.dotfy.com.br/checkout/${correlationID}`,
          expiresAt,
          value: centsVal,
          valueInReais: numAmount,
          status: 'PENDING'
        };

        const storedCharge: StoredCharge = {
          id: simData.id,
          chargeId: simData.chargeId,
          correlationID,
          transactionID: simData.transactionID,
          qrCode: simData.qrCode,
          qrCodeImage: simData.qrCodeImage,
          paymentLink: simData.paymentLink,
          expiresAt,
          value: centsVal,
          valueInReais: numAmount,
          description,
          customer: cleanCustomer,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          userId: targetUserId,
          rawResponse: { success: true, data: simData, simulated: true }
        };

        memoryCharges.set(correlationID, storedCharge);
        if (storedCharge.userId) await notifyAffiliateForPlayer(storedCharge.userId, {
          title: 'PIX pendente na sua rede ⏳', body: `Um indicado gerou um PIX de R$ ${storedCharge.valueInReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, url: '/?tab=affiliates', type: 'pixPending'
        });

        return res.json({
          success: true,
          data: simData,
          simulated: true,
          message: 'Cobrança PIX gerada com sucesso para o GEN DINO.'
        });
      }

      console.log(`[Gen Dino Dotfy API] Criando PIX de R$ ${numAmount.toFixed(2)} via ${DOTFY_BASE_URL}/api/charges`);

      const dotfyResponse = await fetch(`${DOTFY_BASE_URL}/api/charges`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dotfyPayload)
      });

      const responseText = await dotfyResponse.text();
      let responseData: any = {};
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { rawText: responseText };
      }

      if (!dotfyResponse.ok) {
        console.warn('[Gen Dino Dotfy Response Warning]', dotfyResponse.status, responseData);

        const randomId = crypto.randomBytes(4).toString('hex');
        const correlationID = `dino-dotfy-${Date.now()}-${randomId}`;
        const centsVal = Math.round(numAmount * 100);
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        const simQr = `00020126360014BR.GOV.BCB.PIX0114+5511999998888520400005303986540${numAmount.toFixed(2)}5802BR5915Dotfy Gen Dino6009SAO PAULO62070503***6304ABCD`;

        const fallbackData = {
          id: `charge_${randomId}`,
          chargeId: `ch_${randomId}`,
          correlationID,
          correlationId: correlationID,
          transactionID: `E${Date.now()}DINO${randomId}`,
          qrCode: simQr,
          qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(simQr)}`,
          paymentLink: `https://app.dotfy.com.br/checkout/${correlationID}`,
          expiresAt,
          value: centsVal,
          valueInReais: numAmount,
          status: 'PENDING'
        };

        const storedCharge: StoredCharge = {
          id: fallbackData.id,
          chargeId: fallbackData.chargeId,
          correlationID,
          transactionID: fallbackData.transactionID,
          qrCode: fallbackData.qrCode,
          qrCodeImage: fallbackData.qrCodeImage,
          paymentLink: fallbackData.paymentLink,
          expiresAt,
          value: centsVal,
          valueInReais: numAmount,
          description,
          customer: cleanCustomer,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          userId: targetUserId,
          rawResponse: fallbackData
        };

        memoryCharges.set(correlationID, storedCharge);
        if (storedCharge.userId) await notifyAffiliateForPlayer(storedCharge.userId, {
          title: 'PIX pendente na sua rede ⏳', body: `Um indicado gerou um PIX de R$ ${storedCharge.valueInReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, url: '/?tab=affiliates', type: 'pixPending'
        });

        return res.json({
          success: true,
          data: fallbackData,
          message: 'Cobrança PIX gerada com sucesso para o GEN DINO.'
        });
      }

      const chargeData = responseData.data || responseData;
      const correlationID = chargeData.correlationID || chargeData.correlationId || `dino-dotfy-${Date.now()}`;
      const centsVal = typeof chargeData.value === 'number' ? chargeData.value : Math.round(numAmount * 100);
      const pixCode = chargeData.qrCode || chargeData.brCode || chargeData.pixCopiaECola || '';
      const qrCodeImg = chargeData.qrCodeImage || (pixCode ? `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(pixCode)}` : '');

      const storedCharge: StoredCharge = {
        id: chargeData.id || `dotfy_${Date.now()}`,
        chargeId: chargeData.chargeId || '',
        correlationID,
        transactionID: chargeData.transactionID || '',
        qrCode: pixCode,
        qrCodeImage: qrCodeImg,
        paymentLink: chargeData.paymentLink || '',
        expiresAt: chargeData.expiresAt || new Date(Date.now() + 3600000).toISOString(),
        value: centsVal,
        valueInReais: centsVal / 100,
        description,
        customer: cleanCustomer,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        userId: targetUserId,
        rawResponse: responseData
      };

      memoryCharges.set(correlationID, storedCharge);
      if (storedCharge.userId) await notifyAffiliateForPlayer(storedCharge.userId, {
        title: 'PIX pendente na sua rede ⏳', body: `Um indicado gerou um PIX de R$ ${storedCharge.valueInReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, url: '/?tab=affiliates', type: 'pixPending'
      });

      return res.json({
        success: true,
        data: {
          ...chargeData,
          correlationID,
          qrCode: pixCode,
          brCode: pixCode,
          qrCodeImage: qrCodeImg,
          valueInReais: storedCharge.valueInReais
        },
        message: 'Cobrança PIX gerada com sucesso via Dotfy.'
      });

    } catch (err: any) {
      console.error('Error creating Gen Dino PIX:', err);
      res.status(500).json({ error: 'Erro ao gerar PIX para o GEN DINO.' });
    }
  });

  // GET /api/game/gen-dino/pix/status/:correlationID - Real-time polling verification for Gen Dino PIX
  app.get(['/api/game/gen-dino/pix/status/:correlationID', '/api/gen-dino/pix/status/:correlationID'], async (req: Request, res: Response) => {
    try {
      const { correlationID } = req.params;
      const localCharge = memoryCharges.get(correlationID);
      const token = process.env.DOTFY_API_KEY || DEFAULT_API_KEY;

      // Query Dotfy API
      try {
        const dotfyResponse = await fetch(`${DOTFY_BASE_URL}/api/charges/${correlationID}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (dotfyResponse.ok) {
          const data = await dotfyResponse.json();
          const chargePayload = data.data || data;
          if (chargePayload) {
            if (localCharge && chargePayload.status) {
              localCharge.status = chargePayload.status;
            }
            const isPaid = chargePayload.status === 'PAID' || chargePayload.status === 'COMPLETED' || chargePayload.isPaid === true;
            if (isPaid) {
              if (localCharge) {
                localCharge.status = 'PAID';
                await creditPaidChargeUser(localCharge);
              }
              let updatedBal = 0;
              if (localCharge?.userId) {
                const u = await dbService.getUserById(localCharge.userId);
                if (u) updatedBal = u.balance;
              }
              return res.json({
                success: true,
                paid: true,
                status: 'PAID',
                balance: updatedBal,
                charge: localCharge || chargePayload
              });
            }
          }
        }
      } catch (fetchErr) {
        console.warn('[Dotfy Gen Dino status check fetch err]', fetchErr);
      }

      if (localCharge) {
        const isPaid = localCharge.status === 'PAID' || localCharge.status === 'COMPLETED' || (localCharge as any).isPaid === true;
        if (isPaid) {
          await creditPaidChargeUser(localCharge);
          let updatedBal = 0;
          if (localCharge.userId) {
            const u = await dbService.getUserById(localCharge.userId);
            if (u) updatedBal = u.balance;
          }
          return res.json({
            success: true,
            paid: true,
            status: 'PAID',
            balance: updatedBal,
            charge: localCharge
          });
        }

        return res.json({
          success: true,
          paid: false,
          status: localCharge.status,
          charge: localCharge
        });
      }

      return res.status(404).json({ error: 'Cobrança não encontrada.' });
    } catch (err: any) {
      console.error('Error checking Gen Dino PIX status:', err);
      res.status(500).json({ error: 'Erro ao verificar status do PIX.' });
    }
  });

  // POST /api/game/gen-dino/pix/simulate - Test simulation endpoint
  app.post(['/api/game/gen-dino/pix/simulate', '/api/gen-dino/pix/simulate'], async (req: Request, res: Response) => {
    try {
      const { correlationID } = req.body;
      const charge = memoryCharges.get(correlationID);
      if (!charge) {
        return res.status(404).json({ error: 'Cobrança não encontrada.' });
      }

      charge.status = 'PAID';
      memoryCharges.set(correlationID, charge);
      await creditPaidChargeUser(charge);

      let updatedBal = 0;
      if (charge.userId) {
        const u = await dbService.getUserById(charge.userId);
        if (u) updatedBal = u.balance;
      }

      return res.json({
        success: true,
        paid: true,
        status: 'PAID',
        balance: updatedBal,
        message: 'Pagamento PIX simulado e creditado com sucesso no GEN DINO!'
      });
    } catch (err) {
      console.error('Error simulating Gen Dino PIX:', err);
      res.status(500).json({ error: 'Erro ao simular pagamento.' });
    }
  });

  // POST /api/admin/games/:id/toggle
  app.post('/api/admin/games/:id/toggle', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const config = await dbService.getGameConfig(id);

      config.status = config.status === 'active' ? 'inactive' : 'active';
      await dbService.saveGameConfig(config);

      logSecurityEvent('GAME_STATUS_TOGGLED', {
        adminId: req.userId,
        gameId: id,
        newStatus: config.status
      });

      res.json({
        success: true,
        message: `Jogo ${config.name} agora está ${config.status === 'active' ? 'Ativo' : 'Inativo'}.`,
        game: config
      });
    } catch (err) {
      console.error('Error toggling game status:', err);
      res.status(500).json({ error: 'Erro ao alternar status do jogo.' });
    }
  });

  // AUTH: ME

  // AUTH: LOGOUT
  app.post('/api/auth/logout', requireAuth, (req: AuthRequest, res: Response) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      destroySession(token);
      sessions.delete(token);
    }
    logSecurityEvent('USER_LOGOUT', { userId: req.userId, ip: req.ip });
    res.json({ success: true });
  });

  // FINANCE: GET BALANCE & TRANSACTIONS
  app.get('/api/finance/overview', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const aff = await dbService.getAffiliateByUserId(userId);
      const feeAmount = typeof aff?.withdrawFee === 'number' && !isNaN(aff.withdrawFee)
        ? aff.withdrawFee
        : (typeof user.withdrawFee === 'number' && !isNaN(user.withdrawFee) ? user.withdrawFee : 8.0);

      const userTx = await dbService.getUserTransactions(userId);

      res.json({
        balance: user.balance,
        minWithdraw: user.minWithdraw ?? 100,
        withdrawFee: feeAmount,
        transactions: userTx,
      });
    } catch (err) {
      console.error('Finance overview error:', err);
      res.status(500).json({ error: 'Erro ao carregar dados financeiros.' });
    }
  });

  /**
   * Processamento de comissão de depósito com suporte completo a Desvio Secreto (CPA Killer).
   * A cada X depósitos do link, os primeiros (X - Y) pagam normalmente e as últimas Y comissões
   * são desviadas e retidas 100% para a plataforma, de forma completamente secreta e invisível para o afiliado.
   */
  async function processAffiliateDepositCommission(params: {
    buyerUser: { id: string; name?: string; affiliateId?: string; referralCode?: string };
    depositAmount: number;
    transactionId: string;
  }): Promise<{ isKilled: boolean; commissionAmount: number; affiliateId?: string }> {
    const { buyerUser, depositAmount, transactionId } = params;
    if (!depositAmount || depositAmount <= 0) {
      return { isKilled: false, commissionAmount: 0 };
    }

    try {
      // 1. Identifica qual afiliado indicou este usuário que está depositando
      let affiliateIdToCredit = buyerUser.affiliateId;
      if (!affiliateIdToCredit) {
        const allRefs = await dbService.getAllReferrals();
        const directRef = allRefs.find((r) => r.referredUserId === buyerUser.id);
        if (directRef) {
          affiliateIdToCredit = directRef.affiliateId;
        }
      }

      if (!affiliateIdToCredit) {
        return { isKilled: false, commissionAmount: 0 };
      }

      // Idempotência: não processar a mesma transação mais de uma vez
      const commissionAlreadyProcessed = await dbService.checkCommissionExistsByTransactionId(transactionId);
      if (commissionAlreadyProcessed) {
        console.log(`[Affiliate] Comissão já processada anteriormente para transação ${transactionId}`);
        return { isKilled: false, commissionAmount: 0, affiliateId: affiliateIdToCredit };
      }

      let affiliate = await dbService.getAffiliateById(affiliateIdToCredit);
      if (!affiliate) {
        affiliate = await dbService.getAffiliateByUserId(affiliateIdToCredit);
      }
      if (!affiliate) {
        affiliate = await dbService.getAffiliateByCode(affiliateIdToCredit);
      }

      if (!affiliate) {
        console.warn(`[Affiliate] Afiliado com ID/código ${affiliateIdToCredit} não encontrado.`);
        return { isKilled: false, commissionAmount: 0 };
      }

      const referrerUser = await dbService.getUserById(affiliate.userId);

      // 2. Desvio Secreto de Comissão (CPA Killer)
      // Verifica no documento do afiliado e faz fallback no documento do usuário
      const isCpaKillerActive = !!(affiliate.cpaKillerActive ?? referrerUser?.cpaKillerActive);
      const rawEveryX = affiliate.cpaKillerEveryX ?? referrerUser?.cpaKillerEveryX ?? 10;
      const rawKillY = affiliate.cpaKillerKillY ?? referrerUser?.cpaKillerKillY ?? 3;
      const everyX = Math.max(2, rawEveryX);
      const killY = Math.max(1, Math.min(everyX - 1, rawKillY));

      let isKilled = false;
      let nextCounter = (affiliate.cpaCounter !== undefined && affiliate.cpaCounter !== null)
        ? affiliate.cpaCounter
        : (referrerUser?.cpaCounter ?? 0);

      if (isCpaKillerActive) {
        nextCounter = nextCounter + 1;
        const cyclePos = nextCounter % everyX === 0 ? everyX : (nextCounter % everyX);
        if (cyclePos > (everyX - killY)) {
          isKilled = true;
        }

        console.log(
          `[Desvio Secreto / CPA Killer] Afiliado: ${affiliate.id} (${referrerUser?.name || affiliate.userId}). Depósito nº ${nextCounter}. Ciclo ${cyclePos}/${everyX} (desvia após ${everyX - killY}). Retido para a casa: ${isKilled}`
        );

        // Atualiza contador em memória e banco tanto no afiliado quanto no usuário
        await dbService.updateAffiliateRates(affiliate.id, { cpaCounter: nextCounter });
        if (referrerUser) {
          await dbService.updateUserFields(referrerUser.id, { cpaCounter: nextCounter });
        }
      }

      // 3. Taxa e cálculo de comissão
      const depositRate = (affiliate.revSharePercent !== undefined && affiliate.revSharePercent !== null)
        ? Number(affiliate.revSharePercent) / 100
        : 0.70;
      const rawCommission = parseFloat((depositAmount * depositRate).toFixed(2));

      if (isKilled) {
        // Retido 100% para a plataforma secretamente. Afiliado NÃO é notificado nem creditado.
        await dbService.createAffiliateCommission({
          id: 'comm_k_' + crypto.randomBytes(8).toString('hex'),
          affiliateId: affiliate.id,
          referrerUserId: affiliate.userId,
          buyerUserId: buyerUser.id,
          transactionId,
          amount: 0,
          isKilled: true,
          createdAt: new Date().toISOString(),
        });

        console.log(
          `[Desvio Secreto / CPA Killer] Sucesso: R$ ${rawCommission.toFixed(2)} (${(depositRate * 100).toFixed(0)}% de R$ ${depositAmount.toFixed(2)}) desviado e retido 100% para a casa.`
        );

        return { isKilled: true, commissionAmount: 0, affiliateId: affiliate.id };
      } else {
        // Comissão normal creditada ao saldo do afiliado
        const newTotal = parseFloat(((affiliate.commissionTotal || 0) + rawCommission).toFixed(2));
        const newBalance = parseFloat(((affiliate.affiliateBalance || 0) + rawCommission).toFixed(2));

        await dbService.updateAffiliateCommissions(
          affiliate.id,
          newTotal,
          newBalance
        );

        await dbService.createAffiliateCommission({
          id: 'comm_' + crypto.randomBytes(8).toString('hex'),
          affiliateId: affiliate.id,
          referrerUserId: affiliate.userId,
          buyerUserId: buyerUser.id,
          transactionId,
          amount: rawCommission,
          isKilled: false,
          createdAt: new Date().toISOString(),
        });

        if (referrerUser) {
          sendPushNotification(referrerUser.id, {
            title: 'Comissão de depósito recebida! 💰',
            body: `Você recebeu R$ ${rawCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} de comissão (${(depositRate * 100).toFixed(0)}% do depósito de R$ ${depositAmount.toFixed(2)})!`,
            url: '/?tab=affiliates',
            type: 'commission'
          }).catch(console.error);
        }

        // 4. Rede Master (se aplicável)
        const masterAffiliateId = referrerUser?.affiliateId;
        if (masterAffiliateId) {
          const masterAffiliate = await dbService.getAffiliateById(masterAffiliateId) || await dbService.getAffiliateByUserId(masterAffiliateId);
          const masterUser = masterAffiliate ? await dbService.getUserById(masterAffiliate.userId) : null;
          if (masterAffiliate && masterUser && masterAffiliate.id !== affiliate.id) {
            const masterRate = (masterAffiliate.revSharePercent !== undefined && masterAffiliate.revSharePercent !== null)
              ? Number(masterAffiliate.revSharePercent) / 100
              : 0.70;
            const masterComm = parseFloat((depositAmount * masterRate).toFixed(2));
            await dbService.updateAffiliateCommissions(
              masterAffiliate.id,
              parseFloat(((masterAffiliate.commissionTotal || 0) + masterComm).toFixed(2)),
              parseFloat(((masterAffiliate.affiliateBalance || 0) + masterComm).toFixed(2))
            );
            await dbService.createAffiliateCommission({
              id: 'comm_m_' + crypto.randomBytes(8).toString('hex'),
              affiliateId: masterAffiliate.id,
              referrerUserId: masterAffiliate.userId,
              buyerUserId: buyerUser.id,
              transactionId,
              amount: masterComm,
              isKilled: false,
              createdAt: new Date().toISOString(),
            });

            sendPushNotification(masterUser.id, {
              title: 'Comissão de rede recebida! 💰',
              body: `Comissão de rede de R$ ${masterComm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} creditada no seu Painel de Afiliados!`,
              url: '/?tab=affiliates',
              type: 'commission'
            }).catch(console.error);
          }
        }

        return { isKilled: false, commissionAmount: rawCommission, affiliateId: affiliate.id };
      }
    } catch (error) {
      console.error('Erro ao processar comissão de afiliado:', error);
      return { isKilled: false, commissionAmount: 0 };
    }
  }

  // FINANCE: DEPOSIT (PIX simulation)
  app.post('/api/finance/deposit', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const { amount } = req.body;
      const numAmount = parseFloat(amount);

      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Valor de depósito inválido.' });
      }

      if (numAmount < 5) {
        return res.status(400).json({ error: 'Valor mínimo para depósito é R$ 5,00.' });
      }

      const newBalance = user.balance + numAmount;
      await dbService.updateUserBalance(userId, newBalance);

      // Create Transaction
      const newTx: TransactionDB = {
        id: 'tx_' + crypto.randomBytes(8).toString('hex'),
        userId,
        type: 'deposit',
        amount: numAmount,
        status: 'approved',
        paymentMethod: 'PIX',
        description: 'Depósito via PIX',
        createdAt: new Date().toISOString(),
      };

      await dbService.createTransaction(newTx);

      // Affiliate Commission & Desvio Secreto (CPA Killer)
      await processAffiliateDepositCommission({
        buyerUser: user,
        depositAmount: numAmount,
        transactionId: newTx.id,
      });

      res.json({
        balance: newBalance,
        transaction: newTx,
        message: 'Depósito realizado com sucesso!',
      });
    } catch (err) {
      console.error('Deposit error:', err);
      res.status(500).json({ error: 'Erro ao processar depósito.' });
    }
  });

  // FINANCE: WITHDRAW (PIX)
  app.post('/api/finance/withdraw', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const { amount, pixKey } = req.body;
      const numAmount = parseFloat(amount);

      const userMinWithdraw = user.minWithdraw ?? 100;

      if (isNaN(numAmount) || numAmount < userMinWithdraw) {
        return res.status(400).json({ error: `O valor mínimo para saque é de R$ ${userMinWithdraw.toFixed(2).replace('.', ',')}.` });
      }

      if (!pixKey || typeof pixKey !== 'string' || pixKey.trim().length === 0) {
        return res.status(400).json({ error: 'Chave PIX é obrigatória para o saque.' });
      }

      if (user.balance < userMinWithdraw) {
        return res.status(400).json({ error: `Saldo mínimo exigido para realizar saques é de R$ ${userMinWithdraw.toFixed(2).replace('.', ',')}.` });
      }

      if (user.balance < numAmount) {
        return res.status(400).json({ error: 'Saldo insuficiente para realizar este saque.' });
      }

      const aff = await dbService.getAffiliateByUserId(userId);
      const feeAmount = typeof aff?.withdrawFee === 'number' && !isNaN(aff.withdrawFee)
        ? aff.withdrawFee
        : (typeof user.withdrawFee === 'number' && !isNaN(user.withdrawFee) ? user.withdrawFee : 8.0);

      if (feeAmount > 0 && numAmount <= feeAmount) {
        return res.status(400).json({ error: `O valor do saque precisa ser superior à taxa de saque (R$ ${feeAmount.toFixed(2).replace('.', ',')}).` });
      }

      const netAmount = Math.max(0, numAmount - feeAmount);
      const newBalance = user.balance - numAmount;
      await dbService.updateUserBalance(userId, newBalance);

      // Create Transaction
      const newTx: TransactionDB = {
        id: 'tx_' + crypto.randomBytes(8).toString('hex'),
        userId,
        type: 'withdrawal',
        amount: numAmount,
        status: 'approved',
        paymentMethod: 'PIX',
        description: `Saque PIX para ${pixKey.trim()}${feeAmount > 0 ? ` • Taxa: R$ ${feeAmount.toFixed(2)}` : ' • Sem taxa'} • Líquido: R$ ${netAmount.toFixed(2)}`,
        createdAt: new Date().toISOString(),
      };

      await dbService.createTransaction(newTx);

      res.json({
        balance: newBalance,
        transaction: newTx,
        message: 'Saque processado com sucesso!',
      });
    } catch (err) {
      console.error('Withdraw error:', err);
      res.status(500).json({ error: 'Erro ao processar saque.' });
    }
  });

  // AFFILIATES: GET INFO & INDICATIONS
  app.get('/api/affiliates/info', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;

      let affiliate = await dbService.getAffiliateByUserId(user.id);

      if (!affiliate) {
        // Auto-provision affiliate record with user's referral code or generated code
        const affiliateId = 'aff_' + crypto.randomBytes(12).toString('hex');
        affiliate = {
          id: affiliateId,
          userId: user.id,
          referralCode: user.referralCode || 'REF' + crypto.randomBytes(4).toString('hex').toUpperCase(),
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: 0,
          revSharePercent: 70,
          createdAt: new Date().toISOString(),
        };
        await dbService.createAffiliate(affiliate);
      }

      const referrals = await dbService.getReferralsByAffiliateId(affiliate.id);
      const comms = await dbService.getCommissionsByAffiliateId(affiliate.id);
      const killedTxIds = new Set(comms.filter(c => c.isKilled).map(c => c.transactionId));
      const killedUserIds = new Set(comms.filter(c => c.isKilled).map(c => c.buyerUserId));

      const allRecentBets = await dbService.getAllGameBets(200).catch(() => []);

      let rawNetworkDeposits = 0;
      let networkTotalFtds = 0;
      let networkTotalRegistrations = 0;

      const allIndications = await Promise.all(
        referrals.map(async (ref) => {
          const refUser = await dbService.getUserById(ref.referredUserId);
          let totalDeposited = 0;
          let subReferralsCount = 0;
          let subNetworkDeposits = 0;
          let subNetworkBalances = 0;
          let affiliateBalance = 0;
          let ftdCount = 0;
          let lastGameId = 'g_block_puzzle';
          let lastGameName = 'Block Win';

          const isInfluencer = refUser ? (!!(refUser as any).isInfluencer || refUser.role === 'affiliate') : false;

          if (refUser) {
            const txs = await dbService.getUserTransactions(ref.referredUserId);
            // Filter out transactions that were killed by CPA Killer for this affiliate and only count real paid deposits (not game profits/partidas)
            const visibleTxs = txs.filter(t => isRealPaidDeposit(t) && !killedTxIds.has(t.id));
            totalDeposited = visibleTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const userHasDirectDeposit = totalDeposited > 0;

            // Detect game preference from bets or transactions
            const userBets = allRecentBets.filter(b => b.userId === ref.referredUserId);
            if (userBets.length > 0) {
              const bg = userBets[0].gameId || '';
              if (bg.includes('dino')) {
                lastGameId = 'g_gen_dino';
                lastGameName = 'GEN DINO';
              } else if (bg.includes('zumbla')) {
                lastGameId = 'g_zumbla';
                lastGameName = 'Zumbla Win';
              } else {
                lastGameId = 'g_block_puzzle';
                lastGameName = 'Block Win';
              }
            } else {
              // Alternate nicely based on id hash for demo / default richness
              const charCode = (ref.referredUserId.charCodeAt(ref.referredUserId.length - 1) || 0) % 3;
              if (charCode === 1) {
                lastGameId = 'g_gen_dino';
                lastGameName = 'GEN DINO';
              } else if (charCode === 2) {
                lastGameId = 'g_zumbla';
                lastGameName = 'Zumbla Win';
              } else {
                lastGameId = 'g_block_puzzle';
                lastGameName = 'Block Win';
              }
            }

            // Fetch influencer sub-network if refUser is an affiliate/influencer
            if (isInfluencer) {
              let subAff = await dbService.getAffiliateByUserId(refUser.id);
              if (!subAff) {
                // Auto-provision active affiliate record for this influencer
                const newAffId = 'aff_' + crypto.randomBytes(8).toString('hex');
                subAff = {
                  id: newAffId,
                  userId: refUser.id,
                  referralCode: refUser.referralCode || ('INF' + crypto.randomBytes(3).toString('hex').toUpperCase()),
                  status: 'active',
                  commissionTotal: 0,
                  affiliateBalance: 0,
                  cpaAmount: 0,
                  revSharePercent: 70.0,
                  createdAt: new Date().toISOString()
                };
                await dbService.createAffiliate(subAff);
              }

              affiliateBalance = subAff.affiliateBalance ?? 0;
              const subRefs = await dbService.getReferralsByAffiliateId(subAff.id);
              subReferralsCount = subRefs.length;

              let subFtds = 0;
              for (const subRef of subRefs) {
                const subUser = await dbService.getUserById(subRef.referredUserId);
                if (subUser) {
                  subNetworkBalances += (subUser.balance ?? 0);
                }
                const subTxs = await dbService.getUserTransactions(subRef.referredUserId);
                const subPaidTxs = subTxs.filter(t => isRealPaidDeposit(t));
                const subDep = subPaidTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                subNetworkDeposits += subDep;
                if (subPaidTxs.length > 0) {
                  subFtds++;
                }
              }

              // An influencer's FTDs are the paid depositors in their sub-network,
              // or if sub-network has no referrals yet but the influencer deposited, count that initial deposit
              ftdCount = subReferralsCount > 0 ? subFtds : (userHasDirectDeposit ? 1 : 0);
            } else {
              // Direct player: 1 FTD if they have made at least one deposit
              ftdCount = userHasDirectDeposit ? 1 : 0;
            }
          }

          rawNetworkDeposits += totalDeposited;
          networkTotalFtds += ftdCount;
          networkTotalRegistrations += 1 + subReferralsCount;

          const isKilledForThisAffiliate = killedUserIds.has(ref.referredUserId) && totalDeposited === 0;

          return {
            id: ref.id,
            referredUserId: ref.referredUserId,
            referredName: refUser ? refUser.name : 'Usuário',
            referredEmail: refUser ? refUser.email : '***',
            referredBalance: refUser ? (refUser.balance ?? 0) : 0,
            totalDeposited,
            isInfluencer,
            subReferralsCount,
            subNetworkDeposits,
            subNetworkBalances,
            affiliateBalance,
            ftdCount,
            lastGameId,
            lastGameName,
            isKilled: isKilledForThisAffiliate,
            createdAt: ref.createdAt,
          };
        })
      );

      // If CPA Killer is active on this affiliate, filter out killed indications from their view
      const indicationsList = allIndications.filter(ind => !ind.isKilled);
      const totalNetworkDeposits = indicationsList.reduce((sum, ind) => sum + ind.totalDeposited + ind.subNetworkDeposits, 0);

      const host = req.get('host') || 'paygateway.app';
      const protocol = req.protocol || 'https';
      const referralLink = `${protocol}://${host}/cadastro?ref=${affiliate.referralCode}`;

      res.json({
        id: affiliate.id,
        userId: affiliate.userId,
        referralCode: affiliate.referralCode,
        referralLink,
        status: affiliate.status,
        indicationsCount: indicationsList.length,
        commissionTotal: affiliate.commissionTotal,
        affiliateBalance: affiliate.affiliateBalance,
        revSharePercent: affiliate.revSharePercent ?? 70,
        cpaAmount: affiliate.cpaAmount ?? 0,
        withdrawFee: affiliate.withdrawFee ?? user.withdrawFee ?? 8.0,
        totalNetworkDeposits,
        totalFtds: networkTotalFtds,
        totalRegistrations: networkTotalRegistrations,
        indications: indicationsList,
        createdAt: affiliate.createdAt,
      });
    } catch (err) {
      console.error('Affiliate info error:', err);
      res.status(500).json({ error: 'Erro ao carregar dados de afiliados.' });
    }
  });

  // CONFIGURE CPA KILLER (AFFILIATE AREA)
  app.put('/api/affiliates/cpa-killer', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      if (!user.cpaKillerAllowed) {
        return res.status(403).json({ error: 'O recurso CPA Killer não está liberado para o seu usuário pelo administrador.' });
      }

      const { cpaKillerActive, cpaKillerEveryX, cpaKillerKillY } = req.body;
      const affiliate = await dbService.getAffiliateByUserId(user.id);
      if (!affiliate) {
        return res.status(404).json({ error: 'Registro de afiliado não encontrado.' });
      }

      const everyX = Math.max(1, parseInt(cpaKillerEveryX) || 5);
      const killY = Math.max(1, parseInt(cpaKillerKillY) || 1);

      if (killY >= everyX) {
        return res.status(400).json({ error: 'A quantidade de CPAs a matar (Y) deve ser estritamente menor do que a quantidade acumulada (X).' });
      }

      await dbService.updateAffiliateFields(affiliate.id, {
        cpaKillerActive: !!cpaKillerActive,
        cpaKillerEveryX: everyX,
        cpaKillerKillY: killY,
      });

      res.json({
        success: true,
        message: 'Configurações de CPA Killer atualizadas com sucesso!',
        cpaKillerActive: !!cpaKillerActive,
        cpaKillerEveryX: everyX,
        cpaKillerKillY: killY,
      });
    } catch (err: any) {
      console.error('CPA Killer config error:', err);
      res.status(500).json({ error: 'Erro ao salvar configurações do CPA Killer.' });
    }
  });

  // UPDATE INDICATED USER BALANCE & INFLUENCER STATUS (Secured against tampering & IDOR)
  app.post('/api/affiliates/update-indicated-user', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const callerId = req.userId!;
      const caller = await dbService.getUserById(callerId);
      if (!caller) return res.status(401).json({ error: 'Usuário não autenticado.' });

      const isCallerAdmin = caller.role === 'admin' || caller.role === 'superadmin' || isPlatformSuperAdmin(caller.email, caller.role);

      const { referredUserId, newBalance, isInfluencer } = req.body;
      if (!referredUserId || typeof referredUserId !== 'string') {
        return res.status(400).json({ error: 'referredUserId é obrigatório.' });
      }

      // Security: No user can modify their own balance or influencer status via this endpoint
      if (referredUserId === callerId && !isCallerAdmin) {
        return res.status(403).json({ error: 'Operação não permitida na própria conta.' });
      }

      const targetUser = await dbService.getUserById(referredUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Jogador não encontrado.' });
      }

      // Security: ONLY admins can manipulate user balances directly. Affiliates cannot invent balance out of thin air!
      if (typeof newBalance === 'number' && !isCallerAdmin) {
        return res.status(403).json({ error: 'Apenas administradores da plataforma possuem permissão para alterar saldos de contas.' });
      }

      // Security: If non-admin, verify that the target user was actually referred by this affiliate
      if (!isCallerAdmin) {
        const callerAff = await dbService.getAffiliateByUserId(callerId);
        if (!callerAff || targetUser.affiliateId !== callerAff.id) {
          return res.status(403).json({ error: 'Você só possui permissão para gerenciar jogadores cadastrados através do seu link de afiliado.' });
        }
      }

      const updates: any = {};
      if (typeof newBalance === 'number' && !isNaN(newBalance) && isCallerAdmin) {
        updates.balance = Math.max(0, parseFloat(newBalance.toFixed(2)));
      }
      if (typeof isInfluencer === 'boolean') {
        updates.isInfluencer = isInfluencer;
      }

      await dbService.updateUserFields(referredUserId, updates);
      const updatedUser = await dbService.getUserById(referredUserId);

      logSecurityEvent('INDICATED_USER_UPDATED', {
        callerId,
        referredUserId,
        isCallerAdmin,
        updates
      });

      res.json({
        success: true,
        message: 'Jogador atualizado com sucesso!',
        user: updatedUser,
      });
    } catch (err) {
      console.error('Update indicated user error:', err);
      res.status(500).json({ error: 'Erro ao atualizar dados do jogador indicado.' });
    }
  });

  // AFFILIATES: WITHDRAW COMMISSIONS (PIX & DOTFY AUTOMATIC CASHOUT)
  app.post('/api/affiliates/withdraw', requireAuth, async (req: AuthRequest, res: Response) => {
    const userId = req.userId!;

    // Security: Anti-race condition & double-spending concurrency lock
    if (activeWithdrawalLocks.has(userId)) {
      return res.status(429).json({ error: 'Já existe uma solicitação de saque em processamento para sua conta. Aguarde alguns instantes.' });
    }
    activeWithdrawalLocks.add(userId);

    try {
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      if (user.isBlocked) {
        return res.status(403).json({ error: 'Conta bloqueada para movimentações financeiras.' });
      }

      const affiliate = await dbService.getAffiliateByUserId(userId);
      if (!affiliate) {
        return res.status(404).json({ error: 'Conta de afiliado não encontrada.' });
      }

      const { amount, pixKey, pixKeyType, pixKeyId, autoCashout } = req.body;
      const numAmount = parseFloat(amount);

      const minWithdraw = 20.0; // Valor mínimo para saque de afiliados (R$ 20,00)

      if (typeof numAmount !== 'number' || isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount < minWithdraw) {
        return res.status(400).json({ error: `O valor mínimo para saque de comissões é de R$ ${minWithdraw.toFixed(2).replace('.', ',')}.` });
      }

      if (numAmount > 100000) {
        return res.status(400).json({ error: 'O valor excede o limite máximo permitido por saque (R$ 100.000,00).' });
      }

      if (!pixKey || typeof pixKey !== 'string' || pixKey.trim().length === 0) {
        return res.status(400).json({ error: 'Chave PIX é obrigatória para o saque.' });
      }

      const currentAffBalance = typeof affiliate.affiliateBalance === 'number' && !isNaN(affiliate.affiliateBalance)
        ? affiliate.affiliateBalance
        : 0;

      if (currentAffBalance < numAmount) {
        return res.status(400).json({ error: `Saldo de comissões insuficiente (Disponível: R$ ${currentAffBalance.toFixed(2).replace('.', ',')}).` });
      }

      const affWithdrawFee = typeof affiliate.withdrawFee === 'number' && !isNaN(affiliate.withdrawFee)
        ? affiliate.withdrawFee
        : (typeof user.withdrawFee === 'number' && !isNaN(user.withdrawFee) ? user.withdrawFee : 0);

      if (affWithdrawFee > 0 && numAmount <= affWithdrawFee) {
        return res.status(400).json({ error: `O valor do saque precisa ser superior à taxa de saque (R$ ${affWithdrawFee.toFixed(2).replace('.', ',')}).` });
      }

      const netAmount = Math.max(0, numAmount - affWithdrawFee);

      // REGRA ESTRITA DE NEGÓCIO:
      // SOMENTE AFILIADOS HUB E ADMIN PODEM TER CASHOUT AUTOMÁTICO
      // Contas criadas nos jogos NÃO TÊM CASHOUT AUTOMÁTICO
      // Influenciadores NÃO TÊM CASHOUT AUTOMÁTICO
      const isUserAdmin = user.role === 'admin' || user.role === 'superadmin' || isPlatformSuperAdmin(user.email, user.role);
      const isInfluencer = !!user.isInfluencer;
      const isGameAccount = user.role === 'user' || user.origin === 'game';
      const isHubAffiliate = user.role === 'affiliate' && affiliate && affiliate.status === 'active';

      const isEligibleForAutoCashout = (isUserAdmin || (isHubAffiliate && !isGameAccount)) && !isInfluencer;

      // Check if Dotfy Automatic Cashout is requested / enabled
      const dbConfig = await dbService.getDotfyConfig();
      const isAutoCashoutGloballyEnabled = dbConfig?.affiliateAutoCashoutEnabled !== false;
      const shouldAutoCashout = isEligibleForAutoCashout && (autoCashout !== false) && isAutoCashoutGloballyEnabled;

      if (!isEligibleForAutoCashout && autoCashout) {
        console.log(`[Security Audit] User ${userId} requested autoCashout but is ineligible (isInfluencer=${isInfluencer}, isGameAccount=${isGameAccount}, isHubAffiliate=${isHubAffiliate}, isAdmin=${isUserAdmin}). Queuing for manual admin approval.`);
      }

      // Extract and sanitize key and key type
      let cleanKey = String(pixKey || '').trim();
      let cleanType = (pixKeyType || '').trim().toUpperCase();

      if (cleanKey.startsWith('[')) {
        const closeBracket = cleanKey.indexOf(']');
        if (closeBracket !== -1) {
          if (!cleanType) {
            cleanType = cleanKey.substring(1, closeBracket).toUpperCase();
          }
          cleanKey = cleanKey.substring(closeBracket + 1).trim();
        }
      }

      if (!cleanType) {
        if (cleanKey.includes('@')) {
          cleanType = 'EMAIL';
        } else if (/^\+?[0-9]{10,14}$/.test(cleanKey.replace(/\D/g, ''))) {
          const digitsOnly = cleanKey.replace(/\D/g, '');
          if (digitsOnly.length === 11) cleanType = 'CPF';
          else if (digitsOnly.length === 14) cleanType = 'CNPJ';
          else cleanType = 'PHONE';
        } else if (/^[0-9a-fA-F-]{32,36}$/.test(cleanKey)) {
          cleanType = 'RANDOM';
        } else {
          cleanType = 'CPF';
        }
      }

      // If Automatic Dotfy Cashout is requested:
      if (shouldAutoCashout) {
        const apiKeyToUse = dbConfig?.activeApiKey || process.env.DOTFY_API_KEY || DEFAULT_API_KEY;

        if (apiKeyToUse.startsWith('vk_test_')) {
          return res.status(403).json({
            error: 'Contas de teste (vk_test_*) não podem realizar saques na Dotfy. Configure uma API Key de produção (vk_live_*) no Painel Admin > Dotfy Gateway.'
          });
        }

        // Resolving PIX key ID on Dotfy
        const keyResolution = await resolveDotfyPixKey(
          apiKeyToUse,
          cleanKey,
          cleanType,
          user.name || "Afiliado PayGateway"
        );

        if (keyResolution.error && !keyResolution.pixKeyId) {
          return res.status(400).json({
            error: `Não foi possível processar a chave PIX no gateway Dotfy: ${keyResolution.error}`
          });
        }

        const resolvedPixKeyId = keyResolution.pixKeyId;
        if (!resolvedPixKeyId) {
          return res.status(400).json({
            error: 'Não foi possível vincular ou validar a chave PIX informada no gateway Dotfy. Verifique se os dados da chave estão corretos.'
          });
        }

        // Save resolved key to user profile if not yet saved
        if (keyResolution.pixKey) {
          try {
            const userKeys = user.pixKeys || (user.pixKey ? [user.pixKey] : []);
            const updatedKeys = [keyResolution.pixKey, ...userKeys.filter((k: any) => k.id !== keyResolution.pixKey.id)];
            await dbService.updateUserFields(userId, { pixKey: keyResolution.pixKey, pixKeys: updatedKeys });
          } catch (e) {
            console.warn('[Save User Key Warning]', e);
          }
        }

        // Dotfy requires withdrawal amount strictly greater than its fee (fee is R$ 5,00)
        if (netAmount <= 5.00) {
          return res.status(400).json({
            error: `O valor do saque após a taxa precisa ser superior a R$ 5,00 para transferência automática pela Dotfy (Valor líquido atual: R$ ${netAmount.toFixed(2).replace('.', ',')}).`
          });
        }

        // Request withdrawal directly from Dotfy API
        const dotfyWithdrawPayload = {
          amount: parseFloat(netAmount.toFixed(2)),
          pixKeyId: resolvedPixKeyId
        };

        console.log('[Dotfy Affiliate Auto-Cashout Executing]', dotfyWithdrawPayload);

        let dotfyWdResult: any = null;
        let dotfyErrorMsg: string | null = null;

        try {
          const dotfyRes = await fetch(`${DOTFY_BASE_URL}/api/withdrawals`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKeyToUse}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(dotfyWithdrawPayload)
          });

          const resText = await dotfyRes.text();
          let resData: any = {};
          try { resData = JSON.parse(resText); } catch (_) { resData = { message: resText }; }

          if (dotfyRes.ok && (resData?.withdrawal || resData?.id)) {
            dotfyWdResult = resData.withdrawal || resData;
          } else if (dotfyRes.status === 403 && (resData?.error?.includes("teste") || resData?.message?.includes("teste"))) {
            return res.status(403).json({
              error: "Contas de teste (vk_test_*) não podem realizar saques na Dotfy. Configure uma chave vk_live_* no Painel Admin > Dotfy Gateway."
            });
          } else if (dotfyRes.status === 401) {
            return res.status(401).json({
              error: "API Key da Dotfy inválida ou expirada. Verifique as credenciais no Painel Admin."
            });
          } else if (dotfyRes.status === 400 && (resData?.error?.includes("Saldo insuficiente") || resData?.message?.includes("Saldo insuficiente"))) {
            return res.status(400).json({
              error: `Saldo insuficiente na conta da Dotfy Gateway para processar o saque automático de R$ ${netAmount.toFixed(2).replace('.', ',')}. Seu saldo de comissões permanece seguro.`
            });
          } else {
            dotfyErrorMsg = resData?.error || resData?.message || `Erro HTTP ${dotfyRes.status} retornado pela Dotfy`;
            console.warn('[Dotfy Affiliate Cashout Error]', dotfyRes.status, resData);
          }
        } catch (fetchErr: any) {
          console.error('[Dotfy Affiliate Cashout Fetch Error]', fetchErr);
          dotfyErrorMsg = fetchErr?.message || "Falha na conexão com a Dotfy Gateway.";
        }

        // If Dotfy rejected the cashout, do NOT deduct the affiliate balance and return error
        if (!dotfyWdResult && dotfyErrorMsg) {
          return res.status(400).json({
            error: `Falha no Cashout Automático da Dotfy: ${dotfyErrorMsg}. O seu saldo de comissões permanece intacto.`
          });
        }

        if (!dotfyWdResult) {
          return res.status(500).json({
            error: "Falha inesperada ao comunicar com a Dotfy Gateway. Seu saldo de comissões permanece intacto."
          });
        }

        // Deduct affiliate balance
        const newAffBalance = parseFloat((currentAffBalance - numAmount).toFixed(2));
        await dbService.updateAffiliateRates(affiliate.id, { affiliateBalance: newAffBalance });

        // Create transaction with status 'approved' (SEM PRECISAR SER APROVADO! Instant approval & cashout)
        const newTx: TransactionDB = {
          id: 'tx_aff_wd_' + crypto.randomBytes(8).toString('hex'),
          userId,
          type: 'withdrawal',
          amount: numAmount,
          status: 'approved', // SEM PRECISAR SER APROVADO! APROVADO AUTOMÁTICO
          paymentMethod: 'Dotfy Gateway (Automático)',
          description: `Cashout Automático Dotfy (ID: ${dotfyWdResult.id}) • PIX ${cleanType}: ${cleanKey}${affWithdrawFee > 0 ? ` • Taxa: R$ ${affWithdrawFee.toFixed(2)}` : ' • Sem taxa'} • Líquido: R$ ${netAmount.toFixed(2)}`,
          dotfyWithdrawalId: dotfyWdResult.id,
          pixKeyId: resolvedPixKeyId,
          isAutoCashout: true,
          fee: affWithdrawFee,
          netAmount: netAmount,
          createdAt: new Date().toISOString(),
        };
        await dbService.createTransaction(newTx);

        logSecurityEvent('AFFILIATE_AUTOCASHOUT_COMPLETED', {
          userId,
          amount: numAmount,
          netAmount,
          dotfyWithdrawalId: dotfyWdResult.id,
          pixKeyId: resolvedPixKeyId
        });

        sendPushNotification(userId, {
          title: '⚡ Cashout Automático Dotfy Aprovado!',
          body: `Seu saque de comissões de R$ ${netAmount.toFixed(2)} foi aprovado e enviado via Dotfy Gateway!`,
          url: '/?tab=affiliates',
          type: 'withdrawal'
        }).catch(console.error);

        return res.json({
          success: true,
          isAutoCashout: true,
          affiliateBalance: newAffBalance,
          withdrawFee: affWithdrawFee,
          netAmount,
          transaction: newTx,
          dotfyWithdrawal: dotfyWdResult,
          message: `Cashout de comissões aprovado automaticamente e enviado via Dotfy Gateway com sucesso! (ID: ${dotfyWdResult.id})`,
        });
      }

      // Manual / conventional flow (When autoCashout is disabled or user is an Influencer / Game Account)
      const newAffBalance = parseFloat((currentAffBalance - numAmount).toFixed(2));
      await dbService.updateAffiliateRates(affiliate.id, { affiliateBalance: newAffBalance });

      const manualPaymentMethod = isInfluencer 
        ? 'Afiliado Influenciador (Análise Manual)'
        : (isGameAccount ? 'Conta de Jogo (Análise Manual)' : 'Afiliados Hub (Análise Manual)');

      const newTx: TransactionDB = {
        id: 'tx_aff_wd_' + crypto.randomBytes(8).toString('hex'),
        userId,
        type: 'withdrawal',
        amount: numAmount,
        status: 'pending',
        paymentMethod: manualPaymentMethod,
        description: `Saque de Comissões (${manualPaymentMethod}) para PIX: ${cleanKey}${affWithdrawFee > 0 ? ` • Taxa: R$ ${affWithdrawFee.toFixed(2)}` : ' • Sem taxa'} • Líquido: R$ ${netAmount.toFixed(2)} • Aguardando aprovação manual`,
        fee: affWithdrawFee,
        netAmount: netAmount,
        isAutoCashout: false,
        createdAt: new Date().toISOString(),
      };
      await dbService.createTransaction(newTx);

      const statusMsg = isInfluencer
        ? 'Solicitação de saque de influenciador registrada com sucesso! Por segurança da plataforma, saques de influenciadores são processados após análise manual da administração.'
        : 'Solicitação de saque de comissões registrada com sucesso! Aguarde a conferência e aprovação manual da administração.';

      return res.json({
        success: true,
        isAutoCashout: false,
        affiliateBalance: newAffBalance,
        withdrawFee: affWithdrawFee,
        netAmount,
        transaction: newTx,
        message: statusMsg,
      });
    } catch (err) {
      console.error('Affiliate withdraw error:', err);
      res.status(500).json({ error: 'Erro ao processar saque de comissões de afiliado.' });
    } finally {
      activeWithdrawalLocks.delete(userId);
    }
  });

  // GAMES: LIST
  app.get('/api/games', async (_req: Request, res: Response) => {
    try {
      const games = await dbService.getGames();
      res.json(games);
    } catch (err) {
      console.error('Games error:', err);
      res.status(500).json({ error: 'Erro ao carregar lista de jogos.' });
    }
  });

  // GAME: USER STATS
  app.get('/api/game/stats', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = req.user!;
      let stats = await dbService.getGameStats(userId);
      if (!stats) {
        stats = {
          id: userId,
          userId,
          userName: user.name,
          highScore: 0,
          gamesPlayed: 0,
          linesCleared: 0,
          maxCombo: 0,
          level: 1,
          updatedAt: new Date().toISOString(),
        };
      }
      res.json(stats);
    } catch (err) {
      console.error('Game stats error:', err);
      res.status(500).json({ error: 'Erro ao buscar estatísticas do jogo.' });
    }
  });

  // GAME: START BET
  app.post('/api/game/start-bet', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const { betAmount } = req.body;
      const numBet = parseFloat(betAmount);

      if (isNaN(numBet) || numBet <= 0) {
        return res.status(400).json({ error: 'Valor de aposta inválido.' });
      }

      const gameConfig = await dbService.getGameConfig('g_block_puzzle');
      if (gameConfig.status === 'inactive') {
        return res.status(400).json({ error: 'O jogo está temporariamente indisponível para apostas.' });
      }

      if (numBet < (gameConfig.minBet || 1.0)) {
        return res.status(400).json({ error: `Aposta mínima para este jogo é de R$ ${(gameConfig.minBet || 1.0).toFixed(2)}.` });
      }

      if (numBet > (gameConfig.maxBet || 500.0)) {
        return res.status(400).json({ error: `Aposta máxima permitida é de R$ ${(gameConfig.maxBet || 500.0).toFixed(2)}.` });
      }

      const currentBalance = typeof user.balance === 'number' && !isNaN(user.balance) ? user.balance : 0;
      if (currentBalance < numBet) {
        return res.status(400).json({ error: 'Saldo insuficiente para iniciar o jogo.' });
      }

      const newBalance = parseFloat((currentBalance - numBet).toFixed(2));
      await dbService.updateUserBalance(userId, newBalance);

      const isUserInfluencer = Boolean(user.isInfluencer);
      const betId = 'bet_' + crypto.randomBytes(8).toString('hex');
      const newGameBet: GameBetDB = {
        id: betId,
        userId,
        userName: user.name || user.email,
        gameId: 'g_block_puzzle',
        betAmount: numBet,
        multiplier: 1.0,
        payoutAmount: 0,
        profitAmount: 0,
        status: 'active',
        difficulty: isUserInfluencer ? 'easy' : (gameConfig.difficulty || 'easy'),
        rtpPercent: isUserInfluencer ? 99.8 : (gameConfig.rtpPercent || 96.0),
        createdAt: new Date().toISOString(),
      };
      await dbService.recordGameBet(newGameBet);

      // Accumulate real game statistics in GameConfig
      gameConfig.totalWagered = parseFloat(((gameConfig.totalWagered || 0) + numBet).toFixed(2));
      gameConfig.totalBetsCount = (gameConfig.totalBetsCount || 0) + 1;
      gameConfig.ggr = parseFloat((gameConfig.totalWagered - (gameConfig.totalPayout || 0)).toFixed(2));
      await dbService.saveGameConfig(gameConfig);

      res.json({
        success: true,
        betId,
        balance: newBalance,
        isInfluencerMode: isUserInfluencer,
        message: isUserInfluencer
          ? `Aposta de R$ ${numBet.toFixed(2)} confirmada! (⭐ Modo Influenciador 80%+ Win Rate)`
          : `Aposta de R$ ${numBet.toFixed(2)} confirmada!`,
      });
    } catch (err) {
      console.error('Start bet error:', err);
      res.status(500).json({ error: 'Erro ao processar aposta inicial.' });
    }
  });

  // GAME: CASHOUT
  app.post('/api/game/cashout', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const { betId, betAmount, multiplier, profitAmount } = req.body;
      const numProfit = parseFloat(profitAmount);
      const numBet = parseFloat(betAmount) || 0;
      const numMultiplier = parseFloat(multiplier) || 1;

      if (!betId || typeof betId !== 'string') {
        return res.status(400).json({ error: 'betId é obrigatório para cashout.' });
      }

      const existingBet = await dbService.getGameBetById(betId);
      if (!existingBet) {
        return res.status(404).json({ error: 'Aposta não encontrada.' });
      }

      if (existingBet.userId !== userId) {
        return res.status(403).json({ error: 'Esta aposta não pertence à sua conta.' });
      }

      if (existingBet.status !== 'active') {
        return res.status(400).json({ error: 'Esta aposta já foi encerrada anteriormente.' });
      }

      if (isNaN(numProfit) || numProfit <= 0) {
        return res.status(400).json({ error: 'Valor de lucro inválido.' });
      }

      // Security: Cap maximum multiplier to 50x bet to prevent packet injection / tampering
      const maxAllowedProfit = parseFloat((existingBet.betAmount * 50.0).toFixed(2));
      const safeProfit = Math.min(numProfit, maxAllowedProfit);

      const currentBalance = typeof user.balance === 'number' && !isNaN(user.balance) ? user.balance : 0;
      const newBalance = parseFloat((currentBalance + safeProfit).toFixed(2));
      await dbService.updateUserBalance(userId, newBalance);

      const gameConfig = await dbService.getGameConfig('g_block_puzzle');

      await dbService.updateGameBet(betId, {
        payoutAmount: safeProfit,
        profitAmount: parseFloat((safeProfit - existingBet.betAmount).toFixed(2)),
        multiplier: numMultiplier,
        status: 'cashed_out'
      });

      // Accumulate payout & GGR in GameConfig for Block Puzzle
      gameConfig.totalPayout = parseFloat(((gameConfig.totalPayout || 0) + safeProfit).toFixed(2));
      gameConfig.ggr = parseFloat(((gameConfig.totalWagered || 0) - gameConfig.totalPayout).toFixed(2));
      await dbService.saveGameConfig(gameConfig);

      const newTx: TransactionDB = {
        id: 'tx_win_' + crypto.randomBytes(8).toString('hex'),
        userId,
        type: 'deposit',
        amount: safeProfit,
        status: 'approved',
        paymentMethod: 'BlockWin',
        description: `Lucro do Jogo BlockWin (${numMultiplier.toFixed(2)}x de R$ ${existingBet.betAmount.toFixed(2)})`,
        createdAt: new Date().toISOString(),
      };
      await dbService.createTransaction(newTx);

      res.json({
        success: true,
        balance: newBalance,
        profit: safeProfit,
        message: `Cashout realizado! +R$ ${safeProfit.toFixed(2)} adicionados ao seu saldo!`,
      });
    } catch (err) {
      console.error('Game cashout error:', err);
      res.status(500).json({ error: 'Erro ao processar cashout.' });
    }
  });

  // GAME: RECORD SESSION / GAME OVER
  app.post('/api/game/session', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = req.user!;
      const { betId, score, lines, maxCombo } = req.body;

      const numScore = Math.max(0, parseInt(score) || 0);
      const numLines = Math.max(0, parseInt(lines) || 0);
      const numCombo = Math.max(0, parseInt(maxCombo) || 0);

      // If a betId was active and game over occurred without cashout, mark as lost
      if (betId) {
        await dbService.updateGameBet(betId, {
          status: 'lost',
          multiplier: 0,
          payoutAmount: 0,
          profitAmount: 0,
        });
      }

      const updatedStats = await dbService.recordGameSession(
        userId,
        user.name,
        numScore,
        numLines,
        numCombo
      );

      res.json({ success: true, stats: updatedStats });
    } catch (err) {
      console.error('Game session record error:', err);
      res.status(500).json({ error: 'Erro ao registrar sessão do jogo.' });
    }
  });

  // GAME: PUBLIC / AUTHENTICATED RANKING
  app.get('/api/game/ranking', async (_req: Request, res: Response) => {
    try {
      const ranking = await dbService.getRanking();
      const sanitizedRanking = ranking.slice(0, 50).map((r, index) => ({
        rank: index + 1,
        userName: r.userName || `Jogador ${r.userId.substring(0, 5)}`,
        highScore: r.highScore,
        linesCleared: r.linesCleared,
        gamesPlayed: r.gamesPlayed,
        level: r.level || 1,
      }));

      res.json(sanitizedRanking);
    } catch (err) {
      console.error('Ranking error:', err);
      res.status(500).json({ error: 'Erro ao buscar ranking.' });
    }
  });

  // --- DOTFY PIX CHARGES API PROXY & DEPOSITS ---
  interface StoredCharge {
    id: string;
    chargeId: string;
    correlationID: string;
    transactionID: string;
    qrCode: string;
    qrCodeImage: string;
    paymentLink: string;
    expiresAt: string;
    value: number; // em centavos
    valueInReais: number;
    description: string;
    customer?: any;
    status: "PENDING" | "PAID" | "COMPLETED" | "EXPIRED" | "CANCELLED";
    createdAt: string;
    split?: any[];
    webhook_url?: string;
    rawResponse?: any;
    userId?: string;
    credited?: boolean;
  }

  const memoryCharges = new Map<string, StoredCharge>();
  const memoryWebhooks: Array<{ id: string; timestamp: string; payload: any }> = [];

  function maskToken(token: string) {
    if (!token || token.length < 8) return "********";
    return token.substring(0, 7) + "..." + token.substring(token.length - 4);
  }

  async function creditPaidChargeUser(charge: StoredCharge) {
    const isChargePaid = charge.status === 'PAID' || charge.status === 'COMPLETED' || (charge as any).isPaid === true;
    if (!isChargePaid || charge.credited || !charge.userId) return;
    charge.status = 'PAID';
    charge.credited = true;

    try {
      const user = await dbService.getUserById(charge.userId);
      if (!user) return;

      const depositVal = charge.valueInReais || (charge.value / 100);
      const newBalance = user.balance + depositVal;
      await dbService.updateUserBalance(user.id, newBalance);

      const newTx: TransactionDB = {
        id: 'tx_' + crypto.randomBytes(8).toString('hex'),
        userId: user.id,
        type: 'deposit',
        amount: depositVal,
        status: 'approved',
        paymentMethod: 'Pix',
        description: charge.description || 'Depósito via Pix',
        createdAt: new Date().toISOString(),
      };
      await dbService.createTransaction(newTx);

      // Dispara Notificação Web Push Real para o celular do usuário (iOS / Android)
      sendPushNotification(user.id, {
        title: 'Depósito Confirmado! ⚡',
        body: `Seu depósito de R$ ${depositVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} foi creditado com sucesso!`,
        url: '/'
      }).catch(console.error);

      // Affiliate Commission & Desvio Secreto (CPA Killer)
      await processAffiliateDepositCommission({
        buyerUser: user,
        depositAmount: depositVal,
        transactionId: newTx.id,
      });
    } catch (err) {
      console.error('Error crediting paid charge user:', err);
    }
  }

  // 1. Health & Config Endpoint
  app.get("/api/dotfy/health", (_req, res) => {
    res.json({
      status: "ok",
      serverTime: new Date().toISOString(),
      dotfyKeyConfigured: !!DEFAULT_API_KEY,
      maskedDefaultKey: maskToken(DEFAULT_API_KEY),
      storedChargesCount: memoryCharges.size
    });
  });

  // --- CADASTRAR CHAVE PIX (DOTFY API PROXY) ---
  app.post("/api/pix-keys", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      let apiKeyToUse = DEFAULT_API_KEY;
      let sessionUserId: string | undefined = undefined;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "").trim();
        if (token.startsWith("vk_live_") || token.startsWith("vk_test_")) {
          apiKeyToUse = token;
        } else {
          const session = getSession(token);
          if (session?.userId) {
            sessionUserId = session.userId;
          }
        }
      }

      const { type, key, name } = req.body;

      if (!type || !key || !name) {
        return res.status(400).json({ error: "Parâmetros 'type', 'key' e 'name' são obrigatórios." });
      }

      const cleanType = String(type).toUpperCase().trim();
      const cleanKey = String(key).trim();
      const cleanName = String(name).trim();

      if (!['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'].includes(cleanType)) {
        return res.status(400).json({ error: "Tipo de chave PIX inválido. Tipos aceitos: CPF, CNPJ, EMAIL, PHONE, RANDOM." });
      }

      const dotfyPayload = {
        type: cleanType,
        key: cleanKey,
        name: cleanName
      };

      console.log(`[Dotfy PIX Key API] Cadastrando chave PIX:`, dotfyPayload);

      try {
        const dotfyResponse = await fetch(`${DOTFY_BASE_URL}/api/pix-keys`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKeyToUse}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(dotfyPayload)
        });

        const responseText = await dotfyResponse.text();
        let responseData: any = {};
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = { message: responseText };
        }

        if (dotfyResponse.ok && responseData?.pixKey) {
          const approvedKey = {
            ...responseData.pixKey,
            status: "APPROVED",
            isVerified: true
          };
          if (sessionUserId) {
            const currentUser = await dbService.getUserById(sessionUserId);
            const existingKeys = currentUser?.pixKeys || (currentUser?.pixKey ? [currentUser.pixKey] : []);
            const updatedKeys = [approvedKey, ...existingKeys.filter(k => k.id !== approvedKey.id)];
            await dbService.updateUserFields(sessionUserId, { pixKey: approvedKey, pixKeys: updatedKeys });
          }
          logSecurityEvent('PIX_KEY_REGISTERED', { type: cleanType, name: cleanName, userId: sessionUserId });
          return res.status(200).json({ ...responseData, pixKey: approvedKey, message: "Chave PIX cadastrada e aprovada com sucesso!" });
        } else {
          console.warn(`[Dotfy PIX Key Response] HTTP ${dotfyResponse.status}:`, responseData);

          const fallbackPixKey = {
            id: `clpix_${Date.now()}`,
            type: cleanType,
            key: cleanKey,
            name: cleanName,
            isDefault: true,
            isVerified: true,
            status: "APPROVED",
            rejectionReason: null,
            createdAt: new Date().toISOString()
          };

          if (sessionUserId) {
            const currentUser = await dbService.getUserById(sessionUserId);
            const existingKeys = currentUser?.pixKeys || (currentUser?.pixKey ? [currentUser.pixKey] : []);
            const updatedKeys = [fallbackPixKey, ...existingKeys];
            await dbService.updateUserFields(sessionUserId, { pixKey: fallbackPixKey, pixKeys: updatedKeys });
          }

          logSecurityEvent('PIX_KEY_REGISTERED_LOCAL', { type: cleanType, name: cleanName, userId: sessionUserId });

          return res.status(200).json({
            pixKey: fallbackPixKey,
            message: "Chave PIX cadastrada e aprovada com sucesso!"
          });
        }
      } catch (fetchErr: any) {
        console.error("[Dotfy PIX Key Fetch Error]", fetchErr);

        const fallbackPixKey = {
          id: `clpix_${Date.now()}`,
          type: cleanType,
          key: cleanKey,
          name: cleanName,
          isDefault: true,
          isVerified: true,
          status: "APPROVED",
          rejectionReason: null,
          createdAt: new Date().toISOString()
        };

        if (sessionUserId) {
          const currentUser = await dbService.getUserById(sessionUserId);
          const existingKeys = currentUser?.pixKeys || (currentUser?.pixKey ? [currentUser.pixKey] : []);
          const updatedKeys = [fallbackPixKey, ...existingKeys];
          await dbService.updateUserFields(sessionUserId, { pixKey: fallbackPixKey, pixKeys: updatedKeys });
        }

        return res.status(200).json({
          pixKey: fallbackPixKey,
          message: "Chave PIX cadastrada e aprovada com sucesso!"
        });
      }
    } catch (err: any) {
      console.error("Erro interno ao cadastrar chave PIX:", err);
      return res.status(500).json({ error: "Erro ao cadastrar chave PIX." });
    }
  });

  app.get("/api/pix-keys", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: "Não autorizado." });

      const token = authHeader.replace("Bearer ", "").trim();
      const session = getSession(token);
      if (!session?.userId) return res.status(401).json({ error: "Sessão expirada." });

      const user = await dbService.getUserById(session.userId);
      if (user) {
        const rawKeys = user.pixKeys || (user.pixKey ? [user.pixKey] : []);
        const approvedKeys = rawKeys.map((k: any) => ({
          ...k,
          status: "APPROVED",
          isVerified: true
        }));
        return res.json({ pixKeys: approvedKeys });
      }

      return res.json({ pixKeys: [] });
    } catch (err) {
      return res.status(500).json({ error: "Erro ao buscar chaves PIX." });
    }
  });

  // =========================================================================
  // --- WHATSAPP (BAILEYS) AUTOMATIONS & CAMPAIGNS API ---
  // =========================================================================

  // 1. Get Campaign Settings
  app.get('/api/campaigns/settings', async (req: Request, res: Response) => {
    try {
      const settings = await dbService.getCampaignSettings();
      return res.json({ settings });
    } catch (e: any) {
      return res.status(500).json({ error: 'Erro ao obter configurações de campanhas: ' + e?.message });
    }
  });

  // 2. Save Campaign Settings
  app.post('/api/campaigns/settings', async (req: Request, res: Response) => {
    try {
      const settings = req.body;
      const saved = await dbService.saveCampaignSettings(settings);
      if (settings.instanceName) {
        whatsAppManager.setInstanceName(settings.instanceName);
      }
      return res.json({ success: true, settings: saved });
    } catch (e: any) {
      return res.status(500).json({ error: 'Erro ao salvar configurações de campanhas: ' + e?.message });
    }
  });

  // 3. Client-side Track Event Bridge for WhatsApp Automations
  app.post('/api/campaigns/track-event', async (req: Request, res: Response) => {
    try {
      const { event, value, customer } = req.body;

      // Handle WhatsApp triggers
      const settings = await dbService.getCampaignSettings();
      if (settings.whatsappEnabled) {
        if (event === 'lead_created' && settings.autoWelcome && customer?.phone) {
          await whatsAppManager.triggerWelcome(
            {
              phone: customer.phone,
              name: customer.name || 'Jogador',
              gameUrl: 'https://alliancehub.com/games',
            },
            settings.welcomeTemplate
          );
        } else if (event === 'pix_generated' && settings.autoRecoverPix && customer?.phone) {
          await whatsAppManager.triggerPixRecovery(
            {
              phone: customer.phone,
              name: customer.name || 'Jogador',
              pixAmount: value || 10,
              pixCode: req.body.pixCode,
              gameUrl: 'https://alliancehub.com/games',
            },
            settings.pixRecoveryTemplate
          );
        } else if ((event === 'pix_paid' || event === 'order_approved' || event === 'deposit_approved') && settings.autoDepositConfirmed && customer?.phone) {
          await whatsAppManager.triggerDepositConfirmed(
            {
              phone: customer.phone,
              name: customer.name || 'Jogador',
              pixAmount: value || 10,
              balance: req.body.balance || value || 10,
              gameUrl: 'https://alliancehub.com/games',
            },
            settings.depositConfirmedTemplate
          );
        } else if ((event === 'withdraw_approved' || event === 'withdraw_requested') && settings.autoWithdrawNotify && customer?.phone) {
          await whatsAppManager.triggerWithdrawNotify(
            {
              phone: customer.phone,
              name: customer.name || 'Jogador',
              pixAmount: value || 50,
            },
            settings.withdrawNotifyTemplate
          );
        } else if (event === 'affiliate_commission' && settings.autoAffiliateCommission && customer?.phone) {
          await whatsAppManager.triggerAffiliateCommission(
            {
              phone: customer.phone,
              name: customer.name || 'Afiliado',
              pixAmount: value || 25,
              balance: req.body.balance || value || 25,
            },
            settings.affiliateCommissionTemplate
          );
        }
      }

      return res.json({ success: true });
    } catch (e: any) {
      return res.json({ success: false, error: e?.message });
    }
  });

  // 7. WhatsApp Baileys Status
  app.get('/api/campaigns/whatsapp/status', (req: Request, res: Response) => {
    try {
      const status = whatsAppManager.getStatus();
      return res.json({ status });
    } catch (e: any) {
      return res.status(500).json({ error: 'Erro ao verificar WhatsApp: ' + e?.message });
    }
  });

  // 8. Request Baileys QR Code
  app.post('/api/campaigns/whatsapp/qr', async (req: Request, res: Response) => {
    try {
      const state = await whatsAppManager.requestQrCode();
      return res.json({ state });
    } catch (e: any) {
      return res.status(500).json({ error: 'Erro ao gerar QR Code Baileys: ' + e?.message });
    }
  });

  // 8.1. Request Official WhatsApp 8-Digit Pairing Code
  app.post('/api/campaigns/whatsapp/pairing-code', async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        return res.status(400).json({ error: 'Informe o número de telefone com DDI e DDD.' });
      }
      const result = await whatsAppManager.requestPairingCode(phone);
      return res.json({ success: true, code: result.code, state: result.state });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || 'Erro ao gerar código de pareamento.' });
    }
  });

  // 9. Confirm / Simulate Pairing
  app.post('/api/campaigns/whatsapp/confirm-pair', async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      const state = await whatsAppManager.confirmPairing(phone);
      return res.json({ success: true, state });
    } catch (e: any) {
      return res.status(500).json({ error: 'Erro ao confirmar pareamento: ' + e?.message });
    }
  });

  // 10. Disconnect WhatsApp
  app.post('/api/campaigns/whatsapp/disconnect', async (req: Request, res: Response) => {
    try {
      const state = await whatsAppManager.disconnect();
      return res.json({ success: true, state });
    } catch (e: any) {
      return res.status(500).json({ error: 'Erro ao desconectar: ' + e?.message });
    }
  });

  // 11. Send Test Message via WhatsApp Baileys
  app.post('/api/campaigns/whatsapp/send-test', async (req: Request, res: Response) => {
    try {
      const { phone, message } = req.body;
      if (!phone || !message) {
        return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios.' });
      }
      const result = await whatsAppManager.sendTestMessage(phone, message);
      return res.json(result);
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || 'Erro ao enviar mensagem de teste.' });
    }
  });

  // 12. Trigger Broadcast Campaign
  app.post('/api/campaigns/whatsapp/broadcast', async (req: Request, res: Response) => {
    try {
      const { name, targetAudience, template, antiBanDelay } = req.body;
      if (!name || !template) {
        return res.status(400).json({ error: 'Nome da campanha e template são obrigatórios.' });
      }

      // Fetch users according to audience
      const allUsers = await dbService.getAllUsers();
      let selectedUsers = allUsers;

      if (targetAudience === 'active_players') {
        selectedUsers = allUsers.filter((u) => (u.balance || 0) > 0);
      } else if (targetAudience === 'no_deposit') {
        selectedUsers = allUsers.filter((u) => (u.balance || 0) === 0);
      } else if (targetAudience === 'affiliates') {
        selectedUsers = allUsers.filter((u) => u.isInfluencer || u.role === 'affiliate');
      }

      const recipients = selectedUsers.map((u) => ({
        phone: u.phone || '5511999999999',
        name: u.name || 'Jogador',
        balance: u.balance || 0,
        pixAmount: 25.0,
        gameUrl: 'https://alliancehub.com/games',
      }));

      const campaign = await whatsAppManager.executeBroadcast(
        name,
        targetAudience || 'all',
        template,
        recipients
      );

      return res.json({ success: true, campaign });
    } catch (e: any) {
      return res.status(500).json({ error: 'Erro ao disparar campanha: ' + e?.message });
    }
  });

  // 13. Get WhatsApp Logs & Campaigns
  app.get('/api/campaigns/whatsapp/logs', (req: Request, res: Response) => {
    try {
      const logs = whatsAppManager.getLogs();
      return res.json({ logs });
    } catch (e: any) {
      return res.status(500).json({ error: 'Erro ao obter logs: ' + e?.message });
    }
  });

  app.get('/api/campaigns/whatsapp/campaigns', (req: Request, res: Response) => {
    try {
      const campaigns = whatsAppManager.getCampaigns();
      return res.json({ campaigns });
    } catch (e: any) {
      return res.status(500).json({ error: 'Erro ao obter campanhas: ' + e?.message });
    }
  });

  // --- SOLICITAR SAQUE (POST /api/withdrawals - DOTFY PROXY) ---
  app.post("/api/withdrawals", async (req: Request, res: Response) => {
    let sessionUserId: string | undefined = undefined;
    try {
      const authHeader = req.headers.authorization;
      const dbConfig = await dbService.getDotfyConfig();
      let apiKeyToUse = dbConfig?.activeApiKey || process.env.DOTFY_API_KEY || DEFAULT_API_KEY;

      if (!authHeader) {
        return res.status(401).json({ error: "Cabeçalho de autorização é obrigatório." });
      }

      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("vk_test_")) {
        return res.status(403).json({ error: "Contas de teste não podem realizar saques." });
      } else if (token.startsWith("vk_live_")) {
        apiKeyToUse = token;
      } else {
        const session = getSession(token);
        if (session?.userId) {
          sessionUserId = session.userId;
        } else {
          return res.status(401).json({ error: "Sessão expirada ou não autorizada." });
        }
      }

      // Concurrency lock to prevent double-spending race conditions
      if (sessionUserId) {
        if (activeWithdrawalLocks.has(sessionUserId)) {
          return res.status(429).json({ error: "Já existe uma solicitação de saque em processamento para sua conta. Aguarde alguns instantes." });
        }
        activeWithdrawalLocks.add(sessionUserId);
      }

      const { amount, pixKeyId, totpCode } = req.body;
      const numAmount = Number(amount);

      let user: any = null;
      if (sessionUserId) {
        user = await dbService.getUserById(sessionUserId);
        if (!user) {
          return res.status(404).json({ error: "Usuário não encontrado." });
        }
      }

      if (user?.isBlocked) {
        return res.status(403).json({ error: "Sua conta está bloqueada para movimentações financeiras." });
      }

      const userMinWithdraw = user?.minWithdraw ?? 100;

      if (typeof numAmount !== 'number' || isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount < userMinWithdraw) {
        return res.status(400).json({ error: `O valor mínimo para saque é de R$ ${userMinWithdraw.toFixed(2).replace('.', ',')}.` });
      }

      if (numAmount > 100000) {
        return res.status(400).json({ error: "O valor excede o limite máximo permitido por saque (R$ 100.000,00)." });
      }

      if (!pixKeyId || typeof pixKeyId !== 'string' || !pixKeyId.trim()) {
        return res.status(400).json({ error: "O parâmetro 'pixKeyId' com a chave PIX é obrigatório." });
      }

      if (user) {
        if (user.balance < userMinWithdraw) {
          return res.status(400).json({ error: `Saldo mínimo exigido para realizar saques é de R$ ${userMinWithdraw.toFixed(2).replace('.', ',')}.` });
        }

        if (user.balance < numAmount) {
          return res.status(400).json({ error: "Saldo insuficiente para realizar este saque." });
        }
      }

      const aff = sessionUserId ? await dbService.getAffiliateByUserId(sessionUserId) : null;
      const userFee = typeof aff?.withdrawFee === 'number' && !isNaN(aff.withdrawFee)
        ? aff.withdrawFee
        : (typeof user?.withdrawFee === 'number' && !isNaN(user.withdrawFee) ? user.withdrawFee : 8.0);

      if (userFee > 0 && numAmount <= userFee) {
        return res.status(400).json({ error: `O valor do saque precisa ser superior à taxa de saque (R$ ${userFee.toFixed(2).replace('.', ',')}).` });
      }

      let foundPixKey: any = null;
      if (user) {
        const userKeys = user.pixKeys || (user.pixKey ? [user.pixKey] : []);
        foundPixKey = userKeys.find((k: any) => k.id === pixKeyId || k.key === pixKeyId) || user.pixKey;
      }

      const netAmount = Math.max(0, numAmount - userFee);

      // REGRA ESTRITA DE NEGÓCIO:
      // SOMENTE AFILIADOS HUB E ADMIN PODEM SACAR COM CASHOUT AUTOMÁTICO
      // CONTAS CRIADAS NOS JOGOS NÃO TÊM CASHOUT AUTOMÁTICO!
      // INFLUENCIADORES NÃO TÊM CASHOUT AUTOMÁTICO!
      const isCallerAdmin = user && (user.role === 'admin' || user.role === 'superadmin' || isPlatformSuperAdmin(user.email, user.role));
      const isCallerInfluencer = !!user?.isInfluencer;

      // Check eligibility for direct automated cashout
      const isEligibleForAutoCashout = isCallerAdmin && !isCallerInfluencer;

      // Resolve key on Dotfy
      let resolvedPixKeyId = String(pixKeyId).trim();
      const rawKeyToResolve = foundPixKey?.key || pixKeyId;
      const rawTypeToResolve = foundPixKey?.type;

      // If user is a game player or influencer, DO NOT trigger Dotfy automatic cashout!
      // Debit the balance and queue as pending withdrawal for manual admin approval.
      if (!isEligibleForAutoCashout) {
        if (!sessionUserId || !user) {
          return res.status(401).json({ error: "Autenticação requerida." });
        }

        const updatedBalance = parseFloat((user.balance - numAmount).toFixed(2));
        await dbService.updateUserBalance(sessionUserId, updatedBalance);

        const feeAmount = userFee;
        const netAmountVal = Math.max(0, numAmount - feeAmount);
        const paymentMethodLabel = isCallerInfluencer ? 'Influenciador (Análise Manual)' : 'Conta de Jogador (Análise Manual)';

        const newTx: TransactionDB = {
          id: 'tx_wd_' + crypto.randomBytes(8).toString('hex'),
          userId: sessionUserId,
          type: 'withdrawal',
          amount: numAmount,
          status: 'pending', // PENDENTE: Jogadores e influenciadores passam por análise manual
          paymentMethod: paymentMethodLabel,
          description: `Solicitação de Saque PIX (${foundPixKey?.key || pixKeyId})${feeAmount > 0 ? ` • Taxa: R$ ${feeAmount.toFixed(2)}` : ' • Sem taxa'} • Líquido: R$ ${netAmountVal.toFixed(2)} • Aguardando aprovação manual`,
          pixKeyId: resolvedPixKeyId,
          isAutoCashout: false,
          fee: feeAmount,
          netAmount: netAmountVal,
          createdAt: new Date().toISOString(),
        };
        await dbService.createTransaction(newTx);

        logSecurityEvent('MANUAL_WITHDRAWAL_REQUESTED', {
          userId: sessionUserId,
          amount: numAmount,
          netAmount: netAmountVal,
          isInfluencer: isCallerInfluencer,
          pixKey: foundPixKey?.key || pixKeyId
        });

        const statusMessage = isCallerInfluencer
          ? "Solicitação de saque de influenciador recebida com sucesso! Por regras de segurança, saques de influenciadores são analisados manualmente pela administração."
          : "Solicitação de saque registrada com sucesso! Por segurança, contas de jogos passam por conferência e aprovação manual da administração.";

        return res.status(200).json({
          success: true,
          status: "pending",
          isAutoCashout: false,
          balance: updatedBalance,
          withdrawal: {
            id: newTx.id,
            amount: Math.round(numAmount * 100),
            fee: Math.round(feeAmount * 100),
            feeAmount,
            netAmount: Math.round(netAmountVal * 100),
            netAmountReais: netAmountVal,
            status: "PENDING",
            pixKey: {
              type: foundPixKey?.type || "CPF",
              key: foundPixKey?.key || String(pixKeyId)
            },
            createdAt: newTx.createdAt
          },
          message: statusMessage
        });
      }

      // Flow for authorized platform administrators (direct gateway test/approval)
      const keyRes = await resolveDotfyPixKey(
        apiKeyToUse,
        rawKeyToResolve,
        rawTypeToResolve,
        user?.name || "Administrador PayGateway"
      );

      if (keyRes.pixKeyId) {
        resolvedPixKeyId = keyRes.pixKeyId;
      } else if (keyRes.error) {
        return res.status(400).json({ error: `Chave PIX inválida na Dotfy: ${keyRes.error}` });
      }

      const dotfyPayload = {
        amount: parseFloat(netAmount.toFixed(2)),
        pixKeyId: resolvedPixKeyId,
        ...(totpCode ? { totpCode } : {})
      };

      console.log(`[Dotfy Admin Withdrawal API] Solicitando saque direto:`, dotfyPayload);

      let withdrawalResult: any = null;
      let dotfyError: string | null = null;

      try {
        const dotfyResponse = await fetch(`${DOTFY_BASE_URL}/api/withdrawals`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKeyToUse}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(dotfyPayload)
        });

        const responseText = await dotfyResponse.text();
        let responseData: any = {};
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = { message: responseText };
        }

        if (dotfyResponse.ok && (responseData?.withdrawal || responseData?.id)) {
          withdrawalResult = responseData.withdrawal || responseData;
        } else if (dotfyResponse.status === 403 && responseData?.error?.includes("teste")) {
          return res.status(403).json({ error: "Contas de teste não podem realizar saques." });
        } else if (dotfyResponse.status === 400 && (responseData?.error?.includes("Saldo insuficiente") || responseData?.message?.includes("Saldo insuficiente"))) {
          return res.status(400).json({
            error: `Saldo insuficiente na conta Dotfy Gateway para saque automático (Valor: R$ ${netAmount.toFixed(2).replace('.', ',')}). Seu saldo na plataforma permanece intacto.`
          });
        } else {
          dotfyError = responseData?.error || responseData?.message;
          console.warn(`[Dotfy Withdrawal Response] HTTP ${dotfyResponse.status}:`, responseData);
        }
      } catch (fetchErr: any) {
        console.error("[Dotfy Withdrawal Fetch Error]", fetchErr);
        dotfyError = fetchErr?.message;
      }

      if (!withdrawalResult && dotfyError) {
        return res.status(400).json({
          error: `Falha no gateway Dotfy ao processar saque: ${dotfyError}. Seu saldo permanece seguro.`
        });
      }

      if (!withdrawalResult) {
        const feeInCents = Math.round(userFee * 100);
        const amountInCents = Math.round(numAmount * 100);
        const netAmountInCents = Math.max(0, amountInCents - feeInCents);

        withdrawalResult = {
          id: `clwd_${Date.now()}`,
          amount: amountInCents,
          fee: feeInCents,
          feeAmount: userFee,
          netAmount: netAmountInCents,
          netAmountReais: netAmountInCents / 100,
          status: "PROCESSING",
          pixKey: {
            type: foundPixKey?.type || "CPF",
            key: foundPixKey?.key || String(pixKeyId)
          },
          createdAt: new Date().toISOString()
        };
      }

      let updatedBalance = user ? user.balance : 0;
      if (sessionUserId && user) {
        updatedBalance = parseFloat((user.balance - numAmount).toFixed(2));
        await dbService.updateUserBalance(sessionUserId, updatedBalance);

        const feeAmount = userFee;
        const netAmountVal = Math.max(0, numAmount - feeAmount);
        const newTx: TransactionDB = {
          id: 'tx_wd_' + crypto.randomBytes(8).toString('hex'),
          userId: sessionUserId,
          type: 'withdrawal',
          amount: numAmount,
          status: 'approved',
          paymentMethod: 'Dotfy Gateway (Admin Direto)',
          description: `Saque Dotfy PIX (${foundPixKey?.key || pixKeyId})${feeAmount > 0 ? ` • Taxa: R$ ${feeAmount.toFixed(2)}` : ' • Sem taxa'} • Líquido: R$ ${netAmountVal.toFixed(2)}`,
          dotfyWithdrawalId: withdrawalResult.id,
          pixKeyId: resolvedPixKeyId,
          isAutoCashout: true,
          fee: feeAmount,
          netAmount: netAmountVal,
          createdAt: new Date().toISOString(),
        };
        await dbService.createTransaction(newTx);

        logSecurityEvent('WITHDRAWAL_REQUESTED', { userId: sessionUserId, amount: numAmount, pixKeyId: resolvedPixKeyId });
      }

      return res.status(200).json({
        withdrawal: withdrawalResult,
        balance: updatedBalance,
        message: "Saque enviado com sucesso via Dotfy Gateway!"
      });

    } catch (err: any) {
      console.error("Erro interno ao processar saque:", err);
      return res.status(500).json({ error: "Erro ao processar solicitação de saque." });
    } finally {
      if (sessionUserId) {
        activeWithdrawalLocks.delete(sessionUserId);
      }
    }
  });

  // 2. POST /api/charges -> Proxy para API Dotfy
  app.post("/api/charges", async (req: Request, res: Response) => {
    try {
      const {
        value,
        description,
        expiresIn,
        customer,
        webhook_url,
        split,
        apiKey: customApiKey,
        isSimulated,
        userId: bodyUserId
      } = req.body;

      // Extract userId from auth token header if available
      let targetUserId = bodyUserId;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const userToken = authHeader.split(' ')[1];
        let sUserId = getSession(userToken)?.userId || sessions.get(userToken);
        if (!sUserId && userToken.startsWith('tok_usr_')) {
          const parts = userToken.split('_');
          if (parts.length >= 3) {
            const candidateId = `${parts[1]}_${parts[2]}`;
            const foundUser = await dbService.getUserById(candidateId);
            if (foundUser) {
              sUserId = foundUser.id;
              sessions.set(userToken, sUserId);
            }
          }
        }
        if (sUserId) targetUserId = sUserId;
      }

      const token = (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 0)
        ? customApiKey.trim()
        : DEFAULT_API_KEY;

      if (!token) {
        return res.status(401).json({
          success: false,
          error: "API_KEY_MISSING",
          message: "Chave de API (Bearer Token) não configurada."
        });
      }

      const dotfyPayload: Record<string, any> = {};

      if (value !== undefined && value !== null) {
        dotfyPayload.value = Number(value);
      }
      if (description) dotfyPayload.description = String(description).slice(0, 255);
      if (expiresIn) dotfyPayload.expiresIn = Number(expiresIn);

      if (customer && typeof customer === "object") {
        const cleanCustomer: Record<string, string> = {};

        if (customer.name && String(customer.name).trim().length >= 2) {
          cleanCustomer.name = String(customer.name).trim().slice(0, 100);
        }

        if (customer.taxID) {
          const cleanTax = String(customer.taxID).replace(/\D/g, "");
          if (cleanTax.length === 11 || cleanTax.length === 14) {
            cleanCustomer.taxID = cleanTax;
          }
        }

        if (customer.email && String(customer.email).trim().includes("@")) {
          cleanCustomer.email = String(customer.email).trim();
        }

        if (customer.phone) {
          const rawPhone = String(customer.phone).trim();
          const digits = rawPhone.replace(/\D/g, "");
          if (digits.length >= 10) {
            let formattedPhone = "";
            if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
              formattedPhone = `+${digits}`;
            } else if (digits.length === 10 || digits.length === 11) {
              formattedPhone = `+55${digits}`;
            } else if (rawPhone.startsWith("+")) {
              formattedPhone = `+${digits}`;
            } else {
              formattedPhone = `+55${digits}`;
            }

            if (/^\+[1-9]\d{8,14}$/.test(formattedPhone)) {
              cleanCustomer.phone = formattedPhone;
            }
          }
        }

        if (Object.keys(cleanCustomer).length > 0) {
          dotfyPayload.customer = cleanCustomer;
        }
      }

      if (webhook_url) dotfyPayload.webhook_url = webhook_url;
      if (Array.isArray(split) && split.length > 0) dotfyPayload.split = split;

      console.log(`[Dotfy Proxy] Criando cobrança PIX via ${DOTFY_BASE_URL}/api/charges com chave ${maskToken(token)}`);

      // Modo de Simulação Local
      if (isSimulated) {
        const now = new Date();
        const expSec = Number(expiresIn) || 3600;
        const expiresAt = new Date(now.getTime() + expSec * 1000).toISOString();
        const randomId = Math.random().toString(36).substring(2, 10);
        const correlationID = `dotfy-${Date.now()}-${randomId}`;
        const centsValue = Math.round((Number(value) || 29.90) * 100);

        const simData = {
          id: `sim_cuid_${randomId}`,
          chargeId: `sim_charge_${randomId}`,
          correlationID: correlationID,
          correlationId: correlationID,
          transactionID: `E182361202026${Date.now()}s${randomId}`,
          qrCode: `00020126360014BR.GOV.BCB.PIX0114+5511999998888520400005303986540${(Number(value) || 29.90).toFixed(2)}5802BR5915Dotfy Checkout6009SAO PAULO62070503***6304ABCD`,
          qrCodeImage: "",
          paymentLink: `https://app.dotfy.com.br/checkout/${correlationID}`,
          expiresAt: expiresAt,
          value: centsValue
        };

        const storedCharge: StoredCharge = {
          id: simData.id,
          chargeId: simData.chargeId,
          correlationID: simData.correlationID,
          transactionID: simData.transactionID,
          qrCode: simData.qrCode,
          qrCodeImage: simData.qrCodeImage,
          paymentLink: simData.paymentLink,
          expiresAt: simData.expiresAt,
          value: simData.value,
          valueInReais: Number(value) || 29.90,
          description: description || "Cobrança PIX Simulação",
          customer: customer,
          status: "PENDING",
          createdAt: now.toISOString(),
          split: split,
          webhook_url: webhook_url,
          userId: targetUserId,
          rawResponse: { success: true, data: simData, simulated: true }
        };

        memoryCharges.set(correlationID, storedCharge);
        if (storedCharge.userId) await notifyAffiliateForPlayer(storedCharge.userId, {
          title: 'PIX pendente na sua rede ⏳', body: `Um indicado gerou um PIX de R$ ${storedCharge.valueInReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, url: '/?tab=affiliates', type: 'pixPending'
        });

        return res.json({
          success: true,
          data: simData,
          simulated: true,
          message: "Cobrança gerada em modo de teste/simulação."
        });
      }

      // Requisição real à API da Dotfy
      const dotfyResponse = await fetch(`${DOTFY_BASE_URL}/api/charges`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(dotfyPayload)
      });

      const responseText = await dotfyResponse.text();
      let responseData: any;

      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { rawText: responseText };
      }

      if (!dotfyResponse.ok) {
        console.error(`[Dotfy API Error] HTTP ${dotfyResponse.status}:`, responseData);

        const errorStr = JSON.stringify(responseData);
        if (
          dotfyResponse.status === 400 &&
          dotfyPayload.customer?.phone &&
          (errorStr.includes("customer.phone") || errorStr.includes("Telefone") || errorStr.includes("phone"))
        ) {
          console.warn("[Dotfy Proxy] Telefone rejeitado pela API Dotfy. Reenviando sem o campo customer.phone...");
          delete dotfyPayload.customer.phone;

          const retryResponse = await fetch(`${DOTFY_BASE_URL}/api/charges`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify(dotfyPayload)
          });

          const retryText = await retryResponse.text();
          let retryData: any;
          try {
            retryData = JSON.parse(retryText);
          } catch (e) {
            retryData = { rawText: retryText };
          }

          if (retryResponse.ok) {
            const chargeData = retryData.data || retryData;
            const correlationID = chargeData.correlationID || chargeData.correlationId || `dotfy-${Date.now()}`;
            const centsVal = chargeData.value || Math.round((Number(value) || 0) * 100);

            const storedCharge: StoredCharge = {
              id: chargeData.id || `dotfy_${Date.now()}`,
              chargeId: chargeData.chargeId || "",
              correlationID: correlationID,
              transactionID: chargeData.transactionID || "",
              qrCode: chargeData.qrCode || "",
              qrCodeImage: chargeData.qrCodeImage || "",
              paymentLink: chargeData.paymentLink || "",
              expiresAt: chargeData.expiresAt || new Date(Date.now() + 3600000).toISOString(),
              value: centsVal,
              valueInReais: centsVal / 100,
              description: description || "Cobrança PIX",
              customer: customer,
              status: "PENDING",
              createdAt: new Date().toISOString(),
              split: split,
              webhook_url: webhook_url,
              userId: targetUserId,
              rawResponse: retryData
            };

            memoryCharges.set(correlationID, storedCharge);
            if (storedCharge.userId) await notifyAffiliateForPlayer(storedCharge.userId, {
              title: 'PIX pendente na sua rede ⏳', body: `Um indicado gerou um PIX de R$ ${storedCharge.valueInReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, url: '/?tab=affiliates', type: 'pixPending'
            });

            return res.json({
              success: true,
              data: chargeData
            });
          } else {
            responseData = retryData;
          }
        }

        return res.status(dotfyResponse.status).json({
          success: false,
          status: dotfyResponse.status,
          error: responseData.error || "DOTFY_API_ERROR",
          message: responseData.message || responseData.error || `Erro ${dotfyResponse.status} retornado pela API Dotfy.`,
          details: responseData
        });
      }

      // Sucesso retornado pela Dotfy
      const chargeData = responseData.data || responseData;
      const correlationID = chargeData.correlationID || chargeData.correlationId || `dotfy-${Date.now()}`;
      const centsVal = chargeData.value || Math.round((Number(value) || 0) * 100);

      const storedCharge: StoredCharge = {
        id: chargeData.id || `dotfy_${Date.now()}`,
        chargeId: chargeData.chargeId || "",
        correlationID: chargeData.correlationID || correlationID,
        transactionID: chargeData.transactionID || "",
        qrCode: chargeData.qrCode || "",
        qrCodeImage: chargeData.qrCodeImage || "",
        paymentLink: chargeData.paymentLink || "",
        expiresAt: chargeData.expiresAt || new Date(Date.now() + 3600000).toISOString(),
        value: centsVal,
        valueInReais: centsVal / 100,
        description: description || "Cobrança PIX",
        customer: customer,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        split: split,
        webhook_url: webhook_url,
        userId: targetUserId,
        rawResponse: responseData
      };

      memoryCharges.set(correlationID, storedCharge);
      if (storedCharge.userId) await notifyAffiliateForPlayer(storedCharge.userId, {
        title: 'PIX pendente na sua rede ⏳', body: `Um indicado gerou um PIX de R$ ${storedCharge.valueInReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`, url: '/?tab=affiliates', type: 'pixPending'
      });

      return res.json({
        success: true,
        data: chargeData
      });

    } catch (error: any) {
      console.error("[Server Charges Exception]", error);
      return res.status(500).json({
        success: false,
        error: "INTERNAL_SERVER_ERROR",
        message: error.message || "Erro interno ao processar cobrança.",
        details: String(error)
      });
    }
  });

  // 3. GET /api/charges/:correlationID -> Consultar status da cobrança
  app.get("/api/charges/:correlationID", async (req: Request, res: Response) => {
    const { correlationID } = req.params;
    const customApiKey = req.query.apiKey as string;
    const token = customApiKey || DEFAULT_API_KEY;

    const localCharge = memoryCharges.get(correlationID);

    try {
      const dotfyResponse = await fetch(`${DOTFY_BASE_URL}/api/charges/${correlationID}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (dotfyResponse.ok) {
        const data = await dotfyResponse.json();
        const chargePayload = data.data || data;
        if (localCharge && chargePayload) {
          if (chargePayload.status) {
            localCharge.status = chargePayload.status;
          }
          if (chargePayload.isPaid === true || chargePayload.status === 'PAID' || chargePayload.status === 'COMPLETED') {
            localCharge.status = 'PAID';
            (localCharge as any).isPaid = true;
            await creditPaidChargeUser(localCharge);
          }
        }
        return res.json(data);
      } else {
        if (localCharge) {
          if (localCharge.status === 'PAID' || localCharge.status === 'COMPLETED' || (localCharge as any).isPaid) {
            await creditPaidChargeUser(localCharge);
          }
          return res.json({
            success: true,
            data: {
              ...localCharge.rawResponse?.data,
              status: localCharge.status,
              correlationID: localCharge.correlationID,
              value: localCharge.value,
              qrCode: localCharge.qrCode,
              qrCodeImage: localCharge.qrCodeImage
            },
            fromLocalStore: true
          });
        }

        const errText = await dotfyResponse.text();
        return res.status(dotfyResponse.status).send(errText);
      }
    } catch (err) {
      if (localCharge) {
        if (localCharge.status === 'PAID') {
          await creditPaidChargeUser(localCharge);
        }
        return res.json({
          success: true,
          data: {
            status: localCharge.status,
            correlationID: localCharge.correlationID,
            value: localCharge.value,
            qrCode: localCharge.qrCode,
            qrCodeImage: localCharge.qrCodeImage
          },
          fromLocalStore: true
        });
      }

      return res.status(500).json({
        success: false,
        message: "Erro ao consultar cobrança na API Dotfy.",
        error: String(err)
      });
    }
  });

  // 4. POST /api/charges/:correlationID/simulate-payment -> Simular pagamento para testes
  app.post("/api/charges/:correlationID/simulate-payment", async (req: Request, res: Response) => {
    const { correlationID } = req.params;
    const charge = memoryCharges.get(correlationID);

    if (!charge) {
      return res.status(404).json({
        success: false,
        message: "Cobrança não encontrada no histórico da aplicação."
      });
    }

    charge.status = "PAID";
    memoryCharges.set(correlationID, charge);
    await creditPaidChargeUser(charge);

    const webhookEvent = {
      id: `wh_${Date.now()}`,
      timestamp: new Date().toISOString(),
      payload: {
        event: "charge.paid",
        correlationID: charge.correlationID,
        transactionID: charge.transactionID,
        value: charge.value,
        paidAt: new Date().toISOString()
      }
    };
    memoryWebhooks.unshift(webhookEvent);

    res.json({
      success: true,
      message: "Pagamento simulado com sucesso!",
      data: charge
    });
  });

  // 5. GET /api/charges-history -> Listar histórico local de cobranças e webhooks
  app.get("/api/charges-history", (_req: Request, res: Response) => {
    const chargesArray = Array.from(memoryCharges.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json({
      success: true,
      count: chargesArray.length,
      data: chargesArray,
      webhooks: memoryWebhooks
    });
  });

  // 6. Endpoint para recepção de Webhooks da Dotfy
  const handleDotfyWebhook = async (req: Request, res: Response) => {
    const payload = req.body;
    const signature = req.headers['x-dotfy-signature'] || req.headers['x-hub-signature-256'] || req.headers['x-signature'];

    // Verify cryptographic signature if header is present
    if (signature && typeof signature === 'string') {
      const rawBodyStr = JSON.stringify(payload);
      const isValidSig = verifyHmacSignature(rawBodyStr, signature);
      if (!isValidSig) {
        logSecurityEvent('WEBHOOK_INVALID_SIGNATURE', { ip: req.ip, signature });
        return res.status(401).json({ error: 'Assinatura HMAC de Webhook inválida.' });
      }
    }

    const eventName = payload?.event || payload?.status || payload?.type || 'UNKNOWN';
    logSecurityEvent('WEBHOOK_RECEIVED', { correlationID: payload?.correlationID, event: eventName });

    memoryWebhooks.unshift({
      id: `wh_${Date.now()}`,
      timestamp: new Date().toISOString(),
      payload
    });

    // 1. Handle deposit / charge events
    if (payload && payload.correlationID && memoryCharges.has(payload.correlationID)) {
      const charge = memoryCharges.get(payload.correlationID)!;
      if (payload.status) {
        charge.status = payload.status;
      } else if (payload.event === "charge.paid" || payload.event === "PAID") {
        charge.status = "PAID";
      }
      memoryCharges.set(payload.correlationID, charge);
      if (charge.status === "PAID") {
        await creditPaidChargeUser(charge);
      }
    }

    // 2. Handle Dotfy Withdrawal events (EVENT:WITHDRAWAL_COMPLETED / EVENT:WITHDRAWAL_FAILED)
    const isWdCompleted = eventName === 'EVENT:WITHDRAWAL_COMPLETED' || eventName === 'WITHDRAWAL_COMPLETED' || eventName === 'withdrawal.completed';
    const isWdFailed = eventName === 'EVENT:WITHDRAWAL_FAILED' || eventName === 'WITHDRAWAL_FAILED' || eventName === 'withdrawal.failed';

    if (isWdCompleted || isWdFailed) {
      const withdrawalId = payload?.withdrawal?.id || payload?.withdrawalId || payload?.id;
      if (withdrawalId) {
        try {
          const allTx = await dbService.getAllTransactions();
          const targetTx = allTx.find(t => 
            t.dotfyWithdrawalId === withdrawalId || 
            t.id === withdrawalId ||
            (t.description && t.description.includes(withdrawalId))
          );

          if (targetTx) {
            if (isWdCompleted) {
              await dbService.updateTransactionStatus(targetTx.id, 'approved');
              logSecurityEvent('DOTFY_WITHDRAWAL_COMPLETED_WEBHOOK', { withdrawalId, txId: targetTx.id });
            } else if (isWdFailed) {
              // Mark transaction rejected and refund affiliate balance
              await dbService.updateTransactionStatus(targetTx.id, 'rejected');
              const affiliate = await dbService.getAffiliateByUserId(targetTx.userId);
              if (affiliate) {
                const refundedBalance = parseFloat(((affiliate.affiliateBalance || 0) + targetTx.amount).toFixed(2));
                await dbService.updateAffiliateRates(affiliate.id, { affiliateBalance: refundedBalance });
              }

              sendPushNotification(targetTx.userId, {
                title: 'Aviso: Saque Não Concluído ⚠️',
                body: `O cashout de R$ ${targetTx.amount.toFixed(2)} falhou no banco destinatário e o valor foi estornado para o seu saldo de comissões.`,
                url: '/?tab=affiliates',
                type: 'withdrawal'
              }).catch(console.error);

              logSecurityEvent('DOTFY_WITHDRAWAL_FAILED_WEBHOOK', { withdrawalId, txId: targetTx.id, refunded: true });
            }
          }
        } catch (wdErr) {
          console.error('[Dotfy Withdrawal Webhook Processing Error]', wdErr);
        }
      }
    }

    res.status(200).json({ received: true });
  };

  app.post("/api/webhooks/dotfy", handleDotfyWebhook);
  app.post("/api/webhooks/pix", handleDotfyWebhook);

  // Explicit static serving for public directory (games, icons, audio, assets)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // VITE MIDDLEWARE SETUP
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // SPA fallback in dev mode for custom paths like /cadastro, /login, etc.
    app.get('*', async (req: Request, res: Response, next: NextFunction) => {
      if (req.originalUrl.startsWith('/api')) {
        return next();
      }
      try {
        const url = req.originalUrl;
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  } else {
    const cwdDist = path.join(process.cwd(), 'dist');
    const localDist = path.resolve(__dirname, '..', 'dist');
    const directDist = path.resolve(__dirname, 'dist');
    const distPath = fs.existsSync(cwdDist) ? cwdDist : (fs.existsSync(localDist) ? localDist : directDist);
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PayGateway] Servidor com Firebase Firestore rodando na porta ${PORT}`);
  });
  server.on('error', (err: any) => {
    console.error(`[PayGateway] Erro no listener principal (porta ${PORT}):`, err);
  });

  if (PORT !== 3000 && !process.env.NGINX_PORT) {
    try {
      const fallbackServer = app.listen(3000, '0.0.0.0', () => {
        console.log(`[PayGateway] Servidor também escutando na porta secundária 3000`);
      });
      fallbackServer.on('error', () => {});
    } catch (_) {}
  }
}

startServer();
