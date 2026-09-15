import React from 'react';
import { Share2, Gift } from 'lucide-react';

interface ReferralBannerProps {
  onShare: () => void;
}

export const ReferralBanner: React.FC<ReferralBannerProps> = ({ onShare }) => {
  return (
    <section className="py-8 px-4 bg-gradient-to-br from-purple-950/60 via-zinc-950 to-indigo-950/60 border-b border-zinc-800/60 text-white">
      <div className="max-w-md mx-auto bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-2xl p-5 space-y-4 text-center relative overflow-hidden">
        <div className="w-10 h-10 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center mx-auto text-purple-300">
          <Gift className="w-5 h-5" />
        </div>

        <div className="space-y-1">
          <h3 className="font-extrabold text-sm text-white tracking-wider font-mono">
            CONVIDE SEUS AMIGOS
          </h3>
          <p className="text-xs text-zinc-300 font-medium max-w-xs mx-auto">
            Compartilhe o Block Puzzle com seus amigos e desafie todos a superarem sua pontuação!
          </p>
        </div>

        <button
          onClick={onShare}
          className="w-full py-3 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 cursor-pointer active:scale-95 transition-all"
        >
          <Share2 className="w-4 h-4" />
          <span>COMPARTILHAR JOGO</span>
        </button>
      </div>
    </section>
  );
};
