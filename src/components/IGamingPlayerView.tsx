import React, { useState, useEffect } from 'react';
import { User } from '../types';
import {
  CreditCard,
  ArrowDownToLine,
  LayoutGrid,
  Users,
  User as UserIcon,
  Play,
  Star,
  Zap,
} from 'lucide-react';

interface IGamingPlayerViewProps {
  user: User | null;
  onDeposit: () => void;
  onWithdraw: () => void;
  onPlayGame: (betAmount: number) => void;
  onOpenReferral: () => void;
  onOpenProfile: () => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

const PRESET_BETS = [3, 5, 10, 20, 50, 100];

const RECENT_WINNERS = [
  { name: 'Priscila', amount: '157,24' },
  { name: 'Lucas M.', amount: '290,00' },
  { name: 'Rafael S.', amount: '87,50' },
  { name: 'Camila K.', amount: '435,00' },
  { name: 'Eduardo B.', amount: '145,00' },
];

export const IGamingPlayerView: React.FC<IGamingPlayerViewProps> = ({
  user,
  onDeposit,
  onWithdraw,
  onPlayGame,
  onOpenReferral,
  onOpenProfile,
  onShowToast,
}) => {
  const [selectedBet, setSelectedBet] = useState<number>(10);
  const [customBetInput, setCustomBetInput] = useState<string>('10');
  const [winnerIndex, setWinnerIndex] = useState<number>(0);

  // Cycle winners ticker every 4 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setWinnerIndex((prev) => (prev + 1) % RECENT_WINNERS.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleSelectPreset = (amount: number) => {
    setSelectedBet(amount);
    setCustomBetInput(amount.toString());
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomBetInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setSelectedBet(num);
    }
  };

  const handleStartGame = () => {
    if (!user) {
      if (onShowToast) onShowToast('Faça login para começar a jogar!', 'info');
      return;
    }

    if (selectedBet <= 0) {
      if (onShowToast) onShowToast('Selecione um valor de entrada válido.', 'error');
      return;
    }

    if (user.balance < selectedBet) {
      if (onShowToast) {
        onShowToast(`Saldo insuficiente (R$ ${user.balance.toFixed(2)}). Faça um depósito!`, 'error');
      }
      onDeposit();
      return;
    }

    onPlayGame(selectedBet);
  };

  const formattedBalance = user
    ? user.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';
  const minReward = (selectedBet * 2.9).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currentWinner = RECENT_WINNERS[winnerIndex];

  return (
    <div className="min-h-screen bg-[#040819] text-white flex flex-col justify-between selection:bg-cyan-500 selection:text-black relative overflow-hidden select-none bg-[linear-gradient(to_right,#10204620_1px,transparent_1px),linear-gradient(to_bottom,#10204620_1px,transparent_1px)] bg-[size:28px_28px] font-sans">
      
      {/* Background Ambient Glowing Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[420px] bg-blue-600/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 -right-24 w-80 h-80 bg-cyan-500/15 rounded-full blur-[90px] pointer-events-none" />
      <div className="absolute bottom-20 -left-20 w-80 h-80 bg-purple-600/15 rounded-full blur-[90px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="px-4 py-3 bg-[#050B1F]/90 backdrop-blur-xl border-b border-[#142652] flex items-center justify-between sticky top-0 z-30 shadow-2xl">
        {/* Brand Logo */}
        <div className="flex items-center">
          <img
            src="/blocklogo.png"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/logoblock.png';
            }}
            alt="BLOCK WIN"
            className="h-9 sm:h-11 w-auto object-contain drop-shadow-[0_2px_10px_rgba(0,210,255,0.5)]"
          />
        </div>

        {/* Header Right: Balance & Profile Avatar */}
        <div className="flex items-center gap-3">
          {/* Balance Display */}
          <div className="text-right">
            <span className="block text-[9px] text-slate-400 font-extrabold uppercase tracking-widest font-mono leading-none mb-0.5">
              SALDO
            </span>
            <span className="font-black text-sm sm:text-base text-[#00E676] font-mono tracking-tight drop-shadow-[0_0_10px_rgba(0,230,118,0.5)]">
              R$ {formattedBalance}
            </span>
          </div>

          {/* Profile Avatar Button */}
          <button
            onClick={onOpenProfile}
            type="button"
            className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#00A3FF] to-[#3B82F6] p-0.5 shadow-[0_0_12px_rgba(0,163,255,0.4)] cursor-pointer active:scale-95 transition-all flex items-center justify-center shrink-0"
            title="Abrir Perfil"
          >
            <div className="w-full h-full bg-[#08122E] rounded-full flex items-center justify-center font-black text-sm text-[#00D2FF] uppercase font-mono">
              {user?.name ? user.name.charAt(0) : 'R'}
            </div>
          </button>
        </div>
      </header>

      {/* Main Content Area - Mobile-First Premium Card */}
      <main className="flex-1 p-3.5 sm:p-4 max-w-md mx-auto w-full space-y-3 pb-28 relative z-10">
        
        {/* Main iGaming Glass Container Card */}
        <div className="bg-gradient-to-b from-[#0F1B3E] via-[#0A122B] to-[#060B1E] border border-[#1C3268] rounded-[28px] p-4 sm:p-5 shadow-[0_10px_35px_rgba(0,0,0,0.6)] relative overflow-hidden space-y-4 backdrop-blur-md">
          
          {/* Banner Graphic Section */}
          <div className="relative rounded-2xl overflow-hidden border border-[#233F80] bg-[#060C24] shadow-2xl max-h-44 sm:max-h-52 flex items-center justify-center">
            {/* Live Online Badge */}
            <div className="absolute top-2.5 right-2.5 px-3 py-1 bg-black/80 backdrop-blur-md rounded-full border border-cyan-400/30 flex items-center gap-1.5 z-10 shadow-xl">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span className="text-[10px] font-black text-cyan-300 font-mono tracking-wider">
                487 online
              </span>
            </div>

            <img
              src="/banner001.jpeg"
              alt="Banner BlockWin"
              className="w-full h-full object-cover block hover:scale-102 transition-transform duration-500"
            />
          </div>

          {/* Valor de Entrada Section */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-[11px] font-black text-[#00E5FF] uppercase tracking-wider font-mono">
                VALOR DE ENTRADA
              </label>

              <span className="text-[11px] font-bold font-mono text-slate-300">
                Multiplicador <strong className="text-amber-400 font-black">x2.90</strong>
              </span>
            </div>

            {/* Preset Grid (2 Rows x 3 Columns) */}
            <div className="grid grid-cols-3 gap-2.5">
              {PRESET_BETS.map((amount) => {
                const isSelected = selectedBet === amount;
                return (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => handleSelectPreset(amount)}
                    className={`py-3 px-2 rounded-2xl font-black text-sm transition-all cursor-pointer border font-mono tracking-tight ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#81BCFF] via-[#5BA4FF] to-[#388BFF] text-[#04091A] border-[#A8D3FF] shadow-[0_0_20px_rgba(56,139,255,0.6)] scale-[1.03] font-black'
                        : 'bg-[#0E1733] hover:bg-[#142047] text-white border-[#1B2F5E]'
                    }`}
                  >
                    R${amount}
                  </button>
                );
              })}
            </div>

            {/* Custom Input Field */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[#00E5FF] font-black text-sm font-mono">
                R$
              </div>
              <input
                type="text"
                value={customBetInput}
                onChange={handleCustomInputChange}
                className="w-full bg-[#080E24] border border-[#1B2E5C] focus:border-[#00E5FF] text-white font-black text-base pl-11 pr-4 py-3 rounded-2xl outline-none transition-all font-mono shadow-inner"
                placeholder="10"
              />
            </div>
          </div>

          {/* Recompensa Mínima Box - High Impact Card */}
          <div className="bg-[#0A132C]/90 border border-[#1A2E5E] rounded-2xl p-3.5 text-center space-y-1 shadow-inner backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-2xl pointer-events-none" />
            <p className="text-xs text-slate-300 font-semibold font-mono">Recompensa mínima</p>
            <p className="text-2xl sm:text-3xl font-black text-[#FFE600] font-mono tracking-tight drop-shadow-[0_0_15px_rgba(255,230,0,0.6)]">
              R$ {minReward}
            </p>
          </div>

          {/* Big Green "Jogar" Button with Circulating Lightning Bolt */}
          <div className="relative group">
            {/* Circulating Glowing Border Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-emerald-400 via-cyan-400 to-amber-300 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition duration-500 animate-pulse pointer-events-none" />

            <button
              type="button"
              onClick={handleStartGame}
              className="w-full py-4 bg-gradient-to-r from-[#00E676] via-[#00C853] to-[#00E676] hover:brightness-110 active:scale-[0.98] text-[#021A0A] font-black text-lg sm:text-xl rounded-2xl shadow-[0_0_30px_rgba(0,230,118,0.5)] transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2.5 relative overflow-hidden font-mono z-10"
            >
              {/* Animated Shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer pointer-events-none" />

              {/* Circulating / Rotating Lightning Bolt Ring */}
              <div className="relative flex items-center justify-center">
                <Zap className="w-6 h-6 text-[#021A0A] fill-current animate-bounce shrink-0 drop-shadow-[0_0_8px_rgba(255,230,0,0.8)]" />
              </div>

              <span>JOGAR AGORA</span>

              {/* Pulsing Energy Ray */}
              <Zap className="w-5 h-5 text-amber-300 fill-amber-300 animate-pulse shrink-0" />
            </button>
          </div>
        </div>

        {/* Live Winners Ticker Bar */}
        <div className="bg-[#0A132B]/90 border border-[#1A2D5C] rounded-2xl p-2.5 px-3.5 flex items-center justify-between backdrop-blur-md shadow-lg transition-all duration-300">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-white font-mono leading-tight">
                {currentWinner.name}
              </p>
              <p className="text-[10px] text-slate-400 font-sans leading-none">
                acabou de ganhar
              </p>
            </div>
          </div>

          <span className="font-black text-sm text-[#00E676] font-mono drop-shadow-[0_0_8px_rgba(0,230,118,0.4)]">
            R$ {currentWinner.amount}
          </span>
        </div>
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#050A1A]/95 backdrop-blur-2xl border-t border-[#14254E] px-3 py-2.5 shadow-[0_-5px_25px_rgba(0,0,0,0.8)]">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {/* Depositar */}
          <button
            type="button"
            onClick={onDeposit}
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer py-1 group"
          >
            <CreditCard className="w-6 h-6 group-hover:text-cyan-400 transition-colors drop-shadow-md" />
            <span className="text-[10px] sm:text-xs font-extrabold font-mono tracking-tight">Depositar</span>
          </button>

          {/* Sacar */}
          <button
            type="button"
            onClick={onWithdraw}
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer py-1 group"
          >
            <ArrowDownToLine className="w-6 h-6 group-hover:text-emerald-400 transition-colors drop-shadow-md" />
            <span className="text-[10px] sm:text-xs font-extrabold font-mono tracking-tight">Sacar</span>
          </button>

          {/* Center Floating Jogar Button */}
          <button
            type="button"
            onClick={handleStartGame}
            className="flex flex-col items-center gap-1 -mt-7 transition-transform active:scale-95 cursor-pointer group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00E676] via-[#00C853] to-[#00B0FF] text-[#050A1A] flex items-center justify-center shadow-[0_0_25px_rgba(0,230,118,0.6)] border-2 border-[#050A1A] group-hover:scale-105 transition-transform relative overflow-hidden">
              <Zap className="w-7 h-7 fill-current text-[#031C0B] animate-pulse" />
            </div>
            <span className="text-[10px] sm:text-xs font-black text-[#00E676] font-mono uppercase tracking-wider drop-shadow-[0_0_6px_rgba(0,230,118,0.5)]">Jogar</span>
          </button>

          {/* Indicações */}
          <button
            type="button"
            onClick={onOpenReferral}
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer py-1 group"
          >
            <Users className="w-6 h-6 group-hover:text-purple-400 transition-colors drop-shadow-md" />
            <span className="text-[10px] sm:text-xs font-extrabold font-mono tracking-tight">Indicar</span>
          </button>

          {/* Perfil */}
          <button
            type="button"
            onClick={onOpenProfile}
            className="flex flex-col items-center gap-1 text-slate-300 hover:text-white transition-colors cursor-pointer py-1 group"
          >
            <UserIcon className="w-6 h-6 group-hover:text-cyan-400 transition-colors drop-shadow-md" />
            <span className="text-[10px] sm:text-xs font-extrabold font-mono tracking-tight">Perfil</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
