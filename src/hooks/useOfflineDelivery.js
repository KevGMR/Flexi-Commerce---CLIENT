import { useState, useCallback } from "react";
import { useSyncManager } from "@/hooks/useSyncManager";
import {
  savePendingDelivery,
  savePendingDeliveryUpdate,
  cacheDeliveryCategories,
} from "@/lib/indexeddb";

/**
 * Custom hook for offline-aware delivery operations
 * Queues deliveries for sync when offline, syncs immediately when online
 */
export function useOfflineDelivery() {
  const { isOnline, updatePendingCounts, retrySyncPendingDeliveries } =
    useSyncManager();
  const [isQueuing, setIsQueuing] = useState(false);
  const [error, setError] = useState(null);

  // Create delivery (offline-aware)
  const createDelivery = useCallback(
    async (deliveryData, options = {}) => {
      setIsQueuing(true);
      setError(null);

      try {
        // If online, use the regular API directly
        if (isOnline && !options.forceOfflineQueue) {
          try {
            const { useDeliveries } = await import("@/hooks/useDeliveries");
            // This will be handled by the parent component's API call
            // We're just providing the offline fallback here
            throw new Error("Use regular API when online");
          } catch (err) {
            // Fall through to offline queueing
          }
        }

        // Queue to IndexedDB for later sync
        const deliveryId = await savePendingDelivery({
          ...deliveryData,
          isOfflineCreation: true,
          createdOfflineAt: new Date().toISOString(),
        });

        // Update pending counts
        await updatePendingCounts(deliveryData.locationId);

        // If online, attempt immediate sync
        if (isOnline) {
          setTimeout(() => {
            retrySyncPendingDeliveries(deliveryData.locationId);
          }, 1000);
        }

        setIsQueuing(false);

        return {
          success: true,
          offlineId: deliveryId,
          message: isOnline
            ? "Delivery queued and syncing..."
            : "Delivery saved offline. Will sync when online.",
        };
      } catch (err) {
        setError(err.message);
        setIsQueuing(false);
        throw err;
      }
    },
    [isOnline, updatePendingCounts, retrySyncPendingDeliveries],
  );

  // Update delivery status (offline-aware)
  const updateDeliveryStatus = useCallback(
    async (deliveryId, statusUpdate, options = {}) => {
      setIsQueuing(true);
      setError(null);

      try {
        // Determine the type of update from the status data
        let updateType = "status";
        if (statusUpdate.driverId) {
          updateType = "assignment";
        } else if (
          statusUpdate.recipientName ||
          statusUpdate.deliveryAddress
        ) {
          updateType = "details";
        }

        // Queue the update to IndexedDB
        const updateId = await savePendingDeliveryUpdate(deliveryId, {
          type: updateType,
          ...statusUpdate,
          updatedOfflineAt: new Date().toISOString(),
        });

        // Update pending counts
        await updatePendingCounts();

        // If online, attempt immediate sync
        if (isOnline) {
          setTimeout(() => {
            retrySyncPendingDeliveries();
          }, 1000);
        }

        setIsQueuing(false);

        return {
          success: true,
          updateId,
          message: isOnline
            ? "Update queued and syncing..."
            : "Update saved offline. Will sync when online.",
        };
      } catch (err) {
        setError(err.message);
        setIsQueuing(false);
        throw err;
      }
    },
    [isOnline, updatePendingCounts, retrySyncPendingDeliveries],
  );

  // Cache categories for offline access
  const cacheCategories = useCallback(
    async (locationId, categories) => {
      try {
        await cacheDeliveryCategories(locationId, categories);
        return { success: true };
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [],
  );

  // Manually retry syncing pending deliveries
  const retrySync = useCallback(
    async (locationId = null) => {
      try {
        const result = await retrySyncPendingDeliveries(locationId);
        return result;
      } catch (err) {
        setError(err.message);
        throw err;
      }
    },
    [retrySyncPendingDeliveries],
  );

  return {
    isOnline,
    isQueuing,
    error,
    createDelivery,
    updateDeliveryStatus,
    cacheCategories,
    retrySync,
  };
}
