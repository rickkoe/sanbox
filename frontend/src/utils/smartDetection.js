// Smart detection utility for aliases
export const applySmartDetection = (allAliases, aliasDefaults, wwpnPrefixes = []) => {
  // Group aliases by WWPN to detect conflicts for type resolution
  const wwpnGroups = new Map();
  
  allAliases.forEach(alias => {
    if (!wwpnGroups.has(alias.wwpn)) {
      wwpnGroups.set(alias.wwpn, []);
    }
    wwpnGroups.get(alias.wwpn).push(alias);
  });

  const processedAliases = [];

  // Process each WWPN group
  wwpnGroups.forEach((aliasesForWwpn, wwpn) => {
    // Determine the resolved alias type based on aliasType setting
    let resolvedAliasType;
    let typeNote = '';
    
    if (aliasDefaults.aliasType === 'original') {
      if (aliasesForWwpn.length === 1) {
        // No conflict - use the original alias type
        resolvedAliasType = aliasesForWwpn[0].cisco_alias;
        typeNote = `Original type: ${resolvedAliasType}`;
      } else {
        // Conflict detected - apply conflict resolution
        const deviceAliases = aliasesForWwpn.filter(a => a.cisco_alias === 'device-alias');
        const fcAliases = aliasesForWwpn.filter(a => a.cisco_alias === 'fcalias');
        
        console.log(`🔍 Type conflict detected for WWPN ${wwpn}: ${deviceAliases.length} device-alias, ${fcAliases.length} fcalias`);
        
        resolvedAliasType = resolveTypeConflict(aliasDefaults.conflictResolution, deviceAliases, fcAliases);
        typeNote = `Conflict resolved: chose ${resolvedAliasType} (had both device-alias and fcalias)`;
      }
    } else {
      // Use the selected alias type for all
      resolvedAliasType = aliasDefaults.aliasType;
      typeNote = `Set to: ${resolvedAliasType}`;
    }
    
    // Determine the resolved use based on use setting
    let resolvedUse;
    let useNote = '';
    
    if (aliasDefaults.use === 'smart') {
      // Look up WWPN prefix in database (remove colons first)
      const wwpnNoColons = wwpn.replace(/:/g, '');
      const wwpnPrefix = wwpnNoColons.substring(0, 4).toLowerCase();
      const prefixMatch = wwpnPrefixes.find(p => p.prefix.toLowerCase() === wwpnPrefix);
      
      if (prefixMatch) {
        resolvedUse = prefixMatch.wwpn_type; // 'init' or 'target'
        useNote = `Smart detection: prefix ${wwpnPrefix} -> ${prefixMatch.wwpn_type} (${prefixMatch.vendor || 'unknown vendor'})`;
      } else {
        resolvedUse = 'init'; // Default fallback
        useNote = `Smart detection: prefix ${wwpnPrefix} not found, defaulting to init`;
      }
    } else {
      // Use the selected use for all
      resolvedUse = aliasDefaults.use;
      useNote = `Set to: ${resolvedUse}`;
    }
    
    // Create entries for all aliases with the resolved values
    aliasesForWwpn.forEach(alias => {
      processedAliases.push({
        ...alias,
        cisco_alias: resolvedAliasType, // This becomes the "Type" column
        use: resolvedUse, // This becomes the "Use" column
        smartDetectionNote: typeNote + (useNote ? ` | ${useNote}` : '')
      });
    });
  });

  return processedAliases;
};

const resolveTypeConflict = (conflictResolution, deviceAliases, fcAliases) => {
  switch (conflictResolution) {
    case 'device-alias':
      return 'device-alias';
    case 'fcalias':
      return 'fcalias';
    case 'prefer-device-alias':
      return deviceAliases.length > 0 ? 'device-alias' : 'fcalias';
    case 'prefer-fcalias':
      return fcAliases.length > 0 ? 'fcalias' : 'device-alias';
    case 'first-found':
      // Use the type of the first alias found
      return deviceAliases.length > 0 && fcAliases.length > 0 
        ? (deviceAliases[0].order < fcAliases[0].order ? 'device-alias' : 'fcalias')
        : (deviceAliases.length > 0 ? 'device-alias' : 'fcalias');
    default:
      return 'device-alias'; // Default fallback
  }
};

export const mergeAliasesWithSmartDetection = (deviceAliases, fcAliases, aliasDefaults, selectedFabric, wwpnPrefixes = []) => {
  // Convert device aliases to common format
  const deviceAliasItems = deviceAliases.map((alias, index) => ({
    name: alias.name,
    wwpn: alias.wwpn,
    create: aliasDefaults.create,
    include_in_zoning: aliasDefaults.includeInZoning,
    cisco_alias: 'device-alias',
    original_use: 'device-alias',
    fabric: parseInt(selectedFabric),
    order: index * 2 // Even numbers for device-aliases
  }));

  // Convert fc aliases to common format
  const fcAliasItems = fcAliases.map((alias, index) => ({
    name: alias.name,
    wwpn: alias.wwpn,
    create: aliasDefaults.create,
    include_in_zoning: aliasDefaults.includeInZoning,
    cisco_alias: 'fcalias',
    original_use: 'fcalias',
    fabric: parseInt(selectedFabric),
    order: index * 2 + 1 // Odd numbers for fc-aliases
  }));

  // Combine all aliases
  const allAliases = [...deviceAliasItems, ...fcAliasItems];

  // Apply smart detection with WWPN prefix lookup
  return applySmartDetection(allAliases, aliasDefaults, wwpnPrefixes);
};