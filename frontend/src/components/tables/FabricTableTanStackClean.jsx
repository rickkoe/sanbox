import React, { useRef, useContext, useState, useMemo, useEffect, useCallback } from "react";
import axios from "axios";
import { ConfigContext } from "../../context/ConfigContext";

// TanStack Table imports
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table';

// Clean TanStack Table implementation for Fabric management
const FabricTableTanStackClean = () => {
    const API_URL = process.env.REACT_APP_API_URL || '';
    const { config, loading: configLoading } = useContext(ConfigContext);
    const customerId = config?.customer?.id;

    // State for server data
    const [fabricData, setFabricData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // State for Excel-like features
    const [selectedCells, setSelectedCells] = useState(new Set());
    const [selectionRange, setSelectionRange] = useState(null);
    const [currentCell, setCurrentCell] = useState({ row: 0, col: 0 });
    const [globalFilter, setGlobalFilter] = useState('');
    const [fillPreview, setFillPreview] = useState(null);

    // State for editing
    const [editableData, setEditableData] = useState([]);
    const [hasChanges, setHasChanges] = useState(false);
    const [deletedRows, setDeletedRows] = useState([]); // Track deleted row IDs

    // API URL for fabric data
    const fabricsApiUrl = useMemo(() => {
        if (customerId) {
            const url = `${API_URL}/api/san/fabrics/?customer_id=${customerId}`;
            console.log('🔗 Building filtered API URL for customer', customerId, ':', url);
            return url;
        } else {
            const url = `${API_URL}/api/san/fabrics/`;
            console.log('⚠️ No customer ID available, using unfiltered API URL:', url);
            return url;
        }
    }, [customerId, API_URL]);

    // Delete API URL (individual deletion pattern)
    const getFabricDeleteUrl = (id) => `${API_URL}/api/san/fabrics/delete/${id}/`;

    // Vendor mapping (same as original FabricTable)
    const vendorOptions = [
        { code: 'CI', name: 'Cisco' },
        { code: 'BR', name: 'Brocade' }
    ];

    // Load fabric data from server
    useEffect(() => {
        const loadFabricData = async () => {
            // Don't load data if config is still loading
            if (configLoading) {
                console.log('⏳ Config still loading, waiting...');
                return;
            }

            // Don't load data without a proper URL
            if (!fabricsApiUrl) {
                console.log('⚠️ No fabricsApiUrl available');
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                console.log('🔄 Loading fabric data from:', fabricsApiUrl);
                console.log('👤 Customer ID:', customerId);
                console.log('🔧 Config loading state:', configLoading);

                const response = await axios.get(fabricsApiUrl);

                let fabricList = response.data;
                if (response.data.results) {
                    fabricList = response.data.results; // Handle paginated response
                }

                console.log('📥 Raw fabric data from server:', fabricList.length, 'records');
                console.log('📊 First fabric:', fabricList[0]);

                // Process data - convert vendor codes to names for display
                const processedData = fabricList.map(fabric => ({
                    ...fabric,
                    san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor
                }));

                setFabricData(processedData);
                console.log('✅ Processed fabric data:', processedData.length, 'records for customer', customerId);

            } catch (err) {
                console.error('❌ Error loading fabric data:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadFabricData();
    }, [fabricsApiUrl, configLoading, customerId]);

    // Fallback sample data only when no server data AND no customer ID
    const sampleData = useMemo(() => {
        if (!customerId) {
            return [
                { id: 'sample-1', name: 'SAMPLE_FABRIC', san_vendor: 'Cisco', zoneset_name: 'SAMPLE_ZS', vsan: 100, exists: true, notes: 'Sample data - no customer selected' },
            ];
        }
        return [];
    }, [customerId]);

    // Use server data if available, otherwise use sample data (only when no customer)
    const tableData = fabricData.length > 0 ? fabricData : sampleData;

    // Log data usage
    useEffect(() => {
        if (tableData.length > 0) {
            if (tableData[0].id === 'sample-1') {
                console.log('📋 Using sample data (no customer selected)');
            } else {
                console.log('📊 Using server data:', tableData.length, 'fabrics for customer', customerId);
            }
        } else {
            console.log('📭 No data available (customer selected but no fabrics found)');
        }
    }, [tableData, customerId]);

    // Initialize editable data when server data changes
    useEffect(() => {
        if (tableData.length > 0) {
            console.log('🔄 Initializing editable data with:', tableData.length, 'rows');
            setEditableData([...tableData]);
        }
    }, [tableData]);

    // Clear editable data when customer changes to prevent stale data
    useEffect(() => {
        console.log('👤 Customer changed to:', customerId);
        setEditableData([]);
        setDeletedRows([]);
        setHasChanges(false);
    }, [customerId]);

    // Use editable data for the table if it exists, otherwise use original
    const currentTableData = editableData.length > 0 ? editableData : tableData;

    // Debug data changes
    useEffect(() => {
        console.log('📊 Current table data changed:', {
            fabricData: fabricData.length,
            editableData: editableData.length,
            currentTableData: currentTableData.length,
            hasChanges
        });
    }, [fabricData.length, editableData.length, currentTableData.length, hasChanges]);

    // Add new row functionality
    const addNewRow = useCallback(() => {
        const newRow = {
            id: `new-${Date.now()}`, // Temporary ID for new rows
            name: '',
            san_vendor: '',
            zoneset_name: '',
            vsan: '',
            exists: false,
            notes: ''
        };

        const newData = [...editableData, newRow];
        setEditableData(newData);
        setHasChanges(true);

        console.log('➕ Added new row:', newRow);
    }, [editableData]);

    // Save changes to database
    const saveChanges = useCallback(async () => {
        if (!hasChanges) {
            console.log('⚠️ No changes to save');
            return;
        }

        try {
            console.log('💾 Starting save process...');
            console.log('📊 Current editableData:', editableData);
            console.log('🔧 API_URL:', API_URL);
            console.log('👤 Customer ID:', customerId);
            setIsLoading(true);

            // Separate new rows from existing rows
            const newRows = editableData.filter(row => String(row.id).startsWith('new-'));
            const existingRows = editableData.filter(row => !String(row.id).startsWith('new-'));

            console.log('➕ New rows to create:', newRows.length);
            console.log('✏️ Existing rows to update:', existingRows.length);
            console.log('🗑️ Rows to delete:', deletedRows.length);

            // Delete rows first (individual DELETE requests)
            const uniqueDeletedRows = [...new Set(deletedRows)]; // Remove duplicates
            for (const deletedId of uniqueDeletedRows) {
                console.log('🗑️ Deleting fabric ID:', deletedId);
                const response = await axios.delete(getFabricDeleteUrl(deletedId));
                console.log('✅ Deleted fabric response:', response.data);
            }

            // Save new rows (POST requests)
            for (const newRow of newRows) {
                const rowData = {
                    name: newRow.name,
                    san_vendor: vendorOptions.find(v => v.name === newRow.san_vendor)?.code || newRow.san_vendor,
                    zoneset_name: newRow.zoneset_name,
                    vsan: parseInt(newRow.vsan) || null,
                    exists: Boolean(newRow.exists),
                    notes: newRow.notes,
                    customer: customerId
                };

                console.log('📤 Creating new fabric:', rowData);
                const response = await axios.post(`${API_URL}/api/san/fabrics/`, rowData);
                console.log('✅ Created fabric with ID:', response.data.id);
            }

            // Save existing rows (PUT requests)
            for (const existingRow of existingRows) {
                const rowData = {
                    id: existingRow.id,
                    name: existingRow.name,
                    san_vendor: vendorOptions.find(v => v.name === existingRow.san_vendor)?.code || existingRow.san_vendor,
                    zoneset_name: existingRow.zoneset_name,
                    vsan: parseInt(existingRow.vsan) || null,
                    exists: Boolean(existingRow.exists),
                    notes: existingRow.notes,
                    customer: customerId
                };

                console.log('📤 Updating fabric ID:', existingRow.id);
                console.log('📤 Update payload:', rowData);
                const response = await axios.put(`${API_URL}/api/san/fabrics/${existingRow.id}/`, rowData);
                console.log('✅ Updated fabric response:', response.data);
            }

            console.log('🔄 Reloading data from server...');
            // Reload data from server to get fresh state
            const response = await axios.get(fabricsApiUrl);
            let fabricList = response.data;
            if (response.data.results) {
                fabricList = response.data.results;
            }

            console.log('📥 Reloaded data from server:', fabricList.length, 'records');

            // Process data - convert vendor codes to names for display
            const processedData = fabricList.map(fabric => ({
                ...fabric,
                san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor
            }));

            console.log('🔄 Setting fabric data to:', processedData.length, 'records');
            console.log('🔄 Setting editable data to:', processedData.length, 'records');

            setFabricData(processedData);
            setEditableData([...processedData]); // Force new array reference
            setDeletedRows([]); // Clear deleted rows after successful save
            setHasChanges(false);

            console.log('✅ All changes saved successfully!');

        } catch (error) {
            console.error('❌ Error saving changes:', error);
            console.error('❌ Error details:', error.response?.data);
            console.error('❌ Error status:', error.response?.status);
            alert('Error saving changes: ' + (error.response?.data?.detail || error.response?.data?.message || error.message));
        } finally {
            setIsLoading(false);
        }
    }, [editableData, hasChanges, deletedRows, customerId, fabricsApiUrl, vendorOptions, API_URL]);

    // Searchable dropdown cell component for vendor selection
    const VendorDropdownCell = ({ getValue, row, column, table }) => {
        const initialValue = getValue();
        const [value, setValue] = useState(initialValue);
        const [isOpen, setIsOpen] = useState(false);
        const [searchText, setSearchText] = useState('');

        // Update local state when the underlying data changes (for fill operations)
        useEffect(() => {
            const currentValue = getValue();
            if (currentValue !== value) {
                setValue(currentValue);
            }
        }, [getValue, value]);

        // Filter options based on search text
        const filteredOptions = vendorOptions.filter(vendor =>
            vendor.name.toLowerCase().includes(searchText.toLowerCase())
        );

        const handleInputChange = (e) => {
            const newSearchText = e.target.value;
            setSearchText(newSearchText);
            setIsOpen(true);

            // If exact match found, select it
            const exactMatch = vendorOptions.find(vendor =>
                vendor.name.toLowerCase() === newSearchText.toLowerCase()
            );
            if (exactMatch) {
                setValue(exactMatch.name);
                updateCellData(row.index, column.columnDef.accessorKey, exactMatch.name);
            }
        };

        const handleOptionClick = (selectedVendor) => {
            setValue(selectedVendor.name);
            setSearchText('');
            setIsOpen(false);
            updateCellData(row.index, column.columnDef.accessorKey, selectedVendor.name);
        };

        const handleInputFocus = () => {
            setIsOpen(true);
            setSearchText('');
        };

        const handleInputBlur = () => {
            // Delay closing to allow option clicks
            setTimeout(() => {
                setIsOpen(false);
                setSearchText('');
            }, 150);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setIsOpen(false);
                setSearchText('');
            } else if (e.key === 'Enter' && filteredOptions.length === 1) {
                handleOptionClick(filteredOptions[0]);
            }
        };

        return (
            <div style={{ position: 'relative', width: '100%' }}>
                <input
                    type="text"
                    value={isOpen ? searchText : (value || '')}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    onKeyDown={handleKeyDown}
                    placeholder="Select or type vendor..."
                    style={{
                        width: '100%',
                        border: 'none',
                        background: 'transparent',
                        fontSize: '14px',
                        padding: '2px 4px',
                        outline: 'none',
                        cursor: 'text'
                    }}
                />
                {isOpen && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        zIndex: 1000,
                        maxHeight: '150px',
                        overflowY: 'auto'
                    }}>
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(vendor => (
                                <div
                                    key={vendor.code}
                                    onClick={() => handleOptionClick(vendor)}
                                    style={{
                                        padding: '8px 12px',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid #eee',
                                        fontSize: '14px',
                                        backgroundColor: 'white'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.target.style.backgroundColor = '#f0f0f0';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.target.style.backgroundColor = 'white';
                                    }}
                                >
                                    {vendor.name}
                                </div>
                            ))
                        ) : (
                            <div style={{
                                padding: '8px 12px',
                                fontSize: '14px',
                                color: '#999',
                                fontStyle: 'italic'
                            }}>
                                No vendors found
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // Checkbox cell component for exists field
    const ExistsCheckboxCell = ({ getValue, row, column, table }) => {
        const initialValue = Boolean(getValue());
        const [checked, setChecked] = useState(initialValue);

        // Update local state when the underlying data changes (for fill operations)
        useEffect(() => {
            const currentValue = Boolean(getValue());
            if (currentValue !== checked) {
                setChecked(currentValue);
            }
        }, [getValue, checked]);

        const handleChange = (e) => {
            const newValue = e.target.checked;
            setChecked(newValue);
            updateCellData(row.index, column.columnDef.accessorKey, newValue);
            console.log(`📝 Updated ${column.columnDef.header} for row ${row.index} to: ${newValue ? 'checked' : 'unchecked'}`);
        };

        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={handleChange}
                    style={{
                        cursor: 'pointer',
                        transform: 'scale(1.2)',
                        margin: 0
                    }}
                />
            </div>
        );
    };

    // Update cell data function that will be passed to cell components
    const updateCellData = useCallback((rowIndex, columnKey, newValue) => {
        setEditableData(currentData => {
            const newData = [...currentData];
            newData[rowIndex] = {
                ...newData[rowIndex],
                [columnKey]: newValue
            };
            console.log(`📝 Updated ${columnKey} for row ${rowIndex} to: "${newValue}"`);
            console.log(`📊 Updated data now has ${newData.length} rows`);
            return newData;
        });
        setHasChanges(true);
    }, []);

    // Editable text cell component for text fields
    const EditableTextCell = ({ getValue, row, column, table }) => {
        const initialValue = getValue() || '';
        const [value, setValue] = useState(initialValue);
        const [isEditing, setIsEditing] = useState(false);

        // Update local state when the underlying data changes (for fill operations)
        useEffect(() => {
            const currentValue = getValue() || '';
            if (!isEditing && currentValue !== value) {
                setValue(currentValue);
            }
        }, [getValue, isEditing, value]);

        const handleDoubleClick = () => {
            setIsEditing(true);
        };

        const handleChange = (e) => {
            setValue(e.target.value);
        };

        const handleKeyDown = (e) => {
            if (e.key === 'Enter' || e.key === 'Tab') {
                e.preventDefault();
                e.stopPropagation();
                handleBlur();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                setValue(initialValue);
                setIsEditing(false);
            }
        };

        const handleBlur = () => {
            setIsEditing(false);

            // Only update if value changed
            if (value !== initialValue) {
                updateCellData(row.index, column.columnDef.accessorKey, value);
            }
        };

        if (isEditing) {
            return (
                <input
                    type="text"
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    autoFocus
                    style={{
                        width: '100%',
                        border: '2px solid #1976d2',
                        background: '#fff',
                        fontSize: '14px',
                        padding: '4px 6px',
                        outline: 'none',
                        borderRadius: '2px'
                    }}
                />
            );
        }

        return (
            <div
                onDoubleClick={handleDoubleClick}
                style={{
                    width: '100%',
                    padding: '4px 6px',
                    cursor: 'text',
                    minHeight: '20px',
                    borderRadius: '2px'
                }}
                title="Double-click to edit"
            >
                {value || ''}
            </div>
        );
    };

    // Table columns - define this before functions that use it
    const columns = useMemo(() => [
        {
            accessorKey: 'name',
            header: 'Name',
            size: 150,
            cell: EditableTextCell,
        },
        {
            accessorKey: 'san_vendor',
            header: 'Vendor',
            size: 120,
            cell: VendorDropdownCell,
        },
        {
            accessorKey: 'zoneset_name',
            header: 'Zoneset Name',
            size: 150,
            cell: EditableTextCell,
        },
        {
            accessorKey: 'vsan',
            header: 'VSAN',
            size: 80,
            cell: EditableTextCell,
        },
        {
            accessorKey: 'exists',
            header: 'Exists',
            size: 80,
            cell: ExistsCheckboxCell,
        },
        {
            accessorKey: 'notes',
            header: 'Notes',
            size: 200,
            cell: EditableTextCell,
        },
    ], []);

    // Filter data based on global search - define before functions that use it
    const filteredData = useMemo(() => {
        if (!globalFilter) {
            console.log('🔍 No global filter, showing all data:', currentTableData.length, 'rows');
            return currentTableData;
        }

        const filtered = currentTableData.filter(row =>
            Object.values(row).some(value =>
                String(value).toLowerCase().includes(globalFilter.toLowerCase())
            )
        );
        console.log('🔍 Global filter applied:', globalFilter, '- showing', filtered.length, 'of', currentTableData.length, 'rows');
        return filtered;
    }, [currentTableData, globalFilter]);

    // Excel-like functions
    const copySelectedCells = useCallback(() => {
        if (selectedCells.size === 0) return;

        // Group cells by row and column for proper 2D formatting
        const cellMap = new Map();
        Array.from(selectedCells).forEach(cellKey => {
            const [rowIndex, colIndex] = cellKey.split('-').map(Number);
            const row = currentTableData[rowIndex];
            const column = columns[colIndex];

            if (row && column) {
                if (!cellMap.has(rowIndex)) {
                    cellMap.set(rowIndex, new Map());
                }

                // Get the raw value from the data
                let cellValue = row[column.accessorKey];

                // Handle different data types properly
                if (cellValue === null || cellValue === undefined) {
                    cellValue = '';
                } else if (typeof cellValue === 'boolean') {
                    cellValue = cellValue ? 'TRUE' : 'FALSE';
                } else {
                    cellValue = String(cellValue);
                }

                // console.log(`📋 Copying cell [${rowIndex}, ${colIndex}] (${column.accessorKey}):`, cellValue);
                cellMap.get(rowIndex).set(colIndex, cellValue);
            }
        });

        // Convert to 2D array format for proper Excel pasting
        const sortedRows = Array.from(cellMap.keys()).sort((a, b) => a - b);
        const textRows = sortedRows.map(rowIndex => {
            const rowMap = cellMap.get(rowIndex);
            const sortedCols = Array.from(rowMap.keys()).sort((a, b) => a - b);
            return sortedCols.map(colIndex => rowMap.get(colIndex)).join('\t');
        });

        // Join rows with newlines for proper Excel row structure
        const textData = textRows.join('\n');

        navigator.clipboard.writeText(textData).then(() => {
            console.log('📋 Copied to clipboard:', selectedCells.size, 'cells in', textRows.length, 'rows');
            console.log('Data preview:', textData.substring(0, 100) + (textData.length > 100 ? '...' : ''));
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    }, [selectedCells, currentTableData, columns]);

    // Paste from clipboard (Excel-style)
    const pasteFromClipboard = useCallback(async () => {
        if (selectedCells.size === 0) {
            console.log('⚠️ No cells selected for paste operation');
            return;
        }

        try {
            const clipboardText = await navigator.clipboard.readText();
            console.log('📋 Pasting clipboard data:', clipboardText.substring(0, 100) + (clipboardText.length > 100 ? '...' : ''));

            // Parse clipboard data (Excel format: tabs = columns, newlines = rows)
            const rows = clipboardText.split('\n').filter(row => row.trim() !== '');
            const pasteData = rows.map(row => row.split('\t'));

            console.log('📊 Parsed paste data:', pasteData.length, 'rows x', pasteData[0]?.length || 0, 'columns');

            // Get the starting cell (top-left of selection)
            const cellKeys = Array.from(selectedCells).sort();
            const [startRowIndex, startColIndex] = cellKeys[0].split('-').map(Number);

            console.log('📍 Paste starting at row', startRowIndex, 'col', startColIndex);

            // Update data with pasted values (auto-extend rows if needed)
            setEditableData(currentData => {
                let newData = [...currentData];
                let changedCells = 0;
                let addedRows = 0;

                pasteData.forEach((rowValues, pasteRowIndex) => {
                    const targetRowIndex = startRowIndex + pasteRowIndex;

                    // Auto-extend: Add new rows if needed
                    while (targetRowIndex >= newData.length) {
                        const newRow = {
                            id: `new-${Date.now()}-${addedRows}`, // Unique temporary ID
                            name: '',
                            san_vendor: '',
                            zoneset_name: '',
                            vsan: '',
                            exists: false,
                            notes: ''
                        };
                        newData.push(newRow);
                        addedRows++;
                        console.log(`➕ Auto-added row ${newData.length - 1} for paste operation`);
                    }

                    rowValues.forEach((cellValue, pasteColIndex) => {
                        const targetColIndex = startColIndex + pasteColIndex;

                        // Skip if target column doesn't exist
                        if (targetColIndex >= columns.length) return;

                        const targetColumn = columns[targetColIndex];
                        if (!targetColumn) return;

                        // Update the cell value
                        newData[targetRowIndex] = {
                            ...newData[targetRowIndex],
                            [targetColumn.accessorKey]: cellValue.trim()
                        };

                        changedCells++;
                    });
                });

                console.log('✅ Paste completed: Updated', changedCells, 'cells');
                if (addedRows > 0) {
                    console.log('🔄 Auto-extended table by', addedRows, 'rows');
                }
                return newData;
            });

            setHasChanges(true);

            // Show success notification
            const pastePreview = {
                operation: 'Paste',
                sourceValue: `${pasteData.length}x${pasteData[0]?.length || 0} data`,
                columnName: 'Multiple Columns',
                targetCells: [],
                count: pasteData.length * (pasteData[0]?.length || 0)
            };

            setFillPreview(pastePreview);

            // Hide preview after 2 seconds
            setTimeout(() => {
                setFillPreview(null);
            }, 2000);

        } catch (error) {
            console.error('❌ Paste failed:', error);
            alert('Paste failed. Make sure you have copied data to clipboard.');
        }
    }, [selectedCells, columns]);

    // Clear selected cell contents
    const clearCellContents = useCallback(() => {
        if (selectedCells.size === 0) return;

        console.log('🗑️ Clearing', selectedCells.size, 'selected cells');

        setEditableData(currentData => {
            const newData = [...currentData];
            let clearedCells = 0;

            Array.from(selectedCells).forEach(cellKey => {
                const [rowIndex, colIndex] = cellKey.split('-').map(Number);
                const column = columns[colIndex];

                if (newData[rowIndex] && column) {
                    // Set appropriate empty value based on column type
                    let emptyValue = '';
                    if (column.accessorKey === 'exists') {
                        emptyValue = false;
                    } else if (column.accessorKey === 'vsan') {
                        emptyValue = '';
                    }

                    newData[rowIndex] = {
                        ...newData[rowIndex],
                        [column.accessorKey]: emptyValue
                    };
                    clearedCells++;
                }
            });

            console.log('✅ Cleared', clearedCells, 'cells');
            return newData;
        });

        setHasChanges(true);
    }, [selectedCells, columns]);

    // Delete selected rows
    const deleteSelectedRows = useCallback(() => {
        if (selectedCells.size === 0) return;

        // Get unique row indices from selected cells
        const selectedRowIndices = new Set();
        Array.from(selectedCells).forEach(cellKey => {
            const [rowIndex] = cellKey.split('-').map(Number);
            selectedRowIndices.add(rowIndex);
        });

        if (selectedRowIndices.size === 0) return;

        const rowCount = selectedRowIndices.size;
        const confirmation = window.confirm(`Delete ${rowCount} row${rowCount > 1 ? 's' : ''}? This action cannot be undone.`);

        if (!confirmation) return;

        console.log('🗑️ Deleting', rowCount, 'rows:', Array.from(selectedRowIndices).sort());

        setEditableData(currentData => {
            // Sort indices in descending order to avoid index shifting issues
            const sortedIndices = Array.from(selectedRowIndices).sort((a, b) => b - a);
            let newData = [...currentData];
            const toDelete = [];

            sortedIndices.forEach(rowIndex => {
                if (rowIndex < newData.length) {
                    const row = newData[rowIndex];
                    // Only track for deletion if it's an existing row (has real ID, not new-*)
                    if (row.id && !String(row.id).startsWith('new-')) {
                        toDelete.push(row.id);
                    }
                    newData.splice(rowIndex, 1);
                }
            });

            // Track deleted row IDs for API deletion
            if (toDelete.length > 0) {
                setDeletedRows(prev => [...prev, ...toDelete]);
                console.log('🗑️ Marked for deletion:', toDelete);
            }

            console.log('✅ Deleted rows, remaining:', newData.length);
            return newData;
        });

        setSelectedCells(new Set()); // Clear selection
        setHasChanges(true);
    }, [selectedCells]);

    const handleCellClick = useCallback((rowIndex, colIndex, event) => {
        const cellKey = `${rowIndex}-${colIndex}`;

        if (event.ctrlKey || event.metaKey) {
            // Toggle cell selection
            const newSelection = new Set(selectedCells);
            if (selectedCells.has(cellKey)) {
                newSelection.delete(cellKey);
            } else {
                newSelection.add(cellKey);
            }
            setSelectedCells(newSelection);
        } else if (event.shiftKey && selectionRange) {
            // Range selection
            const startRow = Math.min(selectionRange.startRow, rowIndex);
            const endRow = Math.max(selectionRange.startRow, rowIndex);
            const startCol = Math.min(selectionRange.startCol, colIndex);
            const endCol = Math.max(selectionRange.startCol, colIndex);

            const rangeCells = new Set();
            for (let r = startRow; r <= endRow; r++) {
                for (let c = startCol; c <= endCol; c++) {
                    rangeCells.add(`${r}-${c}`);
                }
            }
            setSelectedCells(rangeCells);
        } else {
            // Select single cell
            setSelectedCells(new Set([cellKey]));
            setCurrentCell({ row: rowIndex, col: colIndex });
            setSelectionRange({
                startRow: rowIndex,
                endRow: rowIndex,
                startCol: colIndex,
                endCol: colIndex,
            });
        }
    }, [selectedCells, selectionRange]);

    // Fill down operation - copy value from first selected cell to others
    const fillDown = useCallback(() => {
        if (selectedCells.size <= 1) return;

        const cellKeys = Array.from(selectedCells).sort();
        const firstCellKey = cellKeys[0];
        const [firstRowIndex, firstColIndex] = firstCellKey.split('-').map(Number);
        const sourceValue = currentTableData[firstRowIndex]?.[columns[firstColIndex]?.accessorKey];
        const columnName = columns[firstColIndex]?.header;
        const columnKey = columns[firstColIndex]?.accessorKey;

        if (sourceValue === undefined || sourceValue === null) return;

        console.log(`🔽 Fill Down: Copying "${sourceValue}" from ${columnName} to ${selectedCells.size - 1} cells`);

        // Update the actual data
        setEditableData(currentData => {
            const newData = [...currentData];

            // Fill all selected cells except the first one with the source value
            cellKeys.slice(1).forEach(cellKey => {
                const [rowIndex] = cellKey.split('-').map(Number);
                if (newData[rowIndex]) {
                    newData[rowIndex] = {
                        ...newData[rowIndex],
                        [columnKey]: sourceValue
                    };
                }
            });

            console.log(`✅ Fill Down completed: Updated ${cellKeys.length - 1} cells`);
            return newData;
        });

        setHasChanges(true);

        // Show success preview
        const fillData = {
            operation: 'Fill Down',
            sourceValue: sourceValue,
            columnName: columnName,
            targetCells: cellKeys.slice(1),
            count: selectedCells.size - 1
        };

        setFillPreview(fillData);

        // Hide preview after 2 seconds
        setTimeout(() => {
            setFillPreview(null);
        }, 2000);
    }, [selectedCells, currentTableData, columns]);

    // Fill right operation - copy value from leftmost selected cell to others
    const fillRight = useCallback(() => {
        if (selectedCells.size <= 1) return;

        const cellKeys = Array.from(selectedCells).sort();
        const firstCellKey = cellKeys[0];
        const [firstRowIndex, firstColIndex] = firstCellKey.split('-').map(Number);
        const sourceValue = currentTableData[firstRowIndex]?.[columns[firstColIndex]?.accessorKey];
        const columnName = columns[firstColIndex]?.header;

        if (sourceValue === undefined || sourceValue === null) return;

        console.log(`➡️ Fill Right: Copying "${sourceValue}" from ${columnName} to ${selectedCells.size - 1} cells`);

        // Update the actual data
        setEditableData(currentData => {
            const newData = [...currentData];

            // Fill all selected cells except the first one with the source value
            cellKeys.slice(1).forEach(cellKey => {
                const [rowIndex, colIndex] = cellKey.split('-').map(Number);
                const targetColumnKey = columns[colIndex]?.accessorKey;

                if (newData[rowIndex] && targetColumnKey) {
                    newData[rowIndex] = {
                        ...newData[rowIndex],
                        [targetColumnKey]: sourceValue
                    };
                }
            });

            console.log(`✅ Fill Right completed: Updated ${cellKeys.length - 1} cells`);
            return newData;
        });

        setHasChanges(true);

        // Show success preview
        const fillData = {
            operation: 'Fill Right',
            sourceValue: sourceValue,
            columnName: columnName,
            targetCells: cellKeys.slice(1),
            count: selectedCells.size - 1
        };

        setFillPreview(fillData);

        // Hide preview after 2 seconds
        setTimeout(() => {
            setFillPreview(null);
        }, 2000);
    }, [selectedCells, currentTableData, columns]);

    const handleKeyDown = useCallback((event) => {
        const maxRows = filteredData.length - 1;
        const maxCols = columns.length - 1;

        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            event.preventDefault();
            copySelectedCells();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
            event.preventDefault();
            pasteFromClipboard();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
            event.preventDefault();
            fillDown();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            fillRight();
        } else if (event.key === 'Delete') {
            event.preventDefault();
            clearCellContents();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'Backspace') {
            event.preventDefault();
            deleteSelectedRows();
        } else if (!event.ctrlKey && !event.metaKey) {
            // Arrow key navigation
            let newRow = currentCell.row;
            let newCol = currentCell.col;

            switch (event.key) {
                case 'ArrowUp':
                    event.preventDefault();
                    newRow = Math.max(0, currentCell.row - 1);
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    newRow = Math.min(maxRows, currentCell.row + 1);
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    newCol = Math.max(0, currentCell.col - 1);
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    newCol = Math.min(maxCols, currentCell.col + 1);
                    break;
                case 'Tab':
                    event.preventDefault();
                    if (event.shiftKey) {
                        newCol = Math.max(0, currentCell.col - 1);
                        if (newCol === currentCell.col && currentCell.row > 0) {
                            newRow = currentCell.row - 1;
                            newCol = maxCols;
                        }
                    } else {
                        newCol = Math.min(maxCols, currentCell.col + 1);
                        if (newCol === currentCell.col && currentCell.row < maxRows) {
                            newRow = currentCell.row + 1;
                            newCol = 0;
                        }
                    }
                    break;
                case 'Enter':
                    event.preventDefault();
                    newRow = Math.min(maxRows, currentCell.row + 1);
                    break;
                default:
                    return;
            }

            if (newRow !== currentCell.row || newCol !== currentCell.col) {
                setCurrentCell({ row: newRow, col: newCol });
                const newCellKey = `${newRow}-${newCol}`;

                if (event.shiftKey && (event.key.startsWith('Arrow') || event.key === 'Tab')) {
                    // Extend selection
                    if (selectionRange) {
                        const startRow = Math.min(selectionRange.startRow, newRow);
                        const endRow = Math.max(selectionRange.startRow, newRow);
                        const startCol = Math.min(selectionRange.startCol, newCol);
                        const endCol = Math.max(selectionRange.startCol, newCol);

                        const rangeCells = new Set();
                        for (let r = startRow; r <= endRow; r++) {
                            for (let c = startCol; c <= endCol; c++) {
                                rangeCells.add(`${r}-${c}`);
                            }
                        }
                        setSelectedCells(rangeCells);
                    }
                } else {
                    // Single cell selection
                    setSelectedCells(new Set([newCellKey]));
                    setSelectionRange({
                        startRow: newRow,
                        endRow: newRow,
                        startCol: newCol,
                        endCol: newCol,
                    });
                }
            }
        }
    }, [copySelectedCells, pasteFromClipboard, fillDown, fillRight, clearCellContents, deleteSelectedRows, currentCell, filteredData.length, columns.length, selectionRange]);

    // Table instance
    const table = useReactTable({
        data: filteredData,
        columns,
        state: {
            globalFilter,
        },
        onGlobalFilterChange: setGlobalFilter,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        globalFilterFn: 'includesString',
    });

    if (configLoading) {
        return (
            <div className="modern-table-container">
                <div className="d-flex justify-content-center align-items-center" style={{ height: '200px' }}>
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading configuration...</span>
                    </div>
                    <span className="ms-2">Loading customer configuration...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="modern-table-container">
            {/* Show error banner only if there's an error */}
            {error && (
                <div style={{
                    padding: '15px',
                    backgroundColor: '#f8d7da',
                    borderRadius: '8px',
                    margin: '20px',
                    border: '2px solid #dc3545'
                }}>
                    <h3 style={{
                        color: '#dc3545',
                        marginBottom: '10px'
                    }}>
                        ❌ Error Loading Data
                    </h3>
                    <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#dc3545' }}>
                        Error: {error} - Using sample data instead
                    </p>
                </div>
            )}

            {/* Search and Controls */}
            <div style={{
                margin: '20px',
                padding: '15px',
                backgroundColor: '#e3f2fd',
                borderRadius: '8px',
                border: '1px solid #1976d2'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' }}>
                            🔍 Global Search:
                        </label>
                        <input
                            type="text"
                            value={globalFilter}
                            onChange={(e) => setGlobalFilter(e.target.value)}
                            placeholder="Search all columns..."
                            style={{
                                width: '100%',
                                padding: '8px 12px',
                                border: '1px solid #ccc',
                                borderRadius: '4px',
                                fontSize: '14px'
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            onClick={copySelectedCells}
                            disabled={selectedCells.size === 0}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: selectedCells.size > 0 ? '#1976d2' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
                                fontSize: '14px'
                            }}
                        >
                            📋 Copy ({selectedCells.size})
                        </button>
                        <button
                            onClick={pasteFromClipboard}
                            disabled={selectedCells.size === 0}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: selectedCells.size > 0 ? '#9c27b0' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
                                fontSize: '14px'
                            }}
                        >
                            📥 Paste
                        </button>
                        <button
                            onClick={fillDown}
                            disabled={selectedCells.size <= 1}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: selectedCells.size > 1 ? '#28a745' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: selectedCells.size > 1 ? 'pointer' : 'not-allowed',
                                fontSize: '14px'
                            }}
                        >
                            🔽 Fill Down
                        </button>
                        <button
                            onClick={fillRight}
                            disabled={selectedCells.size <= 1}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: selectedCells.size > 1 ? '#dc3545' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: selectedCells.size > 1 ? 'pointer' : 'not-allowed',
                                fontSize: '14px'
                            }}
                        >
                            ➡️ Fill Right
                        </button>
                        <button
                            onClick={addNewRow}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#17a2b8',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '14px'
                            }}
                        >
                            ➕ Add New Row
                        </button>
                        <button
                            onClick={clearCellContents}
                            disabled={selectedCells.size === 0}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: selectedCells.size > 0 ? '#f39c12' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
                                fontSize: '14px'
                            }}
                        >
                            🗑️ Clear Cells
                        </button>
                        <button
                            onClick={deleteSelectedRows}
                            disabled={selectedCells.size === 0}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: selectedCells.size > 0 ? '#dc3545' : '#ccc',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: selectedCells.size > 0 ? 'pointer' : 'not-allowed',
                                fontSize: '14px'
                            }}
                        >
                            🗑️ Delete Rows
                        </button>
                        <button
                            onClick={saveChanges}
                            disabled={!hasChanges || isLoading}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: isLoading ? '#6c757d' : (hasChanges ? '#28a745' : '#e0e0e0'),
                                color: hasChanges ? 'white' : '#999',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: (!hasChanges || isLoading) ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: 'bold',
                                opacity: hasChanges ? 1 : 0.6
                            }}
                        >
                            {isLoading ? '⏳ Saving...' : '💾 Save Changes'}
                        </button>
                        <span style={{ fontSize: '12px', color: '#666' }}>
                            Ctrl+C copy | Ctrl+V paste | Ctrl+D fill down | Ctrl+R fill right | Del clear | Ctrl+Backspace delete rows
                        </span>
                    </div>
                </div>
            </div>

            {/* TanStack Table */}
            <div style={{
                margin: '20px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                overflow: 'hidden'
            }}>
                <table
                    style={{ width: '100%', borderCollapse: 'collapse' }}
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                >
                    {/* Header */}
                    <thead style={{ backgroundColor: '#f8f9fa' }}>
                        {table.getHeaderGroups().map(headerGroup => (
                            <tr key={headerGroup.id}>
                                {headerGroup.headers.map(header => (
                                    <th
                                        key={header.id}
                                        style={{
                                            borderBottom: '2px solid #dee2e6',
                                            borderRight: '1px solid #dee2e6',
                                            padding: '12px 8px',
                                            textAlign: 'left',
                                            fontWeight: '600',
                                            fontSize: '14px',
                                            cursor: header.column.getCanSort() ? 'pointer' : 'default',
                                            backgroundColor: '#f8f9fa',
                                            width: header.getSize(),
                                        }}
                                        onClick={header.column.getToggleSortingHandler()}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                            {{
                                                asc: ' 🔼',
                                                desc: ' 🔽',
                                            }[header.column.getIsSorted()] ?? null}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        ))}
                    </thead>

                    {/* Body */}
                    <tbody>
                        {table.getRowModel().rows.map((row, rowIndex) => (
                            <tr
                                key={row.id}
                                style={{
                                    borderBottom: '1px solid #dee2e6',
                                }}
                            >
                                {row.getVisibleCells().map((cell, colIndex) => {
                                    const cellKey = `${rowIndex}-${colIndex}`;
                                    const isSelected = selectedCells.has(cellKey);
                                    const isCurrentCell = currentCell.row === rowIndex && currentCell.col === colIndex;

                                    return (
                                        <td
                                            key={cell.id}
                                            onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                                            style={{
                                                borderRight: '1px solid #dee2e6',
                                                padding: '8px',
                                                fontSize: '14px',
                                                width: cell.column.getSize(),
                                                backgroundColor: isCurrentCell ? '#fff3cd' : (isSelected ? '#e3f2fd' : 'transparent'),
                                                border: isCurrentCell ? '3px solid #ffc107' : (isSelected ? '2px solid #1976d2' : '1px solid #dee2e6'),
                                                cursor: 'cell',
                                                userSelect: 'none',
                                                outline: isCurrentCell ? 'none' : 'initial',
                                            }}
                                            onMouseEnter={(e) => {
                                                if (!isSelected && !isCurrentCell) {
                                                    e.target.style.backgroundColor = '#f8f9fa';
                                                }
                                            }}
                                            onMouseLeave={(e) => {
                                                if (!isSelected && !isCurrentCell) {
                                                    e.target.style.backgroundColor = 'transparent';
                                                }
                                            }}
                                        >
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>


            {/* Fill Operation Preview */}
            {fillPreview && (
                <div style={{
                    position: 'fixed',
                    top: '20px',
                    right: '20px',
                    backgroundColor: '#4caf50',
                    color: 'white',
                    padding: '16px 20px',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    zIndex: 1000,
                    maxWidth: '350px',
                    animation: 'fadeIn 0.3s ease-in'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '18px' }}>
                            {fillPreview.operation === 'Fill Down' ? '🔽' : '➡️'}
                        </span>
                        <strong>{fillPreview.operation} Preview</strong>
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: '1.4' }}>
                        <div><strong>Source:</strong> "{fillPreview.sourceValue}" ({fillPreview.columnName})</div>
                        <div><strong>Target:</strong> {fillPreview.count} cells</div>
                        <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.9 }}>
                            ✅ Data updated successfully! Click Save to persist changes.
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FabricTableTanStackClean;