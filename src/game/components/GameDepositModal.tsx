import React, { useState, useEffect } from 'react';
import { X, QrCode, Copy, Check, Ticket, Loader2, RefreshCw } from 'lucide-react';
import { playSaleSound } from '../../lib/pwaNotification';

interface GameDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDeposit: (amount: number) => Promise<void>;
  loading: boolean;
}

export const GameDepositModal: React.FC<GameDepositModalProps> = ({
  isOpen,
  onClose,
  onConfirmDeposit,
  loading,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<number>(20);
  const [customAmount, setCustomAmount] = useState<string>('20');
  const [useBonus, setUseBonus] = useState<boolean>(true);
  const [step, setStep] = useState<'select' | 'pix'>('select');
  const [copied, setCopied] = useState(false);
  const [hasCoupon, setHasCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [generating, setGenerating] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [chargeData, setChargeData] = useState<{
    correlationID?: string;
    qrCode?: string;
    qrCodeImage?: string;
    value?: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setChargeData(null);
      setIsApproved(false);
    }
  }, [isOpen]);

  // Polling to check charge status every 3 seconds
  useEffect(() => {
    if (!isOpen || step !== 'pix' || !chargeData?.correlationID || isApproved) return;

    let isMounted = true;

    const checkStatus = async () => {
      try {
        const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token');
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
            const val = chargeData.value || parseFloat(customAmount) || 0;
            if (val > 0) {
              onConfirmDeposit(val).catch(console.error);
            }
          }
        }
      } catch (err) {
        console.error('Error polling Dotfy charge in Game:', err);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 3000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isOpen, step, chargeData, isApproved, customAmount]);

  if (!isOpen) return null;

  const currentVal = parseFloat(customAmount) || 0;
  const showBonusBox = currentVal >= 30;
  const bonusVal = (showBonusBox && useBonus) ? currentVal : 0;
  const totalBalance = currentVal + bonusVal;

  const presetValues = [
    { value: 20, badge: 'MÍNIMO', badgeColor: 'bg-[#00E676] text-[#031C0B]' },
    { value: 30, badge: 'POPULAR', badgeColor: 'bg-[#FFA000] text-black' },
    { value: 50, badge: 'BÔNUS 2X', badgeColor: 'bg-[#FF5722] text-white' },
    { value: 100, badge: 'BÔNUS 3X', badgeColor: 'bg-[#9C27B0] text-white' },
  ];

  const handleSelectPreset = (val: number) => {
    setSelectedPreset(val);
    setCustomAmount(val.toString());
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '');
    setCustomAmount(val);
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      setSelectedPreset(num);
    }
  };

  const handleGeneratePix = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customAmount);
    if (isNaN(val) || val < 5) return;

    setGenerating(true);
    setIsApproved(false);
    try {
      const token = localStorage.getItem('pg_auth_token') || localStorage.getItem('paygateway_token') || localStorage.getItem('token');
      const res = await fetch('/api/charges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          value: val,
          gameId: 'g_block_puzzle',
          description: `Depósito BlockWin PIX (R$ ${val.toFixed(2)})`,
          expiresIn: 3600,
        }),
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setChargeData({
          correlationID: json.data.correlationID || json.data.correlationId,
          qrCode: json.data.qrCode,
          qrCodeImage: json.data.qrCodeImage,
          value: val,
        });
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
        const val = parseFloat(customAmount) || chargeData.value || 0;
        if (val > 0) {
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md bg-[#091129] border border-[#1A2D5C] rounded-t-[28px] sm:rounded-[28px] p-4 sm:p-5 shadow-2xl relative max-h-[92vh] overflow-y-auto space-y-4 text-white">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          type="button"
          className="absolute top-3 right-3 z-30 w-8 h-8 rounded-full bg-[#901313] hover:bg-[#B71C1C] text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-lg border border-red-400/30"
        >
          <X className="w-4 h-4 stroke-[3]" />
        </button>

        {step === 'select' ? (
          <div className="space-y-4 pt-1">
            {/* Top Graphic Banner Image */}
            <div className="w-full rounded-2xl overflow-hidden border border-[#233B78] shadow-2xl bg-[#060C24]">
              <img
                src="/banner001.jpeg"
                alt="Banner BlockWin"
                className="w-full h-auto object-contain block"
              />
            </div>

            {/* Quick Values Container */}
            <div className="bg-[#0B1533] border border-[#182A57] rounded-2xl p-3 sm:p-4 space-y-3 shadow-inner">
              <label className="block text-[10px] font-black text-[#7A8EA8] uppercase tracking-wider font-mono">
                VALOR RÁPIDO
              </label>

              {/* 6 Grid Cards */}
              <div className="grid grid-cols-3 gap-2.5">
                {presetValues.map((item) => {
                  const isSelected = selectedPreset === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleSelectPreset(item.value)}
                      className={`relative pt-3 pb-2 px-1 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#112454] border-[#FFD700] ring-2 ring-amber-400/60 shadow-lg shadow-amber-500/20 scale-102'
                          : 'bg-[#081028] border-[#182850] hover:border-[#2C478A]'
                      }`}
                    >
                      {/* Badge Tag */}
                      <span className={`absolute -top-2 px-2 py-0.5 rounded-full text-[8px] font-black font-mono shadow-sm ${item.badgeColor}`}>
                        {item.badge}
                      </span>
                      <span className="font-black text-base sm:text-lg text-white font-mono mt-1">
                        R${item.value}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Input */}
              <div className="pt-1">
                <div className="relative flex items-center bg-[#070D22] border border-[#1B2F5E] focus-within:border-cyan-400 rounded-xl px-3 py-2.5">
                  <span className="text-sm font-bold text-slate-400 font-mono mr-1">R$</span>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={handleCustomChange}
                    className="w-full bg-transparent text-white font-extrabold text-sm sm:text-base outline-none font-mono"
                    placeholder="Mínimo R$ 5,00"
                  />
                </div>
              </div>
            </div>

            {/* 100% Bonus Dynamic Box (Visible when amount >= R$30) */}
            {showBonusBox && (
              <div className="bg-[#051C13]/90 border border-[#0B402B] rounded-2xl p-4 space-y-2 shadow-xl backdrop-blur-md animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-[#00E676] font-black text-xs sm:text-sm tracking-wider font-mono uppercase">
                    BÔNUS DE 100%
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 font-mono">
                      USAR BÔNUS
                    </span>
                    <button
                      type="button"
                      onClick={() => setUseBonus(!useBonus)}
                      className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer relative ${
                        useBonus ? 'bg-[#00E676]' : 'bg-[#122920]'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                          useBonus ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight pt-1">
                  + R$ {useBonus ? currentVal.toFixed(2).replace('.', ',') : '0,00'}
                </div>

                <div className="pt-2 border-t border-[#0C3D2B] flex items-center text-xs font-semibold text-slate-300">
                  <span>Total na conta: <strong className="text-white font-bold font-mono text-sm ml-1">R$ {totalBalance.toFixed(2).replace('.', ',')}</strong></span>
                </div>
              </div>
            )}

            {/* Coupon Toggle */}
            <div className="px-1">
              {!hasCoupon ? (
                <button
                  type="button"
                  onClick={() => setHasCoupon(true)}
                  className="text-xs font-bold text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Ticket className="w-4 h-4 text-rose-400" />
                  <span>Tenho um cupom</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Digite o cupom..."
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    className="flex-1 bg-[#081028] border border-[#182A52] text-xs px-3 py-2 rounded-xl text-white outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setHasCoupon(false)}
                    className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
                  >
                    Aplicar
                  </button>
                </div>
              )}
            </div>

            {/* Submit Green Button */}
            <button
              type="button"
              onClick={handleGeneratePix}
              disabled={generating}
              className="w-full py-3.5 bg-[#00A86B] hover:bg-[#00965E] active:scale-98 text-[#022115] font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-[#00A86B]/25 transition-all cursor-pointer uppercase tracking-wider flex items-center justify-center gap-2 border border-emerald-300/30 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-[#022115]" />
                  <span>Gerando PIX...</span>
                </>
              ) : (
                <span>Gerar QR Code PIX</span>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-4 text-center pt-2">
            {isApproved ? (
              <div className="bg-[#042419] border border-[#00E676]/40 rounded-2xl p-6 text-center space-y-3 animate-fade-in shadow-2xl">
                <div className="w-16 h-16 bg-[#00E676] text-[#031C0B] rounded-full flex items-center justify-center mx-auto shadow-lg shadow-[#00E676]/30">
                  <Check className="w-8 h-8 stroke-[3]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-[#00E676] tracking-tight font-mono uppercase">
                    Pagamento Aprovado!
                  </h3>
                  <p className="text-xs font-bold text-slate-200 font-mono">
                    Seu saldo foi creditado!
                  </p>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setStep('select');
                      setIsApproved(false);
                      onClose();
                    }}
                    className="w-full py-3 bg-[#00E676] hover:bg-[#00C853] text-[#031C0B] font-black text-xs rounded-xl transition-all cursor-pointer uppercase tracking-wider shadow-lg shadow-[#00E676]/20"
                  >
                    Concluir
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white">Pagamento via Pix</h3>

                <div className="p-4 bg-[#081028] rounded-2xl border border-[#1B2F5E] inline-block mx-auto">
                  <div className="w-44 h-44 bg-white p-2 border border-white/20 rounded-xl flex items-center justify-center mx-auto shadow-md overflow-hidden">
                    {chargeData?.qrCodeImage ? (
                      <img
                        src={chargeData.qrCodeImage}
                        alt="QR Code PIX Dotfy"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <QrCode className="w-32 h-32 text-black" />
                    )}
                  </div>
                  <span className="text-sm font-extrabold text-[#00E676] font-mono block mt-2">
                    R$ {parseFloat(customAmount || '20').toFixed(2).replace('.', ',')}
                  </span>
                </div>

                <div className="space-y-1 text-left">
                  <label className="text-[11px] font-bold text-slate-400 block font-mono">
                    PIX Copia e Cola
                  </label>
                  <div className="flex items-center gap-2 bg-[#081028] p-2.5 rounded-xl border border-[#1B2F5E]">
                    <input
                      type="text"
                      readOnly
                      value={pixCopyCode}
                      className="bg-transparent text-[11px] font-mono text-slate-400 w-full focus:outline-none truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopyPix}
                      className="py-1.5 px-3 bg-[#00E676] text-[#031C0B] rounded-lg text-xs font-black flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#182A52] space-y-2">
                  {/* Indicador de Status: Aguardando Pagamento */}
                  <div className="w-full py-3.5 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 tracking-wider font-mono shadow-lg">
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Aguardando Pagamento...</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setStep('select')}
                    className="text-xs font-bold text-slate-400 hover:text-white cursor-pointer block mx-auto pt-1"
                  >
                    Voltar e alterar valor
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
