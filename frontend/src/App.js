// App.js
import React, { useState, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";

// Custom Styles
import "./App.css";
import "./styles/navbar.css";
import "./styles/sidebar.css";
import "./styles/breadcrumbs.css";
import "./styles/generictable.css";
import "./styles/pages.css";
import "./styles/themes.css";
// Navbar styles are now consolidated in styles/navbar.css (imported elsewhere)

// Navigation Components (critical for initial load)
import Navbar from "./components/navigation/Navbar";
import Sidebar from "./components/navigation/Sidebar";
import Breadcrumbs from "./components/navigation/Breadcrumbs";
import { BreadcrumbContext } from "./context/BreadcrumbContext";

// Critical pages (loaded immediately)
import CustomizableDashboard from "./pages/CustomizableDashboard";
import NotFound from "./pages/NotFound";
import LoadingSpinner from "./components/LoadingSpinner";

// Context Providers
import { AuthProvider } from "./context/AuthContext";
import { SanVendorProvider } from "./context/SanVendorContext";
import { ConfigProvider } from "./context/ConfigContext";
import { ImportStatusProvider } from "./context/ImportStatusContext";
import { SettingsProvider } from "./context/SettingsContext";
import { TableControlsProvider } from "./context/TableControlsContext";
import { ThemeProvider } from "./context/ThemeContext";

// Authentication Components
import Login from "./components/auth/Login";
import ProtectedRoute from "./components/auth/ProtectedRoute";

// Lazy-loaded components for better performance
const SanPage = React.lazy(() => import("./pages/SanPage"));
const InsightsPage = React.lazy(() => import("./pages/InsightsPage"));
const ToolsPage = React.lazy(() => import("./pages/ToolsPage"));
const StorageCalculatorPage = React.lazy(() => import("./pages/StorageCalculatorPage"));
const StoragePage = React.lazy(() => import("./pages/StoragePage"));
const StorageLandingPage = React.lazy(() => import("./pages/StorageLandingPage"));
const ScriptsPage = React.lazy(() => import("./pages/ScriptsPage"));
const CustomerTable = React.lazy(() => import("./components/tables/CustomerTableTanStackClean"));
const ProjectTable = React.lazy(() => import("./components/tables/ProjectTableTanStackClean"));
const FabricTable = React.lazy(() => import("./components/tables/FabricTableTanStackClean"));
const AliasTable = React.lazy(() => import("./components/tables/AliasTableTanStackClean"));
const ZoneTable = React.lazy(() => import("./components/tables/ZoneTableTanStackClean"));
const StorageTable = React.lazy(() => import("./components/tables/StorageTableTanStackClean"));
const StorageVolumesPage = React.lazy(() => import("./pages/StorageVolumesPage"));
const StorageHostsPage = React.lazy(() => import("./pages/StorageHostsPage"));
const StoragePortsPage = React.lazy(() => import("./pages/StoragePortsPage"));
const PortTable = React.lazy(() => import("./components/tables/PortTableTanStackClean"));
const HostTable = React.lazy(() => import("./components/tables/HostTableTanStackClean"));
const ConfigForm = React.lazy(() => import("./components/forms/ConfigForm"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const WWPNFormatterTable = React.lazy(() => import("./components/tools/WWPNColonizer"));
const DS8000ScriptsPage = React.lazy(() => import("./pages/DS8000ScriptsPage"));
const FlashsystemscriptsPage = React.lazy(() => import("./pages/FlashsystemScriptsPage"));
const StorageScriptsPage = React.lazy(() => import("./pages/StorageScriptsPage"));
const ZoneScriptsPage = React.lazy(() => import("./pages/ZoneScriptsPage"));
const ZoneCreationScriptsPage = React.lazy(() => import("./pages/ZoneCreationScriptsPage"));
const ZoneDeleteScriptsPage = React.lazy(() => import("./pages/ZoneDeleteScriptsPage"));
const ImportSwitchConfig = React.lazy(() => import("./components/forms/ImportSwitchConfig"));
const StorageInsightsImporter = React.lazy(() => import("./pages/StorageInsightsImporter"));
const TestFilters = React.lazy(() => import("./components/tables/TestFilters"));
const CustomNamingPage = React.lazy(() => import("./pages/CustomNamingPage"));
const TeamManagement = React.lazy(() => import("./pages/TeamManagement"));
const UserProfile = React.lazy(() => import("./pages/UserProfile"));
const BulkZoningImportPage = React.lazy(() => import("./pages/BulkZoningImportPage"));
const UniversalImporter = React.lazy(() => import("./pages/UniversalImporter"));

// Main app content with routing-aware CSS classes
function AppContent() {
  const [breadcrumbMap, setBreadcrumbMap] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Define routes that use tables (need fixed headers)
  const tableRoutes = [
    '/customers',
    '/projects',
    '/san/aliases',
    '/san/zones',
    '/san/fabrics',
    '/storage/systems',
    '/storage/hosts',
    '/storage/ports',
    '/tools/wwpn-colonizer',
    '/test'
  ];

  // Check for table routes including dynamic routes
  const isTablePage = tableRoutes.some(route => location.pathname === route) ||
                     location.pathname.match(/^\/storage\/\d+\/volumes$/) ||
                     location.pathname.match(/^\/storage\/\d+\/hosts$/) ||
                     location.pathname.match(/^\/storage\/\d+\/ports$/);

  // Define routes that should scroll normally (non-table pages)
  const scrollableRoutes = [
    '/',
    '/san',
    '/insights',
    '/config',
    '/settings',
    '/tools',
    '/storage',
    '/scripts',
    '/import',
    '/tools/custom-naming',
    '/profile',
    '/team'
  ];

  // Check for scrollable routes including dynamic routes
  const isScrollablePage = scrollableRoutes.some(route => location.pathname === route) ||
                          location.pathname.match(/^\/storage\/\d+$/) || // Storage detail pages
                          location.pathname.startsWith('/scripts/') ||
                          location.pathname.startsWith('/tools/ibm-storage-calculator') ||
                          location.pathname.startsWith('/import/') ||
                          location.pathname.startsWith('/settings/');

  // Determine CSS class for main content
  const getMainContentClass = () => {
    if (isTablePage) return 'main-content table-page';
    if (isScrollablePage) return 'main-content scrollable';
    return 'main-content'; // Default - no scrolling
  };

  return (
    <ConfigProvider>
      <ThemeProvider>
        <ThemedAppLayout 
          breadcrumbMap={breadcrumbMap}
          setBreadcrumbMap={setBreadcrumbMap}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          getMainContentClass={getMainContentClass}
        />
      </ThemeProvider>
    </ConfigProvider>
  );
}

// Component that has access to theme context
function ThemedAppLayout({ breadcrumbMap, setBreadcrumbMap, isSidebarCollapsed, setIsSidebarCollapsed, getMainContentClass }) {
  const { theme } = useTheme();
  
  return (
    <SanVendorProvider>
      <ImportStatusProvider>
        <SettingsProvider>
          <TableControlsProvider>
            <BreadcrumbContext.Provider value={{ breadcrumbMap, setBreadcrumbMap }}>
              <AppLayoutWithTableControls 
                theme={theme}
                isSidebarCollapsed={isSidebarCollapsed}
                setIsSidebarCollapsed={setIsSidebarCollapsed}
                getMainContentClass={getMainContentClass}
              />
            </BreadcrumbContext.Provider>
          </TableControlsProvider>
        </SettingsProvider>
      </ImportStatusProvider>
    </SanVendorProvider>
  );
}

// Component that can use TableControlsProvider
function AppLayoutWithTableControls({ theme, isSidebarCollapsed, setIsSidebarCollapsed, getMainContentClass }) {
  return (
    <div className={`app-layout theme-${theme} ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <header className="navbar-header">
        <Navbar />
      </header>
      <aside className="sidebar">
        <Sidebar 
          isCollapsed={isSidebarCollapsed}
          onCollapseChange={setIsSidebarCollapsed} 
        />
      </aside>
      <div className="topbar">
        <Breadcrumbs />
      </div>
      <main className={getMainContentClass()}>
                <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
                  <Routes>
                    <Route path="/" element={<CustomizableDashboard />} />
                    <Route path="/customers" element={<CustomerTable />} />
                    <Route path="/projects" element={<ProjectTable />} />
                    <Route path="/san" element={<SanPage />} />
                    <Route path="/insights" element={<InsightsPage />} />
                    <Route path="/san/aliases" element={<AliasTable />} />
                    <Route path="/san/zones" element={<ZoneTable />} />
                    <Route path="/storage" element={<StorageLandingPage />} />
                    <Route path="/storage/systems" element={<StorageTable />} />
                    <Route path="/storage/hosts" element={<HostTable />} />
                    <Route path="/storage/ports" element={<PortTable />} />
                    <Route path="/storage/:id" element={<StoragePage />} />
                    <Route path="/storage/:id/volumes" element={<StorageVolumesPage />} />
                    <Route path="/storage/:id/hosts" element={<StorageHostsPage />} />
                    <Route path="/storage/:id/ports" element={<StoragePortsPage />} />
                    <Route path="/san/fabrics" element={<FabricTable />} />
                    <Route path="/settings" element={<div style={{padding: '2rem'}}><h2>Settings</h2><p>Choose a settings category from the Settings dropdown in the navbar.</p></div>} />
                    <Route path="/settings/project-config" element={<ConfigForm />} />
                    <Route path="/settings/app-settings" element={<SettingsPage />} />
                    <Route path="/profile" element={<UserProfile />} />
                    <Route path="/team" element={<TeamManagement />} />
                    <Route path="/tools" element={<ToolsPage />} />
                    <Route path="/scripts" element={<ScriptsPage />} />
                    <Route path="/scripts/zoning" element={<ZoneScriptsPage />} />
                    <Route path="/scripts/storage" element={<StorageScriptsPage />} />
                    <Route path="/scripts/ds8000" element={<DS8000ScriptsPage />} />
                    <Route path="/scripts/flashsystem" element={<FlashsystemscriptsPage />} />
                    <Route path="/test" element={<TestFilters />} />
                    <Route path="/import" element={<div style={{padding: '2rem'}}><h2>Import Data</h2><p>Choose an import type from the Import dropdown in the navbar.</p></div>} />
                    <Route path="/import/universal" element={<UniversalImporter />} />
                    <Route path="/import/zoning" element={<BulkZoningImportPage />} />
                  <Route
                    path="/import/ibm-storage-insights"
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
                    path="/san/zones/zone-scripts"
                    element={<ZoneScriptsPage />}
                  />
                  <Route
                    path="/san/zones/zone-creation-scripts"
                    element={<ZoneCreationScriptsPage />}
                  />
                  <Route
                    path="/san/zones/zone-deletion-scripts"
                    element={<ZoneDeleteScriptsPage />}
                  />
                    <Route path="/import-data" element={<ImportSwitchConfig />} />
                    <Route path="/tools/custom-naming" element={<CustomNamingPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/*" element={
            <ProtectedRoute>
              <AppContent />
            </ProtectedRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
