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

// Deduplicate items by name for zones, by wwpn for aliases
export const deduplicateItems = (items) => {
  const seenAliases = new Set(); // Track by WWPN for aliases
  const seenZones = new Set();   // Track by name for zones
  
  return items.filter(item => {
    if (item.wwpn !== undefined) {
      // This is an alias - deduplicate by WWPN
      const key = item.wwpn;
      if (seenAliases.has(key)) {
        console.log(`Removing duplicate alias by WWPN: ${item.name} (${key})`);
        return false;
      }
      seenAliases.add(key);
      return true;
    } else {
      // This is a zone - deduplicate by name
      const key = item.name;
      if (seenZones.has(key)) {
        console.log(`Removing duplicate zone: ${key}`);
        return false;
      }
      seenZones.add(key);
      return true;
    }
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
      id: alias.id, // Include alias ID
      name: alias.name,
      wwpn: alias.wwpn,
      source: 'importing'
    });
  });
  
  // Add existing aliases from database
  existingAliases.forEach(alias => {
    if (!allAliases.has(alias.name)) {
      allAliases.set(alias.name, {
        id: alias.id, // Include alias ID for existing aliases too
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
          if (zoneIndex < 3) { // Debug first 3 zones
            console.log(`  Found alias ${member.name}:`, {id: aliasInfo.id, wwpn: aliasInfo.wwpn, source: aliasInfo.source});
          }
          resolvedMembers.push({
            ...member,
            resolved: true,
            wwpn: aliasInfo.wwpn,
            source: aliasInfo.source,
            aliasId: aliasInfo.id // Add alias ID for import
          });
        } else {
          unresolvedMembers.push({
            ...member,
            resolved: false,
            reason: 'Alias not found'
          });
        }
      } else if (member.type === 'pwwn') {
        // For PWWN members, try to find a matching alias by WWPN
        const matchingAlias = Array.from(allAliases.values()).find(alias => alias.wwpn === member.name);
        if (matchingAlias) {
          // Found an alias with this WWPN - resolve to the alias
          if (zoneIndex < 3) { // Debug first 3 zones
            console.log(`  Resolved PWWN ${member.name} to alias ${matchingAlias.name} (ID: ${matchingAlias.id})`);
          }
          resolvedMembers.push({
            ...member,
            resolved: true,
            wwpn: member.name,
            source: matchingAlias.source,
            aliasId: matchingAlias.id,
            aliasName: matchingAlias.name
          });
        } else {
          // No alias found for this PWWN - keep as direct PWWN (not supported by current Zone model)
          if (zoneIndex < 3) { // Debug first 3 zones
            console.log(`  PWWN ${member.name} not found in aliases - keeping as direct PWWN`);
          }
          resolvedMembers.push({
            ...member,
            resolved: true,
            wwpn: member.name,
            source: 'direct'
          });
        }
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