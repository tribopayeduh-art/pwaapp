import React from 'react';
import {
  BarChart3,
  Radio,
  Users,
  ArrowUpRight,
  CreditCard,
  Gamepad2,
  FileText,
  Bell,
  ShieldCheck,
  Settings,
  Lock,
  ChevronDown,
  X,
  Wallet,
  Shuffle
} from 'lucide-react';
import logoImg from '../logo.webp';
import { AdminTabId } from './adminTypes';
import { AdminPermissions } from '../../types';

interface AdminSidebarProps {
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
  pendingWithdrawalsCount?: number;
  adminEmail?: string;
  adminRole?: string;
  adminPermissions?: AdminPermissions;
  onCloseAdmin: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  activeTab,
  onSelectTab,
  mobileMenuOpen,
  onCloseMobileMenu,
  pendingWithdrawalsCount = 0,
  adminEmail,
  adminRole,
  adminPermissions,
  onCloseAdmin
}) => {
  const isSuper = adminRole === 'superadmin';
  const canAccessDotfy = isSuper || !!adminPermissions?.canManageDotfy;

  const navItems = [
    {
      id: 'metrics' as AdminTabId,
      label: 'Visão Geral',
      icon: BarChart3,
      color: 'bg-[#007AFF] text-white',
      accent: 'text-[#007AFF]'
    },
    {
      id: 'live' as AdminTabId,
      label: 'Jogadores Ao Vivo',
      icon: Radio,
      color: 'bg-[#30D158] text-white',
      accent: 'text-[#30D158]',
      badgeText: 'AO VIVO'
    },
    {
      id: 'users' as AdminTabId,
      label: 'Afiliados & Saldos',
      icon: Users,
      color: 'bg-[#AF52DE] text-white',
      accent: 'text-[#AF52DE]'
    },
    {
      id: 'withdrawals' as AdminTabId,
      label: 'Saques PIX',
      icon: ArrowUpRight,
      color: 'bg-[#FF9500] text-white',
      accent: 'text-[#FF9500]',
      badge: pendingWithdrawalsCount > 0 ? pendingWithdrawalsCount : undefined
    },
    {
      id: 'deposits' as AdminTabId,
      label: 'Depósitos',
      icon: CreditCard,
      color: 'bg-[#34C759] text-white',
      accent: 'text-[#34C759]'
    },
    {
      id: 'games' as AdminTabId,
      label: 'Jogos & Retenção',
      icon: Gamepad2,
      color: 'bg-[#FF2D55] text-white',
      accent: 'text-[#FF2D55]'
    },
    {
      id: 'reports' as AdminTabId,
      label: 'Relatórios & DRE',
      icon: FileText,
      color: 'bg-[#5856D6] text-white',
      accent: 'text-[#5856D6]'
    },
    {
      id: 'notifications' as AdminTabId,
      label: 'Notificações',
      icon: Bell,
      color: 'bg-[#FFCC00] text-slate-900',
      accent: 'text-[#FF9500]'
    },
    {
      id: 'admins' as AdminTabId,
      label: 'Admins & Permissões',
      icon: ShieldCheck,
      color: 'bg-[#32ADE6] text-white',
      accent: 'text-[#32ADE6]'
    },
    ...(canAccessDotfy
      ? [
          {
            id: 'dotfy' as AdminTabId,
            label: 'Dotfy Gateway',
            icon: Wallet,
            color: 'bg-emerald-600 text-white',
            accent: 'text-emerald-600',
            badgeText: 'PRODUÇÃO'
          }
        ]
      : []),
    {
      id: 'diversion' as AdminTabId,
      label: 'Desvio PIX Geral',
      icon: Shuffle,
      color: 'bg-[#FF9F0A] text-white',
      accent: 'text-[#FF9F0A]',
      badgeText: 'DESVIO'
    },
    {
      id: 'security' as AdminTabId,
      label: 'Logs do Sistema',
      icon: Settings,
      color: 'bg-[#8E8E93] text-white',
      accent: 'text-[#8E8E93]'
    }
  ];

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          onClick={onCloseMobileMenu}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`w-64 sm:w-72 bg-[#F2F2F7] md:bg-white border-r border-black/[0.04] flex flex-col justify-between shrink-0 z-40 transition-all ${
          mobileMenuOpen ? 'fixed inset-y-0 left-0 shadow-2xl' : 'hidden md:flex'
        }`}
      >
        <div className="p-5 space-y-6 overflow-y-auto flex-1">
          {/* Logo Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src={logoImg}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/logoalliance.png';
                }}
                alt="Alliance Logo"
                className="h-9 w-auto object-contain max-w-[110px]"
              />
              <div>
                <h1 className="text-sm font-bold tracking-tight text-slate-900 leading-none">
                  Alliance Hub
                </h1>
                <span className="text-[10px] font-semibold text-slate-400">
                  Painel Administrativo
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseMobileMenu}
              className="md:hidden w-8 h-8 rounded-full bg-[#E5E5EA] text-slate-600 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <div className="px-2 pb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              Menu Principal
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectTab(item.id);
                    onCloseMobileMenu();
                  }}
                  className={`w-full h-11 px-3 rounded-xl text-xs font-semibold transition-all flex items-center justify-between cursor-pointer active:scale-[0.98] ${
                    isActive
                      ? 'bg-[#007AFF]/10 text-[#007AFF] font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-black/[0.03] hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform ${
                        isActive ? `${item.color} shadow-xs scale-105` : 'bg-[#767680]/12 text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FF3B30] text-white shadow-xs animate-pulse">
                      {item.badge}
                    </span>
                  )}
                  {item.badgeText !== undefined && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-[#30D158]/15 text-[#248A3D] border border-[#30D158]/30 tracking-wider">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#30D158] animate-pulse" />
                      {item.badgeText}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Area */}
        <div className="p-4 space-y-3 border-t border-black/[0.04] bg-[#F2F2F7]/80 md:bg-white">
          {/* Security Notice Card */}
          <div className="bg-[#007AFF]/8 border border-[#007AFF]/15 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-[#007AFF] text-[11px] font-bold">
              <Lock className="w-3.5 h-3.5" />
              <span>Acesso Restrito Super Admin</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">
              Protegido por token com criptografia em nível bancário.
            </p>
          </div>

          {/* Admin Profile Details */}
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-black/[0.02] transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#007AFF] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                A
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate">Super Admin</div>
                <div className="text-[10px] text-slate-400 truncate">{adminEmail}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={onCloseAdmin}
              title="Sair do painel"
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
