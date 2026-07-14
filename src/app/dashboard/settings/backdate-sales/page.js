"use client";

import { useState, useEffect } from "react";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";

export default function BackdateSalesPage() {
  const router = useRouter();
  const { can, activeOrganization } = useSessionStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);
  if (hydrated && !can(PERMISSIONS.BACKDATE_SALES)) {
    router.push("/dashboard");
    return null;
  }

  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState({
    organizationId: "",
    locationId: "",
    startDateTime: "",
    endDateTime: "",
    targetDate: "",
    modifiedBy: "",
    sampleSize: 20,
  });

  const [preview, setPreview] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [isDryRun, setIsDryRun] = useState(true);
  const [showRawOutput, setShowRawOutput] = useState(false);

  // Auto-set organization from session
  useEffect(() => {
    if (activeOrganization?._id) {
      setFormData((prev) => ({
        ...prev,
        organizationId: activeOrganization._id,
      }));
      fetchLocations();
    }
  }, [activeOrganization]);

  // Fetch users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await apiFetch("/users");
        setUsers(usersData?.data?.users || []);
      } catch (err) {
        setError("Failed to load users: " + err.message);
      }
    };
    loadUsers();
  }, []);

  const fetchLocations = async () => {
    if (!activeOrganization?._id) return;
    try {
      const data = await apiFetch("/locations");
      const locationList = Array.isArray(data) ? data : data?.locations || [];
      setLocations(locationList);
    } catch (err) {
      setError("Failed to load locations: " + err.message);
    }
  };

  // Set default date values
  useEffect(() => {
    if (formData.organizationId) {
      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };

      if (!formData.startDateTime) {
        setFormData((prev) => ({
          ...prev,
          startDateTime: formatDate(yesterday),
          endDateTime: formatDate(now),
          targetDate: formatDate(yesterday),
        }));
      }
    }
  }, [formData.organizationId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPreview(null);
    setResults(null);

    try {
      const params = new URLSearchParams({
        organizationId: formData.organizationId,
        startDateTime: formData.startDateTime,
        endDateTime: formData.endDateTime,
        targetDate: formData.targetDate,
        sampleSize: String(formData.sampleSize),
        dryRun: String(isDryRun),
        apply: String(!isDryRun),
      });
      if (formData.locationId) params.append("locationId", formData.locationId);
      if (!isDryRun && formData.modifiedBy) params.append("modifiedBy", formData.modifiedBy);

      const data = await apiFetch(`/admin/backdate-sales?${params}`, {
        method: "GET",
        retryOn401: true,
      });

      console.log("[Backdate] Full API response:", JSON.stringify(data, null, 2));

      if (isDryRun) {
        setPreview(data);
      } else {
        setResults(data);
      }
    } catch (err) {
      console.error("[Backdate] Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper to format date nicely
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "Invalid Date";
      return d.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  // Robust parsing of sampleRows
  const getSampleRows = (data) => {
    if (!data) return [];
    let rows = data.sampleRows;
    if (!rows) return [];

    // If rows is not an array, convert from object to array
    if (!Array.isArray(rows)) {
      rows = Object.values(rows);
    }

    // Filter out any rows that are not valid sale rows
    const validRows = rows.filter(row => {
      if (!row || typeof row !== 'object') return false;
      // Check if it has at least one of the expected fields (saleId, id, or index 0 if array)
      if (Array.isArray(row)) {
        return row.length >= 2 && row[0]; // at least saleId and a date
      }
      return (row.saleId || row.id || row._id) && (row.beforeCreatedAtUtc || row.beforeDate);
    });

    console.log("[Backdate] Valid rows after filtering:", validRows.length);

    return validRows.map((row, index) => {
      if (Array.isArray(row)) {
        return {
          saleId: row[0] || `sale-${index}`,
          beforeCreatedAtUtc: row[1] || null,
          afterCreatedAtUtc: row[2] || null,
          beforeShiftId: row[3] || null,
          afterShiftId: row[4] || "unchanged",
        };
      }
      return {
        saleId: row.saleId || row.id || row._id || `sale-${index}`,
        beforeCreatedAtUtc: row.beforeCreatedAtUtc || row.beforeDate || null,
        afterCreatedAtUtc: row.afterCreatedAtUtc || row.afterDate || null,
        beforeShiftId: row.beforeShiftId || row.beforeShift || null,
        afterShiftId: row.afterShiftId || row.afterShift || "unchanged",
      };
    });
  };

  const sampleRows = preview ? getSampleRows(preview) : [];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Backdate Sales</h1>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6 rounded">
        <p className="text-yellow-700 text-sm">
          ⚠️ This operation permanently changes sale dates and affects shift totals,
          Z-reports, and receivables. Always run a dry-run first.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* Organization */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Organization</label>
          <div className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700">
            {activeOrganization?.name || "Loading..."}
            <input type="hidden" name="organizationId" value={formData.organizationId} />
          </div>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-gray-700">Location (optional)</label>
          <select
            value={formData.locationId}
            onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          >
            <option value="">All Locations</option>
            {locations.map((loc) => (
              <option key={loc._id || loc.id} value={loc._id || loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Start Date/Time (UTC) *</label>
            <input
              type="datetime-local"
              value={formData.startDateTime}
              onChange={(e) => setFormData({ ...formData, startDateTime: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Date/Time (UTC) *</label>
            <input
              type="datetime-local"
              value={formData.endDateTime}
              onChange={(e) => setFormData({ ...formData, endDateTime: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            />
          </div>
        </div>

        {/* Target Date and User */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Target Date (UTC) *</label>
            <input
              type="datetime-local"
              value={formData.targetDate}
              onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Modified By {!isDryRun && "*"}
            </label>
            <select
              value={formData.modifiedBy}
              onChange={(e) => setFormData({ ...formData, modifiedBy: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              required={!isDryRun}
              disabled={isDryRun}
            >
              <option value="">Select User</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>{u.fullname} ({u.email})</option>
              ))}
            </select>
            {isDryRun && (
              <p className="mt-1 text-xs text-gray-500">User will be required when applying changes.</p>
            )}
          </div>
        </div>

        {/* Sample Size & Mode */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700">Sample Size</label>
            <input
              type="number"
              min="1"
              max="100"
              value={formData.sampleSize}
              onChange={(e) => setFormData({ ...formData, sampleSize: parseInt(e.target.value) || 20 })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-gray-700">Mode</span>
            <div className="mt-1 flex space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={isDryRun}
                  onChange={() => {
                    setIsDryRun(true);
                    setFormData({ ...formData, modifiedBy: "" });
                  }}
                  className="form-radio text-blue-600"
                />
                <span className="ml-2 text-sm">Dry Run</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={!isDryRun}
                  onChange={() => setIsDryRun(false)}
                  className="form-radio text-red-600"
                />
                <span className="ml-2 text-sm text-red-700">Apply</span>
              </label>
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading || !formData.organizationId}
              className={`w-full py-2 px-4 rounded-md text-white font-medium ${
                loading ? "bg-gray-400 cursor-not-allowed" :
                !formData.organizationId ? "bg-gray-300 cursor-not-allowed" :
                isDryRun ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {loading ? "Processing..." : isDryRun ? "🔍 Dry Run" : "⚠️ Apply Changes"}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div className="mt-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <strong>Error:</strong> {error}
        </div>
      )}

      {preview && (
        <div className="mt-8">
          <div className="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-blue-800">🔍 Dry Run Preview</h3>
            <p className="text-sm text-blue-700">No changes made. Review the preview below.</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <Stat label="Sales Scanned" value={preview.stats?.salesScanned || 0} />
            <Stat label="Matched" value={preview.stats?.salesMatched || 0} color="blue" />
            <Stat label="Would Update" value={preview.stats?.salesWouldUpdate || 0} color="blue" />
            <Stat label="Unchanged" value={preview.stats?.salesUnchanged || 0} color="gray" />
            <Stat label="Errors" value={preview.stats?.errors || 0} color="red" />
          </div>

          {/* Table */}
          {sampleRows.length > 0 ? (
            <div className="overflow-x-auto border rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Before Date (UTC)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">After Date (UTC)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Before Shift</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">After Shift</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sampleRows.map((row, idx) => {
                    const shiftChanged = row.afterShiftId && row.afterShiftId !== "unchanged" && row.afterShiftId !== row.beforeShiftId;
                    return (
                      <tr key={idx} className={shiftChanged ? "bg-green-50" : ""}>
                        <td className="px-4 py-3 whitespace-nowrap text-gray-500">{idx + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-900">{row.saleId || "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {formatDateDisplay(row.beforeCreatedAtUtc)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                          {formatDateDisplay(row.afterCreatedAtUtc)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {row.beforeShiftId ? row.beforeShiftId.slice(0, 12) + "…" : "none"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">
                          {row.afterShiftId && row.afterShiftId !== "unchanged" ? (
                            <span className="text-green-600">{row.afterShiftId.slice(0, 12)}…</span>
                          ) : (
                            <span className="text-gray-400">unchanged</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {shiftChanged ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              🔄 Shift updated
                            </span>
                          ) : row.afterShiftId === "unchanged" ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              No change
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                              New shift
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">No sales to display in the preview.</div>
          )}

          {/* Raw Output Toggle */}
          {preview.rawOutput && preview.rawOutput.length > 0 && (
            <div className="mt-4">
              <button
                onClick={() => setShowRawOutput(!showRawOutput)}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                {showRawOutput ? "Hide" : "Show"} Raw Output
              </button>
              {showRawOutput && (
                <pre className="mt-2 p-4 bg-gray-900 text-gray-100 text-xs rounded-lg overflow-x-auto max-h-96">
                  {preview.rawOutput.join("\n")}
                </pre>
              )}
            </div>
          )}

          {preview.stderr && (
            <div className="mt-4 p-4 bg-red-50 border border-red-300 rounded text-sm text-red-700">
              <strong>STDERR:</strong>
              <pre className="mt-2 whitespace-pre-wrap">{preview.stderr}</pre>
            </div>
          )}
        </div>
      )}

      {results && (
        <div className="mt-8">
          <div className="bg-green-50 border border-green-300 rounded-lg p-4 mb-4">
            <h3 className="text-lg font-semibold text-green-800">✅ Backdate Complete</h3>
            <p className="text-sm text-green-700">Updated {results.stats?.salesUpdated || 0} sales.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat label="Sales Updated" value={results.stats?.salesUpdated || 0} color="green" />
            <Stat label="Shifts Found" value={results.stats?.shiftsFound || 0} />
            <Stat label="Shifts Created" value={results.stats?.shiftsCreated || 0} />
            <Stat label="Receivables" value={results.stats?.receivablesUpdated || 0} />
            <Stat label="Z-Reports" value={results.stats?.zReportsUpdated || 0} />
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color = "gray" }) {
  const colorMap = {
    gray: "bg-gray-50",
    blue: "bg-blue-50",
    green: "bg-green-50",
    red: "bg-red-50",
  };
  const textColorMap = {
    gray: "text-gray-900",
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
  };
  return (
    <div className={`p-3 rounded ${colorMap[color] || "bg-gray-50"}`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className={`text-xl font-bold ${textColorMap[color] || "text-gray-900"}`}>{value}</p>
    </div>
  );
}