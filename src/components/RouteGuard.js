"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useSessionStore } from "@/store/session";
import { buildLoginRedirect } from "@/lib/auth-redirect";

const PUBLIC_ROUTES = ["/auth/login", "/auth/select-organization", "/auth/signup"];

export function RouteGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname() || "";
  const hydrated = useSessionStore((s) => s.hydrated);
  const accessToken = useSessionStore((s) => s.accessToken);
  const activeOrganization = useSessionStore((s) => s.activeOrganization);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window !== "undefined" && window.__LOGGING_OUT__) return;
    if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) return;

    if (!accessToken) {
      router.replace(buildLoginRedirect(`${pathname}${window.location.search || ""}`));
      return;
    }

    if (!activeOrganization) {
      router.replace("/auth/select-organization");
    }
  }, [hydrated, accessToken, activeOrganization, pathname, router]);

  return children;
}