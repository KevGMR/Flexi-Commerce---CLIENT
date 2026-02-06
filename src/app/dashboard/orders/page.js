"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";

export default function OrdersPage() {
  const router = useRouter();
  const { permissions, locationsMeta } = useSessionStore();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    status: "",
    startDate: "",
    endDate: "",
    paymentMethod: "",
    shopifySyncStatus: "",
    paymentStatus: "",
    locationId: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  const canViewSalesHistory = permissions?.includes(PERMISSIONS.VIEW_SALE_HISTORY);

  useEffect(() => {
    if (!canViewSalesHistory) {
      setLoading(false);
      return;
    }

    const fetchSales = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          status: filters.status,
          limit: pagination.limit,
          page: pagination.page,
        });

        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);
        if (filters.paymentMethod) params.append("paymentMethod", filters.paymentMethod);
        if (filters.shopifySyncStatus) params.append("shopifySyncStatus", filters.shopifySyncStatus);
        if (filters.paymentStatus) params.append("paymentStatus", filters.paymentStatus);
        if (filters.locationId) params.append("locationId", filters.locationId);

        const response = await apiFetch(`/sales?${params.toString()}`);

        // Handle API response: {success: true, data: {sales: [...], pagination: {...}}}
        let salesData = [];
        if (response?.data?.sales && Array.isArray(response.data.sales)) {
          salesData = response.data.sales;
        } else if (response?.data && Array.isArray(response.data)) {
          salesData = response.data;
        } else if (Array.isArray(response)) {
          salesData = response;
        }

        setSales(salesData);
        
        if (response?.data?.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: response.data.pagination.total,
          }));
        } else if (response?.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: response.pagination.total,
          }));
        }
        setError("");
      } catch (err) {
        console.error("Failed to fetch sales:", err);
        setError("Failed to load sales history");
        setSales([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, [canViewSalesHistory, filters, pagination.page]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPagination((prev) => ({
      ...prev,
      page: 1,
    }));
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (!canViewSalesHistory) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Sales History</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view sales history.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">Sales History</h1>
        <p className="mt-1 text-sm text-zinc-600">View and manage all POS transactions</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700">Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange("status", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
              <option value="pending">Pending</option>
              <option value="partial_refund">Partial Refund</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Payment Status</label>
            <select
              value={filters.paymentStatus}
              onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="completed">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Shopify Sync</label>
            <select
              value={filters.shopifySyncStatus}
              onChange={(e) => handleFilterChange("shopifySyncStatus", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              <option value="synced">Synced</option>
              <option value="pending">Pending Sync</option>
              <option value="failed">Failed</option>
              <option value="partial">Partial</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Location</label>
            <select
              value={filters.locationId}
              onChange={(e) => handleFilterChange("locationId", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All Locations</option>
              {locationsMeta?.map((location) => (
                <option key={location._id} value={location._id}>
                  {location.name || location.shopifyLocationName || "Unknown"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Payment Method</label>
            <select
              value={filters.paymentMethod}
              onChange={(e) => handleFilterChange("paymentMethod", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mpesa">M-Pesa</option>
              <option value="mobile">Mobile Money</option>
              <option value="check">Check</option>
              <option value="credit">Credit/Account</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Sales Table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-center">
            <p className="text-sm text-zinc-600">Loading sales data...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm text-zinc-600">No sales found</p>
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Receipt #</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Payment Method</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Customer</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {sales.map((sale) => (
                  <tr
                    key={sale._id}
                    onClick={() => router.push(`/dashboard/sales/${sale._id}`)}
                    className="cursor-pointer hover:bg-zinc-50"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-blue-600 hover:underline">
                      {sale.receiptNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{formatDate(sale.createdAt)}</td>
                    <td className="px-6 py-4 text-sm text-zinc-600 capitalize">
                      {sale.payments?.[0]?.method || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {sale.customerName || "—"}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-zinc-900">
                      {formatCurrency(sale.totalAmount)}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                          sale.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                          sale.shopifySyncStatus === "synced"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {sale.shopifySyncStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
                <div className="text-sm text-zinc-600">
                  Page {pagination.page} of {totalPages} ({pagination.total} total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.max(1, prev.page - 1),
                      }))
                    }
                    disabled={pagination.page === 1}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(totalPages, prev.page + 1),
                      }))
                    }
                    disabled={pagination.page === totalPages}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
