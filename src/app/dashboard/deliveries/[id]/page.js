"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useDrivers } from "@/hooks/useDrivers";
import { PERMISSIONS } from "@/lib/permissions";
import { useSessionStore } from "@/store/session";
import { printReceiptInBrowser } from "@/lib/receipt/browserPrint";
import { mapDeliveryToReceipt } from "@/lib/receipt/receiptMappers";

export default function DeliveryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { permissions, locationsMeta, activeOrganization } = useSessionStore();
  const { drivers, loading: driversLoading } = useDrivers({ autoFetch: true });
  const [delivery, setDelivery] = useState(null);
  const [categoryWorkflow, setCategoryWorkflow] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState("");
  const [newStatus, setNewStatus] = useState("");
  const [receivable, setReceivable] = useState(null);

  const canRead = permissions?.includes(PERMISSIONS.DELIVERY_FEES_READ);
  const canUpdate = permissions?.includes(PERMISSIONS.DELIVERY_FEES_UPDATE);
  const canAssignDriver = permissions?.includes(PERMISSIONS.DELIVERY_FEES_ASSIGN_DRIVER);
  const canUpdateStatus = permissions?.includes(PERMISSIONS.DELIVERY_FEES_UPDATE_STATUS);

  useEffect(() => {
    if (!canRead) {
      setLoading(false);
      return;
    }

    const fetchDelivery = async () => {
      try {
        setLoading(true);
        const response = await apiFetch(`/delivery-fees/${params.id}`);
        const deliveryData = response?.data || response;
        if (deliveryData) {
          setDelivery(deliveryData);
          setNewStatus(deliveryData.categoryStatus || "unknown");
          
          // If category-based delivery, fetch workflow
          if (deliveryData.deliveryCategory && deliveryData.locationId) {
            try {
              const locationResponse = await apiFetch(`/locations/${deliveryData.locationId}`);
              const location = locationResponse?.data || locationResponse;
              const category = location.deliveryCategories?.find(
                (cat) => cat.categoryName === deliveryData.deliveryCategory
              );
              if (category?.statusWorkflow) {
                setCategoryWorkflow(category.statusWorkflow);
              }
            } catch (err) {
              console.error("Failed to fetch category workflow:", err);
            }
          }
        } else {
          setError("Failed to load delivery details");
        }
      } catch (err) {
        console.error("Failed to fetch delivery:", err);
        setError("Failed to load delivery details");
      } finally {
        setLoading(false);
      }
    };

    fetchDelivery();
  }, [params.id, canRead]);

  useEffect(() => {
    // Fetch drivers for assignment
    // Using useDrivers hook which fetches from /drivers endpoint
    if (!canAssignDriver) {
      // Drivers already fetched by useDrivers hook
    }
  }, [canAssignDriver]);

  useEffect(() => {
    const linkedSaleId =
      delivery?.saleId && typeof delivery.saleId === "object"
        ? delivery.saleId._id || delivery.saleId.id
        : null;

    if (!linkedSaleId) {
      setReceivable(null);
      return;
    }

    const fetchReceivable = async () => {
      try {
        const response = await apiFetch(`/sales/${linkedSaleId}/receivable`);
        const receivableData = response?.data || response;
        setReceivable(receivableData || null);
      } catch (err) {
        console.error("Failed to fetch linked sale receivable:", err);
        setReceivable(null);
      }
    };

    fetchReceivable();
  }, [delivery?.saleId]);

  const handleAssignDriver = async () => {
    if (!selectedDriver) {
      alert("Please select a driver");
      return;
    }

    try {
      setUpdating(true);
      const response = await apiFetch(`/delivery-fees/${delivery._id}/assign`, {
        method: "PATCH",
        body: { driverId: selectedDriver },
      });

      const updatedData = response?.data || response;
      setDelivery(updatedData);
      setShowAssignModal(false);
      setSelectedDriver("");
    } catch (err) {
      alert(`Failed to assign driver: ${err.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusUpdate = async () => {
    const currentStatus = delivery.categoryStatus || "unknown";
    if (newStatus === currentStatus) {
      alert("No status change");
      return;
    }

    try {
      setUpdating(true);
      const body = { categoryStatus: newStatus };
      
      const response = await apiFetch(`/delivery-fees/${delivery._id}/status`, {
        method: "PATCH",
        body,
      });

      const updatedData = response?.data || response;
      setDelivery(updatedData);
      setNewStatus(updatedData.categoryStatus || "unknown");
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
      setNewStatus(delivery.categoryStatus || "unknown");
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value || 0);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getLocationName = (locationId) => {
    if (!locationsMeta || !locationId) return "Unknown Location";
    const location = locationsMeta.find((loc) => loc._id === locationId);
    return location?.name || "Unknown Location";
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      assigned: "bg-blue-100 text-blue-800 border-blue-300",
      in_transit: "bg-cyan-100 text-cyan-800 border-cyan-300",
      delivered: "bg-green-100 text-green-800 border-green-300",
      cancelled: "bg-red-100 text-red-800 border-red-300",
      failed: "bg-orange-100 text-orange-800 border-orange-300",
      ready_for_pickup: "bg-indigo-100 text-indigo-800 border-indigo-300",
      picked_up: "bg-green-100 text-green-800 border-green-300",
      out_for_delivery: "bg-cyan-100 text-cyan-800 border-cyan-300",
      completed: "bg-green-100 text-green-800 border-green-300",
      ready_for_collection: "bg-purple-100 text-purple-800 border-purple-300",
      collected: "bg-green-100 text-green-800 border-green-300",
      preparing: "bg-amber-100 text-amber-800 border-amber-300",
    };
    return colors[status] || "bg-gray-100 text-gray-800 border-gray-300";
  };

  const handlePrintOrder = () => {
    const receipt = mapDeliveryToReceipt({ delivery, receivable });
    if (!receipt) {
      alert("Linked sale receipt is not available for this delivery");
      return;
    }

    const saleLocationId =
      delivery?.saleId && typeof delivery.saleId === "object"
        ? delivery.saleId.locationId
        : null;

    printReceiptInBrowser({
      receipt,
      organizationName: activeOrganization?.name,
      locationLabel: getLocationName(saleLocationId || delivery?.locationId),
    });
  };

  if (!canRead) {
    return (
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-zinc-900">Delivery Details</h1>
        <p className="text-sm text-zinc-600">You don't have permission to view delivery details.</p>
        <button
          onClick={() => router.back()}
          className="mt-4 rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Go Back
        </button>
        <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm text-zinc-600">Loading delivery details...</p>
        </div>
      </div>
    );
  }

  if (error || !delivery) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => router.back()}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Go Back
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-sm text-red-700">{error || "Delivery not found"}</p>
        </div>
      </div>
    );
  }

  const currentStatus = delivery.categoryStatus || "unknown";
  const isAssigned = Boolean(delivery.driverId || delivery.assignedAt);
  let availableStatuses = [];
  const statusInWorkflow = categoryWorkflow.some((wf) => wf.status === currentStatus);
  const workflowCurrentStatus =
    currentStatus === "assigned" && !statusInWorkflow
      ? "pending"
      : currentStatus;
  
  // Check if delivery can be edited (not in terminal status)
  const terminalStatuses = ["delivered", "completed", "cancelled", "failed", "picked_up", "collected"];
  const canEdit = canUpdate && !terminalStatuses.includes(currentStatus);
  
  if (categoryWorkflow.length > 0) {
    // For category-based deliveries, get next statuses from workflow
    const currentIndex = categoryWorkflow.findIndex((wf) => wf.status === workflowCurrentStatus);
    if (currentIndex !== -1 && currentIndex < categoryWorkflow.length - 1) {
      // Next status in workflow
      availableStatuses = [categoryWorkflow[currentIndex + 1].status];
      // Also allow cancellation if not completed
      const completedStatuses = ['completed', 'delivered', 'picked_up', 'collected'];
      if (!completedStatuses.includes(workflowCurrentStatus) && 
          categoryWorkflow.some(wf => wf.status === 'cancelled')) {
        availableStatuses.push('cancelled');
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="rounded bg-zinc-600 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          ← Go Back
        </button>
        <div><h1 className="text-3xl font-bold text-zinc-900">Delivery #{delivery.trackingNumber}</h1></div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintOrder}
            disabled={!(delivery?.saleId && typeof delivery.saleId === "object")}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🖨️ Print
          </button>
          {canEdit && (
            <button
              onClick={() => router.push(`/dashboard/deliveries/${delivery._id}/edit`)}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Edit Delivery
            </button>
          )}
        </div>
      </div>

      {/* Status Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-600">Current Status</p>
            <span className={`mt-2 inline-block rounded-full border px-4 py-2 text-sm font-medium ${getStatusColor(currentStatus)}`}>
              {currentStatus === "unknown" ? "UNKNOWN" : currentStatus.replace(/_/g, " ").toUpperCase()}
            </span>
            <div className="mt-2">
              <p className="text-xs font-medium text-zinc-600">Assignment</p>
              <span
                className={`mt-1 inline-block rounded-full border px-3 py-1 text-xs font-medium ${
                  isAssigned
                    ? "bg-blue-100 text-blue-800 border-blue-300"
                    : "bg-zinc-100 text-zinc-700 border-zinc-300"
                }`}
              >
                {isAssigned ? "Assigned" : "Unassigned"}
              </span>
            </div>
            {delivery.deliveryCategory && categoryWorkflow.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-zinc-600 mb-2">Workflow Progress</p>
                <div className="flex flex-wrap gap-2">
                  {categoryWorkflow.map((wf, index) => {
                    const progressIndex = categoryWorkflow.findIndex((w) => w.status === workflowCurrentStatus);
                    const isComplete = progressIndex > index;
                    const isCurrent = wf.status === workflowCurrentStatus;
                    return (
                      <div
                        key={wf.status}
                        className={`flex items-center gap-1 rounded border px-2 py-1 text-xs ${
                          isCurrent
                            ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium'
                            : isComplete
                            ? 'bg-green-50 border-green-200 text-green-700'
                            : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                        }`}
                      >
                        {isComplete && '✓ '}
                        {wf.displayName || wf.status}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          {canUpdateStatus && availableStatuses.length > 0 && (
            <div className="flex items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-zinc-700">Update Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="mt-1 rounded border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value={currentStatus}>Keep Current</option>
                  {availableStatuses.map((status) => {
                    const workflowItem = categoryWorkflow.find(wf => wf.status === status);
                    const label = workflowItem?.displayName || status.replace(/_/g, " ");
                    return (
                      <option key={status} value={status}>
                        {label.substring(0, 1).toUpperCase() + label.substring(1)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button
                onClick={handleStatusUpdate}
                disabled={updating || newStatus === currentStatus}
                className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updating ? "Updating..." : "Update"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Info */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Delivery Details */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Delivery Details</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-600">Tracking Number</p>
              <p className="mt-1 text-sm text-zinc-900">{delivery.trackingNumber}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600">Delivery Method</p>
              <p className="mt-1 text-sm font-medium text-zinc-900">
                {delivery.deliveryCategory || "Delivery"}
              </p>
              {delivery.deliveryOption && (
                <p className="text-xs text-zinc-500">{delivery.deliveryOption}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600">Fee Amount</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">{formatCurrency(delivery.amount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600">Tax Amount</p>
              <p className="mt-1 text-sm text-zinc-900">{formatCurrency(delivery.taxAmount || 0)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600">Total Amount</p>
              <p className="mt-1 text-lg font-semibold text-blue-600">{formatCurrency(delivery.totalAmount)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600">Created</p>
              <p className="mt-1 text-sm text-zinc-600">{formatDate(delivery.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* Recipient Info */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900">Recipient Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-zinc-600">Name</p>
              <p className="mt-1 text-sm text-zinc-900">{delivery.recipientName || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600">Phone</p>
              <p className="mt-1 text-sm text-zinc-900">{delivery.recipientPhone || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600">Email</p>
              <p className="mt-1 text-sm text-zinc-900">{delivery.recipientEmail || "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-600">Delivery Address</p>
              <p className="mt-1 text-sm text-zinc-600">
                {delivery.deliveryAddress?.street && `${delivery.deliveryAddress.street}, `}
                {delivery.deliveryAddress?.city && `${delivery.deliveryAddress.city}, `}
                {delivery.deliveryAddress?.state && `${delivery.deliveryAddress.state} `}
                {delivery.deliveryAddress?.postalCode && delivery.deliveryAddress.postalCode}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Driver Assignment */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900">Driver Assignment</h2>
          {canAssignDriver && (
            <button
              onClick={() => setShowAssignModal(true)}
              className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Assign Driver
            </button>
          )}
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-zinc-600">Assigned Driver</p>
            <p className="mt-1 text-sm text-zinc-900">
              {delivery.driverId
                ? `${delivery.driverId.name || "Assigned"}${
                    delivery.driverId.phone ? ` (${delivery.driverId.phone})` : ""
                  }`
                : "Not assigned"}
            </p>
          </div>
          {delivery.assignedAt && (
            <div>
              <p className="text-xs font-medium text-zinc-600">Assigned At</p>
              <p className="mt-1 text-sm text-zinc-600">{formatDate(delivery.assignedAt)}</p>
            </div>
          )}
          {delivery.pickedUpAt && (
            <div>
              <p className="text-xs font-medium text-zinc-600">Picked Up At</p>
              <p className="mt-1 text-sm text-zinc-600">{formatDate(delivery.pickedUpAt)}</p>
            </div>
          )}
          {delivery.deliveredAt && (
            <div>
              <p className="text-xs font-medium text-zinc-600">Delivered At</p>
              <p className="mt-1 text-sm text-zinc-600">{formatDate(delivery.deliveredAt)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Assign Driver Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900">Assign Driver</h2>
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
                onClick={() => setShowAssignModal(false)}
                className="flex-1 rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAssignDriver}
                disabled={updating}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {updating ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
