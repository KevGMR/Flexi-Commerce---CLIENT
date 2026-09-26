"use client";

import { useMemo, useState } from "react";

function variantLabel(v) {
  if (!v.selectedOptions || v.selectedOptions.length === 0) {
    return "Default";
  }
  return v.selectedOptions.map((o) => o.value).join(" / ");
}

export default function VariantPickerModal({
  product,
  onPick,
  onClose,
}) {
  const [search, setSearch] = useState("");

  const variants = useMemo(() => {
    const vs = product?.variants || [];
    if (!search.trim()) return vs;
    const q = search.toLowerCase().trim();
    return vs.filter((v) => {
      const label = variantLabel(v).toLowerCase();
      if (label.includes(q)) return true;
      if (v.sku && v.sku.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [product, search]);

  if (!product) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-lg bg-white shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {product.defaultImage?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={product.defaultImage.url}
                alt=""
                className="w-12 h-12 rounded object-cover border border-gray-200 flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                {product.name}
              </h2>
              <p className="text-xs text-gray-500">
                {product.variants?.length || 0} variant
                {(product.variants?.length || 0) === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Search */}
        {product.variants?.length > 6 && (
          <div className="px-5 py-3 border-b border-gray-200 flex-shrink-0">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search variants…"
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        )}

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto">
          {variants.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No variants match your search.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {variants.map((v) => {
                const oos =
                  v.trackInventory !== false &&
                  !v.continueSellingWhenOutOfStock &&
                  (v.availableAtLocation ?? 0) <= 0;
                const img =
                  v.images?.[0]?.url || product.defaultImage?.url || null;
                return (
                  <li key={v._id}>
                    <button
                      type="button"
                      disabled={oos}
                      onClick={() =>
                        onPick({
                          type: "flexi",
                          productId: product._id,
                          variantId: v._id,
                          productName: product.name,
                          variantTitle: v.selectedOptions || [],
                          sku: v.sku,
                          unitPrice: v.price,
                          quantity: 1,
                          discount: 0,
                          image: img,
                        })
                      }
                      className={`w-full flex items-center gap-4 p-3 text-left transition ${
                        oos
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-blue-50"
                      }`}
                    >
                      <div className="w-14 h-14 rounded border border-gray-200 bg-gray-100 overflow-hidden flex-shrink-0">
                        {img ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : null}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {variantLabel(v)}
                        </p>
                        <div className="text-xs text-gray-500 flex gap-3 mt-0.5">
                          {v.sku && (
                            <span className="font-mono">{v.sku}</span>
                          )}
                          <span
                            className={
                              oos ? "text-red-600 font-medium" : ""
                            }
                          >
                            {v.trackInventory === false
                              ? "Not tracked"
                              : oos
                                ? "Out of stock"
                                : `${v.availableAtLocation ?? 0} in stock`}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-blue-600">
                          ${Number(v.price).toFixed(2)}
                        </p>
                        {v.compareAtPrice && (
                          <p className="text-xs text-gray-400 line-through">
                            ${Number(v.compareAtPrice).toFixed(2)}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex justify-end flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}