"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

const formatMoney = (value) => Number(value || 0).toFixed(2);

const getCashierLabel = (cashier) => {
  if (!cashier) return "Cashier unavailable";
  if (typeof cashier === "object") {
    return cashier.fullname || cashier.email || cashier._id || "Cashier unavailable";
  }
  return cashier;
};

const getTransactionLabel = (transaction) => {
  if (transaction.type === "sale") return transaction.receiptNumber || "Sale";
  if (transaction.type === "expense") return transaction.category || "Expense";
  if (transaction.type === "delivery") return transaction.recipientName || "Delivery";
  return transaction._id;
};

const getTransactionDetails = (transaction) => {
  if (transaction.type === "sale") {
    return transaction.totalAmount;
  }
  if (transaction.type === "expense") {
    return transaction.amount;
  }
  if (transaction.type === "delivery") {
    return transaction.amount;
  }
  return 0;
};

export default function ReconciliationDetailPage() {
  const params = useParams();
  const can = useSessionStore((s) => s.can);
  const canView = can(PERMISSIONS.VIEW_FINANCIAL_REPORTS);
  const reconciliationId = params?.id;

  const [session, setSession] = useState(null);
  const [shiftTransactions, setShiftTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rowLoading, setRowLoading] = useState({});

  const transactions = useMemo(() => {
    return [...shiftTransactions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [shiftTransactions]);

  useEffect(() => {
    const loadDetail = async () => {
      if (!reconciliationId) return;
      setLoading(true);
      setError("");
      try {
        const sessionRes = await apiFetch(`/reconciliation/sessions/${reconciliationId}`);
        const reconciliationSession = sessionRes?.data || null;
        setSession(reconciliationSession);

        const shiftIds = reconciliationSession?.shiftSessionIds || [];
        if (shiftIds.length === 0) {
          setShiftTransactions([]);
          return;
        }

        const shiftResults = await Promise.all(
          shiftIds.map(async (shiftId) => {
            const response = await apiFetch(`/shift-sessions/${shiftId}/transactions?limit=100&type=all`);
            const shiftMeta = (reconciliationSession?.shiftBreakdown || []).find(
              (shift) => String(shift.shiftSessionId) === String(shiftId),
            );
            return (response?.data?.transactions || []).map((transaction) => ({
              ...transaction,
              shiftSessionId: shiftId,
              shiftCode: shiftMeta?.shiftCode || shiftId,
            }));
          }),
        );

        setShiftTransactions(shiftResults.flat());
      } catch (err) {
        setError(err?.message || "Failed to load reconciliation detail");
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [reconciliationId]);

  const offline = useMemo(() => typeof navigator !== "undefined" && !navigator.onLine, []);
  const canManage = can(PERMISSIONS.MANAGE_FINANCE);

  const fetchShiftTransactions = async (shiftId) => {
    try {
      const response = await apiFetch(`/shift-sessions/${shiftId}/transactions?limit=100&type=all`);
      return (response?.data?.transactions || []).map((transaction) => ({
        ...transaction,
        shiftSessionId: shiftId,
      }));
    } catch (err) {
      console.warn("Failed to fetch shift transactions", err);
      return [];
    }
  };

  const validateTransaction = async (transaction) => {
    if (!canManage || offline) return;
    const id = transaction._id;
    setRowLoading((s) => ({ ...s, [id]: true }));
    try {
      await apiFetch(`/transactions/${id}/validate`, { method: "POST", body: {} });
      const updated = await fetchShiftTransactions(transaction.shiftSessionId);
      setShiftTransactions((prev) => [...prev.filter((t) => String(t.shiftSessionId) !== String(transaction.shiftSessionId)), ...updated]);
    } catch (err) {
      console.error("Validate failed", err);
      setError(err?.message || "Failed to validate transaction");
    } finally {
      setRowLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const disputeTransaction = async (transaction) => {
    if (!canManage || offline) return;
    const reason = typeof window !== "undefined" ? window.prompt("Enter dispute reason:") : "";
    if (!reason) return;
    const id = transaction._id;
    setRowLoading((s) => ({ ...s, [id]: true }));
    try {
      await apiFetch(`/transactions/${id}/dispute`, { method: "POST", body: { reason } });
      const updated = await fetchShiftTransactions(transaction.shiftSessionId);
      setShiftTransactions((prev) => [...prev.filter((t) => String(t.shiftSessionId) !== String(transaction.shiftSessionId)), ...updated]);
    } catch (err) {
      console.error("Dispute failed", err);
      setError(err?.message || "Failed to dispute transaction");
    } finally {
      setRowLoading((s) => ({ ...s, [id]: false }));
    }
  };

  if (!canView) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Reconciliation detail</h1>
        <p className="text-sm text-zinc-600">You don&apos;t have permission to view financial reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Reconciliation detail</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Transactions inside the shift sessions covered by this day check.
          </p>
        </div>
        <Link
          href="/dashboard/sales-channels/pos/reconciliation"
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to list
        </Link>
      </div>

      {session ? (
        <div className="grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm md:grid-cols-4">
          <div>
            <div className="text-xs uppercase text-zinc-500">Session</div>
            <div className="font-medium text-zinc-900">{session.sessionCode}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-500">Window</div>
            <div className="font-medium text-zinc-900">
              {new Date(session.windowStart).toLocaleDateString()} - {new Date(session.windowEnd).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-500">Shifts</div>
            <div className="font-medium text-zinc-900">{(session.shiftSessionIds || []).length}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-zinc-500">Status</div>
            <div className="font-medium text-zinc-900">{session.status}</div>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-sm">
          Loading transactions...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          {(session?.shiftBreakdown || []).map((shift) => {
            const rows = transactions.filter((transaction) => String(transaction.shiftSessionId) === String(shift.shiftSessionId));
            return (
              <div key={shift.shiftSessionId} className="rounded-lg border border-zinc-200 bg-white shadow-sm">
                <div className="border-b border-zinc-200 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-zinc-900">{shift.shiftCode}</div>
                      <div className="text-xs text-zinc-500">
                        {`Cashier: ${getCashierLabel(shift.cashierId)}`}
                        {shift.openedAt ? ` · Opened ${new Date(shift.openedAt).toLocaleString()}` : ""}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500">{rows.length} transactions</div>
                  </div>
                </div>

                {rows.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-zinc-500">No transactions were found for this shift.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-600">
                        <tr>
                          <th className="px-4 py-3">Type</th>
                          <th className="px-4 py-3">Reference</th>
                          <th className="px-4 py-3">Amount</th>
                          <th className="px-4 py-3">Validation</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((transaction) => (
                          <tr key={`${transaction.type}-${transaction._id}`} className="border-t border-zinc-100">
                            <td className="px-4 py-3 capitalize">{transaction.type}</td>
                            <td className="px-4 py-3">{getTransactionLabel(transaction)}</td>
                            <td className="px-4 py-3">{formatMoney(getTransactionDetails(transaction))}</td>
                            <td className="px-4 py-3 capitalize">{transaction.validationStatus || "pending"}</td>
                            <td className="px-4 py-3">{new Date(transaction.createdAt).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              {canManage && transaction.validationStatus === "pending" ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    className="rounded bg-green-600 px-2 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                                    onClick={() => validateTransaction(transaction)}
                                    disabled={!!rowLoading[transaction._id] || offline}
                                  >
                                    {rowLoading[transaction._id] ? "..." : "Validate"}
                                  </button>
                                  <button
                                    className="rounded border border-rose-600 px-2 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                                    onClick={() => disputeTransaction(transaction)}
                                    disabled={!!rowLoading[transaction._id] || offline}
                                  >
                                    Dispute
                                  </button>
                                </div>
                              ) : (
                                <div className="text-xs text-zinc-500">—</div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {session && (session.shiftBreakdown || []).length === 0 ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-500 shadow-sm">
          This reconciliation session does not include any shift breakdown data yet.
        </div>
      ) : null}
    </div>
  );
}
