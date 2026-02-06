"use client";

import { useEffect, useState, useCallback } from "react";
import { useSessionStore } from "@/store/session";
import { useSyncManager } from "@/hooks/useSyncManager";
import { apiFetch } from "@/lib/api-client";
import { Logo } from "./Logo";
import { StatusIndicator } from "./StatusIndicator";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { Menu } from "@/components/icons/Icon";

export function TopbarNew({ sidebarOpen, onToggleSidebar }) {
  const {
    activeOrganization,
    organizations,
    setActiveOrganization,
    user,
    accessToken,
    clearSession,
    hydrated,
  } = useSessionStore();

  const { isOnline, pendingSalesCount } = useSyncManager();

  const [shopifyStatus, setShopifyStatus] = useState(null);
  const [shopifyLoading, setShopifyLoading] = useState(false);

  const loadShopifyStatus = useCallback(async () => {
    if (!accessToken) return;
    setShopifyLoading(true);
    try {
      const data = await apiFetch("/shopify/connection");
      setShopifyStatus(data?.connected ? data?.data?.status : "disconnected");
    } catch (err) {
      console.error("Failed to load Shopify status:", err);
      setShopifyStatus("unknown");
    } finally {
      setShopifyLoading(false);
    }
  }, [accessToken]);

  // Poll Shopify status every 60 seconds
  useEffect(() => {
    if (!hydrated || !accessToken) return;

    loadShopifyStatus();

    const interval = setInterval(() => {
      loadShopifyStatus();
    }, 60000);

    return () => clearInterval(interval);
  }, [hydrated, accessToken, activeOrganization, loadShopifyStatus]);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-6">
      {/* Left Section: Logo + Menu */}
      <div className="flex items-center gap-4">
        {/* Mobile Hamburger Menu */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 hover:bg-zinc-100 rounded-md transition-colors"
          title="Toggle sidebar"
        >
          <Menu className="w-5 h-5 text-zinc-600" />
        </button>

        {/* Logo - Hidden on Mobile */}
        <div className="hidden md:flex">
          <Logo />
        </div>
      </div>

      {/* Center Section: Search (Placeholder) */}
      <div className="hidden md:flex flex-1 mx-8 max-w-md">
        <div className="w-full flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-md border border-zinc-200">
          <span className="text-sm text-zinc-400">Search...</span>
        </div>
      </div>

      {/* Right Section: Status, Notifications, User Menu */}
      <div className="flex items-center gap-3">
        {/* Status Indicator */}
        <StatusIndicator
          isOnline={isOnline}
          shopifyStatus={shopifyStatus}
          shopifyLoading={shopifyLoading}
          pendingSalesCount={pendingSalesCount}
          onShopifyRefresh={loadShopifyStatus}
        />

        {/* Notification Bell */}
        <NotificationBell />

        {/* User Menu */}
        {user && (
          <UserMenu
            user={user}
            activeOrganization={activeOrganization}
            organizations={organizations}
            onOrgChange={setActiveOrganization}
            onLogout={clearSession}
          />
        )}
      </div>
    </header>
  );
}
