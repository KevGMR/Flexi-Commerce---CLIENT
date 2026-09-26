"use client";

export default function DiscardChangesModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Discard changes?
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          You have unsaved changes on this product. If you leave now, they
          will be lost.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 text-sm font-medium"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}