# FLEXI-POS Integration Testing & Verification Guide

## Pre-Launch Verification Checklist

### 1. File Structure Verification ✅
```
src/
├── hooks/
│   └── useSyncManager.js ✅ CREATED
├── lib/
│   └── indexeddb.js ✅ CREATED
├── components/
│   └── Topbar.js ✅ MODIFIED
└── app/
    └── dashboard/
        ├── settings/
        │   └── page.js ✅ MODIFIED
        └── sales-channels/
            └── pos/
                └── page.js ✅ MODIFIED

Root:
├── IMPLEMENTATION_PROGRESS.md ✅ CREATED
└── OFFLINE_SYNC_GUIDE.md ✅ CREATED
```

### 2. Import Dependencies Verification

**useSyncManager.js imports:**
- ✅ React hooks (useEffect, useState, useCallback)
- ✅ indexeddb functions (getPendingSales, deletePendingSale, updatePendingSale)

**Topbar.js imports:**
- ✅ React hooks (useEffect, useState)
- ✅ Existing imports (fetchMyOrganizations, switchOrganization, useSessionStore)
- ✅ New: useSyncManager hook

**Settings page imports:**
- ✅ React hooks (useState, useEffect)
- ✅ useSessionStore
- ✅ useSyncManager
- ✅ Placeholder component

**POS page imports:**
- ✅ React hooks (useState, useEffect)
- ✅ apiFetch
- ✅ buildSaleIdempotencyKey
- ✅ NEW: savePendingSale, getPendingSales from indexeddb
- ✅ NEW: useSyncManager hook
- ✅ Placeholder component
- ✅ useSessionStore

### 3. Component State Management Verification

**useSyncManager Hook:**
- ✅ Tracks isOnline via window.onLine
- ✅ Tracks pendingSalesCount from IndexedDB
- ✅ Tracks isRetrying state
- ✅ Tracks isReconnectingShopify state
- ✅ Provides updatePendingCount callback
- ✅ Provides retrySyncPendingSales callback
- ✅ Provides retrySingleSale callback
- ✅ Cleans up event listeners on unmount

**Topbar Component:**
- ✅ Hydration guard (isMounted state)
- ✅ Displays online/offline indicator
- ✅ Displays pending sales count (conditional)
- ✅ Preserves existing org selector and logout button

**Settings Component:**
- ✅ Shopify form state (storeName, storeUrl, clientId, clientSecret)
- ✅ Location mapping state
- ✅ Connection status detection (GET /locations/shopify/available-locations)
- ✅ Error/message state for feedback
- ✅ Loading state during operations
- ✅ Offline detection to disable form

**POS Component:**
- ✅ Product tab state (flexi/shopify)
- ✅ Pending sales visibility toggle
- ✅ Pending sales list loaded from IndexedDB
- ✅ Auto-retry on online detection
- ✅ Form state (location, items, payments, notes)
- ✅ Status/error messages

## Integration Testing Guide

### Test 1: Online Status Indicator
**Steps:**
1. Open app in browser
2. Open DevTools (F12)
3. Check Topbar - should show green dot and "Online"
4. Go to Network tab → Offline
5. Reload page (or wait for refresh)
6. Check Topbar - should show red dot and "Offline"
7. Disable Offline mode
8. Check Topbar - should show green dot and "Online" again

**Expected Result:** ✅ Indicator updates correctly

### Test 2: Settings Shopify Connection
**Steps:**
1. Navigate to Settings page
2. See Shopify Integration section
3. Verify form has 4 fields: Store Name, Store URL, Client ID, Secret
4. Enter valid Shopify credentials (or use test creds)
5. Click "Connect Shopify"
6. Check API headers in Network tab:
   - Authorization: Bearer [token]
   - X-Device-ID: [deviceId]
   - X-Device-Name: [deviceName]
   - X-Organization-Slug: [slug]
7. On success: Green badge "✓ Shopify store connected"
8. Click "Disconnect Shopify"
9. Confirm disconnection

**Expected Result:** ✅ Settings panel connects/disconnects successfully

### Test 3: POS Online Sale Submission
**Steps:**
1. Navigate to POS page
2. Verify topbar shows "Online"
3. Fill form:
   - Location ID: test-location-1
   - Add item: variant=TEST-SKU-1, type=flexi, qty=1
   - Add payment: cash, amount=100
4. Click "Submit sale"
5. Check Network tab - POST /sales request sent
6. Check headers (same as Test 2)
7. See success message: "Sale created: ABC123"
8. Form should reset

**Expected Result:** ✅ Online sale submits successfully

### Test 4: POS Offline Sale Fallback
**Steps:**
1. Navigate to POS page
2. DevTools → Network → Offline
3. Reload page
4. Verify topbar shows red "Offline" dot
5. See red banner: "You are offline. Sales will be saved locally and synced when online."
6. Fill form (same as Test 3)
7. Click "Submit sale"
8. See status message: "Sale saved offline. Will sync when online."
9. Form resets
10. Check Topbar - should show "1 Pending" badge
11. Click badge area to expand pending sales
12. See pending sale listed with save time, items, location

**Expected Result:** ✅ Sale saved to IndexedDB, pending badge displays

### Test 5: Manual Retry
**Steps:**
1. Continue from Test 4 (offline with pending sale)
2. Expand "Pending sales" section (click "Show Details")
3. See pending sale with "Retry" button (should be disabled - offline)
4. Go back Online (DevTools → Network → Online)
5. "Retry" button should become enabled
6. Click "Retry"
7. See "Reconnecting to Shopify and syncing pending sales..." alert
8. Network tab shows POST /sales request
9. On success: Sale disappears from pending list, count → 0
10. See success message

**Expected Result:** ✅ Manual retry works when online

### Test 6: Auto-Retry on Reconnect
**Steps:**
1. Create pending sale while offline (Test 4)
2. Keep POS page open
3. DevTools → Network → Online
4. Within 2 seconds, see "Reconnecting to Shopify..." blue alert
5. Pending sale automatically retries
6. Network tab shows POST /sales request
7. On success: Alert disappears, pending count → 0
8. No user action needed

**Expected Result:** ✅ Auto-retry triggers automatically on reconnect

### Test 7: Product Tabs in POS
**Steps:**
1. Navigate to POS page
2. See two tabs: "FLEXI Products" and "Shopify Products"
3. "FLEXI Products" tab active by default
4. Click "Shopify Products" tab
5. Tab styling changes (underline moves)
6. Click "+ Add item"
7. New item row has type="shopify" by default
8. Click back to "FLEXI Products"
9. Click "+ Add item" again
10. New item has type="flexi" by default

**Expected Result:** ✅ Product tabs work correctly

### Test 8: Browser Refresh with Pending Sales
**Steps:**
1. Create pending sale while offline
2. See pending sales count in topbar
3. Hard refresh page (Ctrl+F5)
4. Wait for page load
5. Check Topbar - pending count still shows
6. Navigate to POS
7. Expand pending sales
8. All pending sales still visible

**Expected Result:** ✅ Pending sales persist across refresh

### Test 9: Settings Disabled When Offline
**Steps:**
1. Navigate to Settings
2. DevTools → Network → Offline
3. Reload page
4. See yellow warning: "You are offline. Shopify settings cannot be changed right now."
5. Form should still be visible but fields disabled
6. "Connect Shopify" button disabled
7. Go back online
8. Warning disappears
9. Form fields enabled
10. Button clickable again

**Expected Result:** ✅ Settings properly restrict offline actions

### Test 10: Offline Mode with Network Errors
**Steps:**
1. Keep app Online
2. Create sale with valid data
3. Simulate network error:
   - DevTools → Network → Throttle → 3G Slow
   - Or simulate server error (backend returns 503)
4. Click "Submit sale"
5. Request times out or fails with 503
6. See error/offline response
7. Check if sale saved to IndexedDB OR error message shown
8. If saved: pending count shows, can retry later

**Expected Result:** ✅ Handles network errors gracefully

## Error Scenarios to Test

| Scenario | Action | Expected |
|----------|--------|----------|
| No internet | Fill form, submit | Saved to IndexedDB |
| Server returns 503 | Submit sale online | Saved to IndexedDB as fallback |
| Shopify API error | Connect/disconnect | Error message shown |
| IndexedDB quota full | Many pending sales | Graceful error handling |
| Lost token (401) | Auto-retry pending | Stop retry, show auth error |
| Invalid location ID | Submit sale | Server validation error |
| Empty required field | Submit | Form validation prevents submit |
| Browser offline mode | Any action | UI disables appropriately |

## API Contract Verification

### POST /sales Request Format
```javascript
{
  locationId: string,
  items: [
    { type: "flexi"|"shopify", variant: string, quantity: number }
  ],
  paymentMethod: "cash"|"card"|"mpesa"|"split",
  payments: [
    { method: "cash"|"card"|"mpesa", amount: number }
  ],
  notes: string (optional),
  idempotencyKey: string
}
```

**Headers:**
```javascript
{
  Authorization: `Bearer ${token}`,
  X-Device-ID: string,
  X-Device-Name: string,
  X-Organization-Slug: string
}
```

### POST /shopify/connect Request
```javascript
{
  organizationId: string,
  storeName: string,
  storeUrl: string,
  clientId: string,
  clientSecret: string
}
```

### GET /locations/shopify/available-locations
Query params: `?organizationId=...`
Response: `[{ id, name, shopifyId }, ...]`

### POST /locations/:id/set-shopify-location
```javascript
{
  organizationId: string,
  shopifyLocationId: string | null
}
```

## Database Verification

### IndexedDB Structure
**Database:** FLEXI_POS
**Store:** pending_sales
**Objects:**
```javascript
{
  id: uuid,
  payload: {
    locationId: string,
    items: [...],
    paymentMethod: string,
    payments: [...],
    notes?: string
  },
  savedAt: timestamp,
  retryCount: number,
  lastError: string | null
}
```

**Verify in DevTools:**
1. Open DevTools
2. Go to Application tab
3. Expand IndexedDB
4. Find FLEXI_POS database
5. Click pending_sales store
6. Should see saved sale objects

## Performance Benchmarks

| Operation | Expected Time | Notes |
|-----------|---------------|-------|
| Save to IndexedDB | <100ms | Fast async operation |
| Load pending sales | <200ms | Multiple reads OK |
| Topbar update | <50ms | Smooth UI update |
| Auto-retry trigger | <1s after online | Debounced |
| Manual retry | <3s (network dep) | Depends on API |

## Success Criteria Checklist

### Core Functionality
- [ ] Online/offline indicator displays correctly
- [ ] Pending sales count shows when sales exist
- [ ] Settings Shopify panel connects/disconnects
- [ ] POS submits sales when online
- [ ] POS saves sales to IndexedDB when offline
- [ ] Pending sales auto-retry on reconnect
- [ ] Pending sales manual retry works
- [ ] Product tabs toggle correctly
- [ ] Pending sales persist across page refresh

### Error Handling
- [ ] Network errors handled gracefully
- [ ] 503 errors fallback to IndexedDB
- [ ] Form validation prevents invalid submissions
- [ ] Settings disabled when offline
- [ ] Retry stops on 401 (token expired)

### User Experience
- [ ] Clear offline/online messaging
- [ ] "Reconnecting..." feedback during sync
- [ ] Pending sales expandable details
- [ ] Success/error messages visible
- [ ] No console errors
- [ ] No 404s in Network tab

### Data Integrity
- [ ] Pending sales have all required fields
- [ ] API headers complete on all requests
- [ ] IndexedDB transactions complete properly
- [ ] No duplicate sales on retry
- [ ] Idempotency keys present on POST /sales

## Launch Readiness Checklist

- [ ] All tests above pass
- [ ] No console errors or warnings
- [ ] No 404s or network errors in DevTools
- [ ] Pending sales sync without duplicates
- [ ] Settings Shopify connection validated
- [ ] Product tabs functional
- [ ] Topbar responsive
- [ ] Mobile layout works (if applicable)
- [ ] Accessibility: keyboard navigation works
- [ ] Code review completed
- [ ] Load testing done (multiple pending sales)
- [ ] Browser compatibility tested (Chrome, Firefox, Safari)

## Troubleshooting Guide

### Issue: Pending sales not showing
**Solution:**
- Check DevTools → Application → IndexedDB → FLEXI_POS → pending_sales
- Verify useSyncManager initializes correctly
- Check console for errors

### Issue: Auto-retry not triggering
**Solution:**
- Verify window.onLine event fires (test in DevTools)
- Check Network tab for POST /sales requests
- Verify API endpoint exists and returns 200

### Issue: Settings form not submitting
**Solution:**
- Check offline mode (should be disabled)
- Verify API endpoint exists (/shopify/connect)
- Check Authorization header in Network tab
- Verify request body in Network tab

### Issue: Topbar pending count wrong
**Solution:**
- Manually refresh pending count: `updatePendingCount()`
- Check IndexedDB for actual count
- Clear IndexedDB and recreate: `clearPendingSales()`

### Issue: Sales not syncing after coming online
**Solution:**
- Check Network tab for POST /sales requests
- Verify Authorization header (token might expired)
- Check API response for errors
- Manually click Retry button on pending sale

## Deployment Notes

- **Environment Variables Needed:**
  - `NEXT_PUBLIC_API_BASE_URL` (used in indexeddb, sync manager, settings, POS)
  
- **Backwards Compatibility:**
  - IndexedDB is additive, no breaking changes
  - Existing POS functionality preserved
  - Settings page updated, not replaced

- **Browser Requirements:**
  - IndexedDB support (IE 10+, all modern browsers)
  - navigator.onLine support (all modern browsers)

- **Performance Impact:**
  - Minimal: IndexedDB operations are async
  - Topbar render optimized with useCallback
  - No layout shift on pending sales display

## Documentation Generated

1. **IMPLEMENTATION_PROGRESS.md** - Full implementation status
2. **OFFLINE_SYNC_GUIDE.md** - Quick reference guide
3. **FLEXI_POS_INTEGRATION_TESTING.md** - This file (testing & verification)

All documentation is in workspace root for easy access.
