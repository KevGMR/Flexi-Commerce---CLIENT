"use client";

import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

const getDefaultDateRange = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    startDate: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
  };
};

export default function ManagerCommissionsPage() {
  const can = useSessionStore((s) => s.can);
  const hydrated = useSessionStore((s) => s.hydrated);
  const canView = can(PERMISSIONS.VIEW_REPORTS);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Summary view (no userId)
  const [summaryRows, setSummaryRows] = useState([]);
  const [summaryTotals, setSummaryTotals] = useState({
    totalCommission: 0,
    totalUsers: 0,
  });

  // Drill-down view (userId set)
  const [drillUserId, setDrillUserId] = useState(null);
  const [drillUserName, setDrillUserName] = useState("");
  const [drillSales, setDrillSales] = useState([]);
  const [drillPagination, setDrillPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });

  const [{ startDate, endDate }, setDateRange] = useState(getDefaultDateRange);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ startDate, endDate });
      const res = await apiFetch(`/commissions?${params.toString()}`);
      const data = res?.data || {};
      setSummaryRows(data.users || []);
      setSummaryTotals(
        data.totals || { totalCommission: 0, totalUsers: 0 },
      );
    } catch (err) {
      setError(err?.message || "Failed to load commissions.");
      setSummaryRows([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  const loadDrill = useCallback(
    async (userId, page = 1) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          startDate,
          endDate,
          userId,
          page: String(page),
          limit: "50",
        });
        const res = await apiFetch(`/commissions?${params.toString()}`);
        const data = res?.data || {};
        setDrillSales(data.sales || []);
        setDrillPagination(
          data.pagination || { page: 1, limit: 50, total: 0, pages: 0 },
        );
      } catch (err) {
        setError(err?.message || "Failed to load attendant commissions.");
        setDrillSales([]);
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    if (hydrated && canView && !drillUserId) loadSummary();
  }, [hydrated, canView, drillUserId, loadSummary]);

  const openDrill = (row) => {
    const id = row.user?._id || row.userId;
    setDrillUserId(String(id));
    setDrillUserName(row.user?.fullname || row.user?.email || "Attendant");
    loadDrill(String(id), 1);
  };

  const closeDrill = () => {
    setDrillUserId(null);
    setDrillUserName("");
    setDrillSales([]);
    setDrillPagination({ page: 1, limit: 50, total: 0, pages: 0 });
    loadSummary();
  };

  const formatKES = (amount) => {
    const n = Number(amount) || 0;
    return `KES ${n.toFixed(2)}`;
  };

  if (!hydrated) {
    return (
      <div className="p-6">
        <p className="text-sm text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Commissions
        </h1>
        <p className="mt-2 text-sm text-zinc-600">
          You don't have permission to view commissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {drillUserId ? (
            <button
              type="button"
              onClick={closeDrill}
              className="mb-1 text-sm text-zinc-500 hover:text-zinc-900"
            >
              ← All attendants
            </button>
          ) : null}
          <h1 className="text-2xl font-semibold text-zinc-900">
            {drillUserId
              ? `Commissions · ${drillUserName}`
              : "Commissions"}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            {drillUserId
              ? "Per-sale commission breakdown for this attendant."
              : "Commissions earned by every attendant in the selected period."}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            From
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) =>
              setDateRange((p) => ({ ...p, startDate: e.target.value }))
            }
            disabled={Boolean(drillUserId)}
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">
            To
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) =>
              setDateRange((p) => ({ ...p, endDate: e.target.value }))
            }
            disabled={Boolean(drillUserId)}
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm disabled:bg-zinc-50"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            drillUserId ? loadDrill(drillUserId, 1) : loadSummary()
          }
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Apply"}
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Summary view */}
      {!drillUserId && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Total commissions
              </div>
              <div className="mt-2 text-2xl font-semibold text-blue-600">
                {formatKES(summaryTotals.totalCommission)}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {startDate} → {endDate}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                Attendants
              </div>
              <div className="mt-2 text-2xl font-semibold text-zinc-900">
                {summaryTotals.totalUsers}
              </div>
            </div>
          </div>

          {loading && summaryRows.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              Loading…
            </div>
          ) : summaryRows.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
              No commissions for the selected period.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      Attendant
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Sales
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      Total commission
                    </th>
                    <th className="px-4 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {summaryRows.map((row) => {
                    const id = row.user?._id || row.userId;
                    const name =
                      row.user?.fullname ||
                      row.user?.email ||
                      String(id);
                    return (
                      <tr
                        key={String(id)}
                        className="hover:bg-zinc-50"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900">
                            {name}
                          </div>
                          {row.user?.email && (
                            <div className="text-xs text-zinc-500">
                              {row.user.email}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-700">
                          {row.salesCount ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-zinc-900">
                          {formatKES(row.totalCommission)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openDrill(row)}
                            className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-white"
                          >
                            View →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Drill-down view */}
      {drillUserId && (
        <>
          {loading && drillSales.length === 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500">
              Loading…
            </div>
          ) : drillSales.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
              No commissions for this attendant in the selected period.
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="divide-y divide-zinc-100">
                {drillSales.map((sale) => (
                  <div key={sale.saleId} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium text-zinc-900">
                          {sale.receiptNumber}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {new Date(sale.saleDate).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-blue-600">
                        {formatKES(sale.totalCommission)}
                      </p>
                    </div>
                    <ul className="mt-3 space-y-1">
                      {(sale.serviceItems || []).map((svc, idx) => (
                        <li
                          key={idx}
                          className="flex justify-between text-xs text-zinc-600"
                        >
                          <span>{svc.serviceName}</span>
                          <span className="font-medium text-zinc-900">
                            {formatKES(svc.commissionAmount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {drillPagination.pages > 1 && (
                <div className="flex items-center justify-between border-t border-zinc-200 p-3">
                  <button
                    type="button"
                    onClick={() =>
                      loadDrill(drillUserId, drillPagination.page - 1)
                    }
                    disabled={drillPagination.page === 1 || loading}
                    className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-zinc-600">
                    Page {drillPagination.page} of {drillPagination.pages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      loadDrill(drillUserId, drillPagination.page + 1)
                    }
                    disabled={
                      drillPagination.page === drillPagination.pages ||
                      loading
                    }
                    className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}