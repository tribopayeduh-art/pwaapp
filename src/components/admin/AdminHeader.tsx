import React from 'react';
import { Menu, RefreshCw, X, Search, ListTodo, Rows3, PanelTop } from 'lucide-react';
import { AdminTabId } from './adminTypes';
interface AdminHeaderProps {
  activeTab: AdminTabId; tabLabel: string; tabDescription?: string; searchQuery: string;
  onSearchChange: (q: string) => void; pendingWithdrawalsCount?: number; loadingMetrics: boolean;
  onRefresh: () => void; onClose: () => void; onOpenMobileMenu: () => void;
  onOpenNotifications: () => void; canOpenPending?: boolean; onOpenMigrationModal?: () => void;
  onOpenCommand?: () => void; lastUpdated?: string | null; autoRefresh?: boolean;
  onAutoRefreshChange?: (value: boolean) => void; compact?: boolean; onCompactChange?: () => void;
}
export const AdminHeader: React.FC<AdminHeaderProps> = ({ tabLabel, tabDescription, pendingWithdrawalsCount = 0, loadingMetrics, onRefresh, onClose, onOpenMobileMenu, onOpenNotifications, canOpenPending = true, onOpenCommand, lastUpdated, autoRefresh, onAutoRefreshChange, compact, onCompactChange }) => <header className="admin-topbar">
  <div className="admin-topbar-left"><button className="admin-icon-btn admin-menu-trigger" aria-label="Abrir menu" onClick={onOpenMobileMenu}><Menu size={20} /></button><div><div className="admin-breadcrumb">Workspace <span>/</span> <strong>{tabLabel}</strong></div><p>{tabDescription}</p></div></div>
  <div className="admin-topbar-actions"><button className="admin-command-trigger" onClick={onOpenCommand}><Search size={16} /><span>Buscar ou navegar</span><kbd>Ctrl K</kbd></button>
    <button className="admin-icon-btn admin-density" aria-label={compact ? 'Usar espaçamento confortável' : 'Usar espaçamento compacto'} title="Densidade da interface" onClick={onCompactChange}>{compact ? <PanelTop size={18} /> : <Rows3 size={18} />}</button>
    {canOpenPending && <button className="admin-icon-btn admin-pending-trigger" onClick={onOpenNotifications} aria-label={`Abrir central de pendências: ${pendingWithdrawalsCount} saques`}><ListTodo size={19} />{pendingWithdrawalsCount > 0 && <b>{pendingWithdrawalsCount > 99 ? '99+' : pendingWithdrawalsCount}</b>}</button>}
    <button className="admin-btn admin-btn-primary admin-refresh-btn" onClick={onRefresh} disabled={loadingMetrics} aria-label="Atualizar dados"><RefreshCw size={15} className={loadingMetrics ? 'animate-spin' : ''} /><span>Atualizar</span></button>
    <button className="admin-icon-btn" aria-label="Fechar painel" onClick={onClose}><X size={19} /></button>
  </div>
  <div className="admin-sync-bar"><span><i className={`admin-live-dot ${!lastUpdated ? 'neutral' : ''}`} />{lastUpdated ? `Atualizado às ${new Date(lastUpdated).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Aguardando atualização'}</span><label><input type="checkbox" checked={!!autoRefresh} onChange={event => onAutoRefreshChange?.(event.target.checked)} />Atualizar a cada 30s</label></div>
</header>;
