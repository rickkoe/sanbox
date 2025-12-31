import React, { useState, useEffect } from "react";
import { Modal, Form, Button, Spinner, Alert, Badge, Table } from "react-bootstrap";
import { useTheme } from "../../context/ThemeContext";
import axios from "axios";
import { Server, Layers, Database, ChevronRight, ChevronLeft, Check } from "lucide-react";

/**
 * MapVolumesToHostModal - Multi-step wizard for mapping volumes to hosts
 *
 * Supports three target types:
 * - Host: Direct mapping to a single host
 * - Host Cluster: All hosts in cluster share all volumes
 * - IBM i LPAR: Volumes distributed evenly across hosts (LSS-split for DS8000 - each LSS is split across all hosts)
 */
const MapVolumesToHostModal = ({
    show,
    onClose,
    selectedVolumeIds = [],
    storageId,
    storageName,
    storageType,
    activeProjectId,
    onSuccess
}) => {
    const { theme } = useTheme();

    // Step state (1: Select Type, 2: Select Target, 3: Preview, 4: Confirm)
    const [step, setStep] = useState(1);

    // Target selection state
    const [targetType, setTargetType] = useState('host'); // 'host' | 'cluster' | 'lpar'
    const [selectedTargetId, setSelectedTargetId] = useState(null);

    // Data state
    const [hosts, setHosts] = useState([]);
    const [clusters, setClusters] = useState([]);
    const [lpars, setLpars] = useState([]);
    const [loadingTargets, setLoadingTargets] = useState(false);

    // Preview state
    const [preview, setPreview] = useState(null);
    const [loadingPreview, setLoadingPreview] = useState(false);

    // Create new entity state
    const [showCreateNew, setShowCreateNew] = useState(false);
    const [newEntityName, setNewEntityName] = useState('');
    const [newEntityHosts, setNewEntityHosts] = useState([]);
    const [creatingEntity, setCreatingEntity] = useState(false);

    // UI state
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (show) {
            setStep(1);
            setTargetType('host');
            setSelectedTargetId(null);
            setPreview(null);
            setError(null);
            setSuccess(false);
            setShowCreateNew(false);
            setNewEntityName('');
            setNewEntityHosts([]);
            fetchTargets();
        }
    }, [show]);

    // Fetch targets when target type changes
    useEffect(() => {
        if (show && storageId) {
            fetchTargets();
        }
    }, [targetType, storageId]);

    const fetchTargets = async () => {
        setLoadingTargets(true);
        setError(null);
        try {
            // Fetch hosts for this storage (include project context to get uncommitted hosts in active project)
            const hostParams = [`storage_id=${storageId}`];
            if (activeProjectId) {
                hostParams.push(`project_id=${activeProjectId}`);
            }
            const hostsResponse = await axios.get(`/api/storage/hosts/?${hostParams.join('&')}`);
            const hostList = hostsResponse.data.results || hostsResponse.data || [];
            setHosts(hostList);

            // Fetch clusters for this storage (include project context)
            const clusterParams = activeProjectId ? `?project_id=${activeProjectId}` : '';
            const clustersResponse = await axios.get(`/api/storage/${storageId}/host-clusters/${clusterParams}`);
            setClusters(clustersResponse.data || []);

            // Fetch LPARs for this storage (include project context)
            const lparParams = activeProjectId ? `?project_id=${activeProjectId}` : '';
            const lparsResponse = await axios.get(`/api/storage/${storageId}/ibmi-lpars/${lparParams}`);
            setLpars(lparsResponse.data || []);
        } catch (err) {
            console.error("Failed to load targets:", err);
            setError("Failed to load available targets");
        } finally {
            setLoadingTargets(false);
        }
    };

    const fetchPreview = async () => {
        if (!selectedTargetId || selectedVolumeIds.length === 0) return;

        setLoadingPreview(true);
        setError(null);
        try {
            const response = await axios.post('/api/storage/volume-mappings/preview/', {
                volume_ids: selectedVolumeIds,
                target_type: targetType,
                target_id: selectedTargetId
            });
            setPreview(response.data);
        } catch (err) {
            console.error("Failed to load preview:", err);
            setError(err.response?.data?.error || "Failed to load distribution preview");
        } finally {
            setLoadingPreview(false);
        }
    };

    const handleCreateMappings = async () => {
        if (!selectedTargetId || selectedVolumeIds.length === 0 || !activeProjectId) {
            setError("Missing required data for creating mappings");
            return;
        }

        setCreating(true);
        setError(null);
        try {
            const response = await axios.post('/api/storage/volume-mappings/create/', {
                volume_ids: selectedVolumeIds,
                target_type: targetType,
                target_id: selectedTargetId,
                project_id: activeProjectId
            });

            if (response.data.created > 0) {
                setSuccess(true);
                if (onSuccess) {
                    onSuccess(response.data);
                }
                // Close after brief success message
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                setError("No mappings were created");
            }
        } catch (err) {
            console.error("Failed to create mappings:", err);
            setError(err.response?.data?.error || "Failed to create volume mappings");
        } finally {
            setCreating(false);
        }
    };

    const handleCreateNewEntity = async () => {
        if (!newEntityName.trim()) {
            setError("Name is required");
            return;
        }

        setCreatingEntity(true);
        setError(null);
        try {
            const endpoint = targetType === 'cluster'
                ? '/api/storage/host-clusters/'
                : '/api/storage/ibmi-lpars/';

            const response = await axios.post(endpoint, {
                name: newEntityName,
                storage: storageId,
                hosts: newEntityHosts,
                notes: '',
                project_id: activeProjectId
            });

            // Select the newly created entity
            setSelectedTargetId(response.data.id);
            setShowCreateNew(false);
            setNewEntityName('');
            setNewEntityHosts([]);

            // Refresh targets
            await fetchTargets();
        } catch (err) {
            console.error("Failed to create entity:", err);
            setError(err.response?.data?.error || "Failed to create");
        } finally {
            setCreatingEntity(false);
        }
    };

    const getTargetList = () => {
        switch (targetType) {
            case 'host':
                return hosts;
            case 'cluster':
                return clusters;
            case 'lpar':
                return lpars;
            default:
                return [];
        }
    };

    const getSelectedTargetName = () => {
        const list = getTargetList();
        const target = list.find(t => t.id === selectedTargetId);
        return target?.name || 'Unknown';
    };

    const handleNext = () => {
        if (step === 2 && selectedTargetId) {
            fetchPreview();
        }
        setStep(step + 1);
    };

    const handleBack = () => {
        setStep(step - 1);
        setError(null);
    };

    const canProceed = () => {
        switch (step) {
            case 1:
                return true; // Target type is always selected
            case 2:
                return selectedTargetId !== null;
            case 3:
                return preview !== null;
            default:
                return false;
        }
    };

    // Render step content
    const renderStep1 = () => (
        <div className="map-volumes-step">
            <h6 className="mb-3">Select Target Type</h6>
            <p className="text-muted small mb-4">
                Choose how you want to map {selectedVolumeIds.length} volume{selectedVolumeIds.length !== 1 ? 's' : ''} to hosts.
            </p>

            <div className="target-type-cards">
                <div
                    className={`target-type-card ${targetType === 'host' ? 'selected' : ''}`}
                    onClick={() => setTargetType('host')}
                >
                    <Server size={32} />
                    <h6>Single Host</h6>
                    <p className="small text-muted">Map all volumes to one host</p>
                </div>

                <div
                    className={`target-type-card ${targetType === 'cluster' ? 'selected' : ''}`}
                    onClick={() => setTargetType('cluster')}
                >
                    <Layers size={32} />
                    <h6>Host Cluster</h6>
                    <p className="small text-muted">Share volumes across all hosts in cluster</p>
                </div>

                <div
                    className={`target-type-card ${targetType === 'lpar' ? 'selected' : ''}`}
                    onClick={() => setTargetType('lpar')}
                >
                    <Database size={32} />
                    <h6>IBM i LPAR</h6>
                    <p className="small text-muted">Distribute volumes evenly across hosts</p>
                </div>
            </div>
        </div>
    );

    const renderStep2 = () => (
        <div className="map-volumes-step">
            <h6 className="mb-3">
                Select {targetType === 'host' ? 'Host' : targetType === 'cluster' ? 'Host Cluster' : 'IBM i LPAR'}
            </h6>

            {loadingTargets ? (
                <div className="text-center py-4">
                    <Spinner animation="border" size="sm" />
                    <span className="ms-2">Loading...</span>
                </div>
            ) : (
                <>
                    {targetType !== 'host' && (
                        <Button
                            variant="outline-primary"
                            size="sm"
                            className="mb-3"
                            onClick={() => setShowCreateNew(true)}
                        >
                            + Create New {targetType === 'cluster' ? 'Cluster' : 'LPAR'}
                        </Button>
                    )}

                    {showCreateNew && targetType !== 'host' && (
                        <div className="create-new-form mb-3 p-3 border rounded">
                            <Form.Group className="mb-2">
                                <Form.Label>Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={newEntityName}
                                    onChange={(e) => setNewEntityName(e.target.value)}
                                    placeholder={`Enter ${targetType === 'cluster' ? 'cluster' : 'LPAR'} name`}
                                />
                            </Form.Group>
                            <Form.Group className="mb-2">
                                <Form.Label>Select Hosts</Form.Label>
                                <div className="host-checkboxes" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                                    {hosts.map(host => (
                                        <Form.Check
                                            key={host.id}
                                            type="checkbox"
                                            label={host.name}
                                            checked={newEntityHosts.includes(host.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setNewEntityHosts([...newEntityHosts, host.id]);
                                                } else {
                                                    setNewEntityHosts(newEntityHosts.filter(id => id !== host.id));
                                                }
                                            }}
                                        />
                                    ))}
                                </div>
                            </Form.Group>
                            <div className="d-flex gap-2">
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={handleCreateNewEntity}
                                    disabled={creatingEntity || !newEntityName.trim()}
                                >
                                    {creatingEntity ? <Spinner size="sm" /> : 'Create'}
                                </Button>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        setShowCreateNew(false);
                                        setNewEntityName('');
                                        setNewEntityHosts([]);
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}

                    <div className="target-list" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {getTargetList().length === 0 ? (
                            <p className="text-muted text-center py-3">
                                No {targetType === 'host' ? 'hosts' : targetType === 'cluster' ? 'clusters' : 'LPARs'} found for this storage.
                            </p>
                        ) : (
                            getTargetList().map(target => (
                                <div
                                    key={target.id}
                                    className={`target-item p-2 mb-2 border rounded cursor-pointer ${selectedTargetId === target.id ? 'border-primary bg-light' : ''}`}
                                    onClick={() => setSelectedTargetId(target.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="d-flex justify-content-between align-items-center">
                                        <div>
                                            <strong>{target.name}</strong>
                                            {targetType !== 'host' && (
                                                <Badge bg="secondary" className="ms-2">
                                                    {target.host_count || target.hosts_details?.length || 0} hosts
                                                </Badge>
                                            )}
                                        </div>
                                        {selectedTargetId === target.id && (
                                            <Check size={20} className="text-primary" />
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );

    // Format volume ranges for display (e.g., "50: 00-1F, 40-5F")
    const formatVolumeRanges = (ranges) => {
        if (!ranges || ranges.length === 0) return '-';

        // Group ranges by LSS
        const byLss = {};
        ranges.forEach(r => {
            if (!byLss[r.lss]) byLss[r.lss] = [];
            const rangeStr = r.start === r.end ? r.start : `${r.start}-${r.end}`;
            byLss[r.lss].push(rangeStr);
        });

        // Format as "LSS: ranges" for each LSS
        return Object.keys(byLss).sort().map(lss => {
            const rangeStrs = byLss[lss];
            // If too many ranges, summarize
            if (rangeStrs.length > 4) {
                return `${lss}: ${rangeStrs.slice(0, 3).join(', ')}... (+${rangeStrs.length - 3} more)`;
            }
            return `${lss}: ${rangeStrs.join(', ')}`;
        }).join(' | ');
    };

    const renderStep3 = () => (
        <div className="map-volumes-step">
            <h6 className="mb-3">Preview Distribution</h6>

            {loadingPreview ? (
                <div className="text-center py-4">
                    <Spinner animation="border" size="sm" />
                    <span className="ms-2">Loading preview...</span>
                </div>
            ) : preview ? (
                <>
                    {/* Warning if some volumes already have mappings */}
                    {preview.summary?.already_mapped > 0 && (
                        <Alert variant="warning" className="mb-3">
                            <strong>{preview.summary.already_mapped} volume{preview.summary.already_mapped !== 1 ? 's' : ''} already mapped</strong>
                            <br />
                            <small>These volumes will be skipped. Only unmapped volumes are shown below.</small>
                        </Alert>
                    )}

                    <Alert variant="info" className="mb-3">
                        <strong>{preview.summary?.distribution_type}</strong>
                        <br />
                        {preview.summary?.total_volumes} volumes to {preview.summary?.total_hosts} host{preview.summary?.total_hosts !== 1 ? 's' : ''}
                        {preview.summary?.balanced && <Badge bg="success" className="ms-2">Balanced</Badge>}
                    </Alert>

                    <Table size="sm" bordered>
                        <thead>
                            <tr>
                                <th style={{ width: '25%' }}>Host</th>
                                <th style={{ width: '10%' }}>Count</th>
                                {storageType === 'DS8000' && targetType === 'lpar' && (
                                    <th>Volume Ranges</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {preview.hosts?.map(host => (
                                <tr key={host.host_id}>
                                    <td>{host.host_name}</td>
                                    <td>{host.volume_count}</td>
                                    {storageType === 'DS8000' && targetType === 'lpar' && (
                                        <td className="small" style={{ fontFamily: 'monospace' }}>
                                            {formatVolumeRanges(host.volume_ranges)}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </>
            ) : (
                <p className="text-muted">No preview available</p>
            )}
        </div>
    );

    const renderStep4 = () => {
        const volumesToMap = preview?.summary?.total_volumes || selectedVolumeIds.length;
        const alreadyMapped = preview?.summary?.already_mapped || 0;

        return (
            <div className="map-volumes-step text-center py-4">
                {success ? (
                    <>
                        <Check size={48} className="text-success mb-3" />
                        <h5>Mappings Created Successfully!</h5>
                        <p className="text-muted">
                            {volumesToMap} volume{volumesToMap !== 1 ? 's' : ''} mapped to {getSelectedTargetName()}
                        </p>
                    </>
                ) : (
                    <>
                        <h6 className="mb-3">Confirm Mapping</h6>
                        {alreadyMapped > 0 && (
                            <Alert variant="warning" className="text-start mb-3">
                                <small><strong>{alreadyMapped}</strong> volume{alreadyMapped !== 1 ? 's' : ''} will be skipped (already mapped)</small>
                            </Alert>
                        )}
                        <p>
                            Map <strong>{volumesToMap}</strong> volume{volumesToMap !== 1 ? 's' : ''} to{' '}
                            <strong>{getSelectedTargetName()}</strong>?
                        </p>
                        <p className="text-muted small">
                            This will create volume mappings in your active project.
                        </p>
                    </>
                )}
            </div>
        );
    };

    return (
        <Modal show={show} onHide={onClose} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>Map Volumes to Host</Modal.Title>
            </Modal.Header>

            <Modal.Body>
                {/* Progress indicator */}
                <div className="step-progress mb-4">
                    <div className="d-flex justify-content-between">
                        {['Target Type', 'Select Target', 'Preview', 'Confirm'].map((label, idx) => (
                            <div
                                key={idx}
                                className={`step-indicator ${step > idx + 1 ? 'completed' : ''} ${step === idx + 1 ? 'active' : ''}`}
                            >
                                <div className="step-number">{idx + 1}</div>
                                <div className="step-label small">{label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {error && (
                    <Alert variant="danger" dismissible onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                {step === 1 && renderStep1()}
                {step === 2 && renderStep2()}
                {step === 3 && renderStep3()}
                {step === 4 && renderStep4()}
            </Modal.Body>

            <Modal.Footer>
                {step > 1 && !success && (
                    <Button variant="secondary" onClick={handleBack}>
                        <ChevronLeft size={16} className="me-1" />
                        Back
                    </Button>
                )}

                <Button variant="secondary" onClick={onClose}>
                    {success ? 'Close' : 'Cancel'}
                </Button>

                {step < 4 && (
                    <Button
                        variant="primary"
                        onClick={handleNext}
                        disabled={!canProceed()}
                    >
                        Next
                        <ChevronRight size={16} className="ms-1" />
                    </Button>
                )}

                {step === 4 && !success && (
                    <Button
                        variant="primary"
                        onClick={handleCreateMappings}
                        disabled={creating}
                    >
                        {creating ? (
                            <>
                                <Spinner size="sm" className="me-2" />
                                Creating...
                            </>
                        ) : (
                            'Create Mappings'
                        )}
                    </Button>
                )}
            </Modal.Footer>

            <style>{`
                .target-type-cards {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1rem;
                }

                .target-type-card {
                    border: 2px solid var(--border-color, #dee2e6);
                    border-radius: 8px;
                    padding: 1.5rem 1rem;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .target-type-card:hover {
                    border-color: var(--bs-primary);
                    background-color: var(--secondary-bg, #f8f9fa);
                }

                .target-type-card.selected {
                    border-color: var(--bs-primary);
                    background-color: var(--bs-primary);
                    color: white;
                }

                .target-type-card.selected .text-muted {
                    color: rgba(255, 255, 255, 0.8) !important;
                }

                .target-type-card svg {
                    margin-bottom: 0.5rem;
                }

                .step-progress {
                    padding: 0 1rem;
                }

                .step-indicator {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    flex: 1;
                    position: relative;
                }

                .step-number {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    background-color: var(--border-color, #dee2e6);
                    color: var(--text-muted, #6c757d);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    margin-bottom: 0.5rem;
                }

                .step-indicator.active .step-number {
                    background-color: var(--bs-primary);
                    color: white;
                }

                .step-indicator.completed .step-number {
                    background-color: var(--bs-success);
                    color: white;
                }

                .step-label {
                    color: var(--text-muted, #6c757d);
                }

                .step-indicator.active .step-label {
                    color: var(--bs-primary);
                    font-weight: 500;
                }

                .target-item:hover {
                    background-color: var(--secondary-bg, #f8f9fa) !important;
                }

                .create-new-form {
                    background-color: var(--secondary-bg, #f8f9fa);
                }

                @media (max-width: 576px) {
                    .target-type-cards {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </Modal>
    );
};

export default MapVolumesToHostModal;
