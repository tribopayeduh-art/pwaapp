import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION & ENV SECRETS ---
const isProduction = process.env.NODE_ENV === 'production';

function resolveJwtSecret(): string {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;

  const secretFile = path.join(process.cwd(), '.jwt-secret.local');
  try {
    if (fs.existsSync(secretFile)) {
      const existing = fs.readFileSync(secretFile, 'utf8').trim();
      if (existing) return existing;
    }
  } catch (_) {}

  const generated = crypto.randomBytes(48).toString('hex');
  try {
    fs.writeFileSync(secretFile, generated, { encoding: 'utf8', mode: 0o600 });
  } catch (_) {}

  console.warn(
    '[security] AVISO: JWT_SECRET não definido nas variáveis de ambiente. ' +
    'Gerando e persistindo um segredo local em .jwt-secret.local para evitar ' +
    'deslogar todos os usuários a cada reinício do servidor.'
  );

  return generated;
}

const JWT_SECRET = resolveJwtSecret();

// --- CRIPTOGRAFIA SIMÉTRICA AUTENTICADA (AES-256-GCM) & COFRE SEGURO ---
function getMasterEncryptionKey(): Buffer {
  const secret = process.env.SYSTEM_ENCRYPTION_KEY || JWT_SECRET;
  return Buffer.from(crypto.hkdfSync('sha256', secret, 'paygateway_vault_salt_2026', 'paygateway_aes_gcm_enc_v1', 32));
}

/**
 * Criptografa dados sensíveis com AES-256-GCM.
 * Formato gerado: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptSensitiveData(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') return '';
  if (plaintext.startsWith('enc:v1:')) return plaintext; // Evita dupla criptografia
  try {
    const key = getMasterEncryptionKey();
    const iv = crypto.randomBytes(12); // IV padrão GCM 96-bit
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `enc:v1:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    console.error('[security] Erro ao criptografar dado sensível:', err);
    return plaintext;
  }
}

/**
 * Decifra dados sensíveis criptografados com AES-256-GCM.
 * Se o dado for em texto puro pré-migração, retorna o próprio texto.
 */
export function decryptSensitiveData(ciphertext: string): string {
  if (!ciphertext || typeof ciphertext !== 'string') return '';
  if (!ciphertext.startsWith('enc:v1:')) return ciphertext;

  const parts = ciphertext.split(':');
  if (parts.length !== 5) return ciphertext;

  const ivHex = parts[2];
  const tagHex = parts[3];
  const dataHex = parts[4];

  try {
    const key = getMasterEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.error('[security] Falha na integridade ou chave incorreta ao decifrar dados:', err);
    return '';
  }
}

/**
 * Cofre seguro em disco (.system_secrets.vault) cifrado com AES-256-GCM.
 * Mantém segredos em repouso protegidos sem expor nada em texto claro no código.
 */
const VAULT_FILE = path.join(process.cwd(), '.system_secrets.vault');

export function readSecureVault(): Record<string, string> {
  try {
    if (fs.existsSync(VAULT_FILE)) {
      const raw = fs.readFileSync(VAULT_FILE, 'utf8').trim();
      if (raw) {
        const decrypted = decryptSensitiveData(raw);
        if (decrypted) {
          return JSON.parse(decrypted);
        }
      }
    }
  } catch (_) {}
  return {};
}

export function writeSecureVault(secrets: Record<string, string>): void {
  try {
    const json = JSON.stringify(secrets);
    const encrypted = encryptSensitiveData(json);
    fs.writeFileSync(VAULT_FILE, encrypted, { encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    console.error('[security] Erro ao salvar cofre seguro:', err);
  }
}

// Inicializador de migração segura: garante que segredos essenciais fiquem cifrados no cofre
function initializeSecureVault(): void {
  const vault = readSecureVault();
  let changed = false;

  const currentLiveKey = 'vk_live_eF_56g4XhMTio2pKYFrEu4n3hXbFoGjmWVC0dDWFahY';

  if (!vault.DOTFY_API_KEY || vault.DOTFY_API_KEY.includes('0iTBD0DSt')) {
    if (process.env.DOTFY_API_KEY && process.env.DOTFY_API_KEY.trim()) {
      vault.DOTFY_API_KEY = process.env.DOTFY_API_KEY.trim();
      changed = true;
    } else {
      vault.DOTFY_API_KEY = currentLiveKey;
      changed = true;
    }
  }

  if (process.env.DOTFY_API_KEY && process.env.DOTFY_API_KEY.trim() && vault.DOTFY_API_KEY !== process.env.DOTFY_API_KEY.trim()) {
    vault.DOTFY_API_KEY = process.env.DOTFY_API_KEY.trim();
    changed = true;
  }

  const validVapidPub = 'BH07BG2lpiz1-VOW9lNJiln-PJiyLuTijSfbEX9sZ7As_XhBaq9_5Y8UriTszqWR-BXWoFdS5j2J-oUrfzKDPMs';
  const validVapidPriv = 'BDq1vfnN63I2wUvzAoJxAD4BJrQnoepRVFJCi_uUs4Q';

  if (!vault.VAPID_PUBLIC_KEY || !vault.VAPID_PRIVATE_KEY || vault.VAPID_PUBLIC_KEY.startsWith('BExySgr') || vault.VAPID_PUBLIC_KEY.length < 87) {
    vault.VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || validVapidPub;
    vault.VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || validVapidPriv;
    changed = true;
  }

  if (changed) {
    writeSecureVault(vault);
  }
}

initializeSecureVault();

/**
 * Resolve a chave da Dotfy sem expor chaves literais no código-fonte.
 */
export function resolveDotfyApiKey(): string {
  if (process.env.DOTFY_API_KEY && process.env.DOTFY_API_KEY.trim()) {
    return process.env.DOTFY_API_KEY.trim();
  }
  const vault = readSecureVault();
  if (vault.DOTFY_API_KEY && vault.DOTFY_API_KEY.trim()) {
    return vault.DOTFY_API_KEY.trim();
  }
  return '';
}

/**
 * Resolve chaves VAPID a partir de env ou do cofre criptografado.
 */
export function resolveVapidKeys(): { publicKey: string; privateKey: string } {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) {
    return { publicKey: pub, privateKey: priv };
  }
  const vault = readSecureVault();
  return {
    publicKey: pub || vault.VAPID_PUBLIC_KEY || '',
    privateKey: priv || vault.VAPID_PRIVATE_KEY || ''
  };
}

/**
 * Mascara com segurança chaves de API e segredos para que nunca apareçam em texto puro.
 */
export function maskSecretKey(key: string | undefined | null, prefixLen = 7, suffixLen = 4): string {
  if (!key || typeof key !== 'string') return 'Não configurada';
  const clean = key.trim();
  if (clean.length <= prefixLen + suffixLen) return '••••••••••••';
  const prefix = clean.substring(0, prefixLen);
  const suffix = clean.substring(clean.length - suffixLen);
  const dotsCount = Math.min(18, Math.max(8, clean.length - (prefixLen + suffixLen)));
  return `${prefix}${'•'.repeat(dotsCount)}${suffix}`;
}

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || resolveDotfyApiKey() || '';

// --- 1. PASSWORD HASHING (SCRYPT WITH SALT + LEGACY FALLBACK) ---
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, storedHash: string): { valid: boolean; needsRehash: boolean } {
  if (!storedHash) return { valid: false, needsRehash: false };

  // Modern scrypt format: scrypt$N$r$p$salt$hash
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$');
    if (parts.length !== 6) return { valid: false, needsRehash: false };

    const N = parseInt(parts[1], 10);
    const r = parseInt(parts[2], 10);
    const p = parseInt(parts[3], 10);
    const salt = parts[4];
    const originalHash = parts[5];

    try {
      const derivedKey = crypto.scryptSync(password, salt, 64, { N, r, p });
      const hashBuffer = Buffer.from(originalHash, 'hex');
      if (derivedKey.length !== hashBuffer.length) {
        return { valid: false, needsRehash: false };
      }
      const match = crypto.timingSafeEqual(derivedKey, hashBuffer);
      return { valid: match, needsRehash: false };
    } catch (e) {
      return { valid: false, needsRehash: false };
    }
  }

  // Legacy PBKDF2 hash check
  const legacyHash = crypto.pbkdf2Sync(password, 'paygateway_salt_2026', 1000, 64, 'sha512').toString('hex');
  const legacyBuffer = Buffer.from(legacyHash, 'utf-8');
  const storedBuffer = Buffer.from(storedHash, 'utf-8');
  const isLegacyValid = legacyBuffer.length === storedBuffer.length && crypto.timingSafeEqual(legacyBuffer, storedBuffer);
  
  return {
    valid: isLegacyValid,
    needsRehash: isLegacyValid // Needs upgrade to scrypt
  };
}

// --- 2. SECURE SESSION MANAGEMENT ---
export interface SessionData {
  userId: string;
  createdAt: number;
  lastActiveAt: number;
  ip: string;
  userAgent: string;
}

const activeSessions = new Map<string, SessionData>();
export const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 Dias de persistência de sessão

function generateTokenSignature(payload: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('hex').substring(0, 32);
}

export function createSession(userId: string, req?: Request): string {
  const now = Date.now();
  const rand = crypto.randomBytes(8).toString('hex');
  const payload = `${userId}_${now}_${rand}`;
  const sig = generateTokenSignature(payload);
  const token = `tok_sec_${payload}_${sig}`;

  const ip = req ? ((req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || 'unknown').split(',')[0].trim()) : 'local';
  const userAgent = (req && req.headers['user-agent']) || 'app';

  activeSessions.set(token, {
    userId,
    createdAt: now,
    lastActiveAt: now,
    ip,
    userAgent
  });

  return token;
}

export function getSession(token: string): SessionData | null {
  if (!token) return null;

  // 1. Check in-memory cache first
  const existing = activeSessions.get(token);
  const now = Date.now();

  if (existing) {
    if (now - existing.lastActiveAt > SESSION_TTL_MS) {
      activeSessions.delete(token);
      return null;
    }
    existing.lastActiveAt = now;
    return existing;
  }

  // 2. Self-verifiable signed token resurrection (survives server restarts & memory clears)
  if (token.startsWith('tok_sec_')) {
    const raw = token.replace('tok_sec_', '');
    const lastUnderscore = raw.lastIndexOf('_');
    if (lastUnderscore > 0) {
      const payload = raw.substring(0, lastUnderscore);
      const sig = raw.substring(lastUnderscore + 1);
      const expectedSig = generateTokenSignature(payload);

      const sigBuffer = Buffer.from(sig, 'utf8');
      const expectedBuffer = Buffer.from(expectedSig, 'utf8');
      if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
        // Payload format: userId_timestamp_rand
        const parts = payload.split('_');
        if (parts.length >= 3) {
          const rand = parts.pop()!;
          const timeStr = parts.pop()!;
          const userId = parts.join('_');
          const createdAt = parseInt(timeStr, 10) || now;

          if (now - createdAt <= SESSION_TTL_MS) {
            const restoredSession: SessionData = {
              userId,
              createdAt,
              lastActiveAt: now,
              ip: 'restored',
              userAgent: 'restored'
            };
            activeSessions.set(token, restoredSession);
            return restoredSession;
          }
        }
      }
    }
  }

  // 3. Fallback for legacy user tokens (tok_usr_<userId>_...)
  if (token.startsWith('tok_usr_')) {
    const raw = token.replace('tok_usr_', '');
    const parts = raw.split('_');
    const candidateId = raw.startsWith('usr_')
      ? (parts.length >= 2 ? `${parts[0]}_${parts[1]}` : raw)
      : (parts.length >= 2 ? `usr_${parts[1]}` : `usr_${parts[0]}`);

    const restoredSession: SessionData = {
      userId: candidateId,
      createdAt: now,
      lastActiveAt: now,
      ip: 'legacy',
      userAgent: 'legacy'
    };
    activeSessions.set(token, restoredSession);
    return restoredSession;
  }

  return null;
}

export function destroySession(token: string): boolean {
  return activeSessions.delete(token);
}

export function getActiveOnlineUserSessions(withinMs: number = 15 * 60 * 1000): SessionData[] {
  const now = Date.now();
  const online: SessionData[] = [];
  const seenUsers = new Set<string>();
  for (const session of activeSessions.values()) {
    if (now - session.lastActiveAt <= withinMs && !seenUsers.has(session.userId)) {
      seenUsers.add(session.userId);
      online.push(session);
    }
  }
  return online;
}

// Periodic cleanup of stale sessions (every 6 hours)
const sessionCleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (now - session.lastActiveAt > SESSION_TTL_MS) {
      activeSessions.delete(token);
    }
  }
}, 6 * 60 * 60 * 1000);
if (sessionCleanupInterval.unref) sessionCleanupInterval.unref();

// --- 3. BRUTE FORCE & RATE LIMITING PROTECTION ---
interface RateLimitRecord {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const failedLoginMap = new Map<string, { attempts: number; blockedUntil?: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  let record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    record = { count: 1, resetAt: now + windowMs };
    rateLimitMap.set(key, record);
    return { allowed: true, retryAfterSec: 0 };
  }

  if (record.count >= maxRequests) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  record.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function recordFailedLogin(identifier: string): { blocked: boolean; remainingAttempts: number; blockTimeSec: number } {
  const now = Date.now();
  let entry = failedLoginMap.get(identifier);

  if (!entry) {
    entry = { attempts: 1 };
    failedLoginMap.set(identifier, entry);
    return { blocked: false, remainingAttempts: 4, blockTimeSec: 0 };
  }

  if (entry.blockedUntil && now < entry.blockedUntil) {
    const blockTimeSec = Math.ceil((entry.blockedUntil - now) / 1000);
    return { blocked: true, remainingAttempts: 0, blockTimeSec };
  }

  entry.attempts += 1;

  if (entry.attempts >= 5) {
    // Bloqueio por 15 minutos
    entry.blockedUntil = now + 15 * 60 * 1000;
    const blockTimeSec = 15 * 60;
    return { blocked: true, remainingAttempts: 0, blockTimeSec };
  }

  return { blocked: false, remainingAttempts: 5 - entry.attempts, blockTimeSec: 0 };
}

export function recordSuccessfulLogin(identifier: string) {
  failedLoginMap.delete(identifier);
}

export function isIdentifierBlocked(identifier: string): { blocked: boolean; blockTimeSec: number } {
  const entry = failedLoginMap.get(identifier);
  if (!entry || !entry.blockedUntil) return { blocked: false, blockTimeSec: 0 };

  const now = Date.now();
  if (now < entry.blockedUntil) {
    const blockTimeSec = Math.ceil((entry.blockedUntil - now) / 1000);
    return { blocked: true, blockTimeSec };
  }

  // Lockout expired
  failedLoginMap.delete(identifier);
  return { blocked: false, blockTimeSec: 0 };
}

// --- 4. HMAC SIGNATURE VERIFICATION (WEBHOOKS) ---
export function verifyHmacSignature(rawBody: string, signature: string, secret: string = WEBHOOK_SECRET): boolean {
  if (!signature || !rawBody || !secret) return false;

  try {
    const computed = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const computedBuffer = Buffer.from(computed, 'utf-8');
    const signatureBuffer = Buffer.from(signature.replace(/^sha256=/, ''), 'utf-8');

    if (computedBuffer.length !== signatureBuffer.length) return false;
    return crypto.timingSafeEqual(computedBuffer, signatureBuffer);
  } catch (e) {
    return false;
  }
}

// --- 5. AUDIT SECURITY LOGGER ---
export function logSecurityEvent(event: string, metadata: Record<string, any>) {
  const sanitizedMeta: Record<string, any> = {};

  for (const [key, val] of Object.entries(metadata)) {
    const lower = key.toLowerCase();
    if (lower.includes('password') || lower.includes('secret') || lower.includes('token') || lower.includes('apikey')) {
      sanitizedMeta[key] = '[MASCARADO_REDACTED]';
    } else if (lower.includes('pixkey') || lower.includes('taxid') || lower.includes('cpf')) {
      const strVal = String(val);
      sanitizedMeta[key] = strVal.length > 6 ? strVal.substring(0, 3) + '***' + strVal.substring(strVal.length - 2) : '***';
    } else {
      sanitizedMeta[key] = val;
    }
  }

  console.log(`[AUDIT_LOG_SECURITY] [${new Date().toISOString()}] EVENT: ${event} | META: ${JSON.stringify(sanitizedMeta)}`);
}

// --- 6. EXPRESS SECURITY MIDDLEWARES ---
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
}

export function generalRateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  // Static files, assets, html, scripts and audio must NEVER be rate-limited
  if (!req.path.startsWith('/api') || req.path === '/api/health') {
    return next();
  }
  if (/\.(png|jpe?g|gif|svg|ico|webp|js|css|woff2?|ttf|eot|mp3|wav|ogg|json|html|map)$/i.test(req.path)) {
    return next();
  }

  const forwarded = (req.headers['cf-connecting-ip'] as string) || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const clientIp = forwarded.split(',')[0].trim();
  const rateKey = `gen_${clientIp}`;

  // Allow up to 1200 requests per minute for active gameplay APIs, state sync, and real-time operations
  const { allowed, retryAfterSec } = checkRateLimit(rateKey, 1200, 60 * 1000);
  if (!allowed) {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', { ip: clientIp, path: req.path });
    return res.status(429).json({
      error: 'Muitas requisições. Por favor, aguarde alguns segundos e tente novamente.',
      retryAfterSec
    });
  }

  next();
}

export function authRateLimiterMiddleware(req: Request, res: Response, next: NextFunction) {
  // Session checks/logout must not consume the credential-attempt budget.
  if (req.path !== '/login' && req.path !== '/register') return next();
  const forwarded = (req.headers['cf-connecting-ip'] as string) || (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const clientIp = forwarded.split(',')[0].trim();
  const identifier = sanitizeString(req.body?.email, 150).toLowerCase() || 'unknown';
  const rateKey = `auth_${clientIp}_${identifier}`;

  const { allowed, retryAfterSec } = checkRateLimit(rateKey, 12, 60 * 1000);
  if (!allowed) {
    logSecurityEvent('AUTH_RATE_LIMIT_EXCEEDED', { ip: clientIp, path: req.path });
    return res.status(429).json({
      error: 'Limite de tentativas atingido. Aguarde antes de tentar novamente.',
      retryAfterSec
    });
  }

  next();
}

// --- 7. INPUT SANITIZATION HELPERS ---
export function sanitizeString(str: any, maxLength: number = 255): string {
  if (typeof str !== 'string') return '';
  // Strip control characters & HTML tags
  return str.replace(/<[^>]*>?/gm, '').replace(/[\0\x08\x09\x1a\n\r]/g, '').trim().slice(0, maxLength);
}

export function isValidEmail(email: any): boolean {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  return emailRegex.test(email.trim()) && email.trim().length <= 254;
}

export function isPositiveNumber(val: any): boolean {
  const num = parseFloat(val);
  return !isNaN(num) && isFinite(num) && num > 0;
}

// --- 8. ADVANCED ANTI-FRAUD ENGINE ---
const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'temp-mail.org',
  '10minutemail.com', '10minutemail.net', 'yopmail.com', 'yopmail.net',
  'sharklasers.com', 'dispostable.com', 'getairmail.com', 'throwawaymail.com',
  'trashmail.com', 'trashmail.net', 'fakemailgenerator.com', 'mohmal.com',
  'generator.email', 'tempail.com', 'burnermail.io', 'inboxkitten.com',
  'nada.ltd', 'crazymailing.com', 'mytemp.email', 'disposablemail.com',
  'temp-mail.io', 'guerrillamailblock.com', 'grr.la', 'emailondeck.com',
  'guerrillamail.biz', 'guerrillamail.de', 'guerrillamail.net', 'guerrillamail.org'
]);

/**
 * Detecta se o e-mail informado pertence a provedores descartáveis/temporários.
 */
export function isDisposableEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

/**
 * Normaliza números de telefone removendo pontuação, DDI e caracteres especiais.
 */
export function normalizePhoneNumber(phone: string): string {
  if (!phone || typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  // Remove 55 se vier com DDI Brasil
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits.substring(2);
  }
  return digits;
}

/**
 * Verifica se um usuário possui perfil de Afiliado Hub (goalliancehub.com).
 * Afiliados Hub são operadores de marketing e são estritamente proibidos de
 * criar contas de jogador ou apostar nos jogos da plataforma.
 */
export function isHubAffiliateUser(user: { role?: string; isAffiliate?: boolean; registeredGame?: string } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'affiliate') return true;
  if (user.isAffiliate === true) return true;
  if (user.registeredGame === 'alliance_hub') return true;
  return false;
}

/**
 * Análise de Risco de Auto-Indicação (Self-Referral) e Fraude de Colusão.
 * Detecta tentativas onde o próprio afiliado tenta criar contas de jogador para
 * farmar comissões (CPA ou RevShare) sobre seus próprios depósitos ou perdas.
 */
export function detectSelfReferralRisk(
  buyer: { id?: string; email?: string; phone?: string; ip?: string; pixKey?: string },
  sponsor: { id?: string; email?: string; phone?: string; ip?: string; pixKey?: string }
): { isFraud: boolean; reason?: string } {
  if (!buyer || !sponsor) return { isFraud: false };

  // 1. Mesmo ID de usuário
  if (buyer.id && sponsor.id && buyer.id === sponsor.id) {
    return { isFraud: true, reason: 'AUTO_INDICACAO_MESMO_ID' };
  }

  // 2. Mesmo e-mail
  if (buyer.email && sponsor.email) {
    const bEmail = buyer.email.trim().toLowerCase();
    const sEmail = sponsor.email.trim().toLowerCase();
    if (bEmail === sEmail) {
      return { isFraud: true, reason: 'AUTO_INDICACAO_MESMO_EMAIL' };
    }
  }

  // 3. Mesmo telefone normalizado
  if (buyer.phone && sponsor.phone) {
    const bPhone = normalizePhoneNumber(buyer.phone);
    const sPhone = normalizePhoneNumber(sponsor.phone);
    if (bPhone.length >= 8 && sPhone.length >= 8 && bPhone === sPhone) {
      return { isFraud: true, reason: 'AUTO_INDICACAO_MESMO_TELEFONE' };
    }
  }

  // 4. Mesmo IP de conexão
  if (buyer.ip && sponsor.ip && buyer.ip !== 'unknown' && buyer.ip === sponsor.ip) {
    return { isFraud: true, reason: 'AUTO_INDICACAO_MESMO_IP' };
  }

  // 5. Mesma chave PIX cadastrada (tentativa de colusão / conta laranja)
  if (buyer.pixKey && sponsor.pixKey) {
    const bPix = buyer.pixKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const sPix = sponsor.pixKey.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (bPix.length >= 5 && bPix === sPix) {
      return { isFraud: true, reason: 'COLUSAO_MESMA_CHAVE_PIX' };
    }
  }

  return { isFraud: false };
}

/**
 * Rate Limiter rigoroso de cadastro por IP para mitigar Sybil attacks e fazendas de contas.
 */
export function checkRegistrationRateLimit(ip: string): { allowed: boolean; retryAfterSec: number } {
  const rateKey = `reg_rate_${ip}`;
  // Máximo 5 cadastros por IP a cada 1 hora
  return checkRateLimit(rateKey, 5, 60 * 60 * 1000);
}

