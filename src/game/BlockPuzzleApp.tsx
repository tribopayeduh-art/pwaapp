import React, { useState, useEffect } from 'react';
import { GameUser, GameStats } from './types';
import { GameHeader } from './components/Header';
import { GameHome } from './pages/GameHome';
import { GameRegister } from './pages/GameRegister';
import { GameLogin } from './pages/GameLogin';
import { GameWelcome } from './pages/GameWelcome';
import { GameDashboard } from './pages/GameDashboard';
import { GameBoardView } from './pages/GameBoardView';
import { GameRanking } from './pages/GameRanking';
import { GameReferral } from './pages/GameReferral';
import { GameProfile } from './pages/GameProfile';
import { GameDepositModal } from './components/GameDepositModal';
import { GameWithdrawModal } from './components/GameWithdrawModal';
import { Toast } from '../components/Toast';
import { GamesView } from '../components/GamesView';

interface BlockPuzzleAppProps {
  onReturnToPortal?: () => void;
}

export const BlockPuzzleApp: React.FC<BlockPuzzleAppProps> = ({ onReturnToPortal }) => {
  const [activeTab, setActiveTab] = useState<
    'home' | 'register' | 'login' | 'welcome' | 'dashboard' | 'play' | 'ranking' | 'referral' | 'missions' | 'profile' | 'terms' | 'privacy' | 'games'
  >('home');

  const [user, setUser] = useState<GameUser | null>(null);
  const [stats, setStats] = useState<GameStats | null>(null);
  const [refCode, setRefCode] = useState<string>('');
  const [selectedBet, setSelectedBet] = useState<number>(10);

  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  const handleStartGameWithBet = (betAmount: number) => {
    setSelectedBet(betAmount);
    setActiveTab('play');
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    document.title = 'BLOCK WIN | GANHE DINHEIRO JOGANDO';
    const favicons = document.querySelectorAll("link[rel*='icon']");
    favicons.forEach((el) => {
      (el as HTMLLinkElement).href = '/faviconblock.png';
    });
  }, []);

  const handleConfirmDeposit = async (amount: number) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token');
      if (token) {
        const meRes = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.user) {
            setUser(meData.user);
          }
        }
      }
      showToast(`Depósito de R$ ${amount.toFixed(2)} aprovado!`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Erro ao realizar depósito', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmWithdraw = async (amount: number, pixKey: string) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('pg_auth_token');
      const res = await fetch('/api/finance/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, pixKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro no saque');

      setUser((prev) => (prev ? { ...prev, balance: data.balance } : null));
      showToast(`Saque de R$ ${amount.toFixed(2)} realizado via PIX!`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Erro ao realizar saque', 'error');
      throw e;
    } finally {
      setActionLoading(false);
    }
  };

  // 1. Capture referral code from URL search param (?ref=CODE) and handle path-based routing
  useEffect(() => {
    const pathname = window.location.pathname.toLowerCase();
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('refCode') || params.get('r');
    const token = localStorage.getItem('pg_auth_token');
    const isBlockDomain =
      window.location.hostname.toLowerCase().includes('blockwinner') ||
      window.location.hostname.toLowerCase().includes('blockwinn') ||
      window.location.hostname.toLowerCase().includes('blockwin');

    let capturedRef = '';
    if (ref) {
      capturedRef = ref.toUpperCase().trim();
      setRefCode(capturedRef);
      try {
        sessionStorage.setItem('bp_game_ref_code', capturedRef);
        localStorage.setItem('bp_game_ref_code', capturedRef);
        sessionStorage.setItem('alliance_ref_code', capturedRef);
        localStorage.setItem('alliance_ref_code', capturedRef);
      } catch (e) {}
    } else {
      try {
        const stored = localStorage.getItem('bp_game_ref_code') || sessionStorage.getItem('bp_game_ref_code') || localStorage.getItem('alliance_ref_code') || sessionStorage.getItem('alliance_ref_code');
        if (stored) {
          capturedRef = stored;
          setRefCode(stored);
        }
      } catch (e) {}
    }

    // Path-based route determination
    if (pathname.includes('/cadastro') || pathname.includes('/register') || ref) {
      if (!token) {
        setActiveTab('register');
        if (capturedRef) {
          showToast(`✨ Bônus de Indicação ativado para ${capturedRef}! Cadastre-se na blockwinner.site`, 'success');
        }
      }
    } else if (pathname.includes('/login') || pathname.includes('/entrar')) {
      if (!token) setActiveTab('login');
    } else if (pathname.includes('/indicar') || pathname.includes('/indicacao') || pathname.includes('/referral')) {
      setActiveTab('referral');
    } else if (pathname.includes('/jogos') || pathname.includes('/lobby') || pathname.includes('/games')) {
      setActiveTab('games');
    } else if (pathname === '/jogo' || pathname.startsWith('/jogo/') || pathname.includes('/play')) {
      setActiveTab('play');
    } else if (!token && (isBlockDomain || window.location.search.includes('mode=game'))) {
      setActiveTab('register');
    }
  }, []);

  // Sync activeTab with URL path for clean precision routing
  useEffect(() => {
    try {
      let path = '/';
      const searchParams = new URLSearchParams(window.location.search);
      if (refCode) {
        searchParams.set('ref', refCode);
      }

      if (activeTab === 'register') {
        path = '/cadastro';
      } else if (activeTab === 'login') {
        path = '/login';
        searchParams.delete('ref');
      } else if (activeTab === 'referral') {
        path = '/indicar';
      } else if (activeTab === 'games') {
        path = '/jogos';
      } else if (activeTab === 'play') {
        path = '/jogo';
      }

      const queryString = searchParams.toString();
      const fullUrl = `${path}${queryString ? `?${queryString}` : ''}`;
      window.history.replaceState({}, '', fullUrl);
    } catch (_) {}
  }, [activeTab, refCode]);

  // 2. Check stored token & authenticate user on load
  useEffect(() => {
    const token = localStorage.getItem('pg_auth_token');
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((userData) => {
          if (userData && userData.id) {
            setUser(userData);
            // If logged in and on home, go to dashboard
            if (activeTab === 'home') {
              setActiveTab('dashboard');
            }
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleRegisterSuccess = (userData: GameUser, token: string) => {
    localStorage.setItem('pg_auth_token', token);
    setUser(userData);
    showToast('Conta criada com sucesso!', 'success');
    setActiveTab('dashboard');
  };

  const handleLoginSuccess = (userData: GameUser, token: string) => {
    localStorage.setItem('pg_auth_token', token);
    setUser(userData);
    showToast(`Bem-vindo de volta, ${userData.name.split(' ')[0]}!`, 'success');
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('pg_auth_token');
    setUser(null);
    setStats(null);
    showToast('Você saiu da sua conta.', 'info');
    setActiveTab('home');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans antialiased selection:bg-cyan-500 selection:text-black">
      {/* Toast notifications */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}

      {/* View routing */}
      <main>
        {activeTab === 'home' && (
          <GameHome
            user={user}
            onNavigate={(tab) => setActiveTab(tab as any)}
            onShowToast={showToast}
            onOpenDeposit={() => setDepositOpen(true)}
            onOpenWithdraw={() => setWithdrawOpen(true)}
            onStartGame={handleStartGameWithBet}
          />
        )}

        {activeTab === 'games' && (
          <GamesView
            user={
              user
                ? {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone || '',
                    pixKey: user.pixKey || '',
                    balance: user.balance ?? 0,
                    referralCode: user.referralCode || 'BP123',
                    createdAt: new Date().toISOString(),
                  }
                : {
                    id: 'guest',
                    name: 'Visitante',
                    email: '',
                    phone: '',
                    pixKey: '',
                    balance: 0.0,
                    referralCode: 'BP123',
                    createdAt: new Date().toISOString(),
                  }
            }
            onShowToast={showToast}
            onDeposit={() => setDepositOpen(true)}
            onWithdraw={() => setWithdrawOpen(true)}
            onPlayGame={(betAmount) => handleStartGameWithBet(betAmount)}
            onOpenReferral={() => setActiveTab('referral')}
            onOpenProfile={() => (user ? setActiveTab('profile') : setActiveTab('login'))}
          />
        )}

        {activeTab === 'register' && (
          <GameRegister
            initialRefCode={refCode}
            onRegisterSuccess={handleRegisterSuccess}
            onNavigateToLogin={() => setActiveTab('login')}
            onBackToHome={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'login' && (
          <GameLogin
            onLoginSuccess={handleLoginSuccess}
            onNavigateToRegister={() => setActiveTab('register')}
            onBackToHome={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'welcome' && user && (
          <GameWelcome
            user={user}
            onPlayNow={() => setActiveTab('play')}
            onGoToDashboard={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'dashboard' && user && (
          <GameDashboard
            user={user}
            onNavigate={(tab) => setActiveTab(tab as any)}
            onShowToast={showToast}
            onOpenDeposit={() => setDepositOpen(true)}
            onOpenWithdraw={() => setWithdrawOpen(true)}
            onStartGame={handleStartGameWithBet}
          />
        )}

        {activeTab === 'play' && (
          <GameBoardView
            user={user}
            initialBet={selectedBet}
            onBackToDashboard={() => {
              const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token');
              if (token) {
                fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
                  .then((res) => (res.ok ? res.json() : null))
                  .then((userData) => {
                    if (userData && userData.id) setUser(userData);
                  })
                  .catch(() => {});
              }
              setActiveTab(user ? 'dashboard' : 'home');
            }}
            onShowToast={showToast}
            onUpdateUserBalance={(newBal) => setUser((prev) => (prev ? { ...prev, balance: newBal } : null))}
            onOpenDeposit={() => setDepositOpen(true)}
          />
        )}

        {activeTab === 'ranking' && (
          <GameRanking onBack={() => setActiveTab(user ? 'dashboard' : 'home')} />
        )}

        {(activeTab === 'referral' || activeTab === 'missions') && (
          <GameReferral
            user={user}
            onBack={() => setActiveTab(user ? 'dashboard' : 'home')}
            onShowToast={showToast}
            onOpenWithdraw={() => setWithdrawOpen(true)}
          />
        )}

        {activeTab === 'profile' && user && (
          <GameProfile
            user={user}
            onLogout={handleLogout}
            onBack={() => setActiveTab('dashboard')}
          />
        )}

        {(activeTab === 'terms' || activeTab === 'privacy') && (
          <div className="max-w-md mx-auto p-6 space-y-4">
            <h1 className="text-xl font-bold text-white font-mono uppercase">
              {activeTab === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'}
            </h1>
            <p className="text-xs text-zinc-300 leading-relaxed">
              O Block Puzzle é uma aplicação de entretenimento independente integrada ao ecossistema PayGateway. Todos os dados e estatísticas são processados com rigorosos padrões de segurança e privacidade.
            </p>
            <button
              onClick={() => setActiveTab(user ? 'dashboard' : 'home')}
              className="px-4 py-2 bg-zinc-800 text-xs font-bold text-white rounded-xl"
            >
              Voltar
            </button>
          </div>
        )}
      </main>

      {/* Financial Modals */}
      <GameDepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        onConfirmDeposit={handleConfirmDeposit}
        loading={actionLoading}
      />

      <GameWithdrawModal
        isOpen={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        onConfirmWithdraw={handleConfirmWithdraw}
        userBalance={user?.balance || 0}
        minWithdraw={user?.minWithdraw}
        loading={actionLoading}
      />
    </div>
  );
};
