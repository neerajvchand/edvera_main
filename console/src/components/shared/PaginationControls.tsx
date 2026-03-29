import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/**
 * Shared pagination controls with "Showing X-Y of Z" text,
 * page number buttons (current +/- 2 with ellipsis), and prev/next.
 */
export function PaginationControls({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
}: PaginationControlsProps) {
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Build page numbers: show current +/- 2 with ellipsis
  function getPageNumbers(): (number | "...")[] {
    const pages: (number | "...")[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, page + 2);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  }

  const pageNums = getPageNumbers();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
      <p className="text-xs text-gray-500">
        Showing{" "}
        <span className="font-medium text-gray-700">{from}</span>
        {"-"}
        <span className="font-medium text-gray-700">{to}</span>
        {" of "}
        <span className="font-medium text-gray-700">{total.toLocaleString()}</span>
      </p>

      <div className="flex items-center gap-1">
        {/* Previous */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            "p-1.5 rounded-md text-gray-500 transition-colors",
            page <= 1
              ? "opacity-40 cursor-not-allowed"
              : "hover:bg-gray-100 hover:text-gray-700"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Page numbers */}
        {pageNums.map((p, i) =>
          p === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-xs text-gray-400">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "min-w-[28px] h-7 rounded-md text-xs font-medium transition-colors",
                p === page
                  ? "bg-emerald-100 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            "p-1.5 rounded-md text-gray-500 transition-colors",
            page >= totalPages
              ? "opacity-40 cursor-not-allowed"
              : "hover:bg-gray-100 hover:text-gray-700"
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
