"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";
import { apiFetch } from "@/lib/api-client";

function StatCard({ label, value, icon, color }) {
  const colors = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-50 text-gray-700",
  };
  return (
    <div className={`rounded-lg p-4 ${colors[color] || colors.gray}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function ShiftBackdateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const shiftId = params?.id;
  const { can, activeOrganization, locationsMeta } = useSessionStore();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  
  if (hydrated && !can(PERMISSIONS.BACKDATE_SALES)) {
    router.push("/dashboard");
    return null;
  }

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState(null);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [deliveryFees, setDeliveryFees] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [zReports, setZReports] = useState([]);
  const [summary, setSummary] = useState({});
  const [error, setError] = useState("");

  const [targetDate, setTargetDate] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState(null);
  const [applying, setApplying] = useState(false);
  const [dryRun, setDryRun] = useState(true);

  const loadShiftDetail = useCallback(async () => {
    if (!shiftId) return;
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`/admin/shifts-for-backdate/${shiftId}`);
      if (res?.data) {
        setShift(res.data.shift);
        setSales(res.data.sales || []);
        setExpenses(res.data.expenses || []);
        setDeliveryFees(res.data.deliveryFees || []);
        setReceivables(res.data.receivables || []);
        setZReports(res.data.zReports || []);
        setSummary(res.data.summary || {});
        // Set default target date (today)
        if (!targetDate) {
          const now = new Date();
          setTargetDate(now.toISOString().slice(0, 16));
        }
      }
    } catch (err) {
      console.error("Failed to load shift detail:", err);
      setError("Failed to load shift detail");
    } finally {
      setLoading(false);
    }
  }, [shiftId]);

  useEffect(() => {
    loadShiftDetail();
  }, [loadShiftDetail]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString();
  };

  const handlePreview = async () => {
    if (!targetDate) {
      setError("Please select a target date");
      return;
    }
    setApplying(true);
    setError("");
    setPreview(null);
    try {
      const res = await apiFetch(`/admin/backdate-shift`, {
        method: "POST",
        body: {
          shiftId,
          targetDate,
          dryRun: true,
          notes,
        },
      });
      if (res?.data) {
        setPreview(res.data);
        setDryRun(true);
      } else {
        setError(res?.message || "Preview failed");
      }
    } catch (err) {
      setError(err.message || "Failed to preview backdate");
    } finally {
      setApplying(false);
    }
  };

  const handleApply = async () => {
    if (!targetDate) {
      setError("Please select a target date");
      return;
    }
    if (!window.confirm(`Are you sure you want to backdate shift ${shift?.shiftCode} to ${new Date(targetDate).toLocaleString()}? This will affect all sales, expenses, deliveries, receivables, and Z-reports.`)) {
      return;
    }
    setApplying(true);
    setError("");
    setPreview(null);
    try {
      const res = await apiFetch(`/admin/backdate-shift`, {
        method: "POST",
        body: {
          shiftId,
          targetDate,
          dryRun: false,
          notes,
        },
      });
      if (res?.data) {
        setPreview(res.data);
        setDryRun(false);
        // Reload shift detail after apply
        await loadShiftDetail();
      } else {
        setError(res?.message || "Apply failed");
      }
    } catch (err) {
      setError(err.message || "Failed to apply backdate");
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Loading shift details...</div>;
  }

  if (error && !shift) {
    return <div className="p-6 text-red-600">{error}</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Shift Backdate: {shift?.shiftCode}</h1>
          <p className="text-sm text-gray-600">
            {shift?.status === "open" ? "🟢 Open" : "🔒 Closed"} · Opened {formatDate(shift?.openedAt)}
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard/settings/backdate-sales")}
          className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50"
        >
          ← Back to Shifts
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Sales" value={summary.salesCount || 0} icon="🧾" color="blue" />
        <StatCard label="Total Revenue" value={formatCurrency(summary.totalSales || 0)} icon="💰" color="green" />
        <StatCard label="Expenses" value={formatCurrency(summary.totalExpenses || 0)} icon="💳" color="yellow" />
        <StatCard label="Expected Cash Sales" value={formatCurrency(shift?.expectedCashSales || 0)} icon="📊" color="gray" />
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Section title="Sales">
          {sales.length === 0 ? (
            <p className="text-gray-500">No sales in this shift</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {sales.slice(0, 20).map((sale) => (
                <li key={sale._id} className="flex justify-between text-sm border-b pb-1">
                  <span>{sale.receiptNumber}</span>
                  <span className="font-semibold">{formatCurrency(sale.totalAmount)}</span>
                </li>
              ))}
              {sales.length > 20 && <li className="text-xs text-gray-500">... and {sales.length - 20} more</li>}
            </ul>
          )}
        </Section>

        <Section title="Expenses">
          {expenses.length === 0 ? (
            <p className="text-gray-500">No expenses in this shift</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {expenses.slice(0, 20).map((exp) => (
                <li key={exp._id} className="flex justify-between text-sm border-b pb-1">
                  <span>{exp.category}: {exp.description}</span>
                  <span className="font-semibold">{formatCurrency(exp.amount)}</span>
                </li>
              ))}
              {expenses.length > 20 && <li className="text-xs text-gray-500">... and {expenses.length - 20} more</li>}
            </ul>
          )}
        </Section>

        <Section title="Delivery Fees">
          {deliveryFees.length === 0 ? (
            <p className="text-gray-500">No deliveries in this shift</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {deliveryFees.slice(0, 20).map((df) => (
                <li key={df._id} className="flex justify-between text-sm border-b pb-1">
                  <span>{df.recipientName || "Unnamed"}</span>
                  <span className="font-semibold">{formatCurrency(df.totalAmount || df.amount)}</span>
                </li>
              ))}
              {deliveryFees.length > 20 && <li className="text-xs text-gray-500">... and {deliveryFees.length - 20} more</li>}
            </ul>
          )}
        </Section>

        <Section title="Z-Reports">
          {zReports.length === 0 ? (
            <p className="text-gray-500">No Z-reports for this shift</p>
          ) : (
            <ul className="space-y-2 max-h-48 overflow-y-auto">
              {zReports.map((zr) => (
                <li key={zr._id} className="flex justify-between text-sm border-b pb-1">
                  <span>{zr.reportCode}</span>
                  <span className="text-xs text-gray-500">{formatDate(zr.reportDate)}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Backdate Form */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Backdate this shift</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Target Date/Time (UTC)</label>
            <input
              type="datetime-local"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for backdate"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <button
            onClick={handlePreview}
            disabled={applying}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {applying ? "Loading..." : "Preview"}
          </button>
          <button
            onClick={handleApply}
            disabled={applying}
            className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {applying ? "Applying..." : "Apply Backdate"}
          </button>
          <button
            onClick={() => router.push("/dashboard/settings/backdate-history")}
            className="px-6 py-2 border rounded-md text-sm hover:bg-gray-50"
          >
            View History
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {preview && (
          <div className="mt-6 border-t pt-4">
            <h4 className="font-semibold text-gray-900 mb-2">
              {preview.dryRun ? "🔍 Preview Results" : "✅ Backdate Applied"}
            </h4>
            {preview.dryRun ? (
              <div className="space-y-2 text-sm">
                <p><strong>Shift:</strong> {preview.data?.shiftCode} → {formatDate(preview.data?.newShiftOpenedAt)}</p>
                <p><strong>Sales to update:</strong> {preview.data?.sales?.length || 0}</p>
                <p><strong>Receivables:</strong> {preview.data?.receivables?.length || 0}</p>
                <p><strong>Expenses:</strong> {preview.data?.expenses?.length || 0}</p>
                <p><strong>Delivery Fees:</strong> {preview.data?.deliveryFees?.length || 0}</p>
                <p><strong>Z-Reports:</strong> {preview.data?.zReports?.length || 0}</p>
                <div className="mt-2 text-xs text-gray-500">
                  Scroll down for a detailed list.
                </div>
                {preview.data?.sales?.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-blue-600">Show affected sales</summary>
                    <ul className="mt-2 max-h-40 overflow-y-auto border rounded p-2 bg-gray-50 space-y-1">
                      {preview.data.sales.map((sale, idx) => (
                        <li key={idx} className="text-xs flex justify-between">
                          <span>{sale.receiptNumber}</span>
                          <span>{formatDate(sale.originalCreatedAt)} → {formatDate(sale.shiftedCreatedAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <div className="text-sm space-y-2">
                <p><strong>✅ Successfully backdated!</strong></p>
                <p><strong>History ID:</strong> {preview.data?.historyId}</p>
                <p><strong>Sales updated:</strong> {preview.data?.salesUpdated || 0}</p>
                <p><strong>Expenses updated:</strong> {preview.data?.expensesUpdated || 0}</p>
                <p><strong>Delivery fees updated:</strong> {preview.data?.deliveryFeesUpdated || 0}</p>
                <p><strong>Receivables updated:</strong> {preview.data?.receivablesUpdated || 0}</p>
                <p><strong>Z-Reports updated:</strong> {preview.data?.zReportsUpdated || 0}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}