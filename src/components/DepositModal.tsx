import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { QrCode, Copy, Check, ArrowDownRight, Loader2, RefreshCw } from 'lucide-react';
import { playSaleSound } from '../lib/pwaNotification';
import { trackDepositInitiated, trackDepositSuccess } from '../lib/tracking';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDeposit: (amount: number) => Promise<void>;
  loading: boolean;
  gameId?: string;
}

export const DepositModal: React.FC<DepositModalProps> = ({
  isOpen,
  onClose,
  onConfirmDeposit,
  loading,
  gameId = 'platform',
}) => {
  const isDino = gameId === 'gen-dino' || gameId === 'dino' || gameId === 'arcade-runner';
  const minDeposit = isDino ? 20 : 5;
  const [amount, setAmount] = useState<string>(isDino ? '20' : '50');
  const [step, setStep] = useState<'amount' | 'pix'>('amount');
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [chargeData, setChargeData] = useState<{
    correlationID?: string;
    qrCode?: string;
    qrCodeImage?: string;
    value?: number;
    paymentLink?: string;
  } | null>(null);

  const presetAmounts = isDino ? [20, 30, 50, 100] : [20, 30, 50, 100];

  useEffect(() => {
    if (!isOpen) {
      setStep('amount');
      setChargeData(null);
      setIsApproved(false);
      setAmount(isDino ? '20' : '50');
    }
  }, [isOpen, isDino]);

  // Polling to check charge status every 3 seconds
  useEffect(() => {
    if (!isOpen || step !== 'pix' || !chargeData?.correlationID || isApproved) return;

    let isMounted = true;

    const checkStatus = async () => {
      try {
        const token = localStorage.getItem('paygateway_token') || localStorage.getItem('pg_auth_token') || localStorage.getItem('token');
        const res = await fetch(`/api/charges/${chargeData.correlationID}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          const data = json.data || json;
          const status = data.status;
          const isPaid = data.isPaid === true || status === 'PAID' || status === 'COMPLETED';

          if (isPaid) {
            if (!isMounted) return;
            setIsApproved(true);
            playSaleSound();
            const val = chargeData.value || parseFloat(amount) || 0;
            if (val > 0) {
              trackDepositSuccess(val, chargeData.correlationID, { gameId });
              onConfirmDeposit(val).catch(console.error);
            }
          }
        }
      } catch (err) {
        console.error('Error polling charge status:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, step, chargeData, isApproved, amount, gameId]);

  const handleGeneratePix = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val < minDeposit) {
      alert(`O depósito mínimo ${isDino ? 'no Dino ' : ''}é de R$ ${minDeposit},00.`);
      return;
    }

    setGenerating(true);
    setIsApproved(false);
    try {
      const token = localStorage.getItem('paygateway_token') || localStorage.getItem('pg_auth_token') || localStorage.getItem('token');
      const res = await fetch('/api/charges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          value: val,
          gameId,
          description: `Depósito PIX • ${gameId} • R$ ${val.toFixed(2)}`,
          expiresIn: 3600,
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        const corrId = json.data.correlationID || json.data.correlationId;
        setChargeData({
          correlationID: corrId,
          qrCode: json.data.qrCode,
          qrCodeImage: json.data.qrCodeImage,
          value: val,
          paymentLink: json.data.paymentLink,
        });

        // Fire tracking event for InitiateCheckout / Pix Generated
        trackDepositInitiated(val, corrId, { gameId, pixCode: json.data.qrCode });
      } else throw new Error(json.message || json.error || 'Não foi possível gerar o PIX.');
      setStep('pix');
    } catch (err) {
      console.error('Error generating Dotfy charge:', err);
      alert(err instanceof Error ? err.message : 'Falha ao gerar PIX. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!chargeData?.correlationID || simulating || isApproved) return;
    setSimulating(true);
    try {
      const res = await fetch(`/api/charges/${chargeData.correlationID}/simulate-payment`, {
        method: 'POST',
      });
      if (res.ok) {
        setIsApproved(true);
        playSaleSound();
        const val = parseFloat(amount) || chargeData.value || 0;
        if (val > 0) {
          trackDepositSuccess(val, chargeData.correlationID, { gameId });
          await onConfirmDeposit(val);
        }
      }
    } catch (err) {
      console.error('Simulate payment error:', err);
    } finally {
      setSimulating(false);
    }
  };

  const pixCopyCode = chargeData?.qrCode || '';

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixCopyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Adicionar Saldo via Pix">
      {step === 'amount' ? (
        <form onSubmit={handleGeneratePix} className="space-y-4 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[#111111] block">
              Valor do depósito (R$)
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-[#737373]">
                R$
              </span>
              <input
                type="number"
                min={minDeposit}
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full h-12 pl-10 pr-4 bg-[#F5F5F5] border border-[#E5E5E5] rounded-xl text-lg font-bold text-[#111111] focus:outline-none focus:border-[#111111] focus:bg-white transition-all"
              />
            </div>
            <p className="text-[11px] text-[#737373]">Depósito mínimo: R$ {minDeposit},00</p>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {presetAmounts.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAmount(val.toString())}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer shrink-0 ${
                  amount === val.toString()
                    ? 'bg-[#111111] text-white border-[#111111]'
                    : 'bg-[#F5F5F5] text-[#111111] border-[#E5E5E5] hover:bg-[#ECECEC]'
                }`}
              >
                + R$ {val}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={generating}
            className="w-full h-11 bg-[#111111] text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:bg-black transition-colors cursor-pointer disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Gerando PIX...</span>
              </>
            ) : (
              <>
                <span>Gerar QR Code PIX</span>
                <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4 text-center pt-1">
          {isApproved ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                <Check className="w-8 h-8 stroke-[3]" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-extrabold text-emerald-950 tracking-tight">
                  Pagamento Aprovado!
                </h3>
                <p className="text-xs font-bold text-emerald-700">
                  Seu saldo foi creditado!
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setStep('amount');
                    setIsApproved(false);
                    onClose();
                  }}
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  Concluir
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="p-4 bg-[#F5F5F5] rounded-2xl border border-[#E5E5E5] inline-block mx-auto">
                <div className="w-44 h-44 bg-white p-2 border border-[#E5E5E5] rounded-xl flex items-center justify-center mx-auto shadow-xs overflow-hidden">
                  {chargeData?.qrCodeImage ? (
                    <img
                      src={chargeData.qrCodeImage}
                      alt="QR Code PIX Dotfy"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <QrCode className="w-32 h-32 text-[#111111]" />
                  )}
                </div>
                <span className="text-xs font-bold text-[#111111] block mt-2">
                  R$ {parseFloat(amount).toFixed(2).replace('.', ',')}
                </span>
              </div>

              <div className="space-y-1 text-left">
                <label className="text-[11px] font-semibold text-[#737373] block">
                  PIX Copia e Cola
                </label>
                <div className="flex items-center gap-2 bg-[#F5F5F5] p-2 rounded-xl border border-[#E5E5E5]">
                  <input
                    type="text"
                    readOnly
                    value={pixCopyCode}
                    className="bg-transparent text-[11px] font-mono text-[#737373] w-full focus:outline-none truncate"
                  />
                  <button
                    type="button"
                    onClick={handleCopyPix}
                    className="py-1.5 px-2.5 bg-[#111111] text-white rounded-lg text-xs font-medium flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-[#E5E5E5] space-y-2">
                {/* Indicador de Status: Aguardando Pagamento */}
                <div className="w-full h-11 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                  <span>Aguardando Pagamento...</span>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('amount')}
                  className="text-xs font-semibold text-[#737373] hover:text-[#111111] cursor-pointer block mx-auto pt-1"
                >
                  Voltar e alterar valor
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
};
