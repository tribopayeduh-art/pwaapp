import React from 'react';
import { Home, Wallet, Gamepad2, MoreHorizontal } from 'lucide-react';

export type TabType = 'home' | 'finance' | 'games' | 'more';

interface BottomNavigationProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  desktopExpanded?: boolean;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ activeTab, onChangeTab, desktopExpanded = false }) => {
  const changeTab = (tab: TabType) => {
    if (tab === activeTab) return;

    // O efeito solicitado pertence apenas à navegação desktop.
    if (window.matchMedia('(min-width: 1024px)').matches) {
      const audio = new Audio(`${import.meta.env.BASE_URL}assets/sounds/section-change.mp3`);
      audio.volume = 0.22;
      audio.currentTime = 0;
      void audio.play().catch(() => undefined);
    }

    onChangeTab(tab);
  };

  const navItems: { id: TabType; label: string; icon: React.ReactNode }[] = [
    {
      id: 'home',
      label: 'Início',
      icon: <Home className="w-5 h-5 lg:w-[22px] lg:h-[22px] stroke-[2.2]" />,
    },
    {
      id: 'finance',
      label: 'Financeiro',
      icon: <Wallet className="w-5 h-5 lg:w-[22px] lg:h-[22px] stroke-[2.2]" />,
    },
    {
      id: 'games',
      label: 'Jogos',
      icon: <Gamepad2 className="w-5 h-5 lg:w-[22px] lg:h-[22px] stroke-[2.2]" />,
    },
    {
      id: 'more',
      label: 'Mais',
      icon: <MoreHorizontal className="w-5 h-5 lg:w-[22px] lg:h-[22px] stroke-[2.2]" />,
    },
  ];

  return (
    <nav className="alliance-bottom-nav fixed bottom-0 left-0 right-0 lg:bottom-6 lg:inset-x-0 lg:mx-auto z-50 bg-white/95 backdrop-blur-md border-t lg:border border-[#E5E5E5] lg:border-zinc-200/90 w-full lg:w-fit lg:min-w-[820px] lg:max-w-[940px] lg:rounded-2xl shadow-2xl transition-all">
      <div className="flex items-center justify-around lg:justify-center h-16 lg:h-[70px] px-2 sm:px-4 lg:px-6 lg:gap-3">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => changeTab(item.id)}
              className={`flex-1 lg:flex-initial flex flex-col lg:flex-row items-center justify-center py-2 lg:py-3 lg:px-7 rounded-xl transition-all cursor-pointer relative ${
                isActive
                  ? 'text-zinc-950 font-bold lg:font-extrabold lg:bg-zinc-100 lg:shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-950 font-semibold hover:bg-zinc-50'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-[#F5F5F5] lg:bg-transparent text-[#111111]' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[11px] lg:text-sm mt-0.5 lg:mt-0 lg:ml-2 tracking-tight leading-none">
                {item.label}
              </span>

              {isActive && (
                <div className="lg:hidden absolute top-0 w-8 h-[2px] bg-[#111111] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
