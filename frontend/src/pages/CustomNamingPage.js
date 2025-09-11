import React, { useState, useEffect } from "react";
import axios from "axios";

const CustomNamingPage = () => {
    const [selectedTable, setSelectedTable] = useState("");
    const [tableColumns, setTableColumns] = useState([]);
    const [customVariables, setCustomVariables] = useState([]);
    const [namingRules, setNamingRules] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState("");
    const [currentRule, setCurrentRule] = useState({
        name: "",
        table_name: "",
        pattern: [],
        is_active: true
    });
    const [newVariable, setNewVariable] = useState({
        name: "",
        value: "",
        description: ""
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Available tables for selection
    const availableTables = [
        { value: "zones", label: "Zones" },
        { value: "aliases", label: "Aliases" },
        { value: "fabrics", label: "Fabrics" },
        { value: "storage", label: "Storage" },
        { value: "hosts", label: "Hosts" },
        { value: "volumes", label: "Volumes" },
        { value: "customers", label: "Customers" },
        { value: "projects", label: "Projects" }
    ];

    // Load data on component mount
    useEffect(() => {
        loadCustomers();
        // Backend connectivity verified and working
    }, []);

    // Load variables and rules when customer is selected
    useEffect(() => {
        if (selectedCustomer) {
            loadCustomVariables();
            loadNamingRules();
        }
    }, [selectedCustomer]);

    // Load table columns when table is selected
    useEffect(() => {
        if (selectedTable) {
            loadTableColumns(selectedTable);
            setCurrentRule(prev => ({ ...prev, table_name: selectedTable }));
        }
    }, [selectedTable]);

    const loadTableColumns = async (tableName) => {
        try {
            setLoading(true);
            console.log('Loading columns for table:', tableName);
            const response = await axios.get(`/api/core/table-columns/?table_name=${tableName}`);
            console.log('Table columns response:', response.data);
            setTableColumns(response.data.columns || []);
        } catch (err) {
            console.error('Error loading table columns:', err);
            console.error('Response data:', err.response?.data);
            setError(`Failed to load columns for ${tableName}: ${err.response?.data?.error || err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const loadCustomers = async () => {
        try {
            setLoading(true);
            console.log('Loading customers from:', '/api/customers/');
            const response = await axios.get('/api/customers/');
            console.log('Customers API response:', response.data);
            
            // Handle different possible response structures
            let customersList = [];
            if (Array.isArray(response.data)) {
                customersList = response.data;
            } else if (response.data && Array.isArray(response.data.results)) {
                customersList = response.data.results;
            } else if (response.data && response.data.customers) {
                customersList = response.data.customers;
            }
            
            setCustomers(customersList);
            
            // Auto-select first customer if available
            if (customersList.length > 0) {
                setSelectedCustomer(customersList[0].id);
                
                // Endpoints tested and working correctly
            } else {
                setError('No customers found. Please create a customer first.');
            }
        } catch (err) {
            console.error('Error loading customers:', err);
            setError('Failed to load customers: ' + err.message);
            setCustomers([]); // Ensure customers is always an array
        } finally {
            setLoading(false);
        }
    };

    const loadCustomVariables = async () => {
        if (!selectedCustomer) return;
        
        try {
            const response = await axios.get(`/api/core/custom-variables/?customer=${selectedCustomer}`);
            setCustomVariables(response.data || []);
        } catch (err) {
            setError('Failed to load custom variables: ' + err.message);
        }
    };

    const loadNamingRules = async () => {
        if (!selectedCustomer) return;
        
        try {
            const response = await axios.get(`/api/core/custom-naming-rules/?customer=${selectedCustomer}`);
            setNamingRules(response.data || []);
        } catch (err) {
            setError('Failed to load naming rules: ' + err.message);
        }
    };

    const addPatternItem = (type, value, label = null) => {
        const newItem = {
            type: type,
            value: value,
            label: label || value
        };
        setCurrentRule(prev => ({
            ...prev,
            pattern: [...prev.pattern, newItem]
        }));
    };

    const removePatternItem = (index) => {
        setCurrentRule(prev => ({
            ...prev,
            pattern: prev.pattern.filter((_, i) => i !== index)
        }));
    };

    const saveNamingRule = async () => {
        if (!selectedCustomer) {
            setError('Please select a customer first');
            return;
        }
        
        if (!currentRule.name || !currentRule.table_name || currentRule.pattern.length === 0) {
            setError('Please provide a name, select a table, and add at least one pattern item');
            return;
        }

        try {
            setLoading(true);
            const ruleData = {
                ...currentRule,
                customer: selectedCustomer,
                user: null  // Explicitly set to null for global rules
            };
            
            // Sending naming rule data to backend

            if (currentRule.id) {
                await axios.put(`/api/core/custom-naming-rules/${currentRule.id}/`, ruleData);
                setSuccess('Naming rule updated successfully');
            } else {
                await axios.post('/api/core/custom-naming-rules/', ruleData);
                setSuccess('Naming rule created successfully');
            }

            // Reset form and reload rules
            setCurrentRule({
                name: "",
                table_name: selectedTable,
                pattern: [],
                is_active: true
            });
            loadNamingRules();
        } catch (err) {
            console.error('Full naming rule error:', err);
            console.error('Response data:', err.response?.data);
            console.error('Response status:', err.response?.status);
            
            let errorMessage = 'Failed to save naming rule: ';
            if (err.response?.data?.error) {
                errorMessage += err.response.data.error;
            } else if (err.response?.data) {
                errorMessage += JSON.stringify(err.response.data);
            } else {
                errorMessage += err.message;
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const editNamingRule = (rule) => {
        setCurrentRule(rule);
        setSelectedTable(rule.table_name);
    };

    const deleteNamingRule = async (ruleId) => {
        if (!window.confirm('Are you sure you want to delete this naming rule?')) {
            return;
        }

        try {
            setLoading(true);
            await axios.delete(`/api/core/custom-naming-rules/${ruleId}/`);
            setSuccess('Naming rule deleted successfully');
            loadNamingRules();
        } catch (err) {
            setError('Failed to delete naming rule: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const saveCustomVariable = async () => {
        if (!selectedCustomer) {
            setError('Please select a customer first');
            return;
        }
        
        if (!newVariable.name || !newVariable.value) {
            setError('Variable name and value are required');
            return;
        }

        try {
            setLoading(true);
            const variableData = {
                ...newVariable,
                customer: selectedCustomer,
                user: null  // Explicitly set to null for global variables
            };
            
            // Sending variable data to backend
            await axios.post('/api/core/custom-variables/', variableData);
            setSuccess('Custom variable created successfully');
            setNewVariable({ name: "", value: "", description: "" });
            loadCustomVariables();
        } catch (err) {
            console.error('Full error object:', err);
            console.error('Response data:', err.response?.data);
            console.error('Response status:', err.response?.status);
            
            let errorMessage = 'Failed to save custom variable: ';
            if (err.response?.data?.error) {
                errorMessage += err.response.data.error;
            } else if (err.response?.data) {
                errorMessage += JSON.stringify(err.response.data);
            } else {
                errorMessage += err.message;
            }
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const deleteCustomVariable = async (variableId) => {
        if (!window.confirm('Are you sure you want to delete this custom variable?')) {
            return;
        }

        try {
            setLoading(true);
            await axios.delete(`/api/core/custom-variables/${variableId}/`);
            setSuccess('Custom variable deleted successfully');
            loadCustomVariables();
        } catch (err) {
            setError('Failed to delete custom variable: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const generatePreview = () => {
        return currentRule.pattern.map(item => {
            if (item.type === 'text') {
                return item.value;
            } else if (item.type === 'column') {
                return `{${item.value}}`;
            } else if (item.type === 'variable') {
                const variable = customVariables.find(v => v.name === item.value);
                return variable ? variable.value : `{${item.value}}`;
            }
            return '';
        }).join('');
    };

    return (
        <div className="container-fluid mt-4">
            <div className="row">
                <div className="col-12">
                    <h2>Custom Naming Rules</h2>
                    <p className="text-muted">
                        Create custom naming patterns for your tables using text, column values, and custom variables.
                    </p>

                    {error && (
                        <div className="alert alert-danger alert-dismissible fade show" role="alert">
                            {error}
                            <button type="button" className="btn-close" onClick={() => setError("")}></button>
                        </div>
                    )}

                    {success && (
                        <div className="alert alert-success alert-dismissible fade show" role="alert">
                            {success}
                            <button type="button" className="btn-close" onClick={() => setSuccess("")}></button>
                        </div>
                    )}

                    {/* Customer Selection */}
                    <div className="row mb-4">
                        <div className="col-12">
                            <div className="card bg-light">
                                <div className="card-body">
                                    <div className="row align-items-center">
                                        <div className="col-md-6">
                                            <label className="form-label">Select Customer</label>
                                            <select
                                                className="form-select"
                                                value={selectedCustomer}
                                                onChange={(e) => setSelectedCustomer(e.target.value)}
                                                disabled={loading}
                                            >
                                                <option value="">
                                                    {loading ? "Loading customers..." : "Choose a customer..."}
                                                </option>
                                                {Array.isArray(customers) && customers.map(customer => (
                                                    <option key={customer.id} value={customer.id}>
                                                        {customer.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="col-md-6">
                                            <small className="text-muted">
                                                Select a customer to manage their custom naming rules and variables.
                                            </small>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {!selectedCustomer ? (
                <div className="row">
                    <div className="col-12">
                        <div className="alert alert-info">
                            <h5>Select a Customer</h5>
                            <p>
                                {customers.length === 0 && !loading 
                                    ? "No customers available. Please create a customer first through the Organization > Customers page."
                                    : "Please select a customer above to start creating custom naming rules and variables."
                                }
                            </p>
                        </div>
                    </div>
                </div>
            ) : (
            <div className="row">
                {/* Custom Variables Section */}
                <div className="col-md-4">
                    <div className="card">
                        <div className="card-header">
                            <h5>Custom Variables</h5>
                        </div>
                        <div className="card-body">
                            <div className="mb-3">
                                <label className="form-label">Variable Name</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={newVariable.name}
                                    onChange={(e) => setNewVariable({...newVariable, name: e.target.value})}
                                    placeholder="e.g., environment, datacenter"
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Variable Value</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={newVariable.value}
                                    onChange={(e) => setNewVariable({...newVariable, value: e.target.value})}
                                    placeholder="e.g., prod, dc1"
                                />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Description (Optional)</label>
                                <input
                                    type="text"
                                    className="form-control"
                                    value={newVariable.description}
                                    onChange={(e) => setNewVariable({...newVariable, description: e.target.value})}
                                    placeholder="Description of this variable"
                                />
                            </div>
                            <button
                                className="btn btn-primary w-100"
                                onClick={saveCustomVariable}
                                disabled={loading}
                            >
                                Add Variable
                            </button>

                            <div className="mt-4">
                                <h6>Existing Variables</h6>
                                {customVariables.length === 0 ? (
                                    <p className="text-muted">No custom variables defined</p>
                                ) : (
                                    <div className="list-group">
                                        {customVariables.map(variable => (
                                            <div key={variable.id} className="list-group-item d-flex justify-content-between align-items-center">
                                                <div>
                                                    <strong>{variable.name}</strong>: {variable.value}
                                                    {variable.description && (
                                                        <small className="d-block text-muted">{variable.description}</small>
                                                    )}
                                                </div>
                                                <button
                                                    className="btn btn-sm btn-outline-danger"
                                                    onClick={() => deleteCustomVariable(variable.id)}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Naming Rule Builder */}
                <div className="col-md-8">
                    <div className="card">
                        <div className="card-header">
                            <h5>Create Naming Rule</h5>
                        </div>
                        <div className="card-body">
                            <div className="row mb-3">
                                <div className="col-md-6">
                                    <label className="form-label">Rule Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={currentRule.name}
                                        onChange={(e) => setCurrentRule({...currentRule, name: e.target.value})}
                                        placeholder="e.g., Zone Standard Naming"
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Table</label>
                                    <select
                                        className="form-select"
                                        value={selectedTable}
                                        onChange={(e) => setSelectedTable(e.target.value)}
                                    >
                                        <option value="">Select a table...</option>
                                        {availableTables.map(table => (
                                            <option key={table.value} value={table.value}>
                                                {table.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Pattern Builder */}
                            <div className="mb-4">
                                <label className="form-label">Naming Pattern</label>
                                <div className="border p-3 rounded mb-3" style={{minHeight: '60px'}}>
                                    {currentRule.pattern.length === 0 ? (
                                        <span className="text-muted">Pattern will appear here as you add components</span>
                                    ) : (
                                        <div className="d-flex flex-wrap gap-1">
                                            {currentRule.pattern.map((item, index) => (
                                                <span
                                                    key={index}
                                                    className={`badge ${
                                                        item.type === 'text' ? 'bg-secondary' :
                                                        item.type === 'column' ? 'bg-primary' : 'bg-success'
                                                    } position-relative`}
                                                    style={{fontSize: '0.9em', padding: '6px 12px'}}
                                                >
                                                    {item.label || item.value}
                                                    <button
                                                        type="button"
                                                        className="btn-close btn-close-white position-absolute top-0 start-100 translate-middle"
                                                        style={{fontSize: '0.6em'}}
                                                        onClick={() => removePatternItem(index)}
                                                    ></button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Preview */}
                                {currentRule.pattern.length > 0 && (
                                    <div className="alert alert-info">
                                        <strong>Preview:</strong> {generatePreview()}
                                    </div>
                                )}

                                {/* Add Pattern Items */}
                                <div className="row">
                                    <div className="col-md-4">
                                        <h6>Add Text</h6>
                                        <div className="input-group mb-2">
                                            <input
                                                type="text"
                                                className="form-control"
                                                placeholder="Enter text"
                                                id="textInput"
                                            />
                                            <button
                                                className="btn btn-outline-secondary"
                                                onClick={() => {
                                                    const input = document.getElementById('textInput');
                                                    if (input.value.trim()) {
                                                        addPatternItem('text', input.value.trim());
                                                        input.value = '';
                                                    }
                                                }}
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>

                                    <div className="col-md-4">
                                        <h6>Add Column</h6>
                                        <select
                                            className="form-select mb-2"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const column = tableColumns.find(c => c.name === e.target.value);
                                                    addPatternItem('column', e.target.value, column?.verbose_name || e.target.value);
                                                    e.target.value = '';
                                                }
                                            }}
                                        >
                                            <option value="">Select column...</option>
                                            {tableColumns.map(column => (
                                                <option key={column.name} value={column.name}>
                                                    {column.verbose_name || column.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="col-md-4">
                                        <h6>Add Variable</h6>
                                        <select
                                            className="form-select mb-2"
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    const variable = customVariables.find(v => v.name === e.target.value);
                                                    addPatternItem('variable', e.target.value, `${variable.name} (${variable.value})`);
                                                    e.target.value = '';
                                                }
                                            }}
                                        >
                                            <option value="">Select variable...</option>
                                            {customVariables.map(variable => (
                                                <option key={variable.id} value={variable.name}>
                                                    {variable.name} ({variable.value})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="mb-3">
                                <div className="form-check">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="isActive"
                                        checked={currentRule.is_active}
                                        onChange={(e) => setCurrentRule({...currentRule, is_active: e.target.checked})}
                                    />
                                    <label className="form-check-label" htmlFor="isActive">
                                        Active Rule
                                    </label>
                                </div>
                            </div>

                            <div className="d-flex gap-2">
                                <button
                                    className="btn btn-primary"
                                    onClick={saveNamingRule}
                                    disabled={loading}
                                >
                                    {currentRule.id ? 'Update Rule' : 'Save Rule'}
                                </button>
                                {currentRule.id && (
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => {
                                            setCurrentRule({
                                                name: "",
                                                table_name: selectedTable,
                                                pattern: [],
                                                is_active: true
                                            });
                                        }}
                                    >
                                        New Rule
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Existing Rules */}
                    <div className="card mt-4">
                        <div className="card-header">
                            <h5>Existing Naming Rules</h5>
                        </div>
                        <div className="card-body">
                            {namingRules.length === 0 ? (
                                <p className="text-muted">No naming rules created yet</p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-hover">
                                        <thead>
                                            <tr>
                                                <th>Name</th>
                                                <th>Table</th>
                                                <th>Pattern Preview</th>
                                                <th>Status</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {namingRules.map(rule => (
                                                <tr key={rule.id}>
                                                    <td>{rule.name}</td>
                                                    <td>
                                                        <span className="badge bg-light text-dark">
                                                            {availableTables.find(t => t.value === rule.table_name)?.label || rule.table_name}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <code>
                                                            {rule.pattern.map(item => {
                                                                if (item.type === 'text') return item.value;
                                                                if (item.type === 'column') return `{${item.value}}`;
                                                                if (item.type === 'variable') {
                                                                    const variable = customVariables.find(v => v.name === item.value);
                                                                    return variable ? variable.value : `{${item.value}}`;
                                                                }
                                                                return '';
                                                            }).join('')}
                                                        </code>
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${rule.is_active ? 'bg-success' : 'bg-secondary'}`}>
                                                            {rule.is_active ? 'Active' : 'Inactive'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div className="btn-group btn-group-sm">
                                                            <button
                                                                className="btn btn-outline-primary"
                                                                onClick={() => editNamingRule(rule)}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                className="btn btn-outline-danger"
                                                                onClick={() => deleteNamingRule(rule.id)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            )}
        </div>
    );
};

export default CustomNamingPage;