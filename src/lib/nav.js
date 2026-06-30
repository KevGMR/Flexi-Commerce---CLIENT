import { PERMISSIONS } from "./permissions";

export const navItems = [
  { label: "Home", href: "/dashboard/home", icon: "Home" },
  {
    label: "Orders",
    href: "/dashboard/orders",
    icon: "ShoppingBag",
    permission: PERMISSIONS.VIEW_SALE_HISTORY,
    children: [
      { label: "Draft Orders", href: "/dashboard/draft-orders", permission: PERMISSIONS.VIEW_SALE_HISTORY, icon: "DocumentText" },
      { label: "Abandoned Checkouts", href: "/dashboard/abandoned-checkouts", permission: PERMISSIONS.VIEW_SALE_HISTORY, icon: "ShoppingCart" },
    ],
  },
  {
    label: "Products",
    href: "/dashboard/products",
    icon: "Cube",
    permission: PERMISSIONS.VIEW_PRODUCT,
    children: [
      { label: "Services", href: "/dashboard/products/services", permission: PERMISSIONS.VIEW_PRODUCT, icon: "Wrench" },
      { label: "Collections", href: "/dashboard/collections", permission: PERMISSIONS.VIEW_PRODUCT, icon: "Folder" },
      { label: "Inventory", href: "/dashboard/inventory", permission: PERMISSIONS.VIEW_PRODUCT, icon: "Cube" },
      { label: "Purchase Orders", href: "/dashboard/purchase-orders", permission: PERMISSIONS.VIEW_PRODUCT, icon: "Clipboard" },
      { label: "Transfers", href: "/dashboard/transfers", permission: PERMISSIONS.VIEW_PRODUCT, icon: "ArrowsRightLeft" },
      { label: "Gift Cards", href: "/dashboard/gift-cards", permission: PERMISSIONS.VIEW_PRODUCT, icon: "Gift" },
    ],
  },
  { label: "Customers", href: "/dashboard/customers", icon: "Users", permission: PERMISSIONS.VIEW_USERS },
  { label: "Analytics (Reports)", href: "/dashboard/analytics", icon: "ChartBar", permission: PERMISSIONS.VIEW_REPORTS },
  {
    label: "Expenses",
    href: "/dashboard/expenses",
    icon: "Banknotes",
    permission: PERMISSIONS.VIEW_EXPENSES,
    children: [
      { label: "Expense List", href: "/dashboard/expenses", permission: PERMISSIONS.VIEW_EXPENSES, icon: "ListBullet" },
      { label: "Create Expense", href: "/dashboard/expenses/create", permission: PERMISSIONS.CREATE_EXPENSES, icon: "PlusCircle" },
    ],
  },
  {
    label: "Deliveries",
    href: "/dashboard/deliveries",
    icon: "Truck",
    permission: PERMISSIONS.DELIVERY_FEES_READ,
    children: [
      { label: "All Deliveries", href: "/dashboard/deliveries", permission: PERMISSIONS.DELIVERY_FEES_READ, icon: "ListBullet" },
      { label: "Create Delivery", href: "/dashboard/deliveries/create", permission: PERMISSIONS.DELIVERY_FEES_CREATE, icon: "PlusCircle" },
      { label: "Drivers", href: "/dashboard/deliveries/drivers", permission: PERMISSIONS.DELIVERY_FEES_ASSIGN_DRIVER, icon: "User" },
      { label: "Reports", href: "/dashboard/deliveries/reports", permission: PERMISSIONS.DELIVERY_FEES_READ, icon: "ChartBar" },
    ],
  },
  { label: "Sales Channels", isSection: true },
  {
    label: "Point of Sale",
    href: "/dashboard/sales-channels/pos",
    icon: "CreditCard",
    permission: PERMISSIONS.CREATE_SALE,
    children: [
      { label: "POS Terminal", href: "/dashboard/sales-channels/pos", permission: PERMISSIONS.CREATE_SALE, icon: "ComputerDesktop" },
      { label: "Sales Reports", href: "/dashboard/sales-channels/pos/reports", permission: PERMISSIONS.VIEW_REPORTS, icon: "ChartBar" },
      { label: "Shift Sessions", href: "/dashboard/sales-channels/pos/shifts", permission: PERMISSIONS.CREATE_SALE, icon: "Clock" },
      { label: "Reconciliation", href: "/dashboard/sales-channels/pos/reconciliation", permission: PERMISSIONS.MANAGE_FINANCE, icon: "ReceiptRefund" },
      // FIXED: Coins → CurrencyDollar
      { label: "Commissions", href: "/dashboard/sales-channels/pos/commissions", permission: PERMISSIONS.VIEW_REPORTS, icon: "CurrencyDollar" },
    ],
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: "Cog",
    permission: PERMISSIONS.VIEW_SETTINGS,
    children: [
      { label: "User Info", href: "/dashboard/settings/user-info", permission: PERMISSIONS.VIEW_SETTINGS, icon: "User" },
      { label: "Users", href: "/dashboard/settings/users", permission: PERMISSIONS.VIEW_USERS, icon: "Users" },
      { label: "Invitations", href: "/dashboard/settings/invitations", permission: PERMISSIONS.VIEW_USERS, icon: "Envelope" },
      { label: "Locations", href: "/dashboard/settings/locations", permission: PERMISSIONS.VIEW_INVENTORY, icon: "MapPin" },
      { label: "Delivery Categories", href: "/dashboard/settings/delivery-categories", permission: PERMISSIONS.MANAGE_INVENTORY, icon: "Tag" },
      { label: "Permissions", href: "/dashboard/settings/permissions", permission: PERMISSIONS.VIEW_ROLES, icon: "ShieldCheck" },
      { label: "Shopify", href: "/dashboard/settings/shopify", permission: PERMISSIONS.VIEW_SETTINGS, icon: "ShoppingCart" },
      { label: "Team & Orgs", href: "/dashboard/settings/team", permission: PERMISSIONS.VIEW_USERS, icon: "Users" },
    ],
  },
];

export default navItems;