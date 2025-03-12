import React, { useState } from "react";
import "../styles/tools.css"; // Ensure styles are applied

const units = [
  { label: "Bytes (B)", value: "bytes", factor: 1 },
  { label: "Kilobytes (KB)", value: "kb", factor: 1000 },
  { label: "Megabytes (MB)", value: "mb", factor: 1000000 },
  { label: "Gigabytes (GB)", value: "gb", factor: 1000000000 },
  { label: "Terabytes (TB)", value: "tb", factor: 1000000000000 },
  { label: "Kibibytes (KiB)", value: "kib", factor: 1024 },
  { label: "Mebibytes (MiB)", value: "mib", factor: 1048576 },
  { label: "Gibibytes (GiB)", value: "gib", factor: 1073741824 },
  { label: "Tebibytes (TiB)", value: "tib", factor: 1099511627776 },
  { label: "Megabits (Mb)", value: "megabits", factor: 125000 },
  { label: "Gigabits (Gb)", value: "gigabits", factor: 125000000 },
  { label: "Terabits (Tb)", value: "terabits", factor: 125000000000 },
];

const GeneralStorageConverter = () => {
  const [inputValue, setInputValue] = useState("");
  const [sourceUnit, setSourceUnit] = useState("bytes");
  const [targetUnit, setTargetUnit] = useState("gb");
  const [convertedValue, setConvertedValue] = useState("");

  const handleInputChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, ""); // Allow only numbers & decimal
    setInputValue(value);
    if (value) {
      convertValue(value, sourceUnit, targetUnit);
    } else {
      setConvertedValue("");
    }
  };

  const handleSourceChange = (e) => {
    setSourceUnit(e.target.value);
    if (inputValue) {
      convertValue(inputValue, e.target.value, targetUnit);
    }
  };

  const handleTargetChange = (e) => {
    setTargetUnit(e.target.value);
    if (inputValue) {
      convertValue(inputValue, sourceUnit, e.target.value);
    }
  };

  const convertValue = (value, from, to) => {
    const fromFactor = units.find((unit) => unit.value === from).factor;
    const toFactor = units.find((unit) => unit.value === to).factor;

    const converted = (parseFloat(value) * fromFactor) / toFactor;
    setConvertedValue(converted % 1 === 0 ? converted.toString() : converted.toFixed(6).replace(/\.?0+$/, ""));
  };

  return (
    <div className="calculator-card">
      <h2>General Storage Converter</h2>

      <label>Enter Value:</label>
      <input type="text" value={inputValue} onChange={handleInputChange} />

      <label>Convert From:</label>
      <select value={sourceUnit} onChange={handleSourceChange}>
        {units.map((unit) => (
          <option key={unit.value} value={unit.value}>
            {unit.label}
          </option>
        ))}
      </select>

      <label>Convert To:</label>
      <select value={targetUnit} onChange={handleTargetChange}>
        {units.map((unit) => (
          <option key={unit.value} value={unit.value}>
            {unit.label}
          </option>
        ))}
      </select>

      <label>Converted Value:</label>
      <input type="text" value={convertedValue} readOnly />
    </div>
  );
};

export default GeneralStorageConverter;