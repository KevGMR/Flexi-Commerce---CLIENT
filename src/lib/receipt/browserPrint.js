import { buildReceiptPrintHtml } from "@/lib/receipt/receiptPrintTemplate";

export const printReceiptInBrowser = ({
  receipt,
  organizationName,
  locationLabel,
  location = null,
  receiptConfig = {},
}) => {
  if (!receipt) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = buildReceiptPrintHtml({
    receipt,
    organizationName,
    locationLabel,
    location,
    receiptConfig,
  });

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
};