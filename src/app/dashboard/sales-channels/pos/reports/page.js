"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";

function StatCard({ label, value, change, icon }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-zinc-600">{label}</p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
          {change && (
            <p className={`mt-1 text-xs font-medium ${change > 0 ? "text-green-600" : "text-red-600"}`}>
              {change > 0 ? "+" : ""}{change}% vs last period
            </p>
          )}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}

export default function SalesReportsPage() {
  const router = useRouter();
  const { permissions, locationsMeta } = useSessionStore();
  const [reportData, setReportData] = useState(null);
  const [detailedSales, setDetailedSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const getLocalDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [filters, setFilters] = useState({
    startDate: getLocalDateString(),
    endDate: getLocalDateString(),
    status: "",
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

  const canViewReports = permissions?.includes(PERMISSIONS.VIEW_REPORTS);

  useEffect(() => {
    if (!canViewReports) {
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
      try {
        setLoading(true);

        // Prepare dates with proper time boundaries using local timezone
        const [startYear, startMonth, startDay] = filters.startDate.split('-').map(Number);
        const [endYear, endMonth, endDay] = filters.endDate.split('-').map(Number);
        
        const startOfDay = new Date(startYear, startMonth - 1, startDay);
        const endOfDay = new Date(endYear, endMonth - 1, endDay + 1);

        // Fetch summary report
        const params = new URLSearchParams({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          status: filters.status,
          timeBasis: "payment",
        });

        if (filters.paymentMethod) params.append("paymentMethod", filters.paymentMethod);
        if (filters.shopifySyncStatus) params.append("shopifySyncStatus", filters.shopifySyncStatus);
        if (filters.paymentStatus) params.append("paymentStatus", filters.paymentStatus);
        if (filters.locationId) params.append("locationId", filters.locationId);

        const summaryRes = await apiFetch(`/sales/reports/summary?${params.toString()}`);

        // Handle response - API returns data directly, not wrapped in data property
        if (summaryRes) {
          setReportData(summaryRes.data);
        }

        // Fetch detailed sales
        const detailParams = new URLSearchParams({
          startDate: startOfDay.toISOString(),
          endDate: endOfDay.toISOString(),
          status: filters.status,
          timeBasis: "payment",
          limit: pagination.limit,
          page: pagination.page,
        });

        if (filters.paymentMethod) detailParams.append("paymentMethod", filters.paymentMethod);
        if (filters.shopifySyncStatus) detailParams.append("shopifySyncStatus", filters.shopifySyncStatus);
        if (filters.paymentStatus) detailParams.append("paymentStatus", filters.paymentStatus);
        if (filters.locationId) detailParams.append("locationId", filters.locationId);

        const detailRes = await apiFetch(`/sales?${detailParams.toString()}`);

        // Handle API response: {success: true, data: {sales: [...], pagination: {...}}}
        let salesData = [];
        if (detailRes?.data?.sales && Array.isArray(detailRes.data.sales)) {
          salesData = detailRes.data.sales;
        } else if (detailRes?.data && Array.isArray(detailRes.data)) {
          salesData = detailRes.data;
        } else if (Array.isArray(detailRes)) {
          salesData = detailRes;
        }
        
        setDetailedSales(salesData);
        
        if (detailRes?.data?.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: detailRes.data.pagination.total,
          }));
        } else if (detailRes?.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: detailRes.pagination.total,
          }));
        }

        setError("");
      } catch (err) {
        console.error("Failed to fetch reports:", err);
        setError("Failed to load sales reports");
        setDetailedSales([]);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [canViewReports, filters, pagination.page]);

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

  const formatDateTime = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  if (!canViewReports) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Sales Reports</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view sales reports.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">Sales Reports</h1>
        <p className="mt-1 text-sm text-zinc-600">Advanced analytics and detailed sales insights</p>
      </div>

      {/* Filters */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-semibold text-zinc-900">Report Filters</h3>
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
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-zinc-200">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 font-medium ${
              activeTab === "overview"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("detailed")}
            className={`px-4 py-2 font-medium ${
              activeTab === "detailed"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Detailed Sales
          </button>
          <button
            onClick={() => setActiveTab("breakdown")}
            className={`px-4 py-2 font-medium ${
              activeTab === "breakdown"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-zinc-600 hover:text-zinc-900"
            }`}
          >
            Payment Breakdown
          </button>
        </div>
      </div>

      {/* Content Tabs */}
      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center">
          <p className="text-sm text-zinc-600">Loading reports...</p>
        </div>
      ) : activeTab === "overview" ? (
        <>
          {reportData ? (
            <>
              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  label="Total Revenue"
                  value={formatCurrency(reportData.totalRevenue)}
                  icon="💰"
                />
                <StatCard
                  label="Delivery Collected"
                  value={formatCurrency(reportData.deliveryAmountCollected)}
                  icon="🚚"
                />
                <StatCard
                  label="Transactions"
                  value={reportData.totalSales || 0}
                  icon="🧾"
                />
                <StatCard
                  label="Items Sold"
                  value={reportData.itemsSold?.total || 0}
                  icon="📦"
                />
                <StatCard
                  label="Avg Transaction"
                  value={formatCurrency(reportData.averageTransactionValue || 0)}
                  icon="📊"
                />
                <StatCard
                  label="Discount Given"
                  value={formatCurrency(reportData.totalDiscount || 0)}
                  icon="🏷️"
                />
              </div>

              {/* Breakdown Cards */}
              <div className="grid gap-4 md:grid-cols-2">
                {/* Item Type Breakdown */}
                <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 font-semibold text-zinc-900">Product Source</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">FLEXI Items</span>
                      <span className="text-lg font-semibold text-zinc-900">
                        {reportData.itemsSold?.flexi || 0}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full bg-blue-600"
                        style={{
                          width: `${
                            reportData.itemsSold?.total > 0
                              ? ((reportData.itemsSold?.flexi || 0) / reportData.itemsSold.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">Shopify Items</span>
                      <span className="text-lg font-semibold text-zinc-900">
                        {reportData.itemsSold?.shopify || 0}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full bg-green-600"
                        style={{
                          width: `${
                            reportData.itemsSold?.total > 0
                              ? ((reportData.itemsSold?.shopify || 0) / reportData.itemsSold.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Tax & Discounts */}
                <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 font-semibold text-zinc-900">Tax & Discounts</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">Subtotal</span>
                      <span className="font-semibold text-zinc-900">
                        {formatCurrency(reportData.totalRevenue - (reportData.totalDiscount || 0) + (reportData.totalTax || 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">Total Tax</span>
                      <span className="font-semibold text-zinc-900">
                        {formatCurrency(reportData.totalTax || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">Total Discount</span>
                      <span className="font-semibold text-red-600">
                        -{formatCurrency(reportData.totalDiscount || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600">Delivery Collected</span>
                      <span className="font-semibold text-zinc-900">
                        {formatCurrency(reportData.deliveryAmountCollected || 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
              <p className="text-sm text-zinc-600">No reports data available</p>
            </div>
          )}
        </>
      ) : activeTab === "breakdown" ? (
        <>
          {reportData?.paymentMethodBreakdown && Object.keys(reportData.paymentMethodBreakdown).length > 0 ? (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h3 className="mb-6 text-lg font-semibold text-zinc-900">Payment Methods Breakdown</h3>
              <div className="space-y-4">
                {Object.entries(reportData.paymentMethodBreakdown).map(([method, data]) => {
                  const percentage = reportData.totalRevenue > 0 ? (data.total / reportData.totalRevenue) * 100 : 0;
                  return (
                    <div key={method}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-zinc-900 capitalize">{method}</span>
                          <span className="ml-2 text-xs text-zinc-500">({data.count} transactions)</span>
                        </div>
                        <span className="font-semibold text-zinc-900">
                          {formatCurrency(data.total)} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                        <div
                          className={`h-full ${
                            method === "cash"
                              ? "bg-green-600"
                              : method === "card"
                                ? "bg-blue-600"
                                : method === "mpesa"
                                  ? "bg-orange-600"
                                  : method === "mobile"
                                    ? "bg-purple-600"
                                    : method === "credit"
                                      ? "bg-indigo-600"
                                      : "bg-gray-600"
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
              <p className="text-sm text-zinc-600">No payment data available</p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Detailed Sales Table */}
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            {detailedSales.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-zinc-600">No sales found for the selected period</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">
                        Receipt #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">
                        Payment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">
                        Items
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">
                        Amount Paid
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {detailedSales.map((sale) => (
                      <tr
                        key={sale._id}
                        onClick={() => router.push(`/dashboard/sales/${sale._id}`)}
                        className="cursor-pointer hover:bg-zinc-50"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-blue-600 hover:underline">
                          {sale.receiptNumber}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {formatDateTime(sale.lastPaymentAtInRange || sale.createdAt)}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600 capitalize">
                          {Array.isArray(sale.paymentMethodsInRange) && sale.paymentMethodsInRange.length > 0
                            ? sale.paymentMethodsInRange.length > 1
                              ? "Split Payments"
                              : sale.paymentMethodsInRange[0]
                            : sale.payments?.length > 1
                              ? "Split Payments"
                              : sale.payments?.[0]?.method || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {sale.items?.length || 0} item{sale.items?.length !== 1 ? "s" : ""}
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-zinc-900">
                          {formatCurrency(
                            typeof sale.amountPaidInRange === "number"
                              ? sale.amountPaidInRange
                              : sale.totalAmount,
                          )}
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
        </>
      )}

    </div>
  );
}
