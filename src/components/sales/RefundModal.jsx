"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";

const RETURN_REASONS = [
  { value: "customer-request", label: "Customer Request" },
  { value: "defective-product", label: "Defective Product" },
  { value: "wrong-item", label: "Wrong Item Shipped/Given" },
  { value: "price-adjustment", label: "Price Adjustment" },
  { value: "damaged", label: "Item Damaged" },
];

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);

export default function RefundModal({ sale, onClose, onSuccess }) {
  const items = Array.isArray(sale?.items) ? sale.items : [];

  // Build initial refundable rows: { index, quantity, maxQuantity }
  const initialRows = useMemo(() => {
    return items
      .map((item, index) => {
        const alreadyRefunded = Number(item.quantityRefunded || 0);
        const maxQuantity = Math.max(0, Number(item.quantity || 0) - alreadyRefunded);
        return { index, quantity: 0, maxQuantity };
      })
      .filter((r) => r.maxQuantity > 0);
  }, [items]);

  const [rows, setRows] = useState(initialRows);
  const [reason, setReason] = useState("customer-request");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const setRowQuantity = (index, value) => {
    const row = rows.find((r) => r.index === index);
    if (!row) return;
    const qty = Math.max(0, Math.min(Number(value) || 0, row.maxQuantity));
    setRows((prev) =>
      prev.map((r) => (r.index === index ? { ...r, quantity: qty } : r)),
    );
  };

  const selectedRows = rows.filter((r) => r.quantity > 0);

  const refundTotal = selectedRows.reduce((sum, r) => {
    const item = items[r.index];
    const unit = Number(item?.unitPrice || 0);
    return sum + unit * r.quantity;
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (selectedRows.length === 0) {
      setError("Select at least one item to refund");
      return;
    }
    if (!reason) {
      setError("Select a refund reason");
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch(`/sales/${sale._id}/refund`, {
        method: "POST",
        body: {
          items: selectedRows.map((r) => ({
            itemIndex: r.index,
            quantity: r.quantity,
          })),
          reason,
          notes: notes.trim() || undefined,
        },
      });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to process refund");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg bg-white shadow-xl">
        <div className="border-b border-zinc-200 p-6">
          <h2 className="text-2xl font-bold text-zinc-900">Refund sale</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Receipt #{sale?.receiptNumber} · {formatCurrency(sale?.totalAmount)}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto p-6 space-y-5">
            {error && (
              <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <h3 className="mb-3 text-sm font-semibold text-zinc-900">
                Items to refund
              </h3>
              {rows.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  All items on this sale have already been refunded.
                </p>
              ) : (
                <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
                  {rows.map((row) => {
                    const item = items[row.index];
                    return (
                      <div
                        key={row.index}
                        className="flex items-center gap-4 p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-900 truncate">
                            {item.productName || item.sku || "Unnamed item"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {formatCurrency(item.unitPrice || 0)} each ·{" "}
                            {item.quantity} purchased
                            {Number(item.quantityRefunded || 0) > 0 && (
                              <> · {item.quantityRefunded} already refunded</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-zinc-500">Refund qty</label>
                          <input
                            type="number"
                            min="0"
                            max={row.maxQuantity}
                            step="1"
                            value={row.quantity}
                            onChange={(e) =>
                              setRowQuantity(row.index, e.target.value)
                            }
                            className="w-20 rounded border border-zinc-300 px-2 py-1 text-sm text-right"
                          />
                          <span className="text-xs text-zinc-400">
                            / {row.maxQuantity}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Reason
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              >
                {RETURN_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">
                Notes (optional)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="rounded-lg bg-zinc-50 p-4 flex justify-between items-center">
              <span className="text-sm font-medium text-zinc-700">
                Refund total
              </span>
              <span className="text-lg font-bold text-zinc-900">
                {formatCurrency(refundTotal)}
              </span>
            </div>
          </div>

          <div className="border-t border-zinc-200 p-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || selectedRows.length === 0}
              className="flex-1 rounded bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? "Processing…" : "Process refund"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}