"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/session";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hydrate } = useSessionStore();
  const accessToken = useSessionStore((state) => state.accessToken);
  const hydrated = useSessionStore((state) => state.hydrated);

  const invitationFromQuery = useMemo(
    () => searchParams.get("invitation") || "",
    [searchParams],
  );

  const [mode, setMode] = useState(invitationFromQuery ? "invitation" : "new");
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [organizationName, setOrganizationName] = useState("");
  const [invitationToken, setInvitationToken] = useState(invitationFromQuery);
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (hydrated && accessToken) {
      router.push("/dashboard/home");
    }
  }, [hydrated, accessToken, router]);

  useEffect(() => {
    if (invitationFromQuery) {
      setMode("invitation");
      setInvitationToken(invitationFromQuery);
    }
  }, [invitationFromQuery]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "new" && !organizationName.trim()) {
      setError("Organization name is required");
      return;
    }

    if (mode === "invitation" && !invitationToken.trim()) {
      setError("Invitation token is required");
      return;
    }

    setLoading(true);

    try {
      const payload = {
        fullname,
        email,
        password,
        phone: phone || undefined,
        avatarUrl: avatarUrl || undefined,
        organizationName: mode === "new" ? organizationName : undefined,
        invitationToken: mode === "invitation" ? invitationToken : undefined,
      };

      const response = await fetch(`${API_BASE_URL}/users/new`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Registration failed");
      }

      setSuccess("Registration successful. Check your email to verify.");
      setTimeout(() => router.push("/auth/login"), 1500);
    } catch (submitError) {
      setError(submitError.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  if (!hydrated) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-zinc-900">
            <span className="text-blue-600">FLEXI</span>
            <span className="text-zinc-900">-COMMERCE</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-600">Create your account</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`w-full rounded-md border px-4 py-2 text-sm ${
                mode === "new"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              New organization
            </button>
            <button
              type="button"
              onClick={() => setMode("invitation")}
              className={`w-full rounded-md border px-4 py-2 text-sm ${
                mode === "invitation"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              Join by invitation
            </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Full name
            </label>
            <input
              type="text"
              required
              value={fullname}
              onChange={(event) => setFullname(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
              placeholder="Your name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                  >
                    <path d="M3 3l18 18" />
                    <path d="M10.58 10.58A2 2 0 0 0 12 14a2 2 0 0 0 1.42-.58" />
                    <path d="M9.88 5.5A9.77 9.77 0 0 1 12 5c6.5 0 10 7 10 7a18.24 18.24 0 0 1-4.12 5.06" />
                    <path d="M6.17 6.17C3.94 7.61 2 10 2 12c0 0 3.5 6 10 6 1.6 0 3.05-.38 4.33-1.03" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {mode === "new" ? (
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Organization name
              </label>
              <input
                type="text"
                required
                value={organizationName}
                onChange={(event) => setOrganizationName(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
                placeholder="Your company"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-zinc-700">
                Invitation token
              </label>
              <input
                type="text"
                required
                value={invitationToken}
                onChange={(event) => setInvitationToken(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
                placeholder="Paste invitation token"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Phone (optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
              placeholder="+1 555 123 4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">
              Avatar URL (optional)
            </label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none"
              placeholder="https://example.com/avatar.png"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-center text-sm text-zinc-600">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-blue-600 hover:text-blue-700"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
