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

async function handleUnauthorizedSession() {
  if (typeof window === "undefined") return;

  // Mark as redirecting BEFORE the await, so concurrent 401s don't
  // double-fire. Reset in a finally so a later session in the same
  // page lifetime can still redirect.
  if (redirectingToLogin) return;
  redirectingToLogin = true;

  try {
    // clearSession() is async (IndexedDB delete). Await it fully so
    // we don't abort the transaction by navigating away.
    await useSessionStore.getState().clearSession();
  } catch (err) {
    console.warn("clearSession failed during unauthorized redirect", err);
  } finally {
    const currentPath = window.location.pathname || "";
    const isAuthRoute = currentPath.startsWith("/auth/");
    if (!isAuthRoute) {
      const nextPath = sanitizeNextPath(
        `${currentPath}${window.location.search || ""}${window.location.hash || ""}`,
      );
      const loginUrl = buildLoginRedirect(nextPath);

      // Reset the guard on the next microtask so a fresh login on
      // the destination page can still redirect if it 401s again.
      setTimeout(() => {
        redirectingToLogin = false;
      }, 0);

      // Prefer a hard replace over assign so the back button cannot
      // return to a half-cleared dashboard, and to force a fresh
      // SessionInitializer.hydrate() on the login page.
      window.location.replace(loginUrl);
    } else {
      redirectingToLogin = false;
    }
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
  // Hard stop: while logout is in progress, never auto-refresh and never
  // retry. A pending refresh would re-issue the httpOnly cookie on the
  // server and resurrect the session.
  if (typeof window !== "undefined" && window.__LOGGING_OUT__) {
    throw Object.assign(new Error("Session is ending"), {
      status: 401,
      code: "LOGGING_OUT",
    });
  }

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

  const code = data?.code;
  const definitive =
    shouldRouteToLogin ||
    isSessionEndedResponse(response.status, code) ||
    (typeof code === "string" &&
      ["DEVICE_ID_MISMATCH", "ORG_ACCESS_REVOKED", "DEVICE_ID_REQUIRED"].includes(code)) ||
    (response.status === 401 && !getSessionState().accessToken);

  if (definitive) {
    // Await so the throw below doesn't race the redirect.
    await handleUnauthorizedSession();
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || data?.message || `Request failed with ${response.status}`,
    );
    error.status = response.status;
    error.code = data?.code || null;
    error.details = data || { status: response.status };
    throw error;
  }

  return data;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const productsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    ).toString();
    return apiFetch(`/products${qs ? `?${qs}` : ""}`);
  },

  get: (id) => apiFetch(`/products/${id}`),

  create: (body) =>
    apiFetch("/products", { method: "POST", body }),

  update: (id, body) =>
    apiFetch(`/products/${id}`, { method: "PUT", body }),

  remove: (id) =>
    apiFetch(`/products/${id}`, { method: "DELETE" }),

  /**
   * Flattened catalogue for the POS.
   * @param {{ locationId: string, search?: string, skip?: number, limit?: number }} params
   */
  posCatalog: (params) => {
    if (!params?.locationId) {
      return Promise.reject(new Error("locationId is required for posCatalog"));
    }
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    ).toString();
    return apiFetch(`/products/pos-catalog?${qs}`);
  },

  listByIds: (ids) =>
    apiFetch("/products/by-ids", {
      method: "POST",
      body: { ids },
    }),
};

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------
export const locationsApi = {
  list: () => apiFetch("/locations"),
  get: (id) => apiFetch(`/locations/${id}`),
  updateReceipt: (id, body) =>
    apiFetch(`/locations/${id}/receipt`, {
      method: "PATCH",
      body,
    }),
};

// ---------------------------------------------------------------------------
// Product Images
// ---------------------------------------------------------------------------
export const productImagesApi = {
  /**
   * Ask the server for a signed upload target.
   * Returns { url, resourceUrl, parameters }.
   */
  stagedUpload: ({ filename, mimeType, fileSize }) =>
    apiFetch("/products/images/staged-upload", {
      method: "POST",
      body: { filename, mimeType, fileSize },
    }),

  /**
   * After the file bytes are POSTed to the staged URL, register it with Shopify.
   * Returns { shopifyFileId, url, width, height }.
   */
  finalize: ({ resourceUrl, alt }) =>
    apiFetch("/products/images/finalize", {
      method: "POST",
      body: { resourceUrl, alt },
    }),

  /**
   * Best-effort delete of an orphaned upload.
   */
  delete: (shopifyFileId) =>
    apiFetch(`/products/images/${encodeURIComponent(shopifyFileId)}`, {
      method: "DELETE",
    }),
};

// ---------------------------------------------------------------------------
// Option Presets
// ---------------------------------------------------------------------------
export const optionPresetsApi = {
  list: () => apiFetch("/option-presets"),

  create: ({ name, values }) =>
    apiFetch("/option-presets", {
      method: "POST",
      body: { name, values },
    }),

  update: (id, { name, values }) =>
    apiFetch(`/option-presets/${id}`, {
      method: "PUT",
      body: { name, values },
    }),

  remove: (id) =>
    apiFetch(`/option-presets/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------
export const collectionsApi = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    ).toString();
    return apiFetch(`/collections${qs ? `?${qs}` : ""}`);
  },

  get: (id) => apiFetch(`/collections/${id}`),

  create: (body) =>
    apiFetch("/collections", { method: "POST", body }),

  update: (id, body) =>
    apiFetch(`/collections/${id}`, { method: "PUT", body }),

  remove: (id) =>
    apiFetch(`/collections/${id}`, { method: "DELETE" }),

  listProducts: (id, params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== "" && v != null),
    ).toString();
    return apiFetch(`/collections/${id}/products${qs ? `?${qs}` : ""}`);
  },

  addProducts: (id, productIds) =>
    apiFetch(`/collections/${id}/products`, {
      method: "POST",
      body: { productIds },
    }),

  removeProducts: (id, productIds) =>
    apiFetch(`/collections/${id}/products`, {
      method: "DELETE",
      body: { productIds },
    }),
};

export function getBaseUrl() {
  return BASE_URL;
}
