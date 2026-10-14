"use client";

export function RichTextForm({ config, onChange }) {
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
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Body
        </label>
        <textarea
          value={config.body || ""}
          onChange={(e) => update("body", e.target.value)}
          rows={8}
          maxLength={4000}
          placeholder="Plain text. Line breaks are preserved."
          className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <p className="mt-1 text-xs text-gray-500">
          {(config.body || "").length}/4000 characters
        </p>
      </div>
    </div>
  );
}