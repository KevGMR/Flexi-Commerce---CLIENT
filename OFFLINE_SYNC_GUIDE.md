# FLEXI-POS: Offline-First POS System - Quick Reference

## 🎯 What Was Built

A comprehensive offline-first Point-of-Sale system with Shopify integration that automatically syncs pending sales when the user comes back online.

## 📁 New & Modified Files

### New Files Created:
1. **src/hooks/useSyncManager.js** - Core sync and online/offline detection hook
2. **src/lib/indexeddb.js** - IndexedDB utilities for offline sale storage
3. **IMPLEMENTATION_PROGRESS.md** - Detailed implementation status

### Modified Files:
1. **src/components/Topbar.js** - Added online status indicator + pending sales badge
2. **src/app/dashboard/settings/page.js** - Added Shopify integration panel
3. **src/app/dashboard/sales-channels/pos/page.js** - Added offline support, pending sales management, product tabs

## 🔑 Key Features

### Offline Support ✅
- Sales saved to IndexedDB when offline
- Automatic sync on reconnect (unlimited retries)
- Manual retry per pending sale
- User feedback: "Reconnecting to Shopify..." alert

### Sync Manager (`useSyncManager` hook)
```javascript
const { isOnline, pendingSalesCount, isRetrying, isReconnectingShopify, 
        updatePendingCount, retrySyncPendingSales, retrySingleSale } = useSyncManager();
```

### IndexedDB Schema
```javascript
DB: "FLEXI_POS"
Store: "pending_sales"
Fields: {
  id: unique identifier,
  payload: sale data object,
  savedAt: timestamp,
  retryCount: number,
  lastError: error message string
}
```

### API Integration

**Settings (Shopify Connection):**
- `POST /shopify/connect` - Connect store
- `POST /shopify/disconnect` - Disconnect store
- `GET /locations/shopify/available-locations` - Fetch Shopify locations
- `POST /locations/:id/set-shopify-location` - Map location

**POS (Sale Submission):**
- `POST /sales` - Submit sale (with offline fallback to IndexedDB)

**All requests include:**
```javascript
headers: {
  "Authorization": `Bearer ${accessToken}`,
  "X-Device-ID": deviceId || "",
  "X-Device-Name": deviceName || "",
  "X-Organization-Slug": organizationSlug || ""
}
```

## 🎨 UI Components

### Topbar
- Green/red dot indicator (online/offline)
- Pending sales count badge (amber background)
- Only shows badge if pending sales > 0

### Settings Page
- **Shopify Connection Form**: Store name, URL, Client ID, Secret
- **Connected Status**: Green badge with disconnect button
- **Location Mapping**: Section for mapping store locations to Shopify (placeholder)
- **Offline Message**: Yellow warning when no internet

### POS Page
- **Offline Alert**: Red banner with explanation
- **Reconnecting Alert**: Blue banner while syncing
- **Pending Sales Section**: 
  - Count badge
  - Expandable details
  - Manual retry buttons per sale
  - Shows save time, items count, last error
- **Product Tabs**: Toggle between FLEXI and Shopify products
- **Form**: Location, items, payments, notes

## 🔄 How Offline Sync Works

```
1. User submits sale while offline
   ↓
2. API call fails (no internet or 503)
   ↓
3. Sale payload saved to IndexedDB
   ↓
4. User sees "Sale saved offline" message
   ↓
5. User comes back online
   ↓
6. useSyncManager detects online event
   ↓
7. Topbar shows "Reconnecting to Shopify..." alert
   ↓
8. App auto-retries all pending sales
   ↓
9. On success: deleted from IndexedDB
   ↓
10. On failure: error logged, user can manual retry
    ↓
11. Alert closes when done, pending count → 0
```

## 🧪 Testing the Offline Feature

### Simulate Offline:
1. DevTools → Network → Offline mode
2. Create sale in POS
3. See "Sale saved offline" message
4. Check Topbar shows pending count

### Simulate Coming Online:
1. DevTools → Network → Online mode
2. See "Reconnecting to Shopify..." alert
3. Pending sales synced automatically
4. Alert clears, count → 0

### Manual Retry:
1. Keep pending sales showing
2. Click "Retry" on specific sale
3. Feedback shows success/error

## 📊 Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Offline detection | ✅ Complete | Via navigator.onLine |
| IndexedDB storage | ✅ Complete | 7 CRUD operations |
| Auto-retry on reconnect | ✅ Complete | Unlimited retries |
| Manual retry | ✅ Complete | Per-sale button |
| Topbar indicator | ✅ Complete | Online/offline + count |
| Settings Shopify panel | ✅ Complete | Connect/disconnect + location mapping placeholder |
| POS offline fallback | ✅ Complete | Saves to IndexedDB on error |
| Product tabs | ✅ Complete | FLEXI/Shopify toggle |
| Shopify product catalog | 🔄 Placeholder | UI ready, backend endpoint needed |
| Inventory sync polling | 🔄 Placeholder | Hook structure ready, UI placeholder |
| Location mapping UI | 🔄 Placeholder | Backend calls ready, UI to build |

## 🚀 Next Steps

### High Priority:
1. Build Shopify product catalog UI (browse & quick-add)
2. Implement inventory sync polling in useSyncManager
3. Create location mapping UI in Settings
4. Add product search/filter

### Medium Priority:
1. Batch sync instead of sequential
2. Retry priority (oldest first)
3. Sync history viewer
4. Conflict resolution

### Nice-to-Have:
1. Sync progress percentage
2. Estimated time to sync
3. Rollback/undo for failed syncs
4. Scheduled auto-retry

## 📚 Important Notes

### Browser Compatibility:
- IndexedDB: All modern browsers (IE 10+)
- navigator.onLine: All modern browsers
- localStorage fallback: Available in Topbar for session data

### Error Handling:
- IndexedDB quota: Handle gracefully if DB full
- Network errors: All retried with exponential backoff (in retrySyncPendingSales)
- 401 errors: Stop retry, let auth handler refresh token

### Performance:
- Pending sales lazy-loaded on demand (no initial load)
- Auto-retry on reconnect doesn't block UI
- Sync operations run in background
- Topbar updates efficiently with useCallback

### Security:
- All API calls include Authorization bearer token
- Device headers included for audit trail
- ClientSecret stored in form (not persisted without backend confirmation)
- Settings disabled when offline

## 🔗 Code References

- Hook: [src/hooks/useSyncManager.js](src/hooks/useSyncManager.js)
- DB: [src/lib/indexeddb.js](src/lib/indexeddb.js)
- Topbar: [src/components/Topbar.js](src/components/Topbar.js)
- Settings: [src/app/dashboard/settings/page.js](src/app/dashboard/settings/page.js)
- POS: [src/app/dashboard/sales-channels/pos/page.js](src/app/dashboard/sales-channels/pos/page.js)
