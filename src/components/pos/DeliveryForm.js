"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";

export default function DeliveryForm({ value, onChange, locationId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/locations/${locationId}/delivery-categories`);
        setCategories(res?.categories || []);
      } catch (err) {
        console.error("Failed to load categories:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [locationId]);

  const handleChange = (field, val) => {
    onChange({ ...value, [field]: val });
  };

  const selectedCategory = categories.find(c => c.categoryName === value?.deliveryCategory);
  const options = selectedCategory?.childOptions || [];

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-zinc-700">Recipient Name</label>
        <input
          type="text"
          value={value?.recipientName || ""}
          onChange={(e) => handleChange("recipientName", e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Phone</label>
        <input
          type="tel"
          value={value?.recipientPhone || ""}
          onChange={(e) => handleChange("recipientPhone", e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Email</label>
        <input
          type="email"
          value={value?.recipientEmail || ""}
          onChange={(e) => handleChange("recipientEmail", e.target.value)}
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Category</label>
        <select
          value={value?.deliveryCategory || ""}
          onChange={(e) => {
            handleChange("deliveryCategory", e.target.value);
            handleChange("deliveryOption", "");
          }}
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Select category</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat.categoryName}>{cat.categoryName}</option>
          ))}
        </select>
      </div>
      {selectedCategory && (
        <div>
          <label className="block text-xs font-medium text-zinc-700">Option</label>
          <select
            value={value?.deliveryOption || ""}
            onChange={(e) => handleChange("deliveryOption", e.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select option</option>
            {options.map((opt) => (
              <option key={opt._id} value={opt.optionName}>{opt.optionName} (${opt.price})</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-zinc-700">Street</label>
        <input
          type="text"
          value={value?.deliveryAddress?.street || ""}
          onChange={(e) => handleChange("deliveryAddress", { ...value?.deliveryAddress, street: e.target.value })}
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">City</label>
        <input
          type="text"
          value={value?.deliveryAddress?.city || ""}
          onChange={(e) => handleChange("deliveryAddress", { ...value?.deliveryAddress, city: e.target.value })}
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-zinc-700">State</label>
          <input
            type="text"
            value={value?.deliveryAddress?.state || ""}
            onChange={(e) => handleChange("deliveryAddress", { ...value?.deliveryAddress, state: e.target.value })}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-zinc-700">Postal Code</label>
          <input
            type="text"
            value={value?.deliveryAddress?.postalCode || ""}
            onChange={(e) => handleChange("deliveryAddress", { ...value?.deliveryAddress, postalCode: e.target.value })}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Country</label>
        <input
          type="text"
          value={value?.deliveryAddress?.country || "Kenya"}
          onChange={(e) => handleChange("deliveryAddress", { ...value?.deliveryAddress, country: e.target.value })}
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Landmark</label>
        <input
          type="text"
          value={value?.deliveryAddress?.landmark || ""}
          onChange={(e) => handleChange("deliveryAddress", { ...value?.deliveryAddress, landmark: e.target.value })}
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-700">Notes</label>
        <textarea
          value={value?.notes || ""}
          onChange={(e) => handleChange("notes", e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}