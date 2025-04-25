import React, { useState, useContext, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Form } from "react-bootstrap";
import { ConfigContext } from "../../context/ConfigContext";

const ImportSwitchConfig = () => {
  const [selectedFabric, setSelectedFabric] = useState(null);
  const [configText, setConfigText] = useState("");
  const [importResult, setImportResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fabrics, setFabrics] = useState([]);
  const { config, loading, error } = useContext(ConfigContext);
  const fabricApiUrl = "http://127.0.0.1:8000/api/san/fabrics/customer/";


  useEffect(() => {
    if (config?.customer?.id) {
      fetchFabrics(config.customer.id);
    }
  }, [config]);



  const handleImport = async (fabricId) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post("/api/import-switch-config/", {
        config_text: configText,
        fabric: fabricId
      });
      setImportResult(response.data);
      setConfigText("");
      setSelectedFabric(null);
    } catch (error) {
      console.error("❌ Import failed:", error);
      setImportResult({ error: "Failed to import switch config." });
    } finally {
      setIsSubmitting(false);
    }
  };
  

  const fetchFabrics = async (customerId) => {
    try {
        const response = await axios.get(`${fabricApiUrl}${customerId}/`);
        setFabrics(response.data.map(fabric => ({ id: fabric.id, name: fabric.name, vsan: fabric.vsan}))); // ✅ Ensure ID and Name
    } catch (error) {
        console.error("❌ Error fetching fabrics:", error);
    }
  };
  console.log("CONFIG",config)

 
  if (loading) {
    return <div>Loading configuration...</div>;
  }
  
  if (error) {
    return <div className="text-danger">Error loading configuration: {error}</div>;
  }
  
  if (!config) {
    return <div>No active configuration found.</div>;
  }
  
  return (
    <div className="import-switch-config">
      {Array.isArray(fabrics) && fabrics.map((fabric) => (
        <div key={fabric.id} className="mb-4">
          <h5>
            {fabric.name}
            {config.san_vendor === "CI" && fabric.vsan ? ` (VSAN ${fabric.vsan})` : ""}
          </h5>
          <div className="d-flex gap-2">
            <Button variant="primary" onClick={() => setSelectedFabric(fabric)}>
              Import show running-config
            </Button>
            {/* Future buttons can go here */}
          </div>
        </div>
      ))}

      <Modal show={selectedFabric !== null} onHide={() => setSelectedFabric(null)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Import show running-config {selectedFabric ? `for ${selectedFabric.name}` : ""}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Paste the output from "show running-config"</Form.Label>
            <Form.Control
              as="textarea"
              rows={15}
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              placeholder="Paste switch configuration text here..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setSelectedFabric(null)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={() => handleImport(selectedFabric?.id)}
            disabled={!configText.trim() || isSubmitting}
          >
            {isSubmitting ? "Importing..." : "Import"}
          </Button>
        </Modal.Footer>
      </Modal>

      {importResult && (
        <div className="mt-3 alert alert-info">
          {importResult.message || importResult.error}
        </div>
      )}
    </div>
  );
};

export default ImportSwitchConfig;
