import React, { useState, useEffect } from 'react';
import {
  Wallet,
  Key,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  Lock,
  ExternalLink,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  EyeOff,
  Server,
  Zap,
  Globe,
  Radio,
  CheckCircle2,
  Search,
  Filter
} from 'lucide-react';
import {
  IOSCard,
  IOSBadge,
  IOSButton,
  IOSModalSheet
} from './IOSComponents';

interface DotfyWithdrawalItem {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  status: string;
  createdAt: string;
  pixKey?: {
    id?: string;
    type?: string;
    key?: string;
    name?: string;
  };
  user?: {
    name?: string;
    email?: string;
  };
}

interface DotfyOverviewData {
  success: boolean;
  superAdminEmail: string;
  userIsSuperAdmin: boolean;
  dotfyStatus: 'online' | 'warning' | 'offline';
  balance: {
    available: number;
    pending: number;
    reserved: number;
    total: number;
    availableReais: number;
    pendingReais: number;
    reservedReais: number;
    totalReais: number;
    recentTransactions: Array<{
      id: string;
      type: string;
      amount: number;
      description: string;
      referenceType?: string;
      referenceId?: string;
      balanceAfter?: number;
      createdAt: string;
    }>;
    error?: string | null;
  };
  pixKeys: {
    total: number;
    list: Array<{
      id: string;
      type: string;
      key: string;
      name: string;
      status?: string;
      createdAt?: string;
    }>;
    error?: string | null;
  };
  dotfyWithdrawals?: {
    total: number;
    list: DotfyWithdrawalItem[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
    summary?: {
      totalGrossReais: number;
      totalFeeReais: number;
      totalNetReais: number;
    };
    error?: string | null;
  };
  apiCredentials: {
    activeKeyMasked: string;
    rawActiveKey?: string;
    keys: Array<{
      id: string;
      name: string;
      keyMasked: string;
      rawKey?: string;
      environment: string;
      status: string;
      isDefault: boolean;
      type: string;
      source: string;
    }>;
    webhookSecret?: string;
    webhookUrl?: string;
    affiliateAutoCashoutEnabled?: boolean;
    updatedAt?: string;
    updatedBy?: string;
  };
  affiliateAutoCashout?: {
    enabled: boolean;
    count: number;
    totalAmount: number;
    recent: Array<{
      id: string;
      amount: number;
      userName?: string;
      userEmail?: string;
      dotfyWithdrawalId?: string;
      pixKeyId?: string;
      status: string;
      createdAt: string;
      description?: string;
      paymentMethod?: string;
    }>;
  };
}

interface AdminDotfyTabProps {
  token: string | null;
  currentUserEmail?: string;
  currentUserRole?: string;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminDotfyTab: React.FC<AdminDotfyTabProps> = ({
  token,
  currentUserEmail,
  currentUserRole,
  onShowToast
}) => {
  const [data, setData] = useState<DotfyOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showRawKeys, setShowRawKeys] = useState(false);

  // Modal new PIX key
  const [isAddKeyModalOpen, setIsAddKeyModalOpen] = useState(false);
  const [keyType, setKeyType] = useState('EVP');
  const [keyValue, setKeyValue] = useState('');
  const [keyOwnerName, setKeyOwnerName] = useState('Alliance Depositos');
  const [savingKey, setSavingKey] = useState(false);

  // Modal update API settings
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [newApiKey, setNewApiKey] = useState('');
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState('');
  const [newAffiliateAutoCashout, setNewAffiliateAutoCashout] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [togglingAutoCashout, setTogglingAutoCashout] = useState(false);

  // Dotfy Withdrawals search & status filter
  const [withdrawSearch, setWithdrawSearch] = useState('');
  const [withdrawStatusFilter, setWithdrawStatusFilter] = useState<'ALL' | 'APPROVED' | 'PROCESSING' | 'FAILED'>('ALL');

  const isSuperAdmin = currentUserRole === 'superadmin' || !!data?.userIsSuperAdmin;

  const handleToggleAutoCashout = async () => {
    if (!token) return;
    setTogglingAutoCashout(true);
    try {
      const res = await fetch('/api/admin/dotfy/affiliate-cashout/toggle', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Erro ao alterar status do cashout automático');
      }
      onShowToast(json.message || 'Status do Cashout Automático atualizado!', 'success');
      fetchOverview(true);
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao alternar status do cashout.', 'error');
    } finally {
      setTogglingAutoCashout(false);
    }
  };

  const fetchOverview = async (isManual = false) => {
    if (!token) return;
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/admin/dotfy/overview', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${res.status}`);
      }

      const json = await res.json();
      setData(json);
      if (isManual) {
        onShowToast('Dados da Dotfy sincronizados em tempo real!', 'success');
      }
    } catch (err: any) {
      console.error('Fetch Dotfy overview failed:', err);
      onShowToast(err.message || 'Falha ao consultar API da Dotfy.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [token]);

  const handleCopy = (text: string, label: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedKey(text);
      onShowToast(`${label} copiada!`, 'success');
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      onShowToast(`Conteúdo: ${text}`, 'info');
    }
  };

  const handleCreatePixKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyValue.trim() || !token) return;

    setSavingKey(true);
    try {
      const res = await fetch('/api/admin/dotfy/pix-keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: keyType,
          key: keyValue.trim(),
          name: keyOwnerName.trim() || 'Alliance Pagamentos'
        })
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Erro ao registrar chave PIX na Dotfy');
      }

      onShowToast('Chave PIX registrada na Dotfy com sucesso!', 'success');
      setIsAddKeyModalOpen(false);
      setKeyValue('');
      fetchOverview(true);
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao cadastrar chave PIX.', 'error');
    } finally {
      setSavingKey(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSavingConfig(true);
    try {
      const res = await fetch('/api/admin/dotfy/config', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          activeApiKey: newApiKey.trim() || undefined,
          webhookUrl: newWebhookUrl.trim() || undefined,
          webhookSecret: newWebhookSecret.trim() || undefined,
          affiliateAutoCashoutEnabled: newAffiliateAutoCashout
        })
      });

      const resJson = await res.json();
      if (!res.ok) {
        throw new Error(resJson.error || 'Erro ao salvar configuração.');
      }

      onShowToast('Credenciais e chaves salvas com sucesso!', 'success');
      setIsConfigModalOpen(false);
      fetchOverview(true);
    } catch (err: any) {
      onShowToast(err.message || 'Erro ao salvar configuração.', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(val || 0);
  };

  if (loading && !data) {
    return (
      <div id="dotfy-loading-state" className="flex flex-col items-center justify-center py-20 gap-3">
        <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-xs font-semibold text-slate-500">
          Carregando saldos e chaves da Dotfy em tempo real...
        </p>
      </div>
    );
  }

  return (
    <div id="dotfy-management-tab" className="space-y-6">
      {/* 1. Top Header & Super Admin Notice */}
      <div className="bg-white rounded-2xl border border-black/[0.06] p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white flex items-center justify-center shadow-md shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Dotfy Gateway & Saldo Financeiro
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                API OFICIAL LIVE
              </span>
              {isSuperAdmin && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">
                  <ShieldCheck className="w-3 h-3" />
                  SUPER ADMIN: Acesso Total
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Consulta autorizada ao gateway de pagamentos Dotfy (<code className="text-[11px] font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-700">app.dotfy.com.br</code>)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            id="dotfy-refresh-btn"
            type="button"
            onClick={() => fetchOverview(true)}
            disabled={refreshing}
            className="h-9 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
            <span>{refreshing ? 'Atualizando...' : 'Sincronizar'}</span>
          </button>

          {isSuperAdmin && (
            <button
              id="dotfy-config-btn"
              type="button"
              onClick={() => {
                setNewApiKey(data?.apiCredentials.rawActiveKey || '');
                setNewWebhookUrl(data?.apiCredentials.webhookUrl || '');
                setNewWebhookSecret(data?.apiCredentials.webhookSecret || '');
                setIsConfigModalOpen(true);
              }}
              className="h-9 px-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
            >
              <Key className="w-3.5 h-3.5 text-emerald-400" />
              <span>Gerenciar Chave API</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Error warning if Dotfy responded with status */}
      {data?.balance.error && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-amber-900 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold">Aviso da Integração:</span> {data.balance.error}
          </div>
        </div>
      )}

      {/* 3. Live Balance Hero Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Available Balance */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-5 text-white shadow-md relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between text-emerald-100 text-xs font-medium">
            <span>Saldo Disponível na Dotfy</span>
            <span className="w-2 h-2 rounded-full bg-emerald-300" />
          </div>
          <div className="text-2xl sm:text-3xl font-black tracking-tight mt-2">
            {formatBRL(data?.balance.availableReais || 0)}
          </div>
          <div className="text-[11px] text-emerald-100/80 mt-1 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-300" />
            <span>Líquido para saques e repasses</span>
          </div>
        </div>

        {/* Total Balance */}
        <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Saldo Total (Conta Dotfy)</span>
            <Wallet className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
            {formatBRL(data?.balance.totalReais || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {data?.balance.total ? `${data.balance.total} centavos processados` : 'R$ 0,00 registrado'}
          </div>
        </div>

        {/* Pending Balance */}
        <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Saldo Pendente / Em Trânsito</span>
            <Zap className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
            {formatBRL(data?.balance.pendingReais || 0)}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Aguardando liquidação compensatória
          </div>
        </div>

        {/* Registered PIX Keys Counter */}
        <div className="bg-white rounded-2xl p-5 border border-black/[0.06] shadow-xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>Chaves PIX Cadastradas</span>
            <Key className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 tracking-tight mt-2">
            {data?.pixKeys.total || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
            <span>Chaves ativas para recebimento</span>
            <span className="font-semibold text-emerald-600">Online</span>
          </div>
        </div>
      </div>

      {/* 4. EXCLUSIVE: Affiliate Auto Cashout Dotfy Gateway */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-emerald-50/70 to-teal-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-900">
                  Cashout Automático de Afiliados (Dotfy Gateway)
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 ${
                  data?.affiliateAutoCashout?.enabled !== false
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    data?.affiliateAutoCashout?.enabled !== false ? 'bg-emerald-600 animate-pulse' : 'bg-slate-400'
                  }`} />
                  {data?.affiliateAutoCashout?.enabled !== false ? 'ATIVADO • APROVAÇÃO IMEDIATA' : 'DESATIVADO (MANUAL)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Saques de comissões são aprovados e debitados diretamente via Dotfy Gateway sem precisar de aprovação manual
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleAutoCashout}
              disabled={togglingAutoCashout}
              className={`h-9 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                data?.affiliateAutoCashout?.enabled !== false
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-slate-800 hover:bg-slate-900 text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>
                {togglingAutoCashout
                  ? 'Alterando...'
                  : data?.affiliateAutoCashout?.enabled !== false
                  ? 'Desativar Cashout Automático'
                  : 'Ativar Cashout Automático'}
              </span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-[11px] font-bold text-slate-500 block">Total Saques Automáticos</span>
              <span className="text-xl font-black text-slate-900 mt-1 block">
                {data?.affiliateAutoCashout?.count || 0}
              </span>
              <span className="text-[10px] text-slate-400">Processados via API Dotfy</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-[11px] font-bold text-slate-500 block">Volume Total Sacado</span>
              <span className="text-xl font-black text-emerald-600 mt-1 block">
                {formatBRL(data?.affiliateAutoCashout?.totalAmount || 0)}
              </span>
              <span className="text-[10px] text-slate-400">Comissões pagas automaticamente</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <span className="text-[11px] font-bold text-slate-500 block">Status da Rota Dotfy</span>
              <span className="text-xs font-mono font-bold text-slate-800 mt-1.5 block">
                POST /api/withdrawals
              </span>
              <span className="text-[10px] text-emerald-600 font-semibold">Scope: withdrawals:write</span>
            </div>
          </div>

          {/* Recent Auto-Cashouts Table */}
          <div>
            <h3 className="text-xs font-bold text-slate-800 mb-2 flex items-center justify-between">
              <span>Últimos Saques Automáticos de Afiliados</span>
              <span className="text-[10px] text-slate-400">Sincronização em tempo real</span>
            </h3>

            {(!data?.affiliateAutoCashout?.recent || data.affiliateAutoCashout.recent.length === 0) ? (
              <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-6 text-center text-xs text-slate-500">
                Nenhum saque automático de afiliados registrado ainda.
              </div>
            ) : (
              <div className="border border-slate-200/80 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Afiliado</th>
                      <th className="py-2.5 px-3">Valor</th>
                      <th className="py-2.5 px-3">Dotfy ID</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.affiliateAutoCashout.recent.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{tx.userName || 'Afiliado'}</div>
                          <div className="text-[10px] text-slate-400">{tx.userEmail}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-black text-emerald-600">
                            {formatBRL(tx.amount)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                              {tx.dotfyWithdrawalId || 'clwd_auto'}
                            </span>
                            {tx.dotfyWithdrawalId && (
                              <button
                                type="button"
                                onClick={() => handleCopy(tx.dotfyWithdrawalId!, 'Dotfy ID')}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500"
                                title="Copiar ID"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                            Aprovado Automático
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[10px]">
                          {new Date(tx.createdAt).toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4.5. Section: Saques no Gateway Dotfy (Withdrawals List) */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F9F9FB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Saques no Gateway Dotfy
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  {data?.dotfyWithdrawals?.total ?? data?.dotfyWithdrawals?.list?.length ?? 0} saques
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Histórico de saques processados via API da Dotfy (POST/GET /api/withdrawals)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchOverview(true)}
              disabled={refreshing}
              className="h-8 px-3 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar Saques</span>
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Summary metrics for withdrawals */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Total de Saques</span>
              <span className="text-base font-black text-slate-900 mt-1 block">
                {data?.dotfyWithdrawals?.total ?? data?.dotfyWithdrawals?.list?.length ?? 0}
              </span>
              <span className="text-[10px] text-slate-400">Dotfy Gateway</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Total Bruto Sacado</span>
              <span className="text-base font-black text-slate-900 mt-1 block">
                {formatBRL(data?.dotfyWithdrawals?.summary?.totalGrossReais ?? 0)}
              </span>
              <span className="text-[10px] text-slate-400">Valor debitado</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Taxas Retidas Dotfy</span>
              <span className="text-base font-black text-amber-600 mt-1 block">
                {formatBRL(data?.dotfyWithdrawals?.summary?.totalFeeReais ?? 0)}
              </span>
              <span className="text-[10px] text-amber-700/80 font-medium">R$ 5,00 por saque</span>
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3">
              <span className="text-[11px] font-medium text-slate-500 block">Total Líquido Pago</span>
              <span className="text-base font-black text-emerald-600 mt-1 block">
                {formatBRL(data?.dotfyWithdrawals?.summary?.totalNetReais ?? 0)}
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">Depositado via PIX</span>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={withdrawSearch}
                onChange={(e) => setWithdrawSearch(e.target.value)}
                placeholder="Buscar por ID, chave PIX ou titular..."
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(['ALL', 'APPROVED', 'PROCESSING', 'FAILED'] as const).map((status) => {
                const labelMap = {
                  ALL: 'Todos',
                  APPROVED: 'Concluídos',
                  PROCESSING: 'Processando',
                  FAILED: 'Falhas'
                };
                const isSelected = withdrawStatusFilter === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setWithdrawStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {labelMap[status]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Withdrawals error alert if any */}
          {data?.dotfyWithdrawals?.error && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{data.dotfyWithdrawals.error}</span>
            </div>
          )}

          {/* Withdrawals Table */}
          {(() => {
            const rawList = data?.dotfyWithdrawals?.list || [];
            const filteredList = rawList.filter((item) => {
              const query = withdrawSearch.trim().toLowerCase();
              const matchesQuery = !query || 
                (item.id && item.id.toLowerCase().includes(query)) ||
                (item.pixKey?.key && item.pixKey.key.toLowerCase().includes(query)) ||
                (item.pixKey?.name && item.pixKey.name.toLowerCase().includes(query)) ||
                (item.user?.name && item.user.name.toLowerCase().includes(query));

              const st = (item.status || '').toUpperCase();
              let matchesStatus = true;
              if (withdrawStatusFilter === 'APPROVED') {
                matchesStatus = st === 'APPROVED' || st === 'COMPLETED' || st === 'SUCCESS';
              } else if (withdrawStatusFilter === 'PROCESSING') {
                matchesStatus = st === 'PROCESSING' || st === 'PENDING';
              } else if (withdrawStatusFilter === 'FAILED') {
                matchesStatus = st === 'FAILED' || st === 'REJECTED' || st === 'CANCELED';
              }

              return matchesQuery && matchesStatus;
            });

            if (filteredList.length === 0) {
              return (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-8 text-center text-xs text-slate-500">
                  <ArrowUpRight className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-700">Nenhum saque encontrado</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {rawList.length === 0
                      ? 'Nenhum saque foi solicitado na conta da Dotfy até o momento.'
                      : 'Nenhum saque corresponde aos filtros selecionados.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="border border-slate-200/80 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">ID do Saque</th>
                      <th className="py-2.5 px-3">Destinatário / Chave PIX</th>
                      <th className="py-2.5 px-3">Valor Bruto</th>
                      <th className="py-2.5 px-3">Taxa Dotfy</th>
                      <th className="py-2.5 px-3">Valor Líquido</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Data / Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredList.map((wd) => {
                      const st = (wd.status || '').toUpperCase();
                      const isSuccess = st === 'COMPLETED' || st === 'APPROVED' || st === 'SUCCESS';
                      const isPending = st === 'PROCESSING' || st === 'PENDING';
                      const isFailed = st === 'FAILED' || st === 'REJECTED' || st === 'CANCELED';

                      const grossReais = (wd.amount || 0) / 100;
                      const feeReais = (wd.fee || 0) / 100;
                      const netReais = (wd.netAmount || 0) / 100;

                      return (
                        <tr key={wd.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                {wd.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(wd.id, 'ID do Saque')}
                                className="p-1 hover:bg-slate-200 rounded text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                                title="Copiar ID"
                              >
                                {copiedKey === wd.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">
                              {wd.pixKey?.name || wd.user?.name || 'Destinatário'}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono mt-0.5">
                              {wd.pixKey?.type && (
                                <span className="text-[9px] font-bold px-1 rounded bg-indigo-50 text-indigo-700">
                                  {wd.pixKey.type}
                                </span>
                              )}
                              <span>{wd.pixKey?.key || 'Chave PIX'}</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {formatBRL(grossReais)}
                          </td>

                          <td className="py-2.5 px-3 text-amber-600 font-medium">
                            - {formatBRL(feeReais)}
                          </td>

                          <td className="py-2.5 px-3 font-black text-emerald-600">
                            {formatBRL(netReais)}
                          </td>

                          <td className="py-2.5 px-3">
                            {isSuccess && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Concluído
                              </span>
                            )}
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                Processando
                              </span>
                            )}
                            {isFailed && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Falhou
                              </span>
                            )}
                            {!isSuccess && !isPending && !isFailed && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                {wd.status || 'N/A'}
                              </span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-slate-400 text-[10px] whitespace-nowrap">
                            {wd.createdAt ? new Date(wd.createdAt).toLocaleString('pt-BR') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      </div>

      {/* 5. Section: Registered API Keys & Tokens */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F9F9FB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Chaves de API Cadastradas (Dotfy)
              </h2>
              <p className="text-[11px] text-slate-500">
                Credenciais de autenticação Bearer para comunicação com a API da Dotfy
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Criptografia AES-256 Ativa
            </span>
          </div>
        </div>

        <div className="divide-y divide-black/[0.04]">
          {data?.apiCredentials.keys.map((k) => {
            const displayToken = k.keyMasked;

            return (
              <div key={k.id} className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-3.5 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Radio className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-xs text-slate-900">{k.name}</span>
                      {k.isDefault && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          ATIVA EM PRODUÇÃO
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                        {k.environment}
                      </span>
                    </div>

                    <div className="mt-1 flex items-center gap-2">
                      <code className="text-xs font-mono bg-slate-100 border border-slate-200 px-2 py-1 rounded-md text-slate-800 break-all select-all">
                        {displayToken}
                      </code>
                      <button
                        type="button"
                        onClick={() => handleCopy(k.keyMasked, 'Token Mascarado de Segurança')}
                        className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 cursor-pointer transition-colors"
                        title="Copiar Identificador Protegido"
                      >
                        {copiedKey === k.keyMasked ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    <div className="mt-1 text-[11px] text-slate-400">
                      Origem: <span className="text-slate-600 font-medium">{k.source}</span> • Formato: <span className="text-slate-600 font-medium">{k.type}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start md:self-auto text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Conectada e Blindada
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Webhook Endpoint Info */}
        <div className="p-4 bg-slate-50/80 border-t border-black/[0.04] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Server className="w-4 h-4 text-slate-400 shrink-0" />
            <span>Endpoint de Retorno (Webhook):</span>
            <code className="font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px] text-slate-800">
              {data?.apiCredentials.webhookUrl || 'https://goalliancehub.com/api/webhooks/pix'}
            </code>
          </div>

          <button
            type="button"
            onClick={() => handleCopy(data?.apiCredentials.webhookUrl || 'https://goalliancehub.com/api/webhooks/pix', 'URL do Webhook')}
            className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar Webhook</span>
          </button>
        </div>
      </div>

      {/* 5. Section: Registered PIX Keys in Dotfy */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/[0.05] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F9F9FB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Chaves PIX Cadastradas na Dotfy ({data?.pixKeys.total || 0})
              </h2>
              <p className="text-[11px] text-slate-500">
                Chaves bancárias habilitadas diretamente na Dotfy para emissão e liquidação
              </p>
            </div>
          </div>

          <button
            id="dotfy-add-pix-key-btn"
            type="button"
            onClick={() => setIsAddKeyModalOpen(true)}
            className="h-8 px-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nova Chave PIX</span>
          </button>
        </div>

        {data?.pixKeys.list && data.pixKeys.list.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F2F2F7] text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-black/[0.04]">
                <tr>
                  <th className="py-3 px-4">Tipo</th>
                  <th className="py-3 px-4">Chave PIX</th>
                  <th className="py-3 px-4">Identificação / Titular</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/[0.04]">
                {data.pixKeys.list.map((pk) => (
                  <tr key={pk.id || pk.key} className="hover:bg-black/[0.015] transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase">
                        {pk.type || 'EVP'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {pk.key}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-medium">
                      {pk.name || 'Alliance Depositos'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        {pk.status || 'Ativa'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopy(pk.key, 'Chave PIX')}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                        title="Copiar Chave"
                      >
                        {copiedKey === pk.key ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-xs">
            <Key className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-600">Nenhuma chave cadastrada na Dotfy</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Clique no botão acima para cadastrar a primeira chave PIX na sua conta Dotfy.
            </p>
          </div>
        )}
      </div>

      {/* 6. Section: Recent Live Dotfy Transactions */}
      <div className="bg-white rounded-2xl border border-black/[0.06] shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-black/[0.05] flex items-center justify-between bg-[#F9F9FB]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Últimas Movimentações na Dotfy (Extrato Bancário)
              </h2>
              <p className="text-[11px] text-slate-500">
                Histórico recente de créditos PIX recebidos e débitos de saques processados
              </p>
            </div>
          </div>
        </div>

        {data?.balance.recentTransactions && data.balance.recentTransactions.length > 0 ? (
          <div className="divide-y divide-black/[0.04]">
            {data.balance.recentTransactions.map((tx) => {
              const isCredit = tx.type === 'CREDIT' || tx.amount > 0;
              const valInReais = Math.abs(tx.amount) / 100;

              return (
                <div key={tx.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                    }`}>
                      {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {tx.description || (isCredit ? 'PIX recebido' : 'Saque processado')}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleString('pt-BR') : '—'} • Ref: <span className="font-mono text-[10px]">{tx.referenceId || tx.id}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-xs font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {isCredit ? '+' : '-'} {formatBRL(valInReais)}
                    </div>
                    {tx.balanceAfter !== undefined && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Saldo após: {formatBRL(tx.balanceAfter / 100)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-400 text-xs">
            Nenhuma transação recente encontrada no extrato Dotfy.
          </div>
        )}
      </div>

      {/* MODAL: Cadastrar Nova Chave PIX */}
      <IOSModalSheet
        isOpen={isAddKeyModalOpen}
        onClose={() => setIsAddKeyModalOpen(false)}
        title="Cadastrar Chave PIX na Dotfy"
      >
        <form onSubmit={handleCreatePixKey} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Tipo de Chave</label>
            <select
              value={keyType}
              onChange={(e) => setKeyType(e.target.value)}
              className="w-full h-10 px-3 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-emerald-600 focus:outline-none transition-all"
            >
              <option value="EVP">Chave Aleatória (EVP)</option>
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
              <option value="EMAIL">E-mail</option>
              <option value="PHONE">Telefone</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Chave PIX</label>
            <input
              type="text"
              value={keyValue}
              onChange={(e) => setKeyValue(e.target.value)}
              placeholder={keyType === 'EVP' ? 'Ex: a1b2c3d4-e5f6-7890...' : 'Digite a chave correspondente'}
              className="w-full h-10 px-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-emerald-600 focus:outline-none transition-all font-mono"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Nome do Titular / Descrição</label>
            <input
              type="text"
              value={keyOwnerName}
              onChange={(e) => setKeyOwnerName(e.target.value)}
              placeholder="Ex: Alliance Depositos"
              className="w-full h-10 px-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-emerald-600 focus:outline-none transition-all"
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl text-[11px] text-emerald-800 leading-relaxed">
            Esta chave será sincronizada instantaneamente na API oficial da Dotfy para receber pagamentos e liquidações.
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={savingKey}
              className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {savingKey ? 'Cadastrando na Dotfy...' : 'Salvar Chave PIX'}
            </button>
            <button
              type="button"
              onClick={() => setIsAddKeyModalOpen(false)}
              className="px-4 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      </IOSModalSheet>

      {/* MODAL: Configurar Credenciais Dotfy */}
      <IOSModalSheet
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        title="Gerenciar Credenciais Dotfy (Super Admin)"
      >
        <form onSubmit={handleSaveConfig} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Token de Produção (API Key Bearer)</label>
            <input
              type="text"
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              placeholder="vk_live_..."
              className="w-full h-10 px-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-emerald-600 focus:outline-none transition-all font-mono"
            />
            <p className="text-[10px] text-slate-400">
              Chave fornecida no painel Dotfy em <span className="font-semibold">Configurações &gt; API</span>.
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">URL do Webhook (Notificação de PIX)</label>
            <input
              type="url"
              value={newWebhookUrl}
              onChange={(e) => setNewWebhookUrl(e.target.value)}
              placeholder="https://goalliancehub.com/api/webhooks/pix"
              className="w-full h-10 px-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-emerald-600 focus:outline-none transition-all font-mono"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Segredo HMAC do Webhook (Opcional)</label>
            <input
              type="password"
              value={newWebhookSecret}
              onChange={(e) => setNewWebhookSecret(e.target.value)}
              placeholder="••••••••••••"
              className="w-full h-10 px-3.5 bg-[#767680]/10 focus:bg-white text-slate-900 text-xs rounded-xl border border-transparent focus:border-emerald-600 focus:outline-none transition-all"
            />
          </div>

          <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Controle Exclusivo Super Admin</span>
            </div>
            <p>
              Alterações salvas aqui terão efeito imediato para todas as cobranças PIX geradas e consultas de saldo.
            </p>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-800">Cashout Automático de Afiliados:</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newAffiliateAutoCashout}
                  onChange={(e) => setNewAffiliateAutoCashout(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                />
                <span className="text-xs font-semibold text-slate-700">Habilitado</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <button
              type="submit"
              disabled={savingConfig}
              className="flex-1 h-10 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
            </button>
            <button
              type="button"
              onClick={() => setIsConfigModalOpen(false)}
              className="px-4 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      </IOSModalSheet>
    </div>
  );
};
