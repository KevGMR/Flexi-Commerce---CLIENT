import { useEffect, useState, useCallback } from "react";
import {
  getPendingSales,
  deletePendingSale,
  updatePendingSale,
  getPendingDeliveries,
  getPendingDeliveriesCount,
} from "@/lib/indexeddb";
import { syncAllPendingDeliveries } from "@/lib/deliverySync";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";

// Hook to manage sync, retries, and online/offline status for both sales and deliveries
export function useSyncManager() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [pendingDeliveriesCount, setPendingDeliveriesCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSyncingDeliveries, setIsSyncingDeliveries] = useState(false);
  const [isReconnectingShopify, setIsReconnectingShopify] = useState(false);

  // Track online/offline status using browser events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Set initial status from navigator.onLine
    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Update pending counts
  const updatePendingCounts = useCallback(async (locationId = null) => {
    try {
      const sales = await getPendingSales();
      setPendingSalesCount(sales.length);

      const deliveriesCount = await getPendingDeliveriesCount(locationId);
      setPendingDeliveriesCount(deliveriesCount);
    } catch (err) {
      console.error("Failed to get pending counts:", err);
    }
  }, []);

  // Initialize pending counts on mount
  useEffect(() => {
    updatePendingCounts();
  }, [updatePendingCounts]);

  // Retry all pending sales when online
  const retrySyncPendingSales = useCallback(
    async (accessToken, deviceId, deviceName, organizationSlug) => {
      const sales = await getPendingSales();
      if (sales.length === 0) return;

      setIsRetrying(true);

      const retryWithDelay = async (index) => {
        if (index >= sales.length) return;

        const sale = sales[index];
        try {
          setIsReconnectingShopify(true);

          // Extract sale data (remove metadata fields)
          const { savedAt, retryCount, lastError, ...payload } = sale;

          const response = await fetch(`${API_BASE_URL}/sales`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
              "X-Device-ID": deviceId || "",
              "X-Device-Name": deviceName || "",
              "X-Organization-Slug": organizationSlug || "",
            },
            body: JSON.stringify(payload),
          });

          if (response.ok) {
            await deletePendingSale(sale.id);
          } else if (response.status === 401) {
            // Token expired; stop retry and let auth handle refresh
            await updatePendingSale(sale.id, { lastError: "Token expired" });
            setIsReconnectingShopify(false);
            return;
          } else {
            await updatePendingSale(sale.id, {
              lastError: response.statusText,
            });
          }
        } catch (err) {
          await updatePendingSale(sale.id, { lastError: err.message });
        }

        if (index < sales.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 20000));
        }

        await retryWithDelay(index + 1);
      };

      await retryWithDelay(0);

      setIsReconnectingShopify(false);
      setIsRetrying(false);
      await updatePendingCounts();
    },
    [updatePendingCounts],
  );

  // Sync all pending deliveries when online
  const retrySyncPendingDeliveries = useCallback(
    async (locationId = null) => {
      const deliveries = await getPendingDeliveries(locationId);
      if (deliveries.length === 0) {
        return {
          syncedDeliveries: 0,
          failedDeliveries: 0,
          syncedUpdates: 0,
          failedUpdates: 0,
          errors: [],
        };
      }

      setIsSyncingDeliveries(true);

      try {
        const result = await syncAllPendingDeliveries(locationId);
        await updatePendingCounts(locationId);
        return result;
      } catch (err) {
        console.error("Failed to sync deliveries:", err);
        return {
          syncedDeliveries: 0,
          failedDeliveries: deliveries.length,
          syncedUpdates: 0,
          failedUpdates: 0,
          errors: [{ message: err.message }],
        };
      } finally {
        setIsSyncingDeliveries(false);
      }
    },
    [updatePendingCounts],
  );

  // Retry a single pending sale manually
  const retrySingleSale = useCallback(
    async (saleId, accessToken, deviceId, deviceName, organizationSlug) => {
      setIsRetrying(true);
      setIsReconnectingShopify(true);

      try {
        const sale =
          await require("@/lib/indexeddb").getPendingSaleById(saleId);
        if (!sale) throw new Error("Sale not found");

        // Extract sale data (remove metadata fields)
        const { savedAt, retryCount, lastError, ...payload } = sale;

        const response = await fetch(`${API_BASE_URL}/sales`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "X-Device-ID": deviceId || "",
            "X-Device-Name": deviceName || "",
            "X-Organization-Slug": organizationSlug || "",
          },
          body: JSON.stringify(payload),
        });

        if (response.ok) {
          await deletePendingSale(saleId);
          return { success: true };
        } else {
          await updatePendingSale(saleId, { lastError: response.statusText });
          return { success: false, error: response.statusText };
        }
      } catch (err) {
        await updatePendingSale(saleId, { lastError: err.message });
        return { success: false, error: err.message };
      } finally {
        setIsReconnectingShopify(false);
        setIsRetrying(false);
        await updatePendingCounts();
      }
    },
    [updatePendingCounts],
  );

  return {
    isOnline,
    pendingSalesCount,
    pendingDeliveriesCount,
    totalPendingCount: pendingSalesCount + pendingDeliveriesCount,
    isRetrying,
    isSyncingDeliveries,
    isReconnectingShopify,
    updatePendingCounts,
    retrySyncPendingSales,
    retrySyncPendingDeliveries,
    retrySingleSale,
  };
}
