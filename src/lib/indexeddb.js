// IndexedDB utility for storing pending sales and deliveries when offline
const DB_NAME = "FLEXI_POS";
const DB_VERSION = 3; // Incremented for new delivery stores
const STORE_NAME = "pending_sales";
const SHOPIFY_STORE_NAME = "shopify_products";
const PENDING_DELIVERIES_STORE = "pending_deliveries";
const PENDING_DELIVERY_UPDATES_STORE = "pending_delivery_updates";
const CACHED_CATEGORIES_STORE = "cached_delivery_categories";

let db = null;

function getStoreNames() {
  return [
    STORE_NAME,
    SHOPIFY_STORE_NAME,
    PENDING_DELIVERIES_STORE,
    PENDING_DELIVERY_UPDATES_STORE,
    CACHED_CATEGORIES_STORE,
  ];
}

// Initialize IndexedDB
export async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Existing stores
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(SHOPIFY_STORE_NAME)) {
        const store = database.createObjectStore(SHOPIFY_STORE_NAME, { keyPath: "id" });
        store.createIndex("title", "title", { unique: false });
      }

      // New delivery-related stores
      if (!database.objectStoreNames.contains(PENDING_DELIVERIES_STORE)) {
        const store = database.createObjectStore(PENDING_DELIVERIES_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("locationId", "locationId", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }

      if (!database.objectStoreNames.contains(PENDING_DELIVERY_UPDATES_STORE)) {
        const store = database.createObjectStore(PENDING_DELIVERY_UPDATES_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("deliveryId", "deliveryId", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }

      if (!database.objectStoreNames.contains(CACHED_CATEGORIES_STORE)) {
        const store = database.createObjectStore(CACHED_CATEGORIES_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("locationId", "locationId", { unique: true });
      }
    };
  });
}

// Save pending sale to IndexedDB
export async function savePendingSale(saleData) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add({
      ...saleData,
      savedAt: new Date().toISOString(),
      retryCount: 0,
      lastError: null,
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Get all pending sales
export async function getPendingSales() {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Get pending sale by ID
export async function getPendingSaleById(id) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Update pending sale (increment retry count, update error)
export async function updatePendingSale(id, updates) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const sale = getRequest.result;
      const updateRequest = store.put({
        ...sale,
        ...updates,
        retryCount: (sale.retryCount || 0) + 1,
      });

      updateRequest.onerror = () => reject(updateRequest.error);
      updateRequest.onsuccess = () => resolve(updateRequest.result);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Delete pending sale
export async function deletePendingSale(id) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Clear all pending sales
export async function clearPendingSales() {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get count of pending sales
export async function getPendingSalesCount() {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.count();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// ===== DELIVERY FUNCTIONS =====

// Save pending delivery to IndexedDB
export async function savePendingDelivery(deliveryData) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERIES_STORE], "readwrite");
    const store = transaction.objectStore(PENDING_DELIVERIES_STORE);
    const request = store.add({
      ...deliveryData,
      savedAt: new Date().toISOString(),
      syncedAt: null,
      retryCount: 0,
      lastError: null,
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Get all pending deliveries
export async function getPendingDeliveries(locationId = null) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERIES_STORE], "readonly");
    const store = transaction.objectStore(PENDING_DELIVERIES_STORE);
    const index = store.index("locationId");

    let request;
    if (locationId) {
      request = index.getAll(locationId);
    } else {
      request = store.getAll();
    }

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      // Filter to unsync edigered only
      resolve(results.filter((d) => !d.syncedAt));
    };
  });
}

// Get pending delivery by ID
export async function getPendingDeliveryById(id) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERIES_STORE], "readonly");
    const store = transaction.objectStore(PENDING_DELIVERIES_STORE);
    const request = store.get(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Update pending delivery
export async function updatePendingDelivery(id, updates) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERIES_STORE], "readwrite");
    const store = transaction.objectStore(PENDING_DELIVERIES_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const delivery = getRequest.result;
      if (!delivery) return reject(new Error("Delivery not found"));

      const updateRequest = store.put({
        ...delivery,
        ...updates,
        retryCount: (delivery.retryCount || 0) + 1,
      });

      updateRequest.onerror = () => reject(updateRequest.error);
      updateRequest.onsuccess = () => resolve(updateRequest.result);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Mark delivery as synced (keeps it in DB for reference)
export async function markDeliveryAsSynced(id, serverId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERIES_STORE], "readwrite");
    const store = transaction.objectStore(PENDING_DELIVERIES_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const delivery = getRequest.result;
      const updateRequest = store.put({
        ...delivery,
        syncedAt: new Date().toISOString(),
        serverId,
        retryCount: 0,
        lastError: null,
      });

      updateRequest.onerror = () => reject(updateRequest.error);
      updateRequest.onsuccess = () => resolve(updateRequest.result);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Delete pending delivery
export async function deletePendingDelivery(id) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERIES_STORE], "readwrite");
    const store = transaction.objectStore(PENDING_DELIVERIES_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// Get count of pending deliveries
export async function getPendingDeliveriesCount(locationId = null) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERIES_STORE], "readonly");
    const store = transaction.objectStore(PENDING_DELIVERIES_STORE);

    let request;
    if (locationId) {
      const index = store.index("locationId");
      request = index.count(locationId);
    } else {
      request = store.count();
    }

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      // Count only unsynced deliveries
      resolve(request.result);
    };
  });
}

// ===== DELIVERY UPDATES (STATUS CHANGES) =====

// Save pending delivery update (status change, etc.)
export async function savePendingDeliveryUpdate(deliveryId, updateData) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERY_UPDATES_STORE], "readwrite");
    const store = transaction.objectStore(PENDING_DELIVERY_UPDATES_STORE);
    const request = store.add({
      deliveryId,
      ...updateData,
      savedAt: new Date().toISOString(),
      syncedAt: null,
      retryCount: 0,
      lastError: null,
    });

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Get pending delivery updates for a specific delivery
export async function getPendingDeliveryUpdates(deliveryId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERY_UPDATES_STORE], "readonly");
    const store = transaction.objectStore(PENDING_DELIVERY_UPDATES_STORE);
    const index = store.index("deliveryId");
    const request = index.getAll(deliveryId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      // Filter to unsynced only
      resolve(results.filter((u) => !u.syncedAt));
    };
  });
}

// Get all un synced delivery updates
export async function getAllPendingDeliveryUpdates() {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERY_UPDATES_STORE], "readonly");
    const store = transaction.objectStore(PENDING_DELIVERY_UPDATES_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      // Filter to unsynced only
      resolve(results.filter((u) => !u.syncedAt));
    };
  });
}

// Mark delivery update as synced
export async function markDeliveryUpdateAsSynced(id) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERY_UPDATES_STORE], "readwrite");
    const store = transaction.objectStore(PENDING_DELIVERY_UPDATES_STORE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const update = getRequest.result;
      const updateRequest = store.put({
        ...update,
        syncedAt: new Date().toISOString(),
        retryCount: 0,
        lastError: null,
      });

      updateRequest.onerror = () => reject(updateRequest.error);
      updateRequest.onsuccess = () => resolve(updateRequest.result);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Delete pending delivery update
export async function deletePendingDeliveryUpdate(id) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERY_UPDATES_STORE], "readwrite");
    const store = transaction.objectStore(PENDING_DELIVERY_UPDATES_STORE);
    const request = store.delete(id);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

// ===== CACHED CATEGORIES =====

// Cache delivery categories for a location (offline access)
export async function cacheDeliveryCategories(locationId, categories) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CACHED_CATEGORIES_STORE], "readwrite");
    const store = transaction.objectStore(CACHED_CATEGORIES_STORE);
    const index = store.index("locationId");
    const getRequest = index.get(locationId);

    getRequest.onsuccess = () => {
      const existing = getRequest.result;
      const request = store.put({
        ...(existing || {}),
        locationId,
        categories,
        cachedAt: new Date().toISOString(),
      });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

// Get cached categories for a location
export async function getCachedCategories(locationId) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CACHED_CATEGORIES_STORE], "readonly");
    const store = transaction.objectStore(CACHED_CATEGORIES_STORE);
    const index = store.index("locationId");
    const request = index.get(locationId);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const result = request.result;
      resolve(result?.categories || []);
    };
  });
}

// Clear cached categories
export async function clearCachedCategories(locationId = null) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CACHED_CATEGORIES_STORE], "readwrite");
    const store = transaction.objectStore(CACHED_CATEGORIES_STORE);

    if (locationId) {
      const index = store.index("locationId");
      const request = index.openCursor(locationId);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    } else {
      const request = store.clear();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    }
  });
}

// Edit-distance (Levenshtein) algorithm for fuzzy search scoring
function editDistance(a, b) {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const m = aLower.length, n = bLower.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = aLower[i - 1] === bLower[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Calculate fuzzy match score (lower distance = higher score)
function calculateFuzzyScore(query, text) {
  const distance = editDistance(query, text);
  const maxLen = Math.max(query.length, text.length);
  return 1 - (distance / maxLen);
}

// Check if query is a prefix of any word in the text (for multi-word product names)
function hasWordPrefixMatch(query, text) {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  
  // Split on whitespace and common delimiters
  const words = lowerText.split(/[\s-_,]+/);
  
  // Check if any word starts with the query
  return words.some(word => word.startsWith(lowerQuery));
}

// Set Shopify products in cache (clears old data)
export async function setShopifyProducts(products) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SHOPIFY_STORE_NAME], "readwrite");
    const store = transaction.objectStore(SHOPIFY_STORE_NAME);
    store.clear();
    for (const product of products) {
      store.add({
        id: product.id,
        title: product.title,
        descriptionHtml: product.descriptionHtml,
        vendor: product.vendor,
        productType: product.productType,
        status: product.status,
        totalInventory: product.totalInventory,
        variants: product.variants?.edges?.map(e => ({
          id: e.node.id,
          title: e.node.title,
          sku: e.node.sku,
          price: parseFloat(e.node.price),
          inventoryQuantity: e.node.inventoryQuantity,
          inventoryItemId: e.node.inventoryItem?.id,
        })) || [],
        images: product.images?.edges?.map(e => ({
          url: e.node.url,
          altText: e.node.altText,
        })) || [],
        savedAt: new Date().toISOString(),
      });
    }
    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

// Get all Shopify products from cache
export async function getShopifyProducts() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SHOPIFY_STORE_NAME], "readonly");
    const store = transaction.objectStore(SHOPIFY_STORE_NAME);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

/**
 * Search Shopify products by title (fuzzy) and SKU (exact match)
 * @param {string} query - Search query
 * @param {number} limit - Max results to return
 * @returns {Promise<Array>} - Matching products sorted by score
 */
export async function searchShopifyProducts(query = "", limit = 50) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SHOPIFY_STORE_NAME], "readonly");
    const store = transaction.objectStore(SHOPIFY_STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const allProducts = request.result || [];
      
      if (!query.trim()) {
        return resolve(allProducts.slice(0, limit));
      }

      const lowerQuery = query.toLowerCase().trim();
      const results = [];

      for (const product of allProducts) {
        let matchScore = 0;
        let matchType = null;

        // Check word prefix match (e.g., "flann" matches "Flannel Shirt")
        if (hasWordPrefixMatch(lowerQuery, product.title)) {
          matchScore = 0.85;
          matchType = "word-prefix";
        }

        // Check title fuzzy match (fallback for typos)
        const titleScore = calculateFuzzyScore(lowerQuery, product.title.toLowerCase());
        if (titleScore > 0.3) {
          matchScore = Math.max(matchScore, titleScore);
          matchType = matchType || "title";
        }

        // Check SKU exact/partial match (higher priority)
        if (product.variants && product.variants.length > 0) {
          for (const variant of product.variants) {
            if (variant.sku) {
              const variantSku = variant.sku.toLowerCase();
              
              // Exact match gets highest score
              if (variantSku === lowerQuery) {
                matchScore = 1.0;
                matchType = "sku-exact";
                break;
              }
              
              // Partial match (starts with)
              if (variantSku.startsWith(lowerQuery)) {
                matchScore = Math.max(matchScore, 0.9);
                matchType = "sku-partial";
              }
              
              // Contains match
              if (variantSku.includes(lowerQuery)) {
                matchScore = Math.max(matchScore, 0.7);
                matchType = matchType || "sku-contains";
              }
            }
          }
        }

        if (matchScore > 0) {
          results.push({ ...product, _matchScore: matchScore, _matchType: matchType });
        }
      }

      // Sort by score (highest first)
      results.sort((a, b) => b._matchScore - a._matchScore);

      resolve(results.slice(0, limit));
    };
  });
}

// Clear all Shopify products from cache
export async function clearShopifyProducts() {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SHOPIFY_STORE_NAME], "readwrite");
    const store = transaction.objectStore(SHOPIFY_STORE_NAME);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clearAllIndexedDbData() {
  if (typeof indexedDB === "undefined") return;
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(getStoreNames(), "readwrite");

    transaction.onerror = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();

    for (const storeName of getStoreNames()) {
      transaction.objectStore(storeName).clear();
    }
  });
}

export async function deleteFlexiPosDatabase() {
  if (typeof indexedDB === "undefined") return false;

  if (db) {
    db.close();
    db = null;
  }

  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);

    request.onsuccess = () => resolve(true);
    request.onerror = () => {
      console.warn("Failed to delete IndexedDB database", request.error);
      resolve(false);
    };
    request.onblocked = () => {
      console.warn("IndexedDB deletion was blocked; falling back to clearing stores");
      resolve(false);
    };
  });
}
