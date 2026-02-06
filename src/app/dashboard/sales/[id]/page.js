"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";

export default function SaleDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { permissions } = useSessionStore();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canViewSalesHistory = permissions?.includes(PERMISSIONS.VIEW_SALE_HISTORY);

  useEffect(() => {
    if (!canViewSalesHistory) {
      setLoading(false);
      return;
    }

    const fetchSale = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/sales/${params.id}`);

        // Handle different response structures
        const saleData = response?.data || response;
        if (saleData) {
          setSale(saleData);
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

    fetchSale();
  }, [params.id, canViewSalesHistory]);

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
          <button className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
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

      {/* Main Content */}
      <div className="space-y-6">
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
              <span className={`rounded-full border px-3 py-1 text-sm font-medium capitalize ${getSyncStatusColor(sale.shopifySyncStatus)}`}>
                Shopify: {sale.shopifySyncStatus}
              </span>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
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
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">COMPLETED AT</p>
              <p className="mt-1 text-sm text-zinc-900">
                {sale.completedAt ? formatDateOnly(sale.completedAt) : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Items Section */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Items</h2>
          <div className="divide-y divide-zinc-200">
            {sale.items?.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between border-b border-zinc-200 py-4 last:border-b-0">
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

        <div className="grid gap-6 lg:grid-cols-3">
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
              <div className="border-t border-zinc-200 pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-zinc-900">Total</span>
                  <span className="text-lg font-bold text-zinc-900">{formatCurrency(sale.totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Payment</h2>
            <div className="space-y-3">
              {sale.payments?.map((payment, idx) => (
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
              ))}
            </div>
          </div>

          {/* Customer Section */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Customer</h2>
            {sale.customerName || sale.customerEmail || sale.customerPhone ? (
              <div className="space-y-2 text-sm">
                {sale.customerName && <p className="font-medium text-zinc-900">{sale.customerName}</p>}
                {sale.customerEmail && <p className="text-zinc-600">{sale.customerEmail}</p>}
                {sale.customerPhone && <p className="text-zinc-600">{sale.customerPhone}</p>}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No customer information</p>
            )}
          </div>
        </div>

        {/* Notes Section */}
        {sale.notes && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Notes</h2>
            <p className="text-sm text-zinc-600">{sale.notes}</p>
          </div>
        )}

        {/* Refund History */}
        {sale.refundHistory?.length > 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Refund History</h2>
            <div className="space-y-4">
              {sale.refundHistory.map((refund, idx) => (
                <div key={idx} className="border-b border-zinc-200 pb-4 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-zinc-900">{formatCurrency(refund.amount)}</p>
                    <p className="text-xs text-zinc-500">{formatDate(refund.refundedAt)}</p>
                  </div>
                  {refund.reason && <p className="text-sm text-zinc-600">Reason: {refund.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
