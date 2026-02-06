# FLEXI-POS Dashboard (Next.js App Router, JS)

Multi-tenant commerce dashboard skeleton wired for FLEXI-POS APIs. Includes permission-gated navigation, org switching, manual token seeding, and a POS flow with split payments (cash, card button, M-Pesa button).

## Stack
- Next.js 14 App Router (JavaScript)
- Tailwind CSS
- Zustand for auth/org/permission state

## Setup
1) Install deps:
```bash
npm install
```
2) Configure API base URL (default `http://localhost:9200`):
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:9200
```
3) Run dev server:
```bash
npm run dev
```

## Auth & Org
- Manual token seeding page: `/auth/login` (paste access + refresh tokens; optional org ID and user email label).
- Org switching: top bar select → calls `/organizations/:id/switch`; auto-selects if only one org returned by `/organizations/my`.
- State is persisted to `localStorage` plus in-memory cache.
- Device headers are sent on all requests: `X-Device-ID` and `X-Device-Name` (defaults in store).

## Navigation (permission-gated)
- Home: `/dashboard/home`
- Orders: `/dashboard/orders/orders`, `/dashboard/orders/draft-orders`, `/dashboard/orders/abandoned-checkouts`
- Products: `/dashboard/products/products`, `/dashboard/products/collections`, `/dashboard/products/inventory`, `/dashboard/products/purchase-orders`, `/dashboard/products/transfers`, `/dashboard/products/gift-cards`
- Customers: `/dashboard/customers`
- Sales Channels (POS): `/dashboard/sales-channels/pos`
- Settings: `/dashboard/settings`

## POS Flow (split payments)
Page: `/dashboard/sales-channels/pos`
- Inputs: `locationId`, items (variant + quantity, FLEXI or Shopify), payments (cash/card/M-Pesa). Split payments supported; payload uses `paymentMethod: "split"` when multiple payments exist.
- Idempotency key helper: `pos-{orgId}-{locationId}-{timestamp}-{random}`.
- Submit posts to `/sales`; shows success or API error.

## Helpers
- API client: `src/lib/api-client.js` attaches bearer token, device headers, refresh on 401 via `/auth/refresh`.
- Session store: `src/store/session.js` (tokens, org, permissions, device headers, can(permission)).
- Idempotency helper: `src/lib/idempotency.js`.

## Notes
- No backend is included; endpoints must be available for live calls.
- Menu items hide when `can(permission)` fails; Shopify items can be further gated once connection status is available.
