"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";

const DEFAULT_PRIMARY = "#111111";
const DEFAULT_ACCENT = "#2563eb";

export default function StorefrontSettingsPage() {
  const { activeOrganization, setActiveOrganization } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    logoUrl: "",
    faviconUrl: "",
    tagline: "",
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
    headerLayout: "left",
  });

  const colorInputPrimaryRef = useRef(null);
  const colorInputAccentRef = useRef(null);

  useEffect(() => {
    const load = async () => {
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
            logoUrl: org.website?.logoUrl || "",
            faviconUrl: org.website?.faviconUrl || "",
            tagline: org.website?.tagline || "",
            primaryColor: org.website?.primaryColor || DEFAULT_PRIMARY,
            accentColor: org.website?.accentColor || DEFAULT_ACCENT,
            headerLayout: org.website?.headerLayout || "left",
          });
        }
      } catch (err) {
        setError(err?.message || "Failed to load storefront settings.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeOrganization?._id]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    // Basic URL validation
    const urlPattern = /^https?:\/\/.+/i;
    if (form.logoUrl && !urlPattern.test(form.logoUrl)) {
      setError("Logo URL must start with http:// or https://");
      return;
    }
    if (form.faviconUrl && !urlPattern.test(form.faviconUrl)) {
      setError("Favicon URL must start with http:// or https://");
      return;
    }

    // Hex validation
    const hexPattern = /^#[0-9a-fA-F]{6}$/;
    if (!hexPattern.test(form.primaryColor)) {
      setError("Primary color must be a 6-digit hex value");
      return;
    }
    if (!hexPattern.test(form.accentColor)) {
      setError("Accent color must be a 6-digit hex value");
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch(
        `/organizations/${activeOrganization._id}`,
        {
          method: "PUT",
          body: {
            website: {
              logoUrl: form.logoUrl.trim(),
              faviconUrl: form.faviconUrl.trim(),
              tagline: form.tagline.trim(),
              primaryColor: form.primaryColor,
              accentColor: form.accentColor,
              headerLayout: form.headerLayout,
            },
          },
        },
      );

      const updated = res?.organization;
      if (updated) {
        setActiveOrganization(updated);
      }
      setStatus("Storefront branding saved.");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setError(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({
      logoUrl: "",
      faviconUrl: "",
      tagline: "",
      primaryColor: DEFAULT_PRIMARY,
      accentColor: DEFAULT_ACCENT,
      headerLayout: "left",
    });
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
        <h1 className="text-2xl font-bold text-gray-900">Storefront branding</h1>
        <p className="mt-1 text-sm text-gray-600">
          How your storefront looks to customers. Changes go live immediately
          after saving.
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
        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Logo URL
          </label>
          <input
            type="url"
            value={form.logoUrl}
            onChange={(e) => update("logoUrl", e.target.value)}
            placeholder="https://your-cdn.com/logo.png"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            PNG or SVG, ideally with a transparent background. Max 400px wide.
          </p>
          {form.logoUrl && /^https?:\/\/.+/i.test(form.logoUrl) && (
            <div className="mt-3 inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={form.logoUrl}
                alt="Logo preview"
                className="max-h-12 max-w-[200px] object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement?.insertAdjacentHTML(
                    "beforeend",
                    '<span class="text-xs text-red-500">Failed to load image</span>',
                  );
                }}
              />
            </div>
          )}
        </div>

        {/* Favicon */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Favicon URL
          </label>
          <input
            type="url"
            value={form.faviconUrl}
            onChange={(e) => update("faviconUrl", e.target.value)}
            placeholder="https://your-cdn.com/favicon.png"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            Small square icon (32×32 or 64×64). PNG or ICO.
          </p>
        </div>

        {/* Tagline */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tagline
          </label>
          <input
            type="text"
            value={form.tagline}
            onChange={(e) => update("tagline", e.target.value)}
            placeholder="Short line shown on your homepage hero"
            maxLength={120}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-gray-500">
            {form.tagline.length}/120 characters
          </p>
        </div>

        {/* Colors */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Colors</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Primary color
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    colorInputPrimaryRef.current?.click()
                  }
                  className="h-10 w-10 rounded-md border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: form.primaryColor }}
                  aria-label="Pick primary color"
                />
                <input
                  ref={colorInputPrimaryRef}
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  className="sr-only"
                />
                <input
                  type="text"
                  value={form.primaryColor}
                  onChange={(e) => update("primaryColor", e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:border-indigo-500 focus:outline-none"
                  maxLength={7}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Buttons, links, active states.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Accent color
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    colorInputAccentRef.current?.click()
                  }
                  className="h-10 w-10 rounded-md border border-gray-300 flex-shrink-0"
                  style={{ backgroundColor: form.accentColor }}
                  aria-label="Pick accent color"
                />
                <input
                  ref={colorInputAccentRef}
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => update("accentColor", e.target.value)}
                  className="sr-only"
                />
                <input
                  type="text"
                  value={form.accentColor}
                  onChange={(e) => update("accentColor", e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:border-indigo-500 focus:outline-none"
                  maxLength={7}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Secondary highlights, badges.
              </p>
            </div>
          </div>
        </div>

        {/* Header layout */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Header layout
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <LayoutOption
              value="left"
              selected={form.headerLayout === "left"}
              onSelect={() => update("headerLayout", "left")}
              title="Left-aligned"
              description="Logo on the left, nav on the right."
            />
            <LayoutOption
              value="centered"
              selected={form.headerLayout === "centered"}
              onSelect={() => update("headerLayout", "centered")}
              title="Centered"
              description="Logo in the center, nav on both sides."
            />
          </div>
        </div>

        {/* Live preview */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Preview
          </h3>
          <HeaderPreview
            logoUrl={form.logoUrl}
            primaryColor={form.primaryColor}
            accentColor={form.accentColor}
            tagline={form.tagline}
            layout={form.headerLayout}
            orgName={activeOrganization?.name || "Your store"}
          />
        </div>

        {/* Actions */}
        <div className="flex justify-between gap-2 border-t border-gray-200 pt-6">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Reset to defaults
          </button>
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

function LayoutOption({ value, selected, onSelect, title, description }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`text-left rounded-lg border-2 p-4 transition-colors ${
        selected
          ? "border-indigo-500 bg-indigo-50"
          : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 ${
            selected
              ? "border-indigo-500 bg-indigo-500"
              : "border-gray-300"
          }`}
        >
          {selected && (
            <div className="h-full w-full rounded-full border-2 border-white" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        </div>
      </div>

      {/* Tiny wireframe */}
      <div className="mt-3 flex items-center gap-1.5 px-1">
        {value === "left" ? (
          <>
            <div className="h-3 w-8 rounded-sm bg-gray-900" />
            <div className="flex-1" />
            <div className="h-3 w-6 rounded-sm bg-gray-200" />
            <div className="h-3 w-6 rounded-sm bg-gray-200" />
          </>
        ) : (
          <>
            <div className="h-3 w-6 rounded-sm bg-gray-200" />
            <div className="flex-1" />
            <div className="h-3 w-8 rounded-sm bg-gray-900" />
            <div className="flex-1" />
            <div className="h-3 w-6 rounded-sm bg-gray-200" />
          </>
        )}
      </div>
    </button>
  );
}

function HeaderPreview({
  logoUrl,
  primaryColor,
  accentColor,
  tagline,
  layout,
  orgName,
}) {
  const logo = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logoUrl}
      alt="Logo"
      className="h-7 w-auto object-contain"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  ) : (
    <span className="text-sm font-semibold">{orgName}</span>
  );

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      {/* Fake header */}
      <div className="flex items-center justify-between border-b border-gray-200 bg-white/90 px-4 py-3">
        {layout === "centered" ? (
          <>
            <div className="flex flex-1 items-center gap-3">
              <span className="text-xs text-gray-500">Shop</span>
              <span className="text-xs text-gray-500">Collections</span>
            </div>
            <div className="flex-1 flex justify-center">{logo}</div>
            <div className="flex flex-1 items-center justify-end">
              <div
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          </>
        ) : (
          <>
            {logo}
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">Shop</span>
              <span className="text-xs text-gray-500">Collections</span>
              <div
                className="h-6 w-6 rounded-full"
                style={{ backgroundColor: primaryColor }}
              />
            </div>
          </>
        )}
      </div>

      {/* Fake hero */}
      <div className="bg-white px-4 py-6">
        <p className="text-lg font-semibold text-gray-900">
          {tagline || `Welcome to ${orgName}`}
        </p>
        <div className="mt-3 flex gap-2">
          <div
            className="h-8 w-24 rounded-full"
            style={{ backgroundColor: primaryColor }}
          />
          <div className="h-8 w-24 rounded-full border border-gray-300" />
        </div>
        <div className="mt-4">
          <span
            className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: accentColor }}
          >
            Sale
          </span>
        </div>
      </div>
    </div>
  );
}