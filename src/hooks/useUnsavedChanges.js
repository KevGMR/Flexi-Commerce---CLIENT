"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Tracks an "is dirty" flag and blocks navigation while set.
 *
 * Two layers:
 *  - `beforeunload`: intercepts tab close, refresh, hard nav. Native browser dialog.
 *  - click interception on <a> tags: intercepts in-app navigation. Calls `onBlocked`,
 *    which the consumer uses to show a custom modal.
 *
 * Usage:
 *   const { markDirty, clearDirty, confirmDiscard } = useUnsavedChanges({
 *     onBlocked: (proceed) => setShowDiscardModal(proceed),
 *   });
 *
 *   // when the modal's "Discard" button is clicked:
 *   confirmDiscard(() => router.push("/somewhere"));
 */
export function useUnsavedChanges({ onBlocked } = {}) {
  const dirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const pendingNavRef = useRef(null);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setIsDirty(true);
    }
  }, []);

  const clearDirty = useCallback(() => {
    dirtyRef.current = false;
    setIsDirty(false);
  }, []);

  // Browser-level: tab close, refresh, hard back
  useEffect(() => {
    const handler = (e) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // In-app <a> click interception
  useEffect(() => {
    const handler = (e) => {
      if (!dirtyRef.current) return;
      // Only intercept plain left-clicks
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (e.defaultPrevented) return;

      const anchor = e.target?.closest?.("a[href]");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      // External URLs: let the browser handle, but beforeunload will catch it
      try {
        const url = new URL(anchor.href, window.location.origin);
        if (url.origin !== window.location.origin) return;
      } catch {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const proceed = () => {
        clearDirty();
        window.location.assign(anchor.href);
      };
      pendingNavRef.current = proceed;

      if (onBlocked) onBlocked(proceed);
    };

    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [clearDirty, onBlocked]);

  /**
   * Called by the consumer when the user confirms discard.
   * Runs the stored navigation callback if there is one.
   */
  const confirmDiscard = useCallback(
    (overrideAction) => {
      clearDirty();
      if (overrideAction) {
        overrideAction();
        return;
      }
      const action = pendingNavRef.current;
      pendingNavRef.current = null;
      if (action) action();
    },
    [clearDirty],
  );

  const cancelDiscard = useCallback(() => {
    pendingNavRef.current = null;
  }, []);

  return {
    isDirty,
    markDirty,
    clearDirty,
    confirmDiscard,
    cancelDiscard,
  };
}