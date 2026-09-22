import { buildReceiptPrintHtml } from "@/lib/receipt/receiptPrintTemplate";

export const printReceiptInBrowser = ({
  receipt,
  organizationName,
  locationLabel,
}) => {
  if (!receipt) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const html = buildReceiptPrintHtml({
    receipt,
    organizationName,
    locationLabel,
  });

  printWindow.document.write(html);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 250);
};
