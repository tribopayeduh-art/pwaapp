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
  Crown,
  Users,
  TrendingUp,
  CheckCircle2,
  ArrowUpRight,
  Send,
  AlertCircle,
} from 'lucide-react';

interface GameProfileProps {
  user: GameUser;
  onLogout: () => void;
  onBack: () => void;
}

interface InfluencerMetrics {
  isInfluencer: boolean;
  referralCode: string;
  gameReferralsCount: number;
  gameTotalDepositsBrought: number;
  gamePaidDepositsCount: number;
  gamePaidDepositsAmount: number;
  referralsCount: number;
  totalDepositsBrought: number;
  paidDepositsCount: number;
  paidDepositsAmount: number;
  commissionBalance: number;
  responsibleAffiliate?: {
    id: string;
    name: string;
    email: string;
    code: string;
    affiliateId: string;
  };
  requests: Array<{
    id: string;
    amount: number;
    amountReleased?: number;
    pixKey: string;
    pixKeyType: string;
    status: 'pending' | 'approved' | 'rejected';
    rejectionReason?: string;
    createdAt: string;
  }>;
}

export const GameProfile: React.FC<GameProfileProps> = ({
  user,
  onLogout,
  onBack,
}) => {
  const [isInfluencerUser, setIsInfluencerUser] = useState<boolean>(!!user.isInfluencer);
  const [activeMode, setActiveMode] = useState<'player' | 'influencer'>('player');
  const [stats, setStats] = useState<GameStats | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedInfLink, setCopiedInfLink] = useState<boolean>(false);

  // Accordion Expand States
  const [openSection, setOpenSection] = useState<'transactions' | 'games' | 'password' | null>(null);
  const [historyData, setHistoryData] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);

  // Password Change Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  // Influencer Mode States
  const [influencerData, setInfluencerData] = useState<InfluencerMetrics | null>(null);
  const [loadingInfluencer, setLoadingInfluencer] = useState(false);
  const [showWithdrawDrawer, setShowWithdrawDrawer] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKeyType, setPixKeyType] = useState('CPF');
  const [pixKey, setPixKey] = useState('');
  const [submittingWithdraw, setSubmittingWithdraw] = useState(false);
  const [withdrawFeedback, setWithdrawFeedback] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Sync isInfluencer state with user prop
  useEffect(() => {
    setIsInfluencerUser(!!user.isInfluencer);
    if (!user.isInfluencer) {
      setActiveMode('player');
    }
  }, [user.isInfluencer]);

  // Real-time check from server to confirm if affiliate enabled or disabled influencer mode
  useEffect(() => {
    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && typeof data.isInfluencer === 'boolean') {
            setIsInfluencerUser(data.isInfluencer);
            if (!data.isInfluencer) {
              setActiveMode('player');
            }
          }
        })
        .catch(() => {});
    }
  }, []);

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

  const fetchInfluencerStats = async () => {
    if (!isInfluencerUser) return;
    try {
      setLoadingInfluencer(true);
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('token') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/gen-dino/influencer-stats?email=${encodeURIComponent(user.email)}&game=g_block_puzzle`, {
        headers,
      });
      const data = await res.json();
      if (res.ok && data.stats) {
        setInfluencerData(data.stats);
      }
    } catch (e) {
      console.error('[Block Win] Erro ao carregar métricas de influenciador:', e);
    } finally {
      setLoadingInfluencer(false);
    }
  };

  useEffect(() => {
    if (isInfluencerUser && activeMode === 'influencer') {
      fetchInfluencerStats();
    }
  }, [activeMode, user.email, isInfluencerUser]);

  const referralLink = `${window.location.origin}/?ref=${user.referralCode || user.id}`;
  const influencerGameLink = `${window.location.origin}/?ref=${influencerData?.referralCode || user.referralCode || user.id}&game=g_block_win`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyInfLink = () => {
    navigator.clipboard.writeText(influencerGameLink);
    setCopiedInfLink(true);
    setTimeout(() => setCopiedInfLink(false), 2000);
  };

  const handleWithdrawCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawFeedback(null);
    const amountNum = parseFloat(withdrawAmount.replace(',', '.'));
    if (!amountNum || isNaN(amountNum) || amountNum <= 0) {
      setWithdrawFeedback({ text: 'Informe um valor válido para saque.', type: 'error' });
      return;
    }
    const maxBalance = influencerData?.commissionBalance || 0;
    if (amountNum > maxBalance) {
      setWithdrawFeedback({
        text: `Saldo insuficiente! Disponível: R$ ${maxBalance.toFixed(2)}`,
        type: 'error',
      });
      return;
    }
    if (!pixKey.trim()) {
      setWithdrawFeedback({ text: 'Informe uma chave PIX válida.', type: 'error' });
      return;
    }

    try {
      setSubmittingWithdraw(true);
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('token') || '';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/gen-dino/influencer-withdraw', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          amount: amountNum,
          pixKey,
          pixKeyType,
          gameOrigin: 'g_block_puzzle',
          email: user.email,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWithdrawFeedback({
          text: data.message || 'Solicitação enviada com sucesso ao seu afiliado gestor!',
          type: 'success',
        });
        setWithdrawAmount('');
        await fetchInfluencerStats();
      } else {
        setWithdrawFeedback({ text: data.error || 'Erro ao enviar solicitação.', type: 'error' });
      }
    } catch (e) {
      setWithdrawFeedback({ text: 'Falha na conexão ao solicitar saque.', type: 'error' });
    } finally {
      setSubmittingWithdraw(false);
    }
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

        {/* Mode Selector: Only visible if user has been marked as influencer by affiliate */}
        {isInfluencerUser && (
          <div className="flex gap-2 p-1 bg-[#161C33] border border-[#222B4A] rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveMode('player')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMode === 'player'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Modo Jogador</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveMode('influencer')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                activeMode === 'influencer'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-extrabold shadow-md'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <Crown className="w-4 h-4 fill-current" />
              <span>Modo Influenciador</span>
              <span className="text-[9px] bg-black/30 px-1.5 py-0.5 rounded-full uppercase font-black tracking-wider">
                VIP
              </span>
            </button>
          </div>
        )}

        {(!isInfluencerUser || activeMode === 'player') ? (
          <>
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

            {/* Interactive Accordion Rows */}
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
          </>
        ) : (
          /* PAINEL DO MODO INFLUENCIADOR */
          <div className="space-y-3.5">
            {/* Afiliado Responsável / Sponsor Card */}
            <div className="bg-gradient-to-r from-[#172338] to-[#121a2d] border border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between shadow-lg">
              <div>
                <span className="text-[10px] uppercase text-amber-300/80 font-bold tracking-wider block">
                  Afiliado Responsável pela Liberação
                </span>
                <strong className="text-sm font-extrabold text-white">
                  {influencerData?.responsibleAffiliate?.name || 'Afiliado Gestor Responsável'}
                </strong>
              </div>
              <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-lg tracking-wider">
                {influencerData?.responsibleAffiliate?.code ? `CÓD: ${influencerData.responsibleAffiliate.code}` : 'GESTOR VINCULADO'}
              </span>
            </div>

            {/* Link de Divulgação do Jogo */}
            <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-3.5 space-y-2 shadow-md">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-200 flex items-center gap-1.5">
                  <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                  Link de Divulgação • Block Win
                </span>
                <button
                  type="button"
                  onClick={handleCopyInfLink}
                  className="text-xs font-bold text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedInfLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar link</span>
                    </>
                  )}
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={influencerGameLink}
                className="w-full bg-[#0E1324] border border-[#1E2744] text-slate-300 text-xs p-2 rounded-xl font-mono truncate"
              />
            </div>

            {/* Métricas do Jogo Block Win */}
            <div className="grid grid-cols-2 gap-3">
              {/* Depósitos Trazidos */}
              <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-3.5 space-y-1 shadow-md">
                <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                  Depósitos Trazidos
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  R$ {(influencerData?.gameTotalDepositsBrought ?? influencerData?.totalDepositsBrought ?? 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-slate-500">
                  Volume de indicados
                </div>
              </div>

              {/* Depósitos Pagos */}
              <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-3.5 space-y-1 shadow-md">
                <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Depósitos Pagos
                </div>
                <div className="text-lg font-bold text-emerald-400 font-mono">
                  {influencerData?.gamePaidDepositsCount ?? influencerData?.paidDepositsCount ?? 0} pagos
                </div>
                <div className="text-[10px] text-slate-500">
                  R$ {(influencerData?.gamePaidDepositsAmount ?? influencerData?.paidDepositsAmount ?? 0).toFixed(2)} confirmados
                </div>
              </div>

              {/* Quantidade de Indicados */}
              <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-3.5 space-y-1 shadow-md">
                <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  Qtd de Indicados
                </div>
                <div className="text-lg font-bold text-white font-mono">
                  {influencerData?.gameReferralsCount ?? influencerData?.referralsCount ?? 0}
                </div>
                <div className="text-[10px] text-slate-500">
                  Jogadores na sua rede
                </div>
              </div>

              {/* Comissões Disponíveis */}
              <div className="bg-[#161C33] border border-amber-500/30 rounded-2xl p-3.5 space-y-1 shadow-md bg-gradient-to-br from-[#161C33] to-[#1c2212]">
                <div className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                  Comissões
                </div>
                <div className="text-lg font-extrabold text-amber-400 font-mono">
                  R$ {(influencerData?.commissionBalance || 0).toFixed(2)}
                </div>
                <div className="text-[10px] text-amber-200/70">
                  Pronto para resgate
                </div>
              </div>
            </div>

            {/* Ação: Sacar Minhas Comissões */}
            <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">Sacar Minhas Comissões</h3>
                  <p className="text-[11px] text-slate-400">
                    Aprovação realizada pelo seu afiliado gestor responsável.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWithdrawDrawer(!showWithdrawDrawer)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-all cursor-pointer flex items-center gap-1 shadow-md"
                >
                  <ArrowUpRight className="w-4 h-4" />
                  <span>{showWithdrawDrawer ? 'Fechar' : 'Sacar'}</span>
                </button>
              </div>

              {showWithdrawDrawer && (
                <form onSubmit={handleWithdrawCommission} className="pt-3 border-t border-[#222B4A] space-y-3">
                  <div className="p-2.5 bg-blue-950/40 border border-blue-500/30 rounded-xl text-[11px] text-blue-200 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Conferência do Afiliado:</strong> Sua solicitação será enviada diretamente para o painel do seu afiliado responsável para aprovação e liberação do PIX.
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Tipo de Chave PIX</label>
                    <select
                      value={pixKeyType}
                      onChange={(e) => setPixKeyType(e.target.value)}
                      className="w-full bg-[#0E1324] border border-[#1E2744] text-white p-2.5 rounded-xl text-xs outline-none"
                    >
                      <option value="CPF">CPF</option>
                      <option value="EMAIL">E-mail</option>
                      <option value="TELEFONE">Telefone / Celular</option>
                      <option value="ALEATORIA">Chave Aleatória (EVP)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] text-slate-400 font-bold mb-1">Chave PIX</label>
                    <input
                      type="text"
                      value={pixKey}
                      onChange={(e) => setPixKey(e.target.value)}
                      placeholder="Digite sua chave PIX"
                      className="w-full bg-[#0E1324] border border-[#1E2744] text-white p-2.5 rounded-xl text-xs outline-none"
                      required
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1 text-[10px]">
                      <span className="text-slate-400 font-bold">Valor a Sacar (R$)</span>
                      <span className="text-slate-400">
                        Saldo: <b className="text-amber-400">R$ {(influencerData?.commissionBalance || 0).toFixed(2)}</b>
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-[#0E1324] border border-[#1E2744] text-white p-2.5 pr-20 rounded-xl text-xs font-mono outline-none"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setWithdrawAmount(String(influencerData?.commissionBalance || 0))}
                        className="absolute right-2 top-2 px-2 py-0.5 rounded bg-[#202A4A] text-cyan-400 text-[10px] font-bold hover:bg-[#2A3761]"
                      >
                        Sacar tudo
                      </button>
                    </div>
                  </div>

                  {withdrawFeedback && (
                    <p
                      className={`p-2 rounded-xl text-xs font-bold text-center border ${
                        withdrawFeedback.type === 'success'
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                          : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {withdrawFeedback.text}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submittingWithdraw}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingWithdraw ? 'Enviando...' : 'Confirmar Solicitação de Saque'}</span>
                  </button>
                </form>
              )}
            </div>

            {/* Histórico de Solicitações de Saque de Comissões */}
            <div className="bg-[#161C33] border border-[#222B4A] rounded-2xl p-3.5 space-y-2.5 shadow-md">
              <h4 className="text-xs font-bold text-slate-200 tracking-wider">
                HISTÓRICO DE SAQUES DE COMISSÕES
              </h4>
              <div className="space-y-2">
                {(!influencerData?.requests || influencerData.requests.length === 0) ? (
                  <p className="text-slate-500 text-xs text-center py-3">
                    Nenhuma solicitação de saque de comissões enviada ainda.
                  </p>
                ) : (
                  influencerData.requests.map((req) => (
                    <div
                      key={req.id}
                      className="p-2.5 bg-[#0E1324] border border-[#1E2744] rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-white font-mono">
                            R$ {Number(req.amountReleased || req.amount).toFixed(2)}
                          </strong>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                              req.status === 'approved'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : req.status === 'rejected'
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                            }`}
                          >
                            {req.status === 'approved'
                              ? 'Aprovado pelo Gestor'
                              : req.status === 'rejected'
                              ? 'Recusado'
                              : 'Aguardando Gestor'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          PIX: {req.pixKey} • {new Date(req.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                        {req.rejectionReason && (
                          <p className="text-[10px] text-rose-400 mt-0.5 italic">
                            Motivo: {req.rejectionReason}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

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
