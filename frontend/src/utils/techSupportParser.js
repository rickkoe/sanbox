// Tech support file parsing utilities
import { detectWwpnType } from './wwpnDetection';

export const parseTechSupportFile = (text) => {
  const lines = text.split("\n");
  const extractedSections = {
    deviceAliases: [],
    fcAliases: [],
    zones: [],
    flogiWwpns: []
  };
  
  let currentSection = null;
  let currentVsan = null;
  let sectionLines = [];
  let inTargetSection = false;
  let foundShowDeviceAlias = false;
  
  // console.log("🔍 Parsing tech-support file with", lines.length, "lines");
  console.log("🎯 Looking for 'show device-alias database' and 'show flogi database' sections");
  
  // Debug: Look specifically for "show flogi database" lines
  console.log("🔍 Searching for 'show flogi database' line in file...");
  const flogiDatabaseLines = lines.filter(line => {
    const trimmed = line.trim().toLowerCase();
    return trimmed === 'show flogi database' || 
           trimmed === '`show flogi database`' ||
           trimmed === 'show flogi database' ||
           trimmed === '`show flogi database`';
  }).slice(0, 5); // Show first 5 matches
  
  if (flogiDatabaseLines.length > 0) {
    console.log(`📝 Found ${flogiDatabaseLines.length} exact 'show flogi database' lines:`);
    flogiDatabaseLines.forEach((line, index) => {
      console.log(`  ${index + 1}: "${line.trim()}"`);
    });
  } else {
    console.log("❌ No exact 'show flogi database' lines found in file");
  }
  
  // Also try a simpler approach - look for patterns anywhere in the file
  console.log("🔍 Simple pattern search:");
  const deviceAliasCount = (text.match(/device-alias\s+name\s+\S+\s+pwwn\s+[0-9a-fA-F:]+/gi) || []).length;
  const fcAliasCount = (text.match(/fcalias\s+name\s+\S+/gi) || []).length;
  const showDeviceAliasCount = (text.match(/show\s+device-alias\s+database/gi) || []).length;
  console.log(`Found patterns: ${deviceAliasCount} device-alias, ${fcAliasCount} fcalias, ${showDeviceAliasCount} show device-alias database`);
  
  // Show first few matches for debugging
  const deviceAliasMatches = text.match(/device-alias\s+name\s+\S+\s+pwwn\s+[0-9a-fA-F:]+/gi) || [];
  if (deviceAliasMatches.length > 0) {
    console.log("🔍 Sample device-alias matches:");
    deviceAliasMatches.slice(0, 3).forEach((match, i) => console.log(`  ${i + 1}: ${match}`));
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // Look for "show device-alias database" section (only first occurrence)
    if (!foundShowDeviceAlias && (
        trimmedLine.match(/^-+\s*show\s+device-alias\s+database/i) ||
        trimmedLine.match(/^`?show\s+device-alias\s+database`?/i))) {
      if (currentSection && sectionLines.length > 0) {
        processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
      }
      currentSection = "device-alias-show";
      sectionLines = [];
      inTargetSection = true;
      foundShowDeviceAlias = true;
      console.log("📝 Found FIRST 'show device-alias database' section at line", i + 1, ":", trimmedLine);
      continue;
    }
    
    // Look for "Full Zone Database Section" ONLY
    if (trimmedLine.match(/^!Full Zone Database Section for vsan\s+\d+/i)) {
      if (currentSection && sectionLines.length > 0) {
        processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
      }
      
      // Extract VSAN from Full Zone Database Section header
      const vsanMatch = trimmedLine.match(/^!Full Zone Database Section for vsan\s+(\d+)/i);
      if (vsanMatch) {
        currentVsan = parseInt(vsanMatch[1]);
        console.log("📝 Found Full Zone Database Section for VSAN", currentVsan, "at line", i + 1);
      }
      
      currentSection = "full-zone-database";
      sectionLines = [];
      inTargetSection = true;
      continue;
    }
    
    // Look for exact "show flogi database" section (not "show flogi database details")
    if (trimmedLine.match(/^-+\s*show\s+flogi\s+database\s*-*$/i) ||
        trimmedLine.match(/^`?show\s+flogi\s+database`?\s*$/i)) {
      if (currentSection && sectionLines.length > 0) {
        processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
      }
      currentSection = "flogi-show";
      sectionLines = [];
      inTargetSection = true;
      console.log("📝 Found 'show flogi database' section at line", i + 1);
      continue;
    }
    
    // Look for any other show command that indicates the end of our current section
    if (inTargetSection && trimmedLine.match(/^-+\s*show\s+(?!device-alias|zone|zoneset|flogi)/i)) {
      console.log("📝 Found end of section at line", i + 1, "- new show command:", trimmedLine.substring(0, 50));
      if (currentSection && sectionLines.length > 0) {
        processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
      }
      currentSection = null;
      sectionLines = [];
      inTargetSection = false;
      continue;
    }
    
    // If we're in a target section, collect the line
    if (inTargetSection) {
      sectionLines.push(line);
    }
  }
  
  // Process any remaining section
  if (currentSection && sectionLines.length > 0) {
    processTechSupportSection(currentSection, sectionLines, extractedSections, currentVsan);
  }
  
  console.log("📊 Tech-support parsing results:");
  console.log("  Device Aliases:", extractedSections.deviceAliases.length);
  console.log("  FC Aliases:", extractedSections.fcAliases.length);
  console.log("  Zones:", extractedSections.zones.length);
  console.log("  FLOGI WWPNs:", extractedSections.flogiWwpns.length);
  
  if (extractedSections.fcAliases.length > 0) {
    console.log("🔍 Sample fcaliases found:");
    extractedSections.fcAliases.slice(0, 3).forEach((fcalias, i) => {
      console.log(`  ${i + 1}: ${fcalias.name} -> ${fcalias.wwpn}`);
    });
  }
  
  return extractedSections;
};

export const processTechSupportSection = (sectionType, lines, extractedSections, currentVsan) => {
  console.log(`🔧 Processing ${sectionType} section with ${lines.length} lines (VSAN: ${currentVsan || 'N/A'})`);
  
  if (sectionType === "device-alias-show") {
    // Process device-alias database output
    let consecutiveEmptyLines = 0;
    const maxEmptyLines = 3;
    let deviceAliasCount = 0;
    
    console.log("🔍 Processing device-alias-show section with sample lines:");
    lines.slice(0, 10).forEach((line, i) => {
      console.log(`  ${i + 1}: "${line.trim()}"`);
    });
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Count consecutive empty lines to detect section end
      if (trimmedLine === "") {
        consecutiveEmptyLines++;
        if (consecutiveEmptyLines >= maxEmptyLines) {
          console.log("📝 Detected section end due to consecutive empty lines");
          break;
        }
        continue;
      } else {
        consecutiveEmptyLines = 0;
      }
      
      // Match device-alias entries: device-alias name HOST_01 pwwn 10:00:00:00:c9:7b:5c:01
      const deviceAliasMatch = trimmedLine.match(/^device-alias\s+name\s+(\S+)\s+pwwn\s+([0-9a-fA-F:]+)/i);
      if (deviceAliasMatch) {
        const aliasName = deviceAliasMatch[1];
        const wwpn = deviceAliasMatch[2];
        deviceAliasCount++;
        if (deviceAliasCount <= 5) {
          console.log(`  Found device-alias ${deviceAliasCount}: ${aliasName} -> ${wwpn}`);
        }
        extractedSections.deviceAliases.push({ name: aliasName, wwpn: wwpn });
        continue;
      }
      
      // Stop if we see another show command
      if (trimmedLine.match(/^-+\s*show\s+/i) || trimmedLine.match(/^show\s+/i)) {
        console.log("📝 Found another show command, ending device-alias section");
        break;
      }
    }
    
    console.log(`✅ Processed ${deviceAliasCount} device-aliases in this section`);
  } else if (sectionType === "zone-show" || sectionType === "full-zone-database") {
    // Process zone/zoneset output
    let currentZone = null;
    let currentZoneMembers = [];
    let currentFcAlias = null;
    let fcAliasCount = 0;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine === "") continue;
      
      // Match fcalias definition: fcalias name ALIAS_NAME vsan 75
      const fcAliasMatch = trimmedLine.match(/^fcalias\s+name\s+(\S+)(?:\s+vsan\s+(\d+))?/i);
      if (fcAliasMatch) {
        // Save previous fcalias if exists
        if (currentFcAlias && currentFcAlias.members.length > 0) {
          extractedSections.fcAliases.push({
            name: currentFcAlias.name,
            wwpn: currentFcAlias.members[0], // Use first WWPN
            allWwpns: currentFcAlias.members, // Keep all WWPNs for reference
            vsan: currentFcAlias.vsan
          });
          fcAliasCount++;
          if (fcAliasCount <= 5) {
            console.log(`  Found fcalias ${fcAliasCount}: ${currentFcAlias.name} -> ${currentFcAlias.members[0]}`);
          }
        }
        
        currentFcAlias = {
          name: fcAliasMatch[1],
          vsan: fcAliasMatch[2] ? parseInt(fcAliasMatch[2]) : currentVsan,
          members: []
        };
        continue;
      }
      
      // If we're in an fcalias, look for member pwwn lines
      if (currentFcAlias) {
        const memberPwwnMatch = trimmedLine.match(/^\s*member\s+pwwn\s+([0-9a-fA-F:]+)/i);
        if (memberPwwnMatch) {
          currentFcAlias.members.push(memberPwwnMatch[1]);
          continue;
        }
      }
      
      // Match zone name: zone name ZONE_HOST_01_to_STOR_01 vsan 75
      const zoneMatch = trimmedLine.match(/^zone\s+name\s+(\S+)(?:\s+vsan\s+(\d+))?/i);
      if (zoneMatch) {
        // Save previous fcalias if exists (we're entering a zone)
        if (currentFcAlias && currentFcAlias.members.length > 0) {
          extractedSections.fcAliases.push({
            name: currentFcAlias.name,
            wwpn: currentFcAlias.members[0],
            allWwpns: currentFcAlias.members,
            vsan: currentFcAlias.vsan
          });
          fcAliasCount++;
          if (fcAliasCount <= 5) {
            console.log(`  Found fcalias ${fcAliasCount}: ${currentFcAlias.name} -> ${currentFcAlias.members[0]}`);
          }
          currentFcAlias = null;
        }
        
        // Save previous zone if exists
        if (currentZone) {
          extractedSections.zones.push({
            name: currentZone.name,
            vsan: currentZone.vsan || currentVsan,
            members: [...currentZoneMembers]
          });
        }
        
        currentZone = {
          name: zoneMatch[1],
          vsan: zoneMatch[2] ? parseInt(zoneMatch[2]) : currentVsan
        };
        currentZoneMembers = [];
        console.log(`  Found zone: ${currentZone.name} (VSAN: ${currentZone.vsan})`);
        continue;
      }
      
      // Check for zoneset - this marks the end of zones
      const zonesetMatch = trimmedLine.match(/^zoneset\s+name\s+(\S+)/i);
      if (zonesetMatch) {
        console.log(`  Found zoneset: ${zonesetMatch[1]} - ending zone processing`);
        // Save current zone if exists
        if (currentZone) {
          extractedSections.zones.push({
            name: currentZone.name,
            vsan: currentZone.vsan || currentVsan,
            members: [...currentZoneMembers]
          });
          currentZone = null;
        }
        // Save current fcalias if exists
        if (currentFcAlias && currentFcAlias.members.length > 0) {
          extractedSections.fcAliases.push({
            name: currentFcAlias.name,
            wwpn: currentFcAlias.members[0],
            allWwpns: currentFcAlias.members,
            vsan: currentFcAlias.vsan
          });
          fcAliasCount++;
        }
        // Stop processing - we've hit the zoneset
        break;
      }

      // Match zone members (Full Zone Database format) - only if we're currently in a zone
      if (currentZone) {
        // Member format: member device-alias ALIAS_NAME
        const memberDeviceAliasMatch = trimmedLine.match(/^\s*member\s+device-alias\s+(\S+)/i);
        if (memberDeviceAliasMatch) {
          currentZoneMembers.push({ type: 'device-alias', name: memberDeviceAliasMatch[1] });
          console.log(`    Zone ${currentZone.name} member: device-alias ${memberDeviceAliasMatch[1]}`);
          continue;
        }
        
        // Member format: member fcalias ALIAS_NAME
        const memberFcAliasMatch = trimmedLine.match(/^\s*member\s+fcalias\s+(\S+)/i);
        if (memberFcAliasMatch) {
          currentZoneMembers.push({ type: 'fcalias', name: memberFcAliasMatch[1] });
          console.log(`    Zone ${currentZone.name} member: fcalias ${memberFcAliasMatch[1]}`);
          continue;
        }
        
        // Member format: member pwwn 50:05:07:68:13:11:58:e7
        const memberPwwnMatch = trimmedLine.match(/^\s*member\s+pwwn\s+([0-9a-fA-F:]+)/i);
        if (memberPwwnMatch) {
          currentZoneMembers.push({ type: 'pwwn', name: memberPwwnMatch[1] });
          console.log(`    Zone ${currentZone.name} member: pwwn ${memberPwwnMatch[1]}`);
          continue;
        }
        
        // Skip comment lines with brackets (alias names for pwwn members)
        if (trimmedLine.startsWith('!')) {
          continue;
        }
      }
      
      // Stop if we see another show command or zone command for different zone
      if (trimmedLine.match(/^-+\s*show\s+/i) || trimmedLine.match(/^show\s+/i)) {
        // console.log("📝 Found another show command, ending zone section");
        break;
      }
    }
    
    // Save any remaining fcalias
    if (currentFcAlias && currentFcAlias.members.length > 0) {
      extractedSections.fcAliases.push({
        name: currentFcAlias.name,
        wwpn: currentFcAlias.members[0],
        allWwpns: currentFcAlias.members,
        vsan: currentFcAlias.vsan
      });
      fcAliasCount++;
      console.log(`  Found fcalias ${fcAliasCount}: ${currentFcAlias.name} -> ${currentFcAlias.members[0]}`);
    }
    
    // Save the last zone
    if (currentZone) {
      extractedSections.zones.push({
        name: currentZone.name,
        vsan: currentZone.vsan || currentVsan,
        members: [...currentZoneMembers]
      });
    }
    
    console.log(`✅ Processed ${fcAliasCount} fcaliases in this section`);
  } else if (sectionType === "flogi-show") {
    // Process flogi database output
    let consecutiveEmptyLines = 0;
    const maxEmptyLines = 5;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip header lines
      if (trimmedLine.includes("INTERFACE") || 
          trimmedLine.includes("VSAN") || 
          trimmedLine.includes("----") ||
          trimmedLine === "") {
        consecutiveEmptyLines++;
        if (trimmedLine === "" && consecutiveEmptyLines >= maxEmptyLines) {
          console.log("📝 Detected flogi section end due to consecutive empty lines");
          break;
        }
        if (trimmedLine !== "") consecutiveEmptyLines = 0;
        continue;
      } else {
        consecutiveEmptyLines = 0;
      }
      
      // Match FLOGI entries - various formats
      // Format 1: fc1/1    1   0x870000   20:00:00:25:b5:00:00:0f  20:00:00:25:b5:00:00:0f
      const flogiMatch1 = trimmedLine.match(/^(\S+)\s+(\d+)\s+\S+\s+([0-9a-fA-F:]+)\s+([0-9a-fA-F:]+)/);
      if (flogiMatch1) {
        const vsan = parseInt(flogiMatch1[2]);
        const pwwn = flogiMatch1[3];
        const nwwn = flogiMatch1[4];
        // console.log(`  Found FLOGI: VSAN ${vsan}, PWWN ${pwwn}, NWWN ${nwwn}`);
        extractedSections.flogiWwpns.push({ vsan, pwwn, nwwn });
        continue;
      }
      
      // Stop if we see another show command
      if (trimmedLine.match(/^-+\s*show\s+/i) || trimmedLine.match(/^show\s+/i)) {
        console.log("📝 Found another show command, ending flogi section");
        break;
      }
    }
  }
  
  console.log(`✅ Completed processing ${sectionType} section`);
};

export const detectDataType = (text) => {
  const lines = text.split('\n');
  const sampleLines = lines.slice(0, 50).join('\n').toLowerCase();
  
  // Check for tech-support indicators
  const techSupportIndicators = [
    'show device-alias database',
    'show flogi database',
    'show zone database',
    'show interface brief',
    'show version'
  ];
  
  for (const indicator of techSupportIndicators) {
    if (sampleLines.includes(indicator)) {
      console.log(`Detected tech-support file (found: ${indicator})`);
      return 'tech-support';
    }
  }
  
  // Check for device-alias patterns
  if (sampleLines.match(/device-alias\s+name\s+\S+\s+pwwn\s+[0-9a-f:]+/i)) {
    console.log('Detected device-alias file');
    return 'alias';
  }
  
  // Check for fcalias patterns
  if (sampleLines.match(/fcalias\s+name\s+\S+/i)) {
    console.log('Detected fcalias file');
    return 'alias';
  }
  
  // Check for zone patterns
  if (sampleLines.match(/zone\s+name\s+\S+/i) || sampleLines.match(/zoneset\s+name\s+\S+/i)) {
    console.log('Detected zone file');
    return 'zone';
  }
  
  console.log('Unable to detect file type, defaulting to alias');
  return 'alias';
};