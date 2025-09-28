/**
 * Utility functions for generating dynamic columns for GenericTableFast
 */

/**
 * Generate dynamic member columns for zone table
 * @param {number} memberCount - Number of member columns to generate
 * @param {Array} memberOptions - Available member options for dropdowns
 * @returns {Array} Array of column definitions
 */
export const generateMemberColumns = (memberCount = 20, memberOptions = []) => {
  const memberColumns = [];
  
  for (let i = 1; i <= memberCount; i++) {
    memberColumns.push({
      data: `member_${i}`,
      title: `Member ${i}`,
      type: 'dropdown',
      width: 150
    });
  }
  
  return memberColumns;
};

/**
 * Generate base columns for zone table
 * @returns {Array} Array of base column definitions
 */
export const getZoneBaseColumns = () => [
  { data: 'zone_status', title: 'Status', width: 80, readOnly: true },
  { data: 'name', title: 'Name', width: 200 },
  { data: 'fabric', title: 'Fabric', type: 'dropdown', width: 150 },
  { data: 'member_count', title: 'Members', width: 80, readOnly: true },
  { data: 'create', title: 'Create', type: 'checkbox', width: 80 },
  { data: 'delete', title: 'Delete', type: 'checkbox', width: 80 },
  { data: 'exists', title: 'Exists', type: 'checkbox', width: 80 },
  { data: 'zone_type', title: 'Zone Type', type: 'dropdown', width: 120 },
  { data: 'imported', title: 'Imported', width: 120, readOnly: true },
  { data: 'updated', title: 'Updated', width: 120, readOnly: true },
  { data: 'notes', title: 'Notes', width: 200 }
];

/**
 * Generate complete zone table columns (base + dynamic members)
 * @param {number} memberCount - Number of member columns
 * @param {Array} visibleBaseIndices - Which base columns to show
 * @returns {Object} { columns, headers }
 */
export const generateZoneTableColumns = (memberCount = 20, visibleBaseIndices = [0, 1, 2, 3, 4, 5, 6, 7]) => {
  const baseColumns = getZoneBaseColumns();
  const memberColumns = generateMemberColumns(memberCount);
  
  // Filter base columns by visibility
  const visibleBaseColumns = visibleBaseIndices.map(index => baseColumns[index]).filter(Boolean);
  
  // Combine base + member columns
  const allColumns = [...visibleBaseColumns, ...memberColumns];
  const allHeaders = allColumns.map(col => col.title);
  
  return {
    columns: allColumns,
    headers: allHeaders
  };
};

/**
 * Generate alias table columns
 * @returns {Object} { columns, headers }
 */
export const generateAliasTableColumns = () => {
  const columns = [
    { data: 'name', title: 'Alias Name', width: 200 },
    { data: 'wwpn', title: 'WWPN', width: 180 },
    { data: 'fabric', title: 'Fabric', type: 'dropdown', width: 150 },
    { data: 'device_type', title: 'Device Type', type: 'dropdown', width: 120 },
    { data: 'use', title: 'Use', type: 'dropdown', width: 100 },
    { data: 'include_in_zoning', title: 'Include in Zoning', type: 'checkbox', width: 120 },
    { data: 'zone_count', title: 'Zone Count', width: 100, readOnly: true },
    { data: 'notes', title: 'Notes', width: 200 }
  ];
  
  return {
    columns,
    headers: columns.map(col => col.title)
  };
};

/**
 * Generate fabric table columns
 * @returns {Object} { columns, headers }
 */
export const generateFabricTableColumns = () => {
  const columns = [
    { data: 'name', title: 'Fabric Name', width: 200 },
    { data: 'vsan_id', title: 'VSAN ID', width: 100 },
    { data: 'switch_count', title: 'Switches', width: 100, readOnly: true },
    { data: 'zone_count', title: 'Zones', width: 100, readOnly: true },
    { data: 'alias_count', title: 'Aliases', width: 100, readOnly: true },
    { data: 'notes', title: 'Notes', width: 300 }
  ];
  
  return {
    columns,
    headers: columns.map(col => col.title)
  };
};

/**
 * Generate storage table columns
 * @returns {Object} { columns, headers }
 */
export const generateStorageTableColumns = () => {
  const columns = [
    { data: 'name', title: 'Storage System', width: 200 },
    { data: 'vendor', title: 'Vendor', type: 'dropdown', width: 120 },
    { data: 'model', title: 'Model', width: 150 },
    { data: 'capacity_tb', title: 'Capacity (TB)', width: 120 },
    { data: 'used_tb', title: 'Used (TB)', width: 100, readOnly: true },
    { data: 'available_tb', title: 'Available (TB)', width: 120, readOnly: true },
    { data: 'utilization_percent', title: 'Utilization %', width: 100, readOnly: true },
    { data: 'status', title: 'Status', width: 100, readOnly: true },
    { data: 'location', title: 'Location', width: 150 },
    { data: 'notes', title: 'Notes', width: 200 }
  ];
  
  return {
    columns,
    headers: columns.map(col => col.title)
  };
};

/**
 * Auto-detect table type and generate appropriate columns
 * @param {string} tableName - Name of the table (zones, aliases, fabrics, storage)
 * @param {Object} options - Additional options like memberCount for zones
 * @returns {Object} { columns, headers }
 */
export const generateTableColumns = (tableName, options = {}) => {
  switch (tableName?.toLowerCase()) {
    case 'zones':
    case 'zone':
      return generateZoneTableColumns(
        options.memberCount || 20,
        options.visibleBaseIndices
      );
    
    case 'aliases':
    case 'alias':
      return generateAliasTableColumns();
    
    case 'fabrics':
    case 'fabric':
      return generateFabricTableColumns();
    
    case 'storage':
    case 'storagesystem':
      return generateStorageTableColumns();
    
    default:
      console.warn(`Unknown table type: ${tableName}, using generic columns`);
      return {
        columns: [
          { data: 'id', title: 'ID', width: 80, readOnly: true },
          { data: 'name', title: 'Name', width: 200 },
          { data: 'notes', title: 'Notes', width: 300 }
        ],
        headers: ['ID', 'Name', 'Notes']
      };
  }
};

/**
 * Convert old GenericTable column format to new format
 * @param {Array} oldColumns - Old column definitions
 * @param {Array} oldHeaders - Old header definitions
 * @returns {Object} { columns, headers }
 */
export const convertLegacyColumns = (oldColumns = [], oldHeaders = []) => {
  const columns = oldColumns.map((col, index) => ({
    data: col.data,
    title: oldHeaders[index] || col.title || col.data,
    type: col.type,
    width: col.width || 120,
    readOnly: col.readOnly || false
  }));
  
  return {
    columns,
    headers: columns.map(col => col.title)
  };
};