import React, { useState } from 'react';
import { X, Copy, Check, MessageCircle, Send, Sparkles, CheckCircle2 } from 'lucide-react';

interface PartnerCopyHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerLink: string;
  partnerCode: string;
  partnerName?: string;
  onShowToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PartnerCopyHubModal: React.FC<PartnerCopyHubModalProps> = ({
  isOpen,
  onClose,
  partnerLink,
  partnerCode,
  partnerName,
  onShowToast
}) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!isOpen) return null;

  const scripts = [
    {
      id: 1,
      title: 'Abordagem Direta no WhatsApp',
      tag: 'Mais Usado',
      tagColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      text: `Fala parceiro! Tudo bem? 🚀\n\nEstou te mandando meu convite oficial como Parceiro do Alliance Hub. A plataforma está pagando até 80% RevShare real com saques via PIX instantâneos 24h por dia e painel executivo em tempo real.\n\nFaz o seu cadastro de afiliado por este link VIP que sua conta já entra com comissão turbinada:\n👉 ${partnerLink}\n\nCódigo do Parceiro: *${partnerCode}*\n\nQualquer dúvida me avisa aqui que te dou suporte na integração!`
    },
    {
      id: 2,
      title: 'Disparo em Grupos de Afiliados & Networking',
      tag: 'Alta Conversão',
      tagColor: 'bg-amber-50 text-amber-800 border-amber-200',
      text: `🔥 *OPORTUNIDADE DE AFILIADOS iGAMING — ALLIANCE HUB*\n\nSe você já roda tráfego pago, grupos de sinais ou tem audiência engajada, você precisa dessa infraestrutura:\n\n✅ Até 80% RevShare Vitalício\n✅ Saques Automáticos via PIX 24/7\n✅ Sem taxas abusivas ou bloqueios\n✅ Painel com Métricas de FTD e NGR em Tempo Real\n\nCadastre-se na minha rede oficial com acesso VIP liberado:\n🔗 ${partnerLink}\n\nUse o código de indicação: *${partnerCode}*`
    },
    {
      id: 3,
      title: 'Pitch para Gestores de Tráfego & Influenciadores',
      tag: 'Executivo',
      tagColor: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      text: `Olá! Notei o trabalho forte que você faz na gestão de tráfego/influência.\n\nComo Parceiro Oficial do Alliance Hub, consigo liberar uma condição especial na sua conta de afiliado:\n• RevShare de alto escalão (até 80%)\n• CPA Killer e links rastreados por UTM\n• Repasses sem retenção bancária\n\nCadastre seu perfil de afiliado pelo link abaixo:\n👉 ${partnerLink}\nCódigo Parceiro: *${partnerCode}*\n\nVamos acelerar seus resultados juntos!`
    },
    {
      id: 4,
      title: 'Canal do Telegram & Stories do Instagram',
      tag: 'Redes Sociais',
      tagColor: 'bg-purple-50 text-purple-800 border-purple-200',
      text: `🚀 Procurando a melhor plataforma de afiliados iGaming do Brasil?\n\nNo Alliance Hub você tem comissões automáticas, saques PIX em segundos e jogos com a maior conversão do mercado!\n\nToque no link e garanta sua vaga VIP:\n👉 ${partnerLink}\n\n(Código Parceiro Oficial: ${partnerCode})`
    }
  ];

  const handleCopy = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      onShowToast('Script copiado com sucesso!', 'success');
      setTimeout(() => setCopiedIndex(null), 2500);
    } catch {
      onShowToast('Erro ao copiar script.', 'error');
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 min-h-[100dvh]"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-2xl max-w-2xl w-full p-4 sm:p-6 space-y-4 my-auto relative animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-zinc-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-zinc-900 tracking-tight">
                Modelos de Recrutamento VIP
              </h2>
              <p className="text-xs text-zinc-500">
                Textos prontos de alta conversão para atrair afiliados com seu link
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 flex items-center justify-center transition cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scripts List */}
        <div className="space-y-3.5 max-h-[68vh] overflow-y-auto pr-1 no-scrollbar">
          {scripts.map((script, idx) => (
            <div
              key={script.id}
              className="bg-zinc-50/90 rounded-2xl p-4 border border-zinc-200/80 space-y-2.5 hover:border-zinc-300 transition"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-black text-zinc-900">
                    {script.title}
                  </h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${script.tagColor}`}>
                    {script.tag}
                  </span>
                </div>
              </div>

              <pre className="text-xs text-zinc-700 font-sans whitespace-pre-wrap bg-white p-3 rounded-xl border border-zinc-200/60 leading-relaxed font-normal">
                {script.text}
              </pre>

              <div className="flex items-center justify-end gap-2 pt-1">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(script.text)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-8 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-white" />
                  <span>Enviar no WhatsApp</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleCopy(script.text, idx)}
                  className="h-8 px-3 rounded-xl bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200 font-bold text-xs flex items-center gap-1.5 transition shadow-2xs cursor-pointer active:scale-95"
                >
                  {copiedIndex === idx ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-zinc-500" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
