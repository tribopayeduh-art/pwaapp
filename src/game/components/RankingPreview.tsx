import React, { useEffect, useState } from 'react';
import { RankingEntry } from '../types';
import { Trophy, Crown, ArrowRight, Medal } from 'lucide-react';

interface RankingPreviewProps {
  onViewFullRanking: () => void;
}

export const RankingPreview: React.FC<RankingPreviewProps> = ({ onViewFullRanking }) => {
  const [top3, setTop3] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/game/ranking')
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setTop3(data.slice(0, 3));
        } else {
          // Default mock leaderboard if database has fewer players yet
          setTop3([
            { rank: 1, userName: 'Lucas Silva', highScore: 4850, linesCleared: 42, gamesPlayed: 18, level: 5 },
            { rank: 2, userName: 'Amanda Costa', highScore: 3920, linesCleared: 35, gamesPlayed: 14, level: 4 },
            { rank: 3, userName: 'Carlos Eduardo', highScore: 3100, linesCleared: 28, gamesPlayed: 11, level: 4 },
          ]);
        }
      })
      .catch(() => {
        setTop3([
          { rank: 1, userName: 'Lucas Silva', highScore: 4850, linesCleared: 42, gamesPlayed: 18, level: 5 },
          { rank: 2, userName: 'Amanda Costa', highScore: 3920, linesCleared: 35, gamesPlayed: 14, level: 4 },
          { rank: 3, userName: 'Carlos Eduardo', highScore: 3100, linesCleared: 28, gamesPlayed: 11, level: 4 },
        ]);
      })
      .finally(() => setLoading(false));
  }, []);

  const medals = ['1º', '2º', '3º'];
  const colors = [
    'border-amber-400/40 bg-amber-500/10 text-amber-300',
    'border-slate-300/40 bg-slate-400/10 text-slate-200',
    'border-amber-700/40 bg-amber-800/10 text-amber-500',
  ];

  return (
    <section className="py-10 px-4 bg-zinc-950 text-white border-b border-zinc-800/60">
      <div className="max-w-md mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-widest font-mono flex items-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Líderes da Semana
            </span>
            <h2 className="text-lg font-extrabold text-white tracking-tight">
              RANKING DOS JOGADORES
            </h2>
          </div>

          <button
            onClick={onViewFullRanking}
            className="text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>VER RANKING</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Top 3 List */}
        <div className="space-y-2.5">
          {top3.map((player, index) => (
            <div
              key={player.rank || index}
              className={`p-3.5 rounded-2xl border ${colors[index] || 'border-zinc-800 bg-zinc-900'} flex items-center justify-between transition-transform hover:scale-[1.01]`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl shrink-0">{medals[index] || `#${index + 1}`}</span>
                <div>
                  <h3 className="font-bold text-xs text-white tracking-tight">{player.userName}</h3>
                  <p className="text-[10px] text-zinc-400 font-mono">Nível {player.level}</p>
                </div>
              </div>

              <div className="text-right">
                <p className="font-black text-sm font-mono text-cyan-300">{player.highScore.toLocaleString()} pts</p>
                <p className="text-[9px] text-zinc-400 font-mono">{player.linesCleared} linhas</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
