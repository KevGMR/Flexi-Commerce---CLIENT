"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";
import { apiFetch } from "@/lib/api-client";

export default function BackdateHistoryPage() {
  const router = useRouter();
  const { can } = useSessionStore();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  
  if (hydrated && !can(PERMISSIONS.BACKDATE_SALES)) {
    router.push("/dashboard");
    return null;
  }

  const [histories, setHistories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0 });
  const [rollingBack, setRollingBack] = useState(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });
      const res = await apiFetch(`/admin/backdate-history?${params}`);
      if (res?.data) {
        setHistories(res.data.histories || []);
        setPagination((prev) => ({
          ...prev,
          total: res.data.pagination?.total || 0,
        }));
      }
    } catch (err) {
      setError("Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const handleRollback = async (historyId) => {
    if (!window.confirm("Are you sure you want to rollback this backdate? This will restore all entities to their original state.")) return;
    setRollingBack(historyId);
    setError("");
    try {
      const reason = prompt("Reason for rollback (optional):");
      const res = await apiFetch(`/admin/rollback-backdate/${historyId}`, {
        method: "POST",
        body: { reason: reason || "" },
      });
      if (res?.success) {
        await loadHistory();
      } else {
        setError(res?.message || "Rollback failed");
      }
    } catch (err) {
      setError(err.message || "Rollback failed");
    } finally {
      setRollingBack(null);
    }
  };

  const formatDate = (date) => new Date(date).toLocaleString();
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Backdate History</h1>
        <button
          onClick={() => router.push("/dashboard/settings/backdate-sales")}
          className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
        >
          ← Back to Shifts
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}</div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading history...</div>
      ) : histories.length === 0 ? (
        <div className="text-center py-12 text-gray-500">No backdate history found.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Shift</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sales</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied By</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied At</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {histories.map((history) => (
                <tr key={history._id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {history.shiftId?.shiftCode || history.shiftId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(history.targetDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      history.status === "applied" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
                    }`}>
                      {history.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {history.changes?.salesCount || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {history.appliedBy?.fullname || history.appliedBy}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {formatDate(history.appliedAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {history.status === "applied" ? (
                      <button
                        onClick={() => handleRollback(history._id)}
                        disabled={rollingBack === history._id}
                        className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs disabled:opacity-50"
                      >
                        {rollingBack === history._id ? "Rolling back..." : "Rollback"}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">Rolled back</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4">
          <div className="text-sm text-gray-600">Page {pagination.page} of {totalPages}</div>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="px-4 py-2 border rounded-md text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
              disabled={pagination.page === totalPages}
              className="px-4 py-2 border rounded-md text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}