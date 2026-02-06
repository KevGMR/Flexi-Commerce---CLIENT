// IndexedDB utility for storing pending sales when offline
const DB_NAME = "FLEXI_POS";
const DB_VERSION = 2;
const STORE_NAME = "pending_sales";
const SHOPIFY_STORE_NAME = "shopify_products";

let db = null;

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
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
      }
      if (!database.objectStoreNames.contains(SHOPIFY_STORE_NAME)) {
        const store = database.createObjectStore(SHOPIFY_STORE_NAME, { keyPath: "id" });
        store.createIndex("title", "title", { unique: false });
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

        // Check title fuzzy match
        const titleScore = calculateFuzzyScore(lowerQuery, product.title.toLowerCase());
        if (titleScore > 0.3) {
          matchScore = titleScore;
          matchType = "title";
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
