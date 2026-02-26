"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";
import { validateDeliveryForm } from "@/lib/validation";

export default function CreateDeliveryPage() {
  const router = useRouter();
  const { permissions, locationsMeta, selectedLocationId } = useSessionStore();
  const [mode, setMode] = useState("standalone"); // standalone or sale-linked
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({});
  const [deliveryCategories, setDeliveryCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [sales, setSales] = useState([]);
  const [showSaleSearch, setShowSaleSearch] = useState(false);

  const [formData, setFormData] = useState({
    locationId: selectedLocationId || "",
    deliveryCategory: "",
    deliveryOption: "",
    amount: 0,
    recipientName: "",
    recipientPhone: "",
    recipientEmail: "",
    deliveryAddress: {
      street: "",
      city: "",
      state: "",
      postalCode: "",
    },
    saleId: "",
  });

  const [saleSearch, setSaleSearch] = useState("");

  const canCreate = permissions?.includes(PERMISSIONS.DELIVERY_FEES_CREATE);

  useEffect(() => {
    if (!canCreate) return;

    // Fetch location settings and categories when location changes
    if (formData.locationId) {
      const fetchLocationData = async () => {
        try {
          // Fetch delivery categories
          const categoriesResponse = await apiFetch(`/locations/${formData.locationId}/delivery-categories`);
          const categories = categoriesResponse?.categories || [];
          setDeliveryCategories(categories);
          
        } catch (err) {
          console.error("Failed to fetch location data:", err);
        }
      };

      fetchLocationData();
    }
  }, [formData.locationId, canCreate]);

  useEffect(() => {
    // Search sales when typing
    if (saleSearch.length > 2 && mode === "sale-linked") {
      const fetchSales = async () => {
        try {
          const locationParam = formData.locationId
            ? `&locationId=${encodeURIComponent(formData.locationId)}`
            : "";
          const response = await apiFetch(
            `/sales?search=${encodeURIComponent(saleSearch)}&limit=10${locationParam}`,
          );
          const salesData = response?.data?.sales || response;
          setSales(Array.isArray(salesData) ? salesData : []);
        } catch (err) {
          console.error("Failed to fetch sales:", err);
        }
      };

      fetchSales();
    } else {
      setSales([]);
    }
  }, [saleSearch, mode]);

  const handleCategoryChange = (categoryName) => {
    const category = deliveryCategories.find((cat) => cat.categoryName === categoryName);
    setSelectedCategory(category);
    
    // Reset option and amount when category changes
    setFormData((prev) => ({
      ...prev,
      deliveryCategory: categoryName,
      deliveryOption: "",
      amount: 0,
    }));
  };

  const handleOptionChange = (optionName) => {
    const option = selectedCategory?.childOptions?.find((opt) => opt.optionName === optionName);
    if (!option) return;

    setFormData((prev) => ({
      ...prev,
      deliveryOption: optionName,
      amount: option.price,
    }));
  };

  const handleAddressChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      deliveryAddress: {
        ...prev.deliveryAddress,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setValidationErrors({});

    // Validate form data
    const validation = validateDeliveryForm(formData);

    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      setError("Please fix the validation errors");
      return;
    }

    // Additional validation for mode-specific fields
    if (mode === "sale-linked" && !formData.saleId) {
      setError("Please select a sale");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        locationId: formData.locationId,
        amount: formData.amount,
        recipientName: formData.recipientName,
        recipientPhone: formData.recipientPhone,
        recipientEmail: formData.recipientEmail,
        deliveryAddress: formData.deliveryAddress,
        saleId: mode === "sale-linked" ? formData.saleId : undefined,
      };

      payload.deliveryCategory = formData.deliveryCategory;
      payload.deliveryOption = formData.deliveryOption;

      const response = await apiFetch("/delivery-fees", {
        method: "POST",
        body: payload,
      });

      setError("");
      router.push(`/dashboard/deliveries/${response?.data?._id || response?._id}`);
    } catch (err) {
      setError(err.message || "Failed to create delivery");
    } finally {
      setLoading(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Create Delivery</h1>
        <p className="text-sm text-zinc-600">You don't have permission to create deliveries.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="mb-4 rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Go Back
        </button>
        <h1 className="text-3xl font-bold text-zinc-900">Create Delivery</h1>
        <p className="mt-1 text-sm text-zinc-600">Add a new delivery to your system</p>
      </div>

      {/* Mode Selection */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <p className="mb-4 text-sm font-medium text-zinc-900">Delivery Type</p>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="standalone"
              checked={mode === "standalone"}
              onChange={(e) => setMode(e.target.value)}
              className="h-4 w-4"
            />
            <span className="text-sm text-zinc-700">Standalone Delivery</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              value="sale-linked"
              checked={mode === "sale-linked"}
              onChange={(e) => setMode(e.target.value)}
              className="h-4 w-4"
            />
            <span className="text-sm text-zinc-700">Link to Sale</span>
          </label>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Location & Fee Type */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Delivery Settings</h2>
          
          {/* Location */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-zinc-700">Location *</label>
            <select
              value={formData.locationId}
              onChange={(e) => setFormData((prev) => ({ ...prev, locationId: e.target.value }))}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select location</option>
              {locationsMeta?.map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Delivery Category *</label>
              <select
                value={formData.deliveryCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                required
              >
                <option value="">Select category</option>
                {deliveryCategories.map((cat) => (
                  <option key={cat._id} value={cat.categoryName}>
                    {cat.categoryName}
                  </option>
                ))}
              </select>
              {formData.deliveryCategory && selectedCategory?.description && (
                <p className="mt-1 text-xs text-zinc-500">{selectedCategory.description}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Delivery Option *</label>
              <select
                value={formData.deliveryOption}
                onChange={(e) => handleOptionChange(e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                required
                disabled={!formData.deliveryCategory}
              >
                <option value="">Select option</option>
                {selectedCategory?.childOptions?.map((opt) => (
                  <option key={opt._id} value={opt.optionName}>
                    {opt.optionName} - ${opt.price.toFixed(2)} ({opt.estimatedDays}d)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Fee Summary */}
          <div className="mt-4 space-y-2 border-t border-zinc-200 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600">Fee Amount:</span>
              <span className="font-medium text-zinc-900">${formData.amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-semibold">
              <span className="text-zinc-900">Total:</span>
              <span className="text-blue-600">${formData.amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Sale Linking (if mode is sale-linked) */}
        {mode === "sale-linked" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Link to Sale</h2>
            <div className="relative">
              <input
                type="text"
                placeholder="Search sales by receipt number or customer..."
                value={saleSearch}
                onChange={(e) => setSaleSearch(e.target.value)}
                onFocus={() => setShowSaleSearch(true)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
              {showSaleSearch && sales.length > 0 && (
                <div className="absolute top-full z-10 mt-1 w-full rounded border border-zinc-300 bg-white shadow-lg">
                  {sales.map((sale) => (
                    <button
                      key={sale._id}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, saleId: sale._id }));
                        setSaleSearch(`${sale.receiptNumber} - ${sale.customerName || "Unknown Customer"}`);
                        setShowSaleSearch(false);
                      }}
                      className="w-full border-b border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50"
                    >
                      {sale.receiptNumber} - {sale.customerName || "Unknown Customer"} (${sale.totalAmount.toFixed(2)})
                    </button>
                  ))}
                </div>
              )}
            </div>
            {formData.saleId && (
              <p className="mt-2 text-sm text-green-700">✓ Sale linked: {saleSearch}</p>
            )}
          </div>
        )}

        {/* Recipient Info */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Recipient Information</h2>
          {validationErrors.contact && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm text-amber-700">{validationErrors.contact}</p>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-700">Name *</label>
              <input
                type="text"
                value={formData.recipientName}
                onChange={(e) => setFormData((prev) => ({ ...prev, recipientName: e.target.value }))}
                className={`mt-1 block w-full rounded border px-3 py-2 text-sm ${
                  validationErrors.recipientName ? "border-red-300" : "border-zinc-300"
                }`}
                required
              />
              {validationErrors.recipientName && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.recipientName}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Phone</label>
              <input
                type="tel"
                value={formData.recipientPhone}
                onChange={(e) => setFormData((prev) => ({ ...prev, recipientPhone: e.target.value }))}
                className={`mt-1 block w-full rounded border px-3 py-2 text-sm ${
                  validationErrors.recipientPhone ? "border-red-300" : "border-zinc-300"
                }`}
                placeholder="+1234567890"
              />
              {validationErrors.recipientPhone && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.recipientPhone}</p>
              )}
              <p className="mt-1 text-xs text-zinc-500">Include country code (e.g., +1, +254)</p>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-700">Email</label>
              <input
                type="email"
                value={formData.recipientEmail}
                onChange={(e) => setFormData((prev) => ({ ...prev, recipientEmail: e.target.value }))}
                className={`mt-1 block w-full rounded border px-3 py-2 text-sm ${
                  validationErrors.recipientEmail ? "border-red-300" : "border-zinc-300"
                }`}
              />
              {validationErrors.recipientEmail && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.recipientEmail}</p>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Delivery Address</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-zinc-700">Street *</label>
              <input
                type="text"
                value={formData.deliveryAddress.street}
                onChange={(e) => handleAddressChange("street", e.target.value)}
                className={`mt-1 block w-full rounded border px-3 py-2 text-sm ${
                  validationErrors.street ? "border-red-300" : "border-zinc-300"
                }`}
                required
              />
              {validationErrors.street && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.street}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">City *</label>
              <input
                type="text"
                value={formData.deliveryAddress.city}
                onChange={(e) => handleAddressChange("city", e.target.value)}
                className={`mt-1 block w-full rounded border px-3 py-2 text-sm ${
                  validationErrors.city ? "border-red-300" : "border-zinc-300"
                }`}
                required
              />
              {validationErrors.city && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.city}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">State</label>
              <input
                type="text"
                value={formData.deliveryAddress.state}
                onChange={(e) => handleAddressChange("state", e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700">Postal Code</label>
              <input
                type="text"
                value={formData.deliveryAddress.postalCode}
                onChange={(e) => handleAddressChange("postalCode", e.target.value)}
                className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Delivery"}
          </button>
        </div>
      </form>
    </div>
  );
}
