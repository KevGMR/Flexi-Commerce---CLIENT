"use client";

/**
 * One row for a bundle child (sub-service) inside an expanded bundle.
 * Used by CartLine when rendering the children of a bundle parent.
 *
 * Kept dumb on purpose — all assignment logic lives in the parent so both
 * the inline row and the BundleManageModal hit the same handler.
 */
export default function BundleSubServiceRow({
  child,
  index,
  users,
  onAssignUser,
  onLaborCostChange,
}) {
  const laborCost = Number(child.laborCost || 0);
  const price = Number(child.price || 0);

  return (
    <div className="ml-6 rounded-lg border-l-2 border-blue-300 bg-gray-50 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-gray-900 text-sm truncate">
              {child.name}
            </h4>
            <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded whitespace-nowrap">
              Bundle item
            </span>
            {child.isAggregator && (
              <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                Aggregator
              </span>
            )}
          </div>

          {/* Labor cost input */}
          <div className="mt-1 flex items-center gap-1">
            <label className="text-[10px] text-gray-500">Labor:</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={laborCost}
              onChange={(e) =>
                onLaborCostChange(index, "laborCost", e.target.value)
              }
              className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
            />
            <span className="text-[10px] text-gray-500">
              = ${price.toFixed(2)}
            </span>
          </div>

          {child.commissionDeductionTiming && (
            <div className="text-[10px] text-gray-400 mt-0.5">
              Timing:{" "}
              {child.commissionDeductionTiming === "before_commission"
                ? "Before Commission"
                : "After Deductions"}
            </div>
          )}

          {/* Assigned user dropdown */}
          <div className="mt-1">
            <select
              value={child.assignedUser || ""}
              onChange={(e) => onAssignUser(index, e.target.value || null)}
              className="text-xs border border-gray-300 rounded px-1 py-0.5 w-full max-w-[120px]"
            >
              <option value="">Assign user</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.fullname || user.email}
                </option>
              ))}
            </select>
          </div>

          {/* Commission display */}
          {child.commissionType && (
            <div className="text-xs mt-1 flex items-center gap-2">
              <span className="text-gray-500">
                Commission:{" "}
                <span className="font-medium text-gray-700">
                  {child.commissionType === "percentage"
                    ? `${child.commissionValue}% ($${
                        child.commissionAmount?.toFixed(2) || "0.00"
                      })`
                    : `$${Number(child.commissionValue || 0).toFixed(2)}`}
                </span>
              </span>
              {child.commissionIsOverride ? (
                <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                  Override
                </span>
              ) : (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                  Default
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quantity is read-only on children (driven by parent) */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="text-xs text-gray-500">×{child.quantity}</span>
        </div>
      </div>
    </div>
  );
}