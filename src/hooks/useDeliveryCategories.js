import { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";

/**
 * Custom hook for managing delivery categories
 * Fetches categories from API and provides helper methods for category/option lookup
 */
export function useDeliveryCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const selectedLocationId = useSessionStore((s) => s.selectedLocationId);

  // Fetch categories from API
  const fetchCategories = useCallback(async () => {
    if (!selectedLocationId) {
      setCategories([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(
        `/locations/${selectedLocationId}/delivery-categories`,
      );

      if (response.success) {
        setCategories(response.categories || []);
      } else {
        throw new Error(response.message || "Failed to fetch categories");
      }
    } catch (err) {
      console.error("Error fetching delivery categories:", err);
      setError(err.message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, [selectedLocationId]);

  // Fetch categories on mount and when location changes
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Helper: Get category by name
  const getCategory = useCallback(
    (categoryName) => {
      return categories.find((cat) => cat.categoryName === categoryName);
    },
    [categories],
  );

  // Helper: Get all options for a category
  const getOptions = useCallback(
    (categoryName) => {
      const category = getCategory(categoryName);
      return category?.childOptions || [];
    },
    [getCategory],
  );

  // Helper: Get specific option by name
  const getOption = useCallback(
    (categoryName, optionName) => {
      const options = getOptions(categoryName);
      return options.find((opt) => opt.optionName === optionName);
    },
    [getOptions],
  );

  // Helper: Get workflow for a category
  const getWorkflow = useCallback(
    (categoryName) => {
      const category = getCategory(categoryName);
      return category?.statusWorkflow || [];
    },
    [getCategory],
  );

  // Helper: Validate if a status is valid for category workflow
  const isValidStatus = useCallback(
    (categoryName, status) => {
      const workflow = getWorkflow(categoryName);
      return workflow.some((step) => step.status === status);
    },
    [getWorkflow],
  );

  // Helper: Get next valid statuses in workflow
  const getNextStatuses = useCallback(
    (categoryName, currentStatus) => {
      const workflow = getWorkflow(categoryName);
      const statusInWorkflow = workflow.some(
        (step) => step.status === currentStatus,
      );
      const effectiveStatus =
        currentStatus === "assigned" && !statusInWorkflow
          ? "pending"
          : currentStatus;
      const currentIndex = workflow.findIndex(
        (step) => step.status === effectiveStatus,
      );
      if (currentIndex === -1 || currentIndex === workflow.length - 1) {
        return [];
      }
      // Return next status in workflow (can be extended for multiple paths)
      return [workflow[currentIndex + 1]];
    },
    [getWorkflow],
  );

  // Computed: Only active categories
  const activeCategories = useMemo(() => {
    return categories.filter((cat) => cat.isActive);
  }, [categories]);

  // Computed: Only active options within active categories
  const activeCategoriesWithOptions = useMemo(() => {
    return activeCategories.map((cat) => ({
      ...cat,
      childOptions: cat.childOptions.filter((opt) => opt.isActive),
    }));
  }, [activeCategories]);

  return {
    categories,
    activeCategories,
    activeCategoriesWithOptions,
    loading,
    error,
    refetch: fetchCategories,
    getCategory,
    getOptions,
    getOption,
    getWorkflow,
    isValidStatus,
    getNextStatuses,
  };
}
