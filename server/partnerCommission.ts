/**
 * Dynamic Partner Commission Calculation (Server)
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
    const t = (rev - 80) / 5;
    return parseFloat((7.5 - t * 2.5).toFixed(1));
  }
  if (rev >= 75) {
    const t = (rev - 75) / 5;
    return parseFloat((10 - t * 2.5).toFixed(1));
  }
  if (rev >= 70) {
    const t = (rev - 70) / 5;
    return parseFloat((15 - t * 5).toFixed(1));
  }
  if (rev >= 65) {
    const t = (rev - 65) / 5;
    return parseFloat((18 - t * 3).toFixed(1));
  }
  if (rev >= 60) {
    const t = (rev - 60) / 5;
    return parseFloat((20 - t * 2).toFixed(1));
  }
  return Math.min(25, parseFloat((20 + (60 - rev) * 0.4).toFixed(1)));
}
