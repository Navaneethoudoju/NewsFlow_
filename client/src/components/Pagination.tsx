import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-rule px-4 py-3 text-sm">
      <span className="text-ink-faint">{total} total</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded p-1.5 text-ink-light hover:bg-paper-dim disabled:opacity-30"
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-2 text-ink-light">
          Page {page} of {Math.max(totalPages, 1)}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded p-1.5 text-ink-light hover:bg-paper-dim disabled:opacity-30"
          aria-label="Next page"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
