"use client";

import React, { useState } from "react";
import { apiFetch } from "@/lib/api-client";

export default function PreviousShiftBlockModal({
  isOpen,
  shift,
  onRecheck,
  onOpenShiftSessions,
}) {
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [closingCash, setClosingCash] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !shift) return null;

  const openedAt = shift.openedAt ? new Date(shift.openedAt).toLocaleString() : "Unknown";

  const fetchPreview = async () => {
    setError(null);
    setPreviewLoading(true);
    try {
      const data = await apiFetch(`/shift-sessions/${shift._id}/preview`);
      setPreviewData(data?.data || null);
      setClosingCash((data?.data?.expectedClosingCash || 0).toFixed?.(2) || "");
    } catch (err) {
      setError(err?.details?.message || err.message || "Failed to fetch preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const submitClose = async () => {
    setError(null);
    setClosingLoading(true);
    try {
      const body = { closingCash: Number(closingCash || 0), notes: "Closed from POS after overnight block" };
      await apiFetch(`/shift-sessions/${shift._id}/close`, { method: "POST", body });
      // trigger parent to re-check state
      onRecheck && onRecheck();
    } catch (err) {
      setError(err?.details?.message || err.message || "Failed to close shift");
    } finally {
      setClosingLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-amber-200 bg-white shadow-2xl">
        <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50 via-white to-orange-50 px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-2xl">
              ⛔
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-semibold text-slate-900">Previous shift is still open</h2>
              <p className="mt-1 text-sm text-slate-600">
                Close the previous day's shift before creating sales, delivery charges, or cash expenses.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 px-6 py-5">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Shift code</span>
              <span className="mt-1 block font-medium text-slate-900">{shift.shiftCode || shift._id}</span>
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Opened at</span>
              <span className="mt-1 block font-medium text-slate-900">{openedAt}</span>
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Opening cash</span>
              <span className="mt-1 block font-medium text-slate-900">
                {typeof shift.openingCash === "number" ? shift.openingCash.toFixed(2) : "0.00"}
              </span>
            </div>
            <div>
              <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">Current status</span>
              <span className="mt-1 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Open</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            The POS is blocked until this shift is closed. If you already closed it in another tab or on another device, use re-check.
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
          ) : null}

          {previewData ? (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">Expected cash sales</div>
                  <div className="text-lg font-medium">{(previewData.expectedCashSales || 0).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Expected closing cash</div>
                  <div className="text-lg font-medium">{(previewData.expectedClosingCash || 0).toFixed(2)}</div>
                </div>
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="flex w-full flex-col text-sm">
                  <span className="text-xs text-slate-500">Closing cash</span>
                  <input
                    type="number"
                    step="0.01"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    className="mt-1 rounded-md border px-3 py-2"
                  />
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={submitClose}
                    disabled={closingLoading}
                    className="ml-auto inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {closingLoading ? "Closing..." : "Close previous shift"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onOpenShiftSessions}
                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Open shift sessions
              </button>
              <button
                type="button"
                onClick={onRecheck}
                className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Re-check after closing
              </button>
              <button
                type="button"
                onClick={fetchPreview}
                className="ml-auto inline-flex items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
              >
                {previewLoading ? "Checking..." : "Preview & close here"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}