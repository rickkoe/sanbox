import React from "react";
import StorageTable from "../components/StorageTable";
import Navbar from "../components/Navbar";

const StoragePage = () => {
  return (
    <div className="container mt-4">
      <Navbar />
      <h1>Storage Management</h1>
      <p>Manage storage devices below.</p>
      <StorageTable />
    </div>
  );
};

export default StoragePage;