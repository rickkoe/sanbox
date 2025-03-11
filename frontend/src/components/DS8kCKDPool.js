import React, { useState } from "react";

const bytesPerCylinder = 849960; // IBM 3390 bytes per cylinder
const bytesPerGiB = Math.pow(1024, 3);
const bytesPerTiB = Math.pow(1024, 4);

const DS8kCKDPool = () => {
  const [extents, setExtents] = useState("");
  const [extentSize, setExtentSize] = useState(21); // Default to 21 cylinders
  const [kmod1, setKmod1] = useState("");
  const [gib, setGib] = useState("");
  const [tib, setTib] = useState("");

  // Handle Extents Input and Calculate KMod1, GiB, TiB
  const handleExtentsChange = (e) => {
    const value = e.target.value.replace(/\D/g, ""); // Allow only numbers
    setExtents(value);
    if (value) {
      calculateKMod1(value, extentSize);
      calculateStorage(value, extentSize);
    } else {
      setKmod1("");
      setGib("");
      setTib("");
    }
  };

  // Handle KMod1 Input and Calculate Extents, GiB, TiB
  const handleKMod1Change = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, ""); // Allow numbers & decimal
    setKmod1(value);
    if (value) {
      calculateExtents(value, extentSize);
    } else {
      setExtents("");
      setGib("");
      setTib("");
    }
  };

  // Handle Extent Size Selection
  const handleExtentSizeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setExtentSize(value);
    if (extents) {
      calculateKMod1(extents, value);
      calculateStorage(extents, value);
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
    const cylinders = parseFloat(kmod1) * 1113 * 1000;
    const extentsValue = Math.round(cylinders / size);
    setExtents(extentsValue.toString());
    calculateStorage(extentsValue, size);
  };

  // Calculate GiB and TiB based on cylinders
  const calculateStorage = (extents, size) => {
    const cylinders = parseInt(extents, 10) * size;
    const gibValue = (cylinders * bytesPerCylinder) / bytesPerGiB;
    const tibValue = gibValue / 1024;
    setGib(gibValue.toFixed(2));
    setTib(tibValue.toFixed(4));
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

      <label>GiB (Gibibytes):</label>
      <input type="text" value={gib} readOnly />

      <label>TiB (Tebibytes):</label>
      <input type="text" value={tib} readOnly />
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