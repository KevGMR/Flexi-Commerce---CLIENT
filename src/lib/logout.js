import { getSessionState, useSessionStore } from "@/store/session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";

function buildLogoutHeaders(accessToken, session) {
  const headers = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  if (session.deviceId) {
    headers["X-Device-ID"] = session.deviceId;
  }
  if (session.deviceName) {
    headers["X-Device-Name"] = session.deviceName;
  }
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
  const headers = {
    "Content-Type": "application/json",
  };

  if (session.deviceId) {
    headers["X-Device-ID"] = session.deviceId;
  }
  if (session.deviceName) {
    headers["X-Device-Name"] = session.deviceName;
  }

  const response = await fetch(`${API_BASE_URL}/users/refresh`, {
    method: "POST",
    headers,
    credentials: "include",
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json().catch(() => null);
  return data?.accessToken || null;
}

export async function logoutUser() {
  const session = getSessionState();

  try {
    if (session.accessToken) {
      let response = await requestLogout(session.accessToken, session);

      if (response.status === 401) {
        const refreshedAccessToken = await refreshAccessToken(session);

        if (refreshedAccessToken) {
          useSessionStore.getState().setTokens({
            accessToken: refreshedAccessToken,
            refreshToken: session.refreshToken || null,
          });

          response = await requestLogout(refreshedAccessToken, getSessionState());
        }
      }

      if (!response.ok) {
        console.warn("Logout request did not complete successfully", response.status);
      }
    }
  } catch (error) {
    console.warn("Logout request failed; continuing with local cleanup", error);
  }

  await useSessionStore.getState().clearSession();
}