'use client';

import { useState } from 'react';
import DeliveryCheckoutModal from './DeliveryCheckoutModal';

export default function CompleteCheckoutModal({
  isOpen,
  cart,
  cartTotal,
  cartDiscount,
  notes,
  selectedPaymentMethod,
  splitPayments,
  useSplitPayment,
  locationId,
  paymentMethods,
  onNoteChange,
  onPaymentMethodChange,
  onSplitPaymentChange,
  onRemoveSplitPayment,
  onAddSplitPayment,
  onUseSplitPaymentChange,
  onComplete,
  onClose,
  status,
  error,
  selectedCustomer,
  deliveryInfo,
  deliveryFee,
  deliveryEnabled,
}) {
  const [isProductsExpanded, setIsProductsExpanded] = useState(true);
  const [isServicesExpanded, setIsServicesExpanded] = useState(true);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const getItemName = (item) =>
    item?.name || item?.productName || item?.title || item?.product?.name || 'Unknown Item';

  const getItemUnitPrice = (item) => Number(item?.price || item?.unitPrice || 0);

  const getItemDiscount = (item) => Number(item?.discount || 0);

  const getBundleComponents = (item) =>
    Array.isArray(item?.serviceBundleComponents)
      ? item.serviceBundleComponents
      : Array.isArray(item?.bundleComponents)
        ? item.bundleComponents
        : [];

  const formatMoney = (value) => `$${Number(value || 0).toFixed(2)}`;

  const getUserFullName = (userId) => {
    if (!userId) return 'Unassigned';
    return userId;
  };

  const normalizeCartBreakdown = () => {
    const products = [];
    const services = [];

    cart.forEach((item, index) => {
      const isService = item?.type === 'service';
      const isChild = item?.parentItemIndex !== null && item?.parentItemIndex !== undefined;
      const bundleComponents = getBundleComponents(item);
      const quantity = Number(item?.quantity || 0);
      const unitPrice = getItemUnitPrice(item);
      const discount = getItemDiscount(item);
      const originalPrice = item?.originalPrice || unitPrice;

      const baseEntry = {
        key: `${item?.variant || index}-${index}`,
        index,
        item,
        name: getItemName(item),
        quantity,
        unitPrice,
        originalPrice,
        discount,
        isChild,
        parentItemIndex: item?.parentItemIndex,
        lineTotal: isChild ? 0 : Math.max(0, unitPrice * quantity - discount),
        assignedUser: item?.assignedUser,
        commissionAmount: item?.commissionAmount || 0,
        commissionType: item?.commissionType,
        commissionValue: item?.commissionValue,
        bundleComponents,
      };

      if (isService) {
        services.push(baseEntry);
      } else {
        products.push(baseEntry);
      }
    });

    return { products, services };
  };

  const { products, services } = normalizeCartBreakdown();

  const findParentService = (childItem) => {
    if (!childItem.isChild) return null;
    const parent = cart[childItem.parentItemIndex];
    if (!parent) return null;
    return {
      name: getItemName(parent),
      index: childItem.parentItemIndex,
    };
  };

  const commissionSummary = services.reduce((acc, service) => {
    if (service.assignedUser && service.commissionAmount > 0) {
      const userId = service.assignedUser;
      if (!acc[userId]) {
        acc[userId] = {
          userId,
          totalCommission: 0,
          services: [],
        };
      }
      acc[userId].totalCommission += service.commissionAmount;
      acc[userId].services.push({
        name: service.name,
        commissionAmount: service.commissionAmount,
        commissionType: service.commissionType,
        commissionValue: service.commissionValue,
      });
    }
    return acc;
  }, {});

  const hasCommissionSummary = Object.keys(commissionSummary).length > 0;

  const total = cartTotal + deliveryFee;
  const splitTotal = splitPayments.reduce(
    (sum, p) => sum + parseFloat(p.amount || 0),
    0,
  );
  const remainingAmount = Math.max(0, total - splitTotal);
  const isReservation = useSplitPayment && remainingAmount > 0.01;

  const renderBundleComponent = (component, parentQuantity, componentIndex) => {
    const componentQuantity = Number(component?.quantity || 0);
    const componentUnitPrice = Number(component?.priceSnapshot || component?.price || 0);
    const componentTotalQuantity = componentQuantity * parentQuantity;
    const componentLineTotal = Math.max(0, componentUnitPrice * componentTotalQuantity);
    const componentName =
      component?.nameSnapshot || component?.name || component?.serviceName || 'Bundle Component';

    return (
      <div
        key={`${component?.serviceProductId || componentName}-${componentIndex}`}
        className="ml-6 border-l border-dashed border-gray-300 pl-4"
      >
        <div className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Component
            </div>
            <div className="font-medium text-gray-800 truncate">{componentName}</div>
            <div className="mt-1 text-xs text-gray-500">
              {component?.skuSnapshot ? `SKU ${component.skuSnapshot} · ` : ''}
              {componentQuantity} per bundle · {formatMoney(componentUnitPrice)} each
            </div>
          </div>
          <div className="text-right text-sm">
            <div className="font-semibold text-gray-900">{formatMoney(componentLineTotal)}</div>
            <div className="text-xs text-gray-500">{componentTotalQuantity} total units</div>
          </div>
        </div>
      </div>
    );
  };

  const renderItemRow = (entry, itemType) => {
    const isBundle = entry.bundleComponents.length > 0;
    const parentService = findParentService(entry);

    return (
      <div
        key={entry.key}
        className={`rounded-lg border border-gray-200 bg-white px-3 py-3 ${entry.isChild ? 'ml-6 border-l-2 border-blue-200' : ''}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-medium text-gray-900 truncate">{entry.name}</h4>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${itemType === 'service' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {itemType === 'service' ? 'Service' : 'Product'}
              </span>
              {entry.isChild && (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">
                  Included in: {parentService?.name || 'Service'}
                </span>
              )}
              {isBundle && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                  Bundle
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Qty {entry.quantity}
              {!entry.isChild && ` · ${formatMoney(entry.unitPrice)} each`}
              {entry.isChild && entry.originalPrice && (
                <span className="ml-2">
                  <span className="line-through text-gray-400">{formatMoney(entry.originalPrice)}</span>
                  {' '}<span className="text-green-600">Included</span>
                </span>
              )}
              {entry.item?.sku ? ` · SKU ${entry.item.sku}` : ''}
            </div>
            {entry.discount > 0 && !entry.isChild && (
              <div className="mt-1 text-xs font-medium text-green-600">
                Discount {formatMoney(entry.discount)}
              </div>
            )}
            {itemType === 'service' && entry.assignedUser && (
              <div className="mt-1 text-xs text-gray-500">
                Assigned to: <span className="font-medium text-gray-700">{getUserFullName(entry.assignedUser)}</span>
                {entry.commissionAmount > 0 && (
                  <span className="ml-2 text-blue-600">
                    Commission: {formatMoney(entry.commissionAmount)}
                    {entry.commissionType === 'percentage' && ` (${entry.commissionValue}%)`}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-base font-bold text-gray-900">
              {entry.isChild ? formatMoney(0) : formatMoney(entry.lineTotal)}
            </div>
            {!entry.isChild && entry.discount > 0 && (
              <div className="text-xs text-gray-500">Before discount {formatMoney(entry.unitPrice * entry.quantity)}</div>
            )}
          </div>
        </div>

        {isBundle && (
          <div className="mt-2 space-y-1 rounded-md bg-gray-50 px-2 py-2">
            {entry.bundleComponents.map((component, componentIndex) =>
              renderBundleComponent(component, entry.quantity, componentIndex),
            )}
          </div>
        )}
      </div>
    );
  };

  const handleDeliveryConfirm = (deliveryData, fee) => {
    setShowDeliveryModal(false);
  };

  const handleDeliverySkip = () => {
    setShowDeliveryModal(false);
  };

  const handleCompleteSale = async () => {
    setIsSubmitting(true);
    try {
      await onComplete({
        notes,
        paymentMethod: selectedPaymentMethod,
        splitPayments,
        useSplitPayment,
        deliveryInfo,
        deliveryFee,
        isReservation,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasItems = products.length > 0 || services.length > 0;

  return (
    <>
      {/* Main Complete Sale Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Complete Sale</h2>
              <p className="text-sm text-gray-500 mt-1">Review order and complete payment</p>
            </div>
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body - Two Column Layout */}
          <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
            {/* LEFT COLUMN - Cart Breakdown & Info */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0">
              {/* Customer Info */}
              {selectedCustomer && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Customer</h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-gray-900">{selectedCustomer.fullname}</p>
                    {selectedCustomer.email && <p className="text-gray-600">{selectedCustomer.email}</p>}
                    {selectedCustomer.phone && <p className="text-gray-600">{selectedCustomer.phone}</p>}
                    {selectedCustomer.loyaltyPoints > 0 && (
                      <p className="text-xs text-blue-600 font-medium">{selectedCustomer.loyaltyPoints} loyalty points</p>
                    )}
                  </div>
                </div>
              )}

              {/* Delivery Summary */}
              {deliveryEnabled && deliveryInfo && (
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <h3 className="font-semibold text-gray-900 mb-2">🚚 Delivery Details</h3>
                  <div className="space-y-1 text-sm">
                    <p><span className="font-medium">Recipient:</span> {deliveryInfo.recipientName}</p>
                    <p><span className="font-medium">Phone:</span> {deliveryInfo.recipientPhone}</p>
                    {deliveryInfo.recipientEmail && <p><span className="font-medium">Email:</span> {deliveryInfo.recipientEmail}</p>}
                    <p><span className="font-medium">Category:</span> {deliveryInfo.deliveryCategory}</p>
                    <p><span className="font-medium">Option:</span> {deliveryInfo.deliveryOption}</p>
                    <p><span className="font-medium">Address:</span> {deliveryInfo.deliveryAddress?.street}, {deliveryInfo.deliveryAddress?.city}, {deliveryInfo.deliveryAddress?.state} {deliveryInfo.deliveryAddress?.postalCode}</p>
                    {deliveryInfo.notes && <p><span className="font-medium">Notes:</span> {deliveryInfo.notes}</p>}
                  </div>
                </div>
              )}

              {/* Cart Breakdown */}
              {hasItems && (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-gray-900">Order Items</h3>

                  {products.length > 0 && (
                    <div className="border border-amber-200 rounded-lg bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsProductsExpanded((prev) => !prev)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-amber-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">Products</span>
                          <span className="text-xs text-gray-500">{products.length} item{products.length === 1 ? '' : 's'}</span>
                        </div>
                        <span className="text-gray-600">{isProductsExpanded ? '−' : '+'}</span>
                      </button>
                      {isProductsExpanded && (
                        <div className="space-y-2 border-t border-amber-100 p-3 max-h-60 overflow-y-auto">
                          {products.map((entry) => renderItemRow(entry, 'product'))}
                        </div>
                      )}
                    </div>
                  )}

                  {services.length > 0 && (
                    <div className="border border-blue-200 rounded-lg bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setIsServicesExpanded((prev) => !prev)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">Services</span>
                          <span className="text-xs text-gray-500">{services.length} item{services.length === 1 ? '' : 's'}</span>
                        </div>
                        <span className="text-gray-600">{isServicesExpanded ? '−' : '+'}</span>
                      </button>
                      {isServicesExpanded && (
                        <div className="space-y-2 border-t border-blue-100 p-3 max-h-60 overflow-y-auto">
                          {services.map((entry) => renderItemRow(entry, 'service'))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Commission Summary */}
              {hasCommissionSummary && (
                <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Commission Summary</h3>
                  <div className="space-y-2">
                    {Object.values(commissionSummary).map((summary) => (
                      <div key={summary.userId} className="bg-white rounded p-3 border border-indigo-100">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-900">
                            {getUserFullName(summary.userId)}
                          </span>
                          <span className="font-semibold text-indigo-600">
                            {formatMoney(summary.totalCommission)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {summary.services.map((svc, idx) => (
                            <span
                              key={idx}
                              className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded"
                            >
                              {svc.name}: {formatMoney(svc.commissionAmount)}
                              {svc.commissionType === 'percentage' && ` (${svc.commissionValue}%)`}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">
                  Add Note (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => onNoteChange(e.target.value)}
                  placeholder="Add any notes about this sale..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows="2"
                />
              </div>
            </div>

            {/* RIGHT COLUMN - Payment & Summary */}
            <div className="w-full md:w-[420px] bg-gray-50 border-l border-gray-200 flex flex-col flex-shrink-0">
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Order Summary */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-medium">{formatMoney(cartTotal)}</span>
                    </div>
                    {cartDiscount > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount</span>
                        <span>-{formatMoney(cartDiscount)}</span>
                      </div>
                    )}
                    {deliveryEnabled && deliveryFee > 0 && (
                      <div className="flex justify-between text-blue-600 font-medium">
                        <span>🚚 Delivery Fee</span>
                        <span>{formatMoney(deliveryFee)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-bold text-lg">
                      <span>Total</span>
                      <span className="text-blue-600">{formatMoney(total)}</span>
                    </div>
                  </div>
                </div>

                {/* Reservation Indicator */}
                {isReservation && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-sm text-amber-800">
                      ⚡ This will create a <strong>reservation</strong> with balance due of <strong>{formatMoney(remainingAmount)}</strong>.
                      The sale will be marked as partial payment.
                    </p>
                  </div>
                )}

                {/* Payment Methods */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">Payment</h3>
                    {cart.length > 0 && (
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useSplitPayment}
                          onChange={(e) => {
                            if (onUseSplitPaymentChange) {
                              onUseSplitPaymentChange(e.target.checked);
                            }
                          }}
                          className="rounded"
                        />
                        <span className="text-gray-600">Split</span>
                      </label>
                    )}
                  </div>

                  {!useSplitPayment ? (
                    <div className="grid grid-cols-3 gap-2">
                      {paymentMethods.map((method, idx) => {
                        const value = typeof method === 'string' ? method : method.value || method;
                        const label = typeof method === 'string' ? method : method.label || method.value || method;
                        const icon = typeof method === 'object' && method.icon ? method.icon : '';
                        const isSelected = selectedPaymentMethod === value;
                        
                        return (
                          <button
                            key={`method-${idx}`}
                            onClick={() => onPaymentMethodChange(value)}
                            className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center justify-center gap-1 ${
                              isSelected
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                          >
                            {icon && <span className="text-2xl">{icon}</span>}
                            <span className="text-xs font-medium">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {splitPayments.map((payment, index) => {
                          const availableMethods = paymentMethods.filter(
                            (m) =>
                              m.value === payment.method ||
                              !splitPayments.some(
                                (p, i) => i !== index && p.method === m.value
                              )
                          );

                          return (
                            <div key={`split-${index}`} className="flex items-center gap-2">
                              <select
                                value={payment.method}
                                onChange={(e) => onSplitPaymentChange(index, 'method', e.target.value)}
                                className="flex-1 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                              >
                                {availableMethods.map((m) => (
                                  <option key={m.value} value={m.value}>
                                    {m.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                value={payment.amount}
                                onChange={(e) => {
                                  const parsedAmount = Number(e.target.value);
                                  onSplitPaymentChange(
                                    index,
                                    'amount',
                                    Number.isFinite(parsedAmount) && parsedAmount >= 0
                                      ? parsedAmount
                                      : 0,
                                  );
                                }}
                                placeholder="Amount"
                                className="w-24 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                                step="0.01"
                                min="0"
                              />
                              {splitPayments.length > 1 && (
                                <button
                                  onClick={() => onRemoveSplitPayment(index)}
                                  className="px-2 py-2 text-red-500 hover:text-red-700 font-bold transition-colors"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-sm">
                          {(() => {
                            const splitTotal = splitPayments.reduce(
                              (sum, p) => sum + parseFloat(p.amount || 0),
                              0
                            );
                            const remaining = total - splitTotal;
                            
                            return (
                              <div className="space-y-1">
                                <div className="font-medium">
                                  Split Total: <span className="text-gray-900">{formatMoney(splitTotal)}</span>
                                </div>
                                {remaining > 0.01 && (
                                  <div className="text-orange-600 font-medium">
                                    Remaining: {formatMoney(remaining)}
                                  </div>
                                )}
                                {remaining < -0.01 && (
                                  <div className="text-red-600 font-medium">
                                    Over by: {formatMoney(Math.abs(remaining))}
                                  </div>
                                )}
                                {Math.abs(remaining) <= 0.01 && splitTotal > 0 && (
                                  <div className="text-green-600 font-medium">
                                    ✓ Balanced
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <button
                          onClick={onAddSplitPayment}
                          disabled={splitPayments.length >= paymentMethods.length}
                          className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 text-xs font-medium transition-colors"
                        >
                          + Add Payment
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Status/Error */}
                {status && (
                  <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded border border-green-200">
                    {status}
                  </div>
                )}
                {error && (
                  <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded border border-red-200">
                    {error}
                  </div>
                )}
              </div>

              {/* Footer - Action Buttons */}
              <div className="border-t border-gray-200 p-4 bg-white flex-shrink-0">
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCompleteSale}
                    disabled={isSubmitting}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                      isReservation
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isSubmitting && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                    {isSubmitting
                      ? 'Processing...'
                      : `${isReservation ? 'Create Reservation' : 'Complete Sale'} (${formatMoney(total)})`}
                  </button>
                </div>
                {isReservation && (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    ⚡ Reservation: Balance due {formatMoney(remainingAmount)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delivery Checkout Modal - shown as sub-modal */}
      {showDeliveryModal && (
        <DeliveryCheckoutModal
          isOpen={showDeliveryModal}
          locationId={locationId}
          cartSubtotal={cartTotal}
          cartDiscount={cartDiscount}
          onConfirm={handleDeliveryConfirm}
          onSkip={handleDeliverySkip}
          onClose={() => setShowDeliveryModal(false)}
          isSubModal={true}
        />
      )}
    </>
  );
}