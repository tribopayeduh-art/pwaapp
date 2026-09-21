/**
 * Dynamic Partner Commission Calculation
 *
 * Rules:
 * - Partner can set affiliate commission up to 80% max (MAX_PARTNER_AFFILIATE_COMMISSION).
 * - If affiliate commission is 85% => Partner receives 5%
 * - If affiliate commission is 80% => Partner receives 7.5%
 * - If affiliate commission is 75% => Partner receives 10%
 * - If affiliate commission is 70% => Partner receives 15%
 * - If affiliate commission is 65% => Partner receives 18%
 * - If affiliate commission is <= 60% => Partner receives 20% (up to 25% max)
 */

export const MAX_PARTNER_AFFILIATE_COMMISSION = 80;
export const MIN_PARTNER_AFFILIATE_COMMISSION = 10;

export function getPartnerCutFromAffiliateRevShare(affiliateRevShare: number): number {
  const rev = typeof affiliateRevShare === 'number' && !isNaN(affiliateRevShare)
    ? affiliateRevShare
    : 70;

  if (rev >= 85) return 5;
  if (rev >= 80) {
    // Linear interpolation between 80 (7.5%) and 85 (5%)
    const t = (rev - 80) / 5;
    return parseFloat((7.5 - t * 2.5).toFixed(1));
  }
  if (rev >= 75) {
    // Linear interpolation between 75 (10%) and 80 (7.5%)
    const t = (rev - 75) / 5;
    return parseFloat((10 - t * 2.5).toFixed(1));
  }
  if (rev >= 70) {
    // Linear interpolation between 70 (15%) and 75 (10%)
    const t = (rev - 70) / 5;
    return parseFloat((15 - t * 5).toFixed(1));
  }
  if (rev >= 65) {
    // Linear interpolation between 65 (18%) and 70 (15%)
    const t = (rev - 65) / 5;
    return parseFloat((18 - t * 3).toFixed(1));
  }
  if (rev >= 60) {
    // Linear interpolation between 60 (20%) and 65 (18%)
    const t = (rev - 60) / 5;
    return parseFloat((20 - t * 2).toFixed(1));
  }
  // For rev < 60:
  return Math.min(25, parseFloat((20 + (60 - rev) * 0.4).toFixed(1)));
}

export const PARTNER_COMMISSION_REFERENCE_TIERS = [
  { affiliateRate: 85, partnerRate: 5, note: 'Teto legado (apenas admin)' },
  { affiliateRate: 80, partnerRate: 7.5, note: 'Teto máximo para parceiros' },
  { affiliateRate: 75, partnerRate: 10, note: 'Comissão intermediária alta' },
  { affiliateRate: 70, partnerRate: 15, note: 'Padrão da plataforma' },
  { affiliateRate: 65, partnerRate: 18, note: 'Margem estendida do parceiro' },
  { affiliateRate: 60, partnerRate: 20, note: 'Alta rentabilidade' }
];
