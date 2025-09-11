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

// Create a naming handler for tables
export const createNamingHandler = (tableRef, allColumns, setSelectedRows) => {
    return (updatedRows, rule) => {
        console.log('🚀 Generic handleApplyNaming called with:', updatedRows, rule);
        
        if (!tableRef.current?.hotInstance) {
            console.error('❌ No hotInstance available');
            return;
        }

        const hot = tableRef.current.hotInstance;
        console.log('✅ Hot instance found:', hot);
        
        // Apply the updated values to the table
        updatedRows.forEach(updatedRow => {
            const rowIndex = updatedRow._rowIndex;
            
            // Find which column was updated
            let targetColumnKey = null;
            let newValue = null;
            
            for (const key in updatedRow) {
                if (key !== '_rowIndex' && updatedRow[key]) {
                    // Check if this is a newly generated value
                    const originalValue = updatedRow[key];
                    if (originalValue && typeof originalValue === 'string') {
                        targetColumnKey = key;
                        newValue = originalValue;
                        break;
                    }
                }
            }
            
            if (targetColumnKey && newValue !== undefined) {
                const columnIndex = allColumns.findIndex(col => col.data === targetColumnKey);
                
                console.log(`🎯 Applying to row ${rowIndex}: column=${targetColumnKey}, columnIndex=${columnIndex}, newValue="${newValue}"`);
                
                if (rowIndex !== undefined && columnIndex !== -1) {
                    console.log(`📝 Calling setDataAtCell(${rowIndex}, ${columnIndex}, "${newValue}")`);
                    hot.setDataAtCell(rowIndex, columnIndex, newValue);
                    console.log('✅ setDataAtCell completed');
                } else {
                    console.error(`❌ Cannot update: rowIndex=${rowIndex}, columnIndex=${columnIndex}`);
                }
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
                    
                    // Map array data to column names
                    allColumns.forEach((col, index) => {
                        const value = rowData[index];
                        rowObject[col.data] = value;
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