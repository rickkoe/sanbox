// App.js
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

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
import CustomerTable from "./components/tables/CustomerTable";
import FabricTable from "./components/tables/FabricTable";
import AliasTable from "./components/tables/AliasTable";
import ZoneTable from "./components/tables/ZoneTable";
import StorageTable from "./components/tables/StorageTable";
import StorageVolumesPage from "./pages/StorageVolumesPage";
import ConfigForm from "./components/forms/ConfigForm";
import WWPNFormatterTable from "./components/tools/WWPNColonizer";
import AliasScriptsPage from "./pages/AliasScriptsPage";
import ZoneScriptsPage from "./pages/ZoneScriptsPage";
import ImportSwitchConfig from "./components/forms/ImportSwitchConfig";
import StorageInsightsImporter from "./pages/StorageInsightsImporter";

// Context Providers
import { SanVendorProvider } from "./context/SanVendorContext";
import { ConfigProvider } from "./context/ConfigContext";

// Custom Styles
import "./App.css";
import "./styles/navbar.css";
import "./styles/sidebar.css";
import "./styles/breadcrumbs.css";
import "./styles/tables.css";
import "./styles/pages.css";
import "./styles/home.css";

function App() {
  const [breadcrumbMap, setBreadcrumbMap] = useState({});

  return (
    <Router>
      <ConfigProvider>
        <SanVendorProvider>
          <BreadcrumbContext.Provider value={{ breadcrumbMap, setBreadcrumbMap }}>
            <div className="app-layout">
              <header className="navbar">
                <Navbar />
              </header>
              <aside className="sidebar">
                <Sidebar />
              </aside>
              <div className="topbar">
                <Breadcrumbs />
              </div>
              <main className="main-content">
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/customers" element={<CustomerTable />} />
                  <Route path="/san" element={<SanPage />} />
                  <Route path="/san/aliases" element={<AliasTable />} />
                  <Route path="/san/zones" element={<ZoneTable />} />
                  <Route path="/storage" element={<StorageTable />} />
                  <Route path="/storage/:id" element={<StoragePage />} />
                  <Route path="/storage/:id/volumes" element={<StorageVolumesPage />} />
                  <Route path="/san/fabrics" element={<FabricTable />} />
                  <Route path="/config" element={<ConfigForm />} />
                  <Route path="/tools" element={<ToolsPage />} />
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
        </SanVendorProvider>
      </ConfigProvider>
    </Router>
  );
}

export default App;
