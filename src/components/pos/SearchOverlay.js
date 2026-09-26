// client/src/components/pos/SearchOverlay.js
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api-client";
import { searchShopifyProducts } from "@/lib/indexeddb";
import { useSessionStore } from "@/store/session";
import FlexiProductGrid from "./FlexiProductGrid";

const TAB_STORAGE_KEY = "flexi-pos-product-tab";
const DEFAULT_TAB = "flexi";
const VALID_TABS = new Set(["flexi", "services", "shopify"]);

function readTab() {
  if (typeof window === "undefined") return DEFAULT_TAB;
  const stored = window.sessionStorage.getItem(TAB_STORAGE_KEY);
  return VALID_TABS.has(stored) ? stored : DEFAULT_TAB;
}

export default function SearchOverlay({
  searchQuery,
  onAddToCart,
  onShopifyProductClick,
  onClose,
  onOpenVariantPicker
}) {
  const selectedLocationId = useSessionStore((s) => s.selectedLocationId);
  const [activeTab, setActiveTab] = useState(readTab);
  const [results, setResults] = useState({ services: [], shopify: [] });
  const [loading, setLoading] = useState(false);
  const searchIdRef = useRef(0);

  // Persist tab choice
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(TAB_STORAGE_KEY, activeTab);
    }
  }, [activeTab]);

  // Services + Shopify searches (Flexi handles its own data)
  const performSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) {
      setResults({ services: [], shopify: [] });
      setLoading(false);
      return;
    }

    const currentSearchId = ++searchIdRef.current;
    setLoading(true);

    try {
      const [serviceRes, shopifyRes] = await Promise.all([
        apiFetch(
          `/products?type=service&search=${encodeURIComponent(query)}&limit=50`,
        ),
        searchShopifyProducts(query, 50),
      ]);

      if (currentSearchId === searchIdRef.current) {
        setResults({
          services: serviceRes?.products || [],
          shopify: shopifyRes || [],
        });
      }
    } catch (err) {
      console.error("Search failed:", err);
      if (currentSearchId === searchIdRef.current) {
        setResults({ services: [], shopify: [] });
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

  const renderProduct = (product, label) => {
    const isShopify = label === "Shopify";
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
          <p className="font-medium text-gray-900">
            {product.name || product.title}
          </p>
          <p className="text-xs text-gray-500">
            ${Number(product.price || 0).toFixed(2)} · {label}
            {isShopify && product.variants?.length > 1 && (
              <span className="ml-2 text-purple-600">
                ({product.variants.length} variants)
              </span>
            )}
          </p>
        </div>
        <span className="text-blue-500">+</span>
      </button>
    );
  };

  const totalNonFlexiResults =
    results.services.length + results.shopify.length;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {[
          { id: "flexi", label: "Flexi" },
          { id: "services", label: "Services" },
          { id: "shopify", label: "Shopify" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-blue-600 border-b-2 border-blue-600 -mb-px"
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "flexi" && (
          <FlexiProductGrid
            locationId={selectedLocationId}
            searchQuery={searchQuery}
            onAddToCart={onAddToCart}
            onOpenVariantPicker={onOpenVariantPicker}
          />
        )}

        {activeTab === "services" && (
          <>
            {loading && results.services.length === 0 ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : results.services.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <p className="text-lg">No services found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Services ({results.services.length})
                </h4>
                {results.services.map((p) => renderProduct(p, "Service"))}
              </div>
            )}
          </>
        )}

        {activeTab === "shopify" && (
          <>
            {loading && results.shopify.length === 0 ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
              </div>
            ) : results.shopify.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                <p className="text-lg">No Shopify products found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                  Shopify ({results.shopify.length})
                </h4>
                {results.shopify.map((p) => renderProduct(p, "Shopify"))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}