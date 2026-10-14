"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";

export function FeaturedCategoryForm({ config, onChange }) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/collections?limit=500")
      .then((data) => setCollections(data?.collections || []))
      .catch(() => setCollections([]))
      .finally(() => setLoading(false));
  }, []);

  const update = (field, value) => {
    onChange({ ...config, [field]: value });
  };

  const slugs = Array.isArray(config.categorySlugs)
    ? config.categorySlugs
    : [];

  const toggle = (slug) => {
    if (slugs.includes(slug)) {
      update(
        "categorySlugs",
        slugs.filter((s) => s !== slug),
      );
    } else if (slugs.length < 6) {
      update("categorySlugs", [...slugs, slug]);
    }
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
          placeholder="Shop by category"
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
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Featured collections ({slugs.length}/6)
        </label>
        {loading ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : collections.length === 0 ? (
          <p className="text-xs text-gray-500">
            No collections yet. Create one under Products → Collections.
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto border border-gray-200 rounded-md p-2">
            {collections.map((c) => {
              const checked = slugs.includes(c.slug);
              const disabled = !checked && slugs.length >= 6;
              return (
                <label
                  key={c._id}
                  className={`flex items-center gap-2 p-1.5 rounded text-sm ${
                    disabled
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(c.slug)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                  />
                  <span className="text-gray-900">{c.name}</span>
                  {c.productCount != null && (
                    <span className="text-xs text-gray-500 ml-auto">
                      {c.productCount} products
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}
        <p className="mt-1 text-xs text-gray-500">
          Selected collections are shown in the order listed above.
        </p>
      </div>
    </div>
  );
}