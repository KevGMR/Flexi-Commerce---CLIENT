"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import SingleImageUploader from "@/components/collections/SingleImageUploader";

const DEFAULT_CONFIG = {
  logoUrl: "",
  headerLines: [],
  footerParagraphs: [],
  thankYouLine: "Thank you for your purchase!",
  termsLine: "",
  showReceiptTitle: true,
  showOrganizationName: true,
  showLocationName: true,
  showLocationAddress: true,
  showLocationPhone: true,
  showTaxId: false,
  showCashier: true,
  showCustomer: true,
  showNotes: true,
  showDeliveryBlock: true,
  customTaxIdLabel: "Tax ID",
  locationNameMaxWords: 0,
  locationAddressMaxWords: 0,
};

export default function ReceiptSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState(null);
  const [org, setOrg] = useState(null);

  const [config, setConfig] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    const load = async () => {
      try {
        const [locRes, orgRes] = await Promise.all([
          apiFetch(`/locations/${locationId}`),
          apiFetch(`/organizations/me`).catch(() => null),
        ]);

        const loc = locRes?.location || locRes;
        setLocation(loc);
        setOrg(orgRes?.organization || null);

        // Merge saved config over defaults so new fields get sensible values
        setConfig({
          ...DEFAULT_CONFIG,
          ...(loc?.receipt || {}),
        });
      } catch (err) {
        setError(err?.message || "Failed to load location");
      } finally {
        setLoading(false);
      }
    };
    if (locationId) load();
  }, [locationId]);

  const update = (patch) => setConfig((c) => ({ ...c, ...patch }));

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      await apiFetch(`/locations/${locationId}/receipt`, {
        method: "PATCH",
        body: config,
      });
      setStatus("Receipt settings saved.");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setError(err?.message || "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm("Reset all receipt settings to defaults?")) return;
    setConfig(DEFAULT_CONFIG);
  };

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.push("/dashboard/settings/locations")}
            className="text-sm text-gray-500 hover:text-gray-900 mb-1"
          >
            ← Locations
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            Receipt settings
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            {location?.name || "Location"}
            {location?.address?.city ? ` · ${location.address.city}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT — form */}
        <div className="space-y-6">
          {/* Logo */}
          <Section title="Logo">
            <SingleImageUploader
              label="Receipt logo"
              value={
                config.logoUrl
                  ? { url: config.logoUrl, alt: "", shopifyFileId: null }
                  : null
              }
              onChange={(img) => update({ logoUrl: img?.url || "" })}
            />
            <p className="mt-2 text-xs text-gray-500">
              Printed at the top of the receipt. PNG with transparent background
              works best. Keep it under 300px wide for thermal printers.
            </p>
          </Section>

          {/* Header lines */}
          <Section title="Header lines">
            <p className="text-xs text-gray-500 mb-3">
              Up to 4 short lines, printed below the location name. Use for
              hours, phone, or a tagline.
            </p>
            {config.headerLines.map((line, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={line}
                  onChange={(e) => {
                    const next = [...config.headerLines];
                    next[i] = e.target.value;
                    update({ headerLines: next });
                  }}
                  maxLength={100}
                  placeholder={`Line ${i + 1}`}
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    update({
                      headerLines: config.headerLines.filter((_, idx) => idx !== i),
                    })
                  }
                  className="px-3 text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
            {config.headerLines.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  update({ headerLines: [...config.headerLines, ""] })
                }
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                + Add header line
              </button>
            )}
          </Section>

          {/* What to show */}
          <Section title="What to show">
            <div className="space-y-3">
                <Toggle
                label="Receipt title"
                checked={config.showReceiptTitle}
                onChange={(v) => update({ showReceiptTitle: v })}
              />
              <Toggle
                label="Organization name"
                checked={config.showOrganizationName}
                onChange={(v) => update({ showOrganizationName: v })}
              />
              <div>
                <Toggle
                  label="Location name"
                  checked={config.showLocationName}
                  onChange={(v) => update({ showLocationName: v })}
                />
                {config.showLocationName && (
                  <div className="ml-6 mt-1 flex items-center gap-2">
                    <label className="text-xs text-gray-500">
                      Max words:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={config.locationNameMaxWords ?? 0}
                      onChange={(e) =>
                        update({
                          locationNameMaxWords: Math.max(
                            0,
                            Math.min(50, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <span className="text-xs text-gray-400">
                      (0 = no limit)
                    </span>
                  </div>
                )}
              </div>

              <div>
                <Toggle
                  label="Location address"
                  checked={config.showLocationAddress}
                  onChange={(v) => update({ showLocationAddress: v })}
                />
                {config.showLocationAddress && (
                  <div className="ml-6 mt-1 flex items-center gap-2">
                    <label className="text-xs text-gray-500">
                      Max words:
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      value={config.locationAddressMaxWords ?? 0}
                      onChange={(e) =>
                        update({
                          locationAddressMaxWords: Math.max(
                            0,
                            Math.min(50, Number(e.target.value) || 0),
                          ),
                        })
                      }
                      className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
                    />
                    <span className="text-xs text-gray-400">
                      (0 = no limit)
                    </span>
                  </div>
                )}
              </div>
              <Toggle
                label="Location phone"
                checked={config.showLocationPhone}
                onChange={(v) => update({ showLocationPhone: v })}
              />
              <Toggle
                label="Tax ID"
                checked={config.showTaxId}
                onChange={(v) => update({ showTaxId: v })}
              />
              {config.showTaxId && (
                <div className="ml-6 mt-1">
                  <input
                    type="text"
                    value={config.customTaxIdLabel}
                    onChange={(e) =>
                      update({ customTaxIdLabel: e.target.value })
                    }
                    maxLength={40}
                    placeholder="Label"
                    className="block w-48 rounded border border-gray-300 px-3 py-1.5 text-sm"
                  />
                </div>
              )}
              <Toggle
                label="Cashier name"
                checked={config.showCashier}
                onChange={(v) => update({ showCashier: v })}
              />
              <Toggle
                label="Customer name"
                checked={config.showCustomer}
                onChange={(v) => update({ showCustomer: v })}
              />
              <Toggle
                label="Notes"
                checked={config.showNotes}
                onChange={(v) => update({ showNotes: v })}
              />
              <Toggle
                label="Delivery block"
                checked={config.showDeliveryBlock}
                onChange={(v) => update({ showDeliveryBlock: v })}
              />
            </div>
          </Section>

          {/* Footer paragraphs */}
          <Section title="Footer paragraphs">
            <p className="text-xs text-gray-500 mb-3">
              Up to 4 paragraphs, printed above the thank-you line. Use for
              policies, terms, or promotions.
            </p>
            {config.footerParagraphs.map((para, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <textarea
                  value={para}
                  onChange={(e) => {
                    const next = [...config.footerParagraphs];
                    next[i] = e.target.value;
                    update({ footerParagraphs: next });
                  }}
                  rows={3}
                  maxLength={300}
                  placeholder={`Paragraph ${i + 1}`}
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() =>
                    update({
                      footerParagraphs: config.footerParagraphs.filter(
                        (_, idx) => idx !== i,
                      ),
                    })
                  }
                  className="px-3 text-red-500 hover:text-red-700 self-start mt-2"
                >
                  ✕
                </button>
              </div>
            ))}
            {config.footerParagraphs.length < 4 && (
              <button
                type="button"
                onClick={() =>
                  update({
                    footerParagraphs: [...config.footerParagraphs, ""],
                  })
                }
                className="text-sm text-indigo-600 hover:text-indigo-700"
              >
                + Add paragraph
              </button>
            )}
          </Section>

          {/* Sign-off lines */}
          <Section title="Sign-off">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Thank-you line
                </label>
                <input
                  type="text"
                  value={config.thankYouLine}
                  onChange={(e) => update({ thankYouLine: e.target.value })}
                  maxLength={200}
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Terms line (optional)
                </label>
                <input
                  type="text"
                  value={config.termsLine}
                  onChange={(e) => update({ termsLine: e.target.value })}
                  maxLength={300}
                  placeholder="e.g. Goods sold are not returnable after 7 days"
                  className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </Section>
        </div>

        {/* RIGHT — preview */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 text-sm font-medium text-gray-700">Preview</p>
          <ReceiptPreview
            config={config}
            organizationName={org?.name || ""}
            location={location}
          />
          <p className="mt-3 text-xs text-gray-500">
            Approximate preview. The actual printed receipt uses these settings
            with real transaction data.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-indigo-600"
      />
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function clampWords(text, maxWords) {
  if (!text) return "";
  const n = Number(maxWords);
  if (!Number.isFinite(n) || n <= 0) return text;
  const words = String(text).trim().split(/\s+/);
  if (words.length <= n) return text;
  return words.slice(0, n).join(" ");
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

function ReceiptPreview({ config, organizationName, location }) {
  // Mock receipt data so the preview shows a full-looking layout
  const mock = {
    receiptNumber: "REC-DEMO-0001",
    timestamp: new Date().toISOString(),
    items: [
      { name: "Sample item A", quantity: 1, price: 1500 },
      { name: "Sample item B", quantity: 2, price: 750 },
    ],
    payments: [{ method: "cash", amount: 3000 }],
    subtotal: 3000,
    deliveryFee: 0,
    notes: "",
    customerName: "",
  };

  const showAddress =
    config.showLocationAddress &&
    (location?.address?.street || location?.address?.city);

  return (
    <div className="rounded-lg border border-gray-200 bg-neutral-100 p-6">
      <div className="mx-auto max-w-[320px] bg-white p-4 shadow-sm font-mono text-[10px] leading-tight text-neutral-900">
        {/* Logo */}
        {config.logoUrl && (
          <div className="mb-2 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={config.logoUrl}
              alt="Logo"
              className="max-h-12 max-w-[180px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        )}

        {/* Header */}
        <div className="text-center border-b border-dashed border-neutral-400 pb-2">
        {config.showReceiptTitle && (
            <div className="text-[10px] font-bold tracking-wide">RECEIPT</div>
            )}
          {config.showOrganizationName && (
            <div className="font-bold">{organizationName || "YOUR STORE"}</div>
          )}
          {config.showLocationName && location?.name && (
            <div>
              {clampWords(location.name, config.locationNameMaxWords)}
            </div>
          )}
          {showAddress && (
            <div>
              {clampWords(
                [
                  location?.address?.street,
                  location?.address?.city,
                ]
                  .filter(Boolean)
                  .join(", "),
                config.locationAddressMaxWords,
              )}
            </div>
          )}
          {config.showLocationPhone && location?.phone && (
            <div>{location.phone}</div>
          )}
          {config.showTaxId && (
            <div>
              {config.customTaxIdLabel}: TAXID-1234
            </div>
          )}
          {config.headerLines
            .filter((l) => l && l.trim())
            .map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          <div className="mt-1">Receipt #{mock.receiptNumber}</div>
          <div className="text-[9px] text-neutral-500">
            {new Date(mock.timestamp).toLocaleString()}
          </div>
          {config.showCashier && <div>Cashier: Jane Doe</div>}
          {config.showCustomer && mock.customerName && (
            <div>Customer: {mock.customerName}</div>
          )}
        </div>

        {/* Items */}
        <div className="py-2 border-b border-dashed border-neutral-400">
          {mock.items.map((it, i) => (
            <div key={i} className="mb-1">
              <div className="flex justify-between">
                <span>{it.name}</span>
                <span>KES {(it.price * it.quantity).toFixed(2)}</span>
              </div>
              <div className="text-[9px] text-neutral-500">
                Qty {it.quantity} × {it.price.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="py-2 border-b border-dashed border-neutral-400">
          <div className="flex justify-between font-bold">
            <span>TOTAL</span>
            <span>KES {mock.subtotal.toFixed(2)}</span>
          </div>
          {mock.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-[9px]">
              <span className="capitalize">{p.method}</span>
              <span>{p.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Notes */}
        {config.showNotes && mock.notes && (
          <div className="py-2 border-b border-dashed border-neutral-400">
            Notes: {mock.notes}
          </div>
        )}

        {/* Footer paragraphs */}
        {config.footerParagraphs
          .filter((p) => p && p.trim())
          .map((para, i) => (
            <div key={i} className="mt-2 text-center text-[9px] whitespace-pre-line">
              {para}
            </div>
          ))}

        {/* Terms */}
        {config.termsLine && (
          <div className="mt-2 text-center text-[9px] text-neutral-500 whitespace-pre-line">
            {config.termsLine}
          </div>
        )}

        {/* Thank you */}
        {config.thankYouLine && (
          <div className="mt-3 text-center font-bold">
            {config.thankYouLine}
          </div>
        )}
      </div>
    </div>
  );
}