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

export default function MyCommissionsPage() {
  const can = useSessionStore((s) => s.can);
  const canView = can(PERMISSIONS.VIEW_OWN_COMMISSIONS);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [salesData, setSalesData] = useState([]);
  const [totals, setTotals] = useState({
    totalCommission: 0,
    serviceCount: 0,
    salesCount: 0,
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    pages: 0,
  });
  const [{ startDate, endDate }, setDateRange] = useState(getDefaultDateRange);

  const load = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          startDate,
          endDate,
          page: String(page),
          limit: "50",
        });
        const res = await apiFetch(`/commissions/me?${params.toString()}`);
        const data = res?.data || {};
        setSalesData(data.sales || []);
        setPagination(
          data.pagination || { page: 1, limit: 50, total: 0, pages: 0 },
        );
        setTotals(
          data.totals || {
            totalCommission: 0,
            serviceCount: 0,
            salesCount: 0,
          },
        );
      } catch (err) {
        setError(err?.message || "Failed to load commissions.");
        setSalesData([]);
      } finally {
        setLoading(false);
      }
    },
    [startDate, endDate],
  );

  useEffect(() => {
    if (canView) load(1);
  }, [canView, load]);

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">My commissions</h1>
        <p className="mt-2 text-sm text-zinc-600">
          You don't have permission to view your commissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">My commissions</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Earnings from services you were assigned.
        </p>
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
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
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
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => load(1)}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading…" : "Apply"}
        </button>
      </div>

      {/* Totals */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Total earned
          </div>
          <div className="mt-2 text-2xl font-semibold text-blue-600">
            KES {totals.totalCommission.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Services
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">
            {totals.serviceCount}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Sales
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">
            {totals.salesCount}
          </div>
        </div>
      </div>

      {/* Sales table */}
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {salesData.length === 0 && !loading && (
        <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
          No commissions for the selected period.
        </div>
      )}

      {salesData.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="divide-y divide-zinc-100">
            {salesData.map((sale) => (
              <div key={sale.saleId} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-zinc-900">
                      {sale.receiptNumber}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {new Date(sale.saleDate).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-blue-600">
                    KES {sale.totalCommission.toFixed(2)}
                  </p>
                </div>
                <ul className="mt-2 space-y-1">
                  {sale.serviceItems.map((svc, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between text-xs text-zinc-600"
                    >
                      <span>
                        {svc.serviceName}
                        {svc.quantityRefunded > 0 && (
                          <span className="ml-1 text-orange-600">
                            ({svc.quantityRefunded} refunded)
                          </span>
                        )}
                      </span>
                      <span>KES {svc.commissionAmount.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {pagination.pages > 1 && (
            <div className="flex items-center justify-between border-t border-zinc-200 p-3">
              <button
                type="button"
                onClick={() => load(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs text-zinc-600">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                type="button"
                onClick={() => load(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}