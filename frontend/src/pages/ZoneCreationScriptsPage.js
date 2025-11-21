import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Tabs, Tab, Alert, Spinner, Badge } from "react-bootstrap";
import { ConfigContext } from "../context/ConfigContext";
import { useNavigate } from "react-router-dom";
import { useSanVendor } from "../context/SanVendorContext";
import JSZip from "jszip";

const ZoneCreationScriptsPage = () => {
  const { config } = useContext(ConfigContext);
  const { sanVendor } = useSanVendor();
  const [scripts, setScripts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyButtonText, setCopyButtonText] = useState("Copy to clipboard");
  const [downloadButtonText, setDownloadButtonText] = useState(
    "Download All Scripts"
  );
  const [activeTab, setActiveTab] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Wait until we actually have config loaded (assuming that an empty config means it's not loaded yet).
    if (!config || Object.keys(config).length === 0) {
      return;
    }

    if (!config.active_project?.id) {
      setError("No active project selected");
      setLoading(false);
      return;
    }

    const fetchScripts = async () => {
      try {
        const response = await axios.get(
          `/api/san/zone-creation-scripts/${config.active_project.id}/?vendor=${sanVendor}`
        );

        // Process the response based on its structure
        let processedScripts = {};

        if (response.data.zone_scripts) {
          if (
            typeof Object.values(response.data.zone_scripts)[0] === "object"
          ) {
            // New format with fabric_info
            processedScripts = response.data.zone_scripts;
          } else {
            // Old format (array of commands)
            processedScripts = Object.entries(
              response.data.zone_scripts
            ).reduce((acc, [key, value]) => {
              acc[key] = {
                commands: value,
                fabric_info: { san_vendor: sanVendor }, // Default to global context
              };
              return acc;
            }, {});
          }
        }

        setScripts(processedScripts);
        if (!activeTab && Object.keys(processedScripts).length > 0) {
          setActiveTab(Object.keys(processedScripts)[0]);
        }
      } catch (err) {
        console.error("Error fetching zone creation scripts:", err);
        setError("Error fetching zone creation scripts");
      } finally {
        setLoading(false);
      }
    };

    fetchScripts();
  }, [config, sanVendor]);

  const handleCopyToClipboard = () => {
    if (activeTab && scripts[activeTab]) {
      const header = `### ${activeTab.toUpperCase()} ZONE CREATION COMMANDS`;
      const commands = scripts[activeTab].commands || scripts[activeTab];
      const commandsText = Array.isArray(commands) ? commands.join("\n") : "";

      const textToCopy = `${header}\n${commandsText}`;

      navigator.clipboard
        .writeText(textToCopy)
        .then(() => {
          setCopyButtonText("Copied!");
          setTimeout(() => setCopyButtonText("Copy to clipboard"), 5000);
        })
        .catch((err) => {
          console.error("Clipboard copy failed:", err);
          alert("Failed to copy to clipboard.");
        });
    } else {
      alert("No active code block to copy.");
    }
  };

  const handleDownloadAllScripts = async () => {
    if (Object.keys(scripts).length === 0) {
      alert("No scripts available to download.");
      return;
    }

    const zip = new JSZip();
    const now = new Date(); // Current local time for file timestamps

    Object.entries(scripts).forEach(([fabricName, fabricData]) => {
      const commands = Array.isArray(fabricData)
        ? fabricData
        : fabricData.commands;

      const header = `### ${fabricName.toUpperCase()} ZONE CREATION COMMANDS`;
      const commandsText = Array.isArray(commands) ? commands.join("\n") : "";
      const fileContent = `${header}\n${commandsText}`;

      // Clean fabric name for filename
      const cleanFabricName = fabricName.replace(/[^a-zA-Z0-9_-]/g, "_");
      // Set file date explicitly to local time to avoid timezone issues in ZIP
      zip.file(`${cleanFabricName}_zone_creation_commands.txt`, fileContent, { date: now });
    });

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${config?.active_project?.name || "project"}_zone_creation_scripts.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadButtonText("Downloaded!");
      setTimeout(() => setDownloadButtonText("Download All Scripts"), 3000);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download scripts.");
    }
  };

  if (loading) {
    return (
      <div className="container mt-5 text-center">
        <Spinner animation="border" role="status">
          <span className="sr-only">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mt-5">
        <Alert variant="danger">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="table-container" style={{ paddingBottom: "50px" }}>
      {/* Modern Header with Styled Buttons */}
      <div className="modern-table-header">
        <div className="header-left">
          <div className="action-group">
            <button
              className="modern-btn modern-btn-secondary"
              onClick={() => navigate("/san/zones")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
              Back
            </button>
            
            <button
              className="modern-btn modern-btn-primary"
              onClick={handleCopyToClipboard}
              style={
                copyButtonText === "Copied!"
                  ? {
                      backgroundColor: "#10b981",
                      borderColor: "#10b981",
                    }
                  : {}
              }
            >
              {copyButtonText === "Copied!" ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5,15H4a2,2,0,0,1-2-2V4A2,2,0,0,1,4,2H13a2,2,0,0,1,2,2V5"/>
                  </svg>
                  Copy to clipboard
                </>
              )}
            </button>

            <button
              className="modern-btn modern-btn-primary"
              onClick={handleDownloadAllScripts}
              style={
                downloadButtonText === "Downloaded!"
                  ? {
                      backgroundColor: "#10b981",
                      borderColor: "#10b981",
                    }
                  : {}
              }
            >
              {downloadButtonText === "Downloaded!" ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  Downloaded!
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download All Scripts
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {scripts && Object.keys(scripts).length > 0 ? (
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          id="zone-creation-scripts-tabs"
          className="custom-tabs"
        >
          {Object.entries(scripts).map(([fabricName, fabricData]) => {
            // Handle both new format (object with commands and fabric_info) and old format (array of commands)
            const commands = Array.isArray(fabricData)
              ? fabricData
              : fabricData.commands;

            // Get vendor from fabric info or fall back to global context
            const fabricInfo = fabricData.fabric_info || {
              san_vendor: sanVendor,
            };
            const vendor = fabricInfo.san_vendor;

            return (
              <Tab
                eventKey={fabricName}
                key={fabricName}
                title={
                  <>
                    <Badge pill bg={vendor === "CI" ? "info" : "danger"}>
                      {vendor === "CI" ? "Cisco" : "Brocade"}
                    </Badge>{" "}
                    {fabricName}
                  </>
                }
              >
                <div className="code-block">
                  {commands.map((command, index) => (
                    <pre key={index}>{command || '\u00A0'}</pre>
                  ))}
                </div>
              </Tab>
            );
          })}
        </Tabs>
      ) : (
        <Alert variant="info">
          No zone creation scripts available. Verify the column "Create" is checked for
          the zones and aliases you want to create.
        </Alert>
        )}
    </div>
  );
};

export default ZoneCreationScriptsPage;