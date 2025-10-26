import React, { useEffect, useState, useRef } from "react";
import { Form, Alert, Button } from "react-bootstrap";
import { HotTable } from '@handsontable/react';
import Handsontable from 'handsontable';
import { registerAllModules } from 'handsontable/registry';
import { useTheme } from '../../context/ThemeContext';
import 'handsontable/dist/handsontable.full.css';
import '../../styles/tanstacktable.css';


registerAllModules();

const removeColons = (value) => {
  if (!value) return '';
  return value.replace(/:/g, '').trim();
};

const addColons = (wwpn) => {
  if (!wwpn) return '';
  const cleaned = removeColons(wwpn);
  return cleaned.length === 16 ? cleaned.match(/.{1,2}/g).join(':').toLowerCase() : cleaned;
};

const isValidWWPN = (wwpn) => {
  if (!wwpn) return false;
  const cleaned = removeColons(wwpn);
  return /^[a-fA-F0-9]{16}$/.test(cleaned);
};

const WWPNFormatterTable = () => {
  const { theme } = useTheme();
  const [data, setData] = useState(() => Array(500).fill().map(() => ['']));
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
        const updatedData = [...prevData];
        
        changes.forEach(([row, col, oldValue, newValue]) => {
          if (newValue && newValue.trim()) {
            if (isValidWWPN(newValue)) {
              updatedData[row][col] = newValue.trim();
              setError(null);
            } else {
              setError("Invalid WWPN format detected. Please ensure all WWPNs are 16 hex characters.");
            }
          } else {
            updatedData[row][col] = '';
          }
        });
        
        return updatedData;
      });
    }
  };

  const handlePaste = (event) => {
    let clipboardData = event.clipboardData || window.clipboardData;
    
    if (!clipboardData) {
      console.error("Clipboard data not available");
      return;
    }

    let pastedText = clipboardData.getData("text/plain");
    
    if (!pastedText) return;

    // Normalize line breaks and split into rows
    pastedText = pastedText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const pastedRows = pastedText
      .split(/\n/)
      .map(row => row.replace(/\s/g, '').trim())
      .filter(row => row.length > 0);

    if (pastedRows.length > 0) {
      const validRows = pastedRows.filter(isValidWWPN);
      const invalidRows = pastedRows.filter(row => !isValidWWPN(row));

      if (invalidRows.length > 0) {
        setError(`${invalidRows.length} invalid WWPN(s) detected and skipped.`);
      } else {
        setError(null);
      }

      setData((prevData) => {
        const newData = [...prevData];
        let currentRow = 0;
        
        // Find first empty row or start from beginning
        while (currentRow < newData.length && newData[currentRow][0] && newData[currentRow][0].trim()) {
          currentRow++;
        }
        
        // Add valid WWPNs starting from current row
        validRows.forEach((wwpn, index) => {
          const targetRow = currentRow + index;
          if (targetRow < newData.length) {
            newData[targetRow][0] = wwpn;
          }
        });
        
        return newData;
      });
    }

    event.preventDefault();
  };

  const clearTable = () => {
    setData(Array(500).fill().map(() => ['']));
    setError(null);
  };

  const copyAllWWPNs = () => {
    const validWWPNs = data
      .map(row => row[0])
      .filter(value => value && value.trim() && isValidWWPN(value))
      .map(value => showWithColons ? addColons(value) : removeColons(value))
      .join('\n');
    
    if (validWWPNs) {
      navigator.clipboard.writeText(validWWPNs).then(() => {
        // Could add a toast notification here if desired
      }).catch(err => {
        console.error('Failed to copy to clipboard:', err);
      });
    }
  };

  const getDisplayData = () => {
    return data.map(row => {
      const value = row[0];
      if (!value || !value.trim()) return [''];
      
      if (isValidWWPN(value)) {
        return [showWithColons ? addColons(value) : removeColons(value)];
      }
      return [value];
    });
  };


  return (
    <div className={`modern-table-container theme-${theme}`}>
      <div className="modern-table-header">
        <div className="header-left">
          <h2 className="table-title" style={{
            background: 'transparent',
            color: 'inherit',
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: '600'
          }}>WWPN Colonizer</h2>
        </div>
        <div className="header-right" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Button 
            size="sm" 
            onClick={copyAllWWPNs}
            style={{
              backgroundColor: 'transparent',
              borderColor: theme === 'dark' ? 'var(--button-border)' : 'var(--table-border)',
              color: theme === 'dark' ? 'var(--primary-text)' : 'var(--primary-text)',
              border: '1px solid',
              borderRadius: '4px',
              fontWeight: '500',
              transition: 'all 0.15s ease'
            }}
            onMouseDown={(e) => {
              e.target.style.backgroundColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
              e.target.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.transform = 'scale(1)';
            }}
          >
            Copy All
          </Button>
          <Button 
            size="sm" 
            onClick={clearTable}
            style={{
              backgroundColor: 'transparent',
              borderColor: theme === 'dark' ? 'var(--button-border)' : 'var(--table-border)',
              color: theme === 'dark' ? 'var(--primary-text)' : 'var(--primary-text)',
              border: '1px solid',
              borderRadius: '4px',
              fontWeight: '500',
              transition: 'all 0.15s ease'
            }}
            onMouseDown={(e) => {
              e.target.style.backgroundColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
              e.target.style.transform = 'scale(0.98)';
            }}
            onMouseUp={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.transform = 'scale(1)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
              e.target.style.transform = 'scale(1)';
            }}
          >
            Clear All
          </Button>
          <Form.Check 
            type="switch" 
            id="format-toggle" 
            label="With Colons" 
            checked={showWithColons} 
            onChange={() => setShowWithColons(!showWithColons)} 
            className="table-toggle-switch"
          />
        </div>
      </div>
      
      <div className="table-info-banner modern-table-header" style={{
        borderTop: 'none',
        borderRadius: '0'
      }}>
        <div className="header-left">
          <p style={{ 
            margin: 0, 
            color: 'inherit', 
            fontSize: '0.875rem' 
          }}>
            <strong>Instructions:</strong> Paste one or more valid WWPNs (16 hex characters), and they will be automatically formatted. 
            Use the toggle to switch between colon-separated and plain formats.
          </p>
        </div>
      </div>
      
      {error && (
        <div className="table-alert-container">
          <Alert variant="warning" className="table-alert">
            {error}
          </Alert>
        </div>
      )}
      
      <div className="table-scroll-container">
        <HotTable
          ref={tableRef}
          data={getDisplayData()}
          colHeaders={["WWPN"]}
          contextMenu={['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo']}
          columns={[{ 
            data: 0, 
            type: "text", 
            width: 400,
            placeholder: "Enter or paste WWPN..." 
          }]}
          afterChange={handleTableChange}
          beforePaste={handlePaste}
          columnSorting={true}
          licenseKey="non-commercial-and-evaluation"
          dropdownMenu={false}
          filters={false}
          rowHeaders={false}
          dragToScroll={true}
          width="100%"
          height="calc(100vh - 235px)"
          stretchH="all"
          startRows={500}
          minRows={500}
          rowHeights={32}
          cells={(row, col) => {
            const cellProperties = {};
            const value = data[row] && data[row][col];
            
            if (value && value.trim() && !isValidWWPN(value)) {
              cellProperties.className = 'invalid-cell';
            }
            
            return cellProperties;
          }}
        />
      </div>
    </div>
  );
};

export default WWPNFormatterTable;