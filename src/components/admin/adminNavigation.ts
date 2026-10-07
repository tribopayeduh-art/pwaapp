import { LayoutDashboard, Radio, Users, ArrowUpRight, CreditCard, Gamepad2, FileText, Bell, ShieldCheck, Wallet, Shuffle, Activity, ListTodo } from 'lucide-react';
import type { AdminPermissions } from '../../types';
import type { AdminTabId } from './adminTypes';
export const adminNavigation = [
  { id: 'metrics', label: 'Visão geral', section: 'Workspace', icon: LayoutDashboard, permission: 'canViewMetrics' },
  { id: 'operations', label: 'Central de pendências', section: 'Workspace', icon: ListTodo, permission: 'canApproveWithdrawals' },
  { id: 'live', label: 'Jogadores ao vivo', section: 'Workspace', icon: Radio, permission: 'canViewMetrics' },
  { id: 'users', label: 'Usuários e afiliados', section: 'Gestão', icon: Users, permission: 'canManageUsers' },
  { id: 'withdrawals', label: 'Saques', section: 'Gestão', icon: ArrowUpRight, permission: 'canApproveWithdrawals' },
  { id: 'deposits', label: 'Depósitos', section: 'Gestão', icon: CreditCard, permission: 'canApproveDeposits' },
  { id: 'reports', label: 'Relatórios', section: 'Gestão', icon: FileText, permission: 'canExportReports' },
  { id: 'games', label: 'Jogos', section: 'Configuração', icon: Gamepad2, permission: 'canManageGames' },
  { id: 'notifications', label: 'Comunicação', section: 'Configuração', icon: Bell, permission: 'canSendNotifications' },
  { id: 'dotfy', label: 'Gateway e PIX', section: 'Configuração', icon: Wallet, permission: 'canManageDotfy' },
  { id: 'diversion', label: 'Regras de PIX', section: 'Configuração', icon: Shuffle, permission: 'canManageDotfy' },
  { id: 'admins', label: 'Equipe e permissões', section: 'Configuração', icon: ShieldCheck, permission: 'canManageAdmins' },
  { id: 'security', label: 'Atividade do sistema', section: 'Configuração', icon: Activity, permission: 'canViewMetrics' }
] as const;
export function canAccessAdminTab(tab: AdminTabId, role?: string, permissions?: AdminPermissions): boolean {
  if (role === 'superadmin') return true;
  if (role !== 'admin') return false;
  if (['withdrawals', 'operations', 'deposits'].includes(tab) && permissions?.canViewMetrics) return true;
  if (tab === 'users' && permissions?.canManageBalances) return true;
  const item = adminNavigation.find(item => item.id === tab);
  return !!item && !!permissions?.[item.permission];
}
