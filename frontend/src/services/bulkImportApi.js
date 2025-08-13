import axios from "axios";

// Enhance data with existence check from the database
export const enhanceWithExistenceCheck = async (items) => {
  if (!items || items.length === 0) {
    console.log("No items to enhance");
    return [];
  }

  console.log(`🔍 Checking existence for ${items.length} items`);
  
  // Separate aliases and zones
  const aliases = items.filter(item => item.wwpn !== undefined);
  const zones = items.filter(item => item.zone_type !== undefined || item.members !== undefined);
  
  console.log(`📊 Breakdown: ${aliases.length} aliases, ${zones.length} zones`);
  
  let enhancedItems = [...items]; // Start with original items
  
  // Check aliases if any exist
  if (aliases.length > 0) {
    try {
      const fabricId = aliases[0].fabric;
      console.log(`🔍 Checking existing aliases in fabric ${fabricId}`);
      
      // Get all existing aliases for this fabric
      const response = await axios.get(`/api/san/aliases/fabric/${fabricId}/`);
      const existingAliases = response.data.results || response.data || [];
      
      // Create sets for both name and wwpn checking
      const existingAliasNames = new Set(existingAliases.map(alias => alias.name));
      const existingWwpns = new Set(existingAliases.map(alias => alias.wwpn));
      
      console.log(`✅ Found ${existingAliases.length} existing aliases in fabric ${fabricId}`);
      console.log(`Names: ${existingAliasNames.size}, WWPNs: ${existingWwpns.size}`);
      
      // Debug: Show sample existing data
      if (existingAliases.length > 0) {
        console.log('Sample existing aliases:');
        existingAliases.slice(0, 3).forEach((alias, i) => {
          console.log(`  ${i + 1}: ${alias.name} -> ${alias.wwpn}`);
        });
      }
      
      let markedAsExisting = 0;
      
      // Update items with existence information
      enhancedItems = enhancedItems.map(item => {
        if (item.wwpn !== undefined) { // This is an alias
          // Check if alias exists by name OR by wwpn (since fabric+wwpn must be unique)
          const existsByName = existingAliasNames.has(item.name);
          const existsByWwpn = existingWwpns.has(item.wwpn);
          const exists = existsByName || existsByWwpn;
          
          if (exists) {
            markedAsExisting++;
            console.log(`  Existing alias found: ${item.name} (${existsByName ? 'by name' : 'by WWPN'})`);
          }
          
          return {
            ...item,
            existsInDatabase: exists
          };
        }
        return item;
      });
      
      console.log(`📊 Marked ${markedAsExisting} aliases as existing in database`);
    } catch (error) {
      console.error("Error checking alias existence:", error);
      // Continue without existence check for aliases
    }
  }
  
  // Check zones if any exist - we need project ID for this
  if (zones.length > 0) {
    try {
      // For now, we'll skip zone existence check since we don't have project ID here
      // This would need to be implemented with a proper zones endpoint
      console.log("⚠️ Zone existence check not implemented, marking all as new");
      const existingZoneNames = new Set();
      
      // Update items with existence information
      enhancedItems = enhancedItems.map(item => {
        if (item.zone_type !== undefined || item.members !== undefined) { // This is a zone
          return {
            ...item,
            existsInDatabase: existingZoneNames.has(item.name)
          };
        }
        return item;
      });
    } catch (error) {
      console.error("Error checking zone existence:", error);
      // Continue without existence check for zones
    }
  }
  
  const enhancedAliases = enhancedItems.filter(item => item.wwpn !== undefined);
  const enhancedZones = enhancedItems.filter(item => item.zone_type !== undefined || item.members !== undefined);
  
  console.log(`📊 Enhanced results: ${enhancedAliases.length} aliases, ${enhancedZones.length} zones`);
  console.log(`🔄 Existing: ${enhancedAliases.filter(a => a.existsInDatabase).length} aliases, ${enhancedZones.filter(z => z.existsInDatabase).length} zones`);
  
  return enhancedItems;
};

// Refresh alias options from the API
export const refreshAliasOptions = async (fabricId, retryForLargeImport = false, maxRetries = 5, expectedAliasNames = []) => {
  if (!fabricId) {
    console.warn("No fabric ID provided for alias refresh");
    return [];
  }

  console.log(`🔄 Refreshing aliases for fabric ${fabricId}`);
  
  if (retryForLargeImport && expectedAliasNames.length > 0) {
    console.log(`🔄 Large import retry mode: Looking for ${expectedAliasNames.length} specific aliases`);
    console.log(`🎯 Expected aliases sample:`, expectedAliasNames.slice(0, 5));
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 API call attempt ${attempt}/${maxRetries}`);
      const response = await axios.get(`/api/san/aliases/fabric/${fabricId}/`);
      const aliases = response.data.results || response.data || [];
      
      console.log(`✅ Received ${aliases.length} aliases from API`);
      
      // If this is a retry for a large import, check if we got the expected aliases
      if (retryForLargeImport && expectedAliasNames.length > 0) {
        const receivedNames = new Set(aliases.map(alias => alias.name));
        const foundExpectedAliases = expectedAliasNames.filter(name => receivedNames.has(name));
        
        console.log(`🎯 Found ${foundExpectedAliases.length}/${expectedAliasNames.length} expected aliases`);
        
        if (foundExpectedAliases.length === expectedAliasNames.length) {
          console.log("✅ All expected aliases found!");
          return aliases;
        } else if (attempt < maxRetries) {
          console.log(`⏳ Not all expected aliases found, retrying in 2 seconds (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          continue;
        } else {
          console.log(`⚠️ Final attempt: Found ${foundExpectedAliases.length}/${expectedAliasNames.length} expected aliases`);
          return aliases;
        }
      } else {
        return aliases;
      }
    } catch (error) {
      console.error(`❌ Attempt ${attempt}/${maxRetries} failed:`, error);
      
      if (attempt === maxRetries) {
        console.error("❌ All retry attempts failed");
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
      console.log(`⏳ Waiting ${waitTime}ms before retry`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
  
  return [];
};

// Fetch WWPN prefixes for smart detection
export const fetchWwpnPrefixes = async () => {
  try {
    console.log('🔄 Fetching WWPN prefixes for smart detection');
    const response = await axios.get('/api/san/wwpn-prefixes/');
    const prefixes = response.data.results || response.data || [];
    console.log(`✅ Loaded ${prefixes.length} WWPN prefixes`);
    return prefixes;
  } catch (error) {
    console.error('❌ Error fetching WWPN prefixes:', error);
    return []; // Return empty array on error
  }
};

// Import aliases to the database
export const importAliases = async (aliases, projectId) => {
  try {
    console.log(`🔄 Importing ${aliases.length} aliases to project ${projectId}`);
    
    // Format aliases for the API
    const aliasData = aliases.map(alias => {
      console.log('Sample alias data:', alias.name, 'WWPN:', alias.wwpn, 'Fabric:', alias.fabric);
      return {
        name: alias.name,
        wwpn: alias.wwpn,
        use: alias.use,
        cisco_alias: alias.cisco_alias,
        fabric: alias.fabric,
        create: alias.create,
        include_in_zoning: alias.include_in_zoning
      };
    });
    
    const response = await axios.post('/api/san/aliases/save/', {
      project_id: projectId,
      aliases: aliasData
    });
    
    console.log(`✅ Successfully imported ${aliases.length} aliases`);
    return response.data;
  } catch (error) {
    console.error('❌ Error importing aliases:', error);
    console.error('Error details:', error.response?.data);
    
    // Show detailed validation errors
    if (error.response?.data?.details) {
      console.error('Validation errors sample (first 5):');
      error.response.data.details.slice(0, 5).forEach((detail, index) => {
        console.error(`  ${index + 1}:`, detail);
      });
    }
    
    throw error;
  }
};

// Import zones to the database
export const importZones = async (zones, projectId) => {
  try {
    console.log(`🔄 Importing ${zones.length} zones to project ${projectId}`);
    
    // Format zones for the API
    const zoneData = zones.map(zone => {
      console.log('Zone data:', zone.name, 'Members:', zone.members);
      
      // Convert member objects to alias IDs if they exist
      let memberIds = [];
      if (zone.members && Array.isArray(zone.members)) {
        memberIds = zone.members
          .filter(member => member && member.aliasId) // Only include members that have been resolved to alias IDs
          .map(member => member.aliasId);
      }
      
      return {
        name: zone.name,
        vsan: zone.vsan,
        zone_type: zone.zone_type,
        fabric: zone.fabric,
        create: zone.create,
        exists: zone.exists,
        members: memberIds // Send array of alias IDs
      };
    });
    
    const response = await axios.post('/api/san/zones/save/', {
      project_id: projectId,
      zones: zoneData
    });
    
    console.log(`✅ Successfully imported ${zones.length} zones`);
    return response.data;
  } catch (error) {
    console.error('❌ Error importing zones:', error);
    console.error('Error details:', error.response?.data);
    throw error;
  }
};