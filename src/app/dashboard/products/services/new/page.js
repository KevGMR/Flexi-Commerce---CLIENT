"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

// --- Initial form state ---
const createEmptyForm = () => ({
  name: "",
  sku: "",
  description: "",
  status: "active",
  serviceKind: "single",
  tags: "",
  // Single service fields
  commissionType: "percentage",
  commissionValue: "",
  laborCost: "",
  price: "", // auto-calculated
});

// --- Initial bundle sub‑service row ---
const createBundleRow = (initial = {}) => ({
  name: initial.name || "",
  laborCost: initial.laborCost !== undefined ? String(initial.laborCost) : "",
  commissionDeductionTiming: initial.commissionDeductionTiming || "before_commission",
  commissionType: initial.commissionType || "percentage",
  commissionValue: initial.commissionValue !== undefined ? String(initial.commissionValue) : "",
  isAggregator: initial.isAggregator || false,
  defaultAssignedUser: initial.defaultAssignedUser || "",
});

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Helper to slugify a string for SKU
const slugify = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function NewServicePage() {
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const canCreate = can(PERMISSIONS.CREATE_PRODUCT);

  const [services, setServices] = useState([]);
  const [form, setForm] = useState(createEmptyForm());
  const [bundleRows, setBundleRows] = useState([createBundleRow()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [skuManuallyEdited, setSkuManuallyEdited] = useState(false);

  const loadServices = async () => {
    try {
      const res = await apiFetch("/products?type=service&limit=200");
      setServices(res?.products || []);
    } catch (err) {
      setServices([]);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  // Auto-generate SKU when name changes (if not manually edited)
  const generateUniqueSku = (name, existingServices) => {
    if (!name.trim()) return "";
    let base = slugify(name);
    let sku = base;
    let counter = 1;
    while (existingServices.some((s) => s.sku === sku)) {
      sku = `${base}-${counter}`;
      counter++;
    }
    return sku;
  };

  const updateSkuFromName = (name) => {
    if (!skuManuallyEdited) {
      const newSku = generateUniqueSku(name, services);
      setForm((prev) => ({ ...prev, sku: newSku }));
    }
  };

  // Recalculate price based on serviceKind
  const recalcPrice = () => {
    if (form.serviceKind === "single") {
      const total = toNumberOrZero(form.laborCost);
      setForm((prev) => ({ ...prev, price: total.toString() }));
    } else {
      // bundle: sum of laborCost of all sub‑services (productCost removed)
      const total = bundleRows.reduce((sum, row) => {
        return sum + toNumberOrZero(row.laborCost);
      }, 0);
      setForm((prev) => ({ ...prev, price: total.toString() }));
    }
  };

  // Trigger recalc when relevant fields change
  useEffect(() => {
    recalcPrice();
  }, [form.laborCost, form.serviceKind, bundleRows]);

  // When name changes, update SKU if not manually edited
  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "name") {
      updateSkuFromName(value);
    }
  };

  // Regenerate SKU manually
  const regenerateSku = () => {
    setSkuManuallyEdited(false);
    const newSku = generateUniqueSku(form.name, services);
    setForm((prev) => ({ ...prev, sku: newSku }));
  };

  // When services load, update SKU if name is already set and not manually edited
  useEffect(() => {
    if (form.name && !skuManuallyEdited) {
      const newSku = generateUniqueSku(form.name, services);
      setForm((prev) => ({ ...prev, sku: newSku }));
    }
  }, [services]);

  // Bundle row operations
  const updateBundleRow = (index, field, value) => {
    setBundleRows((previous) =>
      previous.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        // If toggling aggregator, unset others
        if (field === "isAggregator" && value === true) {
          const newRows = previous.map((r, i) => ({
            ...r,
            isAggregator: i === index ? true : false,
          }));
          setBundleRows(newRows);
          return newRows[index];
        }
        return { ...row, [field]: value };
      })
    );
  };

  const addBundleRow = () => setBundleRows((p) => [...p, createBundleRow()]);
  const removeBundleRow = (index) =>
    setBundleRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [createBundleRow()];
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canCreate) {
      setError("You don't have permission to create services.");
      return;
    }

    const name = form.name.trim();
    const sku = form.sku.trim();
    const price = toNumberOrZero(form.price);

    if (!name || !sku) {
      setError("Name and SKU are required.");
      return;
    }

    if (price <= 0) {
      setError("Total price must be greater than 0.");
      return;
    }

    // Build payload
    let payload = {
      name,
      sku,
      description: form.description.trim(),
      price,
      type: "service",
      serviceKind: form.serviceKind,
      status: form.status,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      trackInventory: false,
    };

    if (form.serviceKind === "single") {
      const labor = toNumberOrZero(form.laborCost);
      if (labor < 0) {
        setError("Labor cost cannot be negative.");
        return;
      }
      if (labor !== price) {
        setError(`Price (${price}) must equal laborCost (${labor}). (Product cost is no longer used)`);
        return;
      }
      const commissionValue = toNumberOrZero(form.commissionValue);
      if (commissionValue < 0) {
        setError("Commission value cannot be negative.");
        return;
      }
      if (form.commissionType === "percentage" && commissionValue > 100) {
        setError("Percentage commission cannot exceed 100%.");
        return;
      }
      payload.laborCost = labor;
      payload.productCost = 0; // always 0
      payload.commissionType = form.commissionType;
      payload.commissionValue = commissionValue;
      // For single services, we don't send bundleSubServices
    } else {
      // Bundle: build subServices array
      const subServices = bundleRows
        .map((row) => ({
          name: row.name.trim(),
          laborCost: toNumberOrZero(row.laborCost),
          commissionDeductionTiming: row.commissionDeductionTiming,
          commissionType: row.commissionType,
          commissionValue: toNumberOrZero(row.commissionValue),
          isAggregator: row.isAggregator || false,
          defaultAssignedUser: row.defaultAssignedUser || null,
        }))
        .filter((row) => row.name !== "");

      if (subServices.length === 0) {
        setError("Add at least one sub‑service with a name.");
        return;
      }

      // Ensure exactly one aggregator
      const aggregators = subServices.filter((s) => s.isAggregator);
      if (aggregators.length !== 1) {
        setError("You must select exactly one sub‑service as the Aggregator.");
        return;
      }

      // Validate sub‑service fields
      for (const sub of subServices) {
        if (sub.laborCost < 0) {
          setError(`Sub‑service "${sub.name}" has negative cost.`);
          return;
        }
        if (sub.commissionValue < 0) {
          setError(`Sub‑service "${sub.name}" has negative commission value.`);
          return;
        }
        if (sub.commissionType === "percentage" && sub.commissionValue > 100) {
          setError(`Sub‑service "${sub.name}" has commission > 100%.`);
          return;
        }
      }

      const totalFromSubs = subServices.reduce((sum, sub) => sum + sub.laborCost, 0);
      if (totalFromSubs !== price) {
        setError(`Total price (${price}) does not match sum of sub‑services (${totalFromSubs}).`);
        return;
      }

      // For bundles, we don't send laborCost/productCost at the parent level
      payload.bundleSubServices = subServices;
      payload.serviceBundleComponents = [];
      payload.laborCost = 0;
      payload.productCost = 0;
    }

    setSaving(true);
    try {
      const response = await apiFetch("/products", { method: "POST", body: payload });
      const createdId = (response?.product?._id) || (response?.product?.id);
      if (createdId) {
        router.push(`/dashboard/products/services?edit=${createdId}`);
      } else {
        router.push(`/dashboard/products/services`);
      }
    } catch (err) {
      setError(err?.message || "Failed to create service.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Create Service</h1>
          <p className="mt-1 text-sm text-zinc-600">Create a new sellable service. After creation you'll be taken to the editor.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        {error ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-700">Name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleFieldChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700">SKU *</label>
            <div className="relative mt-1">
              <input
                name="sku"
                value={form.sku}
                onChange={(e) => {
                  setSkuManuallyEdited(true);
                  setForm((prev) => ({ ...prev, sku: e.target.value }));
                }}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm pr-8"
                required
              />
              <button
                type="button"
                onClick={regenerateSku}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Regenerate SKU from name"
              >
                🔁
              </button>
            </div>
            <p className="mt-1 text-[10px] text-zinc-500">
              Auto‑generated from the name. Click the 🔁 button to regenerate.
            </p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700">Description</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleFieldChange}
            rows={3}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-700">Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleFieldChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700">Service Type</label>
            <select
              name="serviceKind"
              value={form.serviceKind}
              onChange={(e) => {
                const val = e.target.value;
                setForm((p) => ({ ...p, serviceKind: val }));
                if (val !== "bundle") setBundleRows([createBundleRow()]);
              }}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="single">Single service</option>
              <option value="bundle">Bundle service</option>
            </select>
          </div>
        </div>

        {form.serviceKind === "single" ? (
          <>
            {/* Cost breakdown for single service */}
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900 mb-2">Cost Breakdown</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Labor Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="laborCost"
                    value={form.laborCost}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="0.00"
                    required
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">Commission is calculated on this value.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Total Price</label>
                  <input
                    type="text"
                    value={form.price}
                    disabled
                    className="mt-1 w-full rounded border border-zinc-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 cursor-not-allowed"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">Auto-calculated as Labor Cost.</p>
                </div>
              </div>
            </div>

            {/* Commission section for single service */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900 mb-2">Commission Default</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-zinc-700">Commission Type</label>
                  <select
                    name="commissionType"
                    value={form.commissionType}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount ($)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Commission Value</label>
                  <input
                    type="number"
                    min="0"
                    step={form.commissionType === "percentage" ? "1" : "0.01"}
                    name="commissionValue"
                    value={form.commissionValue}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    placeholder={form.commissionType === "percentage" ? "e.g., 10" : "e.g., 5.00"}
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">
                    {form.commissionType === "percentage" ? "Percentage of labor cost" : "Fixed amount per service"}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          /* Bundle editor with inline sub‑services */
          <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Bundle Sub‑Services</h3>
                <p className="text-xs text-zinc-600">Define the components of this bundle. One sub‑service must be the Aggregator (holds the full bundle price).</p>
                <div className="mt-1">
                  <span className="text-xs font-medium text-zinc-700">Total Price: </span>
                  <span className="text-sm font-bold text-blue-700">${Number(form.price || 0).toFixed(2)}</span>
                </div>
              </div>
              <button type="button" onClick={addBundleRow} className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">
                + Add Sub‑Service
              </button>
            </div>

            <div className="space-y-3">
              {bundleRows.map((row, index) => (
                <div key={index} className="rounded border border-blue-200 bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
                    <div>
                      <label className="text-[11px] font-medium text-zinc-700">Name *</label>
                      <input
                        value={row.name}
                        onChange={(ev) => updateBundleRow(index, "name", ev.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                        placeholder="e.g., Massage"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-700">Labor Cost</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.laborCost}
                        onChange={(ev) => updateBundleRow(index, "laborCost", ev.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-700">Deduction Timing</label>
                      <select
                        value={row.commissionDeductionTiming}
                        onChange={(ev) => updateBundleRow(index, "commissionDeductionTiming", ev.target.value)}
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      >
                        <option value="before_commission">Before Commission</option>
                        <option value="after_deductions">After Deductions</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-700">Commission</label>
                      <div className="flex gap-1">
                        <select
                          value={row.commissionType}
                          onChange={(ev) => updateBundleRow(index, "commissionType", ev.target.value)}
                          className="mt-1 w-16 rounded border border-zinc-300 px-2 py-2 text-sm"
                        >
                          <option value="percentage">%</option>
                          <option value="fixed">$</option>
                        </select>
                        <input
                          type="number"
                          min="0"
                          step={row.commissionType === "percentage" ? "1" : "0.01"}
                          value={row.commissionValue}
                          onChange={(ev) => updateBundleRow(index, "commissionValue", ev.target.value)}
                          className="mt-1 flex-1 rounded border border-zinc-300 px-3 py-2 text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <label className="text-[10px] font-medium text-zinc-700 flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={row.isAggregator}
                          onChange={(ev) => updateBundleRow(index, "isAggregator", ev.target.checked)}
                          className="w-4 h-4"
                        />
                        Aggregator
                      </label>
                    </div>
                    <div className="flex items-end gap-1">
                      <button
                        type="button"
                        onClick={() => removeBundleRow(index)}
                        className="rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-xs font-medium text-zinc-700">Tags</label>
          <input
            name="tags"
            value={form.tags}
            onChange={handleFieldChange}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            placeholder="spa, premium"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving || !canCreate}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Creating..." : "Create Service"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/products/services")}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}