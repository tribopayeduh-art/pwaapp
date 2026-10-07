// Game Tracking & Acquisition Engine
// Ensures accurate tracking of which game each account is created in

export type CanonicalGameId =
  | 'g_gen_dino'
  | 'g_raspa_fortuna'
  | 'g_block_puzzle'
  | 'g_subway_pay'
  | 'g_bubble_blast'
  | 'alliance_hub';

export interface GameTrackingPayload {
  registeredGame: CanonicalGameId;
  acquisitionGame: CanonicalGameId;
  game: CanonicalGameId;
  gameId: CanonicalGameId;
  trackingSource: string;
  trackingUrl?: string;
  trackingTimestamp: number;
}

const STORAGE_KEY = 'alliance_game_tracking_v2';

export function normalizeGameId(raw: string | null | undefined): CanonicalGameId | null {
  if (!raw) return null;
  const str = String(raw).trim().toLowerCase().replace(/_/g, '-');

  if (['gen-dino', 'gendino', 'g-gen-dino', 'dino', 'dinopay', 'dinoplay', 'dinipay', 't-rex', 't-rex-run'].some((k) => str.includes(k))) {
    return 'g_gen_dino';
  }
  if (['subway', 'subwaypay', 'subway-pay', 'g-subway-pay', 'subway_pay', 'joguesubway'].some((k) => str.includes(k))) {
    return 'g_subway_pay';
  }
  if (['raspa', 'raspafortuna', 'raspa-fortuna', 'g-raspa-fortuna', 'scratch', 'raspadinha', 'raspadinhaadasorte'].some((k) => str.includes(k))) {
    return 'g_raspa_fortuna';
  }
  if (['block', 'blockwin', 'block-win', 'block-puzzle', 'g-block-puzzle', 'blockwinn', 'blockwinner'].some((k) => str.includes(k))) {
    return 'g_block_puzzle';
  }
  if (['bubble', 'bubbleblast', 'bubble-blast', 'bubbles', 'bubbles-win', 'bubbleswin', 'jogarbubble', 'jogarbubble.online', 'g-bubble-blast', 'g_bubble_blast', 'zumbla', 'zumblawin', 'zumbla-win', 'zumblapay', 'g_zumbla'].some((k) => str.includes(k))) {
    return 'g_bubble_blast';
  }
  if (['hub', 'portal', 'goalliancehub', 'alliance'].some((k) => str.includes(k))) {
    return 'alliance_hub';
  }
  return null;
}

export function detectGameFromEnvironment(): { game: CanonicalGameId; source: string } {
  if (typeof window === 'undefined') {
    return { game: 'g_block_puzzle', source: 'default_ssr' };
  }

  const url = new URL(window.location.href);
  const search = url.search.toLowerCase();
  const searchParams = url.searchParams;
  const pathname = url.pathname.toLowerCase();
  const hostname = url.hostname.toLowerCase();

  // 1. Direct query parameters
  const qGame = searchParams.get('game') || searchParams.get('g') || searchParams.get('gameId') || searchParams.get('site');
  const normalizedQuery = normalizeGameId(qGame);
  if (normalizedQuery) {
    return { game: normalizedQuery, source: `query_param_${qGame}` };
  }

  // 2. Path-based detection
  if (pathname.includes('/gen-dino') || pathname.includes('/dino') || pathname.includes('/dinopay') || pathname.includes('/dinoplay')) {
    return { game: 'g_gen_dino', source: 'pathname_dino' };
  }
  if (pathname.includes('/subway')) {
    return { game: 'g_subway_pay', source: 'pathname_subway' };
  }
  if (pathname.includes('/raspa')) {
    return { game: 'g_raspa_fortuna', source: 'pathname_raspa' };
  }
  if (pathname.includes('/blockwin') || pathname.includes('/block-puzzle')) {
    return { game: 'g_block_puzzle', source: 'pathname_block' };
  }
  if (pathname.includes('/bubble') || pathname.includes('/bubbles') || pathname.includes('/zumbla')) {
    return { game: 'g_bubble_blast', source: 'pathname_bubble' };
  }

  // 3. Hostname-based detection
  if (hostname.includes('dinopay') || hostname.includes('dinoplay') || hostname.includes('gendino')) {
    return { game: 'g_gen_dino', source: 'hostname_dino' };
  }
  if (hostname.includes('joguesubway') || hostname.includes('subwaypay') || (hostname.includes('subway') && !hostname.includes('alliance'))) {
    return { game: 'g_subway_pay', source: 'hostname_subway' };
  }
  if (hostname.includes('raspafortuna') || hostname.includes('raspadinhaadasorte') || hostname.includes('raspadinha')) {
    return { game: 'g_raspa_fortuna', source: 'hostname_raspa' };
  }
  if (hostname.includes('blockwinn') || hostname.includes('blockwinner') || hostname.includes('blockwin')) {
    return { game: 'g_block_puzzle', source: 'hostname_block' };
  }
  if (hostname.includes('jogarbubble') || hostname.includes('bubbleswin') || hostname.includes('bubbleblast') || hostname.includes('zumbla') || hostname.includes('zumblawin') || (hostname.includes('bubble') && !hostname.includes('alliance'))) {
    return { game: 'g_bubble_blast', source: 'hostname_bubble' };
  }
  if (hostname.includes('subwaypay') || (hostname.includes('subway') && !hostname.includes('alliance'))) {
    return { game: 'g_subway_pay', source: 'hostname_subway' };
  }
  if (hostname.includes('goalliancehub')) {
    return { game: 'alliance_hub', source: 'hostname_portal' };
  }

  // 4. Stored tracking in session / local storage
  try {
    const rawStored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (rawStored) {
      const parsed = JSON.parse(rawStored);
      if (parsed && parsed.game) {
        const norm = normalizeGameId(parsed.game);
        if (norm) {
          return { game: norm, source: `stored_${parsed.source || 'session'}` };
        }
      }
    }
  } catch (e) {}

  // 5. Fallback
  return { game: 'g_block_puzzle', source: 'default_fallback' };
}

export function setTrackedGame(gameId: CanonicalGameId | string, source: string = 'manual_set'): CanonicalGameId {
  const norm = normalizeGameId(gameId) || 'g_block_puzzle';
  if (typeof window !== 'undefined') {
    try {
      const payload = {
        game: norm,
        source,
        timestamp: Date.now(),
        url: window.location.href
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      // Cross-game sync
      localStorage.setItem('alliance_last_game', norm);
    } catch (e) {}
  }
  return norm;
}

export function getTrackedGame(): CanonicalGameId {
  return detectGameFromEnvironment().game;
}

export function getGameTrackingPayload(): GameTrackingPayload {
  const detected = detectGameFromEnvironment();
  return {
    registeredGame: detected.game,
    acquisitionGame: detected.game,
    game: detected.game,
    gameId: detected.game,
    trackingSource: detected.source,
    trackingUrl: typeof window !== 'undefined' ? window.location.href : '',
    trackingTimestamp: Date.now()
  };
}
