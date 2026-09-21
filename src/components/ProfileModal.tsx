import React, { useState } from 'react';
import { User } from '../types';
import { Modal } from './Modal';
import { 
  User as UserIcon, Mail, Phone, Calendar, ShieldCheck, Hash, 
  Copy, Check
} from 'lucide-react';

interface ProfileModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  currentGameId?: string;
  onShowToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ 
  user, 
  isOpen, 
  onClose,
  onShowToast
}) => {
  if (!user) return null;

  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    const code = user.referralCode || user.id.slice(0, 8).toUpperCase();
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
      if (onShowToast) onShowToast('Código de indicação copiado com sucesso!', 'success');
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Perfil do Afiliado">
      <div className="space-y-4 pt-1 max-h-[80vh] overflow-y-auto pr-1 select-none">
        {/* User Card */}
        <div className="flex items-center gap-3 p-3.5 bg-zinc-50 rounded-2xl border border-zinc-200">
          <div className="w-12 h-12 rounded-full bg-[#111111] text-white font-bold text-lg flex items-center justify-center shrink-0 uppercase shadow-xs">
            {user.name ? user.name.charAt(0) : 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-sm text-zinc-900 truncate">{user.name || 'Afiliado Alliance Hub'}</h3>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold mt-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              Afiliado Verificado • Alliance Hub
            </span>
          </div>
        </div>

        {/* Details List */}
        <div className="bg-white rounded-2xl border border-zinc-200/90 divide-y divide-zinc-100 overflow-hidden text-xs">
          <div className="p-3 flex items-center justify-between gap-2">
            <span className="text-zinc-500 flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-zinc-400" />
              E-mail
            </span>
            <span className="font-semibold text-zinc-900 font-mono truncate max-w-[200px]">{user.email}</span>
          </div>

          <div className="p-3 flex items-center justify-between gap-2">
            <span className="text-zinc-500 flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-zinc-400" />
              Telefone
            </span>
            <span className="font-semibold text-zinc-900">{user.phone || 'Não informado'}</span>
          </div>

          <div className="p-3 flex items-center justify-between gap-2">
            <span className="text-zinc-500 flex items-center gap-2">
              <Hash className="w-3.5 h-3.5 text-zinc-400" />
              Código de Afiliado
            </span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                {user.referralCode || user.id.slice(0, 8).toUpperCase()}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                title="Copiar código"
                className="p-1 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3 flex items-center justify-between gap-2">
            <span className="text-zinc-500 flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Membro desde
            </span>
            <span className="font-semibold text-zinc-900">
              {user.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'Ativo'}
            </span>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 bg-[#111111] text-white rounded-xl font-bold text-xs cursor-pointer hover:bg-zinc-800 transition-colors"
        >
          Fechar
        </button>
      </div>
    </Modal>
  );
};
