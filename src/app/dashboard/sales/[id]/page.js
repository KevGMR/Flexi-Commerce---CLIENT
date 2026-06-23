"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { searchShopifyProducts } from "@/lib/indexeddb";
import { useSessionStore } from "@/store/session";
import { printReceiptInBrowser } from "@/lib/receipt/browserPrint";
import { mapSaleToReceipt } from "@/lib/receipt/receiptMappers";

export default function SaleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { permissions, locationsMeta, user, activeOrganization } = useSessionStore();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState(null);
  const [showCreateDeliveryModal, setShowCreateDeliveryModal] = useState(false);
  const [creatingDelivery, setCreatingDelivery] = useState(false);
  const [deliveryFormError, setDeliveryFormError] = useState("");
  const [receivable, setReceivable] = useState(null);
  const [loadingReceivable, setLoadingReceivable] = useState(false);
  const [receivableError, setReceivableError] = useState("");
  const [showCollectPaymentModal, setShowCollectPaymentModal] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentFormError, setPaymentFormError] = useState("");
  const [showReallocatePaymentModal, setShowReallocatePaymentModal] = useState(false);
  const [submittingReallocation, setSubmittingReallocation] = useState(false);
  const [reallocationFormError, setReallocationFormError] = useState("");
  const [showEditReservationModal, setShowEditReservationModal] = useState(false);
  const [submittingReservationEdit, setSubmittingReservationEdit] = useState(false);
  const [reservationEditError, setReservationEditError] = useState("");
  const [productsLoading, setProductsLoading] = useState(false);
  const [editableProducts, setEditableProducts] = useState([]);
  const [reservationEditMode, setReservationEditMode] = useState("replace");
  const [selectedEditLineIndex, setSelectedEditLineIndex] = useState(0);
  const [reservationSearchQuery, setReservationSearchQuery] = useState("");
  const [reservationSourceTab, setReservationSourceTab] = useState("flexi");
  const [searchResults, setSearchResults] = useState([]);
  const [shopifyResults, setShopifyResults] = useState([]);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [selectedShopifyVariant, setSelectedShopifyVariant] = useState(null);
  const [copyReceiptStatus, setCopyReceiptStatus] = useState("");
  const [reallocationForm, setReallocationForm] = useState({
    fromAllocations: [{ paymentIndex: "", amount: "" }],
    toAllocations: [{ method: "mpesa", amount: "", reference: "", cardLast4: "", cardBrand: "" }],
    reason: "",
    notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    method: "cash",
    amount: "",
    reference: "",
    cardLast4: "",
    cardBrand: "",
    notes: "",
  });
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
  const canCreateDeliveryFees = permissions?.includes(PERMISSIONS.DELIVERY_FEES_CREATE);
  const canCollectPayment = permissions?.includes(PERMISSIONS.CREATE_SALE);
  const canEditSale = permissions?.includes(PERMISSIONS.EDIT_SALE);

  const roundCurrency = (value) => Math.round(Number(value || 0) * 100) / 100;

  const saleItems = Array.isArray(sale?.items) ? sale.items : [];
  const selectedEditLine = saleItems[selectedEditLineIndex] || saleItems[0] || null;
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

  const getLineLabel = (item) => {
    if (!item) return "Unknown line";
    const typeLabel = item.type === "shopify" ? "Shopify" : item.type === "service" ? "Service" : "FLEXI";
    return `${item.productName || "Unnamed item"} · ${typeLabel}`;
  };

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

  const fetchEditableProducts = async () => {
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
  };

  useEffect(() => {
    if (!canViewSalesHistory) {
      setLoading(false);
      return;
    }

    fetchSaleById();
  }, [params.id, canViewSalesHistory, fetchSaleById]);

  // Fetch delivery if sale has deliveryFeeId
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

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const formatDateOnly = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 border-green-300";
      case "voided":
        return "bg-red-100 text-red-800 border-red-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "partial_refund":
        return "bg-orange-100 text-orange-800 border-orange-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getSyncStatusColor = (status) => {
    switch (status) {
      case "synced":
        return "bg-green-100 text-green-800 border-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "failed":
        return "bg-red-100 text-red-800 border-red-300";
      case "partial":
        return "bg-orange-100 text-orange-800 border-orange-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getDeliveryStatusColor = (status) => {
    switch (status) {
      case "delivered":
      case "completed":
        return "bg-green-100 text-green-800 border-green-300";
      case "in_transit":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "pending":
      case "assigned":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "cancelled":
      case "failed":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getLocationName = (locationId) => {
    if (!locationsMeta || !locationId) return "Unknown Location";
    const location = locationsMeta.find((loc) => loc._id === locationId);
    return location?.name || "Unknown Location";
  };

  const buildTimeline = () => {
    const events = [];

    // Sale created
    if (sale?.createdAt) {
      events.push({
        type: "created",
        date: sale.createdAt,
        label: "Sale created",
      });
    }

    // Voided
    if (sale?.status === "voided" && sale?.voidedAt) {
      events.push({
        type: "voided",
        date: sale.voidedAt,
        label: "Sale voided",
        reason: sale.voidReason,
      });
    }

    // Refunds
    if (sale?.refundHistory && sale.refundHistory.length > 0) {
      sale.refundHistory.forEach((refund) => {
        events.push({
          type: "refund",
          date: refund.refundedAt,
          label: `Refund: ${formatCurrency(refund.amount)}`,
          reason: refund.reason,
        });
      });
    }

    // Sort by date descending
    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const handlePrintOrder = () => {
    const receipt = mapSaleToReceipt({ sale, receivable });
    if (!receipt) {
      alert("Unable to generate receipt for this order");
      return;
    }

    printReceiptInBrowser({
      receipt,
      organizationName: activeOrganization?.name,
      locationLabel: getLocationName(sale?.locationId),
    });
  };

  const handleCopyReceiptNumber = async () => {
    if (!sale?.receiptNumber) return;

    try {
      await navigator.clipboard.writeText(sale.receiptNumber);
      setCopyReceiptStatus("Copied!");
      setTimeout(() => setCopyReceiptStatus(""), 2000);
    } catch (err) {
      console.error("Failed to copy receipt number:", err);
      setCopyReceiptStatus("Copy failed");
      setTimeout(() => setCopyReceiptStatus(""), 2000);
    }
  };

  const handleCreateDelivery = async (e) => {
    e.preventDefault();
    setDeliveryFormError("");

    // Validate sale has recipient info
    if (!sale?.recipientName || !sale?.recipientPhone) {
      setDeliveryFormError("Sale must have recipient name and phone number");
      return;
    }

    try {
      setCreatingDelivery(true);

      const payload = {
        locationId: sale.locationId,
        saleId: sale._id,
        recipientName: sale.recipientName,
        recipientPhone: sale.recipientPhone,
        recipientEmail: sale.recipientEmail || "",
        deliveryAddress: sale.deliveryAddress,
        deliveryCategory: sale.deliveryCategory || "",
        deliveryOption: sale.deliveryOption || "",
        amount: sale.deliveryFeeAmount || 0,
        isTaxable: sale.deliveryFeeIsTaxable || false,
      };

      const response = await apiFetch("/delivery-fees", {
        method: "POST",
        body: payload,
      });

      const deliveryData = response?.data || response;
      if (deliveryData) {
        setDelivery(deliveryData);
        setShowCreateDeliveryModal(false);
      }
    } catch (err) {
      console.error("Failed to create delivery:", err);
      setDeliveryFormError(err.message || "Failed to create delivery");
    } finally {
      setCreatingDelivery(false);
    }
  };

  const handleOpenCollectPayment = () => {
    const suggestedAmount = Number(receivable?.balanceDue || 0);
    setPaymentForm({
      method: "cash",
      amount: suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "",
      reference: "",
      cardLast4: "",
      cardBrand: "",
      notes: "",
    });
    setPaymentFormError("");
    setShowCollectPaymentModal(true);
  };

  const handlePaymentFieldChange = (field, value) => {
    setPaymentForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitCollectPayment = async (e) => {
    e.preventDefault();
    setPaymentFormError("");

    const amountValue = Number(paymentForm.amount || 0);
    const currentBalanceDue = Number(receivable?.balanceDue || 0);

    if (!paymentForm.method) {
      setPaymentFormError("Payment method is required");
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setPaymentFormError("Payment amount must be greater than zero");
      return;
    }

    if (currentBalanceDue > 0 && amountValue - currentBalanceDue > 0.01) {
      setPaymentFormError("Payment amount cannot exceed current balance due");
      return;
    }

    try {
      setSubmittingPayment(true);

      await apiFetch(`/sales/${sale._id}/payments`, {
        method: "POST",
        body: {
          method: paymentForm.method,
          amount: amountValue,
          reference: paymentForm.reference || undefined,
          status: "completed",
          cardLast4: paymentForm.cardLast4 || undefined,
          cardBrand: paymentForm.cardBrand || undefined,
          notes: paymentForm.notes || undefined,
        },
      });

      setShowCollectPaymentModal(false);
      await Promise.all([fetchSaleById(), fetchReceivable()]);
    } catch (err) {
      console.error("Failed to collect payment:", err);
      setPaymentFormError(err.message || "Failed to collect payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const getCorrectablePayments = () => {
    if (!sale?.payments?.length) return [];

    const remainingByIndex = new Map();

    sale.payments.forEach((payment, index) => {
      if ((payment?.status || "completed") === "completed" && Number(payment?.amount || 0) > 0) {
        remainingByIndex.set(index, Number(payment.amount) || 0);
      }
    });

    (sale.paymentCorrections || []).forEach((correction) => {
      (correction?.fromAllocations || []).forEach((allocation) => {
        const idx = Number(allocation?.paymentIndex);
        const amount = Number(allocation?.amount || 0);
        if (!Number.isInteger(idx) || idx < 0 || amount <= 0) return;
        const current = Number(remainingByIndex.get(idx) || 0);
        remainingByIndex.set(idx, Math.max(0, current - amount));
      });
    });

    return Array.from(remainingByIndex.entries())
      .map(([index, remainingAmount]) => ({
        index,
        method: sale.payments[index]?.method,
        remainingAmount,
      }))
      .filter((entry) => entry.remainingAmount > 0.01);
  };

  const handleOpenReallocation = () => {
    const correctablePayments = getCorrectablePayments();
    if (correctablePayments.length === 0) {
      setReallocationFormError("No completed payment allocation is available for reallocation");
      return;
    }

    const firstSource = correctablePayments[0];
    setReallocationForm({
      fromAllocations: [
        {
          paymentIndex: String(firstSource.index),
          amount: firstSource.remainingAmount.toFixed(2),
        },
      ],
      toAllocations: [
        {
          method: "mpesa",
          amount: firstSource.remainingAmount.toFixed(2),
          reference: "",
          cardLast4: "",
          cardBrand: "",
        },
      ],
      reason: "Incorrect payment method selected at checkout",
      notes: "",
    });
    setReallocationFormError("");
    setShowReallocatePaymentModal(true);
  };

  const updateReallocationField = (section, index, field, value) => {
    setReallocationForm((prev) => {
      const nextItems = [...prev[section]];
      nextItems[index] = {
        ...nextItems[index],
        [field]: value,
      };

      return {
        ...prev,
        [section]: nextItems,
      };
    });
  };

  const addReallocationRow = (section) => {
    setReallocationForm((prev) => ({
      ...prev,
      [section]: [
        ...prev[section],
        section === "fromAllocations"
          ? { paymentIndex: "", amount: "" }
          : { method: "mpesa", amount: "", reference: "", cardLast4: "", cardBrand: "" },
      ],
    }));
  };

  const removeReallocationRow = (section, index) => {
    setReallocationForm((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const handleSubmitReallocation = async (e) => {
    e.preventDefault();
    setReallocationFormError("");

    const correctablePayments = getCorrectablePayments();
    const remainingByIndex = new Map(
      correctablePayments.map((entry) => [entry.index, Number(entry.remainingAmount || 0)]),
    );

    const fromAllocations = reallocationForm.fromAllocations
      .map((allocation) => ({
        paymentIndex: Number(allocation.paymentIndex),
        amount: Number(allocation.amount || 0),
      }))
      .filter((allocation) => Number.isFinite(allocation.amount) && allocation.amount > 0);

    const toAllocations = reallocationForm.toAllocations
      .map((allocation) => ({
        method: allocation.method,
        amount: Number(allocation.amount || 0),
        reference: allocation.reference || undefined,
        cardLast4: allocation.cardLast4 || undefined,
        cardBrand: allocation.cardBrand || undefined,
      }))
      .filter((allocation) => Number.isFinite(allocation.amount) && allocation.amount > 0);

    if (!reallocationForm.reason?.trim()) {
      setReallocationFormError("Reason is required");
      return;
    }

    if (fromAllocations.length === 0) {
      setReallocationFormError("At least one source allocation is required");
      return;
    }

    if (toAllocations.length === 0) {
      setReallocationFormError("At least one target allocation is required");
      return;
    }

    const requestedFromByIndex = fromAllocations.reduce((acc, allocation) => {
      const current = Number(acc.get(allocation.paymentIndex) || 0);
      acc.set(allocation.paymentIndex, current + allocation.amount);
      return acc;
    }, new Map());

    for (const [paymentIndex, amount] of requestedFromByIndex.entries()) {
      if (!remainingByIndex.has(paymentIndex)) {
        setReallocationFormError(`Payment index ${paymentIndex} is not available for correction`);
        return;
      }

      const available = Number(remainingByIndex.get(paymentIndex) || 0);
      if (amount - available > 0.01) {
        setReallocationFormError(
          `Source allocation for payment index ${paymentIndex} exceeds available amount`,
        );
        return;
      }
    }

    const fromTotal = fromAllocations.reduce((sum, item) => sum + item.amount, 0);
    const toTotal = toAllocations.reduce((sum, item) => sum + item.amount, 0);

    if (Math.abs(fromTotal - toTotal) > 0.01) {
      setReallocationFormError("Total source amount must match total target amount");
      return;
    }

    try {
      setSubmittingReallocation(true);

      await apiFetch(`/sales/${sale._id}/payments/reallocate`, {
        method: "PATCH",
        body: {
          fromAllocations,
          toAllocations,
          reason: reallocationForm.reason.trim(),
          notes: reallocationForm.notes?.trim() || undefined,
        },
      });

      setShowReallocatePaymentModal(false);
      await Promise.all([fetchSaleById(), fetchReceivable()]);
    } catch (err) {
      console.error("Failed to reallocate payment:", err);
      setReallocationFormError(err.message || "Failed to reallocate payment");
    } finally {
      setSubmittingReallocation(false);
    }
  };

  const handleOpenReservationEdit = async () => {
    router.push(`/dashboard/sales/${sale._id}/edit`);
  };

  useEffect(() => {
    if (!showEditReservationModal) return;

    if (selectedEditLine) {
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
    }
  }, [selectedEditLineIndex, selectedEditLine, showEditReservationModal]);

  useEffect(() => {
    if (!showEditReservationModal) return;

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
  }, [reservationSearchQuery, reservationSourceTab, reservationSourceProducts, showEditReservationModal]);

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
      unitPrice:
        selected && Number.isFinite(Number(selected.price))
          ? String(selected.price)
          : prev.unitPrice,
      productType: selected?.type === "service" ? "service" : "flexi",
    }));
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

    if (reservationEditMode === "remove") {
      try {
        setSubmittingReservationEdit(true);
        await apiFetch(`/sales/${sale._id}/reservation`, {
          method: "PATCH",
          body: { edits: [{ action: "remove", itemIndex: selectedEditLineIndex }] },
        });
        setShowEditReservationModal(false);
        await Promise.all([fetchSaleById(), fetchReceivable()]);
      } catch (err) {
        console.error("Failed to remove line:", err);
        setReservationEditError(err.message || "Failed to remove line");
      } finally {
        setSubmittingReservationEdit(false);
      }
      return;
    }

    if (reservationEditMode === "decrement") {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        setReservationEditError("Decrease amount must be greater than zero");
        return;
      }

      try {
        setSubmittingReservationEdit(true);
        await apiFetch(`/sales/${sale._id}/reservation`, {
          method: "PATCH",
          body: { edits: [{ action: "decrement", itemIndex: selectedEditLineIndex, decrementBy: quantity }] },
        });
        setShowEditReservationModal(false);
        await Promise.all([fetchSaleById(), fetchReceivable()]);
      } catch (err) {
        console.error("Failed to decrement line:", err);
        setReservationEditError(err.message || "Failed to decrement line");
      } finally {
        setSubmittingReservationEdit(false);
      }
      return;
    }

    if (reservationEditForm.productType !== "shopify" && !reservationEditForm.productId) {
      setReservationEditError("Select a replacement product");
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

      // Build replacementItem based on selected type
      let replacementItemPayload = null;
      if (reservationEditForm.productType === "shopify") {
        if (!selectedShopifyVariant || !selectedShopifyVariant.product) {
          setReservationEditError("Select a Shopify product/variant");
          setSubmittingReservationEdit(false);
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
            action: "replace",
            itemIndex: selectedEditLineIndex,
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

      setShowEditReservationModal(false);
      await Promise.all([fetchSaleById(), fetchReceivable()]);

      if (sale?.deliveryFeeId) {
        try {
          const deliveryResponse = await apiFetch(`/delivery-fees/${sale.deliveryFeeId}`);
          const deliveryData = deliveryResponse?.data || deliveryResponse;
          setDelivery(deliveryData || null);
        } catch (deliveryErr) {
          console.error("Failed to refresh delivery after reservation edit:", deliveryErr);
        }
      }
    } catch (err) {
      console.error("Failed to edit reservation:", err);
      setReservationEditError(err.message || "Failed to update reservation");
    } finally {
      setSubmittingReservationEdit(false);
    }
  };

  if (!canViewSalesHistory) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Sale Details</h1>
        <p className="text-sm text-zinc-600">You don&apos;t have permission to view sale details.</p>
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
          <p className="text-sm text-zinc-600">Loading sale details...</p>
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

  const timeline = buildTimeline();
  const displayedPayments =
    sale?.effectivePayments?.length > 0 ? sale.effectivePayments : sale?.payments || [];
  const correctablePayments = getCorrectablePayments();
  const selectedEditLineBaseTotal = Number(selectedEditLine?.lineTotal || 0);
  const selectedEditLineCurrentTotal = Number(selectedEditLine?.lineTotal || 0);
  const selectedBeforeLabel = selectedEditLine?.productName || "Selected line";
  const selectedAfterLabel =
    reservationEditMode === "remove"
      ? "Removed"
      : reservationEditMode === "decrement"
        ? `${Math.max(0, Number(selectedEditLine?.quantity || 0) - Number(reservationEditForm.quantity || 0))} remaining`
        : reservationEditForm.productType === "shopify" && selectedShopifyVariant
          ? `${selectedShopifyVariant.product?.title || "Shopify item"}${selectedShopifyVariant.variant?.title ? ` · ${selectedShopifyVariant.variant.title}` : ""}`
          : reservationEditForm.productId
            ? `${reservationEditForm.productType === "service" ? "Service" : "FLEXI"} replacement`
            : "Awaiting selection";
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

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => router.back()}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Go Back
        </button>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {canEditSale && sale.status === "completed" && (
            <button
              onClick={handleOpenReservationEdit}
              className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Edit Reservation
            </button>
          )}
          <button
            onClick={handlePrintOrder}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            🖨️ Print
          </button>
          {sale.status === "completed" && (
            <>
              <button className="rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">
                💰 Refund
              </button>
              <button className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
                ✕ Void
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column (Main Content) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Header Section */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-500">RECEIPT NUMBER</p>
                <div className="mt-1 flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-zinc-900">{sale.receiptNumber || "N/A"}</h1>
                  <button
                    type="button"
                    onClick={handleCopyReceiptNumber}
                    disabled={!sale?.receiptNumber}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copy
                  </button>
                  {copyReceiptStatus && (
                    <span className={`text-xs font-medium ${copyReceiptStatus === "Copied!" ? "text-green-600" : "text-red-600"}`}>
                      {copyReceiptStatus}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm text-zinc-600">{formatDate(sale.createdAt)}</p>
              </div>
              <div className="flex flex-col gap-2">
                <span className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${getStatusColor(sale.status)}`}>
                  {sale.status}
                </span>
                {sale.shopifySyncStatus && (
                  <span className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${getSyncStatusColor(sale.shopifySyncStatus)}`}>
                    Shopify: {sale.shopifySyncStatus}
                  </span>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-medium text-zinc-500">TRANSACTION ID</p>
                <p className="mt-1 text-sm font-mono text-zinc-900">{sale.transactionId}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">INVENTORY STATUS</p>
                <p className="mt-1 capitalize text-sm text-zinc-900">{sale.inventoryStatus}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">PAYMENT STATUS</p>
                <p className="mt-1 capitalize text-sm text-zinc-900">{sale.paymentStatus}</p>
                {Number(receivable?.balanceDue || 0) > 0.01 && (
                  <p className="text-xs font-medium text-orange-700 mt-1">
                    Balance Due: {formatCurrency(receivable?.balanceDue)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Items ({sale.items?.length || 0})</h2>
            <div className="divide-y divide-zinc-200">
              {sale.items?.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900">{item.productName}</p>
                    {item.sku && <p className="text-xs text-zinc-500">SKU: {item.sku}</p>}
                    <p className="mt-1 text-sm text-zinc-600">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                      {item.type === "shopify" && " (Shopify)"}
                      {item.type === "flexi" && " (FLEXI)"}
                    </p>
                    {item.discount > 0 && <p className="text-xs text-green-600">Discount: {formatCurrency(item.discount)}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-zinc-900">{formatCurrency(item.lineTotal)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Section */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Pricing</h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">Subtotal</span>
                <span className="font-medium text-zinc-900">{formatCurrency(sale.subtotal)}</span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Discount</span>
                  <span className="font-medium text-green-600">-{formatCurrency(sale.discountAmount)}</span>
                </div>
              )}
              {sale.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Tax</span>
                  <span className="font-medium text-zinc-900">{formatCurrency(sale.taxAmount)}</span>
                </div>
              )}
              {sale.deliveryFeeAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Delivery Fee</span>
                  <span className="font-medium text-zinc-900">{formatCurrency(sale.deliveryFeeAmount)}</span>
                </div>
              )}
              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-zinc-900">Total</span>
                  <span className="text-lg font-bold text-zinc-900">{formatCurrency(sale.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery Section */}
          {sale.requiresDelivery && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900">Delivery</h2>
                {!delivery && canCreateDeliveryFees && (
                  <button
                    onClick={() => setShowCreateDeliveryModal(true)}
                    className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Create Delivery
                  </button>
                )}
              </div>

              {delivery ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {delivery.deliveryCategory || delivery.deliveryOption || "Standard Delivery"}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {delivery.trackingNumber && `Tracking: ${delivery.trackingNumber}`}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${getDeliveryStatusColor(delivery.categoryStatus)}`}>
                      {delivery.categoryStatus}
                    </span>
                  </div>

                  <div className="border-t border-zinc-200 pt-4 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-zinc-500">RECIPIENT</p>
                      <p className="mt-1 text-sm text-zinc-900">{delivery.recipientName || "N/A"}</p>
                      {delivery.recipientPhone && <p className="text-sm text-zinc-600">{delivery.recipientPhone}</p>}
                      {delivery.recipientEmail && <p className="text-sm text-zinc-600">{delivery.recipientEmail}</p>}
                    </div>

                    <div>
                      <p className="text-xs font-medium text-zinc-500">DELIVERY ADDRESS</p>
                      <p className="mt-1 text-sm text-zinc-900">
                        {typeof delivery.deliveryAddress === "object"
                          ? `${delivery.deliveryAddress.street || ""}, ${delivery.deliveryAddress.city || ""}, ${delivery.deliveryAddress.state || ""}`
                          : delivery.deliveryAddress}
                      </p>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => router.push(`/dashboard/deliveries/${delivery._id}`)}
                        className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <p className="mb-4 text-sm text-zinc-600">No delivery created yet</p>
                  {canCreateDeliveryFees && (
                    <button
                      onClick={() => setShowCreateDeliveryModal(true)}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      + Create Delivery
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Timeline Section */}
          {timeline.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">Timeline</h2>
              <div className="space-y-4">
                {timeline.map((event, idx) => (
                  <div key={idx} className="border-l-2 border-zinc-300 pl-4 pb-4 last:pb-0">
                    <p className="text-xs font-medium text-zinc-500">{formatDate(event.date)}</p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">{event.label}</p>
                    {event.reason && <p className="mt-1 text-sm text-zinc-600">{event.reason}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Sidebar) */}
        <div className="space-y-6">
          {/* Customer Section */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Customer</h2>
            {sale.customerName || sale.customerEmail || sale.customerPhone ? (
              <div className="space-y-3">
                {sale.customerName && <p className="font-medium text-zinc-900">{sale.customerName}</p>}
                {sale.customerEmail && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">EMAIL</p>
                    <p className="mt-1 text-sm text-blue-600">{sale.customerEmail}</p>
                  </div>
                )}
                {sale.customerPhone && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">PHONE</p>
                    <p className="mt-1 text-sm text-zinc-900">{sale.customerPhone}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No customer information</p>
            )}
          </div>

          {/* Payment Section */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Payment</h2>

            {loadingReceivable && (
              <p className="text-xs text-zinc-500 mb-3">Loading receivable details...</p>
            )}

            {receivableError && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 p-2">
                <p className="text-xs text-red-700">{receivableError}</p>
              </div>
            )}

            {receivable && (
              <div className="mb-4 rounded border border-zinc-200 bg-zinc-50 p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-600">Total Due</span>
                  <span className="font-medium text-zinc-900">{formatCurrency(receivable.totalDue)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-600">Amount Paid</span>
                  <span className="font-medium text-green-700">{formatCurrency(receivable.totalPaid)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-600">Balance Due</span>
                  <span className={`font-semibold ${Number(receivable.balanceDue || 0) > 0.01 ? "text-orange-700" : "text-green-700"}`}>
                    {formatCurrency(receivable.balanceDue)}
                  </span>
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <span className="inline-block rounded px-2 py-1 text-xs font-medium capitalize bg-zinc-100 text-zinc-700">
                    {receivable.status || "open"}
                  </span>
                  <div className="flex items-center gap-2">
                    {canEditSale && correctablePayments.length > 0 && (
                      <button
                        onClick={handleOpenReallocation}
                        disabled={loadingReceivable || submittingReallocation}
                        className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Reallocate
                      </button>
                    )}
                    {canCollectPayment && Number(receivable.balanceDue || 0) > 0.01 && (
                      <button
                        onClick={handleOpenCollectPayment}
                        disabled={loadingReceivable || submittingPayment}
                        className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        Collect Payment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {displayedPayments?.length > 0 ? (
                displayedPayments.map((payment, idx) => (
                  <div key={idx} className="border-b border-zinc-200 pb-3 last:border-b-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium capitalize text-zinc-900">{payment.method}</p>
                      <p className="font-semibold text-zinc-900">{formatCurrency(payment.amount)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-block rounded px-2 py-1 text-xs font-medium capitalize ${
                        payment.status === "completed"
                          ? "bg-green-100 text-green-800"
                          : payment.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}>
                        {payment.status}
                      </span>
                      {payment.cardBrand && <span className="text-xs text-zinc-500">{payment.cardBrand}</span>}
                      {payment.cardLast4 && <span className="text-xs text-zinc-500">•••• {payment.cardLast4}</span>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-600">{sale.paymentMethod || "No payment info"}</p>
              )}
            </div>

            {sale.paymentCorrections?.length > 0 && (
              <div className="mt-4 rounded border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Corrections</p>
                <div className="mt-2 space-y-2">
                  {sale.paymentCorrections.map((correction, idx) => (
                    <div key={correction.correctionId || idx} className="text-xs text-indigo-900">
                      <p className="font-medium">{formatDate(correction.correctedAt)}</p>
                      <p>{correction.reason || "Payment allocation corrected"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Location & Staff Section */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Location & Staff</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-medium text-zinc-500">LOCATION</p>
                <p className="mt-1 text-sm text-zinc-900">{getLocationName(sale.locationId)}</p>
              </div>
              {sale.cashierId && (
                <div>
                  <p className="text-xs font-medium text-zinc-500">CASHIER</p>
                  <p className="mt-1 text-sm text-zinc-900">{sale.cashierId?.fullname || sale.cashierId}</p>
                </div>
              )}
              {sale.supervisorId && (
                <div>
                  <p className="text-xs font-medium text-zinc-500">SUPERVISOR</p>
                  <p className="mt-1 text-sm text-zinc-900">{sale.supervisorId?.fullname || sale.supervisorId}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tags Section */}
          {sale.tags && sale.tags.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">Tags</h2>
              <div className="flex flex-wrap gap-2">
                {sale.tags.map((tag, idx) => (
                  <span key={idx} className="inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata Section */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Metadata</h2>
            <div className="space-y-3">
              {sale.idempotencyKey && (
                <div>
                  <p className="text-xs font-medium text-zinc-500">IDEMPOTENCY KEY</p>
                  <p className="mt-1 text-xs font-mono text-zinc-900">{sale.idempotencyKey}</p>
                </div>
              )}
              {sale.completedAt && (
                <div>
                  <p className="text-xs font-medium text-zinc-500">COMPLETED AT</p>
                  <p className="mt-1 text-sm text-zinc-900">{formatDate(sale.completedAt)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Void/Refund Section */}
          {(sale.status === "voided" || sale.status === "partial_refund") && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-red-900">Adjustment</h2>
              <div className="space-y-3">
                {sale.status === "voided" && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-red-700">VOIDED AT</p>
                      <p className="mt-1 text-sm text-red-900">{sale.voidedAt ? formatDate(sale.voidedAt) : "N/A"}</p>
                    </div>
                    {sale.voidReason && (
                      <div>
                        <p className="text-xs font-medium text-red-700">REASON</p>
                        <p className="mt-1 text-sm text-red-900">{sale.voidReason}</p>
                      </div>
                    )}
                  </>
                )}
                {sale.status === "partial_refund" && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-red-700">REFUND AMOUNT</p>
                      <p className="mt-1 text-sm font-semibold text-red-900">{formatCurrency(sale.refundAmount || 0)}</p>
                    </div>
                    {sale.refundReason && (
                      <div>
                        <p className="text-xs font-medium text-red-700">REASON</p>
                        <p className="mt-1 text-sm text-red-900">{sale.refundReason}</p>
                      </div>
                    )}
                    {sale.refundedAt && (
                      <div>
                        <p className="text-xs font-medium text-red-700">REFUNDED AT</p>
                        <p className="mt-1 text-sm text-red-900">{formatDate(sale.refundedAt)}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Notes Section */}
          {sale.notes && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">Notes</h2>
              <p className="text-sm text-zinc-600">{sale.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Reservation Modal */}
      {showEditReservationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 px-3 py-4 backdrop-blur-sm sm:px-4 sm:py-6">
          <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-zinc-200">
            <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Edit order</p>
                <h2 className="mt-1 text-xl font-bold text-zinc-900 sm:text-2xl">Reservation editor</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  Update one selected line at a time while keeping payment history intact.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditReservationModal(false)}
                className="rounded-full p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                aria-label="Close editor"
              >
                ✕
              </button>
            </div>

            {reservationEditError && (
              <div className="mx-4 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:mx-6">
                {reservationEditError}
              </div>
            )}

            <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[1.45fr_0.85fr]">
              <form onSubmit={handleSubmitReservationEdit} className="flex min-h-0 flex-col overflow-hidden border-zinc-200 lg:border-r">
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Current sale lines</p>
                        <h3 className="mt-1 text-lg font-semibold text-zinc-900">Select a line to edit</h3>
                      </div>
                      <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                        {saleItems.length} line{saleItems.length === 1 ? "" : "s"}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {saleItems.map((item, index) => {
                        const isSelected = index === selectedEditLineIndex;
                        return (
                          <button
                            key={`${item.productName || item.sku || item.type}-${index}`}
                            type="button"
                            onClick={() => {
                              setSelectedEditLineIndex(index);
                              const nextTab = item.type === "service" ? "service" : item.type === "shopify" ? "shopify" : "flexi";
                              setReservationSourceTab(nextTab);
                              setReservationEditMode("replace");
                              setReservationSearchQuery("");
                              setShopifyResults([]);
                              setSearchResults([]);
                              setSelectedShopifyVariant(null);
                            }}
                            className={`flex w-full items-center gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                              isSelected
                                ? "border-violet-300 bg-white shadow-sm ring-1 ring-violet-200"
                                : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                            }`}
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-sm font-semibold text-zinc-700">
                              {index + 1}
                            </div>
                            <div className="min-w-0 flex-1">
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
                          </button>
                        );
                      })}
                      {saleItems.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-6 text-sm text-zinc-500">
                          No editable lines were found on this sale.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Selected line</p>
                        <h3 className="mt-1 text-lg font-semibold text-zinc-900">{getLineLabel(selectedEditLine)}</h3>
                      </div>
                      <div className="flex rounded-full bg-zinc-100 p-1 text-sm font-medium text-zinc-600">
                        {[
                          { key: "replace", label: "Replace" },
                          { key: "decrement", label: "Decrease" },
                          { key: "remove", label: "Remove" },
                        ].map((mode) => (
                          <button
                            key={mode.key}
                            type="button"
                            onClick={() => setReservationEditMode(mode.key)}
                            className={`rounded-full px-3 py-1.5 transition ${
                              reservationEditMode === mode.key
                                ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200"
                                : "hover:text-zinc-900"
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3 md:gap-4">
                      <div className="rounded-2xl bg-zinc-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Current line</p>
                        <p className="mt-2 text-lg font-semibold text-zinc-900">{formatCurrency(selectedEditLineCurrentTotal)}</p>
                      </div>
                      <div className="rounded-2xl bg-violet-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Preview change</p>
                        <p className={`mt-2 text-lg font-semibold ${selectedReplacementPreview?.delta < 0 ? "text-emerald-700" : selectedReplacementPreview?.delta > 0 ? "text-rose-700" : "text-zinc-900"}`}>
                          {selectedReplacementPreview ? `${selectedReplacementPreview.delta > 0 ? "+" : ""}${formatCurrency(Math.abs(selectedReplacementPreview.delta || 0))}` : "—"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-zinc-50 p-4">
                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Estimated line total</p>
                        <p className="mt-2 text-lg font-semibold text-zinc-900">
                          {selectedReplacementPreview ? formatCurrency(selectedReplacementPreview.lineTotal) : "—"}
                        </p>
                      </div>
                    </div>

                    {reservationEditMode === "replace" && (
                      <div className="mt-5 space-y-5">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Replacement source</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {[
                              { key: "flexi", label: "FLEXI" },
                              { key: "service", label: "Services" },
                              { key: "shopify", label: "Shopify" },
                            ].map((tab) => (
                              <button
                                key={tab.key}
                                type="button"
                                onClick={() => {
                                  setReservationSourceTab(tab.key);
                                  setReservationSearchQuery("");
                                  setSelectedShopifyVariant(null);
                                }}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                  reservationSourceTab === tab.key
                                    ? "bg-zinc-900 text-white"
                                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:p-5">
                          <label className="block text-sm font-medium text-zinc-700">Search {reservationSourceTab === "shopify" ? "Shopify" : reservationSourceTab}</label>
                          <input
                            type="search"
                            value={reservationSearchQuery}
                            onChange={(e) => setReservationSearchQuery(e.target.value)}
                            placeholder={reservationSourceTab === "shopify" ? "Search Shopify products or SKU" : `Search ${reservationSourceTab} products`}
                            className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none ring-0 focus:border-zinc-400"
                            disabled={submittingReservationEdit}
                          />

                          <div className="mt-4 max-h-72 space-y-3 overflow-auto pr-1">
                            {reservationSourceTab === "shopify" ? (
                              shopifyLoading ? (
                                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                                  Loading Shopify products...
                                </div>
                              ) : shopifyResults.length > 0 ? (
                                shopifyResults.map((product) => (
                                  <div key={product.id} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="font-semibold text-zinc-900">{product.title}</p>
                                        <p className="text-sm text-zinc-500">{product.vendor || "Shopify"}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleSelectShopifyProduct(product, null)}
                                        className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
                                      >
                                        Select
                                      </button>
                                    </div>

                                    {Array.isArray(product.variants) && product.variants.length > 1 && (
                                      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
                                        <select
                                          className="w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm"
                                          onChange={(e) => {
                                            const variant = product.variants.find((entry) => String(entry.id) === String(e.target.value));
                                            if (variant) {
                                              setReservationEditForm((prev) => ({
                                                ...prev,
                                                unitPrice: String(variant.price ?? (prev.unitPrice || 0)),
                                              }));
                                              setSelectedShopifyVariant({ product, variant });
                                            }
                                          }}
                                          value={selectedShopifyVariant?.product?.id === product.id ? selectedShopifyVariant?.variant?.id || "" : ""}
                                        >
                                          <option value="">Choose variant</option>
                                          {product.variants.map((variant) => (
                                            <option key={variant.id} value={variant.id}>
                                              {variant.title} {variant.sku ? `• ${variant.sku}` : ""} • {formatCurrency(variant.price)}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() => handleSelectShopifyProduct(product, selectedShopifyVariant?.product?.id === product.id ? selectedShopifyVariant.variant : product.variants[0])}
                                          className="rounded-xl border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                                        >
                                          Use selected variant
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                                  No Shopify products match this search.
                                </div>
                              )
                            ) : searchResults.length > 0 ? (
                              searchResults.map((product) => (
                                <button
                                  key={product._id}
                                  type="button"
                                  onClick={() => {
                                    setReservationEditForm((prev) => ({
                                      ...prev,
                                      productId: product._id,
                                      productType: reservationSourceTab,
                                      unitPrice: Number.isFinite(Number(product.price)) ? String(product.price) : prev.unitPrice,
                                    }));
                                  }}
                                  className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-violet-300 hover:bg-violet-50"
                                >
                                  <div>
                                    <p className="font-medium text-zinc-900">{product.name}</p>
                                    <p className="text-sm text-zinc-500">{product.sku || "No SKU"}</p>
                                  </div>
                                  <div className="text-right text-sm text-zinc-600">
                                    <p>{formatCurrency(product.price || 0)}</p>
                                    <p className="text-xs uppercase tracking-wide text-zinc-400">{product.type}</p>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-4 py-8 text-center text-sm text-zinc-500">
                                No products available for this section.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <div>
                            <label className="block text-sm font-medium text-zinc-700">
                              {reservationEditMode === "decrement" ? "Decrease by" : "Quantity"}
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={reservationEditForm.quantity}
                              onChange={(event) => handleReservationEditFieldChange("quantity", event.target.value)}
                              disabled={submittingReservationEdit}
                              className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700">Unit Price</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={reservationEditForm.unitPrice}
                              onChange={(event) => handleReservationEditFieldChange("unitPrice", event.target.value)}
                              disabled={submittingReservationEdit || reservationSourceTab === "shopify"}
                              className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm disabled:bg-zinc-100"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-zinc-700">Discount</label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={reservationEditForm.discount}
                              onChange={(event) => handleReservationEditFieldChange("discount", event.target.value)}
                              disabled={submittingReservationEdit || reservationEditMode !== "replace"}
                              className="mt-1 w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm disabled:bg-zinc-100"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {reservationEditMode === "decrement" && (
                      <div className="mt-5 space-y-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <p>
                          Reduce the selected line by the amount below. The line will be removed automatically if it reaches zero.
                        </p>
                        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
                          <label className="block text-sm font-medium text-zinc-700">Quantity reducer</label>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleReservationEditFieldChange(
                                  "quantity",
                                  String(Math.max(1, Number(reservationEditForm.quantity || 1) - 1)),
                                )
                              }
                              disabled={submittingReservationEdit || Number(reservationEditForm.quantity || 1) <= 1}
                              className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-zinc-50 text-lg font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Reduce quantity"
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={reservationEditForm.quantity}
                              onChange={(event) => handleReservationEditFieldChange("quantity", event.target.value)}
                              disabled={submittingReservationEdit}
                              className="w-full rounded-2xl border border-zinc-300 px-4 py-3 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                handleReservationEditFieldChange(
                                  "quantity",
                                  String(Number(reservationEditForm.quantity || 1) + 1),
                                )
                              }
                              disabled={submittingReservationEdit}
                              className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-300 bg-zinc-50 text-lg font-semibold text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                              aria-label="Increase quantity"
                            >
                              +
                            </button>
                          </div>
                          <p className="mt-2 text-xs text-amber-800">This amount will be subtracted from the selected line.</p>
                        </div>
                      </div>
                    )}

                    {reservationEditMode === "remove" && (
                      <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                        Removing this line will delete it from the reservation while keeping already recorded payments intact.
                      </div>
                    )}

                    {sale?.deliveryFeeId && (
                      <div className="mt-6 space-y-4 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5">
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
                      </div>
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
                  </div>

                </div>

                <div className="border-t border-zinc-200 bg-white px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setShowEditReservationModal(false)}
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
                      {submittingReservationEdit
                        ? "Saving..."
                        : reservationEditMode === "remove"
                          ? "Remove line"
                          : reservationEditMode === "decrement"
                            ? "Apply decrement"
                            : "Save changes"}
                    </button>
                  </div>
                </div>
              </form>

              <aside className="flex min-h-0 flex-col bg-zinc-50/80 px-4 py-4 sm:px-6 sm:py-5">
                <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Summary</p>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600">Current total</span>
                      <span className="font-semibold text-zinc-900">{formatCurrency(sale.totalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-600">Estimated edited total</span>
                      <span className="font-semibold text-zinc-900">
                        {selectedReplacementPreview
                          ? formatCurrency(roundCurrency(Number(sale.totalAmount || 0) - selectedEditLineBaseTotal + selectedReplacementPreview.lineTotal))
                          : formatCurrency(sale.totalAmount)}
                      </span>
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
                    <p className="mt-1 capitalize">{reservationEditMode}</p>
                    <p className="mt-3 text-xs leading-5 text-zinc-500">
                      The final server-side recalculation keeps payments intact and updates totals, receivable, and delivery data in place.
                    </p>
                  </div>

                  {saleItems.length > 0 && (
                    <div className="mt-5 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
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
                            <p className={`font-semibold ${selectedReplacementPreview?.delta < 0 ? "text-emerald-700" : selectedReplacementPreview?.delta > 0 ? "text-rose-700" : "text-zinc-900"}`}>
                              Change: {selectedReplacementPreview ? `${selectedReplacementPreview.delta > 0 ? "+" : ""}${formatCurrency(Math.abs(selectedReplacementPreview.delta || 0))}` : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {showCreateDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">Create Delivery</h2>
              <p className="mt-1 text-sm text-zinc-600">Initiate delivery for this sale</p>
            </div>

            {deliveryFormError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{deliveryFormError}</p>
              </div>
            )}

            <form onSubmit={handleCreateDelivery} className="space-y-6">
              {/* Recipient Info */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900">Recipient Information</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Name</label>
                    <input
                      type="text"
                      value={sale?.recipientName || ""}
                      disabled
                      className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Phone</label>
                    <input
                      type="tel"
                      value={sale?.recipientPhone || ""}
                      disabled
                      className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                    />
                  </div>
                </div>
                {sale?.recipientEmail && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-zinc-700">Email</label>
                    <input
                      type="email"
                      value={sale.recipientEmail}
                      disabled
                      className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                    />
                  </div>
                )}
              </div>

              {/* Delivery Address */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900">Delivery Address</h3>
                <div>
                  <label className="block text-sm font-medium text-zinc-700">Address</label>
                  <input
                    type="text"
                    value={
                      typeof sale?.deliveryAddress === "object"
                        ? `${sale.deliveryAddress.street || ""}, ${sale.deliveryAddress.city || ""}, ${sale.deliveryAddress.state || ""}`
                        : sale?.deliveryAddress || ""
                    }
                    disabled
                    className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                  />
                </div>
              </div>

              {/* Delivery Details */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900">Delivery Details</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {sale?.deliveryCategory && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Category</label>
                      <input
                        type="text"
                        value={sale.deliveryCategory}
                        disabled
                        className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                      />
                    </div>
                  )}
                  {sale?.deliveryOption && (
                    <div>
                      <label className="block text-sm font-medium text-zinc-700">Option</label>
                      <input
                        type="text"
                        value={sale.deliveryOption}
                        disabled
                        className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Fee Details */}
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900">Fee Details</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Delivery Fee</label>
                    <input
                      type="text"
                      value={formatCurrency(sale?.deliveryFeeAmount || 0)}
                      disabled
                      className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Taxable</label>
                    <input
                      type="text"
                      value={sale?.deliveryFeeIsTaxable ? "Yes" : "No"}
                      disabled
                      className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-3 border-t border-zinc-200 pt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateDeliveryModal(false)}
                  disabled={creatingDelivery}
                  className="flex-1 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingDelivery}
                  className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creatingDelivery ? "Creating..." : "Create Delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCollectPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">Collect Payment</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Outstanding balance: {formatCurrency(receivable?.balanceDue || 0)}
              </p>
            </div>

            {paymentFormError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{paymentFormError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitCollectPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Payment Method</label>
                <select
                  value={paymentForm.method}
                  onChange={(e) => handlePaymentFieldChange("method", e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="mobile">Mobile</option>
                  <option value="check">Check</option>
                  <option value="credit">Credit</option>
                  <option value="mpesa">M-Pesa</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) => handlePaymentFieldChange("amount", e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Reference (optional)</label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) => handlePaymentFieldChange("reference", e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              {paymentForm.method === "card" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Card Brand (optional)</label>
                    <input
                      type="text"
                      value={paymentForm.cardBrand}
                      onChange={(e) => handlePaymentFieldChange("cardBrand", e.target.value)}
                      className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">Card Last 4 (optional)</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={paymentForm.cardLast4}
                      onChange={(e) => handlePaymentFieldChange("cardLast4", e.target.value)}
                      className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={paymentForm.notes}
                  onChange={(e) => handlePaymentFieldChange("notes", e.target.value)}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCollectPaymentModal(false)}
                  disabled={submittingPayment}
                  className="flex-1 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {submittingPayment ? "Collecting..." : "Collect Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReallocatePaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">Reallocate Payment</h2>
              <p className="mt-1 text-sm text-zinc-600">Manager override for incorrect payment allocation</p>
            </div>

            {reallocationFormError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{reallocationFormError}</p>
              </div>
            )}

            <form onSubmit={handleSubmitReallocation} className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900">Source Allocations</h3>
                  <button
                    type="button"
                    onClick={() => addReallocationRow("fromAllocations")}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    + Add Source
                  </button>
                </div>

                {reallocationForm.fromAllocations.map((allocation, idx) => (
                  <div key={`from-${idx}`} className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-6">
                      <label className="block text-sm font-medium text-zinc-700">Payment Entry</label>
                      <select
                        value={allocation.paymentIndex}
                        onChange={(e) =>
                          updateReallocationField("fromAllocations", idx, "paymentIndex", e.target.value)
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select payment</option>
                        {correctablePayments.map((entry) => (
                          <option key={entry.index} value={entry.index}>
                            #{entry.index + 1} {entry.method} (remaining {formatCurrency(entry.remainingAmount)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-zinc-700">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={allocation.amount}
                        onChange={(e) =>
                          updateReallocationField("fromAllocations", idx, "amount", e.target.value)
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="button"
                        disabled={reallocationForm.fromAllocations.length === 1}
                        onClick={() => removeReallocationRow("fromAllocations", idx)}
                        className="w-full rounded border border-zinc-300 px-2 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900">Target Allocations</h3>
                  <button
                    type="button"
                    onClick={() => addReallocationRow("toAllocations")}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    + Add Target
                  </button>
                </div>

                {reallocationForm.toAllocations.map((allocation, idx) => (
                  <div key={`to-${idx}`} className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-zinc-700">Method</label>
                      <select
                        value={allocation.method}
                        onChange={(e) =>
                          updateReallocationField("toAllocations", idx, "method", e.target.value)
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="mobile">Mobile</option>
                        <option value="check">Check</option>
                        <option value="credit">Credit</option>
                        <option value="mpesa">M-Pesa</option>
                      </select>
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-zinc-700">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={allocation.amount}
                        onChange={(e) =>
                          updateReallocationField("toAllocations", idx, "amount", e.target.value)
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-zinc-700">Reference</label>
                      <input
                        type="text"
                        value={allocation.reference}
                        onChange={(e) =>
                          updateReallocationField("toAllocations", idx, "reference", e.target.value)
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="button"
                        disabled={reallocationForm.toAllocations.length === 1}
                        onClick={() => removeReallocationRow("toAllocations", idx)}
                        className="w-full rounded border border-zinc-300 px-2 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Reason</label>
                <input
                  type="text"
                  value={reallocationForm.reason}
                  onChange={(e) =>
                    setReallocationForm((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">Notes (optional)</label>
                <textarea
                  rows={3}
                  value={reallocationForm.notes}
                  onChange={(e) =>
                    setReallocationForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex gap-3 border-t border-zinc-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowReallocatePaymentModal(false)}
                  disabled={submittingReallocation}
                  className="flex-1 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReallocation}
                  className="flex-1 rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submittingReallocation ? "Saving..." : "Apply Reallocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
