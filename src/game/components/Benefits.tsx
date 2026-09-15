import React from 'react';
import { Trophy, Flame, Smartphone, Target } from 'lucide-react';

export const Benefits: React.FC = () => {
  const list = [
    {
      icon: Trophy,
      title: 'BATA SEU RECORDE',
      desc: 'Acompanhe sua evolução e supere suas marcas a cada nova partida.',
      color: 'text-amber-400 bg-amber-400/10 border-amber-400/30',
    },
    {
      icon: Flame,
      title: 'FAÇA COMBOS',
      desc: 'Quanto melhor você jogar e mais linhas limpar de vez, maior sua pontuação.',
      color: 'text-rose-400 bg-rose-400/10 border-rose-400/30',
    },
    {
      icon: Smartphone,
      title: 'JOGUE DE QUALQUER LUGAR',
      desc: 'Interface fluida e otimizada 100% para celulares e telas touch.',
      color: 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30',
    },
    {
      icon: Target,
      title: 'COMPLETE MISSÕES',
      desc: 'Desafios diários e conquistas para manter a experiência sempre envolvente.',
      color: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
    },
  ];

  return (
    <section className="py-10 px-4 bg-zinc-900/60 text-white border-b border-zinc-800/60">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-1">
          <span className="text-[10px] uppercase font-bold text-purple-400 tracking-widest font-mono">
            Vantagens do Jogo
          </span>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            POR QUE JOGAR?
          </h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {list.map((b, i) => {
            const Icon = b.icon;
            return (
              <div
                key={i}
                className="bg-zinc-900 border border-zinc-800/90 rounded-2xl p-3.5 space-y-2 hover:border-zinc-700 transition-colors"
              >
                <div
                  className={`w-9 h-9 rounded-xl border ${b.color} flex items-center justify-center shrink-0`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-xs text-zinc-100 tracking-wider uppercase font-mono">{b.title}</h3>
                <p className="text-[10px] text-zinc-400 leading-snug">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
