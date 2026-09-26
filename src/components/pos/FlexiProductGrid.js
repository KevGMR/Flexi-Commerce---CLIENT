"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { productsApi } from "@/lib/api-client";
import {
  setFlexiProducts,
  getFlexiProducts,
  getFlexiCacheMeta,
} from "@/lib/indexeddb";

const CACHE_STALE_MS = 24 * 60 * 60 * 1000;

function formatRelative(iso) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function priceRange(variants) {
  const prices = variants
    .map((v) => Number(v.price))
    .filter((p) => Number.isFinite(p) && p > 0);
  if (prices.length === 0) return "$0.00";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max
    ? `$${min.toFixed(2)}`
    : `$${min.toFixed(2)} – $${max.toFixed(2)}`;
}

function totalStock(variants) {
  let sum = 0;
  let anyTracked = false;
  for (const v of variants) {
    if (v.trackInventory === false) continue;
    anyTracked = true;
    sum += v.availableAtLocation ?? 0;
  }
  return anyTracked ? sum : null;
}

function allOutOfStock(variants) {
  if (variants.length === 0) return true;
  return variants.every(
    (v) =>
      v.trackInventory !== false &&
      !v.continueSellingWhenOutOfStock &&
      (v.availableAtLocation ?? 0) <= 0,
  );
}

function pickTileImage(product) {
  // Prefer the first variant that has an image, fall back to product default
  for (const v of product.variants || []) {
    if (v.images?.[0]?.url) return v.images[0].url;
  }
  return product.defaultImage?.url || null;
}

export default function FlexiProductGrid({
  locationId,
  searchQuery = "",
  onAddToCart,
  onOpenVariantPicker,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOffline, setIsOffline] = useState(false);
  const [cacheMeta, setCacheMeta] = useState(null);
  const fetchIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!locationId) return;
    const fetchId = ++fetchIdRef.current;

    try {
      const cached = await getFlexiProducts(locationId);
      if (fetchId === fetchIdRef.current && cached.length > 0) {
        setProducts(cached);
        const meta = await getFlexiCacheMeta(locationId);
        if (fetchId === fetchIdRef.current) setCacheMeta(meta);
      }
    } catch (err) {
      console.warn("[FlexiGrid] cache read failed:", err);
    }

    const online = typeof navigator === "undefined" || navigator.onLine;
    if (!online) {
      if (fetchId === fetchIdRef.current) {
        setIsOffline(true);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await productsApi.posCatalog({
        locationId,
        search: searchQuery.trim() || undefined,
        limit: 100,
      });

      if (fetchId !== fetchIdRef.current) return;

      const fetched = data.products || [];
      setProducts(fetched);
      setIsOffline(false);

      if (!searchQuery.trim()) {
        try {
          await setFlexiProducts(locationId, fetched);
          const meta = await getFlexiCacheMeta(locationId);
          if (fetchId === fetchIdRef.current) setCacheMeta(meta);
        } catch (cacheErr) {
          console.warn("[FlexiGrid] cache write failed:", cacheErr);
        }
      }
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      setIsOffline(true);
      if (products.length === 0) {
        setError(err.message || "Failed to load products");
      }
    } finally {
      if (fetchId === fetchIdRef.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, searchQuery]);

  useEffect(() => {
    const handle = setTimeout(load, searchQuery ? 200 : 0);
    return () => clearTimeout(handle);
  }, [load, searchQuery]);

  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false);
      load();
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [load]);

  const displayed = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase().trim();
    return products.filter((p) => {
      if ((p.name || "").toLowerCase().includes(q)) return true;
      for (const t of p.tags || []) {
        if (String(t).toLowerCase().includes(q)) return true;
      }
      for (const v of p.variants || []) {
        if (v.sku && v.sku.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [products, searchQuery]);

  const tiles = useMemo(() => {
    return displayed.map((p) => {
      const variants = p.variants || [];
      const soldOut = allOutOfStock(variants);
      return {
        key: p._id,
        product: p,
        image: pickTileImage(p),
        priceLabel: priceRange(variants),
        stock: totalStock(variants),
        variantCount: variants.length,
        soldOut,
      };
    });
  }, [displayed]);

  if (!locationId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Select a location to browse products.
      </div>
    );
  }

  const cacheLabel = cacheMeta?.savedAt
    ? `synced ${formatRelative(cacheMeta.savedAt)}`
    : "not cached";
  const cacheIsStale =
    cacheMeta?.savedAt &&
    Date.now() - new Date(cacheMeta.savedAt).getTime() > CACHE_STALE_MS;

  const handleTileClick = (tile) => {
    const variants = tile.product.variants || [];
    if (variants.length === 1) {
      const v = variants[0];
      onAddToCart({
        type: "flexi",
        productId: tile.product._id,
        variantId: v._id,
        productName: tile.product.name,
        variantTitle: v.selectedOptions || [],
        sku: v.sku,
        unitPrice: v.price,
        quantity: 1,
        discount: 0,
        image: v.images?.[0]?.url || tile.product.defaultImage?.url,
      });
      return;
    }
    onOpenVariantPicker(tile.product);
  };

  return (
    <div className="flex flex-col h-full">
      {(isOffline || cacheIsStale) && (
        <div
          className={`px-3 py-1.5 text-xs flex items-center justify-between flex-shrink-0 ${
            isOffline
              ? "bg-amber-50 border-b border-amber-200 text-amber-800"
              : "bg-blue-50 border-b border-blue-200 text-blue-800"
          }`}
        >
          <span>
            {isOffline
              ? "⚠ Offline — showing cached catalogue"
              : "ℹ Cache is stale — reconnecting…"}
          </span>
          <span className="font-mono">
            {cacheMeta?.count ?? 0} · {cacheLabel}
          </span>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-auto">
        {loading && tiles.length === 0 ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : error && tiles.length === 0 ? (
          <div className="p-4 text-sm text-red-600">{error}</div>
        ) : tiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-400">
            <p className="text-lg">No products found</p>
            <p className="text-sm">
              {searchQuery ? "Try a different search" : "No products available"}
            </p>
          </div>
        ) : (
          <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {tiles.map((t) => (
              <button
                key={t.key}
                disabled={t.soldOut}
                onClick={() => handleTileClick(t)}
                className={`flex flex-col text-left rounded-lg border p-2 transition ${
                  t.soldOut
                    ? "opacity-40 cursor-not-allowed border-gray-200"
                    : "border-gray-200 hover:border-blue-500 hover:shadow-sm"
                }`}
              >
                <div className="w-full aspect-square bg-gray-100 rounded overflow-hidden mb-2">
                  {t.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.image}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : null}
                </div>
                <p className="text-sm font-medium text-gray-900 line-clamp-2">
                  {t.product.name}
                </p>
                {t.variantCount > 1 && (
                  <p className="text-xs text-gray-500">
                    {t.variantCount} variants
                  </p>
                )}
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm font-semibold text-blue-600">
                    {t.priceLabel}
                  </span>
                  <span
                    className={`text-xs ${
                      t.soldOut
                        ? "text-red-600"
                        : t.stock != null
                          ? "text-gray-500"
                          : "text-gray-400"
                    }`}
                  >
                    {t.soldOut
                      ? "Out"
                      : t.stock != null
                        ? `${t.stock}`
                        : "—"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}