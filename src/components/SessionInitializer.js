"use client";

import { useEffect } from "react";
import { useSessionStore } from "@/store/session";

export function SessionInitializer({ children }) {
  const hydrate = useSessionStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return children;
}
