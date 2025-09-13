// Utility functions for adding custom naming to tables

// Get text columns that can accept naming rules
export const getTextColumns = (allColumns) => {
    // Define column types that can accept text input
    const textColumnTypes = ['text', 'string'];
    const textColumnNames = ['name', 'title', 'description', 'notes', 'label', 'alias'];
    
    return allColumns.filter(column => {
        const columnName = column.data.toLowerCase();
        
        // Include if column name suggests it's a text field
        if (textColumnNames.some(name => columnName.includes(name))) {
            return true;
        }
        
        // Include specific known text columns
        if (['name', 'wwpn', 'notes', 'description'].includes(columnName)) {
            return true;
        }
        
        return false;
    }).map(column => ({
        key: column.data,
        label: column.title || column.data
    }));
};

// Create a naming handler for tables - RESTORED ZoneTable approach
export const createNamingHandler = (tableRef, allColumns, setSelectedRows) => {
    return (updatedRows, rule) => {
        console.log('🚀 handleApplyNaming called with:', updatedRows, rule);
        
        if (!tableRef.current?.hotInstance) {
            console.error('❌ No hotInstance available');
            return;
        }

        const hot = tableRef.current.hotInstance;
        console.log('✅ Hot instance found:', hot);
        
        // Apply the updated names to the table
        updatedRows.forEach(updatedRow => {
            const rowIndex = updatedRow._rowIndex;
            
            console.log(`🎯 Processing updatedRow for row ${rowIndex}:`, updatedRow);
            
            // Find which column was updated by looking for the target column that was used
            // The CustomNamingApplier sets the value on the selectedTargetColumn key
            let targetColumnKey = null;
            let newValue = null;
            
            // Look for the column that has a new value
            for (const key in updatedRow) {
                if (key !== '_rowIndex' && updatedRow[key] && typeof updatedRow[key] === 'string') {
                    targetColumnKey = key;
                    newValue = updatedRow[key];
                    console.log(`🔍 Found target column: ${targetColumnKey} = "${newValue}"`);
                    break;
                }
            }
            
            if (targetColumnKey && newValue !== undefined) {
                const columnIndex = allColumns.findIndex(col => col.data === targetColumnKey);
                
                console.log(`🎯 Applying to row ${rowIndex}: column=${targetColumnKey}, columnIndex=${columnIndex}, newValue="${newValue}"`);
                console.log(`📊 Available columns:`, allColumns.map(col => col.data));
                
                if (rowIndex !== undefined && columnIndex !== -1) {
                    console.log(`📝 Calling setDataAtCell(${rowIndex}, ${columnIndex}, "${newValue}")`);
                    hot.setDataAtCell(rowIndex, columnIndex, newValue);
                    console.log('✅ setDataAtCell completed');
                } else {
                    console.error(`❌ Cannot update: rowIndex=${rowIndex}, columnIndex=${columnIndex}`);
                    console.error(`❌ Debug info: targetColumnKey="${targetColumnKey}", available columns:`, allColumns.map(col => col.data));
                }
            } else {
                console.error(`❌ No target column or value found in updatedRow:`, updatedRow);
            }
        });

        console.log(`🎉 Applied naming rule "${rule.name}" to ${updatedRows.length} rows`);
        
        // Clear selection after applying
        setSelectedRows([]);
    };
};

// Create selection handler for tables
export const createSelectionHandler = (tableRef, allColumns, setSelectedRows) => {
    return (selection) => {
        console.log('🔄 Generic handleSelectionChange called with selection:', selection);
        
        if (!tableRef.current?.hotInstance) {
            console.log('❌ No hotInstance available');
            return;
        }
        
        if (!selection || selection.length === 0) {
            console.log('❌ Empty selection received - clearing selectedRows');
            setTimeout(() => {
                console.log('⏰ Clearing selectedRows after delay');
                setSelectedRows([]);
            }, 2000); // 2 second delay
            return;
        }

        const hot = tableRef.current.hotInstance;
        const data = hot.getData();
        const selectedRowsData = [];

        // Convert selection ranges to actual row data
        selection.forEach(range => {
            const [startRow, startCol, endRow, endCol] = range;
            
            for (let row = startRow; row <= endRow; row++) {
                if (data[row] && !selectedRowsData.find(r => r._rowIndex === row)) {
                    const rowData = hot.getDataAtRow(row);
                    
                    console.log(`🎯 Selecting row ${row}, raw data:`, rowData);
                    
                    // Check if this row has any actual data
                    const hasValidData = rowData.some(value => 
                        value !== null && value !== undefined && value !== 'null' && value !== 'undefined' && value !== ''
                    );
                    
                    if (!hasValidData) {
                        console.log('⚠️ Skipping row with no valid data');
                        continue;
                    }
                    
                    const rowObject = {};
                    
                    // Map array data to column names using visible column mapping
                    // Since rowData comes from visible columns only, we need to map correctly
                    const columnHeaders = hot.getColHeader();
                    
                    rowData.forEach((value, visibleIndex) => {
                        const headerName = columnHeaders[visibleIndex];
                        // Find the column definition that matches this header
                        const columnDef = allColumns.find(col => col.title === headerName);
                        
                        if (columnDef) {
                            rowObject[columnDef.data] = value;
                            
                            // Debug column mapping for critical fields
                            if (['serial_number', 'model', 'name'].includes(columnDef.data)) {
                                console.log(`🔍 Column mapping: ${columnDef.data} (visible index ${visibleIndex}) = "${value}"`);
                            }
                        }
                    });
                    
                    rowObject._rowIndex = row;
                    selectedRowsData.push(rowObject);
                    console.log(`🎯 Final row object:`, rowObject);
                }
            }
        });

        if (selectedRowsData.length > 0) {
            console.log('✅ Setting selectedRows to:', selectedRowsData.length, 'rows');
            setSelectedRows(selectedRowsData);
        } else {
            console.log('⚠️ No valid rows selected - keeping current selection');
        }
    };
};