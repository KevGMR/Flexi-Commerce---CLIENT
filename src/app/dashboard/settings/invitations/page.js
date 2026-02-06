"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

const ROLE_OPTIONS = ["Owner", "Manager", "Cashier", "Employee"];

export default function InvitationsPage() {
  const { activeOrganization, can } = useSessionStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Employee");
  const [locations, setLocations] = useState([]);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const orgId = activeOrganization?._id || activeOrganization?.id || activeOrganization?.organizationId;

  useEffect(() => {
    const loadLocations = async () => {
      try {
        const data = await apiFetch("/locations");
        setLocations(data?.locations || []);
      } catch (err) {
        setLocations([]);
      }
    };

    loadLocations();
  }, []);

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
    } catch (err) {
      setError(err?.message || "Failed to send invitation.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLocation = (id) => {
    setSelectedLocations((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const canInvite = can(PERMISSIONS.CREATE_USER) || can(PERMISSIONS.MANAGE_USERS);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Invitations</h1>

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
              disabled={!canInvite}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
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
    </div>
  );
}
