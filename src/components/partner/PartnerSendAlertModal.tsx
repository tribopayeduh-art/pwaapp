import React, { useState } from 'react';
import { X, Send, Bell, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';
import { PartnerAffiliateStats } from '../../types';

interface PartnerSendAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  affiliate: PartnerAffiliateStats | null;
  onSend: (affiliateId: string, title: string, message: string) => Promise<boolean>;
}

export const PartnerSendAlertModal: React.FC<PartnerSendAlertModalProps> = ({
  isOpen,
  onClose,
  affiliate,
  onSend
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen || !affiliate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setSending(true);
    const ok = await onSend(affiliate.id, title.trim(), message.trim());
    setSending(false);
    if (ok) {
      setTitle('');
      setMessage('');
      onClose();
    }
  };

  const presetMessages = [
    { title: 'Aviso sobre Saques', text: 'Olá! Suas solicitações de saque passarão por verificação padrão antes do envio.' },
    { title: 'Meta de Faturamento', text: 'Parabéns pelo seu desempenho! Aumente seus indicados para subir de comissão.' },
    { title: 'Dúvidas e Suporte', text: 'Olá! Sou seu parceiro oficial no Alliance Hub. Precisa de apoio para escalar?' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 relative overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">Enviar Alerta Push</h3>
            <p className="text-xs text-zinc-500">
              Para: <span className="font-semibold text-zinc-800">{affiliate.name}</span> ({affiliate.email})
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="mb-4">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
            Mensagens Rápidas
          </span>
          <div className="flex flex-wrap gap-1.5">
            {presetMessages.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTitle(p.title);
                  setMessage(p.text);
                }}
                className="text-xs bg-zinc-50 hover:bg-zinc-100 text-zinc-700 px-2.5 py-1 rounded-lg border border-zinc-200 transition cursor-pointer"
              >
                {p.title}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Título do Alerta</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Atualização Importante"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Conteúdo da Notificação</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Digite a mensagem que o afiliado receberá..."
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition resize-none"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={sending || !title.trim() || !message.trim()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {sending ? 'Enviando...' : 'Enviar Alerta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
