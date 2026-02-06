"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:9200";

export default function VerifyEmailPage() {
  const params = useParams();
  const token = params?.token;

  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("Verifying your email...");

  const verifyEmail = async () => {
    if (!token || typeof token !== "string") {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    setStatus("loading");
    setMessage("Verifying your email...");

    try {
      const response = await fetch(
        `${API_BASE_URL}/email-verification/verify/${token}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Email verification failed");
      }

      setStatus("success");
      setMessage(data?.message || "Email verified successfully.");
    } catch (error) {
      setStatus("error");
      setMessage(error.message || "Email verification failed.");
    }
  };

  useEffect(() => {
    verifyEmail();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-zinc-900">
            <span className="text-blue-600">FLEXI</span>
            <span className="text-zinc-900">-COMMERCE</span>
          </h1>
          <p className="mt-2 text-sm text-zinc-600">Email verification</p>
        </div>

        <div
          className={`rounded-lg border p-4 text-sm ${
            status === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : status === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          {message}
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={verifyEmail}
            disabled={status === "loading"}
            className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {status === "loading" ? "Verifying..." : "Try again"}
          </button>
          <Link
            href="/auth/login"
            className="w-full rounded-md border border-zinc-300 px-4 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Go to login
          </Link>
        </div>
      </div>
    </div>
  );
}
