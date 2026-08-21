import { Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import UIShowcase from './pages/UIShowcase.jsx';
import SystemHealth from './pages/SystemHealth.jsx';
import Login from './pages/Login.jsx';
import NotFound from './pages/NotFound.jsx';
import ProtectedRoute from './routes/ProtectedRoute.jsx';
import ModuleProtectedRoute from './routes/ModuleProtectedRoute.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Clients from './pages/Clients.jsx';
import ClientDetails from './pages/ClientDetails.jsx';
import Products from './pages/Products.jsx';
import Quotations from './pages/Quotations.jsx';
import QuotationForm from './pages/QuotationForm.jsx';
import QuotationView from './pages/QuotationView.jsx';
import Invoices from './pages/Invoices.jsx';
import InvoiceForm from './pages/InvoiceForm.jsx';
import InvoiceView from './pages/InvoiceView.jsx';
import Payments from './pages/Payments.jsx';
import Finance from './pages/Finance.jsx';
import Expenses from './pages/Expenses.jsx';
import Inventory from './pages/Inventory.jsx';
import InventoryHistory from './pages/InventoryHistory.jsx';
import Suppliers from './pages/Suppliers.jsx';
import DataManagement from './pages/DataManagement.jsx';
import ArtworkVault from './pages/ArtworkVault.jsx';
import ArtworkDetail from './pages/ArtworkDetail.jsx';
import NestingJobs from './pages/NestingJobs.jsx';
import NestingJobForm from './pages/NestingJobForm.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

/*
  Authentication gate: unauthenticated users can only reach /login —
  every other route (including "/", "/ui-kit", "/system-health", and
  the 404 fallback) is wrapped in ProtectedRoute. Signing in is the
  only way to see anything else.
*/
function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Home />} />
        <Route path="/ui-kit" element={<UIShowcase />} />
        <Route path="/system-health" element={<SystemHealth />} />

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/clients" element={<ModuleProtectedRoute module="clients"><Clients /></ModuleProtectedRoute>} />
          <Route path="/clients/:id" element={<ModuleProtectedRoute module="clients"><ClientDetails /></ModuleProtectedRoute>} />
          <Route path="/products" element={<ModuleProtectedRoute module="products"><Products /></ModuleProtectedRoute>} />
          <Route path="/quotations" element={<ModuleProtectedRoute module="quotations"><Quotations /></ModuleProtectedRoute>} />
          <Route path="/quotations/new" element={<ModuleProtectedRoute module="quotations"><QuotationForm /></ModuleProtectedRoute>} />
          <Route path="/quotations/:id/edit" element={<ModuleProtectedRoute module="quotations"><QuotationForm /></ModuleProtectedRoute>} />
          <Route path="/quotations/:id" element={<ModuleProtectedRoute module="quotations"><QuotationView /></ModuleProtectedRoute>} />
          <Route path="/invoices" element={<ModuleProtectedRoute module="invoices"><Invoices /></ModuleProtectedRoute>} />
          <Route path="/invoices/new" element={<ModuleProtectedRoute module="invoices"><InvoiceForm /></ModuleProtectedRoute>} />
          <Route path="/invoices/:id/edit" element={<ModuleProtectedRoute module="invoices"><InvoiceForm /></ModuleProtectedRoute>} />
          <Route path="/invoices/:id" element={<ModuleProtectedRoute module="invoices"><InvoiceView /></ModuleProtectedRoute>} />
          <Route path="/payments" element={<ModuleProtectedRoute module="payments"><Payments /></ModuleProtectedRoute>} />
          <Route path="/finance" element={<ModuleProtectedRoute module="finance"><Finance /></ModuleProtectedRoute>} />
          <Route path="/expenses" element={<ModuleProtectedRoute module="expenses"><Expenses /></ModuleProtectedRoute>} />
          <Route path="/inventory" element={<ModuleProtectedRoute module="inventory"><Inventory /></ModuleProtectedRoute>} />
          <Route path="/inventory/history" element={<ModuleProtectedRoute module="inventory"><InventoryHistory /></ModuleProtectedRoute>} />
          <Route path="/suppliers" element={<ModuleProtectedRoute module="suppliers"><Suppliers /></ModuleProtectedRoute>} />
          <Route path="/data-management" element={<ModuleProtectedRoute module="data"><DataManagement /></ModuleProtectedRoute>} />
          <Route path="/artwork-vault" element={<ModuleProtectedRoute module="artwork"><ArtworkVault /></ModuleProtectedRoute>} />
          <Route path="/artwork-vault/nesting" element={<ModuleProtectedRoute module="artwork"><NestingJobs /></ModuleProtectedRoute>} />
          <Route path="/artwork-vault/nesting/new" element={<ModuleProtectedRoute module="artwork"><NestingJobForm /></ModuleProtectedRoute>} />
          <Route path="/artwork-vault/nesting/:id" element={<ModuleProtectedRoute module="artwork"><NestingJobForm /></ModuleProtectedRoute>} />
          <Route path="/artwork-vault/:id" element={<ModuleProtectedRoute module="artwork"><ArtworkDetail /></ModuleProtectedRoute>} />
          <Route path="/reports" element={<ModuleProtectedRoute module="reports"><Reports /></ModuleProtectedRoute>} />
          <Route path="/settings" element={<ModuleProtectedRoute module="settings"><Settings /></ModuleProtectedRoute>} />
        </Route>

        {/* Legacy alias, in case anything still links to /app */}
        <Route path="/app" element={<Navigate to="/dashboard" replace />} />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;
