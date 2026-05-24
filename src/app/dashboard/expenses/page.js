"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function ExpensesPage() {
  const can = useSessionStore((s) => s.can);
  const locationsMeta = useSessionStore((s) => s.locationsMeta);
  const selectedLocationId = useSessionStore((s) => s.selectedLocationId);

  const canView = can(PERMISSIONS.VIEW_EXPENSES);
  const canCreate = can(PERMISSIONS.CREATE_EXPENSES);
  const canManageWorkflow = can(PERMISSIONS.MANAGE_FINANCE);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expenses, setExpenses] = useState([]);

  const [filters, setFilters] = useState({
    locationId: selectedLocationId || "",
    status: "",
    paymentStatus: "",
    category: "",
  });

  const locationNameById = useMemo(() => {
    const map = new Map();
    (locationsMeta || []).forEach((loc) => map.set(loc._id, loc.name));
    return map;
  }, [locationsMeta]);

  const loadExpenses = useCallback(async () => {
    if (!canView) return;

    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams();
      if (filters.locationId) query.set("locationId", filters.locationId);
      if (filters.status) query.set("status", filters.status);
      if (filters.paymentStatus) query.set("paymentStatus", filters.paymentStatus);
      if (filters.category) query.set("category", filters.category.trim());

      const result = await apiFetch(`/expenses?${query.toString()}`);
      setExpenses(result?.data?.items || []);
    } catch (err) {
      setError(err?.message || "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [canView, filters]);

  const runWorkflowAction = useCallback(
    async (expense, action) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("Expense workflow actions are online-only.");
        return;
      }

      setError("");
      try {
        if (action === "submit") {
          await apiFetch(`/expenses/${expense._id}/submit`, {
            method: "POST",
          });
        }

        if (action === "approve") {
          await apiFetch(`/expenses/${expense._id}/approve`, {
            method: "POST",
            body: {
              notes: "Approved from expenses list",
            },
          });
        }

        if (action === "reject") {
          const reason = window.prompt("Reason for rejection:");
          if (!reason) return;
          await apiFetch(`/expenses/${expense._id}/reject`, {
            method: "POST",
            body: {
              reason,
              notes: "Rejected from expenses list",
            },
          });
        }

        await loadExpenses();
      } catch (err) {
        setError(err?.message || "Failed to update expense workflow");
      }
    },
    [loadExpenses]
  );

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  if (!canView) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Expenses</h1>
        <p className="text-sm text-zinc-600">You don&apos;t have permission to view expenses.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Expenses</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Review expenses by location, status, and payment state.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/dashboard/expenses/create"
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Create Expense
          </Link>
        ) : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <select
            value={filters.locationId}
            onChange={(e) => setFilters((prev) => ({ ...prev, locationId: e.target.value }))}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">All locations</option>
            {(locationsMeta || []).map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filters.paymentStatus}
            onChange={(e) => setFilters((prev) => ({ ...prev, paymentStatus: e.target.value }))}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">All payment states</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
          </select>

          <input
            value={filters.category}
            onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="Category"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={loadExpenses}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Apply Filters
          </button>
          <button
            onClick={() => {
              setFilters({ locationId: selectedLocationId || "", status: "", paymentStatus: "", category: "" });
              setTimeout(loadExpenses, 0);
            }}
            className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Reset
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800">
          Expense Entries
        </div>

        {loading ? (
          <div className="p-4 text-sm text-zinc-500">Loading expenses...</div>
        ) : expenses.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No expenses found for the selected filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-600">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr key={expense._id} className="border-t border-zinc-100">
                    <td className="px-4 py-3 text-zinc-700">
                      {new Date(expense.expenseDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-900">{expense.category}</td>
                    <td className="px-4 py-3 text-zinc-700">{expense.description}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {locationNameById.get(expense.locationId) || "-"}
                    </td>
                    <td className="px-4 py-3 text-zinc-900">
                      {Number(expense.amount || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-zinc-700">{expense.status}</td>
                    <td className="px-4 py-3 text-zinc-700">{expense.paymentStatus}</td>
                    <td className="px-4 py-3 text-zinc-700">
                      {canManageWorkflow ? (
                        <div className="flex gap-2">
                          {expense.status === "draft" ? (
                            <button
                              onClick={() => runWorkflowAction(expense, "submit")}
                              className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                            >
                              Submit
                            </button>
                          ) : null}
                          {expense.status === "submitted" ? (
                            <>
                              <button
                                onClick={() => runWorkflowAction(expense, "approve")}
                                className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => runWorkflowAction(expense, "reject")}
                                className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium hover:bg-zinc-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
