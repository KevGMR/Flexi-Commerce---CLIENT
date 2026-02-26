/**
 * RecipientInfoCard - Display recipient contact and address information
 * Reusable card for showing delivery recipient details
 */
export default function RecipientInfoCard({ delivery, editable = false, onEdit = null }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Recipient Information
        </h3>
        {editable && onEdit && (
          <button
            onClick={onEdit}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Edit
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
            Name
          </label>
          <p className="text-sm font-medium text-gray-900">
            {delivery.recipientName || "—"}
          </p>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
              Phone
            </label>
            <p className="text-sm text-gray-900">
              <a
                href={`tel:${delivery.recipientPhone}`}
                className="hover:text-blue-600"
              >
                {delivery.recipientPhone || "—"}
              </a>
            </p>
          </div>

          {delivery.recipientEmail && (
            <div>
              <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
                Email
              </label>
              <p className="text-sm text-gray-900">
                <a
                  href={`mailto:${delivery.recipientEmail}`}
                  className="hover:text-blue-600"
                >
                  {delivery.recipientEmail}
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Address */}
        {delivery.deliveryAddress && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
              Delivery Address
            </label>
            <div className="text-sm text-gray-900 space-y-1">
              <p>{delivery.deliveryAddress.street || "—"}</p>
              <p>
                {[
                  delivery.deliveryAddress.city,
                  delivery.deliveryAddress.state,
                  delivery.deliveryAddress.postalCode,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </p>
              <p className="font-medium">
                {delivery.deliveryAddress.country || "Kenya"}
              </p>
              {delivery.deliveryAddress.landmark && (
                <p className="text-xs text-gray-600 mt-2">
                  <span className="font-medium">Landmark:</span>{" "}
                  {delivery.deliveryAddress.landmark}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Delivery Instructions */}
        {delivery.deliveryInstructions && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
              Delivery Instructions
            </label>
            <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-md">
              {delivery.deliveryInstructions}
            </p>
          </div>
        )}

        {/* Notes */}
        {delivery.notes && (
          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase mb-1">
              Notes
            </label>
            <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-md">
              {delivery.notes}
            </p>
          </div>
        )}

        {/* Proof of Delivery */}
        {(delivery.receivedByName ||
          delivery.signatureUrl ||
          delivery.photoUrl) && (
          <div className="pt-4 border-t border-gray-200">
            <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
              Proof of Delivery
            </label>
            <div className="space-y-2">
              {delivery.receivedByName && (
                <p className="text-sm text-gray-900">
                  <span className="font-medium">Received by:</span>{" "}
                  {delivery.receivedByName}
                </p>
              )}
              {delivery.signatureUrl && (
                <div>
                  <a
                    href={delivery.signatureUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View Signature →
                  </a>
                </div>
              )}
              {delivery.photoUrl && (
                <div>
                  <a
                    href={delivery.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View Delivery Photo →
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Map Link */}
        {delivery.deliveryAddress?.street && delivery.deliveryAddress?.city && (
          <div className="pt-4 border-t border-gray-200">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${delivery.deliveryAddress.street}, ${delivery.deliveryAddress.city}, ${delivery.deliveryAddress.country || "Kenya"}`,
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              Open in Google Maps
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
