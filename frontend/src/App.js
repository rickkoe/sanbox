import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Customers from "./pages/Customers";
import SanPage from "./pages/SanPage";
import StoragePage from "./pages/StoragePage";

function App() {
  return (
    <Router>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/san" element={<SanPage />} />
        <Route path="/storage" element={<StoragePage />} />
      </Routes>
    </Router>
  );
}

export default App;