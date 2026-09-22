"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";
import { validateDeliveryForm } from "@/lib/validation";

export default function EditDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const { permissions } = useSessionStore();
  const [delivery, setDelivery] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [formData, setFormData] = useState({
    recipientName: "",
    recipientPhone: "",
    recipientEmail: "",
    deliveryAddress: {
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
    },
    deliveryNotes: "",
  });

  const [validationErrors, setValidationErrors] = useState({});

  const canUpdate = permissions?.includes(PERMISSIONS.DELIVERY_FEES_UPDATE);

  useEffect(() => {
    if (!canUpdate) {
      setError("You don't have permission to edit deliveries");
      setLoading(false);
      return;
    }

    const fetchDelivery = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/delivery-fees/${params.id}`);
        const deliveryData = response?.data || response;
        
        if (!deliveryData) {
          setError("Delivery not found");
          return;
        }

        // Check if delivery can be edited (not in terminal status)
        const terminalStatuses = ["delivered", "completed", "cancelled", "failed", "picked_up", "collected"];
        const currentStatus = deliveryData.categoryStatus;
        
        if (terminalStatuses.includes(currentStatus)) {
          setError("Cannot edit deliveries in terminal status");
          return;
        }

        setDelivery(deliveryData);
        setFormData({
          recipientName: deliveryData.recipientName || "",
          recipientPhone: deliveryData.recipientPhone || "",
          recipientEmail: deliveryData.recipientEmail || "",
          deliveryAddress: {
            street: deliveryData.deliveryAddress?.street || "",
            city: deliveryData.deliveryAddress?.city || "",
            state: deliveryData.deliveryAddress?.state || "",
            postalCode: deliveryData.deliveryAddress?.postalCode || "",
            country: deliveryData.deliveryAddress?.country || "",
          },
          deliveryNotes: deliveryData.deliveryNotes || "",
        });
      } catch (err) {
        console.error("Failed to fetch delivery:", err);
        setError(err?.message || "Failed to load delivery details");
      } finally {
        setLoading(false);
      }
    };

    fetchDelivery();
  }, [params.id, canUpdate]);

  const validateForm = () => {
    const validation = validateDeliveryForm({
      ...formData,
      locationId: delivery?.locationId,
      deliveryCategory: delivery?.deliveryCategory,
      deliveryOption: delivery?.deliveryOption,
    });

    setValidationErrors(validation.errors);
    return validation.isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) {
      setError("Please fix the validation errors");
      return;
    }

    try {
      setSaving(true);
      await apiFetch(`/delivery-fees/${params.id}`, {
        method: "PATCH",
        body: formData,
      });
      setSuccess("Delivery updated successfully");
      setTimeout(() => {
        router.push(`/dashboard/deliveries/${params.id}`);
      }, 1500);
    } catch (err) {
      console.error("Failed to update delivery:", err);
      setError(err?.message || "Failed to update delivery");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleAddressChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      deliveryAddress: {
        ...prev.deliveryAddress,
        [field]: value,
      },
    }));
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (!canUpdate || error) {
    return (
      <div className="space-y-6 p-6">
        <button
          onClick={() => router.back()}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Go Back
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-sm text-red-700">{error || "Access denied"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Edit Delivery</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Tracking: {delivery?.trackingNumber}
          </p>
        </div>
        <button
          onClick={() => router.back()}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Cancel
        </button>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {validationErrors.contact && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-700">{validationErrors.contact}</p>
        </div>
      )}

      {/* Edit Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Recipient Information */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            Recipient Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Recipient Name *
              </label>
              <input
                type="text"
                value={formData.recipientName}
                onChange={(e) => handleChange("recipientName", e.target.value)}
                className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  validationErrors.recipientName
                    ? "border-red-300"
                    : "border-zinc-300"
                }`}
                placeholder="John Doe"
              />
              {validationErrors.recipientName && (
                <p className="mt-1 text-xs text-red-600">
                  {validationErrors.recipientName}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.recipientPhone}
                onChange={(e) => handleChange("recipientPhone", e.target.value)}
                className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  validationErrors.recipientPhone
                    ? "border-red-300"
                    : "border-zinc-300"
                }`}
                placeholder="+1234567890"
              />
              {validationErrors.recipientPhone && (
                <p className="mt-1 text-xs text-red-600">
                  {validationErrors.recipientPhone}
                </p>
              )}
              <p className="mt-1 text-xs text-zinc-500">
                Include country code (e.g., +1 for US, +254 for Kenya)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Email Address
              </label>
              <input
                type="email"
                value={formData.recipientEmail}
                onChange={(e) => handleChange("recipientEmail", e.target.value)}
                className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  validationErrors.recipientEmail
                    ? "border-red-300"
                    : "border-zinc-300"
                }`}
                placeholder="john.doe@example.com"
              />
              {validationErrors.recipientEmail && (
                <p className="mt-1 text-xs text-red-600">
                  {validationErrors.recipientEmail}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Address */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            Delivery Address
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Street Address
              </label>
              <input
                type="text"
                value={formData.deliveryAddress.street}
                onChange={(e) => handleAddressChange("street", e.target.value)}
                className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                  validationErrors.street ? "border-red-300" : "border-zinc-300"
                }`}
                placeholder="123 Main Street, Apt 4B"
              />
              {validationErrors.street && (
                <p className="mt-1 text-xs text-red-600">
                  {validationErrors.street}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  City *
                </label>
                <input
                  type="text"
                  value={formData.deliveryAddress.city}
                  onChange={(e) => handleAddressChange("city", e.target.value)}
                  className={`mt-1 block w-full rounded-md border px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                    validationErrors.city ? "border-red-300" : "border-zinc-300"
                  }`}
                  placeholder="Nairobi"
                />
                {validationErrors.city && (
                  <p className="mt-1 text-xs text-red-600">
                    {validationErrors.city}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  State/County
                </label>
                <input
                  type="text"
                  value={formData.deliveryAddress.state}
                  onChange={(e) => handleAddressChange("state", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Nairobi County"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={formData.deliveryAddress.postalCode}
                  onChange={(e) => handleAddressChange("postalCode", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="00100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Country
                </label>
                <input
                  type="text"
                  value={formData.deliveryAddress.country}
                  onChange={(e) => handleAddressChange("country", e.target.value)}
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Kenya"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Delivery Notes */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">
            Delivery Notes
          </h2>
          <textarea
            value={formData.deliveryNotes}
            onChange={(e) => handleChange("deliveryNotes", e.target.value)}
            rows={4}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Special delivery instructions, gate codes, landmarks, etc."
          />
          <p className="mt-1 text-xs text-zinc-500">
            Add any special instructions for the delivery
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            disabled={saving}
            className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
