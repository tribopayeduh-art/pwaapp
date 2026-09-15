import React, { useState, useEffect } from 'react';
import { RankingEntry } from '../types';
import { Trophy, ArrowLeft, Loader2, Award, Medal, Crown } from 'lucide-react';

interface GameRankingProps {
  onBack: () => void;
}

export const GameRanking: React.FC<GameRankingProps> = ({ onBack }) => {
  const [filter, setFilter] = useState<'week' | 'month' | 'all'>('week');
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch('/api/game/ranking')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRanking(data);
        } else {
          // Default mock leaderboard
          setRanking([
            { rank: 1, userName: 'Lucas Silva', highScore: 4850, linesCleared: 42, gamesPlayed: 18, level: 5 },
            { rank: 2, userName: 'Amanda Costa', highScore: 3920, linesCleared: 35, gamesPlayed: 14, level: 4 },
            { rank: 3, userName: 'Carlos Eduardo', highScore: 3100, linesCleared: 28, gamesPlayed: 11, level: 4 },
            { rank: 4, userName: 'Mariana Lima', highScore: 2750, linesCleared: 24, gamesPlayed: 9, level: 3 },
            { rank: 5, userName: 'Gabriel Santos', highScore: 2300, linesCleared: 20, gamesPlayed: 8, level: 3 },
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  const medals = ['1º', '2º', '3º'];

  return (
    <div className="min-h-screen bg-[#070D22] text-white p-4 pb-28 relative overflow-hidden select-none bg-[linear-gradient(to_right,#15234A20_1px,transparent_1px),linear-gradient(to_bottom,#15234A20_1px,transparent_1px)] bg-[size:24px_24px]">
      {/* Background Ambient Glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 -right-20 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md mx-auto space-y-5 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>

          <div className="flex items-center gap-2 font-mono">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h1 className="text-base font-extrabold text-white">RANKING GERAL</h1>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800 font-mono text-xs">
          {[
            { id: 'week', label: 'Semana' },
            { id: 'month', label: 'Mês' },
            { id: 'all', label: 'Geral' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as any)}
              className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                filter === item.id
                  ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Leaderboard List */}
        {loading ? (
          <div className="py-16 text-center text-zinc-500 space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-cyan-400" />
            <p className="text-xs font-mono">Carregando líderes...</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {ranking.map((player, index) => {
              const rankNum = player.rank || index + 1;
              const isTop3 = rankNum <= 3;

              return (
                <div
                  key={rankNum}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                    rankNum === 1
                      ? 'bg-amber-500/10 border-amber-400/50 text-amber-300'
                      : rankNum === 2
                      ? 'bg-slate-400/10 border-slate-300/40 text-slate-200'
                      : rankNum === 3
                      ? 'bg-amber-800/10 border-amber-700/40 text-amber-500'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-sm w-6 text-center">
                      {medals[index] || `#${rankNum}`}
                    </span>
                    <div>
                      <h3 className="font-bold text-xs text-white">{player.userName}</h3>
                      <p className="text-[10px] text-zinc-400 font-mono">
                        Nível {player.level || 1} • {player.linesCleared} linhas
                      </p>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <p className="font-black text-sm text-cyan-300">{player.highScore.toLocaleString()} pts</p>
                    <p className="text-[9px] text-zinc-500">{player.gamesPlayed} partidas</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
