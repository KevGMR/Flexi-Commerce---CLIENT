import { getSessionState, useSessionStore } from "@/store/session";
import { buildLoginRedirect, sanitizeNextPath } from "@/lib/auth-redirect";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";
const JSON_HEADERS = { "Content-Type": "application/json" };

let redirectingToLogin = false;

function isSessionEndedResponse(status, code) {
  return (
    status === 401 &&
    [
      "TOKEN_EXPIRED",
      "REFRESH_TOKEN_MISSING",
      "REFRESH_TOKEN_INVALID",
      "REFRESH_TOKEN_EXPIRED",
      "DEVICE_ID_REQUIRED",
      "DEVICE_ID_INVALID_FORMAT",
      "DEVICE_ID_MISMATCH",
      "USER_NOT_FOUND",
      "ORG_ACCESS_REVOKED",
      "REFRESH_TOKEN_INVALID_RESPONSE",
    ].includes(code)
  );
}

function isDefinitiveAuthFailure(status) {
  return status === 400 || status === 401 || status === 403;
}

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
    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await res.json().catch(() => null) : null;

    if (!res.ok) {
      return {
        status: isDefinitiveAuthFailure(res.status) ? "auth-failed" : "transient-failure",
        statusCode: res.status,
        code: data?.code || null,
        error: data?.error || data?.message || "Refresh failed",
      };
    }

    if (data?.accessToken) {
      useSessionStore.getState().setTokens({
        accessToken: data.accessToken,
        refreshToken: refreshToken || null,
      });
      return {
        status: "success",
        accessToken: data.accessToken,
      };
    }
  } catch (err) {
    console.warn("refresh token failed", err);
    return {
      status: "transient-failure",
      statusCode: 0,
      code: "NETWORK_ERROR",
      error: err?.message || "Network error while refreshing token",
    };
  }
  return {
    status: "auth-failed",
    statusCode: 401,
    code: "REFRESH_TOKEN_INVALID_RESPONSE",
    error: "Refresh response did not include access token",
  };
}

export async function apiFetch(
  path,
  { method = "GET", headers = {}, body, retryOn401 = true } = {},
) {
  let shouldRouteToLogin = false;

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
    const refreshResult = await refreshAccessToken();
    if (refreshResult?.status === "success") {
      finalHeaders.Authorization = `Bearer ${refreshResult.accessToken}`;
      response = await fetch(`${BASE_URL}${path}`, options);
      if (response.status === 401) {
        shouldRouteToLogin = true;
      }
    } else if (refreshResult?.status === "auth-failed") {
      console.warn("Forced logout after definitive refresh auth failure", refreshResult);
      shouldRouteToLogin = true;
    } else {
      console.warn("Skipping forced logout after transient refresh failure", refreshResult);
    }
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const data = isJson ? await response.json().catch(() => null) : null;

  if (
    response.status === 401 &&
    (shouldRouteToLogin ||
      isSessionEndedResponse(response.status, data?.code) ||
      !getSessionState().accessToken)
  ) {
    handleUnauthorizedSession();
  }

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
