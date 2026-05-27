"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";

function StatCard({ label, value, change, icon, tooltip }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-zinc-600">
            {tooltip ? <span title={tooltip}>{label}</span> : label}
          </p>
          <p className="mt-1 text-2xl font-bold text-zinc-900">{value}</p>
          {change !== undefined && change !== null && (
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

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) return "0.0";
  return Number(value).toFixed(1);
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildDayBoundaries(startDate, endDate) {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);

  const startOfDay = new Date(startYear, startMonth - 1, startDay);
  const endOfDay = new Date(endYear, endMonth - 1, endDay + 1);

  return {
    startDate: startOfDay.toISOString(),
    endDate: endOfDay.toISOString(),
  };
}

function getDateRangeParams(startDate, endDate) {
  return buildDayBoundaries(startDate, endDate);
}

function currency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0);
}

function toArrayResponse(response) {
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.items)) return response.data.items;
  if (Array.isArray(response)) return response;
  return [];
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 font-medium ${
        active ? "border-b-2 border-blue-600 text-blue-600" : "text-zinc-600 hover:text-zinc-900"
      }`}
    >
      {children}
    </button>
  );
}

function FieldLabel({ children }) {
  return <label className="block text-xs font-medium text-zinc-700">{children}</label>;
}

export default function SalesReportsPage() {
  const router = useRouter();
  const { permissions, locationsMeta, selectedLocationId } = useSessionStore();

  const [reportData, setReportData] = useState(null);
  const [detailedSales, setDetailedSales] = useState([]);
  const [deliveryStats, setDeliveryStats] = useState(null);
  const [deliveryRows, setDeliveryRows] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [expenseRows, setExpenseRows] = useState([]);
  const [shiftSessions, setShiftSessions] = useState([]);
  const [openShiftSessions, setOpenShiftSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [closingCashInput, setClosingCashInput] = useState("");
  const [shiftActionLoading, setShiftActionLoading] = useState(false);

  const today = formatDateInput(new Date());
  const [filters, setFilters] = useState({
    startDate: today,
    endDate: today,
    status: "",
    paymentMethod: "",
    shopifySyncStatus: "",
    paymentStatus: "",
    locationId: selectedLocationId || "",
    search: "",
  });
  const [searchInput, setSearchInput] = useState("");

  const [salesPagination, setSalesPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [deliveryPagination, setDeliveryPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [expensePagination, setExpensePagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  const canViewReports = permissions?.includes(PERMISSIONS.VIEW_REPORTS);
  const canViewExpenses = permissions?.includes(PERMISSIONS.VIEW_EXPENSES);
  const canViewDeliveries = permissions?.includes(PERMISSIONS.DELIVERY_FEES_READ);
  const canViewFinancialReports = permissions?.includes(PERMISSIONS.VIEW_FINANCIAL_REPORTS);
  const canCloseShift = permissions?.includes(PERMISSIONS.MANAGE_FINANCE);

  const effectiveLocationId = filters.locationId || selectedLocationId || "";

  const sortedShiftSessions = useMemo(() => {
    return [...shiftSessions].sort((left, right) => {
      const leftOpen = left.status === "open" ? 0 : 1;
      const rightOpen = right.status === "open" ? 0 : 1;
      if (leftOpen !== rightOpen) return leftOpen - rightOpen;
      return new Date(right.openedAt || 0) - new Date(left.openedAt || 0);
    });
  }, [shiftSessions]);

  const currentOpenShift = useMemo(() => {
    return openShiftSessions[0] || sortedShiftSessions.find((session) => session.status === "open") || null;
  }, [openShiftSessions, sortedShiftSessions]);

  const currentOpenShiftId = currentOpenShift?._id;
  const currentOpenShiftExpectedClosingCash = currentOpenShift?.expectedClosingCash;

  useEffect(() => {
    if (currentOpenShift) {
      setClosingCashInput(
        Number.isFinite(Number(currentOpenShiftExpectedClosingCash))
          ? Number(currentOpenShiftExpectedClosingCash).toFixed(2)
          : "0.00",
      );
    } else {
      setClosingCashInput("");
    }
  }, [currentOpenShift, currentOpenShiftExpectedClosingCash, currentOpenShiftId]);

  useEffect(() => {
    if (!canViewReports) {
      setLoading(false);
      return;
    }

    const fetchReports = async () => {
      try {
        setLoading(true);

        const { startDate, endDate } = getDateRangeParams(filters.startDate, filters.endDate);

        const summaryParams = new URLSearchParams({
          startDate,
          endDate,
          status: filters.status,
          timeBasis: "payment",
        });

        const salesParams = new URLSearchParams({
          startDate,
          endDate,
          status: filters.status,
          timeBasis: "payment",
          limit: String(salesPagination.limit),
          page: String(salesPagination.page),
        });

        if (filters.paymentMethod) summaryParams.append("paymentMethod", filters.paymentMethod);
        if (filters.paymentMethod) salesParams.append("paymentMethod", filters.paymentMethod);
        if (filters.shopifySyncStatus) summaryParams.append("shopifySyncStatus", filters.shopifySyncStatus);
        if (filters.shopifySyncStatus) salesParams.append("shopifySyncStatus", filters.shopifySyncStatus);
        if (filters.paymentStatus) summaryParams.append("paymentStatus", filters.paymentStatus);
        if (filters.paymentStatus) salesParams.append("paymentStatus", filters.paymentStatus);
        if (effectiveLocationId) summaryParams.append("locationId", effectiveLocationId);
        if (effectiveLocationId) salesParams.append("locationId", effectiveLocationId);
        if (filters.search) salesParams.append("search", filters.search);

        const deliveriesParams = new URLSearchParams({
          startDate,
          endDate,
          limit: String(deliveryPagination.limit),
          page: String(deliveryPagination.page),
        });
        if (effectiveLocationId) deliveriesParams.append("locationId", effectiveLocationId);

        const expenseListParams = new URLSearchParams({
          startDate,
          endDate,
          limit: String(expensePagination.limit),
          page: String(expensePagination.page),
        });
        if (effectiveLocationId) expenseListParams.append("locationId", effectiveLocationId);

        const expenseSummaryParams = new URLSearchParams({ startDate, endDate });
        if (effectiveLocationId) expenseSummaryParams.append("locationId", effectiveLocationId);

        const shiftListParams = new URLSearchParams({
          startDate,
          endDate,
          limit: "50",
          page: "1",
        });
        if (effectiveLocationId) shiftListParams.append("locationId", effectiveLocationId);

        const openShiftParams = new URLSearchParams({
          status: "open",
          limit: "10",
          page: "1",
        });
        if (effectiveLocationId) openShiftParams.append("locationId", effectiveLocationId);

        const fetchJson = async (url) => {
          try {
            return await apiFetch(url);
          } catch (fetchError) {
            return { __error: fetchError };
          }
        };

        const [summaryRes, salesRes, deliveryStatsRes, deliveryRowsRes, expenseSummaryRes, expenseRowsRes, shiftRowsRes, openShiftRowsRes] = await Promise.all([
          fetchJson(`/sales/reports/summary?${summaryParams.toString()}`),
          fetchJson(`/sales?${salesParams.toString()}`),
          canViewDeliveries ? fetchJson(`/delivery-fees/stats?${deliveriesParams.toString()}`) : Promise.resolve(null),
          canViewDeliveries ? fetchJson(`/delivery-fees?${deliveriesParams.toString()}`) : Promise.resolve(null),
          canViewExpenses ? fetchJson(`/expenses/summary?${expenseSummaryParams.toString()}`) : Promise.resolve(null),
          canViewExpenses ? fetchJson(`/expenses?${expenseListParams.toString()}`) : Promise.resolve(null),
          canViewFinancialReports ? fetchJson(`/shift-sessions?${shiftListParams.toString()}`) : Promise.resolve(null),
          canViewFinancialReports || canCloseShift ? fetchJson(`/shift-sessions?${openShiftParams.toString()}`) : Promise.resolve(null),
        ]);

        if (summaryRes?.__error) throw summaryRes.__error;
        if (salesRes?.__error) throw salesRes.__error;

        setReportData(summaryRes?.data || null);

        const salesData = salesRes?.data?.sales && Array.isArray(salesRes.data.sales)
          ? salesRes.data.sales
          : Array.isArray(salesRes?.data)
            ? salesRes.data
            : Array.isArray(salesRes)
              ? salesRes
              : [];
        setDetailedSales(salesData);

        const nextSalesPagination = salesRes?.data?.pagination || salesRes?.pagination || null;
        if (nextSalesPagination) {
          setSalesPagination((prev) => ({
            ...prev,
            total: nextSalesPagination.total || 0,
          }));
        }

        if (deliveryStatsRes?.data) {
          setDeliveryStats(deliveryStatsRes.data);
        } else {
          setDeliveryStats(null);
        }

        const nextDeliveryRows = toArrayResponse(deliveryRowsRes);
        setDeliveryRows(nextDeliveryRows);
        if (deliveryRowsRes?.pagination) {
          setDeliveryPagination((prev) => ({
            ...prev,
            total: deliveryRowsRes.pagination.total || 0,
          }));
        }

        if (expenseSummaryRes?.data) {
          setExpenseSummary(expenseSummaryRes.data);
        } else {
          setExpenseSummary(null);
        }

        const expenseItems = expenseRowsRes?.data?.items || [];
        setExpenseRows(expenseItems);
        if (expenseRowsRes?.data) {
          setExpensePagination((prev) => ({
            ...prev,
            total: expenseRowsRes.data.total || 0,
          }));
        }

        const nextShiftRows = shiftRowsRes?.data?.sessions || [];
        setShiftSessions(nextShiftRows);

        const nextOpenShiftRows = openShiftRowsRes?.data?.sessions || [];
        setOpenShiftSessions(nextOpenShiftRows);

        setError("");
      } catch (fetchError) {
        console.error("Failed to fetch reports:", fetchError);
        setError("Failed to load sales reports");
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [
    canCloseShift,
    canViewDeliveries,
    canViewExpenses,
    canViewFinancialReports,
    canViewReports,
    effectiveLocationId,
    filters.endDate,
    filters.paymentMethod,
    filters.paymentStatus,
    filters.search,
    filters.shopifySyncStatus,
    filters.startDate,
    filters.status,
    deliveryPagination.limit,
    deliveryPagination.page,
    expensePagination.limit,
    expensePagination.page,
    salesPagination.limit,
    salesPagination.page,
  ]);

  const handleFilterChange = (key, value) => {
    setFilters((previous) => {
      const updated = {
        ...previous,
        [key]: value,
      };

      if (key === "startDate" && value && updated.endDate && value > updated.endDate) {
        updated.endDate = value;
      }

      if (key === "endDate" && value && updated.startDate && value < updated.startDate) {
        updated.startDate = value;
      }

      return updated;
    });

    setSalesPagination((previous) => ({ ...previous, page: 1 }));
    setDeliveryPagination((previous) => ({ ...previous, page: 1 }));
    setExpensePagination((previous) => ({ ...previous, page: 1 }));
  };

  const handleDetailedSearch = () => {
    handleFilterChange("search", searchInput.trim());
  };

  const handleDetailedSearchKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleDetailedSearch();
    }
  };

  const clearDetailedSearch = () => {
    setSearchInput("");
    handleFilterChange("search", "");
  };

  const handleCloseCurrentShift = async (shift) => {
    if (!shift?._id) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Shift close is online-only.");
      return;
    }

    const closingCash = Number(closingCashInput);
    if (!Number.isFinite(closingCash)) {
      setError("Enter a valid counted till amount before closing the shift.");
      return;
    }

    if (!window.confirm(`Close shift ${shift.shiftCode}?`)) {
      return;
    }

    setShiftActionLoading(true);
    setError("");

    try {
      await apiFetch(`/shift-sessions/${shift._id}/close`, {
        method: "POST",
        body: {
          closingCash,
          notes: "Closed from POS reports overview",
        },
      });

      setLoading(true);
      const { startDate, endDate } = getDateRangeParams(filters.startDate, filters.endDate);
      const refreshParams = new URLSearchParams({
        startDate,
        endDate,
        limit: "50",
        page: "1",
      });
      if (effectiveLocationId) refreshParams.append("locationId", effectiveLocationId);

      const openParams = new URLSearchParams({
        status: "open",
        limit: "10",
        page: "1",
      });
      if (effectiveLocationId) openParams.append("locationId", effectiveLocationId);

      const [shiftRowsRes, openShiftRowsRes] = await Promise.all([
        apiFetch(`/shift-sessions?${refreshParams.toString()}`),
        apiFetch(`/shift-sessions?${openParams.toString()}`),
      ]);

      setShiftSessions(shiftRowsRes?.data?.sessions || []);
      setOpenShiftSessions(openShiftRowsRes?.data?.sessions || []);
    } catch (closeError) {
      console.error("Failed to close shift from reports:", closeError);
      setError(closeError?.message || "Failed to close shift");
    } finally {
      setShiftActionLoading(false);
      setLoading(false);
    }
  };

  const getSubtotalExcludingExchangeCredit = () => {
    if (!reportData) {
      return 0;
    }

    const exchangeCreditApplied = Number(reportData.exchangeCreditApplied) || 0;
    const grossPreDiscountSales = Number.isFinite(Number(reportData.preDiscountSales))
      ? Number(reportData.preDiscountSales)
      : (Number(reportData.totalRevenue) || 0) -
        (Number(reportData.deliveryAmountCollected) || 0) -
        (Number(reportData.totalTax) || 0) +
        (Number(reportData.totalDiscount) || 0) +
        exchangeCreditApplied;

    return Math.max(0, grossPreDiscountSales - exchangeCreditApplied);
  };

  const renderPagination = (pagination, onPrevious, onNext) => {
    const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / pagination.limit));

    if (totalPages <= 1) {
      return null;
    }

    return (
      <div className="flex items-center justify-between border-t border-zinc-200 px-6 py-4">
        <div className="text-sm text-zinc-600">
          Page {pagination.page} of {totalPages} ({pagination.total} total)
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPrevious}
            disabled={pagination.page === 1}
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={onNext}
            disabled={pagination.page === totalPages}
            className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  if (!canViewReports) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Sales Reports</h1>
        <p className="text-sm text-zinc-600">You don&apos;t have permission to view sales reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-900">Sales Reports</h1>
        <p className="mt-1 text-sm text-zinc-600">Advanced analytics and detailed sales insights</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h3 className="mb-4 font-semibold text-zinc-900">Report Filters</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <FieldLabel>Receipt # / Idempotency Key</FieldLabel>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                onKeyDown={handleDetailedSearchKeyDown}
                placeholder="Enter exact receipt number or idempotency key"
                className="block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleDetailedSearch}
                className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Search
              </button>
              {filters.search && (
                <button
                  type="button"
                  onClick={clearDetailedSearch}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-50"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <select
              value={filters.status}
              onChange={(event) => handleFilterChange("status", event.target.value)}
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
            <FieldLabel>Payment Status</FieldLabel>
            <select
              value={filters.paymentStatus}
              onChange={(event) => handleFilterChange("paymentStatus", event.target.value)}
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
            <FieldLabel>Shopify Sync</FieldLabel>
            <select
              value={filters.shopifySyncStatus}
              onChange={(event) => handleFilterChange("shopifySyncStatus", event.target.value)}
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
            <FieldLabel>Location</FieldLabel>
            <select
              value={filters.locationId}
              onChange={(event) => handleFilterChange("locationId", event.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Selected / all locations</option>
              {locationsMeta?.map((location) => (
                <option key={location._id} value={location._id}>
                  {location.name || location.shopifyLocationName || "Unknown"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <FieldLabel>Payment Method</FieldLabel>
            <select
              value={filters.paymentMethod}
              onChange={(event) => handleFilterChange("paymentMethod", event.target.value)}
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
            <FieldLabel>Start Date</FieldLabel>
            <input
              type="date"
              value={filters.startDate}
              onChange={(event) => handleFilterChange("startDate", event.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <FieldLabel>End Date</FieldLabel>
            <input
              type="date"
              value={filters.endDate}
              onChange={(event) => handleFilterChange("endDate", event.target.value)}
              className="mt-1 block w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="border-b border-zinc-200">
        <div className="flex gap-4 overflow-x-auto">
          <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={activeTab === "detailed-sales"} onClick={() => setActiveTab("detailed-sales")}>
            Detailed Sales
          </TabButton>
          {canViewDeliveries && (
            <TabButton active={activeTab === "detailed-deliveries"} onClick={() => setActiveTab("detailed-deliveries")}>
              Detailed Deliveries
            </TabButton>
          )}
          {canViewExpenses && (
            <TabButton active={activeTab === "detailed-expenses"} onClick={() => setActiveTab("detailed-expenses")}>
              Detailed Expenses
            </TabButton>
          )}
          <TabButton active={activeTab === "breakdown"} onClick={() => setActiveTab("breakdown")}>
            Payment Breakdown
          </TabButton>
        </div>
      </div>

      {activeTab === "detailed-sales" && filters.search && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-700">
          Detailed sales exact-match search: <span className="font-medium">{filters.search}</span>
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center">
          <p className="text-sm text-zinc-600">Loading reports...</p>
        </div>
      ) : activeTab === "overview" ? (
        <>
          {canViewFinancialReports && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-zinc-900">Shift Breakdown</h3>
                  <p className="mt-1 text-xs text-zinc-500">Current open shift first, then the rest of the selected range.</p>
                </div>
                {currentOpenShift ? (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                    Open shift available
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700">
                    No open shift
                  </span>
                )}
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Current open shift</p>
                      {currentOpenShift ? (
                        <>
                          <h4 className="mt-1 text-xl font-semibold text-zinc-900">{currentOpenShift.shiftCode}</h4>
                          <p className="mt-1 text-sm text-zinc-600">
                            Opened {new Date(currentOpenShift.openedAt).toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-sm text-zinc-600">No open shift for the selected location.</p>
                      )}
                    </div>
                    {currentOpenShift ? (
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          currentOpenShift.status === "open"
                            ? "bg-green-100 text-green-800"
                            : "bg-zinc-200 text-zinc-700"
                        }`}
                      >
                        {currentOpenShift.status}
                      </span>
                    ) : null}
                  </div>

                  {currentOpenShift ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-white bg-white p-3 shadow-sm">
                        <p className="text-xs text-zinc-500">Opening cash</p>
                        <p className="mt-1 text-lg font-semibold text-zinc-900">{currency(currentOpenShift.openingCash)}</p>
                      </div>
                      <div className="rounded-lg border border-white bg-white p-3 shadow-sm">
                        <p className="text-xs text-zinc-500">Expected cash sales</p>
                        <p className="mt-1 text-lg font-semibold text-zinc-900">{currency(currentOpenShift.expectedCashSales)}</p>
                      </div>
                      <div className="rounded-lg border border-white bg-white p-3 shadow-sm">
                        <p className="text-xs text-zinc-500">Cash expenses</p>
                        <p className="mt-1 text-lg font-semibold text-zinc-900">{currency(currentOpenShift.cashExpenseTotal)}</p>
                      </div>
                      <div className="rounded-lg border border-white bg-white p-3 shadow-sm">
                        <p className="text-xs text-zinc-500">Expected closing till</p>
                        <p className="mt-1 text-lg font-semibold text-zinc-900">{currency(currentOpenShift.expectedClosingCash)}</p>
                      </div>
                      <div className="rounded-lg border border-white bg-white p-3 shadow-sm sm:col-span-2">
                        <p className="text-xs text-zinc-500">Counted till / variance</p>
                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          <div>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={closingCashInput}
                              onChange={(event) => setClosingCashInput(event.target.value)}
                              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                              placeholder="Counted till amount"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
                            <span>
                              Variance: <strong>{currency(Number(closingCashInput || 0) - Number(currentOpenShift.expectedClosingCash || 0))}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCloseCurrentShift(currentOpenShift)}
                              disabled={shiftActionLoading || !canCloseShift}
                              className="rounded bg-zinc-900 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {shiftActionLoading ? "Closing..." : "Close open shift"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <h4 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Shifts in selected range</h4>
                  <div className="mt-4 space-y-3">
                    {sortedShiftSessions.length > 0 ? (
                      sortedShiftSessions.map((session, index) => (
                        <div
                          key={session._id}
                          className={`rounded-lg border p-3 ${
                            index === 0 && session.status === "open"
                              ? "border-green-200 bg-green-50"
                              : "border-zinc-200 bg-zinc-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-zinc-900">{session.shiftCode}</p>
                              <p className="text-xs text-zinc-500">
                                Opened {new Date(session.openedAt).toLocaleString()}
                                {session.closedAt ? ` · Closed ${new Date(session.closedAt).toLocaleString()}` : " · Still open"}
                              </p>
                            </div>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                session.status === "open"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-zinc-200 text-zinc-700"
                              }`}
                            >
                              {session.status}
                            </span>
                          </div>
                          <div className="mt-3 grid gap-2 text-sm text-zinc-600 sm:grid-cols-3">
                            <div>
                              <span className="block text-xs text-zinc-500">Expected closing</span>
                              <span className="font-medium text-zinc-900">{currency(session.expectedClosingCash)}</span>
                            </div>
                            <div>
                              <span className="block text-xs text-zinc-500">Cash expenses</span>
                              <span className="font-medium text-zinc-900">{currency(session.cashExpenseTotal)}</span>
                            </div>
                            <div>
                              <span className="block text-xs text-zinc-500">Variance</span>
                              <span className="font-medium text-zinc-900">{currency(session.cashVariance)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-zinc-200 p-6 text-sm text-zinc-500">
                        No shift sessions found for the selected date range.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {reportData ? (
            <>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <StatCard
                  label="Net Collected"
                  value={currency(reportData.totalRevenue)}
                  icon="💰"
                  tooltip="Total money received after exchange credits are deducted"
                />
                <StatCard
                  label="Gross Sales"
                  value={currency(reportData.grossRevenue || reportData.totalRevenue || 0)}
                  icon="🧾"
                  tooltip="Sum of item totals + tax + delivery − discounts (before exchange credits)"
                />
                <StatCard
                  label="Transactions"
                  value={reportData.totalSales || 0}
                  icon="📋"
                  tooltip="Count of sale transactions in the period"
                />
                <StatCard
                  label="Items Sold"
                  value={reportData.itemsSold?.total || 0}
                  icon="📦"
                  tooltip="Total quantity of items sold"
                />
                <StatCard
                  label="Avg Transaction"
                  value={currency(reportData.averageTransactionValue || 0)}
                  icon="📊"
                  tooltip="Average value collected per transaction"
                />
                <StatCard
                  label="Exchange Credit"
                  value={currency(reportData.exchangeCreditApplied || 0)}
                  icon="🔁"
                  tooltip="Amount paid using store/account credit (reduces net collected)"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 font-semibold text-zinc-900">Product Source</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">FLEXI Items</span>
                      <span className="text-lg font-semibold text-zinc-900">{reportData.itemsSold?.flexi || 0}</span>
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
                      <span className="text-lg font-semibold text-zinc-900">{reportData.itemsSold?.shopify || 0}</span>
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
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-600">Services</span>
                      <span className="text-lg font-semibold text-zinc-900">{reportData.itemsSold?.service || 0}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className="h-full bg-violet-600"
                        style={{
                          width: `${
                            reportData.itemsSold?.total > 0
                              ? ((reportData.itemsSold?.service || 0) / reportData.itemsSold.total) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                  <h3 className="mb-4 font-semibold text-zinc-900">Tax & Discounts</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-zinc-600"
                        title="Item subtotal excluding delivery and before exchange credits and discounts"
                      >
                        Subtotal (Excl. Exchange Credit)
                      </span>
                      <span className="font-semibold text-zinc-900">{currency(getSubtotalExcludingExchangeCredit())}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span
                        className="text-zinc-600"
                        title="Portion of prices that is tax when tax is included in item prices"
                      >
                        {reportData.taxDisplayMode === "exclusive"
                          ? "Tax (Exclusive)"
                          : reportData.taxDisplayMode === "mixed"
                            ? "Tax (Mixed Modes)"
                            : "Tax (Inclusive)"}
                      </span>
                      <span className="font-semibold text-zinc-900">{currency(reportData.totalTax || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600" title="Sum of all discounts applied across items/transactions">
                        Total Discount
                      </span>
                      <span className="font-semibold text-red-600">-{currency(reportData.totalDiscount || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600" title="Total exchange-credit used to pay sales">
                        Exchange Credit Applied
                      </span>
                      <span className="font-semibold text-indigo-600">{currency(reportData.exchangeCreditApplied || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-600" title="Total delivery fees collected">
                        Delivery Collected
                      </span>
                      <span className="font-semibold text-zinc-900">{currency(reportData.deliveryAmountCollected || 0)}</span>
                    </div>
                  </div>
                </div>

                {canViewExpenses && (
                  <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
                    <h3 className="mb-4 font-semibold text-zinc-900">Operating Expenses</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-600" title="Approved operating expenses in the period">
                          Approved Expenses
                        </span>
                        <span className="font-semibold text-red-600">-{currency(expenseSummary?.approvedExpenses || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-600" title="Non-approved operating expenses in the period">
                          Unapproved Expenses
                        </span>
                        <span className="font-semibold text-amber-600">-{currency(expenseSummary?.unapprovedExpenses || 0)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-600" title="Approved expenses only used in profit calculations">
                          Net Profit (after approved expenses)
                        </span>
                        <span className="font-semibold text-green-600">
                          {currency(
                            Number(reportData.netSalesExcludingTax || 0) - Number(expenseSummary?.approvedExpenses || 0),
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-600" title="Approved expenses ÷ Gross Sales shown as a percent">
                          Expense / Revenue
                        </span>
                        <span className="font-semibold text-zinc-900">
                          {formatPercent(
                            Number(reportData.grossRevenue || 0) > 0
                              ? ((Number(expenseSummary?.approvedExpenses || 0) / Number(reportData.grossRevenue || 1)) * 100)
                              : 0,
                          )}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
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
              <p className="mb-4 text-xs text-zinc-500">Percentages are based on gross sales value.</p>
              <div className="space-y-4">
                {Object.entries(reportData.paymentMethodBreakdown).map(([method, data]) => {
                  const grossRevenueBase = reportData.grossRevenue || reportData.totalRevenue || 0;
                  const percentage = grossRevenueBase > 0 ? (data.total / grossRevenueBase) * 100 : 0;

                  return (
                    <div key={method}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <div>
                          <span className="font-medium text-zinc-900 capitalize">{method}</span>
                          <span className="ml-2 text-xs text-zinc-500">({data.count} transactions)</span>
                        </div>
                        <span className="font-semibold text-zinc-900">
                          {currency(data.total)} ({percentage.toFixed(1)}%)
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
      ) : activeTab === "detailed-deliveries" ? (
        <>
          {deliveryStats ? (
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
              <StatCard label="Total Deliveries" value={deliveryStats.assignedCount + deliveryStats.unassignedCount || 0} icon="🚚" />
              <StatCard label="Revenue" value={currency(deliveryStats.totalRevenue || 0)} icon="💵" />
              <StatCard label="Assigned" value={deliveryStats.assignedCount || 0} icon="👤" />
              <StatCard label="Unassigned" value={deliveryStats.unassignedCount || 0} icon="📍" />
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            {deliveryRows.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-zinc-600">No delivery fees found for the selected period</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Tracking #</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Location</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Driver</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Fee</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {deliveryRows.map((delivery) => (
                      <tr key={delivery._id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4 text-sm font-medium text-zinc-900">
                          {delivery.trackingNumber || delivery._id.slice(-8)}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600">{new Date(delivery.createdAt).toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {delivery.locationId?.name || delivery.locationId?.shopifyLocationName || "Unknown"}
                        </td>
                        <td className="px-6 py-4 text-sm text-zinc-600 capitalize">{delivery.deliveryCategory || "N/A"}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600 capitalize">{delivery.categoryStatus || "N/A"}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600">{delivery.driverId?.name || "Unassigned"}</td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-zinc-900">
                          {currency(delivery.totalAmount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {renderPagination(
                  deliveryPagination,
                  () =>
                    setDeliveryPagination((previous) => ({
                      ...previous,
                      page: Math.max(1, previous.page - 1),
                    })),
                  () =>
                    setDeliveryPagination((previous) => ({
                      ...previous,
                      page: previous.page + 1,
                    })),
                )}
              </>
            )}
          </div>
        </>
      ) : activeTab === "detailed-expenses" ? (
        <>
          {expenseSummary ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total Expenses" value={currency(expenseSummary.totalExpenses || 0)} icon="🧾" />
              <StatCard label="Approved" value={currency(expenseSummary.approvedExpenses || 0)} icon="✅" />
              <StatCard label="Unapproved" value={currency(expenseSummary.unapprovedExpenses || 0)} icon="⏳" />
              <StatCard label="Expense Count" value={expenseSummary.totalCount || 0} icon="📋" />
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            {expenseRows.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-zinc-600">No expenses found for the selected period</p>
              </div>
            ) : (
              <>
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Payment Method</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Status</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {expenseRows.map((expense) => (
                      <tr key={expense._id} className="hover:bg-zinc-50">
                        <td className="px-6 py-4 text-sm text-zinc-600">{new Date(expense.expenseDate).toLocaleString()}</td>
                        <td className="px-6 py-4 text-sm font-medium text-zinc-900">{expense.category}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600">{expense.description}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600 capitalize">{expense.paymentMethod || "cash"}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600 capitalize">
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              expense.status === "approved"
                                ? "bg-green-100 text-green-800"
                                : expense.status === "submitted"
                                  ? "bg-blue-100 text-blue-800"
                                  : expense.status === "rejected"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-zinc-100 text-zinc-800"
                            }`}
                          >
                            {expense.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-semibold text-zinc-900">
                          {currency(expense.amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {renderPagination(
                  expensePagination,
                  () =>
                    setExpensePagination((previous) => ({
                      ...previous,
                      page: Math.max(1, previous.page - 1),
                    })),
                  () =>
                    setExpensePagination((previous) => ({
                      ...previous,
                      page: previous.page + 1,
                    })),
                )}
              </>
            )}
          </div>
        </>
      ) : (
        <>
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
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Receipt #</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Payment</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Items</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Amount Paid</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200">
                    {detailedSales.map((sale) => (
                      <tr
                        key={sale._id}
                        onClick={() => router.push(`/dashboard/sales/${sale._id}`)}
                        className="cursor-pointer hover:bg-zinc-50"
                      >
                        <td className="px-6 py-4 text-sm font-medium text-blue-600 hover:underline">{sale.receiptNumber}</td>
                        <td className="px-6 py-4 text-sm text-zinc-600">
                          {new Date(sale.lastPaymentAtInRange || sale.createdAt).toLocaleString()}
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
                          {currency(
                            typeof sale.amountPaidInRange === "number" ? sale.amountPaidInRange : sale.totalAmount,
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                              sale.status === "completed" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {sale.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {renderPagination(
                  salesPagination,
                  () =>
                    setSalesPagination((previous) => ({
                      ...previous,
                      page: Math.max(1, previous.page - 1),
                    })),
                  () =>
                    setSalesPagination((previous) => ({
                      ...previous,
                      page: previous.page + 1,
                    })),
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}