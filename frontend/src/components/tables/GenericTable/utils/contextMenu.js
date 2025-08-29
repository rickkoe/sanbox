export const createContextMenu = (tableRef, setIsDirty, handleAfterContextMenu) => {
  return {
    items: {
      "add_row_above": {
        name: "Insert row above",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot && selection && selection.length > 0) {
            let totalSelectedRows = 0;
            selection.forEach(range => {
              const rowCount = Math.abs(range.end.row - range.start.row) + 1;
              totalSelectedRows += rowCount;
            });
            
            const insertAtRow = Math.min(selection[0].start.row, selection[0].end.row);
            hot.alter('insert_row_above', insertAtRow, totalSelectedRows);
            setIsDirty(true);
          }
        }
      },
      "add_row_below": {
        name: "Insert row below", 
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot && selection && selection.length > 0) {
            let totalSelectedRows = 0;
            selection.forEach(range => {
              const rowCount = Math.abs(range.end.row - range.start.row) + 1;
              totalSelectedRows += rowCount;
            });
            
            const insertAtRow = Math.max(selection[selection.length - 1].start.row, selection[selection.length - 1].end.row);
            hot.alter('insert_row_below', insertAtRow, totalSelectedRows);
            setIsDirty(true);
          }
        }
      },
      "hsep1": { name: "---------" },
      "copy": {
        name: "Copy",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            hot.getPlugin('copyPaste').copy();
          }
        }
      },
      "cut": {
        name: "Cut",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            hot.getPlugin('copyPaste').cut();
          }
        }
      },
      "paste": {
        name: "Paste",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            hot.getPlugin('copyPaste').paste();
          }
        }
      },
      "hsep2": "---------",
      "clear_cell": {
        name: "Clear content",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot && selection && selection.length > 0) {
            selection.forEach(range => {
              for (let row = range.start.row; row <= range.end.row; row++) {
                for (let col = range.start.col; col <= range.end.col; col++) {
                  hot.setDataAtCell(row, col, '');
                }
              }
            });
            setIsDirty(true);
          }
        }
      },
      "hsep3": "---------",
      "select_column": {
        name: "Select column",
        callback: (key, selection, clickEvent) => {
          const hot = tableRef.current?.hotInstance;
          if (hot && selection && selection.length > 0) {
            // Get the column from the first selection
            const targetCol = selection[0].start.col;
            const totalRows = hot.countRows();
            const totalCols = hot.countCols();
            
            // Validate column index
            if (targetCol < 0 || targetCol >= totalCols || totalRows === 0) {
              return;
            }
            
            // Get visible rows by checking the filters plugin
            const filters = hot.getPlugin('filters');
            let visibleRows = [];
            
            if (filters && filters.isEnabled()) {
              // Get the filtered data indices
              const filteredData = hot.getData();
              const sourceData = hot.getSourceData();
              
              // Find which rows are visible by comparing filtered data with source data
              for (let visualRow = 0; visualRow < filteredData.length; visualRow++) {
                // Each visual row corresponds to a data row that passed the filter
                visibleRows.push(visualRow);
              }
            } else {
              // No filtering active, all rows are visible
              for (let row = 0; row < totalRows; row++) {
                visibleRows.push(row);
              }
            }
            
            // If we have visible rows, select the entire column for those rows
            if (visibleRows.length > 0) {
              const startRow = visibleRows[0];
              const endRow = visibleRows[visibleRows.length - 1];
              
              // Select the entire column for visible rows
              hot.selectCell(startRow, targetCol, endRow, targetCol);
            }
          }
        }
      },
      "hsep4": "---------",
      "autosize_columns": {
        name: "Auto-size all columns",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            console.log('📏 Auto-sizing ALL columns via context menu...');
            
            // Trigger the enhanced autosizing with force flag
            const event = new CustomEvent('autosize-columns', {
              detail: { 
                hotInstance: hot,
                options: { force: true, showLoading: true }
              }
            });
            window.dispatchEvent(event);
          }
        }
      },
      "autosize_columns_smart": {
        name: "Smart auto-size (respect saved widths)",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            console.log('🧠 Smart auto-sizing columns via context menu...');
            
            const event = new CustomEvent('autosize-columns', {
              detail: { 
                hotInstance: hot,
                options: { force: false, showLoading: true }
              }
            });
            window.dispatchEvent(event);
          }
        }
      },
      "reset_column_widths": {
        name: "Reset column widths",
        callback: (key, selection) => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            console.log('🔄 Resetting column widths via context menu...');
            
            const event = new CustomEvent('reset-column-widths', {
              detail: { hotInstance: hot }
            });
            window.dispatchEvent(event);
          }
        }
      },
      "hsep5": "---------",
      "remove_row": {
        name: "Delete selected rows",
        callback: (key, selection, clickEvent) => {
          handleAfterContextMenu(key, selection);
        }
      }
    }
  };
};