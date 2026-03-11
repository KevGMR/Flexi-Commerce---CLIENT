import { toNonNegativeAmount } from "@/lib/receipt/receiptPrintTemplate";

const normalizePayments = (payments, fallbackMethod, fallbackAmount) => {
  if (Array.isArray(payments) && payments.length > 0) {
    return payments.map((payment) => ({
      method: payment?.method || "cash",
      amount: toNonNegativeAmount(payment?.amount),
    }));
  }

  if (fallbackMethod || Number.isFinite(Number(fallbackAmount))) {
    return [
      {
        method: fallbackMethod || "cash",
        amount: toNonNegativeAmount(fallbackAmount),
      },
    ];
  }

  return [];
};

const normalizeItems = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => ({
    name: item?.name || item?.productName || "Item",
    quantity: Number(item?.quantity) || 0,
    price: toNonNegativeAmount(item?.price ?? item?.unitPrice),
    type: item?.type,
    discount: toNonNegativeAmount(item?.discount),
  }));

const normalizeTags = (tags) => {
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string" && tags.trim()) return [tags.trim()];
  return [];
};

const resolveSaleId = (sale) => sale?._id || sale?.id || null;

export const mapSaleToReceipt = ({ sale, receivable }) => {
  if (!sale) return null;

  const saleId = resolveSaleId(sale);
  const balanceDue = toNonNegativeAmount(
    receivable?.balanceDue ??
      sale?.balanceDue ??
      toNonNegativeAmount(sale?.totalAmount) - toNonNegativeAmount(sale?.amountPaid),
  );
  const amountPaid = toNonNegativeAmount(
    receivable?.totalPaid ?? sale?.amountPaid ?? toNonNegativeAmount(sale?.totalAmount) - balanceDue,
  );

  return {
    saleId,
    receiptNumber: sale.receiptNumber || sale.transactionId || `RECEIPT-${Date.now()}`,
    items: normalizeItems(sale.items),
    payments: normalizePayments(
      sale.effectivePayments || sale.payments,
      sale.paymentMethod,
      toNonNegativeAmount(sale.totalAmount),
    ),
    subtotal: toNonNegativeAmount(sale.totalAmount),
    grossAmount: toNonNegativeAmount(sale.totalAmount),
    exchangeCreditApplied: toNonNegativeAmount(sale.exchangeCreditApplied),
    netCollected: toNonNegativeAmount(
      sale.netCollected ?? toNonNegativeAmount(sale.totalAmount) - toNonNegativeAmount(sale.exchangeCreditApplied),
    ),
    amountPaid,
    balanceDue,
    paymentStatus: sale.paymentStatus,
    tags: normalizeTags(sale.tags),
    notes: sale.notes || "",
    timestamp: sale.createdAt || new Date().toISOString(),
    isReservation: sale.isReservation === true,
    requiresDelivery: sale.requiresDelivery === true,
    deliveryFee: toNonNegativeAmount(sale.deliveryFeeAmount ?? sale.deliveryFee),
    deliveryInfo: sale.requiresDelivery
      ? {
          recipientName:
            sale.deliveryInfo?.recipientName ||
            (typeof sale.deliveryFeeId === "object" ? sale.deliveryFeeId?.recipientName : undefined),
          recipientPhone:
            sale.deliveryInfo?.recipientPhone ||
            (typeof sale.deliveryFeeId === "object" ? sale.deliveryFeeId?.recipientPhone : undefined),
          deliveryAddress:
            sale.deliveryInfo?.deliveryAddress ||
            (typeof sale.deliveryFeeId === "object" ? sale.deliveryFeeId?.deliveryAddress : undefined),
          deliveryCategory: sale.deliveryInfo?.deliveryCategory || sale.deliveryCategory,
          deliveryOption: sale.deliveryInfo?.deliveryOption || sale.deliveryOption,
        }
      : sale.deliveryInfo || undefined,
  };
};

export const mapDeliveryToReceipt = ({ delivery, receivable }) => {
  if (!delivery) return null;

  const linkedSale = delivery.saleId && typeof delivery.saleId === "object"
    ? delivery.saleId
    : null;

  if (!linkedSale) {
    return null;
  }

  return mapSaleToReceipt({ sale: linkedSale, receivable });
};
