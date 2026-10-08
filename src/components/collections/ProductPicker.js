"use client";

import { useEffect, useRef, useState } from "react";
import { productsApi } from "@/lib/api-client";

/**
 * Search-and-add picker.
 * Calls onPick(productId) when the user selects a product.
 * The parent decides whether that's a pending-add for a new collection
 * or an immediate add for an existing collection.
 */
export default function ProductPicker({ excludeIds = [], onPick }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

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

  const excludeSet = new Set((excludeIds || []).map(String));

  const handlePick = (id) => {
    if (excludeSet.has(String(id))) return;
    onPick(id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search products to add…"
        className="w-full px-3 py-2 border rounded-md text-sm"
      />

      {open && query.trim() && (
        <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
          {loading ? (
            <div className="px-3 py-2 text-xs text-gray-500">Searching…</div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500">
              No products match
            </div>
          ) : (
            results.map((p) => {
              const already = excludeSet.has(String(p._id));
              return (
                <button
                  key={p._id}
                  type="button"
                  disabled={already}
                  onClick={() => handlePick(p._id)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between ${
                    already
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="truncate">
                    {p.name}
                    {p.sku && (
                      <span className="ml-2 text-xs text-gray-400">
                        {p.sku}
                      </span>
                    )}
                  </span>
                  {already && <span className="text-xs text-gray-400">added</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}