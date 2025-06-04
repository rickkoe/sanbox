import React, { useState, useEffect, useContext, useRef } from 'react';
import { Button, Form, Alert, Card, Spinner, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ConfigContext } from '../context/ConfigContext';
import { HotTable } from '@handsontable/react';
import 'handsontable/dist/handsontable.full.css';

const ZoneImportPage = () => {
  const { config } = useContext(ConfigContext);
  const navigate = useNavigate();
  const previewTableRef = useRef(null);
  
  const [fabricOptions, setFabricOptions] = useState([]);
  const [aliasOptions, setAliasOptions] = useState([]);
  const [selectedFabric, setSelectedFabric] = useState('');
  const [rawText, setRawText] = useState('');
  const [parsedZones, setParsedZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [showProjectCopy, setShowProjectCopy] = useState(false);
  const [availableProjects, setAvailableProjects] = useState([]);
  const [selectedSourceProject, setSelectedSourceProject] = useState('');
  const [sourceProjectZones, setSourceProjectZones] = useState([]);
  const [selectedZonesToCopy, setSelectedZonesToCopy] = useState([]);
  const [memberColumns, setMemberColumns] = useState(5);
  const [unmatchedWWPNs, setUnmatchedWWPNs] = useState([]);
  
  const activeProjectId = config?.active_project?.id;
  const activeCustomerId = config?.customer?.id;

  // Load fabrics, aliases, and projects on component mount
  useEffect(() => {
    if (activeCustomerId) {
      setLoading(true);
      
      // Load fabrics
      const fabricsPromise = axios.get(`http://127.0.0.1:8000/api/san/fabrics/?customer_id=${activeCustomerId}`);
      
      // Load projects for this customer
      const projectsPromise = axios.get(`http://127.0.0.1:8000/api/customers/projects/${activeCustomerId}/`);
      
      Promise.all([fabricsPromise, projectsPromise])
        .then(([fabricsRes, projectsRes]) => {
          setFabricOptions(fabricsRes.data);
          if (fabricsRes.data.length > 0) {
            setSelectedFabric(fabricsRes.data[0].id);
          }
          
          // Filter out the current project from available projects
          const otherProjects = projectsRes.data.filter(project => project.id !== activeProjectId);
          setAvailableProjects(otherProjects);
        })
        .catch(err => {
          console.error("Error fetching data:", err);
          setError("Failed to load fabrics and projects");
        })
        .finally(() => setLoading(false));
    }
  }, [activeCustomerId, activeProjectId]);

  // Load aliases when fabric is selected
  useEffect(() => {
    if (activeProjectId && selectedFabric) {
      axios.get(`http://127.0.0.1:8000/api/san/aliases/project/${activeProjectId}/`)
        .then(res => {
          // Filter aliases for the selected fabric
          const fabricAliases = res.data.filter(alias => 
            alias.fabric_details?.id === parseInt(selectedFabric)
          );
          setAliasOptions(fabricAliases);
        })
        .catch(err => {
          console.error("Error fetching aliases:", err);
        });
    }
  }, [activeProjectId, selectedFabric]);

  // Parse zone database text
  const parseZoneText = (text) => {
    const lines = text.split('\n');
    const zones = [];
    let currentZone = null;
    let vsanId = null;
    
    // First, extract VSAN ID from the header
    const vsanHeaderRegex = /!Active Zone Database Section for vsan (\d+)/;
    
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Extract VSAN ID from header
      const vsanMatch = trimmedLine.match(vsanHeaderRegex);
      if (vsanMatch) {
        vsanId = parseInt(vsanMatch[1]);
        return;
      }
      
      // Zone name line: "zone name <zone_name> vsan <vsan_id>"
      const zoneNameRegex = /^zone\s+name\s+(\S+)\s+vsan\s+(\d+)/;
      const zoneMatch = trimmedLine.match(zoneNameRegex);
      
      if (zoneMatch) {
        // Save previous zone if exists
        if (currentZone) {
          zones.push(currentZone);
        }
        
        const [, zoneName, zoneVsan] = zoneMatch;
        currentZone = {
          lineNumber: index + 1,
          name: zoneName,
          vsan: parseInt(zoneVsan),
          fabric: selectedFabric,
          zone_type: 'standard', // Default to standard
          create: true,
          exists: false,
          notes: `Imported from zone database (VSAN ${zoneVsan})`,
          imported: new Date().toISOString(),
          updated: null,
          saved: false,
          members: []
        };
        return;
      }
      
      // Member line: "    member pwwn <wwpn>"
      const memberRegex = /^\s+member\s+pwwn\s+([0-9a-fA-F:]{23})/;
      const memberMatch = trimmedLine.match(memberRegex);
      
      if (memberMatch && currentZone) {
        const [, wwpn] = memberMatch;
        // Format WWPN to standard format
        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, '').match(/.{2}/g)?.join(':') || wwpn;
        currentZone.members.push(formattedWWPN);
      }
      
      // Comment line with alias reference: "!           [alias_name]"
      const commentRegex = /^\s*!\s*\[([^\]]+)\]/;
      const commentMatch = trimmedLine.match(commentRegex);
      
      if (commentMatch && currentZone) {
        // This is additional info, could be used for notes
        if (!currentZone.aliasRef) {
          currentZone.aliasRef = commentMatch[1];
          currentZone.notes += ` (Alias ref: ${commentMatch[1]})`;
        }
      }
    });
    
    // Don't forget the last zone
    if (currentZone) {
      zones.push(currentZone);
    }
    
    return zones;
  };

  // Convert zones to table format with member columns
  const convertZonesToTableFormat = (zones) => {
    let maxMembers = memberColumns;
    const unmatched = [];
    
    const tableData = zones.map(zone => {
      const zoneData = { ...zone };
      
      // Track the maximum number of members to adjust columns
      if (zone.members.length > maxMembers) {
        maxMembers = zone.members.length;
      }
      
      // Convert members to columns, trying to match WWPNs to aliases
      zone.members.forEach((wwpn, index) => {
        const matchingAlias = aliasOptions.find(alias => 
          alias.wwpn.toLowerCase().replace(/[^0-9a-f]/g, '') === 
          wwpn.toLowerCase().replace(/[^0-9a-f]/g, '')
        );
        
        if (matchingAlias) {
          zoneData[`member_${index + 1}`] = matchingAlias.name;
        } else {
          // Store unmatched WWPN for user review
          zoneData[`member_${index + 1}`] = `UNMATCHED: ${wwpn}`;
          unmatched.push({
            zoneName: zone.name,
            wwpn: wwpn,
            memberIndex: index + 1
          });
        }
      });
      
      // Remove the members array as it's now in columns
      delete zoneData.members;
      
      return zoneData;
    });
    
    // Update member columns if needed
    if (maxMembers > memberColumns) {
      setMemberColumns(maxMembers);
    }
    
    setUnmatchedWWPNs(unmatched);
    return tableData;
  };

  // Check for duplicate zones in database
  const checkForDuplicates = async (zones) => {
    setCheckingDuplicates(true);
    try {
      // Get all existing zones for the current project
      const response = await axios.get(`http://127.0.0.1:8000/api/san/zones/project/${activeProjectId}/`);
      const existingZones = response.data;
      
      const duplicateEntries = [];
      const uniqueZones = [];
      
      zones.forEach(zone => {
        // Check for name duplicates within the same fabric
        const nameMatch = existingZones.find(existing => 
          existing.name.toLowerCase() === zone.name.toLowerCase() &&
          existing.fabric_details?.id === parseInt(selectedFabric)
        );
        
        if (nameMatch) {
          duplicateEntries.push({
            ...zone,
            duplicateType: 'name',
            existingZone: nameMatch
          });
        } else {
          uniqueZones.push(zone);
        }
      });
      
      setDuplicates(duplicateEntries);
      return uniqueZones;
      
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      setError('Failed to check for duplicate zones: ' + (error.response?.data?.error || error.message));
      return zones; // Return original zones if check fails
    } finally {
      setCheckingDuplicates(false);
    }
  };

  // Handle text parsing
  const handleParse = async () => {
    setError('');
    setSuccess('');
    
    if (!selectedFabric) {
      setError('Please select a fabric');
      return;
    }
    
    if (!rawText.trim()) {
      setError('Please paste zone database content');
      return;
    }
    
    try {
      const parsed = parseZoneText(rawText);
      
      if (parsed.length === 0) {
        setError('No valid zone entries found. Please check the format.');
        return;
      }
      
      // Check for duplicates
      const uniqueZones = await checkForDuplicates(parsed);
      
      // Convert to table format
      const tableData = convertZonesToTableFormat(uniqueZones);
      
      setParsedZones(parsed);
      setPreviewData([...tableData]);
      setShowPreview(true);
      
      // Show success message with duplicate and unmatched info
      let message = `Successfully parsed ${parsed.length} zones`;
      if (duplicates.length > 0) {
        message += `. ${duplicates.length} duplicate(s) found and will be skipped.`;
      }
      if (uniqueZones.length > 0) {
        message += ` ${uniqueZones.length} unique zones ready for import.`;
      }
      if (unmatchedWWPNs.length > 0) {
        message += ` ${unmatchedWWPNs.length} WWPN(s) could not be matched to existing aliases.`;
      }
      setSuccess(message);
      
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
      // Convert preview data to API format
      const zones = previewData.map(zone => {
        // Extract members from columns
        const members = [];
        for (let i = 1; i <= memberColumns; i++) {
          const memberName = zone[`member_${i}`];
          if (memberName && !memberName.startsWith('UNMATCHED:')) {
            const alias = aliasOptions.find(a => a.name === memberName);
            if (alias) {
              members.push({ alias: alias.id });
            }
          }
        }
        
        // Clean up zone data
        const cleanZone = { ...zone };
        for (let i = 1; i <= memberColumns; i++) {
          delete cleanZone[`member_${i}`];
        }
        delete cleanZone.saved;
        delete cleanZone.lineNumber;
        delete cleanZone.aliasRef;
        
        return {
          ...cleanZone,
          projects: [activeProjectId],
          members
        };
      });
      
      const payload = {
        project_id: activeProjectId,
        zones: zones
      };
      
      await axios.post('http://127.0.0.1:8000/api/san/zones/save/', payload);
      
      setSuccess(`Successfully imported ${previewData.length} zones!`);
      
      // Redirect to zone table after successful import
      setTimeout(() => {
        navigate('/san/zones');
      }, 2000);
      
    } catch (error) {
      console.error('Import error:', error);
      
      // Handle structured error response
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map(e => {
          const errorText = Object.values(e.errors).flat().join(", ");
          return `${e.zone}: ${errorText}`;
        });
        setError(`Import failed:\n${errorMessages.join('\n')}`);
      } else {
        setError(`Import failed: ${error.response?.data?.message || error.message}`);
      }
    } finally {
      setImporting(false);
    }
  };

  // Load zones from selected source project
  const loadSourceProjectZones = async (projectId) => {
    if (!projectId) {
      setSourceProjectZones([]);
      return;
    }
    
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/san/zones/project/${projectId}/`);
      setSourceProjectZones(response.data);
    } catch (error) {
      console.error('Error loading source project zones:', error);
      setError('Failed to load zones from source project');
    }
  };

  // Handle copying zones from another project
  const handleCopyFromProject = async () => {
    if (selectedZonesToCopy.length === 0) {
      setError('Please select zones to copy');
      return;
    }
    
    setImporting(true);
    setError('');
    
    try {
      // Get the selected zones and format them properly for the API
      const zonesToUpdate = sourceProjectZones
        .filter(zone => selectedZonesToCopy.includes(zone.id))
        .map(zone => {
          // Extract members in the format the API expects
          const members = zone.members_details ? zone.members_details.map(member => ({
            id: member.id, // Include member ID if it exists
            alias: member.alias // Use the alias ID
          })) : [];
          
          return {
            id: zone.id, // Keep the original zone ID
            name: zone.name,
            fabric: zone.fabric_details?.id || zone.fabric,
            zone_type: zone.zone_type || 'standard',
            create: zone.create || false,
            exists: zone.exists || false,
            notes: zone.notes || '',
            imported: zone.imported,
            updated: zone.updated,
            projects: [...(zone.projects || []), activeProjectId], // Add current project
            members: members
          };
        });
      
      // Use the existing zone save endpoint
      const payload = {
        project_id: activeProjectId,
        zones: zonesToUpdate
      };
      
      console.log('Sending payload:', JSON.stringify(payload, null, 2)); // Debug log
      
      await axios.post('http://127.0.0.1:8000/api/san/zones/save/', payload);
      
      setSuccess(`Successfully added ${selectedZonesToCopy.length} zones to current project!`);
      setShowProjectCopy(false);
      setSelectedZonesToCopy([]);
      setSelectedSourceProject('');
      
      // Redirect to zone table after successful copy
      setTimeout(() => {
        navigate('/san/zones');
      }, 2000);
      
    } catch (error) {
      console.error('Copy error:', error);
      console.error('Error details:', error.response?.data); // More detailed error logging
      
      // Handle structured error response
      if (error.response?.data?.details) {
        const errorMessages = error.response.data.details.map(e => {
          const errorText = Object.values(e.errors).flat().join(", ");
          return `${e.zone}: ${errorText}`;
        });
        setError(`Copy failed:\n${errorMessages.join('\n')}`);
      } else if (error.response?.data?.message) {
        setError(`Copy failed: ${error.response.data.message}`);
      } else if (error.response?.data) {
        setError(`Copy failed: ${JSON.stringify(error.response.data)}`);
      } else {
        setError(`Copy failed: ${error.message}`);
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

  // Create table columns dynamically based on memberColumns
  const tableColumns = [
    { data: "name", width: 200 },
    { 
      data: "fabric", 
      type: "dropdown", 
      source: fabricOptions.map(f => f.id.toString()),
      width: 120,
      renderer: (instance, td, row, col, prop, value) => {
        const fabric = fabricOptions.find(f => f.id.toString() === value?.toString());
        td.innerText = fabric ? fabric.name : value || '';
        return td;
      }
    },
    { 
      data: "zone_type", 
      type: "dropdown", 
      source: ["standard", "smart"],
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
      data: "exists", 
      type: "checkbox", 
      width: 80,
      className: "htCenter"
    },
    { data: "notes", width: 200 },
    ...Array.from({ length: memberColumns }, (_, i) => ({
      data: `member_${i + 1}`,
      type: "dropdown",
      source: aliasOptions.map(a => a.name),
      width: 150
    }))
  ];

  const tableHeaders = [
    "Name", "Fabric", "Zone Type", "Create", "Exists", "Notes",
    ...Array.from({ length: memberColumns }, (_, i) => `Member ${i + 1}`)
  ];

  return (
    <div className="container mt-4">
      <div className="row justify-content-center">
        <div className="col-lg-12">
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
                Import Zones
              </h4>
              <small className="text-muted">
                Import zones from Cisco zone database output
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
                  <strong>Zone Database Content</strong>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={12}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={`Paste your zone database output here, for example:

!Active Zone Database Section for vsan 75
zone name zv_FCS01A_sys01a_usmnd01shmc0002p_I0030 vsan 75
    member pwwn 50:05:07:63:08:03:11:9a
    member pwwn c0:50:76:09:e3:f8:02:4c
zone name zv_FCS01A_sys02a_usmnd01shmc0002p_I0100 vsan 75
    member pwwn 50:05:07:63:08:08:11:9a
    member pwwn c0:50:76:09:e3:f8:02:4e
...`}
                  style={{ 
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    fontSize: '13px'
                  }}
                />
                <Form.Text className="text-muted">
                  Paste the output from "show zone" or zone database export command
                </Form.Text>
              </Form.Group>

              {/* Action Buttons */}
              <div className="d-flex gap-2 mb-3">
                <Button 
                  variant="primary" 
                  onClick={handleParse}
                  disabled={!selectedFabric || !rawText.trim() || checkingDuplicates}
                >
                  {checkingDuplicates ? (
                    <>
                      <Spinner size="sm" className="me-1" />
                      Checking for duplicates...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
                        <polyline points="16 18 22 12 16 6"/>
                        <polyline points="8 6 2 12 8 18"/>
                      </svg>
                      Parse Text
                    </>
                  )}
                </Button>

                <Button 
                  variant="outline-info" 
                  onClick={() => setShowProjectCopy(true)}
                  disabled={availableProjects.length === 0}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Copy from Project
                </Button>
                
                <Button 
                  variant="outline-secondary" 
                  onClick={() => {
                    setRawText('');
                    setParsedZones([]);
                    setPreviewData([]);
                    setDuplicates([]);
                    setUnmatchedWWPNs([]);
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

              {/* Unmatched WWPNs Warning */}
              {unmatchedWWPNs.length > 0 && (
                <Alert variant="warning" className="mb-3">
                  <Alert.Heading className="h6">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {unmatchedWWPNs.length} Unmatched WWPN(s) Found
                  </Alert.Heading>
                  <p>The following WWPNs could not be matched to existing aliases. You may need to import these aliases first or edit the member columns manually:</p>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {unmatchedWWPNs.map((unmatched, index) => (
                      <div key={index} className="mb-1" style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                        <strong>{unmatched.zoneName}</strong> - Member {unmatched.memberIndex}: {unmatched.wwpn}
                      </div>
                    ))}
                  </div>
                </Alert>
              )}

              {/* Duplicates Warning */}
              {duplicates.length > 0 && (
                <Alert variant="warning" className="mb-3">
                  <Alert.Heading className="h6">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                      <line x1="12" y1="9" x2="12" y2="13"/>
                      <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                    {duplicates.length} Duplicate(s) Found - Will Be Skipped
                  </Alert.Heading>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {duplicates.map((duplicate, index) => (
                      <div key={index} className="mb-2 p-2" style={{ backgroundColor: '#fff3cd', borderRadius: '4px', border: '1px solid #ffeaa7' }}>
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong style={{ fontFamily: 'monospace' }}>{duplicate.name}</strong>
                            <br />
                            <small className="text-muted">VSAN: {duplicate.vsan}</small>
                          </div>
                          <span className="badge bg-warning text-dark">Name duplicate</span>
                        </div>
                        <small className="text-muted">
                          Matches existing zone: <strong>{duplicate.existingZone.name}</strong>
                        </small>
                      </div>
                    ))}
                  </div>
                </Alert>
              )}

              {/* Preview and Import */}
              {showPreview && previewData.length > 0 && (
                <Card className="mt-4">
                  <Card.Header className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">
                      Preview & Edit ({previewData.length} unique zones)
                      {duplicates.length > 0 && (
                        <small className="text-muted ms-2">
                          ({duplicates.length} duplicates skipped)
                        </small>
                      )}
                    </h5>
                    <div className="d-flex gap-2">
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => {
                          setMemberColumns(prev => prev + 2);
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
                          <line x1="12" y1="5" x2="12" y2="19"/>
                          <line x1="5" y1="12" x2="19" y2="12"/>
                        </svg>
                        Add Member Columns
                      </Button>
                      <Button 
                        variant="outline-warning" 
                        size="sm"
                        onClick={() => {
                          // Reset to original parsed data
                          const tableData = convertZonesToTableFormat(parsedZones.filter(zone => 
                            !duplicates.some(dup => dup.name === zone.name)
                          ));
                          setPreviewData([...tableData]);
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
                    <div style={{ height: '500px', width: '100%' }}>
                      <HotTable
                        ref={previewTableRef}
                        data={previewData}
                        colHeaders={tableHeaders}
                        columns={tableColumns}
                        licenseKey="non-commercial-and-evaluation"
                        height="450"
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
                        cells={(row, col, prop) => {
                          // Special handling for member columns
                          if (col >= 6 && typeof prop === 'string' && prop.startsWith('member_')) {
                            const rowData = previewData[row];
                            if (!rowData) return {};
                            
                            const rowFabric = fabricOptions.find(f => f.id.toString() === rowData.fabric?.toString())?.name;
                            const currentValue = rowData[prop];
                            
                            // Filter aliases for the row's fabric and include_in_zoning
                            const availableAliases = aliasOptions.filter(alias => 
                              alias.fabric_details?.name === rowFabric &&
                              alias.include_in_zoning === true
                            );
                            
                            return {
                              type: "dropdown",
                              source: ['', ...availableAliases.map(alias => alias.name)]
                            };
                          }
                          return {};
                        }}
                      />
                    </div>
                    <div className="p-3 bg-light border-top">
                      <small className="text-muted">
                        <strong>Tip:</strong> You can edit any cell by double-clicking. 
                        Use dropdowns to change fabric, zone type, or member assignments. 
                        Unmatched WWPNs are marked with "UNMATCHED:" - replace these with valid alias names or leave empty.
                        Right-click for context menu options.
                      </small>
                    </div>
                  </Card.Body>
                </Card>
              )}

              {/* Show message when no unique zones found */}
              {showPreview && previewData.length === 0 && duplicates.length > 0 && (
                <Alert variant="info" className="mt-4">
                  <Alert.Heading className="h6">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="8" x2="12" y2="12"/>
                      <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    No New Zones to Import
                  </Alert.Heading>
                  All parsed zones already exist in the database. No import needed.
                </Alert>
              )}
            </Card.Body>
          </Card>
        </div>
      </div>

      {/* Project Copy Modal */}
      <Modal show={showProjectCopy} onHide={() => setShowProjectCopy(false)} size="lg" className="modern-modal">
        <Modal.Header closeButton className="modern-modal-header">
          <Modal.Title>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Copy Zones from Another Project
          </Modal.Title>
        </Modal.Header>
        
        <Modal.Body className="modern-modal-body">
          {/* Source Project Selection */}
          <Form.Group className="mb-3">
            <Form.Label>
              <strong>Source Project</strong>
            </Form.Label>
            <Form.Select
              value={selectedSourceProject}
              onChange={(e) => {
                setSelectedSourceProject(e.target.value);
                loadSourceProjectZones(e.target.value);
                setSelectedZonesToCopy([]);
              }}
            >
              <option value="">Choose a project...</option>
              {availableProjects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Form.Select>
            <Form.Text className="text-muted">
              Select a project to copy zones from
            </Form.Text>
          </Form.Group>

          {/* Zones Selection */}
          {sourceProjectZones.length > 0 && (
            <div>
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>Available Zones ({sourceProjectZones.length})</strong>
                <div className="d-flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline-primary"
                    onClick={() => setSelectedZonesToCopy(sourceProjectZones.map(zone => zone.id))}
                  >
                    Select All
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline-secondary"
                    onClick={() => setSelectedZonesToCopy([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
              
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #dee2e6', borderRadius: '4px' }}>
                {sourceProjectZones.map(zone => (
                  <div 
                    key={zone.id} 
                    className={`p-2 border-bottom ${selectedZonesToCopy.includes(zone.id) ? 'bg-primary bg-opacity-10' : ''}`}
                    style={{ cursor: 'pointer' }}
                    onClick={() => {
                      if (selectedZonesToCopy.includes(zone.id)) {
                        setSelectedZonesToCopy(prev => prev.filter(id => id !== zone.id));
                      } else {
                        setSelectedZonesToCopy(prev => [...prev, zone.id]);
                      }
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong style={{ fontFamily: 'monospace' }}>{zone.name}</strong>
                        <br />
                        <small className="text-muted">
                          Fabric: {zone.fabric_details?.name || 'Unknown'} | 
                          Type: {zone.zone_type} | 
                          Members: {zone.members_details?.length || 0}
                        </small>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-info">{zone.zone_type}</span>
                        {zone.create && <span className="badge bg-success">Create</span>}
                        {zone.exists && <span className="badge bg-secondary">Exists</span>}
                        {selectedZonesToCopy.includes(zone.id) && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                            <polyline points="20,6 9,17 4,12"/>
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-2 text-muted">
                <small>
                  <strong>{selectedZonesToCopy.length}</strong> zones selected for copying
                </small>
              </div>
            </div>
          )}

          {selectedSourceProject && sourceProjectZones.length === 0 && (
            <Alert variant="info">
              No zones found in the selected project.
            </Alert>
          )}
        </Modal.Body>
        
        <Modal.Footer className="modern-modal-footer">
          <Button 
            variant="secondary" 
            onClick={() => {
              setShowProjectCopy(false);
              setSelectedZonesToCopy([]);
              setSelectedSourceProject('');
            }}
          >
            Cancel
          </Button>
          <Button 
            variant="success" 
            onClick={handleCopyFromProject}
            disabled={selectedZonesToCopy.length === 0 || importing}
          >
            {importing ? (
              <>
                <Spinner size="sm" className="me-1" />
                Copying...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="me-1">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy {selectedZonesToCopy.length} Zones
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ZoneImportPage;