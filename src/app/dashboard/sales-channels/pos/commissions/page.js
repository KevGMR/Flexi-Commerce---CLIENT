"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

const getDefaultDateRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
};

export default function CommissionsPage() {
  const router = useRouter();
  const can = useSessionStore((state) => state.can);
  const canView = can(PERMISSIONS.VIEW_REPORTS);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usersData, setUsersData] = useState([]);
  const [totals, setTotals] = useState({ totalCommission: 0, totalUsers: 0 });
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

  const loadCommissions = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
      });
      if (locationId) params.append("locationId", locationId);

      const res = await apiFetch(`/commissions?${params}`);
      const data = res?.data || {};
      setUsersData(data.users || []);
      setTotals(data.totals || { totalCommission: 0, totalUsers: 0 });
    } catch (err) {
      setError(err?.message || "Failed to load commissions.");
      setUsersData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, locationId]);

  useEffect(() => {
    if (canView) {
      loadLocations();
    }
  }, [canView, loadLocations]);

  useEffect(() => {
    if (canView) {
      loadCommissions();
    }
  }, [canView, loadCommissions]);

  if (!canView) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Commissions</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view commissions.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Commissions</h1>
          <p className="mt-1 text-sm text-zinc-600">
            View commission earnings by user and service.
          </p>
        </div>
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
          onClick={loadCommissions}
          disabled={loading}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Apply Filters"}
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Total Commission</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">
            ${totals.totalCommission.toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Users with Commission</div>
          <div className="mt-2 text-2xl font-semibold text-zinc-900">
            {totals.totalUsers}
          </div>
        </div>
      </div>

      {/* User Table */}
      {loading ? (
        <div className="py-8 text-center text-sm text-zinc-500">Loading commissions...</div>
      ) : error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : usersData.length === 0 ? (
        <div className="rounded border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
          No commission data found for the selected period.
        </div>
      ) : (
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="py-3 pr-4">User</th>
                  <th className="py-3 pr-4">Total Commission</th>
                  <th className="py-3 pr-4"># Sales</th>
                  <th className="py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {usersData.map((item) => (
                  <tr key={item.userId} className="hover:bg-zinc-50">
                    <td className="py-3 pr-4 font-medium text-zinc-900">
                      {item.user?.fullname || "Unknown User"}
                      <div className="text-xs text-zinc-500">{item.user?.email}</div>
                    </td>
                    <td className="py-3 pr-4 font-semibold text-blue-600">
                      ${item.totalCommission.toFixed(2)}
                    </td>
                    <td className="py-3 pr-4 text-zinc-600">{item.salesCount}</td>
                    <td className="py-3 pr-4">
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/sales-channels/pos/commissions/${item.userId}`)}
                        className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        View Breakdown
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}