"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";

/**
 * Modal shown while the POS waits for the customer to enter their M-Pesa PIN.
 * Polls /sales/:id/payment-status every 3s.
 *
 * Props:
 *   open        boolean
 *   saleId      string
 *   phone       string  — formatted phone for display
 *   amount      number
 *   onSuccess   (receiptNumber?) => void   — cart clears, print receipt
 *   onCancel    () => void                 — DELETE /:id/pending, restore cart
 *   onManualPaid(reference) => void        — mark-paid-manual
 */
export function MpesaStkWaitingModal({
  open,
  saleId,
  phone,
  amount,
  onSuccess,
  onCancel,
  onManualPaid,
}) {
  const [status, setStatus] = useState("waiting"); // waiting | error | manual
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [marking, setMarking] = useState(false);
  const pollRef = useRef(null);

  // Polling loop
  useEffect(() => {
    if (!open || !saleId) return;
    if (status !== "waiting") return;

    const tick = async () => {
      try {
        const res = await apiFetch(`/sales/${saleId}/payment-status`);
        if (res?.paymentStatus === "completed") {
          setStatus("success");
          onSuccess?.(res?.mpesaReceiptNumber || null);
        } else if (res?.paymentStatus === "failed") {
          setStatus("error");
          setError("Payment was declined or failed. Retry or mark as paid.");
        }
      } catch (e) {
        // Ignore transient polling errors — the modal stays in "waiting"
      }
    };

    pollRef.current = setInterval(tick, 3000);
    // Fire once immediately so we don't wait 3s for the first check
    tick();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [open, saleId, status, onSuccess]);

  // Reset internal state when the modal opens fresh
  useEffect(() => {
    if (open) {
      setStatus("waiting");
      setError("");
      setReference("");
    }
  }, [open, saleId]);

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      await apiFetch(`/sales/${saleId}/pending`, { method: "DELETE" });
      onCancel?.();
    } catch (e) {
      setError(e?.message || "Failed to cancel — try again");
      setCancelling(false);
    }
  };

  const handleManualPaid = async () => {
    if (marking) return;
    setMarking(true);
    setError("");
    try {
      await apiFetch(`/sales/${saleId}/mpesa-stk/mark-paid`, {
        method: "POST",
        body: { reference: reference.trim() || undefined },
      });
      onManualPaid?.(reference.trim() || null);
    } catch (e) {
      setError(e?.message || "Failed to mark as paid");
      setMarking(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Waiting for M-Pesa
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Customer should receive an STK prompt on their phone.
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="rounded-lg bg-gray-50 p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-gray-500">
              Phone
            </p>
            <p className="mt-1 text-lg font-mono font-semibold text-gray-900">
              {phone || "—"}
            </p>
            <p className="mt-3 text-xs uppercase tracking-wide text-gray-500">
              Amount
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              KES {Number(amount || 0).toFixed(2)}
            </p>
          </div>

          {status === "waiting" && (
            <div className="flex items-center justify-center gap-3 py-2">
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              <span className="text-sm text-gray-700">
                Waiting for customer to enter PIN…
              </span>
            </div>
          )}

          {status === "error" && error && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {status === "manual" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                M-Pesa reference (optional)
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="e.g. RJ12ABC34D"
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-gray-500">
                The customer reads this off their M-Pesa SMS. It's recorded
                against the sale for reconciliation.
              </p>
            </div>
          )}

          {error && status !== "error" && (
            <div className="rounded border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4 space-y-2">
          {status === "manual" ? (
            <>
              <button
                type="button"
                onClick={handleManualPaid}
                disabled={marking}
                className="w-full rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {marking ? "Marking…" : "Confirm paid"}
              </button>
              <button
                type="button"
                onClick={() => setStatus("waiting")}
                disabled={marking}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back to waiting
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStatus("manual")}
                className="w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 hover:bg-blue-100"
              >
                Mark as paid manually
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel — keep cart"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}