"use client";

export function AnnouncementForm({ config, onChange }) {
  const update = (patch) => onChange({ ...config, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-900">
          Text
        </label>
        <input
          type="text"
          value={config.text || ""}
          onChange={(e) => update({ text: e.target.value })}
          placeholder="e.g. Free delivery over KES 5,000"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Keep it short — one line reads best.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900">
          Link (optional)
        </label>
        <input
          type="text"
          value={config.href || ""}
          onChange={(e) => update({ href: e.target.value })}
          placeholder="/shipping"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-900">
          Tone
        </label>
        <select
          value={config.tone || "muted"}
          onChange={(e) => update({ tone: e.target.value })}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="muted">Muted (grey background)</option>
          <option value="ink">Ink (black background)</option>
          <option value="brand">Brand (uses your brand color)</option>
        </select>
      </div>
    </div>
  );
}