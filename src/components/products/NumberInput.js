"use client";

import { useEffect, useState } from "react";

/**
 * Number input that renders empty when the value is 0 or null,
 * saves `emptyValue` on blur when cleared, and shows a placeholder.
 */
export default function NumberInput({
  value,
  onChange,
  emptyValue = 0,
  placeholder = "0.00",
  step = "0.01",
  min,
  className = "",
  disabled = false,
}) {
  const [local, setLocal] = useState(() =>
    value === 0 || value === null || value === undefined ? "" : String(value),
  );
  const [focused, setFocused] = useState(false);

  // Sync from parent when not focused (parent may reset, load, etc.)
  useEffect(() => {
    if (focused) return;
    setLocal(
      value === 0 || value === null || value === undefined ? "" : String(value),
    );
  }, [value, focused]);

  const handleBlur = () => {
    setFocused(false);
    if (local.trim() === "") {
      onChange(emptyValue);
      return;
    }
    const num = Number(local);
    if (Number.isNaN(num)) {
      onChange(emptyValue);
      setLocal("");
      return;
    }
    onChange(num);
    setLocal(String(num));
  };

  return (
    <input
      type="number"
      step={step}
      min={min}
      value={local}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={handleBlur}
      className={className}
    />
  );
}