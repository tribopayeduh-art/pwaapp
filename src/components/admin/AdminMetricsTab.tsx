import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Users,
  Wallet,
  ArrowUpRight,
  CreditCard,
  Percent,
  ChevronRight,
  Clock,
  Sparkles,
  ArrowDownLeft,
  Activity,
  CheckCircle2,
  AlertCircle,
  Radio,
  Gamepad2,
  Zap
} from 'lucide-react';
import { AdminMetrics, AdminTabId, LivePlayerSession } from './adminTypes';
import { IOSCard, IOSStatCard, IOSBadge, IOSButton } from './IOSComponents';

interface AdminMetricsTabProps {
  metrics: AdminMetrics | null;
  loading: boolean;
  onNavigateTab: (tab: AdminTabId) => void;
  token?: string | null;
}

export const AdminMetricsTab: React.FC<AdminMetricsTabProps> = ({
  metrics,
  loading,
  onNavigateTab,
  token
}) => {
  const [liveSessions, setLiveSessions] = useState<LivePlayerSession[]>([]);
  const [liveActiveCount, setLiveActiveCount] = useState<number>(0);
  const [liveVolume, setLiveVolume] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchLiveOverview = async () => {
      try {
        const authToken =
          token ||
          (typeof window !== 'undefined'
            ? localStorage.getItem('pg_auth_token') ||
              localStorage.getItem('paygateway_token') ||
              localStorage.getItem('token') ||
              localStorage.getItem('auth_token')
            : '');
        const headers: Record<string, string> = {};
        if (authToken) {
          headers['Authorization'] = `Bearer ${authToken}`;
        }

        const res = await fetch('/api/admin/live-players', { headers });
        if (res.ok) {
          const json = await res.json();
          if (isMounted && json) {
            setLiveSessions(json.activeSessions || []);
            setLiveActiveCount(json.activePlayersCount || 0);
            setLiveVolume(json.totalVolumeInPlay || 0);
          }
        }
      } catch (e) {
        // silent fallback
      }
    };

    fetchLiveOverview();
    const interval = setInterval(fetchLiveOverview, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [token]);
  const netProfit = metrics?.netProfit ?? 0;
  const marginPercent = metrics?.profitMarginPercent ?? 0;
  const totalDeposits = metrics?.totalDepositsAmount ?? 0;
  const gameGgr = metrics?.gameGgr ?? 0;
  const affiliateBalance = metrics?.totalAffiliateBalance ?? 0;
  const affiliateCommissionsPaid = metrics?.totalAffiliateCommissionsPaid ?? 0;
  const todaySales = metrics?.todaySalesAmount ?? 0;
  const todaySalesPercent = metrics?.todaySalesPercentChange ?? 0;
  const newUsers = metrics?.totalUsers ?? 0;
  const newUsersToday = metrics?.newUsersToday ?? 0;
  const totalUserBalance = metrics?.totalBalance ?? 0;
  const approvedWithdrawals = metrics?.approvedWithdrawalsAmount ?? 0;
  const pendingWithdrawalsAmount = metrics?.pendingWithdrawalsAmount ?? 0;
  const pendingWithdrawalsCount = metrics?.pendingWithdrawalsCount ?? 0;

  const chart = metrics?.chartData || [];
  const chartCeiling = Math.max(1, ...chart.map(day => Math.max(day.deposits, day.withdrawals)));
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 bg-white p-4 sm:p-5" aria-label="Fluxo financeiro dos últimos sete dias">
        <div className="flex items-baseline justify-between gap-3 mb-5">
          <div><h2 className="text-base font-semibold text-zinc-900">Fluxo financeiro</h2><p className="text-xs text-zinc-500">Depósitos e saques · últimos 7 dias</p></div>
          <div className="flex gap-3 text-xs text-zinc-600"><span>● Entradas</span><span className="text-zinc-400">● Saídas</span></div>
        </div>
        {chart.length ? <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-36">
          {chart.map(day => <div key={day.date} className="flex h-full flex-col items-center justify-end gap-2 min-w-0" title={`${day.date}: entradas R$ ${day.deposits.toFixed(2)}, saídas R$ ${day.withdrawals.toFixed(2)}`}>
            <div className="w-full flex items-end justify-center gap-1 h-28 border-b border-zinc-200">
              <div className="w-3 sm:w-5 rounded-t bg-zinc-800" style={{height:`${Math.max(day.deposits ? 3 : 0,day.deposits/chartCeiling*100)}%`}} />
              <div className="w-3 sm:w-5 rounded-t bg-zinc-400" style={{height:`${Math.max(day.withdrawals ? 3 : 0,day.withdrawals/chartCeiling*100)}%`}} />
            </div><span className="text-[10px] text-zinc-500 truncate max-w-full">{day.date.slice(5)}</span>
          </div>)}
        </div> : <p className="text-sm text-zinc-500">Sem dados no período.</p>}
      </section>
      {/* 1. HERO SUMMARY SECTION: Apple Card Inspired Financial Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Lucro Líquido & Margem Geral */}
        <div className="lg:col-span-2 bg-[#1C1C1E] text-white p-6 rounded-3xl shadow-lg relative overflow-hidden flex flex-col justify-between space-y-4">
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#007AFF]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/20 text-[#0A84FF] flex items-center justify-center font-bold">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold tracking-widest text-[#0A84FF] uppercase block">
                  Visão Consolidada
                </span>
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Lucro Líquido & Margem Geral
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-white/[0.08] px-3.5 py-1.5 rounded-full border border-white/[0.06]">
              <span className="text-xs font-semibold text-[#30D158]">
                Margem: {marginPercent.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="space-y-1">
              <span className="text-[11px] text-white/60 font-medium block">Lucro Líquido Retido</span>
              <div className="text-2xl font-bold tracking-tight text-[#30D158]">
                R$ {netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-white/40 font-medium">(Depósitos + GGR) - Saques</p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-white/60 font-medium block">Entradas Totais (PIX)</span>
              <div className="text-2xl font-bold tracking-tight text-white">
                R$ {totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-white/40 font-medium">{metrics?.totalDepositsCount ?? 0} depósitos concluídos</p>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-white/60 font-medium block">Retenção GGR de Jogos</span>
              <div className="text-2xl font-bold tracking-tight text-[#0A84FF]">
                R$ {gameGgr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[10px] text-white/40 font-medium">Margem do motor de iGaming</p>
            </div>
          </div>

          {/* Efficiency Bar */}
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-white/70">
              <span>Eficiência Operacional do Sistema</span>
              <span className="text-[#30D158]">Alta Estabilidade</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden flex">
              <div className="bg-[#30D158] h-full" style={{ width: `${Math.min(100, Math.max(10, marginPercent))}%` }} />
              <div className="bg-[#FF9F0A] h-full" style={{ width: '8%' }} />
              <div className="bg-[#0A84FF] h-full flex-1" />
            </div>
          </div>
        </div>

        {/* Card 2: Mapeamento de Afiliados */}
        <IOSCard className="p-6 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-black/[0.04] pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#AF52DE]/12 text-[#AF52DE] flex items-center justify-center font-bold">
                <Percent className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-slate-900">Rede de Afiliados</h3>
            </div>
            <IOSBadge variant="purple">Ativa</IOSBadge>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
                Disponível para Saque
              </span>
              <div className="text-2xl font-bold tracking-tight text-slate-900">
                R$ {affiliateBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-slate-500 font-medium">Comissões acumuladas na carteira dos afiliados</p>
            </div>

            <div className="pt-2 border-t border-black/[0.04]">
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                <span>Comissões Pagas:</span>
                <span className="text-[#007AFF]">
                  R$ {affiliateCommissionsPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('users')}
            className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
          >
            <span>Gerenciar Afiliados & Saldos</span>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>
        </IOSCard>
      </div>

      {/* 2. REAL-TIME LIVE PLAYERS RADAR WIDGET */}
      <IOSCard className="p-5 sm:p-6 bg-gradient-to-br from-emerald-950/90 via-slate-900 to-black text-white border-emerald-500/20 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <Radio className="w-5 h-5 animate-pulse" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-ping" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Jogadores em Campo em Tempo Real
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  AO VIVO
                </span>
              </div>
              <p className="text-xs text-white/60 font-medium">
                Partidas ativas nos jogos Block Win, GEN DINO, Zumbla e Raspadinha
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-white/50">Volume Ativo em Jogo</div>
              <div className="text-sm font-extrabold text-emerald-400">
                R$ {liveVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('live')}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-md active:scale-[0.98]"
            >
              <span>Abrir Monitoramento Completo</span>
              <ChevronRight className="w-4 h-4 text-slate-950" />
            </button>
          </div>
        </div>

        {/* Live sessions mini preview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          {liveSessions.slice(0, 4).map((sess) => (
            <div
              key={sess.id}
              className="p-3.5 rounded-2xl bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.08] transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-white truncate max-w-[110px]">
                  {sess.userName}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <Zap className="w-2.5 h-2.5 fill-emerald-300" />
                  {sess.multiplier.toFixed(2)}x
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span className="truncate">{sess.gameName}</span>
                <span className="font-semibold text-white">
                  R$ {sess.betAmount.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/[0.06]">
                <span className="truncate">{sess.lastAction || 'Em jogo'}</span>
                <span className="text-emerald-400 font-bold">
                  +R$ {sess.potentialPayout.toFixed(2)}
                </span>
              </div>
            </div>
          ))}

          {liveSessions.length === 0 && (
            <div className="col-span-full py-4 text-center text-xs text-white/50">
              Sincronizando partidas ao vivo dos jogos...
            </div>
          )}
        </div>
      </IOSCard>

      {/* 3. 4 KEY KPI STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <IOSStatCard
          title="Vendas Diárias (Hoje)"
          value={`R$ ${todaySales.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle={`${todaySalesPercent >= 0 ? '+' : ''}${todaySalesPercent.toFixed(1)}% vs ontem`}
          isPositive={todaySalesPercent >= 0}
          icon={TrendingUp}
          iconBgColor="bg-[#34C759]"
          sparkline={
            <svg className="w-full h-7 text-[#34C759]" viewBox="0 0 100 25" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M0 20 Q 20 8, 40 16 T 70 6 T 100 10" strokeLinecap="round" />
            </svg>
          }
        />

        <IOSStatCard
          title="Novos Usuários"
          value={newUsers}
          subtitle={`+${newUsersToday} novos cadastros hoje`}
          isPositive={true}
          icon={Users}
          iconBgColor="bg-[#007AFF]"
          sparkline={
            <svg className="w-full h-7 text-[#007AFF]" viewBox="0 0 100 25" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M0 20 Q 15 10, 30 18 T 60 12 T 90 15 T 100 8" strokeLinecap="round" />
            </svg>
          }
        />

        <IOSStatCard
          title="Passivo em Carteiras"
          value={`R$ ${totalUserBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Saldo total de usuários em custódia"
          icon={Wallet}
          iconBgColor="bg-[#5856D6]"
          sparkline={
            <svg className="w-full h-7 text-[#5856D6]" viewBox="0 0 100 25" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M0 15 Q 30 22, 50 12 T 80 18 T 100 10" strokeLinecap="round" />
            </svg>
          }
        />

        <IOSStatCard
          title="GGR dos Jogos"
          value={`R$ ${gameGgr.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          subtitle="Lucro bruto retido nos 3 jogos"
          isPositive={true}
          icon={Activity}
          iconBgColor="bg-[#FF2D55]"
          sparkline={
            <svg className="w-full h-7 text-[#FF2D55]" viewBox="0 0 100 25" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M0 22 Q 25 14, 50 18 T 75 8 T 100 14" strokeLinecap="round" />
            </svg>
          }
        />
      </div>

      {/* 3. CASHFLOW & LIQUIDITY RECONCILIATION */}
      <IOSCard className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/[0.04] pb-3">
          <div>
            <h3 className="font-bold text-base text-slate-900 tracking-tight">
              Conciliação de Liquidez PIX
            </h3>
            <p className="text-xs text-slate-400 font-medium">
              Acompanhamento de entradas e saques processados em tempo real
            </p>
          </div>
          {pendingWithdrawalsCount > 0 && (
            <button
              type="button"
              onClick={() => onNavigateTab('withdrawals')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FF9500]/12 text-[#B36B00] font-bold text-xs hover:bg-[#FF9500]/20 transition-all cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{pendingWithdrawalsCount} saques aguardando análise</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-[#34C759]/8 border border-[#34C759]/15 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#248A3D] block">
              Depósitos Concluídos
            </span>
            <div className="text-xl font-bold text-slate-900">
              R$ {totalDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Entradas confirmadas via PIX</p>
          </div>

          <div className="p-4 rounded-xl bg-[#007AFF]/8 border border-[#007AFF]/15 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#0062CC] block">
              Saques Aprovados
            </span>
            <div className="text-xl font-bold text-slate-900">
              R$ {approvedWithdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Pagamentos PIX liquidados</p>
          </div>

          <div className="p-4 rounded-xl bg-[#FF9500]/8 border border-[#FF9500]/15 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#B36B00] block">
              Saques em Análise
            </span>
            <div className="text-xl font-bold text-slate-900">
              R$ {pendingWithdrawalsAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">{pendingWithdrawalsCount} pedidos pendentes</p>
          </div>

          <div className="p-4 rounded-xl bg-[#5856D6]/8 border border-[#5856D6]/15 space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#3634A3] block">
              Saldo Líquido em Caixa
            </span>
            <div className="text-xl font-bold text-[#34C759]">
              R$ {(totalDeposits - approvedWithdrawals).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-slate-500 font-medium">Entradas menos saques pagos</p>
          </div>
        </div>
      </IOSCard>

      {/* 4. RECENT SYSTEM ACTIVITIES INSET GROUPED LIST */}
      <IOSCard className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-black/[0.04] pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <h3 className="font-bold text-sm text-slate-900">Atividades Recentes no Ecossistema</h3>
          </div>
          <span className="text-xs text-slate-400 font-medium">Atualizado ao vivo</span>
        </div>

        {metrics?.recentActivities && metrics.recentActivities.length > 0 ? (
          <div className="divide-y divide-black/[0.04]">
            {metrics.recentActivities.slice(0, 6).map((act) => {
              const isDeposit = act.type === 'deposit';
              const isWithdrawal = act.type === 'withdrawal';
              const isUser = act.type === 'user_registered';

              return (
                <div key={act.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isDeposit
                          ? 'bg-[#34C759]/12 text-[#34C759]'
                          : isWithdrawal
                          ? 'bg-[#FF9500]/12 text-[#FF9500]'
                          : 'bg-[#007AFF]/12 text-[#007AFF]'
                      }`}
                    >
                      {isDeposit ? (
                        <ArrowDownLeft className="w-4 h-4" />
                      ) : isWithdrawal ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {act.title || act.userName}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">{act.userName}</div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    {act.amount !== undefined && act.amount !== null && (
                      <div
                        className={`text-xs font-bold ${
                          isDeposit ? 'text-[#34C759]' : isWithdrawal ? 'text-[#FF9500]' : 'text-slate-900'
                        }`}
                      >
                        {isDeposit ? '+' : isWithdrawal ? '-' : ''}R${' '}
                        {act.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                    )}
                    <span className="text-[10px] text-slate-400">{act.timeAgo || 'agora'}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-400 font-medium">
            Nenhuma atividade recente registrada nas últimas horas.
          </div>
        )}
      </IOSCard>
    </div>
  );
};
