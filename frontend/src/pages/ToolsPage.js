import React from "react";
import { FaServer, FaCalculator } from "react-icons/fa"; // Import icons from react-icons
import "../styles/tools.css";

const ToolsPage = () => {
  return (
    <div className="container mt-5 text-center">
      <h1 className="mb-4">Tools</h1>
      
      <div className="tools-grid">
        {/* WWPN Colonizer Tool */}
        <a href="/tools/wwpn-colonizer" className="tool-card">
          <FaServer className="tool-icon" />
          <span>WWPN Colonizer</span>
        </a>

        {/* Storage Calculators Tool */}
        <a href="/tools/ibm-storage-calculator" className="tool-card">
          <FaCalculator className="tool-icon" />
          <span>Storage Calculators</span>
        </a>
      </div>
    </div>
  );
};

export default ToolsPage;


/*
🔥 Full List of Useful Icons

Here are some more icons you can use:

🖥 Storage & Server
	•	FaServer → 🔌 Server-related tools
	•	FaDatabase → 📀 Database or storage
	•	FaHdd → 💾 Hard disk / Flash storage
	•	FaFolderOpen → 📂 File system tools
	•	FaFileAlt → 📄 File/document-related tools

📊 Calculators & Performance
	•	FaCalculator → 🔢 Calculator tools
	•	FaChartLine → 📈 Performance charts
	•	FaChartPie → 📊 Storage allocation
	•	FaProjectDiagram → 🛠️ Architecture-related

🔁 Data Movement & Replication
	•	FaSync → 🔄 Data replication/mirroring
	•	FaExchangeAlt → 🔀 Data conversion/migration
	•	FaCloudUploadAlt → ☁️ Cloud sync tools

⚙️ Settings & Admin Tools
	•	FaCogs → ⚙️ General tool/settings
	•	FaToolbox → 🧰 General tools collection
	•	FaWrench → 🔧 Hardware or SAN maintenance
	•	FaNetworkWired → 🌐 SAN/NAS/Zoning tools

🔑 Security & Access
	•	FaLock → 🔒 Encryption/security
	•	FaUnlockAlt → 🔓 Access management
	•	FaUserShield → 🛡️ Authentication tools
  */