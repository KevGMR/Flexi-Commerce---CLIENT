"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopbarNew } from "@/components/topbar/TopbarNew";
import { useSessionStore } from "@/store/session";
import { buildLoginRedirect } from "@/lib/auth-redirect";
import { refreshActiveOrganizationContext } from "@/lib/orgs";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const hydrate = useSessionStore((s) => s.hydrate);
  const accessToken = useSessionStore((s) => s.accessToken);
  const hydrated = useSessionStore((s) => s.hydrated);
  const activeOrganization = useSessionStore((s) => s.activeOrganization);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lastRefreshedOrgId = useRef(null);
  const organizationKey =
    activeOrganization?._id ||
    activeOrganization?.id ||
    activeOrganization?.organizationId ||
    "no-org";

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && !accessToken) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      router.replace(buildLoginRedirect(nextPath));
    }
  }, [hydrated, accessToken, router]);

  useEffect(() => {
    if (!hydrated || !accessToken || !activeOrganization) return;

    const orgId =
      activeOrganization?._id ||
      activeOrganization?.id ||
      activeOrganization?.organizationId;

    if (!orgId || lastRefreshedOrgId.current === orgId) return;

    lastRefreshedOrgId.current = orgId;

    refreshActiveOrganizationContext(orgId).catch((error) => {
      console.warn("Failed to refresh organization permissions", error);
    });
  }, [hydrated, accessToken, activeOrganization]);

  const isAuthed = Boolean(accessToken);

  return (
    <div
      key={organizationKey}
      className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900"
    >
      {/* Full-width Topbar */}
      <TopbarNew
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Content area with Sidebar and Main */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-300 opacity-100"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 bg-zinc-50 p-6">
          {!isAuthed ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              You are not signed in. Provide access/refresh tokens via a login
              flow to enable live data.
            </div>
          ) : null}
          {isAuthed && !activeOrganization ? (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              Select an organization to continue. If you belong to only one
              organization, it will auto-select when loaded.
            </div>
          ) : null}
          <div className="mt-4">{children}</div>
        </main>
      </div>
    </div>
  );
}
