import React from 'react';
import { User } from '../types';
import logoImg from './logo.webp';
import { Bell, Crown } from 'lucide-react';

interface HeaderProps {
  user?: User | null;
  title?: string;
  onProfileClick?: () => void;
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, title, onProfileClick, onOpenSettings, onOpenAdmin }) => {
  const isAdminUser = user && (user.role === 'admin' || user.role === 'superadmin' || user.email.toLowerCase() === 'admin.eduh@gmail.com' || user.email.toLowerCase() === 'tribopayeduh@gmail.com');

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#E5E5E5] px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <img
          src={logoImg}
          alt="Logo"
          className="h-8 max-w-[160px] object-contain"
        />
      </div>

      <div className="flex items-center gap-2">
        {user && (
          <>
            {isAdminUser && onOpenAdmin && (
              <button
                onClick={onOpenAdmin}
                title="Acessar Painel Administrativo"
                className="px-2.5 py-1.5 rounded-full bg-amber-400 text-black hover:bg-amber-300 transition-all cursor-pointer border border-amber-500 font-extrabold text-xs flex items-center gap-1 shadow-xs"
              >
                <Crown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Painel Admin</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Configurações do Gateway & Notificações"
                className="w-8 h-8 rounded-full bg-[#F5F5F5] hover:bg-[#ECECEC] transition-colors cursor-pointer border border-[#E5E5E5] flex items-center justify-center text-[#111111]"
              >
                <Bell className="w-4 h-4 text-emerald-600" />
              </button>
            )}

            <button
              onClick={onProfileClick}
              className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-full bg-[#F5F5F5] hover:bg-[#ECECEC] transition-colors cursor-pointer border border-[#E5E5E5]"
            >
              <div className="w-6 h-6 rounded-full bg-[#111111] text-white flex items-center justify-center text-xs font-semibold uppercase">
                {user.name ? user.name.charAt(0) : 'U'}
              </div>
              <span className="text-xs font-semibold text-[#111111] max-w-[80px] truncate">
                {user.name.split(' ')[0]}
              </span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
