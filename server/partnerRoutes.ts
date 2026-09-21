import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { dbService, UserDB, AffiliateDB, TransactionDB, GameBetDB } from './db.js';
import { PartnerDashboardData, PartnerAffiliateStats } from '../src/types.js';
import { getPartnerCutFromAffiliateRevShare, MAX_PARTNER_AFFILIATE_COMMISSION } from './partnerCommission.js';

interface AuthRequest extends Request {
  userId?: string;
  user?: UserDB;
}

// Security: Helper to check if a user is superadmin
function isSuperAdminUser(email?: string, role?: string): boolean {
  if (!email && !role) return false;
  const cleanEmail = (email || '').toLowerCase().trim();
  return cleanEmail === 'admin.eduh@gmail.com' || cleanEmail === 'tribopayeduh@gmail.com' || role === 'superadmin';
}

export function createPartnerRouter(
  requireAuth: (req: AuthRequest, res: Response, next: NextFunction) => Promise<void | Response>,
  sendPushNotification: (userId: string | null, payload: any) => Promise<any>,
  logSecurityEvent: (action: string, metadata: any) => void
): Router {
  const router = Router();

  // Middleware: Require partner access (user.isPartner && user.partnerApproved, or superadmin)
  const requirePartner = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Não autenticado.' });
      }

      const isSuperAdmin = isSuperAdminUser(user.email, user.role);
      if (isSuperAdmin) {
        return next();
      }

      if (!user.isPartner || !user.partnerApproved) {
        return res.status(403).json({
          error: 'Acesso restrito ao Painel de Parceiros. Esta conta precisa de autorização ativa pelo Administrador.',
          isPartner: Boolean(user.isPartner),
          partnerApproved: Boolean(user.partnerApproved),
          partnerRequested: Boolean(user.partnerRequested)
        });
      }

      next();
    } catch (e: any) {
      console.error('[PartnerAuth Middleware Error]', e);
      return res.status(500).json({ error: 'Erro de autorização de parceiro.' });
    }
  };

  // 1. GET /api/partner/me - Partner profile status (accessible to authenticated users)
  router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const isSuperAdmin = isSuperAdminUser(user.email, user.role);
      const isApproved = Boolean(user.partnerApproved || isSuperAdmin);
      const isPartner = Boolean(user.isPartner || isSuperAdmin);
      const partnerCode = user.partnerCode || user.referralCode || `PRT${user.id.substring(0, 5).toUpperCase()}`;

      // Build recruitment URLs (Short & Clean)
      const host = (req.headers.host || 'goalliancehub.com').split(':')[0];
      const baseHubDomain = host.includes('parceiro.') ? host.replace('parceiro.', '') : host;
      const portalDomain = host.includes('parceiro.') ? host : `parceiro.${host}`;

      const shortRecruitmentLink = `https://${baseHubDomain}/p/${partnerCode}`;
      const directRecruitmentLink = `https://${baseHubDomain}/register?p=${partnerCode}`;
      const partnerPortalLink = `https://${portalDomain}/p/${partnerCode}`;

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        isPartner,
        partnerApproved: isApproved,
        partnerRequested: Boolean(user.partnerRequested),
        partnerRequestedAt: user.partnerRequestedAt || null,
        partnerCode,
        recruitmentLinks: {
          short: shortRecruitmentLink,
          direct: shortRecruitmentLink,
          registerParam: directRecruitmentLink,
          partnerPortal: partnerPortalLink,
          whatsappShare: `https://api.whatsapp.com/send?text=${encodeURIComponent(
            `🚀 Venha ser um Afiliado Oficial no Alliance Hub! Fature as maiores comissões do mercado com saques rápidos via PIX e suporte VIP. Cadastre-se pelo meu link de parceiro: ${shortRecruitmentLink}`
          )}`,
          telegramShare: `https://t.me/share/url?url=${encodeURIComponent(shortRecruitmentLink)}&text=${encodeURIComponent(
            `🚀 Venha ser um Afiliado Oficial no Alliance Hub! Comissões automáticas via PIX e infraestrutura completa.`
          )}`
        }
      });
    } catch (err: any) {
      console.error('[Partner Me Error]', err);
      res.status(500).json({ error: 'Erro ao buscar perfil de parceiro.' });
    }
  });

  // 2. POST /api/partner/request-access - Request partner approval
  router.post('/request-access', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const now = new Date().toISOString();

      const partnerCode = user.partnerCode || user.referralCode || `PRT${user.id.substring(0, 5).toUpperCase()}`;

      await dbService.updateUserFields(user.id, {
        partnerRequested: true,
        partnerRequestedAt: now,
        isPartner: true,
        partnerCode
      });

      logSecurityEvent('PARTNER_ACCESS_REQUESTED', {
        userId: user.id,
        email: user.email,
        name: user.name,
        requestedAt: now
      });

      // Send push notification to admin about new partner request
      sendPushNotification('all', {
        title: 'Nova Solicitação de Parceiro VIP 🤝',
        body: `${user.name} (${user.email}) solicitou liberação para o Painel de Parceiros do Alliance Hub.`,
        url: '/admin',
        type: 'partnerRequest'
      }).catch(console.error);

      res.json({
        success: true,
        message: 'Solicitação de acesso enviada com sucesso! O Administrador irá avaliar seu perfil em instantes.',
        partnerCode
      });
    } catch (err: any) {
      console.error('[Partner Request Error]', err);
      res.status(500).json({ error: 'Erro ao solicitar acesso de parceiro.' });
    }
  });

  // 3. GET /api/partner/dashboard - Core partner panel data (strictly filtered to partner's network)
  router.get('/dashboard', requireAuth, requirePartner, async (req: AuthRequest, res: Response) => {
    try {
      const partnerUser = req.user!;
      const isSuperAdmin = isSuperAdminUser(partnerUser.email, partnerUser.role);
      const partnerCode = partnerUser.partnerCode || partnerUser.referralCode || `PRT${partnerUser.id.substring(0, 5).toUpperCase()}`;

      // 1. Fetch only users linked to this partner
      // If superadmin wants to view test partner or self, we fetch their network
      const directPartnerUsers = await dbService.getUsersByPartnerId(partnerUser.id);

      // In case partner is superadmin and network is empty for previewing, include users tagged with partnerCode
      const allUsers = await dbService.getAllUsers();
      const allAffiliates = await dbService.getAllAffiliates();
      const allTransactions = await dbService.getAllTransactions();
      const allBets = await dbService.getAllGameBets(1000).catch(() => []);

      // Build Set of partner's directly recruited affiliates/players
      const partnerDirectUserIds = new Set<string>();
      directPartnerUsers.forEach(u => partnerDirectUserIds.add(u.id));

      // Also identify any affiliates who signed up with partner's code
      allUsers.forEach(u => {
        if (
          u.partnerId === partnerUser.id ||
          u.partnerUserId === partnerUser.id ||
          (partnerCode && (u.partnerCode === partnerCode || u.referredBy === partnerCode)) ||
          u.parentAffiliateUserId === partnerUser.id
        ) {
          partnerDirectUserIds.add(u.id);
        }
      });

      // Also gather the second-level players referred by these affiliates
      // Map each affiliate ID to their referred players
      const affiliateToPlayerMap = new Map<string, string[]>();
      const affiliateByUserId = new Map<string, AffiliateDB>();
      allAffiliates.forEach(aff => affiliateByUserId.set(aff.userId, aff));

      allUsers.forEach(u => {
        // If this user was referred by one of the partner's affiliates
        if (u.parentAffiliateUserId && partnerDirectUserIds.has(u.parentAffiliateUserId) && u.id !== u.parentAffiliateUserId) {
          const list = affiliateToPlayerMap.get(u.parentAffiliateUserId) || [];
          list.push(u.id);
          affiliateToPlayerMap.set(u.parentAffiliateUserId, list);
        }
        if (u.referredBy) {
          const matchingAff = allAffiliates.find(a => a.referralCode === u.referredBy);
          if (matchingAff && partnerDirectUserIds.has(matchingAff.userId)) {
            const list = affiliateToPlayerMap.get(matchingAff.userId) || [];
            if (!list.includes(u.id)) {
              list.push(u.id);
              affiliateToPlayerMap.set(matchingAff.userId, list);
            }
          }
        }
      });

      // Complete Network User ID Set (Partner's affiliates + their downline players)
      const fullNetworkUserIds = new Set<string>(partnerDirectUserIds);
      affiliateToPlayerMap.forEach(playerIds => {
        playerIds.forEach(pId => fullNetworkUserIds.add(pId));
      });

      // Transactions in partner's network
      const networkTx = allTransactions.filter(t => fullNetworkUserIds.has(t.userId));
      const approvedDeposits = networkTx.filter(t => t.type === 'deposit' && t.status === 'approved');
      const approvedWithdrawals = networkTx.filter(t => t.type === 'withdrawal' && t.status === 'approved');

      const totalNetworkDeposits = approvedDeposits.reduce((acc, t) => acc + (t.amount || 0), 0);
      const totalNetworkWithdrawals = approvedWithdrawals.reduce((acc, t) => acc + (t.amount || 0), 0);

      // Bets in partner's network
      const networkBets = allBets.filter(b => fullNetworkUserIds.has(b.userId));
      const totalWagered = networkBets.reduce((acc, b) => acc + (b.betAmount || 0), 0);
      const totalPayouts = networkBets.reduce((acc, b) => acc + (b.payoutAmount || 0), 0);
      const ggr = parseFloat((totalWagered - totalPayouts).toFixed(2));

      // Build affiliate stats list for partner's direct affiliates
      const partnerAffiliateStatsList: PartnerAffiliateStats[] = [];

      for (const userId of partnerDirectUserIds) {
        const u = allUsers.find(user => user.id === userId);
        if (!u) continue;

        const aff = affiliateByUserId.get(userId) || allAffiliates.find(a => a.userId === userId);
        const referredPlayerIds = affiliateToPlayerMap.get(userId) || [];

        // Aggregate stats for this affiliate's downline
        const downlineTx = allTransactions.filter(t => referredPlayerIds.includes(t.userId) || t.userId === userId);
        const downlineDeposits = downlineTx.filter(t => t.type === 'deposit' && t.status === 'approved');
        const downlineDepositsTotal = downlineDeposits.reduce((acc, t) => acc + (t.amount || 0), 0);

        const downlineBets = allBets.filter(b => referredPlayerIds.includes(b.userId) || b.userId === userId);
        const downlineBetsTotal = downlineBets.reduce((acc, b) => acc + (b.betAmount || 0), 0);

        // Find recent activities for this affiliate
        const recentActivity = downlineTx
          .slice(0, 5)
          .map(t => ({
            id: t.id,
            type: (t.type === 'deposit' ? 'deposit' : 'withdrawal') as 'deposit' | 'bet' | 'win' | 'withdrawal' | 'signup',
            amount: t.amount,
            description: t.description || (t.type === 'deposit' ? 'Depósito PIX' : 'Saque PIX'),
            createdAt: t.createdAt
          }));

        // Check if online in last 10 minutes
        const lastBet = downlineBets[0];
        const lastTx = downlineTx[0];
        const latestTimeStr = lastBet?.createdAt || lastTx?.createdAt || u.createdAt;
        const lastActiveTime = new Date(latestTimeStr).getTime();
        const tenMinsAgo = Date.now() - 10 * 60 * 1000;
        const isOnline = lastActiveTime > tenMinsAgo;

        const affiliateRevShare = (typeof aff?.revSharePercent === 'number' && !isNaN(aff.revSharePercent))
          ? aff.revSharePercent
          : (typeof u.revSharePercent === 'number' ? u.revSharePercent : 70);

        const partnerCut = getPartnerCutFromAffiliateRevShare(affiliateRevShare);
        const partnerRate = partnerCut / 100;
        const partnerEarnedFromDeposits = parseFloat((downlineDepositsTotal * partnerRate).toFixed(2));

        partnerAffiliateStatsList.push({
          id: u.id,
          name: u.name || 'Afiliado',
          email: u.email,
          phone: u.phone,
          referralCode: aff?.referralCode || u.referralCode || '-',
          createdAt: u.createdAt,
          registeredGame: u.registeredGame || 'alliance_hub',
          status: u.isBlocked ? 'blocked' : (isOnline ? 'active' : 'idle'),
          isOnlineNow: isOnline,
          autoWithdrawBlocked: Boolean(u.autoWithdrawBlocked),
          balance: u.balance || 0,
          totalDeposited: parseFloat(downlineDepositsTotal.toFixed(2)),
          paidDepositsCount: downlineDeposits.length,
          totalWithdrawn: downlineTx.filter(t => t.type === 'withdrawal' && t.status === 'approved').reduce((acc, t) => acc + (t.amount || 0), 0),
          totalPlayersInvited: referredPlayerIds.length,
          totalVolumeWagered: parseFloat(downlineBetsTotal.toFixed(2)),
          commissionGeneratedForPartner: partnerEarnedFromDeposits,
          revSharePercent: affiliateRevShare,
          partnerCutPercent: partnerCut,
          lastActivityAt: latestTimeStr,
          recentActivity
        });
      }

      // Ranking: Sort by volume (totalDeposited) descending
      const affiliateRanking = [...partnerAffiliateStatsList]
        .sort((a, b) => b.totalDeposited - a.totalDeposited)
        .map((aff, index) => {
          let tierBadge: 'gold' | 'silver' | 'bronze' | 'elite' | 'standard' = 'standard';
          if (index === 0) tierBadge = 'gold';
          else if (index === 1) tierBadge = 'silver';
          else if (index === 2) tierBadge = 'bronze';
          else if (aff.totalDeposited > 500) tierBadge = 'elite';

          return {
            rank: index + 1,
            affiliateId: aff.id,
            name: aff.name,
            email: aff.email,
            totalDeposits: aff.totalDeposited,
            playersCount: aff.totalPlayersInvited,
            totalWagered: aff.totalVolumeWagered,
            commissionGenerated: aff.commissionGeneratedForPartner,
            score: Math.round(aff.totalDeposited * 1.5 + aff.totalPlayersInvited * 10),
            tierBadge
          };
        });

      // Real-time Live Players Feed in Partner's Network
      const realtimeFeed = networkBets
        .slice(0, 25)
        .map(b => {
          const u = allUsers.find(usr => usr.id === b.userId);
          const rawName = u?.name || b.userName || 'Jogador';
          const maskedName = rawName.length > 4 ? `${rawName.substring(0, 3)}***${rawName.substring(rawName.length - 2)}` : rawName;
          const affUser = partnerAffiliateStatsList.find(a => a.id === u?.parentAffiliateUserId);

          return {
            id: b.id,
            affiliateName: affUser?.name || 'Direto do Parceiro',
            playerName: maskedName,
            type: (b.status === 'cashed_out' ? 'win' : 'bet') as 'deposit' | 'bet' | 'win' | 'withdrawal' | 'signup',
            gameName: b.gameId === 'g_block_puzzle' ? 'Block Win' : (b.gameId === 'g_gen_dino' ? 'GEN DINO' : (b.gameId === 'g_zumbla' ? 'Zumbla Win' : 'Raspa Fortuna')),
            amount: b.payoutAmount > 0 ? b.payoutAmount : b.betAmount,
            multiplier: b.multiplier || 1.0,
            status: b.status,
            timestamp: b.createdAt
          };
        });

      // Calculate Total Commissions paid across network
      const totalCommissionsPaid = partnerAffiliateStatsList.reduce((acc, a) => acc + a.commissionGeneratedForPartner, 0);

      // FTD (First Time Deposit) intelligence for partner's network
      const networkFirstDeposits = new Map<string, number>();
      for (const t of networkTx) {
        if (t.type === 'deposit' && t.status === 'approved') {
          const ts = new Date(t.createdAt).getTime();
          const current = networkFirstDeposits.get(t.userId);
          if (!current || ts < current) {
            networkFirstDeposits.set(t.userId, ts);
          }
        }
      }
      const ftdCount = networkFirstDeposits.size;
      const conversionRate = fullNetworkUserIds.size > 0
        ? parseFloat(((ftdCount / fullNetworkUserIds.size) * 100).toFixed(1))
        : 0;

      // Daily timeline (last 14 days)
      const now = new Date();
      const dailyTimeline: Array<{
        date: string;
        displayDate: string;
        deposits: number;
        withdrawals: number;
        newAffiliates: number;
        activePlayers: number;
      }> = [];

      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const dateKey = `${yyyy}-${mm}-${dd}`;
        const displayDate = `${dd}/${mm}`;

        const dayDeposits = approvedDeposits
          .filter(t => t.createdAt.startsWith(dateKey))
          .reduce((acc, t) => acc + (t.amount || 0), 0);

        const dayWithdrawals = approvedWithdrawals
          .filter(t => t.createdAt.startsWith(dateKey))
          .reduce((acc, t) => acc + (t.amount || 0), 0);

        const dayNewAffiliates = partnerAffiliateStatsList.filter(a => a.createdAt.startsWith(dateKey)).length;

        const dayActivePlayers = new Set(
          networkBets.filter(b => b.createdAt.startsWith(dateKey)).map(b => b.userId)
        ).size;

        dailyTimeline.push({
          date: dateKey,
          displayDate,
          deposits: parseFloat(dayDeposits.toFixed(2)),
          withdrawals: parseFloat(dayWithdrawals.toFixed(2)),
          newAffiliates: dayNewAffiliates,
          activePlayers: dayActivePlayers
        });
      }

      // Active players today
      const todayDateKey = now.toISOString().split('T')[0];
      const activePlayersToday = new Set(
        networkBets.filter(b => b.createdAt.startsWith(todayDateKey)).map(b => b.userId)
      ).size;

      // Recruitment URLs (Clean & Short)
      const host = (req.headers.host || 'goalliancehub.com').split(':')[0];
      const baseHubDomain = host.includes('parceiro.') ? host.replace('parceiro.', '') : host;
      const shortRecruitmentLink = `https://${baseHubDomain}/p/${partnerCode}`;
      const directRecruitmentLink = `https://${baseHubDomain}/register?p=${partnerCode}`;
      const partnerPortalLink = `https://parceiro.${baseHubDomain}/p/${partnerCode}`;

      const blockedWithdrawalsCount = partnerAffiliateStatsList.filter(a => a.autoWithdrawBlocked).length;

      const partnerCommissionPercent = (typeof partnerUser.partnerCommissionPercent === 'number' && !isNaN(partnerUser.partnerCommissionPercent))
        ? partnerUser.partnerCommissionPercent
        : 20;

      const dashboardData: PartnerDashboardData = {
        partner: {
          id: partnerUser.id,
          name: partnerUser.name,
          email: partnerUser.email,
          phone: partnerUser.phone,
          partnerCode,
          partnerInviteLink: shortRecruitmentLink,
          partnerShortLink: shortRecruitmentLink,
          partnerDirectLink: directRecruitmentLink,
          partnerPortalLink,
          isPartner: true,
          partnerApproved: true,
          partnerCommissionPercent,
          revSharePercent: partnerCommissionPercent,
          commissionTotal: totalCommissionsPaid,
          partnerBalance: partnerUser.balance || 0
        },
        metrics: {
          totalAffiliates: partnerDirectUserIds.size,
          activeAffiliatesToday: partnerAffiliateStatsList.filter(a => a.isOnlineNow).length,
          totalPlayersInNetwork: fullNetworkUserIds.size,
          totalDepositedByNetwork: parseFloat(totalNetworkDeposits.toFixed(2)),
          totalWageredByNetwork: parseFloat(totalWagered.toFixed(2)),
          totalPartnerCommissions: parseFloat(totalCommissionsPaid.toFixed(2)),
          netRevenue: parseFloat((totalNetworkDeposits - totalNetworkWithdrawals).toFixed(2)),
          ggr,
          realtimeActivePlayers: activePlayersToday,
          blockedWithdrawalsCount,
          ftdCount,
          conversionRate
        },
        affiliates: partnerAffiliateStatsList,
        rankings: affiliateRanking,
        realtimeFeed,
        dailyTimeline
      };

      res.json(dashboardData);
    } catch (err: any) {
      console.error('[Partner Dashboard Error]', err);
      res.status(500).json({ error: 'Erro ao carregar dados do Painel de Parceiros.' });
    }
  });

  // 4. POST /api/partner/affiliates/:id/toggle-auto-withdraw
  // Partner blocks or enables automatic withdrawals for an affiliate in their network
  router.post('/affiliates/:id/toggle-auto-withdraw', requireAuth, requirePartner, async (req: AuthRequest, res: Response) => {
    try {
      const partnerUser = req.user!;
      const { id } = req.params;
      const { blocked } = req.body;

      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Afiliado não encontrado.' });
      }

      // Security check: Verify this target user belongs to this partner's network
      const isSuperAdmin = isSuperAdminUser(partnerUser.email, partnerUser.role);
      const partnerCode = partnerUser.partnerCode || partnerUser.referralCode;

      const belongsToPartner =
        isSuperAdmin ||
        targetUser.partnerId === partnerUser.id ||
        targetUser.partnerUserId === partnerUser.id ||
        targetUser.parentAffiliateUserId === partnerUser.id ||
        (partnerCode && (targetUser.partnerCode === partnerCode || targetUser.referredBy === partnerCode));

      if (!belongsToPartner) {
        return res.status(403).json({
          error: 'Acesso negado. Você só tem permissão para gerenciar afiliados que se cadastraram pelo seu link de parceiro.'
        });
      }

      const shouldBlock = typeof blocked === 'boolean' ? blocked : !targetUser.autoWithdrawBlocked;
      await dbService.toggleUserAutoWithdraw(id, shouldBlock);

      logSecurityEvent('PARTNER_TOGGLED_AUTO_WITHDRAW', {
        partnerId: partnerUser.id,
        targetUserId: id,
        blocked: shouldBlock
      });

      // Send push notification to the affiliate if blocked
      if (shouldBlock) {
        sendPushNotification(id, {
          title: 'Aviso sobre Saques ⚠️',
          body: 'Seus próximos saques passarão por análise manual da equipe de compliance.',
          url: '/?tab=finance',
          type: 'withdrawal'
        }).catch(console.error);
      }

      res.json({
        success: true,
        autoWithdrawBlocked: shouldBlock,
        message: shouldBlock
          ? 'Saque automático bloqueado com sucesso! Os saques deste afiliado entrarão na fila de análise manual.'
          : 'Saque automático desbloqueado com sucesso!'
      });
    } catch (err: any) {
      console.error('[Toggle Auto Withdraw Error]', err);
      res.status(500).json({ error: 'Erro ao alterar status de saque automático.' });
    }
  });

  // 5. POST /api/partner/affiliates/:id/commission - Partner alters commission of their affiliate (max 80%)
  router.post('/affiliates/:id/commission', requireAuth, requirePartner, async (req: AuthRequest, res: Response) => {
    try {
      const partnerUser = req.user!;
      const { id } = req.params;
      const { revSharePercent } = req.body;

      if (typeof revSharePercent !== 'number' || isNaN(revSharePercent)) {
        return res.status(400).json({ error: 'Informe um percentual de comissão válido.' });
      }

      const rate = Math.round(revSharePercent * 10) / 10;
      if (rate < 1) {
        return res.status(400).json({ error: 'A comissão mínima permitida é de 1%.' });
      }

      if (rate > MAX_PARTNER_AFFILIATE_COMMISSION) {
        return res.status(400).json({
          error: `A comissão máxima que você pode atribuir a um afiliado é de ${MAX_PARTNER_AFFILIATE_COMMISSION}%.`
        });
      }

      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Afiliado não encontrado.' });
      }

      const isSuperAdmin = isSuperAdminUser(partnerUser.email, partnerUser.role);
      const partnerCode = partnerUser.partnerCode || partnerUser.referralCode;
      const belongsToPartner =
        isSuperAdmin ||
        targetUser.partnerId === partnerUser.id ||
        targetUser.partnerUserId === partnerUser.id ||
        targetUser.parentAffiliateUserId === partnerUser.id ||
        (partnerCode && (targetUser.partnerCode === partnerCode || targetUser.referredBy === partnerCode));

      if (!belongsToPartner) {
        return res.status(403).json({
          error: 'Acesso negado. Você só pode gerenciar a comissão de afiliados vinculados à sua rede de parceiro.'
        });
      }

      // Upsert affiliate record
      let aff = await dbService.getAffiliateByUserId(id);
      if (!aff) {
        aff = {
          id: 'aff_' + id,
          userId: id,
          referralCode: targetUser.referralCode || `REF${id.substring(0, 6).toUpperCase()}`,
          status: 'active',
          commissionTotal: 0,
          affiliateBalance: 0,
          revSharePercent: rate,
          createdAt: new Date().toISOString()
        };
        await dbService.createAffiliate(aff);
      } else {
        await dbService.updateAffiliateRates(aff.id, { revSharePercent: rate });
      }

      // Sync user model
      await dbService.updateUserFields(id, { revSharePercent: rate });

      const newPartnerCut = getPartnerCutFromAffiliateRevShare(rate);

      sendPushNotification(id, {
        title: 'Sua Comissão foi Atualizada! 📈💎',
        body: `Seu parceiro oficial ${partnerUser.name} alterou sua comissão para ${rate}% em todos os depósitos gerados pela sua rede!`,
        url: '/?tab=affiliates',
        type: 'commissionUpdate'
      }).catch(console.error);

      res.json({
        success: true,
        revSharePercent: rate,
        partnerCutPercent: newPartnerCut,
        message: `Comissão do afiliado atualizada para ${rate}%. Sua comissão de parceiro sobre os depósitos dele agora é de ${newPartnerCut}%.`
      });
    } catch (err: any) {
      console.error('[Update Affiliate Commission Error]', err);
      res.status(500).json({ error: 'Erro ao atualizar comissão do afiliado.' });
    }
  });

  // 6. POST /api/partner/affiliates/:id/send-alert - Send direct push alert to an affiliate
  router.post('/affiliates/:id/send-alert', requireAuth, requirePartner, async (req: AuthRequest, res: Response) => {
    try {
      const partnerUser = req.user!;
      const { id } = req.params;
      const { title, message } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
      }

      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Afiliado não encontrado.' });
      }

      await sendPushNotification(id, {
        title: `[Parceiro ${partnerUser.name}] ${title}`,
        body: message,
        url: '/?tab=affiliates',
        type: 'partnerMessage'
      });

      res.json({ success: true, message: 'Alerta enviado com sucesso para o afiliado!' });
    } catch (err: any) {
      console.error('[Send Alert Error]', err);
      res.status(500).json({ error: 'Erro ao enviar alerta.' });
    }
  });

  // 6. POST /api/partner/broadcast - Send push notification to all affiliates in partner's network
  router.post('/broadcast', requireAuth, requirePartner, async (req: AuthRequest, res: Response) => {
    try {
      const partnerUser = req.user!;
      const { title, message } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: 'Título e mensagem são obrigatórios.' });
      }

      const partnerUsers = await dbService.getUsersByPartnerId(partnerUser.id);
      let sentCount = 0;

      for (const u of partnerUsers) {
        await sendPushNotification(u.id, {
          title: `[Comunicado do Parceiro] ${title}`,
          body: message,
          url: '/?tab=affiliates',
          type: 'partnerBroadcast'
        }).catch(() => {});
        sentCount++;
      }

      res.json({ success: true, sentCount, message: `Mensagem transmitida para ${sentCount} afiliados da sua rede!` });
    } catch (err: any) {
      console.error('[Broadcast Error]', err);
      res.status(500).json({ error: 'Erro ao realizar transmissão.' });
    }
  });

  // 7. GET /api/admin/partners - Admin view of all partners & pending requests
  router.get('/admin/list', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const adminUser = req.user!;
      const isSuperAdmin = isSuperAdminUser(adminUser.email, adminUser.role);
      const isAdmin = adminUser.role === 'admin' || adminUser.role === 'superadmin' || isSuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ error: 'Sem permissão de administrador.' });
      }

      const allUsers = await dbService.getAllUsers();
      const partners = allUsers.filter(u => u.isPartner || u.partnerRequested);

      const enriched = await Promise.all(
        partners.map(async p => {
          const networkUsers = await dbService.getUsersByPartnerId(p.id);
          return {
            id: p.id,
            name: p.name,
            email: p.email,
            phone: p.phone,
            isPartner: Boolean(p.isPartner),
            partnerApproved: Boolean(p.partnerApproved),
            partnerRequested: Boolean(p.partnerRequested),
            partnerRequestedAt: p.partnerRequestedAt,
            partnerCode: p.partnerCode || p.referralCode,
            totalAffiliates: networkUsers.length,
            createdAt: p.createdAt
          };
        })
      );

      res.json({ partners: enriched });
    } catch (err: any) {
      console.error('[Admin Partners List Error]', err);
      res.status(500).json({ error: 'Erro ao listar parceiros.' });
    }
  });

  // 8. POST /api/admin/users/:id/partner - Admin approve / revoke partner status
  router.post('/admin/users/:id/partner', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const adminUser = req.user!;
      const isSuperAdmin = isSuperAdminUser(adminUser.email, adminUser.role);
      const isAdmin = adminUser.role === 'admin' || adminUser.role === 'superadmin' || isSuperAdmin;

      if (!isAdmin) {
        return res.status(403).json({ error: 'Sem permissão de administrador.' });
      }

      const { id } = req.params;
      const { isPartner, partnerApproved, partnerCode } = req.body;

      const targetUser = await dbService.getUserById(id);
      if (!targetUser) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }

      const updateData: any = {};
      if (typeof isPartner === 'boolean') updateData.isPartner = isPartner;
      if (typeof partnerApproved === 'boolean') updateData.partnerApproved = partnerApproved;
      if (partnerCode && typeof partnerCode === 'string') updateData.partnerCode = partnerCode.trim().toUpperCase();

      await dbService.updateUserFields(id, updateData);

      logSecurityEvent('ADMIN_UPDATED_PARTNER_STATUS', {
        adminId: adminUser.id,
        targetUserId: id,
        updateData
      });

      // Push notification to user
      if (partnerApproved) {
        sendPushNotification(id, {
          title: 'Painel de Parceiro Liberado! 🤝💎',
          body: 'Seu acesso ao Painel de Parceiros Oficial foi aprovado! Acesse parceiro.goalliancehub.com e comece a recrutar seus afiliados.',
          url: '/parceiro',
          type: 'partnerApproved'
        }).catch(console.error);
      }

      res.json({
        success: true,
        message: 'Status de parceiro atualizado com sucesso!',
        user: { ...targetUser, ...updateData }
      });
    } catch (err: any) {
      console.error('[Admin Update Partner Error]', err);
      res.status(500).json({ error: 'Erro ao atualizar parceiro.' });
    }
  });

  return router;
}
