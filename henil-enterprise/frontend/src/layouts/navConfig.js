import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Receipt,
  CreditCard,
  Landmark,
  TrendingDown,
  Boxes,
  Truck,
  BarChart3,
  Settings,
  Database,
  Layers,
} from 'lucide-react';

/*
  Single source of truth for the primary app navigation.
  Used by: Sidebar, MobileNav (drawer), and Breadcrumbs (label lookup).
*/
export const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, module: null },
  { path: '/clients', label: 'Clients', icon: Users, module: 'clients' },
  { path: '/products', label: 'Products', icon: Package, module: 'products' },
  { path: '/quotations', label: 'Quotations', icon: FileText, module: 'quotations' },
  { path: '/invoices', label: 'Invoices', icon: Receipt, module: 'invoices' },
  { path: '/payments', label: 'Payments', icon: CreditCard, module: 'payments' },
  { path: '/finance', label: 'Finance', icon: Landmark, module: 'finance' },
  { path: '/expenses', label: 'Expenses', icon: TrendingDown, module: 'expenses' },
  { path: '/inventory', label: 'Inventory', icon: Boxes, module: 'inventory' },
  { path: '/suppliers', label: 'Suppliers', icon: Truck, module: 'suppliers' },
  { path: '/artwork-vault', label: 'Artwork Vault', icon: Layers, module: 'artwork' },
  { path: '/reports', label: 'Reports', icon: BarChart3, module: 'reports' },
  { path: '/data-management', label: 'Data Management', icon: Database, module: 'data' },
  { path: '/settings', label: 'Settings', icon: Settings, module: 'settings' },
];

export function getNavItemByPath(path) {
  return NAV_ITEMS.find((item) => path === item.path || path.startsWith(`${item.path}/`));
}
