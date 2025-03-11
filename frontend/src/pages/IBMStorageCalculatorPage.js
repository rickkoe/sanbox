import React from "react";
import MainframeStorageCalculator from "../components/MainframeStorageCalculator";
import IBMiStorageCalculator from "../components/IBMiStorageCalculator";
import IBMiBlockConverter from "../components/IBMiBlockConverter";
import "../styles/tools.css"

const IBMStorageCalculatorPage = () => {
  return (
    <div className="tools-container mt-4">
      <h1 className="text-center mb-4">IBM Storage Calculators</h1>
      
      {/* Flexible Grid Layout */}
      <div className="calculators-container">
        <div className="calculator-card">
            <MainframeStorageCalculator />
        </div>
        <div className="calculator-card">
          <IBMiStorageCalculator />
        </div>
        <div className="calculator-card">
          <IBMiBlockConverter />
        </div>
      </div>
    </div>
  );
};

export default IBMStorageCalculatorPage;