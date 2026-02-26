"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
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
  const [paymentForm, setPaymentForm] = useState({
    method: "cash",
    amount: "",
    reference: "",
    cardLast4: "",
    cardBrand: "",
    notes: "",
  });

  const canViewSalesHistory = permissions?.includes(PERMISSIONS.VIEW_SALE_HISTORY);
  const canCreateDeliveryFees = permissions?.includes(PERMISSIONS.DELIVERY_FEES_CREATE);
  const canCollectPayment = permissions?.includes(PERMISSIONS.CREATE_SALE);

  const fetchSaleById = async () => {
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
  };

  const fetchReceivable = async () => {
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
  };

  useEffect(() => {
    if (!canViewSalesHistory) {
      setLoading(false);
      return;
    }

    fetchSaleById();
  }, [params.id, canViewSalesHistory]);

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
  }, [sale?._id]);

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


  if (!canViewSalesHistory) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Sale Details</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view sale details.</p>
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

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Go Back
        </button>
        <div className="flex gap-2">
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
                <h1 className="text-3xl font-bold text-zinc-900">{sale.receiptNumber}</h1>
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
            )}

            <div className="space-y-3">
              {sale.payments?.length > 0 ? (
                sale.payments.map((payment, idx) => (
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

      {/* Create Delivery Modal */}
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
    </div>
  );
}
