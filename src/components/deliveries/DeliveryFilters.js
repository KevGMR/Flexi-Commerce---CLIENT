import { useState } from "react";

/**
 * DeliveryFilters - Filter component for delivery list
 * Provides status, date range, and category filtering
 */
export default function DeliveryFilters({
  categories = [],
  onFilterChange,
  initialFilters = {},
}) {
  const [filters, setFilters] = useState({
    status: initialFilters.status || "",
    category: initialFilters.category || "",
    startDate: initialFilters.startDate || "",
    endDate: initialFilters.endDate || "",
    searchTerm: initialFilters.searchTerm || "",
  });

  const handleFilterChange = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    if (onFilterChange) {
      onFilterChange(newFilters);
    }
  };

  const handleReset = () => {
    const resetFilters = {
      status: "",
      category: "",
      startDate: "",
      endDate: "",
      searchTerm: "",
    };
    setFilters(resetFilters);
    if (onFilterChange) {
      onFilterChange(resetFilters);
    }
  };

  const allStatuses = [
    { value: "pending", label: "Pending" },
    { value: "assigned", label: "Assigned" },
    { value: "in_transit", label: "In Transit" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
    { value: "failed", label: "Failed" },
    // Category-specific
    { value: "ready_for_pickup", label: "Ready for Pickup" },
    { value: "picked_up", label: "Picked Up" },
    { value: "out_for_delivery", label: "Out for Delivery" },
    { value: "completed", label: "Completed" },
    { value: "ready_for_collection", label: "Ready for Collection" },
    { value: "collected", label: "Collected" },
    { value: "preparing", label: "Preparing" },
  ];

  const hasActiveFilters =
    filters.status ||
    filters.category ||
    filters.startDate ||
    filters.endDate ||
    filters.searchTerm;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Reset Filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Search
          </label>
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => handleFilterChange("searchTerm", e.target.value)}
            placeholder="Tracking #, name, phone..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Statuses</option>
            {allStatuses.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Category
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange("category", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.categoryName} value={cat.categoryName}>
                {cat.categoryName}
              </option>
            ))}
          </select>
        </div>

        {/* Date Range - Start */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Date Range - End */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm text-gray-600">Active filters:</span>
          {filters.status && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Status: {allStatuses.find((s) => s.value === filters.status)?.label}
              <button
                onClick={() => handleFilterChange("status", "")}
                className="ml-1 hover:text-blue-900"
              >
                ×
              </button>
            </span>
          )}
          {filters.category && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              Category: {filters.category}
              <button
                onClick={() => handleFilterChange("category", "")}
                className="ml-1 hover:text-purple-900"
              >
                ×
              </button>
            </span>
          )}
          {filters.startDate && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              From: {filters.startDate}
              <button
                onClick={() => handleFilterChange("startDate", "")}
                className="ml-1 hover:text-green-900"
              >
                ×
              </button>
            </span>
          )}
          {filters.endDate && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              To: {filters.endDate}
              <button
                onClick={() => handleFilterChange("endDate", "")}
                className="ml-1 hover:text-green-900"
              >
                ×
              </button>
            </span>
          )}
          {filters.searchTerm && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Search: {filters.searchTerm}
              <button
                onClick={() => handleFilterChange("searchTerm", "")}
                className="ml-1 hover:text-gray-900"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
