"use client";

const SECTION_TYPES = [
  {
    type: "hero",
    label: "Hero",
    description: "Heading, subheading, image, and a call-to-action button.",
  },
  {
    type: "featured-products",
    label: "Featured products",
    description: "A grid of hand-picked or latest products.",
  },
  {
    type: "collection",
    label: "Collection",
    description: "Products from a specific collection.",
  },
  {
    type: "rich-text",
    label: "Rich text",
    description: "A heading and body text. Good for About or policies.",
  },
  {
    type: "trust-strip",
    label: "Trust strip",
    description: "Three or four small value propositions.",
  },
  {
    type: "banner",
    label: "Banner",
    description: "A full-width promotional image with an optional link.",
  },
    {
    type: "featured-category",
    label: "Featured categories",
    description: "A grid of up to 6 collection cards with images.",
  },
  {
    type: "image-text",
    label: "Image + text",
    description: "Side-by-side image and text block. Good for storytelling.",
  },
  {
    type: "announcement",
    label: "Announcement",
    description: "A single-line inline banner. Good for hours, promos, notices.",
  },
];

const DEFAULT_CONFIGS = {
  hero: {
    heading: "Welcome",
    subheading: "",
    ctaLabel: "",
    ctaHref: "",
    imageUrl: "",
    align: "left",
  },
  "featured-products": {
    heading: "Featured products",
    subheading: "",
    mode: "latest",
    productIds: [],
    limit: 8,
  },
  collection: {
    heading: "",
    subheading: "",
    collectionSlug: "",
    limit: 8,
  },
  "rich-text": { heading: "", body: "" },
  "trust-strip": {
    items: [
      { title: "Fast delivery", body: "" },
      { title: "Secure checkout", body: "" },
      { title: "Easy returns", body: "" },
    ],
  },
  banner: { imageUrl: "", href: "", alt: "" },
    "featured-category": {
    heading: "Shop by category",
    subheading: "",
    categorySlugs: [],
  },
  "image-text": {
    heading: "",
    subheading: "",
    body: "",
    imageUrl: "",
    imageUrlMobile: "",
    imagePosition: "left",
    ctaLabel: "",
    ctaHref: "",
  },
  announcement: {
    text: "",
    href: "",
    tone: "muted",
  },
};

function generateId() {
  // Browser-safe UUID-ish. Sufficient for uniqueness within a homepage.
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function AddSectionModal({ onClose, onSelect }) {
  const handlePick = (type) => {
    onSelect({
      id: generateId(),
      type,
      config: { ...DEFAULT_CONFIGS[type] },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Add a section
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SECTION_TYPES.map((s) => (
              <button
                key={s.type}
                type="button"
                onClick={() => handlePick(s.type)}
                className="rounded-lg border border-gray-200 bg-white p-4 text-left transition hover:border-indigo-400 hover:bg-indigo-50"
              >
                <p className="text-sm font-medium text-gray-900">
                  {s.label}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {s.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-3 flex justify-end bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}