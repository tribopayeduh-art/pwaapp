import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, ExternalLink } from 'lucide-react';
import { User } from '../types';
import { GAME_ASSETS } from '../config/gameAssets';

interface Props {
  user: User;
  onBack: () => void;
  onDeposit: () => void;
  onBalanceChange: (balance: number) => void;
  onShowToast: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export const ZumblaPlayerView: React.FC<Props> = ({ onBack, onDeposit, onBalanceChange, onShowToast }) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.data?.source !== 'zumbla-shell') return;
      if (event.data.event === 'balance') onBalanceChange(Number(event.data.balance || 0));
      if (event.data.event === 'deposit' || event.data.action === 'deposit') onDeposit();
      if (event.data.event === 'exit') onBack();
      if (event.data.event === 'error') onShowToast(String(event.data.message || 'Erro no Zumbla.'), 'error');
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [onBack, onDeposit, onBalanceChange, onShowToast]);

  return (
    <div className="fixed inset-0 z-[70] bg-black">
      <button type="button" onClick={onBack} aria-label="Voltar ao lobby" className="fixed left-3 top-[max(12px,env(safe-area-inset-top))] z-[90] grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-black/65 text-white shadow-xl backdrop-blur-md"><ArrowLeft className="h-5 w-5" /></button>
      {!loaded && !failed && <div className="absolute inset-0 z-[80] grid place-items-center bg-black text-white"><div className="flex flex-col items-center gap-3"><Loader2 className="h-7 w-7 animate-spin"/><span className="text-xs font-bold">Abrindo Zumbla Win...</span></div></div>}
      {failed && <div className="absolute inset-0 z-[80] grid place-items-center bg-black p-6 text-white"><div className="max-w-xs text-center"><p className="font-bold">Não foi possível carregar o Zumbla.</p><button type="button" onClick={() => window.location.assign(GAME_ASSETS.zumbla.app)} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-black"><ExternalLink className="h-4 w-4"/>Abrir diretamente</button></div></div>}
      <iframe key="zumbla-v15" src={GAME_ASSETS.zumbla.app} title="Zumbla Win" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="absolute inset-0 z-0 h-full w-full border-0" allow="autoplay; fullscreen; clipboard-write" />
    </div>
  );
};
