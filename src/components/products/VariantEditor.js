"use client";

import { useEffect, useMemo, useState } from "react";
import { optionPresetsApi } from "@/lib/api-client";
import VariantImagePicker from "./VariantImagePicker";
import NumberInput from "./NumberInput";

const MAX_OPTIONS = 3;

function signature(selectedOptions) {
  return [...selectedOptions]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((o) => `${o.name}:${o.value}`)
    .join("|");
}

function cartesian(options) {
  if (!options.length) return [];
  const cleaned = options.filter(
    (o) => o.name.trim() && o.values.filter(Boolean).length,
  );
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

export default function VariantEditor({
  options,
  onOptionsChange,
  variants,
  onVariantsChange,
  productImages = [],
  productPrice = 0
}) {
  const [presets, setPresets] = useState([]);
  const [valueWarnings, setValueWarnings] = useState({}); // { "optIdx:value": true }
  const [nameWarnings, setNameWarnings] = useState({}); // { "optIdx": true }
  const [pickerState, setPickerState] = useState(null); // { variantKey, current }

  // Load presets once
  useEffect(() => {
    optionPresetsApi
      .list()
      .then((data) => setPresets(data.presets || []))
      .catch((err) => console.warn("[VariantEditor] preset load failed:", err));
  }, []);

  const generated = useMemo(() => cartesian(options), [options]);

  // Merge generated combos with existing variants, preserving _id, price, sku, images
  const merged = useMemo(() => {
    const bySig = new Map(
      variants.map((v) => [signature(v.selectedOptions || []), v]),
    );
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
            price: productPrice ?? 0,
            compareAtPrice: null,
            barcode: "",
            trackInventory: true,
            images: [],
          };
    });
  }, [generated, variants, productPrice]);

  // Sync merged up to the parent after render
  useEffect(() => {
    const sig = (arr) =>
      arr
        .map(
          (v) =>
            v._id ||
            v._temp ||
            v.selectedOptions.map((o) => `${o.name}:${o.value}`).join("|"),
        )
        .join(",");
    if (sig(merged) !== sig(variants)) {
      onVariantsChange(merged);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merged]);

  // Clean up warnings after 3s
  useEffect(() => {
    if (Object.keys(valueWarnings).length === 0) return;
    const t = setTimeout(() => setValueWarnings({}), 3000);
    return () => clearTimeout(t);
  }, [valueWarnings]);

  useEffect(() => {
    if (Object.keys(nameWarnings).length === 0) return;
    const t = setTimeout(() => setNameWarnings({}), 3000);
    return () => clearTimeout(t);
  }, [nameWarnings]);

  // -------- option mutations --------

  const updateOption = (i, patch) => {
    const next = options.map((o, idx) => (idx === i ? { ...o, ...patch } : o));
    onOptionsChange(next);
  };

  const addOption = () => {
    if (options.length >= MAX_OPTIONS) return;
    onOptionsChange([
      ...options,
      { name: "", values: [""], position: options.length },
    ]);
  };

  const removeOption = (i) => {
    onOptionsChange(options.filter((_, idx) => idx !== i));
  };

  const handleOptionNameChange = (i, raw) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      updateOption(i, { name: raw });
      return;
    }
    // Reject duplicate option names (case-insensitive)
    const duplicate = options.some(
      (o, idx) =>
        idx !== i &&
        o.name.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setNameWarnings((prev) => ({ ...prev, [i]: true }));
      return;
    }
    updateOption(i, { name: raw });
  };

  const handleValueChange = (optIdx, valIdx, raw) => {
    const opt = options[optIdx];
    const trimmed = raw.trim();

    if (!trimmed) {
      const values = opt.values.map((x, xi) => (xi === valIdx ? raw : x));
      updateOption(optIdx, { values });
      return;
    }

    // Reject duplicate values within this option (case-insensitive)
    const duplicate = opt.values.some(
      (v, vi) =>
        vi !== valIdx && v.trim().toLowerCase() === trimmed.toLowerCase(),
    );
    if (duplicate) {
      setValueWarnings((prev) => ({ ...prev, [`${optIdx}:${valIdx}`]: true }));
      return;
    }

    const values = opt.values.map((x, xi) => (xi === valIdx ? raw : x));
    updateOption(optIdx, { values });
  };

  const removeValue = (optIdx, valIdx) => {
    const opt = options[optIdx];
    updateOption(optIdx, {
      values: opt.values.filter((_, xi) => xi !== valIdx),
    });
  };

  const addValue = (optIdx) => {
    const opt = options[optIdx];
    updateOption(optIdx, { values: [...opt.values, ""] });
  };

  const applyPreset = (optIdx, presetName) => {
    const preset = presets.find((p) => p.name === presetName);
    if (!preset) return;
    updateOption(optIdx, {
      name: preset.name,
      values: [...preset.values],
    });
  };

  // -------- variant mutations --------

  const updateVariantField = (key, field, value) => {
    onVariantsChange(
      variants.map((v) =>
        (v._id || v._temp) === key ? { ...v, [field]: value } : v,
      ),
    );
  };

  const setVariantImage = (key, image) => {
    onVariantsChange(
      variants.map((v) =>
        (v._id || v._temp) === key
          ? {
              ...v,
              images: image
                ? [
                    {
                      url: image.url,
                      alt: image.alt || "",
                      isDefault: true,
                      shopifyFileId: image.shopifyFileId || null,
                    },
                  ]
                : [],
            }
          : v,
      ),
    );
  };

  // -------- grouping --------

  // Group by the first option's value for visual organisation
  const groupedVariants = useMemo(() => {
    if (options.length === 0 || variants.length === 0) {
      return [{ key: null, label: null, variants }];
    }
    const firstOptionName = options[0]?.name?.trim();
    if (!firstOptionName) {
      return [{ key: null, label: null, variants }];
    }

    const groups = new Map();
    for (const v of variants) {
      const firstVal =
        v.selectedOptions.find((o) => o.name === firstOptionName)?.value ||
        "Ungrouped";
      if (!groups.has(firstVal)) groups.set(firstVal, []);
      groups.get(firstVal).push(v);
    }

    return [...groups.entries()].map(([label, vs]) => ({
      key: label,
      label,
      variants: vs,
    }));
  }, [variants, options]);

  const showGrouping = options.length > 0 && options[0]?.name?.trim();

  // -------- render --------

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
            <div className="flex gap-2 items-center">
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value) applyPreset(i, e.target.value);
                  e.target.value = "";
                }}
                className="text-xs border rounded px-2 py-1.5 text-gray-600"
              >
                <option value="">Preset…</option>
                {presets.map((p) => (
                  <option key={p._id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>

              <input
                type="text"
                placeholder='Option name (e.g. "Color", "Size")'
                value={opt.name}
                onChange={(e) => handleOptionNameChange(i, e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-md text-sm ${
                  nameWarnings[i] ? "border-red-400 bg-red-50" : ""
                }`}
              />
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-md"
              >
                Remove
              </button>
            </div>
            {nameWarnings[i] && (
              <p className="text-xs text-red-600">
                An option with this name already exists
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {opt.values.map((v, vi) => (
                <div
                  key={vi}
                  className={`flex items-center gap-1 border rounded-full pl-3 pr-1 py-1 ${
                    valueWarnings[`${i}:${vi}`]
                      ? "bg-red-50 border-red-400"
                      : "bg-gray-50"
                  }`}
                >
                  <input
                    type="text"
                    value={v}
                    placeholder="Value"
                    onChange={(e) => handleValueChange(i, vi, e.target.value)}
                    className="bg-transparent text-sm outline-none w-24"
                  />
                  <button
                    type="button"
                    onClick={() => removeValue(i, vi)}
                    className="w-5 h-5 rounded-full hover:bg-gray-200 text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addValue(i)}
                className="px-3 py-1 text-sm border rounded-full hover:bg-gray-50"
              >
                + Value
              </button>
            </div>
            {Object.keys(valueWarnings).some((k) => k.startsWith(`${i}:`)) && (
              <p className="text-xs text-red-600">
                Duplicate value in this option
              </p>
            )}
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
                  <th className="px-3 py-2 text-left w-16">Image</th>
                  {options.filter((o) => o.name).map((o, i) => (
                    <th key={i} className="px-3 py-2 text-left">
                      {o.name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left">SKU</th>
                  <th className="px-3 py-2 text-right">Price</th>
                  <th className="px-3 py-2 text-right">Compare at</th>
                  <th className="px-3 py-2 text-center">Track</th>
                </tr>
              </thead>
              <tbody>
                {groupedVariants.map((group) => (
                  <>
                    {showGrouping && group.label && (
                      <tr
                        key={`grp-${group.key}`}
                        className="bg-gray-100 border-b"
                      >
                        <td
                          colSpan={7}
                          className="px-3 py-1.5 text-xs font-semibold text-gray-700"
                        >
                          {options[0].name}: {group.label}
                        </td>
                      </tr>
                    )}
                    {group.variants.map((v) => {
                      const key = v._id || v._temp;
                      const variantImage = v.images?.[0];
                      return (
                        <tr key={key} className="border-b last:border-b-0">
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() =>
                                setPickerState({
                                  variantKey: key,
                                  current: variantImage,
                                })
                              }
                              className="w-10 h-10 rounded border bg-gray-100 overflow-hidden flex items-center justify-center text-xs text-gray-500 hover:border-blue-400"
                              title={
                                variantImage ? "Change image" : "Assign image"
                              }
                            >
                              {variantImage?.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={variantImage.url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                "+"
                              )}
                            </button>
                          </td>
                          {v.selectedOptions.map((so, si) => (
                            <td key={si} className="px-3 py-2">
                              {so.value}
                            </td>
                          ))}
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={v.sku || ""}
                              onChange={(e) =>
                                updateVariantField(key, "sku", e.target.value)
                              }
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <NumberInput
                              value={v.price}
                              onChange={(val) => updateVariantField(key, "price", val)}
                              emptyValue={0}
                              min={0}
                              className="w-24 px-2 py-1 border rounded text-sm text-right"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                          <td className="px-3 py-2 text-right">
                            <NumberInput
                              value={v.compareAtPrice}
                              onChange={(val) => updateVariantField(key, "compareAtPrice", val)}
                              emptyValue={null}
                              min={0}
                              className="w-24 px-2 py-1 border rounded text-sm text-right"
                            />
                          </td>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={v.trackInventory !== false}
                              onChange={(e) =>
                                updateVariantField(
                                  key,
                                  "trackInventory",
                                  e.target.checked,
                                )
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Variant image picker */}
      {pickerState && (
        <VariantImagePicker
          productImages={productImages}
          current={pickerState.current}
          onPick={(img) => {
            setVariantImage(pickerState.variantKey, img);
            setPickerState(null);
          }}
          onClear={() => {
            setVariantImage(pickerState.variantKey, null);
            setPickerState(null);
          }}
          onClose={() => setPickerState(null)}
        />
      )}
    </div>
  );
}