import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { User, Transaction, Game, AffiliateInfo } from './types';
import { Header } from './components/Header';
import { BottomNavigation, TabType } from './components/BottomNavigation';
import { HomeView } from './components/HomeView';
import { FinanceView } from './components/FinanceView';
import { GamesView } from './components/GamesView';
import { MoreView } from './components/MoreView';
import { AffiliatesView } from './components/AffiliatesView';
import { MembersAreaView } from './components/MembersAreaView';
import { CampaignsView } from './components/CampaignsView';
import { PartnerPanelView } from './components/partner/PartnerPanelView';
import { PartnerRequestView } from './components/partner/PartnerRequestView';
import { LoginView } from './components/LoginView';
import { RegisterView } from './components/RegisterView';
import { DepositModal } from './components/DepositModal';
import { WithdrawModal } from './components/WithdrawModal';
import { TermsModal } from './components/TermsModal';
import { ProfileModal } from './components/ProfileModal';
import { GatewaySettingsModal } from './components/GatewaySettingsModal';
import { PixKeysModal } from './components/PixKeysModal';
import { BannerModal } from './components/BannerModal';
import { Toast, ToastType } from './components/Toast';
import { trackDepositInitiated, trackDepositSuccess, trackRegistration } from './lib/tracking';
import {
  getTrackedGame,
  getGameTrackingPayload,
  setTrackedGame,
  normalizeGameId,
} from './lib/gameTracking';
import {
  registerServiceWorker,
  subscribeToWebPush,
  triggerSaleNotification,
  triggerNewAffiliateNotification,
  getNotificationState,
  playSaleSound,
} from './lib/pwaNotification';
import { applyGameSEO } from './lib/seo';
import { Loader2, Gamepad2, ShieldCheck, ExternalLink, Wallet, Activity, Layers3 } from 'lucide-react';
import logoImg from './components/logo.webp';
import { GAME_ASSETS, publicAsset } from './config/gameAssets';

const AdminPanel = lazy(() => import('./components/AdminPanel').then((module) => ({ default: module.AdminPanel })));
const BlockPuzzleApp = lazy(() => import('./game/BlockPuzzleApp').then((module) => ({ default: module.BlockPuzzleApp })));
const LazyScreen = () => <div className="min-h-screen bg-white grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-zinc-800" /></div>;

type AppContext = 'alliance-hub' | 'blockwin' | 'zumbla' | 'gen-dino' | 'raspa-fortuna' | 'subwaypay';

const detectAppContext = (): AppContext => {
  const host = window.location.hostname.toLowerCase();
  const search = window.location.search.toLowerCase();
  const site = new URLSearchParams(window.location.search).get('site')?.toLowerCase().replaceAll('_', '-');
  const pathname = window.location.pathname.toLowerCase();

  if (host.includes('goalliancehub')) return 'alliance-hub';
  if (
    host.includes('joguesubway') || host.includes('subwaypay') || host.includes('subway') ||
    site === 'subway' || site === 'subwaypay' || site === 'subway-pay' || site === 'joguesubway' ||
    search.includes('site=subway') || search.includes('game=subway') || search.includes('site=joguesubway') ||
    pathname.startsWith('/subway') ||
    host.includes('zumblapay') || host.includes('zumbla') ||
    site === 'zumbla' || site === 'zumbla-win' || site === 'zumblapay' ||
    search.includes('site=zumbla') || search.includes('game=zumbla') || search.includes('site=zumblapay') ||
    pathname.startsWith('/zumbla')
  ) return 'subwaypay';
  if (
    host.includes('raspadinhaadasorte') || host.includes('raspadinha') || host.includes('raspafortuna') ||
    site === 'raspa-fortuna' || site === 'raspafortuna' || site === 'raspa' || site === 'raspadinha' || site === 'raspadinhaadasorte' ||
    search.includes('site=raspa') || search.includes('game=raspa') || search.includes('site=raspadinha') || search.includes('game=raspadinha') ||
    pathname.startsWith('/raspa') || pathname.startsWith('/raspadinha')
  ) return 'raspa-fortuna';
  if (
    site === 'gen-dino' || site === 'gendino' || site === 'dino' || site === 'dinopay' || site === 'dinoplay' || site === 'dinipay' ||
    host.includes('dinopay') || host.includes('dinoplay') || host.includes('dinipay') || host.includes('gendino') ||
    search.includes('site=dino') || search.includes('site=dinopay') || search.includes('site=dinoplay') || search.includes('site=gendino') || search.includes('site=gen-dino') ||
    search.includes('game=dino') || search.includes('game=dinopay') || search.includes('game=dinoplay') || search.includes('game=gendino') || search.includes('game=gen-dino') ||
    pathname.startsWith('/dinopay') || pathname.startsWith('/dinoplay') || pathname.startsWith('/dino') || pathname.startsWith('/gendino') || pathname.startsWith('/gen-dino') ||
    pathname.includes('gen-dino') || pathname.includes('/dino')
  ) return 'gen-dino';
  if (
    site === 'blockwin' || site === 'block-win' || host.includes('blockwinner') || host.includes('blockwinn.fun') || host.includes('blockwin') ||
    search.includes('site=blockwin') || search.includes('game=blockwin') || pathname.startsWith('/blockwin')
  ) return 'blockwin';
  return 'alliance-hub';
};

const gameTrackingId = (context: AppContext) => context === 'zumbla' ? 'g_zumbla' : context === 'gen-dino' ? 'g_gen_dino' : context === 'raspa-fortuna' ? 'g_raspa_fortuna' : context === 'subwaypay' ? 'g_subway_pay' : context === 'blockwin' ? 'g_block_puzzle' : 'platform';

const resolveAcquisitionGame = (context: AppContext): string => {
  const searchParams = new URLSearchParams(window.location.search);
  const rawParam = searchParams.get('game') || searchParams.get('site') || searchParams.get('g') || searchParams.get('gameId');
  const normalized = normalizeGameId(rawParam);
  if (normalized && normalized !== 'alliance_hub') return normalized;

  if (context !== 'alliance-hub') {
    return gameTrackingId(context);
  }

  // Strictly preserve Alliance Hub context when in the hub/affiliate panel
  return 'alliance-hub';
};

const DirectGameFrame: React.FC<{ context: 'zumbla' | 'gen-dino' | 'raspa-fortuna' | 'subwaypay' }> = ({ context }) => {
  const [depositOpen, setDepositOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  useEffect(() => {
    const gid = gameTrackingId(context);
    setTrackedGame(gid, `direct_frame_${context}`);
    applyGameSEO(context);
  }, [context]);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  const [targetSrc] = useState<string>(() => {
    const base =
      context === 'zumbla'
        ? GAME_ASSETS.zumbla.app
        : context === 'gen-dino'
          ? GAME_ASSETS.genDino.app
          : context === 'subwaypay'
            ? GAME_ASSETS.subwayPay.app
            : GAME_ASSETS.raspaFortuna.app;
    const target = new URL(base, window.location.href);
    const incoming = new URLSearchParams(window.location.search);
    const ref = incoming.get('ref') || incoming.get('refCode') || incoming.get('r');
    if (ref) target.searchParams.set('ref', ref.trim().toUpperCase());
    target.searchParams.set('game', gameTrackingId(context));
    target.searchParams.set('sourceDomain', window.location.hostname.toLowerCase());
    target.searchParams.set('embedded', '1');
    const token = typeof window !== 'undefined' ? (localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || '') : '';
    if (token) target.searchParams.set('token', token);
    return target.toString();
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const sendTokenToGame = () => {
    try {
      const t = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || '';
      if (t && iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
          source: 'tribopay-parent',
          event: 'session',
          token: t,
        }, '*');
      }
    } catch (_) {}
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data) return;
      if (event.data.event === 'ready') {
        sendTokenToGame();
      }
      if (event.data.event === 'auth' && event.data.token) {
        try {
          localStorage.setItem('pg_auth_token', event.data.token);
          localStorage.setItem('paygateway_token', event.data.token);
          localStorage.setItem('token', event.data.token);
          if (event.data.user) {
            localStorage.setItem('user', JSON.stringify(event.data.user));
          }
        } catch (_) {}
      }
      if (event.data.event === 'deposit' || event.data.action === 'deposit' || event.data.type === 'deposit') {
        setDepositOpen(true);
      }
      if (event.data.event === 'toast' && event.data.message) {
        showToast(String(event.data.message), event.data.type || 'info');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [context]);

  const handleConfirmDeposit = async (amount: number) => {
    playSaleSound();
    showToast(`Depósito de R$ ${amount.toFixed(2)} gerado com sucesso!`, 'success');
  };

  return (
    <>
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={3000}
          onClose={() => setToast(null)}
        />
      )}
      <iframe
        ref={iframeRef}
        src={targetSrc}
        onLoad={sendTokenToGame}
        title={context === 'zumbla' ? 'Zumbla Win' : context === 'gen-dino' ? 'GEN DINO' : 'Raspa Fortuna'}
        className="fixed inset-0 h-[100dvh] w-full border-0 bg-black"
        allow="autoplay; fullscreen; clipboard-write"
      />
      <DepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        onConfirmDeposit={handleConfirmDeposit}
        loading={false}
        gameId={gameTrackingId(context)}
      />
    </>
  );
};

export default function App() {
  const [appContext, setAppContext] = useState<AppContext>(() => detectAppContext());
  const isGameSite = appContext !== 'alliance-hub';

  // Auth State
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const urlParams = new URLSearchParams(window.location.search);
    const fromUrl = urlParams.get('token') || urlParams.get('t') || urlParams.get('auth');
    if (fromUrl) {
      try {
        localStorage.setItem('pg_auth_token', fromUrl);
        localStorage.setItem('paygateway_token', fromUrl);
        localStorage.setItem('token', fromUrl);
      } catch (_) {}
      return fromUrl;
    }
    return (
      localStorage.getItem('pg_auth_token') ||
      localStorage.getItem('paygateway_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('token') ||
      sessionStorage.getItem('pg_auth_token') ||
      null
    );
  });
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [initialRefCode, setInitialRefCode] = useState<string>('');

  // Real-time tracking of known transactions for affiliate sale notifications
  const knownTxIdsRef = useRef<Set<string> | null>(null);
  const knownIndicationsCountRef = useRef<number | null>(null);
  const knownCommissionIdsRef = useRef<Set<string> | null>(null);

  // Main App State
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [subView, setSubView] = useState<'main' | 'affiliates' | 'members' | 'campaigns' | 'partner'>('main');
  const [gamesResetKey, setGamesResetKey] = useState<number>(0);

  // Data State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [affiliateInfo, setAffiliateInfo] = useState<AffiliateInfo | null>(null);

  // Modals & Overlay State
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const [bannerOpen, setBannerOpen] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [depositGameId, setDepositGameId] = useState('platform');
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [gatewaySettingsOpen, setGatewaySettingsOpen] = useState(false);
  const [pixKeyModalOpen, setPixKeyModalOpen] = useState(false);
  const [pixKeyModalInitialView, setPixKeyModalInitialView] = useState<'list' | 'add'>('add');

  // Action Loading
  const [actionLoading, setActionLoading] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type });
  };

  const isUserAdmin = (u: User | null | undefined): boolean => {
    if (!u) return false;
    const cleanEmail = (u.email || '').toLowerCase().trim();
    const isSuperAdminEmail = cleanEmail === 'admin.eduh@gmail.com' || cleanEmail === 'tribopayeduh@gmail.com';
    return u.role === 'admin' || u.role === 'superadmin' || isSuperAdminEmail;
  };

  const handleOpenAdmin = () => {
    if (!user) {
      showToast('Usuário bloqueado para essa ação. Faça login com uma conta administradora.', 'error');
      return;
    }
    if (!isUserAdmin(user)) {
      showToast('Usuário bloqueado para essa ação.', 'error');
      setAdminPanelOpen(false);
      return;
    }
    setAdminPanelOpen(true);
  };

  // 1. Initialize Service Worker & Detect Route / Referral URL Parameter on initial load
  useEffect(() => {
    registerServiceWorker();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if ('Notification' in window && Notification.permission === 'granted') {
          subscribeToWebPush(reg).catch(console.error);
        }
      }).catch(console.error);
    }

    const pathname = window.location.pathname.toLowerCase();
    const hostname = window.location.hostname.toLowerCase();
    const isPartnerContext =
      hostname.includes('parceiro') ||
      pathname.startsWith('/parceiro') ||
      pathname.startsWith('/p/');

    if (appContext !== 'alliance-hub') {
      applyGameSEO(appContext);
    } else {
      const targetAcquisitionGame = resolveAcquisitionGame(appContext);
      if (
        targetAcquisitionGame &&
        targetAcquisitionGame !== 'alliance-hub' &&
        targetAcquisitionGame !== 'alliance_hub' &&
        targetAcquisitionGame !== 'platform'
      ) {
        applyGameSEO(targetAcquisitionGame);
      } else {
        applyGameSEO(isPartnerContext ? 'partner' : 'alliance-hub');
      }
    }

    const params = new URLSearchParams(window.location.search);

    // Support clean short links: /p/:code, /parceiro/:code, /partner/:code, /r/:code
    let pathCode: string | null = null;
    const shortMatch = window.location.pathname.match(/^\/(?:p|parceiro|partner|r)\/([a-zA-Z0-9_-]+)/i);
    if (shortMatch && shortMatch[1]) {
      pathCode = shortMatch[1].toUpperCase().trim();
    }

    const partnerParam = params.get('p') || params.get('partner') || params.get('partnerCode');
    const refParam = params.get('ref') || params.get('refCode') || params.get('r');
    const isPartnerReferral = Boolean(
      (pathCode && !window.location.pathname.startsWith('/r/')) ||
      partnerParam ||
      params.get('source') === 'partner'
    );

    const activeCode = pathCode || partnerParam || refParam;
    
    if (activeCode) {
      const cleanRef = activeCode.toUpperCase().trim();
      setInitialRefCode(cleanRef);
      try {
        localStorage.setItem('alliance_ref_code', cleanRef);
        sessionStorage.setItem('alliance_ref_code', cleanRef);
        if (isPartnerReferral) {
          localStorage.setItem('alliance_partner_code', cleanRef);
          sessionStorage.setItem('alliance_partner_code', cleanRef);
          localStorage.setItem('alliance_partner_source', 'partner');
        }
        localStorage.setItem('alliance_origin_game', resolveAcquisitionGame(appContext));
        localStorage.setItem('alliance_origin_domain', window.location.hostname.toLowerCase());
      } catch (e) {}
    } else {
      try {
        const stored = localStorage.getItem('alliance_ref_code') || sessionStorage.getItem('alliance_ref_code');
        if (stored) {
          setInitialRefCode(stored);
        }
      } catch (e) {}
    }

    const isPartnerDomain = window.location.hostname.toLowerCase().includes('parceiro');
    const isPartnerPath = pathname === '/parceiro' || pathname === '/parceiros';
    if ((isPartnerDomain && !pathCode && !partnerParam) || isPartnerPath) {
      setActiveTab('more');
      setSubView('partner');
    }

    if (pathname.includes('/cadastro') || pathname.includes('/register') || activeCode) {
      setAuthView('register');
    } else if (pathname.includes('/login')) {
      setAuthView('login');
    }

    const handleNavEvent = (e: Event) => {
      const custom = e as CustomEvent<{ tab: TabType; subView?: 'main' | 'affiliates' | 'members' | 'campaigns' | 'partner' }>;
      if (custom.detail?.tab) {
        setActiveTab(custom.detail.tab);
      }
      if (custom.detail?.subView) {
        setSubView(custom.detail.subView);
      }
    };
    const handleWindowMsg = (e: MessageEvent) => {
      if (!e.data) return;
      if (e.data.type === 'navigate-tab' && e.data.tab) {
        setActiveTab(e.data.tab);
      }
    };
    window.addEventListener('app-navigate-tab', handleNavEvent);
    window.addEventListener('message', handleWindowMsg);
    return () => {
      window.removeEventListener('app-navigate-tab', handleNavEvent);
      window.removeEventListener('message', handleWindowMsg);
    };
  }, [appContext]);

  // Ensure Alliance Hub / Partner SEO remains strictly active when navigating panel tabs
  useEffect(() => {
    if (appContext === 'alliance-hub' && activeTab !== 'games') {
      const isPartnerRoute =
        window.location.hostname.toLowerCase().includes('parceiro') ||
        window.location.pathname.startsWith('/parceiro') ||
        window.location.pathname.startsWith('/p/') ||
        (activeTab === 'more' && subView === 'partner');
      applyGameSEO(isPartnerRoute ? 'partner' : 'alliance-hub');
    }
  }, [activeTab, subView, appContext]);

  // 2. Fetch User Data on mount or token change
  useEffect(() => {
    const initAuth = async () => {
      if (!token) {
        setUser(null);
        knownTxIdsRef.current = null;
        knownIndicationsCountRef.current = null;
        knownCommissionIdsRef.current = null;
        setAuthLoading(false);

        const search = window.location.search.toLowerCase();
        if (search.includes('admin=true')) {
          setAdminPanelOpen(false);
          showToast('Usuário bloqueado para essa ação. Faça login com uma conta administradora.', 'error');
          try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('admin')) {
              url.searchParams.delete('admin');
              window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
            }
          } catch {}
        }
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const userData = await res.json();

          setUser(userData);
          if ('Notification' in window && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then(subscribeToWebPush).catch(console.error);
          }
          fetchOverview(token);
          fetchGames(token);
          fetchAffiliateInfo(token);

          const host = window.location.hostname.toLowerCase();
          const search = window.location.search.toLowerCase();
          const wantsAdmin = host.includes('admin.goalliancehub.com') || search.includes('admin=true');
          if (wantsAdmin) {
            if (isUserAdmin(userData)) {
              setAdminPanelOpen(true);
            } else {
              setAdminPanelOpen(false);
              showToast('Usuário bloqueado para essa ação.', 'error');
              try {
                const url = new URL(window.location.href);
                if (url.searchParams.has('admin')) {
                  url.searchParams.delete('admin');
                  window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
                }
              } catch {}
            }
          }
        } else {
          // Invalid token
          localStorage.removeItem('pg_auth_token');
          localStorage.removeItem('paygateway_token');
          localStorage.removeItem('token');
          try {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('pg_auth_token');
          } catch (_) {}
          setToken(null);
          setUser(null);
          knownTxIdsRef.current = null;
          knownCommissionIdsRef.current = null;
        }
      } catch (e) {
        console.error('Auth error', e);
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();
  }, [token]);

  // Real-time Polling Interval for instant balance, transactions and affiliate sales updates
  useEffect(() => {
    if (!token) {
      knownTxIdsRef.current = null;
      knownCommissionIdsRef.current = null;
      return;
    }

    // Never poll platform affiliate/finance data if user is in a direct full-screen game context
    if (appContext === 'gen-dino' || appContext === 'zumbla') {
      return;
    }

    let isMounted = true;
    let inFlightOverview = false;
    let inFlightAffiliate = false;

    const poll = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!isMounted) return;

      if (!inFlightOverview) {
        inFlightOverview = true;
        fetchOverview(token).finally(() => { inFlightOverview = false; });
      }

      if (!inFlightAffiliate) {
        inFlightAffiliate = true;
        fetchAffiliateInfo(token).finally(() => { inFlightAffiliate = false; });
      }
    };

    const pollInterval = setInterval(poll, 7000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [token, appContext]);

  // Fetch Finance Data (with Real-Time Affiliate Sale Detection & PWA Notification)
  const fetchOverview = async (authToken: string) => {
    try {
      const res = await fetch('/api/finance/overview', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const newTxs: Transaction[] = data.transactions || [];

        if (knownTxIdsRef.current === null) {
          // Initial population of transaction IDs
          knownTxIdsRef.current = new Set(newTxs.map((t) => t.id));
        } else {
          // Check for new incoming sales, commissions or deposits
          for (const tx of newTxs) {
            if (!knownTxIdsRef.current.has(tx.id)) {
              knownTxIdsRef.current.add(tx.id);

              const isDepositOrSale =
                tx.type === 'deposit' ||
                tx.paymentMethod === 'Afiliados' ||
                tx.description?.toLowerCase().includes('comissão') ||
                tx.description?.toLowerCase().includes('indicação') ||
                tx.description?.toLowerCase().includes('depósito') ||
                tx.amount > 0;

              if (isDepositOrSale) {
                const formattedAmount = tx.amount.toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                });

                // Always play venda.mp3 sound instantly
                playSaleSound();

                // Trigger PWA background/foreground sale notification
                triggerSaleNotification({
                  amount: tx.amount,
                  customTitle: 'Nova Venda na sua rede!',
                  customSubtitle: `Comissão de R$ ${formattedAmount} adicionada ao saldo!`,
                });
              }
            }
          }
        }

        setUser((prev) => {
          if (!prev) return null;
          const nextMin = data.minWithdraw !== undefined ? data.minWithdraw : prev.minWithdraw;
          const nextFee = data.withdrawFee !== undefined ? data.withdrawFee : prev.withdrawFee;
          if (prev.balance === data.balance && prev.minWithdraw === nextMin && prev.withdrawFee === nextFee) {
            return prev;
          }
          return {
            ...prev,
            balance: data.balance,
            minWithdraw: nextMin,
            withdrawFee: nextFee
          };
        });
        setTransactions(newTxs);
      }
    } catch (_e) {
      // Graceful catch: suppress transient fetch failures during page transitions
    }
  };

  // Fetch Games List
  const fetchGames = async (authToken: string) => {
    try {
      const res = await fetch('/api/games', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGames(data);
      }
    } catch (_e) {
      // Graceful catch
    }
  };

  // Fetch Affiliate Info (with Real-Time New Registration Detection & PWA Notification)
  const fetchAffiliateInfo = async (authToken: string) => {
    try {
      const res = await fetch('/api/affiliates/info', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const currentCount = data.indicationsCount || 0;
        const commissions = Array.isArray(data.commissions) ? data.commissions : [];

        if (knownIndicationsCountRef.current === null) {
          knownIndicationsCountRef.current = currentCount;
        } else if (currentCount > knownIndicationsCountRef.current) {
          knownIndicationsCountRef.current = currentCount;

          const state = getNotificationState();
          if (state.newAffiliateEnabled) {
            triggerNewAffiliateNotification();
          }
        }

        if (knownCommissionIdsRef.current === null) {
          knownCommissionIdsRef.current = new Set(commissions.map((commission: any) => commission.id));
        } else {
          for (const commission of commissions) {
            if (!knownCommissionIdsRef.current.has(commission.id)) {
              knownCommissionIdsRef.current.add(commission.id);
              playSaleSound();
              triggerSaleNotification({
                amount: Number(commission.amount || 0),
                customTitle: 'Nova comissão recebida!',
                customSubtitle: `${commission.buyerName || 'Um indicado'} gerou comissão em ${commission.gameName || 'sua rede'}.`,
              });
            }
          }
        }

        setAffiliateInfo(data);
      }
    } catch (_e) {
      // Graceful catch: suppress transient fetch failures
    }
  };

  const refreshData = async () => {
    if (token) {
      fetchOverview(token);
      fetchAffiliateInfo(token);
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch {}
    }
  };

  // Automatically refresh user authorization and partner status when accessing partner view
  useEffect(() => {
    if (subView === 'partner' && token) {
      refreshData();
    }
  }, [subView, token]);

  // AUTH ACTIONS
  const handleLogin = async (email: string, pass: string) => {
    setAuthError(null);
    setActionLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass, isGameSite, acquisitionGame: resolveAcquisitionGame(appContext) }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao efetuar login.');
      }

      localStorage.setItem('pg_auth_token', data.token);
      localStorage.setItem('paygateway_token', data.token);
      localStorage.setItem('token', data.token);
      try {
        sessionStorage.setItem('token', data.token);
        sessionStorage.setItem('pg_auth_token', data.token);
      } catch (_) {}
      setToken(data.token);
      setUser(data.user);
      showToast('Bem-vindo de volta!', 'success');

      const host = window.location.hostname.toLowerCase();
      const search = window.location.search.toLowerCase();
      const wantsAdmin = host.includes('admin.goalliancehub.com') || search.includes('admin=true');
      if (wantsAdmin) {
        if (isUserAdmin(data.user)) {
          setAdminPanelOpen(true);
        } else {
          setAdminPanelOpen(false);
          showToast('Usuário bloqueado para essa ação.', 'error');
          try {
            const url = new URL(window.location.href);
            if (url.searchParams.has('admin')) {
              url.searchParams.delete('admin');
              window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRegister = async (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    refCode?: string;
  }) => {
    setAuthError(null);
    setActionLoading(true);
    try {
      const tracking = getGameTrackingPayload();
      const resolvedGame = resolveAcquisitionGame(appContext) || tracking.registeredGame || 'g_block_puzzle';
      const storedPartnerCode =
        sessionStorage.getItem('alliance_partner_code') ||
        localStorage.getItem('alliance_partner_code') ||
        new URLSearchParams(window.location.search).get('p') ||
        new URLSearchParams(window.location.search).get('partner') ||
        undefined;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Game-Origin': resolvedGame,
          'X-Game-Id': resolvedGame
        },
        body: JSON.stringify({
          ...data,
          refCode: data.refCode || storedPartnerCode,
          partnerCode: storedPartnerCode,
          partner: storedPartnerCode,
          p: storedPartnerCode,
          isAffiliate: !isGameSite, // Registers as affiliate when on goalliancehub.com portal
          acquisitionGame: resolvedGame,
          registeredGame: resolvedGame,
          game: resolvedGame,
          gameId: resolvedGame,
          trackingSource: tracking.trackingSource,
          acquisitionDomain: window.location.hostname.toLowerCase(),
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || 'Falha ao cadastrar conta.');
      }

      localStorage.setItem('pg_auth_token', resData.token);
      localStorage.setItem('paygateway_token', resData.token);
      localStorage.setItem('token', resData.token);
      try {
        sessionStorage.setItem('token', resData.token);
        sessionStorage.setItem('pg_auth_token', resData.token);
      } catch (_) {}
      setToken(resData.token);
      setUser(resData.user);
      showToast('Conta criada com sucesso!', 'success');

      if (!isGameSite) {
        setPixKeyModalInitialView('add');
        setPixKeyModalOpen(true);
      }
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Keep push subscription synchronized with authenticated user
  useEffect(() => {
    if (token && 'serviceWorker' in navigator && 'Notification' in window && Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then((reg) => {
        subscribeToWebPush(reg).catch(console.error);
      }).catch(console.error);
    }
  }, [token, user]);

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (e) {
        console.error('Logout error', e);
      }
    }
    localStorage.removeItem('pg_auth_token');
    localStorage.removeItem('paygateway_token');
    localStorage.removeItem('token');
    try {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('pg_auth_token');
    } catch (_) {}
    setToken(null);
    setUser(null);
    knownTxIdsRef.current = null;
    knownIndicationsCountRef.current = null;
    knownCommissionIdsRef.current = null;
    setActiveTab('home');
    setSubView('main');
    showToast('Sessão encerrada com sucesso.', 'info');
  };

  // FINANCIAL ACTIONS
  const handleConfirmDeposit = async (amount: number) => {
    if (!token) return;
    setActionLoading(true);
    try {
      // Re-fetch user profile to sync updated balance
      const meRes = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          setUser(meData.user);
        }
      }

      playSaleSound();
      fetchOverview(token);
      fetchAffiliateInfo(token);
      showToast(`Depósito de R$ ${amount.toFixed(2)} aprovado!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao atualizar dados.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmWithdraw = async (amount: number, pixKeyId: string) => {
    if (!token) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount, pixKeyId }),
      });

      const data = await res.json();
      if (!res.ok) {
        let msg = data.error || data.message || 'Erro ao processar saque.';
        const lower = msg.toLowerCase();
        if ((lower.includes('saldo insuficiente') && (lower.includes('dotfy') || lower.includes('gateway'))) || lower.includes('dotfy gateway')) {
          msg = 'Os saques estão em manutenção temporária. Tente novamente em 30 minutos. Seu saldo na plataforma permanece intacto.';
        }
        throw new Error(msg);
      }

      if (typeof data.balance === 'number') {
        setUser((prev) => (prev ? { ...prev, balance: data.balance } : null));
      }
      fetchOverview(token);
      showToast(data.message || `Solicitação de saque de R$ ${amount.toFixed(2)} enviada com sucesso!`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Erro ao realizar saque.', 'error');
      throw err;
    } finally {
      setActionLoading(false);
    }
  };

  // Render Independent Game Site if explicitly in game site mode
  if (appContext === 'blockwin') {
    return (
      <Suspense fallback={<LazyScreen />}>
        <BlockPuzzleApp
          onReturnToPortal={() => {
            setAppContext('alliance-hub');
            setActiveTab('home');
          }}
        />
      </Suspense>
    );
  }

  if (appContext === 'zumbla' || appContext === 'gen-dino' || appContext === 'raspa-fortuna' || appContext === 'subwaypay') {
    return <DirectGameFrame context={appContext} />;
  }

  // Render Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <img src={logoImg} alt="Logo" className="h-10 max-w-[160px] object-contain mx-auto animate-pulse" />
          <Loader2 className="w-5 h-5 text-zinc-900 animate-spin mx-auto" />
          <p className="text-xs text-zinc-400 font-mono">Carregando...</p>
        </div>
      </div>
    );
  }

  // Render Unauthenticated Flow (Login / Register)
  if (!user) {
    return (
      <div className="auth-app-background min-h-screen bg-zinc-900/5 flex flex-col items-center justify-center">
        <div className="auth-app-shell w-full bg-white min-h-screen border border-zinc-200/80 shadow-2xl overflow-hidden relative">
          {toast && (
            <Toast
              message={toast.message}
              type={toast.type}
              duration={3000}
              onClose={() => setToast(null)}
            />
          )}

          {authView === 'login' ? (
            <LoginView
              onLogin={handleLogin}
              onNavigateToRegister={() => setAuthView('register')}
              onForgotPassword={() =>
                showToast('Instruções de recuperação foram enviadas.', 'info')
              }
              loading={actionLoading}
              error={authError}
            />
          ) : (
            <RegisterView
              onRegister={handleRegister}
              onNavigateToLogin={() => setAuthView('login')}
              onOpenTerms={() => setTermsOpen(true)}
              loading={actionLoading}
              error={authError}
              initialRefCode={initialRefCode}
            />
          )}

          <TermsModal isOpen={termsOpen} onClose={() => setTermsOpen(false)} />
        </div>
      </div>
    );
  }

  // Render Authenticated Mobile Container
  return (
    <div className="min-h-screen bg-zinc-900/5 sm:py-6 flex items-center justify-center">
      {/* Responsive Shell Frame: clean mobile-first that smoothly expands for tablet & desktop */}
      <div className="alliance-app-shell w-full max-w-md md:max-w-3xl lg:max-w-[1400px] xl:max-w-[1440px] bg-white min-h-screen sm:min-h-[820px] border border-zinc-200/90 shadow-2xl relative overflow-hidden flex flex-col justify-between transition-[max-width,border-radius] duration-300 sm:rounded-3xl lg:rounded-[28px]">
        {/* Toast */}
        {toast && (
          <Toast message={toast.message} type={toast.type} duration={3000} onClose={() => setToast(null)} />
        )}

        {/* Header */}
        <Header
          user={{ ...user, balance: user.balance + Number(affiliateInfo?.affiliateBalance || 0) }}
          onProfileClick={() => setProfileOpen(true)}
          onOpenSettings={() => setGatewaySettingsOpen(true)}
          onOpenAdmin={handleOpenAdmin}
        />

        {/* Scrollable Main Content Area */}
        <main className="alliance-main-content flex-1 overflow-y-auto no-scrollbar">
          {!(activeTab === 'more' && subView === 'campaigns') && (
            <section className="desktop-context-strip" aria-label="Resumo da seção atual">
              <div><span>ÁREA ATUAL</span><strong>{activeTab === 'home' ? 'Visão geral' : activeTab === 'finance' ? 'Financeiro' : activeTab === 'games' ? 'Central de jogos' : subView === 'affiliates' ? 'Programa de afiliados' : 'Conta e configurações'}</strong></div>
              <div><i><Wallet/></i><span>Saldo total<strong>R$ {(user.balance + Number(affiliateInfo?.affiliateBalance || 0)).toLocaleString('pt-BR', { minimumFractionDigits:2 })}</strong></span></div>
              <div><i><Activity/></i><span>Movimentações<strong>{transactions.length}</strong></span></div>
              <div><i><Layers3/></i><span>Jogos disponíveis<strong>{games.length || 3}</strong></span></div>
              <div className="desktop-live-pill"><span/> Sistema atualizado</div>
            </section>
          )}
          <div key={`${activeTab}-${subView}`} className="alliance-section-transition">
          {activeTab === 'home' && (
            <HomeView
              user={user}
              transactions={transactions}
              affiliateInfo={affiliateInfo}
              onDeposit={() => { setDepositGameId('platform'); setDepositOpen(true); }}
              onWithdraw={() => setWithdrawOpen(true)}
              onNavigateToFinance={() => setActiveTab('finance')}
            />
          )}

          {activeTab === 'finance' && (
            <FinanceView
              user={user}
              transactions={transactions}
              affiliateInfo={affiliateInfo}
              onDeposit={() => { setDepositGameId('platform'); setDepositOpen(true); }}
              onWithdraw={() => setWithdrawOpen(true)}
              onRefresh={refreshData}
              onShowToast={showToast}
            />
          )}

          {activeTab === 'games' && (
            <GamesView
              key={gamesResetKey}
              games={games}
              user={user}
              affiliateInfo={affiliateInfo}
              onShowToast={showToast}
              onDeposit={(gameId) => { setDepositGameId(gameId || 'platform'); setDepositOpen(true); }}
              onWithdraw={() => setWithdrawOpen(true)}
              onPlayGame={(betAmount) => {
                showToast(`Partida iniciada com entrada de R$ ${betAmount.toFixed(2)}!`, 'success');
                setAppContext('blockwin');
              }}
              onBalanceChange={(balance) => {
                setUser((current) => {
                  if (!current || current.balance === balance) return current;
                  return { ...current, balance };
                });
              }}
              onOpenReferral={() => {
                setActiveTab('more');
                setSubView('affiliates');
              }}
              onOpenProfile={() => setProfileOpen(true)}
            />
          )}

          {activeTab === 'more' && (
            <>
              {subView === 'campaigns' ? (
                <CampaignsView
                  onBack={() => setSubView('main')}
                  onShowToast={showToast}
                />
              ) : subView === 'affiliates' ? (
                <AffiliatesView
                  affiliateInfo={affiliateInfo}
                  currentUser={user}
                  onBack={() => setSubView('main')}
                  onCopySuccess={() => showToast('Link de indicação copiado!', 'success')}
                  onShowToast={showToast}
                  onOpenSettings={() => setGatewaySettingsOpen(true)}
                  onOpenPartnerPanel={((user.isPartner && user.partnerApproved) || isUserAdmin(user)) ? () => {
                    setSubView('partner');
                    try {
                      if (!window.location.pathname.startsWith('/parceiro')) {
                        window.history.pushState({}, '', '/parceiros');
                      }
                    } catch (e) {}
                  } : undefined}
                  onRefresh={() => {
                    if (token) fetchAffiliateInfo(token);
                  }}
                />
              ) : subView === 'partner' ? (
                (user.isPartner && user.partnerApproved) || isUserAdmin(user) ? (
                  <PartnerPanelView
                    user={user}
                    token={token}
                    onBackToHub={() => {
                      setSubView('main');
                      try {
                        if (window.location.pathname.startsWith('/parceiro')) {
                          window.history.pushState({}, '', '/');
                        }
                      } catch (e) {}
                    }}
                    onShowToast={showToast}
                  />
                ) : (
                  <div className="p-8 text-center text-zinc-500 max-w-md mx-auto">
                    <p className="font-semibold text-zinc-700">Acesso Restrito</p>
                    <p className="text-xs mt-1">O Painel de Parceiro é restrito a parceiros homologados pela administração.</p>
                    <button
                      onClick={() => {
                        setSubView('main');
                        try {
                          if (window.location.pathname.startsWith('/parceiro')) {
                            window.history.pushState({}, '', '/');
                          }
                        } catch (e) {}
                      }}
                      className="mt-4 px-4 py-2 bg-zinc-900 text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      Voltar ao Início
                    </button>
                  </div>
                )
              ) : subView === 'members' ? (
                <MembersAreaView onBack={() => setSubView('main')} />
              ) : (
                <MoreView
                  user={user}
                  onOpenProfile={() => setProfileOpen(true)}
                  onOpenAffiliates={() => {
                    setSubView('affiliates');
                    if (token) fetchAffiliateInfo(token);
                  }}
                  onOpenPartnerPanel={((user.isPartner && user.partnerApproved) || isUserAdmin(user)) ? () => {
                    setSubView('partner');
                    try {
                      if (!window.location.pathname.startsWith('/parceiro')) {
                        window.history.pushState({}, '', '/parceiros');
                      }
                    } catch (e) {}
                  } : undefined}
                  onOpenMembers={() => setSubView('members')}
                  onOpenCampaigns={() => setSubView('campaigns')}
                  onOpenSettings={() => setGatewaySettingsOpen(true)}
                  onOpenPixKeys={() => {
                    setPixKeyModalInitialView('list');
                    setPixKeyModalOpen(true);
                  }}
                  onOpenTerms={() => setTermsOpen(true)}
                  onOpenPrivacy={() => setTermsOpen(true)}
                  onLogout={handleLogout}
                  onOpenAdmin={handleOpenAdmin}
                />
              )}
            </>
          )}
          </div>
        </main>

        {/* Bottom Navigation */}
        <BottomNavigation
          activeTab={activeTab}
          desktopExpanded={true}
          onChangeTab={(tab) => {
            if (tab === 'games') {
              setGamesResetKey((prev) => prev + 1);
            }
            setActiveTab(tab);
            setSubView('main');
          }}
        />

        {/* Interactive Modals */}
        <DepositModal
          isOpen={depositOpen}
          onClose={() => setDepositOpen(false)}
          onConfirmDeposit={handleConfirmDeposit}
          loading={actionLoading}
          gameId={depositGameId}
        />

        <WithdrawModal
          isOpen={withdrawOpen}
          onClose={() => setWithdrawOpen(false)}
          onConfirmWithdraw={handleConfirmWithdraw}
          userBalance={user?.balance ?? 0}
          affiliateBalance={Number(affiliateInfo?.affiliateBalance || 0)}
          minWithdraw={user?.minWithdraw}
          withdrawFee={user?.withdrawFee}
          loading={actionLoading}
          token={token}
          userPixKey={user?.pixKey}
          userPixKeys={user?.pixKeys}
          onOpenAddPixKey={() => {
            setPixKeyModalInitialView('add');
            setPixKeyModalOpen(true);
          }}
        />

        <ProfileModal
          user={user}
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          currentGameId={gameTrackingId(appContext)}
          onShowToast={showToast}
        />

        <TermsModal isOpen={termsOpen} onClose={() => setTermsOpen(false)} />

        <GatewaySettingsModal
          isOpen={gatewaySettingsOpen}
          onClose={() => setGatewaySettingsOpen(false)}
          onShowToast={showToast}
        />

        <PixKeysModal
          isOpen={pixKeyModalOpen}
          onClose={() => setPixKeyModalOpen(false)}
          token={token}
          userName={user?.name}
          initialView={pixKeyModalInitialView}
          onSuccess={(msg, pixKeyData) => {
            showToast(msg, 'success');
            if (user && pixKeyData) {
              setUser({ ...user, pixKey: pixKeyData });
            }
          }}
        />

        <BannerModal
          isOpen={bannerOpen}
          onClose={() => setBannerOpen(false)}
          onAction={() => {
            if (!user) {
              setAuthView('register');
            } else {
              setDepositOpen(true);
            }
          }}
        />

        {adminPanelOpen && user && (
          <Suspense fallback={<LazyScreen />}>
            <AdminPanel
              currentUser={user}
              token={token}
              onClose={() => setAdminPanelOpen(false)}
              onShowToast={(msg, type) => showToast(msg, type)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
