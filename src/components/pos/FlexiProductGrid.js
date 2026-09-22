// client/src/components/pos/FlexiProductGrid.js
"use client";

import { useEffect, useMemo, useState } from "react";
import { productsApi } from "@/lib/api-client";

function variantLabel(variant) {
  if (!variant.selectedOptions || variant.selectedOptions.length === 0) {
    return "Default";
  }
  return variant.selectedOptions.map((o) => o.value).join(" / ");
}

export default function FlexiProductGrid({
  locationId,
  searchQuery = "",
  onAddToCart,
}) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const handle = setTimeout(() => {
      productsApi
        .posCatalog({
          locationId,
          search: searchQuery.trim() || undefined,
          limit: 100,
        })
        .then((data) => {
          if (cancelled) return;
          setProducts(data.products || []);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err.message || "Failed to load products");
          setProducts([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [locationId, searchQuery]);

  const tiles = useMemo(() => {
    const out = [];
    for (const p of products) {
      for (const v of p.variants || []) {
        const outOfStock =
          v.trackInventory && (v.availableAtLocation ?? 0) <= 0;
        out.push({
          key: `${p._id}:${v._id}`,
          productId: p._id,
          variantId: v._id,
          productName: p.name,
          variantLabel: variantLabel(v),
          selectedOptions: v.selectedOptions || [],
          sku: v.sku,
          price: v.price,
          available: v.availableAtLocation,
          trackInventory: v.trackInventory,
          outOfStock,
          image: p.defaultImage?.url,
        });
      }
    }
    return out;
  }, [products]);

  if (!locationId) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Select a location to browse products.
      </div>
    );
  }

  if (loading && tiles.length === 0) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-red-600">
        {error}
      </div>
    );
  }

  if (tiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-400">
        <p className="text-lg">No products found</p>
        <p className="text-sm">
          {searchQuery ? "Try a different search" : "No products available"}
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {tiles.map((t) => (
        <button
          key={t.key}
          disabled={t.outOfStock}
          onClick={() =>
            onAddToCart({
              type: "flexi",
              productId: t.productId,
              variantId: t.variantId,
              productName: t.productName,
              variantTitle: t.selectedOptions,
              sku: t.sku,
              unitPrice: t.price,
              quantity: 1,
              discount: 0,
              image: t.image,
            })
          }
          className={`flex flex-col text-left rounded-lg border p-2 transition ${
            t.outOfStock
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
            {t.productName}
          </p>
          {t.variantLabel !== "Default" && (
            <p className="text-xs text-gray-500">{t.variantLabel}</p>
          )}
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm font-semibold text-blue-600">
              ${Number(t.price).toFixed(2)}
            </span>
            <span
              className={`text-xs ${
                t.outOfStock
                  ? "text-red-600"
                  : t.trackInventory
                    ? "text-gray-500"
                    : "text-gray-400"
              }`}
            >
              {t.trackInventory
                ? t.outOfStock
                  ? "Out"
                  : `${t.available}`
                : "—"}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}