import React, { useState } from 'react';
import { X, Megaphone, Send, Users, Loader2 } from 'lucide-react';

interface PartnerBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  affiliateCount: number;
  onBroadcast: (title: string, message: string) => Promise<boolean>;
}

export const PartnerBroadcastModal: React.FC<PartnerBroadcastModalProps> = ({
  isOpen,
  onClose,
  affiliateCount,
  onBroadcast
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [broadcasting, setBroadcasting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;
    setBroadcasting(true);
    const ok = await onBroadcast(title.trim(), message.trim());
    setBroadcasting(false);
    if (ok) {
      setTitle('');
      setMessage('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-zinc-200 relative overflow-hidden">
        {/* Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4 mt-1">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Megaphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-zinc-900">Transmissão em Massa (VIP)</h3>
            <p className="text-xs text-zinc-500">
              Disparar aviso para todos os <strong className="text-zinc-800">{affiliateCount}</strong> afiliados da sua rede
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Título do Comunicado</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: 🚀 Nova Campanha de Bonificação Ativa!"
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Mensagem para os Afiliados</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="Digite o comunicado oficial para a sua base de afiliados..."
              className="w-full px-3.5 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition resize-none"
              required
            />
          </div>

          <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
            <Users className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              Essa mensagem será enviada instantaneamente para todos os dispositivos e painéis dos afiliados vinculados ao seu código de parceiro.
            </span>
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
              disabled={broadcasting || !title.trim() || !message.trim() || affiliateCount === 0}
              className="px-4 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {broadcasting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              {broadcasting ? 'Transmitindo...' : 'Disparar Notificação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
