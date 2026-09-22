"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";
import { PERMISSIONS } from "@/lib/permissions";

export default function CustomerSelector({
  selectedCustomer,
  onSelectCustomer,
  onClearCustomer,
}) {
  const [search, setSearch] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    fullname: "",
    email: "",
    phone: "",
    address: {
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Kenya",
    },
  });
  const [includeAddress, setIncludeAddress] = useState(false);
  const { activeOrganization, can, permissions } = useSessionStore();
  const canCreateCustomers = can(PERMISSIONS.CREATE_CUSTOMERS);

  useEffect(() => {
    console.log("[CustomerSelector] Current permissions:", permissions);
    console.log("[CustomerSelector] Has CREATE_CUSTOMERS:", canCreateCustomers);
  }, [permissions, canCreateCustomers]);

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

  const openCreateModal = (prefilledName = "") => {
    setNewCustomer({
      fullname: prefilledName,
      email: "",
      phone: "",
      address: {
        street: "",
        city: "",
        state: "",
        postalCode: "",
        country: "Kenya",
      },
    });
    setIncludeAddress(false);
    setShowCreateModal(true);
    setShowDropdown(false);
  };

  const handleCreateCustomer = async (e) => {
    e.preventDefault();
    if (!newCustomer.fullname.trim()) return;
    setCreating(true);
    try {
      const payload = {
        fullname: newCustomer.fullname.trim(),
        email: newCustomer.email.trim() || undefined,
        phone: newCustomer.phone.trim() || undefined,
      };
      if (includeAddress) {
        payload.address = newCustomer.address;
      }
      const res = await apiFetch("/customers", {
        method: "POST",
        body: payload,
      });
      const created = res?.customer;
      if (created) {
        onSelectCustomer(created);
        setShowCreateModal(false);
        setNewCustomer({
          fullname: "",
          email: "",
          phone: "",
          address: {
            street: "",
            city: "",
            state: "",
            postalCode: "",
            country: "Kenya",
          },
        });
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

  const refreshPermissions = async () => {
    await useSessionStore.getState().refreshPermissions();
    if (search.trim()) searchCustomers(search);
  };

  return (
    <div className="relative">
      {selectedCustomer ? (
        <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
          <div>
            <p className="font-medium text-zinc-900">{selectedCustomer.fullname}</p>
            {selectedCustomer.email && <p className="text-xs text-zinc-600">{selectedCustomer.email}</p>}
            {selectedCustomer.phone && <p className="text-xs text-zinc-600">{selectedCustomer.phone}</p>}
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
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => search.trim() && setShowDropdown(true)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {showDropdown && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
              {loading ? (
                <div className="p-3 text-sm text-zinc-500">Searching...</div>
              ) : customers.length > 0 ? (
                <>
                  {customers.map((c) => (
                    <button
                      key={c._id}
                      onClick={() => handleSelect(c)}
                      className="w-full text-left px-3 py-2 hover:bg-zinc-50 text-sm border-b border-zinc-100 last:border-0"
                    >
                      <p className="font-medium text-zinc-900">{c.fullname}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-zinc-500">
                        {c.email && <span>{c.email}</span>}
                        {c.phone && <span>{c.phone}</span>}
                        {c.loyaltyPoints > 0 && <span className="text-zinc-400">{c.loyaltyPoints} pts</span>}
                      </div>
                    </button>
                  ))}
                  {canCreateCustomers && (
                    <button
                      onClick={() => openCreateModal(search)}
                      className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-zinc-50 border-t"
                    >
                      + Create new customer: "{search}"
                    </button>
                  )}
                </>
              ) : search.trim() ? (
                <div className="p-4 text-sm text-zinc-600">
                  <p className="mb-2">No customers found for "{search}"</p>
                  {canCreateCustomers ? (
                    <button
                      onClick={() => openCreateModal(search)}
                      className="w-full rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                      + Create customer "{search}"
                    </button>
                  ) : (
                    <div>
                      <p className="text-xs text-red-500 mb-2">You don't have permission to create customers.</p>
                      <button
                        onClick={refreshPermissions}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Refresh permissions
                      </button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
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

              {/* Add Delivery Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">Add Delivery Address</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAddress}
                    onChange={(e) => setIncludeAddress(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Address Fields (visible when includeAddress is true) */}
              {includeAddress && (
                <div className="space-y-3 border-t border-zinc-200 pt-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Street</label>
                    <input
                      type="text"
                      value={newCustomer.address.street}
                      onChange={(e) =>
                        setNewCustomer({
                          ...newCustomer,
                          address: { ...newCustomer.address, street: e.target.value },
                        })
                      }
                      className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">City</label>
                      <input
                        type="text"
                        value={newCustomer.address.city}
                        onChange={(e) =>
                          setNewCustomer({
                            ...newCustomer,
                            address: { ...newCustomer.address, city: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">State/Province</label>
                      <input
                        type="text"
                        value={newCustomer.address.state}
                        onChange={(e) =>
                          setNewCustomer({
                            ...newCustomer,
                            address: { ...newCustomer.address, state: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">Postal Code</label>
                      <input
                        type="text"
                        value={newCustomer.address.postalCode}
                        onChange={(e) =>
                          setNewCustomer({
                            ...newCustomer,
                            address: { ...newCustomer.address, postalCode: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">Country</label>
                      <input
                        type="text"
                        value={newCustomer.address.country}
                        onChange={(e) =>
                          setNewCustomer({
                            ...newCustomer,
                            address: { ...newCustomer.address, country: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

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