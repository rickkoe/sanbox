// App.js
import React, { useState, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

// Custom Styles
import "./App.css";
import "./styles/navbar.css";
import "./styles/sidebar.css";
import "./styles/breadcrumbs.css";
import "./styles/generictable.css";
import "./styles/pages.css";
import "./styles/home.css";

// Navigation Components (critical for initial load)
import Navbar from "./components/navigation/Navbar";
import Sidebar from "./components/navigation/Sidebar";
import Breadcrumbs from "./components/navigation/Breadcrumbs";
import { BreadcrumbContext } from "./context/BreadcrumbContext";

// Critical pages (loaded immediately)
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import LoadingSpinner from "./components/LoadingSpinner";

// Context Providers
import { SanVendorProvider } from "./context/SanVendorContext";
import { ConfigProvider } from "./context/ConfigContext";
import { ImportStatusProvider } from "./context/ImportStatusContext";

// Lazy-loaded components for better performance
const SanPage = React.lazy(() => import("./pages/SanPage"));
const InsightsPage = React.lazy(() => import("./pages/InsightsPage"));
const ToolsPage = React.lazy(() => import("./pages/ToolsPage"));
const StorageCalculatorPage = React.lazy(() => import("./pages/StorageCalculatorPage"));
const StoragePage = React.lazy(() => import("./pages/StoragePage"));
const ScriptsPage = React.lazy(() => import("./pages/ScriptsPage"));
const CustomerTable = React.lazy(() => import("./components/tables/CustomerTable"));
const FabricTable = React.lazy(() => import("./components/tables/FabricTable"));
const AliasTable = React.lazy(() => import("./components/tables/AliasTable"));
const ZoneTable = React.lazy(() => import("./components/tables/ZoneTable"));
const StorageTable = React.lazy(() => import("./components/tables/StorageTable"));
const StorageVolumesPage = React.lazy(() => import("./pages/StorageVolumesPage"));
const StorageHostsPage = React.lazy(() => import("./pages/StorageHostsPage"));
const ConfigForm = React.lazy(() => import("./components/forms/ConfigForm"));
const WWPNFormatterTable = React.lazy(() => import("./components/tools/WWPNColonizer"));
const AliasScriptsPage = React.lazy(() => import("./pages/AliasScriptsPage"));
const DS8000ScriptsPage = React.lazy(() => import("./pages/DS8000ScriptsPage"));
const FlashsystemscriptsPage = React.lazy(() => import("./pages/FlashsystemScriptsPage"));
const ZoneScriptsPage = React.lazy(() => import("./pages/ZoneScriptsPage"));
const ImportSwitchConfig = React.lazy(() => import("./components/forms/ImportSwitchConfig"));
const StorageInsightsImporter = React.lazy(() => import("./pages/StorageInsightsImporter"));
const TestFilters = React.lazy(() => import("./components/tables/TestFilters"));
const AliasImportPage = React.lazy(() => import("./pages/AliasImportPage"));
const ZoneImportPage = React.lazy(() => import("./pages/ZoneImportPage"));

// Main app content with routing-aware CSS classes
function AppContent() {
  const [breadcrumbMap, setBreadcrumbMap] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Define routes that use tables (need fixed headers)
  const tableRoutes = [
    '/customers',
    '/san/aliases', 
    '/san/zones',
    '/san/fabrics',
    '/storage',
    '/tools/wwpn-colonizer',
    '/test'
  ];

  // Check for table routes including dynamic routes
  const isTablePage = tableRoutes.some(route => location.pathname === route) ||
                     location.pathname.match(/^\/storage\/\d+\/volumes$/) ||
                     location.pathname.match(/^\/storage\/\d+\/hosts$/);

  // Define routes that should scroll normally (non-table pages)
  const scrollableRoutes = [
    '/',
    '/san',
    '/insights',
    '/config',
    '/tools',
    '/scripts',
    '/insights/importer'
  ];

  // Check for scrollable routes including dynamic routes
  const isScrollablePage = scrollableRoutes.some(route => location.pathname === route) ||
                          location.pathname.match(/^\/storage\/\d+$/) || // Storage detail pages
                          location.pathname.startsWith('/scripts/') ||
                          location.pathname.startsWith('/tools/ibm-storage-calculator') ||
                          location.pathname.includes('/import');

  // Determine CSS class for main content
  const getMainContentClass = () => {
    if (isTablePage) return 'main-content table-page';
    if (isScrollablePage) return 'main-content scrollable';
    return 'main-content'; // Default - no scrolling
  };

  return (
    <ConfigProvider>
      <SanVendorProvider>
        <ImportStatusProvider>
          <BreadcrumbContext.Provider value={{ breadcrumbMap, setBreadcrumbMap }}>
            <div className={`app-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
              <header className="navbar">
                <Navbar />
              </header>
              <aside className="sidebar">
                <Sidebar onCollapseChange={setIsSidebarCollapsed} />
              </aside>
              <div className="topbar">
                <Breadcrumbs />
              </div>
              <main className={getMainContentClass()}>
                <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/customers" element={<CustomerTable />} />
                    <Route path="/san" element={<SanPage />} />
                    <Route path="/insights" element={<InsightsPage />} />
                    <Route path="/san/aliases" element={<AliasTable />} />
                    <Route path="/san/zones" element={<ZoneTable />} />
                    <Route path="/storage" element={<StorageTable />} />
                    <Route path="/storage/:id" element={<StoragePage />} />
                    <Route path="/storage/:id/volumes" element={<StorageVolumesPage />} />
                    <Route path="/storage/:id/hosts" element={<StorageHostsPage />} />
                    <Route path="/san/fabrics" element={<FabricTable />} />
                    <Route path="/config" element={<ConfigForm />} />
                    <Route path="/tools" element={<ToolsPage />} />
                    <Route path="/scripts" element={<ScriptsPage />} />
                    <Route path="/scripts/zoning" element={<ZoneScriptsPage />} />
                    <Route path="/scripts/ds8000" element={<DS8000ScriptsPage />} />
                    <Route path="/scripts/flashsystem" element={<FlashsystemscriptsPage />} />
                    <Route path="/test" element={<TestFilters />} />
                    <Route path="/san/aliases/import" element={<AliasImportPage />} />
                    <Route path="/san/zones/import" element={<ZoneImportPage />} />
                  <Route
                    path="/insights/importer"
                    element={<StorageInsightsImporter />}
                  />
                  <Route
                    path="/tools/wwpn-colonizer"
                    element={<WWPNFormatterTable />}
                  />
                  <Route
                    path="/tools/ibm-storage-calculator"
                    element={<StorageCalculatorPage />}
                  />
                  <Route
                    path="/san/aliases/alias-scripts"
                    element={<AliasScriptsPage />}
                  />
                  <Route
                    path="/san/zones/zone-scripts"
                    element={<ZoneScriptsPage />}
                  />
                    <Route path="/import-data" element={<ImportSwitchConfig />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
            </div>
          </BreadcrumbContext.Provider>
        </ImportStatusProvider>
      </SanVendorProvider>
    </ConfigProvider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
