import React from 'react';
import {
  Gamepad2,
  RefreshCw,
  ExternalLink,
  X
} from 'lucide-react';
import { IOSButton } from './IOSComponents';

interface AdminGameTesterModalProps {
  modal: {
    isOpen: boolean;
    gameUrl: string;
    gameTitle: string;
  } | null;
  onClose: () => void;
}

export const AdminGameTesterModal: React.FC<AdminGameTesterModalProps> = ({
  modal,
  onClose
}) => {
  if (!modal || !modal.isOpen) return null;

  const handleReload = () => {
    const iframe = document.getElementById('admin-game-tester-frame') as HTMLIFrameElement;
    if (iframe) iframe.src = iframe.src;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#1C1C1E] text-white border border-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-[#2C2C2E] border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#007AFF] flex items-center justify-center text-white font-bold shadow-sm">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">{modal.gameTitle}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#30D158]/20 text-[#30D158] border border-[#30D158]/30">
                  MODO TESTE ADMIN
                </span>
              </div>
              <p className="text-[11px] text-white/50 font-medium">
                Testando física, probabilidades e motor de apostas ao vivo
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReload}
              className="h-8 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#0A84FF]" />
              <span className="hidden sm:inline">Reiniciar</span>
            </button>

            <a
              href={modal.gameUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8 px-3 rounded-xl bg-[#007AFF] hover:bg-[#0A84FF] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova Aba</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white/80 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Game Iframe */}
        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden min-h-[460px] sm:min-h-[540px]">
          <iframe
            id="admin-game-tester-frame"
            src={modal.gameUrl}
            className="w-full h-full border-0 min-h-[460px] sm:min-h-[540px]"
            title="Teste do Jogo"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          />
        </div>
      </div>
    </div>
  );
};
