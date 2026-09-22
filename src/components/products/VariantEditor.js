"use client";

import { useMemo, useEffect } from "react";

const MAX_OPTIONS = 3;

function signature(selectedOptions) {
  return [...selectedOptions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((o) => `${o.name}:${o.value}`)
    .join("|");
}

function cartesian(options) {
  if (!options.length) return [];
  const cleaned = options.filter((o) => o.name.trim() && o.values.filter(Boolean).length);
  if (!cleaned.length) return [];
  let acc = [[]];
  for (const opt of cleaned) {
    const vals = opt.values.map((v) => String(v).trim()).filter(Boolean);
    const next = [];
    for (const combo of acc) {
      for (const v of vals) {
        next.push([...combo, { name: opt.name.trim(), value: v }]);
      }
    }
    acc = next;
  }
  return acc;
}

export default function VariantEditor({ options, onOptionsChange, variants, onVariantsChange }) {
  const generated = useMemo(() => cartesian(options), [options]);

  // merge generated combos with existing variants, keeping _id/price/sku
  const merged = useMemo(() => {
    const bySig = new Map(variants.map((v) => [signature(v.selectedOptions || []), v]));
    return generated.map((combo, idx) => {
      const sig = signature(combo);
      const existing = bySig.get(sig);
      return existing
        ? { ...existing, selectedOptions: combo, position: idx }
        : {
            _temp: `new-${idx}-${sig}`,
            selectedOptions: combo,
            position: idx,
            sku: "",
            price: variants[0]?.price ?? 0,
            compareAtPrice: null,
            barcode: "",
            trackInventory: true,
          };
    });
  }, [generated, variants]);

  useEffect(() => {
    if (JSON.stringify(merged) !== JSON.stringify(variants)) {
      onVariantsChange(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged]);

  const updateOption = (i, patch) => {
    const next = options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    onOptionsChange(next);
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    onOptionsChange([...options, { name: "", values: [""], position: options.length }]);
  };

  const removeOption = (i) => {
    onOptionsChange(options.filter((_, idx) => idx !== i));
  };

  const updateVariantField = (tempOrId, field, value) => {
    onVariantsChange(
      variants.map((v) =>
        (v._id || v._temp) === tempOrId ? { ...v, [field]: value } : v
      )
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Options</h3>
        {options.length < MAX_OPTIONS && (
          <button
            type="button"
            onClick={addOption}
            className="text-sm text-blue-600 hover:underline"
          >
            + Add option
          </button>
        )}
      </div>

      {options.length === 0 && (
        <p className="text-sm text-gray-500">
          No options. This product will have a single default variant.
        </p>
      )}

      <div className="space-y-4">
        {options.map((opt, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder='Option name (e.g. "Color", "Size")'
                value={opt.name}
                onChange={(e) => updateOption(i, { name: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-md text-sm"
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                Remove
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {opt.values.map((v, vi) => (
                <div key={vi} className="flex items-center gap-1 border rounded-full pl-3 pr-1 py-1 bg-gray-50">
                  <input
                    type="text"
                    value={v}
                    placeholder="Value"
                    onChange={(e) => {
                      const values = opt.values.map((x, xi) => (xi === vi ? e.target.value : x));
                      updateOption(i, { values });
                    }}
                    className="bg-transparent text-sm outline-none w-24"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      updateOption(i, { values: opt.values.filter((_, xi) => xi !== vi) })
                    }
                    className="w-5 h-5 rounded-full hover:bg-gray-200 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateOption(i, { values: [...opt.values, ""] })}
                className="px-3 py-1 text-sm border rounded-full hover:bg-gray-50"
              >
                + Value
              </button>
            </div>
          </div>
        ))}
      </div>

      {variants.length > 0 && (
        <div>
          <h3 className="text-sm font-medium mb-2">
            Variants ({variants.length})
          </h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>
                  {options.filter((o) => o.name).map((o, i) => (
                    <th key={i} className="px-3 py-2 text-left">{o.name}</th>
                  ))}
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Compare at</th>
                  <th className="px-3 py-2 text-center">Track</th>
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => {
                  const key = v._id || v._temp;
                  return (
                    <tr key={key} className="border-b last:border-b-0">
                      {v.selectedOptions.map((so, si) => (
                        <td key={si} className="px-3 py-2">{so.value}</td>
                      ))}
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={v.sku || ""}
                          onChange={(e) => updateVariantField(key, "sku", e.target.value)}
                          className="w-full px-2 py-1 border rounded text-sm"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={v.price ?? ""}
                          onChange={(e) => updateVariantField(key, "price", Number(e.target.value))}
                          className="w-24 px-2 py-1 border rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={v.compareAtPrice ?? ""}
                          onChange={(e) => updateVariantField(key, "compareAtPrice", e.target.value === "" ? null : Number(e.target.value))}
                          className="w-24 px-2 py-1 border rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={v.trackInventory !== false}
                          onChange={(e) => updateVariantField(key, "trackInventory", e.target.checked)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}