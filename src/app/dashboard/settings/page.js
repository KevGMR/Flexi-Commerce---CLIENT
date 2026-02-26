"use client";

import Link from "next/link";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

const cards = [
  {
    title: "User Info",
    description: "View and manage your profile details.",
    href: "/dashboard/settings/user-info",
    permission: PERMISSIONS.VIEW_SETTINGS,
  },
  {
    title: "Invitations",
    description: "Invite teammates to your organization.",
    href: "/dashboard/settings/invitations",
    permission: PERMISSIONS.VIEW_USERS,
  },
  {
    title: "Locations",
    description: "Manage store locations and defaults.",
    href: "/dashboard/settings/locations",
    permission: PERMISSIONS.VIEW_INVENTORY,
  },
  {
    title: "Delivery Categories",
    description: "Manage delivery methods and pricing.",
    href: "/dashboard/settings/delivery-categories",
    permission: PERMISSIONS.MANAGE_INVENTORY,
  },
  {
    title: "Permissions",
    description: "Review roles and permission sets.",
    href: "/dashboard/settings/permissions",
    permission: PERMISSIONS.VIEW_ROLES,
  },
  {
    title: "Shopify",
    description: "Connect Shopify and map locations.",
    href: "/dashboard/settings/shopify",
    permission: PERMISSIONS.VIEW_SETTINGS,
  },
  {
    title: "Team & Orgs",
    description: "Manage members and organization details.",
    href: "/dashboard/settings/team",
    permission: PERMISSIONS.VIEW_USERS,
  },
];

export default function SettingsPage() {
  const can = useSessionStore((s) => s.can);
  const hydrated = useSessionStore((s) => s.hydrated);

  const visibleCards = cards.filter((card) => {
    if (!hydrated) return true;
    if (!card.permission) return true;
    return can(card.permission);
  });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {visibleCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="rounded-lg border border-zinc-200 bg-white p-5 hover:shadow-sm transition"
          >
            <div className="text-sm font-semibold text-zinc-900">{card.title}</div>
            <div className="mt-2 text-xs text-zinc-600">{card.description}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
