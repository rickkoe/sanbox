import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import CustomerTable from "./pages/CustomerTable";
import SanPage from "./pages/SanPage";
import StoragePage from "./pages/StoragePage";

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/customers" element={<CustomerTable />} />
        <Route path="/san" element={<SanPage />} />
        <Route path="/storage" element={<StoragePage />} />
      </Routes>
    </Router>
  );
}

export default App;