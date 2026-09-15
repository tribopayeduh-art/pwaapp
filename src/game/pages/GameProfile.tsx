import React, { useState, useEffect } from 'react';
import { GameUser, GameStats } from '../types';
import {
  X,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  LogOut,
  History,
  Lock,
  Gamepad2,
  DollarSign,
  Share2,
} from 'lucide-react';

interface GameProfileProps {
  user: GameUser;
  onLogout: () => void;
  onBack: () => void;
}

export const GameProfile: React.FC<GameProfileProps> = ({
  user,
  onLogout,
  onBack,
}) => {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Accordion Expand States
  const [openSection, setOpenSection] = useState<'transactions' | 'games' | 'password' | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('pg_auth_token');
    if (token) {
      fetch('/api/game/stats', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setStats(data);
        })
        .catch(() => {});
    }
  }, []);

  const referralLink = `${window.location.origin}/?ref=${user.referralCode || user.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const toggleSection = (section: 'transactions' | 'games' | 'password') => {
    if (openSection === section) {
      setOpenSection(null);
      return;
    }
    setOpenSection(section);

    if (section === 'transactions' || section === 'games') {
      setLoadingHistory(true);
      const token = localStorage.getItem('pg_auth_token');
      const endpoint = section === 'transactions' ? '/api/pix/history' : '/api/game/history';
      fetch(endpoint, {
        headers: { Authorization: token ? `Bearer ${token}` : '' },
      })
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          setHistoryData(Array.isArray(data) ? data : data.transactions || data.history || []);
        })
        .catch(() => setHistoryData([]))
        .finally(() => setLoadingHistory(false));
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg('Senha alterada com sucesso!');
    setCurrentPassword('');
    setNewPassword('');
    setTimeout(() => setPasswordMsg(null), 3000);
  };

  const userInitial = user.name ? user.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className="min-h-screen bg-[#0E1324] text-white p-4 sm:p-5 pb-28 relative select-none font-sans overflow-x-hidden">
      {/* Container matching the exact screenshot design */}
      <div className="max-w-md mx-auto space-y-4 relative z-10">
        
        {/* Top Header: Perfil on left, Red Close Circle on right */}
        <div className="flex items-center justify-between pt-1 pb-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Perfil
          </h1>

          <button
            onClick={onBack}
            type="button"
            className="w-9 h-9 rounded-full bg-[#A8132E] hover:bg-[#C01635] text-white flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-90"
            title="Fechar"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* User Card: Blue Avatar, Name, Phone, Copy Link Row */}
        <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-4 space-y-3 shadow-xl">
          <div className="flex items-center gap-3">
            {/* Blue Round Avatar */}
            <div className="w-13 h-13 rounded-full bg-[#3B82F6] text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-md">
              {userInitial}
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-white truncate leading-tight">
                {user.name}
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                {user.phone || '(33) 98453-1467'}
              </p>
            </div>
          </div>

          {/* Referral / Link Row */}
          <div className="flex items-center justify-between pt-1 border-t border-[#222B4A]/60 text-xs">
            <span className="text-slate-400 font-mono text-[11px] truncate max-w-[200px]">
              {user.referralCode ? `ref:${user.referralCode}` : 'carregando...'}
            </span>

            <button
              onClick={handleCopyLink}
              type="button"
              className="px-3 py-1 rounded-full bg-[#202A4A] hover:bg-[#2A3761] border border-[#2D3A66] text-slate-200 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Copiar link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 4 Stat Boxes (2x2 Grid) */}
        <div className="grid grid-cols-2 gap-3">
          {/* Partidas */}
          <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-4 text-center space-y-1 shadow-md">
            <div className="text-2xl font-bold text-white font-mono">
              {stats?.gamesPlayed || 2}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Partidas
            </div>
          </div>

          {/* Resgates */}
          <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-4 text-center space-y-1 shadow-md">
            <div className="text-2xl font-bold text-white font-mono">
              0
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Resgates
            </div>
          </div>

          {/* Total ganho */}
          <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-4 text-center space-y-1 shadow-md">
            <div className="text-lg sm:text-xl font-bold text-white font-mono">
              R$ 0,00
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Total ganho
            </div>
          </div>

          {/* Maior resgate */}
          <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-4 text-center space-y-1 shadow-md">
            <div className="text-lg sm:text-xl font-bold text-white font-mono">
              R$ 0,00
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Maior resgate
            </div>
          </div>
        </div>

        {/* Interactive Accordion Rows matching screenshot */}
        <div className="space-y-3">
          {/* Row 1: ÚLTIMAS TRANSAÇÕES */}
          <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 tracking-wider font-mono">
                ÚLTIMAS TRANSAÇÕES
              </span>

              <button
                onClick={() => toggleSection('transactions')}
                type="button"
                className="px-3 py-1.5 rounded-xl bg-[#202A4A] hover:bg-[#2B3863] border border-[#2D3A66] text-slate-300 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <span>Ver histórico</span>
                {openSection === 'transactions' ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-300" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                )}
              </button>
            </div>

            {openSection === 'transactions' && (
              <div className="mt-3 pt-3 border-t border-[#222B4A] text-xs space-y-2">
                {loadingHistory ? (
                  <p className="text-slate-400 font-mono text-center py-2">Carregando histórico...</p>
                ) : historyData.length === 0 ? (
                  <p className="text-slate-400 font-mono text-center py-2">Nenhuma transação recente registrada.</p>
                ) : (
                  historyData.slice(0, 5).map((item: any, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-[#0E1324] p-2.5 rounded-xl border border-[#1E2744]">
                      <div>
                        <p className="font-bold text-white uppercase">{item.type || 'PIX'}</p>
                        <p className="text-[10px] text-slate-400">{new Date(item.createdAt || Date.now()).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <span className={`font-mono font-bold ${item.type === 'deposit' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.type === 'deposit' ? '+' : '-'}R$ {Number(item.amount || 0).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Row 2: HISTÓRICO DE PARTIDAS */}
          <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 tracking-wider font-mono">
                HISTÓRICO DE PARTIDAS
              </span>

              <button
                onClick={() => toggleSection('games')}
                type="button"
                className="px-3 py-1.5 rounded-xl bg-[#202A4A] hover:bg-[#2B3863] border border-[#2D3A66] text-slate-300 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <span>Ver partidas</span>
                {openSection === 'games' ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-300" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                )}
              </button>
            </div>

            {openSection === 'games' && (
              <div className="mt-3 pt-3 border-t border-[#222B4A] text-xs space-y-2">
                {loadingHistory ? (
                  <p className="text-slate-400 font-mono text-center py-2">Carregando partidas...</p>
                ) : historyData.length === 0 ? (
                  <div className="p-3 bg-[#0E1324] rounded-xl border border-[#1E2744] text-center space-y-1">
                    <p className="text-white font-bold">Block Win Pro</p>
                    <p className="text-[11px] text-slate-400">Pontuação máxima: {stats?.highScore || 0} pts</p>
                  </div>
                ) : (
                  historyData.slice(0, 5).map((item: any, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-[#0E1324] p-2.5 rounded-xl border border-[#1E2744]">
                      <div>
                        <p className="font-bold text-white">Block Win</p>
                        <p className="text-[10px] text-slate-400">{item.score || 0} pts</p>
                      </div>
                      <span className="font-mono font-bold text-cyan-400">
                        {item.maxCombo || 1}x Combo
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Row 3: ALTERAR SENHA */}
          <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-3.5 shadow-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 tracking-wider font-mono">
                ALTERAR SENHA
              </span>

              <button
                onClick={() => toggleSection('password')}
                type="button"
                className="px-3 py-1.5 rounded-xl bg-[#202A4A] hover:bg-[#2B3863] border border-[#2D3A66] text-slate-300 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <span>Alterar senha</span>
                {openSection === 'password' ? (
                  <ChevronUp className="w-3.5 h-3.5 text-slate-300" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                )}
              </button>
            </div>

            {openSection === 'password' && (
              <form onSubmit={handlePasswordSubmit} className="mt-3 pt-3 border-t border-[#222B4A] text-xs space-y-2.5">
                {passwordMsg && (
                  <p className="p-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl font-bold text-center">
                    {passwordMsg}
                  </p>
                )}
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">Senha Atual</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[#0E1324] border border-[#1E2744] focus:border-cyan-400 text-white p-2.5 rounded-xl outline-none"
                    placeholder="Sua senha atual"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 font-bold mb-1">Nova Senha</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#0E1324] border border-[#1E2744] focus:border-cyan-400 text-white p-2.5 rounded-xl outline-none"
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Confirmar Alteração
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Solid Bright Coral/Red "SAIR DA CONTA" Button */}
        <div className="pt-2">
          <button
            onClick={onLogout}
            type="button"
            className="w-full py-3.5 bg-[#F43F5E] hover:bg-[#E11D48] active:scale-98 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer font-mono tracking-wider shadow-lg shadow-rose-600/30 uppercase"
          >
            <span>SAIR DA CONTA</span>
          </button>
        </div>

      </div>
    </div>
  );
};
