import React, { useState } from "react";

const bytesPerCylinder = 849960; // IBM 3390 bytes per cylinder
const bytesPerGiB = Math.pow(1024, 3);
const bytesPerGB = Math.pow(10, 9);

const DS8kCKDPool = () => {
  const [cylinders, setCylinders] = useState("");
  const [extents, setExtents] = useState("");
  const [extentSize, setExtentSize] = useState(21);
  const [kmod1, setKmod1] = useState("");
  const [gib, setGib] = useState("");
  const [tib, setTib] = useState("");
  const [gb, setGb] = useState("");
  const [tb, setTb] = useState("");

  const handleCylindersChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    setCylinders(value);
    if (value) {
      const calculatedExtents = Math.ceil(parseInt(value, 10) / extentSize);
      setExtents(calculatedExtents.toString());
      calculateKMod1(calculatedExtents, extentSize);
      calculateStorage(calculatedExtents, extentSize);
    } else {
      resetFields();
    }
  };

  const handleExtentsChange = (e) => {
    const value = e.target.value.replace(/\D/g, "");
    setExtents(value);
    if (value) {
      const cyl = parseInt(value, 10) * extentSize;
      setCylinders(cyl.toString());
      calculateKMod1(parseInt(value, 10), extentSize);
      calculateStorage(parseInt(value, 10), extentSize);
    } else {
      resetFields();
    }
  };

  const handleKMod1Change = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    setKmod1(value);
    if (value) {
      const cylindersCalc = Math.ceil(parseFloat(value) * 1113 * 1000);
      setCylinders(cylindersCalc.toString());
      const calculatedExtents = Math.ceil(cylindersCalc / extentSize);
      setExtents(calculatedExtents.toString());
      calculateStorage(calculatedExtents, extentSize);
    } else {
      resetFields();
    }
  };

  const handleExtentSizeChange = (e) => {
    const value = parseInt(e.target.value, 10);
    setExtentSize(value);
    if (cylinders) {
      const calculatedExtents = Math.ceil(parseInt(cylinders, 10) / value);
      setExtents(calculatedExtents.toString());
      calculateKMod1(calculatedExtents, value);
      calculateStorage(calculatedExtents, value);
    }
  };

  const calculateKMod1 = (extents, size) => {
    const cylinders = extents * size;
    const kmod1Value = (cylinders / 1113 / 1000).toFixed(6);
    setKmod1(kmod1Value);
  };

  const calculateStorage = (extents, size) => {
    const cylinders = extents * size;
    const gibValue = (cylinders * bytesPerCylinder) / bytesPerGiB;
    const tibValue = gibValue / 1024;
    const gbValue = (cylinders * bytesPerCylinder) / bytesPerGB;
    const tbValue = gbValue / 1000;

    setGib(gibValue.toFixed(2));
    setTib(tibValue.toFixed(4));
    setGb(gbValue.toFixed(2));
    setTb(tbValue.toFixed(4));
  };

  const resetFields = () => {
    setExtents("");
    setKmod1("");
    setGib("");
    setTib("");
    setGb("");
    setTb("");
  };

  return (
    <>
      <h2 className="calculator-title">DS8K CKD Pool Calculator</h2>

      <label>Cylinders:</label>
      <input type="text" value={cylinders} onChange={handleCylindersChange} />

      <label>Extents:</label>
      <input type="text" value={extents} onChange={handleExtentsChange} />

      <label>Extent Size:</label>
      <select value={extentSize} onChange={handleExtentSizeChange}>
        <option value="21">21 Cylinders</option>
        <option value="1113">1113 Cylinders</option>
      </select>

      <label>KMod1:</label>
      <input value={kmod1} onChange={handleKMod1Change} />

      <label>GiB (Gibibytes):</label>
      <input value={gib} readOnly />

      <label>TiB (Tebibytes):</label>
      <input value={tib} readOnly />

      <label>GB (Gigabytes):</label>
      <input value={gb} readOnly />

      <label>TB (Terabytes):</label>
      <input value={tb} readOnly />
    </>
  );
};

export default DS8kCKDPool;
