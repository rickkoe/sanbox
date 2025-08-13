import { detectWwpnType } from './wwpnDetection';

export const parseAliasData = async (text, fabricId, defaults) => {
  console.log("🏗️ parseAliasData called with fabricId:", fabricId, typeof fabricId);
  console.log("🎛️ Using defaults:", defaults);
  
  if (defaults.aliasType === "original") {
    console.log("🔄 Using 'original' mode - preserving source alias types");
  }
  if (defaults.use === "smart") {
    console.log("🧠 Using smart detection mode");
  }
  if (!fabricId || (typeof fabricId === 'string' && fabricId.trim() === "")) {
    console.warn("⚠️ No fabric selected, cannot parse aliases");
    return [];
  }
  
  const lines = text.split("\n");
  const aliases = [];
  
  const deviceAliasRegex = /device-alias\s+name\s+(\S+)\s+pwwn\s+([0-9a-fA-F:]{23})/i;
  const fcAliasRegex = /fcalias\s+name\s+(\S+)\s+vsan\s+(\d+)/i;
  
  let currentFcAlias = null;
  
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmedLine = line.trim();
    
    // Device-alias format
    const deviceMatch = trimmedLine.match(deviceAliasRegex);
    if (deviceMatch) {
      const [, name, wwpn] = deviceMatch;
      const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, "").match(/.{2}/g)?.join(":") || wwpn;
      
      // Determine use type (with smart detection if enabled)
      let useType = defaults.use;
      let smartDetectionNote = null;
      if (defaults.use === "smart") {
        const detectedType = await detectWwpnType(formattedWWPN);
        if (detectedType) {
          useType = detectedType;
          smartDetectionNote = `Smart detected: ${detectedType}`;
          console.log(`🧠 Smart detection: ${formattedWWPN} -> ${detectedType}`);
        } else {
          console.log(`🧠 Smart detection: No rule found for ${formattedWWPN}, using default fallback`);
          useType = "init"; // Default fallback for smart detection
          smartDetectionNote = `No prefix rule found - defaulted to init`;
        }
      }
      
      aliases.push({
        lineNumber: index + 1,
        name,
        wwpn: formattedWWPN,
        create: defaults.create,
        include_in_zoning: defaults.includeInZoning,
        use: useType,
        cisco_alias: defaults.aliasType === "original" ? "device-alias" : defaults.aliasType,
        fabric: parseInt(fabricId),
        ...(smartDetectionNote && { smartDetectionNote })
      });
      console.log(`📝 Found device-alias: ${name} -> ${formattedWWPN} (${useType})`);
      continue;
    }
    
    // FC-alias format (header)
    const fcMatch = trimmedLine.match(fcAliasRegex);
    if (fcMatch) {
      const [, name, vsan] = fcMatch;
      currentFcAlias = {
        lineNumber: index + 1,
        name,
        vsan: parseInt(vsan),
        wwpns: []
      };
      console.log(`📝 Found fcalias header: ${name} (VSAN ${vsan})`);
      continue;
    }
    
    // FC-alias member (WWPN line)
    if (currentFcAlias && trimmedLine.match(/^member\s+pwwn\s+([0-9a-fA-F:]{23})/i)) {
      const wwpnMatch = trimmedLine.match(/^member\s+pwwn\s+([0-9a-fA-F:]{23})/i);
      if (wwpnMatch) {
        const wwpn = wwpnMatch[1];
        const formattedWWPN = wwpn.toLowerCase().replace(/[^0-9a-f]/g, "").match(/.{2}/g)?.join(":") || wwpn;
        currentFcAlias.wwpns.push(formattedWWPN);
        console.log(`  💼 Member WWPN: ${formattedWWPN}`);
      }
      continue;
    }
    
    // End of fcalias - create individual aliases for each WWPN
    if (currentFcAlias && (trimmedLine === "" || fcMatch || index === lines.length - 1)) {
      for (const wwpn of currentFcAlias.wwpns) {
        // Generate unique alias name for each WWPN
        const aliasName = currentFcAlias.wwpns.length === 1 
          ? currentFcAlias.name 
          : `${currentFcAlias.name}_${wwpn.replace(/:/g, "").substring(12)}`;
          
        // Determine use type (with smart detection if enabled)
        let useType = defaults.use;
        let smartDetectionNote = null;
        if (defaults.use === "smart") {
          const detectedType = await detectWwpnType(wwpn);
          if (detectedType) {
            useType = detectedType;
            smartDetectionNote = `Smart detected: ${detectedType}`;
            console.log(`🧠 Smart detection: ${wwpn} -> ${detectedType}`);
          } else {
            console.log(`🧠 Smart detection: No rule found for ${wwpn}, using default fallback`);
            useType = "init"; // Default fallback for smart detection
            smartDetectionNote = `No prefix rule found - defaulted to init`;
          }
        }
        
        aliases.push({
          lineNumber: currentFcAlias.lineNumber,
          name: aliasName,
          wwpn: wwpn,
          create: defaults.create,
          include_in_zoning: defaults.includeInZoning,
          use: useType,
          cisco_alias: defaults.aliasType === "original" ? "fcalias" : defaults.aliasType,
          fabric: parseInt(fabricId),
          vsan: currentFcAlias.vsan,
          ...(smartDetectionNote && { smartDetectionNote })
        });
        console.log(`📝 Created fcalias: ${aliasName} -> ${wwpn} (${useType})`);
      }
      
      currentFcAlias = null;
    }
  }
  
  console.log(`✅ Parsed ${aliases.length} aliases`);
  return aliases;
};