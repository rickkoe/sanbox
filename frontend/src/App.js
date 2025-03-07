import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Sidebar from "./components/Sidebar";
import SanNavbar from "./components/SanNavbar";
import Breadcrumbs from "./components/Breadcrumbs"; 
import Home from "./pages/Home";
import CustomersPage from "./pages/CustomersPage";
import SanPage from "./pages/SanPage";
import AliasPage from "./pages/AliasPage";
import ZoningPage from "./pages/ZoningPage";
import StoragePage from "./pages/StoragePage";
import FabricPage from "./pages/FabricPage";
import ConfigPage from "./pages/ConfigPage";
import { SanVendorProvider } from "./context/SanVendorContext";
import { ConfigProvider } from "./context/ConfigContext";

function App() {
  // ✅ Load sidebar state from localStorage
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    JSON.parse(localStorage.getItem("sidebarOpen")) || false
  );

  // ✅ Save sidebar state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("sidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  return (
    <Router>
      <ConfigProvider>
        <SanVendorProvider> 
          <Navbar toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />
          <Sidebar isOpen={isSidebarOpen} />
          
          {/* ✅ Shift content when sidebar is open */}
          <div className={`app-container ${isSidebarOpen ? "shifted" : ""}`}>
            <Breadcrumbs />
            <SanNavbarWrapper />
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
              </Routes>
            </div>
          </div>
        </SanVendorProvider>
      </ConfigProvider>
    </Router>
  );
}

// ✅ Wrapper to conditionally show SanNavbar only on `/san/*` routes
const SanNavbarWrapper = () => {
  const location = useLocation();
  return location.pathname.startsWith("/san/") ? <SanNavbar /> : null;
};

export default App;