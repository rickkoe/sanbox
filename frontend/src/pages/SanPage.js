import React from "react";
import SanNavbar from "../components/SanNavbar";

const SanPage = () => {
  return (
    <div className="container mt-4">
      <SanNavbar />  {/* Secondary navbar appears here */}
      <h1>SAN Page</h1>
      <p>Welcome to the SAN management section. Use the menu above to navigate.</p>
    </div>
  );
};

export default SanPage;