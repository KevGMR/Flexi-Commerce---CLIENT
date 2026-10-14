export const toNonNegativeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

export const hasPartialPaymentSignal = (receipt) => {
  if (!receipt || receipt.isReturn || receipt.isExchange) return false;
  const balanceDue = toNonNegativeAmount(receipt.balanceDue);
  const paymentStatus =
    typeof receipt.paymentStatus === "string"
      ? receipt.paymentStatus.toLowerCase()
      : "";
  const tags = Array.isArray(receipt.tags)
    ? receipt.tags
    : typeof receipt.tags === "string"
      ? [receipt.tags]
      : [];
  const hasPartialTag = tags.some((tag) => {
    const normalizedTag = String(tag).toLowerCase();
    return (
      normalizedTag === "reservation" || normalizedTag === "partial-payment"
    );
  });
  return (
    balanceDue > 0.01 ||
    receipt.isReservation === true ||
    paymentStatus === "partial" ||
    hasPartialTag
  );
};

const buildItemDisplayName = (item) => {
  const baseName = item.name || item.productName || "";
  const variantParts = Array.isArray(item.variantTitle)
    ? item.variantTitle
        .map((o) => (o && typeof o === "object" ? o.value : null))
        .filter(Boolean)
    : [];
  const variantLabel = variantParts.join(" / ");
  if (!variantLabel) return baseName;
  if (!baseName) return variantLabel;
  const alreadyIncluded = variantParts.every((v) =>
    baseName.toLowerCase().includes(String(v).toLowerCase()),
  );
  if (alreadyIncluded) return baseName;
  return `${baseName} — ${variantLabel}`;
};

/**
 * Build receipt HTML.
 *
 * @param {Object} params
 * @param {Object} params.receipt         — the receipt data (items, totals, etc.)
 * @param {String} params.organizationName
 * @param {String} params.locationLabel   — display label for the location (name)
 * @param {Object} params.location        — the full location document (for address, phone, taxId)
 * @param {Object} params.receiptConfig   — the customization config (logo, toggles, footer, etc.)
 */
export const buildReceiptPrintHtml = ({
  receipt,
  organizationName,
  locationLabel,
  location = null,
  receiptConfig = {},
}) => {
  const cfg = {
    logoUrl: "",
    headerLines: [],
    footerParagraphs: [],
    thankYouLine: "Thank you for your purchase!",
    termsLine: "",
    showReceiptTitle: true,
    showOrganizationName: true,
    showLocationName: true,
    showLocationAddress: true,
    showLocationPhone: true,
    showTaxId: false,
    showCashier: true,
    showCustomer: true,
    showNotes: true,
    showDeliveryBlock: true,
    customTaxIdLabel: "Tax ID",
    ...receiptConfig,
  };

  const isReturn = receipt.isReturn || false;
  const isExchange = receipt.isExchange || false;
  const isPartialReceipt = hasPartialPaymentSignal(receipt);
  const receiptAmountPaid = toNonNegativeAmount(receipt.amountPaid);
  const receiptBalanceDue = toNonNegativeAmount(receipt.balanceDue);
  const borderColor = isExchange ? "#4f46e5" : isReturn ? "#f97316" : "#000";
  const headerBg = isExchange
    ? "#e0e7ff"
    : isReturn
      ? "#fed7aa"
      : "transparent";
  const titleText = isExchange
    ? "EXCHANGE SLIP"
    : isReturn
      ? "RETURN RECEIPT"
      : "RECEIPT";

  const paymentLines = receipt.payments
    ? receipt.payments
        .map(
          (p) =>
            `<div style="display: flex; justify-content: space-between; margin: 3px 0; font-size: 12px;">
              <span style="text-transform: capitalize;">${p.method}</span>
              <span>$${toNonNegativeAmount(p.amount).toFixed(2)}</span>
            </div>`,
        )
        .join("")
    : "";

  const returnItemLines = isExchange
    ? (receipt.returnItems || [])
        .map(
          (item) =>
            `<div style="margin-bottom: 8px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between;">
                <span>${buildItemDisplayName(item)}</span>
                <span style="color: #f97316;">$${(item.price * item.quantity).toFixed(2)}</span>
              </div>
              <div style="font-size: 11px; color: #666;">Qty: ${item.quantity} × $${item.price.toFixed(2)}</div>
            </div>`,
        )
        .join("")
    : "";

  const exchangeItemLines = isExchange
    ? (receipt.exchangeItems || [])
        .map(
          (item) =>
            `<div style="margin-bottom: 8px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between;">
                <span>${buildItemDisplayName(item)}</span>
                <span style="color: #4f46e5;">$${(item.price * item.quantity).toFixed(2)}</span>
              </div>
              <div style="font-size: 11px; color: #666;">Qty: ${item.quantity} × $${item.price.toFixed(2)}</div>
            </div>`,
        )
        .join("")
    : "";

  const itemLines = isExchange
    ? ""
    : (receipt.items || [])
        .map(
          (item) =>
            `<div style="margin-bottom: 8px; font-size: 12px;">
              <div style="display: flex; justify-content: space-between;">
                <span>${buildItemDisplayName(item)}</span>
                <span ${isReturn ? 'style="color: #f97316;"' : ""}>$${(item.price * item.quantity).toFixed(2)}</span>
              </div>
              <div style="font-size: 11px; color: #666;">Qty: ${item.quantity} × $${item.price.toFixed(2)}</div>
            </div>`,
        )
        .join("");

  const exchangeTotals = isExchange
    ? `<div style="margin-top: 10px; font-size: 12px;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>Return Total:</span>
          <span style="color: #f97316;">$${toNonNegativeAmount(receipt.returnTotal).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
          <span>Exchange Total:</span>
          <span style="color: #4f46e5;">$${toNonNegativeAmount(receipt.exchangeTotal).toFixed(2)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 14px;">
          <span>${
            receipt.netBalance > 0
              ? "CUSTOMER PAYS:"
              : receipt.netBalance < 0
                ? "REFUND DUE:"
                : "BALANCED:"
          }</span>
          <span>$${Math.abs(Number(receipt.netBalance) || 0).toFixed(2)}</span>
        </div>
      </div>`
    : "";

  // Configurable header components
  const logoHtml = cfg.logoUrl
    ? `<div style="text-align: center; margin-bottom: 8px;"><img src="${cfg.logoUrl}" alt="" style="max-width: 180px; max-height: 60px; object-fit: contain;" /></div>`
    : "";

  const locationNameHtml =
    cfg.showLocationName && locationLabel
      ? `<div style="font-size: 12px;">${locationLabel}</div>`
      : "";

  const addressParts = location
    ? [
        location.address?.street,
        location.address?.city,
        location.address?.state,
        location.address?.postalCode,
      ].filter(Boolean)
    : [];
  const addressHtml =
    cfg.showLocationAddress && addressParts.length > 0
      ? `<div style="font-size: 11px;">${addressParts.join(", ")}</div>`
      : "";

  const phoneHtml =
    cfg.showLocationPhone && location?.phone
      ? `<div style="font-size: 11px;">${location.phone}</div>`
      : "";

  const taxIdHtml =
    cfg.showTaxId && location?.taxId
      ? `<div style="font-size: 11px;">${cfg.customTaxIdLabel || "Tax ID"}: ${location.taxId}</div>`
      : "";

  const headerLinesHtml = (cfg.headerLines || [])
    .filter((l) => l && String(l).trim())
    .map((line) => `<div style="font-size: 11px;">${line}</div>`)
    .join("");

  const cashierHtml =
    cfg.showCashier && receipt.cashierName
      ? `<div style="font-size: 11px;">Cashier: ${receipt.cashierName}</div>`
      : "";

  const customerHtml =
    cfg.showCustomer && receipt.customerName
      ? `<div style="font-size: 11px;">Customer: ${receipt.customerName}</div>`
      : "";

  const notesHtml =
    cfg.showNotes && receipt.notes
      ? `<div class="section" style="font-size: 11px;"><strong>Notes:</strong> ${receipt.notes}</div>`
      : "";

  const footerParagraphsHtml = (cfg.footerParagraphs || [])
    .filter((p) => p && String(p).trim())
    .map(
      (para) =>
        `<p style="margin: 6px 0; white-space: pre-line;">${para}</p>`,
    )
    .join("");

  const termsHtml = cfg.termsLine
    ? `<p style="margin: 6px 0; font-size: 10px; color: #888; white-space: pre-line;">${cfg.termsLine}</p>`
    : "";

  const thankYouHtml = cfg.thankYouLine
    ? `<p>${cfg.thankYouLine}</p>`
    : "";

  // Delivery block respects toggle
  const showDelivery =
    cfg.showDeliveryBlock &&
    !isReturn &&
    !isExchange &&
    (receipt.deliveryInfo || toNonNegativeAmount(receipt.deliveryFee) > 0);

  const deliveryHtml = showDelivery
    ? `<div class="section">
        <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">DELIVERY</div>
        ${receipt.deliveryInfo?.recipientName ? `<div style="font-size: 12px; margin-bottom: 3px;"><strong>Recipient:</strong> ${receipt.deliveryInfo.recipientName}</div>` : ""}
        ${receipt.deliveryInfo?.recipientPhone ? `<div style="font-size: 12px; margin-bottom: 3px;"><strong>Phone:</strong> ${receipt.deliveryInfo.recipientPhone}</div>` : ""}
        ${
          receipt.deliveryInfo?.deliveryAddress?.street
            ? `<div style="font-size: 12px; margin-bottom: 3px;"><strong>Address:</strong> ${receipt.deliveryInfo.deliveryAddress.street}${receipt.deliveryInfo.deliveryAddress.city ? ", " + receipt.deliveryInfo.deliveryAddress.city : ""}${receipt.deliveryInfo.deliveryAddress.country ? ", " + receipt.deliveryInfo.deliveryAddress.country : ""}</div>`
            : ""
        }
        ${
          receipt.deliveryInfo?.deliveryCategory
            ? `<div style="font-size: 12px; margin-bottom: 3px;"><strong>Category:</strong> ${receipt.deliveryInfo.deliveryCategory}${receipt.deliveryInfo.deliveryOption ? " — " + receipt.deliveryInfo.deliveryOption : ""}</div>`
            : ""
        }
        ${
          toNonNegativeAmount(receipt.deliveryFee) > 0
            ? `<div style="display: flex; justify-content: space-between; font-size: 12px; margin-top: 4px;"><span>Delivery Fee:</span><span>$${toNonNegativeAmount(receipt.deliveryFee).toFixed(2)}</span></div>`
            : ""
        }
      </div>`
    : "";

  return `
    <html>
      <head>
        <title>${titleText} #${receipt.receiptNumber}</title>
        <style>
          body { font-family: monospace; max-width: 400px; margin: auto; padding: 20px; background: white; }
          .receipt { border: 1px solid #ddd; padding: 20px; }
          .header { text-align: center; border-bottom: 2px dashed ${borderColor}; padding-bottom: 10px; margin-bottom: 10px; background: ${headerBg}; padding: 10px; }
          .section { margin: 15px 0; border-bottom: 1px dashed #ccc; padding-bottom: 10px; }
          .section:last-child { border-bottom: none; }
          .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 10px; ${isReturn ? "color: #f97316;" : ""} }
          .footer { text-align: center; font-size: 11px; color: #666; margin-top: 15px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            ${logoHtml}
            ${cfg.showReceiptTitle ? `<h3 style="margin: 0; ${isReturn ? "color: #f97316;" : ""}">${titleText}</h3>` : ""}
            ${cfg.showOrganizationName ? `<h3 style="margin: 0;">${organizationName || "RECEIPT"}</h3>` : ""}
            ${locationNameHtml}
            ${addressHtml}
            ${phoneHtml}
            ${taxIdHtml}
            ${headerLinesHtml}
            <p style="margin: 5px 0; font-size: 12px;">Receipt #${receipt.receiptNumber || ""}</p>
            ${(isReturn || isExchange) && receipt.originalReceiptNumber ? `<p style="margin: 5px 0; font-size: 12px;">Original: ${receipt.originalReceiptNumber}</p>` : ""}
            <p style="margin: 5px 0; font-size: 11px;">${new Date(receipt.timestamp).toLocaleString()}</p>
            ${cashierHtml}
            ${customerHtml}
            ${isPartialReceipt ? `<p style="margin: 6px 0 0; font-size: 11px; font-weight: bold; color: #b45309;">PARTIAL PAYMENT</p>` : ""}
          </div>

          ${
            isExchange
              ? `<div class="section">
                  <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">RETURNED ITEMS</div>
                  ${returnItemLines}
                </div>
                <div class="section">
                  <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">EXCHANGE ITEMS</div>
                  ${exchangeItemLines}
                </div>`
              : `<div class="section">
                  <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">${isReturn ? "RETURNED ITEMS" : "ITEMS"}</div>
                  ${itemLines}
                </div>`
          }

          ${
            (!isReturn || isExchange) && paymentLines
              ? `<div class="section">
                  <div style="font-weight: bold; margin-bottom: 8px; font-size: 12px;">PAYMENT</div>
                  ${paymentLines}
                </div>`
              : ""
          }

          ${
            (isReturn || isExchange) && receipt.returnReason
              ? `<div class="section" style="font-size: 11px;"><strong>Return Reason:</strong> ${receipt.returnReason.replace(/-/g, " ").toUpperCase()}</div>`
              : ""
          }

          ${deliveryHtml}

          ${
            isExchange
              ? exchangeTotals
              : isReturn
                ? `<div class="total">
                    <span>REFUND TOTAL:</span>
                    <span>$${toNonNegativeAmount(receipt.subtotal).toFixed(2)}</span>
                  </div>`
                : `<div class="section" style="margin-top: 10px; font-size: 12px;">
                    ${toNonNegativeAmount(receipt.deliveryFee) > 0 ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Subtotal:</span><span>$${toNonNegativeAmount(receipt.subtotal).toFixed(2)}</span></div><div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Delivery Fee:</span><span>$${toNonNegativeAmount(receipt.deliveryFee).toFixed(2)}</span></div>` : ""}
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-weight: bold; font-size: 14px;">
                      <span>TOTAL:</span>
                      <span>$${(toNonNegativeAmount(receipt.subtotal) + toNonNegativeAmount(receipt.deliveryFee)).toFixed(2)}</span>
                    </div>
                    ${
                      isPartialReceipt
                        ? `<div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>AMOUNT PAID:</span><span>$${receiptAmountPaid.toFixed(2)}</span></div>
                          <div style="display: flex; justify-content: space-between;"><span>BALANCE DUE:</span><span>$${receiptBalanceDue.toFixed(2)}</span></div>`
                        : ""
                    }
                  </div>`
          }

          ${notesHtml}

          <div class="footer">
            ${footerParagraphsHtml}
            ${termsHtml}
            ${thankYouHtml}
          </div>
        </div>
      </body>
    </html>
  `;
};