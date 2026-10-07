import React, { useEffect } from 'react';
import { X, ArrowLeft, ChevronRight, Command } from 'lucide-react';
import logoImg from '../logo.webp';
import { adminNavigation, canAccessAdminTab } from './adminNavigation';
import { AdminTabId } from './adminTypes';
import { AdminPermissions } from '../../types';
interface AdminSidebarProps {
  activeTab: AdminTabId; onSelectTab: (tab: AdminTabId) => void; mobileMenuOpen: boolean;
  onCloseMobileMenu: () => void; pendingWithdrawalsCount?: number; adminEmail?: string;
  adminRole?: string; adminPermissions?: AdminPermissions; onCloseAdmin: () => void;
  onOpenCommand?: () => void;
}
export const AdminSidebar: React.FC<AdminSidebarProps> = ({ activeTab, onSelectTab, mobileMenuOpen, onCloseMobileMenu, pendingWithdrawalsCount = 0, adminEmail, adminRole, adminPermissions, onCloseAdmin, onOpenCommand }) => {
  const allowed = adminNavigation.filter(item => canAccessAdminTab(item.id, adminRole, adminPermissions));
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const listener = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseMobileMenu(); };
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, [mobileMenuOpen, onCloseMobileMenu]);
  return <>
    {mobileMenuOpen && <button type="button" className="admin-drawer-backdrop" onClick={onCloseMobileMenu} aria-label="Fechar menu" />}
    <aside className={`admin-sidebar ${mobileMenuOpen ? 'is-open' : ''}`} aria-label="Navegação administrativa">
      <div className="admin-brand"><span className="admin-brand-mark"><img src={logoImg} alt="Alliance Hub" /></span><div><strong>Alliance Hub</strong><span>Admin workspace</span></div><button className="admin-icon-btn admin-drawer-close" aria-label="Fechar menu" onClick={onCloseMobileMenu}><X size={18} /></button></div>
      <button className="admin-workspace-switch" onClick={onCloseAdmin}><span className="admin-workspace-avatar">AH</span><span><strong>Gestão da plataforma</strong><small>Voltar ao aplicativo</small></span><ChevronRight size={15} /></button>
      <button className="admin-sidebar-search" onClick={onOpenCommand}><Command size={15} /><span>Busca rápida</span><kbd>⌘ K</kbd></button>
      <nav>{['Workspace', 'Gestão', 'Configuração'].map(section => {
        const items = allowed.filter(item => item.section === section);
        if (!items.length) return null;
        return <div className="admin-nav-group" key={section}><div className="admin-nav-label">{section}</div>{items.map(item => <button type="button" key={item.id} className={`admin-nav-item ${activeTab === item.id ? 'active' : ''}`} aria-current={activeTab === item.id ? 'page' : undefined} onClick={() => { onSelectTab(item.id); onCloseMobileMenu(); }}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'withdrawals' && pendingWithdrawalsCount > 0 && <b>{pendingWithdrawalsCount}</b>}{item.id === 'live' && <i className="admin-live-dot" />}</button>)}</div>;
      })}</nav>
      <div className="admin-sidebar-footer"><span className="admin-user-avatar">{adminEmail?.slice(0, 1).toUpperCase() || 'A'}</span><div><strong>{adminRole === 'superadmin' ? 'Administrador geral' : 'Administrador'}</strong><span>{adminEmail}</span></div><button className="admin-icon-btn" title="Voltar ao aplicativo" aria-label="Voltar ao aplicativo" onClick={onCloseAdmin}><ArrowLeft size={17} /></button></div>
    </aside>
  </>;
};
