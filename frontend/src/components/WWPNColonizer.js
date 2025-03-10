import React, { useState, useRef } from 'react';
import { HotTable } from '@handsontable/react';
import { registerAllModules } from 'handsontable/registry';
import 'handsontable/dist/handsontable.full.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { Button } from 'react-bootstrap';

registerAllModules();

const removeColons = (value) => value.replace(/:/g, '').trim();

const addColons = (wwpn) => {
  const cleaned = wwpn.replace(/[^a-fA-F0-9]/g, '');
  return cleaned.length === 16 ? cleaned.match(/.{1,2}/g).join(':').toLowerCase() : cleaned;
};

const WWPNFormatterTable = () => {
  const [data, setData] = useState([['']]);
  const [showWithColons, setShowWithColons] = useState(true);
  const tableRef = useRef(null);

  const handleTableChange = (changes, source) => {
    if (source === 'edit' || source === 'CopyPaste.paste') {
      setData((prevData) => {
        const updatedData = [...prevData];

        changes.forEach(([row, , , newValue]) => {
          if (newValue) {
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

  return (
    <div className="container mt-4">
      <h3>WWPN Formatter</h3>
      <Button 
        variant="primary" 
        className="mb-3" 
        onClick={() => setShowWithColons(!showWithColons)}
      >
        Toggle Format ({showWithColons ? 'With Colons' : 'Without Colons'})
      </Button>
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