"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function PermissionsPage() {
  const can = useSessionStore((s) => s.can);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [roleForm, setRoleForm] = useState({
    name: "",
    description: "",
    permissions: [],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        apiFetch("/role-permission/roles"),
        apiFetch("/role-permission/permissions"),
      ]);
      setRoles(rolesRes?.roles || []);
      setPermissions(permsRes?.permissions || []);
    } catch (err) {
      setError(err?.message || "Failed to load roles and permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const togglePermission = (value) => {
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(value)
        ? prev.permissions.filter((p) => p !== value)
        : [...prev.permissions, value],
    }));
  };

  const handleCreateRole = async (e) => {
    e.preventDefault();
    setStatus("");
    setError("");
    try {
      await apiFetch("/role-permission/roles", {
        method: "POST",
        body: roleForm,
      });
      setStatus("Role created successfully.");
      setRoleForm({ name: "", description: "", permissions: [] });
      await loadData();
    } catch (err) {
      setError(err?.message || "Failed to create role.");
    }
  };

  const canManageRoles = can(PERMISSIONS.MANAGE_ROLES);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Permissions</h1>

      {loading ? (
        <div className="text-sm text-zinc-500">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold mb-3">Roles</h2>
            {roles.map((role) => (
              <div key={role._id} className="border border-zinc-200 rounded p-3 mb-3">
                <div className="text-sm font-semibold text-zinc-900">{role.name}</div>
                {role.description && (
                  <div className="text-xs text-zinc-600 mt-1">{role.description}</div>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {(role.permissions || []).map((perm) => (
                    <span key={perm} className="text-[10px] px-2 py-1 rounded bg-zinc-100 text-zinc-700">
                      {perm}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {roles.length === 0 && (
              <div className="text-xs text-zinc-500">No roles found.</div>
            )}
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold mb-3">Create Role</h2>
            {status && (
              <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm text-green-700">
                {status}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateRole} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  name="name"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Role name"
                  required
                  disabled={!canManageRoles}
                  className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
                <input
                  name="description"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Description"
                  disabled={!canManageRoles}
                  className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <div className="text-xs text-zinc-600 mb-2">Permissions</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-auto border border-zinc-200 rounded p-3">
                  {permissions.map((perm) => (
                    <label key={perm.value} className="flex items-center gap-2 text-xs text-zinc-700">
                      <input
                        type="checkbox"
                        checked={roleForm.permissions.includes(perm.value)}
                        onChange={() => togglePermission(perm.value)}
                        disabled={!canManageRoles}
                      />
                      {perm.value}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!canManageRoles}
                className="px-4 py-2 rounded bg-zinc-900 text-white text-sm disabled:opacity-50"
              >
                Create Role
              </button>
            </form>

            {!canManageRoles && (
              <p className="mt-3 text-xs text-zinc-500">You don’t have permission to manage roles.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
