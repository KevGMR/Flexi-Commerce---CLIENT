"use client";

export function TrustStripForm({ config, onChange }) {
  const items = Array.isArray(config.items) ? config.items : [];

  const updateItem = (index, field, value) => {
    const next = items.map((it, i) =>
      i === index ? { ...it, [field]: value } : it,
    );
    onChange({ ...config, items: next });
  };

  const addItem = () => {
    if (items.length >= 4) return;
    onChange({
      ...config,
      items: [...items, { title: "", body: "" }],
    });
  };

  const removeItem = (index) => {
    onChange({
      ...config,
      items: items.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Up to four value propositions shown side by side.
      </p>

      {items.map((item, index) => (
        <div
          key={index}
          className="rounded-md border border-gray-200 p-3 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">
              Item {index + 1}
            </span>
            <button
              type="button"
              onClick={() => removeItem(index)}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Remove
            </button>
          </div>
          <input
            type="text"
            value={item.title || ""}
            onChange={(e) => updateItem(index, "title", e.target.value)}
            maxLength={80}
            placeholder="Title (e.g. Fast delivery)"
            className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="text"
            value={item.body || ""}
            onChange={(e) => updateItem(index, "body", e.target.value)}
            maxLength={240}
            placeholder="Short description"
            className="block w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
      ))}

      {items.length < 4 && (
        <button
          type="button"
          onClick={addItem}
          className="text-sm text-indigo-600 hover:text-indigo-700"
        >
          + Add item
        </button>
      )}
    </div>
  );
}