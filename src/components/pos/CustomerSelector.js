"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function CustomerSelector({ selectedCustomer, onSelectCustomer, onClearCustomer }) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ fullname: "", email: "", phone: "" });
  const { activeOrganization, can } = useSessionStore();
  const canCreateCustomers = can(PERMISSIONS.CREATE_CUSTOMERS);

  const debounceTimer = useRef(null);

  const searchCustomers = useCallback(async (query) => {
    if (!query.trim()) {
      setCustomers([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch(`/customers?search=${encodeURIComponent(query)}&limit=20`);
      setCustomers(res?.customers || []);
      setShowDropdown(true);
    } catch (err) {
      console.error("Customer search failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      searchCustomers(search);
    }, 300);
    return () => clearTimeout(debounceTimer.current);
  }, [search, searchCustomers]);

  const handleSelect = (customer) => {
    onSelectCustomer(customer);
    setSearch("");
    setShowDropdown(false);
    setCustomers([]);
  };

  const handleClear = () => {
    onClearCustomer();
    setSearch("");
    setShowDropdown(false);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.fullname.trim()) return;
    setCreating(true);
    try {
      const res = await apiFetch("/customers", {
        method: "POST",
        body: {
          fullname: newCustomer.fullname.trim(),
          email: newCustomer.email.trim() || undefined,
          phone: newCustomer.phone.trim() || undefined,
        },
      });
      const created = res?.customer;
      if (created) {
        onSelectCustomer(created);
        setShowCreateModal(false);
        setNewCustomer({ fullname: "", email: "", phone: "" });
        setSearch("");
        setShowDropdown(false);
      }
    } catch (err) {
      console.error("Failed to create customer:", err);
      alert(err.message || "Failed to create customer");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="relative">
      {selectedCustomer ? (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
          <div>
            <p className="font-medium text-zinc-900">{selectedCustomer.fullname}</p>
            {selectedCustomer.email && <p className="text-xs text-zinc-600">{selectedCustomer.email}</p>}
            {selectedCustomer.loyaltyPoints > 0 && (
              <p className="text-xs text-zinc-500">{selectedCustomer.loyaltyPoints} points</p>
            )}
          </div>
          <button onClick={handleClear} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
      ) : (
        <div className="relative">
          <input
            type="text"
            placeholder="Search or create customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => search.trim() && setShowDropdown(true)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showDropdown && (customers.length > 0 || loading) && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
              {loading ? (
                <div className="p-3 text-sm text-zinc-500">Searching...</div>
              ) : (
                <>
                  {customers.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => handleSelect(c)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-sm"
                    >
                      <p className="font-medium">{c.fullname}</p>
                      {c.email && <p className="text-xs text-zinc-500">{c.email}</p>}
                      {c.loyaltyPoints > 0 && <p className="text-xs text-zinc-400">{c.loyaltyPoints} pts</p>}
                    </button>
                  ))}
                  {canCreateCustomers && (
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-zinc-50 border-t"
                    >
                      + Create new customer
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4">Create Customer</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newCustomer.fullname}
                  onChange={(e) => setNewCustomer({ ...newCustomer, fullname: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Email</label>
                <input
                  type="email"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Phone</label>
                <input
                  type="tel"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newCustomer.fullname.trim()}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}