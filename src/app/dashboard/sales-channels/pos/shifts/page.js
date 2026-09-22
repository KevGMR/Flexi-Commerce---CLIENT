"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function ShiftSessionsPage() {
  const can = useSessionStore((s) => s.can);
  const selectedLocationId = useSessionStore((s) => s.selectedLocationId);
  const locationsMeta = useSessionStore((s) => s.locationsMeta);

  const canOpen = can(PERMISSIONS.CREATE_SALE);
  const canClose = can(PERMISSIONS.MANAGE_FINANCE);

  const [locationId, setLocationId] = useState(selectedLocationId || "");
  const [loading, setLoading] = useState(false);
  const [currentShift, setCurrentShift] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [preview, setPreview] = useState(null);
  const [openingCash, setOpeningCash] = useState(0);
  const [closingCash, setClosingCash] = useState(0);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const offline = useMemo(() => typeof navigator !== "undefined" && !navigator.onLine, []);

  const loadData = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    setError("");
    try {
      const [currentRes, listRes] = await Promise.all([
        apiFetch(`/shift-sessions/current?locationId=${locationId}`),
        apiFetch(`/shift-sessions?locationId=${locationId}&limit=20`),
      ]);
      setCurrentShift(currentRes?.data || null);
      setSessions(listRes?.data?.sessions || []);
      setPreview(null);
    } catch (err) {
      setError(err?.message || "Failed to load shift sessions");
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    if (locationId) {
      loadData();
    }
  }, [locationId, loadData]);

  const handleOpen = async () => {
    if (!locationId) {
      setError("Please select a location");
      return;
    }
    if (offline) {
      setError("Shift open is online-only.");
      return;
    }
    setError("");
    setMessage("");
    try {
      await apiFetch("/shift-sessions/open", {
        method: "POST",
        body: {
          locationId,
          openingCash: Number(openingCash) || 0,
          notes,
        },
      });
      setMessage("Shift opened successfully");
      setNotes("");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to open shift");
    }
  };

  const handleClose = async () => {
    if (!currentShift?._id) return;
    if (offline) {
      setError("Shift close is online-only.");
      return;
    }
    setError("");
    setMessage("");
    try {
      // load preview data for current shift if available
      if (currentShift?._id) {
        try {
          const pv = await apiFetch(`/shift-sessions/${currentShift._id}/preview`);
          setPreview(pv?.data || null);
        } catch (e) {
          setPreview(null);
        }
      }
      await apiFetch(`/shift-sessions/${currentShift._id}/close`, {
        method: "POST",
        body: {
          closingCash: Number(closingCash) || 0,
          notes,
        },
      });
      setMessage("Shift closed successfully");
      setNotes("");
      setClosingCash(0);
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to close shift");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Shift Sessions</h1>
        <p className="mt-1 text-sm text-zinc-600">Open, monitor, and close cashier shifts by location.</p>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
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

          {!currentShift ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
              placeholder="Opening till amount"
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          ) : (
            <div className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-500">
              Opening till hidden — active shift exists
            </div>
          )}

          {currentShift ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={closingCash}
              onChange={(e) => setClosingCash(e.target.value)}
              placeholder="Counted till amount"
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          ) : (
            <div className="rounded border border-zinc-300 px-3 py-2 text-sm text-zinc-400">
              Counted till hidden
            </div>
          )}

          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="rounded border border-zinc-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          {canOpen && !currentShift ? (
            <button
              onClick={handleOpen}
              className="rounded bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Open Shift
            </button>
          ) : null}
          {canClose && currentShift ? (
            <button
              onClick={handleClose}
              className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Close Current Shift With Counted Till
            </button>
          ) : null}
        </div>

        {currentShift ? (
          <div className="text-sm text-zinc-600 space-y-2">
            <div>
              Active shift <strong>{currentShift.shiftCode}</strong> opened with <strong>{Number(currentShift.openingCash || 0).toFixed(2)}</strong>.
            </div>
            <div>
              Expected cash sales: <strong>{preview ? Number(preview.expectedCashSales).toFixed(2) : "-"}</strong>
              , cash expenses: <strong>{preview ? Number(preview.cashExpenseTotal).toFixed(2) : "-"}</strong>
            </div>
            <div>
              Expected closing till: <strong>{preview ? Number(preview.expectedClosingCash).toFixed(2) : "-"}</strong>
            </div>
            <div>
              Counted till: <strong>{Number(closingCash || 0).toFixed(2)}</strong>
              , variance: <strong>{preview ? (Number(closingCash || 0) - Number(preview.expectedClosingCash)).toFixed(2) : "-"}</strong>
            </div>
          </div>
        ) : null}

        {message ? <div className="text-sm text-green-700">{message}</div> : null}
        {error ? <div className="text-sm text-red-700">{error}</div> : null}
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-800">Recent Sessions</div>
        {loading ? (
          <div className="p-4 text-sm text-zinc-500">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="p-4 text-sm text-zinc-500">No shift sessions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-600">
                <tr>
                  <th className="px-4 py-3">Shift Code</th>
                  <th className="px-4 py-3">Opened</th>
                  <th className="px-4 py-3">Closed</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Cash Expenses</th>
                  <th className="px-4 py-3">Variance</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session._id} className="border-t border-zinc-100">
                    <td className="px-4 py-3">{session.shiftCode}</td>
                    <td className="px-4 py-3">{new Date(session.openedAt).toLocaleString()}</td>
                    <td className="px-4 py-3">{session.closedAt ? new Date(session.closedAt).toLocaleString() : "-"}</td>
                    <td className="px-4 py-3">{session.status}</td>
                    <td className="px-4 py-3">{Number(session.cashExpenseTotal || 0).toFixed(2)}</td>
                    <td className="px-4 py-3">{Number(session.cashVariance || 0).toFixed(2)}</td>
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
