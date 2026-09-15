import React from 'react';
import { Gamepad2, ShieldCheck, Heart } from 'lucide-react';

interface GameFooterProps {
  onNavigate: (tab: string) => void;
}

export const GameFooter: React.FC<GameFooterProps> = ({ onNavigate }) => {
  return (
    <footer className="bg-zinc-950 text-zinc-400 py-8 px-4 border-t border-zinc-900 text-xs">
      <div className="max-w-md mx-auto space-y-6 text-center">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
            <Gamepad2 className="w-4 h-4" />
          </div>
          <span className="font-mono font-bold text-sm text-white tracking-wider">
            BLOCK PUZZLE
          </span>
        </div>

        {/* Links Grid */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-zinc-300">
          <button onClick={() => onNavigate('home')} className="hover:text-cyan-400 transition-colors cursor-pointer">
            Início
          </button>
          <span>•</span>
          <button onClick={() => onNavigate('home')} className="hover:text-cyan-400 transition-colors cursor-pointer">
            Como Jogar
          </button>
          <span>•</span>
          <button onClick={() => onNavigate('ranking')} className="hover:text-cyan-400 transition-colors cursor-pointer">
            Ranking
          </button>
          <span>•</span>
          <button onClick={() => onNavigate('terms')} className="hover:text-cyan-400 transition-colors cursor-pointer">
            Termos
          </button>
          <span>•</span>
          <button onClick={() => onNavigate('privacy')} className="hover:text-cyan-400 transition-colors cursor-pointer">
            Privacidade
          </button>
          <span>•</span>
          <a href="mailto:suporte@paygateway.com" className="hover:text-cyan-400 transition-colors cursor-pointer">
            Contato
          </a>
        </div>

        {/* Security & Copyright */}
        <div className="space-y-1 text-[11px] text-zinc-500">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-500" />
            <span>Ambiente Independente Auditado e Seguro</span>
          </p>
          <p>© {new Date().getFullYear()} Block Puzzle. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
};
