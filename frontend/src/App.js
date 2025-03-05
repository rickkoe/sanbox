import React from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import SanNavbar from "./components/SanNavbar";
import Navbar from "./components/Navbar";
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

function App() {
  return (
    <Router>
      <SanVendorProvider>  {/* ✅ Now inside Router */}
        <Navbar />
        <Breadcrumbs /> {/* ✅ Display breadcrumb below the navbar */}
        <SanNavbarWrapper /> {/* ✅ Conditionally render SanNavbar */}
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
      </SanVendorProvider>
    </Router>
  );
}

// ✅ Wrapper to conditionally show SanNavbar only on `/san/*` routes
const SanNavbarWrapper = () => {
  const location = useLocation();
  return location.pathname.startsWith("/san/") ? <SanNavbar /> : null;
};

export default App;