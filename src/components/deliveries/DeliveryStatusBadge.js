export default function DeliveryStatusBadge({ status, size = "sm" }) {
  const getStatusColor = (status) => {
    const colors = {
      // Legacy statuses
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      assigned: "bg-blue-100 text-blue-800 border-blue-300",
      in_transit: "bg-cyan-100 text-cyan-800 border-cyan-300",
      delivered: "bg-green-100 text-green-800 border-green-300",
      cancelled: "bg-red-100 text-red-800 border-red-300",
      failed: "bg-orange-100 text-orange-800 border-orange-300",
      
      // Category-specific statuses
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

  const sizeClasses = {
    xs: "px-2 py-0.5 text-xs",
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-base",
  };

  const formattedStatus = (status || "").replace(/_/g, " ");

  return (
    <span
      className={`inline-block rounded-full border font-medium ${getStatusColor(status)} ${sizeClasses[size]}`}
    >
      {formattedStatus}
    </span>
  );
}
