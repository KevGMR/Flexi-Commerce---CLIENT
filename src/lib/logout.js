import { getSessionState, useSessionStore } from "@/store/session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";

function buildLogoutHeaders(accessToken, session) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (session.deviceId) headers["X-Device-ID"] = session.deviceId;
  if (session.deviceName) headers["X-Device-Name"] = session.deviceName;
  if (session.activeOrganization?.slug) {
    headers["X-Organization-Slug"] = session.activeOrganization.slug;
  }
  if (session.selectedLocationId) {
    headers["X-Location-ID"] = session.selectedLocationId;
  }
  return headers;
}

async function requestLogout(accessToken, session) {
  return fetch(`${API_BASE_URL}/users/logout`, {
    method: "POST",
    headers: buildLogoutHeaders(accessToken, session),
    credentials: "include",
  });
}

async function refreshAccessToken(session) {
  const headers = { "Content-Type": "application/json" };
  if (session.deviceId) headers["X-Device-ID"] = session.deviceId;
  if (session.deviceName) headers["X-Device-Name"] = session.deviceName;

  const response = await fetch(`${API_BASE_URL}/users/refresh`, {
    method: "POST",
    headers,
    credentials: "include",
  });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  return data?.accessToken || null;
}

export async function logoutUser() {
  // Guard all persistence writes from this point on (see store/session.js).
  if (typeof window !== "undefined") {
    window.__LOGGING_OUT__ = true;
  }

  const session = getSessionState();

  try {
    if (session.accessToken) {
      let response = await requestLogout(session.accessToken, session);

      // If the access token is already expired, refresh once and
      // retry — otherwise the server cannot authorise the revoke call.
      if (response.status === 401) {
        const refreshed = await refreshAccessToken(session);
        if (refreshed) {
          useSessionStore.getState().setTokens({
            accessToken: refreshed,
            refreshToken: session.refreshToken || null,
          });
          response = await requestLogout(refreshed, getSessionState());
        }
      }

      if (!response.ok) {
        console.warn(
          "Logout request did not complete successfully",
          response.status,
        );
      }
    }
  } catch (error) {
    console.warn("Logout request failed; continuing with local cleanup", error);
  }

  // IMPORTANT: await clearSession() BEFORE any navigation.
  // If we navigate first, a pending background refreshPermissions()
  // can rewrite localStorage after the clear.
  await useSessionStore.getState().clearSession();

  // A hard reload is the only reliable way to kill a service worker
  // that has cached the dashboard HTML, and to force hydrate() to run
  // against a fresh (empty) localStorage.
  if (typeof window !== "undefined") {
    window.location.replace("/auth/login");
  }
}