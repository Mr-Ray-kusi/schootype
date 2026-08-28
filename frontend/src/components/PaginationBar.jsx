import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const PaginationBar = ({ page = 1, total = 0, limit = 50, onPageChange }) => {
  const pages = Math.max(1, Math.ceil(Number(total || 0) / Number(limit || 50)));
  const current = Math.min(Math.max(1, Number(page) || 1), pages);
  const from = total === 0 ? 0 : (current - 1) * limit + 1;
  const to = Math.min(current * limit, total);

  const numbers = [];
  const start = Math.max(1, current - 2);
  const end = Math.min(pages, start + 4);
  for (let n = start; n <= end; n += 1) numbers.push(n);

  return (
    <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[#6b7280]">
        Showing {String(from).padStart(2, '0')}-{String(to).padStart(2, '0')} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={current <= 1}
          onClick={() => onPageChange(current - 1)}
          className="rounded-lg p-2 text-[#111827] hover:bg-[#f3f6fb] disabled:opacity-40"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {numbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPageChange(n)}
            className={`min-w-[1.75rem] rounded-lg px-2 py-1 text-sm font-semibold ${
              n === current ? 'text-[#2f6eff]' : 'text-[#6b7280] hover:text-[#111827]'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          disabled={current >= pages}
          onClick={() => onPageChange(current + 1)}
          className="rounded-lg p-2 text-[#111827] hover:bg-[#f3f6fb] disabled:opacity-40"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default PaginationBar;
