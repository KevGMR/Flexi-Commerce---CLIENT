"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function TeamPage() {
  const { activeOrganization, can } = useSessionStore();
  const [org, setOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [orgName, setOrgName] = useState("");

  const orgId =
    activeOrganization?._id ||
    activeOrganization?.id ||
    activeOrganization?.organizationId;
  const canManageUsers = can(PERMISSIONS.MANAGE_USERS);
  const canManageSettings = can(PERMISSIONS.MANAGE_SETTINGS);

  const loadOrg = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const [orgRes, membersRes] = await Promise.all([
        apiFetch(`/organizations/${orgId}`),
        apiFetch(`/organizations/${orgId}/members`),
      ]);
      setOrg(orgRes?.organization || null);
      setMembers(membersRes?.members || []);
      setOrgName(orgRes?.organization?.name || "");
    } catch (err) {
      setError(err?.message || "Failed to load organization data.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadOrg();
  }, [orgId, loadOrg]);

  const handleRemove = async (userId) => {
    if (!orgId) return;
    if (!window.confirm("Remove this member?")) return;
    setStatus("");
    setError("");
    try {
      await apiFetch(`/organizations/${orgId}/members/${userId}`, {
        method: "DELETE",
      });
      setStatus("Member removed successfully.");
      await loadOrg();
    } catch (err) {
      setError(err?.message || "Failed to remove member.");
    }
  };

  const handleOrgUpdate = async (e) => {
    e.preventDefault();
    if (!orgId) return;
    setStatus("");
    setError("");
    try {
      await apiFetch(`/organizations/${orgId}`, {
        method: "PUT",
        body: { name: orgName },
      });
      setStatus("Organization updated.");
      await loadOrg();
    } catch (err) {
      setError(err?.message || "Failed to update organization.");
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Team & Organizations</h1>

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

      {loading ? (
        <div className="text-sm text-zinc-500">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold mb-3">Organization</h2>
            {org ? (
              <div className="space-y-3">
                <div className="text-xs text-zinc-500">Slug: {org.slug}</div>
                <form
                  onSubmit={handleOrgUpdate}
                  className="flex flex-col md:flex-row gap-3"
                >
                  <input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    disabled={!canManageSettings}
                  />
                  <button
                    type="submit"
                    disabled={!canManageSettings}
                    className="px-4 py-2 rounded bg-zinc-900 text-white text-sm disabled:opacity-50"
                  >
                    Save
                  </button>
                </form>
                {!canManageSettings && (
                  <p className="text-xs text-zinc-500">
                    You don’t have permission to update org settings.
                  </p>
                )}
              </div>
            ) : (
              <div className="text-xs text-zinc-500">
                No organization selected.
              </div>
            )}
          </div>

          <div className="bg-white border border-zinc-200 rounded-lg p-6">
            <h2 className="text-sm font-semibold mb-3">Members</h2>
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.userId}
                  className="border border-zinc-200 rounded p-3 flex flex-col md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">
                      {member.fullname}
                    </div>
                    <div className="text-xs text-zinc-500">{member.email}</div>
                    <div className="text-xs text-zinc-600">
                      Role: {member.role}
                    </div>
                  </div>
                  {canManageUsers && (
                    <button
                      onClick={() => handleRemove(member.userId)}
                      className="mt-3 md:mt-0 px-3 py-2 rounded bg-red-100 text-red-700 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {members.length === 0 && (
                <div className="text-xs text-zinc-500">No members found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
