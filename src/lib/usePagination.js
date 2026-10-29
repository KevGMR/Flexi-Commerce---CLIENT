"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Pagination hook for admin list pages.
 *
 * Owns page / pageSize state, computes skip / limit for the server, and
 * exposes next / prev / goto helpers that clamp against total.
 *
 * Usage:
 *   const pag = usePagination({
 *     initialPageSize: 50,
 *     resetKey: [search, status], // reset to page 1 when these change
 *   });
 *
 *   const res = await apiFetch(
 *     `/products?skip=${pag.skip}&limit=${pag.limit}` +
 *     (search ? `&search=${search}` : "")
 *   );
 *   pag.setTotal(res.total);
 *
 *   return (
 *     <>
 *       <table>…</table>
 *       <PaginationFooter pagination={pag} loading={loading} noun="products" />
 *     </>
 *   );
 *
 * The resetKey pattern: pass in anything that should force the user back to
 * page 1 — search string, filter value, tab key. Deep-compare by JSON so
 * arrays / numbers / strings all work.
 */
export function usePagination({
  initialPage = 1,
  initialPageSize = 50,
  resetKey = [],
} = {}) {
  const [page, setPageState] = useState(initialPage);
  const [pageSize, setPageSizeState] = useState(initialPageSize);
  const [total, setTotalState] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / pageSize)),
    [total, pageSize],
  );

  const skip = (page - 1) * pageSize;
  const limit = pageSize;

  // Reset to page 1 when resetKey changes.
  const resetKeySerialized = JSON.stringify(resetKey);
  useEffect(() => {
    setPageState(1);
  }, [resetKeySerialized]);

  const setPage = useCallback(
    (next) => {
      const n = Number(next);
      if (!Number.isFinite(n)) return;
      const clamped = Math.max(1, Math.min(totalPages, Math.round(n)));
      setPageState(clamped);
    },
    [totalPages],
  );

  const setPageSize = useCallback((next) => {
    const n = Number(next);
    if (!Number.isFinite(n) || n <= 0) return;
    setPageSizeState(Math.round(n));
    setPageState(1);
  }, []);

  const setTotal = useCallback((next) => {
    const n = Number(next);
    if (!Number.isFinite(n) || n < 0) return;
    setTotalState(Math.round(n));
  }, []);

  const next = useCallback(() => {
    setPageState((p) => Math.min(totalPages, p + 1));
  }, [totalPages]);

  const prev = useCallback(() => {
    setPageState((p) => Math.max(1, p - 1));
  }, []);

  const firstItem = total === 0 ? 0 : skip + 1;
  const lastItem = Math.min(skip + pageSize, total);

  return {
    page,
    pageSize,
    total,
    totalPages,
    skip,
    limit,
    firstItem,
    lastItem,
    setPage,
    setPageSize,
    setTotal,
    next,
    prev,
  };
}