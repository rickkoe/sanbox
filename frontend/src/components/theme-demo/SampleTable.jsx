import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from 'lucide-react';
import './SampleTable.css';

const SampleTable = () => {
  const [sortColumn, setSortColumn] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Sample data
  const data = [
    { id: 1, name: 'SAN_ZONE_001', type: 'Zone', status: 'Active', customer: 'Acme Corp', created: '2024-01-15', size: '2.5 TB' },
    { id: 2, name: 'SAN_ZONE_002', type: 'Zone', status: 'Active', customer: 'TechStart Inc', created: '2024-01-18', size: '1.8 TB' },
    { id: 3, name: 'ALIAS_HOST_01', type: 'Alias', status: 'Active', customer: 'Global Systems', created: '2024-01-20', size: '512 GB' },
    { id: 4, name: 'SAN_ZONE_003', type: 'Zone', status: 'Inactive', customer: 'DataCorp', created: '2024-01-22', size: '3.2 TB' },
    { id: 5, name: 'FABRIC_A_ZONE_1', type: 'Zone', status: 'Active', customer: 'Enterprise Co', created: '2024-01-25', size: '4.1 TB' },
    { id: 6, name: 'ALIAS_STORAGE_01', type: 'Alias', status: 'Active', customer: 'Cloud Services', created: '2024-01-28', size: '256 GB' },
    { id: 7, name: 'SAN_ZONE_004', type: 'Zone', status: 'Warning', customer: 'MetroBank', created: '2024-02-01', size: '1.2 TB' },
    { id: 8, name: 'FABRIC_B_ZONE_1', type: 'Zone', status: 'Active', customer: 'Healthcare Plus', created: '2024-02-05', size: '5.8 TB' },
    { id: 9, name: 'ALIAS_HOST_02', type: 'Alias', status: 'Active', customer: 'RetailMax', created: '2024-02-08', size: '128 GB' },
    { id: 10, name: 'SAN_ZONE_005', type: 'Zone', status: 'Active', customer: 'Manufacturing Ltd', created: '2024-02-10', size: '2.9 TB' },
    { id: 11, name: 'FABRIC_A_ZONE_2', type: 'Zone', status: 'Active', customer: 'Finance Group', created: '2024-02-12', size: '3.7 TB' },
    { id: 12, name: 'ALIAS_STORAGE_02', type: 'Alias', status: 'Inactive', customer: 'Education Board', created: '2024-02-15', size: '64 GB' },
  ];

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />;
  };

  const getStatusClass = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'status-active';
      case 'inactive':
        return 'status-inactive';
      case 'warning':
        return 'status-warning';
      default:
        return '';
    }
  };

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = data.slice(startIndex, endIndex);

  return (
    <div className="sample-table-container">
      {/* Table Toolbar */}
      <div className="sample-table-toolbar">
        <div className="sample-table-toolbar-left">
          <h3 className="sample-table-title">SAN Zones & Aliases</h3>
          <span className="sample-table-count">{data.length} items</span>
        </div>
        <div className="sample-table-toolbar-right">
          <button className="sample-table-button">Export</button>
          <button className="sample-table-button sample-table-button-primary">Add New</button>
        </div>
      </div>

      {/* Table */}
      <div className="sample-table-wrapper">
        <table className="sample-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('name')} className="sample-table-sortable">
                <div className="sample-table-th-content">
                  Name
                  <SortIcon column="name" />
                </div>
              </th>
              <th onClick={() => handleSort('type')} className="sample-table-sortable">
                <div className="sample-table-th-content">
                  Type
                  <SortIcon column="type" />
                </div>
              </th>
              <th onClick={() => handleSort('status')} className="sample-table-sortable">
                <div className="sample-table-th-content">
                  Status
                  <SortIcon column="status" />
                </div>
              </th>
              <th onClick={() => handleSort('customer')} className="sample-table-sortable">
                <div className="sample-table-th-content">
                  Customer
                  <SortIcon column="customer" />
                </div>
              </th>
              <th onClick={() => handleSort('created')} className="sample-table-sortable">
                <div className="sample-table-th-content">
                  Created
                  <SortIcon column="created" />
                </div>
              </th>
              <th onClick={() => handleSort('size')} className="sample-table-sortable">
                <div className="sample-table-th-content">
                  Size
                  <SortIcon column="size" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {currentData.map((row) => (
              <tr key={row.id}>
                <td className="sample-table-cell-primary">{row.name}</td>
                <td>{row.type}</td>
                <td>
                  <span className={`sample-table-status ${getStatusClass(row.status)}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.customer}</td>
                <td className="sample-table-cell-muted">{row.created}</td>
                <td className="sample-table-cell-muted">{row.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="sample-table-pagination">
        <div className="sample-table-pagination-info">
          Showing {startIndex + 1}-{Math.min(endIndex, data.length)} of {data.length}
        </div>
        <div className="sample-table-pagination-controls">
          <button
            className="sample-table-pagination-button"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="sample-table-pagination-page">
            Page {currentPage} of {totalPages}
          </span>
          <button
            className="sample-table-pagination-button"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SampleTable;
