"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function InvitationsPage() {
  const { activeOrganization, can } = useSessionStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Employee");
  const [locations, setLocations] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [roles, setRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // Invitations list state
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationsError, setInvitationsError] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionLoading, setActionLoading] = useState({});

  const orgId = activeOrganization?._id || activeOrganization?.id || activeOrganization?.organizationId;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [locationsData, rolesData] = await Promise.all([
          apiFetch("/locations"),
          apiFetch("/role-permission/roles"),
        ]);
        
        setLocations(locationsData?.locations || []);
        setRoles(rolesData?.roles || []);
      } catch (err) {
        setLocations([]);
        setRoles([]);
      } finally {
        setRolesLoading(false);
      }
    };

    loadData();
  }, []);

  // Fetch invitations
  const fetchInvitations = async () => {
    if (!orgId) return;
    setInvitationsLoading(true);
    setInvitationsError("");
    try {
      const queryParams = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const data = await apiFetch(`/organizations/${orgId}/invitations${queryParams}`);
      setInvitations(data?.invitations || []);
    } catch (err) {
      setInvitationsError(err?.message || "Failed to load invitations");
      setInvitations([]);
    } finally {
      setInvitationsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [orgId, statusFilter]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!orgId) return;
    setIsLoading(true);
    setStatus("");
    setError("");
    try {
      await apiFetch(`/organizations/${orgId}/invite`, {
        method: "POST",
        body: {
          email,
          role,
          locations: selectedLocations,
        },
      });
      setStatus("Invitation sent successfully.");
      setEmail("");
      setRole("Employee");
      setSelectedLocations([]);
      // Refresh invitations list
      fetchInvitations();
    } catch (err) {
      setError(err?.message || "Failed to send invitation.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async (invitationId) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    
    setActionLoading((prev) => ({ ...prev, [invitationId]: "revoke" }));
    try {
      await apiFetch(`/organizations/${orgId}/invitations/${invitationId}`, {
        method: "DELETE",
      });
      setStatus("Invitation revoked successfully.");
      fetchInvitations();
    } catch (err) {
      setError(err?.message || "Failed to revoke invitation");
    } finally {
      setActionLoading((prev) => {
        const updated = { ...prev };
        delete updated[invitationId];
        return updated;
      });
    }
  };

  const handleResend = async (invitationId) => {
    setActionLoading((prev) => ({ ...prev, [invitationId]: "resend" }));
    try {
      await apiFetch(`/organizations/${orgId}/invitations/${invitationId}/resend`, {
        method: "POST",
      });
      setStatus("Invitation resent successfully.");
      fetchInvitations();
    } catch (err) {
      setError(err?.message || "Failed to resend invitation");
    } finally {
      setActionLoading((prev) => {
        const updated = { ...prev };
        delete updated[invitationId];
        return updated;
      });
    }
  };

  const toggleLocation = (id) => {
    setSelectedLocations((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Helper functions
  const getStatusBadge = (invitation) => {
    const isExpired = invitation.status === "pending" && new Date(invitation.expiresAt) < new Date();
    const status = isExpired ? "expired" : invitation.status;

    const badges = {
      pending: "bg-amber-100 text-amber-700 border-amber-200",
      accepted: "bg-green-100 text-green-700 border-green-200",
      revoked: "bg-red-100 text-red-700 border-red-200",
      expired: "bg-zinc-100 text-zinc-600 border-zinc-200",
    };

    return (
      <span className={`px-2 py-1 text-xs rounded border ${badges[status] || badges.pending}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const canManageInvitations = (invitation) => {
    const isExpired = new Date(invitation.expiresAt) < new Date();
    return invitation.status === "pending" && !isExpired;
  };

  const canInvite = can(PERMISSIONS.CREATE_USER) || can(PERMISSIONS.MANAGE_USERS);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Invitations</h1>

      <div className="bg-white border border-zinc-200 rounded-lg p-6">
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

        <h2 className="text-sm font-semibold mb-3">Invite a teammate</h2>
        <form onSubmit={handleInvite} className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-600 mb-1">Email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              placeholder="teammate@example.com"
              disabled={!canInvite}
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-600 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              disabled={!canInvite || rolesLoading}
            >
              {rolesLoading ? (
                <option>Loading roles...</option>
              ) : roles.length === 0 ? (
                <option>No roles available</option>
              ) : (
                roles.map((r) => (
                  <option key={r._id} value={r.name}>
                    {r.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-600 mb-2">Location access</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {locations.map((loc) => (
                <label key={loc._id} className="flex items-center gap-2 text-xs text-zinc-700">
                  <input
                    type="checkbox"
                    checked={selectedLocations.includes(loc._id)}
                    onChange={() => toggleLocation(loc._id)}
                    disabled={!canInvite}
                  />
                  {loc.name}
                </label>
              ))}
            </div>
            {locations.length === 0 && (
              <div className="text-xs text-zinc-500">No locations available.</div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canInvite || isLoading}
            className="px-4 py-2 rounded bg-zinc-900 text-white text-sm disabled:opacity-50"
          >
            {isLoading ? "Sending..." : "Send Invitation"}
          </button>
        </form>

        {!canInvite && (
          <p className="mt-3 text-xs text-zinc-500">
            You don’t have permission to send invitations.
          </p>
        )}
      </div>
      {/* Invitations list */}
      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Invitation History</h2>
          
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All Invitations</option>
            <option value="pending">Pending</option>
            <option value="accepted">Accepted</option>
            <option value="revoked">Revoked</option>
          </select>
        </div>

        {invitationsError && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
            {invitationsError}
          </div>
        )}

        {invitationsLoading ? (
          <div className="text-center py-8 text-sm text-zinc-500">Loading invitations...</div>
        ) : invitations.length === 0 ? (
          <div className="text-center py-8 text-sm text-zinc-500">
            No invitations found.
            {statusFilter !== "all" && " Try changing the filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left">
                  <th className="pb-2 font-semibold text-zinc-600">Email</th>
                  <th className="pb-2 font-semibold text-zinc-600">Role</th>
                  <th className="pb-2 font-semibold text-zinc-600">Status</th>
                  <th className="pb-2 font-semibold text-zinc-600">Invited By</th>
                  <th className="pb-2 font-semibold text-zinc-600">Sent</th>
                  <th className="pb-2 font-semibold text-zinc-600">Expires/Accepted</th>
                  <th className="pb-2 font-semibold text-zinc-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((invitation) => {
                  const isExpired = invitation.status === "pending" && new Date(invitation.expiresAt) < new Date();
                  const loading = actionLoading[invitation._id];
                  
                  return (
                    <tr key={invitation._id} className="border-b border-zinc-100 hover:bg-zinc-50">
                      <td className="py-3">{invitation.email}</td>
                      <td className="py-3">{invitation.role}</td>
                      <td className="py-3">{getStatusBadge(invitation)}</td>
                      <td className="py-3">
                        {invitation.invitedBy?.fullname || invitation.invitedBy?.email || "—"}
                      </td>
                      <td className="py-3 text-zinc-600">{formatRelativeTime(invitation.createdAt)}</td>
                      <td className="py-3 text-zinc-600">
                        {invitation.status === "accepted" && invitation.acceptedAt
                          ? formatDate(invitation.acceptedAt)
                          : invitation.status === "pending"
                          ? isExpired
                            ? "Expired"
                            : formatDate(invitation.expiresAt)
                          : "—"}
                      </td>
                      <td className="py-3 text-right">
                        {canManageInvitations(invitation) && canInvite ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleResend(invitation._id)}
                              disabled={!!loading}
                              className="px-2 py-1 text-xs rounded border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50"
                            >
                              {loading === "resend" ? "..." : "Resend"}
                            </button>
                            <button
                              onClick={() => handleRevoke(invitation._id)}
                              disabled={!!loading}
                              className="px-2 py-1 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {loading === "revoke" ? "..." : "Revoke"}
                            </button>
                          </div>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>    </div>
  );
}
