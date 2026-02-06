"use client";

import { useEffect, useState, useCallback } from "react";
import { fetchMyOrganizations, switchOrganization } from "@/lib/orgs";
import { useSessionStore } from "@/store/session";
import { useSyncManager } from "@/hooks/useSyncManager";
import { apiFetch } from "@/lib/api-client";

export function Topbar() {
  const {
    activeOrganization,
    organizations,
    setOrganizations,
    setActiveOrganization,
    user,
    accessToken,
    clearSession,
    hydrated,
  } = useSessionStore();
  const { isOnline, pendingSalesCount } = useSyncManager();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isMounted, setIsMounted] = useState(false);
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

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    if (organizations.length) return;
    let cancelled = false;
    setLoading(true);
    fetchMyOrganizations()
      .then((orgs) => {
        if (cancelled) return;
        setOrganizations(orgs);
        if (orgs.length === 1) {
          switchOrganization(
            orgs[0].organizationId || orgs[0]._id || orgs[0].id,
          )
            .catch(() => {})
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Failed to load orgs");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, organizations.length, setOrganizations]);

  useEffect(() => {
    if (!hydrated || !accessToken) return;
    loadShopifyStatus();
    const interval = setInterval(() => {
      loadShopifyStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, [hydrated, accessToken, activeOrganization, loadShopifyStatus]);

  const handleOrgChange = async (event) => {
    const orgId = event.target.value;
    if (!orgId) return;
    setLoading(true);
    setError("");
    try {
      const res = await switchOrganization(orgId);
      if (res?.organization) setActiveOrganization(res.organization);
    } catch (err) {
      setError(err.message || "Failed to switch organization");
    } finally {
      setLoading(false);
    }
  };

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-4">
      <div className="text-sm text-zinc-600">
        {activeOrganization?.name
          ? `Org: ${activeOrganization.name}`
          : "Select organization"}
        {loading ? " · loading..." : ""}
      </div>
      <div className="flex items-center gap-4">
        {/* Online Status + Pending Sales */}
        {isMounted && (
          <div className="flex items-center gap-3 border-l border-zinc-200 pl-4">
            {/* Online Status Indicator */}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isOnline ? "bg-green-500" : "bg-red-500"
                }`}
              />
              <span className="text-xs font-medium text-zinc-600">
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>

            {/* Pending Sales Badge */}
            {pendingSalesCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded px-2 py-1">
                <span className="text-xs font-medium text-amber-700">
                  {pendingSalesCount} Pending
                </span>
              </div>
            )}

            {/* Shopify Status Indicator */}
            {shopifyStatus && shopifyStatus !== "disconnected" && (
              <div className="flex items-center gap-1.5">
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    shopifyStatus === "active"
                      ? "bg-green-500"
                      : shopifyStatus === "error"
                        ? "bg-yellow-500"
                        : "bg-gray-400"
                  }`}
                />
                <span className="text-xs font-medium text-zinc-600">
                  Shopify{" "}
                  {shopifyStatus === "active"
                    ? "Active"
                    : shopifyStatus === "error"
                      ? "Error"
                      : "Unknown"}
                </span>
                <button
                  onClick={loadShopifyStatus}
                  disabled={shopifyLoading}
                  className={`ml-1 p-0.5 rounded hover:opacity-70 transition-opacity ${
                    shopifyLoading
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer"
                  }`}
                  title="Refresh Shopify status"
                >
                  <svg
                    className={`w-3.5 h-3.5 text-zinc-600 ${shopifyLoading ? "animate-spin" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {accessToken ? (
          <select
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm"
            onChange={handleOrgChange}
            value={
              activeOrganization?._id ||
              activeOrganization?.organizationId ||
              ""
            }
          >
            <option value="">Choose org</option>
            {organizations.map((org) => (
              <option
                key={org._id || org.organizationId || org.id}
                value={org._id || org.organizationId || org.id}
              >
                {org.name}
              </option>
            ))}
          </select>
        ) : null}
        <div className="text-sm text-zinc-700">
          {user?.fullname || user?.email || "Guest"}
        </div>
        {accessToken ? (
          <button
            onClick={clearSession}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-100"
          >
            Logout
          </button>
        ) : null}
      </div>
      {error ? <div className="ml-4 text-xs text-red-600">{error}</div> : null}
    </header>
  );
}
