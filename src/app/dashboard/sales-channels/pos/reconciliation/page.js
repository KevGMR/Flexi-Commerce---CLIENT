"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function ReconciliationPage() {
  const can = useSessionStore((s) => s.can);
  const selectedLocationId = useSessionStore((s) => s.selectedLocationId);
  const locationsMeta = useSessionStore((s) => s.locationsMeta);

  const canManage = can(PERMISSIONS.MANAGE_FINANCE);
  const [locationId, setLocationId] = useState(selectedLocationId || "");
  const [reconciliationDate, setReconciliationDate] = useState(new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const offline = useMemo(() => typeof navigator !== "undefined" && !navigator.onLine, []);

  const loadSessions = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const result = await apiFetch(`/reconciliation/sessions?locationId=${locationId}&limit=20`);
      setSessions(result?.data?.sessions || []);
    } catch (err) {
      setError(err?.message || "Failed to load reconciliation sessions");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (locationId) {
      loadSessions();
    }
  }, [locationId, loadSessions]);

  const createSession = async () => {
    if (!locationId) {
      setError("Please select a location");
      return;
    }
    if (offline) {
      setError("Reconciliation session creation is online-only.");
      return;
    }

    setError("");
    setMessage("");
    try {
      await apiFetch("/reconciliation/sessions", {
        method: "POST",
        body: {
          locationId,
          startDate: reconciliationDate,
          endDate: reconciliationDate,
          varianceThreshold: 0,
        },
      });
      setMessage("Reconciliation session created");
      await loadSessions();
    } catch (err) {
      setError(err?.message || "Failed to create reconciliation session");
    }
  };

  const submitSession = async (session) => {
    if (offline) {
      setError("Reconciliation submission is online-only.");
      return;
    }
    setError("");
    setMessage("");

    const counts = (session.expectedByMethod || []).map((row) => ({
      method: row.method,
      countedAmount: row.expectedAmount,
      settledAmount: row.expectedAmount,
    }));

    try {
      await apiFetch(`/reconciliation/sessions/${session._id}/submit`, {
        method: "POST",
        body: {
          counts,
          notes: "Auto-settled using expected values",
        },
      });
      setMessage(`Reconciliation submitted for ${session.sessionCode}`);
      await loadSessions();
    } catch (err) {
      setError(err?.message || "Failed to submit reconciliation");
    }
  };

  if (!canManage) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Reconciliation</h1>
        <p className="text-sm text-zinc-600">You don&apos;t have permission to manage reconciliations.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Reconciliation</h1>
        <p className="mt-1 text-sm text-zinc-600">Create and submit one daily accountant check per location, with all shifts linked into the same day.</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          >
            <option value="">Select location</option>
            {(locationsMeta || []).map((loc) => (
              <option key={loc._id} value={loc._id}>
                {loc.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={reconciliationDate}
            onChange={(e) => setReconciliationDate(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
          <button
            onClick={createSession}
            className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Create Day Check
          </button>
        </div>
        {message ? <div className="mt-3 text-sm text-green-700">{message}</div> : null}
        {error ? <div className="mt-3 text-sm text-red-700">{error}</div> : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800">Recent Sessions</div>
        {loading ? (
          <div className="p-4 text-sm text-zinc-500">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No reconciliation sessions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-600">
                <tr>
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">Window</th>
                  <th className="px-4 py-3">Shifts</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Variance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session._id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900">{session.sessionCode}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {(session.shiftBreakdown || []).slice(0, 3).map((shift) => shift.shiftCode).join(", ")}
                        {(session.shiftBreakdown || []).length > 3 ? "..." : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(session.windowStart).toLocaleDateString()} - {new Date(session.windowEnd).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{(session.shiftSessionIds || session.shiftBreakdown || []).length}</td>
                    <td className="px-4 py-3">{Number(session.totalExpected || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{Number(session.totalVariance || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{session.status}</td>
                    <td className="px-4 py-3 space-x-3">
                      <Link
                        href={`/dashboard/sales-channels/pos/reconciliation/${session._id}`}
                        className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                      >
                        View transactions
                      </Link>
                      {session.status === "open" ? (
                        <button
                          onClick={() => submitSession(session)}
                          className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                        >
                          Auto Submit
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
