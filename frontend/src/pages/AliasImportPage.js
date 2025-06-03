import React, { useState, useEffect, useContext, useRef } from 'react';
import { Button, Form, Alert, Card, Spinner, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ConfigContext } from '../context/ConfigContext';
import { HotTable } from '@handsontable/react';
import 'handsontable/dist/handsontable.full.css';

const AliasImportPage = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  const previewTableRef = useRef(null);
  
  const [fabricOptions, setFabricOptions] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsedAliases, setParsedAliases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  
  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Load fabrics on component mount
  useEffect(() => {
    if (activeCustomerId) {
      setLoading(true);
      axios.get(`http://127.0.0.1:8000/api/san/fabrics/?customer_id=${activeCustomerId}`)
        .then(res => {
          setFabricOptions(res.data);
          if (res.data.length > 0) {
            setSelectedFabric(res.data[0].id); // Auto-select first fabric
          }
        })
        .catch(err => {
          console.error("Error fetching fabrics:", err);
          setError("Failed to load fabrics");
        })
        .finally(() => setLoading(false));
    }
  }, [activeCustomerId]);

  // Parse device-alias database text
  const parseDeviceAliasText = (text) => {
    const lines = text.split('\n');
    const aliases = [];
    
    // Regex to match device-alias lines
    const deviceAliasRegex = /device-alias\s+name\s+(\S+)\s+pwwn\s+([0-9a-fA-F:]{23})/;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      const match = trimmedLine.match(deviceAliasRegex);
      
      if (match) {
        const [, name, wwpn] = match;
        
        // Format WWPN to standard format (xx:xx:xx:xx:xx:xx:xx:xx)
        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, '').match(/.{2}/g)?.join(':') || wwpn;
        
        aliases.push({
          lineNumber: index + 1,
          name: name,
          wwpn: formattedWWPN,
          use: 'init', // Default to 'init'
          fabric: selectedFabric,
          cisco_alias: 'device-alias',
          create: true,
          include_in_zoning: false,
          notes: `Imported from device-alias database`,
          imported: new Date().toISOString(),
          saved: false
        });
      }
    });
    
    return aliases;
  };

  // Handle text parsing
  const handleParse = () => {
    setError('');
    setSuccess('');
    
    if (!selectedFabric) {
      setError('Please select a fabric');
      return;
    }
    
    if (!rawText.trim()) {
      setError('Please paste device-alias database content');
      return;
    }
    
    try {
      const parsed = parseDeviceAliasText(rawText);
      
      if (parsed.length === 0) {
        setError('No valid device-alias entries found. Please check the format.');
        return;
      }
      
      setParsedAliases(parsed);
      setPreviewData([...parsed]); // Create a copy for editing
      setShowPreview(true);
      setSuccess(`Successfully parsed ${parsed.length} device aliases`);
    } catch (err) {
      setError('Error parsing text: ' + err.message);
    }
  };

  // Handle changes in the preview table
  const handlePreviewChange = (changes, source) => {
    if (source === 'loadData' || !changes) return;
    
    const updatedData = [...previewData];
    changes.forEach(([row, prop, oldVal, newVal]) => {
      if (updatedData[row]) {
        updatedData[row] = { ...updatedData[row], [prop]: newVal };
      }
    });
    setPreviewData(updatedData);
  };

  // Handle import to database
  const handleImport = async () => {
    if (!activeProjectId) {
      setError('No active project selected');
      return;
    }
    
    setImporting(true);
    setError('');
    
    try {
      // Use the edited previewData instead of original parsedAliases
      const payload = {
        project_id: activeProjectId,
        aliases: previewData.map(alias => ({
          name: alias.name,
          wwpn: alias.wwpn,
          use: alias.use,
          fabric: alias.fabric,
          cisco_alias: alias.cisco_alias,
          create: alias.create,
          include_in_zoning: alias.include_in_zoning,
          notes: alias.notes,
          imported: alias.imported, // ADDED: Include the imported timestamp
          projects: [activeProjectId]
        }))
      };
      
      await axios.post('http://127.0.0.1:8000/api/san/aliases/save/', payload);
      
      setSuccess(`Successfully imported ${previewData.length} aliases!`);
      
      // Redirect to alias table after successful import
      setTimeout(() => {
        navigate('/san/aliases');
      }, 2000);
      
    } catch (error) {
      console.error('Import error:', error);
      
      // Handle structured error response
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map(e => {
          const errorText = Object.values(e.errors).flat().join(", ");
          return `${e.alias}: ${errorText}`;
        });
        setError(`Import failed:\n${errorMessages.join('\n')}`);
      } else {
        setError(`Import failed: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setImporting(false);
    }
  };

  if (!activeProjectId) {
    return (
      <div className="container mt-4">
        <Alert variant="warning">No active project selected.</Alert>
      </div>
    );
  }

  const selectedFabricName = fabricOptions.find(f => f.id.toString() === selectedFabric.toString())?.name || '';

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <Card>
            <Card.Header>
              <h4 className="mb-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14,2 14,8 20,8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10,9 9,9 8,9"/>
                </svg>
                Import Device Aliases
              </h4>
              <small className="text-muted">
                Import aliases from Cisco device-alias database output
              </small>
            </Card.Header>
            
            <Card.Body>
              {/* Fabric Selection */}
              <Form.Group className="mb-3">
                <Form.Label>
                  <strong>Select Fabric</strong>
                </Form.Label>
                <Form.Select
                  value={selectedFabric}
                  onChange={(e) => setSelectedFabric(e.target.value)}
                  disabled={loading}
                >
                  <option value="">Choose a fabric...</option>
                  {fabricOptions.map(fabric => (
                    <option key={fabric.id} value={fabric.id}>
                      {fabric.name}
                    </option>
                  ))}
                </Form.Select>
                {loading && <small className="text-muted">Loading fabrics...</small>}
              </Form.Group>

              {/* Text Input */}
              <Form.Group className="mb-3">
                <Form.Label>
                  <strong>Device-Alias Database Content</strong>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={12}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Paste your device-alias database output here, for example:

device-alias database
  device-alias name PRD03A_sys1a pwwn c0:50:76:09:15:09:01:08
  device-alias name PRD03A_sys2a pwwn c0:50:76:09:15:09:01:0a
  device-alias name MGT01A_MGT_1a pwwn c0:50:76:09:15:09:02:b0
  ...`}
                  style={{ 
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    fontSize: '13px'
                  }}
                />
                <Form.Text className="text-muted">
                  Paste the output from "show device-alias database" command
                </Form.Text>
              </Form.Group>

              {/* Action Buttons */}
              <div className="d-flex gap-2 mb-3">
                <Button 
                  variant="primary" 
                  onClick={handleParse}
                  disabled={!selectedFabric || !rawText.trim()}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
                    <polyline points="16 18 22 12 16 6"/>
                    <polyline points="8 6 2 12 8 18"/>
                  </svg>
                  Parse Text
                </Button>
                
                <Button 
                  variant="outline-secondary" 
                  onClick={() => {
                    setRawText('');
                    setParsedAliases([]);
                    setPreviewData([]);
                    setError('');
                    setSuccess('');
                    setShowPreview(false);
                  }}
                >
                  Clear
                </Button>
              </div>

              {/* Status Messages */}
              {error && (
                <Alert variant="danger" className="mb-3">
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{error}</pre>
                </Alert>
              )}

              {success && (
                <Alert variant="success" className="mb-3">
                  {success}
                </Alert>
              )}

              {/* Preview and Import */}
              {showPreview && previewData.length > 0 && (
                <Card className="mt-4">
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Preview & Edit ({previewData.length} aliases)</h5>
                    <div className="d-flex gap-2">
                      <Button 
                        variant="outline-warning" 
                        size="sm"
                        onClick={() => {
                          // Reset to original parsed data
                          setPreviewData([...parsedAliases]);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                          <path d="M21 3v5h-5"/>
                          <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                          <path d="M3 21v-5h5"/>
                        </svg>
                        Reset Changes
                      </Button>
                      <Button 
                        variant="success" 
                        onClick={handleImport}
                        disabled={importing}
                      >
                        {importing ? (
                          <>
                            <Spinner size="sm" className="me-1" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2h4"/>
                              <polyline points="17,6 9,14 5,10"/>
                            </svg>
                            Import to {selectedFabricName}
                          </>
                        )}
                      </Button>
                    </div>
                  </Card.Header>
                  
                  <Card.Body style={{ padding: '0' }}>
                    <div style={{ height: '400px', width: '100%' }}>
                      <HotTable
                        ref={previewTableRef}
                        data={previewData}
                        colHeaders={[
                          "Name", "WWPN", "Use", "Fabric", "Alias Type", 
                          "Create", "Include in Zoning", "Notes"
                        ]}
                        columns={[
                          { data: "name", width: 200 },
                          { 
                            data: "wwpn", 
                            width: 180,
                            validator: (value, callback) => {
                              // WWPN validation
                              const wwpnPattern = /^([0-9a-fA-F]{2}:){7}[0-9a-fA-F]{2}$/;
                              callback(wwpnPattern.test(value));
                            }
                          },
                          { 
                            data: "use", 
                            type: "dropdown", 
                            source: ["init", "target", "both"],
                            width: 100,
                            className: "htCenter"
                          },
                          { 
                            data: "fabric", 
                            type: "dropdown", 
                            source: fabricOptions.map(f => f.id.toString()),
                            width: 120,
                            renderer: (instance, td, row, col, prop, value) => {
                              // Show fabric name instead of ID
                              const fabric = fabricOptions.find(f => f.id.toString() === value?.toString());
                              td.innerText = fabric ? fabric.name : value || '';
                              return td;
                            }
                          },
                          { 
                            data: "cisco_alias", 
                            type: "dropdown", 
                            source: ["device-alias", "fcalias", "wwpn"],
                            width: 120,
                            className: "htCenter"
                          },
                          { 
                            data: "create", 
                            type: "checkbox", 
                            width: 80,
                            className: "htCenter"
                          },
                          { 
                            data: "include_in_zoning", 
                            type: "checkbox", 
                            width: 120,
                            className: "htCenter"
                          },
                          { data: "notes", width: 200 }
                        ]}
                        licenseKey="non-commercial-and-evaluation"
                        height="350"
                        width="100%"
                        afterChange={handlePreviewChange}
                        stretchH="all"
                        manualColumnResize={true}
                        contextMenu={true}
                        copyPaste={true}
                        fillHandle={true}
                        className="preview-table"
                        viewportRowRenderingOffset={30}
                        viewportColumnRenderingOffset={10}
                      />
                    </div>
                    <div className="p-3 bg-light border-top">
                      <small className="text-muted">
                        <strong>Tip:</strong> You can edit any cell by double-clicking. 
                        Use dropdowns to change Use, Fabric, or Alias Type. 
                        Right-click for context menu options.
                      </small>
                    </div>
                  </Card.Body>
                </Card>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AliasImportPage;