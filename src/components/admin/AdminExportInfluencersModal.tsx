import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Crown,
  Phone,
  MessageSquare,
  FileSpreadsheet,
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Users,
  Search,
  Wand2,
  Database,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { AdminUserItem } from './adminTypes';
import {
  healPhoneNumber,
  HealedPhoneResult,
  formatPhoneDisplay,
  getWhatsAppNumber,
  getWhatsAppLink,
  extractDigits,
  isValidBrazilianPhone
} from '../../lib/phoneValidation';
import { IOSButton, IOSBadge } from './IOSComponents';

interface AdminExportInfluencersModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: AdminUserItem[];
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
  initialMode?: 'all' | 'valid';
}

export const AdminExportInfluencersModal: React.FC<AdminExportInfluencersModalProps> = ({
  isOpen,
  onClose,
  users,
  onShowToast,
  initialMode = 'valid'
}) => {
  // Filtros internos do Modal
  const [onlyValidPhone, setOnlyValidPhone] = useState<boolean>(initialMode !== 'all');
  const [autoRepairEnabled, setAutoRepairEnabled] = useState<boolean>(true);
  const [onlyActive, setOnlyActive] = useState<boolean>(false);
  const [selectedGame, setSelectedGame] = useState<string>('all');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const [applyingRepairs, setApplyingRepairs] = useState<boolean>(false);
  const [repairsApplied, setRepairsApplied] = useState<boolean>(false);

  // Sincroniza modo inicial quando o modal abre
  React.useEffect(() => {
    if (isOpen) {
      if (initialMode === 'all') {
        setOnlyValidPhone(false);
      } else {
        setOnlyValidPhone(true);
      }
    }
  }, [isOpen, initialMode]);

  // Filtra todos os usuários com papel ou flag de influenciador
  const allInfluencers = useMemo(() => {
    return users.filter((u) => Boolean(u.isInfluencer));
  }, [users]);

  // Mapa de telefones corrigidos pelo motor inteligente
  const healedMap = useMemo(() => {
    const map = new Map<string, HealedPhoneResult | null>();
    allInfluencers.forEach((u) => {
      map.set(u.id, healPhoneNumber(u.phone));
    });
    return map;
  }, [allInfluencers]);

  // Estatísticas de recuperação e validação
  const repairMetrics = useMemo(() => {
    let originallyValid = 0;
    let repairedWithAdd9 = 0;
    let repairedWithRemove9 = 0;
    let repairedWithPrefixOrTrailing = 0;
    let unrecoverable = 0;

    allInfluencers.forEach((u) => {
      const h = healedMap.get(u.id);
      if (!h) {
        unrecoverable++;
      } else if (!h.wasRepaired && h.method === 'original') {
        originallyValid++;
      } else if (h.method === 'add_9' || h.method === 'add_ddd_and_9') {
        repairedWithAdd9++;
      } else if (h.method === 'remove_9') {
        repairedWithRemove9++;
      } else {
        repairedWithPrefixOrTrailing++;
      }
    });

    const totalRepaired = repairedWithAdd9 + repairedWithRemove9 + repairedWithPrefixOrTrailing;

    return {
      originallyValid,
      repairedWithAdd9,
      repairedWithRemove9,
      repairedWithPrefixOrTrailing,
      totalRepaired,
      totalUsable: originallyValid + totalRepaired,
      unrecoverable
    };
  }, [allInfluencers, healedMap]);

  // Lista filtrada e enriquecida com os dados corrigidos
  const processedInfluencers = useMemo(() => {
    return allInfluencers
      .map((u) => {
        const healed = healedMap.get(u.id);
        const effectivePhone = autoRepairEnabled && healed ? healed.healedPhone : (extractDigits(u.phone) || u.phone);
        const effectiveFormatted = autoRepairEnabled && healed ? healed.formattedPhone : formatPhoneDisplay(u.phone);
        const effectiveWaNumber = autoRepairEnabled && healed ? healed.whatsappNumber : getWhatsAppNumber(u.phone);
        const effectiveWaLink = autoRepairEnabled && healed ? healed.whatsappLink : getWhatsAppLink(u.phone);
        const isCurrentlyValid = autoRepairEnabled ? Boolean(healed) : isValidBrazilianPhone(u.phone);

        return {
          user: u,
          healed,
          effectivePhone,
          effectiveFormatted,
          effectiveWaNumber,
          effectiveWaLink,
          isCurrentlyValid
        };
      })
      .filter(({ user: u, isCurrentlyValid }) => {
        // Filtro de telefone válido
        if (onlyValidPhone && !isCurrentlyValid) {
          return false;
        }

        // Filtro de contas ativas
        if (onlyActive && u.isBlocked) {
          return false;
        }

        // Filtro de jogo de origem
        if (selectedGame !== 'all') {
          const game = (u.registeredGame || u.acquisitionGame || '').toLowerCase();
          if (selectedGame === 'bubble' && !game.includes('bubble')) return false;
          if (selectedGame === 'block' && !game.includes('block')) return false;
          if (selectedGame === 'dino' && !game.includes('dino') && !game.includes('t-rex')) return false;
          if (selectedGame === 'raspa' && !game.includes('scratch') && !game.includes('raspa')) return false;
          if (selectedGame === 'subway' && !game.includes('subway') && !game.includes('runner')) return false;
        }

        // Filtro de busca textual
        if (searchFilter.trim()) {
          const q = searchFilter.toLowerCase().trim();
          const phoneDigits = extractDigits(u.phone);
          const nameMatch = (u.name || '').toLowerCase().includes(q);
          const emailMatch = (u.email || '').toLowerCase().includes(q);
          const phoneMatch = (u.phone || '').includes(q) || phoneDigits.includes(q);
          const refMatch = (u.affiliateInfo?.referralCode || '').toLowerCase().includes(q);
          if (!nameMatch && !emailMatch && !phoneMatch && !refMatch) {
            return false;
          }
        }

        return true;
      });
  }, [allInfluencers, healedMap, autoRepairEnabled, onlyValidPhone, onlyActive, selectedGame, searchFilter]);

  if (!isOpen) return null;

  // Ação: Exportar Planilha CSV Completa
  const handleExportCsv = () => {
    if (processedInfluencers.length === 0) {
      onShowToast('Nenhum influenciador encontrado com os critérios selecionados.', 'error');
      return;
    }

    const host = typeof window !== 'undefined' ? window.location.host : 'goalliancehub.com';
    const proto = typeof window !== 'undefined' ? window.location.protocol : 'https:';

    const headers = [
      'Nome',
      'Telefone_Formatado_WhatsApp',
      'Telefone_WhatsApp_Numero',
      'Link_Direto_WhatsApp',
      'Status_Validacao',
      'Metodo_Correcao',
      'Telefone_Original_Digitado',
      'Email',
      'Codigo_Indicacao',
      'Link_Indicacao',
      'Saldo_Jogos_R$',
      'Saldo_Comissoes_R$',
      'Total_Comissoes_Historico_R$',
      'RevShare_Percentual',
      'Total_Indicados',
      'Jogo_Origem',
      'Status_Conta',
      'ID_Usuario',
      'Data_Cadastro'
    ];

    const rows = processedInfluencers.map(({ user: u, healed, effectiveFormatted, effectiveWaNumber, effectiveWaLink, isCurrentlyValid }) => {
      const refCode = u.affiliateInfo?.referralCode || '';
      const refLink = refCode ? `${proto}//${host}/?ref=${refCode}` : '';
      const game = u.registeredGame || u.acquisitionGame || 'g_block_puzzle';
      const status = u.isBlocked ? 'Bloqueada' : 'Ativa';

      let methodDesc = 'Original Válido';
      if (healed?.wasRepaired) {
        methodDesc = healed.label;
      } else if (!isCurrentlyValid) {
        methodDesc = 'Inválido / Incompleto';
      }

      return [
        u.name || 'Influenciador',
        effectiveFormatted,
        effectiveWaNumber,
        effectiveWaLink,
        isCurrentlyValid ? 'SIM' : 'NÃO',
        methodDesc,
        u.phone || 'Não informado',
        u.email || '',
        refCode,
        refLink,
        Number(u.balance || 0).toFixed(2),
        Number(u.affiliateInfo?.affiliateBalance || 0).toFixed(2),
        Number(u.affiliateInfo?.commissionTotal || 0).toFixed(2),
        `${Number(u.affiliateInfo?.revSharePercent || 70).toFixed(0)}%`,
        u.affiliateInfo?.indicationsCount ?? 0,
        game,
        status,
        u.id,
        u.createdAt || ''
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(';'))].join('\n');

    const link = document.createElement('a');
    link.href = encodeURI(csvContent);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileSuffix = autoRepairEnabled ? 'corrigidos_validados' : 'originais';
    const scopeSuffix = onlyValidPhone ? 'validas_whatsapp' : 'todas';
    link.download = `influenciadoras_${scopeSuffix}_${fileSuffix}_${dateStr}.csv`;
    link.click();

    onShowToast(`Exportadas ${processedInfluencers.length} influenciadoras (${onlyValidPhone ? 'Apenas Válidas' : 'Todas'}) em CSV!`, 'success');
  };

  // Ação: Copiar lista de telefones WhatsApp para envio em massa
  const handleCopyPhones = (format: 'newline' | 'comma') => {
    const phones = processedInfluencers
      .map(({ effectiveWaNumber, user }) => effectiveWaNumber || extractDigits(user.phone))
      .filter((num) => Boolean(num) && num.length >= 8);

    if (phones.length === 0) {
      onShowToast('Nenhum telefone encontrado para copiar.', 'error');
      return;
    }

    const textToCopy = format === 'comma' ? phones.join(', ') : phones.join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(textToCopy);
      setCopiedFormat(format);
      setTimeout(() => setCopiedFormat(null), 3000);
      onShowToast(`${phones.length} números de telefone copiados com sucesso!`, 'success');
    }
  };

  // Ação: Baixar lista TXT simples (um número por linha)
  const handleDownloadTxt = () => {
    const phones = processedInfluencers
      .map(({ effectiveWaNumber, user }) => effectiveWaNumber || extractDigits(user.phone))
      .filter((num) => Boolean(num) && num.length >= 8);

    if (phones.length === 0) {
      onShowToast('Nenhum telefone encontrado para download.', 'error');
      return;
    }

    const txtContent = 'data:text/plain;charset=utf-8,' + encodeURIComponent(phones.join('\n'));
    const link = document.createElement('a');
    link.href = txtContent;
    const dateStr = new Date().toISOString().slice(0, 10);
    const scopeSuffix = onlyValidPhone ? 'validas_whatsapp' : 'todas';
    link.download = `telefones_influenciadoras_${scopeSuffix}_${dateStr}.txt`;
    link.click();

    onShowToast(`Download do arquivo TXT com ${phones.length} contatos concluído!`, 'success');
  };

  // Ação: Aplicar e salvar correções de telefones no banco de dados Firestore
  const handleApplyRepairsToDatabase = async () => {
    setApplyingRepairs(true);
    try {
      const token =
        localStorage.getItem('token') ||
        localStorage.getItem('pg_auth_token') ||
        localStorage.getItem('bb_token') ||
        '';

      const res = await fetch('/api/admin/influencers/apply-phone-repairs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok) {
        setRepairsApplied(true);
        onShowToast(data.message || `${data.updatedCount} telefones foram corrigidos e salvos no banco de dados!`, 'success');
      } else {
        onShowToast(data.error || 'Erro ao salvar correções no banco de dados.', 'error');
      }
    } catch {
      onShowToast('Erro de conexão ao salvar correções no banco.', 'error');
    } finally {
      setApplyingRepairs(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-50 via-orange-50/40 to-white">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 shrink-0">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg text-slate-900">
                  Exportar Influenciadoras e Influenciadores
                </h3>
                <IOSBadge variant="orange">Motor de Validação Ativo</IOSBadge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Valida e repara números automaticamente acrescentando ou retirando o 9º dígito, limpando prefixos e padronizando para WhatsApp.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-all cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {/* Opção Principal de Seleção: Todas as Influenciadoras vs Apenas Válidas */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setOnlyValidPhone(false)}
              className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                !onlyValidPhone
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-slate-600" />
              <span>Todas as Influenciadoras</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold">
                {allInfluencers.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setOnlyValidPhone(true)}
              className={`flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                onlyValidPhone
                  ? 'bg-white text-emerald-800 shadow-sm border border-emerald-500/30'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Apenas Válidas com WhatsApp</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                {autoRepairEnabled ? repairMetrics.totalUsable : repairMetrics.originallyValid}
              </span>
            </button>
          </div>

          {/* Barra de Status Compacta e Ação de Salvar Correções */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 bg-slate-50/90 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600 font-medium">
              <span className="font-bold text-slate-800">Diagnóstico:</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                ✅ {repairMetrics.originallyValid} corretos
              </span>
              {repairMetrics.totalRepaired > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold">
                  ⚡ +{repairMetrics.totalRepaired} recuperados (+9 / -9 / prefixos)
                </span>
              )}
              {repairMetrics.unrecoverable > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[11px] font-bold">
                  ⚠️ {repairMetrics.unrecoverable} inválidos
                </span>
              )}
            </div>

            {repairMetrics.totalRepaired > 0 && (
              <IOSButton
                variant="secondary"
                size="sm"
                onClick={handleApplyRepairsToDatabase}
                disabled={applyingRepairs || repairsApplied}
                className="bg-white hover:bg-slate-50 text-slate-800 font-bold border-amber-500/40 shadow-xs shrink-0 cursor-pointer text-xs"
                title="Salva os telefones corrigidos diretamente nos perfis de usuários no banco de dados"
              >
                <Database className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {repairsApplied ? 'Salvo no Banco ✅' : applyingRepairs ? 'Salvando...' : 'Salvar Correções no Banco'}
                </span>
              </IOSButton>
            )}
          </div>

          {/* Filtering Options Control Box */}
          <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/80 space-y-3.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" /> Critérios de Exportação:
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                {processedInfluencers.length} influenciadores selecionados
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Toggle: Auto-Correção Inteligente (+9 / -9) */}
              <button
                type="button"
                onClick={() => setAutoRepairEnabled(!autoRepairEnabled)}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                  autoRepairEnabled
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>Auto-Corrigir (+9/-9)</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Repara números automaticamente
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white ${
                    autoRepairEnabled ? 'bg-amber-600' : 'bg-slate-300'
                  }`}
                >
                  {autoRepairEnabled && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>

              {/* Toggle: Apenas Telefone Válido */}
              <button
                type="button"
                onClick={() => setOnlyValidPhone(!onlyValidPhone)}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                  onlyValidPhone
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Apenas Telefones Válidos</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Descarta nulos e incompletos
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white ${
                    onlyValidPhone ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  {onlyValidPhone && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>

              {/* Toggle: Apenas Contas Ativas */}
              <button
                type="button"
                onClick={() => setOnlyActive(!onlyActive)}
                className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer text-left ${
                  onlyActive
                    ? 'bg-blue-500/10 border-blue-500/30 text-blue-900 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100/70'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Apenas Contas Ativas</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5 truncate">
                    Exclui contas bloqueadas
                  </p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-white ${
                    onlyActive ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  {onlyActive && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
              </button>

              {/* Seletor de Jogo de Origem */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex flex-col justify-center">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Jogo de Origem
                </label>
                <select
                  value={selectedGame}
                  onChange={(e) => setSelectedGame(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-800 bg-transparent border-0 focus:ring-0 cursor-pointer outline-none"
                >
                  <option value="all">🎮 Todos os Jogos</option>
                  <option value="bubble">🫧 Bubble Blast</option>
                  <option value="block">🧩 Block Win</option>
                  <option value="dino">🦖 Gen Dino</option>
                  <option value="raspa">🍀 Raspa Fortuna</option>
                  <option value="subway">🏃 Subway Pay</option>
                </select>
              </div>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrar por nome, telefone, email ou código de indicação..."
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          </div>

          {/* Quick Actions / Download Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 rounded-2xl border border-amber-500/20">
            <div>
              <h4 className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-amber-600" />
                <span>Pronto para Baixar ou Disparar no WhatsApp</span>
              </h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {processedInfluencers.length} influenciadores selecionados com telefones prontos para exportação.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <IOSButton
                variant="primary"
                size="sm"
                onClick={handleExportCsv}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-md shadow-amber-600/20 flex-1 sm:flex-initial"
              >
                <Download className="w-4 h-4" />
                <span>Baixar Planilha CSV</span>
              </IOSButton>

              <IOSButton
                variant="secondary"
                size="sm"
                onClick={() => handleCopyPhones('newline')}
                className="bg-white hover:bg-slate-50 text-slate-800 font-bold border-slate-200 flex-1 sm:flex-initial"
                title="Copia todos os números corrigidos no formato 5511999999999"
              >
                {copiedFormat === 'newline' ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4 text-slate-500" />
                )}
                <span>Copiar WhatsApp</span>
              </IOSButton>

              <IOSButton
                variant="secondary"
                size="sm"
                onClick={handleDownloadTxt}
                className="bg-white hover:bg-slate-50 text-slate-800 font-semibold border-slate-200 hidden md:flex"
                title="Baixa arquivo TXT com 1 número por linha"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Lista TXT</span>
              </IOSButton>
            </div>
          </div>

          {/* Table Preview: List of Influencers with Before/After Diff */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold px-1">
              <span>Prévia dos Influenciadores Selecionados ({processedInfluencers.length}):</span>
              <span className="text-[11px] text-slate-400">
                Mostrando {Math.min(processedInfluencers.length, 60)} de {processedInfluencers.length}
              </span>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-80 overflow-y-auto">
              {processedInfluencers.length === 0 ? (
                <div className="p-8 text-center space-y-1.5">
                  <Phone className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Nenhum influenciador encontrado</p>
                  <p className="text-[11px] text-slate-400">
                    Tente ajustar o termo de busca ou ativar o motor de auto-correção.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {processedInfluencers.slice(0, 60).map(({ user: u, healed, effectiveFormatted, effectiveWaLink, isCurrentlyValid }) => {
                    const wasRepaired = autoRepairEnabled && healed?.wasRepaired;

                    return (
                      <div
                        key={`prev_${u.id}`}
                        className="p-3 sm:px-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-amber-500/15 text-amber-700 font-black text-xs flex items-center justify-center shrink-0">
                            {u.name ? u.name.charAt(0).toUpperCase() : 'I'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-slate-900 truncate">
                                {u.name || 'Influenciador VIP'}
                              </span>

                              {wasRepaired ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                                  {healed?.label}
                                </span>
                              ) : isCurrentlyValid ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 shrink-0">
                                  WhatsApp Válido ✅
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-800 shrink-0">
                                  Telefone Inválido ⚠️
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                              {/* Before & After Diff */}
                              {wasRepaired ? (
                                <div className="flex items-center gap-1 font-mono text-[11px]">
                                  <span className="line-through text-slate-400">{u.phone}</span>
                                  <ArrowRight className="w-2.5 h-2.5 text-amber-600" />
                                  <span className="font-bold text-emerald-700">{effectiveFormatted}</span>
                                </div>
                              ) : (
                                <span className="font-mono text-slate-700 font-semibold">
                                  {effectiveFormatted}
                                </span>
                              )}

                              {u.email && (
                                <>
                                  <span className="text-slate-300">•</span>
                                  <span className="truncate max-w-[150px]">{u.email}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isCurrentlyValid && (
                            <a
                              href={effectiveWaLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                              title="Abrir chat no WhatsApp com o número validado"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span className="hidden sm:inline">WhatsApp</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </a>
                          )}

                          <div className="text-right hidden sm:block">
                            <div className="text-xs font-black text-slate-900 font-mono">
                              R$ {Number(u.balance || 0).toFixed(2)}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              Ref: {u.affiliateInfo?.referralCode || 'N/A'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer Bar */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-medium">
            Planilhas geradas com codificação UTF-8 BOM, prontas para Microsoft Excel, Google Sheets e WhatsApp CRM.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <IOSButton variant="secondary" size="sm" onClick={onClose} className="flex-1 sm:flex-initial">
              Fechar
            </IOSButton>

            <IOSButton
              variant="primary"
              size="sm"
              onClick={handleExportCsv}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold shadow-sm flex-1 sm:flex-initial"
            >
              <Download className="w-4 h-4" />
              <span>Exportar ({processedInfluencers.length})</span>
            </IOSButton>
          </div>
        </div>
      </div>
    </div>
  );
};
