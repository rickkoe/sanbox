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
        // Expecting response to have a structure like:
        // { alias_scripts: { fabricName: [command, ...], ... } }
        setScripts(response.data.alias_scripts || {});
      } catch (err) {
        console.error("Error fetching alias scripts:", err);
        setError("Error fetching alias scripts");
      } finally {
        setLoading(false);
      }
    };
  
    fetchScripts();
  }, [config]);

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
    <div className="container mt-5">
      <h2>Alias Scripts</h2>
      {scripts && Object.keys(scripts).length > 0 ? (
        <Tabs defaultActiveKey={Object.keys(scripts)[0]} id="alias-scripts-tabs">
          {Object.entries(scripts).map(([fabric, commands]) => (
            <Tab eventKey={fabric} title={fabric} key={fabric}>
              <div className="mt-3">
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
      <div className="mt-3">
        <Button onClick={() => navigate("/alias-table")}>Back to Alias Table</Button>
      </div>
    </div>
  );
};

export default AliasScriptsPage;