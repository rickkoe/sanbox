import React from "react";
import AliasTable from "../components/AliasTable"; // Import AliasTable
import SanNavbar from "../components/SanNavbar"; // Import the secondary SAN Navbar

const AliasPage = () => {
  return (
    <div className="container mt-4">
      <SanNavbar />  {/* ✅ Displays the SAN Navbar */}
      <h1>Aliases</h1>
      
      {/* ✅ Alias Table is now included */}
      <AliasTable />
    </div>
  );
};

export default AliasPage;