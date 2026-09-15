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
      icon: <Home className="w-5 h-5 stroke-[2]" />,
    },
    {
      id: 'finance',
      label: 'Financeiro',
      icon: <Wallet className="w-5 h-5 stroke-[2]" />,
    },
    {
      id: 'games',
      label: 'Jogos',
      icon: <Gamepad2 className="w-5 h-5 stroke-[2]" />,
    },
    {
      id: 'more',
      label: 'Mais',
      icon: <MoreHorizontal className="w-5 h-5 stroke-[2]" />,
    },
  ];

  return (
    <nav className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E5E5] mx-auto transition-[max-width] duration-300 ${desktopExpanded ? 'max-w-md lg:max-w-[1440px]' : 'max-w-md'}`}>
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => changeTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1.5 transition-all cursor-pointer relative ${
                isActive ? 'text-[#111111] font-semibold' : 'text-[#737373] hover:text-[#111111] font-normal'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-[#F5F5F5] text-[#111111]' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight leading-none">
                {item.label}
              </span>

              {isActive && (
                <div className="absolute top-0 w-8 h-[2px] bg-[#111111] rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
