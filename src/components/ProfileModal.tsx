import React from 'react';
import { User } from '../types';
import { Modal } from './Modal';
import { User as UserIcon, Mail, Phone, Calendar, ShieldCheck, Hash } from 'lucide-react';

interface ProfileModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, isOpen, onClose }) => {
  if (!user) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Meu Perfil">
      <div className="space-y-4 pt-1">
        <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-200">
          <div className="w-12 h-12 rounded-full bg-zinc-950 text-white font-bold text-lg flex items-center justify-center shrink-0 uppercase">
            {user.name ? user.name.charAt(0) : 'U'}
          </div>
          <div>
            <h3 className="font-bold text-sm text-zinc-900">{user.name}</h3>
            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600 font-medium">
              <ShieldCheck className="w-3 h-3 text-zinc-900" />
              Usuário Verificado
            </span>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200/90 divide-y divide-zinc-100 overflow-hidden text-xs">
          <div className="p-3 flex items-center justify-between">
            <span className="text-zinc-500 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-zinc-400" />
              E-mail
            </span>
            <span className="font-semibold text-zinc-900">{user.email}</span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="text-zinc-500 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-zinc-400" />
              Telefone
            </span>
            <span className="font-semibold text-zinc-900">{user.phone}</span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="text-zinc-500 flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-zinc-400" />
              Código de Indicação
            </span>
            <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded">
              {user.referralCode}
            </span>
          </div>

          <div className="p-3 flex items-center justify-between">
            <span className="text-zinc-500 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Membro desde
            </span>
            <span className="font-semibold text-zinc-900">
              {new Date(user.createdAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-zinc-950 text-white rounded-xl font-bold text-xs cursor-pointer"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
};
