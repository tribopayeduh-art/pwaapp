export interface GameUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  referralCode?: string;
  affiliateId?: string;
}

export interface GameStats {
  id: string;
  userId: string;
  userName: string;
  highScore: number;
  gamesPlayed: number;
  linesCleared: number;
  maxCombo: number;
  level: number;
  updatedAt: string;
}

export interface RankingEntry {
  rank: number;
  userName: string;
  highScore: number;
  linesCleared: number;
  gamesPlayed: number;
  level: number;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  target: number;
  current: number;
  completed: boolean;
  rewardText: string;
}

export type BlockShape = number[][]; // 2D array 0 or 1

export interface Piece {
  id: string;
  shape: BlockShape;
  color: string; // Tailwind color or hex
  glow: string;
}

export type BoardGrid = (string | null)[][]; // 8x8 grid of colors
