import React, { useState } from 'react';
import { Modal } from './Modal';
import { KeyRound, ShieldCheck, Check, Loader2, CreditCard, AlertCircle } from 'lucide-react';

interface PixKeyRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  userName?: string;
  onSuccess: (message: string, pixKeyData?: any) => void;
}

export const PixKeyRegisterModal: React.FC<PixKeyRegisterModalProps> = ({
  isOpen,
  onClose,
  token,
  userName = '',
  onSuccess,
}) => {
  const [type, setType] = useState<'CPF' | 'CNPJ' | 'EMAIL'>('CPF');
  const [key, setKey] = useState('');
  const [name, setName] = useState(userName || 'Conta principal');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) {
      setError('Por favor, informe o valor da chave PIX.');
      return;
    }
    if (!name.trim()) {
      setError('Por favor, informe o nome do titular ou conta.');
      return;
    }

    setError(null);
    setLoading(true);

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

      onSuccess(
        data.message || 'Chave PIX cadastrada e enviada para aprovação com sucesso!',
        data.pixKey
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Não foi possível cadastrar a chave PIX.');
    } finally {
      setLoading(false);
    }
  };

  const getPlaceholder = () => {
    switch (type) {
      case 'CPF':
        return '000.000.000-00';
      case 'CNPJ':
        return '00.000.000/0001-00';
      case 'EMAIL':
        return 'seu.email@exemplo.com';
      default:
        return 'Digite sua chave PIX';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cadastrar Chave PIX">
      <form onSubmit={handleSubmit} className="space-y-4 pt-1">
        <div className="p-3 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5] flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#111111] text-white flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h4 className="font-bold text-xs text-[#111111]">Cadastre sua chave de recebimento</h4>
            <p className="text-[11px] text-[#737373] mt-0.5">
              Necessário para o processamento de saques e transferências no Gateway.
            </p>
          </div>
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
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F5F5F5] rounded-xl border border-[#E5E5E5]">
            {(['CPF', 'CNPJ', 'EMAIL'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setType(item);
                  setError(null);
                }}
                className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
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
            disabled={loading}
            className="w-full h-11 bg-[#111111] hover:bg-black text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando para aprovação...</span>
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
            onClick={onClose}
            disabled={loading}
            className="w-full py-2.5 text-xs text-[#737373] hover:text-[#111111] font-semibold text-center cursor-pointer"
          >
            Pular por enquanto
          </button>
        </div>
      </form>
    </Modal>
  );
};
