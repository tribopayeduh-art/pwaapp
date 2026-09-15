import React from 'react';
import {
  Menu,
  Bell,
  Calendar,
  RefreshCw,
  X,
  ShieldCheck,
  Server
} from 'lucide-react';
import { AdminTabId } from './adminTypes';
import { IOSSearchBar } from './IOSComponents';

interface AdminHeaderProps {
  activeTab: AdminTabId;
  tabLabel: string;
  tabDescription?: string;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  pendingWithdrawalsCount?: number;
  loadingMetrics: boolean;
  onRefresh: () => void;
  onClose: () => void;
  onOpenMobileMenu: () => void;
  onOpenNotifications: () => void;
  onOpenMigrationModal?: () => void;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  activeTab,
  tabLabel,
  tabDescription,
  searchQuery,
  onSearchChange,
  pendingWithdrawalsCount = 0,
  loadingMetrics,
  onRefresh,
  onClose,
  onOpenMobileMenu,
  onOpenNotifications,
  onOpenMigrationModal
}) => {
  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-black/[0.04] px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between transition-all">
      {/* Left: Mobile Menu + Tab Title & Description */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="md:hidden w-9 h-9 rounded-xl bg-[#767680]/12 text-slate-700 hover:bg-[#767680]/20 flex items-center justify-center cursor-pointer transition-all"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {tabLabel}
              <span className="inline-block w-2 h-2 rounded-full bg-[#007AFF]" />
            </h1>
          </div>
          {tabDescription && (
            <p className="text-[11px] sm:text-xs text-slate-400 font-medium hidden sm:block truncate max-w-md">
              {tabDescription}
            </p>
          )}
        </div>
      </div>

      {/* Right: Quick Search, Notifications, Date, Refresh & Dismiss */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Global Search */}
        <div className="hidden lg:block w-64">
          <IOSSearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Buscar no sistema..."
          />
        </div>

        {/* Notifications Icon Button */}
        <button
          type="button"
          onClick={onOpenNotifications}
          title="Notificações"
          className="relative w-9 h-9 rounded-xl bg-[#767680]/12 hover:bg-[#767680]/20 text-slate-700 flex items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
        >
          <Bell className="w-4 h-4" />
          {pendingWithdrawalsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#FF3B30] ring-2 ring-white" />
          )}
        </button>

        {/* Date Pill (Desktop) */}
        <div className="hidden xl:flex items-center gap-1.5 h-9 px-3 bg-[#767680]/10 rounded-xl text-xs font-semibold text-slate-600">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{new Date().toLocaleDateString('pt-BR')}</span>
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={loadingMetrics}
          className="h-9 px-3.5 bg-[#007AFF] hover:bg-[#0062CC] text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>

        {/* VPS Integrator Migration & Backup Button */}
        {onOpenMigrationModal && (
          <button
            type="button"
            onClick={onOpenMigrationModal}
            title="Migração para VPS Integrator (Exportar Banco Completo)"
            className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-[0.98]"
          >
            <Server className="w-3.5 h-3.5 text-emerald-200" />
            <span className="hidden md:inline">Exportar VPS</span>
          </button>
        )}

        {/* Close Admin Panel Button (Dismiss) */}
        <button
          type="button"
          onClick={onClose}
          title="Fechar Painel Admin"
          className="w-9 h-9 rounded-xl bg-[#E5E5EA] hover:bg-[#D1D1D6] text-slate-600 flex items-center justify-center cursor-pointer transition-all active:scale-[0.98]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
