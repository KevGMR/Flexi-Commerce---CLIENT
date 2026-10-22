// client/src/app/dashboard/sales/[id]/page.js
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";
import { printReceiptInBrowser } from "@/lib/receipt/browserPrint";
import { mapSaleToReceipt } from "@/lib/receipt/receiptMappers";
import RefundModal from "@/components/sales/RefundModal";
import VoidConfirmModal from "@/components/sales/VoidConfirmModal";

export default function SaleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const {
    permissions,
    locationsMeta,
    activeOrganization,
    users: storeUsers,
  } = useSessionStore();

  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [delivery, setDelivery] = useState(null);
  const [receivable, setReceivable] = useState(null);
  const [loadingReceivable, setLoadingReceivable] = useState(false);
  const [receivableError, setReceivableError] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [userCache, setUserCache] = useState({});
  const [copyReceiptStatus, setCopyReceiptStatus] = useState("");

  // Local attendant list — prefetch if store doesn't have it populated.
  const [attendantList, setAttendantList] = useState([]);

  // Assignment editing state
  const [editingAssignment, setEditingAssignment] = useState(null);
  // Shape: { kind: "cashier" } | { kind: "sale" } | { kind: "item", itemIndex } | null
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [assignmentError, setAssignmentError] = useState("");
  const [propagateToUnassigned, setPropagateToUnassigned] = useState(false);

  const [showCreateDeliveryModal, setShowCreateDeliveryModal] = useState(false);
  const [creatingDelivery, setCreatingDelivery] = useState(false);
  const [deliveryFormError, setDeliveryFormError] = useState("");

  const [showCollectPaymentModal, setShowCollectPaymentModal] = useState(false);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentFormError, setPaymentFormError] = useState("");
  const [paymentForm, setPaymentForm] = useState({
    method: "cash",
    amount: "",
    reference: "",
    cardLast4: "",
    cardBrand: "",
    notes: "",
  });

  const [showReallocatePaymentModal, setShowReallocatePaymentModal] =
    useState(false);
  const [submittingReallocation, setSubmittingReallocation] = useState(false);
  const [reallocationFormError, setReallocationFormError] = useState("");
  const [reallocationForm, setReallocationForm] = useState({
    fromAllocations: [{ paymentIndex: "", amount: "" }],
    toAllocations: [
      {
        method: "mpesa",
        amount: "",
        reference: "",
        cardLast4: "",
        cardBrand: "",
      },
    ],
    reason: "",
    notes: "",
  });

  const [showRefundModal, setShowRefundModal] = useState(false);
  const [showVoidModal, setShowVoidModal] = useState(false);

  const canViewSalesHistory = permissions?.includes(
    PERMISSIONS.VIEW_SALE_HISTORY,
  );
  const canCreateDeliveryFees = permissions?.includes(
    PERMISSIONS.DELIVERY_FEES_CREATE,
  );
  const canCollectPayment = permissions?.includes(PERMISSIONS.CREATE_SALE);
  const canEditSale = permissions?.includes(PERMISSIONS.EDIT_SALE);
  const canRefundSale = permissions?.includes(PERMISSIONS.REFUND_SALE);

  // -- Currency handling ----------------------------------------------------
  const currencyCode =
    activeOrganization?.settings?.currency ||
    activeOrganization?.currency ||
    "KES";

  const formatCurrency = (value) => {
    const n = Number(value || 0);
    try {
      return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
      }).format(n);
    } catch {
      return `${currencyCode} ${n.toFixed(2)}`;
    }
  };

  const roundCurrency = (value) =>
    Math.round(Number(value || 0) * 100) / 100;

  const formatDate = (dateString) => new Date(dateString).toLocaleString();

  // -- Derived --------------------------------------------------------------
  const saleItems = Array.isArray(sale?.items) ? sale.items : [];

  const isReservation = useMemo(() => {
    if (!sale) return false;
    if (sale.status !== "completed") return false;
    if (sale.paymentStatus === "partial") return true;
    if (Array.isArray(sale.tags) && sale.tags.includes("reservation"))
      return true;
    return false;
  }, [sale]);

  const isPendingStk =
    sale?.paymentStatus === "pending" && Boolean(sale?.pendingMpesa);

  const displayedPayments =
    sale?.effectivePayments?.length > 0
      ? sale.effectivePayments
      : sale?.payments || [];

  const hasUnassignedServiceLines = useMemo(
    () =>
      saleItems.some((it) => it.type === "service" && !it.assignedUser),
    [saleItems],
  );

  const commissionSummary = useMemo(() => {
    const summary = {};
    saleItems.forEach((item) => {
      if (item.type === "service" && item.commissionAmount > 0) {
        const userId = item.assignedUser;
        if (!userId) return;
        if (!summary[userId]) {
          summary[userId] = {
            userId,
            totalCommission: 0,
            services: [],
          };
        }
        summary[userId].totalCommission += item.commissionAmount;
        summary[userId].services.push({
          productName: item.productName,
          commissionAmount: item.commissionAmount,
          commissionType: item.commissionType,
          commissionValue: item.commissionValue,
        });
      }
    });
    return Object.values(summary);
  }, [saleItems]);

  const timeline = useMemo(() => {
    const events = [];
    if (sale?.createdAt) {
      events.push({
        type: "created",
        date: sale.createdAt,
        label: "Sale created",
      });
    }
    if (sale?.status === "voided" && sale?.voidedAt) {
      events.push({
        type: "voided",
        date: sale.voidedAt,
        label: "Sale voided",
        reason: sale.voidReason,
      });
    }
    if (Array.isArray(sale?.refundHistory) && sale.refundHistory.length > 0) {
      sale.refundHistory.forEach((refund) => {
        events.push({
          type: "refund",
          date: refund.refundedAt,
          label: `Refund: ${formatCurrency(refund.amount)}`,
          reason: refund.reason,
        });
      });
    }
    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sale]);

  // -- Fetchers -------------------------------------------------------------
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
      setReceivable(response?.data || response || null);
      setReceivableError("");
    } catch (err) {
      console.error("Failed to fetch receivable:", err);
      setReceivable(null);
      setReceivableError("Failed to load receivable details");
    } finally {
      setLoadingReceivable(false);
    }
  }, [params.id]);

  useEffect(() => {
    if (!canViewSalesHistory) {
      setLoading(false);
      return;
    }
    fetchSaleById();
  }, [params.id, canViewSalesHistory, fetchSaleById]);

  useEffect(() => {
    if (!sale?.deliveryFeeId) return;
    const fetchDelivery = async () => {
      try {
        const response = await apiFetch(`/delivery-fees/${sale.deliveryFeeId}`);
        setDelivery(response?.data || response || null);
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

  // Load users for the assignment dropdowns (prefer store, else fetch)
  useEffect(() => {
    if (Array.isArray(storeUsers) && storeUsers.length > 0) {
      setAttendantList(storeUsers);
      return;
    }

    let cancelled = false;
    const fetchUsers = async () => {
      try {
        const res = await apiFetch("/users?limit=100");
        const list =
          res?.data?.users || res?.users || res?.data || res || [];
        if (!cancelled && Array.isArray(list)) {
          setAttendantList(list);
        }
      } catch (err) {
        console.warn("[sale detail] failed to load users:", err.message);
        if (!cancelled) setAttendantList([]);
      }
    };
    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [storeUsers]);

  // Fetch user names for commission summary
  useEffect(() => {
    const userIds = commissionSummary.map((e) => e.userId).filter(Boolean);
    if (userIds.length === 0) return;
    const missing = userIds.filter((id) => !userCache[id]);
    if (missing.length === 0) return;

    const fetchMissingUsers = async () => {
      try {
        const results = await Promise.all(
          missing.map((id) =>
            apiFetch(`/users/${id}`).then((res) => ({
              id,
              user: res?.user || res?.data?.user,
            })),
          ),
        );
        const next = { ...userCache };
        results.forEach(({ id, user }) => {
          if (user) next[id] = user;
        });
        setUserCache(next);
      } catch (err) {
        console.error("Failed to fetch user details:", err);
      }
    };
    fetchMissingUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commissionSummary]);

  // -- Helpers --------------------------------------------------------------
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

  const getUserFullName = (userId) => {
    if (!userId) return "Unassigned";
    const cached = userCache[userId];
    if (cached) return cached.fullname || cached.email || userId;
    const fromList = attendantList.find((u) => u._id === userId);
    if (fromList) return fromList.fullname || fromList.email || userId;
    const fromStore = storeUsers?.find((u) => u._id === userId);
    if (fromStore) return fromStore.fullname || fromStore.email || userId;
    return userId;
  };

  // -- Assignment editing ---------------------------------------------------
  const openAssignmentEditor = (shape) => {
    setAssignmentError("");
    setPropagateToUnassigned(false);
    setEditingAssignment(shape);
  };

  const closeAssignmentEditor = () => {
    setEditingAssignment(null);
    setAssignmentError("");
    setPropagateToUnassigned(false);
  };

  const handleSaveAssignment = async (newUserId) => {
    if (!editingAssignment) return;
    setSavingAssignment(true);
    setAssignmentError("");
    try {
      let body = {};
      if (editingAssignment.kind === "cashier") {
        body = { cashierId: newUserId };
      } else if (editingAssignment.kind === "sale") {
        body = {
          assignedUser: newUserId || null,
          propagateToUnassigned:
            propagateToUnassigned === true,
        };
      } else if (editingAssignment.kind === "item") {
        body = {
          items: [
            {
              itemIndex: editingAssignment.itemIndex,
              assignedUser: newUserId || null,
            },
          ],
        };
      }

      const res = await apiFetch(`/sales/${sale._id}/assign`, {
        method: "PATCH",
        body,
      });

      const updated = res?.data || res;
      if (updated) setSale(updated);
      setActionStatus("Assignment updated");
      setTimeout(() => setActionStatus(""), 3000);
      closeAssignmentEditor();
    } catch (err) {
      console.error("Failed to reassign:", err);
      setAssignmentError(err.message || "Failed to reassign");
    } finally {
      setSavingAssignment(false);
    }
  };

  // -- Actions --------------------------------------------------------------
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
    } catch {
      setCopyReceiptStatus("Copy failed");
      setTimeout(() => setCopyReceiptStatus(""), 2000);
    }
  };

  const handleOpenReservationEdit = () => {
    router.push(`/dashboard/sales/${sale._id}/edit`);
  };

  const handleCreateDelivery = async (e) => {
    e.preventDefault();
    setDeliveryFormError("");
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
    const suggested = Number(receivable?.balanceDue || 0);
    setPaymentForm({
      method: "cash",
      amount: suggested > 0 ? suggested.toFixed(2) : "",
      reference: "",
      cardLast4: "",
      cardBrand: "",
      notes: "",
    });
    setPaymentFormError("");
    setShowCollectPaymentModal(true);
  };

  const handlePaymentFieldChange = (field, value) => {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
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
      if (
        (payment?.status || "completed") === "completed" &&
        Number(payment?.amount || 0) > 0
      ) {
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
    const correctable = getCorrectablePayments();
    if (correctable.length === 0) {
      setReallocationFormError(
        "No completed payment allocation is available for reallocation",
      );
      return;
    }
    const first = correctable[0];
    setReallocationForm({
      fromAllocations: [
        {
          paymentIndex: String(first.index),
          amount: first.remainingAmount.toFixed(2),
        },
      ],
      toAllocations: [
        {
          method: "mpesa",
          amount: first.remainingAmount.toFixed(2),
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
      const next = [...prev[section]];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, [section]: next };
    });
  };

  const addReallocationRow = (section) => {
    setReallocationForm((prev) => ({
      ...prev,
      [section]: [
        ...prev[section],
        section === "fromAllocations"
          ? { paymentIndex: "", amount: "" }
          : {
              method: "mpesa",
              amount: "",
              reference: "",
              cardLast4: "",
              cardBrand: "",
            },
      ],
    }));
  };

  const removeReallocationRow = (section, index) => {
    setReallocationForm((prev) => ({
      ...prev,
      [section]: prev[section].filter((_, i) => i !== index),
    }));
  };

  const handleSubmitReallocation = async (e) => {
    e.preventDefault();
    setReallocationFormError("");
    const correctable = getCorrectablePayments();
    const remainingByIndex = new Map(
      correctable.map((entry) => [
        entry.index,
        Number(entry.remainingAmount || 0),
      ]),
    );
    const fromAllocations = reallocationForm.fromAllocations
      .map((a) => ({
        paymentIndex: Number(a.paymentIndex),
        amount: Number(a.amount || 0),
      }))
      .filter((a) => Number.isFinite(a.amount) && a.amount > 0);
    const toAllocations = reallocationForm.toAllocations
      .map((a) => ({
        method: a.method,
        amount: Number(a.amount || 0),
        reference: a.reference || undefined,
        cardLast4: a.cardLast4 || undefined,
        cardBrand: a.cardBrand || undefined,
      }))
      .filter((a) => Number.isFinite(a.amount) && a.amount > 0);

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

    const requestedFrom = fromAllocations.reduce((acc, a) => {
      acc.set(a.paymentIndex, (acc.get(a.paymentIndex) || 0) + a.amount);
      return acc;
    }, new Map());

    for (const [idx, amount] of requestedFrom.entries()) {
      if (!remainingByIndex.has(idx)) {
        setReallocationFormError(
          `Payment index ${idx} is not available for correction`,
        );
        return;
      }
      const available = Number(remainingByIndex.get(idx) || 0);
      if (amount - available > 0.01) {
        setReallocationFormError(
          `Source allocation for payment index ${idx} exceeds available amount`,
        );
        return;
      }
    }

    const fromTotal = fromAllocations.reduce((s, a) => s + a.amount, 0);
    const toTotal = toAllocations.reduce((s, a) => s + a.amount, 0);
    if (Math.abs(fromTotal - toTotal) > 0.01) {
      setReallocationFormError(
        "Total source amount must match total target amount",
      );
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

  // -- Guards ---------------------------------------------------------------
  if (!canViewSalesHistory) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Sale Details</h1>
        <p className="text-sm text-zinc-600">
          You don&apos;t have permission to view sale details.
        </p>
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

  // -- Render ---------------------------------------------------------------
  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Sticky header ----------------------------------------------------- */}
      <div className="sticky top-0 z-30 -mx-4 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              ← Back
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold text-zinc-900 sm:text-xl">
                  {sale.receiptNumber || "N/A"}
                </h1>
                <button
                  type="button"
                  onClick={handleCopyReceiptNumber}
                  disabled={!sale?.receiptNumber}
                  className="rounded border border-zinc-300 px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Copy
                </button>
                {copyReceiptStatus && (
                  <span
                    className={`text-xs font-medium ${
                      copyReceiptStatus === "Copied!"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {copyReceiptStatus}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-zinc-500">
                {formatDate(sale.createdAt)}
              </p>
            </div>
          </div>

          {/* Desktop action group */}
          <div className="hidden flex-wrap items-center gap-2 sm:flex sm:justify-end">
            {canEditSale && isReservation && (
              <button
                onClick={handleOpenReservationEdit}
                className="rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700"
              >
                Edit reservation
              </button>
            )}
            <button
              onClick={handlePrintOrder}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              Print
            </button>
            {canRefundSale && sale.status === "completed" && (
              <>
                <button
                  onClick={() => setShowRefundModal(true)}
                  className="rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
                >
                  Refund
                </button>
                <button
                  onClick={() => setShowVoidModal(true)}
                  className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                >
                  Void
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status pills */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-0.5 text-xs font-medium capitalize ${getStatusColor(
              sale.status,
            )}`}
          >
            {sale.status}
          </span>
          <span className="rounded-full border border-zinc-300 bg-zinc-100 px-3 py-0.5 text-xs font-medium capitalize text-zinc-700">
            {sale.paymentStatus}
          </span>
          {sale.salesChannel && (
            <span className="rounded-full border border-zinc-300 bg-white px-3 py-0.5 text-xs font-medium text-zinc-700">
              {sale.salesChannel === "pos" ? "POS" : "Storefront"}
            </span>
          )}
          {isPendingStk && (
            <span className="rounded-full border border-blue-300 bg-blue-50 px-3 py-0.5 text-xs font-medium text-blue-800">
              Waiting for M-Pesa
            </span>
          )}
          {sale.shopifySyncStatus && sale.shopifySyncStatus !== "synced" && (
            <span
              className={`rounded-full border px-3 py-0.5 text-xs font-medium capitalize ${getSyncStatusColor(
                sale.shopifySyncStatus,
              )}`}
            >
              Shopify: {sale.shopifySyncStatus}
            </span>
          )}
        </div>
      </div>

      {actionStatus && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {actionStatus}
        </div>
      )}

      {/* Main content ------------------------------------------------------ */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT — main */}
        <div className="space-y-6 lg:col-span-2">
          {/* Summary strip */}
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs font-medium text-zinc-500">Total</p>
                <p className="mt-1 text-lg font-bold text-zinc-900">
                  {formatCurrency(sale.totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Paid</p>
                <p className="mt-1 text-lg font-semibold text-emerald-700">
                  {formatCurrency(receivable?.totalPaid || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">
                  Balance due
                </p>
                <p
                  className={`mt-1 text-lg font-semibold ${
                    Number(receivable?.balanceDue || 0) > 0.01
                      ? "text-amber-700"
                      : "text-zinc-500"
                  }`}
                >
                  {formatCurrency(receivable?.balanceDue || 0)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-500">Items</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900">
                  {saleItems.length}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 border-t border-zinc-100 pt-3 text-xs sm:grid-cols-3">
              <div>
                <span className="text-zinc-500">Transaction ID: </span>
                <span className="font-mono text-zinc-700">
                  {sale.transactionId || "—"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Inventory: </span>
                <span className="font-medium capitalize text-zinc-700">
                  {sale.inventoryStatus || "—"}
                </span>
              </div>
              <div>
                <span className="text-zinc-500">Location: </span>
                <span className="font-medium text-zinc-700">
                  {getLocationName(sale.locationId)}
                </span>
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Items ({sale.items?.length || 0})
            </h2>
            <div className="divide-y divide-zinc-200">
              {saleItems.map((item, idx) => {
                const isChild =
                  item.parentItemIndex !== null &&
                  item.parentItemIndex !== undefined;
                const isService = item.type === "service";
                const parentService = isChild
                  ? saleItems[item.parentItemIndex]
                  : null;
                const itemAssignee = isService ? item.assignedUser : null;
                const commissionAmount = isService
                  ? item.commissionAmount
                  : null;
                const commissionType = isService ? item.commissionType : null;
                const commissionValue = isService
                  ? item.commissionValue
                  : null;
                const variantText = Array.isArray(item.variantTitle)
                  ? item.variantTitle
                      .map((o) => o.value)
                      .filter(Boolean)
                      .join(" / ")
                  : "";

                return (
                  <div
                    key={idx}
                    className={`flex items-start justify-between py-4 first:pt-0 last:pb-0 ${
                      isChild ? "ml-6 border-l-2 border-blue-200 pl-4" : ""
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-zinc-900">
                          {item.productName || "Unnamed Item"}
                        </p>
                        {isChild && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                            Attached to:{" "}
                            {parentService?.productName || "Service"}
                          </span>
                        )}
                        {item.type === "service" && (
                          <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                            Service
                          </span>
                        )}
                      </div>
                      {item.sku && (
                        <p className="text-xs text-zinc-500">SKU: {item.sku}</p>
                      )}
                      {variantText && (
                        <p className="text-xs text-zinc-500">
                          Variant: {variantText}
                        </p>
                      )}
                      <p className="mt-1 text-sm text-zinc-600">
                        {item.quantity} × {formatCurrency(item.unitPrice)}
                        {item.type === "shopify" && " (Shopify)"}
                        {item.type === "flexi" && " (FLEXI)"}
                        {item.discount > 0 && (
                          <span className="ml-2 text-green-600">
                            Discount: {formatCurrency(item.discount)}
                          </span>
                        )}
                      </p>
                      {isService && (
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                          {canEditSale ? (
                            editingAssignment?.kind === "item" &&
                            editingAssignment.itemIndex === idx ? (
                              <div className="w-full">
                                <AssignmentDropdown
                                  value={itemAssignee || ""}
                                  users={attendantList}
                                  loading={savingAssignment}
                                  error={assignmentError}
                                  onPick={(uid) =>
                                    handleSaveAssignment(uid)
                                  }
                                  onCancel={closeAssignmentEditor}
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  openAssignmentEditor({
                                    kind: "item",
                                    itemIndex: idx,
                                  })
                                }
                                className="flex items-center gap-1 rounded border border-dashed border-zinc-300 px-2 py-0.5 text-left text-xs text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50"
                                title="Click to reassign"
                              >
                                <span className="font-medium">
                                  Assigned:
                                </span>
                                {itemAssignee
                                  ? getUserFullName(itemAssignee)
                                  : "Unassigned"}
                                <span className="ml-1 text-zinc-400">✎</span>
                              </button>
                            )
                          ) : (
                            itemAssignee && (
                              <span className="flex items-center gap-1 text-zinc-600">
                                <span className="font-medium">Assigned:</span>
                                {getUserFullName(itemAssignee)}
                              </span>
                            )
                          )}
                          {commissionAmount > 0 && (
                            <span className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-blue-700">
                              <span className="font-medium">Commission:</span>
                              {formatCurrency(commissionAmount)}
                              {commissionType === "percentage"
                                ? ` (${commissionValue}%)`
                                : ` (${formatCurrency(
                                    commissionValue,
                                  )} fixed)`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-zinc-900">
                        {formatCurrency(item.lineTotal)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Commission summary */}
          {commissionSummary.length > 0 && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-blue-900">
                Commission summary
              </h2>
              <div className="space-y-3">
                {commissionSummary.map((entry) => (
                  <div
                    key={entry.userId}
                    className="rounded-lg bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {getUserFullName(entry.userId)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-blue-600">
                          {formatCurrency(entry.totalCommission)}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {entry.services.length} service(s)
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {entry.services.map((svc, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800"
                        >
                          {svc.productName}:{" "}
                          {formatCurrency(svc.commissionAmount)}
                          {svc.commissionType === "percentage"
                            ? ` (${svc.commissionValue}%)`
                            : ` (${formatCurrency(
                                svc.commissionValue,
                              )} fixed)`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pricing */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Pricing
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-600">Subtotal</span>
                <span className="font-medium text-zinc-900">
                  {formatCurrency(sale.subtotal)}
                </span>
              </div>
              {sale.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-green-600">Discount</span>
                  <span className="font-medium text-green-600">
                    -{formatCurrency(sale.discountAmount)}
                  </span>
                </div>
              )}
              {sale.taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Tax</span>
                  <span className="font-medium text-zinc-900">
                    {formatCurrency(sale.taxAmount)}
                  </span>
                </div>
              )}
              {sale.deliveryFeeAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Delivery fee</span>
                  <span className="font-medium text-zinc-900">
                    {formatCurrency(sale.deliveryFeeAmount)}
                  </span>
                </div>
              )}
              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-zinc-900">Total</span>
                  <span className="text-lg font-bold text-zinc-900">
                    {formatCurrency(sale.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Delivery */}
          {sale.requiresDelivery && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-900">
                  Delivery
                </h2>
                {delivery && (
                  <button
                    onClick={() =>
                      router.push(`/dashboard/deliveries/${delivery._id}`)
                    }
                    className="rounded border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Open delivery →
                  </button>
                )}
                {!delivery && canCreateDeliveryFees && (
                  <button
                    onClick={() => setShowCreateDeliveryModal(true)}
                    className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                  >
                    Create delivery
                  </button>
                )}
              </div>

              {delivery ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-zinc-900">
                        {delivery.deliveryCategory ||
                          delivery.deliveryOption ||
                          "Standard delivery"}
                      </p>
                      {delivery.trackingNumber && (
                        <p className="text-xs text-zinc-500">
                          Tracking: {delivery.trackingNumber}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${getDeliveryStatusColor(
                        delivery.categoryStatus,
                      )}`}
                    >
                      {delivery.categoryStatus}
                    </span>
                  </div>

                  <div className="grid gap-4 border-t border-zinc-200 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-zinc-500">
                        RECIPIENT
                      </p>
                      <p className="mt-1 text-sm text-zinc-900">
                        {delivery.recipientName || "N/A"}
                      </p>
                      {delivery.recipientPhone && (
                        <p className="text-sm text-zinc-600">
                          {delivery.recipientPhone}
                        </p>
                      )}
                      {delivery.recipientEmail && (
                        <p className="text-sm text-zinc-600">
                          {delivery.recipientEmail}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-500">
                        ADDRESS
                      </p>
                      <p className="mt-1 text-sm text-zinc-900">
                        {typeof delivery.deliveryAddress === "object"
                          ? [
                              delivery.deliveryAddress.street,
                              delivery.deliveryAddress.city,
                              delivery.deliveryAddress.state,
                            ]
                              .filter(Boolean)
                              .join(", ")
                          : delivery.deliveryAddress}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-zinc-600">
                    No delivery created yet
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">
                Timeline
              </h2>
              <div className="space-y-4">
                {timeline.map((event, idx) => (
                  <div
                    key={idx}
                    className="border-l-2 border-zinc-300 pl-4 pb-4 last:pb-0"
                  >
                    <p className="text-xs font-medium text-zinc-500">
                      {formatDate(event.date)}
                    </p>
                    <p className="mt-1 text-sm font-medium text-zinc-900">
                      {event.label}
                    </p>
                    {event.reason && (
                      <p className="mt-1 text-sm text-zinc-600">
                        {event.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — sidebar */}
        <div className="space-y-6">
          {/* Customer */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Customer
            </h2>
            {sale.customerName ||
            sale.customerEmail ||
            sale.customerPhone ? (
              <div className="space-y-3">
                {sale.customerName && (
                  <p className="font-medium text-zinc-900">
                    {sale.customerName}
                  </p>
                )}
                {sale.customerEmail && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">EMAIL</p>
                    <p className="mt-1 text-sm text-blue-600">
                      {sale.customerEmail}
                    </p>
                  </div>
                )}
                {sale.customerPhone && (
                  <div>
                    <p className="text-xs font-medium text-zinc-500">PHONE</p>
                    <p className="mt-1 text-sm text-zinc-900">
                      {sale.customerPhone}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No customer information</p>
            )}
          </div>

          {/* Payment */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Payment
            </h2>

            {isPendingStk && (
                <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-blue-900">
                        Waiting for M-Pesa
                      </p>
                      <p className="mt-1 text-xs text-blue-800">
                        {sale.pendingMpesa?.phone
                          ? `Prompt sent to ${sale.pendingMpesa.phone}.`
                          : "Prompt sent to customer."}
                      </p>
                    </div>
                    {canEditSale && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (
                            !confirm(
                              "Cancel the M-Pesa prompt? The sale will stay pending so it can be retried or marked paid.",
                            )
                          )
                            return;
                          try {
                            await apiFetch(`/sales/${sale._id}/mpesa-stk/cancel`, {
                              method: "POST",
                            });
                            await Promise.all([fetchSaleById(), fetchReceivable()]);
                            setActionStatus("M-Pesa prompt cancelled");
                            setTimeout(() => setActionStatus(""), 3000);
                          } catch (err) {
                            alert(err.message || "Failed to cancel STK");
                          }
                        }}
                        className="shrink-0 rounded border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100"
                      >
                        Cancel prompt
                      </button>
                    )}
                  </div>
                </div>
              )}

            {loadingReceivable && (
              <p className="text-xs text-zinc-500 mb-3">
                Loading receivable details...
              </p>
            )}
            {receivableError && (
              <div className="mb-3 rounded border border-red-200 bg-red-50 p-2">
                <p className="text-xs text-red-700">{receivableError}</p>
              </div>
            )}

            {receivable && (
              <div className="mb-4 rounded border border-zinc-200 bg-zinc-50 p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-600">Total due</span>
                  <span className="font-medium text-zinc-900">
                    {formatCurrency(receivable.totalDue)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-600">Amount paid</span>
                  <span className="font-medium text-green-700">
                    {formatCurrency(receivable.totalPaid)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-600">Balance due</span>
                  <span
                    className={`font-semibold ${
                      Number(receivable.balanceDue || 0) > 0.01
                        ? "text-orange-700"
                        : "text-green-700"
                    }`}
                  >
                    {formatCurrency(receivable.balanceDue)}
                  </span>
                </div>
                <div className="pt-1 flex items-center justify-between">
                  <span className="inline-block rounded px-2 py-1 text-xs font-medium capitalize bg-zinc-100 text-zinc-700">
                    {receivable.status || "open"}
                  </span>
                  <div className="flex items-center gap-2">
                    {isPendingStk ? (
                      <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800">
                        Awaiting M-Pesa
                      </span>
                    ) : (
                      <>
                        {canEditSale && getCorrectablePayments().length > 0 && (
                          <button
                            onClick={handleOpenReallocation}
                            disabled={loadingReceivable || submittingReallocation}
                            className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                          >
                            Reallocate
                          </button>
                        )}
                        {canCollectPayment &&
                          Number(receivable.balanceDue || 0) > 0.01 && (
                            <button
                              onClick={handleOpenCollectPayment}
                              disabled={loadingReceivable || submittingPayment}
                              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              Collect payment
                            </button>
                          )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {displayedPayments?.length > 0 ? (
                displayedPayments.map((payment, idx) => (
                  <div
                    key={idx}
                    className="border-b border-zinc-200 pb-3 last:border-b-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium capitalize text-zinc-900">
                        {payment.method}
                      </p>
                      <p className="font-semibold text-zinc-900">
                        {formatCurrency(payment.amount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-medium capitalize ${
                          payment.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : payment.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                        }`}
                      >
                        {payment.status}
                      </span>
                      {payment.reference && (
                        <span className="text-xs font-mono text-zinc-500">
                          {payment.reference}
                        </span>
                      )}
                      {payment.cardBrand && (
                        <span className="text-xs text-zinc-500">
                          {payment.cardBrand}
                        </span>
                      )}
                      {payment.cardLast4 && (
                        <span className="text-xs text-zinc-500">
                          •••• {payment.cardLast4}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-zinc-600">
                  {sale.paymentMethod || "No payment info"}
                </p>
              )}
            </div>

            {sale.paymentCorrections?.length > 0 && (
              <div className="mt-4 rounded border border-indigo-200 bg-indigo-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">
                  Corrections
                </p>
                <div className="mt-2 space-y-2">
                  {sale.paymentCorrections.map((c, i) => (
                    <div
                      key={c.correctionId || i}
                      className="text-xs text-indigo-900"
                    >
                      <p className="font-medium">
                        {formatDate(c.correctedAt)}
                      </p>
                      <p>{c.reason || "Payment allocation corrected"}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Assignment */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-zinc-900">
              Assignment
            </h2>
            <p className="mb-4 text-xs text-zinc-500">
              Services attribute commission to the attendant on each line. The
              sale default is only used as a fallback when a service line has
              no explicit attendant.
            </p>

            <div className="space-y-4">
              {/* Cashier */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Cashier
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Who operated the till for this sale.
                </p>
                {canEditSale && editingAssignment?.kind === "cashier" ? (
                  <AssignmentDropdown
                    value={sale.cashierId?._id || sale.cashierId || ""}
                    users={attendantList}
                    loading={savingAssignment}
                    error={assignmentError}
                    onPick={(uid) => handleSaveAssignment(uid)}
                    onCancel={closeAssignmentEditor}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={!canEditSale}
                    onClick={() =>
                      openAssignmentEditor({ kind: "cashier" })
                    }
                    className={`mt-1 flex items-center gap-2 rounded border border-dashed px-2 py-1 text-left text-sm ${
                      canEditSale
                        ? "border-zinc-300 text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50"
                        : "border-transparent text-zinc-900 cursor-default"
                    }`}
                    title={canEditSale ? "Click to reassign" : undefined}
                  >
                    {sale.cashierId?._id
                      ? getUserFullName(sale.cashierId._id)
                      : sale.cashierId
                        ? getUserFullName(sale.cashierId)
                        : "—"}
                    {canEditSale && (
                      <span className="text-zinc-400">✎</span>
                    )}
                  </button>
                )}
              </div>

              {/* Default attendant (sale-level) */}
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Default attendant
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">
                  Fallback for new service lines added without an explicit
                  attendant.
                </p>
                {canEditSale && editingAssignment?.kind === "sale" ? (
                  <AssignmentDropdown
                    value={sale.assignedUser?._id || sale.assignedUser || ""}
                    users={attendantList}
                    loading={savingAssignment}
                    error={assignmentError}
                    onPick={(uid) => handleSaveAssignment(uid)}
                    onCancel={closeAssignmentEditor}
                    showPropagate={hasUnassignedServiceLines}
                    propagateValue={propagateToUnassigned}
                    onPropagateChange={setPropagateToUnassigned}
                  />
                ) : (
                  <button
                    type="button"
                    disabled={!canEditSale}
                    onClick={() => openAssignmentEditor({ kind: "sale" })}
                    className={`mt-1 flex items-center gap-2 rounded border border-dashed px-2 py-1 text-left text-sm ${
                      canEditSale
                        ? "border-zinc-300 text-zinc-900 hover:border-zinc-400 hover:bg-zinc-50"
                        : "border-transparent text-zinc-900 cursor-default"
                    }`}
                    title={canEditSale ? "Click to reassign" : undefined}
                  >
                    {sale.assignedUser?._id
                      ? getUserFullName(sale.assignedUser._id)
                      : sale.assignedUser
                        ? getUserFullName(sale.assignedUser)
                        : "None"}
                    {canEditSale && (
                      <span className="text-zinc-400">✎</span>
                    )}
                  </button>
                )}
              </div>

              {/* Per-line attribution summary */}
              {saleItems.some((it) => it.type === "service") && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Per-line attendants
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    Edit each line from the Items card above.
                  </p>
                  <div className="mt-2 space-y-1">
                    {saleItems.map((it, idx) => {
                      if (it.type !== "service") return null;
                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between rounded bg-zinc-50 px-2 py-1 text-xs"
                        >
                          <span className="truncate text-zinc-600">
                            #{idx + 1} {it.productName}
                          </span>
                          <span className="ml-2 whitespace-nowrap text-zinc-900">
                            {it.assignedUser
                              ? getUserFullName(it.assignedUser)
                              : "Unassigned"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {sale.supervisorId && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    Supervisor
                  </p>
                  <p className="mt-1 text-sm text-zinc-900">
                    {sale.supervisorId?.fullname || sale.supervisorId}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          {sale.tags && sale.tags.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">
                Tags
              </h2>
              <div className="flex flex-wrap gap-2">
                {sale.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Metadata
            </h2>
            <div className="space-y-3">
              {sale.idempotencyKey && (
                <div>
                  <p className="text-xs font-medium text-zinc-500">
                    IDEMPOTENCY KEY
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-zinc-900">
                    {sale.idempotencyKey}
                  </p>
                </div>
              )}
              {sale.completedAt && (
                <div>
                  <p className="text-xs font-medium text-zinc-500">
                    COMPLETED AT
                  </p>
                  <p className="mt-1 text-sm text-zinc-900">
                    {formatDate(sale.completedAt)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Adjustment (void / refund) */}
          {(sale.status === "voided" || sale.status === "partial_refund") && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-red-900">
                Adjustment
              </h2>
              <div className="space-y-3">
                {sale.status === "voided" && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-red-700">
                        VOIDED AT
                      </p>
                      <p className="mt-1 text-sm text-red-900">
                        {sale.voidedAt ? formatDate(sale.voidedAt) : "N/A"}
                      </p>
                    </div>
                    {sale.voidReason && (
                      <div>
                        <p className="text-xs font-medium text-red-700">
                          REASON
                        </p>
                        <p className="mt-1 text-sm text-red-900">
                          {sale.voidReason}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {sale.status === "partial_refund" && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-red-700">
                        REFUND AMOUNT
                      </p>
                      <p className="mt-1 text-sm font-semibold text-red-900">
                        {formatCurrency(sale.refundAmount || 0)}
                      </p>
                    </div>
                    {sale.refundReason && (
                      <div>
                        <p className="text-xs font-medium text-red-700">
                          REASON
                        </p>
                        <p className="mt-1 text-sm text-red-900">
                          {sale.refundReason}
                        </p>
                      </div>
                    )}
                    {sale.refundedAt && (
                      <div>
                        <p className="text-xs font-medium text-red-700">
                          REFUNDED AT
                        </p>
                        <p className="mt-1 text-sm text-red-900">
                          {formatDate(sale.refundedAt)}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {sale.notes && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">
                Notes
              </h2>
              <p className="text-sm text-zinc-600">{sale.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile sticky footer */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white p-3 sm:hidden">
        <div className="flex gap-2">
          {canEditSale && isReservation && (
            <button
              onClick={handleOpenReservationEdit}
              className="flex-1 rounded bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Edit
            </button>
          )}
          <button
            onClick={handlePrintOrder}
            className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Print
          </button>
          {canRefundSale && sale.status === "completed" && (
            <>
              <button
                onClick={() => setShowRefundModal(true)}
                className="flex-1 rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-700"
              >
                Refund
              </button>
              <button
                onClick={() => setShowVoidModal(true)}
                className="flex-1 rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Void
              </button>
            </>
          )}
        </div>
      </div>

      {/* Create delivery modal */}
      {showCreateDeliveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">
                Create delivery
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Initiate delivery for this sale
              </p>
            </div>
            {deliveryFormError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{deliveryFormError}</p>
              </div>
            )}
            <form onSubmit={handleCreateDelivery} className="space-y-6">
              <div>
                <h3 className="mb-4 font-semibold text-zinc-900">
                  Recipient information
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      Name
                    </label>
                    <input
                      type="text"
                      value={sale?.recipientName || ""}
                      disabled
                      className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      Phone
                    </label>
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
                    <label className="block text-sm font-medium text-zinc-700">
                      Email
                    </label>
                    <input
                      type="email"
                      value={sale.recipientEmail}
                      disabled
                      className="mt-1 w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                    />
                  </div>
                )}
              </div>

              <div>
                <h3 className="mb-4 font-semibold text-zinc-900">
                  Delivery address
                </h3>
                <input
                  type="text"
                  value={
                    typeof sale?.deliveryAddress === "object"
                      ? [
                          sale.deliveryAddress.street,
                          sale.deliveryAddress.city,
                          sale.deliveryAddress.state,
                        ]
                          .filter(Boolean)
                          .join(", ")
                      : sale?.deliveryAddress || ""
                  }
                  disabled
                  className="w-full rounded border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-600"
                />
              </div>

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
                  {creatingDelivery ? "Creating..." : "Create delivery"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Collect payment modal */}
      {showCollectPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">
                Collect payment
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Outstanding balance:{" "}
                {formatCurrency(receivable?.balanceDue || 0)}
              </p>
            </div>
            {paymentFormError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">{paymentFormError}</p>
              </div>
            )}
            <form onSubmit={handleSubmitCollectPayment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Payment method
                </label>
                <select
                  value={paymentForm.method}
                  onChange={(e) =>
                    handlePaymentFieldChange("method", e.target.value)
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
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    handlePaymentFieldChange("amount", e.target.value)
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Reference (optional)
                </label>
                <input
                  type="text"
                  value={paymentForm.reference}
                  onChange={(e) =>
                    handlePaymentFieldChange("reference", e.target.value)
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              {paymentForm.method === "card" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      Card brand (optional)
                    </label>
                    <input
                      type="text"
                      value={paymentForm.cardBrand}
                      onChange={(e) =>
                        handlePaymentFieldChange("cardBrand", e.target.value)
                      }
                      className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700">
                      Card last 4 (optional)
                    </label>
                    <input
                      type="text"
                      maxLength={4}
                      value={paymentForm.cardLast4}
                      onChange={(e) =>
                        handlePaymentFieldChange("cardLast4", e.target.value)
                      }
                      className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Notes (optional)
                </label>
                <textarea
                  rows={3}
                  value={paymentForm.notes}
                  onChange={(e) =>
                    handlePaymentFieldChange("notes", e.target.value)
                  }
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
                  {submittingPayment ? "Collecting..." : "Collect payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reallocate payment modal */}
      {showReallocatePaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-xl">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-zinc-900">
                Reallocate payment
              </h2>
              <p className="mt-1 text-sm text-zinc-600">
                Manager override for incorrect payment allocation
              </p>
            </div>
            {reallocationFormError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-700">
                  {reallocationFormError}
                </p>
              </div>
            )}
            <form onSubmit={handleSubmitReallocation} className="space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-zinc-900">
                    Source allocations
                  </h3>
                  <button
                    type="button"
                    onClick={() => addReallocationRow("fromAllocations")}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    + Add source
                  </button>
                </div>
                {reallocationForm.fromAllocations.map((a, idx) => (
                  <div
                    key={`from-${idx}`}
                    className="grid gap-3 md:grid-cols-12"
                  >
                    <div className="md:col-span-6">
                      <label className="block text-sm font-medium text-zinc-700">
                        Payment entry
                      </label>
                      <select
                        value={a.paymentIndex}
                        onChange={(e) =>
                          updateReallocationField(
                            "fromAllocations",
                            idx,
                            "paymentIndex",
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      >
                        <option value="">Select payment</option>
                        {getCorrectablePayments().map((entry) => (
                          <option key={entry.index} value={entry.index}>
                            #{entry.index + 1} {entry.method} (remaining{" "}
                            {formatCurrency(entry.remainingAmount)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-zinc-700">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={a.amount}
                        onChange={(e) =>
                          updateReallocationField(
                            "fromAllocations",
                            idx,
                            "amount",
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="button"
                        disabled={
                          reallocationForm.fromAllocations.length === 1
                        }
                        onClick={() =>
                          removeReallocationRow("fromAllocations", idx)
                        }
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
                  <h3 className="font-semibold text-zinc-900">
                    Target allocations
                  </h3>
                  <button
                    type="button"
                    onClick={() => addReallocationRow("toAllocations")}
                    className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    + Add target
                  </button>
                </div>
                {reallocationForm.toAllocations.map((a, idx) => (
                  <div key={`to-${idx}`} className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-4">
                      <label className="block text-sm font-medium text-zinc-700">
                        Method
                      </label>
                      <select
                        value={a.method}
                        onChange={(e) =>
                          updateReallocationField(
                            "toAllocations",
                            idx,
                            "method",
                            e.target.value,
                          )
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
                      <label className="block text-sm font-medium text-zinc-700">
                        Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={a.amount}
                        onChange={(e) =>
                          updateReallocationField(
                            "toAllocations",
                            idx,
                            "amount",
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-zinc-700">
                        Reference
                      </label>
                      <input
                        type="text"
                        value={a.reference}
                        onChange={(e) =>
                          updateReallocationField(
                            "toAllocations",
                            idx,
                            "reference",
                            e.target.value,
                          )
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-end">
                      <button
                        type="button"
                        disabled={
                          reallocationForm.toAllocations.length === 1
                        }
                        onClick={() =>
                          removeReallocationRow("toAllocations", idx)
                        }
                        className="w-full rounded border border-zinc-300 px-2 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Reason
                </label>
                <input
                  type="text"
                  value={reallocationForm.reason}
                  onChange={(e) =>
                    setReallocationForm((prev) => ({
                      ...prev,
                      reason: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">
                  Notes (optional)
                </label>
                <textarea
                  rows={3}
                  value={reallocationForm.notes}
                  onChange={(e) =>
                    setReallocationForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
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
                  {submittingReallocation
                    ? "Saving..."
                    : "Apply reallocation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRefundModal && (
        <RefundModal
          sale={sale}
          onClose={() => setShowRefundModal(false)}
          onSuccess={async () => {
            await Promise.all([fetchSaleById(), fetchReceivable()]);
            setActionStatus("Refund processed successfully");
            setTimeout(() => setActionStatus(""), 3000);
          }}
        />
      )}

      {showVoidModal && (
        <VoidConfirmModal
          sale={sale}
          onClose={() => setShowVoidModal(false)}
          onSuccess={async () => {
            await Promise.all([fetchSaleById(), fetchReceivable()]);
            setActionStatus("Sale voided successfully");
            setTimeout(() => setActionStatus(""), 3000);
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline assignment dropdown
// ---------------------------------------------------------------------------

function AssignmentDropdown({
  value,
  users,
  loading,
  error,
  onPick,
  onCancel,
  showPropagate = false,
  propagateValue = false,
  onPropagateChange,
}) {
  const [localPropagate, setLocalPropagate] = useState(propagateValue);

  useEffect(() => {
    setLocalPropagate(propagateValue);
  }, [propagateValue]);

  const handleToggle = (checked) => {
    setLocalPropagate(checked);
    if (onPropagateChange) onPropagateChange(checked);
  };

  return (
    <div className="mt-2 rounded border border-zinc-200 bg-white p-2 shadow-sm">
      <select
        autoFocus
        defaultValue={value || ""}
        disabled={loading}
        onChange={(e) => onPick(e.target.value || null)}
        className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
      >
        <option value="">Unassigned</option>
        {users.map((u) => (
          <option key={u._id} value={u._id}>
            {u.fullname || u.email || u._id}
          </option>
        ))}
      </select>

      {showPropagate && (
        <label className="mt-2 flex items-start gap-2 text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={localPropagate}
            onChange={(e) => handleToggle(e.target.checked)}
            className="mt-0.5 h-3.5 w-3.5 rounded border-zinc-300"
          />
          <span>
            Also apply to service lines that don&apos;t have an attendant yet
          </span>
        </label>
      )}

      {loading && <p className="mt-1 text-xs text-zinc-500">Saving…</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}