import React from "react";
import CustomerTable from "../components/CustomerTable";

const Customers = () => {
  return (
    <div className="container mt-4">
      <h1>Customers Page</h1>
      <p>Welcome to the Customers section. Here is the list of customers:</p>

      {/* Embed CustomerTable component */}
      <CustomerTable />
    </div>
  );
};

export default Customers;