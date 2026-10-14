"use client";

import SingleImageUploader from "@/components/collections/SingleImageUploader";

export function BannerForm({ config, onChange }) {
  const update = (field, value) => {
    onChange({ ...config, [field]: value });
  };

  const imageValue =
    config.imageUrl && typeof config.imageUrl === "string"
      ? { url: config.imageUrl, alt: config.alt || "", shopifyFileId: null }
      : null;

  const mobileImageValue =
    config.imageUrlMobile && typeof config.imageUrlMobile === "string"
      ? { url: config.imageUrlMobile, alt: "", shopifyFileId: null }
      : null;

  return (
    <div className="space-y-4">
      <SingleImageUploader
        label="Banner image (desktop)"
        value={imageValue}
        onChange={(img) => update("imageUrl", img?.url || "")}
      />

      <div>
        <SingleImageUploader
          label="Banner image (mobile)"
          value={mobileImageValue}
          onChange={(img) => update("imageUrlMobile", img?.url || "")}
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional. Portrait or square works best for mobile.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Alt text
        </label>
        <input
          type="text"
          value={config.alt || ""}
          onChange={(e) => update("alt", e.target.value)}
          maxLength={120}
          placeholder="Describe the image for accessibility"
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Link (optional)
        </label>
        <input
          type="text"
          value={config.href || ""}
          onChange={(e) => update("href", e.target.value)}
          maxLength={300}
          placeholder="/collection/sale"
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>
    </div>
  );
}