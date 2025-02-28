import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Customers from "./pages/Customers";
import SanPage from "./pages/SanPage";
import AliasPage from "./pages/AliasPage";
import ZoningPage from "./pages/ZoningPage";
import StoragePage from "./pages/StoragePage";

function App() {
  return (
    <Router>
      <Navbar />
      <div className="container mt-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/san" element={<SanPage />} />
          <Route path="/san/alias" element={<AliasPage />} />
          <Route path="/san/zoning" element={<ZoningPage />} />
          <Route path="/storage" element={<StoragePage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;