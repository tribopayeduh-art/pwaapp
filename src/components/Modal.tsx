import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}
let openModals = 0;
let previousOverflow = '';
const modalStack: HTMLElement[] = [];

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'max-w-md' }) => {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!isOpen || !panel.current) return;
    const element = panel.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    if (openModals++ === 0) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    modalStack.push(element);
    const focusable = () => Array.from<HTMLElement>(element.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'
    )).filter(item => item.getClientRects().length > 0);
    (focusable()[0] || element).focus();
    const keydown = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== element) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = focusable();
      const first = items[0];
      const last = items.at(-1);
      if (!first) { event.preventDefault(); element.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !element.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      modalStack.splice(modalStack.indexOf(element), 1);
      if (--openModals === 0) document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);

  if (!isOpen || typeof document === 'undefined') return null;
  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 min-h-[100dvh]">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className={`w-full ${maxWidth} bg-white rounded-3xl border border-[#E5E5E5] p-5 sm:p-6 shadow-2xl space-y-4 my-auto max-h-[88dvh] overflow-y-auto overscroll-contain focus:outline-none`}>
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#E5E5E5]">
          <h3 id={titleId} className="font-bold text-sm text-[#111111] tracking-tight">{title}</h3>
          <button type="button" aria-label="Fechar janela" onClick={onClose}
            className="w-11 h-11 shrink-0 rounded-full bg-[#F5F5F5] text-[#737373] hover:text-[#111111] flex items-center justify-center transition-colors cursor-pointer border border-[#E5E5E5] focus-visible:outline-2 focus-visible:outline-blue-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>, document.body
  );
};
