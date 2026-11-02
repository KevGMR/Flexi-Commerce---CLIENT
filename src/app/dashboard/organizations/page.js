"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/session";

export default function OrganizationsPage() {
  const router = useRouter();
  const hydrated = useSessionStore((s) => s.hydrated);
  const accessToken = useSessionStore((s) => s.accessToken);
  const activeOrganization = useSessionStore((s) => s.activeOrganization);

  useEffect(() => {
    if (!hydrated) return;
    if (!accessToken) {
      router.replace("/auth/login");
      return;
    }
    if (!activeOrganization) {
      router.replace("/auth/select-organization");
    }
  }, [hydrated, accessToken, activeOrganization, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50">
      <div className="text-zinc-600">Loading…</div>
    </div>
  );
}