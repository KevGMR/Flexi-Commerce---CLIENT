"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAddressAutocomplete } from "@/hooks/useAddressAutocomplete";

export default function AddressAutocompleteInput({
  name = "street",
  value,
  onChange,
  onSelectSuggestion,
  disabled = false,
  placeholder = "Street",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef(null);

  const { suggestions, loading, error, minQueryLength } = useAddressAutocomplete(value, {
    enabled: !disabled,
  });

  const showSuggestions = useMemo(
    () => isOpen && !disabled && value.trim().length >= minQueryLength,
    [disabled, isOpen, minQueryLength, value],
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (suggestion) => {
    onSelectSuggestion?.(suggestion);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event) => {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      handleSelect(suggestions[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <input
        name={name}
        value={value}
        onChange={(event) => {
          onChange?.(event);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        className={className}
      />

      {showSuggestions && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded border border-zinc-200 bg-white shadow-lg">
          {loading && (
            <div className="px-3 py-2 text-xs text-zinc-500">Searching addresses...</div>
          )}

          {!loading && suggestions.length === 0 && !error && (
            <div className="px-3 py-2 text-xs text-zinc-500">No suggestions found.</div>
          )}

          {!loading && error && (
            <div className="px-3 py-2 text-xs text-red-600">{error}</div>
          )}

          {!loading &&
            suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                type="button"
                onClick={() => handleSelect(suggestion)}
                className={`block w-full px-3 py-2 text-left text-xs ${
                  index === activeIndex ? "bg-zinc-100 text-zinc-900" : "text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {suggestion.label}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
