"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { collectionsApi } from "@/lib/api-client";

export default function CollectionPicker({ value = [], onChange }) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef(null);

    // Normalize: value may contain IDs, populated objects, or a mix.
    // Also dedupe, since the source can arrive with the same collection twice.
    const normalizedValue = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const v of value || []) {
        const id = v && typeof v === "object" ? v._id : v;
        if (!id) continue;
        const key = String(id);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(id);
    }
    return out;
    }, [value]);

  const load = () => {
    setLoading(true);
    collectionsApi
      .list({ limit: 500 })
      .then((data) => {
        setAll(data.collections || []);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const byId = useMemo(() => {
    const m = new Map();
    for (const c of all) m.set(String(c._id), c);
    return m;
  }, [all]);

  const pathLabel = (c) => {
    const parts = [c.name];
    let parentId = c.parentCollectionId;
    let guard = 0;
    while (parentId && guard++ < 10) {
      const p = byId.get(String(parentId));
      if (!p) break;
      parts.unshift(p.name);
      parentId = p.parentCollectionId;
    }
    return parts.join(" / ");
  };

  const selectedSet = useMemo(
    () => new Set(normalizedValue.map(String)),
    [normalizedValue],
  );

  const suggestions = useMemo(() => {
    const q = query.toLowerCase().trim();
    return all
      .filter((c) => c.type === "manual")
      .filter((c) => !selectedSet.has(String(c._id)))
      .filter((c) => !q || pathLabel(c).toLowerCase().includes(q))
      .slice(0, 8);
  }, [all, query, selectedSet]);

  const add = (id) => {
    onChange([...normalizedValue, id]);
    setQuery("");
    setOpen(false);
  };

  const remove = (id) => {
    onChange(normalizedValue.filter((v) => String(v) !== String(id)));
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await collectionsApi.create({
        name: newName.trim(),
        type: "manual",
      });
      setAll((prev) => [...prev, res.collection]);
      onChange([...normalizedValue, res.collection._id]);
      setShowCreate(false);
      setNewName("");
      setQuery("");
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-2" ref={wrapRef}>
      {normalizedValue.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {normalizedValue.map((id) => {
            const c = byId.get(String(id));
            if (!c) {
              return (
                <span
                  key={String(id)}
                  className="px-2 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs"
                >
                  Missing collection
                </span>
              );
            }
            return (
              <span
                key={String(id)}
                className="px-2 py-1 bg-gray-100 rounded-full text-xs flex items-center gap-1"
              >
                {pathLabel(c)}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="text-gray-500 hover:text-black"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search collections to add…"
          className="w-full px-3 py-2 border rounded-md text-sm"
        />

        {open && (
          <div className="absolute z-20 mt-1 w-full bg-white border rounded-md shadow-lg max-h-64 overflow-auto">
            {loading ? (
              <div className="px-3 py-2 text-xs text-gray-500">Loading…</div>
            ) : suggestions.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-500">
                No matching collections
              </div>
            ) : (
              suggestions.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => add(c._id)}
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm flex items-center justify-between"
                >
                  <span>{pathLabel(c)}</span>
                  <span className="text-xs text-gray-400">
                    {c.productCount || 0}
                  </span>
                </button>
              ))
            )}

            {query.trim() && (
              <button
                type="button"
                onClick={() => {
                  setNewName(query.trim());
                  setShowCreate(true);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 border-t hover:bg-gray-50 text-sm text-blue-600"
              >
                + Create &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold mb-3">New collection</h3>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setNewName("");
                }}
                disabled={creating}
                className="px-3 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-3 py-2 bg-black text-white rounded text-sm disabled:opacity-50"
              >
                {creating ? "Creating…" : "Create & add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}   