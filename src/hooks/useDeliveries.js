import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";

/**
 * Custom hook for managing deliveries with filtering and pagination
 * Supports listing, filtering by status/location/date, and CRUD operations
 */
export function useDeliveries({
  categoryStatus = null,
  assigned = null,
  deliveryCategory = null,
  deliveryOption = null,
  searchTerm = null,
  locationId = null,
  startDate = null,
  endDate = null,
  page = 1,
  limit = 20,
  autoFetch = true,
} = {}) {
  const [deliveries, setDeliveries] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20,
    pages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const selectedLocationId = useSessionStore((s) => s.selectedLocationId);

  // Build query parameters
  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());

    if (categoryStatus) params.append("categoryStatus", categoryStatus);
    if (assigned !== null) params.append("assigned", String(assigned));
    if (deliveryCategory) params.append("deliveryCategory", deliveryCategory);
    if (deliveryOption) params.append("deliveryOption", deliveryOption);
    if (locationId || selectedLocationId) {
      params.append("locationId", locationId || selectedLocationId);
    }
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    if (searchTerm) params.append("searchTerm", searchTerm);

    return params.toString();
  }, [
    categoryStatus,
    assigned,
    deliveryCategory,
    deliveryOption,
    locationId,
    selectedLocationId,
    startDate,
    endDate,
    searchTerm,
    page,
    limit,
  ]);

  // Fetch deliveries from API
  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = buildQuery();
      const response = await apiFetch(`/delivery-fees?${query}`);

      if (response.success) {
        const deliveriesData = response.data || [];
        const paginationData = response.pagination || {
          total: 0,
          page: 1,
          limit: 20,
          pages: 1,
        };

        console.log("[useDeliveries] Parsed deliveries count:", deliveriesData.length);
        console.log("[useDeliveries] Pagination:", paginationData);

        setDeliveries(deliveriesData);
        setPagination(paginationData);

        if (deliveriesData.length === 0) {
          console.warn("[useDeliveries] No deliveries returned from API");
        }
      } else {
        throw new Error(response.message || "Failed to fetch deliveries");
      }
    } catch (err) {
      console.error("[useDeliveries] Fetch error:", err);
      console.error("[useDeliveries] Error details:", {
        message: err.message,
        stack: err.stack,
        response: err.response,
      });
      setError(err.message);
      setDeliveries([]);
    } finally {
      setLoading(false);
      console.log("[useDeliveries] Fetch complete");
    }
  }, [buildQuery]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    console.log("[useDeliveries] useEffect triggered, autoFetch:", autoFetch);
    if (autoFetch) {
      fetchDeliveries();
    } else {
      console.log("[useDeliveries] autoFetch is false, skipping fetch");
    }
  }, [autoFetch, fetchDeliveries]);

  // Get single delivery by ID
  const getDelivery = useCallback(async (deliveryId) => {
    try {
      const response = await apiFetch(`/delivery-fees/${deliveryId}`);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.message || "Failed to fetch delivery");
    } catch (err) {
      console.error("Error fetching delivery:", err);
      throw err;
    }
  }, []);

  // Create new delivery
  const createDelivery = useCallback(async (deliveryData) => {
    try {
      const response = await apiFetch("/delivery-fees", {
        method: "POST",
        body: JSON.stringify(deliveryData),
      });

      if (response.success) {
        return response.data || response.deliveryFee;
      }
      throw new Error(response.message || "Failed to create delivery");
    } catch (err) {
      console.error("Error creating delivery:", err);
      throw err;
    }
  }, []);

  // Update delivery details
  const updateDelivery = useCallback(async (deliveryId, updates) => {
    try {
      const response = await apiFetch(`/delivery-fees/${deliveryId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      if (response.success) {
        return response.data;
      }
      throw new Error(response.message || "Failed to update delivery");
    } catch (err) {
      console.error("Error updating delivery:", err);
      throw err;
    }
  }, []);

  // Update delivery status
  const updateStatus = useCallback(async (deliveryId, statusData) => {
    try {
      const response = await apiFetch(`/delivery-fees/${deliveryId}/status`, {
        method: "PATCH",
        body: JSON.stringify(statusData),
      });

      if (response.success) {
        return response.data;
      }
      throw new Error(response.message || "Failed to update status");
    } catch (err) {
      console.error("Error updating status:", err);
      throw err;
    }
  }, []);

  // Assign driver to delivery
  const assignDriver = useCallback(async (deliveryId, driverId) => {
    try {
      const response = await apiFetch(`/delivery-fees/${deliveryId}/assign`, {
        method: "PATCH",
        body: JSON.stringify({ driverId }),
      });

      if (response.success) {
        return response.data;
      }
      throw new Error(response.message || "Failed to assign driver");
    } catch (err) {
      console.error("Error assigning driver:", err);
      throw err;
    }
  }, []);

  // Cancel delivery
  const cancelDelivery = useCallback(async (deliveryId, reason = null) => {
    try {
      const response = await apiFetch(`/delivery-fees/${deliveryId}`, {
        method: "DELETE",
        body: reason ? JSON.stringify({ cancelReason: reason }) : undefined,
      });

      if (response.success) {
        return response.data;
      }
      throw new Error(response.message || "Failed to cancel delivery");
    } catch (err) {
      console.error("Error cancelling delivery:", err);
      throw err;
    }
  }, []);

  return {
    deliveries,
    pagination,
    loading,
    error,
    refetch: fetchDeliveries,
    getDelivery,
    createDelivery,
    updateDelivery,
    updateStatus,
    assignDriver,
    cancelDelivery,
  };
}
