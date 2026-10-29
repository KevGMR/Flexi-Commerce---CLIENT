"use client";

import { Fragment, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { collectionsApi } from "@/lib/api-client";
import { usePagination } from "@/lib/usePagination";
import { PaginationFooter } from "@/components/ui/PaginationFooter";

const TYPE_BADGES = {
  manual: "bg-gray-100 text-gray-700",
  automatic: "bg-violet-100 text-violet-800",
};

const STATUS_STYLES = {
  active: "bg-green-100 text-green-800",
  archived: "bg-yellow-100 text-yellow-800",
};

function StatusPill({ status }) {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
        STATUS_STYLES[status] || ""
      }`}
    >
      {status}
    </span>
  );
}

function buildTree(collections) {
  const byParent = new Map();
  for (const c of collections) {
    const key = c.parentCollectionId
      ? String(c.parentCollectionId)
      : "__root__";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(c);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return byParent;
}

/**
 * Flatten the tree in render order (parent first, then its children with
 * increasing depth). Result is [{ item, depth }, ...] and can be sliced for
 * pagination.
 *
 * Orphan detection: any collection whose parentCollectionId points to a
 * collection we didn't load (e.g. archived + showArchived=false) gets
 * re-parented to the root, so it isn't lost.
 */
function flattenTree(tree, loadedIds) {
  const out = [];
  const seen = new Set();

  const walk = (nodes, depth) => {
    for (const c of nodes) {
      const id = String(c._id);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ item: c, depth });
      const children = tree.get(id) || [];
      if (children.length > 0) walk(children, depth + 1);
    }
  };

  walk(tree.get("__root__") || [], 0);

  // Any collection we haven't seen yet is either orphaned (parent archived)
  // or the parent was filtered out. Re-parent it to the root.
  const allNodes = [];
  for (const list of tree.values()) {
    for (const c of list) allNodes.push(c);
  }
  for (const c of allNodes) {
    const id = String(c._id);
    if (!seen.has(id) && loadedIds.has(id)) {
      seen.add(id);
      out.push({ item: c, depth: 0 });
    }
  }

  return out;
}

export default function CollectionsPage() {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [collapsed, setCollapsed] = useState(new Set());
  const [pendingArchive, setPendingArchive] = useState(null);
  const [archiving, setArchiving] = useState(false);

  const pag = usePagination({
    initialPageSize: 50,
    resetKey: [search, showArchived],
  });
  const { page, pageSize, skip, setTotal } = pag;

  const load = () => {
    setLoading(true);
    collectionsApi
      .list({ limit: 500 })
      .then((data) => {
        setAll(data.collections || []);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    let list = all;
    if (!showArchived) {
      list = list.filter((c) => c.status !== "archived");
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [all, search, showArchived]);

  const tree = useMemo(() => buildTree(filtered), [filtered]);

  const flat = useMemo(() => {
    const loadedIds = new Set(filtered.map((c) => String(c._id)));
    return flattenTree(tree, loadedIds);
  }, [tree, filtered]);

  // Sync flattened count with pagination total.
  useEffect(() => {
    setTotal(flat.length);
  }, [flat.length, setTotal]);

  const visibleRows = useMemo(
    () => flat.slice(skip, skip + pageSize),
    [flat, skip, pageSize],
  );

  const toggleCollapse = (id) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      const key = String(id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const confirmArchive = async () => {
    if (!pendingArchive) return;
    setArchiving(true);
    try {
      await collectionsApi.update(pendingArchive._id, { status: "archived" });
      setPendingArchive(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setArchiving(false);
    }
  };

  const restore = async (c) => {
    try {
      await collectionsApi.update(c._id, { status: "active" });
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  const renderRow = (c, depth) => {
    const childCount = (tree.get(String(c._id)) || []).length;
    const isCollapsed = collapsed.has(String(c._id));

    return (
      <tr className="border-b last:border-b-0 hover:bg-gray-50">
        <td className="px-3 py-3">
          <div
            className="flex items-center"
            style={{ paddingLeft: `${depth * 20}px` }}
          >
            {childCount > 0 ? (
              <button
                type="button"
                onClick={() => toggleCollapse(c._id)}
                className="w-5 h-5 text-gray-500 hover:text-black"
              >
                {isCollapsed ? "▸" : "▾"}
              </button>
            ) : (
              <div className="w-5" />
            )}
            <div className="w-10 h-10 rounded border bg-gray-100 overflow-hidden ml-2">
              {c.image?.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.image.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
          <Link
            href={`/dashboard/products/collections/${c._id}`}
            className="font-medium hover:underline"
          >
            {c.name}
          </Link>
          <div className="text-xs text-gray-500 font-mono">{c.slug}</div>
        </td>
        <td className="px-3 py-3">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${
              TYPE_BADGES[c.type] || ""
            }`}
          >
            {c.type === "automatic" ? "⚡ automatic" : "manual"}
          </span>
        </td>
        <td className="px-3 py-3 text-right text-sm text-gray-700">
          {c.productCount ?? c.productIds?.length ?? 0}
        </td>
        <td className="px-3 py-3">
          <StatusPill status={c.status} />
        </td>
        <td className="px-3 py-3 text-right">
          {c.status === "archived" ? (
            <button
              type="button"
              onClick={() => restore(c)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Restore
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setPendingArchive(c)}
              className="text-xs text-red-600 hover:text-red-800 font-medium"
            >
              Archive
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Collections</h1>
          <p className="text-sm text-gray-500">
            {flat.length} collection{flat.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/dashboard/products/collections/new"
          className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800"
        >
          New collection
        </Link>
      </div>

      <div className="flex gap-3 items-center">
        <input
          type="text"
          placeholder="Search collections…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-md text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="border rounded-lg overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left text-xs uppercase text-gray-500">
              <th className="px-3 py-3">Image</th>
              <th className="px-3 py-3">Name</th>
              <th className="px-3 py-3">Type</th>
              <th className="px-3 py-3 text-right">Products</th>
              <th className="px-3 py-3">Status</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-gray-500"
                >
                  Loading…
                </td>
              </tr>
            )}
            {!loading && flat.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-8 text-center text-gray-500"
                >
                  No collections yet
                </td>
              </tr>
            )}
            {!loading &&
              visibleRows.map(({ item, depth }) =>
                renderRow(item, depth),
              )}
          </tbody>
        </table>

        <PaginationFooter
          pagination={pag}
          loading={loading}
          noun="collection"
        />
      </div>

      {pendingArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold mb-2">
              Archive this collection?
            </h2>
            <p className="text-sm text-gray-600">
              <strong>{pendingArchive.name}</strong> will be hidden. You can
              restore it later.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingArchive(null)}
                disabled={archiving}
                className="px-4 py-2 border rounded text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmArchive}
                disabled={archiving}
                className="px-4 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50"
              >
                {archiving ? "Archiving…" : "Archive"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}