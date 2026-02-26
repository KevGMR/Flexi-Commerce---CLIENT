import { useEffect, useMemo, useRef, useState } from "react";

const MIN_QUERY_LENGTH = 3;

function mapNominatimSuggestion(item) {
  const address = item?.address || {};
  const streetName =
    address.road ||
    address.pedestrian ||
    address.footway ||
    address.path ||
    address.residential ||
    "";
  const street = [address.house_number, streetName].filter(Boolean).join(" ").trim();

  return {
    id: String(item?.place_id || item?.osm_id || item?.display_name || Math.random()),
    label: item?.display_name || "",
    street,
    city:
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.municipality ||
      "",
    state: address.state || address.region || address.county || "",
    postalCode: address.postcode || "",
    country: address.country || "",
  };
}

export function useAddressAutocomplete(query, { enabled = true, limit = 5 } = {}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef(null);

  const normalizedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return;
    }

    if (normalizedQuery.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      setError("");
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        if (abortRef.current) {
          abortRef.current.abort();
        }

        const controller = new AbortController();
        abortRef.current = controller;

        setLoading(true);
        setError("");

        const params = new URLSearchParams({
          q: normalizedQuery,
          format: "jsonv2",
          addressdetails: "1",
          limit: String(limit),
          dedupe: "1",
        });

        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Unable to fetch address suggestions.");
        }

        const payload = await response.json();
        const mapped = Array.isArray(payload) ? payload.map(mapNominatimSuggestion) : [];
        setSuggestions(mapped.filter((item) => item.label));
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        setSuggestions([]);
        setError(err?.message || "Unable to fetch address suggestions.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [enabled, limit, normalizedQuery]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return {
    suggestions,
    loading,
    error,
    minQueryLength: MIN_QUERY_LENGTH,
  };
}
