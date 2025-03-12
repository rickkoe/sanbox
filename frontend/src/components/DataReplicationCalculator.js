import React, { useState, useEffect } from "react";

const DataReplicationCalculator = () => {
  const [dataSize, setDataSize] = useState("");
  const [dataSizeUnit, setDataSizeUnit] = useState("tb");
  const [dataRate, setDataRate] = useState("");
  const [dataRateUnit, setDataRateUnit] = useState("mbps");
  const [replicationTime, setReplicationTime] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });
  const [formattedTime, setFormattedTime] = useState("");

  const dataSizeUnits = [
    { label: "Bytes (B)", value: "bytes", factor: 1 },
    { label: "Kilobytes (KB)", value: "kb", factor: 1000 },
    { label: "Megabytes (MB)", value: "mb", factor: 1000000 },
    { label: "Gigabytes (GB)", value: "gb", factor: 1000000000 },
    { label: "Terabytes (TB)", value: "tb", factor: 1000000000000 },
    { label: "Petabytes (PB)", value: "pb", factor: 1000000000000000 },
  ];

  const dataRateUnits = [
    { label: "B/s (Bytes)", value: "bps", factor: 1 },
    { label: "KB/s (Kilobytes)", value: "kbps", factor: 1000 },
    { label: "MB/s (Megabytes)", value: "mbps", factor: 1000000 },
    { label: "GB/s (Gigabytes)", value: "gbps", factor: 1000000000 },
    { label: "Mbps (Megabits)", value: "megabits", factor: 125000 }, // 1 Megabit = 0.125 Megabytes
    { label: "Gbps (Gigabits)", value: "gigabits", factor: 125000000 }, // 1 Gigabit = 0.125 Gigabytes
  ];

  // Handle input changes
  const handleDataSizeChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    setDataSize(value);
  };

  const handleDataRateChange = (e) => {
    const value = e.target.value.replace(/[^0-9.]/g, "");
    setDataRate(value);
  };

  // Calculate replication time whenever inputs change
  useEffect(() => {
    if (dataSize && dataRate && parseFloat(dataRate) > 0) {
      calculateReplicationTime();
    } else {
      setReplicationTime({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      setFormattedTime("");
    }
  }, [dataSize, dataSizeUnit, dataRate, dataRateUnit]);

  const calculateReplicationTime = () => {
    // Convert data size to bytes
    const sizeInBytes = parseFloat(dataSize) * 
      dataSizeUnits.find(unit => unit.value === dataSizeUnit).factor;
    
    // Convert data rate to bytes per second
    const rateInBytesPerSecond = parseFloat(dataRate) * 
      dataRateUnits.find(unit => unit.value === dataRateUnit).factor;
    
    // Calculate total seconds for replication
    const totalSeconds = sizeInBytes / rateInBytesPerSecond;
    
    // Convert to days, hours, minutes, seconds
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    setReplicationTime({ days, hours, minutes, seconds });
    
    // Format the time string
    let timeString = "";
    if (days > 0) timeString += `${days} day${days !== 1 ? 's' : ''}, `;
    if (hours > 0 || days > 0) timeString += `${hours} hour${hours !== 1 ? 's' : ''}, `;
    if (minutes > 0 || hours > 0 || days > 0) timeString += `${minutes} minute${minutes !== 1 ? 's' : ''}, `;
    timeString += `${seconds} second${seconds !== 1 ? 's' : ''}`;
    
    setFormattedTime(timeString);
  };

  return (
    <div className="calculator-card show">
      <h2>Data Replication Calculator</h2>
      
      {/* Data Size Section */}
      <div>
        <label>Total Data Size:</label>
        <div style={{ display: "flex", gap: "5px", marginBottom: "15px" }}>
          <input
            type="text"
            value={dataSize}
            onChange={handleDataSizeChange}
            placeholder="Enter data size"
            style={{ flex: ".75" }}
          />
          <select
            value={dataSizeUnit}
            onChange={(e) => setDataSizeUnit(e.target.value)}
            style={{ flex: "1.1" }}
          >
            {dataSizeUnits.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Data Rate Section */}
      <div>
        <label>Data Transfer Rate:</label>
        <div style={{ display: "flex", gap: "5px", marginBottom: "20px" }}>
          <input
            type="text"
            value={dataRate}
            onChange={handleDataRateChange}
            placeholder="Enter data rate"
            style={{ flex: ".75" }}
          />
          <select
            value={dataRateUnit}
            onChange={(e) => setDataRateUnit(e.target.value)}
            style={{ flex: "1.1" }}
          >
            {dataRateUnits.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {/* Results Section */}
      <div style={{ 
        backgroundColor: "#f8f9fa", 
        padding: "15px", 
        borderRadius: "6px", 
        marginTop: "10px" 
      }}>
        <h3 style={{ marginTop: "0", marginBottom: "10px" }}>Estimated Replication Time:</h3>
        {formattedTime ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ 
              fontSize: "16px", 
              fontWeight: "bold", 
              marginBottom: "12px" 
            }}>{formattedTime}</p>
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(4, 1fr)", 
              gap: "8px", 
              textAlign: "center" 
            }}>
              <div style={{ 
                background: "#e6f2ff", 
                padding: "8px", 
                borderRadius: "4px" 
              }}>
                <div style={{ fontWeight: "bold", color: "#0066cc" }}>{replicationTime.days}</div>
                <div>Days</div>
              </div>
              <div style={{ 
                background: "#e6f2ff", 
                padding: "8px", 
                borderRadius: "4px" 
              }}>
                <div style={{ fontWeight: "bold", color: "#0066cc" }}>{replicationTime.hours}</div>
                <div>Hours</div>
              </div>
              <div style={{ 
                background: "#e6f2ff", 
                padding: "8px", 
                borderRadius: "4px" 
              }}>
                <div style={{ fontWeight: "bold", color: "#0066cc" }}>{replicationTime.minutes}</div>
                <div>Minutes</div>
              </div>
              <div style={{ 
                background: "#e6f2ff", 
                padding: "8px", 
                borderRadius: "4px" 
              }}>
                <div style={{ fontWeight: "bold", color: "#0066cc" }}>{replicationTime.seconds}</div>
                <div>Seconds</div>
              </div>
            </div>
          </div>
        ) : (
          <p style={{ 
            textAlign: "center", 
            fontStyle: "italic", 
            color: "#6c757d" 
          }}>Enter data size and rate to calculate</p>
        )}
      </div>
    </div>
  );
};

export default DataReplicationCalculator;