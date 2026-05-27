"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { buildSaleIdempotencyKey } from "@/lib/idempotency";
import { PERMISSIONS } from "@/lib/permissions";
import {
  savePendingSale,
  getPendingSales,
  setShopifyProducts,
  searchShopifyProducts,
  clearShopifyProducts,
} from "@/lib/indexeddb";
import { useSyncManager } from "@/hooks/useSyncManager";
import { useSessionStore } from "@/store/session";
import DeliveryCheckoutModal from "@/components/pos/DeliveryCheckoutModal";
import CompleteCheckoutModal from "@/components/pos/CompleteCheckoutModal";
import PreviousShiftBlockModal from "@/components/pos/PreviousShiftBlockModal";
import { printReceiptInBrowser } from "@/lib/receipt/browserPrint";
import {
  hasPartialPaymentSignal,
  toNonNegativeAmount,
} from "@/lib/receipt/receiptPrintTemplate";

// Mock product catalog - replace with real product fetch
const mockProducts = [
  // { id: "696fddca006f8323184b897c", name: "Product A", price: 25.00, image: null, type: "flexi" },
  // { id: "696fddca006f8323184b897d", name: "Product B", price: 45.00, image: null, type: "flexi" },
  // { id: "696fddca006f8323184b897e", name: "Product C", price: 15.00, image: null, type: "flexi" },
  // { id: "696fddca006f8323184b897f", name: "Product D", price: 65.00, image: null, type: "flexi" },
  // { id: "696fddca006f8323184b897g", name: "Product E", price: 35.00, image: null, type: "flexi" },
  // { id: "696fddca006f8323184b897h", name: "Product F", price: 55.00, image: null, type: "flexi" },
];

const paymentMethods = [
  { value: "cash", label: "Cash", icon: "💵" },
  { value: "card", label: "Card", icon: "💳" },
  { value: "mpesa", label: "M-Pesa", icon: "📱" },
];

const returnReasons = [
  { value: "customer-request", label: "Customer Request" },
  { value: "defective-product", label: "Defective Product" },
  { value: "wrong-item", label: "Wrong Item Shipped/Given" },
  { value: "price-adjustment", label: "Price Adjustment" },
  { value: "damaged", label: "Item Damaged" },
];

const normalizeSplitPaymentAmounts = (payments = []) =>
  (Array.isArray(payments) ? payments : []).map((payment) => ({
    ...payment,
    amount: toNonNegativeAmount(payment?.amount),
  }));

const getLocalDayStartIso = () => {
  const now = new Date();
  const localStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return localStart.toISOString();
};

const PRODUCT_TAB_STORAGE_KEY = "flexi-pos-product-tab";
const DEFAULT_PRODUCT_TAB = "flexi";
const PRODUCT_TABS = new Set(["flexi", "services", "shopify"]);

const normalizeProductTab = (value) =>
  PRODUCT_TABS.has(value) ? value : DEFAULT_PRODUCT_TAB;

export default function PosPage() {
  const router = useRouter();
  const {
    activeOrganization,
    accessToken,
    deviceId,
    deviceName,
    locations,
    locationsMeta,
    selectedLocationId,
    setSelectedLocationId,
  } = useSessionStore();
  const {
    isOnline,
    pendingSalesCount,
    isReconnectingShopify,
    retrySyncPendingSales,
    retrySingleSale,
    updatePendingCounts,
  } = useSyncManager();

  const [locationId, setLocationId] = useState(() => selectedLocationId || "");
  const [cart, setCart] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("cash");
  const [searchQuery, setSearchQuery] = useState("");
  const [productTab, setProductTab] = useState(DEFAULT_PRODUCT_TAB);
  const [hasLoadedProductTab, setHasLoadedProductTab] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showNoLocationsModal, setShowNoLocationsModal] = useState(false);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showPendingSales, setShowPendingSales] = useState(false);
  const [pendingSales, setPendingSales] = useState([]);
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [splitPayments, setSplitPayments] = useState([
    { method: "cash", amount: 0 },
  ]);
  const [editingPriceIndex, setEditingPriceIndex] = useState(null);
  const [editingPriceValue, setEditingPriceValue] = useState("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [shopifyConnection, setShopifyConnection] = useState(null);
  const [hasLoadedShopifyConnection, setHasLoadedShopifyConnection] = useState(false);
  const [shopifyProducts, setShopifyProductsState] = useState([]);
  const [serviceProducts, setServiceProductsState] = useState([]);
  const [shopifyLoading, setShopifyLoading] = useState(false);
  const [serviceLoading, setServiceLoading] = useState(false);
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [variantPickerProduct, setVariantPickerProduct] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState(null);
  const [lastSyncTimestamp, setLastSyncTimestamp] = useState(null);
  const [refreshDebounceTimer, setRefreshDebounceTimer] = useState(null);
  const [shopifyLocationScope, setShopifyLocationScope] = useState(null);
  const shopifyFetchRequestIdRef = useRef(0);
  const [previousDayOpenShift, setPreviousDayOpenShift] = useState(null);
  const [checkingPreviousDayShift, setCheckingPreviousDayShift] = useState(false);
  const [previousDayShiftError, setPreviousDayShiftError] = useState("");
  const [showPreviousDayShiftModal, setShowPreviousDayShiftModal] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedProductTab = window.localStorage.getItem(PRODUCT_TAB_STORAGE_KEY);
    setProductTab(normalizeProductTab(storedProductTab));
    setHasLoadedProductTab(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedProductTab || typeof window === "undefined") return;

    window.localStorage.setItem(PRODUCT_TAB_STORAGE_KEY, productTab);
  }, [productTab, hasLoadedProductTab]);

  useEffect(() => {
    if (!hasLoadedShopifyConnection || productTab !== "shopify" || shopifyConnection) return;

    setProductTab(DEFAULT_PRODUCT_TAB);
  }, [hasLoadedShopifyConnection, productTab, shopifyConnection]);

  // Returns mode state
  const [returnMode, setReturnMode] = useState(false);
  const [showReturnLookup, setShowReturnLookup] = useState(false);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState("");
  const [originalSale, setOriginalSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState("customer-request");
  const [lookupError, setLookupError] = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);

  // Exchange mode state
  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeCart, setExchangeCart] = useState([]);
  const [exchangeSelectedPaymentMethod, setExchangeSelectedPaymentMethod] =
    useState("cash");
  const [exchangeUseSplitPayment, setExchangeUseSplitPayment] =
    useState(false);
  const [exchangeSplitPayments, setExchangeSplitPayments] = useState([
    { method: "cash", amount: 0 },
  ]);

  // Checkout modal state
  const [showCompleteCheckoutModal, setShowCompleteCheckoutModal] =
    useState(false);
  const [pendingCheckoutData, setPendingCheckoutData] = useState(null);

  const [exchangeEditingPriceIndex, setExchangeEditingPriceIndex] =
    useState(null);
  const [exchangeEditingPriceValue, setExchangeEditingPriceValue] =
    useState("");
  const [processingExchange, setProcessingExchange] = useState(false);

  // Discount state
  const [editingDiscountIndex, setEditingDiscountIndex] = useState(null);
  const [discountType, setDiscountType] = useState("fixed"); // 'fixed' or 'percentage'
  const [discountValue, setDiscountValue] = useState("");
  const [transactionDiscount, setTransactionDiscount] = useState(0);
  const [transactionDiscountType, setTransactionDiscountType] = useState("fixed");
  const [discountReason, setDiscountReason] = useState("");
  const [showTransactionDiscount, setShowTransactionDiscount] = useState(false);
  const [exchangeEditingDiscountIndex, setExchangeEditingDiscountIndex] = useState(null);
  const [exchangeDiscountType, setExchangeDiscountType] = useState("fixed");
  const [exchangeDiscountValue, setExchangeDiscountValue] = useState("");

  const getLocationLabel = (id) => {
    if (!id) return "";
    const match = locationsMeta?.find((loc) => {
      if (typeof loc === "string") return loc === id;
      const locId = loc?._id || loc?.id || loc?.locationId;
      return locId === id;
    });
    if (!match) return id;
    if (typeof match === "string") return match;
    return match.name || match.shopifyLocationName || id;
  };

  // Load locations from API on mount
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const res = await apiFetch("/locations?limit=100");
        if (res?.data || res?.locations) {
          const allLocations = res.data || res.locations || [];
          const allLocationIds = allLocations
            .map((loc) => loc._id || loc.id || loc.locationId)
            .filter(Boolean);

          // Set to store for use throughout the app
          if (allLocationIds.length > 0) {
            useSessionStore.getState().setLocations(allLocationIds);
            useSessionStore.getState().setLocationsMeta(allLocations);
          }

          setLocationsLoading(false);
        }
      } catch (err) {
        console.warn("Failed to load locations:", err);
        setLocationsLoading(false);
      }
    };

    // Only load if locations not already in store
    if (!locations || locations.length === 0) {
      loadLocations();
    } else {
      setLocationsLoading(false);
    }
  }, [activeOrganization?.id, accessToken, locations]);

  // Initialize location on mount
  useEffect(() => {
    // Mark as loading complete once we have locations data (even if empty)
    if (locations !== undefined) {
      setLocationsLoading(false);
    }

    // Case 1: No locations exist at all
    if (locations !== undefined && (!locations || locations.length === 0)) {
      setShowNoLocationsModal(true);
      return;
    }

    // Hide "No Locations" modal if locations now exist
    setShowNoLocationsModal(false);

    // Case 2: Exactly one location - auto-select it
    if (locations && locations.length === 1) {
      setLocationId(locations[0]);
      setSelectedLocationId(locations[0]);
      return;
    }

    // Case 3: Multiple locations exist
    if (locations && locations.length > 1) {
      // If a location is already selected and valid, use it
      if (locationId && locations.includes(locationId)) {
        return;
      }
      // If selectedLocationId from store is valid, use it
      if (selectedLocationId && locations.includes(selectedLocationId)) {
        setLocationId(selectedLocationId);
        return;
      }
      // Otherwise, show location picker
      setShowLocationPicker(true);
    }
  }, [locations, selectedLocationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validate selected location belongs to organization
  useEffect(() => {
    if (!locationId || !locations || locations.length === 0) return;

    // If selected location doesn't exist in allowed locations, reset and show picker
    if (!locations.includes(locationId)) {
      setLocationId("");
      setSelectedLocationId("");
      if (locations.length > 1) {
        setShowLocationPicker(true);
      } else if (locations.length === 1) {
        setLocationId(locations[0]);
        setSelectedLocationId(locations[0]);
      }
    }
  }, [locationId, locations]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkPreviousDayOpenShift = useCallback(async (targetLocationId) => {
    if (!targetLocationId) return;

    setCheckingPreviousDayShift(true);
    setPreviousDayShiftError("");

    try {
      const dayStart = getLocalDayStartIso();
      const response = await apiFetch(
        `/shift-sessions/open/previous-day?locationId=${encodeURIComponent(targetLocationId)}&dayStart=${encodeURIComponent(dayStart)}`,
      );
      const detectedShift = response?.data?.shift || null;
      setPreviousDayOpenShift(detectedShift);
      setShowPreviousDayShiftModal(Boolean(detectedShift));
    } catch (err) {
      console.error("Failed to check previous-day shift:", err);
      setPreviousDayShiftError(err?.message || "Failed to check previous-day shift");
      setPreviousDayOpenShift(null);
      setShowPreviousDayShiftModal(false);
    } finally {
      setCheckingPreviousDayShift(false);
    }
  }, []);

  useEffect(() => {
    if (!locationId || !locations || !locations.includes(locationId)) {
      setPreviousDayOpenShift(null);
      setShowPreviousDayShiftModal(false);
      return;
    }

    checkPreviousDayOpenShift(locationId);
  }, [locationId, locations, checkPreviousDayOpenShift]);

  // Load pending sales on mount and when count changes
  useEffect(() => {
    const loadPendingSales = async () => {
      try {
        const sales = await getPendingSales();
        setPendingSales(sales || []);
      } catch (err) {
        console.error("Failed to load pending sales:", err);
      }
    };
    loadPendingSales();
  }, [pendingSalesCount]);

  // Auto-retry pending sales when coming back online
  useEffect(() => {
    if (isOnline && pendingSalesCount > 0 && !isReconnectingShopify) {
      const retryWithDelay = async () => {
        await new Promise((r) => setTimeout(r, 1000));
        await retrySyncPendingSales(
          accessToken,
          deviceId,
          deviceName,
          activeOrganization?.slug,
        );
      };
      retryWithDelay();
    }
  }, [
    isOnline,
    pendingSalesCount,
    isReconnectingShopify,
    accessToken,
    deviceId,
    deviceName,
    activeOrganization?.slug,
    retrySyncPendingSales,
  ]);

  // Load Shopify connection status
  const loadShopifyConnection = async () => {
    try {
      const data = await apiFetch("/shopify/connection");

      setShopifyConnection(data?.data || null);
    } catch (err) {
      console.error("Failed to load Shopify connection:", err);
      setShopifyConnection(null);
    } finally {
      setHasLoadedShopifyConnection(true);
    }
  };

  const loadServiceProductsData = useCallback(async () => {
    if (!activeOrganization) {
      return;
    }

    setServiceLoading(true);
    try {
      const res = await apiFetch("/products?type=service&status=active&limit=100");
      const products = res?.data?.products || res?.products || [];
      setServiceProductsState(products);
    } catch (err) {
      console.error("[POS] Failed to load service products:", err);
      setServiceProductsState([]);
    } finally {
      setServiceLoading(false);
    }
  }, [activeOrganization]);

  // Load Shopify products and cache them - memoized to fix exhaustive-deps warning
  const loadShopifyProductsData = useCallback(async () => {
    console.log("[POS] loadShopifyProductsData called");
    if (!shopifyConnection?.status) {
      console.log("[POS] No shopifyConnection.status, returning early");
      return;
    }
    const requestId = ++shopifyFetchRequestIdRef.current;
    setShopifyLoading(true);
    try {
      console.log("[POS] Fetching /shopify/products...");
      const res = await apiFetch("/shopify/products");
      console.log("[POS] API response received:", {
        hasProducts: !!res?.data?.products,
        productCount: res?.data?.products?.length,
        locationScope: res?.data?.locationScope,
      });
      if (requestId !== shopifyFetchRequestIdRef.current) {
        console.log("[POS] Request ID mismatch, returning");
        return;
      }

      const locationScope = res?.data?.locationScope || null;
      setShopifyLocationScope(locationScope);

      if (locationScope?.scoped && locationScope?.hasMapping === false) {
        console.log("[POS] Location scoped without mapping, clearing products");
        await clearShopifyProducts();
        setShopifyProductsState([]);
        setSearchResults([]);
        setLastSyncTimestamp(res?.data?.lastFetchedAt || new Date().toISOString());
        return;
      }

      if (res?.data?.products) {
        console.log("[POS] Calling setShopifyProducts with", res.data.products.length, "products");
        await setShopifyProducts(res.data.products);
        console.log("[POS] setShopifyProducts completed, searching...");
        const cached = await searchShopifyProducts("");
        console.log("[POS] searchShopifyProducts returned", cached.length, "products");
        if (requestId !== shopifyFetchRequestIdRef.current) {
          console.log("[POS] Request ID mismatch after search, returning");
          return;
        }
        setShopifyProductsState(cached);
        setSearchResults(cached);
        setLastSyncTimestamp(res?.data?.lastFetchedAt || new Date().toISOString());
      } else {
        console.log("[POS] No products in response");
      }
    } catch (err) {
      console.error("[POS] Failed to load Shopify products:", err);
    } finally {
      if (requestId === shopifyFetchRequestIdRef.current) {
        setShopifyLoading(false);
      }
    }
  }, [shopifyConnection?.status]);

  // Load Shopify data on mount and when organization changes
  useEffect(() => {
    loadShopifyConnection();
    loadServiceProductsData();

    // Load cached products on mount and check staleness
    searchShopifyProducts("").then((cached) => {
      setShopifyProductsState(cached);
      setSearchResults(cached);

      // Get last sync timestamp from cached data
      if (cached.length > 0 && cached[0].savedAt) {
        setLastSyncTimestamp(cached[0].savedAt);

        // Check if cache is stale (> 1 hour old)
        const cacheAge = Date.now() - new Date(cached[0].savedAt).getTime();
        const MAX_CACHE_AGE = 60 * 60 * 1000; // 1 hour in milliseconds

        if (cacheAge > MAX_CACHE_AGE) {
          console.log("[POS] Shopify product cache is stale, refreshing...");
          // Refresh cache in background if online
          if (navigator.onLine) {
            loadShopifyProductsData().catch((err) => {
              console.error("[POS] Background cache refresh failed:", err);
            });
          }
        }
      }
    });
  }, [activeOrganization, loadShopifyProductsData, loadServiceProductsData]);

  // Load products when connection/location context is active
  useEffect(() => {
    if (shopifyConnection?.status === "active" && locationId) {
      loadShopifyProductsData();
    }
  }, [shopifyConnection?.status, locationId, loadShopifyProductsData]);

  // Cart operations

  // Cart operations
  const upsertCartItem = (targetCart, setTargetCart, cartItem) => {
    const existingIndex = targetCart.findIndex(
      (item) => item.variant === cartItem.variant,
    );
    if (existingIndex >= 0) {
      const updated = [...targetCart];
      updated[existingIndex].quantity += 1;
      setTargetCart(updated);
      return;
    }

    setTargetCart([...targetCart, cartItem]);
  };

  const addToCart = (product) => {
    const newItem = {
      type: product.type,
      variant: product.id || product._id,
      name: product.name,
      price: product.price,
      quantity: 1,
      discount: 0,
      serviceKind: product.serviceKind,
      serviceBundleComponents: Array.isArray(product.serviceBundleComponents)
        ? product.serviceBundleComponents.map((component) => ({ ...component }))
        : undefined,
    };

    if (exchangeMode) {
      upsertCartItem(exchangeCart, setExchangeCart, newItem);
    } else {
      upsertCartItem(cart, setCart, newItem);
    }
  };

  const updateQuantity = (index, newQty) => {
    if (newQty <= 0) {
      removeFromCart(index);
    } else {
      const newCart = [...cart];
      newCart[index].quantity = newQty;
      setCart(newCart);
    }
  };

  const updatePrice = (index, newPrice) => {
    const newCart = [...cart];
    newCart[index].price = parseFloat(newPrice) || 0;
    setCart(newCart);
  };

  const updateDiscount = (index, discountAmount) => {
    const newCart = [...cart];
    newCart[index].discount = parseFloat(discountAmount) || 0;
    setCart(newCart);
  };

  const updateExchangeDiscount = (index, discountAmount) => {
    const newCart = [...exchangeCart];
    newCart[index].discount = parseFloat(discountAmount) || 0;
    setExchangeCart(newCart);
  };

  const updateExchangeQuantity = (index, newQty) => {
    if (newQty <= 0) {
      removeFromExchangeCart(index);
    } else {
      const newCart = [...exchangeCart];
      newCart[index].quantity = newQty;
      setExchangeCart(newCart);
    }
  };

  const updateExchangePrice = (index, newPrice) => {
    const newCart = [...exchangeCart];
    newCart[index].price = parseFloat(newPrice) || 0;
    setExchangeCart(newCart);
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const removeFromExchangeCart = (index) => {
    setExchangeCart(exchangeCart.filter((_, i) => i !== index));
  };

  const handlePriceEdit = (index) => {
    setEditingPriceIndex(index);
    setEditingPriceValue(cart[index].price.toString());
  };

  const handleExchangePriceEdit = (index) => {
    setExchangeEditingPriceIndex(index);
    setExchangeEditingPriceValue(exchangeCart[index].price.toString());
  };

  const savePriceEdit = (index) => {
    updatePrice(index, editingPriceValue);
    setEditingPriceIndex(null);
    setEditingPriceValue("");
  };

  const handleDiscountEdit = (index) => {
    const item = cart[index];
    setEditingDiscountIndex(index);
    setDiscountValue(item.discount > 0 ? item.discount.toString() : "");
    setDiscountType("fixed");
  };

  const handleExchangeDiscountEdit = (index) => {
    const item = exchangeCart[index];
    setExchangeEditingDiscountIndex(index);
    setExchangeDiscountValue(item.discount > 0 ? item.discount.toString() : "");
    setExchangeDiscountType("fixed");
  };

  const saveDiscountEdit = (index) => {
    const item = cart[index];
    const inputValue = parseFloat(discountValue) || 0;
    const itemTotal = item.price * item.quantity;
    
    let finalDiscount = 0;
    if (discountType === "percentage") {
      // Convert percentage to dollar amount
      finalDiscount = (inputValue / 100) * itemTotal;
    } else {
      finalDiscount = inputValue;
    }
    
    // Ensure discount doesn't exceed item total
    finalDiscount = Math.min(finalDiscount, itemTotal);
    
    updateDiscount(index, finalDiscount);
    setEditingDiscountIndex(null);
    setDiscountValue("");
  };

  const saveExchangeDiscountEdit = (index) => {
    const item = exchangeCart[index];
    const inputValue = parseFloat(exchangeDiscountValue) || 0;
    const itemTotal = item.price * item.quantity;
    
    let finalDiscount = 0;
    if (exchangeDiscountType === "percentage") {
      finalDiscount = (inputValue / 100) * itemTotal;
    } else {
      finalDiscount = inputValue;
    }
    
    finalDiscount = Math.min(finalDiscount, itemTotal);
    
    updateExchangeDiscount(index, finalDiscount);
    setExchangeEditingDiscountIndex(null);
    setExchangeDiscountValue("");
  };

  const saveExchangePriceEdit = (index) => {
    updateExchangePrice(index, exchangeEditingPriceValue);
    setExchangeEditingPriceIndex(null);
    setExchangeEditingPriceValue("");
  };

  const handleLocationSwitch = (newLocationId) => {
    setLocationId(newLocationId);
    setSelectedLocationId(newLocationId);
    setSearchQuery("");
    setShopifyProductsState([]);
    setSearchResults([]);
    setShopifyLocationScope(null);
    setShowLocationDropdown(false);
  };

  const updateSplitPayment = (index, field, value) => {
    const newPayments = [...splitPayments];
    newPayments[index][field] =
      field === "amount" ? toNonNegativeAmount(value) : value;
    setSplitPayments(newPayments);
  };

  const updateExchangeSplitPayment = (index, field, value) => {
    const newPayments = [...exchangeSplitPayments];
    newPayments[index][field] =
      field === "amount" ? toNonNegativeAmount(value) : value;
    setExchangeSplitPayments(newPayments);
  };

  const addSplitPayment = () => {
    // Find first available payment method not already selected
    const usedMethods = splitPayments.map((p) => p.method);
    const availableMethod = paymentMethods.find(
      (m) => !usedMethods.includes(m.value),
    );
    const defaultMethod = availableMethod ? availableMethod.value : "cash";
    setSplitPayments([...splitPayments, { method: defaultMethod, amount: 0 }]);
  };

  const addExchangeSplitPayment = () => {
    // Find first available payment method not already selected
    const usedMethods = exchangeSplitPayments.map((p) => p.method);
    const availableMethod = paymentMethods.find(
      (m) => !usedMethods.includes(m.value),
    );
    const defaultMethod = availableMethod ? availableMethod.value : "cash";
    setExchangeSplitPayments([
      ...exchangeSplitPayments,
      { method: defaultMethod, amount: 0 },
    ]);
  };

  const removeSplitPayment = (index) => {
    if (splitPayments.length > 1) {
      setSplitPayments(splitPayments.filter((_, i) => i !== index));
    }
  };

  const removeExchangeSplitPayment = (index) => {
    if (exchangeSplitPayments.length > 1) {
      setExchangeSplitPayments(
        exchangeSplitPayments.filter((_, i) => i !== index),
      );
    }
  };

  const cartSubtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const cartLineItemDiscounts = cart.reduce(
    (sum, item) => sum + (item.discount || 0),
    0,
  );
  const cartTotal = Math.max(0, cartSubtotal - cartLineItemDiscounts - transactionDiscount);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const exchangeCartSubtotal = exchangeCart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const exchangeCartLineItemDiscounts = exchangeCart.reduce(
    (sum, item) => sum + (item.discount || 0),
    0,
  );
  const exchangeCartTotal = Math.max(0, exchangeCartSubtotal - exchangeCartLineItemDiscounts);
  const exchangeCartCount = exchangeCart.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  const splitPaymentTotal = splitPayments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0,
  );
  const splitPaymentValidation =
    splitPaymentTotal <= cartTotal && splitPaymentTotal > 0;

  const exchangeSplitPaymentTotal = exchangeSplitPayments.reduce(
    (sum, p) => sum + (parseFloat(p.amount) || 0),
    0,
  );

  const clearCart = () => {
    setCart([]);
    setNotes("");
    setSelectedPaymentMethod("cash");
    setUseSplitPayment(false);
    setSplitPayments([{ method: "cash", amount: 0 }]);
    setTransactionDiscount(0);
    setTransactionDiscountType("fixed");
    setDiscountReason("");
    setShowTransactionDiscount(false);
  };

  const handlePrintReceipt = () => {
    if (!receipt) return;
    printReceiptInBrowser({
      receipt,
      organizationName: activeOrganization?.name,
      locationLabel: getLocationLabel(locationId),
    });
  };

  const handleSendEmail = async () => {
    if (!emailInput.trim()) {
      setEmailError("Please enter an email address");
      return;
    }
    setSendingEmail(true);
    setEmailError("");
    try {
      await apiFetch("/receipts/email", {
        method: "POST",
        body: {
          email: emailInput,
          receiptNumber: receipt.receiptNumber,
          saleData: receipt,
        },
      });
      setEmailInput("");
      alert("Receipt sent successfully!");
    } catch (err) {
      setEmailError(err.message || "Failed to send email");
    } finally {
      setSendingEmail(false);
    }
  };

  // ========== RETURNS MODE HANDLERS ==========

  const enterReturnMode = () => {
    setReturnMode(true);
    setExchangeMode(false);
    setShowReturnLookup(true);
    setReceiptSearchQuery("");
    setOriginalSale(null);
    setReturnItems({});
    setReturnReason("customer-request");
    setLookupError("");
  };

  const exitReturnMode = () => {
    setReturnMode(false);
    setShowReturnLookup(false);
    setReceiptSearchQuery("");
    setOriginalSale(null);
    setReturnItems({});
    setReturnReason("customer-request");
    setLookupError("");
    setProcessingReturn(false);
  };

  const enterExchangeMode = () => {
    setExchangeMode(true);
    setReturnMode(false);
    setShowReturnLookup(false);
    setReceiptSearchQuery("");
    setOriginalSale(null);
    setReturnItems({});
    setReturnReason("customer-request");
    setLookupError("");
    setExchangeCart([]);
    setExchangeSelectedPaymentMethod("cash");
    setExchangeUseSplitPayment(false);
    setExchangeSplitPayments([{ method: "cash", amount: 0 }]);
  };

  const exitExchangeMode = () => {
    setExchangeMode(false);
    setReturnMode(false);
    setShowReturnLookup(false);
    setReceiptSearchQuery("");
    setOriginalSale(null);
    setReturnItems({});
    setReturnReason("customer-request");
    setLookupError("");
    setExchangeCart([]);
    setExchangeSelectedPaymentMethod("cash");
    setExchangeUseSplitPayment(false);
    setExchangeSplitPayments([{ method: "cash", amount: 0 }]);
    setProcessingExchange(false);
  };

  const lookupSale = async () => {
    if (!receiptSearchQuery.trim()) {
      setLookupError("Please enter a receipt number or idempotency key");
      return;
    }

    setLookupError("");
    try {
      const query = receiptSearchQuery.trim();
      // Try both receiptNumber and idempotencyKey
      const res = await apiFetch(
        `/sales?receiptNumber=${encodeURIComponent(query)}&idempotencyKey=${encodeURIComponent(query)}`,
      );
      const sales = res?.data?.sales || res?.data || res || [];

      if (!sales.length) {
        setLookupError("Receipt not found");
        return;
      }

      const sale = sales[0];

      // Check if all items are fully refunded
      const allRefunded = sale.items.every(
        (item) => item.quantityRefunded >= item.quantity,
      );

      if (allRefunded) {
        setLookupError("This receipt has been fully refunded");
        return;
      }

      setOriginalSale(sale);
      setShowReturnLookup(false);

      // Initialize return items with available quantities
      const initialReturnItems = {};
      sale.items.forEach((item, idx) => {
        const availableQty = item.quantity - (item.quantityRefunded || 0);
        if (availableQty > 0) {
          initialReturnItems[idx] = {
            selected: false,
            quantity: 0,
            maxQuantity: availableQty,
          };
        }
      });
      setReturnItems(initialReturnItems);
    } catch (err) {
      setLookupError(err.message || "Failed to lookup receipt");
    }
  };

  const toggleReturnItem = (itemIndex) => {
    setReturnItems((prev) => ({
      ...prev,
      [itemIndex]: {
        ...prev[itemIndex],
        selected: !prev[itemIndex].selected,
        quantity: !prev[itemIndex].selected ? prev[itemIndex].maxQuantity : 0,
      },
    }));
  };

  const updateReturnQty = (itemIndex, newQty) => {
    const qty = Math.max(
      0,
      Math.min(newQty, returnItems[itemIndex].maxQuantity),
    );
    setReturnItems((prev) => ({
      ...prev,
      [itemIndex]: {
        ...prev[itemIndex],
        quantity: qty,
        selected: qty > 0,
      },
    }));
  };

  const calculateReturnTotal = () => {
    if (!originalSale) return 0;

    let total = 0;
    Object.entries(returnItems).forEach(([idx, returnItem]) => {
      if (returnItem.selected && returnItem.quantity > 0) {
        const originalItem = originalSale.items[parseInt(idx)];
        total += originalItem.unitPrice * returnItem.quantity;
      }
    });

    return total;
  };

  const getExchangeNetBalance = () => exchangeCartTotal - calculateReturnTotal();

  const exchangeNetBalance = getExchangeNetBalance();
  const exchangeNetDue = Math.max(0, exchangeNetBalance);
  const exchangeSplitPaymentValidation =
    exchangeSplitPaymentTotal <= exchangeNetDue && exchangeSplitPaymentTotal > 0;

  const processReturn = async () => {
    if (!originalSale) return;

    const selectedItems = Object.entries(returnItems).filter(
      ([_, item]) => item.selected && item.quantity > 0,
    );

    if (selectedItems.length === 0) {
      setError("Please select at least one item to return");
      return;
    }

    if (!returnReason) {
      setError("Please select a return reason");
      return;
    }

    setProcessingReturn(true);
    setError("");

    try {
      const refundItems = selectedItems.map(([idx, returnItem]) => {
        return {
          itemIndex: parseInt(idx),
          quantity: returnItem.quantity,
        };
      });

      const payload = {
        items: refundItems,
        reason: returnReason,
        notes: notes || undefined,
      };

      const res = await apiFetch(`/sales/${originalSale._id}/refund`, {
        method: "POST",
        body: payload,
      });

      const refundData = res?.data || res;

      // Build return receipt
      const returnReceiptInfo = {
        receiptNumber: `RETURN-${originalSale.receiptNumber}`,
        originalReceiptNumber: originalSale.receiptNumber,
        isReturn: true,
        items: selectedItems.map(([idx, returnItem]) => {
          const originalItem = originalSale.items[parseInt(idx)];
          return {
            name:
              originalItem.productName ||
              originalItem.product?.name ||
              "Unknown Product",
            quantity: returnItem.quantity,
            price: originalItem.unitPrice,
            type: originalItem.type,
          };
        }),
        returnReason,
        subtotal: calculateReturnTotal(),
        notes,
        timestamp: new Date().toISOString(),
      };

      setReceipt(returnReceiptInfo);
      setShowReceipt(true);
      setStatus(`✓ Return processed: ${returnReceiptInfo.receiptNumber}`);

      // Exit return mode
      exitReturnMode();

      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to process return");
    } finally {
      setProcessingReturn(false);
    }
  };

  const processExchange = async () => {
    if (!originalSale) return;

    if (!locationId) {
      setError("Please select a location before completing the exchange.");
      if (!locations || locations.length === 0) {
        setShowNoLocationsModal(true);
      } else if (locations.length > 1) {
        setShowLocationPicker(true);
      }
      return;
    }

    if (locations && locations.length > 0 && !locations.includes(locationId)) {
      setError("You don't have access to the selected location.");
      setShowLocationPicker(true);
      setLocationId("");
      setSelectedLocationId(null);
      return;
    }

    const selectedItems = Object.entries(returnItems).filter(
      ([_, item]) => item.selected && item.quantity > 0,
    );

    if (selectedItems.length === 0) {
      setError("Please select at least one item to return");
      return;
    }

    if (exchangeCart.length === 0) {
      setError("Please add at least one exchange item");
      return;
    }

    if (!returnReason) {
      setError("Please select a return reason");
      return;
    }

    const returnTotal = calculateReturnTotal();
    const exchangeTotal = exchangeCartTotal;
    const netBalance = getExchangeNetBalance();
    const netDue = Math.max(0, netBalance);

    if (netDue > 0 && exchangeUseSplitPayment) {
      const isValidSplit =
        exchangeSplitPaymentTotal <= netDue && exchangeSplitPaymentTotal > 0;
      if (!isValidSplit) {
        setError("Split payment total must be between 0 and net due.");
        return;
      }
    }

    setProcessingExchange(true);
    setError("");

    try {
      const refundItems = selectedItems.map(([idx, returnItem]) => ({
        itemIndex: parseInt(idx),
        quantity: returnItem.quantity,
      }));

      const refundPayload = {
        items: refundItems,
        reason: returnReason,
        notes: notes || undefined,
      };

      await apiFetch(`/sales/${originalSale._id}/refund`, {
        method: "POST",
        body: refundPayload,
      });

      const formattedItems = exchangeCart.map((item) => {
        const baseItem = {
          type: item.type,
          quantity: item.quantity,
          unitPrice: item.price,
          discount: item.discount || 0,
        };

        if (item.type === "shopify") {
          return {
            ...baseItem,
            shopifyVariantId: item.variant,
            sku: item.sku || undefined,
            productName: item.name,
          };
        }

        return {
          ...baseItem,
          productId: item.variant,
        };
      });

      // Calculate payments for the new sale
      // Note: The refund is handled separately via /sales/:id/refund
      const exchangeCreditAmount = Math.min(returnTotal, exchangeTotal);
      let payments = [];
      
      if (netDue > 0) {
        // Customer owes additional money beyond the return credit
        // Need to record both the customer payment AND the return credit
        const customerPayments = exchangeUseSplitPayment
          ? exchangeSplitPayments
              .filter((p) => parseFloat(p.amount) > 0)
              .map((p) => ({
                method: p.method,
                amount: parseFloat(p.amount),
                status: "completed",
              }))
          : [
              {
                method: exchangeSelectedPaymentMethod,
                amount: netDue,
                status: "completed",
              },
            ];
        
        // Add return credit as a payment
        payments = [
          ...customerPayments,
          {
            method: "credit",
            amount: exchangeCreditAmount,
            status: "completed",
          },
        ];
      } else {
        // Balanced or customer gets change - entire sale covered by return credit
        payments = [
          {
            method: "credit",
            amount: exchangeTotal,
            status: "completed",
          },
        ];
      }

      const salePayload = {
        locationId,
        items: formattedItems,
        paymentStatus: "completed",
        payments,
        tags: ["pos", "exchange"],
        notes: `Exchange for receipt ${originalSale.receiptNumber}. Return credit: $${exchangeCreditAmount.toFixed(2)}${notes ? `. ${notes}` : ""}`,
        idempotencyKey: buildSaleIdempotencyKey({
          organizationId:
            activeOrganization?._id || activeOrganization?.organizationId,
          locationId,
        }),
      };

      const saleRes = await apiFetch("/sales", {
        method: "POST",
        body: salePayload,
      });

      const saleData = saleRes?.data || saleRes;
      const saleReceiptNumber =
        saleData?.receiptNumber || `EX-${Date.now()}`;

      const returnReceiptInfo = {
        receiptNumber: `RETURN-${originalSale.receiptNumber}`,
        originalReceiptNumber: originalSale.receiptNumber,
        isReturn: true,
        items: selectedItems.map(([idx, returnItem]) => {
          const originalItem = originalSale.items[parseInt(idx)];
          return {
            name:
              originalItem.productName ||
              originalItem.product?.name ||
              "Unknown Product",
            quantity: returnItem.quantity,
            price: originalItem.unitPrice,
            type: originalItem.type,
          };
        }),
        returnReason,
        subtotal: returnTotal,
        notes,
        timestamp: new Date().toISOString(),
      };

      const exchangeReceiptInfo = {
        receiptNumber: `EXCH-${saleReceiptNumber}`,
        originalReceiptNumber: originalSale.receiptNumber,
        returnReceiptNumber: returnReceiptInfo.receiptNumber,
        saleReceiptNumber,
        isExchange: true,
        returnItems: returnReceiptInfo.items,
        exchangeItems: exchangeCart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          type: item.type,
        })),
        returnReason,
        returnTotal,
        exchangeTotal,
        netBalance,
        payments: payments,
        notes,
        timestamp: new Date().toISOString(),
      };

      setReceipt(exchangeReceiptInfo);
      setShowReceipt(true);
      setStatus(`✓ Exchange completed: ${exchangeReceiptInfo.receiptNumber}`);

      // Exit exchange mode
      exitExchangeMode();

      // Refresh product cache
      scheduleProductRefresh();

      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      const errMsg = err?.message || "";
      if (err.status === 400 && errMsg.includes("open shift")) {
        setError(errMsg);
      } else {
        setError(errMsg || "Failed to process exchange");
      }
    } finally {
      setProcessingExchange(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    if (checkingPreviousDayShift) {
      setError("Checking shift status. Please wait a moment.");
      return;
    }

    if (!locationId) {
      setError("Please select a location before completing the sale.");
      if (!locations || locations.length === 0) {
        setShowNoLocationsModal(true);
      } else if (locations.length > 1) {
        setShowLocationPicker(true);
      }
      return;
    }

    if (locations && locations.length > 0 && !locations.includes(locationId)) {
      setError("You don't have access to the selected location.");
      return;
    }

    if (previousDayOpenShift) {
      setShowPreviousDayShiftModal(true);
      setError("Close the previous day's shift before completing a new sale.");
      return;
    }

    // Show Complete Checkout Modal
    setError("");
    setShowCompleteCheckoutModal(true);
  };

  const handleCompleteCheckout = async (checkoutData) => {
    const {
      notes: checkoutNotes,
      paymentMethod,
      splitPayments: cbSplitPayments,
      useSplitPayment: isSplitPayment,
      deliveryInfo,
      deliveryFee,
      isReservation,
    } = checkoutData;
    const normalizedSplitPayments = normalizeSplitPaymentAmounts(cbSplitPayments);
    const positiveSplitPayments = normalizedSplitPayments.filter(
      (payment) => payment.amount > 0,
    );

    setStatus("Processing...");
    setError("");

    try {
      if (isSplitPayment) {
        const totalAmount = positiveSplitPayments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        );
        if (totalAmount <= 0 || totalAmount > cartTotal + deliveryFee) {
          setError("Split payment total must be between 0 and cart total.");
          return;
        }
      }

      const formattedItems = cart.map((item) => {
        const baseItem = {
          type: item.type,
          quantity: item.quantity,
          unitPrice: item.price,
          discount: item.discount || 0,
        };
        if (item.type === "shopify") {
          return {
            ...baseItem,
            shopifyVariantId: item.variant,
            sku: item.sku || undefined,
            productName: item.name,
          };
        }
        return {
          ...baseItem,
          productId: item.variant,
        };
      });

      const payload = {
        locationId,
        items: formattedItems,
        notes: checkoutNotes || undefined,
        idempotencyKey: buildSaleIdempotencyKey({
          organizationId:
            activeOrganization?._id || activeOrganization?.organizationId,
          locationId,
        }),
      };

      const paidAmount = isSplitPayment
        ? positiveSplitPayments.reduce(
            (sum, payment) => sum + payment.amount,
            0,
          )
        : cartTotal + deliveryFee;
      const balanceDue = Math.max(0, cartTotal + deliveryFee - paidAmount);
      const isReservationSale = Boolean(isReservation || balanceDue > 0.01);

      payload.paymentStatus = isReservationSale ? "partial" : "completed";
      payload.tags = [
        "pos",
        ...(isSplitPayment ? ["split-payment"] : []),
        ...(isReservationSale ? ["reservation", "partial-payment"] : []),
      ];

      if (deliveryInfo) {
        payload.requiresDelivery = true;
        payload.deliveryInfo = {
          requiresDelivery: true,
          recipientName: deliveryInfo.recipientName,
          recipientPhone: deliveryInfo.recipientPhone,
          deliveryAddress: deliveryInfo.deliveryAddress,
          deliveryCategory: deliveryInfo.deliveryCategory,
          deliveryOption: deliveryInfo.deliveryOption,
          deliveryFee,
        };
      }

      if (isSplitPayment) {
        payload.payments = positiveSplitPayments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
            status: "completed",
            paidAt: new Date().toISOString(),
          }));
      } else {
        payload.paymentMethod = paymentMethod;
      }

      const res = await apiFetch("/sales", { method: "POST", body: payload });
      const receiptData = res?.data || res;
      const receiptNumber = receiptData?.receiptNumber || "RECEIPT-" + Date.now();
      const receiptInfo = {
        receiptNumber,
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          type: item.type,
          discount: item.discount || 0,
        })),
        payments: isSplitPayment
          ? positiveSplitPayments
          : [{ method: paymentMethod, amount: cartTotal + deliveryFee }],
        subtotal: cartTotal,
        deliveryFee: deliveryFee || 0,
        deliveryInfo: deliveryInfo || undefined,
        deliveryFeeId: receiptData?.deliveryFeeId,
        trackingNumber: receiptData?.trackingNumber,
        totalDiscount: cartLineItemDiscounts + transactionDiscount,
        discountReason: discountReason || undefined,
        notes: checkoutNotes,
        amountPaid: paidAmount,
        balanceDue,
        isReservation: isReservationSale,
        paymentStatus: receiptData?.paymentStatus || payload.paymentStatus,
        tags: Array.isArray(receiptData?.tags) ? receiptData.tags : payload.tags,
        timestamp: new Date().toISOString(),
      };

      setReceipt(receiptInfo);
      setShowReceipt(true);
      setStatus(
        isReservationSale
          ? `✓ Reservation created: ${receiptNumber}`
          : `✓ Sale completed: ${receiptNumber}`,
      );
      clearCart();
      setShowCompleteCheckoutModal(false);
      scheduleProductRefresh();
      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      const errCode = err?.details?.code || err?.code || err?.response?.data?.code;
      if (err.status === 403 && errCode === "LOCATION_ACCESS_DENIED") {
        setError("Access denied: You don't have permission to transact at this location.");
        setShowLocationPicker(true);
        setLocationId("");
        setSelectedLocationId(null);
        return;
      }

      const errMessage = err?.message || err?.details?.message || "";
      if (err.status === 400 && errMessage.includes("open shift")) {
        setError(errMessage);
        return;
      }

      try {
        const formattedItems = cart.map((item) => {
          const baseItem = {
            type: item.type,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount || 0,
          };
          if (item.type === "shopify") {
            return {
              ...baseItem,
              shopifyVariantId: item.variant,
              sku: item.sku || undefined,
              productName: item.name,
            };
          }
          return {
            ...baseItem,
            productId: item.variant,
          };
        });

        const offlinePayload = {
          locationId,
          items: formattedItems,
          notes: checkoutNotes || undefined,
        };

        const offlinePaidAmount = isSplitPayment
          ? positiveSplitPayments.reduce(
              (sum, payment) => sum + payment.amount,
              0,
            )
          : cartTotal + deliveryFee;
        const offlineBalanceDue = Math.max(
          0,
          cartTotal + deliveryFee - offlinePaidAmount,
        );
        const isOfflineReservation = offlineBalanceDue > 0.01;

        offlinePayload.paymentStatus = isOfflineReservation
          ? "partial"
          : "completed";
        offlinePayload.tags = [
          "pos",
          ...(isSplitPayment ? ["split-payment"] : []),
          ...(isOfflineReservation ? ["reservation", "partial-payment"] : []),
        ];

        if (deliveryInfo) {
          offlinePayload.requiresDelivery = true;
          offlinePayload.deliveryInfo = {
            recipientName: deliveryInfo.recipientName,
            recipientPhone: deliveryInfo.recipientPhone,
            deliveryAddress: {
              street: deliveryInfo.deliveryStreet,
              city: deliveryInfo.deliveryCity,
              country: deliveryInfo.deliveryCountry,
            },
            deliveryCategory: deliveryInfo.category,
            deliveryOption: deliveryInfo.option,
            deliveryFee,
          };
        }

        if (isSplitPayment) {
          offlinePayload.payments = positiveSplitPayments
            .map((payment) => ({
              method: payment.method,
              amount: payment.amount,
              status: "completed",
              paidAt: new Date().toISOString(),
            }));
        } else {
          offlinePayload.paymentMethod = paymentMethod;
        }

        const idempotencyKey = buildSaleIdempotencyKey({
          organizationId: activeOrganization?.id,
          locationId,
        });
        offlinePayload.idempotencyKey = idempotencyKey;
        await savePendingSale(offlinePayload);
        await updatePendingCounts();

        const offlineReceipt = {
          receiptNumber: idempotencyKey,
          timestamp: new Date().toISOString(),
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.customPrice ?? item.price,
          })),
          subtotal: cartTotal,
          deliveryFee: deliveryFee || 0,
          payments: isSplitPayment
            ? positiveSplitPayments
                .map((payment) => ({
                  method: payment.method,
                  amount: payment.amount,
                }))
            : [{ method: paymentMethod, amount: cartTotal + deliveryFee }],
          notes: checkoutNotes,
          amountPaid: offlinePaidAmount,
          balanceDue: offlineBalanceDue,
          isReservation: isOfflineReservation,
          paymentStatus: offlinePayload.paymentStatus,
          tags: offlinePayload.tags,
          isOffline: true,
        };

        setReceipt(offlineReceipt);
        setShowReceipt(true);
        setStatus("⚠ Sale saved offline. Will sync when online.");
        clearCart();
        setShowCompleteCheckoutModal(false);
        scheduleProductRefresh();
        setTimeout(() => setStatus(""), 3000);
      } catch (saveErr) {
        setError("Failed to save sale: " + saveErr.message);
      }
      setStatus("");
    }
  };

  // Unused - moved to handleCompleteCheckout
  const submitSaleWithDelivery = async (deliveryData, fee) => {
    setStatus("Processing...");
    setError("");

    try {
      if (useSplitPayment && !splitPaymentValidation) {
        setError("Split payment total must be between 0 and cart total.");
        return;
      }

      const formattedItems = cart.map((item) => {
        const baseItem = {
          type: item.type,
          quantity: item.quantity,
          unitPrice: item.price,
          discount: item.discount || 0,
        };

        if (item.type === "shopify") {
          return {
            ...baseItem,
            shopifyVariantId: item.variant,
            sku: item.sku || undefined,
            productName: item.name,
          };
        } else {
          return {
            ...baseItem,
            productId: item.variant,
          };
        }
      });

      const payload = {
        locationId,
        items: formattedItems,
        paymentStatus: "completed",
        tags: useSplitPayment ? ["pos", "split-payment"] : ["pos"],
        notes: notes || undefined,
        idempotencyKey: buildSaleIdempotencyKey({
          organizationId:
            activeOrganization?._id || activeOrganization?.organizationId,
          locationId,
        }),
        requiresDelivery: true,
        deliveryInfo: {
          recipientName: deliveryData.recipientName,
          recipientPhone: deliveryData.recipientPhone,
          deliveryAddress: {
            street: deliveryData.deliveryStreet,
            city: deliveryData.deliveryCity,
            country: deliveryData.deliveryCountry,
          },
          deliveryCategory: deliveryData.category,
          deliveryOption: deliveryData.option,
          deliveryFee: fee,
        },
      };

      if (useSplitPayment) {
        payload.payments = splitPayments
          .filter((p) => parseFloat(p.amount) > 0)
          .map((p) => ({
            method: p.method,
            amount: parseFloat(p.amount),
            status: "completed",
          }));
      } else {
        payload.paymentMethod = selectedPaymentMethod;
      }

      const res = await apiFetch("/sales", { method: "POST", body: payload });
      const receiptData = res?.data || res;
      const receiptNumber =
        receiptData?.receiptNumber || "RECEIPT-" + Date.now();

      const receiptInfo = {
        receiptNumber,
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          type: item.type,
          discount: item.discount || 0,
        })),
        payments: useSplitPayment
          ? splitPayments.filter((p) => parseFloat(p.amount) > 0)
          : [{ method: selectedPaymentMethod, amount: cartTotal + fee }],
        subtotal: cartTotal,
        deliveryFee: fee,
        totalDiscount: cartLineItemDiscounts + transactionDiscount,
        discountReason: discountReason || undefined,
        notes,
        paymentStatus: payload.paymentStatus,
        tags: payload.tags,
        timestamp: new Date().toISOString(),
      };

      setReceipt(receiptInfo);
      setShowReceipt(true);
      setStatus(`✓ Sale completed: ${receiptNumber}`);
      clearCart();

      scheduleProductRefresh();

      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      const errMessage = err?.message || err?.response?.data?.message || "";

      if (
        errMessage.includes("Delivery") ||
        errMessage.includes("delivery") ||
        errMessage.includes("address") ||
        errMessage.includes("deliveryCategory")
      ) {
        setError(
          "Delivery validation failed: " +
            (errMessage || "Please check your delivery information"),
        );
        setStatus("");
        return;
      }

      if (err.status === 400 && errMessage.includes("open shift")) {
        setError(errMessage);
        return;
      }

      try {
        const offlinePayload = {
          locationId,
          items: formattedItems,
          paymentStatus: "completed",
          tags: useSplitPayment ? ["pos", "split-payment"] : ["pos"],
          notes: notes || undefined,
          requiresDelivery: true,
          deliveryInfo: {
            recipientName: deliveryData.recipientName,
            recipientPhone: deliveryData.recipientPhone,
            deliveryAddress: {
              street: deliveryData.deliveryStreet,
              city: deliveryData.deliveryCity,
              country: deliveryData.deliveryCountry,
            },
            deliveryCategory: deliveryData.category,
            deliveryOption: deliveryData.option,
            deliveryFee: fee,
          },
        };

        if (useSplitPayment) {
          offlinePayload.payments = splitPayments
            .filter((p) => parseFloat(p.amount) > 0)
            .map((p) => ({
              method: p.method,
              amount: parseFloat(p.amount),
              status: "completed",
            }));
        } else {
          offlinePayload.paymentMethod = selectedPaymentMethod;
        }

        const idempotencyKey = buildSaleIdempotencyKey({
          organizationId: activeOrganization?.id,
          locationId,
        });

        offlinePayload.idempotencyKey = idempotencyKey;

        await savePendingSale(offlinePayload);

        await updatePendingCounts();

        const offlineReceipt = {
          receiptNumber: idempotencyKey,
          timestamp: new Date().toISOString(),
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.customPrice ?? item.price,
          })),
          subtotal: cartTotal,
          deliveryFee: fee,
          payments: useSplitPayment
            ? splitPayments
                .filter((p) => parseFloat(p.amount) > 0)
                .map((p) => ({
                  method: p.method,
                  amount: parseFloat(p.amount),
                }))
            : [{ method: selectedPaymentMethod, amount: cartTotal + fee }],
          notes,
          paymentStatus: offlinePayload.paymentStatus,
          tags: offlinePayload.tags,
          isOffline: true,
        };

        setReceipt(offlineReceipt);
        setShowReceipt(true);
        setStatus("⚠ Sale saved offline. Will sync when online.");
        clearCart();

        scheduleProductRefresh();

        setTimeout(() => setStatus(""), 3000);
      } catch (saveErr) {
        setError("Failed to save sale: " + saveErr.message);
      }
    }

    setStatus("");
  };

  // Unused - moved to handleCompleteCheckout
  const submitSaleWithoutDelivery = async () => {
    setStatus("Processing...");
    setError("");

    try {
      if (useSplitPayment && !splitPaymentValidation) {
        setError("Split payment total must be between 0 and cart total.");
        return;
      }

      const formattedItems = cart.map((item) => {
        const baseItem = {
          type: item.type,
          quantity: item.quantity,
          unitPrice: item.price,
          discount: item.discount || 0,
        };

        if (item.type === "shopify") {
          return {
            ...baseItem,
            shopifyVariantId: item.variant,
            sku: item.sku || undefined,
            productName: item.name,
          };
        } else {
          return {
            ...baseItem,
            productId: item.variant,
          };
        }
      });

      const payload = {
        locationId,
        items: formattedItems,
        paymentStatus: "completed",
        tags: useSplitPayment ? ["pos", "split-payment"] : ["pos"],
        notes: notes || undefined,
        idempotencyKey: buildSaleIdempotencyKey({
          organizationId:
            activeOrganization?._id || activeOrganization?.organizationId,
          locationId,
        }),
      };

      if (useSplitPayment) {
        payload.payments = splitPayments
          .filter((p) => parseFloat(p.amount) > 0)
          .map((p) => ({
            method: p.method,
            amount: parseFloat(p.amount),
            status: "completed",
          }));
      } else {
        payload.paymentMethod = selectedPaymentMethod;
      }

      const res = await apiFetch("/sales", { method: "POST", body: payload });
      const receiptData = res?.data || res;
      const receiptNumber =
        receiptData?.receiptNumber || "RECEIPT-" + Date.now();

      const receiptInfo = {
        receiptNumber,
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          type: item.type,
          discount: item.discount || 0,
        })),
        payments: useSplitPayment
          ? splitPayments.filter((p) => parseFloat(p.amount) > 0)
          : [{ method: selectedPaymentMethod, amount: cartTotal }],
        subtotal: cartTotal,
        totalDiscount: cartLineItemDiscounts + transactionDiscount,
        discountReason: discountReason || undefined,
        notes,
        paymentStatus: payload.paymentStatus,
        tags: payload.tags,
        timestamp: new Date().toISOString(),
      };

      setReceipt(receiptInfo);
      setShowReceipt(true);
      setStatus(`✓ Sale completed: ${receiptNumber}`);
      clearCart();

      scheduleProductRefresh();

      setTimeout(() => setStatus(""), 3000);
    } catch (err) {
      const errCode =
        err?.details?.code || err?.code || err?.response?.data?.code;
      if (err.status === 403 && errCode === "LOCATION_ACCESS_DENIED") {
        setError(
          "Access denied: You don't have permission to transact at this location.",
        );
        setShowLocationPicker(true);
        setLocationId("");
        setSelectedLocationId(null);
        return;
      }

      try {
        const formattedItems = cart.map((item) => {
          const baseItem = {
            type: item.type,
            quantity: item.quantity,
            unitPrice: item.price,
            discount: item.discount || 0,
          };

          if (item.type === "shopify") {
            return {
              ...baseItem,
              shopifyVariantId: item.variant,
              sku: item.sku || undefined,
              productName: item.name,
            };
          } else {
            return {
              ...baseItem,
              productId: item.variant,
            };
          }
        });

        const offlinePayload = {
          locationId,
          items: formattedItems,
          paymentStatus: "completed",
          tags: useSplitPayment ? ["pos", "split-payment"] : ["pos"],
          notes: notes || undefined,
        };

        if (useSplitPayment) {
          offlinePayload.payments = splitPayments
            .filter((p) => parseFloat(p.amount) > 0)
            .map((p) => ({
              method: p.method,
              amount: parseFloat(p.amount),
              status: "completed",
            }));
        } else {
          offlinePayload.paymentMethod = selectedPaymentMethod;
        }

        const idempotencyKey = buildSaleIdempotencyKey({
          organizationId: activeOrganization?.id,
          locationId,
        });

        offlinePayload.idempotencyKey = idempotencyKey;

        await savePendingSale(offlinePayload);

        await updatePendingCounts();

        const offlineReceipt = {
          receiptNumber: idempotencyKey,
          timestamp: new Date().toISOString(),
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.customPrice ?? item.price,
          })),
          subtotal: cartTotal,
          payments: useSplitPayment
            ? splitPayments
                .filter((p) => parseFloat(p.amount) > 0)
                .map((p) => ({
                  method: p.method,
                  amount: parseFloat(p.amount),
                }))
            : [{ method: selectedPaymentMethod, amount: cartTotal }],
          notes,
          paymentStatus: offlinePayload.paymentStatus,
          tags: offlinePayload.tags,
          isOffline: true,
        };

        setReceipt(offlineReceipt);
        setShowReceipt(true);
        setStatus("⚠ Sale saved offline. Will sync when online.");
        clearCart();

        scheduleProductRefresh();

        setTimeout(() => setStatus(""), 3000);
      } catch (saveErr) {
        setError("Failed to save sale: " + saveErr.message);
      }

      setStatus("");
    }
  };

  const handleManualRetry = async (saleId) => {
    try {
      const result = await retrySingleSale(
        saleId,
        accessToken,
        deviceId,
        deviceName,
        activeOrganization?.slug,
      );
      if (result.success) {
        setPendingSales((prev) => prev.filter((s) => s.id !== saleId));
        setStatus("Pending sale synced!");
      } else {
        setError(`Failed to sync: ${result.error}`);
      }
    } catch (err) {
      setError("Retry failed: " + err.message);
    }
  };

  // Handle product click - show variants if multiple, or add to cart if single variant
  const handleProductClick = (product) => {
    const variants = product.variants || [];
    if (variants.length <= 1) {
      // Single variant or no variants - add directly to cart
      const variant = variants[0];
      const cartItem = {
        type: "shopify",
        variant: variant?.id || product.id,
        name: `${product.title}${variant?.title && variant.title !== "Default Title" ? ` - ${variant.title}` : ""}`,
        price: parseFloat(variant?.price) || 0,
        quantity: 1,
        sku: variant?.sku,
        discount: 0,
      };
      if (exchangeMode) {
        upsertCartItem(exchangeCart, setExchangeCart, cartItem);
      } else {
        upsertCartItem(cart, setCart, cartItem);
      }
    } else {
      // Multiple variants - show picker
      setVariantPickerProduct(product);
      setShowVariantPicker(true);
    }
  };

  // Handle variant selection from picker
  const handleVariantSelect = (variant) => {
    if (!variantPickerProduct) return;
    const cartItem = {
      type: "shopify",
      variant: variant.id,
      name: `${variantPickerProduct.title}${variant.title && variant.title !== "Default Title" ? ` - ${variant.title}` : ""}`,
      price: parseFloat(variant.price) || 0,
      quantity: 1,
      sku: variant.sku,
      discount: 0,
    };
    if (exchangeMode) {
      upsertCartItem(exchangeCart, setExchangeCart, cartItem);
    } else {
      upsertCartItem(cart, setCart, cartItem);
    }
    setShowVariantPicker(false);
    setVariantPickerProduct(null);
  };

  // Debounced search handler
  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (productTab !== "shopify") {
      return;
    }

    // Clear existing timer
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    // Debounce search by 200ms
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchShopifyProducts(query, 100);
        setSearchResults(results);
      } catch (error) {
        console.error("Search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    setSearchDebounceTimer(timer);
  };

  // Load products with timestamp tracking
  const handleLoadProducts = async () => {
    await loadShopifyProductsData();
    setLastSyncTimestamp(new Date().toISOString());
  };

  const filteredServiceProducts = serviceProducts.filter((product) => {
    const matchesSearch = product.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesTab = productTab === "services";
    return matchesSearch && matchesTab;
  });

  // Background refresh after sale (debounced)
  const scheduleProductRefresh = () => {
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer);
    }

    // Debounce by 2 seconds to batch multiple rapid sales
    const timer = setTimeout(async () => {
      if (navigator.onLine && shopifyConnection?.status === "active") {
        console.log(
          "[POS] Background refresh: Fetching updated Shopify products",
        );
        try {
          await loadShopifyProductsData();
          setLastSyncTimestamp(new Date().toISOString());
        } catch (error) {
          console.error("[POS] Background refresh failed:", error);
        }
      }
    }, 2000);

    setRefreshDebounceTimer(timer);
  };

  const filteredProducts = mockProducts.filter((p) => {
    const matchesSearch = p.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesTab = p.type === productTab;
    return matchesSearch && matchesTab;
  });
  const isPartialReceipt = hasPartialPaymentSignal(receipt);
  const receiptAmountPaid = toNonNegativeAmount(receipt?.amountPaid);
  const receiptBalanceDue = toNonNegativeAmount(receipt?.balanceDue);

  return (
    <div className="flex flex-col bg-gray-50 min-h-0 h-full md:h-[calc(100vh-8rem)]">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Point of Sale</h1>
        </div>
        <div className="flex items-center gap-3">
          {!isOnline && (
            <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
              Offline
            </span>
          )}
          {pendingSalesCount > 0 && (
            <button
              onClick={() => setShowPendingSales(!showPendingSales)}
              className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium hover:bg-amber-200"
            >
              {pendingSalesCount} pending
            </button>
          )}
          {locationId && (
            <div className="relative">
              <button
                onClick={() => {
                  if (locations && locations.length > 1) {
                    setShowLocationDropdown(!showLocationDropdown);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold ${
                  locations && locations.length > 1
                    ? "hover:bg-blue-200 cursor-pointer"
                    : "cursor-default"
                }`}
              >
                <span>📍</span>
                <span>{getLocationLabel(locationId)}</span>
                {locations && locations.length > 1 && (
                  <span className="text-blue-600 ml-1">▼</span>
                )}
              </button>
              {showLocationDropdown && locations && locations.length > 1 && (
                <div
                  className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-lg border border-gray-200 z-40"
                  style={{ minWidth: "200px" }}
                >
                  {locations.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => handleLocationSwitch(loc)}
                      className={`w-full text-left px-4 py-2 text-sm ${
                        locationId === loc
                          ? "bg-blue-50 text-blue-900 font-medium"
                          : "text-gray-700 hover:bg-gray-50"
                      } border-b border-gray-100 last:border-0`}
                    >
                      {getLocationLabel(loc)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {exchangeMode ? (
            <button
              onClick={exitExchangeMode}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600"
            >
              Exit Exchange
            </button>
          ) : returnMode ? (
            <button
              onClick={exitReturnMode}
              className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600"
            >
              Exit Returns
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={enterReturnMode}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
              >
                Returns
              </button>
              <button
                onClick={enterExchangeMode}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Exchange
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Location Picker Modal */}
      {showLocationPicker && locations && locations.length > 1 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Select Location
            </h2>
            <div className="grid gap-2">
              {locations.map((loc) => (
                <button
                  key={loc}
                  onClick={() => {
                    setLocationId(loc);
                    setSelectedLocationId(loc);
                    setSearchQuery("");
                    setShopifyProductsState([]);
                    setSearchResults([]);
                    setShopifyLocationScope(null);
                    setShowLocationPicker(false);
                  }}
                  className="px-4 py-3 text-left bg-blue-50 hover:bg-blue-100 rounded-lg text-blue-900 font-medium"
                >
                  {getLocationLabel(loc)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Loading Locations Indicator */}
      {locationsLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-4 shadow-xl">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-700 font-medium">Loading locations...</p>
          </div>
        </div>
      )}

      {/* No Locations Modal */}
      {showNoLocationsModal && !locationsLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-5xl mb-4">📍</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">
                No Locations Available
              </h2>
              <p className="text-gray-600 mb-6">
                You need to create at least one location before using the POS
                system. Locations help you track inventory and sales across
                different store locations.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => router.push("/dashboard/settings/locations")}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Go to Locations Settings
                </button>
                <button
                  onClick={() => setShowNoLocationsModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Previous Day Shift Block Modal */}
      <PreviousShiftBlockModal
        isOpen={showPreviousDayShiftModal}
        shift={previousDayOpenShift}
        onOpenShiftSessions={() => {
          router.push("/dashboard/sales-channels/pos/shifts");
        }}
        onRecheck={() => {
          if (locationId) {
            checkPreviousDayOpenShift(locationId);
          }
        }}
      />

      {/* Complete Checkout Modal */}
      <CompleteCheckoutModal
        isOpen={showCompleteCheckoutModal}
        cart={cart}
        cartTotal={cartTotal}
        cartDiscount={cartLineItemDiscounts + transactionDiscount}
        notes={notes}
        selectedPaymentMethod={selectedPaymentMethod}
        splitPayments={splitPayments}
        useSplitPayment={useSplitPayment}
        locationId={locationId}
        paymentMethods={paymentMethods}
        onNoteChange={setNotes}
        onPaymentMethodChange={setSelectedPaymentMethod}
        onSplitPaymentChange={(index, field, value) => {
          const updated = [...splitPayments];
          updated[index][field] =
            field === "amount" ? toNonNegativeAmount(value) : value;
          setSplitPayments(updated);
        }}
        onRemoveSplitPayment={(index) => {
          setSplitPayments(splitPayments.filter((_, i) => i !== index));
        }}
        onAddSplitPayment={() => {
          setSplitPayments([...splitPayments, { method: "cash", amount: 0 }]);
        }}
        onUseSplitPaymentChange={(checked) => {
          setUseSplitPayment(checked);
          if (checked) {
            setSplitPayments([{ method: "cash", amount: 0 }]);
          }
        }}
        onComplete={handleCompleteCheckout}
        onClose={() => setShowCompleteCheckoutModal(false)}
        status={status}
        error={error}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Products Section */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Search & Tabs */}
          <div className="bg-white border-b border-gray-200 p-4">
            <div className="relative mb-3">
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {isSearching && (
                <div className="absolute right-3 top-2.5">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setProductTab("flexi")}
                className={`px-4 py-2 rounded-lg font-medium ${productTab === "flexi" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                FLEXI
              </button>
              <button
                onClick={() => setProductTab("services")}
                className={`px-4 py-2 rounded-lg font-medium ${productTab === "services" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
              >
                Services
                {serviceProducts.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                    {serviceProducts.length}
                  </span>
                )}
              </button>
              {shopifyConnection && (
                <button
                  onClick={() => setProductTab("shopify")}
                  className={`px-4 py-2 rounded-lg font-medium ${productTab === "shopify" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  Shopify
                  {shopifyProducts.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                      {shopifyProducts.length}
                    </span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-auto p-4">
            {productTab === "services" &&
              filteredServiceProducts.length === 0 &&
              !serviceLoading && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 2c-4 0-7 2.7-7 6v2h14v-2c0-3.3-3-6-7-6z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Services Yet
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-sm">
                    Create active service products in Products to make them available in POS.
                  </p>
                  <button
                    onClick={() => router.push("/dashboard/products/services")}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Go to Services
                  </button>
                </div>
              )}

            {/* Empty State - No Shopify Products */}
            {productTab === "shopify" &&
              searchResults.length === 0 &&
              !isSearching && (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {shopifyLocationScope?.scoped &&
                    shopifyLocationScope?.hasMapping === false
                      ? "No Shopify Mapping for This Location"
                      : "No Cached Products"}
                  </h3>
                  <p className="text-sm text-gray-500 mb-4 max-w-sm">
                    {shopifyLocationScope?.scoped &&
                    shopifyLocationScope?.hasMapping === false
                      ? "Map this FLEXI location to a Shopify location in Settings to load products."
                      : navigator.onLine
                        ? "Load products from your Shopify store to start selling."
                        : "Sync when online to cache products for offline use."}
                  </p>
                  {lastSyncTimestamp && (
                    <p className="text-xs text-gray-400 mb-4">
                      Last synced:{" "}
                      {new Date(lastSyncTimestamp).toLocaleString()}
                    </p>
                  )}
                  {navigator.onLine &&
                    !(shopifyLocationScope?.scoped &&
                      shopifyLocationScope?.hasMapping === false) &&
                    shopifyConnection?.status === "active" && (
                      <button
                        onClick={handleLoadProducts}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Load Shopify Products
                      </button>
                    )}
                </div>
              )}

            {/* Product Grid Display */}
            {((productTab === "shopify" && searchResults.length > 0) ||
              productTab !== "shopify") && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* FLEXI Products */}
                {productTab === "flexi" &&
                  filteredProducts.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => addToCart(product)}
                      className="bg-white rounded-lg border-2 border-gray-200 hover:border-blue-500 p-4 flex flex-col items-center gap-2 transition-all hover:shadow-lg"
                    >
                      <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center text-4xl">
                        📦
                      </div>
                      <h3 className="font-medium text-gray-900 text-center text-sm">
                        {product.name}
                      </h3>
                      <p className="text-lg font-bold text-blue-600">
                        ${product.price.toFixed(2)}
                      </p>
                    </button>
                  ))}

                {/* Services */}
                {productTab === "services" &&
                  filteredServiceProducts.map((product) => (
                    <button
                      key={product.id || product._id}
                      onClick={() => addToCart(product)}
                      className="bg-white rounded-lg border-2 border-gray-200 hover:border-blue-500 p-4 flex flex-col items-center gap-2 transition-all hover:shadow-lg"
                    >
                      <div className="w-full aspect-square bg-blue-50 rounded-lg flex items-center justify-center text-4xl">
                        🛎️
                      </div>
                      <h3 className="font-medium text-gray-900 text-center text-sm">
                        {product.name}
                      </h3>
                      <p className="text-xs text-gray-500 text-center">
                        {product.serviceKind === "bundle" ? "Service bundle" : "Service"}
                      </p>
                      <p className="text-lg font-bold text-blue-600">
                        ${Number(product.price || 0).toFixed(2)}
                      </p>
                    </button>
                  ))}

                {/* Shopify Products */}
                {productTab === "shopify" &&
                  searchResults.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => handleProductClick(product)}
                      className="bg-white rounded-lg border-2 border-gray-200 hover:border-blue-500 p-4 flex flex-col items-center gap-2 transition-all hover:shadow-lg relative"
                    >
                      {/* Variant Count Badge */}
                      {product.variants && product.variants.length > 1 && (
                        <span className="absolute top-2 right-2 z-10 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-600 rounded-full">
                          {product.variants.length} variants
                        </span>
                      )}

                      {/* Product Image */}
                      <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden relative">
                        {product.images && product.images.length > 0 ? (
                          <Image
                            src={`${product.images[0].url}?w=640&crop=center`}
                            alt={product.images[0].altText || product.title}
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover"
                          />
                        ) : (
                          <span className="text-4xl">🛍️</span>
                        )}
                      </div>

                      {/* Product Info */}
                      <h3 className="font-medium text-gray-900 text-center text-sm line-clamp-2">
                        {product.title}
                      </h3>

                      {/* Price */}
                      {product.variants && product.variants.length > 0 && (
                        <p className="text-lg font-bold text-blue-600">
                          ${parseFloat(product.variants[0].price).toFixed(2)}
                          {product.variants.length > 1 && (
                            <span className="text-sm text-gray-500">+</span>
                          )}
                        </p>
                      )}

                      {/* Vendor */}
                      {product.vendor && (
                        <p className="text-xs text-gray-500">
                          {product.vendor}
                        </p>
                      )}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col min-h-0 overflow-auto">
          {exchangeMode ? (
            <>
              {/* Exchange Header */}
              <div className="p-4 border-b border-gray-200 bg-indigo-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-indigo-900">
                      Process Exchange
                    </h2>
                    {originalSale && (
                      <p className="text-sm text-indigo-700 mt-1">
                        Receipt: {originalSale.receiptNumber}
                      </p>
                    )}
                  </div>
                  {!originalSale && (
                    <button
                      onClick={() => setShowReturnLookup(true)}
                      className="px-3 py-1 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700"
                    >
                      Lookup Receipt
                    </button>
                  )}
                </div>
              </div>

              {/* Return Items (only if originalSale exists) */}
              {originalSale && (
                <div className="border-b border-gray-200 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Return Items
                  </h3>
                  {originalSale.items.map((item, idx) => {
                    const returnItem = returnItems[idx];
                    if (!returnItem) return null;

                    const maxQty = returnItem.maxQuantity;
                    if (maxQty <= 0) return null;

                    return (
                      <div
                        key={idx}
                        className={`rounded-lg p-3 border-2 transition-all ${
                          returnItem.selected
                            ? "border-orange-500 bg-orange-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={returnItem.selected}
                            onChange={() => toggleReturnItem(idx)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm">
                              {item.productName ||
                                item.product?.name ||
                                "Unknown Product"}
                            </h4>
                            <p className="text-xs text-gray-600">
                              ${item.unitPrice.toFixed(2)} each
                            </p>
                            <p className="text-xs text-gray-500">
                              Available: {maxQty}
                            </p>
                          </div>
                        </div>

                        {returnItem.selected && (
                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  updateReturnQty(idx, returnItem.quantity - 1)
                                }
                                className="w-7 h-7 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm font-bold"
                              >
                                −
                              </button>
                              <span className="w-10 text-center font-medium text-sm">
                                {returnItem.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateReturnQty(idx, returnItem.quantity + 1)
                                }
                                className="w-7 h-7 bg-white border border-gray-300 rounded hover:bg-gray-100 text-sm font-bold"
                              >
                                +
                              </button>
                            </div>
                            <p className="font-bold text-orange-600 text-sm">
                              $
                              {(item.unitPrice * returnItem.quantity).toFixed(
                                2,
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Exchange Items */}
              <div className="flex-1 flex flex-col">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Exchange Items ({exchangeCartCount})
                    </h3>
                    {exchangeCart.length > 0 && (
                      <button
                        onClick={() => setExchangeCart([])}
                        className="text-sm text-red-600 hover:text-red-700 font-medium"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 p-4  space-y-2">
                  {exchangeCart.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm py-8">
                      <p className="text-3xl mb-2">🔄</p>
                      <p>Add items to exchange</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {exchangeCart.map((item, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 text-sm">
                                {item.name}
                              </h4>
                              <div className="flex items-center gap-2">
                                {exchangeEditingPriceIndex === index ? (
                                  <input
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                    value={exchangeEditingPriceValue}
                                    onChange={(e) =>
                                      setExchangeEditingPriceValue(
                                        e.target.value,
                                      )
                                    }
                                    onBlur={() => saveExchangePriceEdit(index)}
                                    onKeyDown={(e) =>
                                      e.key === "Enter" &&
                                      saveExchangePriceEdit(index)
                                    }
                                    className="w-20 px-2 py-1 border border-indigo-300 rounded text-sm font-medium"
                                  />
                                ) : (
                                  <button
                                    onClick={() =>
                                      handleExchangePriceEdit(index)
                                    }
                                    className="text-sm text-gray-500 hover:text-indigo-600 flex items-center gap-1"
                                    title="Click to edit price"
                                  >
                                    ${item.price.toFixed(2)}{" "}
                                    <span className="text-xs">✎</span>
                                  </button>
                                )}
                              </div>
                              {/* Exchange Discount UI */}
                              {useSessionStore.getState().can(PERMISSIONS.POS_APPLY_DISCOUNT) && (
                                <div className="mt-1">
                                  {exchangeEditingDiscountIndex === index ? (
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={exchangeDiscountType}
                                        onChange={(e) => setExchangeDiscountType(e.target.value)}
                                        className="px-2 py-1 border border-green-300 rounded text-xs"
                                      >
                                        <option value="fixed">$</option>
                                        <option value="percentage">%</option>
                                      </select>
                                      <input
                                        autoFocus
                                        type="number"
                                        step="0.01"
                                        placeholder="0"
                                        value={exchangeDiscountValue}
                                        onChange={(e) => setExchangeDiscountValue(e.target.value)}
                                        onBlur={() => saveExchangeDiscountEdit(index)}
                                        onKeyDown={(e) => e.key === "Enter" && saveExchangeDiscountEdit(index)}
                                        className="w-20 px-2 py-1 border border-green-300 rounded text-xs"
                                      />
                                      <button
                                        onClick={() => {
                                          setExchangeEditingDiscountIndex(null);
                                          setExchangeDiscountValue("");
                                        }}
                                        className="text-xs text-gray-500"
                                      >
                                        ✕
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleExchangeDiscountEdit(index)}
                                      className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                                      title="Click to apply discount"
                                    >
                                      {item.discount > 0 ? (
                                        <>
                                          <span className="line-through text-gray-400">
                                            ${(item.price * item.quantity).toFixed(2)}
                                          </span>
                                          <span className="font-medium">
                                            -${item.discount.toFixed(2)} 🏷️
                                          </span>
                                        </>
                                      ) : (
                                        <span>+ Add Discount</span>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => removeFromExchangeCart(index)}
                              className="text-red-500 hover:text-red-700 ml-2"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  updateExchangeQuantity(index, item.quantity - 1)
                                }
                                className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
                              >
                                −
                              </button>
                              <span className="w-12 text-center font-medium">
                                {item.quantity}
                              </span>
                              <button
                                onClick={() =>
                                  updateExchangeQuantity(index, item.quantity + 1)
                                }
                                className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
                              >
                                +
                              </button>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-indigo-600">
                                ${((item.price * item.quantity) - (item.discount || 0)).toFixed(2)}
                              </p>
                              {item.discount > 0 && (
                                <p className="text-xs text-green-600">
                                  Saved ${item.discount.toFixed(2)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Exchange Footer */}
              <div className="border-t border-gray-200 p-4 space-y-3">
                {originalSale && (
                  <>
                    {/* Return Reason */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Return Reason
                      </label>
                      <select
                        value={returnReason}
                        onChange={(e) => setReturnReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        {returnReasons.map((reason) => (
                          <option key={reason.value} value={reason.value}>
                            {reason.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Totals */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Return Total</span>
                        <span className="font-semibold text-orange-600">
                          ${calculateReturnTotal().toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Exchange Total</span>
                        <span className="font-semibold text-indigo-600">
                          ${exchangeCartTotal.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-base font-bold pt-2 border-t">
                        <span>
                          {exchangeNetBalance > 0
                            ? "Customer Pays"
                            : exchangeNetBalance < 0
                              ? "Refund Due"
                              : "Balanced"}
                        </span>
                        <span className="text-gray-900">
                          ${Math.abs(exchangeNetBalance).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Payment (only if net due) */}
                    {exchangeNetDue > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-xs font-medium text-gray-700">
                            Payment Method
                          </label>
                          <label className="flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={exchangeUseSplitPayment}
                              onChange={(e) => {
                                setExchangeUseSplitPayment(e.target.checked);
                                if (e.target.checked) {
                                  setExchangeSplitPayments([
                                    { method: "cash", amount: 0 },
                                  ]);
                                }
                              }}
                              className="rounded"
                            />
                            <span className="text-gray-600">Split</span>
                          </label>
                        </div>
                        {!exchangeUseSplitPayment ? (
                          <div className="grid grid-cols-3 gap-2">
                            {paymentMethods.map((method) => (
                              <button
                                key={method.value}
                                onClick={() =>
                                  setExchangeSelectedPaymentMethod(method.value)
                                }
                                className={`p-2 rounded-lg border-2 transition-all ${
                                  exchangeSelectedPaymentMethod === method.value
                                    ? "border-indigo-500 bg-indigo-50"
                                    : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                              >
                                <div className="text-xl mb-1">{method.icon}</div>
                                <div className="text-xs font-medium">
                                  {method.label}
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {exchangeSplitPayments.map((payment, idx) => {
                              const availableMethods = paymentMethods.filter(
                                (m) =>
                                  m.value === payment.method ||
                                  !exchangeSplitPayments.some(
                                    (p, i) =>
                                      i !== idx && p.method === m.value,
                                  ),
                              );

                              return (
                                <div key={idx} className="flex gap-2">
                                  <select
                                    value={payment.method}
                                    onChange={(e) =>
                                      updateExchangeSplitPayment(
                                        idx,
                                        "method",
                                        e.target.value,
                                      )
                                    }
                                    className="flex-1 px-2 py-2 border border-gray-300 rounded text-xs"
                                  >
                                    {availableMethods.map((m) => (
                                      <option key={m.value} value={m.value}>
                                        {m.label}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="number"
                                    step="0.01"
                                    placeholder="Amount"
                                    value={payment.amount}
                                    onChange={(e) =>
                                      updateExchangeSplitPayment(
                                        idx,
                                        "amount",
                                        parseFloat(e.target.value) || 0,
                                      )
                                    }
                                    className="w-24 px-2 py-2 border border-gray-300 rounded text-xs"
                                  />
                                  {exchangeSplitPayments.length > 1 && (
                                    <button
                                      onClick={() =>
                                        removeExchangeSplitPayment(idx)
                                      }
                                      className="text-red-500 hover:text-red-700 font-bold"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <div className="flex flex-col gap-1">
                                <span>
                                  Total: ${exchangeSplitPaymentTotal.toFixed(2)}
                                </span>
                                <span
                                  className={`${exchangeNetDue - exchangeSplitPaymentTotal > 0 ? "text-orange-600" : exchangeNetDue - exchangeSplitPaymentTotal < 0 ? "text-red-600" : "text-green-600"}`}
                                >
                                  {exchangeNetDue - exchangeSplitPaymentTotal >
                                  0
                                    ? `Remaining: $${(exchangeNetDue - exchangeSplitPaymentTotal).toFixed(2)}`
                                    : exchangeNetDue -
                                          exchangeSplitPaymentTotal <
                                        0
                                      ? `Over: $${Math.abs(exchangeNetDue - exchangeSplitPaymentTotal).toFixed(2)}`
                                      : "Balanced ✓"}
                                </span>
                              </div>
                              <button
                                onClick={addExchangeSplitPayment}
                                disabled={
                                  exchangeSplitPayments.length >=
                                  paymentMethods.length
                                }
                                className="text-indigo-600 hover:text-indigo-700 disabled:text-gray-400 disabled:cursor-not-allowed text-xs font-medium"
                              >
                                + Add
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}

                {/* Notes */}
                <input
                  type="text"
                  placeholder="Add note (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />

                {/* Status/Error */}
                {status && (
                  <div className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded">
                    {status}
                  </div>
                )}
                {error && (
                  <div className="text-xs text-red-700 bg-red-50 px-3 py-2 rounded">
                    {error}
                  </div>
                )}

                {/* Process Exchange Button */}
                {!originalSale ? (
                  <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded text-center">
                    Lookup a receipt to process returns with exchange, or just complete the sale below
                  </div>
                ) : (
                  <button
                    onClick={processExchange}
                    disabled={
                      processingExchange ||
                      calculateReturnTotal() === 0 ||
                      exchangeCart.length === 0 ||
                      (exchangeNetDue > 0 &&
                        exchangeUseSplitPayment &&
                        !exchangeSplitPaymentValidation)
                    }
                    className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg transition-colors"
                  >
                    {processingExchange ? "Processing..." : "Process Exchange"}
                  </button>
                )}
              </div>
            </>
          ) : (!returnMode && !exchangeMode) || (returnMode && !originalSale) ? (
            <>
              {/* Cart Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-900">
                    Cart ({cartCount})
                  </h2>
                  {cart.length > 0 && (
                    <button
                      onClick={clearCart}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Cart Items */}
              <div className="flex-1 p-4 space-y-2 ">
                {cart.length === 0 ? (
                  <div className="text-center text-gray-400 mt-12">
                    <p className="text-4xl mb-2">🛒</p>
                    <p>Cart is empty</p>
                  </div>
                ) : (
                  cart.map((item, index) => (
                    <div key={index} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            {item.name}
                          </h4>
                          <div className="flex items-center gap-2">
                            {editingPriceIndex === index ? (
                              <input
                                autoFocus
                                type="number"
                                step="0.01"
                                value={editingPriceValue}
                                onChange={(e) =>
                                  setEditingPriceValue(e.target.value)
                                }
                                onBlur={() => savePriceEdit(index)}
                                onKeyDown={(e) =>
                                  e.key === "Enter" && savePriceEdit(index)
                                }
                                className="w-20 px-2 py-1 border border-blue-300 rounded text-sm font-medium"
                              />
                            ) : (
                              <button
                                onClick={() => handlePriceEdit(index)}
                                className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1"
                                title="Click to edit price"
                              >
                                ${item.price.toFixed(2)}{" "}
                                <span className="text-xs">✎</span>
                              </button>
                            )}
                          </div>
                          {/* Discount UI */}
                          {useSessionStore.getState().can(PERMISSIONS.POS_APPLY_DISCOUNT) && (
                            <div className="mt-1">
                              {editingDiscountIndex === index ? (
                                <div className="flex items-center gap-2">
                                  <select
                                    value={discountType}
                                    onChange={(e) => setDiscountType(e.target.value)}
                                    className="px-2 py-1 border border-green-300 rounded text-xs"
                                  >
                                    <option value="fixed">$</option>
                                    <option value="percentage">%</option>
                                  </select>
                                  <input
                                    autoFocus
                                    type="number"
                                    step="0.01"
                                    placeholder="0"
                                    value={discountValue}
                                    onChange={(e) => setDiscountValue(e.target.value)}
                                    onBlur={() => saveDiscountEdit(index)}
                                    onKeyDown={(e) => e.key === "Enter" && saveDiscountEdit(index)}
                                    className="w-20 px-2 py-1 border border-green-300 rounded text-xs"
                                  />
                                  <button
                                    onClick={() => {
                                      setEditingDiscountIndex(null);
                                      setDiscountValue("");
                                    }}
                                    className="text-xs text-gray-500"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleDiscountEdit(index)}
                                  className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                                  title="Click to apply discount"
                                >
                                  {item.discount > 0 ? (
                                    <>
                                      <span className="line-through text-gray-400">
                                        ${(item.price * item.quantity).toFixed(2)}
                                      </span>
                                      <span className="font-medium">
                                        -${item.discount.toFixed(2)} 🏷️
                                      </span>
                                    </>
                                  ) : (
                                    <span>+ Add Discount</span>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeFromCart(index)}
                          className="text-red-500 hover:text-red-700 ml-2"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(index, item.quantity - 1)
                            }
                            className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
                          >
                            −
                          </button>
                          <span className="w-12 text-center font-medium">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(index, item.quantity + 1)
                            }
                            className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
                          >
                            +
                          </button>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            ${((item.price * item.quantity) - (item.discount || 0)).toFixed(2)}
                          </p>
                          {item.discount > 0 && (
                            <p className="text-xs text-green-600">
                              Saved ${item.discount.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Cart Footer */}
              {cart.length > 0 && (
                <div className="border-t border-gray-200 p-4 space-y-4">
                  {/* Subtotal & Discounts */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Subtotal</span>
                      <span>${cartSubtotal.toFixed(2)}</span>
                    </div>
                    {cartLineItemDiscounts > 0 && (
                      <div className="flex items-center justify-between text-sm text-green-600">
                        <span>Item Discounts</span>
                        <span>-${cartLineItemDiscounts.toFixed(2)}</span>
                      </div>
                    )}
                    {transactionDiscount > 0 && (
                      <div className="flex items-center justify-between text-sm text-green-600">
                        <span>Transaction Discount</span>
                        <span>-${transactionDiscount.toFixed(2)}</span>
                      </div>
                    )}
                    {(cartLineItemDiscounts > 0 || transactionDiscount > 0) && (
                      <div className="flex items-center justify-between text-sm font-medium text-green-700 bg-green-50 px-2 py-1 rounded">
                        <span>💰 Total Savings</span>
                        <span>${(cartLineItemDiscounts + transactionDiscount).toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between text-xl font-bold border-t pt-2">
                    <span>Total</span>
                    <span className="text-blue-600">
                      ${cartTotal.toFixed(2)}
                    </span>
                  </div>

                  {/* Transaction Discount */}
                  {useSessionStore.getState().can(PERMISSIONS.POS_APPLY_DISCOUNT) && (
                    <div className="border-t pt-2">
                      {!showTransactionDiscount ? (
                        <button
                          onClick={() => setShowTransactionDiscount(true)}
                          className="text-sm text-green-600 hover:text-green-700 font-medium"
                        >
                          + Apply Transaction Discount
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={transactionDiscountType}
                              onChange={(e) => setTransactionDiscountType(e.target.value)}
                              className="px-2 py-1 border border-green-300 rounded text-sm"
                            >
                              <option value="fixed">$ Fixed Amount</option>
                              <option value="percentage">% Percentage</option>
                            </select>
                            <input
                              type="number"
                              placeholder="0"
                              value={transactionDiscount > 0 ? (transactionDiscountType === "percentage" ? ((transactionDiscount / (cartSubtotal - cartLineItemDiscounts)) * 100) : transactionDiscount) : ""}
                              onChange={(e) => {
                                const inputValue = parseFloat(e.target.value) || 0;
                                const availableAmount = cartSubtotal - cartLineItemDiscounts;
                                let finalDiscount = 0;
                                if (transactionDiscountType === "percentage") {
                                  finalDiscount = Math.min((inputValue / 100) * availableAmount, availableAmount);
                                } else {
                                  finalDiscount = Math.min(inputValue, availableAmount);
                                }
                                setTransactionDiscount(Math.max(0, finalDiscount));
                              }}
                              className="flex-1 px-2 py-1 border border-green-300 rounded text-sm"
                            />
                            <button
                              onClick={() => {
                                setTransactionDiscount(0);
                                setShowTransactionDiscount(false);
                                setDiscountReason("");
                              }}
                              className="text-sm text-gray-500 hover:text-gray-700"
                            >
                              ✕
                            </button>
                          </div>
                          <input
                            type="text"
                            placeholder="Discount reason (optional)"
                            value={discountReason}
                            onChange={(e) => setDiscountReason(e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Payment Method */}
                  {/* <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Payment Method
                      </label>
                      {cart.length > 0 && (
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useSplitPayment}
                            onChange={(e) => {
                              setUseSplitPayment(e.target.checked);
                              if (e.target.checked) {
                                setSplitPayments([
                                  { method: "cash", amount: 0 },
                                ]);
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-gray-600">Split</span>
                        </label>
                      )}
                    </div>
                    {!useSplitPayment ? (
                      <div className="grid grid-cols-3 gap-2">
                        {paymentMethods.map((method) => (
                          <button
                            key={method.value}
                            onClick={() =>
                              setSelectedPaymentMethod(method.value)
                            }
                            className={`p-3 rounded-lg border-2 transition-all ${
                              selectedPaymentMethod === method.value
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200 bg-white hover:border-gray-300"
                            }`}
                          >
                            <div className="text-2xl mb-1">{method.icon}</div>
                            <div className="text-xs font-medium">
                              {method.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {splitPayments.map((payment, idx) => {
                          // Filter out already selected payment methods (except current)
                          const availableMethods = paymentMethods.filter(
                            (m) =>
                              m.value === payment.method ||
                              !splitPayments.some(
                                (p, i) => i !== idx && p.method === m.value
                              )
                          );
                          
                          return (
                          <div key={idx} className="flex gap-2">
                            <select
                              value={payment.method}
                              onChange={(e) =>
                                updateSplitPayment(
                                  idx,
                                  "method",
                                  e.target.value,
                                )
                              }
                              className="flex-1 px-2 py-2 border border-gray-300 rounded text-sm"
                            >
                              {availableMethods.map((m) => (
                                <option key={m.value} value={m.value}>
                                  {m.label}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Amount"
                              value={payment.amount}
                              onChange={(e) =>
                                updateSplitPayment(
                                  idx,
                                  "amount",
                                  parseFloat(e.target.value) || 0,
                                )
                              }
                              className="w-24 px-2 py-2 border border-gray-300 rounded text-sm"
                            />
                            {splitPayments.length > 1 && (
                              <button
                                onClick={() => removeSplitPayment(idx)}
                                className="text-red-500 hover:text-red-700 font-bold"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          );
                        })}
                        <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
                          <div className="flex flex-col gap-1">
                            <span>
                              Split Total: ${splitPaymentTotal.toFixed(2)}
                            </span>
                            <span
                              className={`text-xs ${cartTotal - splitPaymentTotal > 0 ? "text-orange-600" : cartTotal - splitPaymentTotal < 0 ? "text-red-600" : "text-green-600"}`}
                            >
                              {cartTotal - splitPaymentTotal > 0
                                ? `Remaining: $${(cartTotal - splitPaymentTotal).toFixed(2)}`
                                : cartTotal - splitPaymentTotal < 0
                                  ? `Over by: $${Math.abs(cartTotal - splitPaymentTotal).toFixed(2)}`
                                  : "Balanced ✓"}
                            </span>
                          </div>
                          <button
                            onClick={addSplitPayment}
                            disabled={splitPayments.length >= paymentMethods.length}
                            className="text-blue-600 hover:text-blue-700 disabled:text-gray-400 disabled:cursor-not-allowed text-xs font-medium"
                          >
                            + Add Payment
                          </button>
                        </div>
                        {splitPaymentTotal > cartTotal && (
                          <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            Total exceeds cart amount
                          </div>
                        )}
                      </div>
                    )}
                  </div> */}

                  {/* Notes */}
                  {/* <input
                    type="text"
                    placeholder="Add note (optional)"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  /> */}

                  {/* Payments and Delivery Modals Button */}
                  <button
                    onClick={handleCheckout}
                    disabled={cart.length === 0 || checkingPreviousDayShift}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-lg text-lg transition-colors"
                  >
                    Add Payments
                  </button>
                  {checkingPreviousDayShift && (
                    <p className="mt-2 text-xs text-gray-500">
                      Checking whether a previous-day shift is still open...
                    </p>
                  )}
                  {previousDayShiftError && !checkingPreviousDayShift && (
                    <p className="mt-2 text-xs text-amber-700">
                      {previousDayShiftError}
                    </p>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Returns Header*/}
              <div className="p-4 border-b border-gray-200 bg-orange-50">
                <h2 className="text-lg font-bold text-orange-900">
                  Process Return
                </h2>
                <p className="text-sm text-orange-700 mt-1">
                  Receipt: {originalSale.receiptNumber}
                </p>
              </div>

              {/* Return Items */}
              <div className="flex-1 p-4 space-y-2 ">
                {originalSale.items.map((item, idx) => {
                  const returnItem = returnItems[idx];
                  if (!returnItem) return null;

                  const maxQty = returnItem.maxQuantity;
                  if (maxQty <= 0) return null;

                  return (
                    <div
                      key={idx}
                      className={`rounded-lg p-3 border-2 transition-all ${
                        returnItem.selected
                          ? "border-orange-500 bg-orange-50"
                          : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={returnItem.selected}
                          onChange={() => toggleReturnItem(idx)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">
                            {item.productName ||
                              item.product?.name ||
                              "Unknown Product"}
                          </h4>
                          <p className="text-sm text-gray-600">
                            ${item.unitPrice.toFixed(2)} each
                          </p>
                          <p className="text-xs text-gray-500">
                            Available to return: {maxQty}
                          </p>
                        </div>
                      </div>

                      {returnItem.selected && (
                        <div className="mt-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateReturnQty(idx, returnItem.quantity - 1)
                              }
                              className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
                            >
                              −
                            </button>
                            <span className="w-12 text-center font-medium">
                              {returnItem.quantity}
                            </span>
                            <button
                              onClick={() =>
                                updateReturnQty(idx, returnItem.quantity + 1)
                              }
                              className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold"
                            >
                              +
                            </button>
                          </div>
                          <p className="font-bold text-orange-600">
                            ${(item.unitPrice * returnItem.quantity).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Return Footer */}
              <div className="border-t border-gray-200 p-4 space-y-4">
                {/* Return Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Return Reason
                  </label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  >
                    {returnReasons.map((reason) => (
                      <option key={reason.value} value={reason.value}>
                        {reason.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <input
                  type="text"
                  placeholder="Add note (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />

                {/* Refund Total */}
                <div className="flex items-center justify-between text-xl font-bold">
                  <span>Refund Total</span>
                  <span className="text-orange-600">
                    ${calculateReturnTotal().toFixed(2)}
                  </span>
                </div>

                {/* Status/Error */}
                {status && (
                  <div className="text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
                    {status}
                  </div>
                )}
                {error && (
                  <div className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded">
                    {error}
                  </div>
                )}

                {/* Process Return Button */}
                <button
                  onClick={processReturn}
                  disabled={processingReturn || calculateReturnTotal() === 0}
                  className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-300 text-white font-bold py-4 rounded-lg text-lg transition-colors"
                >
                  {processingReturn ? "Processing..." : "Process Return"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Variant Picker Modal */}
      {showVariantPicker && variantPickerProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {variantPickerProduct.title}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Select a variant to add to cart
                </p>
              </div>
              <button
                onClick={() => {
                  setShowVariantPicker(false);
                  setVariantPickerProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Variant Grid */}
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {variantPickerProduct.variants.map((variant) => (
                  <button
                    key={variant.id}
                    onClick={() => handleVariantSelect(variant)}
                    className="bg-white border-2 border-gray-200 hover:border-blue-500 rounded-lg p-4 text-left transition-all hover:shadow-md"
                  >
                    {/* Variant Title */}
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {variant.title}
                    </h3>

                    {/* SKU */}
                    {variant.sku && (
                      <p className="text-sm text-gray-600 mb-2">
                        SKU: <span className="font-mono">{variant.sku}</span>
                      </p>
                    )}

                    {/* Price */}
                    <p className="text-xl font-bold text-blue-600 mb-2">
                      ${parseFloat(variant.price).toFixed(2)}
                    </p>

                    {/* Inventory */}
                    <div className="flex items-center gap-2">
                      {variant.inventoryQuantity > 0 ? (
                        <>
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="text-sm text-gray-600">
                            {variant.inventoryQuantity} in stock
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="text-sm text-red-600">
                            Out of stock
                          </span>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setShowVariantPicker(false);
                  setVariantPickerProduct(null);
                }}
                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Lookup Modal (Returns/Exchange Mode) */}
      {showReturnLookup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {exchangeMode ? "Lookup Receipt for Exchange" : "Lookup Receipt"}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {exchangeMode
                ? "Enter the receipt number to start an exchange"
                : "Enter the receipt number to process a return"}
            </p>

            <div className="mb-4">
              <input
                type="text"
                placeholder="Receipt number or idempotency key..."
                value={receiptSearchQuery}
                onChange={(e) => setReceiptSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && lookupSale()}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
            </div>

            {lookupError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {lookupError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={lookupSale}
                className={`flex-1 px-4 py-2 text-white rounded-lg font-medium ${
                  exchangeMode
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                Lookup
              </button>
              <button
                onClick={exchangeMode ? exitExchangeMode : exitReturnMode}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && receipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
            {/* Receipt Header */}
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900">
                  {receipt.isExchange
                    ? "Exchange Slip"
                    : receipt.isReturn
                      ? "Return Receipt"
                      : "Receipt"}
                </h2>
                {isPartialReceipt && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">
                    Partial
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 font-mono">
                #{receipt.receiptNumber}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(receipt.timestamp).toLocaleString()}
              </p>
              {receipt.isOffline && (
                <div className="mt-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-medium">
                  ⚠️ Offline Sale - Will sync when online
                </div>
              )}
            </div>

            {/* Receipt Content */}
            <div className="p-6 space-y-4">
              {/* Organization & Location */}
              <div className="border-b pb-4">
                <p className="text-sm font-semibold text-gray-900">
                  {activeOrganization?.name || "Organization"}
                </p>
                <p className="text-xs text-gray-600">
                  Location: {getLocationLabel(locationId)}
                </p>
              </div>

              {/* Items */}
              {receipt.isExchange ? (
                <>
                  <div className="border-b pb-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Returned Items
                    </h3>
                    <div className="space-y-2">
                      {receipt.returnItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {item.quantity} × ${item.price.toFixed(2)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 text-right">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="border-b pb-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">
                      Exchange Items
                    </h3>
                    <div className="space-y-2">
                      {receipt.exchangeItems.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {item.name}
                            </p>
                            <p className="text-xs text-gray-600">
                              {item.quantity} × ${item.price.toFixed(2)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 text-right">
                            ${(item.price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Items
                  </h3>
                  <div className="space-y-2">
                    {receipt.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {item.quantity} × ${item.price.toFixed(2)}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-gray-900 text-right">
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payments */}
              {receipt.payments && receipt.payments.length > 0 && (
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    {receipt.isExchange ? "Payment Due" : "Payment"}
                  </h3>
                  <div className="space-y-2">
                    {receipt.payments.map((payment, idx) => (
                      <div key={idx} className="flex justify-between">
                        <p className="text-sm text-gray-700 capitalize">
                          {payment.method}
                        </p>
                        <p className="text-sm font-semibold text-gray-900">
                          ${toNonNegativeAmount(payment.amount).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Delivery Information */}
              {receipt.deliveryInfo && (
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">
                    Delivery Information
                  </h3>
                  <div className="space-y-2">
                    {receipt.trackingNumber && (
                      <div className="flex justify-between">
                        <p className="text-xs text-gray-600">Tracking #</p>
                        <p className="text-sm font-mono font-semibold text-blue-600">
                          {receipt.trackingNumber}
                        </p>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <p className="text-xs text-gray-600">Recipient</p>
                      <p className="text-sm font-medium text-gray-900">
                        {receipt.deliveryInfo.recipientName}
                      </p>
                    </div>
                    <div className="flex justify-between">
                      <p className="text-xs text-gray-600">Phone</p>
                      <p className="text-sm font-medium text-gray-900">
                        {receipt.deliveryInfo.recipientPhone}
                      </p>
                    </div>
                    {receipt.deliveryInfo.deliveryAddress && (
                      <div className="flex justify-between">
                        <p className="text-xs text-gray-600">Address</p>
                        <p className="text-sm font-medium text-gray-900 text-right">
                          {receipt.deliveryInfo.deliveryAddress.street}<br />
                          {receipt.deliveryInfo.deliveryAddress.city}
                          {receipt.deliveryInfo.deliveryAddress.country && 
                            `, ${receipt.deliveryInfo.deliveryAddress.country}`}
                        </p>
                      </div>
                    )}
                    {receipt.deliveryInfo.deliveryCategory && (
                      <div className="flex justify-between">
                        <p className="text-xs text-gray-600">Delivery Type</p>
                        <p className="text-sm font-medium text-gray-900">
                          {receipt.deliveryInfo.deliveryCategory} - {receipt.deliveryInfo.deliveryOption}
                        </p>
                      </div>
                    )}
                    {receipt.deliveryFee > 0 && (
                      <div className="flex justify-between">
                        <p className="text-xs text-gray-600">Delivery Fee</p>
                        <p className="text-sm font-semibold text-gray-900">
                          ${receipt.deliveryFee.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Return Reason (only for returns/exchanges) */}
              {(receipt.isReturn || receipt.isExchange) && receipt.returnReason && (
                <div className="border-b pb-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">
                    Return Reason
                  </h3>
                  <p className="text-sm text-gray-700">
                    {receipt.returnReason
                      .replace(/-/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                </div>
              )}

              {/* Total */}
              {receipt.isExchange ? (
                <div className="bg-indigo-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span>Return Total</span>
                    <span className="text-orange-600">
                      ${receipt.returnTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-semibold">
                    <span>Exchange Total</span>
                    <span className="text-indigo-600">
                      ${receipt.exchangeTotal.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-bold text-gray-900">
                      {receipt.netBalance > 0
                        ? "Customer Pays"
                        : receipt.netBalance < 0
                          ? "Refund Due"
                          : "Balanced"}
                    </p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${Math.abs(receipt.netBalance).toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <div
                  className={`${receipt.isReturn ? "bg-orange-50" : "bg-blue-50"} rounded-lg p-4`}
                >
                  <div className="flex justify-between items-center">
                    <p className="text-lg font-bold text-gray-900">
                      {receipt.isReturn ? "Refund Total" : "Total"}
                    </p>
                    <p
                      className={`text-2xl font-bold ${receipt.isReturn ? "text-orange-600" : "text-blue-600"}`}
                    >
                      ${(receipt.subtotal + (receipt.deliveryFee || 0)).toFixed(2)}
                    </p>
                  </div>
                  {isPartialReceipt && !receipt.isReturn && !receipt.isExchange && (
                    <div className="mt-3 pt-3 border-t border-blue-100 space-y-1">
                      <div className="flex justify-between items-center text-sm">
                        <p className="text-gray-700">Amount Paid</p>
                        <p className="font-semibold text-gray-900">
                          ${receiptAmountPaid.toFixed(2)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <p className="text-gray-700">Balance Due</p>
                        <p className="font-semibold text-amber-700">
                          ${receiptBalanceDue.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {receipt.notes && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="text-xs text-gray-600 font-semibold mb-1">
                    Notes
                  </p>
                  <p className="text-sm text-gray-900">{receipt.notes}</p>
                </div>
              )}

              {/* Email Section */}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">
                  Email Receipt
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      setEmailError("");
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded font-medium text-sm transition-colors"
                  >
                    {sendingEmail ? "..." : "Send"}
                  </button>
                </div>
                {emailError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">
                    {emailError}
                  </p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={handlePrintReceipt}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <span>🖨️</span> Print
              </button>
              <button
                onClick={() => setShowReceipt(false)}
                className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
