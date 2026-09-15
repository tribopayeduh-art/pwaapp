import React, { useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  TrendingUp,
  Percent,
  Gamepad2,
  Users,
  Award,
  DollarSign,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  Loader2,
  Server,
  Database
} from 'lucide-react';
import { ReportAnalyticsData } from './adminTypes';
import {
  IOSCard,
  IOSStatCard,
  IOSSegmentedControl,
  IOSBadge,
  IOSButton
} from './IOSComponents';

interface AdminReportsTabProps {
  reportData: ReportAnalyticsData | null;
  loading: boolean;
  selectedPeriod: string;
  onPeriodChange: (period: string) => void;
  onExportCsv: (type: string) => void;
  onFetchReports: (period?: string) => Promise<void>;
  onOpenMigrationModal?: () => void;
}

export const AdminReportsTab: React.FC<AdminReportsTabProps> = ({
  reportData,
  loading,
  selectedPeriod,
  onPeriodChange,
  onExportCsv,
  onFetchReports,
  onOpenMigrationModal
}) => {
  const [subTab, setSubTab] = useState<
    'dre' | 'gaming' | 'affiliates' | 'players' | 'transactions'
  >('dre');

  const periodOptions = [
    { id: 'today', label: 'Hoje' },
    { id: 'yesterday', label: 'Ontem' },
    { id: '7d', label: '7 Dias' },
    { id: '30d', label: '30 Dias' },
    { id: 'month', label: 'Este Mês' },
    { id: 'last_month', label: 'Mês Passado' }
  ];

  const subTabOptions = [
    { id: 'dre' as const, label: 'DRE & Caixa', icon: FileText },
    { id: 'gaming' as const, label: 'GGR & Apostas', icon: Gamepad2 },
    { id: 'affiliates' as const, label: 'Ranking Afiliados', icon: Award },
    { id: 'players' as const, label: 'Maiores Jogadores', icon: Users },
    { id: 'transactions' as const, label: 'Extrato Transacional', icon: BarChart3 }
  ];

  const summary = reportData?.periodSummary;

  return (
    <div className="space-y-5">
      {/* Top Filter Bar: Period Selector & CSV Export */}
      <IOSCard className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <IOSSegmentedControl
            options={periodOptions}
            value={selectedPeriod}
            onChange={(val) => {
              onPeriodChange(val);
              onFetchReports(val);
            }}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {onOpenMigrationModal && (
            <IOSButton
              variant="primary"
              size="sm"
              onClick={onOpenMigrationModal}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            >
              <Server className="w-3.5 h-3.5" />
              <span>Migrar para VPS Integrator</span>
            </IOSButton>
          )}

          <IOSButton
            variant="secondary"
            size="sm"
            onClick={() => onExportCsv('dre')}
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Exportar CSV</span>
          </IOSButton>
        </div>
      </IOSCard>

      {/* Migration Feature Card Banner */}
      {onOpenMigrationModal && (
        <IOSCard className="p-4 sm:p-5 border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-slate-900">Exportação Completa para VPS Integrator</h3>
                <IOSBadge variant="green">Pronto para Migração</IOSBadge>
              </div>
              <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                Exporte todas as chaves e coleções (usuários, saldos, afiliados, transações PIX, configurações Dotfy e catálogo de jogos) em um pacote estruturado (.JSON e .SQL) pronto para restaurar na Integrator VPS.
              </p>
            </div>
          </div>
          <IOSButton
            variant="primary"
            size="sm"
            onClick={onOpenMigrationModal}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Tudo Organizado</span>
          </IOSButton>
        </IOSCard>
      )}

      {/* Sub-Navigation */}
      <div className="flex items-center overflow-x-auto pb-1">
        <IOSSegmentedControl
          options={subTabOptions}
          value={subTab}
          onChange={setSubTab}
          className="w-full sm:w-auto"
        />
      </div>

      {loading ? (
        <IOSCard className="p-12 text-center text-slate-400 text-xs font-semibold flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-[#007AFF]" />
          <span>Calculando métricas avançadas de BI...</span>
        </IOSCard>
      ) : !reportData ? (
        <IOSCard className="p-12 text-center text-slate-400 text-xs font-semibold">
          Nenhum dado analítico disponível para este período.
        </IOSCard>
      ) : (
        <>
          {/* 1. DRE & CAIXA SUB-TAB */}
          {subTab === 'dre' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <IOSStatCard
                  title="Depósitos Brutos (Entradas)"
                  value={`R$ ${(summary?.grossDeposits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  subtitle={`${summary?.grossDepositsCount || 0} depósitos pagos`}
                  icon={ArrowDownLeft}
                  iconBgColor="bg-[#34C759]"
                  isPositive={true}
                />

                <IOSStatCard
                  title="Saques Aprovados (Saídas)"
                  value={`R$ ${(summary?.totalWithdrawals || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  subtitle={`${summary?.totalWithdrawalsCount || 0} saques liquidados`}
                  icon={ArrowUpRight}
                  iconBgColor="bg-[#FF9500]"
                />

                <IOSStatCard
                  title="GGR Operacional"
                  value={`R$ ${(summary?.ggr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  subtitle={`RTP Real: ${(summary?.realRtpPercent || 88).toFixed(1)}%`}
                  icon={TrendingUp}
                  iconBgColor="bg-[#007AFF]"
                  isPositive={true}
                />

                <IOSStatCard
                  title="Resultado Líquido Caixa"
                  value={`R$ ${(summary?.netCashflow || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  subtitle={`Margem: ${(summary?.netOperatingMargin || 0).toFixed(1)}%`}
                  icon={DollarSign}
                  iconBgColor="bg-[#5856D6]"
                  isPositive={(summary?.netCashflow || 0) >= 0}
                />
              </div>

              {/* DRE Breakdown Table */}
              <IOSCard className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-black/[0.04] pb-3">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 tracking-tight">
                      Demonstrativo de Resultado do Exercício (DRE)
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      Visão contábil e de conciliação das operações da plataforma
                    </p>
                  </div>
                  <IOSBadge variant="blue">Período Selecionado</IOSBadge>
                </div>

                <div className="divide-y divide-black/[0.04] text-xs">
                  <div className="py-2.5 flex items-center justify-between">
                    <span className="font-bold text-slate-900">1. RECEITA BRUTA DE DEPÓSITOS (PIX)</span>
                    <span className="font-mono font-bold text-[#34C759]">
                      +R$ {(summary?.grossDeposits || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between pl-4">
                    <span className="text-slate-600">(-) Saques Aprovados aos Usuários</span>
                    <span className="font-mono font-semibold text-[#FF3B30]">
                      -R$ {(summary?.totalWithdrawals || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between bg-black/[0.02] px-2 rounded-lg font-bold">
                    <span className="text-slate-900">(=) SALDO LÍQUIDO DO FLUXO FINANCEIRO</span>
                    <span className="font-mono text-slate-900">
                      R$ {(summary?.netCashflow || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between">
                    <span className="font-bold text-slate-900">2. RESULTADO DE JOGOS & APOSTAS (GGR)</span>
                    <span className="font-mono font-bold text-[#007AFF]">
                      +R$ {(summary?.ggr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between pl-4">
                    <span className="text-slate-600">(+) Volume Total Apostado (Handle/Turnover)</span>
                    <span className="font-mono font-medium text-slate-700">
                      R$ {(summary?.wagered || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between pl-4">
                    <span className="text-slate-600">(-) Total de Prêmios Pagos aos Jogadores (Payouts)</span>
                    <span className="font-mono font-medium text-slate-700">
                      -R$ {(summary?.payouts || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="py-2.5 flex items-center justify-between pl-4">
                    <span className="text-slate-600">(-) Comissões Pagas sobre Depósitos à Rede de Afiliados</span>
                    <span className="font-mono font-semibold text-[#AF52DE]">
                      -R$ {(summary?.totalAffiliateCommissions || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="py-3 flex items-center justify-between bg-[#34C759]/10 px-3 rounded-xl font-bold text-sm">
                    <span className="text-slate-900">(=) LUCRO LÍQUIDO OPERACIONAL (NGR)</span>
                    <span className="font-mono text-[#248A3D]">
                      R$ {(summary?.ngr || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </IOSCard>
            </div>
          )}

          {/* 2. GAMING & GGR SUB-TAB */}
          {subTab === 'gaming' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <IOSStatCard
                  title="Volume Apostado (Turnover)"
                  value={`R$ ${(summary?.wagered || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  subtitle={`${summary?.totalBetsCount || 0} rodadas disputadas`}
                  icon={Gamepad2}
                  iconBgColor="bg-[#FF2D55]"
                />

                <IOSStatCard
                  title="RTP Efetivo Médio"
                  value={`${(summary?.realRtpPercent || 88).toFixed(1)}%`}
                  subtitle={`Target do sistema: ~88%`}
                  icon={Percent}
                  iconBgColor="bg-[#007AFF]"
                  isPositive={true}
                />

                <IOSStatCard
                  title="Taxa de Vitória do Jogador"
                  value={`${(summary?.winRatePercent || 42.5).toFixed(1)}%`}
                  subtitle={`${summary?.winsCount || 0} vitórias / ${summary?.lossesCount || 0} derrotas`}
                  icon={Award}
                  iconBgColor="bg-[#34C759]"
                />
              </div>
            </div>
          )}

          {/* 3. AFFILIATES RANKING SUB-TAB */}
          {subTab === 'affiliates' && (
            <IOSCard className="overflow-hidden">
              <div className="p-4 bg-[#F2F2F7] font-bold text-xs text-slate-700 flex items-center justify-between">
                <span>Ranking de Desempenho dos Melhores Afiliados</span>
                <span className="text-slate-400 font-normal">Ordenado por volume de depósitos</span>
              </div>

              {reportData.affiliateRanking && reportData.affiliateRanking.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
                      <tr>
                        <th className="py-3 px-4">Posição / Afiliado</th>
                        <th className="py-3 px-4">Código</th>
                        <th className="py-3 px-4 text-center">Indicados</th>
                        <th className="py-3 px-4 text-center">FTDs</th>
                        <th className="py-3 px-4 text-right">Depósitos da Rede</th>
                        <th className="py-3 px-4 text-right">Comissões Geradas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {reportData.affiliateRanking.map((aff, idx) => (
                        <tr key={aff.affiliateId || `aff-${idx}`} className="hover:bg-black/[0.015]">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                idx === 0 ? 'bg-[#FF9500] text-white' : idx === 1 ? 'bg-slate-300 text-slate-800' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {idx + 1}
                              </span>
                              <div>
                                <div className="font-bold text-slate-900">{aff.userName}</div>
                                <div className="text-[11px] text-slate-400">{aff.userEmail}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono font-bold text-[#007AFF]">
                            {aff.referralCode}
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                            {aff.totalReferrals}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-[#34C759]">
                            {aff.ftdCount}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            R$ {aff.referralDepositsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#AF52DE]">
                            R$ {aff.commissionTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Nenhum dado de afiliado registrado no período.
                </div>
              )}
            </IOSCard>
          )}

          {/* 4. TOP PLAYERS SUB-TAB */}
          {subTab === 'players' && (
            <IOSCard className="overflow-hidden">
              <div className="p-4 bg-[#F2F2F7] font-bold text-xs text-slate-700">
                Top 20 Jogadores Mais Lucrativos para a Casa
              </div>
              {reportData.topProfitablePlayers && reportData.topProfitablePlayers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
                      <tr>
                        <th className="py-3 px-4">Jogador</th>
                        <th className="py-3 px-4 text-right">Saldo Atual</th>
                        <th className="py-3 px-4 text-right">Depósitos</th>
                        <th className="py-3 px-4 text-right">Saques</th>
                        <th className="py-3 px-4 text-right">Volume Apostado</th>
                        <th className="py-3 px-4 text-right">GGR Gerado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {reportData.topProfitablePlayers.map((p, idx) => (
                        <tr key={p.userId || `p-${idx}`} className="hover:bg-black/[0.015]">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{p.name}</div>
                            <div className="text-[11px] text-slate-400">{p.email}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                            R$ {p.currentBalance.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#34C759]">
                            R$ {p.totalDeposited.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-[#FF9500]">
                            R$ {p.totalWithdrawn.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono text-slate-700">
                            R$ {p.totalWagered.toFixed(2)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-[#007AFF]">
                            R$ {p.ggrGenerated.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Nenhum jogador registrado no período.
                </div>
              )}
            </IOSCard>
          )}

          {/* 5. TRANSACTIONS EXTRACT SUB-TAB */}
          {subTab === 'transactions' && (
            <IOSCard className="overflow-hidden">
              <div className="p-4 bg-[#F2F2F7] font-bold text-xs text-slate-700">
                Histórico Transacional do Período
              </div>
              {reportData.transactions && reportData.transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-white text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
                      <tr>
                        <th className="py-3 px-4">Usuário</th>
                        <th className="py-3 px-4">Tipo</th>
                        <th className="py-3 px-4 text-right">Valor</th>
                        <th className="py-3 px-4 text-center">Status</th>
                        <th className="py-3 px-4">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.04]">
                      {reportData.transactions.slice(0, 50).map((t) => {
                        const isDep = t.type === 'deposit';
                        return (
                          <tr key={t.id} className="hover:bg-black/[0.015]">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{t.userName}</div>
                              <div className="text-[11px] text-slate-400">{t.userEmail}</div>
                            </td>
                            <td className="py-3 px-4">
                              <IOSBadge variant={isDep ? 'green' : 'orange'}>
                                {isDep ? 'Depósito PIX' : 'Saque PIX'}
                              </IOSBadge>
                            </td>
                            <td className={`py-3 px-4 text-right font-mono font-bold ${isDep ? 'text-[#34C759]' : 'text-[#FF9500]'}`}>
                              {isDep ? '+' : '-'}R$ {t.amount.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <IOSBadge variant={t.status === 'approved' ? 'green' : t.status === 'pending' ? 'orange' : 'red'}>
                                {t.status}
                              </IOSBadge>
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-xs">
                              {new Date(t.createdAt).toLocaleString('pt-BR')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Nenhuma transação no período.
                </div>
              )}
            </IOSCard>
          )}
        </>
      )}
    </div>
  );
};
