import React, { useState } from "react";

const IBMiBlockConverter = () => {
  const [volumeSize, setVolumeSize] = useState(""); // Volume Size in GiB
  const [ibmiSize, setIbmiSize] = useState(""); // IBM i Size in GB

  // Conversion Functions
  const convertToIBMiSize = (size) => {
    return ((Math.pow(1024, 3) * size * 8) / (9 * 1e9)).toFixed(2);
  };

  const convertToVolumeSize = (size) => {
    return ((size * 9 * 1e9) / (Math.pow(1024, 3) * 8)).toFixed(2);
  };

  // Handle changes in Volume Size
  const handleVolumeSizeChange = (e) => {
    const size = e.target.value.replace(/[^0-9.]/g, ""); // Allow numbers & decimal
    setVolumeSize(size);
    if (size) {
      setIbmiSize(convertToIBMiSize(parseFloat(size)) + " GB");
    } else {
      setIbmiSize("");
    }
  };

  // Handle changes in IBM i Size
  const handleIBMiSizeChange = (e) => {
    const size = e.target.value.replace(/[^0-9.]/g, ""); // Allow numbers & decimal
    setIbmiSize(size);
    if (size) {
      setVolumeSize(convertToVolumeSize(parseFloat(size)) + " GiB");
    } else {
      setVolumeSize("");
    }
  };

  return (
    <div style={styles.container}>
      <h2>IBM i 520-byte Block Volume Converter</h2>

      <label>Volume Size (GiB):</label>
      <input type="text" value={volumeSize} onChange={handleVolumeSizeChange} />

      <label>IBM i Equivalent Size (GB):</label>
      <input type="text" value={ibmiSize} onChange={handleIBMiSizeChange} />
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

export default IBMiBlockConverter;