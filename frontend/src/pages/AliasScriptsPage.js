import React, { useEffect, useState, useContext } from "react";
import axios from "axios";
import { Tabs, Tab, Alert, Spinner, Button } from "react-bootstrap";
import { ConfigContext } from "../context/ConfigContext";
import { useNavigate } from "react-router-dom";

const AliasScriptsPage = () => {
  const { config } = useContext(ConfigContext);
  const [scripts, setScripts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
          `http://127.0.0.1:8000/api/san/alias-scripts/${config.active_project.id}/`
        );
        const aliasScripts = response.data.alias_scripts || {};
        setScripts(aliasScripts);
        if (!activeTab && Object.keys(aliasScripts).length > 0) {
          setActiveTab(Object.keys(aliasScripts)[0]);
        }
      } catch (err) {
        console.error("Error fetching alias scripts:", err);
        setError("Error fetching alias scripts");
      } finally {
        setLoading(false);
      }
    };
  
    fetchScripts();
  }, [config]);

  const handleCopyToClipboard = () => {
    if (activeTab && scripts[activeTab]) {
      const header = `### ${activeTab.toUpperCase()} ALIAS COMMANDS`;
      const commandsText = scripts[activeTab].join('\n');
      const textToCopy = `${header}\n${commandsText}`;
      navigator.clipboard.writeText(textToCopy)
        .then(() => {
          alert('Copied to clipboard!');
        })
        .catch((err) => {
          alert('Failed to copy to clipboard.');
          console.error('Clipboard copy failed:', err);
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
        <Button className="save-button" onClick={handleCopyToClipboard}>Copy to clipboard</Button>
        <Button className="save-button" onClick={() => navigate("/san/aliases")}>Back to Aliases</Button>
      </div>
      {scripts && Object.keys(scripts).length > 0 ? (
        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k)}
          id="alias-scripts-tabs"
          className="custom-tabs"
        >
          {Object.entries(scripts).map(([fabric, commands]) => (
            <Tab eventKey={fabric} title={fabric} key={fabric}>
              <div className="code-block">
                <pre>### {fabric.toUpperCase()} ALIAS COMMANDS</pre>
                {commands.map((command, index) => (
                  <pre key={index}>{command}</pre>
                ))}
              </div>
            </Tab>
          ))}
        </Tabs>
      ) : (
        <Alert variant="info">No alias scripts available.</Alert>
      )}

    </div>
  );
};

export default AliasScriptsPage;
