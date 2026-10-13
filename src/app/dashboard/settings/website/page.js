"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";

const ROOT_DOMAIN = "localhost:3001"; // dev; update when deployed

export default function WebsiteSettingsPage() {
  const { activeOrganization, setActiveOrganization } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    subdomain: "",
    domain: "",
    published: false,
  });

  const [originalDomain, setOriginalDomain] = useState("");
  const [originalDomainVerified, setOriginalDomainVerified] = useState(false);

  useEffect(() => {
    const loadOrg = async () => {
      if (!activeOrganization?._id) {
        setLoading(false);
        return;
      }
      try {
        const res = await apiFetch(
          `/organizations/${activeOrganization._id}`,
        );
        const org = res?.organization;
        if (org) {
          setForm({
            subdomain: org.website?.subdomain || "",
            domain: org.website?.domain || "",
            published: org.website?.published === true,
          });
          setOriginalDomain(org.website?.domain || "");
          setOriginalDomainVerified(
            org.website?.domainVerified === true,
          );
        }
      } catch (err) {
        setError(err?.message || "Failed to load organization.");
      } finally {
        setLoading(false);
      }
    };
    loadOrg();
  }, [activeOrganization?._id]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const domainChanged =
    form.domain.toLowerCase().trim() !== originalDomain.toLowerCase().trim();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    setSaving(true);
    try {
      const res = await apiFetch(
        `/organizations/${activeOrganization._id}`,
        {
          method: "PUT",
          body: {
            website: {
              subdomain: form.subdomain.toLowerCase().trim(),
              domain: form.domain.toLowerCase().trim(),
              // If the domain changed, clear verification
              domainVerified: domainChanged ? false : originalDomainVerified,
              published: form.published,
            },
          },
        },
      );

      const updated = res?.organization;
      if (updated) {
        setActiveOrganization(updated);
        setOriginalDomain(updated.website?.domain || "");
        setOriginalDomainVerified(updated.website?.domainVerified === true);
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
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Website</h1>
        <p className="mt-1 text-sm text-gray-600">
          Where your storefront is published and how customers reach it.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {status && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-800">{status}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-6 bg-white rounded-lg border border-gray-200 p-6"
      >
        {/* Subdomain */}
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

        {/* Custom domain */}
        <div className="border-t border-gray-200 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Custom domain
          </label>
          <input
            type="text"
            value={form.domain}
            onChange={(e) => update("domain", e.target.value.toLowerCase())}
            placeholder="shop.example.com"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            Optional. Requires DNS setup before it goes live.
          </p>

          {originalDomain && !domainChanged && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              {originalDomainVerified ? (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-green-700">Verified</span>
                </>
              ) : (
                <>
                  <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                  <span className="text-yellow-700">
                    Pending verification
                  </span>
                </>
              )}
            </div>
          )}

          {domainChanged && form.domain && (
            <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-800">
                Saving a new domain resets verification. You'll need to
                reconfigure DNS after saving.
              </p>
            </div>
          )}
        </div>

        {/* Published */}
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
    </div>
  );
}