import { getSessionState, useSessionStore } from "@/store/session";
import { buildLoginRedirect, sanitizeNextPath } from "@/lib/auth-redirect";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";
const JSON_HEADERS = { "Content-Type": "application/json" };

let redirectingToLogin = false;

function handleUnauthorizedSession() {
  useSessionStore.getState().clearSession();

  if (typeof window === "undefined" || redirectingToLogin) return;

  const currentPath = window.location.pathname || "";
  const currentSearch = window.location.search || "";
  const currentHash = window.location.hash || "";
  const isAuthRoute = currentPath.startsWith("/auth/");

  if (!isAuthRoute) {
    redirectingToLogin = true;
    const candidateNextPath = `${currentPath}${currentSearch}${currentHash}`;
    const nextPath = sanitizeNextPath(candidateNextPath);
    const loginUrl = buildLoginRedirect(nextPath);
    window.location.assign(loginUrl);
  }
}

async function refreshAccessToken() {
  const { deviceId, deviceName, refreshToken } = getSessionState();

  const refreshHeaders = {
    ...JSON_HEADERS,
  };
  if (deviceId) refreshHeaders["X-Device-ID"] = deviceId;
  if (deviceName) refreshHeaders["X-Device-Name"] = deviceName;

  try {
    const res = await fetch(`${BASE_URL}/users/refresh`, {
      method: "POST",
      headers: refreshHeaders,
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken) {
      useSessionStore.getState().setTokens({
        accessToken: data.accessToken,
        refreshToken: refreshToken || null,
      });
      return data.accessToken;
    }
  } catch (err) {
    console.warn("refresh token failed", err);
  }
  return null;
}

export async function apiFetch(
  path,
  { method = "GET", headers = {}, body, retryOn401 = true } = {},
) {
  const {
    accessToken,
    deviceId,
    deviceName,
    activeOrganization,
    selectedLocationId,
  } = getSessionState();

  const finalHeaders = {
    ...JSON_HEADERS,
    ...headers,
  };

  if (accessToken) {
    finalHeaders.Authorization = `Bearer ${accessToken}`;
  }
  if (deviceId) finalHeaders["X-Device-ID"] = deviceId;
  if (deviceName) finalHeaders["X-Device-Name"] = deviceName;
  if (activeOrganization?.slug) {
    finalHeaders["X-Organization-Slug"] = activeOrganization.slug;
  }
  if (selectedLocationId) {
    finalHeaders["X-Location-ID"] = selectedLocationId;
  }

  const options = {
    method,
    headers: finalHeaders,
    credentials: "include",
  };

  if (body)
    options.body = typeof body === "string" ? body : JSON.stringify(body);

  let response = await fetch(`${BASE_URL}${path}`, options);

  if (response.status === 401 && retryOn401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      finalHeaders.Authorization = `Bearer ${newToken}`;
      response = await fetch(`${BASE_URL}${path}`, options);
      if (response.status === 401) {
        handleUnauthorizedSession();
      }
    } else {
      handleUnauthorizedSession();
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `Request failed with ${response.status}`,
    );
    error.status = response.status;
    error.details = data || { status: response.status };
    throw error;
  }

  return data;
}

export function getBaseUrl() {
  return BASE_URL;
}
