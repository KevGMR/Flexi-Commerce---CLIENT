"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { searchShopifyProducts } from "@/lib/indexeddb";
import { useRef } from "react";

const moneyFormatter = new Intl.NumberFormat("en-KE", {
	style: "currency",
	currency: "KES",
});

const formatMoney = (value) => moneyFormatter.format(Number(value || 0));

export default function AddToSalePanel({ saleId, currentItems, pendingRemovedLine, onAddSuccess, onCancel }) {
	const [tab, setTab] = useState("shopify");
	const [query, setQuery] = useState("");
	const [shopifyResults, setShopifyResults] = useState([]);
	const [shopifyLoading, setShopifyLoading] = useState(false);
	const [selectedItems, setSelectedItems] = useState([]); // { key, isExisting, itemIndex, product, variant, quantity, unitPrice, discount }
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const searchRef = useRef(null);

	// Initialize with existing items from the sale
	useEffect(() => {
		if (currentItems && Array.isArray(currentItems)) {
			const existingItems = currentItems.map((item, idx) => ({
				key: `existing-${idx}`,
				isExisting: true,
				itemIndex: idx,
				product: { id: item.sku, title: item.productName },
				variant: { 
					id: item.sku,
					title: item.productName,
					price: item.unitPrice,
					sku: item.sku
				},
				quantity: item.quantity,
				unitPrice: Number(item.unitPrice || 0),
				discount: Number(item.discount || 0),
			}));
			setSelectedItems(existingItems);
		}
	}, [currentItems]);

	useEffect(() => {
		setQuery("");
		setShopifyResults([]);
	}, [tab]);

	useEffect(() => {
		let cancelled = false;
		if (tab === "shopify") {
			const t = setTimeout(async () => {
				setShopifyLoading(true);
				try {
					const results = await searchShopifyProducts(query || "", 200);
					if (!cancelled) setShopifyResults(Array.isArray(results) ? results : []);
				} catch (err) {
					console.error(err);
					if (!cancelled) setShopifyResults([]);
				} finally {
					if (!cancelled) setShopifyLoading(false);
				}
			}, 180);
			return () => {
				cancelled = true;
				clearTimeout(t);
			};
		}
	}, [query, tab]);

	// autofocus search when mounted
	useEffect(() => {
		const t = setTimeout(() => {
			try {
				searchRef.current?.focus();
			} catch (e) {}
		}, 60);
		return () => clearTimeout(t);
	}, []);

	const toggleSelectVariant = (product, variant) => {
		const key = `shopify-${product.id}:${variant.id}`;
		setSelectedItems((prev) => {
			const exists = prev.find((p) => p.key === key);
			if (exists) return prev.filter((p) => p.key !== key);
			return [
				...prev,
				{
					key,
					isExisting: false,
					product,
					variant,
					quantity: 1,
					unitPrice: Number(variant.price || 0),
					discount: 0,
				},
			];
		});
	};

	const adjustSelectedItemQuantity = (key, delta) => {
		setSelectedItems((prev) =>
			prev.map((item) =>
				item.key === key
					? { ...item, quantity: Math.max(1, Number(item.quantity || 1) + delta) }
					: item,
			),
		);
	};

	const removeSelectedItem = (key) => {
		setSelectedItems((prev) => prev.filter((item) => item.key !== key));
	};

	const updateSelectedItem = (key, changes) => {
		setSelectedItems((prev) => prev.map((p) => (p.key === key ? { ...p, ...changes } : p)));
	};

	const handleDone = useCallback(async () => {
		setError("");
		if (!saleId) return;
		if (!selectedItems.length) {
			setError("Select at least one product to add");
			return;
		}

		try {
			setSubmitting(true);
			const edits = selectedItems.map((item) => {
				if (item.isExisting) {
					// For existing items, send as update action
					return {
						action: "update",
						itemIndex: item.itemIndex,
						replacementItem: {
							quantity: Number(item.quantity || 1),
							unitPrice: Number(item.unitPrice || 0),
							discount: Number(item.discount || 0),
						},
					};
				} else {
					// For new items, send as add action
					const replacementItem = {
						type: "shopify",
						shopifyVariantId: item.variant.id,
						productName: item.product.title + (item.variant ? ` - ${item.variant.title}` : ""),
						sku: item.variant.sku || "",
						quantity: Number(item.quantity || 1),
						unitPrice: Number(item.unitPrice || 0),
						discount: Number(item.discount || 0),
					};

					return { action: "add", replacementItem };
				}
			});

			await apiFetch(`/sales/${saleId}/reservation`, { method: "PATCH", body: { edits } });
			if (onAddSuccess) await onAddSuccess();
		} catch (err) {
			console.error("Failed to update items:", err);
			setError(err.message || "Failed to update items");
		} finally {
			setSubmitting(false);
		}
	}, [saleId, selectedItems, onAddSuccess]);

	return (
		<div className="w-full">
			<div className="flex items-center justify-between mb-3">
				<div>
					<p className="text-sm font-semibold text-zinc-900">Edit items</p>
					<p className="text-xs text-zinc-500">Adjust quantities and prices inline, then add new products into the same list</p>
				</div>
			</div>

			<div className="rounded-lg border border-zinc-200 bg-white">
				<div className="sticky top-0 z-10 bg-white border-b px-3 py-3">
					<div className="flex gap-2 items-center">
						<div className="relative flex-1">
							<div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35" />
									<circle cx="11" cy="11" r="6" strokeWidth="2" />
								</svg>
							</div>
							<input
								ref={searchRef}
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search products to add"
								className="w-full rounded-full border border-zinc-200 px-10 py-2 text-sm focus:outline-none"
							/>
						</div>
						<div className="ml-2">
							<button type="button" onClick={() => setTab("shopify")} className="rounded-full bg-zinc-100 px-3 py-1 text-sm">Shopify</button>
						</div>
					</div>
				</div>

{/* Product Search Results - Only shown if searching */}
			{query && (
				<div className="max-h-[30vh] overflow-auto border-b">
					<div className="min-w-full">
						<div className="grid grid-cols-[48px_1fr_110px_110px] gap-0 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 border-b">
							<div />
							<div>Product</div>
							<div className="text-right">Available</div>
							<div className="text-right">Price</div>
						</div>

						{shopifyLoading && <div className="p-4 text-sm text-zinc-500">Searching...</div>}

						{!shopifyLoading && shopifyResults.length === 0 && (
							<div className="p-4 text-sm text-zinc-500">No products found</div>
						)}

						{!shopifyLoading && shopifyResults.map((product) => (
							<div key={product.id} className="border-b">
								{product.variants && product.variants.map((variant) => {
									const key = `shopify-${product.id}:${variant.id}`;
									const selected = selectedItems.find((s) => s.key === key);
									const imgSrc = product.image || product.imageSrc || (product.featuredImage && product.featuredImage.src) || (product.images && product.images[0] && product.images[0].src) || null;
									return (
										<div key={variant.id} className={`grid grid-cols-[48px_1fr_110px_110px] items-center gap-0 px-3 py-2 text-sm ${selected ? "bg-emerald-50/60" : ""}`}>
											<div>
												<input type="checkbox" checked={!!selected} onChange={() => toggleSelectVariant(product, variant)} />
											</div>
											<div className="flex min-w-0 items-center gap-3">
												{imgSrc ? (
													<img src={imgSrc} alt="" className="h-8 w-8 flex-none rounded-md object-cover" />
												) : (
													<div className="h-8 w-8 flex-none rounded-md bg-zinc-100" />
												)}
												<div className="min-w-0">
													<div className="truncate font-medium text-zinc-900">{product.title}{variant && variant.title && variant.title !== "Default Title" ? ` — ${variant.title}` : ""}</div>
													<div className="text-xs text-zinc-500">{product.vendor || ""}</div>
												</div>
											</div>
											<div className="text-right text-zinc-600">{variant.available || 0}</div>
											<div className="text-right font-medium text-zinc-900">{formatMoney(variant.price || 0)}</div>
										</div>
									);
								})}
							</div>
						))}
					</div>
				</div>
			)}

			{/* Selected Items List - Always visible */}
			<div className="max-h-[50vh] overflow-auto">
				{selectedItems.length === 0 ? (
					<div className="p-8 text-center text-zinc-500">
						<p className="text-sm">No items yet. Search above to append products to this order.</p>
					</div>
				) : (
					<div>
						<div className="grid grid-cols-[1fr_80px_100px_100px_50px] gap-0 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 border-b sticky top-0">
							<div>Item</div>
							<div className="text-center">Qty</div>
							<div className="text-right">Price</div>
							<div className="text-right">Total</div>
							<div className="text-center">Action</div>
						</div>
						{selectedItems.map((item) => {
							const lineTotal = (Number(item.quantity || 1) * Number(item.unitPrice || 0)) - (Number(item.discount || 0));
							return (
								<div key={item.key} className="grid grid-cols-[minmax(0,1fr)_112px_120px_120px_48px] gap-0 items-center px-3 py-3 border-b hover:bg-zinc-50">
									<div className="flex items-center gap-3 min-w-0">
										<div className="h-9 w-9 flex-none rounded border border-zinc-200 bg-zinc-100" />
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<p className="text-sm font-medium text-zinc-900 truncate">{item.variant?.title || item.product?.title}</p>
												<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${item.isExisting ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
													{item.isExisting ? "existing" : "new"}
												</span>
											</div>
											<p className="mt-1 text-xs text-zinc-500">{item.variant?.sku || item.product?.id || ""}</p>
										</div>
									</div>
									<div className="flex items-center justify-center gap-1">
										<button
											type="button"
											onClick={() => adjustSelectedItemQuantity(item.key, -1)}
											className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
										>
											−
										</button>
										<input
											type="number"
											value={item.quantity}
											onChange={(e) => updateSelectedItem(item.key, { quantity: Math.max(1, Number(e.target.value) || 1) })}
											className="w-12 rounded-lg border border-zinc-300 text-center text-sm py-1"
											min="1"
											inputMode="numeric"
										/>
										<button
											type="button"
											onClick={() => adjustSelectedItemQuantity(item.key, 1)}
											className="inline-flex h-6 w-6 items-center justify-center rounded border border-zinc-300 text-zinc-600 hover:bg-zinc-100"
										>
											+
										</button>
									</div>
									<div>
										<input
											type="number"
											value={item.unitPrice}
											onChange={(e) => updateSelectedItem(item.key, { unitPrice: Number(e.target.value) || 0 })}
											className="w-full rounded-lg border border-zinc-300 px-2 py-1 text-right text-sm"
											inputMode="decimal"
											step="0.01"
											min="0"
											placeholder="0.00"
										/>
									</div>
									<div className="text-right text-sm font-medium text-zinc-900">
										{formatMoney(Math.max(0, lineTotal))}
									</div>
									<div className="flex justify-center">
										<button
											type="button"
											onClick={() => removeSelectedItem(item.key)}
											className="inline-flex h-6 w-6 items-center justify-center rounded text-red-600 hover:bg-red-50"
										>
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
												<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
											</svg>
										</button>
									</div>
								</div>
							);
						})}
					</div>
				)}
				</div>

			{error && <div className="mt-2 text-sm text-red-600">{error}</div>}

			<div className="mt-4 flex gap-2 justify-end">
				<button
					type="button"
					onClick={onCancel}
					disabled={submitting}
					className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
				>
					Cancel
				</button>
				<button
					type="button"
					onClick={handleDone}
					disabled={submitting || selectedItems.length === 0}
					className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
				>
					{submitting ? "Saving..." : "Update order"}
				</button>
				</div>
			</div>
		</div>
	);
}

