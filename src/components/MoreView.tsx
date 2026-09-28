import React from 'react';
import { User } from '../types';
import {
  User as UserIcon,
  Users,
  Settings,
  Bell,
  FileText,
  ShieldAlert,
  LogOut,
  ChevronRight,
  ShieldCheck,
  KeyRound,
  Crown,
  GraduationCap,
  Target
} from 'lucide-react';

interface MoreViewProps {
  user: User;
  onOpenProfile: () => void;
  onOpenAffiliates: () => void;
  onOpenMembers?: () => void;
  onOpenCampaigns?: () => void;
  onOpenPartnerPanel?: () => void;
  onOpenSettings: () => void;
  onOpenPixKeys?: () => void;
  onOpenTerms: () => void;
  onOpenPrivacy: () => void;
  onLogout: () => void;
  onOpenAdmin?: () => void;
}

export const MoreView: React.FC<MoreViewProps> = ({
  user,
  onOpenProfile,
  onOpenAffiliates,
  onOpenMembers,
  onOpenCampaigns,
  onOpenPartnerPanel,
  onOpenSettings,
  onOpenPixKeys,
  onOpenTerms,
  onOpenPrivacy,
  onLogout,
  onOpenAdmin,
}) => {
  const isAdminUser = user.role === 'admin' || user.role === 'superadmin';
  const isApprovedPartner = Boolean((user.isPartner === true && user.partnerApproved === true) || isAdminUser);

  const menuSections = [
    ...(onOpenPartnerPanel && isApprovedPartner ? [{
      id: 'partner',
      label: 'Painel do Parceiro VIP',
      description: 'parceiro.goalliancehub.com • Recrutamento e gestão exclusiva de afiliados',
      icon: <Crown className="w-5 h-5 text-emerald-600" />,
      onClick: onOpenPartnerPanel,
      badge: 'ATIVO',
      highlight: true
    }] : []),
    ...(onOpenCampaigns ? [{
      id: 'campaigns',
      label: 'Automações WhatsApp',
      description: 'Baileys Multi-Device, recuperação de PIX e disparos em massa',
      icon: <Target className="w-5 h-5 text-[#111111]" />,
      onClick: onOpenCampaigns,
      badge: 'PRO'
    }] : []),
    {
      id: 'gateway',
      label: 'Configurações do Gateway',
      description: 'Preferências e integrações do sistema',
      icon: <Settings className="w-5 h-5 text-[#111111]" />,
      onClick: onOpenSettings,
    },
    ...(onOpenMembers ? [{
      id: 'members',
      label: 'Área de Membros',
      description: 'Treinamento com 5 aulas práticas',
      icon: <GraduationCap className="w-5 h-5 text-[#111111]" />,
      onClick: onOpenMembers,
      badge: '5 Aulas'
    }] : []),
    ...(isAdminUser && onOpenAdmin ? [{
      id: 'admin',
      label: 'Painel Administrativo',
      description: 'Gestão de usuários, saques, saldos e permissões',
      icon: <Crown className="w-5 h-5 text-amber-500" />,
      onClick: onOpenAdmin,
      highlight: true
    }] : []),
    {
      id: 'pix-keys',
      label: 'Minhas Chaves PIX',
      description: 'Chaves de recebimento de saques cadastradas',
      icon: <KeyRound className="w-5 h-5 text-[#111111]" />,
      onClick: onOpenPixKeys,
    },
    {
      id: 'profile',
      label: 'Perfil',
      description: 'Seus dados cadastrais e conta',
      icon: <UserIcon className="w-5 h-5 text-[#111111]" />,
      onClick: onOpenProfile,
    },
    {
      id: 'affiliates',
      label: 'Afiliados',
      description: 'Programa de indicação e comissões',
      icon: <Users className="w-5 h-5 text-[#111111]" />,
      onClick: onOpenAffiliates,
    },
    {
      id: 'terms',
      label: 'Termos de uso',
      description: 'Condições gerais do serviço',
      icon: <FileText className="w-5 h-5 text-[#111111]" />,
      onClick: onOpenTerms,
    },
    {
      id: 'privacy',
      label: 'Política de privacidade',
      description: 'Proteção de dados e segurança',
      icon: <ShieldAlert className="w-5 h-5 text-[#111111]" />,
      onClick: onOpenPrivacy,
    },
  ];

  return (
    <div className="more-view space-y-6 pb-24 px-4 pt-4">
      {/* Header Profile Summary */}
      <div className="bg-white p-4 rounded-[24px] border border-[#E5E5E5] flex items-center gap-3.5 shadow-xs">
        <div className="w-12 h-12 rounded-full bg-[#111111] text-white font-bold text-lg flex items-center justify-center shrink-0 uppercase">
          {user.name ? user.name.charAt(0) : 'U'}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-sm text-[#111111] truncate">{user.name}</h2>
          <p className="text-xs text-[#737373] truncate">{user.email}</p>
          <div className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full bg-[#F5F5F5] border border-[#E5E5E5] text-[10px] font-semibold text-[#111111]">
            <ShieldCheck className="w-3 h-3 text-[#111111]" />
            Conta Verificada
          </div>
        </div>
      </div>

      {/* Options List */}
      <div className="bg-white rounded-[24px] border border-[#E5E5E5] divide-y divide-[#E5E5E5] overflow-hidden shadow-xs">
        {menuSections.map((item) => (
          <button
            key={item.id}
            onClick={item.onClick}
            className="w-full p-4 flex items-center justify-between hover:bg-[#F5F5F5] transition-colors text-left cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#F5F5F5] flex items-center justify-center shrink-0 border border-[#E5E5E5] group-hover:bg-white transition-colors">
                {item.icon}
              </div>
              <div>
                <h3 className="font-semibold text-xs text-[#111111] leading-tight">
                  {item.label}
                </h3>
                <p className="text-[11px] text-[#737373] mt-0.5">{item.description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(item as any).badge && (
                <span className="text-[10px] font-medium bg-[#F5F5F5] text-[#555555] px-2 py-0.5 rounded-md border border-[#E5E5E5]">
                  {(item as any).badge}
                </span>
              )}
              <ChevronRight className="w-4 h-4 text-[#737373] group-hover:text-[#111111] transition-colors shrink-0" />
            </div>
          </button>
        ))}
      </div>

      {/* Logout button */}
      <button
        onClick={onLogout}
        className="w-full h-12 bg-[#F5F5F5] hover:bg-[#ECECEC] text-[#111111] rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#E5E5E5]"
      >
        <LogOut className="w-4 h-4 text-[#111111]" />
        Sair da conta
      </button>

      <div className="text-center text-[11px] text-[#737373] pt-2 font-mono">
        v1.0.0 • Mobile-First App
      </div>
    </div>
  );
};
