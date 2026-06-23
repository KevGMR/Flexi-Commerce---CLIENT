"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { searchShopifyProducts } from "@/lib/indexeddb";
import { useSessionStore } from "@/store/session";
import LineActions from "@/components/sales/LineActions";
import AddToSaleModal from "@/components/sales/AddToSaleModal";

export default function EditReservationPage() {
  const router = useRouter();
  const params = useParams();
  const { permissions, activeOrganization } = useSessionStore();

  const [sale, setSale] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [receivable, setReceivable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadingReceivable, setLoadingReceivable] = useState(false);
  const [receivableError, setReceivableError] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [editableProducts, setEditableProducts] = useState([]);
  const [submittingReservationEdit, setSubmittingReservationEdit] = useState(false);
  const [reservationEditError, setReservationEditError] = useState("");
  const [editStep, setEditStep] = useState("remove");
  const [reservationEditMode, setReservationEditMode] = useState("remove");
  const [selectedEditLineIndex, setSelectedEditLineIndex] = useState(0);
  const [reservationSearchQuery, setReservationSearchQuery] = useState("");
  const [reservationSourceTab, setReservationSourceTab] = useState("flexi");
  const [searchResults, setSearchResults] = useState([]);
  const [shopifyResults, setShopifyResults] = useState([]);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [selectedShopifyVariant, setSelectedShopifyVariant] = useState(null);
  const [pendingRemovedLine, setPendingRemovedLine] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [reservationEditForm, setReservationEditForm] = useState({
    productType: "flexi",
    productId: "",
    quantity: "1",
    unitPrice: "",
    discount: "0",
    recipientName: "",
    recipientPhone: "",
    recipientEmail: "",
    deliveryCategory: "",
    deliveryOption: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Kenya",
    landmark: "",
    notes: "",
  });

  const canViewSalesHistory = permissions?.includes(PERMISSIONS.VIEW_SALE_HISTORY);
  const canEditSale = permissions?.includes(PERMISSIONS.EDIT_SALE);

  const saleItems = Array.isArray(sale?.items) ? sale.items : [];
  const selectedEditLine = saleItems[selectedEditLineIndex] || saleItems[0] || null;
  const selectedEditLineBaseTotal = Number(selectedEditLine?.lineTotal || 0);

  const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);

  const getLineLabel = (item) => {
    if (!item) return "Unknown line";
    const typeLabel = item.type === "shopify" ? "Shopify" : item.type === "service" ? "Service" : "FLEXI";
    return `${item.productName || "Unnamed item"} · ${typeLabel}`;
  };

  const reservationSourceProducts = useMemo(() => {
    return reservationSourceTab === "service"
      ? editableProducts.filter((product) => product.type === "service")
      : editableProducts.filter((product) => product.type !== "service");
  }, [editableProducts, reservationSourceTab]);

  const calculateReplacementPreview = (baseItem, draft) => {
    const quantity = Number(draft?.quantity || baseItem?.quantity || 1);
    const unitPrice = Number(draft?.unitPrice || baseItem?.unitPrice || 0);
    const discount = Number(draft?.discount || baseItem?.discount || 0);
    const lineTotal = Math.max(0, quantity * unitPrice - discount);
    return {
      quantity,
      unitPrice,
      discount,
      lineTotal,
      delta: roundCurrency(lineTotal - Number(baseItem?.lineTotal || 0)),
    };
  };

  const selectedReplacementPreview = (() => {
    if (!selectedEditLine) return null;

    if (reservationEditMode === "remove") {
      return { lineTotal: 0, delta: roundCurrency(-selectedEditLineBaseTotal) };
    }

    if (reservationEditMode === "decrement") {
      const decrementBy = Math.min(Number(reservationEditForm.quantity || 0), Number(selectedEditLine.quantity || 0));
      const remainingQty = Math.max(0, Number(selectedEditLine.quantity || 0) - (Number.isFinite(decrementBy) ? decrementBy : 0));
      const lineTotal = roundCurrency(remainingQty * Number(selectedEditLine.unitPrice || 0));
      return { lineTotal, delta: roundCurrency(lineTotal - selectedEditLineBaseTotal) };
    }

    if (reservationEditForm.productType === "shopify" && selectedShopifyVariant) {
      const previewQty = Number(reservationEditForm.quantity || 1);
      const previewUnit = Number(selectedShopifyVariant.variant?.price ?? reservationEditForm.unitPrice ?? 0);
      const lineTotal = roundCurrency(Math.max(0, previewQty * previewUnit - Number(reservationEditForm.discount || 0)));
      return { lineTotal, delta: roundCurrency(lineTotal - selectedEditLineBaseTotal) };
    }

    const preview = calculateReplacementPreview(selectedEditLine, reservationEditForm);
    return { lineTotal: preview.lineTotal, delta: preview.delta };
  })();

  const selectedBeforeLabel = selectedEditLine ? getLineLabel(selectedEditLine) : "No line selected";
  const selectedAfterLabel =
    editStep === "remove"
      ? "Line removed"
      : reservationEditForm.productType === "shopify"
        ? `${reservationEditForm.productType === "service" ? "Service" : "Shopify"} add`
        : "Awaiting selection";

  const fetchSaleById = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/sales/${params.id}`);
      const saleData = response?.data || response;

      if (saleData) {
        setSale(saleData);
        setError("");
      } else {
        setError("Failed to load sale details");
      }
    } catch (err) {
      console.error("Failed to fetch sale:", err);
      setError("Failed to load sale details");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  const fetchReceivable = useCallback(async () => {
    if (!params.id) return;

    try {
      setLoadingReceivable(true);
      const response = await apiFetch(`/sales/${params.id}/receivable`);
      const receivableData = response?.data || response;
      setReceivable(receivableData || null);
      setReceivableError("");
    } catch (err) {
      console.error("Failed to fetch receivable:", err);
      setReceivable(null);
      setReceivableError("Failed to load receivable details");
    } finally {
      setLoadingReceivable(false);
    }
  }, [params.id]);

  const fetchEditableProducts = useCallback(async () => {
    try {
      setProductsLoading(true);
      const response = await apiFetch("/products?status=active&limit=200");
      const products = response?.data?.products || response?.products || [];
      setEditableProducts(Array.isArray(products) ? products : []);
    } catch (err) {
      console.error("Failed to fetch editable products:", err);
      setEditableProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canViewSalesHistory || !canEditSale) {
      setLoading(false);
      return;
    }

    fetchSaleById();
  }, [fetchSaleById, canEditSale, canViewSalesHistory]);

  useEffect(() => {
    if (!sale?.deliveryFeeId) return;

    const fetchDelivery = async () => {
      try {
        const response = await apiFetch(`/delivery-fees/${sale.deliveryFeeId}`);
        const deliveryData = response?.data || response;
        if (deliveryData) {
          setDelivery(deliveryData);
        }
      } catch (err) {
        console.error("Failed to fetch delivery:", err);
      }
    };

    fetchDelivery();
  }, [sale?.deliveryFeeId]);

  useEffect(() => {
    if (!sale?._id) return;
    fetchReceivable();
  }, [sale?._id, fetchReceivable]);

  useEffect(() => {
    if (!sale?._id) return;

    const firstItem = sale?.items?.[0] || {};
    const deliveryAddress =
      typeof delivery?.deliveryAddress === "object"
        ? delivery.deliveryAddress
        : {
            street: delivery?.deliveryAddress || "",
            city: "",
            state: "",
            postalCode: "",
            country: "Kenya",
            landmark: "",
          };

    const initialTab = firstItem.type === "service" ? "service" : firstItem.type === "shopify" ? "shopify" : "flexi";

    setSelectedEditLineIndex(0);
    setEditStep("remove");
    setReservationEditMode("remove");
    setReservationSourceTab(initialTab);
    setReservationSearchQuery("");
    setSearchResults([]);
    setShopifyResults([]);
    setSelectedShopifyVariant(null);
    setPendingRemovedLine(null);

    setReservationEditForm({
      productType: initialTab,
      productId: firstItem.productId || "",
      quantity: String(firstItem.quantity || 1),
      unitPrice: String(firstItem.unitPrice || ""),
      discount: String(firstItem.discount || 0),
      recipientName: delivery?.recipientName || "",
      recipientPhone: delivery?.recipientPhone || "",
      recipientEmail: delivery?.recipientEmail || "",
      deliveryCategory: delivery?.deliveryCategory || sale?.deliveryCategory || "",
      deliveryOption: delivery?.deliveryOption || sale?.deliveryOption || "",
      street: deliveryAddress?.street || "",
      city: deliveryAddress?.city || "",
      state: deliveryAddress?.state || "",
      postalCode: deliveryAddress?.postalCode || "",
      country: deliveryAddress?.country || "Kenya",
      landmark: deliveryAddress?.landmark || "",
      notes: sale?.notes || "",
    });

    if (!editableProducts.length) {
      fetchEditableProducts();
    }
  }, [
    sale?._id,
    sale?.deliveryCategory,
    sale?.deliveryOption,
    sale?.items,
    sale?.notes,
    delivery?._id,
    delivery?.deliveryAddress,
    delivery?.deliveryCategory,
    delivery?.deliveryOption,
    delivery?.recipientEmail,
    delivery?.recipientName,
    delivery?.recipientPhone,
    editableProducts.length,
    fetchEditableProducts,
  ]);

  useEffect(() => {
    if (!selectedEditLine) return;

    const nextTab = selectedEditLine.type === "service" ? "service" : selectedEditLine.type === "shopify" ? "shopify" : "flexi";
    setReservationSourceTab(nextTab);
    setReservationEditForm((prev) => ({
      ...prev,
      productType: nextTab,
      productId: nextTab === "shopify" ? "" : selectedEditLine.productId || "",
      quantity: String(selectedEditLine.quantity || 1),
      unitPrice: String(selectedEditLine.unitPrice || ""),
      discount: String(selectedEditLine.discount || 0),
    }));
  }, [selectedEditLineIndex, selectedEditLine]);

  // Auto-open modal when a line has been removed and the user should add replacement
  useEffect(() => {
    if (pendingRemovedLine && editStep === "add") {
      setShowAddModal(true);
    }
  }, [pendingRemovedLine, editStep]);

  useEffect(() => {
    if (reservationSourceTab === "shopify") {
      let cancelled = false;
      const timeoutId = setTimeout(async () => {
        setShopifyLoading(true);
        try {
          const results = await searchShopifyProducts(reservationSearchQuery || "", 50);
          if (!cancelled) {
            setShopifyResults(Array.isArray(results) ? results : []);
          }
        } catch (err) {
          if (!cancelled) {
            console.error("Failed to search Shopify products:", err);
            setShopifyResults([]);
          }
        } finally {
          if (!cancelled) {
            setShopifyLoading(false);
          }
        }
      }, 180);

      return () => {
        cancelled = true;
        clearTimeout(timeoutId);
      };
    }

    const lowerQuery = reservationSearchQuery.trim().toLowerCase();
    const filtered = !lowerQuery
      ? reservationSourceProducts.slice(0, 50)
      : reservationSourceProducts.filter((product) => {
          const haystack = [product.name, product.sku, product.productType, product.type].filter(Boolean).join(" ").toLowerCase();
          return haystack.includes(lowerQuery);
        });

    setSearchResults(filtered.slice(0, 50));
  }, [reservationSearchQuery, reservationSourceTab, reservationSourceProducts]);

  const handleReservationEditFieldChange = (field, value) => {
    setReservationEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleReservationEditProductChange = (productId) => {
    const selected = editableProducts.find((product) => String(product._id) === String(productId));

    setReservationEditForm((prev) => ({
      ...prev,
      productId,
      unitPrice: selected && Number.isFinite(Number(selected.price)) ? String(selected.price) : prev.unitPrice,
      productType: selected?.type === "service" ? "service" : "flexi",
    }));
  };

  const handleRemoveLine = async (index) => {
    if (index == null || !sale) return;
    setReservationEditError("");
    try {
      setSubmittingReservationEdit(true);
      await apiFetch(`/sales/${sale._id}/reservation`, {
        method: "PATCH",
        body: { edits: [{ action: "remove", itemIndex: index }] },
      });
      const removed = saleItems[index];
      setPendingRemovedLine({ index, item: removed });
      setEditStep("add");
      setReservationEditMode("add");
      setReservationEditError("Line removed. Add the replacement line next.");
    } catch (err) {
      console.error("Failed to remove line:", err);
      setReservationEditError(err.message || "Failed to remove line");
    } finally {
      setSubmittingReservationEdit(false);
    }
  };

  const handleSelectShopifyProduct = (product, variant = null) => {
    setSelectedShopifyVariant({ product, variant });
    setReservationEditForm((prev) => ({
      ...prev,
      productType: "shopify",
      productId: "",
      unitPrice: variant?.price !== undefined ? String(variant.price) : prev.unitPrice,
    }));
  };

  const selectedEditLineCurrentTotal = Number(selectedEditLine?.lineTotal || 0);

  const handleSubmitReservationEdit = async (event) => {
    event.preventDefault();
    setReservationEditError("");

    const quantity = Number(reservationEditForm.quantity || 0);
    const unitPrice = Number(reservationEditForm.unitPrice || 0);
    const discount = Number(reservationEditForm.discount || 0);

    if (!selectedEditLine) {
      setReservationEditError("Select a line to edit");
      return;
    }

    if (editStep === "remove") {
      try {
        setSubmittingReservationEdit(true);
        await apiFetch(`/sales/${sale._id}/reservation`, {
          method: "PATCH",
          body: { edits: [{ action: "remove", itemIndex: selectedEditLineIndex }] },
        });
        setPendingRemovedLine({ index: selectedEditLineIndex, item: selectedEditLine });
        setEditStep("add");
        setReservationEditMode("add");
        setReservationEditError("Line removed. Add the replacement line next.");
      } catch (err) {
        console.error("Failed to remove line:", err);
        setReservationEditError(err.message || "Failed to remove line");
      } finally {
        setSubmittingReservationEdit(false);
      }
      return;
    }

    if (editStep === "add") {
      if (reservationEditForm.productType !== "shopify" && !reservationEditForm.productId) {
        setReservationEditError("Select a product to add");
        return;
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        setReservationEditError("Quantity must be greater than zero");
        return;
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        setReservationEditError("Unit price must be zero or greater");
        return;
      }

      if (!Number.isFinite(discount) || discount < 0) {
        setReservationEditError("Discount must be zero or greater");
        return;
      }

    try {
      setSubmittingReservationEdit(true);

      let replacementItemPayload = null;
      if (reservationEditForm.productType === "shopify") {
        if (!selectedShopifyVariant || !selectedShopifyVariant.product) {
          setReservationEditError("Select a Shopify product/variant");
          return;
        }

        const variant = selectedShopifyVariant.variant;
        const product = selectedShopifyVariant.product;
        const variantId = variant ? variant.id : null;
        const productName = product?.title + (variant ? ` - ${variant.title}` : "");

        replacementItemPayload = {
          type: "shopify",
          shopifyVariantId: variantId || undefined,
          productName,
          sku: variant?.sku || "",
          quantity,
          unitPrice,
          discount,
        };
      } else {
        replacementItemPayload = {
          type: reservationEditForm.productType,
          productId: reservationEditForm.productId,
          quantity,
          unitPrice,
          discount,
        };
      }

      const payload = {
        edits: [
          {
            action: "add",
            itemIndex: pendingRemovedLine?.index ?? selectedEditLineIndex,
            replacementItem: replacementItemPayload,
          },
        ],
        notes: reservationEditForm.notes,
      };

      if (sale?.deliveryFeeId) {
        payload.recipientName = reservationEditForm.recipientName;
        payload.recipientPhone = reservationEditForm.recipientPhone;
        payload.recipientEmail = reservationEditForm.recipientEmail;
        payload.deliveryCategory = reservationEditForm.deliveryCategory;
        payload.deliveryOption = reservationEditForm.deliveryOption;
        payload.deliveryAddress = {
          street: reservationEditForm.street,
          city: reservationEditForm.city,
          state: reservationEditForm.state,
          postalCode: reservationEditForm.postalCode,
          country: reservationEditForm.country,
          landmark: reservationEditForm.landmark,
        };
      }

      await apiFetch(`/sales/${sale._id}/reservation`, {
        method: "PATCH",
        body: payload,
      });

      router.push(`/dashboard/sales/${sale._id}`);
    } catch (err) {
      console.error("Failed to add line:", err);
      setReservationEditError(err.message || "Failed to add line");
    } finally {
      setSubmittingReservationEdit(false);
    }
      return;
    }
  };

  if (!canViewSalesHistory || !canEditSale) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Reservation editor</h1>
        <p className="text-sm text-zinc-600">You don&apos;t have permission to edit this reservation.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Go Back
        </button>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-zinc-600">Loading reservation editor...</p>
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Go Back
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-sm text-red-700">{error || "Sale not found"}</p>
        </div>
      </div>
    );
  }

  if (sale.status !== "completed") {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.push(`/dashboard/sales/${sale._id}`)}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Back to sale
        </button>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <p className="text-sm text-amber-800">Reservation edits are only available for completed sales.</p>
        </div>
      </div>
    );
  }

  const estimatedEditedTotal = selectedReplacementPreview
    ? formatCurrency(roundCurrency(Number(sale.totalAmount || 0) - selectedEditLineBaseTotal + selectedReplacementPreview.lineTotal))
    : formatCurrency(sale.totalAmount || 0);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Edit order</p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">Reservation editor</h1>
          <p className="mt-1 text-sm text-zinc-600">Remove one line first, then add the replacement as a second step while keeping payment history intact.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/dashboard/sales/${sale._id}`)}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Back to sale
          </button>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            + Add product
          </button>
        </div>
      </div>

      {(reservationEditError || receivableError) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {reservationEditError || receivableError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
        <form onSubmit={handleSubmitReservationEdit} className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-zinc-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Sale total</p>
              <p className="mt-2 text-lg font-semibold text-zinc-900">{formatCurrency(sale.totalAmount || 0)}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                  {editStep === "remove" ? "After removal" : "After add"}
                </p>
              <p className="mt-2 text-lg font-semibold text-zinc-900">{estimatedEditedTotal}</p>
            </div>
            <div className="rounded-2xl bg-zinc-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Balance due</p>
              <p className="mt-2 text-lg font-semibold text-amber-700">
                {loadingReceivable ? "Loading..." : formatCurrency(receivable?.balanceDue || 0)}
              </p>
            </div>
          </div>

          <section className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Current sale lines</p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-900">Select a line to edit</h2>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                {saleItems.length} line{saleItems.length === 1 ? "" : "s"}
              </div>
            </div>

            <div className="space-y-3">
              {saleItems.map((item, index) => {
                const isSelected = index === selectedEditLineIndex;
                return (
                  <div
                    key={`${item.productName || item.sku || item.type}-${index}`}
                    className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                      isSelected
                        ? "border-violet-300 bg-white shadow-sm ring-1 ring-violet-200"
                        : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                    }`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedEditLineIndex(index);
                        const nextTab = item.type === "service" ? "service" : item.type === "shopify" ? "shopify" : "flexi";
                        setEditStep("remove");
                        setReservationEditMode("remove");
                        setReservationSourceTab(nextTab);
                        setReservationSearchQuery("");
                        setShopifyResults([]);
                        setSearchResults([]);
                        setSelectedShopifyVariant(null);
                        setPendingRemovedLine(null);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-700">
                        {index + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-zinc-900">{item.productName || item.sku || "Unnamed line"}</p>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                            {item.type}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-3 text-sm text-zinc-500">
                          <span>Qty {item.quantity || 0}</span>
                          <span>{formatCurrency(item.unitPrice || 0)} each</span>
                          <span>{formatCurrency(item.lineTotal || 0)}</span>
                        </div>
                      </div>
                    </div>
                    <LineActions index={index} onRemove={handleRemoveLine} disabled={submittingReservationEdit} />
                  </div>
                );
              })}
              {saleItems.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-sm text-zinc-500">
                  No editable lines were found on this sale.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Selected line</p>
                <h2 className="mt-1 text-lg font-semibold text-zinc-900">{getLineLabel(selectedEditLine)}</h2>
              </div>
              <div className="flex rounded-full bg-zinc-100 p-1 text-sm font-medium text-zinc-600">
                {[
                  { key: "remove", label: "Remove" },
                  { key: "add", label: "Add" },
                ].map((mode) => (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => {
                      setEditStep(mode.key);
                      setReservationEditMode(mode.key);
                    }}
                    className={`rounded-full px-3 py-1.5 transition ${
                      editStep === mode.key
                        ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                        : "hover:text-zinc-900"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3 md:gap-4">
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Current line</p>
                <p className="mt-2 text-lg font-semibold text-zinc-900">{formatCurrency(selectedEditLineCurrentTotal)}</p>
              </div>
              <div className="rounded-2xl bg-violet-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Preview change</p>
                <p
                  className={`mt-2 text-lg font-semibold ${
                    selectedReplacementPreview?.delta < 0
                      ? "text-emerald-700"
                      : selectedReplacementPreview?.delta > 0
                        ? "text-rose-700"
                        : "text-zinc-900"
                  }`}
                >
                  {selectedReplacementPreview ? `${selectedReplacementPreview.delta > 0 ? "+" : ""}${formatCurrency(Math.abs(selectedReplacementPreview.delta || 0))}` : "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-zinc-50 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Estimated line total</p>
                <p className="mt-2 text-lg font-semibold text-zinc-900">{selectedReplacementPreview ? formatCurrency(selectedReplacementPreview.lineTotal) : "—"}</p>
              </div>
            </div>

            {editStep === "add" && (
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">Use the Add products modal (click + Add product).</div>
            )}

            {editStep === "remove" && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                Removing this line will delete it from the reservation while keeping already recorded payments intact.
              </div>
            )}

            {editStep === "add" && pendingRemovedLine && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                The original line was removed. Add the replacement as the second step.
              </div>
            )}

            {sale?.deliveryFeeId && (
              <section className="space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Delivery details</p>
                  <p className="mt-1 text-sm text-zinc-600">Edit the delivery recipient or address if this reservation still requires delivery.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Recipient Name</label>
                    <input
                      type="text"
                      value={reservationEditForm.recipientName}
                      onChange={(event) => handleReservationEditFieldChange("recipientName", event.target.value)}
                      disabled={submittingReservationEdit}
                      className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Recipient Phone</label>
                    <input
                      type="text"
                      value={reservationEditForm.recipientPhone}
                      onChange={(event) => handleReservationEditFieldChange("recipientPhone", event.target.value)}
                      disabled={submittingReservationEdit}
                      className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Delivery Category</label>
                    <input
                      type="text"
                      value={reservationEditForm.deliveryCategory}
                      onChange={(event) => handleReservationEditFieldChange("deliveryCategory", event.target.value)}
                      disabled={submittingReservationEdit}
                      className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Delivery Option</label>
                    <input
                      type="text"
                      value={reservationEditForm.deliveryOption}
                      onChange={(event) => handleReservationEditFieldChange("deliveryOption", event.target.value)}
                      disabled={submittingReservationEdit}
                      className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                    />
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Street"
                    value={reservationEditForm.street}
                    onChange={(event) => handleReservationEditFieldChange("street", event.target.value)}
                    disabled={submittingReservationEdit}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="City"
                    value={reservationEditForm.city}
                    onChange={(event) => handleReservationEditFieldChange("city", event.target.value)}
                    disabled={submittingReservationEdit}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="State"
                    value={reservationEditForm.state}
                    onChange={(event) => handleReservationEditFieldChange("state", event.target.value)}
                    disabled={submittingReservationEdit}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Postal Code"
                    value={reservationEditForm.postalCode}
                    onChange={(event) => handleReservationEditFieldChange("postalCode", event.target.value)}
                    disabled={submittingReservationEdit}
                    className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                  />
                </div>
              </section>
            )}

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
              <label className="block text-sm font-medium text-zinc-700">Internal Note</label>
              <textarea
                rows={4}
                value={reservationEditForm.notes}
                onChange={(event) => handleReservationEditFieldChange("notes", event.target.value)}
                disabled={submittingReservationEdit}
                className="mt-2 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push(`/dashboard/sales/${sale._id}`)}
                disabled={submittingReservationEdit}
                className="flex-1 rounded-2xl border border-zinc-300 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingReservationEdit || saleItems.length === 0}
                className="flex-1 rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {submittingReservationEdit ? "Saving..." : editStep === "remove" ? "Remove line" : "Add line"}
              </button>
            </div>
          </section>
        </form>

        <aside className="space-y-6 rounded-3xl border border-zinc-200 bg-zinc-50/80 p-5 shadow-sm sm:p-6">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Summary</p>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Current total</span>
                <span className="font-semibold text-zinc-900">{formatCurrency(sale.totalAmount || 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Estimated edited total</span>
                <span className="font-semibold text-zinc-900">{estimatedEditedTotal}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Paid</span>
                <span className="font-semibold text-emerald-700">{formatCurrency(receivable?.totalPaid || 0)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-600">Balance due</span>
                <span className="font-semibold text-amber-700">{formatCurrency(receivable?.balanceDue || 0)}</span>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">
              <p className="font-medium text-zinc-900">Selected action</p>
              <p className="mt-1 capitalize">{editStep}</p>
              <p className="mt-3 text-xs leading-5 text-zinc-500">
                The final server-side recalculation keeps payments intact and updates totals, receivable, and delivery data in place.
              </p>
            </div>
          </div>

          {saleItems.length > 0 && (
            <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Visual diff preview</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
                <div className="rounded-2xl bg-zinc-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Before</p>
                  <p className="mt-2 font-semibold text-zinc-900">{selectedBeforeLabel}</p>
                  <div className="mt-3 space-y-1 text-sm text-zinc-600">
                    <p>Qty: {selectedEditLine?.quantity || 0}</p>
                    <p>Unit: {formatCurrency(selectedEditLine?.unitPrice || 0)}</p>
                    <p>Total: {formatCurrency(selectedEditLine?.lineTotal || 0)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-center text-zinc-400">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-lg font-semibold">→</div>
                </div>
                <div className="rounded-2xl bg-violet-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">After</p>
                  <p className="mt-2 font-semibold text-zinc-900">{selectedAfterLabel}</p>
                  <div className="mt-3 space-y-1 text-sm text-zinc-600">
                    <p>Mode: {reservationEditMode}</p>
                    <p>Line total: {selectedReplacementPreview ? formatCurrency(selectedReplacementPreview.lineTotal) : "—"}</p>
                    <p
                      className={`font-semibold ${
                        selectedReplacementPreview?.delta < 0
                          ? "text-emerald-700"
                          : selectedReplacementPreview?.delta > 0
                            ? "text-rose-700"
                            : "text-zinc-900"
                      }`}
                    >
                      Change: {selectedReplacementPreview ? `${selectedReplacementPreview.delta > 0 ? "+" : ""}${formatCurrency(Math.abs(selectedReplacementPreview.delta || 0))}` : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm text-sm text-zinc-600">
            <p className="font-medium text-zinc-900">Organization</p>
            <p className="mt-1">{activeOrganization?.name || "Unknown organization"}</p>
            <p className="mt-3 text-xs leading-5 text-zinc-500">Reservation updates preserve payment history and can also update delivery details when this sale has a delivery fee.</p>
          </div>
        </aside>
      </div>
      
      <AddToSaleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        saleId={sale?._id}
        currentItems={sale?.items}
        pendingRemovedLine={pendingRemovedLine}
        onAddSuccess={async () => {
          await fetchSaleById();
          setPendingRemovedLine(null);
          setEditStep("remove");
          setReservationEditMode("remove");
        }}
      />
    </div>
  );
}