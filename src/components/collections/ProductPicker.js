"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { productsApi } from "@/lib/api-client";

/**
 * Search-and-add product picker.
 *
 * Two modes:
 *
 * 1. Stateless mode — pass `onPick(productId)` and nothing else. The picker
 *    fires on click and doesn't render a selected list. Same as the original.
 *
 * 2. Controlled mode — pass `value` (array of IDs) and `onChange(nextIds)`.
 *    The picker renders the selected products with names, thumbnails, and
 *    remove buttons. Still fires onPick when a search result is clicked.
 */
export default function ProductPicker({
  value,
  onChange,
  excludeIds = [],
  onPick,
}) {
  const isControlled = Array.isArray(value) && typeof onChange === "function";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const [selectedDetails, setSelectedDetails] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      productsApi
        .list({ search: query.trim(), limit: 20 })
        .then((data) => setResults(data.products || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!isControlled) return;
    if (!Array.isArray(value) || value.length === 0) {
      setSelectedDetails([]);
      return;
    }

    let cancelled = false;
    setDetailsLoading(true);

    productsApi
      .listByIds(value)
      .then((data) => {
        if (cancelled) return;
        const fetched = data.products || [];
        const byId = new Map(fetched.map((p) => [String(p._id), p]));
        const ordered = value
          .map((id) => byId.get(String(id)))
          .filter(Boolean);
        setSelectedDetails(ordered);
      })
      .catch(() => {
        if (!cancelled) setSelectedDetails([]);
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isControlled, value]);

  const excludeSet = useMemo(
    () => new Set((excludeIds || []).map(String)),
    [excludeIds],
  );

  const handlePick = (product) => {
    if (excludeSet.has(String(product._id))) return;

    if (isControlled) {
      const already = value.some((id) => String(id) === String(product._id));
      if (!already) {
        onChange([...value, product._id]);
      }
    }

    onPick?.(product._id);

    setQuery("");
    setOpen(false);
  };

  const handleRemove = (productId) => {
    if (!isControlled) return;
    onChange(value.filter((id) => String(id) !== String(productId)));
  };

  return (
    <div className="space-y-3" ref={wrapRef}>
      {isControlled && value.length > 0 && (
        <div className="rounded-md border border-neutral-200 divide-y max-h-64 overflow-y-auto">
          {detailsLoading && selectedDetails.length === 0 ? (
            <div className="p-3 text-xs text-neutral-500">Loading…</div>
          ) : (
            selectedDetails.map((p) => {
              const img =
                (p.images || []).find((i) => i.isDefault) ||
                (p.images || [])[0];
              return (
                <div key={p._id} className="flex items-center gap-3 p-2">
                  <div className="w-10 h-10 rounded bg-neutral-100 overflow-hidden flex-shrink-0">
                    {img?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={img.url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[9px] text-neutral-400">
                        —
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-neutral-500">
                      {p.sku || "No SKU"}
                      {p.price != null && ` · $${Number(p.price).toFixed(2)}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(p._id)}
                    className="text-xs text-red-500 hover:text-red-700 flex-shrink-0"
                    aria-label="Remove"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {isControlled &&
        value.length > 0 &&
        !detailsLoading &&
        selectedDetails.length < value.length && (
          <p className="text-xs text-amber-700">
            {value.length - selectedDetails.length} selected product
            {value.length - selectedDetails.length === 1 ? " is" : "s are"} no
            longer available.
          </p>
        )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search products to add…"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />

        {open && query.trim() && (
          <div className="absolute z-20 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg max-h-64 overflow-auto">
            {loading ? (
              <div className="px-3 py-2 text-xs text-neutral-500">
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-neutral-500">
                No products match
              </div>
            ) : (
              results.map((p) => {
                const already = excludeSet.has(String(p._id));
                const img =
                  (p.images || []).find((i) => i.isDefault) ||
                  (p.images || [])[0];
                return (
                  <button
                    key={p._id}
                    type="button"
                    disabled={already}
                    onClick={() => handlePick(p)}
                    className={`w-full text-left px-3 py-2 text-sm flex items-center gap-3 ${
                      already
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-neutral-50"
                    }`}
                  >
                    <div className="w-8 h-8 rounded bg-neutral-100 overflow-hidden flex-shrink-0">
                      {img?.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={img.url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate">{p.name}</p>
                      {p.sku && (
                        <p className="text-xs text-neutral-500 truncate">
                          {p.sku}
                        </p>
                      )}
                    </div>
                    {already && (
                      <span className="text-xs text-neutral-400">added</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}