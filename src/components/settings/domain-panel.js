"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api-client";

export function DomainPanel({ website, orgId, onUpdated }) {
  const [domainInput, setDomainInput] = useState("");
  const [working, setWorking] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const currentDomain = website?.domain || "";
  const verified = website?.domainVerified === true;
  const verification = website?.domainVerification || {};

    useEffect(() => {
        if (verified) setInfo("");
    }, [verified]);

  const handleAdd = async () => {
    const clean = domainInput.toLowerCase().trim();
    if (!clean) return;
    setError("");
    setInfo("");
    setWorking(true);
    try {
      const res = await apiFetch(
        `/organizations/${orgId}/website/domain`,
        { method: "POST", body: { domain: clean } },
      );
      if (res?.organization) onUpdated(res.organization);
      setInfo(res?.message || "Domain added.");
      setDomainInput("");
      if (res?.vercelError) setError(res.vercelError);
    } catch (err) {
      setError(err?.message || "Failed to add domain.");
    } finally {
      setWorking(false);
    }
  };

  const handleCheck = async () => {
    setError("");
    setInfo("");
    setChecking(true);
    try {
      const res = await apiFetch(
        `/organizations/${orgId}/website/domain/status`,
      );
      if (res?.verified) {
        setInfo("Domain verified.");
        // Refresh org to pull the new website object
        const fresh = await apiFetch(`/organizations/${orgId}`);
        if (fresh?.organization) onUpdated(fresh.organization);
      } else {
        setInfo("Not verified yet — DNS may still be propagating.");
      }
    } catch (err) {
      setError(err?.message || "Failed to check status.");
    } finally {
      setChecking(false);
    }
  };

  const handleRemove = async () => {
    if (
      !confirm(
        `Remove ${currentDomain}? Visitors using this domain will lose access.`,
      )
    ) {
      return;
    }
    setError("");
    setInfo("");
    setWorking(true);
    try {
      const res = await apiFetch(
        `/organizations/${orgId}/website/domain`,
        { method: "DELETE" },
      );
      if (res?.organization) onUpdated(res.organization);
      setInfo(res?.message || "Domain removed.");
      if (res?.vercelError) setError(res.vercelError);
    } catch (err) {
      setError(err?.message || "Failed to remove domain.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">
          Custom domain
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Point your own domain (e.g. <span className="font-mono">shop.example.com</span>)
          at your storefront. Requires DNS setup.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}
      {info && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-800">{info}</p>
        </div>
      )}

      {!currentDomain ? (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Domain
          </label>
          <input
            type="text"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value.toLowerCase())}
            placeholder="shop.example.com"
            className="block w-full px-3 py-2 border border-gray-300 rounded-md font-mono text-sm focus:border-indigo-500 focus:outline-none"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAdd}
              disabled={working || !domainInput.trim()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {working ? "Adding…" : "Add domain"}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2 min-w-0">
              {verified ? (
                <span className="inline-block h-2 w-2 rounded-full bg-green-500 flex-shrink-0" />
              ) : (
                <span className="inline-block h-2 w-2 rounded-full bg-yellow-500 flex-shrink-0" />
              )}
              <span className="font-mono text-sm text-gray-900 truncate">
                {currentDomain}
              </span>
              <span className="text-xs text-gray-500 flex-shrink-0">
                {verified ? "Verified" : "Pending verification"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!verified && (
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={checking}
                  className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-md hover:bg-white disabled:opacity-50"
                >
                  {checking ? "Checking…" : "Check status"}
                </button>
              )}
              <button
                type="button"
                onClick={handleRemove}
                disabled={working}
                className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-md hover:bg-red-50 disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>

          {!verified && (
            <div className="rounded-md border border-gray-200 bg-white p-4">
              <p className="text-sm font-medium text-gray-900 mb-2">
                DNS setup
              </p>
              <p className="text-xs text-gray-600 mb-3">
                Add these records at your DNS provider, then click{" "}
                <strong>Check status</strong>.
              </p>
              <div className="space-y-3">
                <DnsRow
                  type="CNAME"
                  name={currentDomain.split(".")[0] || "@"}
                  value={verification.cnameTarget || "cname.vercel-dns-0.com"}
                />
                {verification.txtName && verification.txtValue && (
                  <DnsRow
                    type="TXT"
                    name={verification.txtName}
                    value={verification.txtValue}
                  />
                )}
              </div>
              {verification.error && (
                <p className="mt-3 text-xs text-red-700">
                  {verification.error}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DnsRow({ type, name, value }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="grid grid-cols-[60px_1fr] gap-3 text-xs">
      <span className="font-mono uppercase text-gray-500 pt-1">{type}</span>
      <div className="space-y-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 w-14 flex-shrink-0">Name</span>
          <span className="font-mono text-gray-900 truncate">{name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 w-14 flex-shrink-0">Value</span>
          <span className="font-mono text-gray-900 truncate flex-1">
            {value}
          </span>
          <button
            type="button"
            onClick={copy}
            className="text-[10px] uppercase tracking-wide text-indigo-600 hover:text-indigo-800 flex-shrink-0"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}