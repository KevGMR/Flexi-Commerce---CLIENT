"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

const createEmptyForm = () => ({
  name: "",
  sku: "",
  description: "",
  price: "",
  status: "active",
  serviceKind: "single",
  tags: "",
});

const createBundleRow = (initial = {}) => ({
  serviceProductId: initial.serviceProductId || "",
  quantity: String(initial.quantity ?? 1),
  nameSnapshot: initial.nameSnapshot || "",
  skuSnapshot: initial.skuSnapshot || "",
  priceSnapshot:
    initial.priceSnapshot === 0 || initial.priceSnapshot
      ? String(initial.priceSnapshot)
      : "",
});

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

  const updateBundleRow = (index, field, value) => {
    setBundleRows((previous) =>
      previous.map((row, rowIndex) => {
        if (rowIndex !== index) return row;

        if (field === "serviceProductId") {
          const selected = services.find((service) => (service._id || service.id) === value);
          if (!selected) {
            return {
              ...row,
              serviceProductId: value,
              nameSnapshot: "",
              skuSnapshot: "",
              priceSnapshot: "",
            };
          }

          return {
            ...row,
            serviceProductId: value,
            nameSnapshot: selected.name || row.nameSnapshot,
            skuSnapshot: selected.sku || row.skuSnapshot,
            priceSnapshot:
              selected.price !== undefined && selected.price !== null
                ? String(selected.price)
                : row.priceSnapshot,
          };
        }

        return { ...row, [field]: value };
      }),
    );
  };

  const addBundleRow = () => setBundleRows((p) => [...p, createBundleRow()]);
  const removeBundleRow = (index) =>
    setBundleRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [createBundleRow()];
    });

  const handleFieldChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!canCreate) {
      setError("You don't have permission to create services.");
      return;
    }

    if (!form.name.trim() || !form.sku.trim() || toNumberOrZero(form.price) <= 0) {
      setError("Name, SKU, and price are required.");
      return;
    }

    let normalizedRows = [];
    if (form.serviceKind === "bundle") {
      normalizedRows = bundleRows
        .map((row) => ({
          serviceProductId: row.serviceProductId,
          quantity: toNumberOrZero(row.quantity),
          nameSnapshot: row.nameSnapshot.trim(),
          skuSnapshot: row.skuSnapshot.trim(),
          priceSnapshot: toNumberOrZero(row.priceSnapshot),
        }))
        .filter((row) => row.serviceProductId || row.nameSnapshot || row.skuSnapshot || row.priceSnapshot > 0);

      if (normalizedRows.length === 0) {
        setError("Add at least one bundle component.");
        return;
      }

      if (normalizedRows.some((row) => !row.serviceProductId || row.quantity <= 0 || row.priceSnapshot < 0)) {
        setError("Each bundle row needs a service, a quantity greater than 0, and a snapshot price.");
        return;
      }

      const serviceIds = normalizedRows.map((r) => r.serviceProductId);
      if (new Set(serviceIds).size !== serviceIds.length) {
        setError("Bundle components must be unique.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        description: form.description.trim(),
        price: toNumberOrZero(form.price),
        type: "service",
        serviceKind: form.serviceKind,
        serviceBundleComponents: normalizedRows,
        status: form.status,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        trackInventory: false,
      };

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
            <input name="name" value={form.name} onChange={handleFieldChange} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700">SKU *</label>
            <input name="sku" value={form.sku} onChange={handleFieldChange} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" required />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700">Description</label>
          <textarea name="description" value={form.description} onChange={handleFieldChange} rows={3} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-zinc-700">Price *</label>
            <input type="number" min="0" step="0.01" name="price" value={form.price} onChange={handleFieldChange} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700">Status</label>
            <select name="status" value={form.status} onChange={handleFieldChange} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm">
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-700">Service Type</label>
            <select name="serviceKind" value={form.serviceKind} onChange={(e) => { setForm((p) => ({ ...p, serviceKind: e.target.value })); if (e.target.value !== 'bundle') setBundleRows([createBundleRow()]); }} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm">
              <option value="single">Single service</option>
              <option value="bundle">Bundle service</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700">Tags</label>
          <input name="tags" value={form.tags} onChange={handleFieldChange} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="spa, premium" />
        </div>

        {form.serviceKind === 'bundle' ? (
          <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">Bundle Editor</h3>
                <p className="text-xs text-zinc-600">Group existing services into one sellable service line.</p>
              </div>
              <button type="button" onClick={addBundleRow} className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700">Add Component</button>
            </div>

            <div className="space-y-3">
              {bundleRows.map((row, index) => (
                <div key={index} className="rounded border border-blue-200 bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[1.1fr_100px_1fr_1fr_120px]">
                    <div>
                      <label className="text-[11px] font-medium text-zinc-700">Service</label>
                      <select value={row.serviceProductId} onChange={(ev) => updateBundleRow(index, 'serviceProductId', ev.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm">
                        <option value="">Select service</option>
                        {services.map((s) => {
                          const sid = s._id || s.id;
                          return <option key={sid} value={sid}>{s.name} ({s.sku})</option>;
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-700">Qty</label>
                      <input type="number" min="1" step="1" value={row.quantity} onChange={(ev) => updateBundleRow(index, 'quantity', ev.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-700">Name snapshot</label>
                      <input value={row.nameSnapshot} onChange={(ev) => updateBundleRow(index, 'nameSnapshot', ev.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="Component name" />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-zinc-700">SKU snapshot</label>
                      <input value={row.skuSnapshot} onChange={(ev) => updateBundleRow(index, 'skuSnapshot', ev.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="Component SKU" />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-[11px] font-medium text-zinc-700">Price snapshot</label>
                        <input type="number" min="0" step="0.01" value={row.priceSnapshot} onChange={(ev) => updateBundleRow(index, 'priceSnapshot', ev.target.value)} className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm" placeholder="0.00" />
                      </div>
                      <button type="button" onClick={() => removeBundleRow(index)} className="rounded border border-red-200 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50">Remove</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          <button type="submit" disabled={saving || !canCreate} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Creating...' : 'Create Service'}</button>
          <button type="button" onClick={() => router.push('/dashboard/products/services')} className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}
