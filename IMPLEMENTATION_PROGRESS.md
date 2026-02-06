# POS System Implementation Progress

## ✅ Completed: Phase 1 - Offline Support & Sync Foundation

### 1. IndexedDB Utility (src/lib/indexeddb.js)
- **Status**: ✅ Complete
- **Features**:
  - Database: `FLEXI_POS`
  - Store: `pending_sales` with fields: id, saleData, savedAt, retryCount, lastError
  - CRUD operations: `savePendingSale`, `getPendingSales`, `getPendingSaleById`, `updatePendingSale`, `deletePendingSale`, `clearPendingSales`, `getPendingSalesCount`
  - Used for storing sales when offline

### 2. Sync Manager Hook (src/hooks/useSyncManager.js)
- **Status**: ✅ Complete
- **Features**:
  - `isOnline` - tracks navigator.onLine status
  - `pendingSalesCount` - real-time count of pending sales from IndexedDB
  - `isRetrying` - loading state during sync
  - `isReconnectingShopify` - UI feedback during reconnection
  - `retrySyncPendingSales()` - auto-retry all pending sales when coming online (unlimited retries)
  - `retrySingleSale()` - manual retry of individual pending sales
  - `updatePendingCount()` - refresh pending count
  - Auto-detects online/offline status via window.onLine events

### 3. Topbar Enhancement (src/components/Topbar.js)
- **Status**: ✅ Complete
- **Features**:
  - Online/offline indicator (green dot when online, red when offline)
  - Pending sales badge showing count (only when pending sales exist or offline)
  - Status text displays beside org selector
  - Hydration guard to prevent SSR issues
  - Auto-updates when sync manager detects online status change

### 4. Settings Panel - Shopify Integration (src/app/dashboard/settings/page.js)
- **Status**: ✅ Complete
- **Features**:
  - **Shopify Connection**:
    - Form to connect Shopify store (storeName, storeUrl, clientId, clientSecret)
    - POST `/shopify/connect` endpoint integration
    - Connection status display (green badge when connected)
    - Disconnect button with confirmation
    - POST `/shopify/disconnect` endpoint integration
  - **Location Mapping** (placeholder ready for UI):
    - Fetches available Shopify locations from `/locations/shopify/available-locations`
    - Maps store locations to Shopify locations via POST `/locations/:id/set-shopify-location`
  - **Offline Detection**:
    - Form disabled when offline with yellow warning
    - Cannot change Shopify settings without connection
  - **Error/Success Messaging**:
    - Success messages on connection/disconnection
    - Error messages for failed operations
    - API integration with proper headers (Authorization, X-Device-ID, X-Device-Name, X-Organization-Slug)

### 5. POS Page Enhancement (src/app/dashboard/sales-channels/pos/page.js)
- **Status**: ✅ Complete
- **Features**:
  - **Offline Support**:
    - Red alert when offline with explanation
    - Sales automatically saved to IndexedDB if offline or server error
    - Success message: "Sale saved offline. Will sync when online."
  - **Pending Sales Management**:
    - Shows count of pending sales waiting to sync
    - Expandable details view with "Show/Hide Details" button
    - Each pending sale displays: item count, location, save time, last error
    - **Manual retry button** for each pending sale (only shown when online)
    - Auto-retry when coming back online (via useSyncManager)
  - **Blue "Reconnecting..." Alert**:
    - Displays when isReconnectingShopify is true
    - User sees feedback that app is syncing pending sales
  - **Product Tabs**:
    - Toggle between FLEXI Products and Shopify Products
    - Tab changes placeholder text in variant field
    - Add item button respects current tab selection
  - **Existing Features**:
    - Split payment support maintained
    - Form validation
    - Status and error messages
    - Location ID, notes, items, and payment methods

## 🔄 Architecture Overview

### Data Flow - Offline Sale Submission:
1. User fills POS form and submits
2. App attempts POST /sales
3. **If offline or 503 error**:
   - Save payload to IndexedDB pending_sales store
   - Show "Sale saved offline" message
   - Reset form
4. **When online**:
   - useSyncManager detects online event
   - Auto-triggers retrySyncPendingSales()
   - For each pending sale, retry POST /sales
   - On success: delete from IndexedDB
   - On failure: update lastError in IndexedDB
   - User sees "Reconnecting to Shopify..." alert
5. **Manual Retry**:
   - User clicks "Retry" on specific pending sale
   - Calls retrySingleSale()
   - On success: removes from pending list
   - On failure: updates error message

### API Endpoints Used:
- **Sales**: POST /sales (submit sales, with fallback to IndexedDB)
- **Shopify**: 
  - POST /shopify/connect (connect store)
  - POST /shopify/disconnect (disconnect store)
  - GET /shopify/products?page=... (fetch products - ready for implementation)
  - GET /shopify/sync-logs (poll sync status - ready for implementation)
- **Locations**:
  - GET /locations/shopify/available-locations?organizationId=... (fetch Shopify locations)
  - POST /locations/:id/set-shopify-location (map location)

### Request Headers (All API Calls):
```javascript
{
  "Authorization": `Bearer ${accessToken}`,
  "X-Device-ID": deviceId || "",
  "X-Device-Name": deviceName || "",
  "X-Organization-Slug": organizationSlug || "",
  "Content-Type": "application/json" // for POST/PUT
}
```

## 📋 Implementation Checklist

### Phase 1: Foundation ✅
- [x] IndexedDB utility for offline sales storage
- [x] Sync manager hook for online/offline detection and retry logic
- [x] Topbar: Online status indicator + pending sales badge
- [x] Settings: Shopify connection & location mapping panel
- [x] POS: Offline support + pending sales management + product tabs
- [x] Auto-retry: Unlimited retries on reconnect with user feedback
- [x] Manual retry: Per-sale retry buttons
- [x] Error tracking: lastError stored in IndexedDB for each pending sale

### Phase 2: Ready for Implementation (Next Steps)
- [ ] Shopify Product Catalog UI
  - Display FLEXI products (from API endpoint - needs backend implementation)
  - Display Shopify products (paginated from `/shopify/products`)
  - Search/filter for both product types
  - Integration into POS form as quick-add buttons or autocomplete
- [ ] Inventory Sync
  - Polling logic in useSyncManager for `/shopify/sync-logs`
  - Status display in Topbar or Settings
  - Last sync timestamp
- [ ] Location Mapping UI
  - Dropdown to select Shopify location for each store location
  - Visual status indicators
  - Save/cancel buttons
- [ ] Advanced Offline Features
  - Sync priority (retry older sales first)
  - Batch sync instead of sequential
  - Sync history/log viewer
  - Conflict resolution for failed syncs

## 🎯 User Experience Flow

### Scenario 1: Online, Normal Sale
1. User opens POS page (green "Online" indicator in topbar)
2. Fills form and submits
3. Sale created immediately: "Sale created: ABC123"
4. Form resets, user ready for next sale

### Scenario 2: Goes Offline, Submits Sale
1. User has internet, then loses connection
2. Topbar shows red "Offline" dot
3. User creates and submits sale
4. App saves to IndexedDB: "Sale saved offline. Will sync when online."
5. Pending sales badge shows "1 Pending" in topbar
6. Form resets for next sale

### Scenario 3: Comes Back Online
1. Internet reconnects
2. Topbar shows "Reconnecting to Shopify..." alert
3. useSyncManager auto-retries all pending sales
4. Sales sync successfully to backend
5. Alert disappears, pending count returns to 0
6. No user action needed

### Scenario 4: Manual Retry
1. User has pending sales stuck (network error)
2. User clicks "Retry" on specific pending sale
3. App retries that sale to backend
4. On success: sale removed from pending list
5. On failure: error message updated, user can retry again later

### Scenario 5: Shopify Settings
1. User navigates to Settings
2. Enters Shopify store credentials (storeName, storeUrl, clientId, clientSecret)
3. Clicks "Connect Shopify"
4. On success: "Shopify store connected successfully!"
5. Location mapping section appears
6. User can map store locations to Shopify locations

## 🔧 Testing Checklist

### Basic Functionality
- [ ] Topbar shows correct online/offline status
- [ ] Pending sales badge appears when offline sales exist
- [ ] Offline alert shows when no internet
- [ ] Settings form accepts Shopify credentials
- [ ] POS form submits when online
- [ ] POS form saves to IndexedDB when offline
- [ ] Product tabs toggle correctly
- [ ] Manual retry button works for pending sales

### Edge Cases
- [ ] No pending sales - badge doesn't show
- [ ] Multiple pending sales - all count displayed
- [ ] Network interrupt mid-submission - saved to IndexedDB
- [ ] Server returns 503 - treated as offline, saved to IndexedDB
- [ ] Browser refresh with pending sales - persisted across page reload
- [ ] IndexedDB quota exceeded - handle gracefully
- [ ] Shopify disconnect while offline - settings disabled
- [ ] Switch from FLEXI to Shopify tab - items use correct type

### Performance
- [ ] Topbar updates smoothly on online/offline change
- [ ] Pending sales list doesn't cause lag with many items
- [ ] Auto-retry doesn't block UI
- [ ] Sync manager doesn't re-trigger infinite loops

## 📝 Code Quality
- All components use proper error handling
- Loading states prevent duplicate submissions
- Hydration guards prevent SSR issues
- API headers consistently applied
- IndexedDB transactions properly closed
- Event listeners properly cleaned up in useEffect

## 🚀 Next Priorities
1. **Product Catalog UI** - Browse and quick-add FLEXI/Shopify products to POS
2. **Inventory Sync** - Poll Shopify sync status and display in UI
3. **Location Mapping UI** - Visual mapping interface in Settings
4. **Advanced Offline** - Batch sync, priority retry, conflict resolution
5. **Sync History** - View all past and current sync operations
