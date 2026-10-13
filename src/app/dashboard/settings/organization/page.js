"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function OrganizationSettingsPage() {
  const { activeOrganization, setActiveOrganization, can } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    slug: "",
    currency: "KES",
    language: "en",
    timezone: "UTC",
    taxMode: "inclusive",
    taxRate: 0,
  });

    // Any user with VIEW_SETTINGS can see the page; the server enforces
    // Owner/Manager for writes.
    const canEdit = can?.(PERMISSIONS.VIEW_SETTINGS) ?? false;
  // If MANAGE_ORG doesn't exist in your permissions config, replace with a
  // permission you already use for org settings, or hardcode `true` for now.

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
            name: org.name || "",
            slug: org.slug || "",
            currency: org.settings?.currency || "KES",
            language: org.settings?.language || "en",
            timezone: org.settings?.timezone || "UTC",
            taxMode: org.settings?.taxMode || "inclusive",
            taxRate: org.settings?.taxRate || 0,
          });
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (!form.slug.trim()) {
      setError("Slug is required");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(
        `/organizations/${activeOrganization._id}`,
        {
          method: "PUT",
          body: {
            name: form.name.trim(),
            slug: form.slug.trim(),
            settings: {
              currency: form.currency,
              language: form.language,
              timezone: form.timezone,
              taxMode: form.taxMode,
              taxRate: Number(form.taxRate) || 0,
            },
          },
        },
      );

      const updated = res?.organization;
      if (updated) {
        setActiveOrganization(updated);
      }
      setStatus("Organization settings saved.");
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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organization</h1>
        <p className="mt-1 text-sm text-gray-600">
          Basic profile and regional settings for your organization.
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Organization name
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            disabled={!canEdit}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Slug
          </label>
          <input
            type="text"
            value={form.slug}
            onChange={(e) => update("slug", e.target.value.toLowerCase())}
            disabled={!canEdit}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
          />
          <p className="mt-1 text-xs text-gray-500">
            Lowercase letters, numbers, and hyphens. Used to identify your
            organization in URLs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={form.currency}
              onChange={(e) => update("currency", e.target.value)}
              disabled={!canEdit}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
            >
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="USD">USD — US Dollar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="GBP">GBP — British Pound</option>
              <option value="UGX">UGX — Ugandan Shilling</option>
              <option value="TZS">TZS — Tanzanian Shilling</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Language
            </label>
            <select
              value={form.language}
              onChange={(e) => update("language", e.target.value)}
              disabled={!canEdit}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
            >
              <option value="en">English</option>
              <option value="sw">Kiswahili</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timezone
          </label>
          <select
            value={form.timezone}
            onChange={(e) => update("timezone", e.target.value)}
            disabled={!canEdit}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
          >
            <option value="Africa/Nairobi">Africa/Nairobi (EAT)</option>
            <option value="UTC">UTC</option>
            <option value="Africa/Kampala">Africa/Kampala</option>
            <option value="Africa/Dar_es_Salaam">Africa/Dar_es_Salaam</option>
            <option value="Europe/London">Europe/London</option>
          </select>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Tax</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax mode
              </label>
              <select
                value={form.taxMode}
                onChange={(e) => update("taxMode", e.target.value)}
                disabled={!canEdit}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
              >
                <option value="inclusive">Inclusive (price includes tax)</option>
                <option value="exclusive">Exclusive (tax added at checkout)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default tax rate
              </label>
              <input
                type="number"
                step="0.001"
                min="0"
                max="1"
                value={form.taxRate}
                onChange={(e) => update("taxRate", e.target.value)}
                disabled={!canEdit}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:border-indigo-500 focus:outline-none disabled:bg-gray-50"
              />
              <p className="mt-1 text-xs text-gray-500">
                Enter as decimal (0.16 for 16% VAT). Individual locations can
                override.
              </p>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end gap-2 border-t border-gray-200 pt-6">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}