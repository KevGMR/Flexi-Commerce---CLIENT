"use client";

import { useState } from "react";

export function AnnouncementSection({ website, onSave, saving, canEdit = true }) {
  const [text, setText] = useState(website?.announcement?.text || "");
  const [href, setHref] = useState(website?.announcement?.href || "");
  const [isActive, setIsActive] = useState(
    website?.announcement?.isActive !== false,
  );

  const dirty =
    text !== (website?.announcement?.text || "") ||
    href !== (website?.announcement?.href || "") ||
    isActive !== (website?.announcement?.isActive !== false);

  const handleSave = () => {
    onSave({
      announcement: {
        text: text.trim(),
        href: href.trim(),
        isActive,
      },
    });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          Announcement bar
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          A thin bar shown above the header on every page of your storefront.
          Use it for delivery notices, hours, or short promos.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900">
            Text
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={200}
            placeholder="e.g. Free delivery in Nairobi on orders over KES 5,000"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            {text.length}/200 — keep it short so it fits on one line.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900">
            Link (optional)
          </label>
          <input
            type="text"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/shipping"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Start with <code>/</code> for internal pages, or <code>https://</code>{" "}
            for external.
          </p>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-900">
            Show the announcement bar
          </span>
        </label>

        {text && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
              Preview
            </p>
            <div className="rounded-sm bg-brand text-white">
              <div className="flex h-8 items-center justify-center px-4 text-[11px] font-medium uppercase tracking-[0.12em]">
                <span className="inline-flex items-center gap-1.5">
                  {text}
                  {href && <span className="opacity-80">→</span>}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

        {canEdit && (
        <div className="mt-6 flex justify-end gap-2">
            <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
            {saving ? "Saving…" : dirty ? "Save announcement" : "Saved"}
            </button>
        </div>
        )}
      
    </div>
  );
}