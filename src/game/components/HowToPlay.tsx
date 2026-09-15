import React from 'react';
import { Layers, Grid3X3, Zap } from 'lucide-react';

export const HowToPlay: React.FC = () => {
  const steps = [
    {
      num: '01',
      title: 'ESCOLHA UMA PEÇA',
      desc: 'Arraste ou toque nas peças coloridas disponíveis na parte inferior.',
      icon: Layers,
      color: 'from-cyan-500 to-blue-600',
    },
    {
      num: '02',
      title: 'ENCAIXE NO TABULEIRO',
      desc: 'Posicione as peças no tabuleiro 8x8 sem deixar espaços vazios.',
      icon: Grid3X3,
      color: 'from-purple-500 to-indigo-600',
    },
    {
      num: '03',
      title: 'LIMPE LINHAS E FAÇA COMBOS',
      desc: 'Complete linhas horizontais ou verticais para multiplicar sua pontuação.',
      icon: Zap,
      color: 'from-amber-400 to-rose-500',
    },
  ];

  return (
    <section className="py-10 px-4 bg-zinc-950 text-white border-b border-zinc-800/60">
      <div className="max-w-md mx-auto space-y-6">
        <div className="text-center space-y-1">
          <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-widest font-mono">
            Aprenda em Segundos
          </span>
          <h2 className="text-xl font-extrabold text-white tracking-tight">
            COMO JOGAR
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3.5">
          {steps.map((s) => {
            const IconComponent = s.icon;
            return (
              <div
                key={s.num}
                className="bg-zinc-900/90 border border-zinc-800/80 rounded-2xl p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.color} text-black font-black flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/10`}
                >
                  <IconComponent className="w-6 h-6 text-white" />
                </div>

                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-400">{s.num}</span>
                    <h3 className="font-bold text-xs text-zinc-100 uppercase tracking-wider">{s.title}</h3>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-snug">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
