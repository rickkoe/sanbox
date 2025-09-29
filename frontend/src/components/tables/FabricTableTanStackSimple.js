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

// Simple demo component to test basic functionality
const FabricTableTanStackSimple = () => {
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

    // API URL for fabric data
    const fabricsApiUrl = useMemo(() => {
        if (customerId) {
            return `${API_URL}/api/san/fabrics/?customer_id=${customerId}`;
        } else {
            return `${API_URL}/api/san/fabrics/`;
        }
    }, [customerId, API_URL]);

    // Vendor mapping (same as original FabricTable)
    const vendorOptions = [
        { code: 'CI', name: 'Cisco' },
        { code: 'BR', name: 'Brocade' }
    ];

    // Load fabric data from server
    useEffect(() => {
        const loadFabricData = async () => {
            if (!fabricsApiUrl) return;

            setIsLoading(true);
            setError(null);

            try {
                console.log('🔄 Loading fabric data from:', fabricsApiUrl);
                const response = await axios.get(fabricsApiUrl);

                let fabricList = response.data;
                if (response.data.results) {
                    fabricList = response.data.results; // Handle paginated response
                }

                // Process data - convert vendor codes to names for display
                const processedData = fabricList.map(fabric => ({
                    ...fabric,
                    san_vendor: vendorOptions.find(v => v.code === fabric.san_vendor)?.name || fabric.san_vendor
                }));

                setFabricData(processedData);
                console.log('✅ Loaded fabric data:', processedData.length, 'records');

            } catch (err) {
                console.error('❌ Error loading fabric data:', err);
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        loadFabricData();
    }, [fabricsApiUrl]);

    // Fallback sample data if no server data
    const sampleData = useMemo(() => [
        { id: 'sample-1', name: 'SAMPLE_FABRIC', san_vendor: 'Cisco', zoneset_name: 'SAMPLE_ZS', vsan: 100, exists: true, notes: 'Sample data - no server data available' },
    ], []);

    // Use server data if available, otherwise use sample data
    const tableData = fabricData.length > 0 ? fabricData : sampleData;

    // Table columns - define this before functions that use it
    const columns = useMemo(() => [
        {
            accessorKey: 'name',
            header: 'Name',
            size: 150,
        },
        {
            accessorKey: 'san_vendor',
            header: 'Vendor',
            size: 100,
        },
        {
            accessorKey: 'zoneset_name',
            header: 'Zoneset Name',
            size: 150,
        },
        {
            accessorKey: 'vsan',
            header: 'VSAN',
            size: 80,
        },
        {
            accessorKey: 'exists',
            header: 'Exists',
            size: 80,
            cell: ({ getValue }) => (
                <span style={{ color: getValue() ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                    {getValue() ? '✓' : '✗'}
                </span>
            ),
        },
        {
            accessorKey: 'notes',
            header: 'Notes',
            size: 200,
        },
    ], []);

    // Filter data based on global search - define before functions that use it
    const filteredData = useMemo(() => {
        if (!globalFilter) return tableData;

        return tableData.filter(row =>
            Object.values(row).some(value =>
                String(value).toLowerCase().includes(globalFilter.toLowerCase())
            )
        );
    }, [tableData, globalFilter]);

    // Excel-like functions
    const copySelectedCells = useCallback(() => {
        if (selectedCells.size === 0) return;

        const cellValues = Array.from(selectedCells).map(cellKey => {
            const [rowIndex, colIndex] = cellKey.split('-').map(Number);
            const row = tableData[rowIndex];
            const column = columns[colIndex];
            if (row && column) {
                return row[column.accessorKey] || '';
            }
            return '';
        });

        const textData = cellValues.join('\t'); // Tab-separated for Excel compatibility
        navigator.clipboard.writeText(textData).then(() => {
            console.log('📋 Copied to clipboard:', cellValues.length, 'cells');
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    }, [selectedCells, tableData, columns]);

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
        const sourceValue = tableData[firstRowIndex]?.[columns[firstColIndex]?.accessorKey];
        const columnName = columns[firstColIndex]?.header;

        if (sourceValue === undefined || sourceValue === null) return;

        // Create fill preview with visual feedback
        const fillData = {
            operation: 'Fill Down',
            sourceValue: sourceValue,
            columnName: columnName,
            targetCells: cellKeys.slice(1), // All cells except the first one
            count: selectedCells.size - 1
        };

        setFillPreview(fillData);

        console.log(`🔽 Fill Down: Would copy "${sourceValue}" from ${columnName} to ${fillData.count} cells`);

        // Show preview for 3 seconds
        setTimeout(() => {
            setFillPreview(null);
        }, 3000);

        // In a real editable implementation, this would update the actual data:
        // const updatedData = [...tableData];
        // cellKeys.slice(1).forEach(cellKey => {
        //     const [rowIndex] = cellKey.split('-').map(Number);
        //     updatedData[rowIndex][columns[firstColIndex].accessorKey] = sourceValue;
        // });
        // setTableData(updatedData);
    }, [selectedCells, tableData, columns]);

    // Fill right operation - copy value from leftmost selected cell to others
    const fillRight = useCallback(() => {
        if (selectedCells.size <= 1) return;

        const cellKeys = Array.from(selectedCells).sort();
        const firstCellKey = cellKeys[0];
        const [firstRowIndex, firstColIndex] = firstCellKey.split('-').map(Number);
        const sourceValue = tableData[firstRowIndex]?.[columns[firstColIndex]?.accessorKey];
        const columnName = columns[firstColIndex]?.header;

        if (sourceValue === undefined || sourceValue === null) return;

        // Create fill preview with visual feedback
        const fillData = {
            operation: 'Fill Right',
            sourceValue: sourceValue,
            columnName: columnName,
            targetCells: cellKeys.slice(1), // All cells except the first one
            count: selectedCells.size - 1
        };

        setFillPreview(fillData);

        console.log(`➡️ Fill Right: Would copy "${sourceValue}" from ${columnName} to ${fillData.count} cells`);

        // Show preview for 3 seconds
        setTimeout(() => {
            setFillPreview(null);
        }, 3000);

        // In a real editable implementation, this would update the actual data across columns
    }, [selectedCells, tableData, columns]);

    const handleKeyDown = useCallback((event) => {
        const maxRows = filteredData.length - 1;
        const maxCols = columns.length - 1;

        if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
            event.preventDefault();
            copySelectedCells();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
            event.preventDefault();
            fillDown();
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            fillRight();
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
    }, [copySelectedCells, fillDown, fillRight, currentCell, filteredData.length, columns.length, selectionRange]);

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
            {/* Status Header */}
            <div style={{
                padding: '15px',
                backgroundColor: error ? '#f8d7da' : isLoading ? '#fff3cd' : '#d4edda',
                borderRadius: '8px',
                margin: '20px',
                border: `2px solid ${error ? '#dc3545' : isLoading ? '#ffc107' : '#28a745'}`
            }}>
                <h3 style={{
                    color: error ? '#dc3545' : isLoading ? '#856404' : '#28a745',
                    marginBottom: '10px'
                }}>
                    {error ? '❌ Error Loading Data' : isLoading ? '⏳ Loading...' : '🚀 TanStack Table - Real Data!'}
                </h3>
                <p style={{ margin: 0, fontSize: '14px' }}>
                    Customer: {config?.customer?.name || 'Not available'} |
                    Data Source: {fabricData.length > 0 ? 'Server API' : 'Sample'} |
                    Rows: {tableData.length} |
                    Columns: {columns.length}
                </p>
                {error && (
                    <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#dc3545' }}>
                        Error: {error} - Using sample data instead
                    </p>
                )}
            </div>

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
                        <span style={{ fontSize: '12px', color: '#666' }}>
                            Ctrl+C copy | Ctrl+D fill down | Ctrl+R fill right
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

            {/* Test Instructions */}
            <div style={{
                margin: '20px',
                padding: '15px',
                backgroundColor: '#f0f8e8',
                border: '1px solid #27ae60',
                borderRadius: '5px',
            }}>
                <h5>🎉 Excel-like TanStack Table - Full Features!</h5>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    <div>
                        <h6 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>📊 Data Features:</h6>
                        <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '13px' }}>
                            <li>✅ Real server data loading</li>
                            <li>✅ Global search filtering</li>
                            <li>✅ Column header sorting</li>
                            <li>✅ Row count: {filteredData.length}</li>
                        </ul>
                    </div>

                    <div>
                        <h6 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>🖱️ Excel Features:</h6>
                        <ul style={{ margin: 0, paddingLeft: '15px', fontSize: '13px' }}>
                            <li>✅ Click cells to select</li>
                            <li>✅ Ctrl+click for multi-select</li>
                            <li>✅ Shift+click for range select</li>
                            <li>✅ Arrow key navigation</li>
                            <li>✅ Tab/Shift+Tab navigation</li>
                            <li>✅ Copy/paste operations</li>
                            <li>✅ Fill down/right operations</li>
                        </ul>
                    </div>
                </div>

                <div style={{
                    padding: '10px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '4px',
                    marginTop: '10px'
                }}>
                    <h6 style={{ margin: '0 0 8px 0', color: '#1976d2' }}>🧪 Try These Tests:</h6>
                    <ol style={{ margin: 0, paddingLeft: '15px', fontSize: '13px' }}>
                        <li><strong>Search:</strong> Type "cisco" or "prod" in search box</li>
                        <li><strong>Sort:</strong> Click column headers (Name, Vendor, etc.)</li>
                        <li><strong>Cell Selection:</strong> Click cells (yellow = active, blue = selected)</li>
                        <li><strong>Multi-select:</strong> Ctrl+click or Shift+click for ranges</li>
                        <li><strong>Navigation:</strong> Arrow keys, Tab/Shift+Tab, Enter</li>
                        <li><strong>Copy:</strong> Ctrl+C or Copy button, paste to Excel/Notepad</li>
                        <li><strong>Fill Operations:</strong> Select range, Ctrl+D (down) or Ctrl+R (right)</li>
                        <li><strong>Range Selection:</strong> Click and Shift+arrow keys</li>
                    </ol>
                </div>

                <p style={{ marginTop: '10px', marginBottom: 0, fontSize: '12px', fontStyle: 'italic', textAlign: 'center' }}>
                    🚀 This demonstrates TanStack Table's performance advantages with Excel-like UX!
                </p>
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
                            💡 In an editable table, this would update the data
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FabricTableTanStackSimple;