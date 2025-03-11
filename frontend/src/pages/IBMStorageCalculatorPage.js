import React, { useState } from "react";
import MainframeStorageCalculator from "../components/MainframeStorageCalculator";
import IBMiStorageCalculator from "../components/IBMiStorageCalculator";
import IBMiBlockConverter from "../components/IBMiBlockConverter";
import "../styles/tools.css";

const IBMStorageCalculatorPage = () => {
  const [filters, setFilters] = useState({
    mainframe: true,
    ibmi: true,
  });

  const handleFilterClick = (category, event) => {
    const isMultiSelect = event.shiftKey || event.ctrlKey || event.metaKey; // Detect Shift or Ctrl (Cmd on Mac)

    setFilters((prevFilters) => {
      let newState = { ...prevFilters };

      if (isMultiSelect) {
        // Toggle only the selected category
        newState[category] = !prevFilters[category];
      } else {
        // If no modifier key is pressed, show only the clicked category
        Object.keys(newState).forEach((key) => {
          newState[key] = key === category;
        });
      }

      return newState;
    });
  };

  return (
    <div className="tools-container mt-4">
      <h1 className="text-center mb-4">IBM Storage Calculators</h1>

      {/* Filter Buttons */}
      <div className="filter-buttons">
        <button
          className={`filter-btn ${filters.mainframe ? "active" : ""}`}
          onClick={(e) => handleFilterClick("mainframe", e)}
        >
          Mainframe
        </button>
        <button
          className={`filter-btn ${filters.ibmi ? "active" : ""}`}
          onClick={(e) => handleFilterClick("ibmi", e)}
        >
          IBM i
        </button>
      </div>

      {/* Flexible Grid Layout */}
      <div className="calculators-container">
        {filters.mainframe && (
          <div className="calculator-card">
            <MainframeStorageCalculator />
          </div>
        )}
        {filters.ibmi && (
          <div className="calculator-card">
            <IBMiStorageCalculator />
          </div>
        )}
        {filters.ibmi && (
          <div className="calculator-card">
            <IBMiBlockConverter />
          </div>
        )}
      </div>
    </div>
  );
};

export default IBMStorageCalculatorPage;