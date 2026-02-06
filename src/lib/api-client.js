import { getSessionState, useSessionStore } from "@/store/session";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";
const JSON_HEADERS = { "Content-Type": "application/json" };

async function refreshAccessToken() {
  const { refreshToken } = getSessionState();
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken) {
      useSessionStore.getState().setTokens({
        accessToken: data.accessToken,
        refreshToken,
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
  };

  if (body)
    options.body = typeof body === "string" ? body : JSON.stringify(body);

  let response = await fetch(`${BASE_URL}${path}`, options);

  if (response.status === 401 && retryOn401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      finalHeaders.Authorization = `Bearer ${newToken}`;
      response = await fetch(`${BASE_URL}${path}`, options);
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
