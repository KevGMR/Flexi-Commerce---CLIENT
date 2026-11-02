// client/src/lib/orgs.js
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";

// GET /users/organizations — NOT /organizations/my. Your organizations.js
// router does not have a /my route, and /organizations/my would be
// caught by GET /:organizationId and return "Organization not found".
// controllers/User.js DOES have GET /users/organizations.
export async function fetchMyOrganizations() {
  const data = await apiFetch(`/users/organizations`, { method: "GET" });
  const orgs = data?.organizations || [];
  if (orgs.length) {
    useSessionStore.getState().setOrganizations(orgs);
  }
  return orgs;
}

export async function refreshActiveOrganizationContext(orgId) {
  if (!orgId) return null;
  if (typeof window !== "undefined" && window.__LOGGING_OUT__) return null;
  const data = await apiFetch(`/organizations/${orgId}`, { method: "GET" });
  if (data?.organization) {
    useSessionStore.getState().setActiveOrganization(data.organization);
    useSessionStore.getState().setPermissions(data.organization.permissions || []);
    useSessionStore.getState().setLocations(data.organization.locations || []);
    useSessionStore.getState().setLocationsMeta(data.organization.locationsMeta || []);
  }
  return data?.organization || null;
}

// The existing server handler is POST /users/switch-organization (see
// controllers/User.js). It already revokes the old refresh token,
// issues a new access + refresh token, sets the cookie, and returns
// the full organizations array. Just call it.
export async function switchOrganization(orgId) {
  const data = await apiFetch(`/users/switch-organization`, {
    method: "POST",
    body: { organizationId: orgId },
  });

  const token = data?.accessToken || data?.newAccessToken;
  if (token) {
    useSessionStore.getState().setTokens({
      accessToken: token,
      refreshToken: useSessionStore.getState().refreshToken,
    });
  }
  if (data?.organization) {
    useSessionStore.getState().setActiveOrganization(data.organization);
    useSessionStore.getState().setPermissions(data.organization.permissions || []);
    useSessionStore.getState().setLocations(data.organization.locations || []);
  }
  if (Array.isArray(data?.organizations)) {
    useSessionStore.getState().setOrganizations(data.organizations);
  }
  return data;
}