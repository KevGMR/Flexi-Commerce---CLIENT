"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useDrivers } from "@/hooks/useDrivers";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";

export default function DriverManagementPage() {
  const router = useRouter();
  const { permissions } = useSessionStore();
  const { drivers, loading: driversLoading, error: driversError, refetch: refetchDrivers, createDriver } = useDrivers({ autoFetch: true });
  const [driverStats, setDriverStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unassignedDeliveries, setUnassignedDeliveries] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingDriver, setCreatingDriver] = useState(false);
  const [createError, setCreateError] = useState("");
  const [formData, setFormData] = useState({ name: "", phone: "" });
  const [selectedDeliveries, setSelectedDeliveries] = useState(new Set());
  const [assigningDelivery, setAssigningDelivery] = useState(null);

  const canAssignDriver = permissions?.includes(PERMISSIONS.DELIVERY_FEES_ASSIGN_DRIVER);

  useEffect(() => {
    if (!canAssignDriver) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch unassigned deliveries
        const deliveriesResponse = await apiFetch("/delivery-fees?categoryStatus=pending&limit=100");
        let deliveriesData = [];
        if (deliveriesResponse?.data?.deliveries && Array.isArray(deliveriesResponse.data.deliveries)) {
          deliveriesData = deliveriesResponse.data.deliveries;
        } else if (deliveriesResponse?.data && Array.isArray(deliveriesResponse.data)) {
          deliveriesData = deliveriesResponse.data;
        } else if (Array.isArray(deliveriesResponse)) {
          deliveriesData = deliveriesResponse;
        }
        setUnassignedDeliveries(deliveriesData);

        // Fetch driver stats
        const statsResponse = await apiFetch("/delivery-fees/stats");
        setDriverStats(statsResponse?.data || statsResponse || {});

        setError("");
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Failed to load driver data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [canAssignDriver])

  // Update loading state when drivers are loading
  useEffect(() => {
    if (driversError) {
      setError("Failed to load drivers");
    }
  }, [driversError]);

  const handleAssignDeliveries = async () => {
    if (!selectedDriver) {
      alert("Please select a driver");
      return;
    }

    const deliveriesToAssign = Array.from(selectedDeliveries);
    if (deliveriesToAssign.length === 0) {
      alert("No deliveries selected");
      return;
    }

    try {
      for (const deliveryId of deliveriesToAssign) {
        await apiFetch(`/delivery-fees/${deliveryId}/assign`, {
          method: "PATCH",
          body: { driverId: selectedDriver },
        });
      }

      // Refresh data
      refetchDrivers();
      const deliveriesResponse = await apiFetch("/delivery-fees?categoryStatus=pending&limit=100");
      let deliveriesData = [];
      if (deliveriesResponse?.data?.deliveries) {
        deliveriesData = deliveriesResponse.data.deliveries;
      } else if (Array.isArray(deliveriesResponse?.data)) {
        deliveriesData = deliveriesResponse.data;
      } else if (Array.isArray(deliveriesResponse)) {
        deliveriesData = deliveriesResponse;
      }
      setUnassignedDeliveries(deliveriesData);
      setShowAssignModal(false);
      setSelectedDriver("");
      setSelectedDeliveries(new Set());
    } catch (err) {
      alert(`Failed to assign deliveries: ${err.message}`);
    }
  };

  const handleIndividualAssign = async (deliveryId, driverId) => {
    if (!driverId) return;

    try {
      setAssigningDelivery(deliveryId);
      await apiFetch(`/delivery-fees/${deliveryId}/assign`, {
        method: "PATCH",
        body: { driverId },
      });

      // Refresh data
      refetchDrivers();
      const deliveriesResponse = await apiFetch("/delivery-fees?categoryStatus=pending&limit=100");
      let deliveriesData = [];
      if (deliveriesResponse?.data?.deliveries) {
        deliveriesData = deliveriesResponse.data.deliveries;
      } else if (Array.isArray(deliveriesResponse?.data)) {
        deliveriesData = deliveriesResponse.data;
      } else if (Array.isArray(deliveriesResponse)) {
        deliveriesData = deliveriesResponse;
      }
      setUnassignedDeliveries(deliveriesData);
      
      // Remove from selection if it was selected
      setSelectedDeliveries(prev => {
        const newSet = new Set(prev);
        newSet.delete(deliveryId);
        return newSet;
      });
    } catch (err) {
      alert(`Failed to assign delivery: ${err.message}`);
    } finally {
      setAssigningDelivery(null);
    }
  };

  const toggleDeliverySelection = (deliveryId) => {
    setSelectedDeliveries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deliveryId)) {
        newSet.delete(deliveryId);
      } else {
        newSet.add(deliveryId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedDeliveries.size === unassignedDeliveries.length) {
      setSelectedDeliveries(new Set());
    } else {
      setSelectedDeliveries(new Set(unassignedDeliveries.map(d => d._id)));
    }
  };

  const handleCreateDriver = async () => {
    if (!formData.name.trim()) {
      setCreateError("Driver name is required");
      return;
    }
    if (!formData.phone.trim()) {
      setCreateError("Phone number is required");
      return;
    }

    try {
      setCreatingDriver(true);
      setCreateError("");
      await createDriver({ name: formData.name, phone: formData.phone });
      setFormData({ name: "", phone: "" });
      setShowCreateModal(false);
      refetchDrivers();
    } catch (err) {
      setCreateError(err.message || "Failed to create driver");
    } finally {
      setCreatingDriver(false);
    }
  };

  if (!canAssignDriver) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Driver Management</h1>
        <p className="text-sm text-zinc-600">You don't have permission to assign drivers.</p>
      </div>
    );
  }

  if (loading || driversLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-zinc-600">Loading driver data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900">Driver Management</h1>
          <p className="mt-1 text-sm text-zinc-600">Manage drivers and assign deliveries</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Create Driver
        </button>
      </div>

      {/* Pending Deliveries Alert */}
      {unassignedDeliveries.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm text-yellow-700">
            <strong>{unassignedDeliveries.length} pending deliveries</strong> waiting to be assigned
          </p>
        </div>
      )}

      {/* Selected Deliveries Alert */}
      {selectedDeliveries.size > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-700">
            <strong>{selectedDeliveries.size} deliveries selected</strong>
          </p>
          <button
            onClick={() => setShowAssignModal(true)}
            className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Assign Selected to Driver
          </button>
        </div>
      )}

      {/* Drivers Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {drivers.length === 0 ? (
          <div className="col-span-full rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-zinc-600">No drivers found</p>
          </div>
        ) : (
          drivers.map((driver) => (
            <div key={driver._id} className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-900">{driver.name}</h3>
                  {driver.phone && <p className="text-xs text-zinc-600">{driver.phone}</p>}
                </div>
                <span className={`rounded-full border px-2 py-1 text-xs font-medium ${
                  driver.status === "active"
                    ? "bg-green-100 text-green-800 border-green-300"
                    : "bg-gray-100 text-gray-800 border-gray-300"
                }`}>
                  {driver.status}
                </span>
              </div>

              {/* Driver Stats */}
              <div className="mt-4 space-y-2 border-t border-zinc-200 pt-3">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Assigned:</span>
                  <span className="font-medium text-zinc-900">
                    {driverStats[driver._id]?.assigned || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">In Transit:</span>
                  <span className="font-medium text-zinc-900">
                    {driverStats[driver._id]?.in_transit || 0}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-600">Delivered:</span>
                  <span className="font-medium text-blue-600">
                    {driverStats[driver._id]?.delivered || 0}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedDriver(driver._id);
                  setShowAssignModal(true);
                }}
                className="mt-4 w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                View Deliveries
              </button>
            </div>
          ))
        )}
      </div>

      {/* Unassigned Deliveries Table */}
      {unassignedDeliveries.length > 0 && (
        <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-6 py-4">
            <h2 className="font-semibold text-zinc-900">Pending Deliveries ({unassignedDeliveries.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-zinc-200 bg-zinc-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedDeliveries.size === unassignedDeliveries.length && unassignedDeliveries.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-zinc-300"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Tracking #</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Recipient</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-zinc-900">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Delivery Address</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-900">Assign Driver</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {unassignedDeliveries.map((delivery) => (
                  <tr key={delivery._id} className={`hover:bg-zinc-50 ${selectedDeliveries.has(delivery._id) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedDeliveries.has(delivery._id)}
                        onChange={() => toggleDeliverySelection(delivery._id)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                    <td
                      onClick={() => router.push(`/dashboard/deliveries/${delivery._id}`)}
                      className="cursor-pointer px-6 py-4 text-sm font-medium text-blue-600 hover:underline"
                    >
                      {delivery.trackingNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">{delivery.recipientName}</td>
                    <td className="px-6 py-4 text-sm text-zinc-600 capitalize">{delivery.feeType}</td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-zinc-900">
                      ${delivery.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-600">
                      {delivery.deliveryAddress?.city}, {delivery.deliveryAddress?.state}
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value=""
                        onChange={(e) => handleIndividualAssign(delivery._id, e.target.value)}
                        disabled={assigningDelivery === delivery._id}
                        className="w-full rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50"
                      >
                        <option value="">Select driver...</option>
                        {drivers.map((driver) => (
                          <option key={driver._id} value={driver._id}>
                            {driver.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">
              Assign {selectedDeliveries.size} Selected {selectedDeliveries.size === 1 ? 'Delivery' : 'Deliveries'}
            </h2>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">Select a driver</option>
              {drivers.map((driver) => (
                <option key={driver._id} value={driver._id}>
                  {driver.name} - {driver.phone}
                </option>
              ))}
            </select>
            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedDriver("");
                }}
                className="flex-1 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignDeliveries}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Driver Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Create New Driver</h2>
            
            {createError && (
              <div className="mb-4 rounded border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-700">{createError}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Driver Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter driver name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="e.g., +254712345678"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({ name: "", phone: "" });
                  setCreateError("");
                }}
                disabled={creatingDriver}
                className="flex-1 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDriver}
                disabled={creatingDriver}
                className="flex-1 rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {creatingDriver ? "Creating..." : "Create Driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
