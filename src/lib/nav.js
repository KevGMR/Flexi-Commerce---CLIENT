import { PERMISSIONS } from "./permissions";

// Top-level items render in Sidebar; add children for submenus when needed.
export const navItems = [
  { label: "Home", href: "/dashboard/home" },
  {
    label: "Orders",
    href: "/dashboard/orders",
    permission: PERMISSIONS.VIEW_SALE_HISTORY,
    children: [
      { label: "Draft Orders", href: "/dashboard/draft-orders", permission: PERMISSIONS.VIEW_SALE_HISTORY },
      { label: "Abandoned Checkouts", href: "/dashboard/abandoned-checkouts", permission: PERMISSIONS.VIEW_SALE_HISTORY },
    ],
  },
  {
    label: "Products",
    href: "/dashboard/products",
    permission: PERMISSIONS.VIEW_PRODUCT,
    children: [
      { label: "Collections", href: "/dashboard/collections", permission: PERMISSIONS.VIEW_PRODUCT },
      { label: "Inventory", href: "/dashboard/inventory", permission: PERMISSIONS.VIEW_PRODUCT },
      { label: "Purchase Orders", href: "/dashboard/purchase-orders", permission: PERMISSIONS.VIEW_PRODUCT },
      { label: "Transfers", href: "/dashboard/transfers", permission: PERMISSIONS.VIEW_PRODUCT },
      { label: "Gift Cards", href: "/dashboard/gift-cards", permission: PERMISSIONS.VIEW_PRODUCT },
    ],
  },
  { label: "Customers", href: "/dashboard/customers", permission: PERMISSIONS.VIEW_USERS },
  { label: "Analytics (Reports)", href: "/dashboard/analytics", permission: PERMISSIONS.VIEW_REPORTS },
  { label: "Sales Channels", isSection: true },
  { label: "POS", href: "/dashboard/sales-channels/pos", permission: PERMISSIONS.CREATE_SALE },
  {
    label: "Settings",
    href: "/dashboard/settings",
    permission: PERMISSIONS.VIEW_SETTINGS,
    children: [
      { label: "User Info", href: "/dashboard/settings/user-info", permission: PERMISSIONS.VIEW_SETTINGS },
      { label: "Invitations", href: "/dashboard/settings/invitations", permission: PERMISSIONS.VIEW_USERS },
      { label: "Locations", href: "/dashboard/settings/locations", permission: PERMISSIONS.VIEW_INVENTORY },
      { label: "Permissions", href: "/dashboard/settings/permissions", permission: PERMISSIONS.VIEW_ROLES },
      { label: "Shopify", href: "/dashboard/settings/shopify", permission: PERMISSIONS.VIEW_SETTINGS },
      { label: "Team & Orgs", href: "/dashboard/settings/team", permission: PERMISSIONS.VIEW_USERS },
    ],
  },
  
];

export default navItems;
