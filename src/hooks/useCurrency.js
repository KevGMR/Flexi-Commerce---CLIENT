"use client";
import { useSessionStore } from "@/store/session";

export function useCurrency(locationId = null) {
  const activeOrganization = useSessionStore((s) => s.activeOrganization);
  const locationsMeta = useSessionStore((s) => s.locationsMeta);

  const orgCurrency =
    activeOrganization?.settings?.currency ||
    activeOrganization?.currency ||
    "KES";

  if (locationId && Array.isArray(locationsMeta)) {
    const loc = locationsMeta.find(
      (l) => String(l._id || l.id) === String(locationId),
    );
    if (loc?.currency) return String(loc.currency).toUpperCase();
  }

  return String(orgCurrency).toUpperCase();
}