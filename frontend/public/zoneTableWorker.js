// Web Worker for ZoneTable heavy computations
// This worker handles expensive data processing to prevent UI blocking

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  try {
    switch (type) {
      case 'CALCULATE_USED_ALIASES':
        handleCalculateUsedAliases(data);
        break;
      case 'FILTER_ALIASES_FOR_FABRIC':
        handleFilterAliasesForFabric(data);
        break;
      case 'CALCULATE_ZONE_COUNTS':
        handleCalculateZoneCounts(data);
        break;
      case 'PROCESS_ALIASES_DATA':
        handleProcessAliasesData(data);
        break;
      case 'VALIDATE_ZONE_FABRIC_STATUS':
        handleValidateZoneFabricStatus(data);
        break;
      default:
        self.postMessage({ type: 'ERROR', error: `Unknown message type: ${type}` });
    }
  } catch (error) {
    self.postMessage({ 
      type: 'ERROR', 
      error: error.message,
      stack: error.stack 
    });
  }
};

// Calculate which aliases are used across all table data
function handleCalculateUsedAliases(data) {
  const { sourceData, totalColumns, requestId } = data;
  const usedAliases = new Set();
  
  // Process in chunks to allow yielding
  const CHUNK_SIZE = 100;
  let processedRows = 0;
  
  function processChunk() {
    const endIndex = Math.min(processedRows + CHUNK_SIZE, sourceData.length);
    
    for (let idx = processedRows; idx < endIndex; idx++) {
      const rowData = sourceData[idx];
      if (rowData) {
        for (let i = 1; i <= totalColumns; i++) {
          const val = rowData[`member_${i}`];
          if (val) usedAliases.add(val);
        }
      }
    }
    
    processedRows = endIndex;
    
    if (processedRows < sourceData.length) {
      // Continue processing in next tick
      setTimeout(processChunk, 0);
    } else {
      // Finished processing
      self.postMessage({
        type: 'USED_ALIASES_RESULT',
        result: Array.from(usedAliases),
        requestId
      });
    }
  }
  
  processChunk();
}

// Filter aliases for a specific fabric with performance optimizations
function handleFilterAliasesForFabric(data) {
  const { 
    fabricAliases, 
    usedAliases, 
    currentValue, 
    aliasMaxZones, 
    rowFabric,
    requestId 
  } = data;
  
  const usedAliasesSet = new Set(usedAliases);
  
  // Process aliases in chunks
  const CHUNK_SIZE = 200;
  const availableAliases = [];
  let processedCount = 0;
  
  function processChunk() {
    const endIndex = Math.min(processedCount + CHUNK_SIZE, fabricAliases.length);
    
    for (let i = processedCount; i < endIndex; i++) {
      const alias = fabricAliases[i];
      
      const includeInZoning = alias.include_in_zoning === true;
      const hasRoomForMoreZones = (alias.zoned_count || 0) < aliasMaxZones;
      const isCurrentValue = alias.name === currentValue;
      
      // For editing: prevent duplicates within the current table session
      const notUsedInCurrentTable = !usedAliasesSet.has(alias.name) || isCurrentValue;
      
      // Zone count check: alias must have room for more zones OR be the current value
      const zoneCountCheck = hasRoomForMoreZones || isCurrentValue;

      if (includeInZoning && notUsedInCurrentTable && zoneCountCheck) {
        availableAliases.push(alias);
      }
    }
    
    processedCount = endIndex;
    
    if (processedCount < fabricAliases.length) {
      // Continue processing in next tick
      setTimeout(processChunk, 0);
    } else {
      // Sort aliases by name for consistent ordering
      availableAliases.sort((a, b) => a.name.localeCompare(b.name));
      const dropdownOptions = availableAliases.map(alias => alias.name);
      
      // Limit to 50 options max to prevent layout shifts
      if (dropdownOptions.length > 50) {
        dropdownOptions.splice(50);
      }
      
      // Add placeholder if no options available
      if (dropdownOptions.length === 0) {
        dropdownOptions.push('(No available aliases)');
      }
      
      self.postMessage({
        type: 'FILTERED_ALIASES_RESULT',
        result: dropdownOptions,
        requestId
      });
    }
  }
  
  processChunk();
}

// Calculate zone counts for aliases
function handleCalculateZoneCounts(data) {
  const { rawData, aliases, requestId } = data;
  
  const aliasZoneCounts = {};
  let processedZones = 0;
  const CHUNK_SIZE = 50;
  
  function processChunk() {
    const endIndex = Math.min(processedZones + CHUNK_SIZE, rawData.length);
    
    for (let i = processedZones; i < endIndex; i++) {
      const zone = rawData[i];
      if (zone && zone.members_details) {
        zone.members_details.forEach(member => {
          if (member.name) {
            aliasZoneCounts[member.name] = (aliasZoneCounts[member.name] || 0) + 1;
          }
        });
      }
    }
    
    processedZones = endIndex;
    
    if (processedZones < rawData.length) {
      setTimeout(processChunk, 0);
    } else {
      // Update aliases with calculated zone counts
      const updatedAliases = aliases.map(alias => ({
        ...alias,
        zoned_count: aliasZoneCounts[alias.name] || 0
      }));
      
      self.postMessage({
        type: 'ZONE_COUNTS_RESULT',
        result: updatedAliases,
        requestId
      });
    }
  }
  
  processChunk();
}

// Process raw aliases data
function handleProcessAliasesData(data) {
  const { aliasesArray, fabricOptions, requestId } = data;
  
  const processedAliases = [];
  let processedCount = 0;
  const CHUNK_SIZE = 200;
  
  function processChunk() {
    const endIndex = Math.min(processedCount + CHUNK_SIZE, aliasesArray.length);
    
    for (let i = processedCount; i < endIndex; i++) {
      const a = aliasesArray[i];
      
      // Handle different fabric reference structures
      let fabricName = "";
      if (a.fabric_details?.name) {
        fabricName = a.fabric_details.name;
      } else if (a.fabric) {
        // If fabric is an ID, find the name in fabricOptions
        const fabric = fabricOptions.find((f) => f.id === a.fabric);
        fabricName = fabric ? fabric.name : "";
      }

      processedAliases.push({
        id: a.id,
        name: a.name,
        fabric: fabricName,
        include_in_zoning: a.include_in_zoning,
        zoned_count: a.zoned_count || 0,
        use: a.use,
      });
    }
    
    processedCount = endIndex;
    
    if (processedCount < aliasesArray.length) {
      setTimeout(processChunk, 0);
    } else {
      self.postMessage({
        type: 'PROCESSED_ALIASES_RESULT',
        result: processedAliases,
        requestId
      });
    }
  }
  
  processChunk();
}

// Validate zone fabric status
function handleValidateZoneFabricStatus(data) {
  const { zones, memberOptions, requestId } = data;
  
  // Create a map for faster lookups
  const memberOptionsMap = new Map();
  memberOptions.forEach(alias => {
    memberOptionsMap.set(alias.name, alias);
  });
  
  const validatedZones = [];
  let processedCount = 0;
  const CHUNK_SIZE = 100;
  
  function processChunk() {
    const endIndex = Math.min(processedCount + CHUNK_SIZE, zones.length);
    
    for (let i = processedCount; i < endIndex; i++) {
      const zone = zones[i];
      
      if (!zone.fabric || !zone.members_details?.length) {
        validatedZones.push({ ...zone, zone_status: "valid" });
        continue;
      }

      const zoneFabric = zone.fabric_details?.name || zone.fabric;
      
      // Check if all members belong to the same fabric as the zone
      const invalidMembers = zone.members_details.filter(member => {
        const alias = memberOptionsMap.get(member.name);
        return alias && alias.fabric !== zoneFabric;
      });

      const zoneStatus = invalidMembers.length > 0 ? "invalid" : "valid";
      validatedZones.push({ ...zone, zone_status: zoneStatus });
    }
    
    processedCount = endIndex;
    
    if (processedCount < zones.length) {
      setTimeout(processChunk, 0);
    } else {
      self.postMessage({
        type: 'VALIDATED_ZONES_RESULT',
        result: validatedZones,
        requestId
      });
    }
  }
  
  processChunk();
}