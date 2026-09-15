import React from 'react';
import { Game } from '../types';
import { Play } from 'lucide-react';

interface GameCardProps {
  game: Game;
  onPlay: (game: Game) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onPlay }) => {
  return (
    <div className="group bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden shadow-xs hover:border-zinc-300 transition-all flex flex-col justify-between">
      <div className="relative aspect-4/3 w-full bg-[#F5F5F5] overflow-hidden">
        <img
          src={game.imageUrl}
          alt={game.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute top-2 left-2 bg-[#111111]/80 backdrop-blur-xs text-white text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider">
          {game.category}
        </div>
      </div>

      <div className="p-3.5 flex flex-col justify-between flex-1">
        <div className="mb-2">
          <h3 className="font-bold text-xs text-[#111111] tracking-tight truncate">
            {game.name}
          </h3>
          <p className="text-[10px] text-[#737373] font-medium mt-0.5">
            Provedor: {game.provider}
          </p>
        </div>

        <button
          onClick={() => onPlay(game)}
          className="w-full h-9 bg-[#111111] hover:bg-black text-white rounded-xl font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-[0.98]"
        >
          <Play className="w-3.5 h-3.5 fill-current stroke-none" />
          Acessar
        </button>
      </div>
    </div>
  );
};
