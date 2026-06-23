"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function Modal({ isOpen, onClose, title, children, className = "", backdropClassName = "bg-black/40", ariaLabel }) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${className}`} role="dialog" aria-modal="true" aria-label={ariaLabel || title}>
      <div className={`absolute inset-0 bg-black/50`} onClick={() => onClose?.()} />
      <div className="relative w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl">
        {title && (
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
            <button onClick={() => onClose?.()} aria-label="Close dialog" className="ml-4 rounded p-1 text-zinc-500 hover:bg-zinc-100">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-4 overflow-auto">{children}</div>
      </div>
    </div>,
    document.body
  );
}
