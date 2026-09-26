"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0);

export default function VoidConfirmModal({ sale, onClose, onSuccess }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!reason.trim()) {
      setError("Void reason is required");
      return;
    }

    try {
      setSubmitting(true);
      await apiFetch(`/sales/${sale._id}/void`, {
        method: "POST",
        body: { reason: reason.trim() },
      });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to void sale");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-zinc-200 p-6">
          <h2 className="text-xl font-bold text-red-900">Void this sale?</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-800 space-y-2">
            <p className="font-semibold">This action will:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Reverse inventory for <strong>all items</strong> on this sale
              </li>
              <li>Mark the sale as voided</li>
              <li>
                Leave total {formatCurrency(sale?.totalAmount)} as a
                permanent record
              </li>
            </ul>
            <p className="text-xs pt-2">
              Cannot be undone. For partial reversals, use Refund instead.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">
              Reason <span className="text-red-600">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Test sale, duplicate entry, customer dispute"
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
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
              disabled={submitting || !reason.trim()}
              className="flex-1 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Voiding…" : "Void sale"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}