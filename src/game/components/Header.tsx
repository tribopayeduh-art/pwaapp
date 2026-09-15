import React from 'react';
import { GameUser, GameStats } from '../types';
import { Gamepad2, Trophy, Flame, User as UserIcon, LogOut, ArrowLeft, Crown } from 'lucide-react';

interface GameHeaderProps {
  user: GameUser | null;
  stats: GameStats | null;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  onReturnToPortal?: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  user,
  stats,
  activeTab,
  onNavigate,
  onLogout,
  onReturnToPortal,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-800/80 px-4 py-3 text-white">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Logo & Portal Back Link */}
        <div className="flex items-center gap-2">
          {onReturnToPortal && (
            <button
              onClick={onReturnToPortal}
              title="Voltar ao PayGateway Portal"
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div
            onClick={() => onNavigate('home')}
            className="flex items-center cursor-pointer group"
          >
            <img
              src="/blocklogo.png"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/logoblock.png';
              }}
              alt="BLOCK WIN"
              className="h-10 sm:h-12 w-auto object-contain group-hover:scale-105 transition-transform drop-shadow-[0_2px_8px_rgba(0,240,255,0.4)]"
            />
          </div>
        </div>

        {/* User Status / Quick Actions */}
        {user ? (
          <div className="flex items-center gap-2">
            {stats && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-full font-mono text-xs">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                <span className="font-bold text-amber-300">{stats.highScore.toLocaleString()}</span>
              </div>
            )}

            <button
              onClick={() => onNavigate('profile')}
              className={`flex items-center gap-2 pl-2 pr-3 py-1 rounded-full border transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
              }`}
            >
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-[10px] font-bold text-black uppercase">
                {user.name.charAt(0)}
              </div>
              <span className="text-xs font-semibold max-w-[80px] truncate">{user.name.split(' ')[0]}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate('login')}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              Entrar
            </button>

            <button
              onClick={() => onNavigate('register')}
              className="px-3.5 py-1.5 text-xs font-bold bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black rounded-full shadow-md shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
            >
              Criar Conta
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
