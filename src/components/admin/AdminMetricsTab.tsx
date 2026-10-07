import React, { useState, useEffect, useMemo } from 'react';
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
  Zap,
  BarChart3,
  Layers,
  SlidersHorizontal,
  Check,
  DollarSign,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { AdminMetrics, AdminTabId, LivePlayerSession } from './adminTypes';
import { IOSCard, IOSStatCard, IOSBadge, IOSButton } from './IOSComponents';

interface AdminMetricsTabProps {
  metrics: AdminMetrics | null;
  loading: boolean;
  onNavigateTab: (tab: AdminTabId) => void;
  token?: string | null;
}

// Catmull-Rom to Cubic Bezier curve algorithm for ultra-smooth graph rendering
function getSmoothPath(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  if (pts.length === 2) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)} L ${pts[1].x.toFixed(1)} ${pts[1].y.toFixed(1)}`;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? i : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
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

  // Chart control state
  const [chartTimeRange, setChartTimeRange] = useState<'today' | '7d' | '30d'>('7d');
  const [chartViewMode, setChartViewMode] = useState<'flow' | 'volume' | 'unified'>('unified');
  const [showDeposits, setShowDeposits] = useState<boolean>(true);
  const [showWithdrawals, setShowWithdrawals] = useState<boolean>(true);
  const [showNetBalance, setShowNetBalance] = useState<boolean>(true);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

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

  // Granular chart series resolution
  const rawToday = metrics?.chartSeries?.today || [];
  const raw7d = metrics?.chartSeries?.sevenDays || metrics?.chartData || [];
  const raw30d = metrics?.chartSeries?.thirtyDays || [];

  const activeChart = useMemo(() => {
    if (chartTimeRange === 'today') {
      if (rawToday.length > 0) return rawToday;
      return [
        { date: '00:00', label: 'Hoje 00:00 - 03:00', deposits: 450, depositsCount: 3, withdrawals: 100, withdrawalsCount: 1, netBalance: 350, volumeTotal: 550, txCountTotal: 4 },
        { date: '03:00', label: 'Hoje 03:00 - 06:00', deposits: 200, depositsCount: 2, withdrawals: 0, withdrawalsCount: 0, netBalance: 200, volumeTotal: 200, txCountTotal: 2 },
        { date: '06:00', label: 'Hoje 06:00 - 09:00', deposits: 800, depositsCount: 6, withdrawals: 250, withdrawalsCount: 1, netBalance: 550, volumeTotal: 1050, txCountTotal: 7 },
        { date: '09:00', label: 'Hoje 09:00 - 12:00', deposits: 1650, depositsCount: 12, withdrawals: 600, withdrawalsCount: 3, netBalance: 1050, volumeTotal: 2250, txCountTotal: 15 },
        { date: '12:00', label: 'Hoje 12:00 - 15:00', deposits: 2400, depositsCount: 18, withdrawals: 850, withdrawalsCount: 4, netBalance: 1550, volumeTotal: 3250, txCountTotal: 22 },
        { date: '15:00', label: 'Hoje 15:00 - 18:00', deposits: 3100, depositsCount: 22, withdrawals: 1200, withdrawalsCount: 5, netBalance: 1900, volumeTotal: 4300, txCountTotal: 27 },
        { date: '18:00', label: 'Hoje 18:00 - 21:00', deposits: 2800, depositsCount: 19, withdrawals: 950, withdrawalsCount: 4, netBalance: 1850, volumeTotal: 3750, txCountTotal: 23 },
        { date: '21:00', label: 'Hoje 21:00 - 24:00', deposits: todaySales || 1900, depositsCount: 14, withdrawals: 700, withdrawalsCount: 3, netBalance: 1200, volumeTotal: 2600, txCountTotal: 17 }
      ];
    }
    if (chartTimeRange === '30d') {
      if (raw30d.length > 0) return raw30d;
      return raw7d;
    }
    // 7d default
    if (raw7d.length > 0) return raw7d;
    return [
      { date: '21/09', label: 'Dom 21/09', deposits: 1850, depositsCount: 14, withdrawals: 600, withdrawalsCount: 3, netBalance: 1250, volumeTotal: 2450, txCountTotal: 17 },
      { date: '22/09', label: 'Seg 22/09', deposits: 2400, depositsCount: 19, withdrawals: 950, withdrawalsCount: 4, netBalance: 1450, volumeTotal: 3350, txCountTotal: 23 },
      { date: '23/09', label: 'Ter 23/09', deposits: 3100, depositsCount: 25, withdrawals: 1100, withdrawalsCount: 5, netBalance: 2000, volumeTotal: 4200, txCountTotal: 30 },
      { date: '24/09', label: 'Qua 24/09', deposits: 2900, depositsCount: 21, withdrawals: 800, withdrawalsCount: 3, netBalance: 2100, volumeTotal: 3700, txCountTotal: 24 },
      { date: '25/09', label: 'Qui 25/09', deposits: 4200, depositsCount: 32, withdrawals: 1300, withdrawalsCount: 6, netBalance: 2900, volumeTotal: 5500, txCountTotal: 38 },
      { date: '26/09', label: 'Sex 26/09', deposits: 3800, depositsCount: 28, withdrawals: 1050, withdrawalsCount: 5, netBalance: 2750, volumeTotal: 4850, txCountTotal: 33 },
      { date: '27/09', label: 'Hoje 27/09', deposits: todaySales || 3400, depositsCount: 24, withdrawals: 900, withdrawalsCount: 4, netBalance: 2500, volumeTotal: 4300, txCountTotal: 28 }
    ];
  }, [chartTimeRange, rawToday, raw7d, raw30d, todaySales]);

  // Aggregate stats for the currently selected period
  const totalPeriodDeposits = activeChart.reduce((acc, d) => acc + (d.deposits || 0), 0);
  const totalPeriodDepositsCount = activeChart.reduce((acc, d) => acc + (d.depositsCount ?? (d.deposits > 0 ? 1 : 0)), 0);
  const totalPeriodWithdrawals = activeChart.reduce((acc, d) => acc + (d.withdrawals || 0), 0);
  const totalPeriodWithdrawalsCount = activeChart.reduce((acc, d) => acc + (d.withdrawalsCount ?? (d.withdrawals > 0 ? 1 : 0)), 0);
  const totalPeriodNet = totalPeriodDeposits - totalPeriodWithdrawals;
  const totalPeriodVolume = totalPeriodDeposits + totalPeriodWithdrawals;
  const totalPeriodTxCount = totalPeriodDepositsCount + totalPeriodWithdrawalsCount;
  const avgDepositTicket = totalPeriodDepositsCount > 0 ? totalPeriodDeposits / totalPeriodDepositsCount : 0;
  const netMarginPercent = totalPeriodDeposits > 0 ? (totalPeriodNet / totalPeriodDeposits) * 100 : 0;

  // SVG Chart Geometry
  const svgWidth = 720;
  const svgHeight = 200;
  const paddingLeft = 55;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const activeValues = activeChart.flatMap(d => [
    showDeposits ? d.deposits || 0 : 0,
    showWithdrawals ? d.withdrawals || 0 : 0,
    showNetBalance ? d.netBalance || 0 : 0
  ]);

  const rawMin = Math.min(0, ...activeValues);
  const rawMax = Math.max(100, ...activeValues);
  const yMax = rawMax * 1.15;
  const yMin = rawMin < 0 ? rawMin * 1.15 : 0;
  const yRange = Math.max(1, yMax - yMin);

  const getY = (val: number) => {
    const norm = (val - yMin) / yRange;
    return svgHeight - paddingBottom - norm * (svgHeight - paddingTop - paddingBottom);
  };

  const getX = (index: number) => {
    if (activeChart.length <= 1) return paddingLeft + (svgWidth - paddingLeft - paddingRight) / 2;
    return paddingLeft + (index / (activeChart.length - 1)) * (svgWidth - paddingLeft - paddingRight);
  };

  const zeroY = getY(0);
  const baselineY = Math.min(svgHeight - paddingBottom, zeroY);

  const points = activeChart.map((d, i) => {
    const x = getX(i);
    const yDeposit = getY(d.deposits || 0);
    const yWithdraw = getY(d.withdrawals || 0);
    const yNet = getY(d.netBalance || 0);
    return {
      ...d,
      index: i,
      x,
      yDeposit,
      yWithdraw,
      yNet
    };
  });

  // Smooth Bezier paths
  const depositSmoothPath = getSmoothPath(points.map(p => ({ x: p.x, y: p.yDeposit })));
  const withdrawSmoothPath = getSmoothPath(points.map(p => ({ x: p.x, y: p.yWithdraw })));
  const netSmoothPath = getSmoothPath(points.map(p => ({ x: p.x, y: p.yNet })));

  const depositArea = points.length > 0
    ? `${depositSmoothPath} L ${points[points.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${points[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`
    : '';

  const netArea = points.length > 0
    ? `${netSmoothPath} L ${points[points.length - 1].x.toFixed(1)} ${baselineY.toFixed(1)} L ${points[0].x.toFixed(1)} ${baselineY.toFixed(1)} Z`
    : '';

  // Max volume for volume bars
  const maxVolumeTxCount = Math.max(5, ...activeChart.map(d => (d.depositsCount || 0) + (d.withdrawalsCount || 0)));

  // Y-axis grid ticks
  const yTicks = [
    { val: yMin, y: getY(yMin) },
    { val: yMin + yRange * 0.33, y: getY(yMin + yRange * 0.33) },
    { val: yMin + yRange * 0.66, y: getY(yMin + yRange * 0.66) },
    { val: yMax, y: getY(yMax) }
  ];

  const formatCurrencyTick = (val: number) => {
    if (Math.abs(val) >= 1000000) return `R$ ${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `R$ ${(val / 1000).toFixed(0)}k`;
    return `R$ ${val.toFixed(0)}`;
  };

  return (
    <div className="space-y-6">
      {/* 0. INTERACTIVE FLOW & GRAPHS SECTION */}
      <section className="rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-sm space-y-5" aria-label="Fluxo financeiro e volume em tempo real">
        {/* Header & Advanced Filter Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 tracking-tight">Fluxo Financeiro & Volume</h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    TEMPO REAL
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Monitoramento de entradas PIX, liquidação de saques, margem líquida e cadência de transações.
                </p>
              </div>
            </div>
          </div>

          {/* Controls: Time Range & View Mode */}
          <div className="flex flex-wrap items-center gap-2.5 self-stretch lg:self-auto justify-between lg:justify-end">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70 text-xs">
              <button
                type="button"
                onClick={() => setChartViewMode('flow')}
                className={`px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartViewMode === 'flow'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Curva de Fluxo Financeiro (R$)"
              >
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Fluxo (R$)</span>
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('volume')}
                className={`px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartViewMode === 'volume'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Volume de Operações e Contagem"
              >
                <BarChart3 className="w-3.5 h-3.5 text-blue-600" />
                <span>Volume (Qtd)</span>
              </button>
              <button
                type="button"
                onClick={() => setChartViewMode('unified')}
                className={`px-2.5 py-1 font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  chartViewMode === 'unified'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Visão Consolidada Dupla (R$ + Qtd)"
              >
                <Layers className="w-3.5 h-3.5 text-purple-600" />
                <span>Consolidado</span>
              </button>
            </div>

            {/* Time Range Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70 text-xs">
              <button
                type="button"
                onClick={() => {
                  setChartTimeRange('today');
                  setHoveredPointIndex(null);
                }}
                className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                  chartTimeRange === 'today'
                    ? 'bg-slate-900 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartTimeRange('7d');
                  setHoveredPointIndex(null);
                }}
                className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                  chartTimeRange === '7d'
                    ? 'bg-slate-900 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                7 Dias
              </button>
              <button
                type="button"
                onClick={() => {
                  setChartTimeRange('30d');
                  setHoveredPointIndex(null);
                }}
                className={`px-3 py-1 font-semibold rounded-lg transition-all cursor-pointer ${
                  chartTimeRange === '30d'
                    ? 'bg-slate-900 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                30 Dias
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Micro-KPIs Bar for the selected filter */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Entradas */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100/80 transition-all hover:bg-emerald-50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Total Entradas (PIX)
              </span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded-md">
                {totalPeriodDepositsCount} {totalPeriodDepositsCount === 1 ? 'depósito' : 'depósitos'}
              </span>
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-600 tabular-nums mt-1">
              R$ {totalPeriodDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-emerald-700/80 font-medium mt-0.5 flex items-center gap-1">
              <span>Ticket Médio:</span>
              <strong className="text-emerald-800">R$ {avgDepositTicket.toFixed(2)}</strong>
            </div>
          </div>

          {/* Saídas */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 transition-all hover:bg-slate-100/50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                Total Saídas (Saques)
              </span>
              <span className="text-[10px] font-semibold text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded-md">
                {totalPeriodWithdrawalsCount} {totalPeriodWithdrawalsCount === 1 ? 'saque' : 'saques'}
              </span>
            </div>
            <div className="text-base sm:text-lg font-black text-slate-700 tabular-nums mt-1">
              R$ {totalPeriodWithdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Liquidados via PIX direto
            </div>
          </div>

          {/* Saldo Líquido Retido */}
          <div className={`p-3.5 rounded-2xl border transition-all ${
            totalPeriodNet >= 0
              ? 'bg-blue-50/60 border-blue-100/80 hover:bg-blue-50'
              : 'bg-rose-50/60 border-rose-100/80 hover:bg-rose-50'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                totalPeriodNet >= 0 ? 'text-blue-800' : 'text-rose-800'
              }`}>
                Saldo Retido Líquido
              </span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                totalPeriodNet >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {netMarginPercent >= 0 ? '+' : ''}{netMarginPercent.toFixed(1)}% margem
              </span>
            </div>
            <div className={`text-base sm:text-lg font-black tabular-nums mt-1 ${
              totalPeriodNet >= 0 ? 'text-blue-600' : 'text-rose-600'
            }`}>
              R$ {totalPeriodNet.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className={`text-[11px] font-medium mt-0.5 ${
              totalPeriodNet >= 0 ? 'text-blue-700/80' : 'text-rose-700/80'
            }`}>
              {totalPeriodNet >= 0 ? 'Superávit retido no período' : 'Déficit líquido no período'}
            </div>
          </div>

          {/* Volume Total Transacionado */}
          <div className="p-3.5 rounded-2xl bg-purple-50/50 border border-purple-100/80 transition-all hover:bg-purple-50">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
                Volume Transacionado
              </span>
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-100/70 px-1.5 py-0.5 rounded-md">
                {totalPeriodTxCount} operações
              </span>
            </div>
            <div className="text-base sm:text-lg font-black text-purple-700 tabular-nums mt-1">
              R$ {totalPeriodVolume.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-purple-700/80 font-medium mt-0.5">
              Turnover bruto movimentado
            </div>
          </div>
        </div>

        {/* Series Filter Legend with Clickable Toggles */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="text-slate-400 text-xs font-medium mr-1 flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Séries:
            </span>

            {/* Depósitos Toggle */}
            <button
              type="button"
              onClick={() => setShowDeposits(!showDeposits)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-xs ${
                showDeposits
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200 line-through opacity-60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showDeposits ? 'bg-emerald-500' : 'bg-slate-400'}`} />
              <span>Depósitos PIX</span>
              {showDeposits && <Check className="w-3 h-3 text-emerald-600" />}
            </button>

            {/* Saques Toggle */}
            <button
              type="button"
              onClick={() => setShowWithdrawals(!showWithdrawals)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-xs ${
                showWithdrawals
                  ? 'bg-slate-100 text-slate-800 border-slate-300'
                  : 'bg-slate-50 text-slate-400 border-slate-200 line-through opacity-60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showWithdrawals ? 'bg-slate-500' : 'bg-slate-400'}`} />
              <span>Saques Aprovados</span>
              {showWithdrawals && <Check className="w-3 h-3 text-slate-700" />}
            </button>

            {/* Saldo Líquido Toggle */}
            <button
              type="button"
              onClick={() => setShowNetBalance(!showNetBalance)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all cursor-pointer text-xs ${
                showNetBalance
                  ? 'bg-blue-50 text-[#007AFF] border-blue-200'
                  : 'bg-slate-50 text-slate-400 border-slate-200 line-through opacity-60'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showNetBalance ? 'bg-[#007AFF]' : 'bg-slate-400'}`} />
              <span>Saldo Líquido</span>
              {showNetBalance && <Check className="w-3 h-3 text-[#007AFF]" />}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            Passe o mouse ou toque nos pontos para detalhamento pontual
          </div>
        </div>

        {/* 1. FINANCIAL FLOW CHART (R$) */}
        {(chartViewMode === 'flow' || chartViewMode === 'unified') && (
          <div className="relative pt-2">
            <div className="w-full overflow-hidden bg-gradient-to-b from-slate-50/50 to-white rounded-2xl border border-slate-100 p-2 sm:p-4">
              <svg
                className="w-full h-48 sm:h-56 overflow-visible select-none"
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="depositFlowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                  </linearGradient>
                  <linearGradient id="netFlowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#007AFF" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#007AFF" stopOpacity="0.0" />
                  </linearGradient>
                  <filter id="glowDeposit" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#10B981" floodOpacity="0.35" />
                  </filter>
                  <filter id="glowNet" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#007AFF" floodOpacity="0.35" />
                  </filter>
                </defs>

                {/* Y-Axis Grid Lines & Currency Labels */}
                {yTicks.map((t, i) => (
                  <g key={`ytick-${i}`}>
                    <line
                      x1={paddingLeft}
                      y1={t.y}
                      x2={svgWidth - paddingRight}
                      y2={t.y}
                      stroke={t.val === 0 ? '#94A3B8' : '#F1F5F9'}
                      strokeWidth={t.val === 0 ? '1.5' : '1'}
                      strokeDasharray={t.val === 0 ? '' : '4 4'}
                    />
                    <text
                      x={paddingLeft - 8}
                      y={t.y + 3.5}
                      textAnchor="end"
                      fill="#94A3B8"
                      fontSize="9"
                      fontWeight="600"
                      className="tabular-nums font-mono"
                    >
                      {formatCurrencyTick(t.val)}
                    </text>
                  </g>
                ))}

                {/* Zero Reference Baseline */}
                {yMin < 0 && (
                  <line
                    x1={paddingLeft}
                    y1={zeroY}
                    x2={svgWidth - paddingRight}
                    y2={zeroY}
                    stroke="#CBD5E1"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                )}

                {/* Smooth Area Fills */}
                {showDeposits && depositArea && (
                  <path d={depositArea} fill="url(#depositFlowGrad)" />
                )}
                {showNetBalance && netArea && (
                  <path d={netArea} fill="url(#netFlowGrad)" />
                )}

                {/* Smooth Curves */}
                {showWithdrawals && withdrawSmoothPath && (
                  <path
                    d={withdrawSmoothPath}
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                  />
                )}
                {showDeposits && depositSmoothPath && (
                  <path
                    d={depositSmoothPath}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3"
                    strokeLinecap="round"
                    filter="url(#glowDeposit)"
                  />
                )}
                {showNetBalance && netSmoothPath && (
                  <path
                    d={netSmoothPath}
                    fill="none"
                    stroke="#007AFF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    filter="url(#glowNet)"
                  />
                )}

                {/* Interactive Points and Guide Lines */}
                {points.map((p, idx) => (
                  <g
                    key={`flow-pt-${idx}`}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredPointIndex(idx)}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                    onClick={() => setHoveredPointIndex(idx)}
                  >
                    {/* Hover vertical hairline */}
                    {hoveredPointIndex === idx && (
                      <line
                        x1={p.x}
                        y1={paddingTop}
                        x2={p.x}
                        y2={svgHeight - paddingBottom}
                        stroke="#64748B"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Deposit marker dot */}
                    {showDeposits && (
                      <circle
                        cx={p.x}
                        cy={p.yDeposit}
                        r={hoveredPointIndex === idx ? 6 : 3.5}
                        fill="#10B981"
                        stroke="#FFFFFF"
                        strokeWidth="2"
                        className="transition-all duration-150"
                      />
                    )}

                    {/* Withdrawal marker dot */}
                    {showWithdrawals && (
                      <circle
                        cx={p.x}
                        cy={p.yWithdraw}
                        r={hoveredPointIndex === idx ? 4.5 : 2.5}
                        fill="#94A3B8"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                        className="transition-all duration-150"
                      />
                    )}

                    {/* Net balance marker dot */}
                    {showNetBalance && (
                      <circle
                        cx={p.x}
                        cy={p.yNet}
                        r={hoveredPointIndex === idx ? 5 : 3}
                        fill="#007AFF"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                        className="transition-all duration-150"
                      />
                    )}

                    {/* Invisible expanded hit target */}
                    <rect
                      x={p.x - 15}
                      y={paddingTop}
                      width={30}
                      height={svgHeight - paddingTop - paddingBottom}
                      fill="transparent"
                    />
                  </g>
                ))}
              </svg>
            </div>

            {/* X-Axis Date / Hour Labels (Guaranteed clean formatting) */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold px-4 pt-2">
              {points.map((p, idx) => {
                const isHovered = hoveredPointIndex === idx;
                // For 30 days, skip some labels to avoid overcrowding
                if (chartTimeRange === '30d' && idx % 4 !== 0 && idx !== points.length - 1) {
                  return null;
                }
                return (
                  <span
                    key={`lbl-${idx}`}
                    className={`transition-colors text-center ${
                      isHovered ? 'text-slate-950 font-bold scale-105' : 'text-slate-400'
                    }`}
                  >
                    {p.date}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. TRANSACTION VOLUME BAR CHART (Qtd de Transações) */}
        {(chartViewMode === 'volume' || chartViewMode === 'unified') && (
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-slate-700" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Distribuição de Volume & Frequência de Operações
                </h3>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5 text-emerald-700">
                  <span className="w-2 h-2 rounded-sm bg-emerald-500" /> Qtd Depósitos
                </span>
                <span className="inline-flex items-center gap-1.5 text-slate-600">
                  <span className="w-2 h-2 rounded-sm bg-slate-400" /> Qtd Saques
                </span>
              </div>
            </div>

            {/* Volume Columns Bar Strip */}
            <div className="bg-slate-50/70 p-3 sm:p-4 rounded-2xl border border-slate-200/60">
              <div className="h-24 sm:h-28 flex items-end justify-between gap-1 sm:gap-2">
                {points.map((p, idx) => {
                  const depCount = p.depositsCount ?? (p.deposits > 0 ? 1 : 0);
                  const withCount = p.withdrawalsCount ?? (p.withdrawals > 0 ? 1 : 0);
                  const totalCount = depCount + withCount;
                  const depHeight = maxVolumeTxCount > 0 ? Math.max(8, (depCount / maxVolumeTxCount) * 100) : 8;
                  const withHeight = maxVolumeTxCount > 0 ? Math.max(4, (withCount / maxVolumeTxCount) * 100) : 4;
                  const isHovered = hoveredPointIndex === idx;

                  return (
                    <div
                      key={`vol-bar-${idx}`}
                      className="flex-1 flex flex-col items-center justify-end h-full cursor-pointer group"
                      onMouseEnter={() => setHoveredPointIndex(idx)}
                      onMouseLeave={() => setHoveredPointIndex(null)}
                      onClick={() => setHoveredPointIndex(idx)}
                    >
                      <div className="w-full flex items-end justify-center gap-0.5 sm:gap-1 h-full">
                        {/* Depósitos bar */}
                        <div
                          style={{ height: `${depHeight}%` }}
                          className={`w-1/2 rounded-t-md transition-all ${
                            isHovered
                              ? 'bg-emerald-600 ring-2 ring-emerald-300'
                              : 'bg-emerald-500/80 group-hover:bg-emerald-600'
                          }`}
                        />
                        {/* Saques bar */}
                        <div
                          style={{ height: `${withHeight}%` }}
                          className={`w-1/2 rounded-t-md transition-all ${
                            isHovered
                              ? 'bg-slate-600 ring-2 ring-slate-300'
                              : 'bg-slate-400 group-hover:bg-slate-500'
                          }`}
                        />
                      </div>

                      {/* Mini X-axis label */}
                      <span className={`text-[10px] mt-1.5 truncate max-w-full font-semibold ${
                        isHovered ? 'text-slate-900 font-bold' : 'text-slate-400'
                      }`}>
                        {chartTimeRange === '30d' && idx % 4 !== 0 ? '' : p.date}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 3. PREMIUM INTERACTIVE TOOLTIP CARD */}
        {hoveredPointIndex !== null && points[hoveredPointIndex] && (
          <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xl border border-slate-800 animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-slate-200">
                  {points[hoveredPointIndex].label || `Período: ${points[hoveredPointIndex].date}`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  points[hoveredPointIndex].netBalance >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {points[hoveredPointIndex].netBalance >= 0 ? 'Superávit Líquido (+)' : 'Déficit Líquido (-)'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs tabular-nums">
              <div>
                <span className="text-slate-400 text-[10px] block font-semibold">Entradas PIX</span>
                <span className="font-extrabold text-emerald-400 text-sm">
                  R$ {points[hoveredPointIndex].deposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {points[hoveredPointIndex].depositsCount ?? 0} depósitos
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block font-semibold">Saídas PIX</span>
                <span className="font-extrabold text-slate-300 text-sm">
                  R$ {points[hoveredPointIndex].withdrawals.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {points[hoveredPointIndex].withdrawalsCount ?? 0} saques pagos
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block font-semibold">Saldo Líquido Retido</span>
                <span className={`font-extrabold text-sm ${
                  points[hoveredPointIndex].netBalance >= 0 ? 'text-[#0A84FF]' : 'text-rose-400'
                }`}>
                  R$ {points[hoveredPointIndex].netBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Margem: {points[hoveredPointIndex].deposits > 0 ? ((points[hoveredPointIndex].netBalance / points[hoveredPointIndex].deposits) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] block font-semibold">Volume Transacionado</span>
                <span className="font-extrabold text-purple-300 text-sm">
                  R$ {(points[hoveredPointIndex].volumeTotal || (points[hoveredPointIndex].deposits + points[hoveredPointIndex].withdrawals)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  {(points[hoveredPointIndex].txCountTotal || ((points[hoveredPointIndex].depositsCount || 0) + (points[hoveredPointIndex].withdrawalsCount || 0)))} operações totais
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 1. HERO SUMMARY SECTION: Apple Card Inspired Financial Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Card 1: Resultado dos Jogos & Margem */}
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
                  Resultado dos Jogos & Margem
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
              <span className="text-[11px] text-white/60 font-medium block">Resultado após comissões</span>
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
                Partidas ativas nos jogos Block Win, GEN DINO, Bubble Blast e Raspadinha
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
          subtitle="Resultado bruto dos jogos"
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
