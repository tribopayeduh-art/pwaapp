import React from 'react';
import {
  BarChart3,
  Users,
  ArrowUpRight,
  CreditCard,
  Gamepad2
} from 'lucide-react';
import { AdminTabId } from './adminTypes';

interface AdminMobileTabBarProps {
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  pendingWithdrawalsCount?: number;
}

export const AdminMobileTabBar: React.FC<AdminMobileTabBarProps> = ({
  activeTab,
  onSelectTab,
  pendingWithdrawalsCount = 0
}) => {
  const tabs = [
    { id: 'metrics' as AdminTabId, label: 'Visão Geral', icon: BarChart3 },
    { id: 'users' as AdminTabId, label: 'Usuários', icon: Users },
    {
      id: 'withdrawals' as AdminTabId,
      label: 'Saques',
      icon: ArrowUpRight,
      badge: pendingWithdrawalsCount > 0 ? pendingWithdrawalsCount : undefined
    },
    { id: 'deposits' as AdminTabId, label: 'Depósitos', icon: CreditCard },
    { id: 'games' as AdminTabId, label: 'Jogos/RTP', icon: Gamepad2 }
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/85 backdrop-blur-md border-t border-black/[0.08] px-2 py-1.5 flex items-center justify-around shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelectTab(tab.id)}
            className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition-all relative cursor-pointer active:scale-[0.95] ${
              isActive ? 'text-[#007AFF]' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {tab.badge !== undefined && (
                <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-[#FF3B30] text-white text-[9px] font-bold flex items-center justify-center leading-none">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] tracking-tight ${isActive ? 'font-bold' : 'font-medium'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
};
