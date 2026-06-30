"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
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

export default function UserCommissionBreakdown() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.userId;

  const can = useSessionStore((state) => state.can);
  const canView = can(PERMISSIONS.VIEW_REPORTS);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [salesData, setSalesData] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, total: 0, pages: 0 });
  const [userInfo, setUserInfo] = useState(null);
  const [startDate, setStartDate] = useState(getDefaultDateRange().startDate);
  const [endDate, setEndDate] = useState(getDefaultDateRange().endDate);
  const [locationId, setLocationId] = useState("");
  const [locations, setLocations] = useState([]);

  const loadLocations = useCallback(async () => {
    try {
      const res = await apiFetch("/locations?limit=100");
      const locs = res?.data || res?.locations || [];
      setLocations(locs);
    } catch (err) {
      console.error("Failed to load locations:", err);
    }
  }, []);

  const loadUserInfo = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiFetch(`/users/${userId}`);
      const user = res?.user || res?.data?.user || null;
      setUserInfo(user);
    } catch (err) {
      console.error("Failed to load user info:", err);
    }
  }, [userId]);

  const loadBreakdown = useCallback(async (page = 1) => {
    if (!userId || !startDate || !endDate) return;
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
      if (locationId) params.append("locationId", locationId);

      const res = await apiFetch(`/commissions?${params}`);
      const data = res?.data || {};
      setSalesData(data.sales || []);
      setPagination(data.pagination || { page: 1, limit: 50, total: 0, pages: 0 });
    } catch (err) {
      setError(err?.message || "Failed to load breakdown.");
      setSalesData([]);
    } finally {
      setLoading(false);
    }
  }, [userId, startDate, endDate, locationId]);

  const downloadCSV = () => {
    if (salesData.length === 0) return;
    const headers = ["Sale ID", "Date", "Receipt", "Total Commission", "Service Breakdown"];
    const rows = salesData.map((sale) => {
      const serviceStr = sale.serviceItems
        .map((svc) => `${svc.serviceName}: $${svc.commissionAmount.toFixed(2)}`)
        .join("; ");
      return [
        sale.saleId,
        new Date(sale.saleDate).toLocaleDateString(),
        sale.receiptNumber,
        sale.totalCommission.toFixed(2),
        serviceStr,
      ];
    });
    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `user_commission_${userId}_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (canView && userId) {
      loadLocations();
      loadUserInfo();
    }
  }, [canView, userId, loadLocations, loadUserInfo]);

  useEffect(() => {
    if (canView && userId) {
      loadBreakdown(1);
    }
  }, [canView, userId, loadBreakdown]);

  if (!canView) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Commission Breakdown</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view commissions.</p>
      </div>
    );
  }

  if (loading && !salesData.length) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Commission Breakdown</h1>
        <p className="text-sm text-zinc-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            Commission Breakdown
          </h1>
          {userInfo && (
            <p className="mt-1 text-sm text-zinc-600">
              {userInfo.fullname} ({userInfo.email})
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/sales-channels/pos/commissions")}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to Commissions
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div>
          <label className="block text-xs font-medium text-zinc-700">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-700">Location</label>
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc._id || loc.id} value={loc._id || loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => loadBreakdown(1)}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Apply Filters"}
        </button>
        <button
          type="button"
          onClick={downloadCSV}
          disabled={loading || salesData.length === 0}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Download CSV
        </button>
      </div>

      {/* Sales Table */}
      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : salesData.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
          No commission sales found for this user in the selected period.
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="py-3 pr-4">Sale ID</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Receipt</th>
                  <th className="py-3 pr-4">Total Commission</th>
                  <th className="py-3 pr-4">Service Breakdown</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {salesData.map((sale) => (
                  <tr key={sale.saleId} className="hover:bg-zinc-50">
                    <td className="py-3 pr-4 font-mono text-xs text-zinc-600">
                      {sale.saleId}
                    </td>
                    <td className="py-3 pr-4 text-zinc-600">
                      {new Date(sale.saleDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 pr-4 font-medium text-zinc-900">
                      {sale.receiptNumber}
                    </td>
                    <td className="py-3 pr-4 font-semibold text-blue-600">
                      ${sale.totalCommission.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="space-y-1">
                        {sale.serviceItems.map((svc, idx) => (
                          <div key={idx} className="text-xs text-zinc-600">
                            {svc.serviceName}: ${svc.commissionAmount.toFixed(2)}
                            <span className="text-[10px] text-zinc-400 ml-1">
                              ({svc.commissionType === "percentage" ? `${svc.commissionValue}%` : `$${svc.commissionValue.toFixed(2)}`})
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => loadBreakdown(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="rounded border border-zinc-300 px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-zinc-600">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                type="button"
                onClick={() => loadBreakdown(pagination.page + 1)}
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