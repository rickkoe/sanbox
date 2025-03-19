import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/navigation/Navbar";
import Sidebar from "./components/navigation/Sidebar";
import Breadcrumbs from "./components/navigation/Breadcrumbs";
import Home from "./pages/Home";
import CustomersPage from "./pages/CustomersPage";
import SanPage from "./pages/SanPage";
import AliasPage from "./pages/AliasPage";
import ZoningPage from "./pages/ZoningPage";
import StoragePage from "./pages/StoragePage";
import FabricPage from "./pages/FabricPage";
import ConfigPage from "./pages/ConfigPage";
import ToolsPage from "./pages/ToolsPage";
import WwpnColonizerPage from "./pages/WWPNColonizerPage";
import StorageCalculatorPage from "./pages/StorageCalculatorPage";
import NotFound from "./pages/NotFound";
import { SanVendorProvider } from "./context/SanVendorContext";
import { ConfigProvider } from "./context/ConfigContext";

import "./App.css";

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    JSON.parse(localStorage.getItem("sidebarOpen")) || false
  );

  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  return (
    <Router>
      <ConfigProvider>
        <SanVendorProvider>
          <div className="navbar">
            <Navbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
          </div>

          <div className={`sidebar ${isSidebarOpen ? "open" : "closed"}`}>
            <Sidebar isOpen={isSidebarOpen} />
          </div>

          <div className="main-content">
            <div className="breadcrumb-container">
              <Breadcrumbs />
            </div>
            <div className="container mt-4">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/customers" element={<CustomersPage />} />
                <Route path="/san" element={<SanPage />} />
                <Route path="/san/aliases" element={<AliasPage />} />
                <Route path="/san/zones" element={<ZoningPage />} />
                <Route path="/storage" element={<StoragePage />} />
                <Route path="/san/fabrics" element={<FabricPage />} />
                <Route path="/config" element={<ConfigPage />} />
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
