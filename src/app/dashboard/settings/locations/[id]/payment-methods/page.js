// client/src/app/dashboard/settings/locations/[id]/payment-methods/page.js
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { PaymentMethodsSection } from "@/components/settings/payment-methods-section";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function LocationPaymentMethodsPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params.id;
  const { activeOrganization, can } = useSessionStore();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingStk, setSavingStk] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [location, setLocation] = useState(null);
  const [orgDefaults, setOrgDefaults] = useState([]);
  const [orgDarajaEnabled, setOrgDarajaEnabled] = useState(false);
  const [methods, setMethods] = useState([]);
  const [stkOverride, setStkOverride] = useState(null); // true | false | null

  const canEdit = can?.(PERMISSIONS.VIEW_SETTINGS) ?? false;

  useEffect(() => {
    const load = async () => {
      try {
        const [locRes, orgRes] = await Promise.all([
          apiFetch(`/locations/${locationId}`),
          apiFetch(`/organizations/${activeOrganization._id}`),
        ]);
        const loc = locRes?.location || locRes;
        setLocation(loc);
        setMethods(Array.isArray(loc?.paymentMethods) ? loc.paymentMethods : []);
        setStkOverride(
          loc?.mpesaStkEnabled === true
            ? true
            : loc?.mpesaStkEnabled === false
              ? false
              : null,
        );
        
        const org = orgRes?.organization;
        setOrgDefaults(
          Array.isArray(org?.website?.paymentMethods) ? org.website.paymentMethods : [],
        );
        setOrgDarajaEnabled(
          org?.daraja?.enabled === true && org?.daraja?.mpesaStkEnabled === true,
        );
      } catch (err) {
        setError(err?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    };
    if (locationId && activeOrganization?._id) load();
  }, [locationId, activeOrganization?._id]);

  const handleSaveMethods = async () => {
    setSaving(true);
    setError("");
    setStatus("");
    try {
      const res = await apiFetch(`/locations/${locationId}`, {
        method: "PUT",
        body: { paymentMethods: methods },
      });
      const updated = res?.location || res;
      if (updated?.paymentMethods) setMethods(updated.paymentMethods);
      setStatus("Payment methods saved.");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStk = async () => {
    setSavingStk(true);
    setError("");
    setStatus("");
    try {
      const res = await apiFetch(`/locations/${locationId}`, {
        method: "PUT",
        body: { mpesaStkEnabled: stkOverride },
      });
      const updated = res?.location || res;
      setStkOverride(
        updated?.mpesaStkEnabled === true
          ? true
          : updated?.mpesaStkEnabled === false
            ? false
            : null,
      );
      setStatus("M-Pesa STK setting saved.");
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setError(err?.message || "Failed to save STK setting");
    } finally {
      setSavingStk(false);
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
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <button
          type="button"
          onClick={() => router.push("/dashboard/settings/locations")}
          className="text-sm text-gray-500 hover:text-gray-900 mb-1"
        >
          ← Locations
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Payment methods</h1>
        <p className="mt-1 text-sm text-gray-600">
          {location?.name || "Location"}
          {location?.address?.city ? ` · ${location.address.city}` : ""}
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

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <PaymentMethodsSection
          value={methods}
          onChange={setMethods}
          allowEmpty={true}
          orgDefaults={orgDefaults}
          mode="location"
        />
        {canEdit && (
          <div className="mt-4 flex justify-end border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleSaveMethods}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save payment methods"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900">
            M-Pesa STK prompt
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Whether the POS at this location shows the "M-Pesa (Prompt)" tile.
          </p>
        </div>

        {!orgDarajaEnabled && (
          <div className="mb-4 rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs text-amber-800">
              Daraja is not enabled at the organization level. Enable it in{" "}
              <a
                href="/dashboard/settings/organization"
                className="underline font-medium"
              >
                Organization settings
              </a>{" "}
              first.
            </p>
          </div>
        )}

        <div className="space-y-2">
          {[
            { value: null, label: "Inherit from organization" },
            { value: true, label: "On (show STK tile at this location)" },
            { value: false, label: "Off (hide STK tile at this location)" },
          ].map((opt) => (
            <label
              key={String(opt.value)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <input
                type="radio"
                checked={stkOverride === opt.value}
                onChange={() => setStkOverride(opt.value)}
                disabled={!canEdit || !orgDarajaEnabled}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>

        {canEdit && (
          <div className="mt-4 flex justify-end border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={handleSaveStk}
              disabled={savingStk || !orgDarajaEnabled}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {savingStk ? "Saving…" : "Save STK setting"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}