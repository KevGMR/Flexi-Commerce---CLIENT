"use client";

import { useState } from "react";
import { HeroForm } from "./section-forms/hero-form";
import { FeaturedProductsForm } from "./section-forms/featured-products-form";
import { CollectionForm } from "./section-forms/collection-form";
import { RichTextForm } from "./section-forms/rich-text-form";
import { TrustStripForm } from "./section-forms/trust-strip-form";
import { BannerForm } from "./section-forms/banner-form";
import { FeaturedCategoryForm } from "./section-forms/featured-category-form";
import { ImageTextForm } from "./section-forms/image-text-form";

const TYPE_LABELS = {
  hero: "Hero",
  "featured-products": "Featured products",
  collection: "Collection",
  "rich-text": "Rich text",
  "trust-strip": "Trust strip",
  banner: "Banner",
  "featured-category": "Featured categories",
  "image-text": "Image + text",
};

export function SectionList({ sections, orgId, onUpdate, onRemove, onMove }) {
  const [expandedId, setExpandedId] = useState(
    sections.length > 0 ? sections[0].id : null,
  );

  return (
    <div className="space-y-3">
      {sections.map((section, index) => {
        const expanded = expandedId === section.id;
        return (
          <div
            key={section.id}
            className="rounded-lg border border-gray-200 bg-white overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <button
                type="button"
                onClick={() =>
                  setExpandedId(expanded ? null : section.id)
                }
                className="flex items-center gap-2 text-left flex-1 min-w-0"
              >
                <svg
                  className={`h-4 w-4 text-gray-500 transition-transform ${
                    expanded ? "rotate-90" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {TYPE_LABELS[section.type] || section.type}
                </span>
                {section.config?.heading && (
                  <span className="text-xs text-gray-500 truncate">
                    — {section.config.heading}
                  </span>
                )}
              </button>

              <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onMove(section.id, "up")}
                  disabled={index === 0}
                  className="p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                  title="Move up"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => onMove(section.id, "down")}
                  disabled={index === sections.length - 1}
                  className="p-1.5 text-gray-500 hover:text-gray-900 disabled:opacity-30"
                  title="Move down"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        `Remove this ${TYPE_LABELS[section.type]} section?`,
                      )
                    ) {
                      onRemove(section.id);
                    }
                  }}
                  className="p-1.5 text-red-500 hover:text-red-700"
                  title="Remove"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {expanded && (
              <div className="p-4">
                <SectionForm
                  section={section}
                  orgId={orgId}
                  onChange={(next) => onUpdate(section.id, next)}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionForm({ section, orgId, onChange }) {
  const props = {
    config: section.config || {},
    onChange: (config) => onChange({ ...section, config }),
    orgId,
  };

  switch (section.type) {
    case "hero":
      return <HeroForm {...props} />;
    case "featured-products":
      return <FeaturedProductsForm {...props} />;
    case "collection":
      return <CollectionForm {...props} />;
    case "rich-text":
      return <RichTextForm {...props} />;
    case "trust-strip":
      return <TrustStripForm {...props} />;
    case "banner":
      return <BannerForm {...props} />;
    case "featured-category":
      return <FeaturedCategoryForm {...props} />;
    case "image-text":
      return <ImageTextForm {...props} />;
    default:
      return (
        <p className="text-sm text-red-600">
          Unknown section type: {section.type}
        </p>
      );
  }
}