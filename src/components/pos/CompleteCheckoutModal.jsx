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
}) {
  const [isProductsExpanded, setIsProductsExpanded] = useState(true);
  const [isServicesExpanded, setIsServicesExpanded] = useState(true);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
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

  const normalizeCartBreakdown = () => {
    const products = [];
    const services = [];

    cart.forEach((item, index) => {
      const isService = item?.type === 'service';
      const bundleComponents = getBundleComponents(item);
      const quantity = Number(item?.quantity || 0);
      const unitPrice = getItemUnitPrice(item);
      const discount = getItemDiscount(item);

      const baseEntry = {
        key: `${item?.variant || index}-${index}`,
        index,
        item,
        name: getItemName(item),
        quantity,
        unitPrice,
        discount,
        lineTotal: Math.max(0, unitPrice * quantity - discount),
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
  const hasBreakdownItems = products.length > 0 || services.length > 0;

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

    return (
      <div key={entry.key} className="rounded-lg border border-gray-200 bg-white px-3 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-medium text-gray-900 truncate">{entry.name}</h4>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${itemType === 'service' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                {itemType === 'service' ? 'Service' : 'Product'}
              </span>
              {isBundle && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
                  Bundle
                </span>
              )}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Qty {entry.quantity} · {formatMoney(entry.unitPrice)} each
              {entry.item?.sku ? ` · SKU ${entry.item.sku}` : ''}
            </div>
            {entry.discount > 0 && (
              <div className="mt-1 text-xs font-medium text-green-600">
                Discount {formatMoney(entry.discount)}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-base font-bold text-gray-900">{formatMoney(entry.lineTotal)}</div>
            {entry.discount > 0 && (
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
    setDeliveryInfo(deliveryData);
    setDeliveryFee(fee);
    setShowDeliveryModal(false);
  };

  const handleDeliverySkip = () => {
    setDeliveryInfo(null);
    setDeliveryFee(0);
    setShowDeliveryModal(false);
  };

  const handleCompleteSale = async () => {
    setIsSubmitting(true);
    try {
      const splitTotal = splitPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount || 0),
        0,
      );
      const remainingAmount = Math.max(0, total - splitTotal);
      const isReservation = useSplitPayment && remainingAmount > 0.01;

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

  const total = cartTotal + deliveryFee;
  const splitTotal = splitPayments.reduce(
    (sum, p) => sum + parseFloat(p.amount || 0),
    0,
  );
  const remainingAmount = Math.max(0, total - splitTotal);
  const isReservation = useSplitPayment && remainingAmount > 0.01;

  return (
    <>
      {/* Main Complete Sale Modal */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Complete Sale</h2>

          {/* Cart Breakdown */}
          {hasBreakdownItems && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Cart Breakdown</h3>

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
                    <div className="space-y-2 border-t border-amber-100 p-3">
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
                    <div className="space-y-2 border-t border-blue-100 p-3">
                      {services.map((entry) => renderItemRow(entry, 'service'))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
              {cartDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${cartDiscount.toFixed(2)}</span>
                </div>
              )}
              {deliveryFee > 0 && (
                <div className="flex justify-between text-blue-600 font-medium">
                  <span>🚚 Delivery Fee</span>
                  <span>${deliveryFee.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-blue-600">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Delivery Section (Expandable) */}
          <div className="border rounded-lg mb-6">
            <button
              onClick={() => setShowDeliveryModal(!deliveryInfo && !showDeliveryModal)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🚚</span>
                <span className="font-medium text-gray-900">
                  {deliveryInfo ? 'Delivery Added' : 'Add Delivery (Optional)'}
                </span>
              </div>
              <span className="text-gray-600">
                {deliveryInfo ? '✓' : '+'}
              </span>
            </button>

            {/* Delivery Summary */}
            {deliveryInfo && (
              
              <div className="border-t px-4 py-3 bg-blue-50 space-y-2 text-sm">
                <div>
                  <span className="font-medium">Category:</span> {deliveryInfo.deliveryCategory}
                </div>
                <div>
                  <span className="font-medium">Option:</span> {deliveryInfo.deliveryOption}
                </div>
                <div>
                  <span className="font-medium">Recipient:</span> {deliveryInfo.recipientName}
                </div>
                <div>
                  <span className="font-medium">Phone:</span> {deliveryInfo.recipientPhone}
                </div>
                <div>
                  <span className="font-medium">Address:</span> {deliveryInfo.deliveryAddress.street}, {deliveryInfo.deliveryAddress?.city}
                </div>
                <button
                  onClick={() => setShowDeliveryModal(true)}
                  className="text-blue-600 hover:text-blue-700 font-medium mt-2"
                >
                  Edit Delivery
                </button>
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Payment Method</h3>
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
                    // Filter out already selected payment methods (except current)
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

                {/* Split Payment Summary & Add Button */}
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
                            Split Total: <span className="text-gray-900">${splitTotal.toFixed(2)}</span>
                          </div>
                          {remaining > 0.01 && (
                            <div className="text-orange-600 font-medium">
                              Remaining: ${remaining.toFixed(2)}
                            </div>
                          )}
                          {remaining < -0.01 && (
                            <div className="text-red-600 font-medium">
                              Over by: ${Math.abs(remaining).toFixed(2)}
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

          {/* Add Note */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Add Note (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Add any notes about this sale..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows="3"
            />
          </div>

          {/* Status/Error */}
          {status && (
            <div className="mb-6 text-sm text-green-700 bg-green-50 px-3 py-2 rounded border border-green-200">
              {status}
            </div>
          )}
          {error && (
            <div className="mb-6 text-sm text-red-700 bg-red-50 px-3 py-2 rounded border border-red-200">
              {error}
            </div>
          )}

          {/* Action Buttons */}
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
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
              {isSubmitting
                ? 'Processing...'
                : `${isReservation ? 'Create Reservation' : 'Complete Sale'} (${total.toFixed(2)})`}
            </button>
          </div>

          {isReservation && (
            <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This will create a reservation with balance due of ${remainingAmount.toFixed(2)}.
            </p>
          )}
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
