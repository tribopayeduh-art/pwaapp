import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Sem movimentações',
  message = 'Você ainda não possui movimentações.',
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-zinc-50/50 rounded-2xl border border-dashed border-zinc-200 text-center my-2">
      <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-400 mb-3">
        <Inbox className="w-5 h-5 stroke-[1.5]" />
      </div>
      {title && <h3 className="font-semibold text-xs text-zinc-800 mb-1">{title}</h3>}
      <p className="text-xs text-zinc-400 max-w-xs">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-medium hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
