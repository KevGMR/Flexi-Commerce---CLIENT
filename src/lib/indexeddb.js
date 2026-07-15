// IndexedDB utility for storing pending sales and deliveries when offline
const DB_NAME = "FLEXI_POS";
const DB_VERSION = 4; // Incremented to add idempotencyKey index
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
      
      // === Pending Sales Store (keyPath: "id", autoIncrement) ===
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        // Add index for idempotencyKey (used for delete and lookup)
        store.createIndex("idempotencyKey", "idempotencyKey", { unique: false });
      } else {
        // For existing store, add index if missing
        const store = event.target.transaction.objectStore(STORE_NAME);
        if (!store.indexNames.contains("idempotencyKey")) {
          store.createIndex("idempotencyKey", "idempotencyKey", { unique: false });
        }
      }

      // === Shopify Products Store ===
      if (!database.objectStoreNames.contains(SHOPIFY_STORE_NAME)) {
        const store = database.createObjectStore(SHOPIFY_STORE_NAME, { keyPath: "id" });
        store.createIndex("title", "title", { unique: false });
      }

      // === Pending Deliveries Store ===
      if (!database.objectStoreNames.contains(PENDING_DELIVERIES_STORE)) {
        const store = database.createObjectStore(PENDING_DELIVERIES_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("locationId", "locationId", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("savedAt", "savedAt", { unique: false });
      }

      // === Pending Delivery Updates Store ===
      if (!database.objectStoreNames.contains(PENDING_DELIVERY_UPDATES_STORE)) {
        const store = database.createObjectStore(PENDING_DELIVERY_UPDATES_STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("deliveryId", "deliveryId", { unique: false });
        store.createIndex("type", "type", { unique: false });
      }

      // === Cached Categories Store ===
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

  // Ensure the sale has a status (default to "pending")
  if (!saleData.status) saleData.status = "pending";

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

// Get pending sale by ID (auto-increment id)
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

// Get pending sale by idempotencyKey
export async function getPendingSaleByIdempotencyKey(idempotencyKey) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("idempotencyKey");
    const request = index.get(idempotencyKey);

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

// Delete pending sale by idempotencyKey
export async function deletePendingSale(idempotencyKey) {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("idempotencyKey");
    const getRequest = index.get(idempotencyKey);

    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record) {
        // If not found, try to find by auto-increment id (backward compatibility)
        const id = parseInt(idempotencyKey, 10);
        if (!isNaN(id)) {
          const deleteByIdRequest = store.delete(id);
          deleteByIdRequest.onerror = () => reject(deleteByIdRequest.error);
          deleteByIdRequest.onsuccess = () => resolve();
        } else {
          resolve(); // nothing to delete
        }
        return;
      }
      const deleteRequest = store.delete(record.id);
      deleteRequest.onerror = () => reject(deleteRequest.error);
      deleteRequest.onsuccess = () => resolve();
    };

    getRequest.onerror = () => reject(getRequest.error);
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
// (unchanged - kept as-is)
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
      resolve(results.filter((d) => !d.syncedAt));
    };
  });
}

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
    request.onsuccess = () => resolve(request.result);
  });
}

// ===== DELIVERY UPDATES (STATUS CHANGES) =====
// (unchanged - kept as-is)
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
      resolve(results.filter((u) => !u.syncedAt));
    };
  });
}

export async function getAllPendingDeliveryUpdates() {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PENDING_DELIVERY_UPDATES_STORE], "readonly");
    const store = transaction.objectStore(PENDING_DELIVERY_UPDATES_STORE);
    const request = store.getAll();

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const results = request.result || [];
      resolve(results.filter((u) => !u.syncedAt));
    };
  });
}

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
// (unchanged - kept as-is)
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

function calculateFuzzyScore(query, text) {
  const distance = editDistance(query, text);
  const maxLen = Math.max(query.length, text.length);
  return 1 - (distance / maxLen);
}

function hasWordPrefixMatch(query, text) {
  const lowerQuery = query.toLowerCase();
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/[\s-_,]+/);
  return words.some(word => word.startsWith(lowerQuery));
}

// Shopify product functions (unchanged)
export async function setShopifyProducts(products) {
  console.log("[setShopifyProducts] Called with", products?.length, "products, db exists:", !!db);
  if (!db) {
    console.log("[setShopifyProducts] DB not initialized, initializing...");
    await initDB();
    console.log("[setShopifyProducts] DB initialized, db:", !!db);
  }
  return new Promise((resolve, reject) => {
    console.log("[setShopifyProducts] Creating transaction for store:", SHOPIFY_STORE_NAME);
    const transaction = db.transaction([SHOPIFY_STORE_NAME], "readwrite");
    const store = transaction.objectStore(SHOPIFY_STORE_NAME);
    
    const clearRequest = store.clear();
    
    clearRequest.onerror = () => {
      console.error("[setShopifyProducts] Failed to clear store:", clearRequest.error);
      reject(clearRequest.error);
    };
    
    clearRequest.onsuccess = () => {
      console.log("[setShopifyProducts] Cleared store, now adding", products.length, "products");
      
      let addCount = 0;
      let hasError = false;
      
      if (products.length === 0) {
        console.log("[setShopifyProducts] No products to add");
      }
      
      for (const product of products) {
        console.log("[setShopifyProducts] Adding product", product.id, "title:", product.title);
        const addRequest = store.put({
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
        
        addRequest.onerror = () => {
          console.error("[setShopifyProducts] Failed to add product", product.id, ":", addRequest.error);
          hasError = true;
        };
        
        addRequest.onsuccess = () => {
          addCount++;
          console.log("[setShopifyProducts] Added product", product.id, `(${addCount}/${products.length})`);
          if (addCount === products.length && hasError) {
            console.warn(`[setShopifyProducts] Added ${addCount} products with some errors`);
          }
        };
      }
    };
    
    transaction.onerror = () => {
      console.error("[setShopifyProducts] Transaction error:", transaction.error);
      reject(transaction.error);
    };
    
    transaction.oncomplete = () => {
      console.log("[setShopifyProducts] Transaction complete! Saved Shopify products.");
      resolve();
    };
  });
}

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

export async function searchShopifyProducts(query = "", limit = 50) {
  console.log("[searchShopifyProducts] Called with query:", query, "limit:", limit, "db exists:", !!db);
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SHOPIFY_STORE_NAME], "readonly");
    const store = transaction.objectStore(SHOPIFY_STORE_NAME);
    const request = store.getAll();
    
    request.onerror = () => {
      console.error("[searchShopifyProducts] Error retrieving products:", request.error);
      reject(request.error);
    };
    request.onsuccess = () => {
      const allProducts = request.result || [];
      console.log("[searchShopifyProducts] Retrieved", allProducts.length, "products from store");
      
      if (!query.trim()) {
        console.log("[searchShopifyProducts] No query, returning first", Math.min(limit, allProducts.length), "products");
        return resolve(allProducts.slice(0, limit));
      }

      const lowerQuery = query.toLowerCase().trim();
      const results = [];

      for (const product of allProducts) {
        let matchScore = 0;
        let matchType = null;

        if (hasWordPrefixMatch(lowerQuery, product.title)) {
          matchScore = 0.85;
          matchType = "word-prefix";
        }

        const titleScore = calculateFuzzyScore(lowerQuery, product.title.toLowerCase());
        if (titleScore > 0.3) {
          matchScore = Math.max(matchScore, titleScore);
          matchType = matchType || "title";
        }

        if (product.variants && product.variants.length > 0) {
          for (const variant of product.variants) {
            if (variant.sku) {
              const variantSku = variant.sku.toLowerCase();
              if (variantSku === lowerQuery) {
                matchScore = 1.0;
                matchType = "sku-exact";
                break;
              }
              if (variantSku.startsWith(lowerQuery)) {
                matchScore = Math.max(matchScore, 0.9);
                matchType = "sku-partial";
              }
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

      results.sort((a, b) => b._matchScore - a._matchScore);
      
      console.log("[searchShopifyProducts] Found", results.length, "matching products for query:", query);
      resolve(results.slice(0, limit));
    };
  });
}

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