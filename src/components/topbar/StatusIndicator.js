"use client";

import { Dropdown } from "@/components/ui/Dropdown";
import { Wifi, ShopifyLogo, Refresh } from "@/components/icons/Icon";

export function StatusIndicator({
  isOnline,
  shopifyStatus,
  shopifyLoading,
  pendingSalesCount,
  onShopifyRefresh,
}) {
  // Determine overall status
  let statusColor = "bg-green-500";
  let statusLabel = "All Systems Active";

  const onlineOk = isOnline;
  const shopifyOk = shopifyStatus === "active";
  const syncOk = pendingSalesCount === 0;

  const issueCount = [!onlineOk, !shopifyOk, !syncOk].filter(Boolean).length;

  if (issueCount === 0) {
    statusColor = "bg-green-500";
    statusLabel = "All Systems Active";
  } else if (issueCount === 1) {
    statusColor = "bg-yellow-500";
    statusLabel = "One Issue";
  } else if (issueCount === 2) {
    statusColor = "bg-red-500";
    statusLabel = "Multiple Issues";
  } else {
    statusColor = "bg-red-500";
    statusLabel = "Multiple Issues";
  }

  const trigger = (
    <button className="flex items-center gap-2 hover:bg-zinc-50 rounded-md px-2 py-1 transition-colors">
      <div className={`w-2.5 h-2.5 rounded-full ${statusColor}`} />
      <span className="text-xs font-medium text-zinc-600 hidden sm:inline">
        {statusLabel}
      </span>
    </button>
  );

  return (
    <Dropdown trigger={trigger} align="right">
      <div className="p-4 space-y-3 w-64">
        <div className="text-sm font-semibold text-zinc-900 mb-4">
          System Status
        </div>

        {/* Network Status */}
        <div className="border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Wifi className="w-4 h-4 text-zinc-600" />
            <span className="text-sm font-medium text-zinc-700">Network</span>
            <div
              className={`w-2 h-2 rounded-full ml-auto ${
                onlineOk ? "bg-green-500" : "bg-red-500"
              }`}
            />
          </div>
          <div className="text-xs text-zinc-600 pl-6">
            {onlineOk ? "Online" : "Offline"}
          </div>
        </div>

        {/* Shopify Status */}
        <div className="border-b border-zinc-200 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <ShopifyLogo className="w-4 h-4 text-zinc-600" />
            <span className="text-sm font-medium text-zinc-700">Shopify</span>
            <div
              className={`w-2 h-2 rounded-full ml-auto ${
                shopifyStatus === "active"
                  ? "bg-green-500"
                  : shopifyStatus === "error"
                  ? "bg-yellow-500"
                  : shopifyStatus === "unknown"
                  ? "bg-gray-400"
                  : "bg-gray-300"
              }`}
            />
          </div>
          <div className="flex items-center justify-between pl-6">
            <span className="text-xs text-zinc-600">
              {shopifyStatus === "active"
                ? "Connected"
                : shopifyStatus === "error"
                ? "Error"
                : shopifyStatus === "unknown"
                ? "Unknown"
                : "Disconnected"}
            </span>
            {shopifyStatus && shopifyStatus !== "disconnected" && (
              <button
                onClick={onShopifyRefresh}
                disabled={shopifyLoading}
                className={`p-1 rounded hover:bg-zinc-100 transition-colors ${
                  shopifyLoading
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                }`}
                title="Refresh Shopify status"
              >
                <Refresh
                  className={`w-3.5 h-3.5 text-zinc-600 ${
                    shopifyLoading ? "animate-spin" : ""
                  }`}
                />
              </button>
            )}
          </div>
        </div>

        {/* Pending Sales */}
        {pendingSalesCount > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-4 h-4 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-amber-500" />
              </div>
              <span className="text-sm font-medium text-zinc-700">
                Pending Sales
              </span>
              <div className="ml-auto text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded">
                {pendingSalesCount}
              </div>
            </div>
            <div className="text-xs text-zinc-600 pl-6">
              Waiting to sync
            </div>
          </div>
        )}
      </div>
    </Dropdown>
  );
}
