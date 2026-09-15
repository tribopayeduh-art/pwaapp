import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// --- CONFIGURATION & ENV SECRETS ---
const isProduction = process.env.NODE_ENV === 'production';

// CRITICAL: if JWT_SECRET is not set via env var, we used to fall back to a
// brand-new random secret on every process start. That silently invalidates
// every session token whenever the server restarts/hibernates (common on
// free-tier / serverless-style hosting), which looks like the app randomly
// bouncing users back to the login screen in an endless loop.
//
// To avoid that, we now persist the auto-generated fallback secret to disk
// so it survives restarts within the same filesystem. This is a safety net,
// NOT a replacement for setting a real JWT_SECRET env var in production
// (a persisted local file will NOT be shared across multiple server
// instances/containers, which will still cause intermittent 401s in a
// multi-instance deployment).
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
    'deslogar todos os usuários a cada reinício do servidor. ' +
    'Configure a variável de ambiente JWT_SECRET no seu provedor de hospedagem ' +
    'assim que possível — isso é obrigatório se você rodar mais de uma instância do servidor.'
  );

  return generated;
}

const JWT_SECRET = resolveJwtSecret();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || process.env.DOTFY_API_KEY || '';

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
    const parts = token.split('_');
    if (parts.length >= 3) {
      const candidateId = `${parts[1]}_${parts[2]}`;
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
  }

  return null;
}

export function destroySession(token: string): boolean {
  return activeSessions.delete(token);
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
