"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";

export default function DeliveryReportsPage() {
  const { permissions, locationsMeta } = useSessionStore();
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    assigned: 0,
    in_transit: 0,
    delivered: 0,
    completed: 0,
    collected: 0,
    cancelled: 0,
    failed: 0,
    deliveredTotal: 0,
    totalRevenue: 0,
    averageFee: 0,
  });
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [dailyData, setDailyData] = useState([]);
  const [topDrivers, setTopDrivers] = useState([]);
  const [categoryReport, setCategoryReport] = useState(null);
  const [deliveryMetrics, setDeliveryMetrics] = useState(null);
  const [statusFlowReport, setStatusFlowReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });
  const [locationId, setLocationId] = useState("");
  const [activeTab, setActiveTab] = useState("overview");

  const canRead = permissions?.includes(PERMISSIONS.DELIVERY_FEES_READ);

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
      try {
        setLoading(true);

        // Build query parameters
        const params = new URLSearchParams();
        const salesParams = new URLSearchParams();

        if (dateRange.startDate) {
          const [year, month, day] = dateRange.startDate.split("-").map(Number);
          const startOfDay = new Date(year, month - 1, day);
          params.append("startDate", startOfDay.toISOString());
          salesParams.append("startDate", startOfDay.toISOString());
        }
        if (dateRange.endDate) {
          const [year, month, day] = dateRange.endDate.split("-").map(Number);
          const endOfDay = new Date(year, month - 1, day + 1);
          params.append("endDate", endOfDay.toISOString());
          salesParams.append("endDate", endOfDay.toISOString());
        }
        if (locationId) {
          salesParams.append("locationId", locationId);
          params.append("locationId", locationId);
        }

        // Fetch stats from backend API
        const statsResponse = await apiFetch(`/delivery-fees/stats?${params.toString()}`);
        const statsData = statsResponse?.data || statsResponse;

        const rawStatusCounts = statsData.categoryStatusCounts || statsData.statusCounts || {};
        const totalCount = Object.values(rawStatusCounts).reduce(
          (sum, count) => sum + count,
          0,
        );
        const deliveredCount =
          (rawStatusCounts.delivered || 0) +
          (rawStatusCounts.completed || 0) +
          (rawStatusCounts.collected || 0);

        const statusCounts = {
          total: totalCount,
          pending: rawStatusCounts.pending || 0,
          assigned: rawStatusCounts.assigned || 0,
          in_transit: rawStatusCounts.in_transit || 0,
          delivered: rawStatusCounts.delivered || 0,
          completed: rawStatusCounts.completed || 0,
          collected: rawStatusCounts.collected || 0,
          cancelled: rawStatusCounts.cancelled || 0,
          failed: rawStatusCounts.failed || 0,
          deliveredTotal: deliveredCount,
        };

        const statusEntries = Object.entries(rawStatusCounts)
          .map(([status, count]) => ({ status, count }))
          .sort((a, b) => b.count - a.count);
        setStatusBreakdown(statusEntries);

        const categoryEntries = Array.isArray(statsData.revenueByCategory)
          ? statsData.revenueByCategory
          : [];
        setCategoryBreakdown(categoryEntries);

        // Calculate average fee
        const totalRevenue = statsData.totalRevenue || 0;
        const averageFee = statusCounts.total > 0 ? totalRevenue / statusCounts.total : 0;

        setStats({
          ...statusCounts,
          totalRevenue,
          averageFee,
        });

        // Fetch delivery category reports from Phase 2 endpoints
        if (dateRange.startDate && dateRange.endDate) {
          try {
            // Fetch category breakdown
            const categoryRes = await apiFetch(`/sales/reports/by-delivery-category?${salesParams.toString()}`);
            if (categoryRes?.data) {
              setCategoryReport(categoryRes.data);
            }

            // Fetch delivery metrics
            const metricsRes = await apiFetch(`/sales/reports/delivery-metrics?${salesParams.toString()}`);
            if (metricsRes?.data) {
              setDeliveryMetrics(metricsRes.data);
            }

            // Fetch delivery status flow
            const statusFlowRes = await apiFetch(`/sales/reports/delivery-status-flow?${salesParams.toString()}`);
            if (statusFlowRes?.data) {
              setStatusFlowReport(statusFlowRes.data);
            }
          } catch (reportErr) {
            console.warn("Failed to fetch delivery category reports:", reportErr);
            // Don't fail the entire page if reports endpoints are unavailable
          }
        }

        // Fetch deliveries for driver stats (still need this for driver breakdown)
        // Only fetch if we have deliveries to report on
        if (statusCounts.total > 0) {
          const deliveriesParams = new URLSearchParams({
            limit: 1000,
            ...Object.fromEntries(params),
          });
          
          const response = await apiFetch(`/delivery-fees?${deliveriesParams.toString()}`);
          
          let deliveries = [];
          if (response?.data?.deliveries && Array.isArray(response.data.deliveries)) {
            deliveries = response.data.deliveries;
          } else if (response?.data && Array.isArray(response.data)) {
            deliveries = response.data;
          } else if (Array.isArray(response)) {
            deliveries = response;
          }

          // Calculate driver stats
          const driverMap = {};
          deliveries.forEach((delivery) => {
            const driverName =
              typeof delivery.driverId === "object"
                ? delivery.driverId?.name
                : null;
            if (driverName) {
              if (!driverMap[driverName]) {
                driverMap[driverName] = { count: 0, revenue: 0 };
              }
              driverMap[driverName].count += 1;
              driverMap[driverName].revenue += delivery.totalAmount || 0;
            }
          });

          const topDriversList = Object.entries(driverMap)
            .map(([name, data]) => ({
              name,
              deliveries: data.count,
              revenue: data.revenue,
              average: data.revenue / data.count,
            }))
            .sort((a, b) => b.deliveries - a.deliveries)
            .slice(0, 5);

          setTopDrivers(topDriversList);
        } else {
          setTopDrivers([]);
        }

        setError("");
      } catch (err) {
        console.error("Failed to fetch reports:", err);
        setError("Failed to load reports");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [canRead, dateRange, locationId]);

  const handleExport = () => {
    // Create CSV export
    const headers = ["Metric", "Count"];
    const rows = [
      ["Total Deliveries", stats.total],
      ["Pending", stats.pending],
      ["Assigned", stats.assigned],
      ["In Transit", stats.in_transit],
      ["Delivered", stats.delivered],
      ["Cancelled", stats.cancelled],
      ["Failed", stats.failed],
      ["Total Revenue", `$${stats.totalRevenue.toFixed(2)}`],
      ["Average Fee", `$${stats.averageFee.toFixed(2)}`],
    ];

    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `delivery-reports-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  };

  const statusColumns = (() => {
    const half = Math.ceil(statusBreakdown.length / 2);
    return [statusBreakdown.slice(0, half), statusBreakdown.slice(half)];
  })();

  const statusColor = (status) => {
    const map = {
      pending: "yellow",
      assigned: "blue",
      in_transit: "cyan",
      delivered: "green",
      completed: "green",
      collected: "green",
      cancelled: "red",
      failed: "orange",
    };
    return map[status] || "blue";
  };

  if (!canRead) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Delivery Reports</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Delivery Reports</h1>
          <p className="mt-1 text-sm text-zinc-600">Analytics and statistics for your deliveries</p>
        </div>
        <button
          onClick={handleExport}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          Export to CSV
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-zinc-700">Start Date</label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">End Date</label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-700">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
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
          <div className="flex items-end">
            <button
              onClick={() => {
                setDateRange({ startDate: "", endDate: "" });
                setLocationId("");
              }}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-zinc-600">Loading reports...</p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <StatCard label="Total Deliveries" value={stats.total} color="blue" />
            <StatCard label="Completed" value={stats.deliveredTotal} color="green" />
            <StatCard label="In Transit" value={stats.in_transit} color="cyan" />
            <StatCard label="Pending" value={stats.pending} color="yellow" />
            <StatCard label="Failed/Cancelled" value={stats.failed + stats.cancelled} color="red" />
          </div>

          {/* Revenue Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">Revenue</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-zinc-600">Total Revenue</p>
                  <p className="mt-1 text-3xl font-bold text-blue-600">
                    {formatCurrency(stats.totalRevenue)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-zinc-600">Average Fee per Delivery</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-900">
                    {formatCurrency(stats.averageFee)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900">Deliveries by Category</h2>
              <div className="space-y-2">
                {categoryBreakdown.map((item) => (
                  <div
                    key={`${item._id?.category || "uncategorized"}-${item._id?.option || ""}`}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-zinc-600">
                      {item._id?.category || "Uncategorized"}
                      {item._id?.option ? ` - ${item._id.option}` : ""}
                    </span>
                    <span className="font-medium text-zinc-900">{item.count}</span>
                  </div>
                ))}
                {categoryBreakdown.length === 0 && (
                  <p className="text-sm text-zinc-500">No deliveries in range.</p>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Status Distribution</h2>
            {statusBreakdown.length === 0 ? (
              <p className="text-sm text-zinc-500">No status data available.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {statusColumns.map((column, idx) => (
                  <div key={idx} className="space-y-2">
                    {column.map((item) => (
                      <StatusBar
                        key={item.status}
                        label={item.status.replace(/_/g, " ")}
                        value={item.count}
                        total={stats.total}
                        color={statusColor(item.status)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Drivers */}
          {topDrivers.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="font-semibold text-zinc-900">Top Drivers</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Driver</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-900">Deliveries</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Revenue</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Avg/Delivery</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {topDrivers.map((driver, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50">
                        <td className="px-6 py-4 text-sm font-medium text-zinc-900">{driver.name}</td>
                        <td className="px-6 py-4 text-center text-sm text-zinc-600">{driver.deliveries}</td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-zinc-900">
                          {formatCurrency(driver.revenue)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-zinc-600">
                          {formatCurrency(driver.average)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Delivery Category Analytics (Phase 2 Reports) */}
          {deliveryMetrics && (
            <>
              {/* Delivery KPI Metrics */}
              <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold text-zinc-900">Delivery Performance (Sales)</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-600">Total Deliveries</p>
                    <p className="mt-1 text-3xl font-bold text-blue-600">
                      {deliveryMetrics.metrics.totalDeliveries}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-600">Success Rate</p>
                    <p className="mt-1 text-3xl font-bold text-green-600">
                      {deliveryMetrics.metrics.successRate}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {deliveryMetrics.metrics.successfulDeliveries} completed
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-600">Delivery Fees Revenue</p>
                    <p className="mt-1 text-3xl font-bold text-zinc-900">
                      {formatCurrency(deliveryMetrics.metrics.totalDeliveryFees)}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Avg: {formatCurrency(deliveryMetrics.metrics.avgDeliveryFee)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-600">Failed Deliveries</p>
                    <p className="mt-1 text-2xl font-semibold text-red-600">
                      {deliveryMetrics.metrics.failedDeliveries} ({deliveryMetrics.metrics.failureRate})
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-600">Pending Deliveries</p>
                    <p className="mt-1 text-2xl font-semibold text-yellow-600">
                      {deliveryMetrics.metrics.pendingDeliveries}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-zinc-600">Fees as % of Revenue</p>
                    <p className="mt-1 text-2xl font-semibold text-zinc-900">
                      {deliveryMetrics.metrics.deliveryFeesAsPercentOfRevenue}
                    </p>
                  </div>
                </div>
              </div>

              {/* Delivery Status Flow */}
              {statusFlowReport && (
                <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-4 text-lg font-semibold text-zinc-900">Delivery Status Flow</h2>
                  <p className="mb-4 text-sm text-zinc-600">
                    Top Bottleneck: <span className="font-semibold text-orange-600 capitalize">{statusFlowReport.topBottleneck}</span>
                  </p>
                  <div className="space-y-3">
                    {Object.entries(statusFlowReport.statusFlow).map(([status, count]) => {
                      const percentage = statusFlowReport.totalDeliveries > 0 
                        ? (count / statusFlowReport.totalDeliveries) * 100 
                        : 0;
                      return (
                        <div key={status}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="font-medium capitalize text-zinc-700">{status}</span>
                            <span className="text-xs text-zinc-600">
                              {count} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-zinc-200">
                            <div
                              className={`h-full rounded-full transition-all ${
                                status === "delivered" ? "bg-green-500" :
                                status === "pending" ? "bg-yellow-500" :
                                status === "in-transit" ? "bg-blue-500" :
                                status === "failed" ? "bg-red-500" :
                                "bg-gray-500"
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Delivery Category Breakdown */}
          {categoryReport && categoryReport.byCategory && Object.keys(categoryReport.byCategory).length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
              <div className="border-b border-zinc-200 px-6 py-4">
                <h2 className="font-semibold text-zinc-900">Delivery Category Breakdown</h2>
                <p className="mt-1 text-sm text-zinc-600">
                  {categoryReport.summary.totalCategories} categories • {categoryReport.summary.totalDeliveries} deliveries
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Category</th>
                      <th className="px-6 py-3 text-center text-xs font-semibold text-zinc-900">Count</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Revenue</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Delivery Fees</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Avg Fee</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {Object.entries(categoryReport.byCategory)
                      .sort((a, b) => b[1].revenue - a[1].revenue)
                      .map(([category, data]) => (
                        <tr key={category} className="hover:bg-zinc-50">
                          <td className="px-6 py-4 text-sm font-medium text-zinc-900">{category}</td>
                          <td className="px-6 py-4 text-center text-sm text-zinc-600">{data.count}</td>
                          <td className="px-6 py-4 text-right text-sm font-semibold text-zinc-900">
                            {formatCurrency(data.revenue)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-zinc-600">
                            {formatCurrency(data.deliveryFees)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm text-zinc-600">
                            {formatCurrency(data.avgFee)}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium text-blue-600">
                            {data.percentage}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colorMap = {
    blue: "bg-blue-100 text-blue-800 border-blue-300",
    green: "bg-green-100 text-green-800 border-green-300",
    cyan: "bg-cyan-100 text-cyan-800 border-cyan-300",
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
    red: "bg-red-100 text-red-800 border-red-300",
  };

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${colorMap[color]}`}>
      <p className="text-xs font-medium opacity-75">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusBar({ label, value, total, color }) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const colorMap = {
    yellow: "bg-yellow-500",
    blue: "bg-blue-500",
    cyan: "bg-cyan-500",
    green: "bg-green-500",
    red: "bg-red-500",
    orange: "bg-orange-500",
  };

  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-zinc-700">{label}</span>
        <span className="text-xs text-zinc-600">{value} ({percentage.toFixed(1)}%)</span>
      </div>
      <div className="h-2 rounded-full bg-zinc-200">
        <div
          className={`h-full rounded-full transition-all ${colorMap[color]}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}
