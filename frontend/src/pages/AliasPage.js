import React from "react";
import AliasTable from "../components/tables/AliasTable"; // Import AliasTable
import SanNavbar from "../components/navigation/SanNavbar"; // Import the secondary SAN Navbar

const AliasPage = () => {
  return (
    <div className="container mt-4">
      <AliasTable />
    </div>
  );
};

export default AliasPage;
