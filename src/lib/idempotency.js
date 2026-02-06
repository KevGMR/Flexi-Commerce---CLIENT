export function buildSaleIdempotencyKey({ organizationId, locationId }) {
  const parts = [
    "pos",
    organizationId || "org",
    locationId || "loc",
    Date.now(),
    Math.random().toString(36).slice(2, 11),
  ];
  return parts.join("-");
}
