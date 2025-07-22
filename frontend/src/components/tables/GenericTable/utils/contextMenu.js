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
      "select_all": {
        name: "Select all",
        callback: () => {
          const hot = tableRef.current?.hotInstance;
          if (hot) {
            hot.selectAll();
          }
        }
      },
      "hsep4": "---------",
      "remove_row": {
        name: "Delete selected rows",
        callback: (key, selection, clickEvent) => {
          handleAfterContextMenu(key, selection);
        }
      }
    }
  };
};