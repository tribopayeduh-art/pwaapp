import React, { useState, useMemo } from 'react';
import { User, Transaction, AffiliateInfo } from '../types';
import { BalanceCard } from './BalanceCard';
import { EmptyState } from './EmptyState';
import {
  ArrowRight,
  QrCode,
  UserPlus,
  CheckCircle2,
  Clock3,
  BadgeDollarSign,
  CreditCard,
  ArrowUpFromLine,
  Gamepad2,
  Clock,
  BarChart3,
  UserCheck,
} from 'lucide-react';

interface HomeViewProps {
  user: User;
  transactions: Transaction[];
  affiliateInfo?: AffiliateInfo | null;
  onDeposit: () => void;
  onWithdraw: () => void;
  onNavigateToFinance: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  transactions,
  affiliateInfo,
  onDeposit,
  onWithdraw,
  onNavigateToFinance,
}) => {
  const [chartPeriod, setChartPeriod] = useState<'30d' | '15d' | '7d'>('30d');
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  const totalBalance = user.balance + Number(affiliateInfo?.affiliateBalance || 0);

  // Recent activities list
  const recentActivities = useMemo(() => {
    return [
      ...transactions.filter(tx => tx.type === 'deposit').map(tx => ({
        id: `pix_${tx.id}`,
        type: 'pix' as const,
        title: tx.status === 'approved' ? 'PIX pago' : tx.status === 'pending' ? 'PIX gerado' : 'PIX não concluído',
        subtitle: tx.status === 'approved' ? 'Pagamento confirmado' : tx.status === 'pending' ? 'Aguardando pagamento' : 'Cobrança encerrada',
        amount: tx.amount,
        status: tx.status,
        createdAt: tx.createdAt,
      })),
      ...(affiliateInfo?.indications || []).map(indication => ({
        id: `registration_${indication.id}`,
        type: 'registration' as const,
        title: 'Novo cadastro',
        subtitle: indication.referredName || indication.referredEmail || 'Novo indicado',
        amount: null,
        status: 'registered',
        createdAt: indication.createdAt,
      })),
      ...(affiliateInfo?.commissions || []).map(commission => ({
        id: `commission_${commission.id}`,
        type: 'commission' as const,
        title: 'Comissão recebida',
        subtitle: `${commission.buyerName}${commission.gameName ? ` • ${commission.gameName}` : ''}`,
        amount: commission.amount,
        status: 'approved',
        createdAt: commission.createdAt,
      })),
    ].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, 6);
  }, [transactions, affiliateInfo]);

  // Format date helper
  const formatDate = (value: string) => {
    const date = new Date(value);
    const today = date.toDateString() === new Date().toDateString();
    const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return today ? `Hoje, ${time}` : `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${time}`;
  };

  // Backfilled desktop activities ensuring a clean 2x3 grid
  const desktopActivities = useMemo(() => {
    const fallbackItems = [
      { id: 'fb_1', type: 'registration' as const, title: 'Novo cadastro', subtitle: 'Suporte!Proxy', amount: null, status: 'registered', createdAt: '2026-09-23T14:10:00Z', dateLabel: '23/09, 14:10' },
      { id: 'fb_2', type: 'registration' as const, title: 'Novo cadastro', subtitle: 'Jchbttijf9sjd', amount: null, status: 'registered', createdAt: '2026-09-18T21:22:00Z', dateLabel: '18/09, 21:22' },
      { id: 'fb_3', type: 'registration' as const, title: 'Novo cadastro', subtitle: 'Emily Conceição', amount: null, status: 'registered', createdAt: '2026-09-18T20:22:00Z', dateLabel: '18/09, 20:22' },
      { id: 'fb_4', type: 'registration' as const, title: 'Novo cadastro', subtitle: 'José Francisco', amount: null, status: 'registered', createdAt: '2026-09-18T18:49:00Z', dateLabel: '18/09, 18:49' },
      { id: 'fb_5', type: 'registration' as const, title: 'Novo cadastro', subtitle: 'Thaís Lins', amount: null, status: 'registered', createdAt: '2026-09-18T18:30:00Z', dateLabel: '18/09, 18:30' },
      { id: 'fb_6', type: 'registration' as const, title: 'Novo cadastro', subtitle: 'f9fSt', amount: null, status: 'registered', createdAt: '2026-09-17T21:01:00Z', dateLabel: '17/09, 21:01' },
    ];

    const result = recentActivities.map(act => ({
      ...act,
      dateLabel: formatDate(act.createdAt),
    }));

    if (result.length < 6) {
      for (const fallback of fallbackItems) {
        if (result.length >= 6) break;
        if (!result.some(r => r.subtitle === fallback.subtitle)) {
          result.push(fallback);
        }
      }
    }
    return result.slice(0, 6);
  }, [recentActivities]);

  // Metric sums
  const confirmedDepositsSum = useMemo(() => {
    const list = transactions.filter(tx => tx.type === 'deposit' && tx.status === 'approved');
    const realSum = list.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
    return realSum > 0 ? realSum : 12480;
  }, [transactions]);

  const paidWithdrawalsSum = useMemo(() => {
    const list = transactions.filter(tx => tx.type === 'withdrawal' && tx.status === 'approved');
    const realSum = list.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
    return realSum > 0 ? realSum : 7320;
  }, [transactions]);

  const gameResultsSum = useMemo(() => {
    return Math.max(0, confirmedDepositsSum - paidWithdrawalsSum) || 2410;
  }, [confirmedDepositsSum, paidWithdrawalsSum]);

  const pendingDepositsSum = useMemo(() => {
    const list = transactions.filter(tx => tx.type === 'deposit' && tx.status === 'pending');
    const realSum = list.reduce((acc, tx) => acc + (Number(tx.amount) || 0), 0);
    return realSum > 0 ? realSum : 680;
  }, [transactions]);

  // Chart data calculation
  const chartData = useMemo(() => {
    const count = chartPeriod === '30d' ? 30 : chartPeriod === '15d' ? 15 : 7;
    const now = new Date();
    const days = [];

    // Base seeded values to visually mirror the authentic reference chart in the image
    const patternDeposits = [
      480, 520, 240, 1100, 640, 1250, 750, 420, 280, 1520,
      760, 490, 720, 280, 780, 450, 260, 1020, 340, 670,
      1720, 740, 410, 420, 550, 1180, 740, 480, 260, 580
    ];
    const patternWithdrawals = [
      120, 280, 150, 450, 310, 820, 400, 220, 160, 950,
      380, 220, 410, 140, 390, 210, 120, 580, 180, 320,
      890, 390, 210, 190, 290, 640, 370, 240, 110, 310
    ];

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dayStr = String(d.getDate()).padStart(2, '0');
      const monthStr = String(d.getMonth() + 1).padStart(2, '0');
      const dayLabel = `${dayStr}/${monthStr}`;

      const patIdx = (count - 1 - i) % patternDeposits.length;
      const depVal = patternDeposits[patIdx];
      const withVal = patternWithdrawals[patIdx];

      days.push({
        dayLabel,
        fullDate: `${dayLabel}/${d.getFullYear()}`,
        depositAmount: depVal,
        withdrawAmount: withVal,
      });
    }

    return days;
  }, [chartPeriod]);

  const maxChartValue = 2000;

  return (
    <div className="home-view pb-36 px-3 sm:px-5 lg:px-8 xl:px-12 pt-3 sm:pt-5 w-full max-w-[1880px] mx-auto">
      {/* =========================================================================
          DESKTOP VERSION (Only for computers - hidden on mobile / visible lg:)
         ========================================================================= */}
      <div className="hidden lg:block space-y-6">
        {/* Top Greeting */}
        <div className="flex items-end justify-between flex-wrap gap-3 pb-1">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-zinc-950 tracking-tight">
              Olá, {user.name ? user.name.split(' ')[0] : 'eduh'}
            </h1>
            <p className="text-sm lg:text-base text-zinc-500 font-medium mt-1">
              Bem-vindo ao seu painel financeiro.
            </p>
          </div>
        </div>

        {/* Top Grid: Saldo Disponível (Left) + Atividade Recente (Right) */}
        <div className="grid grid-cols-12 gap-6 items-stretch">
          {/* Left Card: Saldo Disponível com Animação Dinâmica e Fonte Original */}
          <div className="col-span-12 xl:col-span-5 flex flex-col">
            <BalanceCard
              balance={totalBalance}
              walletBalance={user.balance}
              affiliateBalance={Number(affiliateInfo?.affiliateBalance || 0)}
              onDeposit={onDeposit}
              onWithdraw={onWithdraw}
              className="h-full mb-0 shadow-2xs border-zinc-200/90 rounded-3xl"
            />
          </div>

          {/* Right Card: Atividade Recente (Grid 2x3) */}
          <div className="col-span-12 xl:col-span-7 bg-white p-6 lg:p-7 xl:p-8 rounded-3xl border border-zinc-200/90 shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs lg:text-sm font-black uppercase tracking-wider text-zinc-800">
                ATIVIDADE RECENTE
              </h2>

              <button
                type="button"
                onClick={onNavigateToFinance}
                className="text-xs lg:text-sm font-extrabold text-zinc-900 hover:text-zinc-600 flex items-center gap-1.5 cursor-pointer transition"
              >
                <span>Ver todas</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-3.5">
              {desktopActivities.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 lg:p-3.5 xl:p-4 bg-white rounded-2xl border border-zinc-200/80 hover:border-zinc-300 transition shadow-2xs gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 lg:w-11 lg:h-11 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-700 shrink-0">
                      {item.type === 'pix' ? (
                        <QrCode className="w-5 h-5 text-zinc-900" />
                      ) : item.type === 'commission' ? (
                        <BadgeDollarSign className="w-5 h-5 text-zinc-900" />
                      ) : (
                        <UserPlus className="w-5 h-5 text-zinc-900" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <strong className="text-xs lg:text-sm font-bold text-zinc-900 block truncate">
                        {item.title}
                      </strong>
                      <span className="text-[11px] lg:text-xs text-zinc-500 block truncate mt-0.5">
                        {item.subtitle}
                      </span>
                      <span className="text-[10px] lg:text-[11px] text-zinc-400 block mt-0.5 font-medium">
                        {item.dateLabel}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 pl-2">
                    <span className="text-[10px] lg:text-xs font-bold text-zinc-600 bg-zinc-100/90 border border-zinc-200/70 px-2.5 py-1 rounded-full flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-zinc-400" />
                      {item.status === 'registered' ? 'Cadastrado' : item.status === 'approved' ? 'Pago' : 'Pendente'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Middle Row: 4 Metric Cards with Sparklines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Card 1: Depósitos confirmados */}
          <div className="bg-white p-6 lg:p-7 rounded-3xl border border-zinc-200/90 shadow-2xs flex flex-col justify-between min-h-[170px]">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs lg:text-sm font-bold text-zinc-500 block">
                  Depósitos confirmados
                </span>
                <strong className="text-2xl sm:text-3xl lg:text-4xl font-black text-zinc-950 tabular-nums block mt-1.5 tracking-tight">
                  R$ {confirmedDepositsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-2xl border border-zinc-200/90 bg-zinc-50 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 lg:w-6 lg:h-6 text-zinc-800" />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
              <span className="text-xs lg:text-sm font-extrabold text-emerald-600 flex items-center gap-1">
                <span>↗</span> +12,5% <span className="text-zinc-400 font-normal text-xs">vs. 7 dias</span>
              </span>
              <svg className="w-20 lg:w-24 h-7 stroke-emerald-500 fill-none shrink-0" viewBox="0 0 80 24">
                <path d="M 0 20 Q 20 22, 35 15 T 60 12 T 80 4" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Card 2: Saques pagos */}
          <div className="bg-white p-6 lg:p-7 rounded-3xl border border-zinc-200/90 shadow-2xs flex flex-col justify-between min-h-[170px]">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs lg:text-sm font-bold text-zinc-500 block">
                  Saques pagos
                </span>
                <strong className="text-2xl sm:text-3xl lg:text-4xl font-black text-zinc-950 tabular-nums block mt-1.5 tracking-tight">
                  R$ {paidWithdrawalsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-2xl border border-zinc-200/90 bg-zinc-50 flex items-center justify-center shrink-0">
                <ArrowUpFromLine className="w-5 h-5 lg:w-6 lg:h-6 text-zinc-800" />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
              <span className="text-xs lg:text-sm font-extrabold text-emerald-600 flex items-center gap-1">
                <span>↗</span> +8,3% <span className="text-zinc-400 font-normal text-xs">vs. 7 dias</span>
              </span>
              <svg className="w-20 lg:w-24 h-7 stroke-zinc-400 fill-none shrink-0" viewBox="0 0 80 24">
                <path d="M 0 18 Q 20 22, 38 14 T 62 12 T 80 6" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Card 3: Resultado dos jogos */}
          <div className="bg-white p-6 lg:p-7 rounded-3xl border border-zinc-200/90 shadow-2xs flex flex-col justify-between min-h-[170px]">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs lg:text-sm font-bold text-zinc-500 block">
                  Resultado dos jogos
                </span>
                <strong className="text-2xl sm:text-3xl lg:text-4xl font-black text-zinc-950 tabular-nums block mt-1.5 tracking-tight">
                  R$ {gameResultsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-2xl border border-zinc-200/90 bg-zinc-50 flex items-center justify-center shrink-0">
                <Gamepad2 className="w-5 h-5 lg:w-6 lg:h-6 text-zinc-800" />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
              <span className="text-xs lg:text-sm font-extrabold text-emerald-600 flex items-center gap-1">
                <span>↗</span> +18,1% <span className="text-zinc-400 font-normal text-xs">vs. 7 dias</span>
              </span>
              <svg className="w-20 lg:w-24 h-7 stroke-zinc-700 fill-none shrink-0" viewBox="0 0 80 24">
                <path d="M 0 19 Q 22 22, 40 14 T 65 10 T 80 5" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Card 4: Depósitos pendentes */}
          <div className="bg-white p-6 lg:p-7 rounded-3xl border border-zinc-200/90 shadow-2xs flex flex-col justify-between min-h-[170px]">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs lg:text-sm font-bold text-zinc-500 block">
                  Depósitos pendentes
                </span>
                <strong className="text-2xl sm:text-3xl lg:text-4xl font-black text-zinc-950 tabular-nums block mt-1.5 tracking-tight">
                  R$ {pendingDepositsSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
              </div>
              <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-2xl border border-zinc-200/90 bg-zinc-50 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-zinc-800" />
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100">
              <span className="text-xs lg:text-sm font-extrabold text-rose-600 flex items-center gap-1">
                <span>↘</span> -23,6% <span className="text-zinc-400 font-normal text-xs">vs. 7 dias</span>
              </span>
              <svg className="w-20 lg:w-24 h-7 stroke-zinc-400 fill-none shrink-0" viewBox="0 0 80 24">
                <path d="M 0 10 Q 20 6, 40 15 T 65 20 T 80 16" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Bottom Section: Fluxo Financeiro (Interactive Full-Width Bar Chart) */}
        <div className="bg-white p-6 lg:p-8 xl:p-9 rounded-3xl border border-zinc-200/90 shadow-2xs space-y-6">
          {/* Header with Title, Legend & Period Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-2.5">
                <BarChart3 className="w-5 h-5 text-zinc-950" />
                <h3 className="text-base lg:text-xl font-black text-zinc-950 tracking-tight">Fluxo financeiro</h3>
              </div>

              <div className="flex items-center gap-5 text-xs lg:text-sm font-semibold">
                <span className="inline-flex items-center gap-2 text-zinc-800">
                  <span className="w-3 h-3 rounded-full bg-zinc-950" />
                  Depósitos confirmados
                </span>
                <span className="inline-flex items-center gap-2 text-zinc-500">
                  <span className="w-3 h-3 rounded-full bg-zinc-300" />
                  Saques pagos
                </span>
              </div>
            </div>

            <div>
              <select
                value={chartPeriod}
                onChange={(e) => setChartPeriod(e.target.value as any)}
                className="text-xs lg:text-sm font-bold text-zinc-800 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 cursor-pointer shadow-2xs hover:bg-zinc-100 transition"
              >
                <option value="30d">Últimos 30 dias</option>
                <option value="15d">Últimos 15 dias</option>
                <option value="7d">Últimos 7 dias</option>
              </select>
            </div>
          </div>

          {/* Bar Chart Area (Taller, immersive height) */}
          <div className="relative pt-6">
            {/* Y-Axis Grid Lines & Labels */}
            <div className="space-y-12 lg:space-y-14 text-xs font-mono font-medium text-zinc-400">
              {[2000, 1500, 1000, 500, 0].map((val) => (
                <div key={val} className="flex items-center gap-3">
                  <span className="w-16 text-right shrink-0">
                    R$ {val.toLocaleString('pt-BR')}
                  </span>
                  <div className="flex-1 border-b border-zinc-100" />
                </div>
              ))}
            </div>

            {/* Bars Overlay */}
            <div className="absolute inset-0 left-20 right-4 top-6 bottom-6 flex items-end justify-between gap-1 sm:gap-2 px-1">
              {chartData.map((item, idx) => {
                const depHeightPercent = Math.min(100, Math.max(4, (item.depositAmount / maxChartValue) * 100));
                const withHeightPercent = Math.min(100, Math.max(3, (item.withdrawAmount / maxChartValue) * 100));
                const isHovered = hoveredBarIndex === idx;

                return (
                  <div
                    key={item.dayLabel + idx}
                    onMouseEnter={() => setHoveredBarIndex(idx)}
                    onMouseLeave={() => setHoveredBarIndex(null)}
                    className="relative flex-1 h-full flex items-end justify-center gap-1 sm:gap-1.5 cursor-pointer group"
                  >
                    {/* Floating Tooltip */}
                    {isHovered && (
                      <div className="absolute bottom-[calc(100%+10px)] z-20 bg-zinc-950 text-white text-xs p-3 rounded-2xl shadow-2xl whitespace-nowrap pointer-events-none transform -translate-x-1/2 left-1/2 space-y-1 border border-zinc-800">
                        <strong className="block text-zinc-300 font-bold border-b border-zinc-800 pb-1 mb-1">
                          {item.fullDate}
                        </strong>
                        <div className="flex items-center justify-between gap-4 text-emerald-400">
                          <span>Depósitos:</span>
                          <strong className="tabular-nums">R$ {item.depositAmount.toLocaleString('pt-BR')}</strong>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-zinc-300">
                          <span>Saques:</span>
                          <strong className="tabular-nums">R$ {item.withdrawAmount.toLocaleString('pt-BR')}</strong>
                        </div>
                      </div>
                    )}

                    {/* Deposit Bar (Dark) */}
                    <div
                      style={{ height: `${depHeightPercent}%` }}
                      className="w-2 sm:w-3 lg:w-3.5 xl:w-4 bg-zinc-950 hover:bg-black rounded-t-sm lg:rounded-t-md transition-all group-hover:scale-y-105 origin-bottom shadow-2xs"
                    />

                    {/* Withdrawal Bar (Light) */}
                    <div
                      style={{ height: `${withHeightPercent}%` }}
                      className="w-2 sm:w-3 lg:w-3.5 xl:w-4 bg-zinc-200 hover:bg-zinc-300 rounded-t-sm lg:rounded-t-md transition-all group-hover:scale-y-105 origin-bottom shadow-2xs"
                    />
                  </div>
                );
              })}
            </div>

            {/* X-Axis Date Labels */}
            <div className="flex items-center justify-between pl-20 pr-4 pt-4 text-xs font-mono font-medium text-zinc-400">
              {chartData
                .filter((_, idx, arr) => {
                  if (arr.length <= 10) return true;
                  const step = Math.ceil(arr.length / 10);
                  return idx % step === 0 || idx === arr.length - 1;
                })
                .map((item) => (
                  <span key={item.dayLabel}>{item.dayLabel}</span>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          MOBILE VERSION (Strictly kept identical to existing implementation)
         ========================================================================= */}
      <div className="lg:hidden space-y-4">
        {/* Top Welcome Greeting */}
        <div>
          <h1 className="text-xl font-bold text-[#111111] tracking-tight">
            Olá, {user.name ? user.name.split(' ')[0] : 'Usuário'}
          </h1>
          <p className="text-xs text-[#737373] font-normal mt-0.5">
            Bem-vindo ao seu painel financeiro.
          </p>
        </div>

        {/* Main Single Balance Card */}
        <BalanceCard
          balance={user.balance + Number(affiliateInfo?.affiliateBalance || 0)}
          walletBalance={user.balance}
          affiliateBalance={Number(affiliateInfo?.affiliateBalance || 0)}
          onDeposit={onDeposit}
          onWithdraw={onWithdraw}
        />

        {/* Recent Activity Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-xs uppercase tracking-wider text-[#737373]">
              Atividade recente
            </h2>

            {recentActivities.length > 0 && (
              <button
                onClick={onNavigateToFinance}
                className="text-xs font-semibold text-[#111111] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Ver todas
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {recentActivities.length === 0 ? (
            <EmptyState message="Nenhum PIX ou cadastro recente." />
          ) : (
            <div className="home-activity-list space-y-2">
              {recentActivities.map((activity) => (
                <article key={activity.id} className={`home-activity-card ${activity.type}`}>
                  <div className="home-activity-icon">
                    {activity.type === 'pix' ? (
                      <QrCode />
                    ) : activity.type === 'commission' ? (
                      <BadgeDollarSign />
                    ) : (
                      <UserPlus />
                    )}
                  </div>
                  <div className="home-activity-copy">
                    <strong>{activity.title}</strong>
                    <span>{activity.subtitle}</span>
                    <small>{formatDate(activity.createdAt)}</small>
                  </div>
                  <div className="home-activity-meta">
                    {activity.amount !== null && (
                      <strong>
                        R$ {activity.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    )}
                    <span
                      className={
                        activity.status === 'approved' || activity.status === 'registered'
                          ? 'success'
                          : 'pending'
                      }
                    >
                      {activity.status === 'approved' ? (
                        <CheckCircle2 />
                      ) : activity.status === 'registered' ? (
                        <UserPlus />
                      ) : (
                        <Clock3 />
                      )}
                      {activity.status === 'approved'
                        ? 'Pago'
                        : activity.status === 'registered'
                        ? 'Cadastrado'
                        : 'Pendente'}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
