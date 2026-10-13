"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";

export default function StorefrontChannelPage() {
  const { activeOrganization } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [org, setOrg] = useState(null);
  const [stats, setStats] = useState({
    ordersToday: 0,
    revenueToday: 0,
    pendingPayments: 0,
    currency: "KES",
  });

  useEffect(() => {
    const load = async () => {
      if (!activeOrganization?._id) return;
      try {
        const [orgRes, salesRes] = await Promise.all([
          apiFetch(`/organizations/${activeOrganization._id}`),
          apiFetch("/sales?salesChannel=storefront&limit=200"),
        ]);

        const organization = orgRes?.organization;
        setOrg(organization);

        const sales = salesRes?.data?.sales || salesRes?.sales || [];
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        let ordersToday = 0;
        let revenueToday = 0;
        let pendingPayments = 0;

        for (const sale of sales) {
          const created = new Date(sale.createdAt);
          const isToday = created >= startOfDay;

          if (isToday) {
            ordersToday += 1;
            if (sale.paymentStatus === "completed") {
              revenueToday += Number(sale.totalAmount) || 0;
            }
          }

          if (sale.paymentStatus === "pending") {
            pendingPayments += 1;
          }
        }

        setStats({
          ordersToday,
          revenueToday,
          pendingPayments,
          currency: organization?.settings?.currency || "KES",
        });
      } catch (err) {
        setError(err?.message || "Failed to load storefront data.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeOrganization?._id]);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  const subdomain = org?.website?.subdomain;
  const customDomain = org?.website?.domain;
  const published = org?.website?.published === true;
  const domainVerified = org?.website?.domainVerified === true;

  const ROOT = "localhost:3001"; // dev only
  const storefrontUrl = customDomain && domainVerified
    ? `http://${customDomain}`
    : subdomain
      ? `http://${subdomain}.${ROOT}`
      : null;

  const formatMoney = (value) => {
    try {
      return new Intl.NumberFormat("en-KE", {
        style: "currency",
        currency: stats.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${stats.currency} ${value}`;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Storefront</h1>
        <p className="mt-1 text-sm text-gray-600">
          Your online sales channel — manage branding, domain, and orders.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Status banner */}
      <div
        className={`rounded-lg border p-4 ${
          published
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${
                published ? "bg-green-500" : "bg-amber-500"
              }`}
            />
            <div>
              <p
                className={`text-sm font-medium ${
                  published ? "text-green-900" : "text-amber-900"
                }`}
              >
                {published ? "Storefront is live" : "Storefront is not published"}
              </p>
              {storefrontUrl ? (
                <a
                  href={storefrontUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs hover:underline ${
                    published ? "text-green-700" : "text-amber-700"
                  }`}
                >
                  {storefrontUrl} ↗
                </a>
              ) : (
                <p className="text-xs text-amber-700">
                  No domain configured yet.
                </p>
              )}
            </div>
          </div>
          <Link
            href="/dashboard/settings/website"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50"
          >
            {published ? "Manage" : "Set up"}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Orders today" value={stats.ordersToday} />
        <StatCard
          label="Revenue today"
          value={formatMoney(stats.revenueToday)}
        />
        <StatCard
          label="Pending payments"
          value={stats.pendingPayments}
          warn={stats.pendingPayments > 0}
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          title="Orders"
          description="View all storefront orders"
          href="/dashboard/sales-channels/storefront/orders"
        />
        <ActionCard
          title="Brand"
          description="Logo, colors, tagline"
          href="/dashboard/settings/storefront"
        />
        <ActionCard
          title="Domain"
          description="Subdomain and custom domain"
          href="/dashboard/settings/website"
        />
        <ActionCard
          title="Delivery"
          description="Delivery categories and options"
          href="/dashboard/settings/delivery-categories"
        />
      </div>
    </div>
  );
}

function StatCard({ label, value, warn }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold ${
          warn ? "text-amber-700" : "text-gray-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ActionCard({ title, description, href }) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-lg border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50"
    >
      <p className="font-medium text-gray-900 group-hover:text-indigo-600">
        {title}
      </p>
      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </Link>
  );
}