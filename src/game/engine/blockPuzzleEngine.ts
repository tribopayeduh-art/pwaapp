import { Piece, BoardGrid, BlockShape } from '../types';

export const GRID_SIZE = 8;

export interface PieceDef {
  shape: BlockShape;
  color: string;
  glow: string;
  tier: 'easy' | 'medium' | 'hard' | 'extreme';
  points: number;
}

export const PIECE_DEFINITIONS: PieceDef[] = [
  // EASY PIECES (Small, high-fit rate)
  {
    shape: [[1]],
    color: 'from-amber-400 to-amber-500',
    glow: 'shadow-amber-500/50',
    tier: 'easy',
    points: 10,
  },
  {
    shape: [[1, 1]],
    color: 'from-cyan-400 to-blue-500',
    glow: 'shadow-cyan-500/50',
    tier: 'easy',
    points: 20,
  },
  {
    shape: [[1], [1]],
    color: 'from-cyan-400 to-blue-500',
    glow: 'shadow-cyan-500/50',
    tier: 'easy',
    points: 20,
  },
  {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: 'from-emerald-400 to-teal-500',
    glow: 'shadow-emerald-500/50',
    tier: 'easy',
    points: 40,
  },
  {
    shape: [
      [1, 0],
      [1, 1],
    ],
    color: 'from-violet-400 to-purple-600',
    glow: 'shadow-violet-500/50',
    tier: 'easy',
    points: 30,
  },
  {
    shape: [
      [0, 1],
      [1, 1],
    ],
    color: 'from-violet-400 to-purple-600',
    glow: 'shadow-violet-500/50',
    tier: 'easy',
    points: 30,
  },
  {
    shape: [
      [1, 1],
      [1, 0],
    ],
    color: 'from-sky-400 to-cyan-600',
    glow: 'shadow-sky-500/50',
    tier: 'easy',
    points: 30,
  },
  {
    shape: [
      [1, 1],
      [0, 1],
    ],
    color: 'from-sky-400 to-cyan-600',
    glow: 'shadow-sky-500/50',
    tier: 'easy',
    points: 30,
  },

  // MEDIUM PIECES (3-lines, T-shapes, Step blocks)
  {
    shape: [[1, 1, 1]],
    color: 'from-indigo-400 to-purple-500',
    glow: 'shadow-purple-500/50',
    tier: 'medium',
    points: 30,
  },
  {
    shape: [[1], [1], [1]],
    color: 'from-indigo-400 to-purple-500',
    glow: 'shadow-purple-500/50',
    tier: 'medium',
    points: 30,
  },
  {
    shape: [
      [1, 1, 1],
      [0, 1, 0],
    ],
    color: 'from-pink-400 to-rose-500',
    glow: 'shadow-rose-500/50',
    tier: 'medium',
    points: 40,
  },
  {
    shape: [
      [0, 1],
      [1, 1],
      [0, 1],
    ],
    color: 'from-pink-400 to-rose-500',
    glow: 'shadow-rose-500/50',
    tier: 'medium',
    points: 40,
  },
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: 'from-amber-400 to-orange-500',
    glow: 'shadow-orange-500/50',
    tier: 'medium',
    points: 40,
  },
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: 'from-amber-400 to-orange-500',
    glow: 'shadow-orange-500/50',
    tier: 'medium',
    points: 40,
  },

  // HARD PIECES (4-lines, Big L, Big Corners, Giant U)
  {
    shape: [[1, 1, 1, 1]],
    color: 'from-fuchsia-400 to-pink-500',
    glow: 'shadow-fuchsia-500/50',
    tier: 'hard',
    points: 40,
  },
  {
    shape: [[1], [1], [1], [1]],
    color: 'from-fuchsia-400 to-pink-500',
    glow: 'shadow-fuchsia-500/50',
    tier: 'hard',
    points: 40,
  },
  {
    shape: [
      [1, 0, 0],
      [1, 0, 0],
      [1, 1, 1],
    ],
    color: 'from-rose-500 to-red-600',
    glow: 'shadow-red-500/50',
    tier: 'hard',
    points: 50,
  },
  {
    shape: [
      [0, 0, 1],
      [0, 0, 1],
      [1, 1, 1],
    ],
    color: 'from-rose-500 to-red-600',
    glow: 'shadow-red-500/50',
    tier: 'hard',
    points: 50,
  },
  {
    shape: [
      [1, 1, 1],
      [1, 0, 0],
      [1, 0, 0],
    ],
    color: 'from-rose-500 to-red-600',
    glow: 'shadow-red-500/50',
    tier: 'hard',
    points: 50,
  },
  {
    shape: [
      [1, 1, 1],
      [0, 0, 1],
      [0, 0, 1],
    ],
    color: 'from-rose-500 to-red-600',
    glow: 'shadow-red-500/50',
    tier: 'hard',
    points: 50,
  },
  {
    shape: [
      [1, 0, 1],
      [1, 1, 1],
    ],
    color: 'from-violet-600 to-purple-800',
    glow: 'shadow-purple-600/50',
    tier: 'hard',
    points: 50,
  },

  // EXTREME PIECES (3x3 Solid Cube, 5-bar lines, 3x2 solid blocks, Giant Cross)
  {
    shape: [
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ],
    color: 'from-[#FF3B30] to-[#FF9500]',
    glow: 'shadow-orange-500/50',
    tier: 'extreme',
    points: 90,
  },
  {
    shape: [[1, 1, 1, 1, 1]],
    color: 'from-red-600 to-rose-700',
    glow: 'shadow-red-600/50',
    tier: 'extreme',
    points: 50,
  },
  {
    shape: [[1], [1], [1], [1], [1]],
    color: 'from-red-600 to-rose-700',
    glow: 'shadow-red-600/50',
    tier: 'extreme',
    points: 50,
  },
  {
    shape: [
      [1, 1, 1],
      [1, 1, 1],
    ],
    color: 'from-red-500 to-amber-600',
    glow: 'shadow-red-500/50',
    tier: 'extreme',
    points: 60,
  },
  {
    shape: [
      [1, 1],
      [1, 1],
      [1, 1],
    ],
    color: 'from-red-500 to-amber-600',
    glow: 'shadow-red-500/50',
    tier: 'extreme',
    points: 60,
  },
  {
    shape: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 1, 0],
    ],
    color: 'from-purple-500 to-indigo-600',
    glow: 'shadow-purple-500/50',
    tier: 'extreme',
    points: 50,
  },
  {
    shape: [
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 1],
    ],
    color: 'from-rose-600 to-pink-700',
    glow: 'shadow-rose-600/50',
    tier: 'extreme',
    points: 50,
  },
];

export function createEmptyBoard(): BoardGrid {
  return Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));
}

export type GameDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export interface PieceGenOptions {
  board?: BoardGrid;
  rtpPercent?: number; // 0.1 to 100%
  difficulty?: GameDifficulty;
  currentMultiplier?: number;
  betAmount?: number;
  isInfluencer?: boolean; // Dedicated Influencer Mode: 80%+ Win Rate (Ganha 8 de 10 partidas)
  antiBailoutMode?: boolean; // When board is tight, block single-block and easy bailout pieces
  heavyBlocksForce?: boolean; // Frequently inject heavy 3x3 or 4-line blocks
  dynamicRetention?: boolean; // Dynamically tighten difficulty as currentMultiplier increases
  streakLimiterMultiplier?: number; // Multiplier limit above which extreme pieces are guaranteed
  nearLossPressure?: boolean; // Pressure player by preventing matching corner pieces
  winStreakBrake?: boolean; // Freio de Sequência de Vitórias (reduz RTP progressivamente com base no multiplicador)
  antiComboBlocker?: boolean; // Bloqueia peças que fechariam combos ou múltiplas linhas simultâneas
  highBetResistance?: boolean; // Resistência a apostas altas (aumenta peso de peças pesadas)
  giantPieceFrequency?: number; // Frequência (0% a 100%) de injeção de peças 3x3 / gigantes
  instantLossOnTargetProfit?: number; // Lucro alvo para indução de Game Over
  tightenOnHighOccupancy?: boolean; // Aperto agressivo quando ocupação > 35%
  maxMultiplier?: number; // Maximum target multiplier
  retentionAggressiveness?: 'soft' | 'moderate' | 'aggressive' | 'ruthless' | 'impossible'; // Retention curve preset
  forceLossOnMaxMultiplier?: boolean; // Extreme board saturation when nearing max multiplier
  consecutiveWinDecay?: number; // Decay multiplier boost rate
  smartRtp?: boolean; // Ultra-Precise Smart RTP Engine
  smartRtpEasyThreshold?: number; // Easy onboarding threshold (default R$ 30)
  smartRtpMidThreshold?: number; // Mid alert threshold (default R$ 60)
  smartRtpHardThreshold?: number; // Hard critical threshold (default R$ 85)
  smartRtpMaxTarget?: number; // Absolute max target threshold (default R$ 100)
}

export function resolveDifficultyFromRtp(rtpPercent?: number, explicitDiff?: string): GameDifficulty {
  if (explicitDiff === 'easy' || explicitDiff === 'medium' || explicitDiff === 'hard' || explicitDiff === 'extreme') {
    return explicitDiff;
  }
  const rtp = typeof rtpPercent === 'number' ? rtpPercent : 90.0;
  if (rtp >= 93) return 'easy';
  if (rtp >= 75) return 'medium';
  if (rtp >= 45) return 'hard';
  return 'extreme';
}

export function calculateBoardOccupancy(board: BoardGrid): { occupied: number; total: number; ratio: number } {
  let occupied = 0;
  const total = GRID_SIZE * GRID_SIZE;
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (board[r][c] !== null) occupied++;
    }
  }
  return { occupied, total, ratio: occupied / total };
}

export function generateRandomPieces(
  optionsOrBoardOrCountOrDiff?: PieceGenOptions | BoardGrid | number | GameDifficulty,
  difficultyOrRtp?: GameDifficulty | number,
  explicitRtp?: number
): Piece[] {
  let actualBoard: BoardGrid | undefined = undefined;
  let difficulty: GameDifficulty = 'medium';
  let rtp = 90.0;
  let currentMultiplier = 1.0;
  let antiBailoutMode = false;
  let heavyBlocksForce = false;
  let dynamicRetention = false;
  let streakLimiterMultiplier = 5.0;
  let nearLossPressure = false;
  let winStreakBrake = false;
  let antiComboBlocker = false;
  let highBetResistance = false;
  let giantPieceFrequency = 20;
  let tightenOnHighOccupancy = false;
  let retentionCurve: 'soft' | 'moderate' | 'aggressive' | 'ruthless' | 'impossible' = 'moderate';
  let forceLoss = true;
  let maxMult = 100.0;
  let effectiveRtp = 90.0;

  let isInfluencerMode = false;

  // Check if first arg is options object
  if (
    optionsOrBoardOrCountOrDiff &&
    typeof optionsOrBoardOrCountOrDiff === 'object' &&
    !Array.isArray(optionsOrBoardOrCountOrDiff)
  ) {
    const opts = optionsOrBoardOrCountOrDiff as PieceGenOptions;
    actualBoard = opts.board;
    isInfluencerMode = Boolean(opts.isInfluencer);
    rtp = isInfluencerMode ? 90 : (typeof opts.rtpPercent === 'number' ? opts.rtpPercent : 90.0);
    difficulty = isInfluencerMode ? 'easy' : (opts.difficulty || resolveDifficultyFromRtp(rtp));
    currentMultiplier = opts.currentMultiplier ?? 1.0;
    antiBailoutMode = isInfluencerMode ? false : Boolean(opts.antiBailoutMode);
    heavyBlocksForce = isInfluencerMode ? false : Boolean(opts.heavyBlocksForce);
    dynamicRetention = isInfluencerMode ? false : Boolean(opts.dynamicRetention);
    streakLimiterMultiplier = isInfluencerMode ? 100.0 : (opts.streakLimiterMultiplier ?? 5.0);
    nearLossPressure = isInfluencerMode ? false : Boolean(opts.nearLossPressure);
    winStreakBrake = isInfluencerMode ? false : Boolean(opts.winStreakBrake);
    antiComboBlocker = isInfluencerMode ? false : Boolean(opts.antiComboBlocker);
    highBetResistance = isInfluencerMode ? false : Boolean(opts.highBetResistance);
    giantPieceFrequency = isInfluencerMode ? 0 : (typeof opts.giantPieceFrequency === 'number' ? opts.giantPieceFrequency : 20);
    tightenOnHighOccupancy = isInfluencerMode ? false : Boolean(opts.tightenOnHighOccupancy);
    retentionCurve = isInfluencerMode ? 'soft' : (opts.retentionAggressiveness || 'moderate');
    forceLoss = isInfluencerMode ? false : (opts.forceLossOnMaxMultiplier ?? true);
    maxMult = opts.maxMultiplier ?? 100.0;

    // Smart RTP Engine
    const smartRtp = isInfluencerMode ? false : (opts.smartRtp !== false);
    const maxTarget = opts.smartRtpMaxTarget ?? 100.0;
    const hardThreshold = opts.smartRtpHardThreshold ?? 85.0;
    const midThreshold = opts.smartRtpMidThreshold ?? 60.0;
    const easyThreshold = opts.smartRtpEasyThreshold ?? 30.0;
    const betAmount = opts.betAmount ?? 1.0;
    const currentRunProfit = betAmount * currentMultiplier;

    if (smartRtp) {
      if (currentRunProfit >= maxTarget) {
        effectiveRtp = 0.1;
        heavyBlocksForce = true;
        antiBailoutMode = true;
        giantPieceFrequency = 90;
        antiComboBlocker = true;
      } else if (currentRunProfit >= hardThreshold) {
        // Critical Near-100 Zone (e.g. R$ 85 - R$ 99.99)
        const progress = (currentRunProfit - hardThreshold) / Math.max(1, maxTarget - hardThreshold);
        const expPenalty = Math.pow(progress, 1.6) * 60.0;
        effectiveRtp = Math.max(0.5, rtp - 40.0 - expPenalty);
        heavyBlocksForce = true;
        antiBailoutMode = true;
        giantPieceFrequency = Math.min(85, 45 + Math.round(progress * 40));
        antiComboBlocker = true;
      } else if (currentRunProfit >= midThreshold) {
        // Mid Alert Zone (e.g. R$ 60 - R$ 85)
        const midProgress = (currentRunProfit - midThreshold) / Math.max(1, hardThreshold - midThreshold);
        effectiveRtp = Math.max(25, rtp - 15.0 - midProgress * 25.0);
        giantPieceFrequency = Math.min(50, 20 + Math.round(midProgress * 25));
        if (midProgress > 0.5) antiBailoutMode = true;
      } else if (currentRunProfit > easyThreshold) {
        // Progressive Escalation (e.g. R$ 30 - R$ 60)
        const lowProgress = (currentRunProfit - easyThreshold) / Math.max(1, midThreshold - easyThreshold);
        effectiveRtp = Math.max(60, rtp - lowProgress * 15.0);
      } else {
        // Under easyThreshold: Friendly onboarding ONLY if RTP is high (>= 75%)
        effectiveRtp = (rtp >= 75 && difficulty !== 'hard' && difficulty !== 'extreme') ? Math.max(88, rtp) : rtp;
        if (rtp < 75 || difficulty === 'hard' || difficulty === 'extreme') {
          giantPieceFrequency = Math.max(giantPieceFrequency, 45);
          if (rtp < 50) heavyBlocksForce = true;
          if (rtp < 30) antiBailoutMode = true;
        }
      }
    }
  } else if (Array.isArray(optionsOrBoardOrCountOrDiff)) {
    actualBoard = optionsOrBoardOrCountOrDiff;
    if (typeof difficultyOrRtp === 'number') {
      rtp = difficultyOrRtp;
      difficulty = resolveDifficultyFromRtp(rtp);
    } else if (typeof difficultyOrRtp === 'string') {
      difficulty = resolveDifficultyFromRtp(explicitRtp, difficultyOrRtp);
      rtp = explicitRtp ?? (difficulty === 'easy' ? 96 : difficulty === 'medium' ? 85 : difficulty === 'hard' ? 50 : 5);
    }
  } else if (typeof optionsOrBoardOrCountOrDiff === 'string') {
    difficulty = resolveDifficultyFromRtp(typeof difficultyOrRtp === 'number' ? difficultyOrRtp : undefined, optionsOrBoardOrCountOrDiff);
    rtp = typeof difficultyOrRtp === 'number' ? difficultyOrRtp : (difficulty === 'easy' ? 96 : difficulty === 'medium' ? 85 : difficulty === 'hard' ? 50 : 5);
  } else if (typeof optionsOrBoardOrCountOrDiff === 'number') {
    if (typeof difficultyOrRtp === 'string') {
      difficulty = resolveDifficultyFromRtp(explicitRtp, difficultyOrRtp);
      rtp = explicitRtp ?? (difficulty === 'easy' ? 96 : difficulty === 'medium' ? 85 : difficulty === 'hard' ? 50 : 5);
    } else if (typeof difficultyOrRtp === 'number') {
      rtp = difficultyOrRtp;
      difficulty = resolveDifficultyFromRtp(rtp);
    }
  }

  // Dynamic RTP calculation adjusted for player current win streak/multiplier and aggressiveness
  effectiveRtp = Math.min(effectiveRtp, rtp);
  if (dynamicRetention && currentMultiplier > 1.15) {
    const slope =
      retentionCurve === 'soft'
        ? 6.0
        : retentionCurve === 'moderate'
        ? 14.0
        : retentionCurve === 'aggressive'
        ? 22.0
        : retentionCurve === 'ruthless'
        ? 32.0
        : 50.0; // 'impossible'
    const multiplierPenalty = (currentMultiplier - 1.15) * slope;
    effectiveRtp = Math.max(0.5, rtp - multiplierPenalty);
  }

  // Win Streak Brake: If player is actively running high multiplier, penalize effective RTP further
  if (winStreakBrake && currentMultiplier >= 1.4) {
    const brakePenalty = (currentMultiplier - 1.2) * 15.0;
    effectiveRtp = Math.max(0.5, effectiveRtp - brakePenalty);
  }

  // If streak limiter reached, clamp effective RTP to minimal survival levels
  if (currentMultiplier >= streakLimiterMultiplier) {
    const clampVal =
      retentionCurve === 'soft'
        ? 20.0
        : retentionCurve === 'moderate'
        ? 10.0
        : retentionCurve === 'aggressive'
        ? 4.0
        : 0.5;
    effectiveRtp = Math.min(effectiveRtp, clampVal);
  }

  // If nearing max multiplier limit, trigger near-maximum house resistance
  if (forceLoss && currentMultiplier >= maxMult * 0.85) {
    effectiveRtp = 0.5;
    heavyBlocksForce = true;
  }

  // Piece pools
  const easyPool = PIECE_DEFINITIONS.filter(p => p.tier === 'easy');
  const mediumPool = PIECE_DEFINITIONS.filter(p => p.tier === 'medium');
  const hardPool = PIECE_DEFINITIONS.filter(p => p.tier === 'hard');
  const extremePool = PIECE_DEFINITIONS.filter(p => p.tier === 'extreme');

  // Loss Probability calculation (0 to 100%)
  const lossProbability = Math.max(1, Math.min(99.5, 100 - effectiveRtp));
  const isExtremeLossMode = difficulty === 'extreme' || lossProbability >= 70 || retentionCurve === 'impossible';
  const isHighLossMode = difficulty === 'hard' || lossProbability >= 50;

  // Board occupancy calculation
  let boardOccupancyRatio = 0;
  if (actualBoard) {
    boardOccupancyRatio = calculateBoardOccupancy(actualBoard).ratio;
  }

  // Auto-activate Anti-Bailout when in high/extreme loss mode or high occupancy
  const effectiveAntiBailout =
    antiBailoutMode ||
    isHighLossMode ||
    (tightenOnHighOccupancy && boardOccupancyRatio >= 0.35);
  const effectiveNearLossPressure = nearLossPressure || isHighLossMode;

  // Anti-Bailout Filtering: Exclude single/double block bailouts when active
  let activeEasyPool = easyPool;
  if (actualBoard && effectiveAntiBailout) {
    if (boardOccupancyRatio >= 0.12 || isHighLossMode) {
      activeEasyPool = easyPool.filter(p => {
        const blocks = p.shape.flat().filter(v => v === 1).length;
        return blocks > 3; // strictly exclude 1x1, 1x2, 2x1 bailout pieces
      });
      if (activeEasyPool.length === 0) activeEasyPool = mediumPool;
    }
  }

  // Weight distribution based on loss probability & RTP
  let easyWeight: number;
  let mediumWeight: number;
  let hardWeight: number;
  let extremeWeight: number;

  if (isInfluencerMode) {
    // Carteira promocional: distribuição preparada para aproximadamente 90% de vitórias.
    easyWeight = 90;
    mediumWeight = 10;
    hardWeight = 0;
    extremeWeight = 0;
  } else if (isExtremeLossMode) {
    // Extreme Mode (RTP 0.1-15% / ~85-99% loss rate): Extreme & Hard blocks dominate almost 100%
    easyWeight = 0;
    mediumWeight = 3;
    hardWeight = 42;
    extremeWeight = 55;
  } else if (isHighLossMode) {
    // High Loss Mode (~50-75% loss rate)
    easyWeight = 4;
    mediumWeight = 16;
    hardWeight = 45;
    extremeWeight = 35;
  } else {
    // Standard / High RTP Mode
    const normalizedRtp = Math.max(1, Math.min(99, effectiveRtp));
    easyWeight = Math.max(0, (normalizedRtp - 30) * 1.1);
    extremeWeight = Math.max(3, (100 - normalizedRtp) * 0.35);
    hardWeight = Math.max(8, (100 - normalizedRtp) * 0.35);
    mediumWeight = Math.max(15, 100 - (easyWeight + hardWeight + extremeWeight));
  }

  // If Heavy Blocks Force is active or High Bet Resistance, boost hard and extreme pieces further (disabled in influencer mode)
  if (!isInfluencerMode) {
    if (heavyBlocksForce || isExtremeLossMode) {
      hardWeight += 20;
      extremeWeight += 35;
      easyWeight = 0;
    }
    if (highBetResistance) {
      hardWeight += 15;
      extremeWeight += 20;
      easyWeight = Math.max(0, easyWeight - 15);
    }
  }

  const totalWeight = easyWeight + mediumWeight + hardWeight + extremeWeight;
  const easyThresh = (easyWeight / totalWeight) * 100;
  const medThresh = easyThresh + (mediumWeight / totalWeight) * 100;
  const hardThresh = medThresh + (hardWeight / totalWeight) * 100;

  // Helper to test if a piece completes an almost-full line on the board
  const countLinesCompletedByPiece = (b: BoardGrid, pieceDef: PieceDef): number => {
    const testPiece: Piece = { id: 'test_line', shape: pieceDef.shape, color: pieceDef.color, glow: pieceDef.glow };
    const numRows = pieceDef.shape.length;
    const numCols = pieceDef.shape[0].length;
    let maxLines = 0;
    for (let r = 0; r <= GRID_SIZE - numRows; r++) {
      for (let c = 0; c <= GRID_SIZE - numCols; c++) {
        if (canPlacePiece(b, testPiece, r, c)) {
          const tempBoard = b.map(row => [...row]);
          for (let pr = 0; pr < numRows; pr++) {
            for (let pc = 0; pc < numCols; pc++) {
              if (pieceDef.shape[pr][pc] === 1) tempBoard[r + pr][c + pc] = pieceDef.color;
            }
          }
          const { linesCleared } = checkAndClearLines(tempBoard);
          if (linesCleared > maxLines) maxLines = linesCleared;
        }
      }
    }
    return maxLines;
  };

  const pieces: Piece[] = [];

  for (let i = 0; i < 3; i++) {
    let chosenDef: PieceDef;
    const roll = Math.random() * 100;

    if (roll < easyThresh) {
      chosenDef = activeEasyPool[Math.floor(Math.random() * activeEasyPool.length)];
    } else if (roll < medThresh) {
      chosenDef = mediumPool[Math.floor(Math.random() * mediumPool.length)];
    } else if (roll < hardThresh) {
      chosenDef = hardPool[Math.floor(Math.random() * hardPool.length)];
    } else {
      chosenDef = extremePool[Math.floor(Math.random() * extremePool.length)];
    }

    // Giant Piece Frequency Injection: Roll against giantPieceFrequency
    const giantRoll = Math.random() * 100;
    if (giantRoll < giantPieceFrequency && i >= 1) {
      const giantDefs = extremePool.filter(p => p.shape.length >= 3 || p.shape[0].length >= 3);
      if (giantDefs.length > 0) {
        chosenDef = giantDefs[Math.floor(Math.random() * giantDefs.length)];
      }
    }

    // Heavy Blocks Guarantee: In extreme loss mode or heavyBlocksForce, inject huge blocks
    if ((isExtremeLossMode && i >= 1) || (heavyBlocksForce && i === 2)) {
      const heavyPool = [...hardPool, ...extremePool];
      chosenDef = heavyPool[Math.floor(Math.random() * heavyPool.length)];
    }

    // Anti-Combo Blocker: If piece completes 2 or more lines simultaneously and antiComboBlocker is on, filter out
    if (actualBoard && antiComboBlocker) {
      const linesCleared = countLinesCompletedByPiece(actualBoard, chosenDef);
      if (linesCleared >= 2) {
        const saferPool = [...mediumPool, ...hardPool].filter(
          p => countLinesCompletedByPiece(actualBoard!, p) < 2
        );
        if (saferPool.length > 0) {
          chosenDef = saferPool[Math.floor(Math.random() * saferPool.length)];
        }
      }
    }

    // Near-Loss Pressure: When board has lines waiting for 1 piece, intentionally withhold completing pieces
    if (actualBoard && effectiveNearLossPressure && isHighLossMode) {
      if (countLinesCompletedByPiece(actualBoard, chosenDef) > 0) {
        // Suppress easy completing piece and swap for a non-fitting heavy/extreme piece
        const heavyPool = [...hardPool, ...extremePool];
        const nonCompleters = heavyPool.filter(p => countLinesCompletedByPiece(actualBoard!, p) === 0);
        if (nonCompleters.length > 0) {
          chosenDef = nonCompleters[Math.floor(Math.random() * nonCompleters.length)];
        }
      }
    }

    // Modo promocional: prioriza encaixes e linhas sem afetar a operação financeira real.
    if (isInfluencerMode && actualBoard) {
      const fittingPieces = easyPool.filter(def => {
        const testP: Piece = { id: 'test_fit', shape: def.shape, color: def.color, glow: def.glow };
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (canPlacePiece(actualBoard!, testP, r, c)) return true;
          }
        }
        return false;
      });

      if (fittingPieces.length > 0) {
        // Look for pieces that complete at least 1 line/column
        const lineCompletingPieces = fittingPieces.filter(def => countLinesCompletedByPiece(actualBoard!, def) >= 1);
        
        if (lineCompletingPieces.length > 0 && (Math.random() < 0.90 || i === 0)) {
          chosenDef = lineCompletingPieces[Math.floor(Math.random() * lineCompletingPieces.length)];
        } else {
          // Choose any small, super manageable fitting piece
          const smallFitting = fittingPieces.filter(p => p.shape.flat().filter(v => v === 1).length <= 4);
          chosenDef = (smallFitting.length > 0 ? smallFitting : fittingPieces)[
            Math.floor(Math.random() * (smallFitting.length > 0 ? smallFitting : fittingPieces).length)
          ];
        }
      }
    } else {
      // Standard Fitting Logic ONLY for High RTP (Easy) mode (when loss probability is low)
      if (actualBoard && effectiveRtp >= 88 && !effectiveAntiBailout) {
        const tempPiece: Piece = {
          id: `p_check_${i}`,
          shape: chosenDef.shape,
          color: chosenDef.color,
          glow: chosenDef.glow,
        };

        let fits = false;
        for (let r = 0; r < GRID_SIZE; r++) {
          for (let c = 0; c < GRID_SIZE; c++) {
            if (canPlacePiece(actualBoard, tempPiece, r, c)) {
              fits = true;
              break;
            }
          }
          if (fits) break;
        }

        if (!fits) {
          const fittingEasy = activeEasyPool.filter(def => {
            const testP: Piece = { id: 'test', shape: def.shape, color: def.color, glow: def.glow };
            for (let r = 0; r < GRID_SIZE; r++) {
              for (let c = 0; c < GRID_SIZE; c++) {
                if (canPlacePiece(actualBoard!, testP, r, c)) return true;
              }
            }
            return false;
          });

          if (fittingEasy.length > 0) {
            chosenDef = fittingEasy[Math.floor(Math.random() * fittingEasy.length)];
          }
        }
      }
    }

    pieces.push({
      id: `p_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 4)}`,
      shape: chosenDef.shape,
      color: chosenDef.color,
      glow: chosenDef.glow,
    });
  }

  return pieces;
}

export function canPlacePiece(
  board: BoardGrid,
  piece: Piece,
  startRow: number,
  startCol: number
): boolean {
  const numRows = piece.shape.length;
  const numCols = piece.shape[0].length;

  if (startRow < 0 || startRow + numRows > GRID_SIZE) return false;
  if (startCol < 0 || startCol + numCols > GRID_SIZE) return false;

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (piece.shape[r][c] === 1) {
        if (board[startRow + r][startCol + c] !== null) {
          return false;
        }
      }
    }
  }

  return true;
}

export function placePieceOnBoard(
  board: BoardGrid,
  piece: Piece,
  startRow: number,
  startCol: number
): BoardGrid {
  const newBoard = board.map((row) => [...row]);
  const numRows = piece.shape.length;
  const numCols = piece.shape[0].length;

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      if (piece.shape[r][c] === 1) {
        newBoard[startRow + r][startCol + c] = piece.color;
      }
    }
  }

  return newBoard;
}

export interface LineClearResult {
  newBoard: BoardGrid;
  linesCleared: number;
  clearedRows: number[];
  clearedCols: number[];
}

export function checkAndClearLines(board: BoardGrid): LineClearResult {
  const rowsToClear: number[] = [];
  const colsToClear: number[] = [];

  // Check rows
  for (let r = 0; r < GRID_SIZE; r++) {
    if (board[r].every((cell) => cell !== null)) {
      rowsToClear.push(r);
    }
  }

  // Check columns
  for (let c = 0; c < GRID_SIZE; c++) {
    let full = true;
    for (let r = 0; r < GRID_SIZE; r++) {
      if (board[r][c] === null) {
        full = false;
        break;
      }
    }
    if (full) {
      colsToClear.push(c);
    }
  }

  const linesCleared = rowsToClear.length + colsToClear.length;

  if (linesCleared === 0) {
    return {
      newBoard: board,
      linesCleared: 0,
      clearedRows: [],
      clearedCols: [],
    };
  }

  const newBoard = board.map((row) => [...row]);

  // Clear rows
  rowsToClear.forEach((r) => {
    for (let c = 0; c < GRID_SIZE; c++) {
      newBoard[r][c] = null;
    }
  });

  // Clear cols
  colsToClear.forEach((c) => {
    for (let r = 0; r < GRID_SIZE; r++) {
      newBoard[r][c] = null;
    }
  });

  return {
    newBoard,
    linesCleared,
    clearedRows: rowsToClear,
    clearedCols: colsToClear,
  };
}

export function canAnyPieceFit(board: BoardGrid, pieces: Piece[]): boolean {
  if (pieces.length === 0) return true;

  for (const piece of pieces) {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (canPlacePiece(board, piece, r, c)) {
          return true;
        }
      }
    }
  }

  return false;
}

export function calculatePieceBlockCount(piece: Piece): number {
  let count = 0;
  for (const row of piece.shape) {
    for (const val of row) {
      if (val === 1) count++;
    }
  }
  return count;
}
