import React from 'react';
import {
  Users,
  Trophy,
  Activity,
  Shuffle,
  Grid,
  BarChart3,
  Share2,
  Calculator,
  Megaphone,
  QrCode,
  X,
  ChevronRight,
  TrendingUp,
  Percent
} from 'lucide-react';

export type PartnerTabType = 'affiliates' | 'dashboards' | 'ranking' | 'realtime' | 'diversion' | 'reports' | 'recruiting' | 'simulator';

interface PartnerMobileTabBarProps {
  activeTab: PartnerTabType;
  onSelectTab: (tab: PartnerTabType) => void;
  affiliatesCount?: number;
  pixDiversionActive?: boolean;
  onOpenBroadcast?: () => void;
  onOpenInviteModal?: () => void;
  moreDrawerOpen: boolean;
  setMoreDrawerOpen: (open: boolean) => void;
}

export const PartnerMobileTabBar: React.FC<PartnerMobileTabBarProps> = ({
  activeTab,
  onSelectTab,
  affiliatesCount = 0,
  pixDiversionActive = false,
  onOpenBroadcast,
  onOpenInviteModal,
  moreDrawerOpen,
  setMoreDrawerOpen
}) => {
  const isMoreTabActive = activeTab === 'realtime' || activeTab === 'reports' || activeTab === 'recruiting' || activeTab === 'simulator';

  const getMoreTabLabel = () => {
    if (activeTab === 'realtime') return 'Ao Vivo';
    if (activeTab === 'reports') return 'Comissões';
    if (activeTab === 'recruiting') return 'Kit';
    if (activeTab === 'simulator') return 'Simulador';
    return 'Mais';
  };

  return (
    <>
      {/* Bottom Sheet / Drawer for "Mais" Options */}
      {moreDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex flex-col justify-end transition-opacity duration-200">
          <div
            className="fixed inset-0"
            onClick={() => setMoreDrawerOpen(false)}
            aria-hidden="true"
          />

          <div className="relative bg-white rounded-t-3xl border-t border-zinc-200 shadow-2xl p-4 pb-8 space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Grab Handle */}
            <div className="w-10 h-1 bg-zinc-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between px-1">
              <div>
                <h3 className="text-sm font-black text-zinc-900 tracking-tight">Recursos do Parceiro</h3>
                <p className="text-[11px] text-zinc-500">Ferramentas de análise, kit e projeção</p>
              </div>
              <button
                type="button"
                onClick={() => setMoreDrawerOpen(false)}
                className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 flex items-center justify-center cursor-pointer transition active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Grid of extra tools */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Radar Ao Vivo */}
              <button
                type="button"
                onClick={() => {
                  onSelectTab('realtime');
                  setMoreDrawerOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer active:scale-95 ${
                  activeTab === 'realtime'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100 text-zinc-800'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-2">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-bold block">Radar Ao Vivo</strong>
                  <span className="text-[10px] text-zinc-500">Fluxo em tempo real</span>
                </div>
              </button>

              {/* Kit de Recrutamento */}
              <button
                type="button"
                onClick={() => {
                  onSelectTab('recruiting');
                  setMoreDrawerOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer active:scale-95 ${
                  activeTab === 'recruiting'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100 text-zinc-800'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center mb-2">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-bold block">Kit Recrutamento</strong>
                  <span className="text-[10px] text-zinc-500">Scripts & links prontos</span>
                </div>
              </button>

              {/* Simulador de Metas */}
              <button
                type="button"
                onClick={() => {
                  onSelectTab('simulator');
                  setMoreDrawerOpen(false);
                }}
                className={`p-3 rounded-2xl border text-left flex flex-col justify-between transition cursor-pointer active:scale-95 ${
                  activeTab === 'simulator'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-zinc-50/70 border-zinc-200 hover:bg-zinc-100 text-zinc-800'
                }`}
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <strong className="text-xs font-bold block">Simulador</strong>
                  <span className="text-[10px] text-zinc-500">Projeção de comissões</span>
                </div>
              </button>

              {/* Convidar Afiliados / QR Code */}
              {onOpenInviteModal && (
                <button
                  type="button"
                  onClick={() => {
                    setMoreDrawerOpen(false);
                    onOpenInviteModal();
                  }}
                  className="p-3 rounded-2xl border border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100 text-zinc-800 text-left flex flex-col justify-between transition cursor-pointer active:scale-95"
                >
                  <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center mb-2">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <strong className="text-xs font-bold block">QR Code Convite</strong>
                    <span className="text-[10px] text-zinc-500">Baixar flyer e código</span>
                  </div>
                </button>
              )}
            </div>

            {/* Quick Broadcast action button */}
            {onOpenBroadcast && (
              <button
                type="button"
                onClick={() => {
                  setMoreDrawerOpen(false);
                  onOpenBroadcast();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center justify-between cursor-pointer transition active:scale-98"
              >
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-amber-400" />
                  <span>Transmissão para a Rede</span>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Floating Bottom Tab Bar for Mobile */}
      <nav
        aria-label="Navegação móvel do parceiro"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-zinc-200 px-3 py-1.5 flex items-center justify-around select-none"
        style={{ paddingBottom: 'max(0.375rem, env(safe-area-inset-bottom))' }}
      >
        {/* Tab 1: Afiliados */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('affiliates');
            setMoreDrawerOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 min-w-[56px] ${
            activeTab === 'affiliates'
              ? 'text-emerald-700 font-bold'
              : 'text-zinc-500 hover:text-zinc-800 font-medium'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5" />
            {affiliatesCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-1 rounded-full bg-emerald-600 text-white text-[8px] font-black flex items-center justify-center leading-none">
                {affiliatesCount > 99 ? '99+' : affiliatesCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Afiliados</span>
        </button>

        {/* Tab 2: Dashboards & Gráficos */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('dashboards');
            setMoreDrawerOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 min-w-[56px] ${
            activeTab === 'dashboards'
              ? 'text-emerald-700 font-bold'
              : 'text-zinc-500 hover:text-zinc-800 font-medium'
          }`}
        >
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px]">Dashboard</span>
        </button>

        {/* Tab 3: Ranking */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('ranking');
            setMoreDrawerOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 min-w-[56px] ${
            activeTab === 'ranking'
              ? 'text-emerald-700 font-bold'
              : 'text-zinc-500 hover:text-zinc-800 font-medium'
          }`}
        >
          <Trophy className="w-5 h-5" />
          <span className="text-[10px]">Ranking</span>
        </button>

        {/* Tab 4: Desvio PIX */}
        <button
          type="button"
          onClick={() => {
            onSelectTab('diversion');
            setMoreDrawerOpen(false);
          }}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 min-w-[56px] ${
            activeTab === 'diversion'
              ? 'text-emerald-700 font-bold'
              : 'text-zinc-500 hover:text-zinc-800 font-medium'
          }`}
        >
          <div className="relative">
            <Shuffle className="w-5 h-5" />
            {pixDiversionActive && (
              <span className="absolute -top-1 -right-2 px-1 rounded-full bg-amber-500 text-white text-[8px] font-black leading-tight">
                ON
              </span>
            )}
          </div>
          <span className="text-[10px]">Desvio</span>
        </button>

        {/* Tab 5: Mais (Menu) */}
        <button
          type="button"
          onClick={() => setMoreDrawerOpen(!moreDrawerOpen)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2.5 rounded-xl transition cursor-pointer active:scale-95 min-w-[56px] ${
            isMoreTabActive || moreDrawerOpen
              ? 'text-emerald-700 font-bold'
              : 'text-zinc-500 hover:text-zinc-800 font-medium'
          }`}
        >
          <div className="relative">
            <Grid className="w-5 h-5" />
            {isMoreTabActive && (
              <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-600" />
            )}
          </div>
          <span className="text-[10px]">{getMoreTabLabel()}</span>
        </button>
      </nav>
    </>
  );
};
