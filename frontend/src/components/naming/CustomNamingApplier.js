import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CustomNamingApplier = ({ 
    tableName, 
    selectedRows = [], 
    onApplyNaming,
    customerId,
    disabled = false 
}) => {
    const [namingRules, setNamingRules] = useState([]);
    const [selectedRule, setSelectedRule] = useState('');
    const [customVariables, setCustomVariables] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Load naming rules and variables when component mounts or customer changes
    useEffect(() => {
        if (customerId && tableName) {
            loadNamingData();
        }
    }, [customerId, tableName]);

    const loadNamingData = async () => {
        try {
            setLoading(true);
            
            // Load both naming rules and custom variables
            const [rulesResponse, variablesResponse] = await Promise.all([
                axios.get(`/api/core/custom-naming-rules/?customer=${customerId}&table_name=${tableName}`),
                axios.get(`/api/core/custom-variables/?customer=${customerId}`)
            ]);
            
            setNamingRules(rulesResponse.data || []);
            setCustomVariables(variablesResponse.data || []);
        } catch (err) {
            console.error('Error loading naming data:', err);
            setError('Failed to load naming rules');
        } finally {
            setLoading(false);
        }
    };

    const applyNamingRule = async () => {
        console.log('🎯 applyNamingRule called with:', {
            selectedRule,
            selectedRowsLength: selectedRows.length,
            selectedRows: selectedRows
        });
        
        if (!selectedRule || selectedRows.length === 0) {
            console.log('❌ Cannot apply: no rule or no selected rows');
            return;
        }

        try {
            setLoading(true);
            
            // Find the selected rule
            const rule = namingRules.find(r => r.id === parseInt(selectedRule));
            if (!rule) {
                setError('Selected naming rule not found');
                return;
            }

            // Generate names for each selected row
            const updatedRows = selectedRows.map(row => {
                const generatedName = generateNameFromPattern(rule.pattern, row);
                return {
                    ...row,
                    name: generatedName
                };
            });

            // Call the parent handler with the updated rows
            if (onApplyNaming) {
                console.log('🚀 About to call onApplyNaming with:', updatedRows, rule);
                onApplyNaming(updatedRows, rule);
                console.log('✅ onApplyNaming call completed');
            } else {
                console.error('❌ onApplyNaming callback is not provided!');
            }

            setSelectedRule(''); // Reset selection
        } catch (err) {
            console.error('Error applying naming rule:', err);
            setError('Failed to apply naming rule');
        } finally {
            setLoading(false);
        }
    };

    const generateNameFromPattern = (pattern, rowData) => {
        if (!pattern || !Array.isArray(pattern)) {
            return '';
        }

        console.log('🎯 generateNameFromPattern called with:');
        console.log('Pattern:', pattern);
        console.log('Row data:', rowData);
        console.log('Row data keys:', Object.keys(rowData));

        return pattern.map(item => {
            console.log(`Processing pattern item:`, item);
            
            switch (item.type) {
                case 'text':
                    console.log(`Text item: "${item.value}"`);
                    return item.value;
                
                case 'column':
                    const columnValue = rowData[item.value];
                    console.log(`Column "${item.value}" = "${columnValue}"`);
                    console.log(`Available columns:`, Object.keys(rowData).filter(k => !k.startsWith('_')));
                    
                    // Handle string representations of null/undefined from Handsontable
                    if (columnValue === null || columnValue === undefined || 
                        columnValue === 'null' || columnValue === 'undefined' || columnValue === '') {
                        return '';
                    }
                    return columnValue;
                
                case 'variable':
                    // Find the custom variable
                    const variable = customVariables.find(v => v.name === item.value);
                    const variableValue = variable ? variable.value : `{${item.value}}`;
                    console.log(`Variable "${item.value}" = "${variableValue}"`);
                    return variableValue;
                
                default:
                    console.log(`Unknown item type: ${item.type}`);
                    return '';
            }
        }).join('');
    };

    const getPreviewName = () => {
        if (!selectedRule || selectedRows.length === 0) {
            return 'Select a rule and rows to see preview';
        }

        const rule = namingRules.find(r => r.id === parseInt(selectedRule));
        if (!rule) return 'Rule not found';

        // Use the first selected row for preview
        return generateNameFromPattern(rule.pattern, selectedRows[0]);
    };

    if (loading && namingRules.length === 0) {
        return (
            <div className="custom-naming-applier">
                <span className="text-muted">Loading naming rules...</span>
            </div>
        );
    }

    console.log('🔧 CustomNamingApplier render:', {
        selectedRule,
        selectedRowsCount: selectedRows.length,
        disabled,
        loading,
        namingRulesCount: namingRules.length
    });

    const isButtonDisabled = disabled || !selectedRule || selectedRows.length === 0 || loading;
    console.log('🔘 Button disabled state:', isButtonDisabled);

    return (
        <div className="custom-naming-applier d-flex align-items-center gap-2">
            <select
                className="form-select form-select-sm"
                value={selectedRule}
                onChange={(e) => {
                    console.log('📝 Rule selected:', e.target.value);
                    setSelectedRule(e.target.value);
                }}
                disabled={disabled || namingRules.length === 0}
                style={{ minWidth: '150px' }}
            >
                <option value="">
                    {namingRules.length === 0 ? 'No naming rules' : 'Select naming rule...'}
                </option>
                {namingRules.filter(rule => rule.is_active).map(rule => (
                    <option key={rule.id} value={rule.id}>
                        {rule.name}
                    </option>
                ))}
            </select>

            <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                    console.log('🖱️ Apply button clicked!');
                    console.log('  - selectedRule:', selectedRule);
                    console.log('  - selectedRows.length:', selectedRows.length);
                    console.log('  - disabled:', disabled);
                    console.log('  - loading:', loading);
                    applyNamingRule();
                }}
                disabled={isButtonDisabled}
                title={`Apply naming to ${selectedRows.length} selected row(s)`}
            >
                {loading ? 'Applying...' : `Apply to ${selectedRows.length} row(s)`}
            </button>

            {selectedRule && selectedRows.length > 0 && (
                <small className="text-muted" style={{ maxWidth: '200px' }}>
                    Preview: <strong>{getPreviewName()}</strong>
                </small>
            )}

            {error && (
                <small className="text-danger">
                    {error}
                </small>
            )}
        </div>
    );
};

export default CustomNamingApplier;