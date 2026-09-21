import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  className?: string;
  itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize = 40,
  onPageChange,
  className = '',
  itemLabel = 'itens',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalItems <= pageSize && currentPage === 1) {
    return (
      <div className={`flex items-center justify-between text-[11px] text-zinc-500 px-2 py-2 ${className}`}>
        <span>
          Exibindo todos os <strong>{totalItems}</strong> {itemLabel}
        </span>
        <span className="text-[10px] font-medium bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md">
          Página 1 de 1 (40 por página)
        </span>
      </div>
    );
  }

  const startItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // Generate page numbers with smart ellipsis
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const handlePrev = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 px-3 py-3 bg-white border border-[#E5E5E5] rounded-2xl shadow-2xs ${className}`}
    >
      {/* Items Count Info */}
      <div className="text-xs text-zinc-600 font-medium flex items-center gap-1.5 self-start sm:self-auto">
        <span>
          Mostrando <strong className="text-zinc-900 font-bold">{startItem}</strong>–
          <strong className="text-zinc-900 font-bold">{endItem}</strong> de{' '}
          <strong className="text-zinc-900 font-bold">{totalItems}</strong> {itemLabel}
        </span>
        <span className="hidden sm:inline-block text-[10px] bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-md font-semibold">
          40 por página
        </span>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center gap-1 self-end sm:self-auto">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentPage <= 1}
          aria-label="Página anterior"
          className="p-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-zinc-50 disabled:cursor-not-allowed transition-all text-zinc-700 cursor-pointer flex items-center gap-1 text-xs font-semibold"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden xs:inline">Anterior</span>
        </button>

        <div className="flex items-center gap-1 px-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellip_${idx}`} className="px-1.5 py-1 text-xs text-zinc-400 font-bold">
                  ...
                </span>
              );
            }
            const pageNum = Number(p);
            const isActive = pageNum === currentPage;
            return (
              <button
                key={`page_${pageNum}`}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#111111] text-white shadow-2xs'
                    : 'bg-transparent hover:bg-zinc-100 text-zinc-700'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          aria-label="Próxima página"
          className="p-1.5 rounded-xl border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 disabled:opacity-40 disabled:hover:bg-zinc-50 disabled:cursor-not-allowed transition-all text-zinc-700 cursor-pointer flex items-center gap-1 text-xs font-semibold"
        >
          <span className="hidden xs:inline">Próxima</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
