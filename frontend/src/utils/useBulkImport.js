import { useState, useEffect, useCallback } from 'react';
import { parseTechSupportFile, detectDataType } from './techSupportParser';
import { parseAliasData } from './aliasParser';
import { parseZoneData } from './zoneParser';
import { enhanceWithExistenceCheck, refreshAliasOptions, fetchWwpnPrefixes } from '../services/bulkImportApi';
import { deduplicateItems, resolveZoneMembers } from './dataProcessing';
import { mergeAliasesWithSmartDetection } from './smartDetection';

export const useBulkImport = (selectedFabric, aliasDefaults, zoneDefaults) => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [parsedData, setParsedData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [aliasOptions, setAliasOptions] = useState([]);
  const [wwpnPrefixes, setWwpnPrefixes] = useState([]);

  // Process files when uploaded
  const processFiles = useCallback(async (files) => {
    console.log("🔄 processFiles called with:", files);
    if (!files || files.length === 0) {
      console.log("No files to process");
      return;
    }

    if (!selectedFabric) {
      console.warn("No fabric selected, cannot process files");
      return;
    }

    console.log(`🔄 Processing ${files.length} files with fabric ${selectedFabric}`);
    setParsing(true);
    setLoading(true);

    try {
      const allParsedItems = [];
      const fileDetails = [];

      for (const file of files) {
        console.log(`📁 Processing file: ${file.name} (${file.size} bytes)`);
        
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });

        const dataType = detectDataType(content);
        console.log(`🔍 Detected data type: ${dataType}`);

        let parsedItems = [];
        
        if (dataType === 'tech-support') {
          const sections = parseTechSupportFile(content);
          
          // Apply smart detection to merge device-aliases and fcaliases
          const aliasItems = mergeAliasesWithSmartDetection(
            sections.deviceAliases,
            sections.fcAliases,
            aliasDefaults,
            selectedFabric,
            wwpnPrefixes
          );
          
          parsedItems.push(...aliasItems);

          // Parse zones
          for (const zone of sections.zones) {
            parsedItems.push({
              name: zone.name,
              vsan: zone.vsan,
              zone_type: zoneDefaults.zoneType || "standard",
              members: zone.members || [],
              unresolvedMembers: zone.unresolvedMembers || [],
              create: zoneDefaults.create,
              exists: zoneDefaults.exists,
              fabric: parseInt(selectedFabric)
            });
          }
        } else if (dataType === 'alias') {
          parsedItems = await parseAliasData(content, selectedFabric, aliasDefaults);
        } else if (dataType === 'zone') {
          // For zones, we need existing aliases for resolution
          const freshAliasOptions = await refreshAliasOptions(selectedFabric);
          parsedItems = await parseZoneData(content, selectedFabric, zoneDefaults, freshAliasOptions);
        }

        console.log(`📊 Parsed ${parsedItems.length} items from ${file.name}`);
        
        allParsedItems.push(...parsedItems);
        fileDetails.push({
          fileName: file.name,
          fileSize: file.size,
          dataType: dataType,
          itemCount: parsedItems.length,
          items: parsedItems
        });
      }

      // Deduplicate and enhance with existence check
      const deduplicatedItems = deduplicateItems(allParsedItems);
      const enhancedItems = await enhanceWithExistenceCheck(deduplicatedItems);

      // Resolve zone members against imported and existing aliases
      const aliases = enhancedItems.filter(item => item.wwpn !== undefined);
      const zones = enhancedItems.filter(item => item.zone_type !== undefined || item.members !== undefined);
      const resolvedZones = resolveZoneMembers(zones, aliases, aliasOptions);
      
      // Combine resolved zones with aliases
      const finalItems = [
        ...aliases,
        ...resolvedZones
      ];

      setUploadedFiles(fileDetails);
      setParsedData(finalItems);
      
      console.log(`✅ Successfully processed ${files.length} files, ${enhancedItems.length} total items`);
      
    } catch (error) {
      console.error("Error processing files:", error);
      throw error;
    } finally {
      setParsing(false);
      setLoading(false);
    }
  }, [selectedFabric, aliasDefaults, zoneDefaults]);

  // Load alias options when fabric changes
  useEffect(() => {
    if (selectedFabric) {
      refreshAliasOptions(selectedFabric)
        .then(setAliasOptions)
        .catch(error => {
          console.error("Error loading alias options:", error);
          setAliasOptions([]);
        });
    }
  }, [selectedFabric]);

  // Load WWPN prefixes for smart detection
  useEffect(() => {
    fetchWwpnPrefixes()
      .then(setWwpnPrefixes)
      .catch(error => {
        console.error("Error loading WWPN prefixes:", error);
        setWwpnPrefixes([]);
      });
  }, []); // Only load once

  return {
    uploadedFiles,
    parsedData,
    loading,
    parsing,
    importing,
    aliasOptions,
    setImporting,
    setParsedData,
    setUploadedFiles,
    processFiles
  };
};