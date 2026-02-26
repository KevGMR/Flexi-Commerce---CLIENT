"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";
import { useDeliveries } from "@/hooks/useDeliveries";
import { useDeliveryCategories } from "@/hooks/useDeliveryCategories";
import DeliveryStatusBadge from "@/components/deliveries/DeliveryStatusBadge";
import DeliveryFilters from "@/components/deliveries/DeliveryFilters";

// Helper functions for formatting
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 2,
  }).format(amount || 0);
};

export default function DeliveriesPage() {
  const router = useRouter();
  const { permissions } = useSessionStore();
  const [activeFilters, setActiveFilters] = useState({
    status: "",
    category: "",
    startDate: "",
    endDate: "",
    searchTerm: "",
  });
  const [page, setPage] = useState(1);

  const canRead = permissions?.includes(PERMISSIONS.DELIVERY_FEES_READ);
  const canCreate = permissions?.includes(PERMISSIONS.DELIVERY_FEES_CREATE);

  // Fetch deliveries with filters
  const {
    deliveries,
    pagination,
    loading,
    error,
    refetch,
    cancelDelivery,
  } = useDeliveries({
    categoryStatus: activeFilters.status || null,
    deliveryCategory: activeFilters.category || null,
    searchTerm: activeFilters.searchTerm || null,
    startDate: activeFilters.startDate || null,
    endDate: activeFilters.endDate || null,
    page,
    limit: 50,
    autoFetch: canRead,
  });

  // Fetch categories for filtering
  const { activeCategories } = useDeliveryCategories();

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setActiveFilters(newFilters);
    setPage(1); // Reset to first page on filter change
  };

  // Handle row click
  const handleRowClick = (deliveryId) => {
    router.push(`/dashboard/deliveries/${deliveryId}`);
  };

  // Handle delete/cancel
  const handleDelete = async (deliveryId) => {
    if (!window.confirm("Are you sure you want to cancel this delivery?")) return;

    try {
      await cancelDelivery(deliveryId, "Cancelled by user");
      refetch();
    } catch (err) {
      alert(`Failed to cancel delivery: ${err.message}`);
    }
  };

  if (!canRead) {
    return (
      <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Deliveries</h1>
        <p className="text-sm text-gray-600">
          You don't have permission to view deliveries.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Deliveries</h1>
          <p className="mt-1 text-sm text-gray-600">
            Track and manage all deliveries
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => router.push("/dashboard/deliveries/create")}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + Create Delivery
          </button>
        )}
      </div>

      {/* Filters */}
      <DeliveryFilters
        categories={activeCategories}
        onFilterChange={handleFilterChange}
        initialFilters={activeFilters}
      />

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-300 border-t-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">Loading deliveries...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && deliveries.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">
            No deliveries found
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {activeFilters.status || activeFilters.category || activeFilters.startDate
              ? "Try adjusting your filters"
              : "Get started by creating a new delivery"}
          </p>
          {canCreate && (
            <button
              onClick={() => router.push("/dashboard/deliveries/create")}
              className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              + Create Delivery
            </button>
          )}
        </div>
      )}

      {/* Deliveries Table */}
      {!loading && deliveries.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
            <table className="min-w-full">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Tracking #
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Recipient
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Driver
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left text-[11px] font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {deliveries.map((delivery) => {
                  const currentStatus = delivery.categoryStatus || "unknown";
                  const isAssigned = Boolean(delivery.driverId || delivery.assignedAt);
                  const driverName = delivery.driverId
                    ? typeof delivery.driverId === "object"
                      ? delivery.driverId.name || "Assigned"
                      : "Assigned"
                    : "Unassigned";

                  return (
                    <tr
                      key={delivery._id}
                      onClick={() => handleRowClick(delivery._id)}
                      className="cursor-pointer hover:bg-zinc-50 transition-colors"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs font-medium text-blue-600">
                          {delivery.trackingNumber || delivery._id.slice(-8).toUpperCase()}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-xs font-medium text-gray-900">
                          {delivery.recipientName}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {delivery.recipientPhone}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-xs text-gray-900 max-w-[180px] truncate">
                          {delivery.deliveryAddress?.street}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {delivery.deliveryAddress?.city}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-900">
                          {delivery.deliveryCategory || "Standard"}
                        </div>
                        {delivery.deliveryOption && (
                          <div className="text-[10px] text-gray-500">
                            {delivery.deliveryOption}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-900">
                          {driverName}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="space-y-1">
                          <DeliveryStatusBadge status={currentStatus} size="xs" />
                          <span
                            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              isAssigned
                                ? "bg-blue-100 text-blue-800 border-blue-300"
                                : "bg-zinc-100 text-zinc-700 border-zinc-300"
                            }`}
                          >
                            {isAssigned ? "Assigned" : "Unassigned"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs font-medium text-gray-900">
                          {formatCurrency(delivery.totalAmount || delivery.amount)}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="text-xs text-gray-500">
                          {formatDate(delivery.createdAt)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between bg-white px-6 py-4 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)}{" "}
                of {pagination.total} deliveries
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page === 1}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="flex items-center px-4 text-sm text-gray-600">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  disabled={pagination.page === pagination.pages}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
