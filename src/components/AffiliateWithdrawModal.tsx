import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import {
  Loader2,
  AlertCircle,
  ShieldCheck,
  Wallet,
  ArrowUpRight,
  CheckCircle2,
  Zap,
  Clock,
  Coins,
  ExternalLink,
  Copy,
  Check,
  ShieldAlert
} from 'lucide-react';

interface AffiliateWithdrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  affiliateBalance: number;
  withdrawFee?: number;
  onWithdrawSuccess: (newBalance: number) => void;
  onShowToast?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

interface SavedPixKey {
  id: string;
  type: string;
  key: string;
  status?: string;
  name?: string;
}

export const AffiliateWithdrawModal: React.FC<AffiliateWithdrawModalProps> = ({
  isOpen,
  onClose,
  affiliateBalance,
  withdrawFee = 0,
  onWithdrawSuccess,
  onShowToast,
}) => {
  const minWithdraw = 20.0;
  const fallbackFee = typeof withdrawFee === 'number' && !isNaN(withdrawFee) && withdrawFee >= 0 ? withdrawFee : 0;
  const [liveFee, setLiveFee] = useState<number>(fallbackFee);
  const [amount, setAmount] = useState<string>(minWithdraw.toString());
  const [pixKeyType, setPixKeyType] = useState<'cpf' | 'cnpj' | 'email' | 'phone' | 'random'>('cpf');
  const [pixKey, setPixKey] = useState<string>('');
  const [isAutoCashout, setIsAutoCashout] = useState<boolean>(true); // Default to automatic Dotfy cashout!
  const [autoWithdrawBlocked, setAutoWithdrawBlocked] = useState<boolean>(false);
  const [withdrawBlocked, setWithdrawBlocked] = useState<boolean>(false);
  const [savedKeys, setSavedKeys] = useState<SavedPixKey[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<boolean>(false);

  // Keep live fee in sync when prop updates
  useEffect(() => {
    if (typeof withdrawFee === 'number' && !isNaN(withdrawFee) && withdrawFee >= 0) {
      setLiveFee(withdrawFee);
    }
  }, [withdrawFee]);

  // Fetch latest fee & saved keys whenever modal opens
  useEffect(() => {
    if (!isOpen) {
      setSuccessReceipt(null);
      return;
    }
    setError(null);
    setSuccessReceipt(null);

    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (!token) return;

    // 1. Get affiliate info
    fetch('/api/affiliates/info', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          if (typeof data.withdrawFee === 'number' && !isNaN(data.withdrawFee)) {
            setLiveFee(data.withdrawFee);
          }
          if (typeof data.autoWithdrawBlocked === 'boolean') {
            setAutoWithdrawBlocked(data.autoWithdrawBlocked);
            if (data.autoWithdrawBlocked) {
              setIsAutoCashout(false); // Forced to manual queue by admin
            } else {
              setIsAutoCashout(true); // Default instant auto cashout
            }
          }
          if (typeof data.withdrawBlocked === 'boolean') {
            setWithdrawBlocked(data.withdrawBlocked);
          }
        }
      })
      .catch((err) => {
        console.error('Erro ao atualizar informações de saque do afiliado:', err);
      });

    // 2. Fetch saved PIX keys
    const loadKeys = () => {
      fetch('/api/pix-keys', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          const list = Array.isArray(data?.pixKeys) ? data.pixKeys : [];
          setSavedKeys(list);
          if (list.length > 0) {
            const firstKey = list[0];
            setSelectedKeyId((prev) => prev || firstKey.id || firstKey.key);
            setPixKey((prev) => prev || firstKey.key);
            const rawType = (firstKey.type || 'CPF').toLowerCase();
            if (['cpf', 'cnpj', 'email', 'phone', 'random'].includes(rawType)) {
              setPixKeyType(rawType as any);
            }
          }
        })
        .catch(() => {
          // Ignore fallback
        });
    };

    loadKeys();
    window.addEventListener('pix_keys_updated', loadKeys);
    return () => {
      window.removeEventListener('pix_keys_updated', loadKeys);
    };
  }, [isOpen]);

  const currentFee = liveFee;
  const numVal = parseFloat(amount.replace(',', '.')) || 0;
  const netAmount = Math.max(0, numVal - currentFee);

  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const handleSelectAll = () => {
    if (affiliateBalance > 0) {
      setAmount(affiliateBalance.toFixed(2));
    }
  };

  const handleSelectSavedKey = (k: SavedPixKey) => {
    setSelectedKeyId(k.id);
    setPixKey(k.key);
    const rawType = (k.type || 'CPF').toLowerCase();
    if (['cpf', 'cnpj', 'email', 'phone', 'random'].includes(rawType)) {
      setPixKeyType(rawType as any);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val < minWithdraw) {
      setError(`O valor mínimo para saque de comissões é de R$ ${minWithdraw.toFixed(2).replace('.', ',')}.`);
      return;
    }

    if (currentFee > 0 && val <= currentFee) {
      setError(`O valor do saque precisa ser maior que a taxa de saque (${formatCurrency(currentFee)}).`);
      return;
    }

    if (val > affiliateBalance) {
      setError(`Saldo de comissões insuficiente. Disponível: ${formatCurrency(affiliateBalance)}`);
      return;
    }

    if (!pixKey.trim()) {
      setError('Por favor, informe a chave PIX de destino.');
      return;
    }

    const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token') || localStorage.getItem('auth_token');
    if (!token) {
      setError('Sessão expirada. Faça login novamente.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/affiliates/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: val,
          pixKey: `[${pixKeyType.toUpperCase()}] ${pixKey.trim()}`,
          pixKeyType: pixKeyType.toUpperCase(),
          pixKeyId: selectedKeyId || undefined,
          autoCashout: isAutoCashout,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onWithdrawSuccess(data.affiliateBalance);
        if (data.isAutoCashout) {
          setSuccessReceipt({
            amount: val,
            netAmount: data.netAmount ?? netAmount,
            fee: data.withdrawFee ?? currentFee,
            dotfyId: data.dotfyWithdrawal?.id || data.transaction?.dotfyWithdrawalId || 'clwd_auto',
            pixKey: pixKey.trim(),
            pixKeyType: pixKeyType.toUpperCase(),
            newBalance: data.affiliateBalance,
          });
          if (onShowToast) {
            onShowToast(data.message || `Cashout de ${formatCurrency(val)} aprovado automaticamente na Dotfy!`, 'success');
          }
        } else {
          if (onShowToast) {
            onShowToast(data.message || `Solicitação de saque de ${formatCurrency(val)} enviada com sucesso!`, 'success');
          }
          onClose();
        }
      } else {
        let errMsg = data.error || 'Erro ao processar saque de comissões.';
        const lower = errMsg.toLowerCase();
        if ((lower.includes('saldo insuficiente') && (lower.includes('dotfy') || lower.includes('gateway'))) || lower.includes('dotfy gateway')) {
          errMsg = 'Os saques estão em manutenção temporária. Tente novamente em 30 minutos. O seu saldo de comissões permanece intacto.';
        }
        setError(errMsg);
      }
    } catch (err: any) {
      setError('Erro de conexão ao processar o saque. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Saque de Comissões de Afiliado">
      {successReceipt ? (
        <div className="space-y-4 pt-1 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 border border-emerald-300 rounded-full mx-auto flex items-center justify-center text-emerald-600 shadow-sm">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" />
            </div>

            <div>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-600 text-white shadow-xs">
                <Zap className="w-3 h-3 fill-current" />
                CASHOUT AUTOMÁTICO APROVADO
              </span>
              <h3 className="text-xl font-black text-emerald-950 mt-2">
                {formatCurrency(successReceipt.netAmount)}
              </h3>
              <p className="text-xs text-emerald-800 font-semibold mt-0.5">
                Enviado diretamente via Dotfy Gateway para sua chave PIX
              </p>
            </div>

            <div className="bg-white/90 border border-emerald-200/80 rounded-xl p-3 text-left space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>Gateway Processador:</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  Dotfy API Oficial
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>Status de Aprovação:</span>
                <span className="font-bold text-emerald-600">Aprovado Automático (Sem Fila)</span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px]">
                <span>Chave PIX Destino:</span>
                <span className="font-mono font-bold text-slate-800">
                  [{successReceipt.pixKeyType}] {successReceipt.pixKey}
                </span>
              </div>
              <div className="flex justify-between items-center text-slate-500 text-[11px] pt-1 border-t border-slate-100">
                <span>Dotfy Withdrawal ID:</span>
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                    {successReceipt.dotfyId}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopyId(successReceipt.dotfyId)}
                    className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
                    title="Copiar ID da Dotfy"
                  >
                    {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-emerald-700 font-medium">
              Novo Saldo de Afiliado: <span className="font-bold">{formatCurrency(successReceipt.newBalance)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-sm"
          >
            Concluir e Fechar
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Balance Card Warning - Affiliate Balance */}
          <div className="bg-emerald-50 border border-emerald-200/80 rounded-2xl p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                Saldo Disponível de Afiliado
              </span>
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Coins className="w-3 h-3 text-emerald-600" />
                Comissões Hub
              </span>
            </div>
            <div className="flex items-baseline justify-between pt-1">
              <span className="text-2xl font-black text-emerald-900">
                {formatCurrency(affiliateBalance)}
              </span>
              <button
                type="button"
                onClick={handleSelectAll}
                disabled={affiliateBalance <= 0}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer disabled:opacity-40"
              >
                Sacar tudo
              </button>
            </div>
            <p className="text-[10px] text-emerald-700 font-medium pt-1">
              Este saldo provém exclusivamente das suas comissões de indicação de afiliados.
            </p>
          </div>

          {/* Hard Withdraw Block Warning */}
          {withdrawBlocked && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <strong className="font-bold text-rose-900 block text-sm">Saques Temporariamente Desativados</strong>
                <p className="mt-0.5 text-[11px] text-rose-700 leading-relaxed">
                  Os saques da sua conta foram pausados pela administração para verificação de segurança. Entre em contato com o suporte para solicitar a liberação.
                </p>
              </div>
            </div>
          )}

          {/* Mode Selector: Cashout Automático Dotfy vs Manual */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>Método de Liberação</span>
              <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-wider">
                Exclusivo Afiliados
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={autoWithdrawBlocked}
                onClick={() => !autoWithdrawBlocked && setIsAutoCashout(true)}
                className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                  autoWithdrawBlocked
                    ? 'opacity-40 bg-slate-100 border-slate-200 cursor-not-allowed'
                    : isAutoCashout
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-xs ring-1 ring-emerald-500 cursor-pointer'
                    : 'border-slate-200 bg-white hover:bg-slate-50 cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                    isAutoCashout && !autoWithdrawBlocked ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Zap className="w-3.5 h-3.5 fill-current" />
                  </div>
                  <span className={`text-xs font-black ${isAutoCashout && !autoWithdrawBlocked ? 'text-emerald-950' : 'text-slate-800'}`}>
                    Dotfy Automático
                  </span>
                </div>
                <div className="mt-1.5 space-y-1">
                  <span className={`inline-block text-[9px] font-extrabold px-1.5 py-0.2 rounded ${
                    autoWithdrawBlocked
                      ? 'bg-slate-200 text-slate-600'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {autoWithdrawBlocked ? 'Bloqueado p/ Admin' : 'Aprovação Instantânea'}
                  </span>
                  <p className="text-[10px] text-slate-500 leading-tight">
                    {autoWithdrawBlocked
                      ? 'Admin configurou sua conta para análise manual.'
                      : 'Saca direto da Dotfy sem precisar de aprovação manual.'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setIsAutoCashout(false)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  !isAutoCashout || autoWithdrawBlocked
                    ? 'border-slate-800 bg-slate-50 shadow-xs ring-1 ring-slate-800'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center ${
                    !isAutoCashout || autoWithdrawBlocked ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-xs font-bold ${!isAutoCashout || autoWithdrawBlocked ? 'text-slate-950' : 'text-slate-700'}`}>
                    Saque Convencional
                  </span>
                </div>
                <div className="mt-1.5 space-y-1">
                  <span className="inline-block text-[9px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                    Fila de Aprovação
                  </span>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    Solicitação enviada para análise manual da administração.
                  </p>
                </div>
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Valor do Saque (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-sm text-slate-400">
                R$
              </span>
              <input
                type="number"
                step="0.01"
                min={minWithdraw}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0,00"
                required
                className="w-full h-11 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
              />
            </div>
            <span className="text-[10px] text-slate-400 font-medium block">
              Valor mínimo para saque de afiliados: {formatCurrency(minWithdraw)}
            </span>
          </div>

          {/* Saved Keys Quick Selector (if any) */}
          {savedKeys.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                Chaves PIX Cadastradas na Conta
              </label>
              <div className="flex flex-wrap gap-1.5">
                {savedKeys.map((k) => {
                  const currentId = k.id || k.key;
                  const isSelected = (selectedKeyId === currentId || selectedKeyId === k.id) && pixKey === k.key;
                  return (
                    <button
                      key={currentId}
                      type="button"
                      onClick={() => handleSelectSavedKey(k)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="text-[10px] font-black uppercase opacity-80">
                        {k.type}
                      </span>
                      <span className="font-mono font-semibold truncate max-w-[140px]">
                        {k.key}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* PIX Key Type Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Tipo de Chave PIX
            </label>
            <div className="grid grid-cols-5 gap-1">
              {[
                { id: 'cpf', label: 'CPF' },
                { id: 'cnpj', label: 'CNPJ' },
                { id: 'email', label: 'E-mail' },
                { id: 'phone', label: 'Telefone' },
                { id: 'random', label: 'Aleatória' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setPixKeyType(t.id as any);
                    setSelectedKeyId('');
                  }}
                  className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    pixKeyType === t.id
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* PIX Key Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              Chave PIX de Destino
            </label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => {
                setPixKey(e.target.value);
                setSelectedKeyId('');
              }}
              placeholder={
                pixKeyType === 'cpf'
                  ? '000.000.000-00'
                  : pixKeyType === 'cnpj'
                  ? '00.000.000/0001-00'
                  : pixKeyType === 'email'
                  ? 'seu@email.com'
                  : pixKeyType === 'phone'
                  ? '(11) 99999-9999'
                  : 'Chave aleatória UUID'
              }
              required
              className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>

          {/* Resumo de Saque de Comissões & Taxa */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-500">
              <span>Valor Solicitado</span>
              <span className="font-semibold text-slate-800">
                {formatCurrency(numVal > 0 ? numVal : 0)}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Taxa de Saque de Afiliado</span>
              <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                currentFee > 0
                  ? 'text-amber-700 bg-amber-50 border border-amber-200'
                  : 'text-emerald-700 bg-emerald-50 border border-emerald-200'
              }`}>
                {currentFee > 0 ? formatCurrency(currentFee) : 'Grátis (R$ 0,00)'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Processamento</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                {isAutoCashout ? (
                  <>
                    <Zap className="w-3 h-3 text-emerald-600 fill-current" />
                    Dotfy API Direto (Sem Espera)
                  </>
                ) : (
                  <>
                    <Clock className="w-3 h-3 text-slate-500" />
                    Aprovação Manual
                  </>
                )}
              </span>
            </div>
            <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between font-bold text-slate-900">
              <span>Valor Líquido a Receber via PIX</span>
              <span className="text-emerald-600 text-sm font-extrabold">
                {formatCurrency(netAmount > 0 ? netAmount : 0)}
              </span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || affiliateBalance < minWithdraw || withdrawBlocked}
            className={`w-full h-12 text-white rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] ${
              withdrawBlocked
                ? 'bg-slate-400'
                : isAutoCashout
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-slate-900 hover:bg-slate-800'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>
                  {isAutoCashout
                    ? 'Sacando diretamente via Dotfy...'
                    : 'Enviando solicitação de saque...'}
                </span>
              </>
            ) : withdrawBlocked ? (
              <>
                <ShieldAlert className="w-4 h-4" />
                <span>Saques Desativados para sua Conta</span>
              </>
            ) : (
              <>
                {isAutoCashout ? (
                  <>
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Confirmar Cashout Automático Dotfy</span>
                  </>
                ) : (
                  <>
                    <ArrowUpRight className="w-4 h-4" />
                    <span>Enviar Solicitação de Saque</span>
                  </>
                )}
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {isAutoCashout
                ? 'Cashout instantâneo via Dotfy Gateway • Chave PIX aprovada automaticamente'
                : 'Programa Oficial de Afiliados'}
            </span>
          </div>
        </form>
      )}
    </Modal>
  );
};
