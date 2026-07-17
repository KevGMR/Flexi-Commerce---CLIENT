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
  deletePendingSale,
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
import SearchOverlay from "@/components/pos/SearchOverlay";
import CustomerSelector from "@/components/pos/CustomerSelector";
import DeliveryForm from "@/components/pos/DeliveryForm";

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

// Helper to compute effective commission
const getEffectiveCommission = (product, user) => {
  const defaultType = product?.commissionType || "percentage";
  const defaultValue = Number(product?.commissionValue) || 0;

  let overrideType = defaultType;
  let overrideValue = defaultValue;
  let isOverride = false;

  if (user && user.commissionOverrides && Array.isArray(user.commissionOverrides)) {
    const override = user.commissionOverrides.find(
      (ov) => ov.serviceId.toString() === (product?._id || product?.id || "").toString()
    );
    if (override) {
      overrideType = override.commissionType;
      overrideValue = Number(override.commissionValue) || 0;
      isOverride = true;
    }
  }

  return {
    type: overrideType,
    value: overrideValue,
    isOverride,
    display: overrideType === "percentage" ? `${overrideValue}%` : `$${overrideValue.toFixed(2)}`,
    isDefault: !isOverride,
  };
};

// Compute commission amount
const computeCommissionAmount = (laborCost, commissionType, commissionValue, productCost = 0, includeProduct = false) => {
  let base = laborCost;
  if (includeProduct) {
    base += productCost;
  }
  if (commissionType === "percentage") {
    return (base * commissionValue) / 100;
  } else {
    return Math.min(commissionValue, base);
  }
};

// Recalculate commissions for bundle children based on net bundle amount
const recalculateBundleCommissions = (children, bundleTotal) => {
  const beforeCommissionTotal = children
    .filter((ch) => ch.commissionDeductionTiming === "before_commission")
    .reduce((sum, ch) => sum + ch.price, 0);
  const netAmount = Math.max(0, bundleTotal - beforeCommissionTotal);

  return children.map((ch) => {
    if (ch.commissionValue === 0 || ch.commissionType === null) {
      return { ...ch, commissionAmount: 0 };
    }
    let commissionAmount = 0;
    if (ch.commissionType === "percentage") {
      commissionAmount = (netAmount * ch.commissionValue) / 100;
    } else {
      commissionAmount = ch.commissionValue;
    }
    return {
      ...ch,
      commissionAmount: Math.min(commissionAmount, netAmount),
      commissionIsOverride: ch.commissionIsOverride || false,
      commissionDisplay: ch.commissionDisplay || (ch.commissionType === "percentage" ? `${ch.commissionValue}%` : `$${ch.commissionValue.toFixed(2)}`),
    };
  });
};

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
    user,
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
  const [showSearchOverlay, setShowSearchOverlay] = useState(false);
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
  const [serviceProductMap, setServiceProductMap] = useState({});
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

  const [locationSettings, setLocationSettings] = useState(null);
  const [enableProductCost, setEnableProductCost] = useState(false);

  const [attachMode, setAttachMode] = useState(false);
  const [attachingServiceIndex, setAttachingServiceIndex] = useState(null);
  const [users, setUsers] = useState([]);
  const [saleAssignedUser, setSaleAssignedUser] = useState(null);
  const [showAttachModal, setShowAttachModal] = useState(false);
  const [pendingServiceProduct, setPendingServiceProduct] = useState(null);

  const [showAttachQuantityModal, setShowAttachQuantityModal] = useState(false);
  const [attachQuantityProductIndex, setAttachQuantityProductIndex] = useState(null);
  const [attachQuantityValue, setAttachQuantityValue] = useState(1);
  const [attachModalSelectedServiceIndex, setAttachModalSelectedServiceIndex] = useState(null);

  const [returnMode, setReturnMode] = useState(false);
  const [showReturnLookup, setShowReturnLookup] = useState(false);
  const [receiptSearchQuery, setReceiptSearchQuery] = useState("");
  const [originalSale, setOriginalSale] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState("customer-request");
  const [lookupError, setLookupError] = useState("");
  const [processingReturn, setProcessingReturn] = useState(false);

  const [exchangeMode, setExchangeMode] = useState(false);
  const [exchangeCart, setExchangeCart] = useState([]);
  const [exchangeSelectedPaymentMethod, setExchangeSelectedPaymentMethod] =
    useState("cash");
  const [exchangeUseSplitPayment, setExchangeUseSplitPayment] =
    useState(false);
  const [exchangeSplitPayments, setExchangeSplitPayments] = useState([
    { method: "cash", amount: 0 },
  ]);

  const [showCompleteCheckoutModal, setShowCompleteCheckoutModal] =
    useState(false);
  const [pendingCheckoutData, setPendingCheckoutData] = useState(null);

  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  const [exchangeEditingPriceIndex, setExchangeEditingPriceIndex] =
    useState(null);
  const [exchangeEditingPriceValue, setExchangeEditingPriceValue] =
    useState("");
  const [processingExchange, setProcessingExchange] = useState(false);

  const [editingDiscountIndex, setEditingDiscountIndex] = useState(null);
  const [discountType, setDiscountType] = useState("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [transactionDiscount, setTransactionDiscount] = useState(0);
  const [transactionDiscountType, setTransactionDiscountType] = useState("fixed");
  const [discountReason, setDiscountReason] = useState("");
  const [showTransactionDiscount, setShowTransactionDiscount] = useState(false);
  const [exchangeEditingDiscountIndex, setExchangeEditingDiscountIndex] = useState(null);
  const [exchangeDiscountType, setExchangeDiscountType] = useState("fixed");
  const [exchangeDiscountValue, setExchangeDiscountValue] = useState("");

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [deliveryInfo, setDeliveryInfo] = useState({
    recipientName: "",
    recipientPhone: "",
    recipientEmail: "",
    deliveryCategory: "",
    deliveryOption: "",
    deliveryAddress: {
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "Kenya",
      landmark: "",
    },
    notes: "",
  });

  const [updatingCustomer, setUpdatingCustomer] = useState(false);
  const [showUpdateCustomerModal, setShowUpdateCustomerModal] = useState(false);
  const [customerUpdateData, setCustomerUpdateData] = useState({
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

  const [heldSales, setHeldSales] = useState([]);
  const [showHeldSalesModal, setShowHeldSalesModal] = useState(false);
  const [loadingHeldSales, setLoadingHeldSales] = useState(false);
  const [heldSalesSearchQuery, setHeldSalesSearchQuery] = useState("");

  const cartContainerRef = useRef(null);

  const calculateDeliveryFee = useCallback(() => {
    if (!deliveryEnabled || !deliveryInfo.deliveryCategory) return 0;
    
    const category = locationSettings?.deliveryCategories?.find(
      c => c.categoryName === deliveryInfo.deliveryCategory
    );
    const option = category?.childOptions?.find(
      o => o.optionName === deliveryInfo.deliveryOption
    );
    return option?.price || 0;
  }, [deliveryEnabled, deliveryInfo, locationSettings]);

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

  // Load locations
  useEffect(() => {
    const loadLocations = async () => {
      try {
        const res = await apiFetch("/locations?limit=100");
        if (res?.data || res?.locations) {
          const allLocations = res.data || res.locations || [];
          const allLocationIds = allLocations
            .map((loc) => loc._id || loc.id || loc.locationId)
            .filter(Boolean);

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

    if (!locations || locations.length === 0) {
      loadLocations();
    } else {
      setLocationsLoading(false);
    }
  }, [activeOrganization?.id, accessToken, locations]);

  useEffect(() => {
    if (locations !== undefined) {
      setLocationsLoading(false);
    }

    if (locations !== undefined && (!locations || locations.length === 0)) {
      setShowNoLocationsModal(true);
      return;
    }

    setShowNoLocationsModal(false);

    if (locations && locations.length === 1) {
      setLocationId(locations[0]);
      setSelectedLocationId(locations[0]);
      return;
    }

    if (locations && locations.length > 1) {
      if (locationId && locations.includes(locationId)) {
        return;
      }
      if (selectedLocationId && locations.includes(selectedLocationId)) {
        setLocationId(selectedLocationId);
        return;
      }
      setShowLocationPicker(true);
    }
  }, [locations, selectedLocationId]);

  useEffect(() => {
    if (!locationId || !locations || locations.length === 0) return;

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
  }, [locationId, locations]);

  useEffect(() => {
    if (!locationId) return;
    const fetchLocationSettings = async () => {
      try {
        const res = await apiFetch(`/locations/${locationId}`);
        const loc = res?.location;
        if (loc) {
          setLocationSettings(loc);
          setEnableProductCost(loc.enableProductCost || false);
        }
      } catch (err) {
        console.error("Failed to fetch location settings:", err);
        setEnableProductCost(false);
      }
    };
    fetchLocationSettings();
  }, [locationId]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSearchOverlay && cartContainerRef.current && !cartContainerRef.current.contains(event.target)) {
        handleCloseSearch();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSearchOverlay]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && showSearchOverlay) {
        handleCloseSearch();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showSearchOverlay]);

  useEffect(() => {
    if (!selectedCustomer) return;

    if (deliveryEnabled) {
      const address = selectedCustomer.address || {};
      setDeliveryInfo((prev) => ({
        ...prev,
        recipientName: selectedCustomer.fullname || prev.recipientName,
        recipientPhone: selectedCustomer.phone || prev.recipientPhone,
        recipientEmail: selectedCustomer.email || prev.recipientEmail,
        deliveryAddress: {
          street: address.street || prev.deliveryAddress?.street || "",
          city: address.city || prev.deliveryAddress?.city || "",
          state: address.state || prev.deliveryAddress?.state || "",
          postalCode: address.postalCode || prev.deliveryAddress?.postalCode || "",
          country: address.country || prev.deliveryAddress?.country || "Kenya",
          landmark: address.landmark || prev.deliveryAddress?.landmark || "",
        },
      }));
      return;
    }

    const address = selectedCustomer.address;
    if (!address) return;

    const hasAddressInfo =
      address.street || address.city || address.state || address.postalCode || address.country;
    if (!hasAddressInfo) return;

    const hasUserEntered =
      deliveryInfo.recipientName ||
      deliveryInfo.recipientPhone ||
      deliveryInfo.deliveryAddress.street ||
      deliveryInfo.deliveryAddress.city;

    if (hasUserEntered) return;

    setDeliveryInfo((prev) => ({
      ...prev,
      recipientName: selectedCustomer.fullname || prev.recipientName,
      recipientPhone: selectedCustomer.phone || prev.recipientPhone,
      recipientEmail: selectedCustomer.email || prev.recipientEmail,
      deliveryAddress: {
        street: address.street || "",
        city: address.city || "",
        state: address.state || "",
        postalCode: address.postalCode || "",
        country: address.country || "Kenya",
        landmark: address.landmark || "",
      },
    }));

    if (!deliveryEnabled && (address.street || address.city)) {
      setDeliveryEnabled(true);
    }
  }, [selectedCustomer, deliveryEnabled]);

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

  useEffect(() => {
    const loadPendingSales = async () => {
      try {
        const sales = await getPendingSales();
        setPendingSales(sales || []);
        const held = sales.filter(s => s.status === "held");
        setHeldSales(held);
      } catch (err) {
        console.error("Failed to load pending sales:", err);
      }
    };
    loadPendingSales();
  }, [pendingSalesCount]);

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
    if (!activeOrganization) return;

    setServiceLoading(true);
    try {
      const res = await apiFetch("/products?type=service&status=active&limit=100");
      const products = res?.data?.products || res?.products || [];
      setServiceProductsState(products);

      const productMap = {};
      products.forEach(p => {
        productMap[p._id || p.id] = {
          commissionType: p.commissionType || "percentage",
          commissionValue: p.commissionValue || 0,
          name: p.name,
          laborCost: p.laborCost || 0,
        };
      });
      setServiceProductMap(productMap);
    } catch (err) {
      console.error("[POS] Failed to load service products:", err);
      setServiceProductsState([]);
    } finally {
      setServiceLoading(false);
    }
  }, [activeOrganization]);

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

  useEffect(() => {
    loadShopifyConnection();
    loadServiceProductsData();

    searchShopifyProducts("").then((cached) => {
      setShopifyProductsState(cached);
      setSearchResults(cached);

      if (cached.length > 0 && cached[0].savedAt) {
        setLastSyncTimestamp(cached[0].savedAt);

        const cacheAge = Date.now() - new Date(cached[0].savedAt).getTime();
        const MAX_CACHE_AGE = 60 * 60 * 1000;

        if (cacheAge > MAX_CACHE_AGE) {
          console.log("[POS] Shopify product cache is stale, refreshing...");
          if (navigator.onLine) {
            loadShopifyProductsData().catch((err) => {
              console.error("[POS] Background cache refresh failed:", err);
            });
          }
        }
      }
    });
  }, [activeOrganization, loadShopifyProductsData, loadServiceProductsData]);

  useEffect(() => {
    if (shopifyConnection?.status === "active" && locationId) {
      loadShopifyProductsData();
    }
  }, [shopifyConnection?.status, locationId, loadShopifyProductsData]);

  useEffect(() => {
    const loadUsers = async () => {
      try {
        console.log("[POS] Fetching users from /users...");
        const res = await apiFetch("/users?limit=100");
        console.log("[POS] Users response:", res);
        let usersList = res?.data?.users || res?.users || res?.data || [];
        if (Array.isArray(res) && !usersList.length) {
          usersList = res;
        }
        if (usersList.length) {
          setUsers(usersList);
          console.log("[POS] Loaded", usersList.length, "users");
        } else {
          console.warn("[POS] No users found");
          setUsers([]);
        }
      } catch (err) {
        console.error("[POS] Failed to load users:", err);
        if (err.status === 403) {
          console.warn("[POS] User lacks VIEW_USERS permission");
          setUsers([]);
        } else {
          setUsers([]);
        }
      }
    };
    loadUsers();
  }, [activeOrganization]);

  // Auto‑assign cashier
  useEffect(() => {
    if (user?._id && users.length > 0 && !saleAssignedUser) {
      const currentUser = users.find(u => u._id === user._id);
      if (currentUser) {
        setSaleAssignedUser(user._id);
        console.log("[POS] Auto‑assigned cashier as sale user:", currentUser.fullname || user._id);
      }
    }
  }, [user, users, saleAssignedUser]);

  // Auto‑fill service assignedUser when saleAssignedUser is set (only for single services, not bundle children)
  useEffect(() => {
    if (!saleAssignedUser) return;
    let updated = false;
    const newCart = cart.map((item) => {
      if (item.type === "service" && !item.assignedUser && !item.isBundleChild) {
        updated = true;
        const productDefaults = serviceProductMap[item.variant];
        if (productDefaults) {
          const userObj = users.find((u) => u._id === saleAssignedUser);
          const commission = getEffectiveCommission(
            {
              _id: item.variant,
              commissionType: productDefaults.commissionType,
              commissionValue: productDefaults.commissionValue,
            },
            userObj
          );
          const includeProduct = false;
          const commissionAmount = computeCommissionAmount(
            item.laborCost || 0,
            commission.type,
            commission.value,
            0,
            includeProduct
          );
          return {
            ...item,
            assignedUser: saleAssignedUser,
            commissionType: commission.type,
            commissionValue: commission.value,
            commissionIsOverride: commission.isOverride,
            commissionDisplay: commission.display,
            commissionAmount: commissionAmount,
          };
        }
        return { ...item, assignedUser: saleAssignedUser };
      }
      return item;
    });
    if (updated) {
      setCart(newCart);
    }
  }, [saleAssignedUser, serviceProductMap, users]);

  // ====== HELD SALES FUNCTIONS ======
  const loadHeldSales = async () => {
    setLoadingHeldSales(true);
    try {
      const allSales = await getPendingSales();
      const held = allSales.filter(s => s.status === "held");
      setHeldSales(held);
    } catch (err) {
      console.error("Failed to load held sales:", err);
    } finally {
      setLoadingHeldSales(false);
    }
  };

  const holdCurrentSale = async () => {
    if (cart.length === 0) {
      setError("Cart is empty. Cannot hold.");
      return;
    }

    const draft = {
      status: "held",
      heldAt: new Date().toISOString(),
      cart: cart.map(item => ({ ...item })),
      notes: notes,
      selectedCustomer: selectedCustomer,
      deliveryEnabled: deliveryEnabled,
      deliveryInfo: deliveryInfo,
      transactionDiscount: transactionDiscount,
      discountReason: discountReason,
      saleAssignedUser: saleAssignedUser,
      cartSubtotal: cartSubtotal,
      cartLineItemDiscounts: cartLineItemDiscounts,
      cartTotal: cartTotal,
      idempotencyKey: `HOLD-${Date.now()}`,
    };

    try {
      await savePendingSale(draft);
      setStatus("Sale held successfully!");
      clearCart();
      await loadHeldSales();
    } catch (err) {
      setError("Failed to hold sale: " + err.message);
    }
  };

  const resumeHeldSale = async (draft) => {
    setCart(draft.cart || []);
    setNotes(draft.notes || "");
    setSelectedCustomer(draft.selectedCustomer || null);
    setDeliveryEnabled(draft.deliveryEnabled || false);
    setDeliveryInfo(draft.deliveryInfo || {
      recipientName: "",
      recipientPhone: "",
      recipientEmail: "",
      deliveryCategory: "",
      deliveryOption: "",
      deliveryAddress: {
        street: "",
        city: "",
        state: "",
        postalCode: "",
        country: "Kenya",
        landmark: "",
      },
      notes: "",
    });
    setTransactionDiscount(draft.transactionDiscount || 0);
    setDiscountReason(draft.discountReason || "");
    setSaleAssignedUser(draft.saleAssignedUser || null);
    setShowHeldSalesModal(false);

    try {
      await deletePendingSale(draft.idempotencyKey);
      await loadHeldSales();
      setStatus("Held sale loaded and removed from list.");
    } catch (err) {
      console.error("Failed to delete held sale after resume:", err);
      setStatus("Held sale loaded, but could not be removed. You may need to delete it manually.");
    }
  };

  const deleteHeldSale = async (idempotencyKey) => {
    if (!confirm("Delete this held sale?")) return;
    try {
      await deletePendingSale(idempotencyKey);
      await loadHeldSales();
      setStatus("Held sale deleted.");
    } catch (err) {
      setError("Failed to delete: " + err.message);
    }
  };

  // ====== CART OPERATIONS ======
  const isBundleParent = (item) => item.isBundleParent === true;
  const isBundleChild = (item) => item.isBundleChild === true;

  const upsertCartItem = (targetCart, setTargetCart, cartItem) => {
    const existingIndex = targetCart.findIndex(
      (item) => item.variant === cartItem.variant && item.isBundleChild === cartItem.isBundleChild && item.parentItemIndex === cartItem.parentItemIndex
    );
    if (existingIndex >= 0) {
      const updated = [...targetCart];
      updated[existingIndex].quantity += 1;
      setTargetCart(updated);
      return;
    }
    setTargetCart([...targetCart, cartItem]);
  };

  // Add a bundle to cart – all children start with their own laborCost
  const addBundleToCart = (product) => {
    const parentIndex = cart.length;
    const bundleId = product._id;
    const bundleTotal = product.price;

    const aggregatorIndex = product.bundleSubServices.findIndex((sub) => sub.isAggregator === true);
    if (aggregatorIndex === -1) {
      console.warn("No aggregator defined for bundle, defaulting to first sub‑service");
      product.bundleSubServices[0].isAggregator = true;
    }

    const parentItem = {
      type: "bundle",
      variant: bundleId,
      name: product.name,
      price: bundleTotal,
      quantity: 1,
      discount: 0,
      parentItemIndex: null,
      isBundleParent: true,
      assignedUser: null,
      commissionType: null,
      commissionValue: null,
      commissionDeductionTiming: null,
      laborCost: 0,
      productCost: 0,
    };

    const children = product.bundleSubServices.map((sub, index) => {
      const isAggregator = sub.isAggregator === true;
      const price = sub.laborCost; // ALL children start with their own laborCost

      let assignedUserId = sub.defaultAssignedUser || null;
      if (!assignedUserId && saleAssignedUser) {
        assignedUserId = saleAssignedUser;
      }

      let effectiveCommissionType = sub.commissionType;
      let effectiveCommissionValue = sub.commissionValue;
      let isOverride = false;
      let overrideDisplay = null;

      if (assignedUserId) {
        const user = users.find(u => u._id === assignedUserId);
        if (user && user.commissionOverrides) {
          const overrideKey = `${bundleId}:${index}`;
          const override = user.commissionOverrides.find(
            ov => ov.serviceId === overrideKey
          );
          if (override) {
            effectiveCommissionType = override.commissionType;
            effectiveCommissionValue = override.commissionValue;
            isOverride = true;
            overrideDisplay = effectiveCommissionType === "percentage"
              ? `${effectiveCommissionValue}%`
              : `$${effectiveCommissionValue.toFixed(2)}`;
          }
        }
      }

      return {
        type: "service",
        variant: bundleId,
        name: sub.name,
        price: price,
        originalPrice: null,
        quantity: 1,
        discount: 0,
        parentItemIndex: parentIndex,
        isBundleChild: true,
        isAggregator: isAggregator,
        assignedUser: assignedUserId,
        commissionType: effectiveCommissionType,
        commissionValue: effectiveCommissionValue,
        commissionDeductionTiming: sub.commissionDeductionTiming,
        laborCost: sub.laborCost,
        productCost: 0,
        commissionAmount: 0,
        commissionIsOverride: isOverride,
        commissionDisplay: isOverride ? overrideDisplay : (sub.commissionType === "percentage" ? `${sub.commissionValue}%` : `$${sub.commissionValue.toFixed(2)}`),
        defaultCommissionType: sub.commissionType,
        defaultCommissionValue: sub.commissionValue,
        subServiceIndex: index,
      };
    });

    const updatedChildren = recalculateBundleCommissions(children, bundleTotal);
    const newCart = [...cart, parentItem, ...updatedChildren];
    setCart(newCart);
    handleCloseSearch();
  };

  const addToCart = (product) => {
    if (product.serviceKind === "bundle" && product.bundleSubServices && product.bundleSubServices.length > 0) {
      addBundleToCart(product);
      return;
    }

    let parentItemIndex = null;
    let isChild = false;
    if (attachMode && attachingServiceIndex !== null) {
      if (product.type === "service") {
        setShowAttachModal(true);
        setPendingServiceProduct(product);
        return;
      }
      parentItemIndex = attachingServiceIndex;
      isChild = true;
    }

    const isService = product.type === "service";
    let laborCost = 0;
    let price = product.price;
    if (isService) {
      const prodDefaults = serviceProductMap[product.id || product._id] || {};
      laborCost = Number(prodDefaults.laborCost) || 0;
      price = laborCost;
    }

    const newItem = {
      type: product.type,
      variant: product.id || product._id,
      name: product.name,
      price: isChild ? 0 : price,
      originalPrice: isChild ? product.price : null,
      quantity: 1,
      discount: 0,
      serviceKind: product.serviceKind,
      serviceBundleComponents: Array.isArray(product.serviceBundleComponents)
        ? product.serviceBundleComponents.map((component) => ({ ...component }))
        : undefined,
      parentItemIndex: parentItemIndex,
      assignedUser: null,
      commissionType: null,
      commissionValue: null,
      commissionIsOverride: false,
      commissionDisplay: null,
      commissionAmount: 0,
      defaultCommissionType: null,
      defaultCommissionValue: null,
      laborCost: isService ? laborCost : 0,
      productCost: 0,
      isBundleChild: false,
      isBundleParent: false,
    };

    if (isService) {
      const assignedUserId = saleAssignedUser || null;
      const assignedUser = assignedUserId
        ? users.find(u => u._id === assignedUserId)
        : null;

      const productDefaults = serviceProductMap[product.id || product._id] || {
        commissionType: product.commissionType || "percentage",
        commissionValue: product.commissionValue || 0,
      };

      const commission = getEffectiveCommission(
        {
          _id: product.id || product._id,
          commissionType: productDefaults.commissionType,
          commissionValue: productDefaults.commissionValue,
        },
        assignedUser
      );

      const includeProduct = false;
      const commissionAmount = computeCommissionAmount(
        newItem.laborCost,
        commission.type,
        commission.value,
        0,
        includeProduct
      );

      newItem.commissionType = commission.type;
      newItem.commissionValue = commission.value;
      newItem.commissionIsOverride = commission.isOverride;
      newItem.commissionDisplay = commission.display;
      newItem.commissionAmount = commissionAmount;
      newItem.defaultCommissionType = productDefaults.commissionType;
      newItem.defaultCommissionValue = Number(productDefaults.commissionValue) || 0;
      if (saleAssignedUser) {
        newItem.assignedUser = saleAssignedUser;
      }
    }

    if (exchangeMode) {
      upsertCartItem(exchangeCart, setExchangeCart, newItem);
    } else {
      if (product.type === "service") {
        setAttachMode(false);
        setAttachingServiceIndex(null);
      }
      upsertCartItem(cart, setCart, newItem);
      handleCloseSearch();
    }
  };

  const updateServiceCosts = (index, field, value) => {
    const newCart = [...cart];
    const item = newCart[index];
    if (item.type !== "service" || item.isBundleChild) return;
    const numVal = parseFloat(value) || 0;
    if (field === "laborCost") {
      item.laborCost = numVal;
    }
    item.price = item.laborCost;
    const commission = getEffectiveCommission(
      {
        _id: item.variant,
        commissionType: item.defaultCommissionType || "percentage",
        commissionValue: item.defaultCommissionValue || 0,
      },
      users.find(u => u._id === item.assignedUser)
    );
    const includeProduct = false;
    item.commissionType = commission.type;
    item.commissionValue = commission.value;
    item.commissionIsOverride = commission.isOverride;
    item.commissionDisplay = commission.display;
    item.commissionAmount = computeCommissionAmount(
      item.laborCost,
      commission.type,
      commission.value,
      0,
      includeProduct
    );
    setCart(newCart);
  };

  const updateBundleChildCosts = (index, field, value) => {
    const newCart = [...cart];
    const child = newCart[index];
    if (!child.isBundleChild) return;
    const numVal = parseFloat(value) || 0;
    if (field === "laborCost") {
      child.laborCost = numVal;
      if (!child.isAggregator) {
        child.price = child.laborCost;
      }
    }
    const parentIdx = child.parentItemIndex;
    if (parentIdx !== null && parentIdx !== undefined) {
      const parent = newCart[parentIdx];
      if (parent && parent.isBundleParent) {
        const bundleTotal = parent.price;
        const children = newCart.filter(
          (it) => it.isBundleChild && it.parentItemIndex === parentIdx
        );
        const updatedChildren = recalculateBundleCommissions(children, bundleTotal);
        const childIndices = newCart
          .map((it, idx) => (it.isBundleChild && it.parentItemIndex === parentIdx ? idx : -1))
          .filter(idx => idx !== -1);
        for (let i = 0; i < childIndices.length; i++) {
          newCart[childIndices[i]] = updatedChildren[i];
        }
      }
    }
    setCart(newCart);
  };

  const updateBundleParentQuantity = (index, newQty) => {
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    const newCart = [...cart];
    const parent = newCart[index];
    if (!parent.isBundleParent) return;
    parent.quantity = newQty;
    const childrenIndices = newCart
      .map((item, idx) => (item.parentItemIndex === index && item.isBundleChild ? idx : -1))
      .filter(idx => idx !== -1);
    for (const idx of childrenIndices) {
      newCart[idx].quantity = newQty;
    }
    const bundleTotal = parent.price;
    const children = newCart.filter(
      (it) => it.isBundleChild && it.parentItemIndex === index
    );
    const updatedChildren = recalculateBundleCommissions(children, bundleTotal);
    for (let i = 0; i < childrenIndices.length; i++) {
      newCart[childrenIndices[i]] = updatedChildren[i];
    }
    setCart(newCart);
  };

  // ====== ATTACH FUNCTIONS (added) ======
  const openAttachQuantityModal = (productIndex) => {
    const serviceIndexes = cart
      .map((item, idx) => (item.type === "service" && !item.isBundleParent && !item.isBundleChild ? idx : -1))
      .filter(idx => idx !== -1);
    if (serviceIndexes.length === 0) {
      setError("No services in cart to attach to.");
      return;
    }
    setAttachQuantityProductIndex(productIndex);
    setAttachQuantityValue(cart[productIndex].quantity);
    setAttachModalSelectedServiceIndex(serviceIndexes[0]);
    setShowAttachQuantityModal(true);
  };

  const splitAndAttachItem = (productIndex, serviceIndex, attachQty) => {
    const newCart = [...cart];
    const product = newCart[productIndex];
    if (!product || product.type === "service") return;
    const originalQty = product.quantity;
    const originalPrice = product.price;

    if (attachQty <= 0 || attachQty > originalQty) return;

    if (attachQty === originalQty) {
      product.parentItemIndex = serviceIndex;
      product.originalPrice = originalPrice;
      product.price = 0;
      setCart(newCart);
    } else {
      const remainingQty = originalQty - attachQty;
      product.quantity = remainingQty;
      product.parentItemIndex = null;
      product.price = originalPrice;

      const childItem = {
        ...product,
        quantity: attachQty,
        parentItemIndex: serviceIndex,
        price: 0,
        originalPrice: originalPrice,
      };
      newCart.splice(productIndex + 1, 0, childItem);
      setCart(newCart);
    }
    setShowAttachQuantityModal(false);
  };

  const detachFromService = (itemIndex) => {
    const updatedCart = [...cart];
    const item = updatedCart[itemIndex];
    if (item.originalPrice !== null && item.originalPrice !== undefined) {
      item.price = item.originalPrice;
    }
    item.parentItemIndex = null;
    setCart(updatedCart);
  };

  const toggleAttachMode = (index) => {
    if (attachMode && attachingServiceIndex === index) {
      setAttachMode(false);
      setAttachingServiceIndex(null);
    } else {
      setAttachMode(true);
      setAttachingServiceIndex(index);
    }
  };

  const stopAttach = () => {
    setAttachMode(false);
    setAttachingServiceIndex(null);
  };

  // Remove from cart (handles bundle parent/children, aggregator, and price transfer)
  const removeFromCart = (index) => {
    if (attachMode && attachingServiceIndex === index) {
      setAttachMode(false);
      setAttachingServiceIndex(null);
    }

    const newCart = [...cart];
    const item = newCart[index];

    if (item.isBundleParent) {
      const toRemove = newCart
        .map((it, idx) => (it.parentItemIndex === index || idx === index ? idx : -1))
        .filter(idx => idx !== -1);
      toRemove.sort((a, b) => b - a);
      for (const idx of toRemove) {
        newCart.splice(idx, 1);
      }
      setCart(newCart);
      return;
    }

    if (item.isBundleChild) {
      const parentIdx = item.parentItemIndex;
      const parent = newCart[parentIdx];
      if (!parent) {
        newCart.splice(index, 1);
        setCart(newCart);
        return;
      }

      if (item.isAggregator) {
        const toRemove = newCart
          .map((it, idx) => (it.parentItemIndex === parentIdx || idx === parentIdx ? idx : -1))
          .filter(idx => idx !== -1);
        toRemove.sort((a, b) => b - a);
        for (const idx of toRemove) {
          newCart.splice(idx, 1);
        }
        setCart(newCart);
        return;
      }

      const removedPrice = item.price;
      newCart.splice(index, 1);

      const aggregatorIndex = newCart.findIndex(
        (it) => it.isBundleChild && it.parentItemIndex === parentIdx && it.isAggregator === true
      );
      if (aggregatorIndex !== -1) {
        newCart[aggregatorIndex].price += removedPrice;
      }

      const bundleTotal = parent.price;
      const remainingChildren = newCart.filter(
        (it) => it.isBundleChild && it.parentItemIndex === parentIdx
      );
      const updatedChildren = recalculateBundleCommissions(remainingChildren, bundleTotal);

      const childIndices = newCart
        .map((it, idx) => (it.isBundleChild && it.parentItemIndex === parentIdx ? idx : -1))
        .filter(idx => idx !== -1);
      for (let i = 0; i < childIndices.length; i++) {
        newCart[childIndices[i]] = updatedChildren[i];
      }

      if (updatedChildren.length === 0) {
        const parentIndexToRemove = newCart.findIndex(
          (it) => it.isBundleParent && it.variant === parent.variant && it.parentItemIndex === null
        );
        if (parentIndexToRemove !== -1) {
          newCart.splice(parentIndexToRemove, 1);
        }
      }

      setCart(newCart);
      return;
    }

    setCart(cart.filter((_, i) => i !== index));
  };

  const updateQuantity = (index, newQty) => {
    if (newQty <= 0) {
      removeFromCart(index);
    } else {
      const newCart = [...cart];
      const item = newCart[index];
      if (item.isBundleParent) {
        updateBundleParentQuantity(index, newQty);
      } else if (item.isBundleChild) {
        // ignore direct changes to child quantity
      } else {
        newCart[index].quantity = newQty;
        setCart(newCart);
      }
    }
  };

  const updatePrice = (index, newPrice) => {
    const newCart = [...cart];
    const item = newCart[index];
    if (item.isBundleParent || item.isBundleChild) return;
    newCart[index].price = parseFloat(newPrice) || 0;
    setCart(newCart);
  };

  // Discount functions (unchanged)
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
      finalDiscount = (inputValue / 100) * itemTotal;
    } else {
      finalDiscount = inputValue;
    }
    
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
    const usedMethods = splitPayments.map((p) => p.method);
    const availableMethod = paymentMethods.find(
      (m) => !usedMethods.includes(m.value),
    );
    const defaultMethod = availableMethod ? availableMethod.value : "cash";
    setSplitPayments([...splitPayments, { method: defaultMethod, amount: 0 }]);
  };

  const addExchangeSplitPayment = () => {
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

  // Cart totals
  const cartItems = cart.filter(item => !item.isBundleParent);
  const cartSubtotal = cartItems
    .reduce((sum, item) => sum + item.price * item.quantity, 0);

  const cartLineItemDiscounts = cartItems
    .reduce((sum, item) => sum + (item.discount || 0), 0);

  const cartTotal = Math.max(0, cartSubtotal - cartLineItemDiscounts - transactionDiscount);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const exchangeCartItems = exchangeCart.filter(item => !item.isBundleParent);
  const exchangeCartSubtotal = exchangeCartItems
    .reduce((sum, item) => sum + item.price * item.quantity, 0);
  const exchangeCartLineItemDiscounts = exchangeCartItems
    .reduce((sum, item) => sum + (item.discount || 0), 0);
  const exchangeCartTotal = Math.max(0, exchangeCartSubtotal - exchangeCartLineItemDiscounts);
  const exchangeCartCount = exchangeCart.reduce((sum, item) => sum + item.quantity, 0);

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
    setAttachMode(false);
    setAttachingServiceIndex(null);
    setSaleAssignedUser(null);
    setSelectedCustomer(null);
    setDeliveryEnabled(false);
    setDeliveryInfo({
      recipientName: "",
      recipientPhone: "",
      recipientEmail: "",
      deliveryCategory: "",
      deliveryOption: "",
      deliveryAddress: {
        street: "",
        city: "",
        state: "",
        postalCode: "",
        country: "Kenya",
        landmark: "",
      },
      notes: "",
    });
  };

  const handleUpdateCustomer = async () => {
    if (!selectedCustomer) return;
    setUpdatingCustomer(true);
    setError("");
    try {
      const payload = {
        fullname: customerUpdateData.fullname,
        email: customerUpdateData.email || undefined,
        phone: customerUpdateData.phone || undefined,
        address: customerUpdateData.address,
      };
      const res = await apiFetch(`/customers/${selectedCustomer._id}`, {
        method: "PUT",
        body: payload,
      });
      const updated = res?.customer;
      if (updated) {
        setSelectedCustomer(updated);
        
        if (deliveryEnabled && updated.address) {
          setDeliveryInfo((prev) => ({
            ...prev,
            recipientName: updated.fullname || prev.recipientName,
            recipientPhone: updated.phone || prev.recipientPhone,
            recipientEmail: updated.email || prev.recipientEmail,
            deliveryAddress: {
              street: updated.address.street || "",
              city: updated.address.city || "",
              state: updated.address.state || "",
              postalCode: updated.address.postalCode || "",
              country: updated.address.country || "Kenya",
              landmark: updated.address.landmark || "",
            },
          }));
        }
        
        setShowUpdateCustomerModal(false);
        setStatus("Customer updated successfully!");
        setTimeout(() => setStatus(""), 3000);
      }
    } catch (err) {
      setError(err?.message || "Failed to update customer");
    } finally {
      setUpdatingCustomer(false);
    }
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

  const handleDeliveryConfirm = (deliveryData, fee) => {
    setDeliveryInfo({
      recipientName: deliveryData.recipientName,
      recipientPhone: deliveryData.recipientPhone,
      recipientEmail: deliveryData.recipientEmail || "",
      deliveryCategory: deliveryData.deliveryCategory,
      deliveryOption: deliveryData.deliveryOption,
      deliveryAddress: deliveryData.deliveryAddress,
      notes: deliveryData.notes || "",
    });
    setShowDeliveryModal(false);
    setShowCompleteCheckoutModal(true);
  };

  const handleDeliverySkip = () => {
    setShowDeliveryModal(false);
    setDeliveryEnabled(false);
  };

  // ====== RETURNS / EXCHANGE ======
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
      const res = await apiFetch(
        `/sales?receiptNumber=${encodeURIComponent(query)}&idempotencyKey=${encodeURIComponent(query)}`,
      );
      const sales = res?.data?.sales || res?.data || res || [];

      if (!sales.length) {
        setLookupError("Receipt not found");
        return;
      }

      const sale = sales[0];

      const allRefunded = sale.items.every(
        (item) => item.quantityRefunded >= item.quantity,
      );

      if (allRefunded) {
        setLookupError("This receipt has been fully refunded");
        return;
      }

      setOriginalSale(sale);
      setShowReturnLookup(false);

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

      const exchangeCreditAmount = Math.min(returnTotal, exchangeTotal);
      let payments = [];
      
      if (netDue > 0) {
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
        
        payments = [
          ...customerPayments,
          {
            method: "credit",
            amount: exchangeCreditAmount,
            status: "completed",
          },
        ];
      } else {
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

      exitExchangeMode();

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

  // ====== CHECKOUT ======
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError("Cart is empty");
      return;
    }

    setError("");

    const bundleChildrenWithNoUser = cart.filter(item => 
      item.isBundleChild && item.type === "service" && !item.assignedUser
    );
    const regularServicesNoUser = cart.filter(item => 
      item.type === "service" && !item.isBundleChild && !item.assignedUser && !saleAssignedUser
    );

    if (regularServicesNoUser.length > 0) {
      const names = regularServicesNoUser.map(item => item.name).join(", ");
      setError(`Please assign a user to the following services (or set a sale-level user): ${names}`);
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

    if (deliveryEnabled) {
      const hasRecipientInfo = deliveryInfo.recipientName && deliveryInfo.recipientPhone;
      const hasAddress = deliveryInfo.deliveryAddress?.street && deliveryInfo.deliveryAddress?.city;
      const hasDeliveryOptions = deliveryInfo.deliveryCategory && deliveryInfo.deliveryOption;

      if (!hasRecipientInfo || !hasAddress || !hasDeliveryOptions) {
        setShowDeliveryModal(true);
        return;
      }
    }

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

    const finalDeliveryFee = deliveryFee !== undefined ? deliveryFee : calculateDeliveryFee();

    setStatus("Processing...");
    setError("");

    try {
      if (isSplitPayment) {
        const totalAmount = positiveSplitPayments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        );
        if (totalAmount <= 0 || totalAmount > cartTotal + finalDeliveryFee) {
          setError("Split payment total must be between 0 and cart total.");
          return;
        }
      }

      const bundleParentNames = {};
      cart.forEach((item, index) => {
        if (item.isBundleParent) {
          bundleParentNames[index] = item.name;
        }
      });

      const saleItems = cart.filter(item => !item.isBundleParent);

      const formattedItems = saleItems.map((item) => {
        const isChild = item.parentItemIndex !== null &&
                        item.parentItemIndex !== undefined &&
                        !item.isBundleParent &&
                        !item.isBundleChild;

        const baseItem = {
          type: item.type,
          quantity: item.quantity,
          unitPrice: isChild ? 0 : item.price,
          discount: item.discount || 0,
          parentItemIndex: isChild ? item.parentItemIndex : null,
        };

        if (isChild && item.originalPrice !== undefined) {
          baseItem.originalPrice = item.originalPrice;
        }

        if (item.type === "service") {
          let displayName = item.name || item.productName;
          if (item.isBundleChild && bundleParentNames[item.parentItemIndex]) {
            displayName = `${bundleParentNames[item.parentItemIndex]} – ${displayName}`;
          }

          return {
            ...baseItem,
            productId: item.variant,
            productName: displayName,
            sku: item.sku || "",
            assignedUser: item.assignedUser || saleAssignedUser || null,
            parentItemIndex: null,
            laborCost: item.laborCost || 0,
            productCost: 0,
            commissionType: item.commissionType,
            commissionValue: item.commissionValue,
            commissionAmount: item.commissionAmount,
            isBundleChild: item.isBundleChild || false,
          };
        } else if (item.type === "shopify") {
          return {
            ...baseItem,
            shopifyVariantId: item.variant,
            sku: item.sku || undefined,
            productName: item.name,
            assignedUser: null,
          };
        } else {
          return {
            ...baseItem,
            productId: item.variant,
            assignedUser: null,
          };
        }
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
        assignedUser: saleAssignedUser || undefined,
        customerId: selectedCustomer?._id || undefined,
        customerName: selectedCustomer?.fullname || undefined,
        customerEmail: selectedCustomer?.email || undefined,
        customerPhone: selectedCustomer?.phone || undefined,
      };

      if (deliveryEnabled) {
        payload.requiresDelivery = true;
        payload.deliveryInfo = {
          requiresDelivery: true,
          recipientName: deliveryInfo.recipientName,
          recipientPhone: deliveryInfo.recipientPhone,
          recipientEmail: deliveryInfo.recipientEmail,
          deliveryAddress: deliveryInfo.deliveryAddress,
          deliveryCategory: deliveryInfo.deliveryCategory,
          deliveryOption: deliveryInfo.deliveryOption,
          deliveryFee: finalDeliveryFee || 0,
          notes: deliveryInfo.notes,
        };
      }

      const paidAmount = isSplitPayment
        ? positiveSplitPayments.reduce(
            (sum, payment) => sum + payment.amount,
            0,
          )
        : cartTotal + (deliveryEnabled ? (finalDeliveryFee || 0) : 0);
      const balanceDue = Math.max(0, cartTotal + (deliveryEnabled ? (finalDeliveryFee || 0) : 0) - paidAmount);
      const isReservationSale = Boolean(isReservation || balanceDue > 0.01);

      payload.paymentStatus = isReservationSale ? "partial" : "completed";
      payload.tags = [
        "pos",
        ...(isSplitPayment ? ["split-payment"] : []),
        ...(isReservationSale ? ["reservation", "partial-payment"] : []),
      ];

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

      // ✅ Group bundle items for receipt
      const groupedReceiptItems = [];
      const bundleGroups = {};

      saleItems.forEach((item) => {
        const parentName = bundleParentNames[item.parentItemIndex];
        if (item.isBundleChild && parentName) {
          if (!bundleGroups[parentName]) {
            bundleGroups[parentName] = {
              name: parentName,
              quantity: 1,
              price: 0,
              type: "bundle",
              discount: 0,
            };
          }
          bundleGroups[parentName].price += item.price * item.quantity;
          bundleGroups[parentName].discount += item.discount || 0;
        } else {
          groupedReceiptItems.push({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            type: item.type,
            discount: item.discount || 0,
          });
        }
      });

      Object.values(bundleGroups).forEach((group) => {
        groupedReceiptItems.push({
          name: group.name,
          quantity: 1,
          price: group.price,
          type: "bundle",
          discount: group.discount,
        });
      });

      const receiptInfo = {
        receiptNumber,
        items: groupedReceiptItems,
        payments: isSplitPayment
          ? positiveSplitPayments
          : [{ method: paymentMethod, amount: cartTotal + (deliveryEnabled ? (finalDeliveryFee || 0) : 0) }],
        subtotal: cartTotal,
        deliveryFee: deliveryEnabled ? (finalDeliveryFee || 0) : 0,
        deliveryInfo: deliveryEnabled ? deliveryInfo : undefined,
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

      // Offline fallback
      try {
        const offlineBundleParentNames = {};
        cart.forEach((item, index) => {
          if (item.isBundleParent) {
            offlineBundleParentNames[index] = item.name;
          }
        });

        const saleItemsForOffline = cart.filter(item => !item.isBundleParent);

        const formattedItemsOffline = saleItemsForOffline.map((item) => {
          const isChild = item.parentItemIndex !== null &&
                          item.parentItemIndex !== undefined &&
                          !item.isBundleParent &&
                          !item.isBundleChild;
          const baseItem = {
            type: item.type,
            quantity: item.quantity,
            unitPrice: isChild ? 0 : item.price,
            discount: item.discount || 0,
            parentItemIndex: isChild ? item.parentItemIndex : null,
          };
          if (isChild && item.originalPrice !== undefined) {
            baseItem.originalPrice = item.originalPrice;
          }

          if (item.type === "service") {
            let displayName = item.name || item.productName;
            if (item.isBundleChild && offlineBundleParentNames[item.parentItemIndex]) {
              displayName = `${offlineBundleParentNames[item.parentItemIndex]} – ${displayName}`;
            }

            return {
              ...baseItem,
              productId: item.variant,
              productName: displayName,
              sku: item.sku || "",
              assignedUser: item.assignedUser || saleAssignedUser || null,
              parentItemIndex: null,
              laborCost: item.laborCost || 0,
              productCost: 0,
              commissionType: item.commissionType,
              commissionValue: item.commissionValue,
              commissionAmount: item.commissionAmount,
              isBundleChild: item.isBundleChild || false,
            };
          } else if (item.type === "shopify") {
            return {
              ...baseItem,
              shopifyVariantId: item.variant,
              sku: item.sku || undefined,
              productName: item.name,
              assignedUser: null,
            };
          } else {
            return {
              ...baseItem,
              productId: item.variant,
              assignedUser: null,
            };
          }
        });

        const offlinePayload = {
          locationId,
          items: formattedItemsOffline,
          notes: checkoutNotes || undefined,
          assignedUser: saleAssignedUser || undefined,
          customerId: selectedCustomer?._id || undefined,
          customerName: selectedCustomer?.fullname || undefined,
          customerEmail: selectedCustomer?.email || undefined,
          customerPhone: selectedCustomer?.phone || undefined,
        };

        if (deliveryEnabled) {
          offlinePayload.requiresDelivery = true;
          offlinePayload.deliveryInfo = {
            requiresDelivery: true,
            recipientName: deliveryInfo.recipientName,
            recipientPhone: deliveryInfo.recipientPhone,
            recipientEmail: deliveryInfo.recipientEmail,
            deliveryAddress: deliveryInfo.deliveryAddress,
            deliveryCategory: deliveryInfo.deliveryCategory,
            deliveryOption: deliveryInfo.deliveryOption,
            deliveryFee: finalDeliveryFee || 0,
            notes: deliveryInfo.notes,
          };
        }

        const offlinePaidAmount = isSplitPayment
          ? positiveSplitPayments.reduce(
              (sum, payment) => sum + payment.amount,
              0,
            )
          : cartTotal + (deliveryEnabled ? (finalDeliveryFee || 0) : 0);
        const offlineBalanceDue = Math.max(
          0,
          cartTotal + (deliveryEnabled ? (finalDeliveryFee || 0) : 0) - offlinePaidAmount,
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

        if (isSplitPayment) {
          offlinePayload.payments = positiveSplitPayments.map((payment) => ({
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

        // Offline receipt also grouped
        const offlineBundleGroups = {};
        saleItemsForOffline.forEach((item) => {
          const parentName = offlineBundleParentNames[item.parentItemIndex];
          if (item.isBundleChild && parentName) {
            if (!offlineBundleGroups[parentName]) {
              offlineBundleGroups[parentName] = {
                name: parentName,
                quantity: 1,
                price: 0,
                type: "bundle",
              };
            }
            offlineBundleGroups[parentName].price += item.price * item.quantity;
          }
        });

        const offlineGroupedItems = [];
        Object.values(offlineBundleGroups).forEach((group) => {
          offlineGroupedItems.push({
            name: group.name,
            quantity: 1,
            price: group.price,
            type: "bundle",
          });
        });

        const offlineReceipt = {
          receiptNumber: idempotencyKey,
          timestamp: new Date().toISOString(),
          items: offlineGroupedItems.length > 0 ? offlineGroupedItems : saleItemsForOffline.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.customPrice ?? item.price,
          })),
          subtotal: cartTotal,
          deliveryFee: deliveryEnabled ? (finalDeliveryFee || 0) : 0,
          payments: isSplitPayment
            ? positiveSplitPayments.map((payment) => ({
                method: payment.method,
                amount: payment.amount,
              }))
            : [{ method: paymentMethod, amount: cartTotal + (deliveryEnabled ? (finalDeliveryFee || 0) : 0) }],
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

  // ====== PRODUCT CLICK HANDLERS ======
  const handleProductClick = (product) => {
    const variants = product.variants || [];
    if (variants.length <= 1) {
      const variant = variants[0];
      let isChild = false;
      let parentIndex = null;
      if (attachMode && attachingServiceIndex !== null) {
        isChild = true;
        parentIndex = attachingServiceIndex;
      }
      const cartItem = {
        type: "shopify",
        variant: variant?.id || product.id,
        name: `${product.title}${variant?.title && variant.title !== "Default Title" ? ` - ${variant.title}` : ""}`,
        price: isChild ? 0 : (parseFloat(variant?.price) || 0),
        originalPrice: isChild ? (parseFloat(variant?.price) || 0) : null,
        quantity: 1,
        sku: variant?.sku,
        discount: 0,
        parentItemIndex: parentIndex,
        assignedUser: null,
        isBundleChild: false,
        isBundleParent: false,
      };
      if (exchangeMode) {
        upsertCartItem(exchangeCart, setExchangeCart, cartItem);
      } else {
        upsertCartItem(cart, setCart, cartItem);
        handleCloseSearch();
      }
    } else {
      setVariantPickerProduct(product);
      setShowVariantPicker(true);
    }
  };

  const handleVariantSelect = (variant) => {
    if (!variantPickerProduct) return;
    let isChild = false;
    let parentIndex = null;
    if (attachMode && attachingServiceIndex !== null) {
      isChild = true;
      parentIndex = attachingServiceIndex;
    }
    const cartItem = {
      type: "shopify",
      variant: variant.id,
      name: `${variantPickerProduct.title}${variant.title && variant.title !== "Default Title" ? ` - ${variant.title}` : ""}`,
      price: isChild ? 0 : (parseFloat(variant.price) || 0),
      originalPrice: isChild ? (parseFloat(variant.price) || 0) : null,
      quantity: 1,
      sku: variant.sku,
      discount: 0,
      parentItemIndex: parentIndex,
      assignedUser: null,
      isBundleChild: false,
      isBundleParent: false,
    };
    if (exchangeMode) {
      upsertCartItem(exchangeCart, setExchangeCart, cartItem);
    } else {
      upsertCartItem(cart, setCart, cartItem);
      handleCloseSearch();
    }
    setShowVariantPicker(false);
    setVariantPickerProduct(null);
  };

  const handleSearchInput = (query) => {
    setSearchQuery(query);
    setShowSearchOverlay(query.trim().length > 0);
  };

  const handleCloseSearch = () => {
    setSearchQuery("");
    setShowSearchOverlay(false);
  };

  const handleSearchAdd = (product) => {
    addToCart(product);
    handleCloseSearch();
  };

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
  };

  const handleCustomerClear = () => {
    setSelectedCustomer(null);
    setDeliveryEnabled(false);
    setDeliveryInfo({
      recipientName: "",
      recipientPhone: "",
      recipientEmail: "",
      deliveryCategory: "",
      deliveryOption: "",
      deliveryAddress: {
        street: "",
        city: "",
        state: "",
        postalCode: "",
        country: "Kenya",
        landmark: "",
      },
      notes: "",
    });
  };

  const scheduleProductRefresh = useCallback(() => {
    if (refreshDebounceTimer) {
      clearTimeout(refreshDebounceTimer);
    }
    const timer = setTimeout(() => {
      if (shopifyConnection?.status === "active" && locationId) {
        loadShopifyProductsData();
      }
    }, 2000);
    setRefreshDebounceTimer(timer);
  }, [shopifyConnection?.status, locationId, loadShopifyProductsData]);

  // ====== RENDER ======
  return (
    <div className="flex flex-col bg-gray-50 h-full w-full max-w-full overflow-hidden box-border">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 h-[56px]">
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
            <h2 className="text-lg font-bold text-gray-900 mb-4">Select Location</h2>
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

      {locationsLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center gap-4 shadow-xl">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-700 font-medium">Loading locations...</p>
          </div>
        </div>
      )}

      {showNoLocationsModal && !locationsLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="text-center">
              <div className="text-5xl mb-4">📍</div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">No Locations Available</h2>
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
        selectedCustomer={selectedCustomer}
        deliveryInfo={deliveryInfo}
        deliveryFee={calculateDeliveryFee()}
        deliveryEnabled={deliveryEnabled}
      />

      {showDeliveryModal && (
        <DeliveryCheckoutModal
          isOpen={showDeliveryModal}
          locationId={locationId}
          cartSubtotal={cartSubtotal}
          cartDiscount={cartLineItemDiscounts}
          onConfirm={handleDeliveryConfirm}
          onSkip={handleDeliverySkip}
          onClose={() => setShowDeliveryModal(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0 w-full max-w-full">
        {/* LEFT: Cart Area */}
        <div
          ref={cartContainerRef}
          className="flex-1 min-w-0 bg-white border-r border-gray-200 flex flex-col min-h-0 h-full max-h-full overflow-hidden"
        >
          {/* Search Bar */}
          <div className="p-3 border-b border-gray-200 bg-white z-10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => handleSearchInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
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
                {searchQuery && (
                  <button
                    onClick={() => handleSearchInput("")}
                    className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowPendingSales(!showPendingSales)}
                className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium whitespace-nowrap hover:bg-amber-200"
              >
                {pendingSalesCount} pending
              </button>
            </div>
          </div>

          {/* Content: Overlay or Cart Items */}
          <div className="flex-1 min-h-0 overflow-auto relative">
            {showSearchOverlay ? (
              <SearchOverlay
                searchQuery={searchQuery}
                onAddToCart={(product) => {
                  addToCart(product);
                  handleCloseSearch();
                }}
                onShopifyProductClick={handleProductClick}
                onClose={handleCloseSearch}
              />
            ) : (
              <div className="p-4 h-full">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <p className="text-4xl mb-2">🛒</p>
                    <p>Cart is empty</p>
                    <p className="text-xs mt-2">Search for products above</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item, index) => {
                      const isService = item.type === "service";
                      const isChild = item.parentItemIndex !== null && item.parentItemIndex !== undefined && !item.isBundleParent;
                      const isBundleParent = item.isBundleParent === true;
                      const isBundleChild = item.isBundleChild === true;
                      const isAttachActive = attachMode && attachingServiceIndex === index;

                      return (
                        <div key={index} className={`bg-gray-50 rounded-lg p-3 ${isChild ? "ml-4 border-l-2 border-blue-300" : ""}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-medium text-gray-900 text-sm truncate">{item.name}</h4>
                                {isBundleParent && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded whitespace-nowrap">Bundle</span>}
                                {isBundleChild && <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded whitespace-nowrap">Bundle item</span>}
                                {isChild && !isBundleChild && <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded whitespace-nowrap">attached</span>}
                                {isService && <span className="text-[10px] bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded whitespace-nowrap">service</span>}
                              </div>
                              {isBundleParent && (
                                <div className="text-xs text-gray-500 mt-1">
                                  {item.quantity} × {cart.filter(i => i.parentItemIndex === index && i.isBundleChild).length} sub‑services
                                </div>
                              )}
                              {isService && !isBundleParent && (
                                <div className="mt-1 space-y-1">
                                  <div className="flex items-center gap-1">
                                    <label className="text-[10px] text-gray-500">Labor:</label>
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={item.laborCost || 0}
                                      onChange={(e) => {
                                        if (isBundleChild) {
                                          updateBundleChildCosts(index, "laborCost", e.target.value);
                                        } else {
                                          updateServiceCosts(index, "laborCost", e.target.value);
                                        }
                                      }}
                                      className="w-16 px-1 py-0.5 text-xs border border-gray-300 rounded"
                                    />
                                    <span className="text-[10px] text-gray-500">= ${item.price.toFixed(2)}</span>
                                  </div>
                                  {isBundleChild && item.commissionDeductionTiming && (
                                    <div className="text-[10px] text-gray-400">
                                      Timing: {item.commissionDeductionTiming === "before_commission" ? "Before Commission" : "After Deductions"}
                                    </div>
                                  )}
                                </div>
                              )}
                              {!isService && !isBundleParent && !isBundleChild && (
                                <div className="flex items-center gap-2 mt-1">
                                  {editingPriceIndex === index ? (
                                    <input autoFocus type="number" step="0.01" value={editingPriceValue} onChange={(e) => setEditingPriceValue(e.target.value)} onBlur={() => savePriceEdit(index)} onKeyDown={(e) => e.key === "Enter" && savePriceEdit(index)} className="w-20 px-2 py-1 border border-blue-300 rounded text-sm" />
                                  ) : (
                                    <button onClick={() => handlePriceEdit(index)} className="text-sm text-gray-500 hover:text-blue-600 flex items-center gap-1" title="Click to edit price">
                                      ${item.price.toFixed(2)} <span className="text-xs">✎</span>
                                    </button>
                                  )}
                                </div>
                              )}
                              {useSessionStore.getState().can(PERMISSIONS.POS_APPLY_DISCOUNT) && !isChild && !isBundleParent && !isBundleChild && (
                                <div className="mt-1">
                                  {editingDiscountIndex === index ? (
                                    <div className="flex items-center gap-2">
                                      <select value={discountType} onChange={(e) => setDiscountType(e.target.value)} className="px-2 py-1 border border-green-300 rounded text-xs">
                                        <option value="fixed">$</option>
                                        <option value="percentage">%</option>
                                      </select>
                                      <input autoFocus type="number" step="0.01" placeholder="0" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} onBlur={() => saveDiscountEdit(index)} onKeyDown={(e) => e.key === "Enter" && saveDiscountEdit(index)} className="w-20 px-2 py-1 border border-green-300 rounded text-xs" />
                                      <button onClick={() => { setEditingDiscountIndex(null); setDiscountValue(""); }} className="text-xs text-gray-500">✕</button>
                                    </div>
                                  ) : (
                                    <button onClick={() => handleDiscountEdit(index)} className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1" title="Click to apply discount">
                                      {item.discount > 0 ? (
                                        <>
                                          <span className="line-through text-gray-400">${(item.price * item.quantity).toFixed(2)}</span>
                                          <span className="font-medium">-${item.discount.toFixed(2)} 🏷️</span>
                                        </>
                                      ) : (
                                        <span>+ Add Discount</span>
                                      )}
                                    </button>
                                  )}
                                </div>
                              )}

                              {isService && !isBundleParent && (
                                <div className="mt-1">
                                  <select
                                    value={item.assignedUser || ""}
                                    onChange={(e) => {
                                      const userId = e.target.value || null;
                                      const newCart = [...cart];
                                      const updatedItem = { ...newCart[index] };
                                      updatedItem.assignedUser = userId;

                                      const isBundleChild = updatedItem.isBundleChild === true;

                                      if (isBundleChild) {
                                        const bundleId = updatedItem.variant;
                                        const subServiceIndex = updatedItem.subServiceIndex;
                                        if (subServiceIndex !== undefined) {
                                          const overrideKey = `${bundleId}:${subServiceIndex}`;
                                          const user = userId ? users.find(u => u._id === userId) : null;
                                          
                                          // Start with defaults from the bundle definition
                                          let effectiveCommissionType = updatedItem.defaultCommissionType || "percentage";
                                          let effectiveCommissionValue = updatedItem.defaultCommissionValue || 0;
                                          let isOverride = false;
                                          let overrideDisplay = null;

                                          if (user && user.commissionOverrides) {
                                            const override = user.commissionOverrides.find(ov => ov.serviceId === overrideKey);
                                            if (override) {
                                              // ✅ Override found – use it
                                              effectiveCommissionType = override.commissionType;
                                              effectiveCommissionValue = override.commissionValue;
                                              isOverride = true;
                                              overrideDisplay = effectiveCommissionType === "percentage"
                                                ? `${effectiveCommissionValue}%`
                                                : `$${effectiveCommissionValue.toFixed(2)}`;
                                              
                                              console.log(`✅ Override applied for ${updatedItem.name}:`, {
                                                type: effectiveCommissionType,
                                                value: effectiveCommissionValue,
                                                isOverride,
                                              });
                                            } else {
                                              console.log(`❌ No override for ${updatedItem.name} (key: ${overrideKey})`);
                                            }
                                          }

                                          // Update the child with the effective commission
                                          updatedItem.commissionType = effectiveCommissionType;
                                          updatedItem.commissionValue = effectiveCommissionValue;
                                          updatedItem.commissionIsOverride = isOverride;
                                          updatedItem.commissionDisplay = isOverride ? overrideDisplay : updatedItem.commissionDisplay;

                                          // ✅ IMPORTANT: Place the updated child back into the cart BEFORE recalculating
                                          newCart[index] = updatedItem;

                                          // Now recalculate commissions for the entire bundle
                                          const parentIdx = updatedItem.parentItemIndex;
                                          if (parentIdx !== null && parentIdx !== undefined) {
                                            const parent = newCart[parentIdx];
                                            if (parent && parent.isBundleParent) {
                                              const bundleTotal = parent.price;
                                              const children = newCart.filter(
                                                (it) => it.isBundleChild && it.parentItemIndex === parentIdx
                                              );
                                              
                                              console.log("Children before recalculation:", children.map(c => ({
                                                name: c.name,
                                                commissionType: c.commissionType,
                                                commissionValue: c.commissionValue,
                                                price: c.price,
                                              })));
                                              
                                              const updatedChildren = recalculateBundleCommissions(children, bundleTotal);
                                              
                                              console.log("Children after recalculation:", updatedChildren.map(c => ({
                                                name: c.name,
                                                commissionType: c.commissionType,
                                                commissionValue: c.commissionValue,
                                                commissionAmount: c.commissionAmount,
                                              })));
                                              
                                              const childIndices = newCart
                                                .map((it, idx) => (it.isBundleChild && it.parentItemIndex === parentIdx ? idx : -1))
                                                .filter(idx => idx !== -1);
                                              for (let i = 0; i < childIndices.length; i++) {
                                                newCart[childIndices[i]] = updatedChildren[i];
                                              }
                                            }
                                          }
                                        }
                                      } else {
                                        // Regular service logic
                                        const productDefaults = serviceProductMap[updatedItem.variant];
                                        if (productDefaults) {
                                          const user = userId ? users.find(u => u._id === userId) : null;
                                          const commission = getEffectiveCommission(
                                            { _id: updatedItem.variant, commissionType: productDefaults.commissionType, commissionValue: productDefaults.commissionValue },
                                            user
                                          );
                                          const includeProduct = false;
                                          updatedItem.commissionType = commission.type;
                                          updatedItem.commissionValue = commission.value;
                                          updatedItem.commissionIsOverride = commission.isOverride;
                                          updatedItem.commissionDisplay = commission.display;
                                          updatedItem.commissionAmount = computeCommissionAmount(
                                            updatedItem.laborCost || 0,
                                            commission.type,
                                            commission.value,
                                            0,
                                            includeProduct
                                          );
                                          newCart[index] = updatedItem;
                                        }
                                      }

                                      // If it's not a bundle child, we already set newCart[index] above, but for safety:
                                      if (!isBundleChild) {
                                        newCart[index] = updatedItem;
                                      }

                                      setCart(newCart);
                                    }}
                                    className="text-xs border border-gray-300 rounded px-1 py-0.5 w-full max-w-[120px]"
                                  >
                                    <option value="">Assign user</option>
                                    {users.map((user) => (
                                      <option key={user._id} value={user._id}>{user.fullname || user.email}</option>
                                    ))}
                                  </select>
                                </div>
                              )}

                              {isService && !isBundleParent && (
                                <div className="text-xs mt-1 flex items-center gap-2">
                                  <span className="text-gray-500">
                                    Commission: <span className="font-medium text-gray-700">
                                      {item.commissionType === "percentage"
                                        ? `${item.commissionValue}% ($${item.commissionAmount?.toFixed(2) || "0.00"})`
                                        : `$${item.commissionValue?.toFixed(2)}`}
                                    </span>
                                  </span>
                                  {item.commissionIsOverride ? (
                                    <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">Override</span>
                                  ) : (
                                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Default</span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Right side actions */}
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <button onClick={() => removeFromCart(index)} className="text-red-500 hover:text-red-700">✕</button>
                              {!isService && !isChild && !isBundleParent && !isBundleChild && cart.some(item => item.type === "service") && (
                                <button onClick={() => openAttachQuantityModal(index)} className="text-[10px] text-blue-600 hover:text-blue-800 whitespace-nowrap">
                                  Attach
                                </button>
                              )}
                              {isChild && !isBundleChild && (
                                <button onClick={() => detachFromService(index)} className="text-[10px] text-red-500 hover:text-red-700 whitespace-nowrap">
                                  Detach
                                </button>
                              )}
                              {isService && !isBundleParent && !isBundleChild && (
                                <button
                                  onClick={() => toggleAttachMode(index)}
                                  className={`text-[10px] p-1 rounded-full border ${isAttachActive ? "border-blue-500 bg-blue-100 text-blue-700" : "border-gray-300 bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                                  title={isAttachActive ? "Stop attaching" : "Start attaching"}
                                >
                                  📎
                                </button>
                              )}
                              {isService && isAttachActive && (
                                <span className="text-[9px] text-blue-600 whitespace-nowrap">Attaching...</span>
                              )}
                            </div>
                          </div>

                          {/* Quantity controls and item total */}
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-2">
                              {isBundleParent ? (
                                <>
                                  <button onClick={() => updateBundleParentQuantity(index, item.quantity - 1)} className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold">−</button>
                                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                                  <button onClick={() => updateBundleParentQuantity(index, item.quantity + 1)} className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold">+</button>
                                </>
                              ) : isBundleChild ? (
                                <span className="w-12 text-center font-medium text-gray-500">{item.quantity}</span>
                              ) : (
                                <>
                                  <button onClick={() => updateQuantity(index, item.quantity - 1)} className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold">−</button>
                                  <span className="w-12 text-center font-medium">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(index, item.quantity + 1)} className="w-8 h-8 bg-white border border-gray-300 rounded hover:bg-gray-100 font-bold">+</button>
                                </>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900">${((item.price * item.quantity) - (item.discount || 0)).toFixed(2)}</p>
                              {item.discount > 0 && <p className="text-xs text-green-600">Saved ${item.discount.toFixed(2)}</p>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Checkout Panel */}
        <div className="w-[380px] bg-white border-l border-gray-200 flex flex-col min-h-0 h-full max-h-full overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900">Checkout</h2>
          </div>

          <div className="flex-1 min-h-0 overflow-auto p-4 space-y-4">
            {/* Sale Assigned User */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Sale Assigned User</h3>
              </div>
              <select
                value={saleAssignedUser || ""}
                onChange={(e) => setSaleAssignedUser(e.target.value || null)}
                className="w-full rounded border border-zinc-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None (cashier default)</option>
                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.fullname || user.email}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                This user will be assigned to all services that don't have a specific user.
              </p>
            </div>

            {/* Customer */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Customer</h3>
                {selectedCustomer && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerUpdateData({
                        fullname: selectedCustomer.fullname || "",
                        email: selectedCustomer.email || "",
                        phone: selectedCustomer.phone || "",
                        address: selectedCustomer.address || {
                          street: "",
                          city: "",
                          state: "",
                          postalCode: "",
                          country: "Kenya",
                        },
                      });
                      setShowUpdateCustomerModal(true);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Update Customer
                  </button>
                )}
              </div>
              <CustomerSelector
                selectedCustomer={selectedCustomer}
                onSelectCustomer={handleCustomerSelect}
                onClearCustomer={handleCustomerClear}
              />
            </div>

            {/* Delivery */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Delivery</h3>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deliveryEnabled}
                    onChange={(e) => setDeliveryEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
              {deliveryEnabled && (
                <div className="mt-2 bg-gray-50 p-3 rounded-lg">
                  <DeliveryForm
                    value={deliveryInfo}
                    onChange={setDeliveryInfo}
                    locationId={locationId}
                  />
                </div>
              )}
            </div>

            {/* Summary */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Summary</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">${cartSubtotal.toFixed(2)}</span>
                </div>
                {cartLineItemDiscounts > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Item Discounts</span>
                    <span>-${cartLineItemDiscounts.toFixed(2)}</span>
                  </div>
                )}
                {deliveryEnabled && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Delivery Fee</span>
                    <span className="font-medium">
                      ${calculateDeliveryFee().toFixed(2)}
                    </span>
                  </div>
                )}
                {transactionDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Transaction Discount</span>
                    <span>-${transactionDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-blue-600">
                      ${(cartTotal + (deliveryEnabled ? calculateDeliveryFee() : 0)).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transaction Discount */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Discount</h3>
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
                      className="px-2 py-1 border border-green-300 rounded text-sm flex-1"
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
                      className="w-20 px-2 py-1 border border-green-300 rounded text-sm"
                    />
                    <button
                      onClick={() => { setTransactionDiscount(0); setShowTransactionDiscount(false); setDiscountReason(""); }}
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

            {/* Notes */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
              <input
                type="text"
                placeholder="Add note (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 space-y-2 flex-shrink-0">
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || checkingPreviousDayShift}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg text-sm transition-colors"
            >
              Add Payments
            </button>
            <button
              onClick={() => {
                setShowCompleteCheckoutModal(true);
              }}
              disabled={cart.length === 0 || checkingPreviousDayShift}
              className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg text-sm transition-colors"
            >
              Create Reservation
            </button>
            <button
              onClick={holdCurrentSale}
              disabled={cart.length === 0 || checkingPreviousDayShift}
              className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-lg text-sm transition-colors"
            >
              Hold Sale
            </button>
            <button
              onClick={() => {
                setShowHeldSalesModal(true);
                loadHeldSales();
              }}
              className="w-full border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium py-3 rounded-lg text-sm transition-colors"
            >
              📋 View Held Sales ({heldSales.length})
            </button>
            {checkingPreviousDayShift && <p className="mt-2 text-xs text-gray-500">Checking whether a previous-day shift is still open...</p>}
            {previousDayShiftError && !checkingPreviousDayShift && <p className="mt-2 text-xs text-amber-700">{previousDayShiftError}</p>}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAttachModal && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Cannot Add Service</h3>
            <p className="text-sm text-gray-600 mb-4">You are currently attaching products to another service. Please stop attaching before adding a new service.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowAttachModal(false); setPendingServiceProduct(null); stopAttach(); }} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Stop Attach</button>
              <button onClick={() => { setShowAttachModal(false); setPendingServiceProduct(null); }} className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showAttachQuantityModal && attachQuantityProductIndex !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Attach to Service</h3>
            <p className="text-sm text-gray-600 mb-4">
              Attach a quantity of <strong>{cart[attachQuantityProductIndex]?.name}</strong> to a service.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Service</label>
                <select
                  value={attachModalSelectedServiceIndex ?? ""}
                  onChange={(e) => setAttachModalSelectedServiceIndex(Number(e.target.value))}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                >
                  {cart.map((item, idx) => {
                    if (item.type === "service" && !item.isBundleParent && !item.isBundleChild) {
                      return <option key={idx} value={idx}>{item.name}</option>;
                    }
                    return null;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Quantity to Attach</label>
                <input
                  type="number"
                  min="1"
                  max={cart[attachQuantityProductIndex]?.quantity || 1}
                  value={attachQuantityValue}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 1;
                    const max = cart[attachQuantityProductIndex]?.quantity || 1;
                    setAttachQuantityValue(Math.min(Math.max(1, val), max));
                  }}
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Available: {cart[attachQuantityProductIndex]?.quantity}</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  if (attachModalSelectedServiceIndex === null) {
                    setError("Please select a service.");
                    return;
                  }
                  splitAndAttachItem(
                    attachQuantityProductIndex,
                    attachModalSelectedServiceIndex,
                    attachQuantityValue
                  );
                }}
                className="flex-1 rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Attach
              </button>
              <button
                onClick={() => {
                  setShowAttachQuantityModal(false);
                  setAttachQuantityProductIndex(null);
                }}
                className="flex-1 rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showVariantPicker && variantPickerProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{variantPickerProduct.title}</h2>
                <p className="text-sm text-gray-500 mt-1">Select a variant to add to cart</p>
              </div>
              <button onClick={() => { setShowVariantPicker(false); setVariantPickerProduct(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {variantPickerProduct.variants.map((variant) => (
                  <button key={variant.id} onClick={() => handleVariantSelect(variant)} className="bg-white border-2 border-gray-200 hover:border-blue-500 rounded-lg p-4 text-left transition-all hover:shadow-md">
                    <h3 className="font-semibold text-gray-900 mb-2">{variant.title}</h3>
                    {variant.sku && <p className="text-sm text-gray-600 mb-2">SKU: <span className="font-mono">{variant.sku}</span></p>}
                    <p className="text-xl font-bold text-blue-600 mb-2">${parseFloat(variant.price).toFixed(2)}</p>
                    <div className="flex items-center gap-2">
                      {variant.inventoryQuantity > 0 ? (
                        <><div className="w-2 h-2 bg-green-500 rounded-full"></div><span className="text-sm text-gray-600">{variant.inventoryQuantity} in stock</span></>
                      ) : (
                        <><div className="w-2 h-2 bg-red-500 rounded-full"></div><span className="text-sm text-red-600">Out of stock</span></>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <button onClick={() => { setShowVariantPicker(false); setVariantPickerProduct(null); }} className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showReturnLookup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">{exchangeMode ? "Lookup Receipt for Exchange" : "Lookup Receipt"}</h2>
            <p className="text-sm text-gray-600 mb-4">{exchangeMode ? "Enter the receipt number to start an exchange" : "Enter the receipt number to process a return"}</p>
            <div className="mb-4">
              <input type="text" placeholder="Receipt number or idempotency key..." value={receiptSearchQuery} onChange={(e) => setReceiptSearchQuery(e.target.value)} onKeyPress={(e) => e.key === "Enter" && lookupSale()} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" autoFocus />
            </div>
            {lookupError && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{lookupError}</div>}
            <div className="flex gap-3">
              <button onClick={lookupSale} className={`flex-1 px-4 py-2 text-white rounded-lg font-medium ${exchangeMode ? "bg-indigo-600 hover:bg-indigo-700" : "bg-orange-500 hover:bg-orange-600"}`}>Lookup</button>
              <button onClick={exchangeMode ? exitExchangeMode : exitReturnMode} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showUpdateCustomerModal && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-4">Update Customer</h2>
            <form onSubmit={(e) => { e.preventDefault(); handleUpdateCustomer(); }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Full Name *</label>
                <input
                  type="text"
                  required
                  value={customerUpdateData.fullname}
                  onChange={(e) => setCustomerUpdateData({ ...customerUpdateData, fullname: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Email</label>
                <input
                  type="email"
                  value={customerUpdateData.email}
                  onChange={(e) => setCustomerUpdateData({ ...customerUpdateData, email: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Phone</label>
                <input
                  type="tel"
                  value={customerUpdateData.phone}
                  onChange={(e) => setCustomerUpdateData({ ...customerUpdateData, phone: e.target.value })}
                  className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="border-t border-zinc-200 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-zinc-700">Delivery Address</label>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700">Street</label>
                    <input
                      type="text"
                      value={customerUpdateData.address?.street || ""}
                      onChange={(e) =>
                        setCustomerUpdateData({
                          ...customerUpdateData,
                          address: { ...customerUpdateData.address, street: e.target.value },
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
                        value={customerUpdateData.address?.city || ""}
                        onChange={(e) =>
                          setCustomerUpdateData({
                            ...customerUpdateData,
                            address: { ...customerUpdateData.address, city: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">State/Province</label>
                      <input
                        type="text"
                        value={customerUpdateData.address?.state || ""}
                        onChange={(e) =>
                          setCustomerUpdateData({
                            ...customerUpdateData,
                            address: { ...customerUpdateData.address, state: e.target.value },
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
                        value={customerUpdateData.address?.postalCode || ""}
                        onChange={(e) =>
                          setCustomerUpdateData({
                            ...customerUpdateData,
                            address: { ...customerUpdateData.address, postalCode: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-zinc-700">Country</label>
                      <input
                        type="text"
                        value={customerUpdateData.address?.country || "Kenya"}
                        onChange={(e) =>
                          setCustomerUpdateData({
                            ...customerUpdateData,
                            address: { ...customerUpdateData.address, country: e.target.value },
                          })
                        }
                        className="mt-1 w-full rounded border border-zinc-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUpdateCustomerModal(false)}
                  className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updatingCustomer || !customerUpdateData.fullname.trim()}
                  className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatingCustomer ? "Updating..." : "Update Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showReceipt && receipt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900">{receipt.isExchange ? "Exchange Slip" : receipt.isReturn ? "Return Receipt" : "Receipt"}</h2>
                {receipt.isReservation && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-semibold">Partial</span>}
              </div>
              <p className="text-sm text-gray-600 font-mono">#{receipt.receiptNumber}</p>
              <p className="text-xs text-gray-500 mt-1">{new Date(receipt.timestamp).toLocaleString()}</p>
              {receipt.isOffline && <div className="mt-2 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-medium">⚠️ Offline Sale - Will sync when online</div>}
            </div>
            <div className="p-6 space-y-4">
              <div className="border-b pb-4">
                <p className="text-sm font-semibold text-gray-900">{activeOrganization?.name || "Organization"}</p>
                <p className="text-xs text-gray-600">Location: {getLocationLabel(locationId)}</p>
              </div>
              {receipt.isExchange ? (
                <>
                  <div className="border-b pb-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">Returned Items</h3><div className="space-y-2">{receipt.returnItems.map((item, idx) => (<div key={idx} className="flex justify-between items-start"><div className="flex-1"><p className="text-sm font-medium text-gray-900">{item.name}</p><p className="text-xs text-gray-600">{item.quantity} × ${item.price.toFixed(2)}</p></div><p className="text-sm font-semibold text-gray-900 text-right">${(item.price * item.quantity).toFixed(2)}</p></div>))}</div></div>
                  <div className="border-b pb-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">Exchange Items</h3><div className="space-y-2">{receipt.exchangeItems.map((item, idx) => (<div key={idx} className="flex justify-between items-start"><div className="flex-1"><p className="text-sm font-medium text-gray-900">{item.name}</p><p className="text-xs text-gray-600">{item.quantity} × ${item.price.toFixed(2)}</p></div><p className="text-sm font-semibold text-gray-900 text-right">${(item.price * item.quantity).toFixed(2)}</p></div>))}</div></div>
                </>
              ) : (
                <div className="border-b pb-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">Items</h3><div className="space-y-2">{receipt.items.map((item, idx) => (<div key={idx} className="flex justify-between items-start"><div className="flex-1"><p className="text-sm font-medium text-gray-900">{item.name}</p><p className="text-xs text-gray-600">{item.quantity} × ${item.price.toFixed(2)}</p></div><p className="text-sm font-semibold text-gray-900 text-right">${(item.price * item.quantity).toFixed(2)}</p></div>))}</div></div>
              )}
              {receipt.payments && receipt.payments.length > 0 && (
                <div className="border-b pb-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">{receipt.isExchange ? "Payment Due" : "Payment"}</h3><div className="space-y-2">{receipt.payments.map((payment, idx) => (<div key={idx} className="flex justify-between"><p className="text-sm text-gray-700 capitalize">{payment.method}</p><p className="text-sm font-semibold text-gray-900">${toNonNegativeAmount(payment.amount).toFixed(2)}</p></div>))}</div></div>
              )}
              {receipt.deliveryInfo && (
                <div className="border-b pb-4"><h3 className="text-sm font-semibold text-gray-900 mb-3">Delivery Information</h3><div className="space-y-2">{receipt.trackingNumber && <div className="flex justify-between"><p className="text-xs text-gray-600">Tracking #</p><p className="text-sm font-mono font-semibold text-blue-600">{receipt.trackingNumber}</p></div>}<div className="flex justify-between"><p className="text-xs text-gray-600">Recipient</p><p className="text-sm font-medium text-gray-900">{receipt.deliveryInfo.recipientName}</p></div><div className="flex justify-between"><p className="text-xs text-gray-600">Phone</p><p className="text-sm font-medium text-gray-900">{receipt.deliveryInfo.recipientPhone}</p></div>{receipt.deliveryInfo.deliveryAddress && <div className="flex justify-between"><p className="text-xs text-gray-600">Address</p><p className="text-sm font-medium text-gray-900 text-right">{receipt.deliveryInfo.deliveryAddress.street}<br />{receipt.deliveryInfo.deliveryAddress.city}{receipt.deliveryInfo.deliveryAddress.country && `, ${receipt.deliveryInfo.deliveryAddress.country}`}</p></div>}{receipt.deliveryInfo.deliveryCategory && <div className="flex justify-between"><p className="text-xs text-gray-600">Delivery Type</p><p className="text-sm font-medium text-gray-900">{receipt.deliveryInfo.deliveryCategory} - {receipt.deliveryInfo.deliveryOption}</p></div>}{receipt.deliveryFee > 0 && <div className="flex justify-between"><p className="text-xs text-gray-600">Delivery Fee</p><p className="text-sm font-semibold text-gray-900">${receipt.deliveryFee.toFixed(2)}</p></div>}</div></div>
              )}
              {(receipt.isReturn || receipt.isExchange) && receipt.returnReason && (
                <div className="border-b pb-4"><h3 className="text-sm font-semibold text-gray-900 mb-2">Return Reason</h3><p className="text-sm text-gray-700">{receipt.returnReason.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}</p></div>
              )}
              {receipt.isExchange ? (
                <div className="bg-indigo-50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-center text-sm font-semibold"><span>Return Total</span><span className="text-orange-600">${receipt.returnTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center text-sm font-semibold"><span>Exchange Total</span><span className="text-indigo-600">${receipt.exchangeTotal.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center"><p className="text-lg font-bold text-gray-900">{receipt.netBalance > 0 ? "Customer Pays" : receipt.netBalance < 0 ? "Refund Due" : "Balanced"}</p><p className="text-2xl font-bold text-gray-900">${Math.abs(receipt.netBalance).toFixed(2)}</p></div>
                </div>
              ) : (
                <div className={`${receipt.isReturn ? "bg-orange-50" : "bg-blue-50"} rounded-lg p-4`}>
                  <div className="flex justify-between items-center"><p className="text-lg font-bold text-gray-900">{receipt.isReturn ? "Refund Total" : "Total"}</p><p className={`text-2xl font-bold ${receipt.isReturn ? "text-orange-600" : "text-blue-600"}`}>${(receipt.subtotal + (receipt.deliveryFee || 0)).toFixed(2)}</p></div>
                  {receipt.isReservation && !receipt.isReturn && !receipt.isExchange && (
                    <div className="mt-3 pt-3 border-t border-blue-100 space-y-1">
                      <div className="flex justify-between items-center text-sm"><p className="text-gray-700">Amount Paid</p><p className="font-semibold text-gray-900">${receipt.amountPaid.toFixed(2)}</p></div>
                      <div className="flex justify-between items-center text-sm"><p className="text-gray-700">Balance Due</p><p className="font-semibold text-amber-700">${receipt.balanceDue.toFixed(2)}</p></div>
                    </div>
                  )}
                </div>
              )}
              {receipt.notes && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200"><p className="text-xs text-gray-600 font-semibold mb-1">Notes</p><p className="text-sm text-gray-900">{receipt.notes}</p></div>
              )}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-900 mb-3">Email Receipt</p>
                <div className="flex gap-2 mb-2">
                  <input type="email" placeholder="customer@example.com" value={emailInput} onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }} className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleSendEmail} disabled={sendingEmail} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white rounded font-medium text-sm transition-colors">{sendingEmail ? "..." : "Send"}</button>
                </div>
                {emailError && <p className="text-xs text-red-600 bg-red-50 rounded px-2 py-1">{emailError}</p>}
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
              <button onClick={handlePrintReceipt} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"><span>🖨️</span> Print</button>
              <button onClick={() => setShowReceipt(false)} className="flex-1 px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-lg font-semibold transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {showHeldSalesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Held Sales</h2>
              <button
                onClick={() => setShowHeldSalesModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="mb-4">
              <input
                type="text"
                placeholder="Search by PROF number..."
                value={heldSalesSearchQuery}
                onChange={(e) => setHeldSalesSearchQuery(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {loadingHeldSales ? (
              <p className="text-gray-500">Loading...</p>
            ) : (
              (() => {
                const filtered = heldSales.filter(draft =>
                  draft.idempotencyKey?.toLowerCase().includes(heldSalesSearchQuery.toLowerCase().trim())
                );
                if (filtered.length === 0) {
                  return <p className="text-gray-500 text-center py-8">No held sales found.</p>;
                }
                return (
                  <div className="space-y-4">
                    {filtered.map((draft, idx) => (
                      <div key={draft.idempotencyKey || idx} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {draft.cart.length} items &nbsp;|&nbsp;
                              Total: ${(draft.cartTotal || 0).toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-600">PROF: {draft.idempotencyKey}</p>
                            {draft.selectedCustomer && (
                              <p className="text-xs text-gray-600">Customer: {draft.selectedCustomer.fullname}</p>
                            )}
                            <p className="text-xs text-gray-400">Held: {new Date(draft.heldAt).toLocaleString()}</p>
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              onClick={() => resumeHeldSale(draft)}
                              className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              Resume
                            </button>
                            <button
                              onClick={() => {
                                const items = (draft.cart || []).map(item => ({
                                  name: item.name,
                                  quantity: item.quantity,
                                  price: item.price,
                                  type: item.type,
                                  discount: item.discount || 0,
                                }));
                                const subtotal = draft.cartTotal || 0;
                                const total = subtotal;

                                const proformaReceipt = {
                                  isProforma: true,
                                  receiptNumber: `PROF-${draft.idempotencyKey?.slice(0, 8) || Date.now()}`,
                                  timestamp: new Date().toISOString(),
                                  items,
                                  subtotal,
                                  total,
                                  notes: draft.notes || "",
                                  customer: draft.selectedCustomer?.fullname || "",
                                };

                                printReceiptInBrowser({
                                  receipt: proformaReceipt,
                                  organizationName: activeOrganization?.name,
                                  locationLabel: getLocationLabel(locationId),
                                });
                              }}
                              className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
                            >
                              Print Proforma
                            </button>
                            <button
                              onClick={() => deleteHeldSale(draft.idempotencyKey)}
                              className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </div>
      )}
    </div>
  );
}