import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { KeyRound, ShieldCheck, Plus, Loader2, AlertCircle, ArrowLeft, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface PixKey {
  id: string;
  type: string;
  key: string;
  name: string;
  isDefault?: boolean;
  isVerified?: boolean;
  status: string;
  rejectionReason?: string | null;
  createdAt?: string;
}

interface PixKeysModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  userName?: string;
  initialView?: 'list' | 'add';
  onSuccess?: (message: string, pixKeyData?: any) => void;
}

export const PixKeysModal: React.FC<PixKeysModalProps> = ({
  isOpen,
  onClose,
  token,
  userName = '',
  initialView = 'list',
  onSuccess,
}) => {
  const [view, setView] = useState<'list' | 'add'>(initialView);
  const [pixKeys, setPixKeys] = useState<PixKey[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Form State
  const [type, setType] = useState<'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE'>('CPF');
  const [key, setKey] = useState('');
  const [name, setName] = useState(userName || 'Conta Principal');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setView(initialView);
      fetchPixKeys();
    }
  }, [isOpen, initialView, token]);

  const fetchPixKeys = async () => {
    if (!token) return;
    setLoadingList(true);
    try {
      const res = await fetch('/api/pix-keys', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.pixKeys)) {
        setPixKeys(data.pixKeys);
      }
    } catch (err) {
      console.error('Erro ao buscar chaves PIX:', err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleCreatePixKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError('Por favor, informe o valor da chave PIX.');
      return;
    }
    if (!name.trim()) {
      setError('Por favor, informe o nome da conta.');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const res = await fetch('/api/pix-keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          type,
          key: key.trim(),
          name: name.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Erro ao cadastrar chave PIX.');
      }

      if (data.pixKey) {
        setPixKeys((prev) => [data.pixKey, ...prev]);
      }

      if (onSuccess) {
        onSuccess(
          data.message || 'Chave PIX cadastrada e enviada para aprovação com sucesso!',
          data.pixKey
        );
      }

      // Reset form & view
      setKey('');
      setView('list');
      fetchPixKeys();
    } catch (err: any) {
      setError(err.message || 'Não foi possível cadastrar a chave PIX.');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const st = (status || '').toUpperCase();
    if (st === 'APPROVED' || st === 'APROVADO') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Aprovada
        </span>
      );
    }
    if (st === 'REJECTED' || st === 'RECUSADA') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
          <XCircle className="w-3 h-3 text-red-600" />
          Recusada
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
        <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
        Em Análise
      </span>
    );
  };

  const getPlaceholder = () => {
    switch (type) {
      case 'CPF':
        return '000.000.000-00';
      case 'CNPJ':
        return '00.000.000/0001-00';
      case 'EMAIL':
        return 'seu.email@exemplo.com';
      case 'PHONE':
        return '(11) 99999-9999';
      default:
        return 'Digite sua chave PIX';
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={view === 'list' ? 'Minhas Chaves PIX' : 'Cadastrar Nova Chave PIX'}
    >
      <div className="space-y-4 pt-1">
        {view === 'list' ? (
          <>
            {/* Header / Intro */}
            <div className="p-3 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#111111] text-white flex items-center justify-center shrink-0">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#111111]">Chaves de Recebimento</h4>
                  <p className="text-[11px] text-[#737373]">Suas chaves vinculadas no Dotfy Gateway</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setView('add')}
                className="h-8 px-3 bg-[#111111] hover:bg-black text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova</span>
              </button>
            </div>

            {/* List of keys */}
            {loadingList ? (
              <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#111111]" />
                <span className="text-xs text-[#737373] font-medium">Carregando chaves cadastradas...</span>
              </div>
            ) : pixKeys.length === 0 ? (
              <div className="py-8 text-center bg-[#FAFAFA] border border-dashed border-[#E5E5E5] rounded-2xl p-6">
                <KeyRound className="w-8 h-8 text-[#A3A3A3] mx-auto mb-2" />
                <h5 className="font-bold text-xs text-[#111111]">Nenhuma chave PIX encontrada</h5>
                <p className="text-[11px] text-[#737373] mt-1 max-w-xs mx-auto">
                  Você ainda não cadastrou nenhuma chave de recebimento. Cadastre uma chave para poder realizar saques.
                </p>
                <button
                  type="button"
                  onClick={() => setView('add')}
                  className="mt-4 h-9 px-4 bg-[#111111] text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Chave PIX</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {pixKeys.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="p-3.5 bg-white rounded-xl border border-[#E5E5E5] flex items-center justify-between gap-3 hover:border-[#111111] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center shrink-0">
                        <KeyRound className="w-4 h-4 text-[#111111]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h5 className="font-bold text-xs text-[#111111] truncate">{item.name}</h5>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-[#F5F5F5] text-[#737373] rounded border border-[#E5E5E5]">
                            {item.type}
                          </span>
                        </div>
                        <p className="text-xs font-mono font-semibold text-[#111111] truncate mt-0.5">
                          {item.key}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">{getStatusBadge(item.status)}</div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full h-11 bg-[#F5F5F5] hover:bg-[#ECECEC] text-[#111111] rounded-xl font-bold text-xs transition-colors cursor-pointer border border-[#E5E5E5]"
            >
              Fechar
            </button>
          </>
        ) : (
          /* ADD VIEW */
          <form onSubmit={handleCreatePixKey} className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setView('list')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#737373] hover:text-[#111111] cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Voltar para a lista</span>
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Tipo de Chave Tabs */}
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1.5">
                Tipo de Chave PIX
              </label>
              <div className="grid grid-cols-4 gap-1 p-1 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5]">
                {(['CPF', 'CNPJ', 'EMAIL', 'PHONE'] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setType(item);
                      setError(null);
                    }}
                    className={`py-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                      type === item
                        ? 'bg-[#111111] text-white shadow-xs'
                        : 'text-[#737373] hover:text-[#111111]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            {/* Valor da Chave */}
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Chave PIX ({type})
              </label>
              <input
                type={type === 'EMAIL' ? 'email' : 'text'}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={getPlaceholder()}
                required
                className="w-full h-11 px-3.5 bg-white border border-[#E5E5E5] rounded-xl text-xs font-medium text-[#111111] focus:outline-none focus:border-[#111111] transition-colors"
              />
            </div>

            {/* Nome do Titular / Identificação */}
            <div>
              <label className="block text-xs font-semibold text-[#111111] mb-1">
                Nome do Titular / Identificação da Conta
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Conta Principal"
                required
                className="w-full h-11 px-3.5 bg-white border border-[#E5E5E5] rounded-xl text-xs font-medium text-[#111111] focus:outline-none focus:border-[#111111] transition-colors"
              />
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full h-11 bg-[#111111] hover:bg-black text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Cadastrando chave PIX...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>Cadastrar Chave PIX</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setView('list')}
                disabled={saving}
                className="w-full py-2 text-xs text-[#737373] hover:text-[#111111] font-semibold text-center cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
