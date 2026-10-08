"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Modal that lists every sub-service of a bundle with its user-assign
 * dropdown. Supports bulk-assigning all children to one user, and
 * removing individual sub-services (which transfers price to the
 * aggregator, same as the old inline behavior).
 *
 * Props:
 *   parent         — the bundle parent cart item (has .name)
 *   children       — [{ item, index }] where index is the cart index of each child
 *   users          — array of user objects
 *   onAssign       — (childCartIndex, userId) => void
 *   onBulkAssign   — (userId) => void
 *   onRemoveChild  — (childCartIndex) => void
 *   onClose        — () => void
 */
export default function BundleManageModal({
  parent,
  children,
  users,
  onAssign,
  onBulkAssign,
  onRemoveChild,
  onClose,
}) {
  const [bulkUserId, setBulkUserId] = useState("");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const assignedCount = useMemo(
    () => children.filter(({ item }) => item.assignedUser).length,
    [children],
  );
  const allAssigned = assignedCount === children.length && children.length > 0;
  const noneAssigned = assignedCount === 0;
  const canRemove = children.length > 1;

  const handleBulkAssign = () => {
    if (!bulkUserId) return;
    onBulkAssign(bulkUserId);
    setBulkUserId("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-lg bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 truncate">
              {parent.name}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {children.length} sub-service
              {children.length === 1 ? "" : "s"}
              {" · "}
              <span className={allAssigned ? "text-green-600" : "text-amber-600"}>
                {assignedCount} of {children.length} assigned
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0 ml-3"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Bulk-assign bar */}
        {children.length > 1 && (
          <div className="border-b bg-blue-50 px-6 py-3 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-blue-900">
              Assign all to:
            </span>
            <select
              value={bulkUserId}
              onChange={(e) => setBulkUserId(e.target.value)}
              className="flex-1 min-w-[180px] text-sm border border-blue-300 rounded px-2 py-1.5 bg-white"
            >
              <option value="">Choose a user…</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.fullname || u.email}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleBulkAssign}
              disabled={!bulkUserId}
              className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Apply to all
            </button>
            {!noneAssigned && (
              <button
                type="button"
                onClick={() => onBulkAssign(null)}
                className="px-3 py-1.5 border border-blue-300 text-blue-700 text-sm font-medium rounded hover:bg-blue-100"
                title="Clear assignment on every sub-service"
              >
                Clear all
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {children.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No sub-services in this bundle.
            </p>
          ) : (
            children.map(({ item: child, index: childIndex }) => (
              <div
                key={childIndex}
                className="border border-gray-200 rounded-lg p-3 bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900 truncate">
                        {child.name}
                      </p>
                      {child.isAggregator && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          Aggregator
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Labor: ${Number(child.laborCost || 0).toFixed(2)}
                    </p>
                    {child.commissionType && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        Commission:{" "}
                        <span className="font-medium text-gray-700">
                          {child.commissionType === "percentage"
                            ? `${child.commissionValue}% ($${
                                child.commissionAmount?.toFixed(2) || "0.00"
                              })`
                            : `$${Number(child.commissionValue || 0).toFixed(2)}`}
                        </span>
                        {child.commissionIsOverride ? (
                          <span className="ml-2 text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                            Override
                          </span>
                        ) : (
                          <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <select
                      value={child.assignedUser || ""}
                      onChange={(e) =>
                        onAssign(childIndex, e.target.value || null)
                      }
                      className="text-sm border border-gray-300 rounded px-2 py-1 min-w-[160px]"
                    >
                      <option value="">Assign user</option>
                      {users.map((u) => (
                        <option key={u._id} value={u._id}>
                          {u.fullname || u.email}
                        </option>
                      ))}
                    </select>

                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => onRemoveChild(childIndex)}
                        className="text-red-500 hover:text-red-700 text-lg leading-none px-1"
                        title={
                          child.isAggregator
                            ? "Remove this aggregator — the whole bundle will be removed"
                            : "Remove this sub-service — its price transfers to the aggregator"
                        }
                        aria-label="Remove sub-service"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-3 flex justify-between items-center bg-gray-50">
          <p className="text-xs text-gray-500">
            {canRemove
              ? "Removing a sub-service transfers its price to the aggregator."
              : "Last sub-service cannot be removed."}
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}