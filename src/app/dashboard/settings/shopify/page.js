"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { useSyncManager } from "@/hooks/useSyncManager";
import { PERMISSIONS } from "@/lib/permissions";

const QUEUE_STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-800",
  processing: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-700",
  retrying: "bg-indigo-100 text-indigo-700",
  needs_review: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
};

const formatDateTime = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

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
  const [syncQueue, setSyncQueue] = useState([]);
  const [queueFilterStatus, setQueueFilterStatus] = useState("failed");
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueMessage, setQueueMessage] = useState("");
  const [queueError, setQueueError] = useState("");
  const [processingQueue, setProcessingQueue] = useState(false);
  const [retryingQueueItemId, setRetryingQueueItemId] = useState("");

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

  const loadSyncQueue = useCallback(async () => {
    if (!isConnected) {
      setSyncQueue([]);
      return;
    }

    setQueueLoading(true);
    setQueueError("");

    try {
      const query = new URLSearchParams();
      if (queueFilterStatus) query.set("status", queueFilterStatus);

      const response = await apiFetch(`/shopify/sync-queue?${query.toString()}`);
      setSyncQueue(response?.data || []);
    } catch (err) {
      setQueueError(err?.message || "Failed to load Shopify sync queue.");
      setSyncQueue([]);
    } finally {
      setQueueLoading(false);
    }
  }, [isConnected, queueFilterStatus]);

  useEffect(() => {
    loadConnection();
  }, [activeOrganization, loadConnection]);

  useEffect(() => {
    if (isConnected) {
      loadLocations();
    }
  }, [isConnected]);

  useEffect(() => {
    loadSyncQueue();
  }, [loadSyncQueue]);

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

  const handleProcessSyncQueue = async () => {
    setProcessingQueue(true);
    setQueueMessage("");
    setQueueError("");

    try {
      const response = await apiFetch("/shopify/sync-queue/process", {
        method: "POST",
      });
      setQueueMessage(
        response?.message ||
          `Processed ${response?.data?.processed || 0} queued item(s).`,
      );
      await loadSyncQueue();
    } catch (err) {
      setQueueError(err?.message || "Failed to process sync queue.");
    } finally {
      setProcessingQueue(false);
    }
  };

  const handleRetryQueueItem = async (queueId) => {
    setRetryingQueueItemId(queueId);
    setQueueMessage("");
    setQueueError("");

    try {
      const response = await apiFetch(`/shopify/sync-queue/${queueId}/retry`, {
        method: "POST",
      });
      setQueueMessage(response?.message || "Retry processed.");
      await loadSyncQueue();
    } catch (err) {
      setQueueError(err?.message || "Failed to retry sync queue item.");
    } finally {
      setRetryingQueueItemId("");
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

      <div className="bg-white border border-zinc-200 rounded-lg p-6 mt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold mb-1">Shopify Product Sync Retries</h2>
            <p className="text-xs text-zinc-500">
              Organization-level queue with per-item retry attempts and status.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={queueFilterStatus}
              onChange={(e) => setQueueFilterStatus(e.target.value)}
              className="rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">All statuses</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="retrying">Retrying</option>
              <option value="needs_review">Needs Review</option>
              <option value="completed">Completed</option>
            </select>
            <button
              onClick={loadSyncQueue}
              disabled={queueLoading}
              className="px-3 py-2 rounded border border-zinc-300 text-sm disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={handleProcessSyncQueue}
              disabled={processingQueue || !canManage || !isOnline || !isConnected}
              className="px-3 py-2 rounded bg-zinc-900 text-white text-sm disabled:opacity-50"
            >
              {processingQueue ? "Processing..." : "Process Queue"}
            </button>
          </div>
        </div>

        {queueMessage && (
          <div className="bg-green-50 border border-green-200 rounded p-3 mb-4 text-sm text-green-700">
            {queueMessage}
          </div>
        )}

        {queueError && (
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm text-red-700">
            {queueError}
          </div>
        )}

        {queueLoading ? (
          <div className="text-xs text-zinc-500">Loading sync queue...</div>
        ) : syncQueue.length === 0 ? (
          <div className="text-xs text-zinc-500">No queue items for this filter.</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
            <table className="w-full">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-700 uppercase tracking-wider">
                    Sale
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-700 uppercase tracking-wider">
                    Shopify Variant
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-700 uppercase tracking-wider">
                    Qty Change
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-700 uppercase tracking-wider">
                    Retry Attempts
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-700 uppercase tracking-wider">
                    Next Retry
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-zinc-700 uppercase tracking-wider">
                    Last Error
                  </th>
                  <th className="px-3 py-2 text-right text-[11px] font-medium text-zinc-700 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {syncQueue.map((item) => {
                  const retryDisabled =
                    !canManage ||
                    !isOnline ||
                    item.status === "completed" ||
                    item.status === "processing" ||
                    retryingQueueItemId === item._id;

                  return (
                    <tr key={item._id} className="hover:bg-zinc-50">
                      <td className="px-3 py-2 text-xs text-zinc-700">
                        {item.saleId ? String(item.saleId) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-700">
                        {item.shopifyVariantId || "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-700">
                        {item.inventoryUpdate?.quantityChange ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-700">
                        {(item.attemptCount || 0) + 1} / {item.maxAttempts || 10}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-medium ${QUEUE_STATUS_STYLES[item.status] || "bg-zinc-100 text-zinc-700"}`}
                        >
                          {item.status || "unknown"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-700">
                        {formatDateTime(item.nextRetryAt)}
                      </td>
                      <td
                        className="px-3 py-2 text-xs text-zinc-700 max-w-75 truncate"
                        title={item.lastError?.message || ""}
                      >
                        {item.lastError?.message || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          onClick={() => handleRetryQueueItem(item._id)}
                          disabled={retryDisabled}
                          className="px-3 py-1 rounded border border-zinc-300 text-xs disabled:opacity-50"
                        >
                          {retryingQueueItemId === item._id ? "Retrying..." : "Retry"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!canManage && (
          <div className="mt-3 text-xs text-zinc-500">
            Retry actions are available to Managers and Owners only.
          </div>
        )}
      </div>
    </div>
  );
}
