"use client";

export default function VariantImagePicker({
  productImages = [],
  current,
  onPick,
  onClear,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Choose variant image
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {productImages.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No product images yet. Upload images in the Media section first.
          </p>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {productImages.map((img, idx) => {
              const isCurrent = current?.url && current.url === img.url;
              return (
                <button
                  key={img.shopifyFileId || img.url || idx}
                  type="button"
                  onClick={() => onPick(img)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${
                    isCurrent
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-gray-200 hover:border-blue-400"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt || ""}
                    className="w-full h-full object-cover"
                  />
                  {isCurrent && (
                    <div className="absolute top-2 right-2 px-2 py-0.5 text-[10px] font-semibold bg-blue-600 text-white rounded-full">
                      Current
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={onClear}
            disabled={!current}
            className="px-4 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium disabled:opacity-40"
          >
            Clear variant image
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}