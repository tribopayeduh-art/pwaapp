import React from 'react';
import { LayoutDashboard, ListTodo, Users, Menu } from 'lucide-react';
import { AdminTabId } from './adminTypes';
interface Props { activeTab: AdminTabId; onSelectTab: (tab: AdminTabId) => void; pendingWithdrawalsCount?: number; onOpenMenu?: () => void; allowedTabs?: AdminTabId[]; }
export const AdminMobileTabBar: React.FC<Props> = ({ activeTab, onSelectTab, pendingWithdrawalsCount = 0, onOpenMenu, allowedTabs }) => <nav className="admin-mobile-nav" aria-label="Atalhos do painel">{[
  { id: 'metrics' as AdminTabId, label: 'Visão geral', icon: LayoutDashboard },
  { id: 'operations' as AdminTabId, label: 'Pendências', icon: ListTodo },
  { id: 'users' as AdminTabId, label: 'Usuários', icon: Users }
].filter(item => !allowedTabs || allowedTabs.includes(item.id)).map(item => <button key={item.id} className={activeTab === item.id ? 'active' : ''} onClick={() => onSelectTab(item.id)} aria-current={activeTab === item.id ? 'page' : undefined}><span><item.icon size={20} />{item.id === 'operations' && pendingWithdrawalsCount > 0 && <b>{pendingWithdrawalsCount}</b>}</span><small>{item.label}</small></button>)}<button onClick={onOpenMenu}><Menu size={20} /><small>Mais</small></button></nav>;
