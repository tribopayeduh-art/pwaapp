import React from 'react';
import { User } from '../types';
import logoImg from './logo.webp';
import { Bell, Crown, Sparkles } from 'lucide-react';

interface HeaderProps {
  user?: User | null;
  title?: string;
  onProfileClick?: () => void;
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
  onOpenPartner?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ user, title, onProfileClick, onOpenSettings, onOpenAdmin, onOpenPartner }) => {
  const isAdminUser = !!user && (user.role === 'admin' || user.role === 'superadmin');
  const isApprovedPartner = !!user && (
    isAdminUser ||
    (user.isPartner === true && user.partnerApproved === true)
  );

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
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 hover:from-amber-300 hover:to-amber-400 transition-all cursor-pointer border border-amber-500/70 font-black text-xs flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
              >
                <Crown className="w-3.5 h-3.5 fill-zinc-950" />
                <span className="hidden sm:inline">Painel Admin</span>
              </button>
            )}

            {isApprovedPartner && onOpenPartner && (
              <button
                onClick={onOpenPartner}
                title="Acessar Painel do Parceiro (VIP)"
                className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 transition-all cursor-pointer border border-emerald-700/70 font-black text-xs flex items-center gap-1.5 shadow-2xs hover:shadow-xs active:scale-95 shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">Parceiro</span>
              </button>
            )}

            {onOpenSettings && (
              <button
                onClick={onOpenSettings}
                title="Configurações do Gateway & Notificações"
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200/90 transition-all cursor-pointer border border-zinc-200/80 flex items-center justify-center text-zinc-700 active:scale-95 shrink-0 shadow-2xs"
              >
                <Bell className="w-4 h-4 text-emerald-600" />
              </button>
            )}

            <button
              onClick={onProfileClick}
              className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200/90 transition-all cursor-pointer border border-zinc-200/80 active:scale-95 shrink-0 shadow-2xs"
            >
              <div className="w-6 h-6 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold uppercase shadow-2xs">
                {user.name ? user.name.charAt(0) : 'U'}
              </div>
              <span className="text-xs font-bold text-zinc-900 max-w-[80px] sm:max-w-[110px] truncate">
                {user.name.split(' ')[0]}
              </span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};
