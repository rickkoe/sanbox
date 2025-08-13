// Helper function to detect what types of data are in parsed data
export const detectDataTypes = (items) => {
  const hasAliases = items.some(item => item.wwpn !== undefined);
  const hasZones = items.some(
    (item) => item.zone_type !== undefined || item.members !== undefined
  );
  return { aliases: hasAliases, zones: hasZones };
};

// Calculate import statistics for both aliases and zones
export const getImportStats = (parsedData) => {
  const allAliases = parsedData.filter(item => item.wwpn !== undefined);
  const allZones = parsedData.filter(item => item.zone_type !== undefined || item.members !== undefined);
  
  const newAliases = allAliases.filter(alias => !alias.existsInDatabase);
  const duplicateAliases = allAliases.filter(alias => alias.existsInDatabase);
  const smartDetectedAliases = allAliases.filter(alias => alias.smartDetectionNote);
  const smartDetectedWithRules = smartDetectedAliases.filter(alias => !alias.smartDetectionNote.includes('No prefix rule found'));
  const smartDetectedWithoutRules = smartDetectedAliases.filter(alias => alias.smartDetectionNote.includes('No prefix rule found'));
  
  const newZones = allZones.filter(zone => !zone.existsInDatabase);
  const duplicateZones = allZones.filter(zone => zone.existsInDatabase);
  
  return {
    // Alias stats
    totalAliases: allAliases.length,
    newAliases: newAliases.length,
    duplicateAliases: duplicateAliases.length,
    smartDetected: smartDetectedAliases.length,
    smartDetectedWithRules: smartDetectedWithRules.length,
    smartDetectedWithoutRules: smartDetectedWithoutRules.length,
    
    // Zone stats
    totalZones: allZones.length,
    newZones: newZones.length,
    duplicateZones: duplicateZones.length,
    
    // Combined stats (for backward compatibility)
    total: allAliases.length + allZones.length,
    new: newAliases.length + newZones.length,
    duplicates: duplicateAliases.length + duplicateZones.length
  };
};

// Deduplicate items by name
export const deduplicateItems = (items) => {
  const seen = new Set();
  return items.filter(item => {
    const key = item.name;
    if (seen.has(key)) {
      // console.log(`Removing duplicate: ${key}`);
      return false;
    }
    seen.add(key);
    return true;
  });
};

// Resolve zone members against available aliases (imported + existing)
export const resolveZoneMembers = (zones, aliases, existingAliases = []) => {
  console.log(`🔄 Resolving ${zones.length} zones with ${aliases.length} imported aliases and ${existingAliases.length} existing aliases`);
  
  // Create a map of all available aliases (imported + existing)
  const allAliases = new Map();
  
  // Add imported aliases
  aliases.forEach(alias => {
    allAliases.set(alias.name, {
      name: alias.name,
      wwpn: alias.wwpn,
      source: 'importing'
    });
  });
  
  // Add existing aliases from database
  existingAliases.forEach(alias => {
    if (!allAliases.has(alias.name)) {
      allAliases.set(alias.name, {
        name: alias.name,
        wwpn: alias.wwpn || alias.pwwn,
        source: 'database'
      });
    }
  });
  
  // Resolve members for each zone
  return zones.map((zone, zoneIndex) => {
    if (!zone.members || zone.members.length === 0) {
      return {
        ...zone,
        resolvedMembers: [],
        unresolvedMembers: zone.members || [],
        memberResolutionStats: {
          total: 0,
          resolved: 0,
          unresolved: 0
        }
      };
    }
    
    if (zoneIndex < 3) { // Debug first 3 zones
      console.log(`🔍 Zone ${zone.name}: ${zone.members.length} members:`, zone.members.map(m => `${m.type}:${m.name}`));
    }
    
    const resolvedMembers = [];
    const unresolvedMembers = [];
    
    zone.members.forEach(member => {
      if (member.type === 'device-alias' || member.type === 'fcalias') {
        const aliasInfo = allAliases.get(member.name);
        if (aliasInfo) {
          resolvedMembers.push({
            ...member,
            resolved: true,
            wwpn: aliasInfo.wwpn,
            source: aliasInfo.source
          });
        } else {
          unresolvedMembers.push({
            ...member,
            resolved: false,
            reason: 'Alias not found'
          });
        }
      } else if (member.type === 'pwwn') {
        // PWWN members are always considered resolved
        resolvedMembers.push({
          ...member,
          resolved: true,
          wwpn: member.name,
          source: 'direct'
        });
      } else {
        unresolvedMembers.push({
          ...member,
          resolved: false,
          reason: 'Unknown member type'
        });
      }
    });
    
    return {
      ...zone,
      resolvedMembers,
      unresolvedMembers,
      memberResolutionStats: {
        total: zone.members.length,
        resolved: resolvedMembers.length,
        unresolved: unresolvedMembers.length
      }
    };
  });
};