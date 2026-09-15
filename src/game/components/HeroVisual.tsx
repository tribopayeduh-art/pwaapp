import React from 'react';
import { GameUser } from '../types';
import { Play, Sparkles, UserPlus, LogIn, Flame, Trophy } from 'lucide-react';

interface HeroVisualProps {
  user: GameUser | null;
  onPlay: () => void;
  onRegister: () => void;
  onLogin: () => void;
}

export const HeroVisual: React.FC<HeroVisualProps> = ({
  user,
  onPlay,
  onRegister,
  onLogin,
}) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-12 px-4 bg-gradient-to-b from-zinc-950 via-slate-950 to-zinc-900 border-b border-zinc-800/60">
      {/* Background Lighting Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-60 h-60 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md mx-auto text-center space-y-6 relative z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold backdrop-blur-md">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span>Jogo de Raciocínio & Combos</span>
        </div>

        {/* Hero Headlines */}
        <div className="space-y-2">
          <h1 className="text-4xl font-black text-white tracking-tight font-mono">
            BLOCK <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500">PUZZLE</span>
          </h1>
          <p className="text-lg font-bold text-zinc-100 leading-snug">
            Desafie sua mente. <br />
            <span className="text-cyan-400">Monte.</span> <span className="text-purple-400">Combine.</span> <span className="text-blue-400">Domine.</span>
          </p>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto leading-relaxed font-medium">
            Encaixe os blocos, elimine linhas e tente bater seu recorde em cada partida.
          </p>
        </div>

        {/* 3D-Like Neon Grid Visual Composition */}
        <div className="relative py-4 my-2 flex items-center justify-center">
          {/* Main Illustrated Grid */}
          <div className="relative w-64 h-64 bg-zinc-900/90 border-2 border-cyan-500/40 rounded-2xl shadow-2xl shadow-cyan-500/20 p-2.5 transform rotate-3 hover:rotate-0 transition-transform duration-500 backdrop-blur-xl">
            <div className="grid grid-cols-4 gap-1.5 h-full w-full">
              {[
                'bg-cyan-500 shadow-cyan-500/50', 'bg-cyan-500 shadow-cyan-500/50', 'bg-zinc-800/40', 'bg-purple-500 shadow-purple-500/50',
                'bg-zinc-800/40', 'bg-cyan-500 shadow-cyan-500/50', 'bg-purple-500 shadow-purple-500/50', 'bg-purple-500 shadow-purple-500/50',
                'bg-amber-400 shadow-amber-400/50', 'bg-amber-400 shadow-amber-400/50', 'bg-zinc-800/40', 'bg-zinc-800/40',
                'bg-emerald-400 shadow-emerald-400/50', 'bg-emerald-400 shadow-emerald-400/50', 'bg-pink-500 shadow-pink-500/50', 'bg-pink-500 shadow-pink-500/50',
              ].map((style, idx) => (
                <div key={idx} className={`rounded-lg border border-white/10 ${style} shadow-md transition-all duration-300`} />
              ))}
            </div>

            {/* Floating Energy Score Badges */}
            <div className="absolute -top-3 -right-3 bg-gradient-to-r from-amber-500 to-rose-500 text-white font-extrabold text-[11px] px-3 py-1 rounded-full shadow-lg shadow-amber-500/40 animate-bounce flex items-center gap-1 font-mono">
              <Flame className="w-3.5 h-3.5 fill-current" />
              COMBO x3
            </div>

            <div className="absolute top-1/2 -left-6 bg-cyan-500 text-black font-extrabold text-[10px] px-2.5 py-1 rounded-full shadow-lg shadow-cyan-500/50 font-mono tracking-wider animate-pulse">
              +120 PTS
            </div>

            <div className="absolute -bottom-3 right-8 bg-purple-600 text-white font-extrabold text-[10px] px-3 py-1 rounded-full shadow-lg shadow-purple-600/50 font-mono tracking-wider">
              +250 PTS
            </div>
          </div>
        </div>

        {/* Action CTAs */}
        <div className="space-y-3 pt-2">
          <button
            onClick={onPlay}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:to-purple-500 text-black font-extrabold text-sm rounded-2xl shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>JOGAR AGORA</span>
          </button>

          {!user && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onRegister}
                className="py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-cyan-400" />
                <span>CRIAR CONTA</span>
              </button>

              <button
                onClick={onLogin}
                className="py-3 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-purple-400" />
                <span>JÁ TENHO CONTA</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
