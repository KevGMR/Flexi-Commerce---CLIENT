import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";

/**
 * Custom hook for managing drivers
 * Supports listing, filtering by status, and CRUD operations
 */
export function useDrivers({ status = null, autoFetch = true } = {}) {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Build query parameters
  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    return params.toString();
  }, [status]);

  // Fetch drivers from API
  const fetchDrivers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const query = buildQuery();
      const response = await apiFetch(`/drivers${query ? `?${query}` : ""}`);

      if (response.success) {
        setDrivers(response.data || []);
      } else {
        throw new Error(response.message || "Failed to fetch drivers");
      }
    } catch (err) {
      console.error("Error fetching drivers:", err);
      setError(err.message);
      setDrivers([]);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch) {
      fetchDrivers();
    }
  }, [autoFetch, fetchDrivers]);

  // Get single driver by ID
  const getDriver = useCallback(async (driverId) => {
    try {
      const response = await apiFetch(`/drivers/${driverId}`);
      if (response.success) {
        return response.data;
      }
      throw new Error(response.message || "Failed to fetch driver");
    } catch (err) {
      console.error("Error fetching driver:", err);
      throw err;
    }
  }, []);

  // Create new driver
  const createDriver = useCallback(async (driverData) => {
    try {
      const response = await apiFetch("/drivers", {
        method: "POST",
        body: JSON.stringify(driverData),
      });

      if (response.success) {
        return response.data;
      }
      throw new Error(response.message || "Failed to create driver");
    } catch (err) {
      console.error("Error creating driver:", err);
      throw err;
    }
  }, []);

  // Update driver
  const updateDriver = useCallback(async (driverId, updates) => {
    try {
      const response = await apiFetch(`/drivers/${driverId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });

      if (response.success) {
        return response.data;
      }
      throw new Error(response.message || "Failed to update driver");
    } catch (err) {
      console.error("Error updating driver:", err);
      throw err;
    }
  }, []);

  // Delete driver
  const deleteDriver = useCallback(async (driverId) => {
    try {
      const response = await apiFetch(`/drivers/${driverId}`, {
        method: "DELETE",
      });

      if (response.success) {
        return response.data;
      }
      throw new Error(response.message || "Failed to delete driver");
    } catch (err) {
      console.error("Error deleting driver:", err);
      throw err;
    }
  }, []);

  return {
    drivers,
    loading,
    error,
    refetch: fetchDrivers,
    getDriver,
    createDriver,
    updateDriver,
    deleteDriver,
  };
}
