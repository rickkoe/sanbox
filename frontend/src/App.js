import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

// Navigation Components
import Navbar from "./components/navigation/Navbar";
import Sidebar from "./components/navigation/Sidebar";
import Breadcrumbs from "./components/navigation/Breadcrumbs";

// Pages
import Home from "./pages/Home";
import SanPage from "./pages/SanPage";
import StoragePage from "./pages/StoragePage";
import NotFound from "./pages/NotFound";
import ToolsPage from "./pages/ToolsPage";
import WwpnColonizerPage from "./pages/WWPNColonizerPage";
import StorageCalculatorPage from "./pages/StorageCalculatorPage";

// Tables
import CustomerTable from "./components/tables/CustomerTable";
import FabricTable from "./components/tables/FabricTable";
import AliasTable from "./components/tables/AliasTable";
import ZoneTable from "./components/tables/ZoneTable";

// Forms
import ConfigForm from "./components/forms/ConfigForm";

// Context
import { SanVendorProvider } from "./context/SanVendorContext";
import { ConfigProvider } from "./context/ConfigContext";

// Custom Styles
import "./App.css";
import "./styles/navbar.css";
import "./styles/sidebar.css";
import "./styles/breadcrumbs.css";

function App() {

  return (
    <Router>
      <ConfigProvider>
        <SanVendorProvider>
          <div className="navbar">
            <Navbar />
          </div>

          <div className="sidebar">
            <Sidebar />
          </div>
          <div className="breadcrumb-container">
              <Breadcrumbs />
            </div>
          <div className="main-content">

            <div className="container mt-4">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/customers" element={<CustomerTable />} />
                <Route path="/san" element={<SanPage />} />
                <Route path="/san/aliases" element={<AliasTable />} />
                <Route path="/san/zones" element={<ZoneTable />} />
                <Route path="/storage" element={<StoragePage />} />
                <Route path="/san/fabrics" element={<FabricTable />} />
                <Route path="/config" element={<ConfigForm />} />
                <Route path="/tools" element={<ToolsPage />} />
                <Route path="/tools/wwpn-colonizer" element={<WwpnColonizerPage />} />
                <Route path="/tools/ibm-storage-calculator" element={<StorageCalculatorPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
          </div>
        </SanVendorProvider>
      </ConfigProvider>
    </Router>
  );
}

export default App;
