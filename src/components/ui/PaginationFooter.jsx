"use client";

export function PaginationFooter({
  pagination,
  loading = false,
  noun = "item",
  pageSizeOptions = [25, 50, 100],
}) {
  const {
    page,
    pageSize,
    total,
    totalPages,
    firstItem,
    lastItem,
    setPageSize,
    next,
    prev,
  } = pagination;

  const plural = noun.endsWith("s") ? noun : `${noun}s`;
  const showControls = totalPages > 1;

  return (
    <div className="flex flex-col gap-2 border-t bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="text-xs text-gray-600">
        {total === 0
          ? `No ${plural}`
          : `Showing ${firstItem}–${lastItem} of ${total}`}
      </div>

      {showControls && (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-gray-600">
            <span className="sr-only">Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(e.target.value)}
              disabled={loading}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 disabled:opacity-50"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={prev}
            disabled={page <= 1 || loading}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            ← Previous
          </button>

          <span className="text-xs text-gray-700">
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={next}
            disabled={page >= totalPages || loading}
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}