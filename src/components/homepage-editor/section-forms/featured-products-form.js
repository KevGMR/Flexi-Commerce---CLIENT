"use client";

import ProductPicker from "@/components/collections/ProductPicker";

export function FeaturedProductsForm({ config, onChange }) {
  const update = (field, value) => {
    onChange({ ...config, [field]: value });
  };

  const mode = config.mode === "manual" ? "manual" : "latest";
  const productIds = Array.isArray(config.productIds)
    ? config.productIds
    : [];

  const handleAddProduct = (productId) => {
    if (productIds.includes(productId)) return;
    update("productIds", [...productIds, productId]);
  };

  const handleRemoveProduct = (productId) => {
    update(
      "productIds",
      productIds.filter((id) => id !== productId),
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Heading
        </label>
        <input
          type="text"
          value={config.heading || ""}
          onChange={(e) => update("heading", e.target.value)}
          maxLength={120}
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Subheading
        </label>
        <input
          type="text"
          value={config.subheading || ""}
          onChange={(e) => update("subheading", e.target.value)}
          maxLength={240}
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Source
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => update("mode", "latest")}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              mode === "latest"
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            Latest products
          </button>
          <button
            type="button"
            onClick={() => update("mode", "manual")}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              mode === "manual"
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-gray-300 hover:bg-gray-50"
            }`}
          >
            Manual selection
          </button>
        </div>
      </div>

      {mode === "manual" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Products
          </label>
          <div className="space-y-2">
            {productIds.length > 0 && (
              <ul className="space-y-1 rounded-md border border-gray-200 p-2 max-h-48 overflow-y-auto">
                {productIds.map((id) => (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-mono text-gray-600 truncate">
                      {id}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(id)}
                      className="text-red-500 hover:text-red-700 flex-shrink-0"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <ProductPicker
              value={productIds}
              excludeIds={productIds}
              onChange={(ids) => update("productIds", ids)}
            />
            <p className="text-xs text-gray-500">
              {productIds.length} product
              {productIds.length === 1 ? "" : "s"} selected.
            </p>
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Maximum shown
        </label>
        <input
          type="number"
          value={config.limit ?? 8}
          onChange={(e) =>
            update("limit", Math.max(1, Math.min(24, Number(e.target.value) || 8)))
          }
          min={1}
          max={24}
          className="block w-24 rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>
    </div>
  );
}