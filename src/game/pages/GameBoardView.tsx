import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameUser, Piece, BoardGrid } from '../types';
import {
  createEmptyBoard,
  generateRandomPieces,
  canPlacePiece,
  placePieceOnBoard,
  checkAndClearLines,
  canAnyPieceFit,
  calculatePieceBlockCount,
} from '../engine/blockPuzzleEngine';
import {
  ArrowLeft,
  RotateCcw,
  Trophy,
  Flame,
  Sparkles,
  Volume2,
  VolumeX,
  TrendingUp,
  DollarSign,
  Crown,
  CheckCircle2,
  Zap,
  Gamepad2,
} from 'lucide-react';

interface GameBoardViewProps {
  user: GameUser | null;
  initialBet?: number;
  onBackToDashboard: () => void;
  onShowToast: (msg: string, type?: 'info' | 'success' | 'error') => void;
  onUpdateUserBalance?: (newBalance: number) => void;
  onOpenDeposit?: () => void;
}

// Simple Web Audio API sound generator
const playAudioFx = (type: 'place' | 'clear' | 'cashout' | 'fail', enabled: boolean = true) => {
  if (!enabled) return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'place') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'clear') {
      [440, 554, 659, 880].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.06);
        gain.gain.setValueAtTime(0.2, ctx.currentTime + index * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.06 + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + index * 0.06);
        osc.stop(ctx.currentTime + index * 0.06 + 0.15);
      });
    } else if (type === 'cashout') {
      [523, 659, 783, 1046, 1318].forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.07);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + index * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.07 + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + index * 0.07);
        osc.stop(ctx.currentTime + index * 0.07 + 0.2);
      });
    } else if (type === 'fail') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.25);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (_) {
    // Ignore audio context autoplay restriction errors
  }
};

export const GameBoardView: React.FC<GameBoardViewProps> = ({
  user,
  initialBet = 10,
  onBackToDashboard,
  onShowToast,
  onUpdateUserBalance,
  onOpenDeposit,
}) => {
  const [betAmount, setBetAmount] = useState<number>(initialBet);
  const [board, setBoard] = useState<BoardGrid>(createEmptyBoard);

  // Real RTP & Difficulty Configuration from backend
  const [gameConfig, setGameConfig] = useState<{
    rtpPercent: number;
    difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
    isInfluencer?: boolean;
    isInfluencerMode?: boolean;
    maxMultiplier: number;
    antiBailoutMode: boolean;
    heavyBlocksForce: boolean;
    dynamicRetention: boolean;
    streakLimiterMultiplier: number;
    nearLossPressure: boolean;
    winStreakBrake?: boolean;
    antiComboBlocker?: boolean;
    highBetResistance?: boolean;
    giantPieceFrequency?: number;
    instantLossOnTargetProfit?: number;
    tightenOnHighOccupancy?: boolean;
    minCashoutMultiplier: number;
    lineMultiplierStep: number;
    initialMultiplier?: number;
    retentionAggressiveness?: 'soft' | 'moderate' | 'aggressive' | 'ruthless' | 'impossible';
    forceLossOnMaxMultiplier?: boolean;
    consecutiveWinDecay?: number;
  }>({
    rtpPercent: user?.isInfluencer ? 90 : 96,
    difficulty: 'easy',
    isInfluencer: Boolean(user?.isInfluencer),
    isInfluencerMode: Boolean(user?.isInfluencer),
    maxMultiplier: 100,
    antiBailoutMode: false,
    heavyBlocksForce: false,
    dynamicRetention: !user?.isInfluencer,
    streakLimiterMultiplier: user?.isInfluencer ? 100.0 : 6.0,
    nearLossPressure: false,
    winStreakBrake: !user?.isInfluencer,
    antiComboBlocker: false,
    highBetResistance: !user?.isInfluencer,
    giantPieceFrequency: user?.isInfluencer ? 0 : 25,
    instantLossOnTargetProfit: 0,
    tightenOnHighOccupancy: !user?.isInfluencer,
    minCashoutMultiplier: 1.05,
    lineMultiplierStep: user?.isInfluencer ? 0.50 : 0.40,
    initialMultiplier: 1.0,
    retentionAggressiveness: user?.isInfluencer ? 'soft' : 'moderate',
    forceLossOnMaxMultiplier: !user?.isInfluencer,
    consecutiveWinDecay: user?.isInfluencer ? 0 : 0.05,
    smartRtp: !user?.isInfluencer,
    smartRtpEasyThreshold: 30,
    smartRtpMidThreshold: 60,
    smartRtpHardThreshold: 85,
    smartRtpMaxTarget: 100,
  });

  const isUserInfluencer = Boolean(user?.isInfluencer || gameConfig.isInfluencerMode);

  const [pieces, setPieces] = useState<Piece[]>(() =>
    generateRandomPieces({
      rtpPercent: isUserInfluencer ? 99.8 : 96,
      difficulty: 'easy',
      isInfluencer: isUserInfluencer,
      currentMultiplier: 1.0,
      betAmount: 1.0,
    })
  );
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(null);

  // Fetch Real Game Config on load & Poll every 3 seconds for real-time admin tweaks
  useEffect(() => {
    const fetchConfig = () => {
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      fetch('/api/game/config', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.rtpPercent === 'number') {
            const isInf = Boolean(user?.isInfluencer || data.isInfluencer || data.isInfluencerMode);
            const cfg = {
              rtpPercent: isInf ? 99.8 : data.rtpPercent,
              difficulty: (data.difficulty as 'easy' | 'medium' | 'hard' | 'extreme') || 'easy',
              isInfluencer: isInf,
              isInfluencerMode: isInf,
              maxMultiplier: data.maxMultiplier || 100,
              antiBailoutMode: isInf ? false : Boolean(data.antiBailoutMode),
              heavyBlocksForce: isInf ? false : Boolean(data.heavyBlocksForce),
              dynamicRetention: isInf ? false : (data.dynamicRetention ?? true),
              streakLimiterMultiplier: isInf ? 100.0 : (data.streakLimiterMultiplier ?? 6.0),
              nearLossPressure: isInf ? false : Boolean(data.nearLossPressure),
              winStreakBrake: isInf ? false : Boolean(data.winStreakBrake),
              antiComboBlocker: isInf ? false : Boolean(data.antiComboBlocker),
              highBetResistance: isInf ? false : Boolean(data.highBetResistance),
              giantPieceFrequency: isInf ? 0 : (data.giantPieceFrequency ?? 25),
              instantLossOnTargetProfit: data.instantLossOnTargetProfit ?? 0,
              tightenOnHighOccupancy: isInf ? false : Boolean(data.tightenOnHighOccupancy),
              minCashoutMultiplier: data.minCashoutMultiplier ?? 1.05,
              lineMultiplierStep: isInf ? 0.50 : (data.lineMultiplierStep ?? 0.40),
              initialMultiplier: data.initialMultiplier ?? 1.0,
              retentionAggressiveness: (data.retentionAggressiveness as 'soft' | 'moderate' | 'aggressive' | 'ruthless' | 'impossible') || (isInf ? 'soft' : 'moderate'),
              forceLossOnMaxMultiplier: isInf ? false : (data.forceLossOnMaxMultiplier ?? true),
              consecutiveWinDecay: isInf ? 0 : (data.consecutiveWinDecay ?? 0.05),
              smartRtp: isInf ? false : (data.smartRtp !== false),
              smartRtpEasyThreshold: Number(data.smartRtpEasyThreshold || 30),
              smartRtpMidThreshold: Number(data.smartRtpMidThreshold || 60),
              smartRtpHardThreshold: Number(data.smartRtpHardThreshold || 85),
              smartRtpMaxTarget: Number(data.smartRtpMaxTarget || 100),
            };
            setGameConfig(cfg);
          }
        })
        .catch(() => {});
    };

    fetchConfig();
    const interval = setInterval(fetchConfig, 3000);
    return () => clearInterval(interval);
  }, [user?.isInfluencer]);

  // iGaming Multiplier Engine State
  const [multiplier, setMultiplier] = useState<number>(1.0);
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(0);
  const [clearedLinesTotal, setClearedLinesTotal] = useState<number>(0);
  const [combo, setCombo] = useState<number>(0);
  const [maxCombo, setMaxCombo] = useState<number>(0);

  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  // Board DOM Ref for precise mathematical coordinate calculation
  const boardRef = useRef<HTMLDivElement>(null);

  // Drag and Drop Touch & Pointer State
  const [draggingPieceIndex, setDraggingPieceIndex] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState<boolean>(false);

  // Helper to determine board cell mathematically using bounding client rect
  const updateHoverFromPoint = useCallback((clientX: number, clientY: number, activeIndex?: number) => {
    const pIdx = activeIndex ?? draggingPieceIndex ?? selectedPieceIndex;
    if (pIdx === null || !pieces[pIdx]) {
      setHoverRow(null);
      setHoverCol(null);
      return;
    }

    const boardEl = boardRef.current;
    if (!boardEl) return;

    const rect = boardEl.getBoundingClientRect();
    const currentPiece = pieces[pIdx];
    const pRows = currentPiece.shape.length;
    const pCols = currentPiece.shape[0].length;

    // Shift target anchor 80px upwards on mobile so thumb/finger never obstructs board cells
    const VERTICAL_OFFSET = 80;
    const targetX = clientX;
    const targetY = clientY - VERTICAL_OFFSET;

    const cellW = rect.width / 8;
    const cellH = rect.height / 8;

    // Check proximity to board (with generous margin for ease of dragging)
    const margin = 40;
    if (
      targetX >= rect.left - margin &&
      targetX <= rect.right + margin &&
      targetY >= rect.top - margin &&
      targetY <= rect.bottom + margin
    ) {
      // Align piece center with the target pointer position
      const rawCol = Math.round((targetX - rect.left - (pCols * cellW) / 2) / cellW);
      const rawRow = Math.round((targetY - rect.top - (pRows * cellH) / 2) / cellH);

      const clampedRow = Math.max(0, Math.min(8 - pRows, rawRow));
      const clampedCol = Math.max(0, Math.min(8 - pCols, rawCol));

      setHoverRow(clampedRow);
      setHoverCol(clampedCol);
    } else {
      setHoverRow(null);
      setHoverCol(null);
    }
  }, [draggingPieceIndex, selectedPieceIndex, pieces]);

  // Touch & Pointer start on piece card
  const handlePieceTouchStart = (pIdx: number, fitsSomewhere: boolean, e: React.TouchEvent | React.MouseEvent) => {
    if (!fitsSomewhere || gameOver || cashoutSuccess) return;
    const isTouch = 'touches' in e;
    setIsTouchDevice(isTouch);
    const clientX = isTouch ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = isTouch ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

    setSelectedPieceIndex(pIdx);
    setDraggingPieceIndex(pIdx);
    setDragPos({ x: clientX, y: clientY });
    updateHoverFromPoint(clientX, clientY, pIdx);
  };

  const handleGlobalTouchMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (draggingPieceIndex === null) return;
    if (e.cancelable) e.preventDefault(); // Prevent scrolling while dragging piece
    const isTouch = 'touches' in e;
    const clientX = isTouch ? e.touches[0].clientX : (e as MouseEvent).clientX;
    const clientY = isTouch ? e.touches[0].clientY : (e as MouseEvent).clientY;

    setDragPos({ x: clientX, y: clientY });
    updateHoverFromPoint(clientX, clientY, draggingPieceIndex);
  }, [draggingPieceIndex, updateHoverFromPoint]);

  const handleGlobalTouchEnd = useCallback(() => {
    if (draggingPieceIndex !== null) {
      if (hoverRow !== null && hoverCol !== null) {
        handlePlacePiece(draggingPieceIndex, hoverRow, hoverCol);
      }
      setDraggingPieceIndex(null);
      setDragPos(null);
      setHoverRow(null);
      setHoverCol(null);
    }
  }, [draggingPieceIndex, hoverRow, hoverCol]);

  useEffect(() => {
    if (draggingPieceIndex !== null) {
      const onMove = (e: any) => handleGlobalTouchMove(e);
      const onEnd = () => handleGlobalTouchEnd();

      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      return () => {
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
      };
    }
  }, [draggingPieceIndex, handleGlobalTouchMove, handleGlobalTouchEnd]);

  // Compute which full lines/columns will be cleared if the hovering piece is placed
  const projectedClearedLines = useMemo(() => {
    const activeIdx = draggingPieceIndex ?? selectedPieceIndex;
    if (activeIdx === null || hoverRow === null || hoverCol === null || !pieces[activeIdx]) {
      return { rows: [] as number[], cols: [] as number[] };
    }
    const piece = pieces[activeIdx];
    if (!canPlacePiece(board, piece, hoverRow, hoverCol)) {
      return { rows: [] as number[], cols: [] as number[] };
    }

    // Clone board and apply ghost piece
    const tempBoard = board.map((row) => [...row]);
    for (let r = 0; r < piece.shape.length; r++) {
      for (let c = 0; c < piece.shape[0].length; c++) {
        if (piece.shape[r][c] === 1) {
          tempBoard[hoverRow + r][hoverCol + c] = piece.color;
        }
      }
    }

    const fullRows: number[] = [];
    const fullCols: number[] = [];

    for (let r = 0; r < 8; r++) {
      if (tempBoard[r].every((cell) => cell !== null)) {
        fullRows.push(r);
      }
    }
    for (let c = 0; c < 8; c++) {
      let isFull = true;
      for (let r = 0; r < 8; r++) {
        if (tempBoard[r][c] === null) {
          isFull = false;
          break;
        }
      }
      if (isFull) {
        fullCols.push(c);
      }
    }

    return { rows: fullRows, cols: fullCols };
  }, [board, draggingPieceIndex, selectedPieceIndex, hoverRow, hoverCol, pieces]);

  // Status & Audio Controls
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentBalance, setCurrentBalance] = useState<number>(() => user?.balance ?? 0);
  const [gameOver, setGameOver] = useState<boolean>(false);
  const [cashoutSuccess, setCashoutSuccess] = useState<boolean>(false);
  const [cashedOutAmount, setCashedOutAmount] = useState<number>(0);
  const [cashingOut, setCashingOut] = useState<boolean>(false);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [multiplierAlert, setMultiplierAlert] = useState<string | null>(null);
  const [activeBetId, setActiveBetId] = useState<string | null>(null);

  // Sync current balance with user prop whenever it changes
  useEffect(() => {
    if (user?.balance !== undefined && !isNaN(user.balance)) {
      setCurrentBalance(user.balance);
    }
  }, [user?.balance]);

  // Deduct initial bet on game start if authenticated
  useEffect(() => {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token');
    if (token && betAmount > 0) {
      fetch('/api/game/start-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ betAmount }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.balance === 'number') {
            if (data.betId) setActiveBetId(data.betId);
            setCurrentBalance(data.balance);
            if (onUpdateUserBalance) onUpdateUserBalance(data.balance);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Fetch High Score
  useEffect(() => {
    const token = localStorage.getItem('pg_auth_token');
    if (token) {
      fetch('/api/game/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.highScore === 'number') {
            setHighScore(data.highScore);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Handle Game Restart
  const handleRestart = () => {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token');
    if (token && betAmount > 0) {
      if (currentBalance < betAmount) {
        onShowToast('Saldo insuficiente para iniciar nova aposta!', 'error');
        if (onOpenDeposit) onOpenDeposit();
        return;
      }

      fetch('/api/game/start-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ betAmount }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.balance === 'number') {
            if (data.betId) setActiveBetId(data.betId);
            setCurrentBalance(data.balance);
            if (onUpdateUserBalance) onUpdateUserBalance(data.balance);
          }
        })
        .catch(() => {});
    }

    setBoard(createEmptyBoard());
    const initMult = gameConfig.initialMultiplier || 1.0;
    setPieces(
      generateRandomPieces({
        rtpPercent: gameConfig.rtpPercent,
        difficulty: gameConfig.difficulty,
        isInfluencer: isUserInfluencer,
        currentMultiplier: initMult,
        betAmount: betAmount,
        antiBailoutMode: gameConfig.antiBailoutMode,
        heavyBlocksForce: gameConfig.heavyBlocksForce,
        dynamicRetention: gameConfig.dynamicRetention,
        streakLimiterMultiplier: gameConfig.streakLimiterMultiplier,
        nearLossPressure: gameConfig.nearLossPressure,
        winStreakBrake: gameConfig.winStreakBrake,
        antiComboBlocker: gameConfig.antiComboBlocker,
        highBetResistance: Boolean(gameConfig.highBetResistance && betAmount >= 10),
        giantPieceFrequency: gameConfig.giantPieceFrequency,
        instantLossOnTargetProfit: gameConfig.instantLossOnTargetProfit,
        tightenOnHighOccupancy: gameConfig.tightenOnHighOccupancy,
        maxMultiplier: gameConfig.maxMultiplier,
        retentionAggressiveness: gameConfig.retentionAggressiveness,
        forceLossOnMaxMultiplier: gameConfig.forceLossOnMaxMultiplier,
        consecutiveWinDecay: gameConfig.consecutiveWinDecay,
        smartRtp: gameConfig.smartRtp,
        smartRtpEasyThreshold: gameConfig.smartRtpEasyThreshold,
        smartRtpMidThreshold: gameConfig.smartRtpMidThreshold,
        smartRtpHardThreshold: gameConfig.smartRtpHardThreshold,
        smartRtpMaxTarget: gameConfig.smartRtpMaxTarget,
      })
    );
    setSelectedPieceIndex(null);
    setScore(0);
    setMultiplier(initMult);
    setClearedLinesTotal(0);
    setCombo(0);
    setMaxCombo(0);
    setGameOver(false);
    setCashoutSuccess(false);
    setIsNewRecord(false);
    setMultiplierAlert(null);
  };

  // Check Game Over
  const checkGameOverState = useCallback(
    (currentBoard: BoardGrid, currentPieces: Piece[]) => {
      if (currentPieces.length > 0) {
        const canFit = canAnyPieceFit(currentBoard, currentPieces);
        if (!canFit) {
          setGameOver(true);
          playAudioFx('fail', soundEnabled);

          const isRecord = score > highScore;
          if (isRecord) {
            setHighScore(score);
            setIsNewRecord(true);
          }

          const token = localStorage.getItem('pg_auth_token');
          if (token && user) {
            fetch('/api/game/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                betId: activeBetId,
                score,
                lines: clearedLinesTotal,
                maxCombo,
              }),
            }).catch(() => {});
          }
        }
      }
    },
    [score, highScore, clearedLinesTotal, maxCombo, user, soundEnabled, activeBetId]
  );

  // Trigger temporary multiplier alert toast
  const triggerMultiplierToast = (msg: string) => {
    setMultiplierAlert(msg);
    setTimeout(() => {
      setMultiplierAlert(null);
    }, 2000);
  };

  // Handle placing piece
  const handlePlacePiece = (pieceIndex: number, startRow: number, startCol: number) => {
    if (gameOver || cashoutSuccess) return;
    if (pieceIndex === null || pieceIndex >= pieces.length) return;

    const piece = pieces[pieceIndex];
    if (!canPlacePiece(board, piece, startRow, startCol)) {
      onShowToast('A peça não cabe nesta posição!', 'info');
      return;
    }

    // Place piece
    const boardWithPiece = placePieceOnBoard(board, piece, startRow, startCol);
    const pieceBlocks = calculatePieceBlockCount(piece);
    const blockPoints = pieceBlocks * 10;

    // Check line clears
    const { newBoard, linesCleared } = checkAndClearLines(boardWithPiece);

    let newCombo = combo;
    let addedScore = blockPoints;
    let multBoost = 0.03; // Small boost for placing a piece

    const stepMultiplier = gameConfig.lineMultiplierStep || 0.40;

    if (linesCleared > 0) {
      playAudioFx('clear', soundEnabled);
      newCombo = combo + 1;
      const comboMultiplier = Math.max(1, newCombo);
      addedScore += linesCleared * 100 * comboMultiplier;
      setClearedLinesTotal((prev) => prev + linesCleared);

      // Multiplier increase logic using dynamic step
      multBoost += linesCleared * stepMultiplier + (newCombo > 1 ? newCombo * 0.20 : 0);
      triggerMultiplierToast(`+${multBoost.toFixed(2)}x MULTIPLICADOR!`);
    } else {
      playAudioFx('place', soundEnabled);
      newCombo = 0;
    }

    const maxAllowedMult = gameConfig.maxMultiplier || 100.0;
    const newMult = Math.min(maxAllowedMult, Math.round((multiplier + multBoost) * 100) / 100);
    const newScore = score + addedScore;

    setScore(newScore);
    setMultiplier(newMult);
    setCombo(newCombo);
    if (newCombo > maxCombo) {
      setMaxCombo(newCombo);
    }

    setBoard(newBoard);

    // Remaining pieces
    const remainingPieces = pieces.filter((_, idx) => idx !== pieceIndex);
    setSelectedPieceIndex(null);
    setDraggingPieceIndex(null);
    setDragPos(null);
    setHoverRow(null);
    setHoverCol(null);

    if (remainingPieces.length === 0) {
      const nextBatch = generateRandomPieces({
        board: newBoard,
        rtpPercent: gameConfig.rtpPercent,
        difficulty: gameConfig.difficulty,
        isInfluencer: isUserInfluencer,
        currentMultiplier: newMult,
        betAmount: betAmount,
        antiBailoutMode: gameConfig.antiBailoutMode,
        heavyBlocksForce: gameConfig.heavyBlocksForce,
        dynamicRetention: gameConfig.dynamicRetention,
        streakLimiterMultiplier: gameConfig.streakLimiterMultiplier,
        nearLossPressure: gameConfig.nearLossPressure,
        winStreakBrake: gameConfig.winStreakBrake,
        antiComboBlocker: gameConfig.antiComboBlocker,
        highBetResistance: Boolean(gameConfig.highBetResistance && betAmount >= 10),
        giantPieceFrequency: gameConfig.giantPieceFrequency,
        instantLossOnTargetProfit: gameConfig.instantLossOnTargetProfit,
        tightenOnHighOccupancy: gameConfig.tightenOnHighOccupancy,
        maxMultiplier: gameConfig.maxMultiplier,
        retentionAggressiveness: gameConfig.retentionAggressiveness,
        forceLossOnMaxMultiplier: gameConfig.forceLossOnMaxMultiplier,
        consecutiveWinDecay: gameConfig.consecutiveWinDecay,
        smartRtp: gameConfig.smartRtp,
        smartRtpEasyThreshold: gameConfig.smartRtpEasyThreshold,
        smartRtpMidThreshold: gameConfig.smartRtpMidThreshold,
        smartRtpHardThreshold: gameConfig.smartRtpHardThreshold,
        smartRtpMaxTarget: gameConfig.smartRtpMaxTarget,
      });
      setPieces(nextBatch);
      checkGameOverState(newBoard, nextBatch);
    } else {
      setPieces(remainingPieces);
      checkGameOverState(newBoard, remainingPieces);
    }
  };

  const handleCellClick = (startRow: number, startCol: number) => {
    if (selectedPieceIndex !== null) {
      handlePlacePiece(selectedPieceIndex, startRow, startCol);
    }
  };

  // Cashout / Retirar Lucro
  const handleCashout = async () => {
    if (cashingOut || gameOver || cashoutSuccess) return;

    const minRequired = gameConfig.minCashoutMultiplier || 1.05;
    if (multiplier < minRequired) {
      onShowToast(`Multiplicador mínimo para cashout é de ${minRequired.toFixed(2)}x!`, 'info');
      return;
    }

    const profit = parseFloat((betAmount * multiplier).toFixed(2));

    setCashingOut(true);
    playAudioFx('cashout', soundEnabled);

    try {
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token');
      if (token) {
        const res = await fetch('/api/game/cashout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            betId: activeBetId,
            betAmount,
            multiplier,
            profitAmount: profit,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro ao realizar cashout');

        if (typeof data.balance === 'number') {
          setCurrentBalance(data.balance);
          if (onUpdateUserBalance) {
            onUpdateUserBalance(data.balance);
          }
        } else {
          const updatedBal = parseFloat((currentBalance + profit).toFixed(2));
          setCurrentBalance(updatedBal);
          if (onUpdateUserBalance) {
            onUpdateUserBalance(updatedBal);
          }
        }
      } else {
        const updatedBal = parseFloat((currentBalance + profit).toFixed(2));
        setCurrentBalance(updatedBal);
        if (onUpdateUserBalance) {
          onUpdateUserBalance(updatedBal);
        }
      }

      setCashedOutAmount(profit);
      setCashoutSuccess(true);
      onShowToast(`🎉 Ganho de R$ ${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} adicionado ao seu saldo!`, 'success');
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao processar saque do jogo.', 'error');
    } finally {
      setCashingOut(false);
    }
  };

  const currentProfit = (betAmount * multiplier).toFixed(2);
  const formattedProfit = parseFloat(currentProfit).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  // Calculate multiplier tier percentage for level bar (max 10.0x for gauge display)
  const multProgressPercent = Math.min(100, Math.max(0, ((multiplier - 1.0) / 9.0) * 100));

  return (
    <div className="fixed inset-0 h-[100dvh] w-screen bg-[#070D22] text-white flex flex-col justify-between p-2 sm:p-3 select-none overflow-hidden touch-none overscroll-none font-sans bg-[linear-gradient(to_right,#15234A20_1px,transparent_1px),linear-gradient(to_bottom,#15234A20_1px,transparent_1px)] bg-[size:24px_24px] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      {/* Background Ambient Lighting Orbs */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-sm w-full mx-auto flex-1 flex flex-col justify-between space-y-1 sm:space-y-1.5 h-full min-h-0 relative z-10">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between pt-0.5 pb-0.5 shrink-0">
          {/* Lobby Button */}
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-[#0A1738] border border-[#1E336A] text-slate-200 hover:text-white text-[11px] sm:text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-1 shadow-md"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
            <span>Lobby</span>
          </button>

          {/* Logo */}
          <div className="flex items-center cursor-pointer">
            <img
              src="/blocklogo.png"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/logoblock.png';
              }}
              alt="BLOCK WIN"
              className="h-7 sm:h-9 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,240,255,0.4)]"
            />
          </div>

          {/* Enhanced Glowing Saldo Badge */}
          <div
            onClick={() => {
              if (onOpenDeposit) onOpenDeposit();
              else onShowToast('Depósito PIX instantâneo', 'info');
            }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#00E676]/15 via-[#00C853]/20 to-[#00E676]/15 border border-[#00E676]/60 rounded-xl px-2 py-0.5 sm:px-2.5 sm:py-1 text-[#00E676] font-mono font-black text-[11px] sm:text-xs shadow-lg shadow-[#00E676]/20 cursor-pointer active:scale-95 transition-all hover:brightness-110"
            title="Apertar para Depositar"
          >
            <div className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
            <span className="tracking-tight font-mono font-extrabold text-[#00E676] drop-shadow-[0_0_8px_rgba(0,230,118,0.5)]">
              R$ {currentBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-[#00E676] text-[#031C0B] font-black text-[9px] sm:text-[10px] flex items-center justify-center shrink-0">
              +
            </div>
          </div>
        </div>

        {/* Top Ganhos Acumulados / Multiplier HUD Panel */}
        <div className="bg-[#091638] border border-[#1B3168] rounded-2xl p-2 sm:p-2.5 text-center shadow-xl relative overflow-hidden space-y-1 shrink-0">
          {/* Ambient Glows */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-10 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between px-1 text-[9px] sm:text-[10px] text-cyan-300 font-extrabold font-mono tracking-wider uppercase">
            <div className="flex items-center gap-1.5">
              <span>GANHOS ACUMULADOS</span>
              {isUserInfluencer ? (
                <span className="bg-gradient-to-r from-amber-500/30 to-emerald-500/30 text-amber-300 border border-amber-500/40 text-[8px] font-black px-1.5 py-0.2 rounded flex items-center gap-0.5 animate-pulse">
                  ⭐ INFLUENCIADOR (80% WIN)
                </span>
              ) : (
                <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded ${
                  gameConfig.difficulty === 'easy'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : gameConfig.difficulty === 'medium'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : gameConfig.difficulty === 'hard'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {gameConfig.difficulty === 'easy' ? 'FÁCIL' : gameConfig.difficulty === 'medium' ? 'MÉDIO' : gameConfig.difficulty === 'hard' ? 'DIFÍCIL' : 'EXTREMO'}
                </span>
              )}
            </div>
            <span className="text-amber-400 font-bold flex items-center gap-0.5">
              <Zap className="w-3 h-3 fill-amber-400" />
              {multiplier.toFixed(2)}x
            </span>
          </div>

          {/* Accumulated Profit Display */}
          <div className="text-xl sm:text-2xl font-black text-[#00E676] font-mono tracking-tight drop-shadow-[0_0_12px_rgba(0,230,118,0.5)]">
            R$ {formattedProfit}
          </div>

          {/* Multiplier Level Progress Bar */}
          <div className="w-full bg-[#060D24] border border-[#162752] h-1.5 sm:h-2 rounded-full overflow-hidden p-0.5 relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400 transition-all duration-300 shadow-sm shadow-cyan-400/50"
              style={{ width: `${multProgressPercent}%` }}
            />
          </div>

          {/* Floating Multiplier Toast Notification */}
          {multiplierAlert && (
            <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 px-3 py-0.5 bg-gradient-to-r from-amber-400 to-orange-500 text-black font-extrabold text-[11px] rounded-full shadow-lg shadow-amber-500/40 animate-bounce font-mono">
              {multiplierAlert}
            </div>
          )}
        </div>

        {/* 8x8 BOARD GRID CONTAINER */}
        <div
          ref={boardRef}
          className="bg-[#08122D] border-2 border-[#162B5E] rounded-2xl p-1.5 sm:p-2 shadow-2xl relative w-full max-w-[min(340px,80vw,42vh)] aspect-square flex items-center justify-center mx-auto my-auto shrink-0 select-none touch-none"
        >
          <div className="grid grid-cols-8 gap-1 aspect-square w-full">
            {board.map((row, rIdx) =>
              row.map((cellColor, cIdx) => {
                const activePieceIdx = draggingPieceIndex ?? selectedPieceIndex;
                let isGhostPart = false;
                let isGhostValid = false;
                let ghostColor = '';

                if (
                  activePieceIdx !== null &&
                  activePieceIdx < pieces.length &&
                  hoverRow !== null &&
                  hoverCol !== null
                ) {
                  const currentPiece = pieces[activePieceIdx];
                  const pRows = currentPiece.shape.length;
                  const pCols = currentPiece.shape[0].length;

                  if (
                    rIdx >= hoverRow &&
                    rIdx < hoverRow + pRows &&
                    cIdx >= hoverCol &&
                    cIdx < hoverCol + pCols
                  ) {
                    if (currentPiece.shape[rIdx - hoverRow][cIdx - hoverCol] === 1) {
                      isGhostPart = true;
                      isGhostValid = canPlacePiece(board, currentPiece, hoverRow, hoverCol);
                      ghostColor = currentPiece.color;
                    }
                  }
                }

                // Check if this cell is in a line/col that will explode/clear
                const isLineWillClear =
                  projectedClearedLines.rows.includes(rIdx) ||
                  projectedClearedLines.cols.includes(cIdx);

                return (
                  <div
                    key={`${rIdx}-${cIdx}`}
                    data-cell="true"
                    data-row={rIdx}
                    data-col={cIdx}
                    onClick={() => handleCellClick(rIdx, cIdx)}
                    onMouseEnter={() => {
                      if (selectedPieceIndex !== null && draggingPieceIndex === null) {
                        setHoverRow(rIdx);
                        setHoverCol(cIdx);
                      }
                    }}
                    className={`rounded-md border transition-all duration-100 flex items-center justify-center cursor-pointer aspect-square relative overflow-hidden ${
                      cellColor
                        ? `bg-gradient-to-tr ${cellColor} border-white/40 shadow-sm shadow-cyan-500/20 ${
                            isLineWillClear ? 'ring-2 ring-amber-300 brightness-125 animate-pulse' : ''
                          }`
                        : isGhostPart
                        ? isGhostValid
                          ? `bg-gradient-to-tr ${ghostColor} border-2 border-white opacity-85 shadow-lg shadow-cyan-400/50 scale-95 ring-2 ring-cyan-400 animate-pulse`
                          : 'bg-rose-500/40 border-2 border-rose-400/90 ring-1 ring-rose-500 scale-95 animate-pulse'
                        : isLineWillClear
                        ? 'bg-amber-400/25 border-amber-300/80 animate-pulse'
                        : 'bg-[#0A183D] border-[#152857] hover:border-cyan-500/40'
                    }`}
                  >
                    {/* Inner Shimmer on line clear preview */}
                    {isLineWillClear && (
                      <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/20 to-cyan-300/20 animate-pulse pointer-events-none" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* BOTTOM PIECE SELECTION TRAY & RETIRAR GANHOS BUTTON */}
        <div className="space-y-1.5 sm:space-y-2 max-w-[min(340px,80vw,42vh)] sm:max-w-[360px] w-full mx-auto pb-0.5 shrink-0">
          {/* Piece Cards Tray */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {pieces.map((piece, pIdx) => {
              const isSelected = selectedPieceIndex === pIdx;
              const isBeingDragged = draggingPieceIndex === pIdx;
              const fitsSomewhere = canAnyPieceFit(board, [piece]);

              return (
                <div
                  key={piece.id}
                  onClick={() => {
                    if (fitsSomewhere) {
                      if (selectedPieceIndex === pIdx) {
                        setSelectedPieceIndex(null);
                        setHoverRow(null);
                        setHoverCol(null);
                      } else {
                        setSelectedPieceIndex(pIdx);
                      }
                    }
                  }}
                  onTouchStart={(e) => handlePieceTouchStart(pIdx, fitsSomewhere, e)}
                  onMouseDown={(e) => handlePieceTouchStart(pIdx, fitsSomewhere, e)}
                  className={`h-15 sm:h-18 rounded-xl sm:rounded-2xl border-2 flex items-center justify-center p-1 sm:p-2 transition-all cursor-grab active:cursor-grabbing relative overflow-hidden select-none touch-none ${
                    isBeingDragged
                      ? 'bg-cyan-500/20 border-[#00F0FF] shadow-lg shadow-cyan-500/30 scale-105 ring-2 ring-cyan-400 opacity-40'
                      : isSelected
                      ? 'bg-cyan-500/25 border-[#00F0FF] shadow-xl shadow-cyan-400/40 ring-2 ring-cyan-300 scale-102'
                      : !fitsSomewhere
                      ? 'bg-[#09132E]/80 border-[#14234C] opacity-40 cursor-not-allowed'
                      : 'bg-[#0A173B] border-[#1A2E63] hover:border-cyan-400/60 active:scale-98'
                  }`}
                >
                  {fitsSomewhere ? (
                    <div
                      className="grid gap-0.5 max-w-[46px] max-h-[46px] sm:max-w-[52px] sm:max-h-[52px] items-center justify-center pointer-events-none"
                      style={{
                        gridTemplateRows: `repeat(${piece.shape.length}, minmax(0, 1fr))`,
                        gridTemplateColumns: `repeat(${piece.shape[0].length}, minmax(0, 1fr))`,
                      }}
                    >
                      {piece.shape.map((row, r) =>
                        row.map((val, c) => (
                          <div
                            key={`${r}-${c}`}
                            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-sm ${
                              val === 1
                                ? `bg-gradient-to-tr ${piece.color} shadow-sm border border-white/30`
                                : 'opacity-0'
                            }`}
                          />
                        ))
                      )}
                    </div>
                  ) : (
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-500 font-mono">
                      Utilizada
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* RETIRAR GANHOS / CASHOUT BUTTON */}
          <button
            type="button"
            onClick={handleCashout}
            disabled={cashingOut || gameOver || cashoutSuccess}
            className="w-full py-2.5 sm:py-3.5 px-3 sm:px-4 bg-gradient-to-r from-[#FFD700] via-[#FFC000] to-[#FF9900] hover:brightness-110 active:scale-98 text-[#201200] font-black text-xs sm:text-base rounded-xl sm:rounded-2xl shadow-xl shadow-amber-500/20 transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-1.5 sm:gap-2 border border-amber-200/50 font-mono disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          >
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            <span>RETIRAR GANHOS (R$ {formattedProfit})</span>
          </button>
        </div>

      </div>

      {/* FLOATING DRAGGED PIECE PREVIEW (MOBILE TOUCH ERGONOMIC OFFSET) */}
      {draggingPieceIndex !== null && dragPos !== null && pieces[draggingPieceIndex] && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-1/2 transition-none shadow-2xl drop-shadow-[0_15px_30px_rgba(0,0,0,0.8)]"
          style={{
            left: `${dragPos.x}px`,
            top: `${dragPos.y - 80}px`,
          }}
        >
          {/* Aiming Indicator Laser / Pointer to touch point */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-12 bg-gradient-to-b from-cyan-400 to-transparent opacity-70 pointer-events-none" />
          <div className="absolute top-[calc(100%+48px)] left-1/2 -translate-x-1/2 w-3 h-3 rounded-full border border-cyan-400 bg-cyan-400/40 animate-ping pointer-events-none" />

          {/* Floating Shape Card */}
          <div
            className="grid gap-1 p-2 bg-[#08122D]/95 border-2 border-[#00F0FF] rounded-2xl backdrop-blur-md shadow-2xl shadow-cyan-500/50 scale-105"
            style={{
              gridTemplateRows: `repeat(${pieces[draggingPieceIndex].shape.length}, minmax(0, 1fr))`,
              gridTemplateColumns: `repeat(${pieces[draggingPieceIndex].shape[0].length}, minmax(0, 1fr))`,
            }}
          >
            {pieces[draggingPieceIndex].shape.map((row, r) =>
              row.map((val, c) => (
                <div
                  key={`drag-${r}-${c}`}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md ${
                    val === 1
                      ? `bg-gradient-to-tr ${pieces[draggingPieceIndex].color} border border-white/70 shadow-md`
                      : 'opacity-0'
                  }`}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* CASHOUT SUCCESS CELEBRATION MODAL */}
      {cashoutSuccess && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-b from-[#0D1B3E] via-[#09122B] to-[#060B1C] border border-emerald-400/50 rounded-3xl p-6 max-w-sm w-full text-center space-y-5 shadow-2xl relative overflow-hidden">
            
            <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-[#00E676] p-0.5 mx-auto flex items-center justify-center shadow-2xl shadow-[#00E676]/40 animate-bounce">
              <CheckCircle2 className="w-12 h-12 text-[#00E676]" />
            </div>

            <div className="space-y-1 font-mono">
              <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">
                LUCRO MULTIPLICADO!
              </span>
              <h3 className="text-3xl font-black text-white tracking-tight">
                R$ {cashedOutAmount.toFixed(2).replace('.', ',')}
              </h3>
              <p className="text-xs text-slate-400">
                Multiplicador de <span className="text-[#FFE600] font-bold">{multiplier.toFixed(2)}x</span> alcançado!
              </p>
            </div>

            <div className="bg-[#080E21] border border-[#192A54] rounded-2xl p-3.5 space-y-2 font-mono text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Aposta Inicial:</span>
                <span className="font-bold text-white">R$ {betAmount.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Multiplicador:</span>
                <span className="font-bold text-amber-400">{multiplier.toFixed(2)}x</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800">
                <span className="text-emerald-400 font-bold">Lucro Total Depositado:</span>
                <span className="font-black text-[#00E676] text-sm">+R$ {cashedOutAmount.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full py-4 bg-[#00E676] hover:bg-[#00C853] text-[#031C0B] font-black text-sm rounded-2xl shadow-xl shadow-[#00E676]/30 transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>JOGAR NOVAMENTE</span>
              </button>

              <button
                type="button"
                onClick={onBackToDashboard}
                className="w-full py-3 bg-[#111A33] hover:bg-[#1A284D] border border-[#21325B] text-slate-300 font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
              >
                VOLTAR AO DASHBOARD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER MODAL */}
      {gameOver && !cashoutSuccess && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-gradient-to-b from-[#180E28] via-[#0E0A1A] to-[#07050E] border border-rose-500/40 rounded-3xl p-6 max-w-sm w-full text-center space-y-5 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-purple-600 p-0.5 mx-auto shadow-xl flex items-center justify-center">
              <div className="w-full h-full bg-[#0E0A1A] rounded-[14px] flex items-center justify-center">
                <Gamepad2 className="w-8 h-8 text-rose-400" />
              </div>
            </div>

            <div className="space-y-1 font-mono">
              <h3 className="text-2xl font-black text-white tracking-tight">FIM DE JOGO</h3>
              <p className="text-xs text-slate-400">Não há mais espaço para as peças no tabuleiro.</p>
            </div>

            {isNewRecord && (
              <div className="p-2 bg-amber-500/20 border border-amber-400/40 text-amber-300 rounded-xl text-xs font-bold font-mono animate-bounce flex items-center justify-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>NOVO RECORDE PESSOAL!</span>
              </div>
            )}

            <div className="bg-[#07050E] border border-[#23153D] rounded-2xl p-4 space-y-2 font-mono text-left">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Pontuação Final:</span>
                <span className="font-extrabold text-cyan-300 text-sm">{score.toLocaleString()}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Multiplicador Alcançado:</span>
                <span className="font-bold text-amber-400">{multiplier.toFixed(2)}x</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Linhas Eliminadas:</span>
                <span className="font-bold text-white">{clearedLinesTotal}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2 font-mono">
              <button
                type="button"
                onClick={handleRestart}
                className="w-full py-3.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 text-black font-extrabold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all uppercase tracking-wider"
              >
                <RotateCcw className="w-4 h-4" />
                <span>TENTAR NOVAMENTE</span>
              </button>

              <button
                type="button"
                onClick={onBackToDashboard}
                className="w-full py-3 bg-[#171029] hover:bg-[#23193E] text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                VOLTAR AO DASHBOARD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
