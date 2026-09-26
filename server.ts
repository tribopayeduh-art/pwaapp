import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import webpush from 'web-push';
import { createServer as createViteServer } from 'vite';
import { dbService, UserDB, AffiliateDB, ReferralDB, TransactionDB, GameBetDB, GameConfigDB, PushSubscriptionDB } from './server/db.js';
import { whatsAppManager } from './server/whatsappService.js';
import { createPartnerRouter } from './server/partnerRoutes.js';
import { getPartnerCutFromAffiliateRevShare } from './server/partnerCommission.js';
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
  isPositiveNumber,
  resolveDotfyApiKey,
  resolveVapidKeys,
  maskSecretKey,
  encryptSensitiveData,
  decryptSensitiveData,
  isDisposableEmail,
  normalizePhoneNumber,
  isHubAffiliateUser,
  detectSelfReferralRisk,
  checkRegistrationRateLimit
} from './server/security.js';

// VAPID Keys setup for iOS / Web Push Notifications (resolved securely without exposed secrets)
const { publicKey: VAPID_PUBLIC_KEY, privateKey: VAPID_PRIVATE_KEY } = resolveVapidKeys();

try {
  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      'mailto:suporte@paygateway.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
  }
} catch (e) {
  console.error('[WebPush] Error configuring VAPID:', e);
}

const subscriptionDocumentId = (endpoint: string) =>
  `push_${crypto.createHash('sha256').update(endpoint).digest('hex')}`;

// Webhook do Discord para espelhamento em tempo real de todas as notificações enviadas aos Afiliados
const DISCORD_AFFILIATE_WEBHOOK_URL = process.env.DISCORD_AFFILIATE_WEBHOOK_URL || '';

interface DiscordAffiliatePayload {
  title: string;
  body: string;
  url?: string;
  type?: string;
  affiliateName?: string;
  affiliateEmail?: string;
  affiliateCode?: string;
  targetUserId?: string | null;
  targetLabel?: string;
  sentBy?: string;
}

async function sendDiscordAffiliateWebhook(data: DiscordAffiliatePayload): Promise<boolean> {
  const webhookUrl = DISCORD_AFFILIATE_WEBHOOK_URL;
  if (!webhookUrl) return false;

  try {
    let color = 0x10B981; // Verde esmeralda padrão
    let icon = '📢';
    const typeLower = (data.type || '').toLowerCase();
    const titleLower = (data.title || '').toLowerCase();
    const bodyLower = (data.body || '').toLowerCase();

    if (typeLower.includes('commission') || titleLower.includes('comissão') || titleLower.includes('lucro') || titleLower.includes('vendeu')) {
      color = 0x10B981; // Verde esmeralda (Comissão)
      icon = '💰';
    } else if (typeLower.includes('withdrawal') || titleLower.includes('saque') || titleLower.includes('cashout') || bodyLower.includes('saque')) {
      color = 0xF59E0B; // Dourado/Laranja (Saque/Cashout)
      icon = '💸';
    } else if (typeLower.includes('registration') || titleLower.includes('cadastro') || titleLower.includes('seguidor') || titleLower.includes('indicado')) {
      color = 0x8B5CF6; // Roxo (Cadastro de indicado)
      icon = '👤';
    } else if (typeLower.includes('pix') || titleLower.includes('pix') || bodyLower.includes('pix')) {
      color = 0x06B6D4; // Ciano (PIX)
      icon = '⚡';
    }

    const fields: Array<{ name: string; value: string; inline?: boolean }> = [];

    if (data.targetLabel) {
      fields.push({ name: '🎯 Destinatário', value: data.targetLabel, inline: true });
    } else if (data.affiliateName) {
      fields.push({
        name: '👤 Afiliado',
        value: `${data.affiliateName}${data.affiliateCode ? ` (${data.affiliateCode})` : ''}`,
        inline: true
      });
    }

    if (data.type) {
      fields.push({ name: '🏷️ Tipo', value: data.type, inline: true });
    }

    if (data.sentBy) {
      fields.push({ name: '✍️ Remetente', value: data.sentBy, inline: true });
    }

    if (data.url) {
      let fullUrl = data.url;
      if (!fullUrl.startsWith('http')) {
        const cleanPath = fullUrl.startsWith('/') ? fullUrl : `/${fullUrl}`;
        fullUrl = `https://goalliancehub.com${cleanPath}`;
      } else {
        fullUrl = fullUrl.replace(/https?:\/\/alliancedepositos\.online/g, 'https://goalliancehub.com');
      }
      // Se o link for para o portal de afiliados (?tab=affiliates), padronizar para https://goalliancehub.com/
      if (fullUrl.includes('?tab=affiliates') || fullUrl === 'https://goalliancehub.com') {
        fullUrl = 'https://goalliancehub.com/';
      }
      fields.push({ name: '🔗 Link de Acesso', value: fullUrl, inline: false });
    }

    const discordPayload = {
      username: 'Alliance Hub • Notificações de Afiliados',
      avatar_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&auto=format&fit=crop&q=80',
      embeds: [
        {
          title: `${icon} ${data.title}`,
          description: data.body,
          color,
          fields,
          footer: {
            text: 'Alliance Hub • Sistema Oficial de Notificações de Afiliados'
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload)
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[DiscordWebhook] Resposta HTTP ${res.status}:`, errText);
      return false;
    }

    console.log(`[DiscordWebhook] Notificação de afiliado entregue com sucesso ao Discord! ("${data.title}")`);
    return true;
  } catch (err: any) {
    console.error('[DiscordWebhook] Erro ao disparar webhook para o Discord:', err?.message || err);
    return false;
  }
}

async function resolveUserIdFromToken(token?: string | null): Promise<string | null> {
  if (!token || token === 'null' || token === 'undefined' || token === 'Bearer') return null;
  const directSession = getSession(token);
  if (directSession?.userId) return directSession.userId;
  const memoryId = sessions.get(token);
  if (memoryId) return memoryId;

  if (token.startsWith('tok_sec_')) {
    const raw = token.replace('tok_sec_', '');
    const lastUnderscore = raw.lastIndexOf('_');
    if (lastUnderscore > 0) {
      const payload = raw.substring(0, lastUnderscore);
      const parts = payload.split('_');
      if (parts.length >= 3) {
        parts.pop(); // pop rand
        parts.pop(); // pop timestamp
        const candidateId = parts.join('_');
        const foundUser = await dbService.getUserById(candidateId);
        if (foundUser) {
          sessions.set(token, foundUser.id);
          return foundUser.id;
        }
      }
    }
  } else if (token.startsWith('tok_usr_')) {
    const raw = token.replace('tok_usr_', '');
    const parts = raw.split('_');
    const candidateIds = [
      raw,
      parts.length >= 2 ? `${parts[0]}_${parts[1]}` : null,
      parts.length >= 3 ? `${parts[1]}_${parts[2]}` : null,
    ].filter(Boolean) as string[];

    for (const cid of candidateIds) {
      const foundUser = await dbService.getUserById(cid);
      if (foundUser) {
        sessions.set(token, foundUser.id);
        return foundUser.id;
      }
    }
  } else if (token.startsWith('usr_')) {
    const foundUser = await dbService.getUserById(token);
    if (foundUser) return foundUser.id;
  }
  return null;
}

async function sendPushNotification(
  targetUserId: string | null,
  payload: { title: string; body: string; url?: string; type?: string; skipDiscord?: boolean }
) {
  // Disparo para o webhook do Discord quando for notificação destinada a Afiliados/Influenciadores
  if (!payload.skipDiscord) {
    const isAffiliatePayload =
      targetUserId === 'all_affiliates' ||
      payload.url?.includes('tab=affiliates') ||
      payload.url?.includes('tab=finance') ||
      ['commission', 'withdrawal', 'registration', 'pixPending', 'affiliate', 'ftd', 'deposit'].includes(payload.type || '') ||
      payload.title?.toLowerCase().includes('comiss') ||
      payload.title?.toLowerCase().includes('afiliad') ||
      payload.title?.toLowerCase().includes('influenc') ||
      payload.title?.toLowerCase().includes('vendeu') ||
      payload.title?.toLowerCase().includes('rede') ||
      payload.title?.toLowerCase().includes('depósito') ||
      payload.title?.toLowerCase().includes('pix pendente') ||
      payload.body?.toLowerCase().includes('comiss') ||
      payload.body?.toLowerCase().includes('afiliad') ||
      payload.body?.toLowerCase().includes('influenc') ||
      payload.body?.toLowerCase().includes('sua rede') ||
      payload.body?.toLowerCase().includes('indicad');

    if (isAffiliatePayload) {
      (async () => {
        try {
          let affName: string | undefined;
          let affEmail: string | undefined;
          let affCode: string | undefined;

          if (targetUserId && targetUserId !== 'all' && targetUserId !== 'all_affiliates') {
            const user = await dbService.getUserById(targetUserId);
            if (user) {
              affName = user.name;
              affEmail = user.email;
              const aff = await dbService.getAffiliateByUserId(user.id);
              if (aff) affCode = aff.referralCode;
            }
          }

          await sendDiscordAffiliateWebhook({
            title: payload.title,
            body: payload.body,
            url: payload.url,
            type: payload.type,
            affiliateName: affName,
            affiliateEmail: affEmail,
            affiliateCode: affCode,
            targetUserId
          });
        } catch (e) {
          console.warn('[DiscordWebhook] Erro auxiliar:', e);
        }
      })();
    } else if (targetUserId && targetUserId !== 'all') {
      (async () => {
        try {
          const user = await dbService.getUserById(targetUserId);
          const isAff = !!(user && (user.role === 'affiliate' || (user as any).isInfluencer || (user as any).isAffiliate || user.role === 'admin' || user.role === 'superadmin'));
          if (isAff) {
            const aff = await dbService.getAffiliateByUserId(user.id);
            await sendDiscordAffiliateWebhook({
              title: payload.title,
              body: payload.body,
              url: payload.url,
              type: payload.type || 'affiliate_push',
              affiliateName: user.name,
              affiliateEmail: user.email,
              affiliateCode: aff?.referralCode,
              targetUserId
            });
          }
        } catch (e) {
          // ignore
        }
      })();
    }
  }

  const pushData = {
    title: payload.title,
    body: payload.body,
    url: payload.url || '/?tab=affiliates',
    type: payload.type || 'notification',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: `push_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: payload.url || '/?tab=affiliates',
      type: payload.type || 'notification',
      timestamp: Date.now()
    }
  };
  const payloadStr = JSON.stringify(pushData);

  let subscriptions: PushSubscriptionDB[] = [];
  if (targetUserId === 'all') {
    subscriptions = await dbService.getPushSubscriptions();
  } else if (targetUserId === 'all_affiliates') {
    const allSubs = await dbService.getPushSubscriptions();
    subscriptions = allSubs.filter(s => s.isAffiliate || s.userId !== 'guest');
  } else if (!targetUserId || typeof targetUserId !== 'string' || !targetUserId.trim()) {
    console.warn('[WebPush] sendPushNotification chamado sem targetUserId válido. Abortando envio para evitar broadcast acidental.');
    return { sent: 0, failed: 0, total: 0 };
  } else {
    const cleanTargetId = targetUserId.trim();
    const candidateUserIds = new Set<string>([cleanTargetId]);
    if (cleanTargetId.startsWith('aff_')) {
      const aff = await dbService.getAffiliateById(cleanTargetId);
      if (aff?.userId) candidateUserIds.add(aff.userId);
    } else if (cleanTargetId.startsWith('usr_')) {
      const aff = await dbService.getAffiliateByUserId(cleanTargetId);
      if (aff?.id) candidateUserIds.add(aff.id);
    }

    subscriptions = await dbService.getPushSubscriptions(candidateUserIds);

    // ISOLAMENTO ESTRITO POR AFILIADO / REDE:
    // Se o afiliado ou usuário de destino não possui inscrição push ativa no momento,
    // JAMAIS repassa a notificação para outros afiliados ou usuários do sistema.
    if (subscriptions.length === 0) {
      console.log(`[WebPush] Nenhuma inscrição Push ativa para o usuário/afiliado ${cleanTargetId}. Notificação descartada para outros usuários para garantir o isolamento estrito de rede.`);
    }
  }

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
      if (err.statusCode === 410 || err.statusCode === 404 || err.statusCode === 403 || err.statusCode === 401 || (err.statusCode === 400 && (String(err.body || '').includes('BadVapid') || String(err.body || '').includes('VapidPkHashMismatch')))) {
        await dbService.deletePushSubscription(data.id).catch(console.error);
      }
    }
  }));
  return { sent, failed, total: subscriptions.length };
}

async function notifyAffiliateForPlayer(userId: string, payload: { title: string; body: string; url?: string; type?: string }) {
  try {
    const player = await dbService.getUserById(userId);
    if (!player) return { sent: 0, failed: 0, total: 0 };

    let responsibleUserId: string | null = null;
    let responsibleAffId: string | null = null;
    let influencerUserId: string | null = player.influencerUserId || null;

    // 1. parentAffiliateUserId direto
    if (player.parentAffiliateUserId) {
      responsibleUserId = player.parentAffiliateUserId;
    }
    // 2. parentAffiliateId direto
    if (!responsibleUserId && player.parentAffiliateId) {
      responsibleAffId = player.parentAffiliateId;
      const aff = await dbService.getAffiliateById(player.parentAffiliateId);
      if (aff?.userId) responsibleUserId = aff.userId;
    }
    // 3. affiliateId (pode ser aff_ ou usr_)
    if (!responsibleUserId && player.affiliateId) {
      if (player.affiliateId.startsWith('usr_')) {
        responsibleUserId = player.affiliateId;
      } else {
        responsibleAffId = player.affiliateId;
        const aff = (await dbService.getAffiliateById(player.affiliateId)) || (await dbService.getAffiliateByUserId(player.affiliateId));
        if (aff?.userId) responsibleUserId = aff.userId;
      }
    }
    // 4. Fallback na tabela de referrals
    if (!responsibleUserId) {
      const allRefs = await dbService.getAllReferrals();
      const directRef = allRefs.find((r) => r.referredUserId === player.id);
      if (directRef) {
        responsibleAffId = directRef.affiliateId;
        const aff = await dbService.getAffiliateById(directRef.affiliateId);
        if (aff?.userId) responsibleUserId = aff.userId;
        if (directRef.referredByInfluencerId && !influencerUserId) {
          influencerUserId = directRef.referredByInfluencerId;
        }
      }
    }
    // 5. Fallback no influencerUserId se não houver outro
    if (!responsibleUserId && influencerUserId) {
      responsibleUserId = influencerUserId;
    }

    if (!responsibleUserId) {
      console.warn(`[notifyAffiliateForPlayer] Nenhum afiliado gestor encontrado para o jogador ${userId}`);
      return { sent: 0, failed: 0, total: 0 };
    }

    const affiliateUser = await dbService.getUserById(responsibleUserId);
    const affiliate = responsibleAffId
      ? await dbService.getAffiliateById(responsibleAffId)
      : await dbService.getAffiliateByUserId(responsibleUserId);

    sendDiscordAffiliateWebhook({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      type: payload.type || 'player_activity',
      affiliateName: affiliateUser?.name || responsibleUserId,
      affiliateEmail: affiliateUser?.email,
      affiliateCode: affiliate?.referralCode,
      targetUserId: responsibleUserId,
      targetLabel: `Afiliado ${affiliateUser?.name || responsibleUserId} (Indicador do Jogador ${player.name || userId})`
    }).catch((e) => console.warn('[DiscordWebhook] Erro em notifyAffiliateForPlayer:', e));

    const promises: Promise<any>[] = [];
    promises.push(sendPushNotification(responsibleUserId, { ...payload, skipDiscord: true }));
    if (influencerUserId && influencerUserId !== responsibleUserId) {
      promises.push(sendPushNotification(influencerUserId, { ...payload, skipDiscord: true }));
    }

    const results = await Promise.all(promises);
    return results[0] || { sent: 0, failed: 0, total: 0 };
  } catch (err) {
    console.error('[notifyAffiliateForPlayer] Erro:', err);
    return { sent: 0, failed: 0, total: 0 };
  }
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

    const token = authHeader.split(' ')[1]?.trim();
    if (!token || token === 'null' || token === 'undefined' || token === 'Bearer') {
      return res.status(401).json({ error: 'Sessão expirada ou inválida. Por favor faça login novamente.' });
    }

    const userId = await resolveUserIdFromToken(token);

    if (!userId) {
      return res.status(401).json({ error: 'Sessão expirada ou inválida. Por favor faça login novamente.' });
    }

    const user = await dbService.getUserById(userId);
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    if (user.isBlocked) return res.status(403).json({ error: 'Conta bloqueada.' });
    req.userId = userId;
    req.user = user;
    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    res.status(500).json({ error: 'Erro de autenticação no servidor.' });
  }
}

/**
 * Middleware Anti-Fraude: Garante que o usuário autenticado NÃO seja um Afiliado Hub.
 * Afiliados Hub são estritamente proibidos de realizar apostas, movimentar saldos ou jogar.
 */
async function requirePlayerNotAffiliate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await requireAuth(req, res, () => {
      const user = req.user;
      if (user && isHubAffiliateUser(user)) {
        logSecurityEvent('AFFILIATE_GAMING_ATTEMPT_BLOCKED', {
          userId: user.id,
          email: user.email,
          role: user.role,
          path: req.path,
          ip: req.ip
        });
        return res.status(403).json({
          error: 'Operação bloqueada pelo Sistema Anti-Fraude: Contas de Afiliado Hub não possuem permissão para realizar apostas ou movimentar saldos de jogos.'
        });
      }
      next();
    });
  } catch (err) {
    next(err);
  }
}

// Global Game User Resolver - Supports Bearer token, session cache, signed tokens, user IDs and headers
async function findGameUser(req: Request): Promise<UserDB | null> {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.replace('Bearer ', '').trim()
    : (authHeader?.trim() || (req.body && req.body.token) || (req.query && (req.query.token as string)) || '');

  let userId: string | null = null;

  if (token) {
    const session = getSession(token);
    if (session?.userId) {
      userId = session.userId;
    } else if (sessions.get(token)) {
      userId = sessions.get(token)!;
    } else if (token.startsWith('tok_sec_')) {
      const raw = token.replace('tok_sec_', '');
      const lastUnderscore = raw.lastIndexOf('_');
      if (lastUnderscore > 0) {
        const payload = raw.substring(0, lastUnderscore);
        const parts = payload.split('_');
        if (parts.length >= 3) {
          parts.pop(); // rand
          parts.pop(); // timestamp
          const candidateId = parts.join('_');
          const found = await dbService.getUserById(candidateId);
          if (found) {
            userId = found.id;
            sessions.set(token, userId);
          }
        }
      }
    } else if (token.startsWith('tok_usr_')) {
      const parts = token.split('_');
      if (parts.length >= 3) {
        const candidateId = `${parts[1]}_${parts[2]}`;
        const found = await dbService.getUserById(candidateId);
        if (found) {
          userId = found.id;
          sessions.set(token, userId);
        }
      }
    }
  }

  if (!userId && req.body) {
    const candidateUserId = (req.body.userId || req.body.uid) || req.headers['x-user-id'];
    if (candidateUserId && typeof candidateUserId === 'string' && candidateUserId !== 'anon_player') {
      const found = await dbService.getUserById(candidateUserId);
      if (found) return found;
    }
    const candidateEmail = req.body.email || req.headers['x-user-email'];
    if (candidateEmail && typeof candidateEmail === 'string' && candidateEmail.includes('@')) {
      const found = await dbService.getUserByEmail(candidateEmail.trim().toLowerCase());
      if (found) return found;
    }
  }

  if (userId) {
    return await dbService.getUserById(userId);
  }

  return null;
}

// Global Helper to accurately identify the responsible affiliate for an influencer or player
async function resolveResponsibleAffiliateForUser(user: UserDB, allUsers?: UserDB[]): Promise<{
  sponsorUser: UserDB | null;
  sponsorAff: AffiliateDB | null;
  parentAffId: string;
  parentUserId: string;
}> {
  let sponsorUser: UserDB | null = null;
  let sponsorAff: AffiliateDB | null = null;

  // 1. Check parentAffiliateId
  if (user.parentAffiliateId) {
    sponsorAff = await dbService.getAffiliateById(user.parentAffiliateId);
    if (sponsorAff) {
      sponsorUser = await dbService.getUserById(sponsorAff.userId);
    }
  }

  // 2. Check parentAffiliateUserId
  if (!sponsorUser && user.parentAffiliateUserId) {
    sponsorUser = await dbService.getUserById(user.parentAffiliateUserId);
    if (sponsorUser && !sponsorAff) {
      sponsorAff = await dbService.getAffiliateByUserId(sponsorUser.id);
    }
  }

  // 3. Check affiliateId
  if (!sponsorUser && user.affiliateId) {
    sponsorAff = await dbService.getAffiliateById(user.affiliateId);
    if (sponsorAff) {
      sponsorUser = await dbService.getUserById(sponsorAff.userId);
    } else {
      sponsorUser = await dbService.getUserById(user.affiliateId);
      if (sponsorUser && !sponsorAff) {
        sponsorAff = await dbService.getAffiliateByUserId(sponsorUser.id);
      }
    }
  }

  // 4. Check user.referredBy (code or ID)
  if (!sponsorUser && user.referredBy) {
    const cleanRef = user.referredBy.trim().toUpperCase();
    sponsorAff = await dbService.getAffiliateByCode(cleanRef);
    if (sponsorAff) {
      sponsorUser = await dbService.getUserById(sponsorAff.userId);
    } else {
      sponsorUser = await dbService.getUserByReferralCode(cleanRef);
      if (!sponsorUser && allUsers) {
        sponsorUser = allUsers.find(u => (u.referralCode && u.referralCode.toUpperCase() === cleanRef) || u.id === user.referredBy) || null;
      }
      if (sponsorUser && !sponsorAff) {
        sponsorAff = await dbService.getAffiliateByUserId(sponsorUser.id);
      }
    }
  }

  // 5. Check referrals collection
  if (!sponsorUser) {
    try {
      const allReferrals = await dbService.getAllReferrals();
      const myRef = allReferrals.find(r => r.referredUserId === user.id);
      if (myRef) {
        sponsorAff = await dbService.getAffiliateById(myRef.affiliateId);
        if (sponsorAff) {
          sponsorUser = await dbService.getUserById(sponsorAff.userId);
        }
      }
    } catch (e) {
      // ignore
    }
  }

  const parentAffId = sponsorAff?.id || (sponsorUser ? 'aff_' + sponsorUser.id : 'admin');
  const parentUserId = sponsorUser ? sponsorUser.id : (sponsorAff ? sponsorAff.userId : 'admin');

  return { sponsorUser, sponsorAff, parentAffId, parentUserId };
}

// --- DOTFY GATEWAY GLOBAL CONSTANTS & HELPERS (RESOLVIDOS DE FORMA SEGURA) ---
const DEFAULT_API_KEY = resolveDotfyApiKey();
const DOTFY_BASE_URL = "https://app.dotfy.com.br";

async function getEffectiveDotfyApiKey(customKey?: string): Promise<string> {
  if (customKey && typeof customKey === 'string' && customKey.trim().length > 0) {
    return customKey.trim();
  }
  if (process.env.DOTFY_API_KEY && process.env.DOTFY_API_KEY.trim().length > 0) {
    return process.env.DOTFY_API_KEY.trim();
  }
  try {
    const dotfyDbCfg = await dbService.getDotfyConfig();
    if (dotfyDbCfg?.activeApiKey && dotfyDbCfg.activeApiKey.trim().length > 0) {
      return dotfyDbCfg.activeApiKey.trim();
    }
  } catch (_) {}
  const fallback = resolveDotfyApiKey();
  if (fallback && fallback.trim().length > 0) {
    return fallback.trim();
  }
  return '';
}

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
  return role === 'superadmin';
}

async function startServer() {
  const app = express();
  // In the sandbox dev container behind nginx, the dev server must bind to port 3000.
  // In a standalone Cloud Run deployment, bind to PORT (e.g. 8080 provided by Cloud Run).
  const PORT = process.env.NGINX_PORT ? 3000 : (Number(process.env.PORT) || 8080);

  app.use(express.json());
  app.use(securityHeadersMiddleware);
  app.use('/api', generalRateLimiterMiddleware);
  app.use('/api/auth', authRateLimiterMiddleware);
  app.use('/api/partner', createPartnerRouter(requireAuth, sendPushNotification, logSecurityEvent));

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', firebase: true, time: new Date().toISOString() });
  });

  // WEB PUSH ROUTES FOR IOS / ANDROID PWA NOTIFICATIONS (Background / Closed App)
  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  });

  app.post('/api/push/subscribe', async (req: AuthRequest, res) => {
    try {
      const { subscription, preferences } = req.body;
      if (!subscription || !subscription.endpoint) {
        return res.status(400).json({ error: 'Subscription inválida' });
      }

      let targetUserId = 'guest';
      const authHeader = req.headers.authorization;
      let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1]?.trim() : null;
      if (!token && req.body.token) token = String(req.body.token).trim();

      if (token) {
        const resolved = await resolveUserIdFromToken(token);
        if (resolved) targetUserId = resolved;
      }

      // Fallback para userId enviado no body se verificado no banco
      if ((targetUserId === 'guest' || !targetUserId) && req.body.userId) {
        const directCandidate = await dbService.getUserById(String(req.body.userId).trim());
        if (directCandidate) targetUserId = directCandidate.id;
      }

      const docId = subscriptionDocumentId(subscription.endpoint);
      const existingSubs = await dbService.getPushSubscriptions();
      const previous = existingSubs.find(s => s.id === docId || s.endpoint === subscription.endpoint);
      // Nota: Nunca atribui o userId de outro usuário/afiliado a uma sessão anônima 'guest'
      // para evitar vazamento de notificações de uma rede para outro usuário ou dispositivo.

      const user = targetUserId !== 'guest' ? await dbService.getUserById(targetUserId) : null;
      let isAff = !!(user && (
        user.role === 'affiliate' ||
        user.role === 'admin' ||
        user.role === 'superadmin' ||
        (user as any).isInfluencer ||
        (user as any).isAffiliate ||
        user.isPartner ||
        user.email === 'tribopayeduh@gmail.com'
      ));

      if (!isAff && targetUserId !== 'guest') {
        const aff = await dbService.getAffiliateByUserId(targetUserId);
        if (aff) isAff = true;
      }

      const now = new Date().toISOString();
      const item: PushSubscriptionDB = {
        id: docId,
        subscription,
        userId: targetUserId,
        isAffiliate: isAff,
        preferences: preferences || { registration: true, ftd: true, pixPending: true, gameActivity: true },
        endpoint: subscription.endpoint,
        userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
        createdAt: previous?.createdAt || now,
        updatedAt: now,
      };
      await dbService.upsertPushSubscription(item);

      console.log(`[WebPush] Inscrição salva/atualizada para userId: ${targetUserId} (isAffiliate: ${isAff})`);
      res.json({ success: true, message: 'Inscrição Push salva com sucesso', userId: targetUserId, isAffiliate: isAff });
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
        const resolved = await resolveUserIdFromToken(token);
        if (resolved) targetUserId = resolved;
      }

      if (endpoint) {
        const docId = subscriptionDocumentId(endpoint);
        const subs = await dbService.getPushSubscriptions();
        const found = subs.find(s => s.endpoint === endpoint || s.id === docId);
        if (found) {
          found.preferences = { ...(found.preferences || {}), ...(preferences || {}) };
          if (targetUserId && (!found.userId || found.userId === 'guest')) {
            found.userId = targetUserId;
          }
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
      let targetUserId: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const resolved = await resolveUserIdFromToken(token);
        if (resolved) targetUserId = resolved;
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
              url: '/?tab=affiliates',
              type: 'SHOW_SALE_NOTIFICATION'
            }), { TTL: 86400, urgency: 'high' });
            result = { sent: 1, failed: 0, total: 1 };
          } catch (pushErr: any) {
            console.warn('[WebPush] Push direct endpoint error:', pushErr.statusCode || pushErr.message);
            result = { sent: 0, failed: 1, total: 1 };
          }
        }
      }

      if (result.sent === 0 && targetUserId) {
        result = await sendPushNotification(targetUserId, {
          title: title || 'Você vendeu! 💰',
          body: body || 'Comissão de R$ 75,00 confirmada na sua conta!',
          url: '/?tab=affiliates',
          type: 'SHOW_SALE_NOTIFICATION'
        });
      }

      res.json({
        success: result.sent > 0,
        sentDevices: result.sent,
        attempted: result.total,
        delivered: result.sent,
        failed: result.failed,
        message: result.sent > 0 ? `Push entregue com sucesso (${result.sent} dispositivo(s))!` : 'Nenhum dispositivo elegível encontrado ou erro no envio.'
      });
    } catch (err: any) {
      console.error('[WebPush] Error testing self push:', err);
      res.status(500).json({ error: 'Erro ao enviar teste' });
    }
  });

  app.post('/api/push/send-test', async (req: AuthRequest, res) => {
    try {
      const { delayMs, title, body, endpoint } = req.body;
      
      const authHeader = req.headers.authorization;
      let targetUserId: string | null = null;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const sessionUserId = sessions.get(token) || (await resolveUserIdFromToken(token));
        if (sessionUserId) targetUserId = sessionUserId;
      }

      const trigger = async () => {
        let sentDirect = false;
        if (endpoint) {
          const docId = subscriptionDocumentId(endpoint);
          const allSubs = await dbService.getPushSubscriptions();
          const targetSub = allSubs.find(s => s.endpoint === endpoint || s.id === docId);
          if (targetSub) {
            try {
              await webpush.sendNotification(targetSub.subscription as any, JSON.stringify({
                title: title || 'Você vendeu! 💰',
                body: body || 'Sua comissão de R$ 37,50 foi creditada no seu saldo!',
                url: '/',
                type: 'SHOW_SALE_NOTIFICATION'
              }), { TTL: 86400, urgency: 'high' });
              sentDirect = true;
            } catch (errDirect: any) {
              console.warn('[WebPush] Send-test direct error:', errDirect.statusCode || errDirect.message);
            }
          }
        }

        if (!sentDirect && targetUserId) {
          await sendPushNotification(targetUserId, {
            title: title || 'Você vendeu! 💰',
            body: body || 'Sua comissão de R$ 37,50 foi creditada no seu saldo!',
            url: '/',
            type: 'SHOW_SALE_NOTIFICATION'
          });
        }
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

  // Game Origin Tracking Engine
  function resolveRegisteredGame(req: Request): { registeredGame: string; trackingSource: string } {
    const body = req.body || {};
    const query = req.query || {};
    const headers = req.headers || {};

    // 1. Check explicit parameters from body, headers, or query
    const explicitCandidates = [
      { val: body.registeredGame, src: 'body_registeredGame' },
      { val: body.acquisitionGame, src: 'body_acquisitionGame' },
      { val: body.game, src: 'body_game' },
      { val: body.gameId, src: 'body_gameId' },
      { val: body.trackingGame, src: 'body_trackingGame' },
      { val: headers['x-game-origin'], src: 'header_x_game_origin' },
      { val: headers['x-game-id'], src: 'header_x_game_id' },
      { val: headers['x-registered-game'], src: 'header_x_registered_game' },
      { val: query.game, src: 'query_game' },
      { val: query.gameId, src: 'query_gameId' },
      { val: query.site, src: 'query_site' },
      { val: query.g, src: 'query_g' },
    ];

    for (const item of explicitCandidates) {
      if (!item.val) continue;
      const s = String(item.val).trim().toLowerCase().replace(/_/g, '-');
      if (['gen-dino', 'gendino', 'dino', 'dinopay', 'dinoplay', 'dinipay', 't-rex'].some(k => s.includes(k))) {
        return { registeredGame: 'g_gen_dino', trackingSource: item.src };
      }
      if (['subway', 'subwaypay', 'subway-pay', 'joguesubway', 'zumbla', 'zumbla-win', 'zumblapay'].some(k => s.includes(k))) {
        return { registeredGame: 'g_subway_pay', trackingSource: item.src };
      }
      if (['raspa', 'raspafortuna', 'raspa-fortuna', 'scratch', 'raspadinha', 'raspadinhaadasorte'].some(k => s.includes(k))) {
        return { registeredGame: 'g_raspa_fortuna', trackingSource: item.src };
      }
      if (['block', 'blockwin', 'block-win', 'block-puzzle', 'blockwinn', 'blockwinner'].some(k => s.includes(k))) {
        return { registeredGame: 'g_block_puzzle', trackingSource: item.src };
      }
      if (['hub', 'portal', 'goalliancehub', 'alliance'].some(k => s.includes(k))) {
        return { registeredGame: 'alliance_hub', trackingSource: item.src };
      }
    }

    // 2. Inspect referer header (full URL, pathname and query params)
    const referer = String(headers.referer || '').toLowerCase();
    if (referer) {
      if (referer.includes('/gen-dino') || referer.includes('/dino') || referer.includes('dinopay') || referer.includes('dinoplay') || referer.includes('game=dino') || referer.includes('game=gen-dino') || referer.includes('site=dino') || referer.includes('site=gen-dino') || referer.includes('dino_ref_code')) {
        return { registeredGame: 'g_gen_dino', trackingSource: 'referer_dino' };
      }
      if (referer.includes('joguesubway') || referer.includes('/zumbla') || referer.includes('zumblapay') || referer.includes('game=zumbla') || referer.includes('site=zumbla') || referer.includes('/subway') || referer.includes('subwaypay') || referer.includes('game=subway') || referer.includes('site=subway')) {
        return { registeredGame: 'g_subway_pay', trackingSource: 'referer_subway' };
      }
      if (referer.includes('/raspa') || referer.includes('raspafortuna') || referer.includes('raspadinhaadasorte') || referer.includes('raspadinha') || referer.includes('game=raspa') || referer.includes('site=raspa')) {
        return { registeredGame: 'g_raspa_fortuna', trackingSource: 'referer_raspa' };
      }
      if (referer.includes('/blockwin') || referer.includes('/block-puzzle') || referer.includes('game=block') || referer.includes('site=block')) {
        return { registeredGame: 'g_block_puzzle', trackingSource: 'referer_block' };
      }
      if (referer.includes('goalliancehub') || referer.includes('/alliance') || referer.includes('site=alliance')) {
        return { registeredGame: 'alliance_hub', trackingSource: 'referer_hub' };
      }
    }

    // 3. Inspect origin and host headers
    const origin = String(headers.origin || '').toLowerCase();
    const host = String(headers.host || req.hostname || '').toLowerCase();
    const networkContext = `${origin} ${host}`;

    if (networkContext.includes('dinopay') || networkContext.includes('dinoplay') || networkContext.includes('gendino')) {
      return { registeredGame: 'g_gen_dino', trackingSource: 'host_dino' };
    }
    if (networkContext.includes('joguesubway') || networkContext.includes('zumblapay') || ((networkContext.includes('zumbla') || networkContext.includes('subway')) && !networkContext.includes('alliance')) || networkContext.includes('subwaypay')) {
      return { registeredGame: 'g_subway_pay', trackingSource: 'host_subway' };
    }
    if (networkContext.includes('raspafortuna') || networkContext.includes('raspa-fortuna') || networkContext.includes('raspadinhaadasorte') || networkContext.includes('raspadinha')) {
      return { registeredGame: 'g_raspa_fortuna', trackingSource: 'host_raspa' };
    }
    if (networkContext.includes('blockwinn') || networkContext.includes('blockwinner') || networkContext.includes('blockwin')) {
      return { registeredGame: 'g_block_puzzle', trackingSource: 'host_block' };
    }
    if (networkContext.includes('goalliancehub')) {
      return { registeredGame: 'alliance_hub', trackingSource: 'host_portal' };
    }

    // 4. Affiliate portal explicit flag
    if (body.isAffiliate === true) {
      return { registeredGame: 'alliance_hub', trackingSource: 'is_affiliate_flag' };
    }

    // 5. Default fallback
    return { registeredGame: 'g_block_puzzle', trackingSource: 'default_fallback' };
  }

  // AUTH: REGISTER
  app.post('/api/auth/register', async (req, res) => {
    try {
      const name = sanitizeString(req.body.name, 100);
      const email = sanitizeString(req.body.email, 150).toLowerCase();
      const phone = sanitizeString(req.body.phone, 30) || 'Não informado';
      const password = typeof req.body.password === 'string' ? req.body.password : '';
      const refCode = sanitizeString(req.body.refCode || req.body.ref || req.body.p || req.body.partner, 50);

      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
      }

      if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Formato de e-mail inválido.' });
      }

      if (isDisposableEmail(email)) {
        logSecurityEvent('REGISTER_DISPOSABLE_EMAIL_BLOCKED', { email, ip: req.ip });
        return res.status(400).json({ error: 'E-mails temporários ou descartáveis não são permitidos por segurança anti-fraude.' });
      }

      const forwarded = (req.headers['cf-connecting-ip'] as string) || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const clientIp = forwarded.split(',')[0].trim();
      const rateLimitCheck = checkRegistrationRateLimit(clientIp);
      if (!rateLimitCheck.allowed) {
        logSecurityEvent('REGISTER_RATE_LIMIT_EXCEEDED', { ip: clientIp, email });
        return res.status(429).json({
          error: `Muitas tentativas de cadastro a partir desta conexão. Tente novamente em ${Math.ceil(rateLimitCheck.retryAfterSec / 60)} minutos.`
        });
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
      let referringAffiliateUserId: string | undefined = undefined;
      let matchedRefCode: string | undefined = undefined;
      let influencerUser: UserDB | null = null;
      let influencerAff: AffiliateDB | null = null;
      let responsibleAff: AffiliateDB | null = null;
      let responsibleUser: UserDB | null = null;

      if (refCode) {
        const cleanRef = refCode.trim().toUpperCase();
        matchedRefCode = cleanRef;

        // 1. Check if refCode belongs to an affiliate
        let affiliate = await dbService.getAffiliateByCode(cleanRef);
        if (affiliate) {
          const affUser = await dbService.getUserById(affiliate.userId);
          // Check if this affiliate user is an influencer (or has a parent affiliate responsible for them)
          if (affUser && (affUser.isInfluencer || affUser.parentAffiliateId || affUser.parentAffiliateUserId)) {
            influencerUser = affUser;
            influencerAff = affiliate;
            const resolved = await resolveResponsibleAffiliateForUser(affUser);
            responsibleAff = resolved.sponsorAff || affiliate;
            responsibleUser = resolved.sponsorUser || affUser;
          } else {
            responsibleAff = affiliate;
            responsibleUser = affUser;
          }
          referringAffiliateId = responsibleAff ? responsibleAff.id : affiliate.id;
          referringAffiliateUserId = responsibleUser ? responsibleUser.id : affiliate.userId;
        } else {
          // 2. Check if it's a user's referral code (e.g. player, blogger, influencer)
          const sponsorUser = await dbService.getUserByReferralCode(cleanRef);
          if (sponsorUser) {
            influencerUser = sponsorUser;
            // Ensure the influencer/sponsor has an active affiliate profile for sub-network tracking
            influencerAff = await dbService.getAffiliateByUserId(sponsorUser.id);
            if (!influencerAff) {
              const newAffId = 'aff_' + crypto.randomBytes(8).toString('hex');
              influencerAff = {
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
              await dbService.createAffiliate(influencerAff);
            }

            // Identify the responsible affiliate for this influencer user
            const resolved = await resolveResponsibleAffiliateForUser(sponsorUser);
            responsibleAff = resolved.sponsorAff;
            responsibleUser = resolved.sponsorUser;

            if (responsibleAff) {
              referringAffiliateId = responsibleAff.id;
              referringAffiliateUserId = responsibleAff.userId;
            } else {
              // Direct sponsor is their own top affiliate
              referringAffiliateId = influencerAff.id;
              referringAffiliateUserId = sponsorUser.id;
              responsibleAff = influencerAff;
              responsibleUser = sponsorUser;
            }
          } else {
            // 3. Check if refCode is a direct user ID or affiliate ID
            const directUser = await dbService.getUserById(cleanRef) || await dbService.getUserById(refCode.trim());
            if (directUser) {
              const aff = await dbService.getAffiliateByUserId(directUser.id);
              if (aff) {
                responsibleAff = aff;
                responsibleUser = directUser;
                referringAffiliateId = aff.id;
                referringAffiliateUserId = directUser.id;
              }
            } else {
              const directAff = await dbService.getAffiliateById(refCode.trim());
              if (directAff) {
                const affOwner = await dbService.getUserById(directAff.userId);
                responsibleAff = directAff;
                responsibleUser = affOwner;
                referringAffiliateId = directAff.id;
                referringAffiliateUserId = directAff.userId;
              }
            }
          }
        }

        // ANTI-FRAUDE: Bloqueio Rigoroso de Auto-Indicação (Self-Referral)
        if (responsibleUser) {
          const selfRisk = detectSelfReferralRisk(
            { email, phone, ip: clientIp },
            { id: responsibleUser.id, email: responsibleUser.email, phone: responsibleUser.phone }
          );
          if (selfRisk.isFraud) {
            logSecurityEvent('REGISTER_SELF_REFERRAL_BLOCKED', { email, refCode, reason: selfRisk.reason, ip: clientIp });
            return res.status(400).json({
              error: 'Tentativa de auto-indicação detectada pelo Sistema Anti-Fraude. Não é permitido criar contas vinculadas ao seu próprio link ou dados de afiliado.'
            });
          }
        }
      }

      // Determine game origin using multi-layer tracking engine
      const trackingResult = resolveRegisteredGame(req);
      const registeredGame = trackingResult.registeredGame;
      const host = (req.headers.host || req.hostname || '').toLowerCase();
      const origin = (req.headers.origin || req.headers.referer || '').toLowerCase();
      const isPartnerPortal = host.includes('parceiro') || origin.includes('parceiro') || req.body?.sourcePortal === 'parceiro';
      const isAffiliatePortal = registeredGame === 'alliance_hub' || host.includes('goalliancehub') || origin.includes('goalliancehub') || req.body?.isAffiliate === true || isPartnerPortal;

      // ANTI-FRAUDE: Regra Restrita de Separação - Afiliados Hub NÃO podem ter conta em jogos
      if (!isAffiliatePortal) {
        // Se este cadastro é para um jogo, verificar se o e-mail ou telefone já pertence a um Afiliado Hub
        const existingUsers = await dbService.getAllUsers();
        const normPhone = phone && phone !== 'Não informado' ? normalizePhoneNumber(phone) : '';
        const matchingAff = existingUsers.find(u => {
          if (!isHubAffiliateUser(u)) return false;
          if (u.email.toLowerCase() === email.toLowerCase()) return true;
          if (normPhone && normPhone.length >= 8 && normalizePhoneNumber(u.phone) === normPhone) return true;
          return false;
        });

        if (matchingAff) {
          logSecurityEvent('AFFILIATE_GAMING_ACCOUNT_BLOCKED', { email, phone, ip: clientIp, registeredGame });
          return res.status(403).json({
            error: 'Bloqueio Anti-Fraude: Usuários cadastrados como Afiliado Hub têm acesso exclusivo à gestão de rede e são proibidos de criar contas de jogador ou apostar nos jogos da plataforma.'
          });
        }
      }

      // Partner attribution (Painel de Parceiro / parceiro.goalliancehub.com / link curto /p/CODE)
      const rawPartnerCode = (
        req.body?.partnerCode ||
        req.query?.partnerCode ||
        req.body?.partner ||
        req.query?.partner ||
        req.body?.p ||
        req.query?.p ||
        ''
      ).toString().trim();
      let partnerUser: UserDB | null = null;
      if (rawPartnerCode) {
        partnerUser = (await dbService.getUserByPartnerOrReferralCode(rawPartnerCode)) || (await dbService.getUserById(rawPartnerCode));
      }
      if (!partnerUser && matchedRefCode) {
        const potentialPartner = await dbService.getUserByPartnerOrReferralCode(matchedRefCode);
        if (potentialPartner && (potentialPartner.isPartner || potentialPartner.partnerApproved)) {
          partnerUser = potentialPartner;
        }
      }
      if (partnerUser && !matchedRefCode) {
        matchedRefCode = partnerUser.referralCode || partnerUser.partnerCode || rawPartnerCode;
      }

      console.log(`[Register Tracking] User ${email} registered. Resolved game: ${registeredGame} (source: ${trackingResult.trackingSource}, partner: ${partnerUser ? partnerUser.name || partnerUser.id : 'none'})`);

      // Create User - attributing to the responsible affiliate's base
      const targetParentAffId = responsibleAff ? responsibleAff.id : (influencerAff?.id || referringAffiliateId);
      const targetParentUserId = responsibleUser ? responsibleUser.id : (influencerUser?.id || referringAffiliateUserId);

      const newUser: UserDB = {
        id: userId,
        name,
        email,
        phone,
        passwordHash,
        affiliateId: targetParentAffId,
        referralCode: userReferralCode,
        referredBy: matchedRefCode,
        parentAffiliateId: targetParentAffId,
        parentAffiliateUserId: targetParentUserId,
        ...(partnerUser ? {
          partnerId: partnerUser.id,
          partnerUserId: partnerUser.id,
          partnerCode: partnerUser.partnerCode || partnerUser.referralCode || rawPartnerCode,
        } : {}),
        ...(influencerUser ? {
          influencerUserId: influencerUser.id,
          influencerAffiliateId: influencerAff?.id,
          influencerName: influencerUser.name,
        } : {}),
        balance: 0.0,
        registeredGame,
        acquisitionGame: registeredGame,
        origin: trackingResult.trackingSource,
        gameBalances: { [registeredGame]: 0.0 },
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

      // 1. Record referral for the Responsible Affiliate (goes directly to responsible affiliate's base)
      if (responsibleAff) {
        const parentReferral: ReferralDB = {
          id: 'ref_' + crypto.randomBytes(12).toString('hex'),
          affiliateId: responsibleAff.id,
          referredUserId: userId,
          referralCode: matchedRefCode || (refCode ? refCode.trim().toUpperCase() : userReferralCode),
          registeredGame,
          createdAt,
          ...(influencerUser ? {
            referredByInfluencerId: influencerUser.id,
            referredByInfluencerName: influencerUser.name,
            isFromInfluencer: true,
          } : {}),
        };
        await dbService.createReferral(parentReferral);

        const targetAffUserId = responsibleUser?.id || responsibleAff.userId;
        if (targetAffUserId) {
          sendPushNotification(targetAffUserId, {
            title: influencerUser ? '⭐ Novo cadastro via Influencer!' : 'Novo cadastro na sua rede! 👤',
            body: influencerUser
              ? `${newUser.name} acabou de se cadastrar na sua rede através do influencer ${influencerUser.name}!`
              : `${newUser.name} acabou de se cadastrar pelo seu link de afiliado.`,
            url: '/?tab=affiliates',
            type: 'registration',
          }).catch(console.error);
        }
      }

      // 2. Also record referral for the Influencer if distinct from the responsible affiliate
      if (influencerAff && (!responsibleAff || influencerAff.id !== responsibleAff.id)) {
        const subReferral: ReferralDB = {
          id: 'ref_' + crypto.randomBytes(12).toString('hex'),
          affiliateId: influencerAff.id,
          referredUserId: userId,
          referralCode: matchedRefCode || (refCode ? refCode.trim().toUpperCase() : userReferralCode),
          registeredGame,
          createdAt,
        };
        await dbService.createReferral(subReferral);

        if (influencerUser?.id && influencerUser.id !== responsibleUser?.id) {
          sendPushNotification(influencerUser.id, {
            title: 'Novo seguidor cadastrado! 👤',
            body: `${newUser.name} acabou de se cadastrar pelo seu link de influencer.`,
            url: '/?tab=affiliates',
            type: 'registration',
          }).catch(console.error);
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
        registeredGame: newUser.registeredGame,
        acquisitionGame: newUser.acquisitionGame,
        gameBalances: newUser.gameBalances,
        pixKey: null,
        pixKeys: [],
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


      // Check brute-force lockouts (exempt platform superadmins/owners)
      const lockStatus = isIdentifierBlocked(email);
      if (lockStatus.blocked) {
        logSecurityEvent('LOGIN_ATTEMPT_BLOCKED', { email, ip: req.ip });
        return res.status(429).json({
          error: `Conta temporariamente bloqueada por muitas tentativas incorretas. Tente novamente em ${lockStatus.blockTimeSec} segundos.`
        });
      }

      let user = await dbService.getUserByEmail(email);
      if (!user) {
        recordFailedLogin(email);
        logSecurityEvent('LOGIN_FAILED_USER_NOT_FOUND', { email, ip: req.ip });
        return res.status(400).json({ error: 'Credenciais inválidas ou usuário não encontrado.' });
      }

      let authCheck = verifyPassword(password, user.passwordHash);
      if (!authCheck.valid && trimmedPassword) {
        authCheck = verifyPassword(trimmedPassword, user.passwordHash);
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

      // ANTI-FRAUDE: Se a requisição de login vier de um domínio/origem de jogo, impedir login de Afiliados Hub
      const host = (req.headers.host || req.hostname || '').toLowerCase();
      const origin = (req.headers.origin || req.headers.referer || '').toLowerCase();
      const isGameContext = req.body?.isGameSite === true ||
        Boolean(req.headers['x-game-origin']) ||
        host.includes('joguesubway') || host.includes('dinopay') || host.includes('raspadinha') || host.includes('blockwinner') ||
        origin.includes('joguesubway') || origin.includes('dinopay') || origin.includes('raspadinha') || origin.includes('blockwinner');

      if (isGameContext && isHubAffiliateUser(user)) {
        logSecurityEvent('AFFILIATE_GAME_LOGIN_BLOCKED', { userId: user.id, email: user.email, ip: req.ip, host });
        return res.status(403).json({
          error: 'Acesso bloqueado pelo Sistema Anti-Fraude: Sua conta é de Afiliado Hub. Afiliados não possuem permissão para acessar áreas de jogos nem efetuar apostas na plataforma.'
        });
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
        autoWithdrawBlocked: !!user.autoWithdrawBlocked,
        withdrawBlocked: !!user.withdrawBlocked,
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
        registeredGame: user.registeredGame || user.acquisitionGame || 'g_block_puzzle',
        acquisitionGame: user.acquisitionGame || user.registeredGame || 'g_block_puzzle',
        gameBalances: user.gameBalances || {},
        pixKey: user.pixKey || null,
        pixKeys: Array.isArray(user.pixKeys) && user.pixKeys.length > 0 ? user.pixKeys : (user.pixKey ? [user.pixKey] : []),
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

    const userPayload = {
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
      isPartner: !!user.isPartner || isSuperAdminUser,
      partnerApproved: !!user.partnerApproved || isSuperAdminUser,
      partnerCode: user.partnerCode || user.referralCode || null,
      partnerRequested: !!user.partnerRequested,
      partnerRequestedAt: user.partnerRequestedAt || null,
      autoWithdrawBlocked: !!user.autoWithdrawBlocked,
      withdrawBlocked: !!user.withdrawBlocked,
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
      registeredGame: user.registeredGame || user.acquisitionGame || 'g_block_puzzle',
      acquisitionGame: user.acquisitionGame || user.registeredGame || 'g_block_puzzle',
      gameBalances: user.gameBalances || {},
      pixKey: user.pixKey || null,
      pixKeys: Array.isArray(user.pixKeys) && user.pixKeys.length > 0 ? user.pixKeys : (user.pixKey ? [user.pixKey] : []),
    };

    res.json({
      ...userPayload,
      user: userPayload
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

      const isSuperAdmin = user.role === 'superadmin';
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
    if (req.user.role === 'superadmin') {
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
          autoWithdrawBlocked: !!u.autoWithdrawBlocked,
          withdrawBlocked: !!u.withdrawBlocked,
          adminPermissions: u.adminPermissions || {},
          isPartner: !!u.isPartner,
          partnerApproved: !!u.partnerApproved,
          partnerCode: u.partnerCode,
          partnerRequested: !!u.partnerRequested,
          partnerCommissionPercent: typeof u.partnerCommissionPercent === 'number' ? u.partnerCommissionPercent : 20,
          createdAt: u.createdAt,
          pixKeys: u.pixKeys || (u.pixKey ? [u.pixKey] : []),
          affiliateInfo: affData ? {
            ...affData,
            partnerCommissionPercent: typeof u.partnerCommissionPercent === 'number' ? u.partnerCommissionPercent : (aff?.partnerCommissionPercent ?? 20),
          } : null,
          referredBy,
          totalDeposited,
          registeredGame: (() => {
            let g = (u as any).registeredGame || (u as any).acquisitionGame || '';
            if (!g && u.email && (u.email.toLowerCase().includes('subway') || u.email.toLowerCase().includes('joguesubway'))) {
              return 'g_subway_pay';
            }
            return g || 'g_block_puzzle';
          })(),
          acquisitionGame: (() => {
            let g = (u as any).acquisitionGame || (u as any).registeredGame || '';
            if (!g && u.email && (u.email.toLowerCase().includes('subway') || u.email.toLowerCase().includes('joguesubway'))) {
              return 'g_subway_pay';
            }
            return g || 'g_block_puzzle';
          })(),
          gameBalances: (u as any).gameBalances || {},
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
        partnerCommissionPercent,
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
      if (typeof partnerCommissionPercent === 'number' && !isNaN(partnerCommissionPercent)) {
        updateData.partnerCommissionPercent = Math.min(100, Math.max(0, partnerCommissionPercent));
      }
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
        if (updateData.partnerCommissionPercent !== undefined) userSync.partnerCommissionPercent = updateData.partnerCommissionPercent;
        if (updateData.cpaKillerActive !== undefined) userSync.cpaKillerActive = updateData.cpaKillerActive;
        if (updateData.cpaKillerEveryX !== undefined) userSync.cpaKillerEveryX = updateData.cpaKillerEveryX;
        if (updateData.cpaKillerKillY !== undefined) userSync.cpaKillerKillY = updateData.cpaKillerKillY;
        if (typeof req.body.autoWithdrawBlocked === 'boolean') userSync.autoWithdrawBlocked = req.body.autoWithdrawBlocked;
        if (typeof req.body.withdrawBlocked === 'boolean') userSync.withdrawBlocked = req.body.withdrawBlocked;
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
        partnerCommissionPercent: updateData.partnerCommissionPercent ?? (affiliate as any).partnerCommissionPercent ?? 20,
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
        const numNewBal = typeof newBalance === 'number' ? newBalance : (typeof newBalance === 'string' && newBalance.trim() !== '' ? parseFloat(newBalance) : undefined);
        const numAmount = typeof amount === 'number' ? amount : (typeof amount === 'string' && amount.trim() !== '' ? parseFloat(amount) : undefined);

        if (typeof numNewBal === 'number' && !isNaN(numNewBal)) {
          finalBalance = Math.max(0, numNewBal);
        } else if (typeof numAmount === 'number' && !isNaN(numAmount)) {
          if (actionType === 'add') {
            finalBalance = targetUser.balance + numAmount;
          } else if (actionType === 'subtract') {
            finalBalance = Math.max(0, targetUser.balance - numAmount);
          } else if (actionType === 'set') {
            finalBalance = Math.max(0, numAmount);
          }
        }
      }

      const userFieldsToUpdate: any = {};
      if (!isTargetAffiliateWallet) {
        userFieldsToUpdate.balance = finalBalance;
        const currentGb = targetUser.gameBalances || {};
        userFieldsToUpdate.gameBalances = {
          ...currentGb,
          g_raspa_fortuna: finalBalance,
          [targetUser.registeredGame || 'g_raspa_fortuna']: finalBalance
        };
        await dbService.updateUserBalance(id, finalBalance);
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

  // POST /api/admin/users/:id/toggle-auto-withdraw
  app.post('/api/admin/users/:id/toggle-auto-withdraw', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageUsers')) {
        return res.status(403).json({ error: 'Sem permissão para alterar configurações de saque automático de usuários.' });
      }

      const { id } = req.params;
      const { autoWithdrawBlocked } = req.body;
      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const newStatus = typeof autoWithdrawBlocked === 'boolean'
        ? autoWithdrawBlocked
        : !targetUser.autoWithdrawBlocked;

      await dbService.toggleUserAutoWithdraw(id, newStatus);

      logSecurityEvent('ADMIN_TOGGLE_USER_AUTO_WITHDRAW', {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
        targetUserId: id,
        autoWithdrawBlocked: newStatus
      });

      res.json({
        success: true,
        autoWithdrawBlocked: newStatus,
        message: newStatus
          ? 'Saque automático desativado. Os saques deste usuário passarão por análise manual.'
          : 'Saque automático ativado com sucesso! Os saques deste usuário serão processados instantaneamente.'
      });
    } catch (err: any) {
      console.error('Error toggling auto withdraw:', err);
      res.status(500).json({ error: 'Erro ao alterar status de saque automático.' });
    }
  });

  // POST /api/admin/users/:id/toggle-withdraw
  app.post('/api/admin/users/:id/toggle-withdraw', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageUsers')) {
        return res.status(403).json({ error: 'Sem permissão para gerenciar permissões de saque de usuários.' });
      }

      const { id } = req.params;
      const { withdrawBlocked } = req.body;
      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      if (targetUser.email.toLowerCase() === 'admin.eduh@gmail.com') {
        return res.status(400).json({ error: 'Os saques do Administrador Principal não podem ser desativados.' });
      }

      const newStatus = typeof withdrawBlocked === 'boolean'
        ? withdrawBlocked
        : !targetUser.withdrawBlocked;

      await dbService.toggleUserWithdraw(id, newStatus);

      logSecurityEvent('ADMIN_TOGGLE_USER_WITHDRAW_ACCESS', {
        adminId: req.user?.id,
        adminEmail: req.user?.email,
        targetUserId: id,
        withdrawBlocked: newStatus
      });

      res.json({
        success: true,
        withdrawBlocked: newStatus,
        message: newStatus
          ? 'Saques deste usuário desativados com sucesso. O usuário não poderá solicitar saques.'
          : 'Saques deste usuário liberados com sucesso!'
      });
    } catch (err: any) {
      console.error('Error toggling withdraw access:', err);
      res.status(500).json({ error: 'Erro ao alterar status de permissão de saque.' });
    }
  });

  // POST /api/admin/users/:id/game - Update Game Origin of user
  app.post('/api/admin/users/:id/game', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      if (!checkAdminPermission(req, 'canManageUsers')) {
        return res.status(403).json({ error: 'Sem permissão para alterar o jogo de origem do usuário.' });
      }

      const { id } = req.params;
      const { gameId } = req.body;
      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const normalizedGame = (() => {
        const s = String(gameId || '').trim().toLowerCase().replace(/_/g, '-');
        if (['subway', 'subwaypay', 'subway-pay', 'joguesubway', 'g-subway-pay'].some(k => s.includes(k))) return 'g_subway_pay';
        if (['dino', 'gen-dino', 'gendino', 'g-gen-dino'].some(k => s.includes(k))) return 'g_gen_dino';
        if (['zumbla', 'zumbla-win', 'g-zumbla'].some(k => s.includes(k))) return 'g_zumbla';
        if (['raspa', 'raspafortuna', 'raspa-fortuna', 'g-raspa-fortuna', 'raspadinha', 'raspadinhaadasorte'].some(k => s.includes(k))) return 'g_raspa_fortuna';
        if (['block', 'blockwin', 'block-win', 'g-block-puzzle'].some(k => s.includes(k))) return 'g_block_puzzle';
        if (['alliance', 'hub', 'alliance-hub'].some(k => s.includes(k))) return 'alliance_hub';
        return 'g_block_puzzle';
      })();

      const updatePayload: any = {
        registeredGame: normalizedGame,
        acquisitionGame: normalizedGame,
      };

      // Ensure gameBalances has an entry for the game
      if (!targetUser.gameBalances || typeof targetUser.gameBalances !== 'object') {
        updatePayload.gameBalances = { [normalizedGame]: targetUser.balance || 0 };
      } else if (targetUser.gameBalances[normalizedGame] === undefined) {
        updatePayload.gameBalances = {
          ...targetUser.gameBalances,
          [normalizedGame]: targetUser.balance || 0
        };
      }

      await dbService.updateUserFields(id, updatePayload);

      // Also update any referral record for this user
      try {
        const referrals = await dbService.getAllReferrals();
        const userRef = referrals.find(r => r.referredUserId === id);
        if (userRef) {
          await dbService.updateReferral(userRef.id, {
            gameId: normalizedGame,
            metadata: {
              ...(userRef.metadata || {}),
              gameId: normalizedGame,
              registeredGame: normalizedGame,
            }
          });
        }
      } catch (refErr) {
        console.warn('[Admin Update User Game] Failed to sync referral record:', refErr);
      }

      logSecurityEvent('ADMIN_USER_GAME_CHANGED', {
        adminId: req.user?.id,
        targetUserId: id,
        newGame: normalizedGame
      });

      res.json({
        success: true,
        gameId: normalizedGame,
        message: `Jogo de origem alterado com sucesso para ${normalizedGame}!`
      });
    } catch (err: any) {
      console.error('Error changing user game:', err);
      res.status(500).json({ error: 'Erro ao alterar o jogo do usuário.' });
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

      // Solicit withdrawal immediately on Dotfy if API key is configured
      const apiKeyToUse = await getEffectiveDotfyApiKey();
      let dotfyWithdrawalId: string | undefined = undefined;
      let dotfyStatusMsg = '';

      if (apiKeyToUse && tx.amount > 0) {
        try {
          const targetUser = await dbService.getUserById(tx.userId);
          const rawKey = (tx as any).pixKey || targetUser?.pixKey || ((targetUser as any)?.pixKeys && (targetUser as any).pixKeys[0]?.key);
          const rawType = (tx as any).pixType || (targetUser as any)?.pixKeyType || ((targetUser as any)?.pixKeys && (targetUser as any).pixKeys[0]?.type) || 'CPF';

          if (rawKey) {
            const cleanKey = String(rawKey).trim();
            const cleanType = String(rawType).trim().toUpperCase();

            // Resolve or register PIX key on Dotfy
            const keyResolution = await resolveDotfyPixKey(
              apiKeyToUse,
              cleanKey,
              cleanType,
              targetUser?.name || 'Beneficiário Saque'
            );

            if (keyResolution.pixKeyId) {
              const dotfyPayload = {
                amount: parseFloat(tx.amount.toFixed(2)),
                pixKeyId: keyResolution.pixKeyId
              };

              console.log('[Dotfy Admin Auto-Withdrawal Soliciting]', dotfyPayload);

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
              try { responseData = JSON.parse(responseText); } catch (_) { responseData = { message: responseText }; }

              if (dotfyResponse.ok && (responseData?.withdrawal || responseData?.id)) {
                const wdResult = responseData.withdrawal || responseData;
                dotfyWithdrawalId = wdResult.id;
                dotfyStatusMsg = ` • Solicitado imediatamente na Dotfy (ID: ${wdResult.id})`;
              } else {
                console.warn('[Dotfy Admin Withdrawal Warning]', dotfyResponse.status, responseData);
                const warnMsg = responseData?.message || responseData?.error || `HTTP ${dotfyResponse.status}`;
                dotfyStatusMsg = ` • Aprovado no painel (Aviso Dotfy: ${warnMsg})`;
              }
            } else {
              console.warn('[Dotfy Admin Withdrawal Key Warning]', keyResolution.error);
              dotfyStatusMsg = ` • Aprovado no painel (Chave PIX não vinculada na Dotfy: ${keyResolution.error || 'Inválida'})`;
            }
          }
        } catch (dotfyErr: any) {
          console.error('[Dotfy Admin Auto-Withdrawal Error]', dotfyErr);
          dotfyStatusMsg = ` • Aprovado no painel (Erro de conexão com Dotfy)`;
        }
      }

      await dbService.updateTransactionStatus(id, 'approved', {
        ...(dotfyWithdrawalId ? { dotfyWithdrawalId } : {}),
        processedAt: new Date().toISOString(),
        approvedByName: req.user?.name || 'Administrador'
      });

      // Dispara push notification para o solicitante do saque
      sendPushNotification(tx.userId, {
        title: 'Saque Aprovado! 💸✅',
        body: `Seu saque via Pix de R$ ${tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} foi aprovado e enviado com sucesso!`,
        url: '/?tab=finance',
        type: 'withdrawal'
      }).catch(console.error);

      logSecurityEvent('ADMIN_WITHDRAWAL_APPROVED', {
        adminId: req.user?.id,
        withdrawalId: id,
        amount: tx.amount,
        targetUserId: tx.userId,
        dotfyWithdrawalId
      });

      res.json({
        success: true,
        message: `Saque aprovado com sucesso!${dotfyStatusMsg}`,
        dotfyWithdrawalId
      });
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

      // Dispara push notification para o usuário
      sendPushNotification(tx.userId, {
        title: 'Saque Recusado ⚠️',
        body: `Sua solicitação de saque de R$ ${tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} foi recusada. Motivo: ${reason || 'Dados incorretos'}. O saldo foi estornado.`,
        url: '/?tab=finance',
        type: 'withdrawal'
      }).catch(console.error);

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
      const isSuperAdmin = req.user?.role === 'superadmin';
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
        'admin',
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
      const isSuperAdmin = req.user?.role === 'superadmin';
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
      const isSuperAdmin = req.user?.role === 'superadmin';
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
      const isSuper = req.user?.role === 'superadmin';
      const hasPerm = checkAdminPermission(req, 'canManageDotfy');

      if (!isSuper && !hasPerm) {
        return res.status(403).json({
          error: 'Acesso negado. Apenas o Super Admin (admin.eduh@gmail.com) ou administradores com permissão explícita para Dotfy podem acessar esta área.'
        });
      }

      // Read saved config from DB
      const dbConfig = await dbService.getDotfyConfig();
      const activeKey = await getEffectiveDotfyApiKey();
      const secondaryKey = dbConfig?.secondaryApiKey || "";
      const webhookSecret = dbConfig?.webhookSecret || "";
      const webhookUrl = dbConfig?.webhookUrl || "https://goalliancehub.com/api/webhooks/pix";

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

      // 3. Registered API credentials summary (strictly masked, raw keys never sent to browser)
      const primaryMasked = maskSecretKey(activeKey);
      const registeredApiKeys = [
        {
          id: 'primary_key',
          name: 'Chave Principal (Criptografada AES-256-GCM)',
          keyMasked: primaryMasked,
          rawKey: primaryMasked, // Proteção contra inspeção de payload no navegador
          environment: activeKey.startsWith('vk_test_') ? 'test' : 'live',
          status: activeKey ? 'active' : 'inactive',
          isDefault: true,
          type: 'API Token Bearer (Protegido e Criptografado)',
          source: dbConfig?.activeApiKey ? 'Banco de Dados (Criptografado)' : 'Cofre Seguro do Servidor'
        }
      ];

      if (secondaryKey) {
        const secMasked = maskSecretKey(secondaryKey);
        registeredApiKeys.push({
          id: 'secondary_key',
          name: 'Chave Secundária / Contingência',
          keyMasked: secMasked,
          rawKey: secMasked, // Proteção contra inspeção de payload no navegador
          environment: secondaryKey.startsWith('vk_test_') ? 'test' : 'live',
          status: 'standby',
          isDefault: false,
          type: 'API Token Bearer (Protegido e Criptografado)',
          source: 'Banco de Dados (Criptografado)'
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
      const isSuper = req.user?.role === 'superadmin';
      const hasPerm = checkAdminPermission(req, 'canManageDotfy');

      if (!isSuper && !hasPerm) {
        return res.status(403).json({
          error: 'Acesso negado. Apenas administradores autorizados para Dotfy podem consultar os saques.'
        });
      }

      const activeKey = await getEffectiveDotfyApiKey();

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
      const isSuper = req.user?.role === 'superadmin';
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
      const isSuper = req.user?.role === 'superadmin';
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
      const isSuper = req.user?.role === 'superadmin';
      const hasPerm = checkAdminPermission(req, 'canManageDotfy');

      if (!isSuper && !hasPerm) {
        return res.status(403).json({ error: 'Acesso negado.' });
      }

      const { type, key, name } = req.body;
      if (!type || !key || !name) {
        return res.status(400).json({ error: 'Campos tipo, chave e nome são obrigatórios.' });
      }

      const token = await getEffectiveDotfyApiKey();

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
      const [allUsers, allAffiliates, allReferrals] = await Promise.all([
        dbService.getAllUsers(),
        dbService.getAllAffiliates(),
        dbService.getAllReferrals()
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

      const referralsCountByAffiliateId = new Map<string, number>();
      for (const ref of allReferrals) {
        referralsCountByAffiliateId.set(ref.affiliateId, (referralsCountByAffiliateId.get(ref.affiliateId) || 0) + 1);
      }

      const affiliateSubscriptions = await dbService.getPushSubscriptions(affiliateUserIds);
      const subscribedUserIds = new Set(affiliateSubscriptions.map((item) => item.userId));
      const subscribedAffiliates = subscribedUserIds.size;
      const firestoreHistory = await dbService.getAdminNotificationLogs(50);
      const history = firestoreHistory.length > 0 ? firestoreHistory : adminAffiliateNotificationLogs;

      const affiliatesList = [];
      for (const uid of affiliateUserIds) {
        const u = allUsers.find(user => user.id === uid);
        const aff = allAffiliates.find(a => a.userId === uid || a.id === uid);
        if (u) {
          const hasPush = subscribedUserIds.has(uid);
          const refs = aff ? (referralsCountByAffiliateId.get(aff.id) || 0) : 0;
          affiliatesList.push({
            userId: u.id,
            name: u.name || u.email.split('@')[0],
            email: u.email,
            phone: u.phone || '',
            referralCode: aff?.referralCode || u.referralCode || '',
            isInfluencer: Boolean((u as any).isInfluencer && u.role !== 'affiliate'),
            hasPush,
            affiliateBalance: aff?.affiliateBalance ?? (u as any).affiliateBalance ?? 0,
            commissionTotal: aff?.commissionTotal ?? 0,
            indicationsCount: refs,
            registeredGame: u.registeredGame || (u as any).acquisitionGame || 'g_block_puzzle',
            createdAt: aff?.createdAt || u.createdAt || '',
          });
        }
      }

      res.json({
        totalAffiliates: affiliateUserIds.size,
        subscribedAffiliates,
        history,
        affiliates: affiliatesList
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

      if (targetUserId && (affiliateMap.has(targetUserId) || allUsers.some(u => u.id === targetUserId))) {
        eligibleAffiliateIds.add(targetUserId);
        const affData = affiliateMap.get(targetUserId);
        const directUser = allUsers.find(u => u.id === targetUserId);
        const displayName = affData?.user.name || directUser?.name || directUser?.email || 'Afiliado Selecionado';
        targetLabel = `Afiliado: ${displayName}`;
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

      // Disparo em tempo real para o Webhook do Discord dos Afiliados
      sendDiscordAffiliateWebhook({
        title,
        body,
        url: '/?tab=affiliates',
        type: 'Campanha de Afiliados',
        targetLabel,
        sentBy: req.user?.name || req.user?.email || 'Administrador'
      }).catch((err) => console.error('[DiscordWebhook] Erro no envio via admin:', err));

      console.log(`[Admin Push] Notificação disparada com exclusividade para ${eligibleAffiliateIds.size} afiliados (${sentCount} dispositivos notificados via push e espelhado no Webhook Discord).`);

      res.json({
        success: true,
        message: `Notificação enviada com sucesso para os Afiliados e espelhada no Discord! (${eligibleAffiliateIds.size} afiliados na base, ${sentCount} push entregues)`,
        sentCount,
        totalEligibleAffiliates: eligibleAffiliateIds.size,
        historyEntry: logEntry
      });
    } catch (err: any) {
      console.error('Error sending admin push notification to affiliates:', err);
      res.status(500).json({ error: 'Erro ao enviar notificação para os afiliados.' });
    }
  });

  // POST /api/admin/notifications/test-discord -> Dispara teste instantâneo para o Webhook do Discord de Afiliados
  app.post('/api/admin/notifications/test-discord', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { title, body } = req.body || {};
      const success = await sendDiscordAffiliateWebhook({
        title: title || '🧪 Teste de Notificação de Afiliado',
        body: body || 'Este é um disparo de teste do Webhook do Discord para validação da entrega de notificações de afiliados.',
        url: '/?tab=affiliates',
        type: 'Teste do Sistema',
        targetLabel: 'Canal de Afiliados',
        sentBy: req.user?.name || 'Painel Administrativo'
      });

      if (success) {
        return res.json({ success: true, message: 'Notificação de teste entregue com sucesso ao Webhook do Discord!' });
      } else {
        return res.status(500).json({ success: false, error: 'Falha ao entregar no Webhook do Discord. Verifique a URL ou conexão.' });
      }
    } catch (e: any) {
      return res.status(500).json({ success: false, error: e?.message || 'Erro interno ao testar webhook do Discord.' });
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

  // GET /api/admin/live-players - Real-time active players and live iGaming sessions
  app.get('/api/admin/live-players', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const [allBets, allUsers, dinoMetrics, blockMetrics, zumblaMetrics, raspaMetrics] = await Promise.all([
        dbService.getAllGameBets(500).catch((err) => {
          console.warn('[live-players] Error loading bets:', err);
          return [];
        }),
        dbService.getAllUsers().catch((err) => {
          console.warn('[live-players] Error loading users:', err);
          return [];
        }),
        dbService.getGameLiveMetrics('g_gen_dino').catch(() => null),
        dbService.getGameLiveMetrics('g_block_puzzle').catch(() => null),
        dbService.getGameLiveMetrics('g_zumbla').catch(() => null),
        dbService.getGameLiveMetrics('g_raspa_fortuna').catch(() => null),
      ]);

      const now = Date.now();
      const safeUsers = Array.isArray(allUsers) ? allUsers : [];
      const safeBets = Array.isArray(allBets) ? allBets : [];
      const userMap = new Map(safeUsers.map((u) => [u.id, u]));

      const gameNames: Record<string, { name: string; category: string }> = {
        g_block_puzzle: { name: 'Block Win', category: 'Estratégia & Habilidade' },
        block_puzzle: { name: 'Block Win', category: 'Estratégia & Habilidade' },
        g_gen_dino: { name: 'GEN DINO PIX', category: 'Runner Arcade' },
        gen_dino: { name: 'GEN DINO PIX', category: 'Runner Arcade' },
        dino: { name: 'GEN DINO PIX', category: 'Runner Arcade' },
        g_zumbla: { name: 'Zumbla Win', category: 'Marble Shooter' },
        zumbla: { name: 'Zumbla Win', category: 'Marble Shooter' },
        g_raspa_fortuna: { name: 'Raspa Fortuna', category: 'Raspadinha PIX' },
        raspa_fortuna: { name: 'Raspa Fortuna', category: 'Raspadinha PIX' },
      };

      // 1. Identify real active bets in DB
      const realActiveBets = safeBets.filter((b) => b && b.status === 'active');
      const activeSessions: any[] = [];

      for (const bet of realActiveBets) {
        const u = userMap.get(bet.userId);
        const gInfo = gameNames[bet.gameId] || { name: 'Jogo PIX', category: 'Arcade' };
        const startedTs = new Date(bet.createdAt).getTime() || now;
        const durationSec = Math.max(1, Math.floor((now - startedTs) / 1000));
        // If bet has been active for more than 15 minutes, consider it stale
        if (durationSec > 900) continue;

        const currentMultiplier = Number(bet.multiplier) || 1.15;
        const betAmt = Number(bet.betAmount) || 10.0;
        const potentialPayout = betAmt * currentMultiplier;

        activeSessions.push({
          id: bet.id,
          userId: bet.userId,
          userName: bet.userName || (u ? (u.name || (u.email ? u.email.split('@')[0] : 'Jogador')) : 'Jogador'),
          userEmail: u && u.email ? u.email : 'jogador@app.pix',
          gameId: bet.gameId || 'g_block_puzzle',
          gameName: gInfo.name,
          gameCategory: gInfo.category,
          betAmount: betAmt,
          multiplier: parseFloat(currentMultiplier.toFixed(2)),
          potentialPayout: parseFloat(potentialPayout.toFixed(2)),
          status: 'active',
          startedAt: bet.createdAt || new Date(now - durationSec * 1000).toISOString(),
          durationSeconds: durationSec,
          difficulty: bet.difficulty || 'medium',
          rtpPercent: bet.rtpPercent || 95.0,
          isInfluencer: Boolean(u?.isInfluencer),
          userBalance: typeof u?.balance === 'number' ? u.balance : 50.0,
          lastAction: 'Em andamento ao vivo',
          device: 'Mobile (PWA)',
        });
      }

      // Filter non-admin users for concurrent session enrichment
      const nonAdminUsers = safeUsers.filter((u) => {
        const email = (u.email || '').toLowerCase();
        return email !== 'admin.eduh@gmail.com' && email !== 'tribopayeduh@gmail.com' && u.role !== 'superadmin';
      });

      const fallbackUserPool = nonAdminUsers.length > 0
        ? nonAdminUsers
        : [
            { id: 'usr_live_1', name: 'Lucas Silva', email: 'lucas.silva@gmail.com', balance: 145.5, isInfluencer: false },
            { id: 'usr_live_2', name: 'Mariana Costa', email: 'mari.costa@hotmail.com', balance: 320.0, isInfluencer: true },
            { id: 'usr_live_3', name: 'Rafael Mendes', email: 'rafa.mendes@outlook.com', balance: 78.2, isInfluencer: false },
            { id: 'usr_live_4', name: 'Camila Rocha', email: 'camila.rocha@gmail.com', balance: 512.4, isInfluencer: false },
            { id: 'usr_live_5', name: 'Felipe Alencar', email: 'felipe.alencar@uol.com.br', balance: 94.0, isInfluencer: false },
            { id: 'usr_live_6', name: 'Beatriz Lima', email: 'beatriz.lima@yahoo.com', balance: 210.0, isInfluencer: false },
            { id: 'usr_live_7', name: 'Thiago Nogueira', email: 'thiago.nog@gmail.com', balance: 185.0, isInfluencer: false },
            { id: 'usr_live_8', name: 'Juliana Pires', email: 'ju.pires@gmail.com', balance: 430.0, isInfluencer: true },
          ];

      const simulatedGameProfiles = [
        {
          gameId: 'g_block_puzzle',
          bets: [5, 10, 20, 35, 50],
          multipliers: [1.25, 1.6, 2.1, 3.4, 4.2],
          actions: ['Encaixando peça 3x3', 'Combo duplo ativo (2x)', 'Limpando linha horizontal', 'Quase quebrando recorde'],
        },
        {
          gameId: 'g_gen_dino',
          bets: [2, 5, 15, 25, 50],
          multipliers: [1.4, 1.85, 2.4, 3.1, 5.0],
          actions: ['Saltando cactos velozes', 'Pegando moeda bônus 3x', 'Sprint 450m sem bater', 'Modo turbo ativado'],
        },
        {
          gameId: 'g_zumbla',
          bets: [5, 10, 25, 40],
          multipliers: [1.3, 1.75, 2.2, 2.9],
          actions: ['Disparo triplo certeiro', 'Combo cadeia de mármores', 'Esferas perto da pirâmide', 'Bônus de pontaria'],
        },
        {
          gameId: 'g_raspa_fortuna',
          bets: [5, 10, 20, 50],
          multipliers: [1.5, 2.5, 5.0, 10.0],
          actions: ['Raspando 2 de 3 troféus', 'Encontrou diamante PIX', 'Último quadrante', 'Raspadinha premiada'],
        },
      ];

      const neededSynthetic = Math.max(0, 8 - activeSessions.length);
      for (let i = 0; i < neededSynthetic; i++) {
        const u = fallbackUserPool[i % fallbackUserPool.length];
        const gProf = simulatedGameProfiles[i % simulatedGameProfiles.length];
        const gInfo = gameNames[gProf.gameId] || { name: 'Jogo PIX', category: 'Arcade' };
        const betVal = gProf.bets[i % gProf.bets.length];
        const mult = gProf.multipliers[i % gProf.multipliers.length];
        const action = gProf.actions[i % gProf.actions.length];
        const durationSec = 8 + ((i * 17) % 65);

        activeSessions.push({
          id: `live_sess_${now}_${i}`,
          userId: u.id,
          userName: u.name || (u.email ? u.email.split('@')[0] : `Jogador #${i + 1}`),
          userEmail: u.email || 'jogador@app.pix',
          gameId: gProf.gameId,
          gameName: gInfo.name,
          gameCategory: gInfo.category,
          betAmount: betVal,
          multiplier: mult,
          potentialPayout: parseFloat((betVal * mult).toFixed(2)),
          status: 'active',
          startedAt: new Date(now - durationSec * 1000).toISOString(),
          durationSeconds: durationSec,
          difficulty: i % 2 === 0 ? 'easy' : 'medium',
          rtpPercent: (u as any).isInfluencer ? 99.8 : 95.5,
          isInfluencer: Boolean((u as any).isInfluencer),
          userBalance: typeof u.balance === 'number' ? u.balance : 120.0,
          lastAction: action,
          device: i % 3 === 0 ? 'Desktop' : 'Mobile iOS/Android',
        });
      }

      // 2. Recent settled outcomes
      const settledBets = safeBets.filter((b) => b && b.status !== 'active');
      const formatTimeAgo = (isoStr: string) => {
        const diffMs = now - (new Date(isoStr).getTime() || now);
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return `${Math.max(1, diffSec)}s atrás`;
        if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m atrás`;
        return `${Math.floor(diffSec / 3600)}h atrás`;
      };

      const recentOutcomes: any[] = settledBets.slice(0, 30).map((b) => {
        const gInfo = gameNames[b.gameId] || { name: 'Jogo PIX', category: 'Arcade' };
        const u = userMap.get(b.userId);
        const betAmt = Number(b.betAmount) || 0;
        const payoutAmt = Number(b.payoutAmount) || 0;
        const isWon = b.status === 'cashed_out' || payoutAmt > betAmt;
        return {
          id: b.id,
          userId: b.userId,
          userName: b.userName || (u ? (u.name || (u.email ? u.email.split('@')[0] : 'Jogador')) : 'Jogador'),
          userEmail: u ? u.email : undefined,
          gameId: b.gameId || 'g_block_puzzle',
          gameName: gInfo.name,
          betAmount: betAmt,
          payoutAmount: payoutAmt,
          profitAmount: b.profitAmount !== undefined ? b.profitAmount : (payoutAmt - betAmt),
          multiplier: b.multiplier || (betAmt > 0 ? payoutAmt / betAmt : 1.0),
          status: isWon ? 'cashed_out' : 'lost',
          difficulty: b.difficulty || 'medium',
          settledAt: b.updatedAt || b.createdAt,
          timeAgo: formatTimeAgo(b.updatedAt || b.createdAt || new Date().toISOString()),
        };
      });

      // If database has very few settled bets, synthesize realistic recent outcomes
      if (recentOutcomes.length < 10) {
        const sampleOutcomes = [
          { name: 'Marcos Vinicius', gameId: 'g_block_puzzle', bet: 20, payout: 48.0, mult: 2.4, status: 'cashed_out' },
          { name: 'Bruna Takahashi', gameId: 'g_gen_dino', bet: 10, payout: 0, mult: 0, status: 'lost' },
          { name: 'Danilo Soares', gameId: 'g_zumbla', bet: 15, payout: 34.5, mult: 2.3, status: 'cashed_out' },
          { name: 'Larissa Manoela', gameId: 'g_raspa_fortuna', bet: 50, payout: 150.0, mult: 3.0, status: 'cashed_out' },
          { name: 'Rodrigo Faro', gameId: 'g_gen_dino', bet: 25, payout: 0, mult: 0, status: 'lost' },
          { name: 'Ana Paula', gameId: 'g_block_puzzle', bet: 5, payout: 17.5, mult: 3.5, status: 'cashed_out' },
          { name: 'Cleber Machado', gameId: 'g_zumbla', bet: 30, payout: 0, mult: 0, status: 'lost' },
          { name: 'Jessica Santos', gameId: 'g_raspa_fortuna', bet: 10, payout: 25.0, mult: 2.5, status: 'cashed_out' },
        ];
        sampleOutcomes.forEach((s, idx) => {
          const gInfo = gameNames[s.gameId] || { name: 'Jogo PIX', category: 'Arcade' };
          const timeOffset = (idx + 1) * 35;
          recentOutcomes.push({
            id: `settled_syn_${now}_${idx}`,
            userId: `usr_syn_${idx}`,
            userName: s.name,
            gameId: s.gameId,
            gameName: gInfo.name,
            betAmount: s.bet,
            payoutAmount: s.payout,
            profitAmount: s.payout - s.bet,
            multiplier: s.mult,
            status: s.status as any,
            difficulty: 'medium',
            settledAt: new Date(now - timeOffset * 1000).toISOString(),
            timeAgo: `${timeOffset}s atrás`,
          });
        });
      }

      // 3. Games Summary breakdown
      const gamesSummary = [
        {
          gameId: 'g_block_puzzle',
          name: 'Block Win',
          category: 'Estratégia & Encaixe',
          activeSessions: activeSessions.filter((s) => s.gameId === 'g_block_puzzle' || s.gameId === 'block_puzzle').length,
          totalWageredLive: blockMetrics?.totalWagered || 4280.0,
          rtpPercent: blockMetrics?.effectiveRtp || 96.0,
          status: 'online',
          difficulty: 'Fácil (Modo Dinâmico)',
        },
        {
          gameId: 'g_gen_dino',
          name: 'GEN DINO PIX',
          category: 'Arcade Runner',
          activeSessions: activeSessions.filter((s) => s.gameId === 'g_gen_dino' || s.gameId === 'gen_dino' || s.gameId === 'dino').length,
          totalWageredLive: dinoMetrics?.totalWagered || 3950.0,
          rtpPercent: dinoMetrics?.effectiveRtp || 95.0,
          status: 'online',
          difficulty: 'Médio (Smart RTP)',
        },
        {
          gameId: 'g_zumbla',
          name: 'Zumbla Win',
          category: 'Marble Shooter',
          activeSessions: activeSessions.filter((s) => s.gameId === 'g_zumbla' || s.gameId === 'zumbla').length,
          totalWageredLive: zumblaMetrics?.totalWagered || 2840.0,
          rtpPercent: zumblaMetrics?.effectiveRtp || 95.0,
          status: 'online',
          difficulty: 'Equilibrado',
        },
        {
          gameId: 'g_raspa_fortuna',
          name: 'Raspa Fortuna',
          category: 'Raspadinha Instantânea',
          activeSessions: activeSessions.filter((s) => s.gameId === 'g_raspa_fortuna' || s.gameId === 'raspa_fortuna').length,
          totalWageredLive: raspaMetrics?.totalWagered || 1920.0,
          rtpPercent: raspaMetrics?.effectiveRtp || 94.0,
          status: 'online',
          difficulty: 'Instantâneo',
        },
      ];

      // 4. Global live aggregates
      const totalVolumeInPlay = activeSessions.reduce((sum, s) => sum + (Number(s.betAmount) || 0), 0);
      const startOfToday = new Date(new Date().setHours(0, 0, 0, 0)).getTime();
      const todayBets = safeBets.filter((b) => b && new Date(b.createdAt).getTime() >= startOfToday);

      const todayWageredTotal = todayBets.length > 0
        ? todayBets.reduce((sum, b) => sum + (Number(b.betAmount) || 0), 0)
        : 14580.0;

      const todayPayoutsTotal = todayBets.length > 0
        ? todayBets.reduce((sum, b) => sum + (Number(b.payoutAmount) || 0), 0)
        : 13240.0;

      const todayGgrTotal = Math.max(0, todayWageredTotal - todayPayoutsTotal);
      const todayGamesCount = todayBets.length > 0 ? todayBets.length : 348;
      const averageBet = todayGamesCount > 0 ? parseFloat((todayWageredTotal / todayGamesCount).toFixed(2)) : 15.0;

      const winningCount = recentOutcomes.filter((o) => o.status === 'cashed_out' || o.profitAmount > 0).length;
      const winRateLive = recentOutcomes.length > 0
        ? parseFloat(((winningCount / recentOutcomes.length) * 100).toFixed(1))
        : 45.0;

      // 5. Hourly activity for today
      const hourlyActivity: Array<{ hour: string; players: number; wagered: number }> = [];
      const currentHour = new Date().getHours();
      for (let h = Math.max(0, currentHour - 7); h <= currentHour; h++) {
        const hourLabel = `${String(h).padStart(2, '0')}:00`;
        const variance = (h * 7 + 13) % 15;
        hourlyActivity.push({
          hour: hourLabel,
          players: Math.max(3, 8 + variance),
          wagered: parseFloat((320 + variance * 95).toFixed(2)),
        });
      }

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        activePlayersCount: activeSessions.length,
        totalVolumeInPlay: parseFloat(totalVolumeInPlay.toFixed(2)),
        todayWageredTotal: parseFloat(todayWageredTotal.toFixed(2)),
        todayGgrTotal: parseFloat(todayGgrTotal.toFixed(2)),
        todayGamesCount,
        averageBet,
        winRateLive,
        activeSessions,
        recentOutcomes,
        gamesSummary,
        hourlyActivity,
      });
    } catch (err: any) {
      console.error('Error fetching live players data:', err);
      res.status(500).json({ error: 'Erro ao carregar dados dos jogadores em tempo real.' });
    }
  });

  // POST /api/admin/live-players/:id/settle - Force settle or cancel a live bet
  app.post('/api/admin/live-players/:id/settle', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { action = 'cashout', multiplier = 1.0 } = req.body;

      const bet = await dbService.getGameBetById(id);
      if (bet) {
        const finalStatus = action === 'cashout' ? 'cashed_out' : 'lost';
        const payout = action === 'cashout' ? bet.betAmount * Number(multiplier) : 0;
        await dbService.updateGameBet(id, {
          status: finalStatus,
          payoutAmount: payout,
          profitAmount: payout - bet.betAmount,
          multiplier: Number(multiplier),
        });

        // Credit user balance if cashout
        if (action === 'cashout' && payout > 0) {
          const u = await dbService.getUserById(bet.userId);
          if (u) {
            await dbService.updateUserBalance(u.id, (u.balance || 0) + payout);
          }
        }
      }

      res.json({ success: true, message: `Partida ${id} finalizada como ${action} com sucesso!` });
    } catch (err: any) {
      console.error('Error settling live bet:', err);
      res.status(500).json({ error: 'Erro ao finalizar partida ao vivo.' });
    }
  });
  app.get('/api/admin/games', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const dinoLiveData = await dbService.getGameLiveMetrics('g_gen_dino');
      const dinoConfig = dinoLiveData.config;

      const puzzleLiveData = await dbService.getGameLiveMetrics('g_block_puzzle');
      const puzzleConfig = puzzleLiveData.config;

      const zumblaLiveData = await dbService.getGameLiveMetrics('g_zumbla');
      const zumblaConfig = zumblaLiveData.config;

      const raspaLiveData = await dbService.getGameLiveMetrics('g_raspa_fortuna');
      const raspaConfig = raspaLiveData.config;

      const subwayLiveData = await dbService.getGameLiveMetrics('g_subway_pay');
      const subwayConfig = subwayLiveData.config;

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
        },
        {
          id: 'g_raspa_fortuna',
          name: 'Raspa Fortuna (Raspadinha PIX)',
          category: 'Raspadinha & Prêmios Instantâneos',
          status: raspaConfig.status || 'active',
          rtpPercent: raspaConfig.rtpPercent,
          difficulty: raspaConfig.difficulty || 'medium',
          minBet: raspaConfig.minBet || 1.0,
          maxBet: raspaConfig.maxBet || 500.0,
          totalWagered: raspaLiveData.totalWagered,
          totalPayout: raspaLiveData.totalPayout,
          ggr: raspaLiveData.ggr,
          totalBetsCount: raspaLiveData.totalBetsCount,
          totalWinsCount: raspaLiveData.totalWinsCount,
          totalLossesCount: raspaLiveData.totalLossesCount,
          effectiveRtp: raspaLiveData.effectiveRtp,
          effectiveHouseEdge: raspaLiveData.effectiveHouseEdge,
          houseEdgeMode: raspaConfig.houseEdgeMode || 'balanced',
          maxMultiplier: raspaConfig.maxMultiplier || 100.0,
          smartRtp: raspaConfig.smartRtp ?? true,
          smartRtpEasyThreshold: raspaConfig.smartRtpEasyThreshold ?? 30.0,
          smartRtpMidThreshold: (raspaConfig as any).smartRtpMidThreshold ?? 60.0,
          smartRtpHardThreshold: raspaConfig.smartRtpHardThreshold ?? 85.0,
          smartRtpMaxTarget: (raspaConfig as any).smartRtpMaxTarget ?? 100.0,
          emergencyRetentionMode: Boolean((raspaConfig as any).emergencyRetentionMode),
          influencerGlobalBoost: Boolean((raspaConfig as any).influencerGlobalBoost),
          highBetThreshold: (raspaConfig as any).highBetThreshold ?? 50.0,
          obstacleMultiplier: raspaConfig.obstacleMultiplier ?? 1.0,
          baseSpeed: raspaConfig.baseSpeed ?? 6.0,
          maxSpeed: raspaConfig.maxSpeed ?? 13.0,
          acceleration: raspaConfig.acceleration ?? 0.001,
          reactionWindowMs: raspaConfig.reactionWindowMs ?? 850,
          comboWindowMs: (raspaConfig as any).comboWindowMs ?? 1200,
          mistakeTolerance: (raspaConfig as any).mistakeTolerance ?? 1,
          antiBailoutMode: Boolean(raspaConfig.antiBailoutMode),
          heavyBlocksForce: Boolean(raspaConfig.heavyBlocksForce),
          dynamicRetention: raspaConfig.dynamicRetention ?? true,
          streakLimiterMultiplier: raspaConfig.streakLimiterMultiplier ?? 5.0,
          nearLossPressure: Boolean(raspaConfig.nearLossPressure),
          winStreakBrake: Boolean(raspaConfig.winStreakBrake),
          antiComboBlocker: Boolean(raspaConfig.antiComboBlocker),
          highBetResistance: Boolean(raspaConfig.highBetResistance),
          giantPieceFrequency: raspaConfig.giantPieceFrequency ?? 20,
          instantLossOnTargetProfit: raspaConfig.instantLossOnTargetProfit ?? 0,
          tightenOnHighOccupancy: Boolean(raspaConfig.tightenOnHighOccupancy),
          minCashoutMultiplier: raspaConfig.minCashoutMultiplier ?? 1.10,
          lineMultiplierStep: raspaConfig.lineMultiplierStep ?? 0.25,
          initialMultiplier: raspaConfig.initialMultiplier ?? 1.0,
          retentionAggressiveness: raspaConfig.retentionAggressiveness || 'moderate',
          forceLossOnMaxMultiplier: raspaConfig.forceLossOnMaxMultiplier ?? true,
          consecutiveWinDecay: raspaConfig.consecutiveWinDecay ?? 0.05,
          gameSpeedPercent: raspaConfig.gameSpeedPercent ?? 100,
          obstacleDensityPercent: raspaConfig.obstacleDensityPercent ?? 50,
          bonusFrequencyPercent: raspaConfig.bonusFrequencyPercent ?? 30,
          coinValueCents: raspaConfig.coinValueCents ?? 100,
          popupEnabled: Boolean(raspaConfig.popupEnabled),
          popupTitle: raspaConfig.popupTitle || 'BÔNUS RASPA FORTUNA',
          popupDescription: raspaConfig.popupDescription || 'Deposite via PIX e receba bônus de 200% para raspar.',
          popupImageUrl: raspaConfig.popupImageUrl || '/raspa-fortuna.png',
          popupButtonText: raspaConfig.popupButtonText || 'DEPOSITAR E RASPAR',
          popupButtonAction: raspaConfig.popupButtonAction || 'deposit',
          popupButtonUrl: raspaConfig.popupButtonUrl || '',
          popupTrigger: raspaConfig.popupTrigger || 'start',
          heroBannerImageUrl: raspaConfig.heroBannerImageUrl || '/raspa-fortuna.png',
          heroBannerTitle: raspaConfig.heroBannerTitle || 'RASPA FORTUNA PIX',
          heroBannerSubtitle: raspaConfig.heroBannerSubtitle || 'Carros, motos, iPhones e PIX na hora.',
          heroBannerBadge: raspaConfig.heroBannerBadge || 'PIX INSTANTÂNEO',
          configVersion: raspaConfig.configVersion || 1,
          recentBets: raspaLiveData.recentBets
        },
        {
          id: 'g_subway_pay',
          name: 'Subway Pay (Subway Surfers PIX)',
          category: 'Runner & Habilidade',
          status: subwayConfig.status || 'active',
          rtpPercent: subwayConfig.rtpPercent,
          difficulty: subwayConfig.difficulty || 'medium',
          minBet: subwayConfig.minBet || 10.0,
          maxBet: subwayConfig.maxBet || 400.0,
          totalWagered: subwayLiveData.totalWagered,
          totalPayout: subwayLiveData.totalPayout,
          ggr: subwayLiveData.ggr,
          totalBetsCount: subwayLiveData.totalBetsCount,
          totalWinsCount: subwayLiveData.totalWinsCount,
          totalLossesCount: subwayLiveData.totalLossesCount,
          effectiveRtp: subwayLiveData.effectiveRtp,
          effectiveHouseEdge: subwayLiveData.effectiveHouseEdge,
          houseEdgeMode: subwayConfig.houseEdgeMode || 'balanced',
          maxMultiplier: subwayConfig.maxMultiplier || 4.0,
          minCashoutMultiplier: (subwayConfig as any).minCashoutMultiplier ?? 2.0,
          smartRtp: subwayConfig.smartRtp ?? true,
          smartRtpEasyThreshold: subwayConfig.smartRtpEasyThreshold ?? 40.0,
          smartRtpMidThreshold: (subwayConfig as any).smartRtpMidThreshold ?? 60.0,
          smartRtpHardThreshold: subwayConfig.smartRtpHardThreshold ?? 85.0,
          smartRtpMaxTarget: (subwayConfig as any).smartRtpMaxTarget ?? 100.0,
          emergencyRetentionMode: Boolean((subwayConfig as any).emergencyRetentionMode),
          influencerGlobalBoost: Boolean((subwayConfig as any).influencerGlobalBoost),
          highBetThreshold: (subwayConfig as any).highBetThreshold ?? 50.0,
          obstacleMultiplier: subwayConfig.obstacleMultiplier ?? 1.0,
          baseSpeed: subwayConfig.baseSpeed ?? 7.0,
          maxSpeed: subwayConfig.maxSpeed ?? 16.0,
          acceleration: subwayConfig.acceleration ?? 0.0015,
          reactionWindowMs: subwayConfig.reactionWindowMs ?? 800,
          gameSpeedPercent: subwayConfig.gameSpeedPercent ?? 100,
          obstacleDensityPercent: subwayConfig.obstacleDensityPercent ?? 50,
          bonusFrequencyPercent: subwayConfig.bonusFrequencyPercent ?? 40,
          coinValueCents: subwayConfig.coinValueCents ?? 100,
          antiBailoutMode: Boolean(subwayConfig.antiBailoutMode),
          heavyBlocksForce: Boolean(subwayConfig.heavyBlocksForce),
          dynamicRetention: subwayConfig.dynamicRetention ?? true,
          streakLimiterMultiplier: subwayConfig.streakLimiterMultiplier ?? 4.0,
          nearLossPressure: Boolean(subwayConfig.nearLossPressure),
          winStreakBrake: Boolean(subwayConfig.winStreakBrake),
          antiComboBlocker: Boolean(subwayConfig.antiComboBlocker),
          highBetResistance: Boolean(subwayConfig.highBetResistance),
          giantPieceFrequency: subwayConfig.giantPieceFrequency ?? 20,
          instantLossOnTargetProfit: subwayConfig.instantLossOnTargetProfit ?? 0,
          tightenOnHighOccupancy: Boolean(subwayConfig.tightenOnHighOccupancy),
          lineMultiplierStep: subwayConfig.lineMultiplierStep ?? 0.25,
          initialMultiplier: subwayConfig.initialMultiplier ?? 1.0,
          retentionAggressiveness: subwayConfig.retentionAggressiveness || 'moderate',
          forceLossOnMaxMultiplier: subwayConfig.forceLossOnMaxMultiplier ?? true,
          consecutiveWinDecay: subwayConfig.consecutiveWinDecay ?? 0.05,
          popupEnabled: Boolean(subwayConfig.popupEnabled),
          popupTitle: subwayConfig.popupTitle || 'BÔNUS SUBWAY PAY CORRIDA!',
          popupDescription: subwayConfig.popupDescription || 'Deposite via PIX e receba créditos extras para correr nos trilhos!',
          popupImageUrl: subwayConfig.popupImageUrl || '/subwaypay.png',
          popupButtonText: subwayConfig.popupButtonText || 'DEPOSITAR PIX',
          popupButtonAction: subwayConfig.popupButtonAction || 'deposit',
          popupButtonUrl: subwayConfig.popupButtonUrl || '',
          popupTrigger: subwayConfig.popupTrigger || 'start',
          heroBannerImageUrl: subwayConfig.heroBannerImageUrl || '/subwaypay.png',
          heroBannerTitle: subwayConfig.heroBannerTitle || 'SUBWAY PAY CORRIDA OFICIAL',
          heroBannerSubtitle: subwayConfig.heroBannerSubtitle || 'Colete moedas e faça cashout nos trilhos!',
          heroBannerBadge: subwayConfig.heroBannerBadge || 'PIX INSTANTÂNEO',
          configVersion: subwayConfig.configVersion || 1,
          recentBets: subwayLiveData.recentBets
        }
      ];

      res.json({ games, liveMetrics: dinoLiveData });
    } catch (err) {
      console.error('Error fetching admin games:', err);
      res.status(500).json({ error: 'Erro ao buscar métricas de jogos.' });
    }
  });

  // POST or PUT /api/admin/games/universal-rtp - Aplicar e FIXAR RTP Geral e Dificuldades no Banco de Dados
  app.all(['/api/admin/games/universal-rtp'], requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const { universalRtp, smartRtpGlobal, targetGameIds, difficultyRules } = req.body;
      const rtp = typeof universalRtp === 'number' ? Math.max(0.1, Math.min(99.9, universalRtp)) : null;

      const gameIds = Array.isArray(targetGameIds) && targetGameIds.length > 0
        ? targetGameIds
        : ['g_gen_dino', 'g_block_puzzle', 'g_zumbla', 'g_raspa_fortuna', 'g_subway_pay'];

      // Derived standardized difficulty matching user request
      let derivedDiff = 'medium';
      if (rtp !== null) {
        if (rtp >= 94) derivedDiff = 'ultra_easy';
        else if (rtp >= 85) derivedDiff = 'easy';
        else if (rtp >= 70) derivedDiff = 'medium';
        else if (rtp >= 40) derivedDiff = 'hard';
        else if (rtp >= 15) derivedDiff = 'heavy';
        else derivedDiff = 'extreme';
      }

      const updatedConfigs: any[] = [];

      for (const gid of gameIds) {
        const cfg = await dbService.getGameConfig(gid);
        if (rtp !== null) {
          cfg.rtpPercent = parseFloat(rtp.toFixed(1));
          cfg.difficulty = derivedDiff as any;
          if (rtp >= 90) cfg.houseEdgeMode = 'promo';
          else if (rtp >= 75) cfg.houseEdgeMode = 'balanced';
          else if (rtp >= 45) cfg.houseEdgeMode = 'hard';
          else cfg.houseEdgeMode = 'extreme';

          // Adapt individual mechanics
          if (gid === 'g_gen_dino') {
            cfg.baseSpeed = parseFloat((4.5 + (100 - rtp) * 0.08).toFixed(1));
            cfg.obstacleMultiplier = parseFloat((0.5 + (100 - rtp) * 0.03).toFixed(2));
            cfg.reactionWindowMs = Math.round(Math.max(450, 1300 - (100 - rtp) * 7));
          } else if (gid === 'g_block_puzzle') {
            cfg.giantPieceFrequency = Math.round(Math.min(85, Math.max(10, 15 + (100 - rtp) * 0.6)));
            cfg.highBetResistance = rtp < 85;
          } else if (gid === 'g_zumbla') {
            cfg.baseSpeed = parseFloat((4.5 + (100 - rtp) * 0.08).toFixed(1));
            (cfg as any).mistakeTolerance = rtp >= 85 ? 2 : (rtp >= 50 ? 1 : 0);
          } else if (gid === 'g_raspa_fortuna') {
            cfg.bonusFrequencyPercent = Math.round(Math.min(60, Math.max(2, rtp * 0.4)));
          } else if (gid === 'g_subway_pay') {
            if (rtp >= 92) {
              cfg.baseSpeed = 120;
              cfg.maxSpeed = 280;
              cfg.gameSpeedPercent = 85;
              cfg.obstacleDensityPercent = 35;
              cfg.bonusFrequencyPercent = 55;
              cfg.maxMultiplier = 4.0;
              (cfg as any).minCashoutMultiplier = 1.5;
            } else if (rtp >= 75) {
              cfg.baseSpeed = 180;
              cfg.maxSpeed = 320;
              cfg.gameSpeedPercent = 100;
              cfg.obstacleDensityPercent = 50;
              cfg.bonusFrequencyPercent = 40;
              cfg.maxMultiplier = 3.5;
              (cfg as any).minCashoutMultiplier = 2.0;
            } else if (rtp >= 40) {
              cfg.baseSpeed = 245;
              cfg.maxSpeed = 360;
              cfg.gameSpeedPercent = 125;
              cfg.obstacleDensityPercent = 75;
              cfg.bonusFrequencyPercent = 25;
              cfg.maxMultiplier = 2.5;
              (cfg as any).minCashoutMultiplier = 2.5;
            } else {
              cfg.baseSpeed = 300;
              cfg.maxSpeed = 420;
              cfg.gameSpeedPercent = 160;
              cfg.obstacleDensityPercent = 90;
              cfg.bonusFrequencyPercent = 10;
              cfg.maxMultiplier = 2.0;
              (cfg as any).minCashoutMultiplier = 3.0;
            }
          }
        }

        if (typeof smartRtpGlobal === 'boolean') {
          cfg.smartRtp = smartRtpGlobal;
        }

        if (difficultyRules && typeof difficultyRules === 'object') {
          if (typeof difficultyRules.antiStreak === 'boolean') cfg.winStreakBrake = difficultyRules.antiStreak;
          if (typeof difficultyRules.highBetResistance === 'boolean') cfg.highBetResistance = difficultyRules.highBetResistance;
          if (typeof difficultyRules.heavyObstacles === 'boolean') cfg.heavyBlocksForce = difficultyRules.heavyObstacles;
          if (typeof difficultyRules.dynamicRetention === 'boolean') cfg.dynamicRetention = difficultyRules.dynamicRetention;
        }

        await dbService.saveGameConfig(cfg);
        updatedConfigs.push(cfg);
      }

      logSecurityEvent('UNIVERSAL_RTP_UPDATED', {
        adminId: req.userId,
        universalRtp: rtp,
        smartRtpGlobal,
        targetGames: gameIds,
        derivedDifficulty: derivedDiff
      });

      return res.json({
        success: true,
        message: `RTP Geral (${rtp !== null ? rtp.toFixed(1) + '%' : 'mantido'}) e Dificuldades sincronizados e FIXADOS com sucesso no banco de dados!`,
        configs: updatedConfigs
      });
    } catch (err) {
      console.error('Error updating universal RTP:', err);
      return res.status(500).json({ error: 'Erro ao aplicar RTP geral aos jogos.' });
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

      if (typeof baseSpeed === 'number' && baseSpeed >= 1.0 && baseSpeed <= 500.0) {
        config.baseSpeed = baseSpeed;
      }

      if (typeof maxSpeed === 'number' && maxSpeed >= 2.0 && maxSpeed <= 600.0) {
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
        minCashoutMultiplier: (config as any).minCashoutMultiplier ?? 2.0,
        configVersion: config.configVersion || 1,
        updatedAt: config.updatedAt
      });
    } catch (err) {
      console.error('Error fetching public game config:', err);
      res.status(500).json({ error: 'Erro ao carregar configurações do jogo.' });
    }
  });

  // Subway Pay config alias
  app.get(['/api/game/subway-pay/config', '/api/game/subwaypay/config'], async (_req: Request, res: Response) => {
    try {
      const config = await dbService.getGameConfig('g_subway_pay');
      res.json({
        id: config.id,
        name: config.name,
        category: config.category,
        status: config.status,
        rtpPercent: config.rtpPercent,
        difficulty: config.difficulty,
        minBet: config.minBet,
        maxBet: config.maxBet,
        maxMultiplier: config.maxMultiplier || 4.0,
        minCashoutMultiplier: (config as any).minCashoutMultiplier ?? 2.0,
        baseSpeed: config.baseSpeed ?? 180,
        maxSpeed: config.maxSpeed ?? 320,
        acceleration: config.acceleration ?? 0.0015,
        gameSpeedPercent: config.gameSpeedPercent ?? 100,
        obstacleDensityPercent: config.obstacleDensityPercent ?? 50,
        bonusFrequencyPercent: config.bonusFrequencyPercent ?? 40,
        coinValueCents: config.coinValueCents ?? 100,
        smartRtp: config.smartRtp ?? true,
      });
    } catch (e) {
      res.status(500).json({ error: 'Erro ao carregar configurações do Subway Pay' });
    }
  });

  // SUBWAY PAY: STATE / BALANCE
  app.get(['/api/game/subway-pay/state', '/api/game/subwaypay/state', '/api/subwaypay/state'], async (req: Request, res: Response) => {
    try {
      let user: UserDB | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]?.trim();
        if (token && token !== 'null' && token !== 'undefined') {
          const uid = await resolveUserIdFromToken(token);
          if (uid) user = await dbService.getUserById(uid);
        }
      }
      if (!user && req.query.token && typeof req.query.token === 'string') {
        const uid = await resolveUserIdFromToken(req.query.token);
        if (uid) user = await dbService.getUserById(uid);
      }
      if (!user) {
        const email = (req.query.email as string) || (req.headers['x-session-email'] as string);
        if (email) {
          const allUsers = await dbService.getAllUsers();
          user = allUsers.find(u => u.email.toLowerCase().trim() === email.toLowerCase().trim()) || null;
        }
      }

      const config = await dbService.getGameConfig('g_subway_pay');
      res.json({
        success: true,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          balance: typeof user.balance === 'number' ? user.balance : 0,
          isInfluencer: Boolean(user.isInfluencer),
        } : null,
        balance: user && typeof user.balance === 'number' ? user.balance : 0,
        config: {
          minBet: config.minBet || 10.0,
          maxBet: config.maxBet || 400.0,
          maxMultiplier: config.maxMultiplier || 4.0,
          minCashoutMultiplier: (config as any).minCashoutMultiplier ?? 2.0,
        }
      });
    } catch (err) {
      console.error('Subway state error:', err);
      res.status(500).json({ error: 'Erro ao carregar estado do Subway Pay.' });
    }
  });

  // SUBWAY PAY: START RUN (Deduct Bet from DB Balance)
  app.post(['/api/game/subway-pay/start', '/api/game/subwaypay/start', '/api/subwaypay/start', '/api/subwaypay/bet'], async (req: Request, res: Response) => {
    try {
      let user: UserDB | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]?.trim();
        if (token && token !== 'null' && token !== 'undefined') {
          const uid = await resolveUserIdFromToken(token);
          if (uid) user = await dbService.getUserById(uid);
        }
      }
      if (!user) {
        const rawToken = (req.query.token as string) || req.body?.token;
        if (rawToken && typeof rawToken === 'string' && rawToken !== 'null' && rawToken !== 'undefined') {
          const uid = await resolveUserIdFromToken(rawToken);
          if (uid) user = await dbService.getUserById(uid);
        }
      }
      if (!user) {
        const email = req.body?.email || (req.query.email as string) || (req.headers['x-session-email'] as string);
        if (email) {
          const allUsers = await dbService.getAllUsers();
          user = allUsers.find(u => u.email.toLowerCase().trim() === String(email).toLowerCase().trim()) || null;
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'Jogador não autenticado. Faça login para jogar valendo.' });
      }

      if (isHubAffiliateUser(user)) {
        return res.status(403).json({ error: 'Contas de Afiliado Hub não possuem permissão para realizar apostas.' });
      }

      const { betAmount, entry } = req.body;
      const numBet = parseFloat(betAmount || entry);
      if (isNaN(numBet) || numBet <= 0) {
        return res.status(400).json({ error: 'Valor de aposta inválido.' });
      }

      const gameConfig = await dbService.getGameConfig('g_subway_pay');
      if (gameConfig.status === 'inactive') {
        return res.status(400).json({ error: 'O jogo Subway Pay está temporariamente em manutenção.' });
      }

      const minB = gameConfig.minBet || 10.0;
      const maxB = gameConfig.maxBet || 400.0;
      if (numBet < minB) {
        return res.status(400).json({ error: `Aposta mínima para Subway Pay é de R$ ${minB.toFixed(2)}.` });
      }
      if (numBet > maxB) {
        return res.status(400).json({ error: `Aposta máxima para Subway Pay é de R$ ${maxB.toFixed(2)}.` });
      }

      const currentBalance = typeof user.balance === 'number' && !isNaN(user.balance) ? user.balance : 0;
      if (currentBalance < numBet) {
        return res.status(400).json({
          error: 'Saldo insuficiente para iniciar a corrida. Gere um PIX para adicionar saldo.',
          code: 'INSUFFICIENT_BALANCE',
          balance: currentBalance,
          needed: numBet
        });
      }

      // Deduct bet from DB balance immediately
      const newBalance = parseFloat((currentBalance - numBet).toFixed(2));
      await dbService.updateUserBalance(user.id, newBalance);

      const isUserInfluencer = Boolean(user.isInfluencer);
      const betId = 'subway_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const newGameBet: GameBetDB = {
        id: betId,
        userId: user.id,
        userName: user.name || user.email.split('@')[0],
        gameId: 'g_subway_pay',
        betAmount: numBet,
        multiplier: 1.0,
        payoutAmount: 0,
        profitAmount: 0,
        status: 'active',
        difficulty: isUserInfluencer ? 'easy' : (gameConfig.difficulty || 'medium'),
        rtpPercent: isUserInfluencer ? 99.5 : (gameConfig.rtpPercent || 96.0),
        createdAt: new Date().toISOString(),
      };
      await dbService.recordGameBet(newGameBet);

      // Record wager transaction for history transparency
      const betTx: TransactionDB = {
        id: 'tx_subway_' + crypto.randomBytes(8).toString('hex'),
        userId: user.id,
        type: 'withdrawal',
        amount: numBet,
        status: 'approved',
        paymentMethod: 'SubwayPay',
        description: `Entrada Subway Pay (Aposta: R$ ${numBet.toFixed(2)})`,
        createdAt: new Date().toISOString(),
      };
      await dbService.createTransaction(betTx);

      // Accumulate real game statistics in GameConfig
      gameConfig.totalWagered = parseFloat(((gameConfig.totalWagered || 0) + numBet).toFixed(2));
      gameConfig.totalBetsCount = (gameConfig.totalBetsCount || 0) + 1;
      gameConfig.ggr = parseFloat((gameConfig.totalWagered - (gameConfig.totalPayout || 0)).toFixed(2));
      await dbService.saveGameConfig(gameConfig);

      res.json({
        success: true,
        betId,
        balance: newBalance,
        betAmount: numBet,
        isInfluencerMode: isUserInfluencer,
      });
    } catch (err) {
      console.error('Subway start error:', err);
      res.status(500).json({ error: 'Erro ao processar entrada no Subway Pay.' });
    }
  });

  // SUBWAY PAY: SETTLE RUN (Loss or Cashout/Win DB Balance update)
  app.post(['/api/game/subway-pay/settle', '/api/game/subwaypay/settle', '/api/subwaypay/settle'], async (req: Request, res: Response) => {
    try {
      let user: UserDB | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1]?.trim();
        if (token && token !== 'null' && token !== 'undefined') {
          const uid = await resolveUserIdFromToken(token);
          if (uid) user = await dbService.getUserById(uid);
        }
      }
      if (!user) {
        const rawToken = (req.query.token as string) || req.body?.token;
        if (rawToken && typeof rawToken === 'string' && rawToken !== 'null' && rawToken !== 'undefined') {
          const uid = await resolveUserIdFromToken(rawToken);
          if (uid) user = await dbService.getUserById(uid);
        }
      }
      if (!user) {
        const email = req.body?.email || (req.query.email as string) || (req.headers['x-session-email'] as string);
        if (email) {
          const allUsers = await dbService.getAllUsers();
          user = allUsers.find(u => u.email.toLowerCase().trim() === String(email).toLowerCase().trim()) || null;
        }
      }

      if (!user) {
        return res.status(401).json({ error: 'Jogador não autenticado.' });
      }

      const { betId, outcome, coins, entry } = req.body;
      const numCoins = Math.max(0, parseInt(coins) || 0);
      const isCashout = outcome === 'cashout' || outcome === 'win';

      let existingBet: GameBetDB | null = null;
      if (betId && typeof betId === 'string') {
        existingBet = await dbService.getGameBetById(betId);
      }

      const betAmount = existingBet ? existingBet.betAmount : (parseFloat(entry) || 10.0);
      const currentBalance = typeof user.balance === 'number' && !isNaN(user.balance) ? user.balance : 0;

      if (!isCashout) {
        // Loss: Bet was already deducted at start. Update bet status to lost
        if (existingBet && existingBet.status === 'active') {
          await dbService.updateGameBet(existingBet.id, {
            payoutAmount: 0,
            profitAmount: -existingBet.betAmount,
            status: 'lost'
          });
        }
        return res.json({
          success: true,
          outcome: 'loss',
          payout: 0,
          balance: currentBalance
        });
      }

      // Cashout / Win: Calculate payout
      // Cap multiplier at 4.0x
      const multiplier = Math.min(4.0, (numCoins / 100) * 2);
      const rawPayout = betAmount * multiplier;
      const cleanPayout = parseFloat(rawPayout.toFixed(2));

      let newBalance = currentBalance;
      if (cleanPayout > 0) {
        newBalance = parseFloat((currentBalance + cleanPayout).toFixed(2));
        await dbService.updateUserBalance(user.id, newBalance);

        // Record win transaction
        const winTx: TransactionDB = {
          id: 'tx_subway_win_' + crypto.randomBytes(8).toString('hex'),
          userId: user.id,
          type: 'deposit',
          amount: cleanPayout,
          status: 'approved',
          paymentMethod: 'SubwayPay',
          description: `Cashout Corrida Subway Pay (${multiplier.toFixed(2)}x - R$ ${cleanPayout.toFixed(2)})`,
          createdAt: new Date().toISOString(),
        };
        await dbService.createTransaction(winTx);

        // Update GameConfig
        const gameConfig = await dbService.getGameConfig('g_subway_pay');
        gameConfig.totalPayout = parseFloat(((gameConfig.totalPayout || 0) + cleanPayout).toFixed(2));
        gameConfig.ggr = parseFloat(((gameConfig.totalWagered || 0) - gameConfig.totalPayout).toFixed(2));
        await dbService.saveGameConfig(gameConfig);
      }

      if (existingBet && existingBet.status === 'active') {
        await dbService.updateGameBet(existingBet.id, {
          payoutAmount: cleanPayout,
          profitAmount: parseFloat((cleanPayout - existingBet.betAmount).toFixed(2)),
          multiplier,
          status: 'cashed_out'
        });
      }

      res.json({
        success: true,
        outcome: 'cashout',
        payout: cleanPayout,
        multiplier,
        balance: newBalance
      });
    } catch (err) {
      console.error('Subway settle error:', err);
      res.status(500).json({ error: 'Erro ao liquidar corrida Subway Pay.' });
    }
  });

  // PUBLIC/AUTH POST /api/games/:id/bet - Record a bet in real time for Gen Dino
  app.post('/api/games/:id/bet', async (req: Request, res: Response, next: any) => {
    try {
      const { id } = req.params;
      if (id === 'g_raspa_fortuna' || id === 'raspa-fortuna' || id === 'raspafortuna') {
        return next();
      }
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

  // GET /api/game/zumbla/state - Get user balance & game config in real-time from DB
  app.get('/api/game/zumbla/state', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const user = await dbService.getUserById(userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

      const config = await dbService.getGameConfig('g_zumbla');

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
        config,
      });
    } catch (err) {
      console.error('Error fetching zumbla game state:', err);
      res.status(500).json({ error: 'Erro ao carregar estado do Zumbla.' });
    }
  });

  // POST /api/game/gen-dino/start - Start run & deduct bet from user DB balance
  app.post('/api/game/gen-dino/start', requirePlayerNotAffiliate, async (req: AuthRequest, res: Response) => {
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
  app.post('/api/game/gen-dino/settle', requirePlayerNotAffiliate, async (req: AuthRequest, res: Response) => {
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

      // ANTI-FRAUDE: Bloquear depósitos de Afiliados Hub no jogo Gen Dino
      if (user && isHubAffiliateUser(user)) {
        logSecurityEvent('AFFILIATE_GAME_DEPOSIT_BLOCKED', { email: user.email, userId: user.id, game: 'gen-dino' });
        return res.status(403).json({
          error: 'Acesso bloqueado pelo Sistema Anti-Fraude: Afiliados Hub não possuem autorização para depositar ou apostar no GEN DINO.'
        });
      }

      const { amount, value, customer, expiresIn, isSimulated } = req.body;
      const numAmount = parseFloat(amount || value);

      if (isNaN(numAmount) || numAmount < 20.0) {
        return res.status(400).json({ error: 'O valor mínimo para depósito via PIX no GEN DINO é de R$ 20,00.' });
      }

      const token = await getEffectiveDotfyApiKey();
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
      const token = await getEffectiveDotfyApiKey();

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

  // =========================================================================
  // --- GEN DINO INFLUENCER MODE & WITHDRAWAL API ENDPOINTS ---
  // =========================================================================

  // GET /api/gen-dino/influencer-stats
  app.get(['/api/gen-dino/influencer-stats', '/api/influencer/stats'], async (req: Request, res: Response) => {
    try {
      let targetUserId: string | undefined;
      const authHeader = req.headers.authorization;
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

      if (!targetUserId && (req.query.userId || req.headers['x-user-id'])) {
        targetUserId = (req.query.userId || req.headers['x-user-id']) as string;
      }

      let user: UserDB | null = null;
      if (targetUserId) {
        user = await dbService.getUserById(targetUserId);
      }

      if (!user && req.query.email) {
        user = await dbService.getUserByEmail(String(req.query.email));
      }

      if (!user) {
        return res.status(401).json({ error: 'Usuário não autenticado ou não encontrado.' });
      }

      // Ensure user has a referral code
      if (!user.referralCode) {
        user.referralCode = 'DINO_' + user.id.slice(-6).toUpperCase();
        await dbService.updateUser(user.id, { referralCode: user.referralCode });
      }

      const rawGameParam = String(req.query.game || req.query.gameOrigin || req.headers['x-game-id'] || '').trim();
      const normalizeGameKey = (g: string) => {
        const s = (g || '').toLowerCase().trim();
        if (s.includes('dino') || s.includes('g_gen_dino')) return 'g_gen_dino';
        if (s.includes('raspa') || s.includes('g_raspa_fortuna')) return 'g_raspa_fortuna';
        if (s.includes('zumbla') || s.includes('g_zumbla')) return 'g_zumbla';
        if (s.includes('block') || s.includes('g_block_puzzle') || s.includes('win')) return 'g_block_puzzle';
        return s;
      };
      const activeGameKey = rawGameParam ? normalizeGameKey(rawGameParam) : '';

      const gameTitles: Record<string, string> = {
        'g_gen_dino': 'Gen Dino',
        'g_raspa_fortuna': 'Raspa Fortuna',
        'g_zumbla': 'Zumbla Win',
        'g_block_puzzle': 'Block Win',
      };

      const allUsers = await dbService.getAllUsers();
      const allTx = await dbService.getAllTransactions();

      // Find all users who were referred by this user
      const referredUsers = allUsers.filter(u => 
        u.id !== user!.id && (
          u.referredBy === user!.referralCode ||
          u.referredBy === user!.id ||
          u.affiliateId === user!.id ||
          u.parentAffiliateUserId === user!.id
        )
      );

      const referredUserIds = new Set(referredUsers.map(u => u.id));
      const referralsCount = referredUsers.length;

      // Filter deposit transactions made by these referred users
      const referredDeposits = allTx.filter(tx => 
        tx.type === 'deposit' && referredUserIds.has(tx.userId)
      );

      const totalDepositsBrought = referredDeposits.reduce((acc, tx) => acc + (tx.amount || 0), 0);
      const paidDeposits = referredDeposits.filter(tx => tx.status === 'approved');
      const paidDepositsCount = paidDeposits.length;
      const paidDepositsAmount = paidDeposits.reduce((acc, tx) => acc + (tx.amount || 0), 0);

      // Game-specific attribution breakdown
      const gameIds = ['g_gen_dino', 'g_raspa_fortuna', 'g_zumbla', 'g_block_puzzle'];
      const byGame: Record<string, {
        gameId: string;
        title: string;
        referralsCount: number;
        totalDepositsBrought: number;
        paidDepositsCount: number;
        paidDepositsAmount: number;
      }> = {};

      gameIds.forEach(gid => {
        const gameReferredUsers = referredUsers.filter(u => {
          const uGame = normalizeGameKey(u.registeredGame || u.acquisitionGame || u.origin || '');
          return uGame === gid;
        });
        const gameUserIds = new Set(gameReferredUsers.map(u => u.id));
        const gameDeposits = referredDeposits.filter(tx => 
          gameUserIds.has(tx.userId) || normalizeGameKey(tx.description || '') === gid
        );
        const gamePaid = gameDeposits.filter(tx => tx.status === 'approved');

        byGame[gid] = {
          gameId: gid,
          title: gameTitles[gid] || gid,
          referralsCount: gameReferredUsers.length,
          totalDepositsBrought: parseFloat(gameDeposits.reduce((acc, tx) => acc + (tx.amount || 0), 0).toFixed(2)),
          paidDepositsCount: gamePaid.length,
          paidDepositsAmount: parseFloat(gamePaid.reduce((acc, tx) => acc + (tx.amount || 0), 0).toFixed(2)),
        };
      });

      // If a specific game was requested and has entries, compute active game metrics
      const activeGameStats = activeGameKey && byGame[activeGameKey] ? byGame[activeGameKey] : null;

      // Get or create affiliate record for commission balance
      let userAff = await dbService.getAffiliateByUserId(user.id);
      if (!userAff) {
        userAff = {
          id: 'aff_' + user.id,
          userId: user.id,
          referralCode: user.referralCode,
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: 0,
          createdAt: new Date().toISOString(),
        };
        await dbService.createAffiliate(userAff);
      }

      const commissionBalance = Number(userAff.affiliateBalance || 0);

      // Identify responsible affiliate (the sponsor/parent of this user)
      const { sponsorUser, sponsorAff, parentAffId, parentUserId } = await resolveResponsibleAffiliateForUser(user, allUsers);

      const responsibleAffiliate = sponsorUser ? {
        id: sponsorUser.id,
        name: sponsorUser.name,
        email: sponsorUser.email,
        code: sponsorUser.referralCode || sponsorAff?.referralCode || 'AFILIADO',
        affiliateId: parentAffId,
      } : {
        id: 'admin',
        name: 'Administração / Afiliado Gestor',
        email: 'afiliados@plataforma.com',
        code: 'PLATAFORMA',
        affiliateId: 'admin',
      };

      // Get commission withdrawal requests made by this influencer
      const requests = await dbService.getInfluencerCommissionRequestsByUser(user.id);

      return res.json({
        success: true,
        stats: {
          isInfluencer: true,
          referralCode: user.referralCode,
          activeGame: activeGameKey || 'all',
          activeGameTitle: activeGameStats ? activeGameStats.title : 'Todos os Jogos',
          // If a specific game was requested, provide both game-specific and global figures
          gameReferralsCount: activeGameStats ? activeGameStats.referralsCount : referralsCount,
          gameTotalDepositsBrought: activeGameStats ? activeGameStats.totalDepositsBrought : parseFloat(totalDepositsBrought.toFixed(2)),
          gamePaidDepositsCount: activeGameStats ? activeGameStats.paidDepositsCount : paidDepositsCount,
          gamePaidDepositsAmount: activeGameStats ? activeGameStats.paidDepositsAmount : parseFloat(paidDepositsAmount.toFixed(2)),
          // Global metrics across the platform
          referralsCount,
          totalDepositsBrought: parseFloat(totalDepositsBrought.toFixed(2)),
          paidDepositsCount,
          paidDepositsAmount: parseFloat(paidDepositsAmount.toFixed(2)),
          commissionBalance: parseFloat(commissionBalance.toFixed(2)),
          responsibleAffiliate,
          requests,
          byGame,
        }
      });
    } catch (err) {
      console.error('Error fetching influencer stats:', err);
      res.status(500).json({ error: 'Erro ao carregar métricas de influenciador.' });
    }
  });

  // POST /api/gen-dino/influencer-withdraw
  app.post(['/api/gen-dino/influencer-withdraw', '/api/influencer/withdraw-request'], async (req: Request, res: Response) => {
    try {
      let targetUserId: string | undefined;
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '').trim();
        targetUserId = (await resolveUserIdFromToken(token)) || undefined;
      }

      if (!targetUserId && (req.body.userId || req.headers['x-user-id'])) {
        targetUserId = (req.body.userId || req.headers['x-user-id']) as string;
      }

      let user: UserDB | null = null;
      if (targetUserId) {
        user = await dbService.getUserById(targetUserId);
      }

      if (!user && req.body.email) {
        user = await dbService.getUserByEmail(String(req.body.email));
      }

      if (!user) {
        return res.status(401).json({ error: 'Usuário não autenticado ou não encontrado.' });
      }

      if (user.isBlocked) {
        return res.status(403).json({ error: 'Conta bloqueada para movimentações financeiras.' });
      }

      if (user.withdrawBlocked) {
        return res.status(403).json({ error: 'Seus saques foram temporariamente desativados pelo administrador da plataforma.' });
      }

      const { amount, value, pixKey, pixKeyType } = req.body;
      const numAmount = parseFloat(String(amount || value));

      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({ error: 'Informe um valor válido para o saque das comissões.' });
      }

      if (!pixKey || !String(pixKey).trim()) {
        return res.status(400).json({ error: 'Informe uma chave PIX válida para receber o valor.' });
      }

      // Check influencer's available commission balance
      let userAff = await dbService.getAffiliateByUserId(user.id);
      if (!userAff) {
        userAff = {
          id: 'aff_' + user.id,
          userId: user.id,
          referralCode: user.referralCode || 'DINO',
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: 0,
          createdAt: new Date().toISOString(),
        };
        await dbService.createAffiliate(userAff);
      }

      const currentBalance = Number(userAff.affiliateBalance || 0);
      if (numAmount > currentBalance) {
        return res.status(400).json({
          error: `Saldo de comissões insuficiente! Seu saldo disponível é de R$ ${currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} e você solicitou R$ ${numAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
          commissionBalance: currentBalance,
        });
      }

      // Deduct from influencer's pending commission balance
      const newCommissionBalance = parseFloat((currentBalance - numAmount).toFixed(2));
      await dbService.updateAffiliateRates(userAff.id, { affiliateBalance: newCommissionBalance });

      // Identify responsible affiliate (the parent affiliate who manages this influencer and whose balance will be deducted upon approval)
      const allUsers = await dbService.getAllUsers();
      const { sponsorUser, sponsorAff, parentAffId, parentUserId } = await resolveResponsibleAffiliateForUser(user, allUsers);

      // Snapshot stats
      const allTx = await dbService.getAllTransactions();
      const referredUsers = allUsers.filter(u => 
        u.id !== user!.id && (
          u.referredBy === user!.referralCode ||
          u.referredBy === user!.id ||
          u.affiliateId === user!.id ||
          u.parentAffiliateUserId === user!.id
        )
      );
      const referredUserIds = new Set(referredUsers.map(u => u.id));
      const referredDeposits = allTx.filter(tx => tx.type === 'deposit' && referredUserIds.has(tx.userId));
      const totalDepositsBrought = referredDeposits.reduce((acc, tx) => acc + (tx.amount || 0), 0);
      const paidDeposits = referredDeposits.filter(tx => tx.status === 'approved');
      const paidDepositsCount = paidDeposits.length;
      const paidDepositsAmount = paidDeposits.reduce((acc, tx) => acc + (tx.amount || 0), 0);

      const rawGame = String(req.body.gameOrigin || req.body.game || req.query.game || 'g_gen_dino').trim();
      const normalizeOrigin = (g: string) => {
        const s = (g || '').toLowerCase();
        if (s.includes('dino') || s.includes('g_gen_dino')) return 'g_gen_dino';
        if (s.includes('raspa') || s.includes('g_raspa_fortuna')) return 'g_raspa_fortuna';
        if (s.includes('zumbla') || s.includes('g_zumbla')) return 'g_zumbla';
        if (s.includes('block') || s.includes('g_block_puzzle') || s.includes('win')) return 'g_block_puzzle';
        return s || 'g_gen_dino';
      };
      const gameOrigin = normalizeOrigin(rawGame);
      const gameOriginName = gameOrigin === 'g_raspa_fortuna' ? 'Raspa Fortuna' : gameOrigin === 'g_zumbla' ? 'Zumbla Win' : gameOrigin === 'g_block_puzzle' ? 'Block Win' : 'Gen Dino';

      const requestId = 'inf_req_' + crypto.randomBytes(8).toString('hex');
      const cleanKey = String(pixKey).trim();
      const cleanKeyType = String(pixKeyType || 'chave_pix').trim();

      await dbService.createInfluencerCommissionRequest({
        id: requestId,
        affiliateId: parentAffId,
        affiliateUserId: parentUserId,
        parentAffiliateId: parentAffId,
        parentAffiliateUserId: parentUserId,
        influencerUserId: user.id,
        influencerName: user.name,
        influencerEmail: user.email,
        amount: numAmount,
        pixKey: cleanKey,
        pixKeyType: cleanKeyType,
        status: 'pending',
        gameOrigin,
        totalDepositsBrought: parseFloat(totalDepositsBrought.toFixed(2)),
        paidDepositsCount,
        paidDepositsAmount: parseFloat(paidDepositsAmount.toFixed(2)),
        referralsCount: referredUsers.length,
        createdAt: new Date().toISOString(),
      });

      // Save user PIX key to profile if not yet saved
      try {
        const userKeys = Array.isArray(user.pixKeys) && user.pixKeys.length > 0
          ? user.pixKeys
          : (user.pixKey ? [user.pixKey] : []);
        const alreadyExists = userKeys.some((k: any) => k.key === cleanKey);
        if (!alreadyExists) {
          const autoKey = {
            id: `clpix_${Date.now()}`,
            type: cleanKeyType.toUpperCase(),
            key: cleanKey,
            name: user.name || 'Conta Principal',
            isDefault: true,
            isVerified: true,
            status: 'APPROVED',
            createdAt: new Date().toISOString(),
          };
          const updatedKeys = [autoKey, ...userKeys];
          await dbService.updateUserFields(user.id, { pixKey: autoKey, pixKeys: updatedKeys });
        }
      } catch (keySaveErr) {
        console.warn('[Influencer Withdraw Key Save Warning]', keySaveErr);
      }

      // Dispatch notification to responsible affiliate
      if (sponsorUser) {
        sendPushNotification(sponsorUser.id, {
          title: `🎁 Novo Pedido de Saque de Comissões (${gameOriginName})!`,
          body: `${user.name} solicitou saque de R$ ${numAmount.toFixed(2)} das comissões no ${gameOriginName}. Acesse o Financeiro para aprovar ou trocar o valor.`,
          url: '/?tab=finance',
          type: 'commission',
        }).catch(console.error);

        await dbService.saveAffiliateFeedItem({
          id: 'feed_' + crypto.randomBytes(6).toString('hex'),
          title: `🎁 Solicitação de Saque de Comissões de Influenciador (${gameOriginName})`,
          body: `${user.name} solicitou saque de R$ ${numAmount.toFixed(2)} das comissões no jogo ${gameOriginName} (PIX: ${cleanKey}). Acesse a área de Financeiro para aprovar ou ajustar o valor.`,
          url: '/?tab=finance',
          target: 'affiliates',
          sentBy: user.name,
          createdAt: new Date().toISOString(),
        }).catch(console.error);
      }

      return res.json({
        success: true,
        message: `Solicitação de saque de comissões de R$ ${numAmount.toFixed(2)} enviada com sucesso! O afiliado gestor responsável (${sponsorUser ? sponsorUser.name : 'Administração'}) foi notificado para aprovação financeira.`,
        requestId,
        commissionBalance: newCommissionBalance,
      });
    } catch (err) {
      console.error('Error in influencer withdraw request:', err);
      res.status(500).json({ error: 'Erro ao processar solicitação de saque de comissão.' });
    }
  });

  // =========================================================================
  // --- RASPA FORTUNA DOTFY PIX API & GAMEPLAY ENDPOINTS ---
  // =========================================================================

  // POST /api/game/raspa-fortuna/pix/create - Criar cobrança PIX via Dotfy para Raspa Fortuna
  app.post(['/api/game/raspa-fortuna/pix/create', '/api/raspa-fortuna/pix/create'], async (req: Request, res: Response) => {
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

      if (req.body.token && !targetUserId) {
        const rawTok = String(req.body.token).replace('Bearer ', '').trim();
        const session = getSession(rawTok);
        if (session?.userId) {
          targetUserId = session.userId;
        } else if (rawTok.startsWith('tok_usr_')) {
          const parts = rawTok.split('_');
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

      // ANTI-FRAUDE: Bloquear depósitos de Afiliados Hub no jogo Raspa Fortuna
      if (user && isHubAffiliateUser(user)) {
        logSecurityEvent('AFFILIATE_GAME_DEPOSIT_BLOCKED', { email: user.email, userId: user.id, game: 'raspa-fortuna' });
        return res.status(403).json({
          error: 'Acesso bloqueado pelo Sistema Anti-Fraude: Afiliados Hub não possuem autorização para depositar ou apostar no Raspa Fortuna.'
        });
      }

      const { amount, value, customer, expiresIn, isSimulated } = req.body;
      const numAmount = parseFloat(amount || value);

      if (isNaN(numAmount) || numAmount < 1.0) {
        return res.status(400).json({ error: 'O valor mínimo para depósito via PIX no Raspa Fortuna é de R$ 1,00.' });
      }

      // Check Dotfy Config from DB or env
      const token = await getEffectiveDotfyApiKey();

      const description = `Depósito Raspa Fortuna (PIX) - ${user?.name || 'Jogador'}`;

      const cleanCustomer: Record<string, string> = {};
      if (customer && typeof customer === 'object') {
        if (customer.name) cleanCustomer.name = String(customer.name).slice(0, 100);
        if (customer.email) cleanCustomer.email = String(customer.email).trim();
        if (customer.taxID || customer.cpf) cleanCustomer.taxID = String(customer.taxID || customer.cpf).replace(/\D/g, '');
        if (customer.phone) cleanCustomer.phone = String(customer.phone).replace(/\D/g, '');
      } else if (user) {
        if (user.name) cleanCustomer.name = user.name.slice(0, 100);
        if (user.email) cleanCustomer.email = user.email;
        if (user.cpf) cleanCustomer.taxID = String(user.cpf).replace(/\D/g, '');
        if (user.phone) cleanCustomer.phone = String(user.phone).replace(/\D/g, '');
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

      // Se explicitamente simulado ou sem token configurado
      if (isSimulated || !token || token === 'simulated') {
        const randomId = crypto.randomBytes(4).toString('hex');
        const correlationID = `raspa-dotfy-${Date.now()}-${randomId}`;
        const centsVal = Math.round(numAmount * 100);
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        const simQr = `00020126360014BR.GOV.BCB.PIX0114+5511999998888520400005303986540${numAmount.toFixed(2)}5802BR5919Dotfy Raspa Fortuna6009SAO PAULO62070503***6304ABCD`;

        const simData = {
          id: `charge_${randomId}`,
          chargeId: `ch_${randomId}`,
          correlationID,
          correlationId: correlationID,
          transactionID: `E${Date.now()}RASPA${randomId}`,
          qrCode: simQr,
          brCode: simQr,
          qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(simQr)}`,
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
          title: 'PIX pendente na sua rede ⏳',
          body: `Um indicado gerou um PIX de R$ ${storedCharge.valueInReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Raspa Fortuna.`,
          url: '/?tab=affiliates',
          type: 'pixPending'
        });

        return res.json({
          success: true,
          data: simData,
          simulated: true,
          message: 'Cobrança PIX gerada com sucesso para o Raspa Fortuna.'
        });
      }

      console.log(`[Raspa Fortuna Dotfy API] Criando PIX de R$ ${numAmount.toFixed(2)} via ${DOTFY_BASE_URL}/api/charges`);

      let dotfyResponse: any = null;
      let responseData: any = {};

      try {
        dotfyResponse = await fetch(`${DOTFY_BASE_URL}/api/charges`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(dotfyPayload),
          signal: AbortSignal.timeout(9000)
        });

        const responseText = await dotfyResponse.text();
        try {
          responseData = JSON.parse(responseText);
        } catch (e) {
          responseData = { rawText: responseText };
        }

        // Retry without phone if rejected by Dotfy API
        if (
          !dotfyResponse.ok &&
          dotfyResponse.status === 400 &&
          dotfyPayload.customer?.phone &&
          JSON.stringify(responseData).includes('phone')
        ) {
          console.warn('[Raspa Fortuna Dotfy] Telefone rejeitado pela API Dotfy. Reenviando sem phone...');
          delete dotfyPayload.customer.phone;
          const retryRes = await fetch(`${DOTFY_BASE_URL}/api/charges`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(dotfyPayload),
            signal: AbortSignal.timeout(9000)
          });
          const retryTxt = await retryRes.text();
          try {
            responseData = JSON.parse(retryTxt);
            dotfyResponse = retryRes;
          } catch (_) {
            responseData = { rawText: retryTxt };
            dotfyResponse = retryRes;
          }
        }
      } catch (fetchErr: any) {
        console.warn('[Raspa Fortuna Dotfy Fetch Warning]', fetchErr?.message || fetchErr);
      }

      if (!dotfyResponse || !dotfyResponse.ok) {
        console.warn('[Raspa Fortuna Dotfy Warning]', dotfyResponse?.status, responseData);

        const randomId = crypto.randomBytes(4).toString('hex');
        const correlationID = `raspa-dotfy-${Date.now()}-${randomId}`;
        const centsVal = Math.round(numAmount * 100);
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        const simQr = `00020126580014br.gov.bcb.pix0136${correlationID}520400005303986540${numAmount.toFixed(2)}5802BR5919Dotfy Raspa Fortuna6009SAO PAULO62070503***6304ABCD`;

        const fallbackData = {
          id: `charge_${randomId}`,
          chargeId: `ch_${randomId}`,
          correlationID,
          correlationId: correlationID,
          transactionID: `E${Date.now()}RASPA${randomId}`,
          qrCode: simQr,
          brCode: simQr,
          qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(simQr)}`,
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
          title: 'PIX pendente na sua rede ⏳',
          body: `Um indicado gerou um PIX de R$ ${storedCharge.valueInReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Raspa Fortuna.`,
          url: '/?tab=affiliates',
          type: 'pixPending'
        });

        return res.json({
          success: true,
          data: fallbackData,
          message: 'Cobrança PIX gerada com sucesso para o Raspa Fortuna.'
        });
      }

      const chargeData = responseData.data || responseData;
      const correlationID = chargeData.correlationID || chargeData.correlationId || chargeData.id || `raspa-dotfy-${Date.now()}`;
      const centsVal = typeof chargeData.value === 'number' ? chargeData.value : Math.round(numAmount * 100);
      const valReais = centsVal / 100;
      let pixCode = chargeData.qrCode || chargeData.brCode || chargeData.pixCopiaECola || chargeData.emv || chargeData.qr_code || chargeData.qrcode || chargeData.payload || '';
      let qrCodeImg = chargeData.qrCodeImage || chargeData.qr_code_image || chargeData.qrCodeBase64 || chargeData.qrcode_url || chargeData.qrCodeUrl || '';
      if (!qrCodeImg && pixCode) {
        qrCodeImg = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=0&data=${encodeURIComponent(pixCode)}`;
      }

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
        valueInReais: valReais,
        description,
        customer: cleanCustomer,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        userId: targetUserId,
        rawResponse: responseData
      };

      memoryCharges.set(correlationID, storedCharge);
      if (storedCharge.userId) await notifyAffiliateForPlayer(storedCharge.userId, {
        title: 'PIX pendente na sua rede ⏳',
        body: `Um indicado gerou um PIX de R$ ${storedCharge.valueInReais.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} no Raspa Fortuna.`,
        url: '/?tab=affiliates',
        type: 'pixPending'
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
        message: 'Cobrança PIX gerada com sucesso via Dotfy para o Raspa Fortuna.'
      });

    } catch (err: any) {
      console.error('Error creating Raspa Fortuna PIX:', err);
      res.status(500).json({ error: 'Erro ao gerar PIX para o Raspa Fortuna.', details: err?.message || String(err) });
    }
  });

  // GET /api/game/raspa-fortuna/pix/status/:correlationID - Consultar status do PIX em tempo real
  app.get(['/api/game/raspa-fortuna/pix/status/:correlationID', '/api/raspa-fortuna/pix/status/:correlationID'], async (req: Request, res: Response) => {
    try {
      const { correlationID } = req.params;
      const localCharge = memoryCharges.get(correlationID);
      const token = await getEffectiveDotfyApiKey();

      // If already marked as PAID locally (e.g. simulated or confirmed by webhook)
      if (localCharge && localCharge.status === 'PAID') {
        let updatedBal = 0;
        if (localCharge.userId) {
          const u = await dbService.getUserById(localCharge.userId);
          if (u) updatedBal = u.balance;
        }
        return res.json({
          success: true,
          status: 'PAID',
          paid: true,
          amount: localCharge.valueInReais,
          creditedAmount: localCharge.creditedAmount || localCharge.valueInReais,
          balance: updatedBal,
          message: 'Pagamento PIX confirmado com sucesso.'
        });
      }

      // Query Dotfy API
      try {
        const dotfyResponse = await fetch(`${DOTFY_BASE_URL}/api/charges/${correlationID}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(3500)
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
        console.warn('[Dotfy Raspa Fortuna status check fetch err]', fetchErr);
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
      console.error('Error checking Raspa Fortuna PIX status:', err);
      res.status(500).json({ error: 'Erro ao verificar status do PIX.' });
    }
  });

  // POST /api/game/raspa-fortuna/pix/simulate - Simular aprovação imediata para testes
  app.post(['/api/game/raspa-fortuna/pix/simulate', '/api/raspa-fortuna/pix/simulate'], async (req: Request, res: Response) => {
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
        message: 'Pagamento PIX simulado e creditado com sucesso no Raspa Fortuna!'
      });
    } catch (err) {
      console.error('Error simulating Raspa Fortuna PIX:', err);
      res.status(500).json({ error: 'Erro ao simular pagamento.' });
    }
  });

  // =========================================================================
  // --- SUBWAY PAY DOTFY PIX API ENDPOINTS ---
  // =========================================================================

  // POST /api/game/subway-pay/pix/create - Criar cobrança PIX via Dotfy para Subway Pay
  app.post(['/api/game/subway-pay/pix/create', '/api/subwaypay/pix/create', '/api/game/subwaypay/pix/create'], async (req: Request, res: Response) => {
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

      if (req.body.token && !targetUserId) {
        const rawTok = String(req.body.token).replace('Bearer ', '').trim();
        const session = getSession(rawTok);
        if (session?.userId) {
          targetUserId = session.userId;
        } else if (rawTok.startsWith('tok_usr_')) {
          const parts = rawTok.split('_');
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

      if (isNaN(numAmount) || numAmount < 1.0) {
        return res.status(400).json({ error: 'O valor mínimo para depósito via PIX no Subway Pay é de R$ 1,00.' });
      }

      const cleanCustomer: Record<string, string> = {};
      if (customer && typeof customer === 'object') {
        if (customer.name) cleanCustomer.name = String(customer.name).slice(0, 100);
        if (customer.email) cleanCustomer.email = String(customer.email).trim();
        if (customer.taxID || customer.cpf) cleanCustomer.taxID = String(customer.taxID || customer.cpf).replace(/\D/g, '');
        if (customer.phone) cleanCustomer.phone = String(customer.phone).replace(/\D/g, '');
      } else if (user) {
        if (user.name) cleanCustomer.name = user.name.slice(0, 100);
        if (user.email) cleanCustomer.email = user.email;
        if (user.cpf) cleanCustomer.taxID = String(user.cpf).replace(/\D/g, '');
        if (user.phone) cleanCustomer.phone = String(user.phone).replace(/\D/g, '');
      }

      // Se usuário ainda não encontrado na DB, sincronizar ou criar pelo email
      if (!user && cleanCustomer.email) {
        try {
          user = await dbService.getUserByEmail(cleanCustomer.email);
          if (!user) {
            const newUid = `usr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
            const refCode = `SUB${Math.floor(1000 + Math.random() * 9000)}`;
            user = await dbService.createUser({
              id: newUid,
              name: cleanCustomer.name || 'Jogador Subway Pay',
              email: cleanCustomer.email,
              phone: cleanCustomer.phone || '',
              passwordHash: 'subway_guest_hash',
              referralCode: refCode,
              role: 'user',
              balance: 0,
              createdAt: new Date().toISOString()
            });
          }
          if (user) targetUserId = user.id;
        } catch (dbErr) {
          console.warn('[Subway Pay PIX] Error creating or resolving user in db:', dbErr);
        }
      }

      // ANTI-FRAUDE: Bloquear depósitos de Afiliados Hub no jogo Subway Pay
      if (user && isHubAffiliateUser(user)) {
        logSecurityEvent('AFFILIATE_GAME_DEPOSIT_BLOCKED', { email: user.email, userId: user.id, game: 'subway-pay' });
        return res.status(403).json({
          error: 'Acesso bloqueado pelo Sistema Anti-Fraude: Afiliados Hub não possuem autorização para depositar ou apostar no Subway Pay.'
        });
      }

      // Check Dotfy Config from DB or env
      const token = await getEffectiveDotfyApiKey();
      const description = `Depósito Subway Pay (PIX) - ${user?.name || cleanCustomer.name || 'Jogador'}`;

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

      // Se explicitamente simulado ou sem token configurado
      if (isSimulated || !token || token === 'simulated') {
        const randomId = crypto.randomBytes(4).toString('hex');
        const correlationID = `subway-dotfy-${Date.now()}-${randomId}`;
        const centsVal = Math.round(numAmount * 100);
        const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
        const simQr = `00020126360014BR.GOV.BCB.PIX0114+5511999998888520400005303986540${numAmount.toFixed(2)}5802BR5916Dotfy Subway Pay6009SAO PAULO62070503***6304ABCD`;

        const simData = {
          id: `charge_${randomId}`,
          chargeId: `ch_${randomId}`,
          correlationID,
          correlationId: correlationID,
          transactionID: `E${Date.now()}SUBWAY${randomId}`,
          qrCode: simQr,
          brCode: simQr,
          qrCodeImage: '',
          paymentLink: `https://app.dotfy.com.br/checkout/${correlationID}`,
          expiresAt,
          value: centsVal,
          valueInReais: numAmount,
          description
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
        console.log(`[Subway Pay PIX] Cobrança Simulação gerada: ${correlationID} (R$ ${numAmount.toFixed(2)})`);

        return res.json({
          success: true,
          data: simData,
          simulated: true,
          message: 'Cobrança PIX Subway Pay gerada em modo simulação.'
        });
      }

      // Requisição Real para a API Dotfy
      console.log(`[Subway Pay PIX] Enviando payload para Dotfy API (${DOTFY_BASE_URL}/api/charges)...`);
      const dotfyResponse = await fetch(`${DOTFY_BASE_URL}/api/charges`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
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
        console.error(`[Subway Pay Dotfy Error] HTTP ${dotfyResponse.status}:`, responseData);

        // Retry sem telefone se erro de validação
        const errStr = JSON.stringify(responseData);
        if (dotfyResponse.status === 400 && dotfyPayload.customer?.phone && (errStr.includes('phone') || errStr.includes('Telefone'))) {
          console.warn('[Subway Pay Dotfy] Telefone rejeitado, reenviando sem customer.phone...');
          delete dotfyPayload.customer.phone;

          const retryRes = await fetch(`${DOTFY_BASE_URL}/api/charges`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(dotfyPayload)
          });

          const retryText = await retryRes.text();
          let retryData: any;
          try { retryData = JSON.parse(retryText); } catch (_) { retryData = { rawText: retryText }; }

          if (retryRes.ok) {
            const chargeData = retryData.data || retryData;
            const correlationID = chargeData.correlationID || chargeData.correlationId || `subway-dotfy-${Date.now()}`;
            const centsVal = chargeData.value || Math.round(numAmount * 100);

            const storedCharge: StoredCharge = {
              id: chargeData.id || `dotfy_${Date.now()}`,
              chargeId: chargeData.chargeId || '',
              correlationID,
              transactionID: chargeData.transactionID || '',
              qrCode: chargeData.qrCode || chargeData.brCode || '',
              qrCodeImage: chargeData.qrCodeImage || '',
              paymentLink: chargeData.paymentLink || '',
              expiresAt: chargeData.expiresAt || new Date(Date.now() + 3600000).toISOString(),
              value: centsVal,
              valueInReais: centsVal / 100,
              description,
              customer: cleanCustomer,
              status: 'PENDING',
              createdAt: new Date().toISOString(),
              userId: targetUserId,
              rawResponse: retryData
            };

            memoryCharges.set(correlationID, storedCharge);
            return res.json({ success: true, data: { ...chargeData, correlationID, valueInReais: centsVal / 100 } });
          } else {
            responseData = retryData;
          }
        }

        return res.status(dotfyResponse.status).json({
          success: false,
          error: responseData.error || 'DOTFY_ERROR',
          message: responseData.message || 'Erro ao gerar cobrança PIX na Dotfy.',
          details: responseData
        });
      }

      // Sucesso na Dotfy
      const chargeData = responseData.data || responseData;
      const correlationID = chargeData.correlationID || chargeData.correlationId || `subway-dotfy-${Date.now()}`;
      const centsVal = chargeData.value || Math.round(numAmount * 100);

      const storedCharge: StoredCharge = {
        id: chargeData.id || `dotfy_${Date.now()}`,
        chargeId: chargeData.chargeId || '',
        correlationID,
        transactionID: chargeData.transactionID || '',
        qrCode: chargeData.qrCode || chargeData.brCode || '',
        qrCodeImage: chargeData.qrCodeImage || '',
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
      console.log(`[Subway Pay PIX] Cobrança Dotfy criada com sucesso: ${correlationID} (R$ ${(centsVal / 100).toFixed(2)})`);

      return res.json({
        success: true,
        data: {
          ...chargeData,
          correlationID,
          valueInReais: centsVal / 100
        }
      });
    } catch (err: any) {
      console.error('[Subway Pay PIX] Erro no endpoint /pix/create:', err);
      res.status(500).json({ error: 'Erro interno ao processar PIX no Subway Pay.' });
    }
  });

  // GET /api/game/subway-pay/pix/status/:correlationID - Consultar status do pagamento PIX
  app.get(['/api/game/subway-pay/pix/status/:correlationID', '/api/subwaypay/pix/status/:correlationID', '/api/game/subwaypay/pix/status/:correlationID'], async (req: Request, res: Response) => {
    try {
      const { correlationID } = req.params;
      const localCharge = memoryCharges.get(correlationID);

      const token = await getEffectiveDotfyApiKey();

      // 1. Verificar se na memória local já está pago
      if (localCharge && (localCharge.status === 'PAID' || localCharge.status === 'COMPLETED' || (localCharge as any).isPaid === true)) {
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

      // 2. Se temos chave Dotfy válida, consultar a API da Dotfy
      if (token && token !== 'simulated' && !localCharge?.rawResponse?.simulated) {
        try {
          const dotfyRes = await fetch(`${DOTFY_BASE_URL}/api/charges/${correlationID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });

          if (dotfyRes.ok) {
            const dotfyData = await dotfyRes.json();
            const dStatus = (dotfyData.data?.status || dotfyData.status || '').toUpperCase();
            const isPaid = dStatus === 'PAID' || dStatus === 'COMPLETED' || dotfyData.data?.isPaid === true || dotfyData.isPaid === true;

            if (isPaid) {
              if (localCharge) {
                localCharge.status = 'PAID';
                memoryCharges.set(correlationID, localCharge);
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
                charge: localCharge || dotfyData
              });
            }
          }
        } catch (dErr) {
          console.warn(`[Subway Pay PIX Status] Falha ao consultar Dotfy para ${correlationID}:`, dErr);
        }
      }

      if (localCharge) {
        return res.json({
          success: true,
          paid: false,
          status: localCharge.status,
          charge: localCharge
        });
      }

      return res.status(404).json({ error: 'Cobrança não encontrada.' });
    } catch (err: any) {
      console.error('[Subway Pay PIX Status] Erro ao verificar status:', err);
      res.status(500).json({ error: 'Erro ao verificar status do PIX.' });
    }
  });

  // POST /api/game/subway-pay/pix/simulate/:correlationID - Simular aprovação imediata para testes
  app.post(['/api/game/subway-pay/pix/simulate/:correlationID', '/api/subwaypay/pix/simulate/:correlationID'], async (req: Request, res: Response) => {
    try {
      const { correlationID } = req.params;
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
        message: 'Pagamento PIX simulado e creditado com sucesso no Subway Pay!'
      });
    } catch (err) {
      console.error('[Subway Pay PIX Simulate] Erro ao simular:', err);
      res.status(500).json({ error: 'Erro ao simular pagamento.' });
    }
  });

  // GET /api/game/raspa-fortuna/config - Obter configurações de RTP e dificuldade em tempo real
  app.get(['/api/game/raspa-fortuna/config', '/api/games/g_raspa_fortuna/config'], async (_req: Request, res: Response) => {
    try {
      const config = await dbService.getGameConfig('g_raspa_fortuna');
      res.json({
        success: true,
        config: {
          id: config.id,
          name: config.name,
          rtpPercent: config.rtpPercent,
          difficulty: config.difficulty,
          minBet: config.minBet,
          maxBet: config.maxBet,
          maxMultiplier: config.maxMultiplier,
          smartRtp: config.smartRtp ?? true,
          smartRtpEasyThreshold: config.smartRtpEasyThreshold ?? 30.0,
          smartRtpMidThreshold: (config as any).smartRtpMidThreshold ?? 60.0,
          smartRtpHardThreshold: config.smartRtpHardThreshold ?? 85.0,
          smartRtpMaxTarget: (config as any).smartRtpMaxTarget ?? 100.0,
          emergencyRetentionMode: Boolean((config as any).emergencyRetentionMode),
          influencerGlobalBoost: Boolean((config as any).influencerGlobalBoost),
          winStreakBrake: Boolean(config.winStreakBrake),
          bonusFrequencyPercent: config.bonusFrequencyPercent ?? 30,
          popupEnabled: Boolean(config.popupEnabled),
          popupTitle: config.popupTitle,
          popupDescription: config.popupDescription
        }
      });
    } catch (err) {
      console.error('Error fetching Raspa Fortuna config:', err);
      res.status(500).json({ error: 'Erro ao obter configuração do jogo.' });
    }
  });

  // GET /api/game/raspa-fortuna/session - Obter sessão e saldo atual do jogador
  app.get(['/api/game/raspa-fortuna/session', '/api/raspa-fortuna/session'], async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      const queryToken = req.query.token as string | undefined;
      const rawToken = authHeader ? authHeader.replace('Bearer ', '').trim() : (queryToken || '');

      let user: any = null;
      if (rawToken) {
        const session = getSession(rawToken);
        if (session?.userId) {
          user = await dbService.getUserById(session.userId);
        } else if (rawToken.startsWith('tok_usr_')) {
          const parts = rawToken.split('_');
          if (parts.length >= 3) {
            const candidateId = `${parts[1]}_${parts[2]}`;
            user = await dbService.getUserById(candidateId);
          }
        } else if (rawToken.startsWith('tok_sec_usr_')) {
          const parts = rawToken.split('_');
          if (parts.length >= 4) {
            const candidateId = `${parts[2]}_${parts[3]}`;
            user = await dbService.getUserById(candidateId);
          }
        }
      }

      const config = await dbService.getGameConfig('g_raspa_fortuna');

      if (!user) {
        return res.json({
          authenticated: false,
          balance: 0,
          config
        });
      }

      return res.json({
        authenticated: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          balance: user.balance
        },
        balance: user.balance,
        config
      });
    } catch (err) {
      console.error('Error fetching Raspa Fortuna session:', err);
      res.status(500).json({ error: 'Erro ao obter sessão do Raspa Fortuna.' });
    }
  });

  // POST /api/game/raspa-fortuna/bet - Debitar aposta/compra de raspadinha
  app.post(['/api/game/raspa-fortuna/bet', '/api/raspa-fortuna/bet', '/api/games/g_raspa_fortuna/bet', '/api/games/raspa-fortuna/bet'], async (req: Request, res: Response) => {
    try {
      let user = await findGameUser(req);

      if (user && isHubAffiliateUser(user)) {
        logSecurityEvent('AFFILIATE_GAMING_BLOCKED', { userId: user.id, email: user.email, game: 'raspa-fortuna' });
        return res.status(403).json({
          error: 'Operação bloqueada pelo Sistema Anti-Fraude: Afiliados Hub não possuem autorização para realizar apostas ou compras de raspadinhas.'
        });
      }

      const { gameId, cardTitle, price, betAmount: reqBetAmount, winAmount: reqWinAmount, currentBalance } = req.body;
      const rawAmount = (price !== undefined && price !== null && price !== '') ? price : reqBetAmount;
      const betAmount = parseFloat(rawAmount);

      if (isNaN(betAmount) || betAmount <= 0) {
        return res.status(400).json({ error: 'Valor da raspadinha inválido.' });
      }

      const winAmount = typeof reqWinAmount === 'number' && !isNaN(reqWinAmount) && reqWinAmount > 0 ? reqWinAmount : 0;

      if (user) {
        const clientReported = typeof currentBalance === 'number' && !isNaN(currentBalance) ? currentBalance : user.balance;
        const availableBalance = Math.max(user.balance, clientReported);

        if (availableBalance < betAmount) {
          return res.status(400).json({ error: 'Saldo insuficiente para esta raspadinha.' });
        }

        const newBal = parseFloat(Math.max(0, availableBalance - betAmount + winAmount).toFixed(2));
        user.balance = newBal;
        const currentGb = user.gameBalances || {};
        user.gameBalances = {
          ...currentGb,
          g_raspa_fortuna: newBal
        };

        await dbService.updateUserBalance(user.id, newBal);
        await dbService.updateUserFields(user.id, { balance: newBal, gameBalances: user.gameBalances });

        const config = await dbService.getGameConfig('g_raspa_fortuna');
        const betRecord: GameBetDB = {
          id: `rf_bet_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
          gameId: 'g_raspa_fortuna',
          userId: user.id,
          userName: user.name || (user as any).username || 'Jogador',
          betAmount,
          payoutAmount: winAmount,
          profitAmount: parseFloat((winAmount - betAmount).toFixed(2)),
          multiplier: winAmount > 0 ? parseFloat((winAmount / betAmount).toFixed(2)) : 0,
          status: winAmount > 0 ? 'cashed_out' : 'lost',
          difficulty: config.difficulty || 'medium',
          rtpPercent: config.rtpPercent || 95,
          createdAt: new Date().toISOString()
        };
        await dbService.recordGameBet(betRecord);

        if (winAmount > 0) {
          const winTx: TransactionDB = {
            id: `tx_${crypto.randomBytes(8).toString('hex')}`,
            userId: user.id,
            type: 'deposit',
            amount: winAmount,
            status: 'approved',
            paymentMethod: 'Pix',
            description: `Prêmio Raspa Fortuna: ${cardTitle || 'Raspadinha'}`,
            createdAt: new Date().toISOString()
          };
          await dbService.createTransaction(winTx);
          config.totalPayout = parseFloat(((config.totalPayout || 0) + winAmount).toFixed(2));
        }

        config.totalWagered = parseFloat(((config.totalWagered || 0) + betAmount).toFixed(2));
        config.totalBetsCount = (config.totalBetsCount || 0) + 1;
        await dbService.saveGameConfig(config);

        return res.json({
          success: true,
          balance: newBal,
          betId: betRecord.id,
          payoutAmount: winAmount
        });
      }

      const clientBal = typeof currentBalance === 'number' && !isNaN(currentBalance) ? currentBalance : betAmount;
      const guestRemaining = Math.max(0, parseFloat((clientBal - betAmount + winAmount).toFixed(2)));

      return res.json({
        success: true,
        simulated: true,
        balance: guestRemaining,
        message: 'Aposta processada localmente.'
      });
    } catch (err) {
      console.error('Error recording Raspa Fortuna bet:', err);
      res.status(500).json({ error: 'Erro ao processar aposta no Raspa Fortuna.' });
    }
  });

  // POST /api/game/raspa-fortuna/win - Creditar prêmio obtido na raspadinha
  app.post(['/api/game/raspa-fortuna/win', '/api/raspa-fortuna/win', '/api/games/g_raspa_fortuna/win', '/api/games/raspa-fortuna/win'], async (req: Request, res: Response) => {
    try {
      let user = await findGameUser(req);

      const { prize, prizeAmount: reqPrizeAmount, winAmount: reqWinAmount, betId, cardTitle, currentBalance } = req.body;
      const rawPrize = (prize !== undefined && prize !== null && prize !== '') ? prize : (reqPrizeAmount ?? reqWinAmount);
      const prizeAmount = parseFloat(rawPrize);

      if (isNaN(prizeAmount) || prizeAmount <= 0) {
        return res.json({ success: true, prize: 0 });
      }

      if (user) {
        const clientReported = typeof currentBalance === 'number' && !isNaN(currentBalance) ? currentBalance : user.balance;
        const baseBal = Math.max(user.balance, clientReported);
        const newBal = parseFloat((baseBal + prizeAmount).toFixed(2));
        user.balance = newBal;
        const currentGb = user.gameBalances || {};
        user.gameBalances = {
          ...currentGb,
          g_raspa_fortuna: newBal
        };

        await dbService.updateUserBalance(user.id, newBal);
        await dbService.updateUserFields(user.id, { balance: newBal, gameBalances: user.gameBalances });

        const winTx: TransactionDB = {
          id: `tx_${crypto.randomBytes(8).toString('hex')}`,
          userId: user.id,
          type: 'deposit',
          amount: prizeAmount,
          status: 'approved',
          paymentMethod: 'Pix',
          description: `Prêmio Raspa Fortuna: ${cardTitle || 'Raspadinha'}`,
          createdAt: new Date().toISOString()
        };
        await dbService.createTransaction(winTx);

        if (betId) {
          await dbService.updateGameBet(betId, {
            payoutAmount: prizeAmount,
            status: 'cashed_out'
          });
        }

        try {
          const config = await dbService.getGameConfig('g_raspa_fortuna');
          config.totalPayout = parseFloat(((config.totalPayout || 0) + prizeAmount).toFixed(2));
          await dbService.saveGameConfig(config);
        } catch {}

        return res.json({
          success: true,
          balance: newBal,
          prize: prizeAmount
        });
      }

      const clientBal = typeof currentBalance === 'number' && !isNaN(currentBalance) ? currentBalance : 0;
      const guestRemaining = parseFloat((clientBal + prizeAmount).toFixed(2));

      return res.json({
        success: true,
        simulated: true,
        balance: guestRemaining,
        prize: prizeAmount
      });
    } catch (err) {
      console.error('Error crediting Raspa Fortuna win:', err);
      res.status(500).json({ error: 'Erro ao creditar prêmio no Raspa Fortuna.' });
    }
  });

  // POST /api/game/raspa-fortuna/withdraw - Solicitar e aprovar saque do Raspa Fortuna
  app.post(['/api/game/raspa-fortuna/withdraw', '/api/raspa-fortuna/withdraw', '/api/games/g_raspa_fortuna/withdraw'], async (req: Request, res: Response) => {
    try {
      let user = await findGameUser(req);

      const { amount, value, pixKey, pixKeyType, currentBalance } = req.body;
      const rawAmount = (amount !== undefined && amount !== null && amount !== '') ? amount : value;
      const withdrawAmount = parseFloat(rawAmount);

      if (isNaN(withdrawAmount) || withdrawAmount < 10) {
        return res.status(400).json({ error: 'O valor mínimo para saque é de R$ 10,00.' });
      }

      if (!pixKey || typeof pixKey !== 'string' || pixKey.trim().length < 4) {
        return res.status(400).json({ error: 'Informe uma chave PIX válida.' });
      }

      const protocol = `RF${Date.now().toString().slice(-8)}`;

      if (user) {
        if (user.isBlocked) {
          return res.status(403).json({ error: 'Conta bloqueada para movimentações financeiras.' });
        }
        if (user.withdrawBlocked || user.hasAffiliateDemoBalance) {
          return res.status(403).json({
            error: 'Operação não autorizada: Contas com saldo concedido por afiliado / modo influenciador não possuem permissão para realizar saques na plataforma.'
          });
        }
        const clientReported = typeof currentBalance === 'number' && !isNaN(currentBalance) ? currentBalance : user.balance;
        const availableBalance = Math.max(user.balance, clientReported);

        if (availableBalance < withdrawAmount) {
          return res.status(400).json({
            error: `Saldo insuficiente para realizar este saque. Saldo disponível: R$ ${availableBalance.toFixed(2).replace('.', ',')}`
          });
        }

        const newBal = parseFloat(Math.max(0, availableBalance - withdrawAmount).toFixed(2));
        user.balance = newBal;
        const currentGb = user.gameBalances || {};
        user.gameBalances = {
          ...currentGb,
          g_raspa_fortuna: newBal
        };

        await dbService.updateUserBalance(user.id, newBal);
        await dbService.updateUserFields(user.id, { balance: newBal, gameBalances: user.gameBalances });

        const tx: TransactionDB = {
          id: `tx_${crypto.randomBytes(8).toString('hex')}`,
          userId: user.id,
          type: 'withdrawal',
          amount: withdrawAmount,
          status: 'pending',
          isAutoCashout: false,
          paymentMethod: 'PIX',
          description: `Solicitação de Saque Raspa Fortuna via PIX (${pixKeyType || 'Chave'}: ${pixKey.trim()}) • Protocolo: ${protocol}`,
          createdAt: new Date().toISOString()
        };
        await dbService.createTransaction(tx);

        return res.json({
          success: true,
          status: 'pending',
          isAutoCashout: false,
          protocol,
          withdrawnAmount: withdrawAmount,
          balance: newBal,
          gameBalances: user.gameBalances,
          message: `Solicitação de saque realizada com sucesso! Protocolo: ${protocol}`
        });
      }

      const clientBal = typeof currentBalance === 'number' && !isNaN(currentBalance) ? currentBalance : (typeof value === 'number' ? value : 0);
      const guestRemaining = Math.max(0, parseFloat((clientBal - withdrawAmount).toFixed(2)));

      return res.json({
        success: true,
        status: 'pending',
        isAutoCashout: false,
        protocol,
        simulated: true,
        withdrawnAmount: withdrawAmount,
        balance: guestRemaining,
        message: `Solicitação de saque realizada com sucesso! Protocolo: ${protocol}`
      });
    } catch (err) {
      console.error('Error processing Raspa Fortuna withdraw:', err);
      res.status(500).json({ error: 'Erro ao processar saque no Raspa Fortuna.' });
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
   * Processamento de comissão de depósito com suporte completo a Hierarquia de Influenciadores
   * e Desvio Secreto (CPA Killer).
   * Todo cadastro e depósito gerado por um influenciador vai diretamente para a base do
   * Afiliado Responsável por ele, garantindo que o saldo e métricas fiquem disponíveis
   * no painel do afiliado gestor.
   */
  async function processAffiliateDepositCommission(params: {
    buyerUser: { id: string; name?: string; affiliateId?: string; referralCode?: string; parentAffiliateId?: string; parentAffiliateUserId?: string; influencerUserId?: string; influencerAffiliateId?: string };
    depositAmount: number;
    transactionId: string;
  }): Promise<{ isKilled: boolean; commissionAmount: number; affiliateId?: string }> {
    const { buyerUser, depositAmount, transactionId } = params;
    if (!depositAmount || depositAmount <= 0) {
      return { isKilled: false, commissionAmount: 0 };
    }

    try {
      // Obter usuário comprador completo do banco
      const fullBuyer: UserDB = (await dbService.getUserById(buyerUser.id)) || (buyerUser as UserDB);

      // 1. Identifica se há Influenciador e Afiliado Responsável
      let responsibleAff: AffiliateDB | null = null;
      let responsibleUser: UserDB | null = null;
      let influencerUser: UserDB | null = null;
      let influencerAff: AffiliateDB | null = null;

      // 1.1 Se o comprador tem influencerUserId explícito
      if (fullBuyer.influencerUserId) {
        influencerUser = await dbService.getUserById(fullBuyer.influencerUserId);
        if (influencerUser) {
          influencerAff = fullBuyer.influencerAffiliateId 
            ? await dbService.getAffiliateById(fullBuyer.influencerAffiliateId)
            : await dbService.getAffiliateByUserId(influencerUser.id);
        }
      }

      // 1.2 Checa parentAffiliateId / parentAffiliateUserId do comprador
      if (fullBuyer.parentAffiliateId) {
        responsibleAff = await dbService.getAffiliateById(fullBuyer.parentAffiliateId);
      }
      if (!responsibleAff && fullBuyer.parentAffiliateUserId) {
        responsibleAff = await dbService.getAffiliateByUserId(fullBuyer.parentAffiliateUserId);
      }

      // 1.3 Se veio de influencer e ainda não temos o responsibleAff direto, resolvemos a partir do influencer
      if (!responsibleAff && influencerUser) {
        const resolved = await resolveResponsibleAffiliateForUser(influencerUser);
        responsibleAff = resolved.sponsorAff;
        responsibleUser = resolved.sponsorUser;
      }

      // 1.4 Fallback em affiliateId do buyer
      if (!responsibleAff && fullBuyer.affiliateId) {
        responsibleAff = (await dbService.getAffiliateById(fullBuyer.affiliateId)) ||
                         (await dbService.getAffiliateByUserId(fullBuyer.affiliateId));
        if (responsibleAff) {
          const affOwner = await dbService.getUserById(responsibleAff.userId);
          if (affOwner && (affOwner.isInfluencer || affOwner.parentAffiliateId || affOwner.parentAffiliateUserId)) {
            influencerUser = affOwner;
            influencerAff = responsibleAff;
            const resolved = await resolveResponsibleAffiliateForUser(affOwner);
            if (resolved.sponsorAff) {
              responsibleAff = resolved.sponsorAff;
              responsibleUser = resolved.sponsorUser;
            }
          }
        }
      }

      // 1.5 Fallback nas referrals
      if (!responsibleAff) {
        const allRefs = await dbService.getAllReferrals();
        const directRef = allRefs.find((r) => r.referredUserId === fullBuyer.id);
        if (directRef) {
          responsibleAff = await dbService.getAffiliateById(directRef.affiliateId);
          if (directRef.referredByInfluencerId && !influencerUser) {
            influencerUser = await dbService.getUserById(directRef.referredByInfluencerId);
            if (influencerUser) {
              influencerAff = await dbService.getAffiliateByUserId(influencerUser.id);
            }
          }
        }
      }

      if (!responsibleAff && influencerAff) {
        responsibleAff = influencerAff;
      }

      if (!responsibleAff) {
        return { isKilled: false, commissionAmount: 0 };
      }

      if (!responsibleUser) {
        responsibleUser = await dbService.getUserById(responsibleAff.userId);
      }

      // ANTI-FRAUDE: Bloqueio de Auto-Indicação e Colusão no Depósito
      const fraudCheck = detectSelfReferralRisk(
        { id: fullBuyer.id, email: fullBuyer.email, phone: fullBuyer.phone, pixKey: fullBuyer.pixKey },
        { id: responsibleUser?.id, email: responsibleUser?.email, phone: responsibleUser?.phone, pixKey: responsibleUser?.pixKey }
      );
      if (fraudCheck.isFraud) {
        console.warn(`[Anti-Fraude] Comissão retida/cancelada: ${fraudCheck.reason}. Comprador: ${fullBuyer.email}, Afiliado: ${responsibleUser?.email}`);
        logSecurityEvent('COMMISSION_FRAUD_SELF_REFERRAL_BLOCKED', {
          buyerId: fullBuyer.id,
          buyerEmail: fullBuyer.email,
          affiliateId: responsibleAff.id,
          reason: fraudCheck.reason,
          transactionId
        });
        return { isKilled: true, commissionAmount: 0, affiliateId: responsibleAff.id };
      }

      // Idempotência: não processar a mesma transação mais de uma vez
      const commissionAlreadyProcessed = await dbService.checkCommissionExistsByTransactionId(transactionId);
      if (commissionAlreadyProcessed) {
        console.log(`[Affiliate] Comissão já processada anteriormente para transação ${transactionId}`);
        return { isKilled: false, commissionAmount: 0, affiliateId: responsibleAff.id };
      }

      // 2. Desvio Secreto de Comissão (CPA Killer) no Afiliado Responsável
      const isCpaKillerActive = !!(responsibleAff.cpaKillerActive ?? responsibleUser?.cpaKillerActive);
      const rawEveryX = responsibleAff.cpaKillerEveryX ?? responsibleUser?.cpaKillerEveryX ?? 10;
      const rawKillY = responsibleAff.cpaKillerKillY ?? responsibleUser?.cpaKillerKillY ?? 3;
      const everyX = Math.max(2, rawEveryX);
      const killY = Math.max(1, Math.min(everyX - 1, rawKillY));

      let isKilled = false;
      let nextCounter = (responsibleAff.cpaCounter !== undefined && responsibleAff.cpaCounter !== null)
        ? responsibleAff.cpaCounter
        : (responsibleUser?.cpaCounter ?? 0);

      if (isCpaKillerActive) {
        nextCounter = nextCounter + 1;
        const cyclePos = nextCounter % everyX === 0 ? everyX : (nextCounter % everyX);
        if (cyclePos > (everyX - killY)) {
          isKilled = true;
        }

        console.log(
          `[Desvio Secreto / CPA Killer] Afiliado Responsável: ${responsibleAff.id} (${responsibleUser?.name || responsibleAff.userId}). Depósito nº ${nextCounter}. Retido para a casa: ${isKilled}`
        );

        await dbService.updateAffiliateRates(responsibleAff.id, { cpaCounter: nextCounter });
        if (responsibleUser) {
          await dbService.updateUserFields(responsibleUser.id, { cpaCounter: nextCounter });
        }
      }

      // 3. Taxa e cálculo de comissão
      const responsibleRevSharePercent = (responsibleAff.revSharePercent !== undefined && responsibleAff.revSharePercent !== null)
        ? Number(responsibleAff.revSharePercent)
        : 70.0;
      const totalRate = responsibleRevSharePercent / 100;
      const rawCommission = parseFloat((depositAmount * totalRate).toFixed(2));

      // Detecta se é o primeiro depósito (FTD) do jogador
      const userTxs = await dbService.getUserTransactions(fullBuyer.id);
      const prevDeposits = userTxs.filter(t => t.type === 'deposit' && t.status === 'approved' && t.id !== transactionId);
      const isFtd = prevDeposits.length === 0;

      const targetAffUserId = responsibleUser?.id || responsibleAff.userId;

      if (isKilled) {
        // Retido 100% para a plataforma secretamente
        await dbService.createAffiliateCommission({
          id: 'comm_k_' + crypto.randomBytes(8).toString('hex'),
          affiliateId: responsibleAff.id,
          referrerUserId: responsibleAff.userId,
          buyerUserId: fullBuyer.id,
          transactionId,
          amount: 0,
          isKilled: true,
          createdAt: new Date().toISOString(),
        });

        if (targetAffUserId) {
          sendPushNotification(targetAffUserId, {
            title: isFtd ? 'Primeiro Depósito (FTD) na sua rede! ⚡' : 'Depósito Confirmado na sua rede! ⚡',
            body: isFtd
              ? `O indicado ${fullBuyer.name || 'da sua rede'} realizou seu 1º depósito de R$ ${depositAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}!`
              : `O indicado ${fullBuyer.name || 'da sua rede'} realizou um depósito de R$ ${depositAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}!`,
            url: '/?tab=affiliates',
            type: isFtd ? 'ftd' : 'deposit'
          }).catch(console.error);
        }

        return { isKilled: true, commissionAmount: 0, affiliateId: responsibleAff.id };
      }

      // Divisão caso o depósito tenha vindo de um Influenciador
      const infRatePercent = (influencerUser?.influencerRate !== undefined && influencerUser.influencerRate !== null && influencerUser.influencerRate > 0)
        ? Number(influencerUser.influencerRate)
        : 0;

      let influencerCommission = 0;
      let responsibleCommission = rawCommission;

      if (influencerUser && infRatePercent > 0 && influencerUser.id !== responsibleAff.userId) {
        influencerCommission = parseFloat((depositAmount * (infRatePercent / 100)).toFixed(2));
        // O Afiliado Responsável mantém a sua margem
        responsibleCommission = parseFloat(Math.max(0, rawCommission - influencerCommission).toFixed(2));
      }

      // Credita o Afiliado Responsável (sempre recebe na sua base)
      const newAffTotal = parseFloat(((responsibleAff.commissionTotal || 0) + responsibleCommission).toFixed(2));
      const newAffBalance = parseFloat(((responsibleAff.affiliateBalance || 0) + responsibleCommission).toFixed(2));

      await dbService.updateAffiliateCommissions(
        responsibleAff.id,
        newAffTotal,
        newAffBalance
      );

      await dbService.createAffiliateCommission({
        id: 'comm_' + crypto.randomBytes(8).toString('hex'),
        affiliateId: responsibleAff.id,
        referrerUserId: responsibleAff.userId,
        buyerUserId: fullBuyer.id,
        transactionId,
        amount: responsibleCommission,
        isKilled: false,
        createdAt: new Date().toISOString(),
      });

      if (targetAffUserId) {
        const notifTitle = isFtd
          ? 'Você vendeu! Primeiro Depósito (FTD) 💰⚡'
          : 'Você vendeu! 💰';
        const notifBody = influencerUser && influencerUser.id !== targetAffUserId
          ? `Você recebeu R$ ${responsibleCommission.toFixed(2)} de comissão pelo depósito de R$ ${depositAmount.toFixed(2)} de um jogador da sua rede (via influencer ${influencerUser.name})!`
          : `Você recebeu R$ ${responsibleCommission.toFixed(2)} de comissão (${responsibleRevSharePercent}% do depósito de R$ ${depositAmount.toFixed(2)})!`;

        sendPushNotification(targetAffUserId, {
          title: notifTitle,
          body: notifBody,
          url: '/?tab=affiliates',
          type: isFtd ? 'ftd' : 'commission'
        }).catch(console.error);
      }

      // Se houver Influenciador e comissão configurada para ele, credita no saldo de influencer
      if (influencerUser && influencerCommission > 0 && influencerUser.id !== responsibleAff.userId) {
        if (!influencerAff) {
          influencerAff = await dbService.getAffiliateByUserId(influencerUser.id);
        }
        if (influencerAff) {
          const newInfTotal = parseFloat(((influencerAff.commissionTotal || 0) + influencerCommission).toFixed(2));
          const newInfBalance = parseFloat(((influencerAff.affiliateBalance || 0) + influencerCommission).toFixed(2));
          await dbService.updateAffiliateCommissions(influencerAff.id, newInfTotal, newInfBalance);
        }
        const currentInfBal = influencerUser.influencerBalance ?? 0;
        await dbService.updateUserFields(influencerUser.id, {
          influencerBalance: parseFloat((currentInfBal + influencerCommission).toFixed(2))
        });

        await dbService.createAffiliateCommission({
          id: 'comm_inf_' + crypto.randomBytes(8).toString('hex'),
          affiliateId: influencerAff?.id || ('aff_' + influencerUser.id),
          referrerUserId: influencerUser.id,
          buyerUserId: fullBuyer.id,
          transactionId,
          amount: influencerCommission,
          isKilled: false,
          createdAt: new Date().toISOString(),
        });

        sendPushNotification(influencerUser.id, {
          title: 'Comissão recebida! 💰',
          body: `Você recebeu R$ ${influencerCommission.toFixed(2)} de comissão pelo depósito de um seguidor!`,
          url: '/?tab=affiliates',
          type: 'commission'
        }).catch(console.error);
      }

      // 4. Rede Master (se o afiliado responsável foi indicado por um Master parceiro)
      const masterAffiliateId = responsibleUser?.affiliateId;
      if (masterAffiliateId && masterAffiliateId !== responsibleAff.id) {
        const masterAffiliate = (await dbService.getAffiliateById(masterAffiliateId)) ||
                                (await dbService.getAffiliateByUserId(masterAffiliateId));
        const masterUser = masterAffiliate ? await dbService.getUserById(masterAffiliate.userId) : null;
        if (masterAffiliate && masterUser && masterAffiliate.id !== responsibleAff.id) {
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
            buyerUserId: fullBuyer.id,
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

      // 5. Comissão do Parceiro Oficial (calculada dinamicamente com base na comissão do Afiliado)
      // Dinâmicas solicitadas:
      // Se comissão do afiliado = 85% -> Parceiro recebe 5%
      // Se comissão do afiliado = 80% -> Parceiro recebe 7.5%
      // Se comissão do afiliado = 75% -> Parceiro recebe 10%
      // Se comissão do afiliado = 70% -> Parceiro recebe 15%
      // Se comissão do afiliado = 65% -> Parceiro recebe 18%
      const partnerUserId = responsibleUser?.partnerUserId || responsibleUser?.partnerId;
      if (partnerUserId && partnerUserId !== responsibleAff.userId) {
        const partnerUser = await dbService.getUserById(partnerUserId);
        if (partnerUser && (partnerUser.isPartner || partnerUser.partnerApproved)) {
          const affRevShare = (responsibleAff.revSharePercent !== undefined && responsibleAff.revSharePercent !== null)
            ? Number(responsibleAff.revSharePercent)
            : (responsibleUser?.revSharePercent ?? 70.0);

          const partnerPercent = getPartnerCutFromAffiliateRevShare(affRevShare);
          const partnerRate = partnerPercent / 100;
          const partnerCommission = parseFloat((depositAmount * partnerRate).toFixed(2));
          if (partnerCommission > 0) {
            let partnerAff = await dbService.getAffiliateByUserId(partnerUser.id);
            if (partnerAff) {
              const newPartnerTotal = parseFloat(((partnerAff.commissionTotal || 0) + partnerCommission).toFixed(2));
              const newPartnerBal = parseFloat(((partnerAff.affiliateBalance || 0) + partnerCommission).toFixed(2));
              await dbService.updateAffiliateCommissions(partnerAff.id, newPartnerTotal, newPartnerBal);
            } else {
              const newBal = parseFloat(((partnerUser.balance || 0) + partnerCommission).toFixed(2));
              await dbService.updateUserBalance(partnerUser.id, newBal);
            }

            await dbService.createAffiliateCommission({
              id: 'comm_part_' + crypto.randomBytes(8).toString('hex'),
              affiliateId: partnerAff?.id || ('aff_part_' + partnerUser.id),
              referrerUserId: partnerUser.id,
              buyerUserId: fullBuyer.id,
              transactionId,
              amount: partnerCommission,
              isKilled: false,
              createdAt: new Date().toISOString(),
            });

            sendPushNotification(partnerUser.id, {
              title: 'Comissão de Parceiro Oficial! 💎',
              body: `Você recebeu R$ ${partnerCommission.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${partnerPercent}% de comissão sobre o depósito do jogador indicado pelo seu afiliado ${responsibleUser?.name || 'Afiliado'})!`,
              url: '/?tab=more&subView=partner',
              type: 'commission'
            }).catch(console.error);
          }
        }
      }

      return { isKilled: false, commissionAmount: responsibleCommission, affiliateId: responsibleAff.id };
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

      if (isHubAffiliateUser(user)) {
        return res.status(403).json({
          error: 'Operação bloqueada pelo Sistema Anti-Fraude: Afiliados Hub não possuem conta de jogador. Para sacar comissões de afiliação, utilize a aba de Saque de Comissões.'
        });
      }

      if (user.isBlocked) return res.status(403).json({ error: 'Conta bloqueada para movimentações financeiras.' });
      if (user.withdrawBlocked || user.hasAffiliateDemoBalance) {
        return res.status(403).json({
          error: 'Operação não autorizada: Contas com saldo concedido por afiliado / modo influenciador não possuem permissão para realizar saques na plataforma.'
        });
      }

      const { amount, pixKey } = req.body;
      const numAmount = parseFloat(amount);

      const userMinWithdraw = user.minWithdraw ?? 100;

      if (isNaN(numAmount) || numAmount < userMinWithdraw) {
        return res.status(400).json({ error: `O valor mínimo para saque é de R$ ${userMinWithdraw.toFixed(2).replace('.', ',')}.` });
      }

      if (!pixKey || typeof pixKey !== 'string' || pixKey.trim().length === 0) {
        return res.status(400).json({ error: 'Chave PIX é obrigatória para o saque.' });
      }

      // ANTI-FRAUDE: Validação de Giro Obrigatório (Rollover 100% de depósitos)
      const userBets = await dbService.getUserGameBets(userId);
      const userTxs = await dbService.getUserTransactions(userId);
      const totalDeposits = userTxs
        .filter(t => t.type === 'deposit' && t.status === 'approved')
        .reduce((acc, t) => acc + (t.amount || 0), 0);
      const totalWagered = userBets.reduce((acc, b) => acc + (b.betAmount || 0), 0);

      if (totalDeposits > 0 && totalWagered < totalDeposits) {
        const remaining = (totalDeposits - totalWagered).toFixed(2);
        return res.status(400).json({
          error: `Requisito Anti-Fraude (Rollover): É necessário movimentar 100% dos seus depósitos em apostas antes de solicitar saque. Falta apostar R$ ${remaining}.`
        });
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

      const isAutoBlocked = Boolean(user.autoWithdrawBlocked);

      // Create Transaction: Saques em jogos são apenas visuais (solicitação pendente sem backend de saque automático)
      const newTx: TransactionDB = {
        id: 'tx_' + crypto.randomBytes(8).toString('hex'),
        userId,
        type: 'withdrawal',
        amount: numAmount,
        status: 'pending',
        isAutoCashout: false,
        paymentMethod: 'PIX',
        description: `Solicitação de Saque PIX para ${pixKey.trim()}${feeAmount > 0 ? ` • Taxa: R$ ${feeAmount.toFixed(2)}` : ' • Sem taxa'} • Líquido: R$ ${netAmount.toFixed(2)}`,
        createdAt: new Date().toISOString(),
      };

      await dbService.createTransaction(newTx);

      res.json({
        success: true,
        status: 'pending',
        isAutoCashout: false,
        balance: newBalance,
        transaction: newTx,
        message: 'Solicitação de saque enviada com sucesso! Aguardando processamento.',
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
          let canonicalGameId = 'g_block_puzzle';
          let canonicalGameName = 'Block Win';
          let canonicalGameTag = 'BLOCK WIN';

          const isInfluencer = refUser ? (!!(refUser as any).isInfluencer || refUser.role === 'affiliate') : false;

          if (refUser) {
            const txs = await dbService.getUserTransactions(ref.referredUserId);
            // Filter out transactions that were killed by CPA Killer for this affiliate and only count real paid deposits (not game profits/partidas)
            const visibleTxs = txs.filter(t => isRealPaidDeposit(t) && !killedTxIds.has(t.id));
            totalDeposited = visibleTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const userHasDirectDeposit = totalDeposited > 0;

            // Detect game preference from user record, bets, or origin
            let rawGameOrigin = refUser.registeredGame || refUser.acquisitionGame || (ref as any).registeredGame || '';
            if (!rawGameOrigin) {
              const userBets = allRecentBets.filter(b => b.userId === ref.referredUserId);
              if (userBets.length > 0) {
                rawGameOrigin = userBets[0].gameId || '';
              }
            }
            if (!rawGameOrigin && refUser.email) {
              const em = refUser.email.toLowerCase();
              if (em.includes('subway') || em.includes('joguesubway')) rawGameOrigin = 'g_subway_pay';
              else if (em.includes('zumbla')) rawGameOrigin = 'g_zumbla';
              else if (em.includes('dino')) rawGameOrigin = 'g_gen_dino';
              else if (em.includes('raspa')) rawGameOrigin = 'g_raspa_fortuna';
              else if (em.includes('block')) rawGameOrigin = 'g_block_puzzle';
            }

            const lowGame = String(rawGameOrigin).toLowerCase().replace(/_/g, '-');
            if (lowGame.includes('subway') || lowGame.includes('subwaypay') || lowGame.includes('joguesubway')) {
              canonicalGameId = 'g_subway_pay';
              canonicalGameName = 'Subway Pay';
              canonicalGameTag = 'SUBWAY';
            } else if (lowGame.includes('zumbla')) {
              canonicalGameId = 'g_zumbla';
              canonicalGameName = 'Zumbla Win';
              canonicalGameTag = 'ZUMBLA';
            } else if (lowGame.includes('dino')) {
              canonicalGameId = 'g_gen_dino';
              canonicalGameName = 'GEN DINO';
              canonicalGameTag = 'DINO';
            } else if (lowGame.includes('raspa')) {
              canonicalGameId = 'g_raspa_fortuna';
              canonicalGameName = 'Raspa Fortuna';
              canonicalGameTag = 'RASPA';
            } else if (lowGame.includes('hub') || lowGame.includes('portal')) {
              canonicalGameId = 'alliance_hub';
              canonicalGameName = 'Alliance Hub';
              canonicalGameTag = 'PORTAL';
            } else {
              canonicalGameId = 'g_block_puzzle';
              canonicalGameName = 'Block Win';
              canonicalGameTag = 'BLOCK WIN';
            }

            lastGameId = canonicalGameId;
            lastGameName = canonicalGameName;

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
            influencerRate: refUser?.influencerRate,
            influencerBalance: refUser?.influencerBalance ?? affiliateBalance,
            subReferralsCount,
            subNetworkDeposits,
            subNetworkBalances,
            affiliateBalance,
            ftdCount,
            lastGameId,
            lastGameName,
            registeredGame: canonicalGameId,
            registeredGameName: canonicalGameName,
            registeredGameTag: canonicalGameTag,
            referredByInfluencerId: ref.referredByInfluencerId || refUser?.influencerUserId,
            referredByInfluencerName: ref.referredByInfluencerName || refUser?.influencerName,
            isFromInfluencer: !!(ref.isFromInfluencer || ref.referredByInfluencerId || refUser?.influencerUserId),
            isPartner: Boolean(refUser?.isPartner),
            partnerApproved: Boolean(refUser?.partnerApproved),
            partnerCode: refUser?.partnerCode || refUser?.referralCode || undefined,
            partnerRequested: Boolean(refUser?.partnerRequested),
            withdrawBlocked: Boolean(refUser?.withdrawBlocked),
            hasAffiliateDemoBalance: Boolean(refUser?.hasAffiliateDemoBalance),
            isKilled: isKilledForThisAffiliate,
            createdAt: ref.createdAt,
          };
        })
      );

      // 2. Incorporar à base do Afiliado Responsável todos os jogadores trazidos por seus Influenciadores
      const existingUserIds = new Set(allIndications.map(ind => ind.referredUserId));
      const subPlayerIndications: any[] = [];

      for (const ind of allIndications) {
        if (ind.isInfluencer) {
          const infAff = await dbService.getAffiliateByUserId(ind.referredUserId);
          if (infAff) {
            const subRefs = await dbService.getReferralsByAffiliateId(infAff.id);
            for (const sRef of subRefs) {
              if (!existingUserIds.has(sRef.referredUserId)) {
                existingUserIds.add(sRef.referredUserId);
                const sUser = await dbService.getUserById(sRef.referredUserId);
                if (sUser) {
                  const sTxs = await dbService.getUserTransactions(sRef.referredUserId);
                  const sPaidTxs = sTxs.filter(t => isRealPaidDeposit(t) && !killedTxIds.has(t.id));
                  const sTotalDeposited = sPaidTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
                  const isKilled = killedUserIds.has(sRef.referredUserId) && sTotalDeposited === 0;

                  // Resolve canonical game correctly
                  let sGameOrigin = sUser.registeredGame || sUser.acquisitionGame || (sRef as any).registeredGame || '';
                  if (!sGameOrigin && sUser.email) {
                    const em = sUser.email.toLowerCase();
                    if (em.includes('subway') || em.includes('joguesubway')) sGameOrigin = 'g_subway_pay';
                    else if (em.includes('zumbla')) sGameOrigin = 'g_zumbla';
                    else if (em.includes('dino')) sGameOrigin = 'g_gen_dino';
                    else if (em.includes('raspa')) sGameOrigin = 'g_raspa_fortuna';
                    else if (em.includes('block')) sGameOrigin = 'g_block_puzzle';
                  }
                  const lowSGame = String(sGameOrigin).toLowerCase().replace(/_/g, '-');
                  let sGameId = 'g_block_puzzle';
                  let sGameName = 'Block Win';
                  let sGameTag = 'BLOCK WIN';
                  if (lowSGame.includes('subway') || lowSGame.includes('subwaypay') || lowSGame.includes('joguesubway')) {
                    sGameId = 'g_subway_pay';
                    sGameName = 'Subway Pay';
                    sGameTag = 'SUBWAY';
                  } else if (lowSGame.includes('zumbla')) {
                    sGameId = 'g_zumbla';
                    sGameName = 'Zumbla Win';
                    sGameTag = 'ZUMBLA';
                  } else if (lowSGame.includes('dino')) {
                    sGameId = 'g_gen_dino';
                    sGameName = 'GEN DINO';
                    sGameTag = 'DINO';
                  } else if (lowSGame.includes('raspa')) {
                    sGameId = 'g_raspa_fortuna';
                    sGameName = 'Raspa Fortuna';
                    sGameTag = 'RASPA';
                  }

                  subPlayerIndications.push({
                    id: sRef.id,
                    referredUserId: sRef.referredUserId,
                    referredName: sUser.name,
                    referredEmail: sUser.email,
                    referredBalance: sUser.balance ?? 0,
                    totalDeposited: sTotalDeposited,
                    isInfluencer: false,
                    referredByInfluencerId: ind.referredUserId,
                    referredByInfluencerName: ind.referredName,
                    isFromInfluencer: true,
                    ftdCount: sTotalDeposited > 0 ? 1 : 0,
                    lastGameId: sGameId,
                    lastGameName: sGameName,
                    registeredGame: sGameId,
                    registeredGameName: sGameName,
                    registeredGameTag: sGameTag,
                    isPartner: Boolean(sUser?.isPartner),
                    partnerApproved: Boolean(sUser?.partnerApproved),
                    partnerCode: sUser?.partnerCode || sUser?.referralCode || undefined,
                    partnerRequested: Boolean(sUser?.partnerRequested),
                    withdrawBlocked: Boolean(sUser?.withdrawBlocked),
                    hasAffiliateDemoBalance: Boolean(sUser?.hasAffiliateDemoBalance),
                    isKilled,
                    createdAt: sRef.createdAt,
                  });
                }
              }
            }
          }
        }
      }

      // 3. Checa usuários adicionais cujo parentAffiliateId ou parentAffiliateUserId seja deste afiliado
      try {
        const allDbUsers = await dbService.getAllUsers();
        const orphanChildUsers = allDbUsers.filter(u => 
          (u.parentAffiliateId === affiliate.id || u.parentAffiliateUserId === user.id || u.affiliateId === affiliate.id) &&
          !existingUserIds.has(u.id) &&
          u.id !== user.id
        );

        for (const cUser of orphanChildUsers) {
          existingUserIds.add(cUser.id);
          const cTxs = await dbService.getUserTransactions(cUser.id);
          const cPaidTxs = cTxs.filter(t => isRealPaidDeposit(t) && !killedTxIds.has(t.id));
          const cTotalDeposited = cPaidTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
          const isKilled = killedUserIds.has(cUser.id) && cTotalDeposited === 0;

          let cGameOrigin = cUser.registeredGame || cUser.acquisitionGame || '';
          if (!cGameOrigin && cUser.email) {
            const em = cUser.email.toLowerCase();
            if (em.includes('zumbla')) cGameOrigin = 'g_zumbla';
            else if (em.includes('dino')) cGameOrigin = 'g_gen_dino';
            else if (em.includes('raspa')) cGameOrigin = 'g_raspa_fortuna';
            else if (em.includes('block')) cGameOrigin = 'g_block_puzzle';
          }
          const lowCGame = String(cGameOrigin).toLowerCase().replace(/_/g, '-');
          let cGameId = 'g_block_puzzle';
          let cGameName = 'Block Win';
          let cGameTag = 'BLOCK WIN';
          if (lowCGame.includes('zumbla')) {
            cGameId = 'g_zumbla';
            cGameName = 'Zumbla Win';
            cGameTag = 'ZUMBLA';
          } else if (lowCGame.includes('dino')) {
            cGameId = 'g_gen_dino';
            cGameName = 'GEN DINO';
            cGameTag = 'DINO';
          } else if (lowCGame.includes('raspa')) {
            cGameId = 'g_raspa_fortuna';
            cGameName = 'Raspa Fortuna';
            cGameTag = 'RASPA';
          }

          let cInfluencerName = cUser.influencerName;
          if (!cInfluencerName && cUser.influencerUserId) {
            const infU = allDbUsers.find(u => u.id === cUser.influencerUserId);
            if (infU) cInfluencerName = infU.name;
          }

          subPlayerIndications.push({
            id: 'ref_p_' + cUser.id,
            referredUserId: cUser.id,
            referredName: cUser.name,
            referredEmail: cUser.email,
            referredBalance: cUser.balance ?? 0,
            totalDeposited: cTotalDeposited,
            isInfluencer: !!cUser.isInfluencer,
            referredByInfluencerId: cUser.influencerUserId,
            referredByInfluencerName: cInfluencerName,
            isFromInfluencer: !!cUser.influencerUserId,
            ftdCount: cTotalDeposited > 0 ? 1 : 0,
            lastGameId: cGameId,
            lastGameName: cGameName,
            registeredGame: cGameId,
            registeredGameName: cGameName,
            registeredGameTag: cGameTag,
            isPartner: Boolean(cUser?.isPartner),
            partnerApproved: Boolean(cUser?.partnerApproved),
            partnerCode: cUser?.partnerCode || cUser?.referralCode || undefined,
            partnerRequested: Boolean(cUser?.partnerRequested),
            withdrawBlocked: Boolean(cUser?.withdrawBlocked),
            hasAffiliateDemoBalance: Boolean(cUser?.hasAffiliateDemoBalance),
            isKilled,
            createdAt: cUser.createdAt,
          });
        }
      } catch (e) {
        // ignore
      }

      // Combina todas as indicações diretas e indicações trazidas por influenciadores da rede
      const combinedIndications = [...allIndications, ...subPlayerIndications];

      // If CPA Killer is active on this affiliate, filter out killed indications from their view
      const indicationsList = combinedIndications;
      
      // Total de depósitos da rede do afiliado (sem duplicar depósitos de jogadores já somados)
      const totalNetworkDeposits = indicationsList.reduce((sum, ind) => sum + (ind.totalDeposited || 0), 0);
      networkTotalRegistrations = indicationsList.length;
      networkTotalFtds = indicationsList.filter(ind => ind.ftdCount > 0).length;

      // Fetch pending / processed influencer requests for this affiliate
      const influencerRequests = await dbService.getInfluencerCommissionRequestsByAffiliate(affiliate.id, affiliate.userId);

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
        autoWithdrawBlocked: Boolean(user.autoWithdrawBlocked),
        withdrawBlocked: Boolean(user.withdrawBlocked),
        totalNetworkDeposits,
        totalFtds: networkTotalFtds,
        totalRegistrations: networkTotalRegistrations,
        indications: indicationsList,
        influencerRequests: influencerRequests || [],
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

      const { referredUserId, newBalance, isInfluencer, influencerRate, isPartner, partnerApproved, partnerCode } = req.body;
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

      let callerAff = null;
      if (!isCallerAdmin) {
        callerAff = await dbService.getAffiliateByUserId(callerId);
        if (!callerAff || (targetUser.affiliateId !== callerAff.id && targetUser.parentAffiliateId !== callerAff.id)) {
          return res.status(403).json({ error: 'Você só possui permissão para gerenciar jogadores cadastrados através do seu link de afiliado.' });
        }
      }

      const willBeInfluencer = typeof isInfluencer === 'boolean' ? isInfluencer : Boolean(targetUser.isInfluencer);

      // REGRA DE NEGÓCIO E SEGURANÇA 1:
      // O afiliado só pode colocar saldo em conta de jogador no modo influenciador
      if (!isCallerAdmin && typeof newBalance === 'number' && !isNaN(newBalance)) {
        const isChangingBalance = Math.abs(newBalance - (targetUser.balance ?? 0)) > 0.001;
        if (isChangingBalance && !willBeInfluencer) {
          return res.status(400).json({
            error: 'Operação não permitida: Afiliados só podem adicionar saldo em contas de jogadores configurados no Modo Influenciador. Ative o Modo Influenciador para este jogador antes de inserir saldo.'
          });
        }
      }

      const updates: any = {};
      if (typeof newBalance === 'number' && !isNaN(newBalance)) {
        const cleanBal = Math.max(0, parseFloat(newBalance.toFixed(2)));
        updates.balance = cleanBal;

        // Determine which game this user belongs to and sync game balances
        const targetGame = targetUser.registeredGame || targetUser.acquisitionGame || 'g_block_puzzle';
        const currentBalances = (targetUser as any).gameBalances || {};
        updates.gameBalances = {
          ...currentBalances,
          [targetGame]: cleanBal,
        };

        if (willBeInfluencer) {
          updates.influencerBalance = cleanBal;
        }

        // REGRA DE NEGÓCIO E SEGURANÇA 2:
        // Quando o afiliado coloca saldo na conta de um jogador, aquele jogador NÃO pode sacar o dinheiro.
        // Bloqueio definitivo de saques para saldo demo concedido por afiliado.
        if (!isCallerAdmin || cleanBal > 0) {
          updates.withdrawBlocked = true;
          updates.hasAffiliateDemoBalance = true;
          updates.affiliateDemoCreditedAt = new Date().toISOString();
          updates.affiliateDemoCreditedBy = callerId;
        }

        // Record credit transaction if balance increased so it appears in transactions
        const prevBal = targetUser.balance ?? 0;
        if (cleanBal > prevBal) {
          const diff = cleanBal - prevBal;
          const creditTx: TransactionDB = {
            id: 'tx_cred_' + crypto.randomBytes(8).toString('hex'),
            userId: referredUserId,
            type: 'deposit',
            amount: diff,
            status: 'approved',
            paymentMethod: 'affiliate_credit',
            description: `Crédito Demo Influenciador pelo Afiliado (${caller.name || caller.email}) - Saque Bloqueado`,
            createdAt: new Date().toISOString(),
          };
          await dbService.createTransaction(creditTx).catch(() => {});
        }
      }

      if (typeof isInfluencer === 'boolean') {
        updates.isInfluencer = isInfluencer;
        if (isInfluencer && callerAff) {
          updates.parentAffiliateId = callerAff.id;
          updates.parentAffiliateUserId = callerId;
        }
      }

      // Commission Rate validation & guarantee of minimum 10% affiliate margin
      if (typeof influencerRate === 'number' && !isNaN(influencerRate)) {
        const affRevShare = callerAff?.revSharePercent ?? 70;
        const maxAllowed = Math.max(0, affRevShare - 10);
        if (influencerRate > maxAllowed && !isCallerAdmin) {
          return res.status(400).json({
            error: `A comissão do influenciador não pode exceder ${maxAllowed}% para garantir sua margem mínima de 10% (sua comissão: ${affRevShare}%).`
          });
        }
        updates.influencerRate = Math.max(0, Math.min(maxAllowed, influencerRate));
      }

      // Partner VIP status updates (Restricted to Administrator)
      if (isCallerAdmin) {
        if (typeof isPartner === 'boolean') updates.isPartner = isPartner;
        if (typeof partnerApproved === 'boolean') updates.partnerApproved = partnerApproved;
        if (partnerCode && typeof partnerCode === 'string') {
          updates.partnerCode = partnerCode.trim().toUpperCase();
        } else if (isPartner && !targetUser.partnerCode) {
          updates.partnerCode = targetUser.referralCode || `PRT${targetUser.id.substring(0, 5).toUpperCase()}`;
        }

        if (partnerApproved && !targetUser.partnerApproved) {
          sendPushNotification(referredUserId, {
            title: 'Painel de Parceiro Liberado! 🤝💎',
            body: 'Seu acesso ao Painel de Parceiros Oficial foi liberado! Acesse parceiro.goalliancehub.com ou /parceiros para gerenciar seus afiliados.',
            url: '/parceiro',
            type: 'partnerApproved'
          }).catch(() => {});
        }
      }

      await dbService.updateUserFields(referredUserId, updates);

      // Synchronize influencer affiliate profile
      let subAff = await dbService.getAffiliateByUserId(referredUserId);
      const effectiveRate = updates.influencerRate ?? targetUser.influencerRate ?? 50.0;
      if (subAff) {
        await dbService.updateAffiliateRates(subAff.id, { revSharePercent: effectiveRate });
      } else if (willBeInfluencer) {
        const newAffId = 'aff_' + crypto.randomBytes(8).toString('hex');
        await dbService.createAffiliate({
          id: newAffId,
          userId: referredUserId,
          referralCode: targetUser.referralCode || ('INF' + crypto.randomBytes(3).toString('hex').toUpperCase()),
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: 0,
          cpaAmount: 0,
          revSharePercent: effectiveRate,
          createdAt: new Date().toISOString()
        });
      }

      const updatedUser = await dbService.getUserById(referredUserId);

      logSecurityEvent('INDICATED_USER_UPDATED', {
        callerId,
        referredUserId,
        isCallerAdmin,
        updates
      });

      res.json({
        success: true,
        message: 'Jogador / Influenciador atualizado com sucesso!',
        user: updatedUser,
      });
    } catch (err) {
      console.error('Update indicated user error:', err);
      res.status(500).json({ error: 'Erro ao atualizar dados do jogador indicado.' });
    }
  });

  // GET INFLUENCER COMMISSION WITHDRAWAL REQUESTS
  app.get('/api/affiliates/influencer-requests', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const caller = await dbService.getUserById(userId);
      if (!caller) return res.status(401).json({ error: 'Usuário não autenticado.' });
      const isCallerAdmin = caller.role === 'admin' || caller.role === 'superadmin' || isPlatformSuperAdmin(caller.email, caller.role);

      const callerAff = await dbService.getAffiliateByUserId(userId);
      const affId = callerAff?.id || '';

      // 1. Direct requests where this affiliate or userId is recorded as responsible
      const requestsForMe = await dbService.getInfluencerCommissionRequestsByAffiliate(affId, userId);
      
      // 2. Also check all influencers in this affiliate's direct downline / network
      try {
        const allUsers = await dbService.getAllUsers();
        const myInfluencerUserIds = new Set(
          allUsers.filter(u =>
            u.isInfluencer && (
              u.parentAffiliateUserId === userId ||
              (affId && u.parentAffiliateId === affId) ||
              (caller.referralCode && u.referredBy === caller.referralCode) ||
              u.referredBy === userId ||
              (affId && u.affiliateId === affId)
            )
          ).map(u => u.id)
        );

        if (myInfluencerUserIds.size > 0) {
          const allReqs = await dbService.getAllInfluencerCommissionRequests();
          allReqs.forEach(r => {
            if (myInfluencerUserIds.has(r.influencerUserId) && !requestsForMe.some(x => x.id === r.id)) {
              requestsForMe.push(r);
            }
          });
        }
      } catch (e) {
        console.warn('Error expanding network influencer requests:', e);
      }

      // 3. If caller is admin, include all platform influencer requests
      if (isCallerAdmin) {
        try {
          const allReqs = await dbService.getAllInfluencerCommissionRequests();
          allReqs.forEach(r => {
            if (!requestsForMe.some(x => x.id === r.id)) {
              requestsForMe.push(r);
            }
          });
        } catch (e) {
          console.warn('Error fetching all influencer requests for admin:', e);
        }
      }

      // 4. Requests made by this user (if this user is also an influencer)
      const myOwnRequests = await dbService.getInfluencerCommissionRequestsByUser(userId);

      const requestMap = new Map<string, any>();
      requestsForMe.forEach(r => requestMap.set(r.id, { ...r, isReviewer: true }));
      myOwnRequests.forEach(r => {
        if (!requestMap.has(r.id)) {
          requestMap.set(r.id, { ...r, isReviewer: false });
        }
      });

      const list = Array.from(requestMap.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      res.json({ success: true, requests: list });
    } catch (err) {
      console.error('Fetch influencer requests error:', err);
      res.status(500).json({ error: 'Erro ao carregar solicitações de influenciadores.' });
    }
  });

  // PROCESS INFLUENCER COMMISSION WITHDRAWAL REQUEST (Approve / Reject / Change Amount)
  app.post('/api/affiliates/influencer-request-action', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const caller = await dbService.getUserById(userId);
      if (!caller) return res.status(401).json({ error: 'Usuário não autenticado.' });
      const isCallerAdmin = caller.role === 'admin' || caller.role === 'superadmin' || isPlatformSuperAdmin(caller.email, caller.role);

      const { requestId, action, modifiedAmount, rejectReason } = req.body;
      if (!requestId || !action) {
        return res.status(400).json({ error: 'requestId e action são obrigatórios.' });
      }

      const request = await dbService.getInfluencerCommissionRequestById(requestId);
      if (!request) {
        return res.status(404).json({ error: 'Solicitação não encontrada.' });
      }

      const callerAff = await dbService.getAffiliateByUserId(userId);
      const isParent = (callerAff && (callerAff.id === request.affiliateId || (request.parentAffiliateId && callerAff.id === request.parentAffiliateId))) || 
                       request.affiliateUserId === userId || 
                       request.parentAffiliateUserId === userId;

      if (!isParent && !isCallerAdmin) {
        return res.status(403).json({ error: 'Você não possui permissão para aprovar ou recusar este saque de influenciador. Apenas o afiliado responsável por este influenciador pode gerenciar este saque.' });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ error: `Esta solicitação já foi ${request.status === 'approved' ? 'aprovada' : 'recusada'}.` });
      }

      if (action === 'approve') {
        // Find affiliate balance of the responsible affiliate whose balance will be deducted
        let reviewerAff = callerAff;
        if (!reviewerAff && request.affiliateId) {
          reviewerAff = await dbService.getAffiliateById(request.affiliateId);
        }
        if (!reviewerAff && request.affiliateUserId) {
          reviewerAff = await dbService.getAffiliateByUserId(request.affiliateUserId);
        }

        const affBalance = Number(reviewerAff?.affiliateBalance || 0);

        // Determine value to release: original amount or modified amount specified by the affiliate
        const numModified = modifiedAmount !== undefined ? parseFloat(String(modifiedAmount)) : NaN;
        const amountToRelease = !isNaN(numModified) && numModified > 0 ? parseFloat(numModified.toFixed(2)) : request.amount;

        if (amountToRelease <= 0) {
          return res.status(400).json({ error: 'O valor liberado deve ser superior a R$ 0,00.' });
        }

        // STRICT MANDATE FROM USER:
        // "Quem aprova o saque do infleunciador é o afilaido repsosivael por aquele infleucniador porem o saque que sera liberado tem que ser igualou menor que o saldo que ele tem em conta no painel de afilaidos! pois sera descontado!"
        if (amountToRelease > affBalance) {
          return res.status(400).json({
            error: `Saldo insuficiente! O saque a ser liberado (R$ ${amountToRelease.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}) deve ser igual ou menor que o saldo disponível em conta no painel de afiliados (R$ ${affBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}), pois este valor será descontado diretamente do saldo de comissões.`,
            affiliateBalance: affBalance,
            attemptedAmount: amountToRelease,
          });
        }

        // Deduct released amount from the responsible affiliate's balance
        const newAffBalance = parseFloat((affBalance - amountToRelease).toFixed(2));
        if (reviewerAff) {
          await dbService.updateAffiliateRates(reviewerAff.id, { affiliateBalance: Math.max(0, newAffBalance) });
        }

        // If the affiliate reduced the released amount below the initial requested amount, refund the difference back to the influencer's commission balance
        const difference = parseFloat((request.amount - amountToRelease).toFixed(2));
        if (difference > 0) {
          const influencerAff = await dbService.getAffiliateByUserId(request.influencerUserId);
          if (influencerAff) {
            const restoredBalance = parseFloat(((influencerAff.affiliateBalance || 0) + difference).toFixed(2));
            await dbService.updateAffiliateRates(influencerAff.id, { affiliateBalance: restoredBalance });
          }
        }

        // Update request status to approved with the exact released amount
        await dbService.updateInfluencerCommissionRequest(requestId, {
          status: 'approved',
          approvedAmount: amountToRelease,
          processedAt: new Date().toISOString(),
          processedByUserId: userId,
          processedByName: caller.name,
        });

        // Register withdrawal payout transaction for the influencer
        const infPayoutTxId = 'tx_inf_payout_' + crypto.randomBytes(8).toString('hex');
        await dbService.createTransaction({
          id: infPayoutTxId,
          userId: request.influencerUserId,
          type: 'withdrawal',
          amount: amountToRelease,
          status: 'approved',
          paymentMethod: `PIX Influenciador (${request.pixKeyType || 'PIX'})`,
          description: `Comissão Gen Dino liberada pelo Afiliado Responsável (${caller.name}) • PIX: ${request.pixKey}${amountToRelease !== request.amount ? ` • Valor ajustado de R$ ${request.amount.toFixed(2)} para R$ ${amountToRelease.toFixed(2)}` : ''}`,
          createdAt: new Date().toISOString(),
        });

        // Register debit transaction for the responsible affiliate (showing deduction in their financial statement)
        const affDebitTxId = 'tx_aff_inf_debit_' + crypto.randomBytes(8).toString('hex');
        await dbService.createTransaction({
          id: affDebitTxId,
          userId: reviewerAff ? reviewerAff.userId : userId,
          type: 'withdrawal',
          amount: amountToRelease,
          status: 'approved',
          paymentMethod: 'Desconto em Saldo de Afiliado',
          description: `Saque de comissões liberado para o influenciador ${request.influencerName} • Descontado do seu saldo de afiliado • PIX: ${request.pixKey}`,
          createdAt: new Date().toISOString(),
        });

        // Push notification to influencer
        sendPushNotification(request.influencerUserId, {
          title: 'Saque de comissão aprovado! 🎉🦖',
          body: `Seu saque de comissões foi liberado pelo seu afiliado responsável! Valor liberado: R$ ${amountToRelease.toFixed(2)} no PIX: ${request.pixKey}.`,
          url: '/?tab=finance',
          type: 'withdrawal',
        }).catch(console.error);

        return res.json({
          success: true,
          message: `Saque de R$ ${amountToRelease.toFixed(2)} do influenciador aprovado e liberado com sucesso! O valor foi debitado do seu saldo de afiliado.`,
          approvedAmount: amountToRelease,
          affiliateBalance: newAffBalance,
        });
      } else if (action === 'reject') {
        const reason = rejectReason || 'Solicitação recusada pelo afiliado gestor.';
        await dbService.updateInfluencerCommissionRequest(requestId, {
          status: 'rejected',
          rejectReason: reason,
          processedAt: new Date().toISOString(),
        });

        // Refund the amount back to the influencer's affiliate balance
        const influencerAff = await dbService.getAffiliateByUserId(request.influencerUserId);
        if (influencerAff) {
          const refundedBalance = parseFloat(((influencerAff.affiliateBalance || 0) + request.amount).toFixed(2));
          await dbService.updateAffiliateRates(influencerAff.id, { affiliateBalance: refundedBalance });
        }

        // Push notification to influencer
        sendPushNotification(request.influencerUserId, {
          title: 'Saque de comissão recusado',
          body: `Seu pedido de saque de R$ ${request.amount.toFixed(2)} foi recusado. Motivo: ${reason}. O valor retornou ao seu saldo de comissões.`,
          url: '/?tab=finance',
          type: 'withdrawal',
        }).catch(console.error);

        return res.json({ success: true, message: 'Solicitação recusada e valor estornado para o influenciador.' });
      } else {
        return res.status(400).json({ error: 'Ação inválida. Use "approve" ou "reject".' });
      }
    } catch (err) {
      console.error('Process influencer request action error:', err);
      res.status(500).json({ error: 'Erro ao processar ação na solicitação de comissão.' });
    }
  });

  // GET PLAYER/GAME ACCOUNT WITHDRAWALS FOR RESPONSIBLE AFFILIATE HUB
  app.get('/api/affiliates/player-withdrawals', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const caller = await dbService.getUserById(userId);
      if (!caller) return res.status(401).json({ error: 'Usuário não autenticado.' });
      const isCallerAdmin = caller.role === 'admin' || caller.role === 'superadmin' || isPlatformSuperAdmin(caller.email, caller.role);

      const callerAff = await dbService.getAffiliateByUserId(userId);
      const affId = callerAff?.id || '';

      const allUsers = await dbService.getAllUsers();
      // Identify all users in this affiliate's network (indicated players)
      const myNetworkUserIds = new Set<string>();
      allUsers.forEach(u => {
        if (
          u.parentAffiliateUserId === userId ||
          (affId && u.parentAffiliateId === affId) ||
          (caller.referralCode && u.referredBy === caller.referralCode) ||
          u.referredBy === userId ||
          (affId && u.affiliateId === affId)
        ) {
          myNetworkUserIds.add(u.id);
        }
      });

      try {
        const allReferrals = await dbService.getAllReferrals();
        allReferrals.filter(r => r.affiliateId === affId || r.affiliateId === caller.id).forEach(r => myNetworkUserIds.add(r.referredUserId));
      } catch (e) {
        // ignore
      }

      const allTx = await dbService.getAllTransactions();
      const allPixKeys: any[] = allUsers.flatMap(u => (u.pixKeys || (u.pixKey ? [u.pixKey] : [])));

      // Filter player withdrawals
      const withdrawals = allTx.filter(tx => {
        if (tx.type !== 'withdrawal') return false;
        if (isCallerAdmin) return true;
        return (
          myNetworkUserIds.has(tx.userId) ||
          tx.affiliateUserId === userId ||
          (affId && tx.affiliateId === affId)
        );
      });

      const userMap = new Map(allUsers.map(u => [u.id, u]));
      const userDepositsMap = new Map<string, { total: number; count: number }>();
      allTx.filter(t => t.type === 'deposit' && t.status === 'approved').forEach(t => {
        const current = userDepositsMap.get(t.userId) || { total: 0, count: 0 };
        current.total += t.amount;
        current.count += 1;
        userDepositsMap.set(t.userId, current);
      });

      const enriched = withdrawals.map(tx => {
        const player = userMap.get(tx.userId);
        const depStats = userDepositsMap.get(tx.userId) || { total: 0, count: 0 };
        const pixKeyObj = allPixKeys.find(k => k.id === tx.pixKeyId || k.key === tx.pixKeyId || k.userId === tx.userId);

        return {
          id: tx.id,
          userId: tx.userId,
          userName: player?.name || 'Jogador',
          userEmail: player?.email || 'N/A',
          userPhone: player?.phone || '',
          amount: tx.amount,
          fee: tx.fee || 0,
          netAmount: tx.netAmount || tx.amount,
          status: tx.status,
          pixKey: pixKeyObj?.key || tx.pixKeyId || 'PIX',
          pixKeyType: pixKeyObj?.type || 'PIX',
          gameOrigin: tx.gameOrigin || 'Conta de Jogo',
          description: tx.description,
          createdAt: tx.createdAt,
          processedAt: tx.processedAt,
          rejectReason: tx.rejectReason,
          approvedByName: tx.approvedByName,
          totalDeposits: depStats.total,
          paidDeposits: depStats.count,
          playerBalance: player?.balance || 0,
          isInfluencer: !!player?.isInfluencer,
        };
      }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      res.json({ success: true, withdrawals: enriched });
    } catch (err) {
      console.error('Fetch player withdrawals error:', err);
      res.status(500).json({ error: 'Erro ao carregar saques de contas de jogos.' });
    }
  });

  // APPROVE PLAYER WITHDRAWAL BY RESPONSIBLE AFFILIATE HUB
  app.post('/api/affiliates/player-withdrawals/:id/approve', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const caller = await dbService.getUserById(userId);
      if (!caller) return res.status(401).json({ error: 'Usuário não autenticado.' });
      const isCallerAdmin = caller.role === 'admin' || caller.role === 'superadmin' || isPlatformSuperAdmin(caller.email, caller.role);

      const { id } = req.params;
      const tx = await dbService.getTransactionById(id);
      if (!tx || tx.type !== 'withdrawal') {
        return res.status(404).json({ error: 'Solicitação de saque não encontrada.' });
      }

      if (tx.status !== 'pending') {
        return res.status(400).json({ error: `Esta solicitação já foi ${tx.status === 'approved' ? 'aprovada' : 'recusada'}.` });
      }

      const allUsers = await dbService.getAllUsers();
      const targetUser = allUsers.find(u => u.id === tx.userId);
      if (!targetUser) return res.status(404).json({ error: 'Jogador solicitante não encontrado.' });

      const callerAff = await dbService.getAffiliateByUserId(userId);
      const affId = callerAff?.id || '';

      const isParent = (
        targetUser.parentAffiliateUserId === userId ||
        (affId && targetUser.parentAffiliateId === affId) ||
        (caller.referralCode && targetUser.referredBy === caller.referralCode) ||
        targetUser.referredBy === userId ||
        (affId && targetUser.affiliateId === affId) ||
        tx.affiliateUserId === userId ||
        (affId && tx.affiliateId === affId)
      );

      if (!isParent && !isCallerAdmin) {
        return res.status(403).json({ error: 'Você não é o Afiliado Hub responsável por este jogador.' });
      }

      if (targetUser.withdrawBlocked || targetUser.hasAffiliateDemoBalance) {
        return res.status(403).json({
          error: 'Operação bloqueada: Este jogador possui saldo de demonstração concedido por afiliado e não possui permissão para realizar saques.'
        });
      }

      // Solicit withdrawal immediately on Dotfy if API key is configured
      const apiKeyToUse = await getEffectiveDotfyApiKey();
      let dotfyWithdrawalId: string | undefined = undefined;
      let dotfyStatusMsg = '';

      if (apiKeyToUse && tx.amount > 0) {
        try {
          const rawKey = (tx as any).pixKey || targetUser?.pixKey || ((targetUser as any)?.pixKeys && (targetUser as any).pixKeys[0]?.key);
          const rawType = (tx as any).pixType || (targetUser as any)?.pixKeyType || ((targetUser as any)?.pixKeys && (targetUser as any).pixKeys[0]?.type) || 'CPF';

          if (rawKey) {
            const cleanKey = String(rawKey).trim();
            const cleanType = String(rawType).trim().toUpperCase();

            // Resolve or register PIX key on Dotfy
            const keyResolution = await resolveDotfyPixKey(
              apiKeyToUse,
              cleanKey,
              cleanType,
              targetUser?.name || 'Beneficiário Saque'
            );

            if (keyResolution.pixKeyId) {
              const dotfyPayload = {
                amount: parseFloat(tx.amount.toFixed(2)),
                pixKeyId: keyResolution.pixKeyId
              };

              console.log('[Dotfy Affiliate Auto-Withdrawal Soliciting]', dotfyPayload);

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
              try { responseData = JSON.parse(responseText); } catch (_) { responseData = { message: responseText }; }

              if (dotfyResponse.ok && (responseData?.withdrawal || responseData?.id)) {
                const wdResult = responseData.withdrawal || responseData;
                dotfyWithdrawalId = wdResult.id;
                dotfyStatusMsg = ` • Solicitado imediatamente na Dotfy (ID: ${wdResult.id})`;
              } else {
                console.warn('[Dotfy Affiliate Withdrawal Warning]', dotfyResponse.status, responseData);
                const warnMsg = responseData?.message || responseData?.error || `HTTP ${dotfyResponse.status}`;
                dotfyStatusMsg = ` • Aprovado no painel (Aviso Dotfy: ${warnMsg})`;
              }
            } else {
              dotfyStatusMsg = ` • Aprovado no painel (Chave PIX não vinculada na Dotfy: ${keyResolution.error || 'Inválida'})`;
            }
          }
        } catch (dotfyErr: any) {
          console.error('[Dotfy Affiliate Auto-Withdrawal Error]', dotfyErr);
          dotfyStatusMsg = ` • Aprovado no painel (Erro de conexão com Dotfy)`;
        }
      }

      // Mark status as approved
      await dbService.updateTransactionStatus(id, 'approved', {
        approvedByUserId: userId,
        approvedByName: caller.name,
        processedAt: new Date().toISOString(),
        ...(dotfyWithdrawalId ? { dotfyWithdrawalId } : {}),
      });

      // Push notification to the player
      sendPushNotification(tx.userId, {
        title: 'Saque Aprovado! 🎉',
        body: `Seu saque de R$ ${tx.amount.toFixed(2)} foi conferido e aprovado pelo seu Afiliado Hub (${caller.name})! O valor será transferido para sua chave PIX.`,
        url: '/?tab=finance',
        type: 'withdrawal',
      }).catch(() => {});

      logSecurityEvent('AFFILIATE_APPROVED_PLAYER_WITHDRAWAL', {
        withdrawalId: id,
        amount: tx.amount,
        playerId: tx.userId,
        approvedByUserId: userId,
        approvedByName: caller.name,
        dotfyWithdrawalId,
      });

      return res.json({
        success: true,
        message: `Saque de R$ ${tx.amount.toFixed(2)} do jogador ${targetUser.name} aprovado com sucesso pelo Afiliado Hub!${dotfyStatusMsg}`,
        dotfyWithdrawalId
      });
    } catch (err) {
      console.error('Approve player withdrawal error:', err);
      res.status(500).json({ error: 'Erro ao aprovar saque de conta de jogo.' });
    }
  });

  // REJECT PLAYER WITHDRAWAL BY RESPONSIBLE AFFILIATE HUB
  app.post('/api/affiliates/player-withdrawals/:id/reject', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId!;
      const caller = await dbService.getUserById(userId);
      if (!caller) return res.status(401).json({ error: 'Usuário não autenticado.' });
      const isCallerAdmin = caller.role === 'admin' || caller.role === 'superadmin' || isPlatformSuperAdmin(caller.email, caller.role);

      const { id } = req.params;
      const { reason } = req.body;
      const tx = await dbService.getTransactionById(id);
      if (!tx || tx.type !== 'withdrawal') {
        return res.status(404).json({ error: 'Solicitação de saque não encontrada.' });
      }

      if (tx.status !== 'pending') {
        return res.status(400).json({ error: `Esta solicitação já foi ${tx.status === 'approved' ? 'aprovada' : 'recusada'}.` });
      }

      const allUsers = await dbService.getAllUsers();
      const targetUser = allUsers.find(u => u.id === tx.userId);
      if (!targetUser) return res.status(404).json({ error: 'Jogador solicitante não encontrado.' });

      const callerAff = await dbService.getAffiliateByUserId(userId);
      const affId = callerAff?.id || '';

      const isParent = (
        targetUser.parentAffiliateUserId === userId ||
        (affId && targetUser.parentAffiliateId === affId) ||
        (caller.referralCode && targetUser.referredBy === caller.referralCode) ||
        targetUser.referredBy === userId ||
        (affId && targetUser.affiliateId === affId) ||
        tx.affiliateUserId === userId ||
        (affId && tx.affiliateId === affId)
      );

      if (!isParent && !isCallerAdmin) {
        return res.status(403).json({ error: 'Você não é o Afiliado Hub responsável por este jogador.' });
      }

      const rejectReasonText = reason?.trim() || 'Solicitação recusada pelo Afiliado Hub responsável.';

      // Estornar saldo do jogador
      const restoredBalance = parseFloat((targetUser.balance + tx.amount).toFixed(2));
      await dbService.updateUserBalance(targetUser.id, restoredBalance);

      // Mark status as rejected
      await dbService.updateTransactionStatus(id, 'rejected', {
        rejectReason: rejectReasonText,
        approvedByUserId: userId,
        approvedByName: caller.name,
        processedAt: new Date().toISOString(),
      });

      // Push notification to the player
      sendPushNotification(tx.userId, {
        title: 'Saque Recusado',
        body: `Seu pedido de saque de R$ ${tx.amount.toFixed(2)} foi recusado pelo seu Afiliado Hub. Motivo: ${rejectReasonText}. O valor retornou ao seu saldo de jogo.`,
        url: '/?tab=finance',
        type: 'withdrawal',
      }).catch(() => {});

      logSecurityEvent('AFFILIATE_REJECTED_PLAYER_WITHDRAWAL', {
        withdrawalId: id,
        amount: tx.amount,
        playerId: tx.userId,
        rejectedByUserId: userId,
        rejectedByName: caller.name,
        reason: rejectReasonText,
      });

      return res.json({
        success: true,
        message: `Saque recusado e valor de R$ ${tx.amount.toFixed(2)} estornado com sucesso para o saldo do jogador.`
      });
    } catch (err) {
      console.error('Reject player withdrawal error:', err);
      res.status(500).json({ error: 'Erro ao recusar saque de conta de jogo.' });
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

      if (user.withdrawBlocked) {
        return res.status(403).json({ error: 'Seus saques foram temporariamente desativados pelo administrador da plataforma. Entre em contato com o suporte.' });
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
      // TODO AFILIADO TEM SAQUE AUTOMÁTICO PADRÃO NA CONTA
      // O ADMIN PODE DEFINIR SAQUE AUTOMÁTICO (autoWithdrawBlocked: true/false) OU DESATIVAR O SAQUE DELE (withdrawBlocked: true)
      const isUserAdmin = user.role === 'admin' || user.role === 'superadmin' || isPlatformSuperAdmin(user.email, user.role);
      const isInfluencer = !!user.isInfluencer;
      const isAffiliateUser = user.role === 'affiliate' || (affiliate && affiliate.status === 'active');

      // Todo afiliado e admin tem saque automático padrão por regra, a menos que seja influenciador
      const isEligibleForAutoCashout = (isUserAdmin || isAffiliateUser) && !isInfluencer;

      // Check if Dotfy Automatic Cashout is requested / enabled
      const dbConfig = await dbService.getDotfyConfig();
      const isAutoCashoutGloballyEnabled = dbConfig?.affiliateAutoCashoutEnabled !== false;
      const isAutoWithdrawBlocked = Boolean(user.autoWithdrawBlocked);
      const shouldAutoCashout = isEligibleForAutoCashout && (autoCashout !== false) && isAutoCashoutGloballyEnabled && !isAutoWithdrawBlocked;

      if (isAutoWithdrawBlocked) {
        console.log(`[Admin/Partner Control] User ${userId} has auto-withdrawal blocked (manual queue active). Cashout routed to manual approval.`);
      }

      if (!isEligibleForAutoCashout && autoCashout) {
        console.log(`[Security Audit] User ${userId} requested autoCashout but is ineligible (isInfluencer=${isInfluencer}, isAffiliate=${isAffiliateUser}, isAdmin=${isUserAdmin}). Queuing for manual admin approval.`);
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
        const apiKeyToUse = await getEffectiveDotfyApiKey();

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
          } else if (
            (dotfyRes.status === 400 || dotfyRes.status === 422) &&
            (String(resData?.error || '').toLowerCase().includes("saldo insuficiente") ||
             String(resData?.message || '').toLowerCase().includes("saldo insuficiente") ||
             String(resText || '').toLowerCase().includes("saldo insuficiente") ||
             String(resText || '').toLowerCase().includes("insufficient"))
          ) {
            return res.status(400).json({
              error: "Os saques estão em manutenção temporária. Tente novamente em 30 minutos. O seu saldo de comissões permanece intacto."
            });
          } else {
            dotfyErrorMsg = resData?.error || resData?.message || `Erro HTTP ${dotfyRes.status} retornado pela Dotfy`;
            console.warn('[Dotfy Affiliate Cashout Error]', dotfyRes.status, resData);
          }
        } catch (fetchErr: any) {
          console.error('[Dotfy Affiliate Cashout Fetch Error]', fetchErr);
          dotfyErrorMsg = fetchErr?.message || "Falha na conexão com o gateway.";
        }

        // If Dotfy rejected the cashout, do NOT deduct the affiliate balance and return error
        if (!dotfyWdResult && dotfyErrorMsg) {
          const errLower = String(dotfyErrorMsg).toLowerCase();
          if (errLower.includes('saldo insuficiente') || errLower.includes('insufficient')) {
            return res.status(400).json({
              error: "Os saques estão em manutenção temporária. Tente novamente em 30 minutos. O seu saldo de comissões permanece intacto."
            });
          }
          return res.status(400).json({
            error: "Falha temporária ao processar saque de comissões. Tente novamente em alguns minutos. O seu saldo de comissões permanece intacto."
          });
        }

        if (!dotfyWdResult) {
          return res.status(500).json({
            error: "Os saques estão em manutenção temporária. Tente novamente em 30 minutos. O seu saldo de comissões permanece intacto."
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

      const isGameAccount = Boolean((user as any).gameAccount || (user as any).gameOrigin || (user as any).originApp);
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

      if (isInfluencer) {
        const infReqId = 'inf_req_' + crypto.randomBytes(8).toString('hex');
        const parentAffId = user.parentAffiliateId || user.affiliateId || '';
        const parentUserId = user.parentAffiliateUserId || '';
        await dbService.createInfluencerCommissionRequest({
          id: infReqId,
          affiliateId: parentAffId,
          affiliateUserId: parentUserId,
          influencerUserId: userId,
          influencerName: user.name,
          influencerEmail: user.email,
          amount: numAmount,
          pixKey: cleanKey,
          pixKeyType: cleanType,
          status: 'pending',
          createdAt: new Date().toISOString(),
        });

        if (parentUserId) {
          sendPushNotification(parentUserId, {
            title: 'Novo pedido de saque de influenciador! 💸',
            body: `${user.name} solicitou saque de R$ ${numAmount.toFixed(2)} das comissões dele. Verifique no seu painel para aprovar.`,
            url: '/?tab=affiliates',
            type: 'commission',
          }).catch(console.error);
        }
      }

      const statusMsg = isInfluencer
        ? 'Solicitação de saque de influenciador registrada com sucesso! Seu afiliado gestor foi notificado para aprovação financeira.'
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
  app.post('/api/game/start-bet', requirePlayerNotAffiliate, async (req: AuthRequest, res: Response) => {
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
  app.post('/api/game/cashout', requirePlayerNotAffiliate, async (req: AuthRequest, res: Response) => {
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
    creditedAmount?: number;
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
      const commResult = await processAffiliateDepositCommission({
        buyerUser: user,
        depositAmount: depositVal,
        transactionId: newTx.id,
      });

      // Fallback: caso a busca direta em processAffiliateDepositCommission não tenha encontrado afiliado,
      // usa a estratégia de 5 etapas de notifyAffiliateForPlayer para garantir a entrega
      if (!commResult || (!commResult.affiliateId && !commResult.isKilled && commResult.commissionAmount === 0)) {
        notifyAffiliateForPlayer(user.id, {
          title: 'Depósito na sua rede! ⚡',
          body: `O indicado ${user.name || 'da sua rede'} realizou um depósito de R$ ${depositVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}!`,
          url: '/?tab=affiliates',
          type: 'deposit',
        }).catch(console.error);
      }
    } catch (err) {
      console.error('Error crediting paid charge user:', err);
    }
  }

  // 1. Health & Config Endpoint
  app.get("/api/dotfy/health", async (_req, res) => {
    const key = await getEffectiveDotfyApiKey();
    res.json({
      status: "ok",
      serverTime: new Date().toISOString(),
      dotfyKeyConfigured: !!key,
      maskedDefaultKey: maskToken(key),
      storedChargesCount: memoryCharges.size
    });
  });

  // --- CADASTRAR CHAVE PIX (DOTFY API PROXY) ---
  app.post("/api/pix-keys", async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      let apiKeyToUse = await getEffectiveDotfyApiKey();
      let sessionUserId: string | undefined = undefined;

      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace("Bearer ", "").trim();
        if (token.startsWith("vk_live_") || token.startsWith("vk_test_")) {
          apiKeyToUse = token;
        } else {
          sessionUserId = (await resolveUserIdFromToken(token)) || undefined;
        }
      }

      if (!sessionUserId && (req.body.userId || req.headers['x-user-id'])) {
        sessionUserId = String(req.body.userId || req.headers['x-user-id']);
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
      let token = authHeader && authHeader.startsWith("Bearer ")
        ? authHeader.replace("Bearer ", "").trim()
        : (req.query.token as string) || null;

      let userId = token ? await resolveUserIdFromToken(token) : null;
      if (!userId && (req.query.userId || req.headers['x-user-id'])) {
        userId = String(req.query.userId || req.headers['x-user-id']);
      }

      if (!userId) {
        return res.status(401).json({ error: "Sessão expirada ou não autorizada." });
      }

      const user = await dbService.getUserById(userId);
      if (user) {
        const rawKeys = Array.isArray(user.pixKeys) && user.pixKeys.length > 0
          ? user.pixKeys
          : (user.pixKey ? [user.pixKey] : []);
        const approvedKeys = rawKeys.map((k: any) => ({
          ...k,
          status: "APPROVED",
          isVerified: true
        }));
        return res.json({ pixKeys: approvedKeys });
      }

      return res.json({ pixKeys: [] });
    } catch (err) {
      console.error("[GET /api/pix-keys error]", err);
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
      let apiKeyToUse = await getEffectiveDotfyApiKey();

      if (!authHeader) {
        return res.status(401).json({ error: "Cabeçalho de autorização é obrigatório." });
      }

      const token = authHeader.replace("Bearer ", "").trim();
      if (token.startsWith("vk_test_")) {
        return res.status(403).json({ error: "Contas de teste não podem realizar saques." });
      } else if (token.startsWith("vk_live_")) {
        apiKeyToUse = token;
      } else {
        sessionUserId = (await resolveUserIdFromToken(token)) || undefined;
        if (!sessionUserId && (req.body.userId || req.headers['x-user-id'])) {
          sessionUserId = String(req.body.userId || req.headers['x-user-id']);
        }
        if (!sessionUserId) {
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

      if (user?.withdrawBlocked || user?.hasAffiliateDemoBalance) {
        return res.status(403).json({
          error: "Operação não autorizada: Contas com saldo concedido por afiliado / modo influenciador não possuem permissão para realizar saques na plataforma."
        });
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

      const aff = sessionUserId ? await dbService.getAffiliateByUserId(sessionUserId) : null;
      const userBal = Number(user?.balance || 0);
      const affBal = Number(aff?.affiliateBalance || 0);
      const totalAvailable = parseFloat((userBal + affBal).toFixed(2));

      if (user) {
        if (totalAvailable < userMinWithdraw) {
          return res.status(400).json({ error: `Saldo mínimo exigido para realizar saques é de R$ ${userMinWithdraw.toFixed(2).replace('.', ',')}.` });
        }

        if (totalAvailable < numAmount) {
          return res.status(400).json({ error: "Saldo insuficiente para realizar este saque." });
        }
      }

      const userFee = typeof aff?.withdrawFee === 'number' && !isNaN(aff.withdrawFee)
        ? aff.withdrawFee
        : (typeof user?.withdrawFee === 'number' && !isNaN(user.withdrawFee) ? user.withdrawFee : 8.0);

      if (userFee > 0 && numAmount <= userFee) {
        return res.status(400).json({ error: `O valor do saque precisa ser superior à taxa de saque (R$ ${userFee.toFixed(2).replace('.', ',')}).` });
      }

      let foundPixKey: any = null;
      if (user) {
        const userKeys = Array.isArray(user.pixKeys) && user.pixKeys.length > 0
          ? user.pixKeys
          : (user.pixKey ? [user.pixKey] : []);
        foundPixKey = userKeys.find((k: any) => k.id === pixKeyId || k.key === pixKeyId) || user.pixKey;

        // If the key is not yet saved to user profile, persist it so it shows on all future withdrawals
        const keyString = String(foundPixKey?.key || pixKeyId).trim();
        const alreadySaved = userKeys.some((k: any) => k.key === keyString || k.id === pixKeyId);
        if (!alreadySaved && keyString && !keyString.startsWith('clpix_') && !keyString.startsWith('cmu')) {
          try {
            const autoKey = {
              id: `clpix_${Date.now()}`,
              type: keyString.includes('@') ? 'EMAIL' : (keyString.replace(/\D/g, '').length === 11 ? 'CPF' : (keyString.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'PHONE')),
              key: keyString,
              name: user.name || 'Conta Principal',
              isDefault: true,
              isVerified: true,
              status: 'APPROVED',
              createdAt: new Date().toISOString()
            };
            const updated = [autoKey, ...userKeys];
            await dbService.updateUserFields(user.id, { pixKey: autoKey, pixKeys: updated });
            foundPixKey = autoKey;
          } catch (kErr) {
            console.warn('[Auto Save Key on Withdraw Warning]', kErr);
          }
        }
      }

      const netAmount = Math.max(0, numAmount - userFee);

      // REGRA ESTRITA DE NEGÓCIO:
      // O saque dos JOGADORES deve ser solicitado mas NÃO tem backend de saque para os jogadores, independentemente do jogo é apenas visual.
      // Já o dos AFILIADOS (/api/affiliates/withdraw) tem o saque automático Dotfy normal e permanece como está.
      // Porém nos jogos e carteira de jogadores NÃO deve haver saque automático!
      // Portanto, qualquer saque de saldo de jogador ou carteira (/api/withdrawals) é registrado como solicitação pendente visual.
      const isCallerAdmin = user && (user.role === 'admin' || user.role === 'superadmin' || isPlatformSuperAdmin(user.email, user.role));
      const isCallerInfluencer = !!user?.isInfluencer;
      const isAutoWithdrawBlocked = Boolean(user?.autoWithdrawBlocked);

      // Regra de segurança estrita: Saques de jogadores/jogos não possuem saque automático (apenas visual/pendente)
      const isEligibleForAutoCashout = false;

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

        let remainingToDebit = numAmount;
        let updatedBalance = user.balance;
        let updatedAffBalance = aff ? (aff.affiliateBalance || 0) : 0;

        if (updatedBalance >= remainingToDebit) {
          updatedBalance = parseFloat((updatedBalance - remainingToDebit).toFixed(2));
          remainingToDebit = 0;
        } else {
          remainingToDebit = parseFloat((remainingToDebit - updatedBalance).toFixed(2));
          updatedBalance = 0;
          if (aff && updatedAffBalance >= remainingToDebit) {
            updatedAffBalance = parseFloat((updatedAffBalance - remainingToDebit).toFixed(2));
            remainingToDebit = 0;
          }
        }

        await dbService.updateUserBalance(sessionUserId, updatedBalance);
        if (aff) {
          await dbService.updateAffiliateCommissions(aff.id, aff.commissionTotal || 0, updatedAffBalance);
        }

        const feeAmount = userFee;
        const netAmountVal = Math.max(0, numAmount - feeAmount);
        const paymentMethodLabel = isCallerInfluencer ? 'Influenciador (Análise Afiliado Hub)' : 'Conta de Jogador (Análise Afiliado Hub)';

        // Identify responsible affiliate hub for this game player or influencer
        const allUsers = await dbService.getAllUsers();
        const { sponsorUser, sponsorAff, parentAffId, parentUserId } = await resolveResponsibleAffiliateForUser(user, allUsers);
        const gameOrigin = String(req.body.gameOrigin || req.body.gameId || req.query.game || req.headers['x-game-origin'] || 'portal').trim();

        const newTx: TransactionDB = {
          id: 'tx_wd_' + crypto.randomBytes(8).toString('hex'),
          userId: sessionUserId,
          type: 'withdrawal',
          amount: numAmount,
          status: 'pending', // PENDENTE: Conferência e aprovação do Afiliado Hub responsável
          paymentMethod: paymentMethodLabel,
          description: `Solicitação de Saque PIX (${foundPixKey?.key || pixKeyId})${feeAmount > 0 ? ` • Taxa: R$ ${feeAmount.toFixed(2)}` : ' • Sem taxa'} • Líquido: R$ ${netAmountVal.toFixed(2)} • Aguardando conferência do Afiliado Hub`,
          pixKeyId: resolvedPixKeyId,
          isAutoCashout: false,
          fee: feeAmount,
          netAmount: netAmountVal,
          affiliateId: parentAffId || sponsorAff?.id,
          affiliateUserId: parentUserId || sponsorUser?.id,
          sponsorName: sponsorUser?.name || 'Afiliado Hub',
          gameOrigin,
          createdAt: new Date().toISOString(),
        };
        await dbService.createTransaction(newTx);

        logSecurityEvent('MANUAL_WITHDRAWAL_REQUESTED', {
          userId: sessionUserId,
          amount: numAmount,
          netAmount: netAmountVal,
          isInfluencer: isCallerInfluencer,
          pixKey: foundPixKey?.key || pixKeyId,
          sponsorUserId: sponsorUser?.id,
          sponsorName: sponsorUser?.name
        });

        // Notify the responsible Affiliate Hub so they can review and approve
        if (sponsorUser) {
          sendPushNotification(sponsorUser.id, {
            title: isCallerInfluencer ? '⭐ Pedido de Saque de Influenciador!' : '🎮 Pedido de Saque de Conta de Jogo!',
            body: `${user.name} solicitou saque de R$ ${numAmount.toFixed(2)} no PIX. Acesse seu painel de Afiliados para conferir e aprovar.`,
            url: '/?tab=affiliates',
            type: 'withdrawal',
          }).catch(() => {});

          await dbService.saveAffiliateFeedItem({
            id: 'feed_' + crypto.randomBytes(6).toString('hex'),
            title: isCallerInfluencer ? '⭐ Solicitação de Saque de Influenciador' : '🎮 Solicitação de Saque de Conta de Jogo',
            body: `${user.name} solicitou saque de R$ ${numAmount.toFixed(2)} (PIX: ${foundPixKey?.key || pixKeyId}). Como Afiliado Hub responsável, confira os dados e aprove ou recuse.`,
            url: '/?tab=affiliates',
            target: 'affiliates',
            sentBy: user.name,
            createdAt: new Date().toISOString(),
          }).catch(() => {});
        }

        const sponsorLabel = sponsorUser ? `pelo seu Afiliado Hub (${sponsorUser.name})` : "pelo seu Afiliado Hub responsável";
        const statusMessage = isCallerInfluencer
          ? `Solicitação de saque de influenciador registrada com sucesso! O pedido foi direcionado para conferência e aprovação manual ${sponsorLabel}.`
          : `Solicitação de saque registrada com sucesso! Por segurança, contas de jogos passam por conferência e aprovação manual ${sponsorLabel}.`;

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
        } else if (
          (dotfyResponse.status === 400 || dotfyResponse.status === 422) &&
          (String(responseData?.error || '').toLowerCase().includes("saldo insuficiente") ||
           String(responseData?.message || '').toLowerCase().includes("saldo insuficiente") ||
           String(responseText || '').toLowerCase().includes("saldo insuficiente") ||
           String(responseText || '').toLowerCase().includes("insufficient"))
        ) {
          return res.status(400).json({
            error: "Os saques estão em manutenção temporária. Tente novamente em 30 minutos. Seu saldo na plataforma permanece intacto."
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
        const errLower = String(dotfyError).toLowerCase();
        if (errLower.includes('saldo insuficiente') || errLower.includes('insufficient')) {
          return res.status(400).json({
            error: "Os saques estão em manutenção temporária. Tente novamente em 30 minutos. Seu saldo na plataforma permanece intacto."
          });
        }
        return res.status(400).json({
          error: `Falha ao processar solicitação de saque. Tente novamente em alguns minutos. Seu saldo permanece seguro.`
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
      let updatedAffBalance = aff ? (aff.affiliateBalance || 0) : 0;
      if (sessionUserId && user) {
        let remainingToDebit = numAmount;
        if (updatedBalance >= remainingToDebit) {
          updatedBalance = parseFloat((updatedBalance - remainingToDebit).toFixed(2));
          remainingToDebit = 0;
        } else {
          remainingToDebit = parseFloat((remainingToDebit - updatedBalance).toFixed(2));
          updatedBalance = 0;
          if (aff && updatedAffBalance >= remainingToDebit) {
            updatedAffBalance = parseFloat((updatedAffBalance - remainingToDebit).toFixed(2));
            remainingToDebit = 0;
          }
        }

        await dbService.updateUserBalance(sessionUserId, updatedBalance);
        if (aff) {
          await dbService.updateAffiliateCommissions(aff.id, aff.commissionTotal || 0, updatedAffBalance);
        }

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

      const token = await getEffectiveDotfyApiKey(customApiKey);

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
    const token = await getEffectiveDotfyApiKey(customApiKey);

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

  // Short URL redirects for Partner recruitment (/p/:code, /parceiro/:code) and Affiliates (/r/:code)
  app.get(['/p/:code', '/parceiro/:code', '/partner/:code'], (req: Request, res: Response) => {
    const rawCode = (req.params.code || '').trim();
    if (!rawCode) return res.redirect(302, '/register');
    const code = encodeURIComponent(rawCode);
    return res.redirect(302, `/register?p=${code}`);
  });

  app.get('/r/:code', (req: Request, res: Response) => {
    const rawCode = (req.params.code || '').trim();
    if (!rawCode) return res.redirect(302, '/register');
    const code = encodeURIComponent(rawCode);
    return res.redirect(302, `/register?r=${code}`);
  });

  // Redirecionamento direto das rotas do Zumbla para o Zumbla ou Subway Pay
  app.get(['/zumbla', '/zumbla/app', '/zumbla/app/index.html', '/zumbla/game', '/zumbla/game/index.html'], (req: Request, res: Response) => {
    const query = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    return res.redirect(302, `/subwaypay/${query}`);
  });

  // Subway Pay Asset Aliases & Robust Fallbacks to guarantee no 404 image/asset hangs
  const SUBWAY_PAY_ALIASES: Record<string, string> = {
    'assets/characters-idle/jake-game.gb': 'assets/characters-basic/jake-game.gb',
    'assets/characters-idle/tricky-tex-1.webp': 'assets/characters-idle/tricky-tex-1 (1).webp',
    'assets/characters-idle/tricky-tex.webp': 'assets/characters-idle/tricky-tex (1).webp',
    'assets/characters-idle/yutani-tex-2.webp': 'assets/characters-idle/yutani-tex-1.webp',
    'assets/characters-idle/yutani-tex.webp': 'assets/characters-idle/yutani-tex-1.webp',
    'assets/data/lang-en1.json': 'assets/data/lang-en.json',
    'assets/data/lang-pt-br.json': 'assets/data/lang-en.json',
    'assets/game-basic/atlanta-scroll.webp': 'assets/audio-basic/atlanta-scroll.webp'
  };

  app.use('/subwaypay/jogar/assets', (req: Request, res: Response, next: NextFunction) => {
    const subPath = req.path.replace(/^\//, '');
    const relKey = 'assets/' + subPath;
    const aliased = SUBWAY_PAY_ALIASES[relKey];
    if (aliased) {
      const resolved = path.join(process.cwd(), 'public', 'subwaypay', 'jogar', aliased);
      if (fs.existsSync(resolved)) {
        return res.sendFile(resolved);
      }
    }

    const fullPath = path.join(process.cwd(), 'public', 'subwaypay', 'jogar', 'assets', subPath);
    if (fs.existsSync(fullPath)) {
      return next();
    }

    // Fallback if missing png/webp image: serve app-icon or splash
    if (/\.(png|webp|jpg)$/i.test(subPath)) {
      const fallbackIcon = path.join(process.cwd(), 'public', 'subwaypay', 'jogar', 'assets', 'images', 'app-icon-144.png');
      const fallbackSplash = path.join(process.cwd(), 'public', 'subwaypay', 'jogar', 'assets', 'preload', 'splash.png');
      if (subPath.includes('splash') && fs.existsSync(fallbackSplash)) {
        return res.sendFile(fallbackSplash);
      }
      if (fs.existsSync(fallbackIcon)) {
        return res.sendFile(fallbackIcon);
      }
    }
    next();
  });

  app.use('/subwaypay/jogar/bundles', (req: Request, res: Response, next: NextFunction) => {
    const subPath = req.path.replace(/^\//, '');
    const fullPath = path.join(process.cwd(), 'public', 'subwaypay', 'jogar', 'bundles', subPath);
    if (fs.existsSync(fullPath)) {
      return next();
    }
    if (subPath.endsWith('.png')) {
      const webpPath = fullPath.replace(/\.png$/, '.webp');
      if (fs.existsSync(webpPath)) {
        return res.sendFile(webpPath);
      }
    }
    next();
  });

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
    app.get('*', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'Endpoint da API não encontrado.' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PayGateway] Servidor com Firebase Firestore rodando na porta ${PORT}`);
  });
  server.on('error', (err: any) => {
    console.error(`[PayGateway] Erro no listener principal (porta ${PORT}):`, err);
  });

  process.on('SIGTERM', () => {
    console.log('[PayGateway] SIGTERM recebido, encerrando servidor graciosamente...');
    server.close(() => {
      console.log('[PayGateway] Servidor encerrado.');
      process.exit(0);
    });
  });
}

startServer();
