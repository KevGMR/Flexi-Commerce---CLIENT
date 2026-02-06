"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { navItems } from "@/lib/nav";
import { useSessionStore } from "@/store/session";

function NavLink({ item, depth = 0, isActive }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center justify-between rounded-md px-3 py-2 text-[11px] font-medium transition hover:bg-zinc-100 ${
        isActive ? "bg-zinc-200 text-zinc-900" : "text-zinc-700"
      }`}
      style={{ paddingLeft: 12 + depth * 12 }}
    >
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const can = useSessionStore((s) => s.can);
  const hydrated = useSessionStore((s) => s.hydrated);
  const [expandedParent, setExpandedParent] = useState(null);
  const [touchStart, setTouchStart] = useState(null);
  const sidebarRef = useRef(null);

  // Split settings out so it can be pinned at the bottom
  const mainNavItems = navItems.filter((item) => item.label !== "Settings");
  const settingsNav = navItems.find((item) => item.label === "Settings");

  // Check if any child path is currently active
  const isChildActive = (item) => {
    if (!item.children) return false;
    return item.children.some((child) => pathname === child.href);
  };

  const autoExpandedParent = useMemo(() => {
    const findParentForPath = (items) => {
      for (const item of items) {
        if (pathname === item.href && item.children?.length) return item.href;
        if (item.children?.some((child) => pathname === child.href))
          return item.href;
        if (item.children) {
          const nested = findParentForPath(item.children);
          if (nested) return nested;
        }
      }
      return null;
    };

    return findParentForPath(navItems);
  }, [pathname]);

  // Handle escape key to close sidebar on mobile
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Handle swipe to close
  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const swipeDistance = touchStart - touchEnd;

    // Swiped left > 50px
    if (swipeDistance > 50) {
      onClose?.();
    }
    setTouchStart(null);
  };

  const renderItems = (items, depth = 0, parentHref = null) =>
    items
      .filter((item) => {
        // Don't filter by permissions until session is hydrated
        if (!hydrated) return true;
        return !item.permission || can(item.permission);
      })
      .map((item) => {
        // Render section headings
        if (item.isSection) {
          return (
            <div
              key={item.label}
              className="mt-4 pt-3 px-3 text-[10px] font-semibold uppercase text-zinc-500"
            >
              {item.label}
            </div>
          );
        }

        const isActive = pathname === item.href;
        const hasChildren = item.children && item.children.length > 0;
        const childActive = isChildActive(item);
        const isExpanded =
          expandedParent === item.href ||
          childActive ||
          autoExpandedParent === item.href; // Auto-expand if child is active

        return (
          <div key={item.href} className="space-y-1">
            <div
              onClick={() => {
                if (hasChildren && !isExpanded) {
                  setExpandedParent(item.href);
                }
                if (!hasChildren) {
                  // Clicking a leaf collapses other parents unless this item is under a parent
                  if (parentHref) {
                    setExpandedParent(parentHref);
                  } else {
                    setExpandedParent(null);
                  }
                }
              }}
            >
              <NavLink item={item} depth={depth} isActive={isActive} />
            </div>
            {hasChildren &&
              isExpanded &&
              renderItems(item.children, depth + 1, item.href)}
          </div>
        );
      });

  return (
    <aside
      ref={sidebarRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={`fixed md:sticky top-0 md:top-16 left-0 z-40 flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-zinc-200 bg-white px-3 py-4 transform transition-transform duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      <nav className="space-y-1 overflow-y-auto pb-4">
        {renderItems(mainNavItems)}
      </nav>
      {settingsNav ? (
        <div className="mt-auto pt-3 border-t border-zinc-200">
          <nav className="space-y-1">{renderItems([settingsNav])}</nav>
        </div>
      ) : null}
    </aside>
  );
}
