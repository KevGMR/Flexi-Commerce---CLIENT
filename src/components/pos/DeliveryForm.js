"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";

export default function DeliveryForm({ value, onChange, locationId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [availableOptions, setAvailableOptions] = useState([]);

  // Fetch delivery categories from location settings
  useEffect(() => {
    if (!locationId) return;

    const fetchCategories = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/locations/${locationId}/delivery-categories`);
        const cats = res?.categories || [];
        setCategories(cats);
        // If there's a selected category, update options
        if (value.deliveryCategory) {
          const selected = cats.find((c) => c.categoryName === value.deliveryCategory);
          if (selected) {
            setAvailableOptions(selected.childOptions || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch delivery categories:", err);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [locationId]);

  // Update available options when category changes
  useEffect(() => {
    if (!value.deliveryCategory) {
      setAvailableOptions([]);
      return;
    }
    const selected = categories.find((c) => c.categoryName === value.deliveryCategory);
    setAvailableOptions(selected?.childOptions || []);
    // Reset delivery option if it doesn't belong to the new category
    if (selected && !selected.childOptions?.some((o) => o.optionName === value.deliveryOption)) {
      onChange({
        ...value,
        deliveryOption: "",
      });
    }
  }, [value.deliveryCategory, categories]);

  const handleFieldChange = (field, val) => {
    onChange({
      ...value,
      [field]: val,
    });
  };

  const handleAddressChange = (field, val) => {
    onChange({
      ...value,
      deliveryAddress: {
        ...value.deliveryAddress,
        [field]: val,
      },
    });
  };

  if (loading) {
    return (
      <div className="text-sm text-gray-500">Loading delivery options...</div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Recipient Name */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Recipient Name</label>
        <input
          type="text"
          value={value.recipientName || ""}
          onChange={(e) => handleFieldChange("recipientName", e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          placeholder="Full name"
        />
      </div>

      {/* Recipient Phone */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Phone</label>
        <input
          type="tel"
          value={value.recipientPhone || ""}
          onChange={(e) => handleFieldChange("recipientPhone", e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          placeholder="Phone number"
        />
      </div>

      {/* Recipient Email */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Email</label>
        <input
          type="email"
          value={value.recipientEmail || ""}
          onChange={(e) => handleFieldChange("recipientEmail", e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          placeholder="Email address"
        />
      </div>

      {/* Delivery Category */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Delivery Category</label>
        <select
          value={value.deliveryCategory || ""}
          onChange={(e) => handleFieldChange("deliveryCategory", e.target.value)}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat.categoryName}>
              {cat.categoryName}
            </option>
          ))}
        </select>
      </div>

      {/* Delivery Option (dependent on category) */}
      {availableOptions.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-700">Delivery Option</label>
          <select
            value={value.deliveryOption || ""}
            onChange={(e) => handleFieldChange("deliveryOption", e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="">Select option</option>
            {availableOptions.map((opt) => (
              <option key={opt._id} value={opt.optionName}>
                {opt.optionName} - ${opt.price.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Delivery Address */}
      <div className="border-t border-gray-200 pt-3">
        <p className="text-xs font-medium text-gray-700 mb-2">Delivery Address</p>
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Street"
            value={value.deliveryAddress?.street || ""}
            onChange={(e) => handleAddressChange("street", e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="City"
              value={value.deliveryAddress?.city || ""}
              onChange={(e) => handleAddressChange("city", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="State/Province"
              value={value.deliveryAddress?.state || ""}
              onChange={(e) => handleAddressChange("state", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Postal Code"
              value={value.deliveryAddress?.postalCode || ""}
              onChange={(e) => handleAddressChange("postalCode", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              type="text"
              placeholder="Country"
              value={value.deliveryAddress?.country || "Kenya"}
              onChange={(e) => handleAddressChange("country", e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
            />
          </div>
          <input
            type="text"
            placeholder="Landmark (optional)"
            value={value.deliveryAddress?.landmark || ""}
            onChange={(e) => handleAddressChange("landmark", e.target.value)}
            className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-700">Delivery Notes</label>
        <textarea
          value={value.notes || ""}
          onChange={(e) => handleFieldChange("notes", e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          placeholder="Special instructions for delivery"
        />
      </div>
    </div>
  );
}