// client/src/app/auth/accept-invitation/page.js
"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/session";
import { getDeviceId, getDeviceName } from "@/lib/device";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";

function AcceptInvitationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const hydrate = useSessionStore((s) => s.hydrate);
  const hydrated = useSessionStore((s) => s.hydrated);

  const [status, setStatus] = useState("idle"); // idle | loading | success | error | signup-required
  const [error, setError] = useState("");
  const [signupInfo, setSignupInfo] = useState(null);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated) return;
    if (!token) {
      setStatus("error");
      setError("This invitation link is missing a token.");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/users/accept-invitation`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            "X-Device-ID": getDeviceId() || "",
            "X-Device-Name": getDeviceName() || "",
          },
          body: JSON.stringify({ invitationToken: token }),
        });

        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (res.status === 404 && data?.code === "SIGNUP_REQUIRED") {
          setSignupInfo(data.invitation || null);
          setStatus("signup-required");
          return;
        }

        if (!res.ok) {
          setError(data?.error || "Failed to accept invitation");
          setStatus("error");
          return;
        }

        // Success — persist the fresh session and land in the new org.
        const store = useSessionStore.getState();
        if (data.accessToken) {
          store.setTokens({
            accessToken: data.accessToken,
            refreshToken: null,
          });
        }
        if (data.user) {
          store.setUser(data.user);
        }
        if (data.organization) {
          store.setActiveOrganization(data.organization);
          store.setPermissions(data.organization.permissions || []);
          store.setLocations(data.organization.locations || []);
        }
        if (Array.isArray(data.organizations)) {
          store.setOrganizations(data.organizations);
        }

        setStatus("success");
        setTimeout(() => router.replace("/dashboard/home"), 700);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Network error — please try again.");
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, token, router]);

  if (!hydrated) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
        <h1 className="mb-2 text-xl font-bold text-zinc-900">
          Organization invitation
        </h1>

        {status === "loading" && (
          <p className="text-sm text-zinc-600">Verifying your invitation…</p>
        )}

        {status === "success" && (
          <>
            <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              Invitation accepted. Redirecting to your dashboard…
            </div>
            <Link
              href="/dashboard/home"
              className="text-sm text-blue-600 hover:underline"
            >
              Continue now
            </Link>
          </>
        )}

        {status === "signup-required" && (
          <>
            <p className="mb-4 text-sm text-zinc-600">
              No account exists for{" "}
              <strong>{signupInfo?.email || "this email"}</strong> yet. Create
              one to join{" "}
              <strong>{signupInfo?.organizationName || "the organization"}</strong>.
            </p>
            <Link
              href={`/auth/signup?invitation=${encodeURIComponent(token)}`}
              className="block w-full rounded-md bg-zinc-900 px-4 py-2 text-center text-sm font-medium text-white hover:bg-zinc-800"
            >
              Create account to accept
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
            <Link
              href="/auth/login"
              className="text-sm text-blue-600 hover:underline"
            >
              Go to sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitationContent />
    </Suspense>
  );
}