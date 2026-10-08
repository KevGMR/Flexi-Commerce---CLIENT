"use client";

import { useEffect, useState } from "react";
import { collectionsApi } from "@/lib/api-client";

const PAGE_SIZE = 20;

export default function CollectionProductsList({
  collectionId,
  refreshKey = 0,
  onRemove, // optional: (productId) => void
}) {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPage(0);
  }, [search, collectionId]);

  useEffect(() => {
    if (!collectionId) return;
    let cancelled = false;
    setLoading(true);
    collectionsApi
      .listProducts(collectionId, {
        search: search.trim() || undefined,
        skip: page * PAGE_SIZE,
        limit: PAGE_SIZE,
      })
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products || []);
        setTotal(data.total || 0);
        setError("");
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [collectionId, page, search, refreshKey]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products in this collection…"
          className="flex-1 px-3 py-2 border rounded-md text-sm"
        />
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {total} total
        </span>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="border rounded-md divide-y max-h-96 overflow-auto">
        {loading && products.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">Loading…</div>
        ) : products.length === 0 ? (
          <div className="p-4 text-sm text-gray-500 text-center">
            {search.trim() ? "No matching products" : "No products yet"}
          </div>
        ) : (
          products.map((p) => (
            <div key={p._id} className="flex items-center gap-3 p-2">
              <div className="w-10 h-10 rounded bg-gray-100 overflow-hidden flex-shrink-0">
                {p.image?.url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.image.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-gray-500">
                  {p.sku} · ${Number(p.price).toFixed(2)}
                </p>
              </div>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(p._id)}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Remove
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-600">
          <button
            type="button"
            disabled={page === 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            ← Prev
          </button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount - 1 || loading}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}