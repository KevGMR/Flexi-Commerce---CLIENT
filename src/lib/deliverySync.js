import { apiFetch } from "@/lib/api-client";
import {
  getPendingDeliveries,
  getPendingDeliveryById,
  markDeliveryAsSynced,
  deletePendingDelivery,
  getAllPendingDeliveryUpdates,
  markDeliveryUpdateAsSynced,
  deletePendingDeliveryUpdate,
  updatePendingDelivery,
} from "@/lib/indexeddb";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000; // 2 seconds

/**
 * Sync service for pending deliveries
 * Handles creation and updates of deliveries when offline
 */

/**
 * Sync a single pending delivery to the server
 */
export async function syncPendingDelivery(pendingDelivery) {
  try {
    // Validate required fields before syncing
    const validation = validateDeliveryBeforeSync(pendingDelivery);
    if (!validation.valid) {
      throw new Error(validation.errors.join(", "));
    }

    // Attempt to create delivery on server
    const response = await apiFetch("/delivery-fees", {
      method: "POST",
      body: JSON.stringify({
        locationId: pendingDelivery.locationId,
        recipientName: pendingDelivery.recipientName,
        recipientPhone: pendingDelivery.recipientPhone,
        recipientEmail: pendingDelivery.recipientEmail,
        deliveryAddress: pendingDelivery.deliveryAddress,
        deliveryInstructions: pendingDelivery.deliveryInstructions,
        notes: pendingDelivery.notes,
        deliveryCategory: pendingDelivery.deliveryCategory,
        deliveryOption: pendingDelivery.deliveryOption,
      }),
    });

    if (!response.success) {
      throw new Error(response.message || "Failed to create delivery");
    }

    const createdDelivery = response.data || response.deliveryFee;
    await markDeliveryAsSynced(pendingDelivery.id, createdDelivery._id);

    return {
      success: true,
      serverId: createdDelivery._id,
      serverData: createdDelivery,
    };
  } catch (err) {
    // Update retry count and error
    await updatePendingDelivery(pendingDelivery.id, {
      lastError: err.message,
    });

    throw err;
  }
}

/**
 * Sync a single pending delivery update (status change, etc.)
 */
export async function syncPendingDeliveryUpdate(pendingUpdate) {
  try {
    const { deliveryId, type, ...updateData } = pendingUpdate;

    let response;

    if (type === "status") {
      // Sync status update - categoryStatus-only payload
      const syncPayload = { ...updateData };

      if (syncPayload.status && !syncPayload.categoryStatus) {
        syncPayload.categoryStatus = syncPayload.status;
      }
      delete syncPayload.status;
      delete syncPayload.deliveryCategory;

      response = await apiFetch(`/delivery-fees/${deliveryId}/status`, {
        method: "PATCH",
        body: JSON.stringify(syncPayload),
      });
    } else if (type === "assignment") {
      // Sync driver assignment
      response = await apiFetch(`/delivery-fees/${deliveryId}/assign`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });
    } else if (type === "details") {
      // Sync delivery details update
      response = await apiFetch(`/delivery-fees/${deliveryId}`, {
        method: "PATCH",
        body: JSON.stringify(updateData),
      });
    } else {
      throw new Error(`Unknown update type: ${type}`);
    }

    if (!response.success) {
      throw new Error(response.message || "Failed to sync delivery update");
    }

    await markDeliveryUpdateAsSynced(pendingUpdate.id);

    return {
      success: true,
      updatedData: response.data,
    };
  } catch (err) {
    // Update retry count for the update
    // Note: Updates are simpler, so we just delete after max retries

    throw err;
  }
}

/**
 * Sync all pending deliveries and updates
 */
export async function syncAllPendingDeliveries(locationId = null) {
  const results = {
    syncedDeliveries: 0,
    failedDeliveries: 0,
    syncedUpdates: 0,
    failedUpdates: 0,
    errors: [],
  };

  try {
    // Sync pending deliveries first (creations must happen before updates)
    const pendingDeliveries = await getPendingDeliveries(locationId);

    for (const delivery of pendingDeliveries) {
      // Skip if already synced
      if (delivery.syncedAt) continue;

      // Skip if max retries exceeded
      if (delivery.retryCount >= MAX_RETRY_ATTEMPTS) {
        results.failedDeliveries++;
        results.errors.push({
          type: "delivery",
          id: delivery.id,
          message: `Max retries exceeded: ${delivery.lastError}`,
        });
        continue;
      }

      try {
        await syncPendingDelivery(delivery);
        results.syncedDeliveries++;
      } catch (err) {
        results.failedDeliveries++;
        results.errors.push({
          type: "delivery",
          id: delivery.id,
          message: err.message,
        });

        // Add exponential backoff
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            RETRY_DELAY_MS * Math.pow(2, delivery.retryCount || 0),
          ),
        );
      }
    }

    // Then sync pending delivery updates
    const pendingUpdates = await getAllPendingDeliveryUpdates();

    for (const update of pendingUpdates) {
      // Skip if already synced
      if (update.syncedAt) continue;

      // Skip if max retries exceeded
      if (update.retryCount >= MAX_RETRY_ATTEMPTS) {
        results.failedUpdates++;
        results.errors.push({
          type: "update",
          id: update.id,
          message: `Max retries exceeded: ${update.lastError}`,
        });
        continue;
      }

      try {
        await syncPendingDeliveryUpdate(update);
        results.syncedUpdates++;
      } catch (err) {
        results.failedUpdates++;
        results.errors.push({
          type: "update",
          id: update.id,
          message: err.message,
        });

        // Add exponential backoff
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            RETRY_DELAY_MS * Math.pow(2, update.retryCount || 0),
          ),
        );
      }
    }
  } catch (err) {
    results.errors.push({
      type: "sync",
      message: err.message,
    });
  }

  return results;
}

/**
 * Validate delivery data before syncing
 * Ensures required fields are present and valid
 */
export function validateDeliveryBeforeSync(delivery) {
  const errors = [];

  // Required fields
  if (!delivery.locationId) {
    errors.push("Location ID is required");
  }
  if (!delivery.recipientName) {
    errors.push("Recipient name is required");
  }
  if (!delivery.recipientPhone) {
    errors.push("Recipient phone is required");
  }
  if (!delivery.deliveryAddress) {
    errors.push("Delivery address is required");
  } else {
    if (!delivery.deliveryAddress.street) {
      errors.push("Street address is required");
    }
    if (!delivery.deliveryAddress.city) {
      errors.push("City is required");
    }
    // Country is optional - defaults to "Kenya" on backend
    // Only warn if explicitly provided but invalid
  }

  if (!delivery.deliveryCategory || !delivery.deliveryOption) {
    errors.push("Delivery category and option are required");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get sync status for a delivery
 */
export async function getDeliverySyncStatus(pendingDeliveryId) {
  const delivery = await getPendingDeliveryById(pendingDeliveryId);
  if (!delivery) {
    return null;
  }

  return {
    id: pendingDeliveryId,
    isSynced: !!delivery.syncedAt,
    syncedAt: delivery.syncedAt || null,
    serverId: delivery.serverId || null,
    retryCount: delivery.retryCount || 0,
    lastError: delivery.lastError || null,
    canRetry: (delivery.retryCount || 0) < MAX_RETRY_ATTEMPTS,
  };
}

/**
 * Retry syncing a failed delivery
 */
export async function retryPendingDelivery(pendingDeliveryId) {
  const delivery = await getPendingDeliveryById(pendingDeliveryId);
  if (!delivery) {
    throw new Error("Pending delivery not found");
  }

  if (delivery.retryCount >= MAX_RETRY_ATTEMPTS) {
    throw new Error("Maximum retry attempts exceeded");
  }

  return syncPendingDelivery(delivery);
}
