export function formatCurrency(amount, currency = "KES", locale) {
  const n = Number(amount) || 0;
  const safeCurrency = String(currency || "KES").toUpperCase();
  // Locale derived from currency so Intl picks the right symbol/grouping.
  // KES -> en-KE renders "Ksh 5,500.00"; USD -> en-US renders "$5,500.00".
  const resolvedLocale =
    locale ||
    {
      KES: "en-KE",
      USD: "en-US",
      EUR: "en-IE",
      GBP: "en-GB",
      NGN: "en-NG",
      UGX: "en-UG",
      TZS: "en-TZ",
      ZAR: "en-ZA",
    }[safeCurrency] ||
    "en-US";

  try {
    return new Intl.NumberFormat(resolvedLocale, {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${safeCurrency} ${n.toFixed(2)}`;
  }
}   