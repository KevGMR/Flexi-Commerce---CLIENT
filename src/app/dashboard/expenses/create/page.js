"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function CreateExpensePage() {
  const router = useRouter();
  const can = useSessionStore((s) => s.can);
  const locationsMeta = useSessionStore((s) => s.locationsMeta);
  const selectedLocationId = useSessionStore((s) => s.selectedLocationId);

  const canCreate = can(PERMISSIONS.CREATE_EXPENSES);

  const [loading, setLoading] = useState(false);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [currentShift, setCurrentShift] = useState(null);

  const [form, setForm] = useState({
    locationId: selectedLocationId || "",
    expenseDate: new Date().toISOString().slice(0, 10),
    category: "",
    description: "",
    amount: "",
    paymentMethod: "cash",
    paymentStatus: "paid",
    status: "draft",
    vendorName: "",
    reference: "",
  });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    let active = true;

    const loadCurrentShift = async () => {
      if (!form.locationId) {
        setCurrentShift(null);
        return;
      }

      setShiftLoading(true);
      try {
        const response = await apiFetch(`/shift-sessions/current?locationId=${form.locationId}`);
        if (active) {
          setCurrentShift(response?.data || null);
        }
      } catch {
        if (active) {
          setCurrentShift(null);
        }
      } finally {
        if (active) {
          setShiftLoading(false);
        }
      }
    };

    loadCurrentShift();

    return () => {
      active = false;
    };
  }, [form.locationId]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setStatusMessage("");

    if (!form.locationId || !form.expenseDate || !form.category || !form.description) {
      setError("Location, date, category, and description are required.");
      return;
    }

    if (Number(form.amount) <= 0) {
      setError("Amount must be greater than 0.");
      return;
    }

    if (form.paymentMethod === "cash" && !currentShift?._id) {
      setError("Cash expenses require an open shift for this location.");
      return;
    }

    try {
      setLoading(true);

      if (typeof navigator !== "undefined" && !navigator.onLine && form.status === "submitted") {
        setError("Submitting an expense is online-only.");
        setLoading(false);
        return;
      }

      const response = await apiFetch("/expenses", {
        method: "POST",
        body: {
          locationId: form.locationId,
          expenseDate: form.expenseDate,
          category: form.category,
          description: form.description,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          paymentStatus: form.paymentStatus,
          status: form.status,
          vendorName: form.vendorName || undefined,
          reference: form.reference || undefined,
        },
      });

      const posting = response?.data?.accountingPosting;
      if (posting?.posted) {
        setStatusMessage("Expense created and posted to accounting.");
      } else {
        const warningMessage =
          posting?.warningType === "period_locked"
            ? "Expense created. Accounting period is locked; posting was skipped."
            : posting?.warningType === "period_closed"
              ? "Expense created. Accounting period is closed; posting was skipped."
              : posting?.warningType === "period_missing"
                ? "Expense created. No accounting period covers this date; posting was skipped."
                : "Expense created. Posting will happen on approval.";

        setStatusMessage(warningMessage);
      }

      setForm((prev) => ({
        ...prev,
        category: "",
        description: "",
        amount: "",
        vendorName: "",
        reference: "",
      }));
    } catch (err) {
      setError(err?.message || "Failed to create expense.");
    } finally {
      setLoading(false);
    }
  };

  if (!canCreate) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Create Expense</h1>
        <p className="text-sm text-zinc-600">You don&apos;t have permission to create expenses.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Create Expense</h1>
          <p className="mt-1 text-sm text-zinc-600">Record a new expense and post it to accounting.</p>
        </div>
        <button
          onClick={() => router.push("/dashboard/expenses")}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to Expenses
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        {error ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : null}

        {statusMessage ? (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{statusMessage}</div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-700">Location *</label>
            <select
              name="locationId"
              value={form.locationId}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              required
            >
              <option value="">Select location</option>
              {(locationsMeta || []).map((loc) => (
                <option key={loc._id} value={loc._id}>
                  {loc.name}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-zinc-500">
              {shiftLoading
                ? "Checking open shift..."
                : currentShift?._id
                  ? `Open shift: ${currentShift.shiftCode}`
                  : "Cash expenses require an open shift before submission."}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700">Expense Date *</label>
            <input
              type="date"
              name="expenseDate"
              value={form.expenseDate}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-700">Category *</label>
            <input
              name="category"
              value={form.category}
              onChange={handleChange}
              placeholder="e.g. utilities, rent, fuel"
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700">Amount *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              name="amount"
              value={form.amount}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-700">Description *</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={3}
            className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-xs font-medium text-zinc-700">Payment Method</label>
            <select
              name="paymentMethod"
              value={form.paymentMethod}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile">Mobile</option>
              <option value="mpesa">M-Pesa</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="check">Check</option>
              <option value="credit">Credit</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700">Payment Status</label>
            <select
              name="paymentStatus"
              value={form.paymentStatus}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700">Workflow Status</label>
            <select
              name="status"
              value={form.status}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-zinc-700">Vendor</label>
            <input
              name="vendorName"
              value={form.vendorName}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-700">Reference</label>
            <input
              name="reference"
              value={form.reference}
              onChange={handleChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {loading ? "Saving..." : "Create Expense"}
          </button>
        </div>
      </form>
    </div>
  );
}
