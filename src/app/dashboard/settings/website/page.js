"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { DomainPanel } from "@/components/settings/domain-panel";

const ROOT_DOMAIN =
  process.env.NEXT_PUBLIC_STOREFRONT_ROOT_DOMAIN || "flexisolutions.tech";

export default function WebsiteSettingsPage() {
  const { activeOrganization, setActiveOrganization } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    subdomain: "",
    published: false,
  });

  const [website, setWebsite] = useState(null);

  const load = useCallback(async () => {
    if (!activeOrganization?._id) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch(`/organizations/${activeOrganization._id}`);
      const org = res?.organization;
      if (org) {
        setForm({
          subdomain: org.website?.subdomain || "",
          published: org.website?.published === true,
        });
        setWebsite(org.website || {});
      }
    } catch (err) {
      setError(err?.message || "Failed to load organization.");
    } finally {
      setLoading(false);
    }
  }, [activeOrganization?._id]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setSaving(true);
    try {
      const res = await apiFetch(`/organizations/${activeOrganization._id}`, {
        method: "PUT",
        body: {
          website: {
            subdomain: form.subdomain.toLowerCase().trim(),
            published: form.published,
          },
        },
      });
      const updated = res?.organization;
      if (updated) {
        setActiveOrganization(updated);
        setWebsite(updated.website || {});
      }
      setStatus("Website settings saved.");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setError(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  const previewSubdomain = form.subdomain
    ? `${form.subdomain}.${ROOT_DOMAIN}`
    : "(not set)";

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Website</h1>
        <p className="mt-1 text-sm text-gray-600">
          Where your storefront is published and how customers reach it.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {status && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-800">{status}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white rounded-lg border border-gray-200 p-6"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subdomain
          </label>
          <div className="flex items-stretch">
            <input
              type="text"
              value={form.subdomain}
              onChange={(e) =>
                update("subdomain", e.target.value.toLowerCase())
              }
              placeholder="your-store"
              className="block flex-1 px-3 py-2 border border-gray-300 rounded-l-md font-mono text-sm focus:border-indigo-500 focus:outline-none"
            />
            <span className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-sm text-gray-600">
              .{ROOT_DOMAIN}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Your storefront will be live at{" "}
            <span className="font-mono">{previewSubdomain}</span>. Lowercase
            letters, numbers, and hyphens.
          </p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => update("published", e.target.checked)}
              className="mt-0.5 h-4 w-4 text-indigo-600 border-gray-300 rounded"
            />
            <div>
              <span className="block text-sm font-medium text-gray-900">
                Publish storefront
              </span>
              <span className="block text-xs text-gray-500 mt-1">
                When enabled, your storefront is publicly visible. Disabling
                hides it from all visitors.
              </span>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <DomainPanel
        website={website}
        orgId={activeOrganization?._id}
        onUpdated={(updatedOrg) => {
          setActiveOrganization(updatedOrg);
          setWebsite(updatedOrg.website || {});
        }}
      />
    </div>
  );
}