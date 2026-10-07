import React, { useState } from 'react';
import {
  X,
  Activity,
  Shuffle,
  Calendar,
  CreditCard,
  User,
  ArrowRight,
  Search,
  CheckCircle2,
  Copy,
  Check,
  Wallet
} from 'lucide-react';
import { PartnerAffiliateStats } from '../../types';

interface DiversionLogEntry {
  id: string;
  depositId: string;
  amount: number;
  playerName: string;
  playerEmail?: string;
  affiliateId?: string;
  affiliateName: string;
  affiliateCode?: string;
  saleNumber?: number;
  divertedKey: string;
  divertedAt: string;
  status?: string;
  cycleInfo?: string;
}

interface PartnerInterceptedSalesModalProps {
  affiliate: PartnerAffiliateStats;
  diversionLogs: DiversionLogEntry[];
  onClose: () => void;
  onGoToDiversionSettings: (affiliateId: string) => void;
}

export const PartnerInterceptedSalesModal: React.FC<PartnerInterceptedSalesModalProps> = ({
  affiliate,
  diversionLogs,
  onClose,
  onGoToDiversionSettings
}) => {
  const [search, setSearch] = useState('');
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  // Filter logs for this specific affiliate
  const affiliateLogs = diversionLogs.filter((log) => {
    const matchId = log.affiliateId && log.affiliateId === affiliate.id;
    const matchCode = log.affiliateCode && affiliate.referralCode && log.affiliateCode.toLowerCase() === affiliate.referralCode.toLowerCase();
    const matchName = log.affiliateName && affiliate.name && log.affiliateName.toLowerCase() === affiliate.name.toLowerCase();
    return matchId || matchCode || matchName;
  });

  const filteredLogs = affiliateLogs.filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.playerName.toLowerCase().includes(q) ||
      (log.playerEmail && log.playerEmail.toLowerCase().includes(q)) ||
      log.depositId.toLowerCase().includes(q) ||
      log.divertedKey.toLowerCase().includes(q)
    );
  });

  const totalDivertedSum = affiliateLogs.reduce((acc, l) => acc + (l.amount || 0), 0);
  const totalDivertedCount = affiliate.divertedSalesCount || affiliateLogs.length;
  const totalSalesAll = affiliate.actualTotalSalesCount || (affiliate.paidDepositsCount + totalDivertedCount);

  const handleCopy = (text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTxId(text);
    setTimeout(() => setCopiedTxId(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full border border-zinc-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-start justify-between gap-3 bg-zinc-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 shadow-2xs shrink-0">
              <Activity className="w-5 h-5 fill-amber-500/20" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-zinc-900 tracking-tight">
                  Vendas Interceptadas
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                  {totalDivertedCount} {totalDivertedCount === 1 ? 'venda' : 'vendas'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                <span>Afiliado: <strong className="text-zinc-800">{affiliate.name}</strong></span>
                <span className="text-zinc-300">•</span>
                <span className="font-mono text-[11px] text-zinc-500">REF: {affiliate.referralCode}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-200/60 hover:bg-zinc-200 flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* Key Rule & Mathematical Clarity Strip */}
          <div className="bg-amber-500/10 border border-amber-500/25 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-950">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span>Lógica de Desvio Oficial Aplicada a este Afiliado</span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              Exemplo real: de <strong className="text-zinc-900">{totalSalesAll} vendas</strong> geradas pela rede deste afiliado,{' '}
              <strong className="text-emerald-700">{affiliate.paidDepositsCount} contaram para o painel dele</strong> e{' '}
              <strong className="text-rose-700">{totalDivertedCount} foram interceptadas</strong> e creditadas diretamente na sua conta de parceiro.
            </p>

            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white/80 p-2 rounded-xl border border-zinc-200/80">
                <span className="text-[10px] text-zinc-400 block font-semibold uppercase">Total Gerado</span>
                <strong className="text-sm font-black text-zinc-900">{totalSalesAll} vendas</strong>
              </div>
              <div className="bg-emerald-50/80 p-2 rounded-xl border border-emerald-200/80">
                <span className="text-[10px] text-emerald-600 block font-semibold uppercase">Afiliado Viu</span>
                <strong className="text-sm font-black text-emerald-700">{affiliate.paidDepositsCount} vendas</strong>
              </div>
              <div className="bg-rose-50/80 p-2 rounded-xl border border-rose-200/80">
                <span className="text-[10px] text-rose-600 block font-semibold uppercase">Ficou com Você</span>
                <strong className="text-sm font-black text-rose-700">{totalDivertedCount} vendas</strong>
              </div>
            </div>
          </div>

          {/* Search bar if multiple logs */}
          {affiliateLogs.length > 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Buscar por jogador, e-mail ou código de transação..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-amber-500 focus:bg-white transition"
              />
            </div>
          )}

          {/* List of Intercepted Sales */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-zinc-700">
              <span>Extrato das Vendas Desviadas</span>
              {totalDivertedSum > 0 && (
                <span className="text-emerald-600 font-extrabold">
                  Total Retido: R$ {totalDivertedSum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              )}
            </div>

            {filteredLogs.length === 0 ? (
              <div className="py-8 text-center bg-zinc-50 rounded-2xl border border-zinc-200/70 p-4 space-y-2">
                <Shuffle className="w-8 h-8 text-zinc-300 mx-auto" />
                <p className="text-xs font-bold text-zinc-700">
                  {totalDivertedCount > 0
                    ? `${totalDivertedCount} venda(s) registrada(s) nas métricas deste afiliado`
                    : 'Nenhuma venda desviada deste afiliado ainda'}
                </p>
                <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                  Quando jogadores indicados por {affiliate.name} realizarem novos depósitos dentro da regra de desvio, o extrato detalhado aparecerá aqui.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log, idx) => (
                  <div
                    key={log.id || log.depositId || idx}
                    className="bg-white p-3 rounded-2xl border border-zinc-200/90 shadow-2xs hover:border-amber-300 transition space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          {log.saleNumber ? `Venda #${log.saleNumber}` : `Desvio #${idx + 1}`}
                        </span>
                        {log.cycleInfo && (
                          <span className="text-[10px] text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md font-medium">
                            {log.cycleInfo}
                          </span>
                        )}
                      </div>
                      <strong className="text-sm font-black text-emerald-600 tabular-nums">
                        R$ {log.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div className="flex items-start justify-between text-xs pt-0.5">
                      <div>
                        <strong className="text-zinc-900 font-bold block">{log.playerName}</strong>
                        {log.playerEmail && (
                          <span className="text-[10px] text-zinc-400 block">{log.playerEmail}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400 text-right">
                        {new Date(log.divertedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] bg-emerald-50/60 px-2.5 py-1.5 rounded-xl border border-emerald-100 text-emerald-900">
                      <div className="flex items-center gap-1.5 truncate max-w-[280px]">
                        <Wallet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate font-semibold text-[10px] text-emerald-800">Destino: Conta do Parceiro</span>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                        100% no seu Saldo
                      </span>
                    </div>

                    {log.depositId && (
                      <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-0.5">
                        <span className="font-mono">ID: {log.depositId.substring(0, 16)}...</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(log.depositId)}
                          className="hover:text-zinc-700 flex items-center gap-1 cursor-pointer transition"
                        >
                          {copiedTxId === log.depositId ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copiar ID</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-zinc-100 bg-zinc-50/70 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onGoToDiversionSettings(affiliate.id);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 text-xs font-black transition shadow-xs active:scale-95 cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Configurar Desvio Deste Afiliado</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-zinc-200/80 hover:bg-zinc-200 text-zinc-700 text-xs font-bold transition cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
