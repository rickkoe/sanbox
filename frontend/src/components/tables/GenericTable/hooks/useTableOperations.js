import axios from 'axios';
import * as XLSX from "xlsx";

export const useTableOperations = ({
  isDirty,
  setIsDirty,
  loading,
  setLoading,
  setSaveStatus,
  unsavedData,
  setUnsavedData,
  data,
  beforeSave,
  onSave,
  saveTransform,
  onBuildPayload,
  saveUrl,
  afterSave,
  navigationRedirectPath,
  fetchData,
  hasNonEmptyValues,
  deleteUrl,
  setShowDeleteModal,
  setRowsToDelete,
  ensureBlankRow,
  columns,
  colHeaders,
  getExportFilename
}) => {

  const handleSaveChanges = async () => {
    if (!isDirty) {
      setSaveStatus("No changes to save");
      return;
    }

    if (beforeSave && typeof beforeSave === 'function') {
      const validationResult = beforeSave(unsavedData);
      if (validationResult !== true) {
        setSaveStatus(validationResult);
        return;
      }
    }

    setLoading(true);
    setSaveStatus("Saving...");

    try {
      if (onSave && typeof onSave === 'function') {
        const result = await onSave(unsavedData);
        setSaveStatus(result.message);
        if (result.success) {
          await fetchData();
          if (afterSave && typeof afterSave === 'function') {
            afterSave();
          }
          handleSuccessfulSave();
        }
      } else {
        const transformedData = typeof saveTransform === 'function' ? saveTransform(unsavedData) : unsavedData;
        const payload = [];

        transformedData.forEach(row => {
          const isNew = row.id == null;
          const original = data.find(d => d.id === row.id);
          const isModified = original ? JSON.stringify(row) !== JSON.stringify(original) : false;

          if ((isNew && hasNonEmptyValues(row)) || (original && isModified)) {
            payload.push(onBuildPayload ? onBuildPayload(row) : row);
          }
        });

        if (payload.length === 0) {
          setSaveStatus("No changes to save");
          setLoading(false);
          return;
        }

        await Promise.all(payload.map(row => {
          if (row.id == null) {
            const postData = { ...row };
            delete postData.id;
            delete postData.saved;
            return axios.post(saveUrl.endsWith("/") ? saveUrl : `${saveUrl}/`, postData);
          } else {
            const putData = { ...row };
            delete putData.saved;
            return axios.put(`${saveUrl}${row.id}/`, putData);
          }
        }));

        setSaveStatus("Save successful!");
        await fetchData();
        if (afterSave && typeof afterSave === 'function') {
          afterSave();
        }
        handleSuccessfulSave();
      }
    } catch (error) {
      console.error("Save error:", error);
      setSaveStatus(`Save failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccessfulSave = () => {
    if (navigationRedirectPath) {
      setTimeout(() => {
        window.location.href = navigationRedirectPath;
      }, 1000);
    }
  };

  const handleDeleteRows = (selection, hotInstance) => {
    if (!selection || selection.length === 0) return;
    if (!hotInstance) return;
    
    const visualRows = [];
    selection.forEach(range => {
      for (let row = range.start.row; row <= range.end.row; row++) {
        visualRows.push(row);
      }
    });
    
    const physicalRows = visualRows
      .map(visualRow => hotInstance.toPhysicalRow(visualRow))
      .filter(physicalRow => physicalRow !== null && physicalRow < unsavedData.length)
      .filter((row, index, arr) => arr.indexOf(row) === index);
    
    if (physicalRows.length === 0) return;
    
    const sortedRows = [...physicalRows].sort((a, b) => b - a);
    const rowsWithId = [];
    const rowsWithoutId = [];
    
    sortedRows.forEach(rowIndex => {
      const rowData = unsavedData[rowIndex];
      if (rowData && rowData.id !== null && rowData.id !== undefined) {
        rowsWithId.push(rowIndex);
      } else {
        rowsWithoutId.push(rowIndex);
      }
    });
    
    if (rowsWithoutId.length > 0) {
      const updated = [...unsavedData];
      rowsWithoutId.forEach(rowIndex => {
        updated.splice(rowIndex, 1);
      });
      
      const dataWithBlankRow = ensureBlankRow(updated);
      setUnsavedData(dataWithBlankRow);
      // Don't mark as dirty when deleting unsaved rows - this is a clean operation
      
      if (rowsWithId.length === 0) {
        setSaveStatus("Rows deleted successfully!");
      }
    }
    
    if (rowsWithId.length > 0) {
      const rowsToDeleteData = rowsWithId.map(rowIndex => unsavedData[rowIndex]);
      setRowsToDelete(rowsToDeleteData);
      setShowDeleteModal(true);
    }
  };

  const handleExportCSV = () => {
    if (!unsavedData.length) return;

    const headers = colHeaders.join(",");
    const rows = unsavedData
      .filter(row => hasNonEmptyValues(row))
      .map(row => columns.map(col => {
        const val = row[col.data];
        if (typeof val === "string") return `"${val.replace(/"/g, '""')}"`;
        return val ?? "";
      }).join(","));

    const csvContent = [headers, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const filename = typeof getExportFilename === 'function'
      ? getExportFilename()
      : "table_export.csv";

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (!unsavedData.length) return;

    const filteredData = unsavedData.filter(row => hasNonEmptyValues(row));

    const exportData = filteredData.map(row =>
      columns.reduce((acc, col) => {
        const val = row[col.data];
        acc[col.data] = val ?? "";
        return acc;
      }, {})
    );

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");

    const filename = typeof getExportFilename === "function"
      ? getExportFilename().replace(/\.csv$/, ".xlsx")
      : "table_export.xlsx";

    XLSX.writeFile(workbook, filename);
  };

  return {
    handleSaveChanges,
    handleDeleteRows,
    handleExportCSV,
    handleExportExcel
  };
};