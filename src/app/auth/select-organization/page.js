"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/session";
import { apiFetch } from "@/lib/api-client";
import { OrgAvatar } from "@/components/ui/Avatar";
import { X } from "@/components/icons/Icon";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";

export default function SelectOrganizationPage() {
  const router = useRouter();
  const {
    organizations,
    activeOrganization,
    accessToken,
    hydrated,
    setOrganizations,
    setTokens,
    setUser,
    setActiveOrganization,
    setPermissions,
    setLocations,
    setLocationsMeta,
    deviceId,
    deviceName,
  } = useSessionStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ name: "" });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (hydrated) {
      const { tempAuthCredentials } = useSessionStore.getState();
      // Redirect to login if no temp credentials and no existing session
      if (!accessToken && !tempAuthCredentials) {
        router.push("/auth/login");
      }
    }
  }, [hydrated, accessToken, router]);

  const handleSelectOrganization = async (orgId) => {
    setLoading(true);
    setError("");

    try {
      const { tempAuthCredentials } = useSessionStore.getState();

      // If temp credentials exist (from login flow), complete login step 2
      if (tempAuthCredentials) {
        const loginRes = await fetch(`${API_BASE_URL}/users/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Device-ID": deviceId || "",
            "X-Device-Name": deviceName || "",
          },
          body: JSON.stringify({
            email: tempAuthCredentials.email,
            password: tempAuthCredentials.password,
            organizationId: orgId,
          }),
        });

        const data = await loginRes.json();

        console.log(data);

        if (!loginRes.ok) {
          throw new Error(data.error || "Login failed");
        }

        // Set all login state
        setTokens({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        });

        if (data.user) {
          setUser({
            email: data.user.email,
            _id: data.user._id,
            fullname: data.user.fullname,
          });
        }

        setActiveOrganization(data.organization);
        setPermissions(data.organization?.permissions || []);

        const allowedLocationIds = data.organization?.locations || [];

        // Fetch location metadata
        let locationsMeta = [];
        try {
          const locsRes = await fetch(`${API_BASE_URL}/locations?limit=100`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.accessToken}`,
              "X-Device-ID": deviceId || "",
              "X-Device-Name": deviceName || "",
              "X-Organization-Slug": data.organization?.slug || "",
            },
          });
          if (locsRes.ok) {
            const locsData = await locsRes.json();
            const allLocations = locsData.data || locsData.locations || [];
            const allLocationIds = allLocations
              .map((loc) => loc._id || loc.id || loc.locationId)
              .filter(Boolean);
            if (allowedLocationIds.length > 0) {
              locationsMeta = allLocations.filter((loc) =>
                allowedLocationIds.includes(loc._id || loc.id || loc.locationId),
              );
              setLocations(allowedLocationIds);
            } else {
              locationsMeta = allLocations;
              setLocations(allLocationIds);
            }
          }
        } catch (locErr) {
          console.warn("Failed to fetch locations:", locErr);
        }
        setLocationsMeta(locationsMeta);

        // Clear temp credentials
        useSessionStore.getState().setAuthTempCredentials(null);
        router.push("/dashboard/home");
      } else {
        // Existing user switching org - use switch endpoint
        const res = await fetch(`${API_BASE_URL}/users/switch-organization`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Device-ID": deviceId || "",
            "X-Device-Name": deviceName || "",
          },
          body: JSON.stringify({ organizationId: orgId }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to switch organization");
        }

        // Update session with new org data
        if (data.accessToken) {
          setTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
          });
        }

        setActiveOrganization(data.organization);
        setPermissions(data.organization?.permissions || []);

        const allowedLocationIds = data.organization?.locations || [];

        // Fetch location metadata
        let locationsMeta = [];
        try {
          const locsRes = await fetch(`${API_BASE_URL}/locations?limit=100`, {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${data.accessToken || accessToken}`,
              "X-Device-ID": deviceId || "",
              "X-Device-Name": deviceName || "",
              "X-Organization-Slug": data.organization?.slug || "",
            },
          });
          if (locsRes.ok) {
            const locsData = await locsRes.json();
            const allLocations = locsData.data || locsData.locations || [];
            const allLocationIds = allLocations
              .map((loc) => loc._id || loc.id || loc.locationId)
              .filter(Boolean);
            if (allowedLocationIds.length > 0) {
              locationsMeta = allLocations.filter((loc) =>
                allowedLocationIds.includes(loc._id || loc.id || loc.locationId),
              );
              setLocations(allowedLocationIds);
            } else {
              locationsMeta = allLocations;
              setLocations(allLocationIds);
            }
          }
        } catch (locErr) {
          console.warn("Failed to fetch locations:", locErr);
        }
        setLocationsMeta(locationsMeta);

        router.push("/dashboard/home");
      }
    } catch (err) {
      setError(err.message || "Failed to select organization");
      setLoading(false);
    }
  };

  const handleCreateOrganization = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Organization name is required");
      return;
    }

    setCreating(true);
    setError("");
    try {
      const data = await apiFetch("/organizations", {
        method: "POST",
        body: { name: formData.name },
      });

      if (data?.data || data?.organization) {
        const newOrg = data.data || data.organization;
        const updatedOrgs = [...organizations, newOrg];
        setOrganizations(updatedOrgs);

        await handleSelectOrganization(
          newOrg._id || newOrg.organizationId || newOrg.id,
        );
        setFormData({ name: "" });
        setShowCreateForm(false);
      }
    } catch (err) {
      setError(err.message || "Failed to create organization");
    } finally {
      setCreating(false);
    }
  };

  if (!hydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50">
        <div className="text-zinc-600">Loading...</div>
      </div>
    );
  }

  const currentOrgId =
    activeOrganization?._id ||
    activeOrganization?.organizationId ||
    activeOrganization?.id;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 py-8">
      <div className="w-full max-w-2xl rounded-lg bg-white p-8 shadow-sm border border-zinc-200">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Organizations</h1>
        <p className="text-sm text-zinc-600 mb-6">
          {activeOrganization
            ? "Switch to a different organization or create a new one"
            : "Choose an organization to continue or create a new one"}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {showCreateForm && accessToken && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-zinc-900">
                Create New Organization
              </h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className="p-1 hover:bg-blue-100 rounded-md"
              >
                <X className="w-4 h-4 text-zinc-600" />
              </button>
            </div>
            <form onSubmit={handleCreateOrganization} className="space-y-3">
              <input
                type="text"
                placeholder="Organization name"
                value={formData.name}
                onChange={(e) => setFormData({ name: e.target.value })}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={creating}
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !formData.name.trim()}
                  className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creating ? "Creating..." : "Create Organization"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormData({ name: "" });
                    setError("");
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {organizations.length > 0 ? (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-zinc-700 mb-3">
              Your Organizations
            </h2>
            <div className="space-y-2">
              {organizations.map((org) => {
                const orgId = org._id || org.organizationId || org.id;
                const isActive = currentOrgId === orgId;

                return (
                  <button
                    key={orgId}
                    onClick={() => handleSelectOrganization(orgId)}
                    disabled={loading}
                    className={`w-full flex items-center gap-4 rounded-lg border-2 p-4 transition-all ${
                      isActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50"
                    } ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <OrgAvatar org={org} size="lg" />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-zinc-900">
                        {org.name}
                      </div>
                      <div className="text-xs text-zinc-500">{orgId}</div>
                    </div>
                    {isActive && (
                      <div className="text-sm font-medium text-blue-600">
                        Current
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            You do not belong to any organizations yet. Create one to get
            started.
          </div>
        )}

        {!showCreateForm && accessToken && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Create Organization
            </button>
            {activeOrganization && (
              <button
                onClick={() => router.push("/dashboard")}
                className="flex-1 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 transition-colors"
              >
                Continue to Dashboard
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
