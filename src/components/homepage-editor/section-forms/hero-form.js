"use client";

import SingleImageUploader from "@/components/collections/SingleImageUploader";

export function HeroForm({ config, onChange }) {
  const update = (field, value) => {
    onChange({ ...config, [field]: value });
  };

  const imageValue =
    config.imageUrl && typeof config.imageUrl === "string"
      ? { url: config.imageUrl, alt: "", shopifyFileId: null }
      : null;

  const mobileImageValue =
    config.imageUrlMobile && typeof config.imageUrlMobile === "string"
      ? { url: config.imageUrlMobile, alt: "", shopifyFileId: null }
      : null;

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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Button label
          </label>
          <input
            type="text"
            value={config.ctaLabel || ""}
            onChange={(e) => update("ctaLabel", e.target.value)}
            maxLength={40}
            placeholder="Shop now"
            className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Button link
          </label>
          <input
            type="text"
            value={config.ctaHref || ""}
            onChange={(e) => update("ctaHref", e.target.value)}
            maxLength={300}
            placeholder="/products"
            className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">
          Text alignment
        </label>
        <div className="flex gap-2">
          {["left", "center", "right"].map((align) => (
            <button
              key={align}
              type="button"
              onClick={() => update("align", align)}
              className={`rounded-md border px-3 py-1.5 text-sm capitalize ${
                (config.align || "left") === align
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-300 hover:bg-gray-50"
              }`}
            >
              {align}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={config.fullHeight === true}
            onChange={(e) => update("fullHeight", e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          Full viewport height on desktop
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Makes the hero fill most of the screen. Best for image-heavy heroes.
        </p>
      </div>

      <SingleImageUploader
        label="Background image (desktop)"
        value={imageValue}
        onChange={(img) => update("imageUrl", img?.url || "")}
      />

      <div>
        <SingleImageUploader
          label="Background image (mobile)"
          value={mobileImageValue}
          onChange={(img) => update("imageUrlMobile", img?.url || "")}
        />
        <p className="mt-1 text-xs text-gray-500">
          Optional. If not set, the desktop image is used on mobile.
        </p>
      </div>
    </div>
  );
}