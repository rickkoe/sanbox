import React, { useState } from "react";

const DS8kCKDPool = () => {
  const [extents, setExtents] = useState("");
  const [extentSize, setExtentSize] = useState(21); // Default to 21 cylinders
  const [kmod1, setKmod1] = useState("");

  // Handle Extents Input and Calculate KMod1
  const handleExtentsChange = (e) => {
    const value = e.target.value.replace(/\D/g, ""); // Allow only numbers
    setExtents(value);
    if (value) {
      calculateKMod1(value, extentSize);
    } else {
      setKmod1(""); // Clear KMod1 if Extents is empty
    }
  };

  // Handle KMod1 Input and Calculate Extents
  const handleKMod1Change = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, ""); // Allow numbers & decimal
    setKmod1(value);
    if (value) {
      calculateExtents(value, extentSize);
    } else {
      setExtents(""); // Clear Extents if KMod1 is empty
    }
  };

  // Handle Extent Size Selection
  const handleExtentSizeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setExtentSize(value);
    if (extents) {
      calculateKMod1(extents, value);
    } else if (kmod1) {
      calculateExtents(kmod1, value);
    }
  };

  // Calculate KMod1 based on Extents
  const calculateKMod1 = (extents, size) => {
    const cylinders = parseInt(extents, 10) * size;
    const kmod1Value = ((cylinders / 1113) / 1000).toFixed(6);
    setKmod1(kmod1Value);
  };

  // Calculate Extents based on KMod1
  const calculateExtents = (kmod1, size) => {
    const cylinders = parseFloat(kmod1) * 1113 * 1000; // Reverse formula
    const extentsValue = Math.round(cylinders / size);
    setExtents(extentsValue.toString());
  };

  return (
    <div style={styles.container}>
      <h2>DS8K CKD Pool Calculator</h2>

      <label>Extents:</label>
      <input type="text" value={extents} onChange={handleExtentsChange} />

      <label>Extent Size:</label>
      <select value={extentSize} onChange={handleExtentSizeChange}>
        <option value="21">21 Cylinders</option>
        <option value="1113">1113 Cylinders</option>
      </select>

      <label>KMod1:</label>
      <input type="text" value={kmod1} onChange={handleKMod1Change} />
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "400px",
    margin: "20px auto",
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    background: "#f9f9f9",
    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
};

export default DS8kCKDPool;