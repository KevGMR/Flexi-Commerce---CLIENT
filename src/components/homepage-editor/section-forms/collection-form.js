"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function CollectionForm({ config, onChange }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/collections?limit=500")
      .then((data) => {
        setCollections(data?.collections || []);
      })
      .catch(() => setCollections([]))
      .finally(() => setLoading(false));
  }, []);

  const update = (field, value) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Heading
        </label>
        <input
          type="text"
          value={config.heading || ""}
          onChange={(e) => update("heading", e.target.value)}
          maxLength={120}
          placeholder="Leave blank to use the collection's name"
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Subheading
        </label>
        <input
          type="text"
          value={config.subheading || ""}
          onChange={(e) => update("subheading", e.target.value)}
          maxLength={240}
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Collection
        </label>
        <select
          value={config.collectionSlug || ""}
          onChange={(e) => update("collectionSlug", e.target.value)}
          disabled={loading}
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
        >
          <option value="">
            {loading ? "Loading…" : "Choose a collection…"}
          </option>
          {collections.map((c) => (
            <option key={c._id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        {!loading && collections.length === 0 && (
          <p className="mt-1 text-xs text-gray-500">
            No collections yet. Create one under Products → Collections.
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Maximum shown
        </label>
        <input
          type="number"
          value={config.limit ?? 8}
          onChange={(e) =>
            update("limit", Math.max(1, Math.min(24, Number(e.target.value) || 8)))
          }
          min={1}
          max={24}
          className="block w-24 rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>
    </div>
  );
}