"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";
import AddressAutocompleteInput from "@/components/locations/AddressAutocompleteInput";

export default function LocationsPage() {
  const can = useSessionStore((s) => s.can);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    locationType: "warehouse",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    phone: "",
    email: "",
    taxRate: "",
    taxMode: "",
    currency: "USD",
    isDefault: false,
  });

  const loadLocations = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/locations");
      setLocations(data?.locations || []);
    } catch (err) {
      setError(err?.message || "Failed to load locations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLocations();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleAddressSelect = (address) => {
    setForm((prev) => ({
      ...prev,
      name: address.label || prev.name,
      street: address.street || prev.street,
      city: address.city || "",
      state: address.state || "",
      postalCode: address.postalCode || "",
      country: address.country || "",
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setStatus("");
    setError("");
    try {
      await apiFetch("/locations", {
        method: "POST",
        body: {
          name: form.name,
          locationType: form.locationType,
          address: {
            street: form.street,
            city: form.city,
            state: form.state,
            postalCode: form.postalCode,
            country: form.country,
          },
          phone: form.phone,
          email: form.email,
          taxRate: form.taxRate ? Number(form.taxRate) : 0,
          taxMode: form.taxMode || undefined,
          currency: form.currency,
          isDefault: form.isDefault,
        },
      });
      setStatus("Location created successfully.");
      setForm({
        name: "",
        locationType: "warehouse",
        street: "",
        city: "",
        state: "",
        postalCode: "",
        country: "",
        phone: "",
        email: "",
        taxRate: "",
        taxMode: "",
        currency: "USD",
        isDefault: false,
      });
      await loadLocations();
    } catch (err) {
      setError(err?.message || "Failed to create location.");
    }
  };

  const canManage = can(PERMISSIONS.MANAGE_INVENTORY);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Locations</h1>

      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold mb-3">All Locations</h2>
        {loading ? (
          <div className="text-sm text-zinc-500">Loading...</div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <div key={loc._id} className="border border-zinc-200 rounded p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{loc.name}</div>
                    <div className="text-xs text-zinc-500">{loc.locationType}</div>
                  </div>
                  {loc.isDefault && (
                    <span className="text-xs px-2 py-1 rounded bg-green-50 text-green-700">Default</span>
                  )}
                </div>
                <div className="mt-2 text-xs text-zinc-600">
                  {loc.address?.street || loc.address?.city ? (
                    <span>
                      {loc.address?.street || ""} {loc.address?.city || ""}
                    </span>
                  ) : (
                    <span>No address provided</span>
                  )}
                </div>
                {loc.shopifyLocationName && (
                  <div className="mt-1 text-xs text-blue-600">
                    Shopify: {loc.shopifyLocationName}
                  </div>
                )}
                <div className="mt-1 text-xs text-zinc-600">
                  Tax mode: {loc.taxMode || "Inherit org default"}
                </div>
              </div>
            ))}
            {locations.length === 0 && (
              <div className="text-xs text-zinc-500">No locations found.</div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold mb-3">Create Location</h2>
        {status && (
          <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm text-green-700">
            {status}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AddressAutocompleteInput
              name="name"
              value={form.name}
              onChange={handleChange}
              onSelectSuggestion={handleAddressSelect}
              disabled={!canManage}
              placeholder="Location name (type to search)"
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              name="locationType"
              value={form.locationType}
              onChange={handleChange}
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="warehouse">Warehouse</option>
              <option value="retail">Retail</option>
              <option value="fulfillment">Fulfillment</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="street"
              value={form.street}
              onChange={handleChange}
              placeholder="Street"
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="City"
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="state"
              value={form.state}
              onChange={handleChange}
              placeholder="State"
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="postalCode"
              value={form.postalCode}
              onChange={handleChange}
              placeholder="Postal code"
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="country"
              value={form.country}
              onChange={handleChange}
              placeholder="Country"
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="currency"
              value={form.currency}
              onChange={handleChange}
              placeholder="Currency"
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="Phone"
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <input
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Email"
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              name="taxRate"
              value={form.taxRate}
              onChange={handleChange}
              placeholder="Tax rate (e.g., 0.16)"
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              name="taxMode"
              value={form.taxMode}
              onChange={handleChange}
              disabled={!canManage}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Tax mode: Inherit organization default</option>
              <option value="inclusive">Inclusive (tax included in price)</option>
              <option value="exclusive">Exclusive (tax added on top)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-700">
              <input
                type="checkbox"
                name="isDefault"
                checked={form.isDefault}
                onChange={handleChange}
                disabled={!canManage}
              />
              Set as default location
            </label>
          </div>

          <button
            type="submit"
            disabled={!canManage}
            className="px-4 py-2 rounded bg-zinc-900 text-white text-sm disabled:opacity-50"
          >
            Create Location
          </button>
        </form>

        {!canManage && (
          <p className="mt-3 text-xs text-zinc-500">
            You don’t have permission to manage locations.
          </p>
        )}
      </div>
    </div>
  );
}
