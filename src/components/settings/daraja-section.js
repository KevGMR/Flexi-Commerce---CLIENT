"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api-client";

const SECRET_FIELDS = ["consumerKey", "consumerSecret", "passkey"];

export function DarajaSection({ daraja, orgId, onSave, saving, canEdit = true }) {
  const [env, setEnv] = useState(daraja?.environment || "sandbox");
  const [shortcode, setShortcode] = useState(daraja?.shortcode || "");
  const [txType, setTxType] = useState(
    daraja?.transactionType || "CustomerPayBillOnline",
  );
  const [enabled, setEnabled] = useState(daraja?.enabled === true);
  const [stkEnabled, setStkEnabled] = useState(daraja?.mpesaStkEnabled === true);

  // For secret fields, `null` = keep existing; a string = replace
  const [consumerKey, setConsumerKey] = useState(null);
  const [consumerSecret, setConsumerSecret] = useState(null);
  const [passkey, setPasskey] = useState(null);

  const [replacing, setReplacing] = useState({
    consumerKey: false,
    consumerSecret: false,
    passkey: false,
  });

  const [copied, setCopied] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState("");
  const [loadingUrl, setLoadingUrl] = useState(false);

  const fieldIsSet = (name) => daraja?.[name]?.set === true;
  const fieldPreview = (name) => daraja?.[name]?.preview || "";

  const handleReplace = (name) => {
    setReplacing((r) => ({ ...r, [name]: true }));
    if (name === "consumerKey") setConsumerKey("");
    if (name === "consumerSecret") setConsumerSecret("");
    if (name === "passkey") setPasskey("");
  };

  const handleCancelReplace = (name) => {
    setReplacing((r) => ({ ...r, [name]: false }));
    if (name === "consumerKey") setConsumerKey(null);
    if (name === "consumerSecret") setConsumerSecret(null);
    if (name === "passkey") setPasskey(null);
  };

  const fetchCallbackUrl = async () => {
    setLoadingUrl(true);
    try {
      const res = await apiFetch(`/organizations/${orgId}/daraja/callback-url`);
      setCallbackUrl(res?.url || "");
    } catch (e) {
      setCallbackUrl("");
    } finally {
      setLoadingUrl(false);
    }
  };

  const copyUrl = async () => {
    if (!callbackUrl) return;
    try {
      await navigator.clipboard.writeText(callbackUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleSave = () => {
    const payload = {
      enabled,
      environment: env,
      shortcode: shortcode.trim(),
      transactionType: txType,
      mpesaStkEnabled: stkEnabled,
    };
    if (consumerKey !== null) payload.consumerKey = consumerKey;
    if (consumerSecret !== null) payload.consumerSecret = consumerSecret;
    if (passkey !== null) payload.passkey = passkey;
    onSave({ daraja: payload });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">
            Daraja M-Pesa
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Safaricom credentials for STK push prompts.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={!canEdit}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          <span className="text-sm text-gray-700">Enabled</span>
        </label>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Environment
            </label>
            <select
              value={env}
              onChange={(e) => setEnv(e.target.value)}
              disabled={!canEdit}
              className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="sandbox">Sandbox</option>
              <option value="production">Production</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Shortcode
            </label>
            <input
              type="text"
              value={shortcode}
              onChange={(e) => setShortcode(e.target.value)}
              disabled={!canEdit}
              placeholder="174379"
              className="block w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Transaction type
          </label>
          <select
            value={txType}
            onChange={(e) => setTxType(e.target.value)}
            disabled={!canEdit}
            className="block w-full rounded border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="CustomerPayBillOnline">Paybill (CustomerPayBillOnline)</option>
            <option value="CustomerBuyGoodsOnline">Buy Goods (CustomerBuyGoodsOnline)</option>
          </select>
        </div>

        {SECRET_FIELDS.map((name) => (
          <div key={name}>
            <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
              {name.replace(/([A-Z])/g, " $1").trim()}
            </label>
            {replacing[name] || !fieldIsSet(name) ? (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={
                    name === "consumerKey"
                      ? consumerKey || ""
                      : name === "consumerSecret"
                        ? consumerSecret || ""
                        : passkey || ""
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (name === "consumerKey") setConsumerKey(v);
                    if (name === "consumerSecret") setConsumerSecret(v);
                    if (name === "passkey") setPasskey(v);
                  }}
                  disabled={!canEdit}
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm font-mono"
                />
                {fieldIsSet(name) && (
                  <button
                    type="button"
                    onClick={() => handleCancelReplace(name)}
                    className="rounded border border-gray-300 px-3 text-xs text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  {fieldPreview(name)}
                </code>
                <button
                  type="button"
                  onClick={() => handleReplace(name)}
                  disabled={!canEdit}
                  className="rounded border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Replace
                </button>
              </div>
            )}
          </div>
        ))}

        <div className="border-t border-gray-200 pt-4">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={stkEnabled}
              onChange={(e) => setStkEnabled(e.target.checked)}
              disabled={!canEdit || !enabled}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600"
            />
            <div>
              <span className="block text-sm font-medium text-gray-900">
                Enable M-Pesa STK prompt
              </span>
              <span className="block text-xs text-gray-500 mt-0.5">
                When on, the POS shows an "M-Pesa (Prompt)" tile alongside
                regular M-Pesa. Locations can override this individually.
              </span>
            </div>
          </label>
        </div>

        {enabled && (
          <div className="rounded border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-medium text-blue-900">
                  Daraja callback URL
                </p>
                {loadingUrl ? (
                  <p className="text-xs text-blue-700 mt-1">Loading…</p>
                ) : callbackUrl ? (
                  <code className="block text-xs text-blue-900 mt-1 break-all font-mono">
                    {callbackUrl}
                  </code>
                ) : (
                  <p className="text-xs text-blue-700 mt-1">
                    Click "Load" to reveal the URL. Paste this into your
                    Safaricom Daraja portal.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={callbackUrl ? copyUrl : fetchCallbackUrl}
                className="shrink-0 rounded border border-blue-300 bg-white px-2 py-1 text-xs font-medium text-blue-800 hover:bg-blue-50"
              >
                {callbackUrl ? (copied ? "Copied" : "Copy") : "Load"}
              </button>
            </div>
          </div>
        )}
      </div>

      {canEdit && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Daraja settings"}
          </button>
        </div>
      )}
    </div>
  );
}