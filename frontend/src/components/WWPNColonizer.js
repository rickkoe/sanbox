import React, { useState, useRef, useEffect } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Form, Alert } from 'react-bootstrap';

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
    const clipboardData = event.clipboardData.getData('Text');
    const pastedRows = clipboardData.split(/\r?\n/).map(row => row.trim()).filter(row => row !== '');

    if (pastedRows.length > 0) {
      const validRows = pastedRows.filter(isValidWWPN);
      const invalidRows = pastedRows.filter(row => !isValidWWPN(row));
      
      if (invalidRows.length > 0) {
        setError("Some pasted WWPNs are invalid. Ensure they follow the correct format.");
        return;
      }
      
      setData((prevData) => {
        const nonEmptyRows = prevData.filter(row => row[0] && row[0].trim() !== '');
        return [...nonEmptyRows, ...validRows.map(row => [row]), ['']];
      });
    }
  };

  return (
    <div className="container mt-4" onPaste={handlePaste}>
      <Form>
        <Form.Check 
          type="switch" 
          id="format-toggle" 
          label={showWithColons ? "Colons" : "No Colons"} 
          checked={showWithColons} 
          onChange={() => setShowWithColons(!showWithColons)} 
          className="mb-3"
        />
      </Form>
      {error && <Alert variant="danger">{error}</Alert>}
      <HotTable
        ref={tableRef}
        data={data.map(row => row.length > 0 ? [showWithColons ? addColons(row[0]) : removeColons(row[0])] : [''])}
        colHeaders={["WWPN"]}
        columns={[{ data: 0, type: "text" }]}
        afterChange={handleTableChange}
        licenseKey="non-commercial-and-evaluation"
        className="handsontable htMaterial"
        rowHeaders={true}
        width="100%"
        stretchH="all"
      />
    </div>
  );
};

export default WWPNFormatterTable;