"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { useSyncManager } from "@/hooks/useSyncManager";
import { PERMISSIONS } from "@/lib/permissions";

export default function ShopifySettingsPage() {
  const { activeOrganization, can } = useSessionStore();
  const { isOnline } = useSyncManager();

  const [shopifyForm, setShopifyForm] = useState({
    storeName: "",
    storeUrl: "",
    clientId: "",
    clientSecret: "",
  });

  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState(null);
  const [shopifyLocations, setShopifyLocations] = useState([]);
  const [flexiLocations, setFlexiLocations] = useState([]);
  const [status, setStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshingToken, setIsRefreshingToken] = useState(false);

  const canManage = can(PERMISSIONS.MANAGE_SETTINGS);

  const shouldRefreshToken = (info) => {
    if (!info?.lastTokenRefreshAt) return true;
    const lastRefresh = new Date(info.lastTokenRefreshAt).getTime();
    if (Number.isNaN(lastRefresh)) return true;
    const hoursSinceRefresh = (Date.now() - lastRefresh) / (1000 * 60 * 60);
    return hoursSinceRefresh >= 23;
  };

  const refreshShopifyToken = useCallback(async () => {
    if (isRefreshingToken) return;
    setIsRefreshingToken(true);
    setNotice("Refreshing Shopify token...");
    try {
      await apiFetch("/shopify/products?limit=1");
      setStatus("Shopify token refreshed.");
      await loadConnection({ skipRefresh: true });
    } catch (err) {
      setNotice(
        err?.message ||
          "Shopify token refresh failed. Reconnect if it persists.",
      );
    } finally {
      setIsRefreshingToken(false);
    }
  }, [isRefreshingToken]);

  const loadConnection = useCallback(
    async ({ skipRefresh = false } = {}) => {
      try {
        const data = await apiFetch("/shopify/connection");
        if (data?.connected && data?.data) {
          const info = data.data;
          const isActive = info.status === "active";

          setIsConnected(isActive);
          setConnectionInfo(info);

          if (info.clientId && info.clientSecret) {
            setShopifyForm({
              storeName: info.storeName || "",
              storeUrl: info.storeUrl || "",
              clientId: info.clientId,
              clientSecret: info.clientSecret,
            });
          }

          if (!isActive) {
            setNotice(
              "Shopify connection needs attention. Update credentials and reconnect.",
            );
          } else {
            setNotice("");
          }

          if (
            isActive &&
            isOnline &&
            !skipRefresh &&
            shouldRefreshToken(info)
          ) {
            refreshShopifyToken();
          }
        } else {
          setIsConnected(false);
          setConnectionInfo(null);
          setNotice("");
        }
      } catch (err) {
        setIsConnected(false);
        setConnectionInfo(null);
        setNotice("");
      }
    },
    [isOnline, refreshShopifyToken],
  );

  const loadLocations = async () => {
    try {
      const [flexiRes, shopifyRes] = await Promise.all([
        apiFetch("/locations"),
        apiFetch("/locations/shopify/available-locations"),
      ]);
      setFlexiLocations(flexiRes?.locations || []);
      setShopifyLocations(shopifyRes?.shopifyLocations || []);
    } catch (err) {
      setFlexiLocations([]);
      setShopifyLocations([]);
    }
  };

  useEffect(() => {
    loadConnection();
  }, [activeOrganization, loadConnection]);

  useEffect(() => {
    if (isConnected) {
      loadLocations();
    }
  }, [isConnected]);

  const handleConnect = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus("");
    setNotice("");
    setError("");
    try {
      await apiFetch("/shopify/connect", {
        method: "POST",
        body: {
          storeName: shopifyForm.storeName,
          storeUrl: shopifyForm.storeUrl,
          clientId: shopifyForm.clientId,
          clientSecret: shopifyForm.clientSecret,
        },
      });
      setStatus("Shopify connected successfully.");
      setShopifyForm({
        storeName: "",
        storeUrl: "",
        clientId: "",
        clientSecret: "",
      });
      await loadConnection();
      await loadLocations();
    } catch (err) {
      setError(err?.message || "Failed to connect Shopify.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect Shopify store?")) return;
    setIsLoading(true);
    setStatus("");
    setNotice("");
    setError("");
    try {
      await apiFetch("/shopify/disconnect", { method: "DELETE" });
      setStatus("Shopify disconnected.");
      setIsConnected(false);
      setConnectionInfo(null);
      setFlexiLocations([]);
      setShopifyLocations([]);
    } catch (err) {
      setError(err?.message || "Failed to disconnect Shopify.");
    } finally {
      setIsLoading(false);
    }
  };

  const shopifyLocationById = useMemo(() => {
    const map = new Map();
    shopifyLocations.forEach((loc) => map.set(loc.id, loc));
    return map;
  }, [shopifyLocations]);

  const handleMappingChange = async (flexiLocationId, shopifyLocationId) => {
    setIsLoading(true);
    setStatus("");
    setNotice("");
    setError("");
    try {
      const selected = shopifyLocationById.get(shopifyLocationId);
      await apiFetch(`/locations/${flexiLocationId}/set-shopify-location`, {
        method: "POST",
        body: {
          shopifyLocationId: shopifyLocationId || null,
          shopifyLocationName: selected?.name || "",
        },
      });
      setStatus("Location mapping updated.");
      await loadLocations();
    } catch (err) {
      setError(err?.message || "Failed to update mapping.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Shopify</h1>

      {status && (
        <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm text-green-700">
          {status}
        </div>
      )}
      {notice && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-700">
          {notice}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-700">
          You are offline. Shopify settings are read-only.
        </div>
      )}

      <div className="bg-white border border-zinc-200 rounded-lg p-6 mb-6">
        <h2 className="text-sm font-semibold mb-3">Connection</h2>
        {isConnected ? (
          <div className="space-y-4">
            <div className="text-xs text-zinc-600">
              Connected to {connectionInfo?.storeName || "Shopify"}
            </div>
            <button
              onClick={handleDisconnect}
              disabled={isLoading || !canManage || !isOnline}
              className="px-4 py-2 rounded bg-red-100 text-red-700 text-sm disabled:opacity-50"
            >
              {isLoading ? "Disconnecting..." : "Disconnect Shopify"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="space-y-3">
            {connectionInfo?.status &&
              connectionInfo.status !== "active" &&
              connectionInfo?.syncError?.message && (
                <div className="text-xs text-zinc-500">
                  Last error: {connectionInfo.syncError.message}
                </div>
              )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                name="storeName"
                value={shopifyForm.storeName}
                onChange={(e) =>
                  setShopifyForm((prev) => ({
                    ...prev,
                    storeName: e.target.value,
                  }))
                }
                placeholder="Store name"
                required
                disabled={!canManage || !isOnline}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                name="storeUrl"
                value={shopifyForm.storeUrl}
                onChange={(e) =>
                  setShopifyForm((prev) => ({
                    ...prev,
                    storeUrl: e.target.value,
                  }))
                }
                placeholder="your-store.myshopify.com"
                required
                disabled={!canManage || !isOnline}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                name="clientId"
                value={shopifyForm.clientId}
                onChange={(e) =>
                  setShopifyForm((prev) => ({
                    ...prev,
                    clientId: e.target.value,
                  }))
                }
                placeholder="Client ID"
                required
                disabled={!canManage || !isOnline}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
              <input
                type="password"
                name="clientSecret"
                value={shopifyForm.clientSecret}
                onChange={(e) =>
                  setShopifyForm((prev) => ({
                    ...prev,
                    clientSecret: e.target.value,
                  }))
                }
                placeholder="Client Secret"
                required
                disabled={!canManage || !isOnline}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !canManage || !isOnline}
              className="px-4 py-2 rounded bg-zinc-900 text-white text-sm disabled:opacity-50"
            >
              {isLoading
                ? "Connecting..."
                : connectionInfo?.status && connectionInfo.status !== "active"
                  ? "Reconnect Shopify"
                  : "Connect Shopify"}
            </button>
          </form>
        )}
      </div>

      <div className="bg-white border border-zinc-200 rounded-lg p-6">
        <h2 className="text-sm font-semibold mb-3">Location Mapping</h2>
        {!isConnected ? (
          <div className="text-xs text-zinc-500">
            Connect Shopify to map locations.
          </div>
        ) : (
          <div className="space-y-3">
            {flexiLocations.map((loc) => (
              <div
                key={loc._id}
                className="flex flex-col md:flex-row md:items-center gap-3 border border-zinc-200 rounded p-3"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium text-zinc-900">
                    {loc.name}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {loc.locationType}
                  </div>
                </div>
                <select
                  value={loc.shopifyLocationId || ""}
                  onChange={(e) => handleMappingChange(loc._id, e.target.value)}
                  disabled={!canManage || !isOnline}
                  className="w-full md:w-72 rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">Unmapped</option>
                  {shopifyLocations.map((sLoc) => (
                    <option key={sLoc.id} value={sLoc.id}>
                      {sLoc.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
            {flexiLocations.length === 0 && (
              <div className="text-xs text-zinc-500">
                No Flexi locations found.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
