import React from "react";

export default function LineActions({ index, onRemove, disabled }) {
  return (
    <div className="ml-3 flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (onRemove) onRemove(index);
        }}
        disabled={disabled}
        className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
      >
        Remove
      </button>
    </div>
  );
}
