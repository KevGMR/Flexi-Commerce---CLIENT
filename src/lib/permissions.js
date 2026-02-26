// Permission constants matching backend permission system
// Keep this in sync with server/config/permissions.js

export const PERMISSIONS = {
  // Sales Permissions
  CREATE_SALE: "create_sale",
  VIEW_SALE_HISTORY: "view_sale_history",
  EDIT_SALE: "edit_sale",
  DELETE_SALE: "delete_sale",
  REFUND_SALE: "refund_sale",

  // POS Permissions
  POS_OVERRIDE_PRICE: "pos:override_price",
  POS_ACCESS_SHOPIFY_PRODUCTS: "pos:access_shopify_products",
  POS_APPLY_DISCOUNT: "pos:apply_discount",
  POS_VIEW_COST: "pos:view_cost",

  // Reporting Permissions
  VIEW_REPORTS: "view_reports",
  EXPORT_REPORTS: "export_reports",
  VIEW_FINANCIAL_REPORTS: "view_financial_reports",

  // Inventory Permissions
  MANAGE_INVENTORY: "manage_inventory",
  VIEW_INVENTORY: "view_inventory",
  ADJUST_INVENTORY: "adjust_inventory",

  // Product Permissions
  CREATE_PRODUCT: "create_product",
  EDIT_PRODUCT: "edit_product",
  DELETE_PRODUCT: "delete_product",
  VIEW_PRODUCT: "view_product",

  // Invoice Permissions
  CREATE_INVOICE: "create_invoice",
  VIEW_INVOICE: "view_invoice",
  EDIT_INVOICE: "edit_invoice",
  DELETE_INVOICE: "delete_invoice",

  // Vault Permissions
  MANAGE_VAULT: "manage_vault",
  VIEW_VAULT: "view_vault",
  CREATE_VAULT: "create_vault",
  DELETE_VAULT: "delete_vault",

  // Quick Items Permissions
  MANAGE_QUICK_ITEMS: "manage_quick_items",
  VIEW_QUICK_ITEMS: "view_quick_items",

  // User Management Permissions
  MANAGE_USERS: "manage_users",
  VIEW_USERS: "view_users",
  CREATE_USER: "create_user",
  EDIT_USER: "edit_user",
  DELETE_USER: "delete_user",
  BAN_USER: "ban_user",

  // Role & Permission Management
  MANAGE_ROLES: "manage_roles",
  VIEW_ROLES: "view_roles",
  ASSIGN_PERMISSIONS: "assign_permissions",

  // Audit & Security
  MANAGE_AUDIT_LOGS: "manage_audit_logs",
  VIEW_AUDIT_LOGS: "view_audit_logs",
  EXPORT_AUDIT_LOGS: "export_audit_logs",
  PURGE_AUDIT_LOGS: "purge_audit_logs",

  // System Administration
  MANAGE_SETTINGS: "manage_settings",
  VIEW_SETTINGS: "view_settings",

  // Delivery Fee Permissions
  DELIVERY_FEES_CREATE: "delivery_fees.create",
  DELIVERY_FEES_READ: "delivery_fees.read",
  DELIVERY_FEES_UPDATE: "delivery_fees.update",
  DELIVERY_FEES_DELETE: "delivery_fees.delete",
  DELIVERY_FEES_ASSIGN_DRIVER: "delivery_fees.assign_driver",
  DELIVERY_FEES_UPDATE_STATUS: "delivery_fees.update_status",
};

// Permission Groups for UI organization
export const PERMISSION_GROUPS = {
  sales: [
    PERMISSIONS.CREATE_SALE,
    PERMISSIONS.VIEW_SALE_HISTORY,
    PERMISSIONS.EDIT_SALE,
    PERMISSIONS.DELETE_SALE,
    PERMISSIONS.REFUND_SALE,
  ],
  pos: [
    PERMISSIONS.POS_OVERRIDE_PRICE,
    PERMISSIONS.POS_ACCESS_SHOPIFY_PRODUCTS,
    PERMISSIONS.POS_APPLY_DISCOUNT,
    PERMISSIONS.POS_VIEW_COST,
  ],
  reporting: [
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
  ],
  inventory: [
    PERMISSIONS.MANAGE_INVENTORY,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.ADJUST_INVENTORY,
  ],
  products: [
    PERMISSIONS.CREATE_PRODUCT,
    PERMISSIONS.EDIT_PRODUCT,
    PERMISSIONS.DELETE_PRODUCT,
    PERMISSIONS.VIEW_PRODUCT,
  ],
  admin: [
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.MANAGE_AUDIT_LOGS,
    PERMISSIONS.MANAGE_SETTINGS,
  ],
  deliveryFees: [
    PERMISSIONS.DELIVERY_FEES_CREATE,
    PERMISSIONS.DELIVERY_FEES_READ,
    PERMISSIONS.DELIVERY_FEES_UPDATE,
    PERMISSIONS.DELIVERY_FEES_DELETE,
    PERMISSIONS.DELIVERY_FEES_ASSIGN_DRIVER,
    PERMISSIONS.DELIVERY_FEES_UPDATE_STATUS,
  ],
};
