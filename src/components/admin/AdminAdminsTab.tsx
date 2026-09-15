import React, { useState } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Lock,
  Mail,
  User,
  Shield,
  Key
} from 'lucide-react';
import { AdminPermissions } from '../../types';
import {
  IOSCard,
  IOSBadge,
  IOSButton,
  IOSToggle,
  IOSModalSheet
} from './IOSComponents';

interface AdminMember {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions?: AdminPermissions;
  createdAt: string;
}

interface AdminAdminsTabProps {
  admins: AdminMember[];
  loading: boolean;
  onAddAdmin: (data: {
    name: string;
    email: string;
    password?: string;
    permissions: AdminPermissions;
  }) => Promise<void>;
  onRemoveAdmin: (adminId: string) => Promise<void>;
}

export const AdminAdminsTab: React.FC<AdminAdminsTabProps> = ({
  admins,
  loading,
  onAddAdmin,
  onRemoveAdmin
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  // Granular permissions state
  const [permissions, setPermissions] = useState<AdminPermissions>({
    canManageUsers: true,
    canManageBalances: true,
    canManageCommissions: true,
    canApproveWithdrawals: true,
    canApproveDeposits: true,
    canSendNotifications: true,
    canManageGames: true,
    canManageAdmins: false,
    canViewMetrics: true,
    canExportReports: true,
    canManageDotfy: false
  });

  const handleToggle = (key: keyof AdminPermissions) => {
    setPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    try {
      await onAddAdmin({ name, email, password, permissions });
      setModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <IOSCard className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Equipe Administrativa & Permissões
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Gerencie operadores com controle de acesso baseado em funções (RBAC)
          </p>
        </div>

        <IOSButton variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="w-4 h-4" />
          <span>Novo Administrador</span>
        </IOSButton>
      </IOSCard>

      {/* Admins Inset Grouped List */}
      <IOSCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F2F2F7] text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
              <tr>
                <th className="py-3 px-4">Administrador</th>
                <th className="py-3 px-4">Papel</th>
                <th className="py-3 px-4">Permissões Habilitadas</th>
                <th className="py-3 px-4">Cadastro</th>
                <th className="py-3 px-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {admins.map((admin) => {
                const isSuper = (admin.email || '').toLowerCase() === 'admin.eduh@gmail.com';

                return (
                  <tr key={admin.id} className="hover:bg-black/[0.015] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#007AFF]/12 text-[#007AFF] font-bold text-xs flex items-center justify-center">
                          {admin.name ? admin.name.charAt(0).toUpperCase() : 'A'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{admin.name || 'Operador'}</div>
                          <div className="text-[11px] text-slate-400">{admin.email}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      {isSuper ? (
                        <IOSBadge variant="indigo">Super Admin</IOSBadge>
                      ) : (
                        <IOSBadge variant="blue">Operador</IOSBadge>
                      )}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-sm">
                        {isSuper ? (
                          <span className="text-[10px] font-bold text-[#007AFF]">
                            Acesso Irrestrito / Full Master
                          </span>
                        ) : (
                          <>
                            {admin.permissions?.canManageUsers && (
                              <IOSBadge variant="gray">Usuários</IOSBadge>
                            )}
                            {admin.permissions?.canApproveWithdrawals && (
                              <IOSBadge variant="gray">Saques</IOSBadge>
                            )}
                            {admin.permissions?.canManageGames && (
                              <IOSBadge variant="gray">Jogos/RTP</IOSBadge>
                            )}
                            {admin.permissions?.canExportReports && (
                              <IOSBadge variant="gray">Relatórios</IOSBadge>
                            )}
                            {admin.permissions?.canManageDotfy && (
                              <IOSBadge variant="indigo">Dotfy Gateway</IOSBadge>
                            )}
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-xs">
                      {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString('pt-BR') : '—'}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {!isSuper && (
                        <button
                          type="button"
                          onClick={() => onRemoveAdmin(admin.id)}
                          className="w-7 h-7 rounded-lg bg-[#FF3B30]/12 text-[#FF3B30] hover:bg-[#FF3B30]/20 flex items-center justify-center transition-all cursor-pointer mx-auto"
                          title="Remover operador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </IOSCard>

      {/* Modal: New Admin */}
      <IOSModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Cadastrar Novo Administrador"
        subtitle="Defina o acesso e as credenciais do novo operador"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Nome Completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Oliveira"
              className="w-full h-10 px-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Email de Acesso</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operador@alliance.com"
              className="w-full h-10 px-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Senha Provisória</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-10 px-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-[#007AFF] focus:outline-none transition-all"
              required
            />
          </div>

          {/* Permissions toggles */}
          <div className="pt-2 border-t border-black/[0.04] space-y-2">
            <span className="text-xs font-bold text-slate-900 block">Permissões de Acesso:</span>

            <IOSToggle
              label="Gerenciar Usuários & Saldos"
              description="Pode visualizar dados e ajustar saldos"
              checked={!!permissions.canManageUsers}
              onChange={() => handleToggle('canManageUsers')}
            />

            <IOSToggle
              label="Aprovar e Rejeitar Saques PIX"
              description="Acesso ao painel financeiro de liberação"
              checked={!!permissions.canApproveWithdrawals}
              onChange={() => handleToggle('canApproveWithdrawals')}
            />

            <IOSToggle
              label="Controle de Jogos & RTP"
              description="Alterar probabilidade, física e modos"
              checked={!!permissions.canManageGames}
              onChange={() => handleToggle('canManageGames')}
            />

            <IOSToggle
              label="Exportação de Relatórios & DRE"
              description="Download de planilhas e métricas financeiras"
              checked={!!permissions.canExportReports}
              onChange={() => handleToggle('canExportReports')}
            />

            <IOSToggle
              label="Gerenciamento Dotfy Gateway"
              description="Visualizar saldo em tempo real e todas as chaves PIX/API da Dotfy"
              checked={!!permissions.canManageDotfy}
              onChange={() => handleToggle('canManageDotfy')}
            />
          </div>

          <div className="pt-3 flex gap-2">
            <IOSButton
              type="submit"
              variant="primary"
              disabled={saving}
              className="flex-1 h-10"
            >
              <span>Salvar e Convidar</span>
            </IOSButton>
            <IOSButton
              type="button"
              variant="secondary"
              onClick={() => setModalOpen(false)}
              className="h-10"
            >
              <span>Cancelar</span>
            </IOSButton>
          </div>
        </form>
      </IOSModalSheet>
    </div>
  );
};
