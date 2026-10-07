import React from 'react';
import { User } from '../types';
import logoImg from './logo.webp';
import {
  Bell,
  Crown,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';

interface HeaderProps {
  user?: User | null;
  title?: string;
  onProfileClick?: () => void;
  onOpenSettings?: () => void;
  onOpenAdmin?: () => void;
  onOpenPartner?: () => void;
  onDeposit?: () => void;
  onWithdraw?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  title,
  onProfileClick,
  onOpenSettings,
  onOpenAdmin,
  onOpenPartner,
  onDeposit,
  onWithdraw
}) => {
  const isAdminUser = !!user && (user.role === 'admin' || user.role === 'superadmin');
  const isApprovedPartner = !!user && (
    isAdminUser ||
    (user.isPartner === true && user.partnerApproved === true)
  );

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200/80 px-2 sm:px-3.5 lg:px-4 py-2 transition-all">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2 max-w-full">
        {/* Left: Platform Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative flex items-center">
            <img
              src={logoImg}
              alt="Alliance Hub"
              className="h-7 sm:h-8 max-w-[130px] sm:max-w-[160px] object-contain cursor-pointer hover:opacity-95 transition"
            />
          </div>
        </div>

        {/* Right: Actions, Panels & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {user && (
            <>
              {/* Partner VIP Button */}
              {isApprovedPartner && onOpenPartner && (
                <button
                  type="button"
                  onClick={onOpenPartner}
                  title="Acessar Painel do Parceiro (VIP)"
                  className="h-8 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-105 active:brightness-95 text-zinc-950 font-black text-xs flex items-center gap-1.5 shadow-2xs border border-amber-300 transition-all cursor-pointer active:scale-95"
                >
                  <Crown className="w-3.5 h-3.5 fill-zinc-950 text-zinc-950" />
                  <span className="text-[11px] sm:text-xs">Parceiro</span>
                  <span className="hidden md:inline px-1 py-0.2 rounded bg-black/10 text-[9px] font-black uppercase">
                    VIP
                  </span>
                </button>
              )}

              {/* Admin Panel Button */}
              {isAdminUser && onOpenAdmin && (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  title="Acessar Painel Administrativo Geral"
                  className="h-8 px-2.5 sm:px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 active:bg-black text-white font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer active:scale-95"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline text-[11px]">Admin</span>
                </button>
              )}

              {/* Settings / Notifications Icon */}
              {onOpenSettings && (
                <button
                  type="button"
                  onClick={onOpenSettings}
                  title="Configurações de Gateway e Alertas"
                  className="w-8 h-8 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-200 text-zinc-700 transition flex items-center justify-center cursor-pointer border border-zinc-200/80 active:scale-95 relative"
                >
                  <Bell className="w-3.5 h-3.5 text-zinc-700" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                </button>
              )}

              {/* User Profile Capsule */}
              <button
                type="button"
                onClick={onProfileClick}
                className="h-8 pl-1.5 pr-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-200 text-zinc-900 border border-zinc-200/80 flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                title="Minha Conta e Perfil"
              >
                <div className="w-5 h-5 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-[10px] font-black uppercase shadow-2xs">
                  {user.name ? user.name.charAt(0) : 'U'}
                </div>
                <span className="text-xs font-bold max-w-[70px] sm:max-w-[90px] truncate">
                  {user.name ? user.name.split(' ')[0] : 'Conta'}
                </span>
                <ChevronDown className="w-3 h-3 text-zinc-400 hidden sm:inline" />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
