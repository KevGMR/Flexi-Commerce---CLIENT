"use client";

import { useState, useEffect } from "react";

const BASE_METHODS = [
  { key: "cash", label: "Cash", icon: "💵", custom: false },
  { key: "card", label: "Card", icon: "💳", custom: false },
  { key: "mpesa", label: "M-Pesa", icon: "📱", custom: false },
  { key: "gift_card", label: "Gift Card", icon: "🎁", custom: false },
];

/**
 * Renders an editable list of payment methods.
 *
 * Props:
 *   value:         current array of { key, label, icon, enabled, isDefault, custom }
 *                  if undefined/null/empty → seeded from BASE_METHODS
 *   onChange:      (nextArray) => void
 *   allowEmpty:    if true, a location can set [] to mean "inherit org defaults"
 *                  shows an "Use organization defaults" toggle
 *   orgDefaults:   the org's array, shown as a preview when inheriting
 *   mode:          "org" | "location"
 */
export function PaymentMethodsSection({
  value,
  onChange,
  allowEmpty = false,
  orgDefaults = [],
  mode = "org",
}) {
  const [inheriting, setInheriting] = useState(
    allowEmpty && (!Array.isArray(value) || value.length === 0),
  );

  useEffect(() => {
    if (!allowEmpty) return;
    const isEmpty = !Array.isArray(value) || value.length === 0;
    setInheriting(isEmpty);
  }, [value, allowEmpty]);

  const methods = inheriting ? [] : (Array.isArray(value) && value.length ? value : BASE_METHODS.map((m, i) => ({ ...m, enabled: true, isDefault: i === 0 })));

  const update = (next) => onChange(next);

  const toggleEnabled = (idx) => {
    const next = methods.map((m, i) => (i === idx ? { ...m, enabled: !m.enabled } : m));
    update(next);
  };

  const setLabel = (idx, label) => {
    const next = methods.map((m, i) => (i === idx ? { ...m, label } : m));
    update(next);
  };

  const setIcon = (idx, icon) => {
    const next = methods.map((m, i) => (i === idx ? { ...m, icon } : m));
    update(next);
  };

  const setDefault = (idx) => {
    const next = methods.map((m, i) => ({ ...m, isDefault: i === idx }));
    update(next);
  };

  const removeMethod = (idx) => {
    const next = methods.filter((_, i) => i !== idx);
    if (next.length && !next.some((m) => m.isDefault)) next[0].isDefault = true;
    update(next);
  };

  const addCustom = () => {
    const key = window.prompt(
      "Method key (lowercase, letters/numbers/underscore — e.g. 'bank_transfer')",
    );
    if (!key) return;
    const clean = key.toLowerCase().trim();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(clean)) {
      alert("Key must start with a letter and contain only a-z, 0-9, _");
      return;
    }
    if (methods.some((m) => m.key === clean)) {
      alert("That key already exists");
      return;
    }
    const label = window.prompt("Display label (e.g. 'Bank Transfer')") || clean;
    const icon = window.prompt("Icon (emoji or URL, optional)") || "";
    update([
      ...methods,
      {
        key: clean,
        label: label.slice(0, 40),
        icon: icon.slice(0, 300),
        enabled: true,
        isDefault: false,
        custom: true,
      },
    ]);
  };

  const handleInheritToggle = (useInherit) => {
    setInheriting(useInherit);
    if (useInherit) {
      update([]);
    } else {
      update(
        (Array.isArray(orgDefaults) && orgDefaults.length
          ? orgDefaults
          : BASE_METHODS.map((m, i) => ({ ...m, enabled: true, isDefault: i === 0 }))
        ).map((m) => ({ ...m })),
      );
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          {mode === "org" ? "Organization payment methods" : "Payment methods for this location"}
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          {mode === "org"
            ? "These are the default payment methods shown at every location."
            : "If set, these override the organization defaults for this location."}
        </p>
      </div>

      {allowEmpty && (
        <label className="mb-4 flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inheriting}
            onChange={(e) => handleInheritToggle(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          <span className="text-sm text-gray-700">
            Use organization defaults
            {orgDefaults?.length ? (
              <span className="ml-2 text-xs text-gray-500">
                ({orgDefaults.filter((m) => m.enabled !== false).map((m) => m.label).join(", ")})
              </span>
            ) : null}
          </span>
        </label>
      )}

      {!inheriting && (
        <>
          <div className="space-y-3">
            {methods.map((m, idx) => (
              <div
                key={m.key}
                className="flex flex-wrap items-center gap-3 rounded border border-gray-200 bg-gray-50 px-3 py-2"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={m.enabled !== false}
                    onChange={() => toggleEnabled(idx)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                </label>

                <input
                  type="text"
                  value={m.icon || ""}
                  onChange={(e) => setIcon(idx, e.target.value)}
                  placeholder="💵"
                  className="w-12 rounded border border-gray-300 px-2 py-1 text-center text-lg"
                  maxLength={300}
                />

                <input
                  type="text"
                  value={m.label}
                  onChange={(e) => setLabel(idx, e.target.value)}
                  className="flex-1 min-w-[140px] rounded border border-gray-300 px-2 py-1 text-sm"
                  maxLength={40}
                />

                <code className="text-xs text-gray-400 hidden sm:inline">
                  {m.key}
                </code>

                <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="radio"
                    name={`default-${mode}`}
                    checked={m.isDefault === true}
                    onChange={() => setDefault(idx)}
                    className="h-3 w-3"
                  />
                  Default
                </label>

                {m.custom && (
                  <button
                    type="button"
                    onClick={() => removeMethod(idx)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={addCustom}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              + Add custom method
            </button>
            <p className="text-xs text-gray-500">
              Disabled methods stay in the list but won't show at the POS.
            </p>
          </div>
        </>
      )}
    </div>
  );
}