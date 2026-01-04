// App.js
import React, { useState, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { useTheme } from "./context/ThemeContext";

// Custom Styles
import "./App.css";
import "./styles/navbar.css";
import "./styles/sidebar.css";
import "./styles/breadcrumbs.css";
import "./styles/tanstacktable.css";
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
import { ProjectFilterProvider } from "./context/ProjectFilterContext";
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
const SwitchTable = React.lazy(() => import("./components/tables/SwitchTableTanStack"));
const AliasTable = React.lazy(() => import("./components/tables/AliasTableTanStackClean"));
const ZoneTable = React.lazy(() => import("./components/tables/ZoneTableTanStackClean"));
const StorageTable = React.lazy(() => import("./components/tables/StorageTableTanStackClean"));
const StorageVolumesPage = React.lazy(() => import("./pages/StorageVolumesPage"));
const StorageVolumeRangesPage = React.lazy(() => import("./pages/StorageVolumeRangesPage"));
const StoragePoolsPage = React.lazy(() => import("./pages/StoragePoolsPage"));
const StorageHostsPage = React.lazy(() => import("./pages/StorageHostsPage"));
const StoragePortsPage = React.lazy(() => import("./pages/StoragePortsPage"));
const StorageDetailScriptsPage = React.lazy(() => import("./pages/StorageDetailScriptsPage"));
const StorageHostClustersPage = React.lazy(() => import("./pages/StorageHostClustersPage"));
const StorageIBMiLPARsPage = React.lazy(() => import("./pages/StorageIBMiLPARsPage"));
const StorageVolumeMappingsPage = React.lazy(() => import("./pages/StorageVolumeMappingsPage"));
const StorageLSSSummaryPage = React.lazy(() => import("./pages/StorageLSSSummaryPage"));
const PPRCPathsPage = React.lazy(() => import("./pages/PPRCPathsPage"));
const AllVolumesPage = React.lazy(() => import("./pages/AllVolumesPage"));
const PortTable = React.lazy(() => import("./components/tables/PortTableTanStackClean"));
const HostTable = React.lazy(() => import("./components/tables/HostTableTanStackClean"));
const ConfigForm = React.lazy(() => import("./components/forms/ConfigForm"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const WWPNFormatterTable = React.lazy(() => import("./components/tools/WWPNColonizer"));
const DS8000ScriptsPage = React.lazy(() => import("./pages/DS8000ScriptsPage"));
const FlashsystemscriptsPage = React.lazy(() => import("./pages/FlashsystemScriptsPage"));
const StorageScriptsPage = React.lazy(() => import("./pages/StorageScriptsPage"));
const ZoneScriptsPage = React.lazy(() => import("./pages/ZoneScriptsPage"));
const ImportSwitchConfig = React.lazy(() => import("./components/forms/ImportSwitchConfig"));
const TestFilters = React.lazy(() => import("./components/tables/TestFilters"));
const CustomNamingPage = React.lazy(() => import("./pages/CustomNamingPage"));
const UserProfile = React.lazy(() => import("./pages/UserProfile"));
const UniversalImporter = React.lazy(() => import("./pages/UniversalImporter"));
const ImportMonitor = React.lazy(() => import("./pages/ImportMonitor"));
const WorksheetGeneratorPage = React.lazy(() => import("./pages/WorksheetGeneratorPage"));
const BackupManagement = React.lazy(() => import("./pages/BackupManagement"));
const BackupDashboard = React.lazy(() => import("./pages/BackupDashboard"));
const RestoreHistory = React.lazy(() => import("./pages/RestoreHistory"));
const ThemeDemo = React.lazy(() => import("./pages/ThemeDemo"));
const UserManual = React.lazy(() => import("./pages/UserManual"));
const AuditLog = React.lazy(() => import("./pages/AuditLog"));
const ProjectSummary = React.lazy(() => import("./pages/ProjectSummary"));

// Main app content with routing-aware CSS classes
function AppContent() {
  const [breadcrumbMap, setBreadcrumbMap] = useState({});
  const [storageTypeMap, setStorageTypeMap] = useState({});
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const location = useLocation();

  // Define routes that use tables (need fixed headers)
  const tableRoutes = [
    '/customers',
    '/projects',
    '/san/switches',
    '/san/aliases',
    '/san/zones',
    '/san/fabrics',
    '/storage/systems',
    '/storage/hosts',
    '/storage/ports',
    '/storage/volumes',
    '/tools/wwpn-colonizer',
    '/test'
  ];

  // Check for table routes including dynamic routes
  const isTablePage = tableRoutes.some(route => location.pathname === route) ||
                     location.pathname.match(/^\/storage\/\d+\/volumes$/) ||
                     location.pathname.match(/^\/storage\/\d+\/volume-ranges$/) ||
                     location.pathname.match(/^\/storage\/\d+\/pools$/) ||
                     location.pathname.match(/^\/storage\/\d+\/hosts$/) ||
                     location.pathname.match(/^\/storage\/\d+\/ports$/) ||
                     location.pathname.match(/^\/storage\/\d+\/host-clusters$/) ||
                     location.pathname.match(/^\/storage\/\d+\/ibmi-lpars$/) ||
                     location.pathname.match(/^\/storage\/\d+\/volume-mappings$/) ||
                     location.pathname.match(/^\/storage\/\d+\/lss-summary$/);

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
    '/settings/backups',
    '/settings/backups/dashboard',
    '/settings/backups/restore-history',
    '/audit-log',
    '/manual'
  ];

  // Check for scrollable routes including dynamic routes
  const isScrollablePage = scrollableRoutes.some(route => location.pathname === route) ||
                          location.pathname.match(/^\/storage\/\d+$/) || // Storage detail pages
                          location.pathname.match(/^\/storage\/\d+\/pprc-paths$/) || // PPRC paths page
                          location.pathname.startsWith('/scripts/') ||
                          location.pathname.startsWith('/tools/ibm-storage-calculator') ||
                          location.pathname.startsWith('/tools/doc-builder') ||
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
      <ProjectFilterProvider>
        <ThemeProvider>
          <ThemedAppLayout
            breadcrumbMap={breadcrumbMap}
            setBreadcrumbMap={setBreadcrumbMap}
            storageTypeMap={storageTypeMap}
            setStorageTypeMap={setStorageTypeMap}
            isSidebarCollapsed={isSidebarCollapsed}
            setIsSidebarCollapsed={setIsSidebarCollapsed}
            getMainContentClass={getMainContentClass}
          />
        </ThemeProvider>
      </ProjectFilterProvider>
    </ConfigProvider>
  );
}

// Component that has access to theme context
function ThemedAppLayout({ breadcrumbMap, setBreadcrumbMap, storageTypeMap, setStorageTypeMap, isSidebarCollapsed, setIsSidebarCollapsed, getMainContentClass }) {
  const { theme } = useTheme();

  return (
    <SanVendorProvider>
      <ImportStatusProvider>
        <SettingsProvider>
          <TableControlsProvider>
            <BreadcrumbContext.Provider value={{ breadcrumbMap, setBreadcrumbMap, storageTypeMap, setStorageTypeMap }}>
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
                    <Route path="/storage" element={<StorageTable />} />
                    <Route path="/storage/hosts" element={<HostTable />} />
                    <Route path="/storage/ports" element={<PortTable />} />
                    <Route path="/storage/volumes" element={<AllVolumesPage />} />
                    <Route path="/storage/:id" element={<StoragePage />} />
                    <Route path="/storage/:id/volumes" element={<StorageVolumesPage />} />
                    <Route path="/storage/:id/volume-ranges" element={<StorageVolumeRangesPage />} />
                    <Route path="/storage/:id/pools" element={<StoragePoolsPage />} />
                    <Route path="/storage/:id/hosts" element={<StorageHostsPage />} />
                    <Route path="/storage/:id/ports" element={<StoragePortsPage />} />
                    <Route path="/storage/:id/host-clusters" element={<StorageHostClustersPage />} />
                    <Route path="/storage/:id/ibmi-lpars" element={<StorageIBMiLPARsPage />} />
                    <Route path="/storage/:id/volume-mappings" element={<StorageVolumeMappingsPage />} />
                    <Route path="/storage/:id/lss-summary" element={<StorageLSSSummaryPage />} />
                    <Route path="/storage/:id/pprc-paths" element={<PPRCPathsPage />} />
                    <Route path="/storage/:id/scripts" element={<StorageDetailScriptsPage />} />
                    <Route path="/san/fabrics" element={<FabricTable />} />
                    <Route path="/san/switches" element={<SwitchTable />} />
                    <Route path="/settings" element={<div style={{padding: '2rem'}}><h2>Settings</h2><p>Choose a settings category from the Settings dropdown in the navbar.</p></div>} />
                    <Route path="/settings/project-config" element={<ConfigForm />} />
                    <Route path="/settings/project" element={<ProjectSummary />} />
                    <Route path="/settings/app-settings" element={<SettingsPage />} />
                    <Route path="/profile" element={<UserProfile />} />
                    <Route path="/tools" element={<ToolsPage />} />
                    <Route path="/scripts" element={<ScriptsPage />} />
                    <Route path="/scripts/zoning" element={<ZoneScriptsPage />} />
                    <Route path="/scripts/storage" element={<StorageScriptsPage />} />
                    <Route path="/scripts/ds8000" element={<DS8000ScriptsPage />} />
                    <Route path="/scripts/flashsystem" element={<FlashsystemscriptsPage />} />
                    <Route path="/test" element={<TestFilters />} />
                    <Route path="/import" element={<div style={{padding: '2rem'}}><h2>Import Data</h2><p>Choose an import type from the Import dropdown in the navbar.</p></div>} />
                    <Route path="/import/universal" element={<UniversalImporter />} />
                    <Route path="/import/monitor" element={<ImportMonitor />} />
                  <Route
                    path="/tools/wwpn-colonizer"
                    element={<WWPNFormatterTable />}
                  />
                  <Route
                    path="/tools/ibm-storage-calculator"
                    element={<StorageCalculatorPage />}
                  />
                  <Route
                    path="/tools/doc-builder"
                    element={<WorksheetGeneratorPage />}
                  />
                  <Route
                    path="/san/zones/zone-scripts"
                    element={<ZoneScriptsPage />}
                  />
                    <Route path="/import-data" element={<ImportSwitchConfig />} />
                    <Route path="/tools/custom-naming" element={<CustomNamingPage />} />
                    <Route path="/settings/backups" element={<BackupManagement />} />
                    <Route path="/settings/backups/dashboard" element={<BackupDashboard />} />
                    <Route path="/settings/backups/restore-history" element={<RestoreHistory />} />
                    <Route path="/audit-log" element={<AuditLog />} />
                    <Route path="/manual" element={<UserManual />} />
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
          <Route path="/theme-demo" element={
            <Suspense fallback={<LoadingSpinner />}>
              <ThemeDemo />
            </Suspense>
          } />
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
