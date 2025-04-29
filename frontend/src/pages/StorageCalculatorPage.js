import React, { useState } from "react";
import MainframeStorageCalculator from "../components/calculators/MainframeStorageCalculator";
import IBMiStorageCalculator from "../components/calculators/IBMiStorageCalculator";
import IBMiBlockConverter from "../components/calculators/IBMiBlockConverter";
import DS8kCKDPool from "../components/calculators/DS8kCKDPool";
import GeneralStorageConverter from "../components/calculators/GeneralStorageConverter";
import DataReplicationCalculator from "../components/calculators/DataReplicationCalculator";

import "../styles/tools.css";

const StorageCalculatorPage = () => {
  const [filters, setFilters] = useState({
    mainframe: true,
    ibmi: true,
    general: true,
    replication: true,
  });

  const handleFilterClick = (category, event) => {
    if (category === "all") {
      // Enable all filters when "Show All" is clicked
      setFilters({ mainframe: true, ibmi: true, general: true, replication: true });
      return;
    }
  
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
      <h1 className="text-center mb-4">Storage Calculators</h1>

      {/* Filter Buttons */}
      <div className="filter-buttons">
        <button
          className="filter-btn"
          onClick={() => handleFilterClick("all")}
        >
          Show All
        </button>
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
        <button 
          className={`filter-btn ${filters.general ? "active" : ""}`} 
          onClick={(e) => handleFilterClick("general", e)}
          >
          General Storage
        </button>
        <button 
          className={`filter-btn ${filters.replication ? "active" : ""}`} 
          onClick={(e) => handleFilterClick("replication", e)}
          >
          Replication
        </button>
      </div>

      {/* Flexible Grid Layout */}
      <div className="calculators-container">
        {filters.mainframe && (
          <div className="calculator-card">
            <MainframeStorageCalculator />
          </div>
        )}
        {filters.mainframe && (
          <div className="calculator-card">
            <DS8kCKDPool />
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
        {filters.general && (
          <div className="calculator-card">
            <GeneralStorageConverter />
          </div>
        )}
        {(filters.general || filters.replication) && (
          <div className="calculator-card">
            <DataReplicationCalculator />
          </div>
        )}
      </div>
    </div>
  );
};

export default StorageCalculatorPage;