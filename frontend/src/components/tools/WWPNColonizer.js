import React, { useEffect, useState, useRef } from "react";
import { Form, Alert } from "react-bootstrap";
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';

console.log("Handsontable version:", Handsontable.version);
registerAllModules();

const removeColons = (value) => value.replace(/:/g, '').trim();

const addColons = (wwpn) => {
  const cleaned = removeColons(wwpn);
  return cleaned.length === 16 ? cleaned.match(/.{1,2}/g).join(':').toLowerCase() : cleaned;
};

const isValidWWPN = (wwpn) => {
  const cleaned = removeColons(wwpn);
  return /^[a-fA-F0-9]{16}$/.test(cleaned);
};

const WWPNFormatterTable = () => {
  const [data, setData] = useState([['']]);
  const [showWithColons, setShowWithColons] = useState(true);
  const [error, setError] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    const handleWindowPaste = (event) => {
        handlePaste(event);
    };

    window.addEventListener("paste", handleWindowPaste);

    return () => {
        window.removeEventListener("paste", handleWindowPaste);
    };
  }, []);

  const handleTableChange = (changes, source) => {
    if (source === 'edit' || source === 'CopyPaste.paste') {
      setData((prevData) => {
        const updatedData = prevData.map(row => row.length > 0 ? [...row] : ['']);
       
        changes.forEach(([row, , , newValue]) => {
          if (updatedData[row] && newValue && isValidWWPN(newValue)) {
            updatedData[row][0] = newValue;
            setError(null); // ✅ Clear error if valid
          } else if (newValue) {
            setError("Invalid WWPN format detected. Ensure all WWPNs follow the correct format.");
          }
        });
       
        if (updatedData.length === 0 || updatedData[updatedData.length - 1][0].trim() !== '') {
          updatedData.push(['']);
        }
       
        return updatedData;
      });
    }
  };

  const handlePaste = (event) => {
    let clipboardData = event.clipboardData || window.clipboardData;

    if (!clipboardData) {
        console.error("❌ Clipboard data not available in Safari.");
        return;
    }

    let pastedText = clipboardData.getData("text/plain");

    // ✅ Normalize line breaks and remove spaces
    pastedText = pastedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const pastedRows = pastedText
        .split(/\n/)
        .map(row => row.replace(/\s/g, '').trim()) // Remove spaces
        .filter(row => row.length > 0); // Remove empty rows


    if (pastedRows.length > 0) {
        const validRows = pastedRows.filter(isValidWWPN);
        const invalidRows = pastedRows.filter(row => !isValidWWPN(row));

        if (invalidRows.length > 0) {
            setError(`Some pasted WWPNs are invalid (${invalidRows.length} entries).`);
        }

        setData((prevData) => {
            // ✅ Remove existing empty row before appending new data
            const nonEmptyRows = prevData.filter(row => row[0] && row[0].trim() !== '');

            // ✅ Prevent duplicates by checking if WWPN already exists
            const uniqueValidRows = validRows.filter(wwpn => 
                !nonEmptyRows.some(existingRow => existingRow[0] === wwpn)
            );

            // ✅ Combine existing data with unique new WWPNs
            const newData = [...nonEmptyRows, ...uniqueValidRows.map(row => [row]), ['']];

            return newData;
        });

        setError(null); // ✅ Clear error after successful paste
    }

    // ✅ Prevent default behavior to avoid double triggering
    event.preventDefault();
  };

  return (
    <div className="modern-table-container">
      <div className="modern-table-header">
        <div className="header-left">
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
            WWPN Formatter
          </h2>
        </div>
        <div className="header-right">
          <Form>
            <Form.Check 
              type="switch" 
              id="format-toggle" 
              label={showWithColons ? "Show Colons" : "Hide Colons"} 
              checked={showWithColons} 
              onChange={() => setShowWithColons(!showWithColons)} 
              className="format-toggle"
            />
          </Form>
        </div>
      </div>
      
      <div style={{ padding: '1rem 1.5rem', backgroundColor: '#eff6ff', borderLeft: '4px solid #3b82f6', margin: '0 1.5rem' }}>
        <p style={{ margin: 0, color: '#1e40af', fontSize: '0.875rem' }}>
          <strong>Instructions:</strong> Paste one or more valid WWPNs, and they will be automatically formatted. 
          Use the toggle above to switch between colon-separated and plain formats.
        </p>
      </div>
      
      {error && (
        <div style={{ margin: '1rem 1.5rem' }}>
          <Alert variant="danger">{error}</Alert>
        </div>
      )}
      
      <div style={{ padding: '1.5rem', flex: 1 }}>
        <HotTable
          ref={tableRef}
          data={data.map(row => row.length > 0 ? [showWithColons ? addColons(row[0]) : removeColons(row[0])] : [''])}
          colHeaders={["WWPN"]}
          contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo']}
          columns={[{ data: 0, type: "text", width: 300 }]}
          afterChange={handleTableChange}
          columnSorting={true}
          licenseKey="non-commercial-and-evaluation"
          className="htMaterial"
          dropdownMenu={false}
          filters={false}
          rowHeaders={true}
          dragToScroll={true}
          width="100%"
          height="calc(100vh - 400px)"
          stretchH="all"
        />
      </div>
    </div>
  );
};

export default WWPNFormatterTable;