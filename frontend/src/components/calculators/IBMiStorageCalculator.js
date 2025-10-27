import React, { useState } from "react";

const bytesPerBlock = 512;
const bytesPerKB = 1024;
const bytesPerMB = 1024 * 1024;
const bytesPerGB = 1024 * 1024 * 1024;
const bytesPerTB = 1024 * 1024 * 1024 * 1024;

// Protected and Unprotected IBM i Disk Models
const protectedModels = [
  { label: "Custom", blocks: 0 },
  { label: "A01 (Protected)", blocks: 16058880 },
  { label: "A02 (Protected)", blocks: 32117760 },
  { label: "A03 (Protected)", blocks: 64235520 },
  { label: "A04 (Protected)", blocks: 128471040 },
  { label: "A05 (Protected)", blocks: 256942080 },
  { label: "A06 (Protected)", blocks: 513884160 },
  { label: "A07 (Protected)", blocks: 1027768320 },
  { label: "099 (Protected)", blocks: 2055536640 },
];

const unprotectedModels = [
  { label: "A81 (Unprotected)", blocks: 17179869 },
  { label: "A82 (Unprotected)", blocks: 34359738 },
  { label: "A83 (Unprotected)", blocks: 68719476 },
  { label: "A84 (Unprotected)", blocks: 137438952 },
  { label: "A85 (Unprotected)", blocks: 274877904 },
  { label: "A86 (Unprotected)", blocks: 549755808 },
  { label: "A87 (Unprotected)", blocks: 1099511616 },
  { label: "050 (Unprotected)", blocks: 2199023232 },
];

const IBMiStorageCalculator = () => {
  const [selectedModel, setSelectedModel] = useState(protectedModels[0].blocks);
  const [blocks, setBlocks] = useState("");
  const [quantity, setQuantity] = useState("1"); // Volume count
  const [bytes, setBytes] = useState("");
  const [kb, setKb] = useState("");
  const [mb, setMb] = useState("");
  const [gb, setGb] = useState("");
  const [tb, setTb] = useState("");
  const [isProtected, setIsProtected] = useState(true); // Toggle for model type

  // Select model type (Protected/Unprotected)
  const handleTypeChange = (e) => {
    setIsProtected(e.target.value === "protected");
    setSelectedModel(0);
    resetValues();
  };

  // Handle model selection
  const handleModelChange = (e) => {
    const modelBlocks = parseInt(e.target.value, 10);
    setSelectedModel(modelBlocks);
    if (modelBlocks > 0) {
      updateValues(modelBlocks, parseInt(quantity, 10));
    } else {
      resetValues();
    }
  };

  const handleBlocksChange = (e) => {
    const blockCount = e.target.value.replace(/\D/g, ""); // Allow only numbers
    setBlocks(blockCount);
    setSelectedModel(0); // Custom input mode
    if (blockCount) {
      updateValues(parseInt(blockCount, 10), parseInt(quantity, 10));
    } else {
      resetValues();
    }
  };

  const handleQuantityChange = (e) => {
    const qty = e.target.value.replace(/\D/g, ""); // Allow only numbers
    setQuantity(qty);
    if (blocks) {
      updateValues(parseInt(blocks, 10), parseInt(qty, 10));
    }
  };

  const updateValues = (blockCount, qty) => {
    const newBytes = blockCount * bytesPerBlock * qty;
    setBlocks(blockCount.toString());
    setBytes(newBytes.toLocaleString());
    setKb((newBytes / bytesPerKB).toLocaleString());
    setMb((newBytes / bytesPerMB).toLocaleString());
    setGb((newBytes / bytesPerGB).toFixed(2));
    setTb((newBytes / bytesPerTB).toFixed(4));
  };

  const resetValues = () => {
    setBytes("");
    setKb("");
    setMb("");
    setGb("");
    setTb("");
  };

  return (
    <>
      <h2 className="calculator-title">IBM i (AS/400) Storage Calculator</h2>

      <label>Disk Type:</label>
      <select value={isProtected ? "protected" : "unprotected"} onChange={handleTypeChange}>
        <option value="protected">Protected (RAID)</option>
        <option value="unprotected">Unprotected</option>
      </select>

      <label>Standard Disk Model:</label>
      <select value={selectedModel} onChange={handleModelChange}>
        {(isProtected ? protectedModels : unprotectedModels).map((model, index) => (
          <option key={index} value={model.blocks}>
            {model.label}
          </option>
        ))}
      </select>

      <label>Blocks (512-byte units):</label>
      <input type="text" value={blocks} onChange={handleBlocksChange} />

      <label>Quantity of Volumes:</label>
      <input type="text" value={quantity} onChange={handleQuantityChange} />

      <label>Bytes:</label>
      <input type="text" value={bytes} readOnly />

      <label>Gigabytes (GB):</label>
      <input type="text" value={gb} readOnly />

      <label>Terabytes (TB):</label>
      <input type="text" value={tb} readOnly />
    </>
  );
};

export default IBMiStorageCalculator;