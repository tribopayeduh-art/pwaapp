import React from 'react';
import { GameUser } from '../types';
import { CheckCircle2, Play, LayoutDashboard, Sparkles, ShieldCheck } from 'lucide-react';

interface GameWelcomeProps {
  user: GameUser;
  onPlayNow: () => void;
  onGoToDashboard: () => void;
}

export const GameWelcome: React.FC<GameWelcomeProps> = ({
  user,
  onPlayNow,
  onGoToDashboard,
}) => {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-4 relative overflow-hidden">
      {/* Background Lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full mx-auto my-auto py-8 space-y-6 text-center">
        {/* Success Icon */}
        <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30 animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-400/30 text-emerald-300 rounded-full text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Conta Pronta!</span>
          </div>
          <h1 className="text-2xl font-black text-white font-mono">
            CADASTRO REALIZADO COM SUCESSO!
          </h1>
          <p className="text-xs text-zinc-300">
            Sua conta já está configurada e pronta para o jogo.
          </p>
        </div>

        {/* User Summary Box */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-left space-y-3 font-mono">
          <p className="text-[10px] text-cyan-400 uppercase font-bold tracking-wider border-b border-zinc-800 pb-2 flex items-center justify-between">
            <span>RESUMO DO PERFIL</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </p>

          <div className="space-y-2 text-xs">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Nome</p>
              <p className="font-bold text-white">{user.name}</p>
            </div>

            <div>
              <p className="text-[10px] text-zinc-500 uppercase">E-mail</p>
              <p className="font-bold text-zinc-200">{user.email}</p>
            </div>

            <div>
              <p className="text-[10px] text-zinc-500 uppercase">ID do Usuário (UID)</p>
              <p className="font-bold text-cyan-300 truncate">{user.id}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-2">
          <button
            onClick={onPlayNow}
            className="w-full py-3.5 bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:to-purple-500 text-black font-extrabold text-xs rounded-xl shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all uppercase tracking-wider"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>COMEÇAR A JOGAR</span>
          </button>

          <button
            onClick={onGoToDashboard}
            className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4 text-cyan-400" />
            <span>IR PARA O DASHBOARD</span>
          </button>
        </div>
      </div>
    </div>
  );
};
