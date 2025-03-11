import React, { useState } from "react";

const GeneralStorageConverter = () => {
  const [bytes, setBytes] = useState("");

  // Conversion Factors
  const KB = 1000, KiB = 1024;
  const MB = KB * 1000, MiB = KiB * 1024;
  const GB = MB * 1000, GiB = MiB * 1024;
  const TB = GB * 1000, TiB = GiB * 1024;
  const Gb = GB * 8, Mb = MB * 8, Tb = TB * 8;

  const updateValues = (newBytes) => {
    if (!newBytes || isNaN(newBytes)) {
      setBytes("");
      return;
    }
    setBytes(newBytes);
  };

  // Input handlers
  const handleBytesChange = (e) => updateValues(parseFloat(e.target.value) || 0);
  const handleKBChange = (e) => updateValues((parseFloat(e.target.value) || 0) * KB);
  const handleKiBChange = (e) => updateValues((parseFloat(e.target.value) || 0) * KiB);
  const handleMBChange = (e) => updateValues((parseFloat(e.target.value) || 0) * MB);
  const handleMiBChange = (e) => updateValues((parseFloat(e.target.value) || 0) * MiB);
  const handleGBChange = (e) => updateValues((parseFloat(e.target.value) || 0) * GB);
  const handleGiBChange = (e) => updateValues((parseFloat(e.target.value) || 0) * GiB);
  const handleTBChange = (e) => updateValues((parseFloat(e.target.value) || 0) * TB);
  const handleTiBChange = (e) => updateValues((parseFloat(e.target.value) || 0) * TiB);
  const handleGbChange = (e) => updateValues((parseFloat(e.target.value) || 0) * Gb / 8);
  const handleMbChange = (e) => updateValues((parseFloat(e.target.value) || 0) * Mb / 8);
  const handleTbChange = (e) => updateValues((parseFloat(e.target.value) || 0) * Tb / 8);

  return (
    <div style={styles.container}>
      <h2>General Storage Converter</h2>

      <label>Bytes (B):</label>
      <input type="text" value={bytes} onChange={handleBytesChange} />

      <label>Kilobytes (KB):</label>
      <input type="text" value={bytes / KB} onChange={handleKBChange} />

      <label>Kibibytes (KiB):</label>
      <input type="text" value={bytes / KiB} onChange={handleKiBChange} />

      <label>Megabytes (MB):</label>
      <input type="text" value={bytes / MB} onChange={handleMBChange} />

      <label>Mebibytes (MiB):</label>
      <input type="text" value={bytes / MiB} onChange={handleMiBChange} />

      <label>Gigabytes (GB):</label>
      <input type="text" value={bytes / GB} onChange={handleGBChange} />

      <label>Gibibytes (GiB):</label>
      <input type="text" value={bytes / GiB} onChange={handleGiBChange} />

      <label>Terabytes (TB):</label>
      <input type="text" value={bytes / TB} onChange={handleTBChange} />

      <label>Tebibytes (TiB):</label>
      <input type="text" value={bytes / TiB} onChange={handleTiBChange} />

      <label>Gigabits (Gb):</label>
      <input type="text" value={bytes * 8 / Gb} onChange={handleGbChange} />

      <label>Megabits (Mb):</label>
      <input type="text" value={bytes * 8 / Mb} onChange={handleMbChange} />

      <label>Terabits (Tb):</label>
      <input type="text" value={bytes * 8 / Tb} onChange={handleTbChange} />
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
    background: "#fff",
    boxShadow: "0px 4px 6px rgba(0, 0, 0, 0.1)",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
};

export default GeneralStorageConverter;