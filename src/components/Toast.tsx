import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  onClose,
  duration = 3000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, message, type, onClose]);

  const icons = {
    success: <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />,
    error: <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />,
    info: <Info className="w-4 h-4 text-zinc-900 shrink-0" />,
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] w-[90%] max-w-xs bg-zinc-950 text-white p-3 rounded-xl shadow-xl border border-zinc-800 flex items-center justify-between gap-2 text-xs font-medium animate-in slide-in-from-top-2 duration-200">
      <div className="flex items-center gap-2">
        {icons[type]}
        <span>{message}</span>
      </div>
      <button
        onClick={onClose}
        className="text-zinc-400 hover:text-white p-0.5 rounded cursor-pointer"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
