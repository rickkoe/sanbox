// Main export file for GenericTable
export { default } from './GenericTable';

// Optional: Export sub-components if you want to use them elsewhere
export { default as TableHeader } from './components/TableHeader';
export { default as ExportDropdown } from './components/ExportDropdown';
export { default as ColumnsDropdown } from './components/ColumnsDropdown';
export { default as QuickSearch } from './components/QuickSearch';
export { default as StatsContainer } from './components/StatsContainer';
export { default as StatusMessage } from './components/StatusMessage';
export { default as DeleteModal } from './components/DeleteModal';
export { default as NavigationModal } from './components/NavigationModal';
export { default as ScrollButtons } from './components/ScrollButtons';

// Export hooks for potential reuse
export { useTableData } from './hooks/useTableData';
export { useTableColumns } from './hooks/useTableColumns';
export { useTableOperations } from './hooks/useTableOperations';