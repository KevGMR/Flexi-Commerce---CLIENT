import { useEffect, useState, useCallback } from "react";
import {
  getPendingSales,
  deletePendingSale,
  updatePendingSale,
} from "@/lib/indexeddb";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";

// Hook to manage sync, retries, and online/offline status
export function useSyncManager() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingSalesCount, setPendingSalesCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
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

  // Update pending sales count
  const updatePendingCount = useCallback(async () => {
    try {
      const sales = await getPendingSales();
      setPendingSalesCount(sales.length);
    } catch (err) {
      console.error("Failed to get pending sales count:", err);
    }
  }, []);

  // Initialize pending count on mount
  useEffect(() => {
    updatePendingCount();
  }, [updatePendingCount]);

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

          console.log({sale,payload});
          

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

          console.log({response, payload});

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
      await updatePendingCount();
    },
    [updatePendingCount],
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
        await updatePendingCount();
      }
    },
    [updatePendingCount],
  );

  return {
    isOnline,
    pendingSalesCount,
    isRetrying,
    isReconnectingShopify,
    updatePendingCount,
    retrySyncPendingSales,
    retrySingleSale,
  };
}
