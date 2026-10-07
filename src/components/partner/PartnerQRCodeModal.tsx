import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { X, Copy, Check, Download, Share2, QrCode } from 'lucide-react';

interface PartnerQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  partnerLink: string;
  partnerCode: string;
  partnerName: string;
}

export const PartnerQRCodeModal: React.FC<PartnerQRCodeModalProps> = ({
  isOpen,
  onClose,
  partnerLink,
  partnerCode,
  partnerName
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && partnerLink) {
      QRCode.toDataURL(partnerLink, {
        width: 320,
        margin: 2,
        color: {
          dark: '#111827',
          light: '#ffffff'
        }
      })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [isOpen, partnerLink]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(partnerLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `qrcode-parceiro-${partnerCode}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-zinc-200 relative overflow-hidden">
        {/* Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mt-2 mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-2">
            <QrCode className="w-3.5 h-3.5" />
            Recrutamento VIP
          </div>
          <h3 className="text-lg font-bold text-zinc-900">QR Code de Parceiro</h3>
          <p className="text-xs text-zinc-500">
            Apresente para novos afiliados escanearem com a câmera do celular
          </p>
        </div>

        {/* QR Code Canvas */}
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-50 rounded-2xl border border-zinc-100 mb-4">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code Parceiro" className="w-56 h-56 rounded-xl shadow-sm" />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-xs text-zinc-400">
              Gerando QR Code...
            </div>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-xs font-mono font-medium text-zinc-600 bg-white px-3 py-1 rounded-lg border border-zinc-200">
            <span>CÓDIGO:</span>
            <strong className="text-zinc-900">{partnerCode}</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-zinc-200 text-zinc-700 text-xs font-semibold hover:bg-zinc-50 transition active:scale-95 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copiado!' : 'Copiar Link'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition active:scale-95 shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Salvar Imagem
          </button>
        </div>
      </div>
    </div>
  );
};
