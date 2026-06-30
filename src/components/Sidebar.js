"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { navItems } from "@/lib/nav";
import { useSessionStore } from "@/store/session";

// Import icons from @heroicons/react/24/outline
import {
  HomeIcon,
  ShoppingBagIcon,
  DocumentTextIcon,
  ShoppingCartIcon,
  CubeIcon,
  WrenchIcon,
  FolderIcon,
  ClipboardIcon,
  ArrowsRightLeftIcon,
  GiftIcon,
  UsersIcon,
  ChartBarIcon,
  BanknotesIcon,
  ListBulletIcon,
  PlusCircleIcon,
  TruckIcon,
  UserIcon,
  CreditCardIcon,
  ComputerDesktopIcon,
  ClockIcon,
  ReceiptRefundIcon,
  CurrencyDollarIcon, // FIXED: CoinsIcon → CurrencyDollarIcon
  CogIcon,
  EnvelopeIcon,
  MapPinIcon,
  TagIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

// Map icon names to components
const iconMap = {
  Home: HomeIcon,
  ShoppingBag: ShoppingBagIcon,
  DocumentText: DocumentTextIcon,
  ShoppingCart: ShoppingCartIcon,
  Cube: CubeIcon,
  Wrench: WrenchIcon,
  Folder: FolderIcon,
  Clipboard: ClipboardIcon,
  ArrowsRightLeft: ArrowsRightLeftIcon,
  Gift: GiftIcon,
  Users: UsersIcon,
  ChartBar: ChartBarIcon,
  Banknotes: BanknotesIcon,
  ListBullet: ListBulletIcon,
  PlusCircle: PlusCircleIcon,
  Truck: TruckIcon,
  User: UserIcon,
  CreditCard: CreditCardIcon,
  ComputerDesktop: ComputerDesktopIcon,
  Clock: ClockIcon,
  ReceiptRefund: ReceiptRefundIcon,
  CurrencyDollar: CurrencyDollarIcon, // FIXED: Coins → CurrencyDollar
  Cog: CogIcon,
  Envelope: EnvelopeIcon,
  MapPin: MapPinIcon,
  Tag: TagIcon,
  ShieldCheck: ShieldCheckIcon,
};

function NavLink({ item, depth = 0, isActive, collapsed }) {
  const IconComponent = iconMap[item.icon];

  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 rounded-md px-3 py-2 text-[11px] font-medium transition hover:bg-zinc-100 ${
        isActive ? "bg-zinc-200 text-zinc-900" : "text-zinc-700"
      } ${collapsed ? "justify-center" : ""}`}
      style={{ paddingLeft: collapsed ? 12 : 12 + depth * 12 }}
      title={collapsed ? item.label : ""}
    >
      {IconComponent && <IconComponent className="h-5 w-5 flex-shrink-0" />}
      {!collapsed && <span className="truncate">{item.label}</span>}
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
  const [isHovered, setIsHovered] = useState(false);

  const mainNavItems = navItems.filter((item) => item.label !== "Settings");
  const settingsNav = navItems.find((item) => item.label === "Settings");

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

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose?.();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const handleTouchStart = (e) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const swipeDistance = touchStart - touchEnd;

    if (swipeDistance > 50) {
      onClose?.();
    }
    setTouchStart(null);
  };

  const renderItems = (items, depth = 0, parentHref = null, collapsed = false) =>
    items
      .filter((item) => {
        if (!hydrated) return true;
        return !item.permission || can(item.permission);
      })
      .map((item) => {
        if (item.isSection) {
          if (collapsed) return null;
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
          autoExpandedParent === item.href;

        return (
          <div key={item.href} className="space-y-1">
            <div
              onClick={() => {
                if (hasChildren && !isExpanded) {
                  setExpandedParent(item.href);
                }
                if (!hasChildren) {
                  if (parentHref) {
                    setExpandedParent(parentHref);
                  } else {
                    setExpandedParent(null);
                  }
                }
              }}
            >
              <NavLink
                item={item}
                depth={depth}
                isActive={isActive}
                collapsed={collapsed}
              />
            </div>
            {hasChildren &&
              isExpanded &&
              !collapsed &&
              renderItems(item.children, depth + 1, item.href, collapsed)}
          </div>
        );
      });

  const collapsed = !isHovered;

  return (
    <aside
      ref={sidebarRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`fixed md:sticky top-0 md:top-16 left-0 z-40 flex h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] flex-col border-r border-zinc-200 bg-white px-3 py-4 transform transition-all duration-300 ${
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } ${collapsed ? "w-16" : "w-64"}`}
    >
      <nav className="space-y-1 overflow-y-auto pb-4">
        {renderItems(mainNavItems, 0, null, collapsed)}
      </nav>
      {settingsNav ? (
        <div className="mt-auto pt-3 border-t border-zinc-200">
          <nav className="space-y-1">
            {renderItems([settingsNav], 0, null, collapsed)}
          </nav>
        </div>
      ) : null}
    </aside>
  );
}