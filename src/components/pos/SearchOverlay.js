"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api-client";
import { searchShopifyProducts } from "@/lib/indexeddb";

export default function SearchOverlay({
  searchQuery,
  onAddToCart,
  onShopifyProductClick,
  onClose,
}) {
  const [results, setResults] = useState({ flexi: [], services: [], shopify: [] });
  const [loading, setLoading] = useState(false);
  const searchIdRef = useRef(0);

  const performSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      setResults({ flexi: [], services: [], shopify: [] });
      setLoading(false);
      return;
    }

    const currentSearchId = ++searchIdRef.current;
    setLoading(true);

    try {
      const [flexiRes, serviceRes, shopifyRes] = await Promise.all([
        apiFetch(`/products?type=physical&search=${encodeURIComponent(query)}&limit=50`),
        apiFetch(`/products?type=service&search=${encodeURIComponent(query)}&limit=50`),
        searchShopifyProducts(query, 50),
      ]);

      // Only update if this is the latest search
      if (currentSearchId === searchIdRef.current) {
        setResults({
          flexi: flexiRes?.products || [],
          services: serviceRes?.products || [],
          shopify: shopifyRes || [],
        });
      }
    } catch (err) {
      console.error("Search failed:", err);
      if (currentSearchId === searchIdRef.current) {
        setResults({ flexi: [], services: [], shopify: [] });
      }
    } finally {
      if (currentSearchId === searchIdRef.current) {
        setLoading(false);
      }
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(performSearch, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const totalResults = results.flexi.length + results.services.length + results.shopify.length;

  const renderProduct = (product, type) => {
    const isShopify = type === "Shopify";
    const onClick = () => {
      if (isShopify) {
        onShopifyProductClick(product);
      } else {
        onAddToCart(product);
      }
    };
    return (
      <button
        key={product._id || product.id}
        onClick={onClick}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 text-left"
      >
        <div>
          <p className="font-medium text-gray-900">{product.name || product.title}</p>
          <p className="text-xs text-gray-500">
            ${Number(product.price || 0).toFixed(2)} · {type}
            {isShopify && product.variants?.length > 1 && (
              <span className="ml-2 text-purple-600">({product.variants.length} variants)</span>
            )}
          </p>
        </div>
        <span className="text-blue-500">+</span>
      </button>
    );
  };

  return (
    <div className="p-4 h-full overflow-auto bg-white">
      {loading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : totalResults === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-gray-400">
          <p className="text-lg">No products found</p>
          <p className="text-sm">Try a different search term</p>
        </div>
      ) : (
        <>
          {results.flexi.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">FLEXI Products ({results.flexi.length})</h4>
              {results.flexi.map(p => renderProduct(p, "FLEXI"))}
            </div>
          )}
          {results.services.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Services ({results.services.length})</h4>
              {results.services.map(p => renderProduct(p, "Service"))}
            </div>
          )}
          {results.shopify.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Shopify ({results.shopify.length})</h4>
              {results.shopify.map(p => renderProduct(p, "Shopify"))}
            </div>
          )}
        </>
      )}
    </div>
  );
}