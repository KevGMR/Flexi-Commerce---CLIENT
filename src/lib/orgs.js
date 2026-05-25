import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";

export async function fetchMyOrganizations() {
  const data = await apiFetch(`/organizations/my`, { method: "GET" });
  return data?.organizations || [];
}

export async function refreshActiveOrganizationContext(orgId) {
  if (!orgId) return null;

  const data = await apiFetch(`/organizations/${orgId}`, { method: "GET" });
  if (data?.organization) {
    useSessionStore.getState().setActiveOrganization(data.organization);
    useSessionStore.getState().setPermissions(data.organization.permissions || []);
  }
  return data?.organization || null;
}

export async function switchOrganization(orgId) {
  const data = await apiFetch(`/organizations/${orgId}/switch`, {
    method: "POST",
  });
  if (data?.accessToken || data?.newAccessToken) {
    useSessionStore.getState().setTokens({
      accessToken: data.accessToken || data.newAccessToken,
      refreshToken: useSessionStore.getState().refreshToken,
    });
  }
  if (data?.organization) {
    useSessionStore.getState().setActiveOrganization(data.organization);
    useSessionStore.getState().setPermissions(data.organization.permissions || []);
  }
  return data;
}
