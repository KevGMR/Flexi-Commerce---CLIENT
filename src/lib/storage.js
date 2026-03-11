import { clearAllIndexedDbData, deleteFlexiPosDatabase } from "@/lib/indexeddb";

export const SESSION_STORAGE_KEY = "flexi_pos_session";

export function loadSessionFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Failed to load session from storage", err);
    return null;
  }
}

export function saveSessionToStorage(session) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn("Failed to save session to storage", err);
  }
}

export function clearSessionStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear session storage", err);
  }
}

function expireCookie(name, domain) {
  const parts = [`${name}=`, "Max-Age=0", "expires=Thu, 01 Jan 1970 00:00:00 GMT", "path=/"];

  if (domain) {
    parts.push(`domain=${domain}`);
  }

  document.cookie = parts.join("; ");
}

export function clearBrowserCookies() {
  if (typeof document === "undefined") return;

  const cookieNames = document.cookie
    .split(";")
    .map((entry) => entry.trim().split("=")[0])
    .filter(Boolean);

  const hostname = window.location.hostname;
  const domains = new Set([
    undefined,
    hostname,
    hostname.startsWith(".") ? hostname : `.${hostname}`,
  ]);

  for (const cookieName of [...cookieNames, "refreshToken"]) {
    for (const domain of domains) {
      expireCookie(cookieName, domain);
    }
  }
}

async function clearCacheStorage() {
  if (typeof window === "undefined" || !("caches" in window)) return;

  const cacheNames = await window.caches.keys();
  await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
}

export async function clearClientPersistence() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch (err) {
    console.warn("Failed to clear web storage", err);
  }

  clearBrowserCookies();
  await clearCacheStorage();

  const deleted = await deleteFlexiPosDatabase();
  if (!deleted) {
    await clearAllIndexedDbData();
  }
}
