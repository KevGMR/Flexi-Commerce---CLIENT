"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OrganizationsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth/select-organization");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center bg-zinc-50">
      <div className="text-zinc-600">Redirecting...</div>
    </div>
  );
}
