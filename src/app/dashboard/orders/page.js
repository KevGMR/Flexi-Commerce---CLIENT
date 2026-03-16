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
    deliveryCategory: "",
    categoryStatus: "",
    requiresDelivery: "",
    search: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");

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

        // Handle dates with proper timezone conversion
        if (filters.startDate) {
          const [year, month, day] = filters.startDate.split('-').map(Number);
          const startOfDay = new Date(year, month - 1, day);
          params.append("startDate", startOfDay.toISOString());
        }
        if (filters.endDate) {
          const [year, month, day] = filters.endDate.split('-').map(Number);
          const endOfDay = new Date(year, month - 1, day + 1);
          params.append("endDate", endOfDay.toISOString());
        }
        if (filters.paymentMethod) params.append("paymentMethod", filters.paymentMethod);
        if (filters.shopifySyncStatus) params.append("shopifySyncStatus", filters.shopifySyncStatus);
        if (filters.paymentStatus) params.append("paymentStatus", filters.paymentStatus);
        if (filters.locationId) params.append("locationId", filters.locationId);
        if (filters.deliveryCategory) params.append("deliveryCategory", filters.deliveryCategory);
        if (filters.categoryStatus) params.append("categoryStatus", filters.categoryStatus);
        if (filters.requiresDelivery) params.append("requiresDelivery", filters.requiresDelivery);
        if (filters.search) params.append("search", filters.search);

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
    setFilters((prev) => {
      const updated = {
        ...prev,
        [key]: value,
      };
      
      // If startDate is changed and is greater than endDate, update endDate to match
      if (key === 'startDate' && value && updated.endDate && value > updated.endDate) {
        updated.endDate = value;
      }
      
      // If endDate is changed and is less than startDate, update startDate to match
      if (key === 'endDate' && value && updated.startDate && value < updated.startDate) {
        updated.startDate = value;
      }
      
      return updated;
    });
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

  const handleSearchSubmit = () => {
    handleFilterChange("search", searchInput.trim());
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSearchSubmit();
    }
  };

  const clearSearch = () => {
    setSearchInput("");
    handleFilterChange("search", "");
  };

  const escapeCsvValue = (value) => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
      return `"${str.replace(/"/g, "\"\"")}"`;
    }
    return str;
  };

  const handleExport = async () => {
    if (exportLoading) return;
    setExportLoading(true);
    setExportError("");
    try {
      const limit = pagination.total > 0 ? pagination.total : 10000;
      const params = new URLSearchParams({
        status: filters.status,
        limit,
        page: 1,
      });

      if (filters.startDate) {
        const [year, month, day] = filters.startDate.split("-").map(Number);
        params.append("startDate", new Date(year, month - 1, day).toISOString());
      }
      if (filters.endDate) {
        const [year, month, day] = filters.endDate.split("-").map(Number);
        params.append("endDate", new Date(year, month - 1, day + 1).toISOString());
      }
      if (filters.paymentMethod) params.append("paymentMethod", filters.paymentMethod);
      if (filters.shopifySyncStatus) params.append("shopifySyncStatus", filters.shopifySyncStatus);
      if (filters.paymentStatus) params.append("paymentStatus", filters.paymentStatus);
      if (filters.locationId) params.append("locationId", filters.locationId);
      if (filters.deliveryCategory) params.append("deliveryCategory", filters.deliveryCategory);
      if (filters.categoryStatus) params.append("categoryStatus", filters.categoryStatus);
      if (filters.requiresDelivery) params.append("requiresDelivery", filters.requiresDelivery);
      if (filters.search) params.append("search", filters.search);

      const response = await apiFetch(`/sales?${params.toString()}`);

      let exportSales = [];
      if (response?.data?.sales && Array.isArray(response.data.sales)) {
        exportSales = response.data.sales;
      } else if (response?.data && Array.isArray(response.data)) {
        exportSales = response.data;
      } else if (Array.isArray(response)) {
        exportSales = response;
      }

      if (exportSales.length === 0) {
        setExportError("No records to export for the current filters.");
        return;
      }

      const headers = [
        "Receipt Number",
        "Transaction ID",
        "Date",
        "Time",
        "Location ID",
        "Customer Name",
        "Customer Phone",
        "Customer Email",
        "Product Name",
        "Product SKU",
        "Sold Quantity",
        "Item Unit Price",
        "Subtotal",
        "Discount",
        "Tax Amount",
        "Tax Rate (%)",
        "Delivery Fee",
        "Total Amount",
        "Payment Methods",
        "Payment Status",
        "Card Last4",
        "Transaction Ref",
        "Sale Status",
        "Void Reason",
        "Voided At",
        "Refund Amount",
        "Refund Reason",
        "Delivery Category",
        "Delivery Option",
        "Delivery Status",
        "Shopify Sync Status",
        "Notes",
      ];

      const rows = exportSales.flatMap((sale) => {
        const dt = sale.completedAt || sale.createdAt ? new Date(sale.completedAt || sale.createdAt) : null;
        const dateStr = dt ? dt.toLocaleDateString() : "";
        const timeStr = dt ? dt.toLocaleTimeString() : "";

        const paymentMethods = (sale.payments || []).map((p) => {
          return `${p.method}:${p.amount}`;
        }).join("; ");

        const orderPrefix = [
          sale.receiptNumber,
          sale.transactionId,
          dateStr,
          timeStr,
          sale.locationId,
          sale.customerName,
          sale.customerPhone,
          sale.customerEmail,
        ];

        const orderSuffix = [
          sale.subtotal,
          sale.discountAmount,
          sale.taxAmount,
          sale.taxRateUsed,
          sale.deliveryFeeAmount,
          sale.totalAmount,
          paymentMethods,
          sale.paymentStatus,
          sale.cardLast4,
          sale.transactionRef,
          sale.status,
          sale.voidReason,
          sale.voidedAt ? new Date(sale.voidedAt).toLocaleString() : "",
          sale.refundAmount,
          sale.refundReason,
          sale.deliveryCategory,
          sale.deliveryOption,
          sale.categoryStatus || sale.deliveryStatus,
          sale.shopifySyncStatus,
          sale.notes,
        ];

        const items = Array.isArray(sale.items) ? sale.items : [];

        if (items.length === 0) {
          return [[
            ...orderPrefix,
            "",
            "",
            "",
            "",
            ...orderSuffix,
          ].map(escapeCsvValue)];
        }

        const itemRows = items.map((item) => {
          const parsedQuantity = Number(item?.quantity);
          const soldQuantity = Number.isFinite(parsedQuantity) ? parsedQuantity : 0;

          return {
            productName: item?.productName || "Unknown",
            productSku: item?.sku || "",
            soldQuantity,
            itemUnitPrice: item?.unitPrice ?? "",
          };
        });

        return itemRows.map((itemRow, index) => {
          const showOrderFields = index === 0;

          return [
            ...(showOrderFields ? orderPrefix : Array(orderPrefix.length).fill("")),
            itemRow.productName,
            itemRow.productSku,
            itemRow.soldQuantity,
            itemRow.itemUnitPrice,
            ...(showOrderFields ? orderSuffix : Array(orderSuffix.length).fill("")),
          ].map(escapeCsvValue);
        });
      });

      const csv = [headers.map(escapeCsvValue), ...rows].map((row) => row.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      setExportError("Export failed. Please try again.");
    } finally {
      setExportLoading(false);
    }
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Sales History</h1>
          <p className="mt-1 text-sm text-zinc-600">View and manage all POS transactions</p>
        </div>
        {canViewSalesHistory && (
          <div className="flex flex-col items-end gap-1">
            <button
              type="button"
              onClick={handleExport}
              disabled={exportLoading}
              className="rounded border border-zinc-300 bg-white px-4 py-2 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
            >
              {exportLoading ? "Exporting…" : "Export CSV"}
            </button>
            {exportError && (
              <p className="text-xs text-red-600">{exportError}</p>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-zinc-700">Receipt # / Idempotency Key</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Enter exact receipt number or idempotency key"
                className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Search
              </button>
              {filters.search && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
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
              <option value="partial">Partial</option>
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
          <div>
            <label className="block text-xs font-medium text-zinc-700">Delivery Category</label>
            <select
              value={filters.deliveryCategory}
              onChange={(e) => handleFilterChange("deliveryCategory", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All Categories</option>
              <option value="Local Delivery">Local Delivery</option>
              <option value="Courier">Courier</option>
              <option value="Pickup">Pickup</option>
              <option value="Shipping">Shipping</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Delivery Status</label>
            <select
              value={filters.categoryStatus}
              onChange={(e) => handleFilterChange("categoryStatus", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Delivery Type</label>
            <select
              value={filters.requiresDelivery}
              onChange={(e) => handleFilterChange("requiresDelivery", e.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All Types</option>
              <option value="true">Requires Delivery</option>
              <option value="false">No Delivery</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {filters.search && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          Searching exact match for: <span className="font-medium">{filters.search}</span>
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Delivery</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Delivery Status</th>
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
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {sale.deliveryCategory ? (
                        <span className="font-medium text-zinc-900">{sale.deliveryCategory}</span>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {sale.categoryStatus || sale.deliveryStatus ? (
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-medium capitalize ${
                            (sale.categoryStatus || sale.deliveryStatus) === "delivered"
                              ? "bg-green-100 text-green-800"
                              : (sale.categoryStatus || sale.deliveryStatus) === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : (sale.categoryStatus || sale.deliveryStatus) === "in-transit"
                                  ? "bg-blue-100 text-blue-800"
                                  : (sale.categoryStatus || sale.deliveryStatus) === "failed"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {sale.categoryStatus || sale.deliveryStatus || "—"}
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">N/A</span>
                      )}
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
