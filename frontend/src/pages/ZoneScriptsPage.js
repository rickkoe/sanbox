import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Tabs, Tab, Alert, Spinner, Button, Badge } from "react-bootstrap";
import { ConfigContext } from "../context/ConfigContext";
import { useNavigate } from "react-router-dom";
import { useSanVendor } from "../context/SanVendorContext";

const ZoneScriptsPage = () => {
  const { config } = useContext(ConfigContext);
  const { sanVendor } = useSanVendor();
  const [scripts, setScripts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copyButtonText, setCopyButtonText] = useState("Copy to clipboard");
  const [activeTab, setActiveTab] = useState(null);
  const navigate = useNavigate();
  const [isDirty, setIsDirty] = useState(false);

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
          `http://127.0.0.1:8000/api/san/zone-scripts/${config.active_project.id}/?vendor=${sanVendor}`
        );
        
        // Process the response based on its structure
        let processedScripts = {};
        
        if (response.data.zone_scripts) {
          if (typeof Object.values(response.data.zone_scripts)[0] === 'object') {
            // New format with fabric_info
            processedScripts = response.data.zone_scripts;
          } else {
            // Old format (array of commands)
            processedScripts = Object.entries(response.data.zone_scripts).reduce((acc, [key, value]) => {
              acc[key] = {
                commands: value,
                fabric_info: { san_vendor: sanVendor }  // Default to global context
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
        console.error("Error fetching zone scripts:", err);
        setError("Error fetching zone scripts");
      } finally {
        setLoading(false);
      }
    };
  
    fetchScripts();
  }, [config, sanVendor]);

  const handleCopyToClipboard = () => {
    if (activeTab && scripts[activeTab]) {
      const header = `### ${activeTab.toUpperCase()} zone COMMANDS`;
      const commands = scripts[activeTab].commands || scripts[activeTab];
      const commandsText = Array.isArray(commands) ? commands.join('\n') : '';
      
      const textToCopy = `${header}\n${commandsText}`;
      
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          setCopyButtonText("Copied!");
          setTimeout(() => setCopyButtonText("Copy to clipboard"), 5000);
        })
        .catch((err) => {
          console.error('Clipboard copy failed:', err);
          alert('Failed to copy to clipboard.');
        });
    } else {
      alert('No active code block to copy.');
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
    <div className="table-container">
      <div>
        <Button
          className="back-button"
          onClick={() => navigate("/san/zones")}
        >
          <span className="arrow">←</span> Back
        </Button>
        <Button
          className="save-button"
          onClick={handleCopyToClipboard}
          style={copyButtonText === "Copied!" ? { backgroundColor: 'white', color: 'black', borderColor: 'black' } : {}}
        >
          {copyButtonText === "Copied!" ? (<span>&#x2714; Copied!</span>) : "Copy to clipboard"}
        </Button>
      </div>
      
      {scripts && Object.keys(scripts).length > 0 ? (
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          id="zone-scripts-tabs"
          className="custom-tabs"
        >
          {Object.entries(scripts).map(([fabricName, fabricData]) => {
            // Handle both new format (object with commands and fabric_info) and old format (array of commands)
            const commands = Array.isArray(fabricData) ? fabricData : fabricData.commands;
            
            // Get vendor from fabric info or fall back to global context
            const fabricInfo = fabricData.fabric_info || { san_vendor: sanVendor };
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
                  <pre>### {fabricName.toUpperCase()} ZONE COMMANDS</pre>
                  {commands.map((command, index) => (
                    <pre key={index}>{command}</pre>
                  ))}
                </div>
              </Tab>
            );
          })}
        </Tabs>
      ) : (
        <Alert variant="info">No zone scripts available. Verify the column "Create" is checked for the zones you want to include.</Alert>
      )}
    </div>
  );
};

export default ZoneScriptsPage;