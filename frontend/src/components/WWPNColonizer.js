import React, { useState, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Form } from 'react-bootstrap';

registerAllModules();

const removeColons = (value) => value.replace(/:/g, '').trim();

const addColons = (wwpn) => {
  const cleaned = removeColons(wwpn);
  return cleaned.length === 16 ? cleaned.match(/.{1,2}/g).join(':').toLowerCase() : cleaned;
};

const WWPNFormatterTable = () => {
  const [data, setData] = useState([['']]);
  const [showWithColons, setShowWithColons] = useState(true);
  const tableRef = useRef(null);

  const handleTableChange = (changes, source) => {
    if (source === 'edit' || source === 'CopyPaste.paste') {
      setData((prevData) => {
        const updatedData = prevData.map(row => [...row]);
        
        changes.forEach(([row, , , newValue]) => {
          if (updatedData[row]) {
            updatedData[row][0] = newValue;
          }
        });
        
        if (updatedData[updatedData.length - 1][0].trim() !== '') {
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
      setData((prevData) => {
        const updatedData = [...prevData.filter(row => row[0].trim() !== ''), ...pastedRows.map(row => [row]), ['']];
        return updatedData;
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
      <HotTable
        ref={tableRef}
        data={data.map(row => [showWithColons ? addColons(row[0]) : removeColons(row[0])])}
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
