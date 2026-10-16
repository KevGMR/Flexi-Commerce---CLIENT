"use client";

import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

/**
 * One cart row. Handles three shapes:
 *   - bundle parent (opens Manage modal; no inline expand)
 *   - attached product (attached to a service)
 *   - standalone item (flexi / shopify / service)
 *
 * Bundle children are never rendered inline — they only appear inside
 * BundleManageModal. See pos/page.js patch for the skip logic.
 *
 * Services render as a compact summary by default:
 *   $300.00 · Dorcas Wanjiru Kimani · Commission 0% ($0.00) [Default] ▸
 * Clicking the summary expands labor cost, user picker, and discount.
 *
 * All mutation is delegated to callbacks owned by pos/page.js.
 */
export default function CartLine({
  item,
  index,
  cart,
  users,
  expandedServices,
  onToggleServiceExpand,
  onOpenManage,
  onRemove,
  onPriceEdit,
  onPriceSave,
  onPriceCancel,
  editingPriceIndex,
  editingPriceValue,
  setEditingPriceValue,
  onDiscountEdit,
  onDiscountSave,
  onDiscountCancel,
  editingDiscountIndex,
  discountType,
  setDiscountType,
  discountValue,
  setDiscountValue,
  onUpdateQuantity,
  onUpdateBundleParentQuantity,
  onUpdateServiceCosts,
  onAssignUser,
  attachMode,
  attachingServiceIndex,
  onToggleAttach,
  onDetach,
  onOpenAttachQuantity,
}) {
  const isService = item.type === "service";
  const isBundleParent = item.isBundleParent === true;
  const isChild =
    item.parentItemIndex !== null &&
    item.parentItemIndex !== undefined &&
    !isBundleParent;
  const isAttachActive = attachMode && attachingServiceIndex === index;

  const canApplyDiscount = useSessionStore
    .getState()
    .can(PERMISSIONS.POS_APPLY_DISCOUNT);

  const childCount = isBundleParent
    ? cart.filter((i) => i.isBundleChild && i.parentItemIndex === index).length
    : 0;
  const assignedChildCount = isBundleParent
    ? cart.filter(
        (i) =>
          i.isBundleChild &&
          i.parentItemIndex === index &&
          i.assignedUser,
      ).length
    : 0;

  // Expanded state for service detail panel
  const isServiceExpanded =
    expandedServices instanceof Set
      ? expandedServices.has(String(index))
      : Array.isArray(expandedServices)
        ? expandedServices.includes(index)
        : false;

  // Resolve the assigned user's display name
  const assignedUserObj = item.assignedUser
    ? users.find((u) => String(u._id) === String(item.assignedUser))
    : null;
  const assignedUserName =
    assignedUserObj?.fullname || assignedUserObj?.email || "";

  // Compact commission label for the summary line
  const commissionLabel = (() => {
    if (!item.commissionType) return "No commission";
    if (item.commissionType === "percentage") {
      return `${item.commissionValue || 0}% ($${Number(
        item.commissionAmount || 0,
      ).toFixed(2)})`;
    }
    return `$${Number(item.commissionValue || 0).toFixed(2)}`;
  })();

  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <div className="flex items-start justify-between gap-2">
        {/* Thumbnail */}
        <div className="w-10 h-10 rounded border bg-gray-100 overflow-hidden flex-shrink-0 mt-0.5">
          {item.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
              —
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-gray-900 text-sm truncate">
              {item.name}
            </h4>
            {isBundleParent && (
              <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                Bundle
              </span>
            )}
            {isChild && (
              <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">
                attached
              </span>
            )}
            {isService && !isBundleParent && (
              <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                service
              </span>
            )}
          </div>

          {/* Bundle parent: summary + Manage prompt */}
          {isBundleParent && (
            <div className="text-xs text-gray-500 mt-1">
              {item.quantity} × {childCount} sub-service
              {childCount === 1 ? "" : "s"}
              {" · "}
              <span
                className={
                  assignedChildCount === childCount && childCount > 0
                    ? "text-green-600"
                    : "text-amber-600"
                }
              >
                {assignedChildCount} of {childCount} assigned
              </span>
              {" · "}
              <button
                onClick={() => onOpenManage(index)}
                className="text-blue-600 hover:text-blue-800 font-medium underline-offset-2 hover:underline"
              >
                Manage
              </button>
            </div>
          )}

          {/* Service: compact summary + inline expand */}
          {isService && !isBundleParent && (
            <div className="mt-1 space-y-1">
              {/* Summary line — always shown */}
              <button
                type="button"
                onClick={() => onToggleServiceExpand(index)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 text-left flex-wrap"
                title={isServiceExpanded ? "Hide details" : "Edit details"}
              >
                <span className="text-gray-700 font-medium">
                  ${Number(item.price || 0).toFixed(2)}
                </span>
                <span className="text-gray-300">·</span>
                <span
                  className={
                    assignedUserName ? "text-gray-700" : "text-amber-600"
                  }
                >
                  {assignedUserName || "Unassigned"}
                </span>
                <span className="text-gray-300">·</span>
                <span>Commission {commissionLabel}</span>
                {item.commissionIsOverride ? (
                  <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">
                    Override
                  </span>
                ) : (
                  <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    Default
                  </span>
                )}
                <span className="text-[10px] text-blue-600 ml-1">
                  {isServiceExpanded ? "▾" : "▸"}
                </span>
              </button>

              {/* Expanded details */}
              {isServiceExpanded && (
                <div className="mt-2 space-y-2 border-l-2 border-blue-200 pl-3">
                  {/* Labor cost */}
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-500 w-12">
                      Labor:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.laborCost || 0}
                      onChange={(e) =>
                        onUpdateServiceCosts(
                          index,
                          "laborCost",
                          e.target.value,
                        )
                      }
                      className="w-20 px-1 py-0.5 text-xs border border-gray-300 rounded"
                    />
                    <span className="text-[10px] text-gray-500">
                      = ${Number(item.price || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Assigned user */}
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-gray-500 w-12">
                      User:
                    </label>
                    <select
                      value={item.assignedUser || ""}
                      onChange={(e) =>
                        onAssignUser(index, e.target.value || null)
                      }
                      className="text-xs border border-gray-300 rounded px-1 py-0.5 flex-1 max-w-[180px]"
                    >
                      <option value="">Assign user</option>
                      {users.map((user) => (
                        <option key={user._id} value={user._id}>
                          {user.fullname || user.email}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Discount */}
                  {canApplyDiscount && (
                    <div className="flex items-center gap-2">
                      {editingDiscountIndex === index ? (
                        <>
                          <select
                            value={discountType}
                            onChange={(e) =>
                              setDiscountType(e.target.value)
                            }
                            className="px-2 py-1 border border-green-300 rounded text-xs"
                          >
                            <option value="fixed">$</option>
                            <option value="percentage">%</option>
                          </select>
                          <input
                            autoFocus
                            type="number"
                            step="0.01"
                            placeholder="0"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(e.target.value)}
                            onBlur={() => onDiscountSave(index)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onDiscountSave(index);
                              if (e.key === "Escape") onDiscountCancel();
                            }}
                            className="w-20 px-2 py-1 border border-green-300 rounded text-xs"
                          />
                          <button
                            onClick={onDiscountCancel}
                            className="text-xs text-gray-500"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => onDiscountEdit(index)}
                          className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                          title="Click to apply discount"
                        >
                          {item.discount > 0 ? (
                            <>
                              <span className="line-through text-gray-400">
                                $
                                {(
                                  Number(item.price) * item.quantity
                                ).toFixed(2)}
                              </span>
                              <span className="font-medium">
                                -${Number(item.discount).toFixed(2)} 🏷️
                              </span>
                            </>
                          ) : (
                            <span>+ Add Discount</span>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Non-service price edit */}
          {!isService && !isBundleParent && (
            <div className="flex items-center gap-2 mt-1">
              {editingPriceIndex === index ? (
                <input
                  autoFocus
                  type="number"
                  step="0.01"
                  value={editingPriceValue}
                  onChange={(e) => setEditingPriceValue(e.target.value)}
                  onBlur={() => onPriceSave(index)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onPriceSave(index);
                    if (e.key === "Escape") onPriceCancel();
                  }}
                  className="w-20 px-2 py-1 border border-blue-300 rounded text-sm"
                />
              ) : (
                <button
                  onClick={() => onPriceEdit(index)}
                  className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1"
                  title="Click to edit price"
                >
                  ${Number(item.price || 0).toFixed(2)}{" "}
                  <span className="text-xs">✎</span>
                </button>
              )}
            </div>
          )}

          {/* Discount controls for non-service, non-child items */}
          {canApplyDiscount && !isChild && !isBundleParent && !isService && (
            <div className="mt-1">
              {editingDiscountIndex === index ? (
                <div className="flex items-center gap-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="px-2 py-1 border border-green-300 rounded text-xs"
                  >
                    <option value="fixed">$</option>
                    <option value="percentage">%</option>
                  </select>
                  <input
                    autoFocus
                    type="number"
                    step="0.01"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    onBlur={() => onDiscountSave(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onDiscountSave(index);
                      if (e.key === "Escape") onDiscountCancel();
                    }}
                    className="w-20 px-2 py-1 border border-green-300 rounded text-xs"
                  />
                  <button
                    onClick={onDiscountCancel}
                    className="text-xs text-gray-500"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onDiscountEdit(index)}
                  className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                  title="Click to apply discount"
                >
                  {item.discount > 0 ? (
                    <>
                      <span className="line-through text-gray-400">
                        ${(Number(item.price) * item.quantity).toFixed(2)}
                      </span>
                      <span className="font-medium">
                        -${Number(item.discount).toFixed(2)} 🏷️
                      </span>
                    </>
                  ) : (
                    <span>+ Add Discount</span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right-side actions */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button
            onClick={() => onRemove(index)}
            className="text-red-500 hover:text-red-700"
          >
            ✕
          </button>

          {!isService &&
            !isChild &&
            !isBundleParent &&
            cart.some((it) => it.type === "service") && (
              <button
                onClick={() => onOpenAttachQuantity(index)}
                className="text-[10px] text-blue-600 hover:text-blue-800 whitespace-nowrap"
              >
                Attach
              </button>
            )}

          {isChild && (
            <button
              onClick={() => onDetach(index)}
              className="text-[10px] text-red-500 hover:text-red-700 whitespace-nowrap"
            >
              Detach
            </button>
          )}

          {isService && !isBundleParent && (
            <button
              onClick={() => onToggleAttach(index)}
              className={`text-[10px] p-1 rounded-full border ${
                isAttachActive
                  ? "border-blue-500 bg-blue-100 text-blue-700"
                  : "border-gray-300 bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
              title={isAttachActive ? "Stop attaching" : "Start attaching"}
            >
              📎
            </button>
          )}

          {isService && isAttachActive && (
            <span className="text-[9px] text-blue-600 whitespace-nowrap">
              Attaching...
            </span>
          )}
        </div>
      </div>

      {/* Quantity + line total */}
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {isBundleParent ? (
            <>
              <button
                onClick={() =>
                  onUpdateBundleParentQuantity(index, item.quantity - 1)
                }
                className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
              >
                −
              </button>
              <span className="w-12 text-center font-medium">
                {item.quantity}
              </span>
              <button
                onClick={() =>
                  onUpdateBundleParentQuantity(index, item.quantity + 1)
                }
                className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
              >
                +
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
              >
                −
              </button>
              <span className="w-12 text-center font-medium">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
              >
                +
              </button>
            </>
          )}
        </div>
        <div className="text-right">
          <p className="font-bold text-gray-900">
            $
            {(
              Number(item.price || 0) * item.quantity -
              Number(item.discount || 0)
            ).toFixed(2)}
          </p>
          {item.discount > 0 && (
            <p className="text-xs text-green-600">
              Saved ${Number(item.discount).toFixed(2)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}