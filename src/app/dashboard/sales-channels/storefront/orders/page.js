"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSessionStore } from "@/store/session";

export default function StorefrontOrdersPage() {
  const router = useRouter();
  const { activeOrganization } = useSessionStore();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });

  useEffect(() => {
    const load = async () => {
      if (!activeOrganization?._id) return;
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(
          `/sales?salesChannel=storefront&limit=${pagination.limit}&page=${pagination.page}`,
        );

        const salesData = res?.data?.sales || res?.sales || res?.data || [];
        setSales(salesData);

        if (res?.data?.pagination) {
          setPagination((prev) => ({
            ...prev,
            total: res.data.pagination.total,
          }));
        } else if (res?.pagination) {
          setPagination((prev) => ({ ...prev, total: res.pagination.total }));
        }
      } catch (err) {
        setError(err?.message || "Failed to load orders.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeOrganization?._id, pagination.page]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("en-KE", {
      style: "currency",
      currency: activeOrganization?.settings?.currency || "KES",
    }).format(value || 0);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString();

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Storefront Orders</h1>
        <p className="mt-1 text-sm text-gray-600">
          Orders placed on your online storefront.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-500">
            Loading orders…
          </div>
        ) : sales.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">
            No storefront orders yet.
          </div>
        ) : (
          <>
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                    Receipt #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-900">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                    Payment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-900">
                    Delivery
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sales.map((sale) => (
                  <tr
                    key={sale._id}
                    onClick={() =>
                      router.push(`/dashboard/sales/${sale._id}`)
                    }
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm font-medium text-blue-600 hover:underline">
                      {sale.receiptNumber}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(sale.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {sale.customerName || "—"}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900">
                      {formatCurrency(sale.totalAmount)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                      {sale.paymentStatus || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                          sale.status === "completed"
                            ? "bg-green-100 text-green-800"
                            : sale.status === "voided"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {sale.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {sale.deliveryCategory ? (
                        <span>
                          {sale.deliveryCategory}
                          {sale.deliveryOption
                            ? ` · ${sale.deliveryOption}`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Page {pagination.page} of {totalPages} ({pagination.total}{" "}
                  total)
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.max(1, prev.page - 1),
                      }))
                    }
                    disabled={pagination.page === 1}
                    className="rounded border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() =>
                      setPagination((prev) => ({
                        ...prev,
                        page: Math.min(totalPages, prev.page + 1),
                      }))
                    }
                    disabled={pagination.page === totalPages}
                    className="rounded border border-gray-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}