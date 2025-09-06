import React from 'react';
import AdvancedFilter from './AdvancedFilter';
import StatsContainer from './StatsContainer';

const TableControls = ({
  columns,
  colHeaders,
  visibleColumns,
  quickSearch,
  setQuickSearch,
  unsavedData,
  hasNonEmptyValues,
  selectedCount,
  pagination = null,
  data = [],
  onFilterChange,
  columnFilters = {},
  apiUrl = null,
  serverPagination = false,
  dropdownSources = {},
  isDirty
}) => {
  return (
    <div className="table-controls">
      <AdvancedFilter
        columns={columns}
        colHeaders={colHeaders}
        visibleColumns={visibleColumns}
        quickSearch={quickSearch}
        setQuickSearch={setQuickSearch}
        onFilterChange={onFilterChange}
        data={data}
        initialFilters={columnFilters}
        apiUrl={apiUrl}
        serverPagination={serverPagination}
        dropdownSources={dropdownSources}
      />
      
      <StatsContainer
        unsavedData={unsavedData}
        hasNonEmptyValues={hasNonEmptyValues}
        selectedCount={selectedCount}
        quickSearch={quickSearch}
        isDirty={isDirty}
        pagination={pagination}
      />
    </div>
  );
};

export default TableControls;