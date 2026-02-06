"use client";

import { useEffect, useRef, useState, cloneElement } from "react";

export function Dropdown({
  children,
  trigger,
  align = "left",
  onClose,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Click outside handler
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        onClose?.();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
        onClose?.();
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen, onClose]);

  const alignClass = align === "right" ? "right-0" : "left-0";

  return (
    <div ref={dropdownRef} className="relative">
      {cloneElement(trigger, {
        onClick: () => {
          setIsOpen(!isOpen);
          if (isOpen) onClose?.();
        },
      })}

      {isOpen && (
        <div
          className={`absolute top-full mt-2 ${alignClass} w-60 bg-white rounded-lg shadow-lg border border-zinc-200 z-50 transition-opacity duration-200 opacity-100`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
