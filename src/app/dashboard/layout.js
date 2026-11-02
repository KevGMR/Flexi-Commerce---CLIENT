"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { TopbarNew } from "@/components/topbar/TopbarNew";
import { useSessionStore } from "@/store/session";
import { buildLoginRedirect } from "@/lib/auth-redirect";
import { refreshActiveOrganizationContext } from "@/lib/orgs";
import { PERMISSIONS } from "@/lib/permissions";
import { RouteGuard } from "@/components/RouteGuard";

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrate = useSessionStore((s) => s.hydrate);
  const accessToken = useSessionStore((s) => s.accessToken);
  const hydrated = useSessionStore((s) => s.hydrated);
  const activeOrganization = useSessionStore((s) => s.activeOrganization);
  const permissionsRefreshed = useSessionStore((s) => s.permissionsRefreshed);
  const refreshPermissions = useSessionStore((s) => s.refreshPermissions);
  const can = useSessionStore((s) => s.can);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const lastRefreshedOrgId = useRef(null);

  const organizationKey =
    activeOrganization?._id ||
    activeOrganization?.id ||
    activeOrganization?.organizationId ||
    "no-org";

  const isPosPage = pathname?.includes("/sales-channels/pos") || false;

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Redirect to login when accessToken disappears AFTER mount, not just
  // on mount. This is the effect that was missing when an idle session
  // 401'd and clearSession() nulled the token — without it you sit on
  // the dashboard with a null org.
  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined" && window.__LOGGING_OUT__) return;
    if (!accessToken) {
      const nextPath = `${window.location.pathname}${window.location.search}`;
      router.replace(buildLoginRedirect(nextPath));
    }
  }, [hydrated, accessToken, router]);

  // Refresh active org from server when the org changes. Guard against
  // the switchOrganization() response racing this by skipping when
  // lastRefreshedOrgId is already the new org.
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

  useEffect(() => {
    if (accessToken && activeOrganization && !permissionsRefreshed) {
      refreshPermissions();
    }
  }, [accessToken, activeOrganization, permissionsRefreshed, refreshPermissions]);

  useEffect(() => {
    if (!hydrated || !accessToken || !permissionsRefreshed) return;

    const isAttendantOnly =
      can(PERMISSIONS.VIEW_OWN_COMMISSIONS) &&
      !can(PERMISSIONS.VIEW_REPORTS) &&
      !can(PERMISSIONS.VIEW_SALE_HISTORY);

    if (!isAttendantOnly) return;

    const allowedPrefixes = [
      "/dashboard/my-commissions",
      "/dashboard/settings/user-info",
    ];

    const isAllowed = allowedPrefixes.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      router.replace("/dashboard/my-commissions");
    }
  }, [hydrated, accessToken, permissionsRefreshed, can, pathname, router]);

  const isAuthed = Boolean(accessToken);

  return (
    <RouteGuard>
      <div
        key={organizationKey}
        className="flex flex-col min-h-screen bg-zinc-50 text-zinc-900"
      >
        <TopbarNew
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />

        <div className="flex flex-1 min-h-0">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

          {sidebarOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-30 md:hidden transition-opacity duration-300 opacity-100"
              onClick={() => setSidebarOpen(false)}
            />
          )}

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
            <div className={isPosPage ? "h-full overflow-hidden" : "mt-4"}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </RouteGuard>
  );
}