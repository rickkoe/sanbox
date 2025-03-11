import React from "react";
import IBMiStorageCalculator from "../components/IBMiStorageCalculator";
import IBMiBlockConverter from "../components/IBMiBlockConverter";

const IBMiStorageCalculatorPage = () => {
  return (
    <div className="container mt-4">
      <IBMiStorageCalculator />
      <IBMiBlockConverter />
        
    </div>
  );
};

export default IBMiStorageCalculatorPage;