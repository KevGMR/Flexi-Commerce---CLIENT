"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function UserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id;

  const can = useSessionStore((state) => state.can);
  const canView = can(PERMISSIONS.VIEW_USERS);
  const canManageUsers = can(PERMISSIONS.MANAGE_USERS) || can(PERMISSIONS.EDIT_USER);

  const [user, setUser] = useState(null);
  const [services, setServices] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [overrides, setOverrides] = useState({});
  const [editingRole, setEditingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [editingLocations, setEditingLocations] = useState(false);

  const loadData = async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    try {
      // Fetch user details (includes role, permissions, locations)
      const userRes = await apiFetch(`/users/${userId}`);
      const userData = userRes?.user || userRes?.data?.user || null;
      if (!userData) throw new Error("User not found");
      setUser(userData);

      // Set role and locations for editing
      setSelectedRole(userData.role || "Employee");
      setSelectedLocations(userData.locations || []);

      // Build overrides map from user's commissionOverrides
      const overrideMap = {};
      if (Array.isArray(userData.commissionOverrides)) {
        userData.commissionOverrides.forEach((ov) => {
          overrideMap[ov.serviceId] = {
            type: ov.commissionType,
            value: ov.commissionValue,
          };
        });
      }
      setOverrides(overrideMap);

      // Fetch all services
      const servicesRes = await apiFetch("/products?type=service&limit=200");
      const allServices = servicesRes?.products || [];
      setServices(allServices);

      // Fetch locations
      const locationsRes = await apiFetch("/locations?limit=100");
      const allLocations = locationsRes?.locations || [];
      setLocations(allLocations);
    } catch (err) {
      setError(err?.message || "Failed to load user data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView && userId) {
      loadData();
    }
  }, [userId, canView]);

  const handleOverrideChange = (serviceId, field, value) => {
    if (!canManageUsers) return;
    setOverrides((prev) => ({
      ...prev,
      [serviceId]: {
        ...prev[serviceId],
        [field]: value,
      },
    }));
  };

  const handleSaveOverrides = async () => {
    if (!canManageUsers) return;
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      const overrideArray = Object.entries(overrides)
        .filter(([_, ov]) => ov.type && ov.value !== undefined && ov.value !== "")
        .map(([serviceId, ov]) => ({
          serviceId,
          commissionType: ov.type,
          commissionValue: toNumberOrZero(ov.value),
        }));

      const payload = {
        commissionOverrides: overrideArray,
      };

      await apiFetch(`/users/${userId}`, {
        method: "PUT",
        body: payload,
      });

      setStatusMessage("Commission overrides saved successfully.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to save overrides.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async () => {
    if (!canManageUsers) return;
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      await apiFetch(`/users/${userId}/membership`, {
        method: "PATCH",
        body: {
          role: selectedRole,
        },
      });
      setStatusMessage("Role updated successfully.");
      setEditingRole(false);
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to update role.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocations = async () => {
    if (!canManageUsers) return;
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      await apiFetch(`/users/${userId}/membership`, {
        method: "PATCH",
        body: {
          locations: selectedLocations,
        },
      });
      setStatusMessage("Locations updated successfully.");
      setEditingLocations(false);
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to update locations.");
    } finally {
      setSaving(false);
    }
  };

  // NEW: Sync permissions
  const handleSyncPermissions = async () => {
    if (!canManageUsers) return;
    setSaving(true);
    setError("");
    setStatusMessage("");
    try {
      await apiFetch(`/users/${userId}/sync-permissions`, {
        method: "POST",
      });
      setStatusMessage("Permissions synced successfully based on current role.");
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to sync permissions.");
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">User Details</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view users.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">User Details</h1>
        <p className="text-sm text-zinc-600">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">User Details</h1>
        <p className="text-sm text-red-600">User not found.</p>
      </div>
    );
  }

  const roleOptions = ["Owner", "Manager", "Cashier", "Employee"];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">User Details</h1>
          <p className="mt-1 text-sm text-zinc-600">
            View and manage user profile, permissions, and commission overrides.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/settings/users")}
          className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Back to Users
        </button>
      </div>

      {/* User Profile */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900 mb-4">Profile</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs font-medium text-zinc-500">Full Name</div>
            <div className="mt-1 text-sm text-zinc-900">{user.fullname}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Email</div>
            <div className="mt-1 text-sm text-zinc-900">{user.email}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Phone</div>
            <div className="mt-1 text-sm text-zinc-900">{user.phone || "—"}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Status</div>
            <div className="mt-1">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  user.status === "active"
                    ? "bg-green-100 text-green-700"
                    : user.status === "inactive"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                }`}
              >
                {user.status}
              </span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Joined</div>
            <div className="mt-1 text-sm text-zinc-900">
              {new Date(user.createdAt).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-zinc-500">Last Login</div>
            <div className="mt-1 text-sm text-zinc-900">
              {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
            </div>
          </div>
        </div>
      </div>

      {/* Permissions & Roles Section (only for managers/owners) */}
      {canManageUsers && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-zinc-900 mb-4">Permissions & Roles</h2>

          {/* Role */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-zinc-500">Current Role</div>
                <div className="mt-1 text-sm font-medium text-zinc-900">{user.role || "Employee"}</div>
              </div>
              <button
                type="button"
                onClick={() => setEditingRole(!editingRole)}
                className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {editingRole ? "Cancel" : "Change Role"}
              </button>
            </div>
            {editingRole && (
              <div className="mt-4 flex items-center gap-3">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleSaveRole}
                  disabled={saving || selectedRole === user.role}
                  className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Role"}
                </button>
              </div>
            )}
            <div className="mt-2 text-xs text-zinc-500">
              Role determines the base permissions for this user.
            </div>
          </div>

          {/* Locations */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-zinc-500">Accessible Locations</div>
                <div className="mt-1 text-sm text-zinc-900">
                  {user.locations && user.locations.length > 0
                    ? user.locations.map((locId) => {
                        const loc = locations.find((l) => (l._id || l.id) === locId);
                        return loc ? loc.name : "Unknown Location";
                      }).join(", ")
                    : "All Locations"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingLocations(!editingLocations)}
                className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                {editingLocations ? "Cancel" : "Edit Locations"}
              </button>
            </div>
            {editingLocations && (
              <div className="mt-4 space-y-3">
                <div className="max-h-48 overflow-y-auto border border-zinc-200 rounded p-3">
                  {locations.map((loc) => {
                    const locId = loc._id || loc.id;
                    const isChecked = selectedLocations.includes(locId);
                    return (
                      <label key={locId} className="flex items-center gap-2 py-1">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setSelectedLocations(selectedLocations.filter((id) => id !== locId));
                            } else {
                              setSelectedLocations([...selectedLocations, locId]);
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{loc.name}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleSaveLocations}
                    disabled={saving}
                    className="rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save Locations"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLocations(user.locations || []);
                      setEditingLocations(false);
                    }}
                    className="rounded border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
            <div className="mt-2 text-xs text-zinc-500">
              Leave empty to grant access to all locations.
            </div>
          </div>

          {/* Sync Permissions Button */}
          <div className="mt-6 pt-6 border-t border-zinc-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-900">Sync Permissions</div>
                <p className="text-xs text-zinc-500">
                  Recalculate permissions based on the user's current role. Useful when you've added new permissions to the system.
                </p>
              </div>
              <button
                type="button"
                onClick={handleSyncPermissions}
                disabled={saving}
                className="rounded bg-yellow-600 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
              >
                {saving ? "Syncing..." : "Sync Permissions"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Commission Overrides Section */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900">
            Service Commission Overrides
          </h2>
          {canManageUsers && (
            <button
              type="button"
              onClick={handleSaveOverrides}
              disabled={saving}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Overrides"}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {statusMessage && (
          <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            {statusMessage}
          </div>
        )}

        {services.length === 0 ? (
          <div className="py-4 text-sm text-zinc-500">
            No services found. Create services first to set overrides.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="py-3 pr-4">Service</th>
                  <th className="py-3 pr-4">Default</th>
                  <th className="py-3 pr-4">Override Type</th>
                  <th className="py-3 pr-4">Override Value</th>
                  <th className="py-3 pr-4">Effective</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {services.map((service) => {
                  const serviceId = service._id || service.id;
                  const defaultComm = {
                    type: service.commissionType || "percentage",
                    value: service.commissionValue || 0,
                  };
                  const override = overrides[serviceId] || {};
                  const overrideType = override.type || "";
                  const overrideValue =
                    override.value !== undefined ? String(override.value) : "";
                  const effectiveType = overrideType || defaultComm.type;
                  const effectiveValue =
                    overrideValue !== "" ? toNumberOrZero(overrideValue) : defaultComm.value;
                  const isOverridden = !!overrideType && overrideValue !== "";

                  return (
                    <tr key={serviceId} className="hover:bg-zinc-50">
                      <td className="py-3 pr-4 font-medium text-zinc-900">
                        {service.name}
                      </td>
                      <td className="py-3 pr-4 text-zinc-600">
                        {defaultComm.type === "percentage"
                          ? `${defaultComm.value}%`
                          : `$${defaultComm.value.toFixed(2)}`}
                      </td>
                      <td className="py-3 pr-4">
                        {canManageUsers ? (
                          <select
                            value={overrideType}
                            onChange={(e) =>
                              handleOverrideChange(serviceId, "type", e.target.value)
                            }
                            className="rounded border border-zinc-300 px-2 py-1 text-xs"
                          >
                            <option value="">Default</option>
                            <option value="percentage">Percentage</option>
                            <option value="fixed">Fixed ($)</option>
                          </select>
                        ) : (
                          <span className="text-xs text-zinc-500">
                            {overrideType || "Default"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {canManageUsers ? (
                          <input
                            type="number"
                            min="0"
                            step={overrideType === "percentage" ? "1" : "0.01"}
                            value={overrideValue}
                            onChange={(e) =>
                              handleOverrideChange(serviceId, "value", e.target.value)
                            }
                            className="w-20 rounded border border-zinc-300 px-2 py-1 text-xs"
                            placeholder="—"
                            disabled={!overrideType}
                          />
                        ) : (
                          <span className="text-xs text-zinc-500">
                            {overrideValue || "—"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`text-xs font-medium ${
                            isOverridden ? "text-blue-600" : "text-zinc-500"
                          }`}
                        >
                          {effectiveType === "percentage"
                            ? `${effectiveValue}%`
                            : `$${effectiveValue.toFixed(2)}`}
                          {isOverridden && (
                            <span className="ml-1 text-[10px] text-blue-500">(override)</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}