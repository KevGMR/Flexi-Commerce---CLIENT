"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

const createEmptyForm = () => ({
  name: "",
  sku: "",
  description: "",
  status: "active",
  serviceKind: "single",
  tags: "",
  commissionType: "percentage",
  commissionValue: "",
  laborCost: "",
  productCost: "",
  price: "",
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

function ServicesPageContent() {
  const router = useRouter();
  const can = useSessionStore((state) => state.can);

  const canView = can(PERMISSIONS.VIEW_PRODUCT);
  const canCreate = can(PERMISSIONS.CREATE_PRODUCT);
  const canEdit = can(PERMISSIONS.EDIT_PRODUCT);
  const canDelete = can(PERMISSIONS.DELETE_PRODUCT);

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [form, setForm] = useState(createEmptyForm());
  const [bundleRows, setBundleRows] = useState([createBundleRow()]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const loadServices = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch("/products?type=service&limit=200");
      setServices(response?.products || []);
    } catch (err) {
      setServices([]);
      setError(err?.message || "Failed to load services.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadServices();
    }
  }, [canView]);

  const searchParams = useSearchParams();

  useEffect(() => {
    const editId = searchParams?.get("edit");
    if (editId) {
      setSelectedServiceId(editId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (selectedServiceId && services.length > 0) {
      const s = services.find((service) => (service._id || service.id) === selectedServiceId);
      if (s) applyServiceToForm(s);
    }
  }, [selectedServiceId, services]);

  const resetEditor = () => {
    setSelectedServiceId("");
    setForm(createEmptyForm());
    setBundleRows([createBundleRow()]);
    setError("");
    setStatusMessage("");
  };

  const selectedService = useMemo(
    () => services.find((service) => (service._id || service.id) === selectedServiceId),
    [services, selectedServiceId],
  );

  // Auto-calculate price from labor + product
  const recalcPrice = (labor, product) => {
    const total = toNumberOrZero(labor) + toNumberOrZero(product);
    setForm((prev) => ({ ...prev, price: total.toString() }));
  };

  const applyServiceToForm = (service) => {
    const serviceId = service._id || service.id || "";
    setSelectedServiceId(serviceId);
    // Fallback: if laborCost is undefined, use price (old service), productCost = 0
    const labor = service.laborCost ?? service.price ?? 0;
    const product = service.productCost ?? 0;
    const total = labor + product;
    setForm({
      name: service.name || "",
      sku: service.sku || "",
      description: service.description || "",
      status: service.status || "active",
      serviceKind: service.serviceKind || "single",
      tags: Array.isArray(service.tags) ? service.tags.join(", ") : "",
      commissionType: service.commissionType || "percentage",
      commissionValue:
        service.commissionValue !== undefined && service.commissionValue !== null
          ? String(service.commissionValue)
          : "",
      laborCost: String(labor),
      productCost: String(product),
      price: String(total),
    });

    const existingRows = Array.isArray(service.serviceBundleComponents)
      ? service.serviceBundleComponents.map((component) =>
          createBundleRow({
            serviceProductId: component.serviceProductId || "",
            quantity: component.quantity || 1,
            nameSnapshot: component.nameSnapshot || "",
            skuSnapshot: component.skuSnapshot || "",
            priceSnapshot: component.priceSnapshot,
          }),
        )
      : [];

    setBundleRows(existingRows.length > 0 ? existingRows : [createBundleRow()]);
    setError("");
    setStatusMessage("");
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
    if (name === "laborCost" || name === "productCost") {
      const labor = name === "laborCost" ? value : form.laborCost;
      const product = name === "productCost" ? value : form.productCost;
      recalcPrice(labor, product);
    }
  };

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

  const addBundleRow = () => {
    setBundleRows((previous) => [...previous, createBundleRow()]);
  };

  const removeBundleRow = (index) => {
    setBundleRows((previous) => {
      const next = previous.filter((_, rowIndex) => rowIndex !== index);
      return next.length > 0 ? next : [createBundleRow()];
    });
  };

  const filteredServices = services.filter((service) => {
    const search = searchQuery.trim().toLowerCase();
    const name = (service.name || "").toLowerCase();
    const sku = (service.sku || "").toLowerCase();
    const matchesSearch = !search || name.includes(search) || sku.includes(search);
    const matchesStatus = statusFilter === "all" || service.status === statusFilter;
    const matchesKind = kindFilter === "all" || service.serviceKind === kindFilter;
    return matchesSearch && matchesStatus && matchesKind;
  });

  const bundleServiceOptions = services.filter((service) => {
    const serviceId = service._id || service.id;
    if (!serviceId) return false;
    if (serviceId === selectedServiceId) return false;
    return true;
  });

  const bundlePreviewTotal = bundleRows.reduce((sum, row) => {
    return sum + toNumberOrZero(row.quantity) * toNumberOrZero(row.priceSnapshot);
  }, 0);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setStatusMessage("");

    const name = form.name.trim();
    const sku = form.sku.trim();
    const price = toNumberOrZero(form.price);
    const labor = toNumberOrZero(form.laborCost);
    const product = toNumberOrZero(form.productCost);

    if (!name || !sku || price <= 0) {
      setError("Name, SKU, and price are required.");
      return;
    }

    if (labor < 0 || product < 0) {
      setError("Labor cost and product cost cannot be negative.");
      return;
    }
    // No need to check sum, price is derived

    const commissionValue = toNumberOrZero(form.commissionValue);
    if (commissionValue < 0) {
      setError("Commission value cannot be negative.");
      return;
    }
    if (form.commissionType === "percentage" && commissionValue > 100) {
      setError("Percentage commission cannot exceed 100%.");
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

      const serviceIds = normalizedRows.map((row) => row.serviceProductId);
      if (new Set(serviceIds).size !== serviceIds.length) {
        setError("Bundle components must be unique.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        name,
        sku,
        description: form.description.trim(),
        price,
        type: "service",
        serviceKind: form.serviceKind,
        serviceBundleComponents: normalizedRows,
        status: form.status,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        trackInventory: false,
        commissionType: form.commissionType,
        commissionValue: commissionValue,
        laborCost: labor,
        productCost: product,
      };

      let response;
      if (selectedServiceId) {
        response = await apiFetch(`/products/${selectedServiceId}`, {
          method: "PUT",
          body: payload,
        });
        setStatusMessage(`Updated service: ${response?.product?.name || payload.name}`);
      } else {
        response = await apiFetch("/products", {
          method: "POST",
          body: payload,
        });
        setStatusMessage(`Created service: ${response?.product?.name || payload.name}`);
      }

      await loadServices();
      if (response?.product) {
        applyServiceToForm(response.product);
      }
    } catch (err) {
      setError(err?.message || "Failed to save service.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (serviceId) => {
    if (!canDelete) return;

    const target = services.find((service) => (service._id || service.id) === serviceId);
    if (!target) return;

    if (!window.confirm(`Delete service "${target.name}"?`)) {
      return;
    }

    setDeletingId(serviceId);
    setError("");
    setStatusMessage("");
    try {
      await apiFetch(`/products/${serviceId}`, { method: "DELETE" });
      setStatusMessage(`Deleted service: ${target.name}`);
      if (selectedServiceId === serviceId) {
        resetEditor();
      }
      await loadServices();
    } catch (err) {
      setError(err?.message || "Failed to delete service.");
    } finally {
      setDeletingId("");
    }
  };

  if (!canView) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Services</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view services.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Services</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Create sellable services and bundle them into one POS-friendly service line.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard/products")}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Products Home
          </button>
          <button
            type="button"
            onClick={() => router.push("/dashboard/products/services/new")}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New Service
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Total services</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">{services.length}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Bundles</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">
            {services.filter((service) => service.serviceKind === "bundle").length}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Active</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">
            {services.filter((service) => service.status === "active").length}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.35fr]">
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Service Catalog</h2>
              <p className="text-sm text-zinc-600">Search, filter, edit, or delete service records.</p>
            </div>
            <button
              type="button"
              onClick={loadServices}
              className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Refresh
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search services"
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            <select
              value={kindFilter}
              onChange={(event) => setKindFilter(event.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="all">All kinds</option>
              <option value="single">Single service</option>
              <option value="bundle">Bundle service</option>
            </select>
          </div>

          {loading ? (
            <div className="py-8 text-sm text-zinc-500">Loading services...</div>
          ) : filteredServices.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
              No services match the current filters.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredServices.map((service) => {
                const serviceId = service._id || service.id;
                const isSelected = serviceId === selectedServiceId;
                const componentCount = Array.isArray(service.serviceBundleComponents)
                  ? service.serviceBundleComponents.length
                  : 0;

                return (
                  <div
                    key={serviceId}
                    className={`rounded-lg border p-4 transition ${isSelected ? "border-blue-500 bg-blue-50" : "border-zinc-200 bg-white hover:border-zinc-300"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => applyServiceToForm(service)}
                        className="text-left"
                      >
                        <div className="font-semibold text-zinc-900">{service.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          SKU {service.sku || "-"} · {service.status || "draft"} · {service.serviceKind || "single"}
                        </div>
                        <div className="mt-2 text-sm text-zinc-600">
                          ${Number(service.price || 0).toFixed(2)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Labor: ${Number(service.laborCost ?? service.price ?? 0).toFixed(2)} | Product: ${Number(service.productCost || 0).toFixed(2)}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500">
                          Commission: {service.commissionType === "percentage" ? `${service.commissionValue || 0}%` : `$${Number(service.commissionValue || 0).toFixed(2)}`}
                        </div>
                        {service.description ? (
                          <div className="mt-2 text-xs text-zinc-500 line-clamp-2">{service.description}</div>
                        ) : null}
                      </button>

                      <div className="flex flex-col items-end gap-2">
                        {service.serviceKind === "bundle" ? (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                            Bundle · {componentCount}
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-700">
                            Single
                          </span>
                        )}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => applyServiceToForm(service)}
                            className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(serviceId)}
                            disabled={!canDelete || deletingId === serviceId}
                            className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === serviceId ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {Array.isArray(service.tags) && service.tags.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {service.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-zinc-100 px-2 py-1 text-[11px] font-medium text-zinc-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {selectedServiceId ? (
          <form onSubmit={handleSubmit} className="space-y-5 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900">
                  {selectedServiceId ? "Edit Service" : "Create Service"}
                </h2>
                <p className="text-sm text-zinc-600">
                  Bundle services can store a snapshot of each component and still sell as one item.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetEditor}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={saving || (!selectedServiceId && !canCreate) || (selectedServiceId && !canEdit)}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Saving..." : selectedServiceId ? "Update Service" : "Create Service"}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}

            {statusMessage ? (
              <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{statusMessage}</div>
            ) : null}

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
                <input
                  name="sku"
                  value={form.sku}
                  disabled
                  className="mt-1 w-full rounded border border-zinc-300 bg-gray-100 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-[10px] text-zinc-500">SKU is generated at creation and cannot be changed.</p>
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

            {/* Cost breakdown with auto-calculated total price */}
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
              <h3 className="text-sm font-semibold text-zinc-900 mb-2">Cost Breakdown</h3>
              <div className="grid gap-3 md:grid-cols-3">
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
                  <label className="text-xs font-medium text-zinc-700">Product Cost</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="productCost"
                    value={form.productCost}
                    onChange={handleFieldChange}
                    className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    placeholder="0.00"
                    required
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">Materials or product component cost.</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-zinc-700">Total Price</label>
                  <input
                    type="text"
                    value={form.price}
                    disabled
                    className="mt-1 w-full rounded border border-zinc-300 bg-gray-100 px-3 py-2 text-sm text-gray-700 cursor-not-allowed"
                  />
                  <p className="mt-1 text-[10px] text-zinc-500">Auto-calculated as Labor + Product.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-700">Service Type</label>
              <select
                name="serviceKind"
                value={form.serviceKind}
                onChange={(event) => {
                  const nextKind = event.target.value;
                  setForm((previous) => ({ ...previous, serviceKind: nextKind }));
                  if (nextKind !== "bundle") {
                    setBundleRows([createBundleRow()]);
                  }
                }}
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="single">Single service</option>
                <option value="bundle">Bundle service</option>
              </select>
            </div>

            {/* Commission section */}
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

            <div>
              <label className="text-xs font-medium text-zinc-700">Tags</label>
              <input
                name="tags"
                value={form.tags}
                onChange={handleFieldChange}
                className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                placeholder="spa, premium, consultation"
              />
            </div>

            {form.serviceKind === "bundle" ? (
              <div className="space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900">Bundle Editor</h3>
                    <p className="text-xs text-zinc-600">Group existing services into one sellable service line.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addBundleRow}
                    className="rounded bg-blue-600 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Add Component
                  </button>
                </div>

                <div className="space-y-3">
                  {bundleRows.map((row, index) => (
                    <div key={index} className="rounded border border-blue-200 bg-white p-4">
                      <div className="grid gap-3 md:grid-cols-[1.1fr_100px_1fr_1fr_120px]">
                        <div>
                          <label className="text-[11px] font-medium text-zinc-700">Service</label>
                          <select
                            value={row.serviceProductId}
                            onChange={(event) => updateBundleRow(index, "serviceProductId", event.target.value)}
                            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                          >
                            <option value="">Select service</option>
                            {bundleServiceOptions.map((service) => {
                              const serviceId = service._id || service.id;
                              return (
                                <option key={serviceId} value={serviceId}>
                                  {service.name} ({service.sku})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-zinc-700">Qty</label>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={row.quantity}
                            onChange={(event) => updateBundleRow(index, "quantity", event.target.value)}
                            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-zinc-700">Name snapshot</label>
                          <input
                            value={row.nameSnapshot}
                            onChange={(event) => updateBundleRow(index, "nameSnapshot", event.target.value)}
                            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                            placeholder="Component name"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-zinc-700">SKU snapshot</label>
                          <input
                            value={row.skuSnapshot}
                            onChange={(event) => updateBundleRow(index, "skuSnapshot", event.target.value)}
                            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                            placeholder="Component SKU"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <label className="text-[11px] font-medium text-zinc-700">Price snapshot</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.priceSnapshot}
                              onChange={(event) => updateBundleRow(index, "priceSnapshot", event.target.value)}
                              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                              placeholder="0.00"
                            />
                          </div>
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

                <div className="rounded border border-blue-200 bg-white p-3 text-sm text-zinc-700">
                  Bundle snapshot total: ${bundlePreviewTotal.toFixed(2)}
                </div>
              </div>
            ) : (
              <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
                Single services sell as one line item. Switch to bundle mode if this service should contain other services.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={saving || (selectedServiceId && !canEdit)}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Update Service"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard/sales-channels/pos")}
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Open POS
              </button>
            </div>
          </form>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Create Service</h2>
            <p className="mt-1 text-sm text-zinc-600">To create a new service, click the button above to open the dedicated create page.</p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => router.push("/dashboard/products/services/new")}
                className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
              >
                New Service
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ServicesPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Services</h1>
          <p className="text-sm text-zinc-600">Loading services...</p>
        </div>
      }
    >
      <ServicesPageContent />
    </Suspense>
  );
}