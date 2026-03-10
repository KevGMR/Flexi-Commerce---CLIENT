"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";
import { useSyncManager } from "@/hooks/useSyncManager";

function KPICard({ title, value, subtitle, icon, trend, trendValue }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-600">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-zinc-900">{value}</p>
          {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {icon && <div className="text-3xl text-zinc-300">{icon}</div>}
      </div>
      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <span className={`text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
            {trend === "up" ? "↑" : "↓"} {trendValue}
          </span>
          <span className="text-xs text-zinc-500">from yesterday</span>
        </div>
      )}
    </div>
  );
}

function LoadingCard({ title }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-zinc-600">{title}</p>
      <div className="mt-2 h-10 animate-pulse rounded bg-zinc-100" />
    </div>
  );
}

export default function HomePage() {
  const { permissions } = useSessionStore();
  const { isOnline, pendingSalesCount } = useSyncManager();
  const [salesData, setSalesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const canViewReports = permissions?.includes(PERMISSIONS.VIEW_REPORTS);

  useEffect(() => {
    if (!canViewReports) {
      setLoading(false);
      return;
    }

    const fetchSalesData = async () => {
      try {
        setLoading(true);
        // Get today's sales summary
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);


        const response = await apiFetch(
          `/sales/reports/summary?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}&timeBasis=payment`
        );

      
        if (response) {
          setSalesData(response.data);
        }
        setError("");
      } catch (err) {
        console.error("Failed to fetch sales data:", err);
        setError("Failed to load sales data");
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, [canViewReports]);

  if (!canViewReports) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view sales data.</p>
      </div>
    );
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">Sales Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Real-time overview of today's POS sales and system status
        </p>
      </div>

      {/* System Status */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className={`rounded-lg border-2 p-4 ${isOnline ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}`}>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${isOnline ? "bg-green-600" : "bg-red-600"}`} />
            <span className="font-medium text-zinc-900">
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-600">
            {isOnline ? "System is connected and syncing" : "System is offline. Changes queued for sync."}
          </p>
        </div>

        {pendingSalesCount > 0 && (
          <div className="rounded-lg border-2 border-yellow-200 bg-yellow-50 p-4">
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold text-yellow-600">{pendingSalesCount}</span>
              <span className="font-medium text-zinc-900">Pending Sales</span>
            </div>
            <p className="mt-1 text-xs text-zinc-600">
              Waiting to sync when online
            </p>
          </div>
        )}
      </div>

      {/* Sales KPIs */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">Today's Performance</h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <LoadingCard title="Total Revenue" />
            <LoadingCard title="Transactions" />
            <LoadingCard title="Items Sold" />
            <LoadingCard title="Average Transaction" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : salesData ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              title="Total Revenue"
              value={formatCurrency(salesData.totalRevenue)}
              icon="💰"
              subtitle={`${salesData.totalSales || 0} transactions`}
            />
            <KPICard
              title="Transactions"
              value={salesData.totalSales || 0}
              icon="🧾"
              subtitle="Completed sales"
            />
            <KPICard
              title="Items Sold"
              value={salesData.itemsSold?.total || 0}
              icon="📦"
              subtitle={`${salesData.itemsSold?.flexi || 0} FLEXI, ${salesData.itemsSold?.shopify || 0} Shopify`}
            />
            <KPICard
              title="Avg Transaction"
              value={formatCurrency(salesData.averageTransactionValue || 0)}
              icon="📊"
              subtitle="Average order value"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center">
            <p className="text-sm text-zinc-600">No sales data for today</p>
          </div>
        )}
      </div>

      {/* Payment Breakdown */}
      {salesData?.paymentMethodBreakdown && Object.keys(salesData.paymentMethodBreakdown).length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-zinc-900">Payment Methods</h3>
          <div className="mt-4 space-y-2">
            {Object.entries(salesData.paymentMethodBreakdown).map(([method, data]) => (
              <div key={method} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-700 capitalize">{method}</span>
                  <span className="text-xs text-zinc-500">({data.count} txns)</span>
                </div>
                <span className="text-sm font-semibold text-zinc-900">{formatCurrency(data.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid gap-4 md:grid-cols-3">
        <a
          href="/dashboard/orders"
          className="rounded-lg border border-blue-200 bg-blue-50 p-4 hover:border-blue-300 hover:bg-blue-100"
        >
          <p className="font-medium text-blue-900">View Sales History</p>
          <p className="mt-1 text-xs text-blue-700">See all completed sales and transactions</p>
        </a>
        <a
          href="/dashboard/sales-channels/pos/reports"
          className="rounded-lg border border-purple-200 bg-purple-50 p-4 hover:border-purple-300 hover:bg-purple-100"
        >
          <p className="font-medium text-purple-900">Detailed Reports</p>
          <p className="mt-1 text-xs text-purple-700">Advanced analytics and data export</p>
        </a>
        <a
          href="/dashboard/sales-channels/pos"
          className="rounded-lg border border-green-200 bg-green-50 p-4 hover:border-green-300 hover:bg-green-100"
        >
          <p className="font-medium text-green-900">New Sale</p>
          <p className="mt-1 text-xs text-green-700">Create a new POS transaction</p>
        </a>
      </div>
    </div>
  );
}
