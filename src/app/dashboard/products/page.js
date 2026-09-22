"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { productsApi } from "@/lib/api-client";

const STATUS_STYLES = {
  active:   "bg-green-100 text-green-800",
  draft:    "bg-gray-100 text-gray-800",
  archived: "bg-yellow-100 text-yellow-800",
  unlisted: "bg-purple-100 text-purple-800",
};

function StatusPill({ status }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status] || ""}`}>
      {status}
    </span>
  );
}

function PriceRange({ min, max }) {
  if (min == null) return <span className="text-gray-400">—</span>;
  if (min === max) return `KES ${min.toLocaleString()}`;
  return `KES ${min.toLocaleString()} – ${max.toLocaleString()}`;
}

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = { limit: 50 };
    if (search) params.search = search;
    if (status) params.status = status;

    productsApi
      .list(params)
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products || []);
        setTotal(data.total || 0);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [search, status]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="text-sm text-gray-500">{total} total</p>
        </div>
        <Link
          href="/dashboard/products/new"
          className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800"
        >
          Add product
        </Link>
      </div>

      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 border rounded-md text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
          <option value="unlisted">Unlisted</option>
        </select>
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
              <th className="px-4 py-3 w-16"></th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Stock</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            )}
            {!loading && products.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No products yet</td></tr>
            )}
            {products.map((p) => {
              const img = p.images?.find((i) => i.isDefault) || p.images?.[0];
              return (
                <tr key={p._id} className="border-b last:border-b-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {img?.url ? (
                      <img src={img.url} alt="" className="w-10 h-10 rounded object-cover border" />
                    ) : (
                      <div className="w-10 h-10 rounded border bg-gray-100" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/products/${p._id}`} className="font-medium hover:underline">
                      {p.name}
                    </Link>
                    {p.migrationFlags?.length > 0 && (
                      <div className="mt-1 flex gap-1 flex-wrap">
                        {p.migrationFlags.map((f) => (
                          <span key={f} className="px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-800">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                  <td className="px-4 py-3 text-gray-600">{p.productType || "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{p.vendor || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <PriceRange min={p.priceMin} max={p.priceMax} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.totalStock == null ? (
                      <span className="text-gray-400">—</span>
                    ) : (
                      <span className={p.totalStock <= 0 ? "text-red-600 font-medium" : ""}>
                        {p.totalStock}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}