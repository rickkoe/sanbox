/**
 * Table Column Configuration Loader
 *
 * Centralized utility for loading and processing table column configurations
 * from the JSON configuration file.
 *
 * Usage:
 *   import { getTableColumns, getDefaultSort } from '../../utils/tableConfigLoader';
 *
 *   const columns = getTableColumns('alias', projectFilter === 'current');
 *   const defaultSort = getDefaultSort('alias');
 */

import tableColumnConfig from '../config/tableColumnConfig.json';
import { projectStatusColumn } from './projectStatusRenderer';

/**
 * Get the full configuration for a table
 * @param {string} tableName - Name of the table (alias, fabric, zone, etc.)
 * @returns {object|null} Table configuration object or null if not found
 */
export function getTableConfig(tableName) {
    if (!tableName || typeof tableName !== 'string') {
        console.error(`Invalid table name: ${tableName}`);
        return null;
    }

    const config = tableColumnConfig[tableName.toLowerCase()];
    if (!config) {
        console.error(`No configuration found for table: ${tableName}`);
        return null;
    }

    return config;
}

/**
 * Get columns for a table with optional Project View columns
 * @param {string} tableName - Name of the table
 * @param {boolean} includeProjectColumns - Whether to include _selected and project_action columns
 * @returns {array} Array of column definitions
 *
 * CONFIGURATION:
 * - To change _selected position: Change where it's added below (currently first)
 * - To change project_action position: Modify insertIndex calculation (currently after name)
 */
export function getTableColumns(tableName, includeProjectColumns = false) {
    const config = getTableConfig(tableName);
    if (!config || !config.columns) {
        return [];
    }

    const columns = [];

    // ============================================================
    // POSITION 1: _selected checkbox column (Project View only)
    // To move this column, cut this block and paste it elsewhere
    // ============================================================
    if (includeProjectColumns) {
        columns.push({
            data: "_selected",
            accessorKey: "_selected",
            title: "Select",
            type: "checkbox",
            readOnly: false,
            width: 60,
            defaultVisible: true,
            required: true  // Always visible, can't be hidden
        });
    }

    // Add all configured columns from JSON
    config.columns.forEach(col => {
        columns.push({
            data: col.id,
            accessorKey: col.id,
            title: col.title,
            type: col.type || "text",
            required: col.required || false,
            defaultVisible: col.defaultVisible !== undefined ? col.defaultVisible : true,
            width: col.width,
            readOnly: col.readOnly || false,
            dropdownSource: col.dropdownSource,
            allowMultiple: col.allowMultiple || false
        });
    });

    // ============================================================
    // POSITION 2: project_action status column (Project View only)
    // Currently inserted after "name" column
    // To change position, modify the insertIndex calculation below:
    // - After a different column: change "name" to another column id
    // - At the end: set insertIndex = columns.length
    // - At a specific position: set insertIndex = <number>
    // ============================================================
    if (includeProjectColumns) {
        // Find the index of the name column (usually index 1, after _selected)
        const selectedIndex = columns.findIndex(col => col.data === "project_memberships");
        const insertIndex = selectedIndex >= 0 ? selectedIndex + 1 : 1;

        columns.splice(insertIndex, 0, {
            ...projectStatusColumn,
            defaultVisible: true,
            required: true  // Always visible, can't be hidden
        });
    }

    return columns;
}

/**
 * Get the default sort configuration for a table
 * @param {string} tableName - Name of the table
 * @returns {object|null} Object with { column, direction } or null
 */
export function getDefaultSort(tableName) {
    const config = getTableConfig(tableName);
    if (!config || !config.defaultSort) {
        // Default fallback if not configured
        return { column: "name", direction: "asc" };
    }

    return {
        column: config.defaultSort.column,
        direction: config.defaultSort.direction || "asc"
    };
}

/**
 * Get column headers (titles) for a table
 * @param {string} tableName - Name of the table
 * @param {boolean} includeProjectColumns - Whether to include Project View columns
 * @returns {array} Array of column header strings
 */
export function getColumnHeaders(tableName, includeProjectColumns = false) {
    const columns = getTableColumns(tableName, includeProjectColumns);
    return columns.map(col => col.title);
}

/**
 * Get required column IDs for a table
 * @param {string} tableName - Name of the table
 * @returns {array} Array of required column IDs
 */
export function getRequiredColumns(tableName) {
    const columns = getTableColumns(tableName, false);
    return columns.filter(col => col.required).map(col => col.data);
}

/**
 * Get default visible column IDs for a table
 * @param {string} tableName - Name of the table
 * @param {boolean} includeProjectColumns - Whether to include Project View columns
 * @returns {array} Array of default visible column IDs
 */
export function getDefaultVisibleColumns(tableName, includeProjectColumns = false) {
    const columns = getTableColumns(tableName, includeProjectColumns);
    return columns
        .filter(col => col.defaultVisible)
        .map(col => col.data);
}

/**
 * Validate the configuration structure (useful for development)
 * @returns {object} Object with { valid: boolean, errors: array }
 */
export function validateConfig() {
    const errors = [];
    const tableNames = Object.keys(tableColumnConfig);

    tableNames.forEach(tableName => {
        const config = tableColumnConfig[tableName];

        // Check for required properties
        if (!config.columns || !Array.isArray(config.columns)) {
            errors.push(`Table '${tableName}': Missing or invalid 'columns' array`);
            return;
        }

        if (!config.defaultSort) {
            errors.push(`Table '${tableName}': Missing 'defaultSort' configuration`);
        } else {
            if (!config.defaultSort.column) {
                errors.push(`Table '${tableName}': Missing 'defaultSort.column'`);
            }
        }

        // Validate each column
        config.columns.forEach((col, index) => {
            if (!col.id) {
                errors.push(`Table '${tableName}', Column ${index}: Missing 'id' property`);
            }
            if (!col.title) {
                errors.push(`Table '${tableName}', Column ${index}: Missing 'title' property`);
            }
            if (col.required && col.defaultVisible === false) {
                errors.push(`Table '${tableName}', Column '${col.id}': Required columns should not have defaultVisible=false`);
            }
        });

        // Check for duplicate column IDs
        const columnIds = config.columns.map(col => col.id);
        const duplicates = columnIds.filter((id, index) => columnIds.indexOf(id) !== index);
        if (duplicates.length > 0) {
            errors.push(`Table '${tableName}': Duplicate column IDs found: ${duplicates.join(', ')}`);
        }
    });

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Get a list of all available table names
 * @returns {array} Array of table names
 */
export function getAvailableTables() {
    return Object.keys(tableColumnConfig);
}

export default {
    getTableConfig,
    getTableColumns,
    getDefaultSort,
    getColumnHeaders,
    getRequiredColumns,
    getDefaultVisibleColumns,
    validateConfig,
    getAvailableTables
};
