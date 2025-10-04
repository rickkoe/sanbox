import React, { useState } from "react";

const bytesPerCylinder = 849960;
const bytesPerGB = 1_073_741_824; // 1 GB = 1024^3 bytes
const bytesPerTB = 1_099_511_627_776; // 1 TB = 1024^4 bytes

// Easily expandable tuple of disk models
const diskModels = [
  { label: "Custom", cylinders: 0 },
  { label: "3390-1 (MOD 1)", cylinders: 1113 },
  { label: "3390-3 (MOD 3)", cylinders: 3339 },
  { label: "3390-9 (MOD 9)", cylinders: 10017 },
  { label: "3390-27 (MOD 27)", cylinders: 30051 },
  { label: "3390-54 (MOD 54)", cylinders: 65520 },
];

const MainframeStorageCalculator = () => {
  const [selectedModel, setSelectedModel] = useState(diskModels[0].cylinders);
  const [cylinders, setCylinders] = useState("");
  const [quantity, setQuantity] = useState("1"); // New volume quantity field
  const [bytes, setBytes] = useState("");
  const [gigabytes, setGigabytes] = useState("");
  const [terabytes, setTerabytes] = useState("");

  // Handle model selection
  const handleModelChange = (e) => {
    const modelCylinders = parseInt(e.target.value, 10);
    setSelectedModel(modelCylinders);
    if (modelCylinders > 0) {
      updateValues(modelCylinders, parseInt(quantity, 10));
    } else {
      resetValues();
    }
  };

  const handleCylindersChange = (e) => {
    const cyl = e.target.value.replace(/\D/g, ""); // Allow only numbers
    setCylinders(cyl);
    setSelectedModel(0); // Custom input mode
    if (cyl) {
      updateValues(parseInt(cyl, 10), parseInt(quantity, 10));
    } else {
      resetValues();
    }
  };

  const handleQuantityChange = (e) => {
    const qty = e.target.value.replace(/\D/g, ""); // Allow only numbers
    setQuantity(qty);
    if (cylinders) {
      updateValues(parseInt(cylinders, 10), parseInt(qty, 10));
    }
  };

  const handleBytesChange = (e) => {
    const newBytes = parseFloat(e.target.value.replace(/,/g, "")) || 0;
    const cyl = newBytes / bytesPerCylinder;
    setSelectedModel(0);
    updateValues(cyl, parseInt(quantity, 10));
  };

  const handleGBChange = (e) => {
    const gb = parseFloat(e.target.value) || 0;
    const newBytes = gb * bytesPerGB;
    const cyl = newBytes / bytesPerCylinder;
    setSelectedModel(0);
    updateValues(cyl, parseInt(quantity, 10));
  };

  const handleTBChange = (e) => {
    const tb = parseFloat(e.target.value) || 0;
    const newBytes = tb * bytesPerTB;
    const cyl = newBytes / bytesPerCylinder;
    setSelectedModel(0);
    updateValues(cyl, parseInt(quantity, 10));
  };

  const updateValues = (cyl, qty) => {
    const newBytes = cyl * bytesPerCylinder * qty;
    setCylinders(cyl.toString());
    setBytes(newBytes.toLocaleString());
    setGigabytes((newBytes / bytesPerGB).toFixed(2));
    setTerabytes((newBytes / bytesPerTB).toFixed(4));
  };

  const resetValues = () => {
    setBytes("");
    setGigabytes("");
    setTerabytes("");
  };

  return (
    <div style={styles.container}>
      <h2>IBM 3390 Storage Calculator</h2>

      <label>Standard Disk Model:</label>
      <select value={selectedModel} onChange={handleModelChange}>
        {diskModels.map((model, index) => (
          <option key={index} value={model.cylinders}>
            {model.label}
          </option>
        ))}
      </select>

      <label>Cylinders:</label>
      <input type="text" value={cylinders} onChange={handleCylindersChange} />

      <label>Quantity of Volumes:</label>
      <input type="text" value={quantity} onChange={handleQuantityChange} />

      <label>Bytes:</label>
      <input type="text" value={bytes} onChange={handleBytesChange} />

      <label>Gigabytes (GB):</label>
      <input type="number" value={gigabytes} onChange={handleGBChange} />

      <label>Terabytes (TB):</label>
      <input type="number" value={terabytes} onChange={handleTBChange} />
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "400px",
    margin: "20px auto",
    padding: "20px",
    border: "1px solid #ccc",
    borderRadius: "8px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
};

export default MainframeStorageCalculator;