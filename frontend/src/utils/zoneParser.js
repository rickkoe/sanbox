export const parseZoneData = async (text, fabricId, defaults, batchAliases = []) => {
  console.log("🏗️ parseZoneData called with fabricId:", fabricId, typeof fabricId);
  console.log("🎛️ Using defaults:", defaults);
  console.log("📋 Batch aliases available:", batchAliases.length);
  
  if (!fabricId || (typeof fabricId === 'string' && fabricId.trim() === "")) {
    console.warn("⚠️ No fabric selected, cannot parse zones");
    return [];
  }
  
  const lines = text.split("\n");
  const zones = [];
  
  // Create a lookup map for quick alias resolution
  const aliasMap = new Map();
  batchAliases.forEach(alias => {
    aliasMap.set(alias.name, alias);
  });
  
  let currentZone = null;
  let currentMembers = [];
  let currentUnresolvedMembers = [];
  
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmedLine = line.trim();
    
    // Zone header: zone name ZONE_NAME vsan 1
    const zoneMatch = trimmedLine.match(/^zone\s+name\s+(\S+)(?:\s+vsan\s+(\d+))?/i);
    if (zoneMatch) {
      // Save previous zone if exists
      if (currentZone) {
        zones.push({
          lineNumber: currentZone.lineNumber,
          name: currentZone.name,
          vsan: currentZone.vsan,
          zone_type: currentZone.zone_type || defaults.zoneType || "standard",
          members: [...currentMembers],
          unresolvedMembers: [...currentUnresolvedMembers],
          create: defaults.create,
          exists: defaults.exists,
          fabric: parseInt(fabricId)
        });
      }
      
      const [, name, vsan] = zoneMatch;
      currentZone = {
        lineNumber: index + 1,
        name,
        vsan: vsan ? parseInt(vsan) : null,
        zone_type: "standard" // Default, may be overridden
      };
      currentMembers = [];
      currentUnresolvedMembers = [];
      console.log(`📝 Found zone: ${name} ${vsan ? `(VSAN ${vsan})` : ''}`);
      continue;
    }
    
    // Zone members
    if (currentZone) {
      // Device-alias member: device-alias HOST_01
      const deviceAliasMember = trimmedLine.match(/^\s*device-alias\s+(\S+)/i);
      if (deviceAliasMember) {
        const aliasName = deviceAliasMember[1];
        const alias = aliasMap.get(aliasName);
        
        if (alias) {
          currentMembers.push({
            id: alias.id,
            name: aliasName,
            wwpn: alias.wwpn,
            use: alias.use
          });
          console.log(`  ✅ Resolved member: device-alias ${aliasName} -> ${alias.wwpn}`);
        } else {
          currentUnresolvedMembers.push({
            type: 'device-alias',
            name: aliasName
          });
          console.log(`  ⚠️ Unresolved member: device-alias ${aliasName}`);
        }
        continue;
      }
      
      // FC-alias member: fcalias ALIAS_NAME
      const fcAliasMember = trimmedLine.match(/^\s*fcalias\s+(\S+)/i);
      if (fcAliasMember) {
        const aliasName = fcAliasMember[1];
        const alias = aliasMap.get(aliasName);
        
        if (alias) {
          currentMembers.push({
            id: alias.id,
            name: aliasName,
            wwpn: alias.wwpn,
            use: alias.use
          });
          console.log(`  ✅ Resolved member: fcalias ${aliasName} -> ${alias.wwpn}`);
        } else {
          currentUnresolvedMembers.push({
            type: 'fcalias',
            name: aliasName
          });
          console.log(`  ⚠️ Unresolved member: fcalias ${aliasName}`);
        }
        continue;
      }
      
      // Direct WWPN member: pwwn 10:00:00:00:c9:7b:5c:01
      const pwwnMember = trimmedLine.match(/^\s*pwwn\s+([0-9a-fA-F:]+)/i);
      if (pwwnMember) {
        const wwpn = pwwnMember[1];
        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, "").match(/.{2}/g)?.join(":") || wwpn;
        
        // For direct WWPNs, we don't have an alias ID, so we'll use the WWPN as both name and wwpn
        currentMembers.push({
          name: formattedWWPN,
          wwpn: formattedWWPN,
          use: "unknown" // We don't know the type for direct WWPNs
        });
        console.log(`  ✅ Direct WWPN member: ${formattedWWPN}`);
        continue;
      }
    }
    
    // End of zone or file
    if (currentZone && (trimmedLine === "" || zoneMatch || index === lines.length - 1)) {
      // Only add zones that have at least one member or unresolved member
      if (currentMembers.length > 0 || currentUnresolvedMembers.length > 0) {
        zones.push({
          lineNumber: currentZone.lineNumber,
          name: currentZone.name,
          vsan: currentZone.vsan,
          zone_type: currentZone.zone_type || defaults.zoneType || "standard",
          members: [...currentMembers],
          unresolvedMembers: [...currentUnresolvedMembers],
          create: defaults.create,
          exists: defaults.exists,
          fabric: parseInt(fabricId)
        });
      }
      
      if (trimmedLine === "" || index === lines.length - 1) {
        currentZone = null;
        currentMembers = [];
        currentUnresolvedMembers = [];
      }
    }
  }
  
  console.log(`✅ Parsed ${zones.length} zones`);
  console.log(`📊 Zone summary:`);
  zones.forEach(zone => {
    console.log(`  ${zone.name}: ${zone.members.length} resolved, ${zone.unresolvedMembers.length} unresolved`);
  });
  
  return zones;
};