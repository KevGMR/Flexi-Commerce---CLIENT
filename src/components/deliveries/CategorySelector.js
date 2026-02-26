"use client";

import { useState, useEffect } from "react";

export default function CategorySelector({
  categories,
  selectedCategory,
  selectedOption,
  onCategoryChange,
  onOptionChange,
  disabled = false,
  showPrice = true,
}) {
  const [availableOptions, setAvailableOptions] = useState([]);

  useEffect(() => {
    if (selectedCategory) {
      const category = categories?.find((cat) => cat.categoryName === selectedCategory);
      setAvailableOptions(
        category?.childOptions?.filter((opt) => opt.isActive) || []
      );
    } else {
      setAvailableOptions([]);
    }
  }, [selectedCategory, categories]);

  const selectedOptionData = availableOptions.find(
    (opt) => opt.optionName === selectedOption
  );

  return (
    <div className="space-y-4">
      {/* Category Selection */}
      <div>
        <label className="block text-sm font-medium text-zinc-700">
          Delivery Category *
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
          disabled={disabled}
          className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-zinc-100"
          required
        >
          <option value="">Select a category</option>
          {categories
            ?.filter((cat) => cat.isActive)
            ?.map((cat) => (
              <option key={cat.categoryName} value={cat.categoryName}>
                {cat.categoryName}
              </option>
            ))}
        </select>
        {selectedCategory && (
          <p className="mt-1 text-xs text-zinc-500">
            {categories?.find((cat) => cat.categoryName === selectedCategory)?.description}
          </p>
        )}
      </div>

      {/* Option Selection */}
      {selectedCategory && (
        <div>
          <label className="block text-sm font-medium text-zinc-700">
            Delivery Option *
          </label>
          <select
            value={selectedOption}
            onChange={(e) => onOptionChange(e.target.value)}
            disabled={disabled || !selectedCategory}
            className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none disabled:bg-zinc-100"
            required
          >
            <option value="">Select an option</option>
            {availableOptions.map((opt) => (
              <option key={opt.optionName} value={opt.optionName}>
                {opt.optionName}
                {showPrice && ` - $${opt.price.toFixed(2)}`}
              </option>
            ))}
          </select>
          {selectedOptionData && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-zinc-500">{selectedOptionData.description}</p>
              {showPrice && (
                <p className="text-sm font-semibold text-blue-600">
                  Price: ${selectedOptionData.price.toFixed(2)}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
