"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";

export default function UserInfoPage() {
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    fullname: user?.fullname || "",
    phone: user?.phone || "",
    avatarUrl: user?.avatarUrl || "",
  });

  useEffect(() => {
    setForm({
      fullname: user?.fullname || "",
      phone: user?.phone || "",
      avatarUrl: user?.avatarUrl || "",
    });
  }, [user]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setIsSending(true);
    setStatus("");
    setError("");
    try {
      await apiFetch("/users/reset", {
        method: "POST",
        body: { email: user.email },
      });
      setStatus("Password reset email sent.");
    } catch (err) {
      setError(err?.message || "Failed to send password reset email.");
    } finally {
      setIsSending(false);
    }
  };

  const handleSave = async () => {
    if (!user?._id) return;
    setIsSaving(true);
    setStatus("");
    setError("");
    try {
      const data = await apiFetch(`/users/${user._id}`, {
        method: "PUT",
        body: {
          fullname: form.fullname,
          phone: form.phone,
          avatarUrl: form.avatarUrl,
        },
      });
      if (data?.user) {
        setUser({ ...user, ...data.user });
      }
      setStatus("Profile updated successfully.");
    } catch (err) {
      setError(err?.message || "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">User Info</h1>

      <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
        {status && (
          <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-700">
            {status}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-zinc-500">Full name</div>
            <input
              name="fullname"
              value={form.fullname}
              onChange={handleFormChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="text-xs text-zinc-500">Email</div>
            <div className="mt-1 text-sm font-medium text-zinc-900">{user?.email || "—"}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Phone</div>
            <input
              name="phone"
              value={form.phone}
              onChange={handleFormChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="text-xs text-zinc-500">Avatar URL</div>
            <input
              name="avatarUrl"
              value={form.avatarUrl}
              onChange={handleFormChange}
              className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 rounded bg-zinc-900 text-white text-sm disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Profile"}
          </button>
          <button
            onClick={handlePasswordReset}
            disabled={isSending || !user?.email}
            className="px-4 py-2 rounded border border-zinc-300 text-sm disabled:opacity-50"
          >
            {isSending ? "Sending..." : "Send Password Reset Email"}
          </button>
        </div>

      </div>
    </div>
  );
}
