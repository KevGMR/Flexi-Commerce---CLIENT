import Link from "next/link";
import DeliveryStatusBadge from "./DeliveryStatusBadge";

/**
 * DeliveryCard - A card component displaying delivery summary
 * Used in lists and grids to show delivery information at a glance
 */
export default function DeliveryCard({ delivery, showActions = true }) {
  const statusToDisplay = delivery.categoryStatus;
  const isAssigned = Boolean(delivery.driverId || delivery.assignedAt);
  const deliveryType =
    delivery.deliveryCategory ||
    delivery.deliveryOption ||
    "delivery";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <Link
            href={`/dashboard/deliveries/${delivery._id}`}
            className="text-lg font-semibold text-gray-900 hover:text-blue-600"
          >
            {delivery.trackingNumber || delivery._id?.slice(-8)}
          </Link>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(delivery.createdAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <DeliveryStatusBadge status={statusToDisplay} size="sm" />
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              isAssigned
                ? "bg-blue-100 text-blue-800 border-blue-300"
                : "bg-gray-100 text-gray-700 border-gray-300"
            }`}
          >
            {isAssigned ? "Assigned" : "Unassigned"}
          </span>
        </div>
      </div>

      {/* Recipient Info */}
      <div className="mb-3">
        <p className="text-sm font-medium text-gray-900">
          {delivery.recipientName}
        </p>
        <p className="text-sm text-gray-600">{delivery.recipientPhone}</p>
        {delivery.recipientEmail && (
          <p className="text-xs text-gray-500">{delivery.recipientEmail}</p>
        )}
      </div>

      {/* Address */}
      {delivery.deliveryAddress && (
        <div className="mb-3 text-sm text-gray-600">
          <p>
            {delivery.deliveryAddress.street}, {delivery.deliveryAddress.city}
          </p>
          {delivery.deliveryAddress.landmark && (
            <p className="text-xs text-gray-500">
              Near: {delivery.deliveryAddress.landmark}
            </p>
          )}
        </div>
      )}

      {/* Delivery Type & Price */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="text-sm">
          <span className="text-gray-500">Type:</span>{" "}
          <span className="font-medium text-gray-900 capitalize">
            {deliveryType.replace(/_/g, " ")}
          </span>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">
            KES {(delivery.totalAmount || delivery.amount || 0).toFixed(2)}
          </p>
          {delivery.taxAmount > 0 && (
            <p className="text-xs text-gray-500">
              (incl. tax KES {delivery.taxAmount.toFixed(2)})
            </p>
          )}
        </div>
      </div>

      {/* Driver Info */}
      {delivery.driverId && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Driver: <span className="font-medium text-gray-700">
              {typeof delivery.driverId === 'object' 
                ? `${delivery.driverId.name || 'Assigned'} ${delivery.driverId.phone ? `(${delivery.driverId.phone})` : ''}`
                : 'Assigned'}
            </span>
          </p>
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <div className="mt-4 flex gap-2">
          <Link
            href={`/dashboard/deliveries/${delivery._id}`}
            className="flex-1 text-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
          >
            View Details
          </Link>
          {statusToDisplay !== "delivered" &&
            statusToDisplay !== "cancelled" &&
            statusToDisplay !== "picked_up" &&
            statusToDisplay !== "collected" && (
              <Link
                href={`/dashboard/deliveries/${delivery._id}/edit`}
                className="flex-1 text-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
              >
                Edit
              </Link>
            )}
        </div>
      )}
    </div>
  );
}
