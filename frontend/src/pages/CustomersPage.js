import React from "react";
import CustomerTable from "../components/CustomerTable";

const CustomersPage = () => {
  return (
    <div className="container mt-4">

      {/* Embed CustomerTable component */}
      <CustomerTable />
    </div>
  );
};

export default CustomersPage;