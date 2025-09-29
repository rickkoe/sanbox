/**
 * TanStackTable - High-performance table component
 *
 * A complete replacement for GenericTable using TanStack Table v8
 * with enhanced performance, Excel-like features, and modern architecture.
 */

// Main component
export { default as TanStackTable } from './TanStackTable';

// Core hooks
export { useTableInstance } from './core/hooks/useTableInstance';
export { useVirtualization, useRowVirtualization } from './core/hooks/useVirtualization';
export { useServerPagination, useClientPagination } from './core/hooks/useServerPagination';

// Feature hooks
export { useRowSelection } from './features/selection/useRowSelection';
export { useExcelFeatures } from './features/excel-features/useExcelFeatures';
export { useCopyPaste } from './features/excel-features/useCopyPaste';
export { useFillOperations } from './features/excel-features/useFillOperations';
export { useKeyboardNavigation } from './features/excel-features/useKeyboardNavigation';
export { useSelection } from './features/excel-features/useSelection';
export { useAdvancedFiltering } from './features/filtering/useAdvancedFiltering';
export { useExport } from './features/export/useExport';

// UI Components
export { LoadingOverlay, InlineSpinner, TableRowSkeleton, TableSkeleton } from './components/ui/LoadingOverlay';
export { Pagination } from './components/ui/Pagination';
export { TableHeader } from './components/TableHeader';

// Utilities
export { createColumnDefinitions } from './utils/columnDefinitions';
export { generateServerFilters, createColumnMetadata, applyAllFilters } from './utils/serverFilterUtils';
export {
  migrateGenericTableProps,
  migrateColumns,
  migrateCustomRenderers,
  GenericTableMigrationWrapper,
  validateMigration,
  generateMigrationReport,
  MIGRATION_GUIDE,
} from './utils/migration';

// Re-export TanStack Table utilities for convenience
export { flexRender } from '@tanstack/react-table';

// Default export
export { default } from './TanStackTable';