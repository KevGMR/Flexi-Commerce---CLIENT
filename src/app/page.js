"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/session";

export default function Landing() {
  const router = useRouter();
  const hydrate = useSessionStore((s) => s.hydrate);
  const accessToken = useSessionStore((s) => s.accessToken);
  const hydrated = useSessionStore((s) => s.hydrated);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated) {
      if (!accessToken) {
        router.push("/auth/login");
      } else {
        router.push("/dashboard/home");
      }
    }
  }, [hydrated, accessToken, router]);

  return null;
}
