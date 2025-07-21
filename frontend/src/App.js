// App.js
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";

// Navigation Components
import Navbar from "./components/navigation/Navbar";
import Sidebar from "./components/navigation/Sidebar";
import Breadcrumbs from "./components/navigation/Breadcrumbs";
import { BreadcrumbContext } from "./context/BreadcrumbContext";

// Pages and Tables...
import Home from "./pages/Home";
import SanPage from "./pages/SanPage";
import NotFound from "./pages/NotFound";
import ToolsPage from "./pages/ToolsPage";
import StorageCalculatorPage from "./pages/StorageCalculatorPage";
import StoragePage from "./pages/StoragePage";
import ScriptsPage from "./pages/ScriptsPage";
import CustomerTable from "./components/tables/CustomerTable";
import FabricTable from "./components/tables/FabricTable";
import AliasTable from "./components/tables/AliasTable";
import ZoneTable from "./components/tables/ZoneTable";
import StorageTable from "./components/tables/StorageTable";
import StorageVolumesPage from "./pages/StorageVolumesPage";
import StorageHostsPage from "./pages/StorageHostsPage";
import ConfigForm from "./components/forms/ConfigForm";
import WWPNFormatterTable from "./components/tools/WWPNColonizer";
import AliasScriptsPage from "./pages/AliasScriptsPage";
import DS8000ScriptsPage from "./pages/DS8000ScriptsPage";
import FlashsystemscriptsPage from "./pages/FlashsystemScriptsPage";
import ZoneScriptsPage from "./pages/ZoneScriptsPage";
import ImportSwitchConfig from "./components/forms/ImportSwitchConfig";
import StorageInsightsImporter from "./pages/StorageInsightsImporter";
import TestFilters from "./components/tables/TestFilters";
import AliasImportPage from './pages/AliasImportPage';
import ZoneImportPage from './pages/ZoneImportPage';
// Context Providers
import { SanVendorProvider } from "./context/SanVendorContext";
import { ConfigProvider } from "./context/ConfigContext";
import { ImportStatusProvider } from "./context/ImportStatusContext";

// Custom Styles
import "./App.css";
import "./styles/navbar.css";
import "./styles/sidebar.css";
import "./styles/breadcrumbs.css";
import "./styles/generictable.css";
import "./styles/pages.css";
import "./styles/home.css";

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
                     location.pathname.match(/^\/storage\/\d+\/volumes$/);

  // Define routes that should scroll normally (non-table pages)
  const scrollableRoutes = [
    '/',
    '/san',
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
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/customers" element={<CustomerTable />} />
                  <Route path="/san" element={<SanPage />} />
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
