# Testing the Universal Importer

## Quick Start Guide

### 1. Access the Importer
Navigate to: `http://localhost:3000/import/universal`

Or use the navbar: **Import → Universal Importer**

### 2. Test with Your 45MB Tech-Support File

**✅ Fixed**: The upload size limit has been increased to 100MB, so your 45MB file should now work.

**Steps:**
1. Click **"SAN Zoning Configuration"** card
2. Click **"Next: Upload Data"**
3. Select **"Upload File"** tab
4. Drag and drop your `show-tech-support.txt` file OR click to browse
5. Click **"Preview Import"**
6. Review the parsed data:
   - Check fabric count
   - Check alias count
   - Check zone count
   - Review any warnings
7. Configure import options:
   - Choose to create new fabric or update existing
   - Optionally override fabric name
8. Click **"Start Import"**
9. Monitor progress in real-time
10. Click **"View Import Logs"** to see detailed progress

### 3. Alternative: Use Running-Config (Smaller File)

If you want faster uploads, use `show running-config` instead:

```bash
# On Cisco switch
show running-config > running-config.txt
```

This file will be much smaller (typically <1MB) but contains the same configuration data.

### 4. Test with Example Files

**Cisco Examples:**
- Location: `/Users/rickk/sanbox/claude_import_examples/cisco/`
- `show-running-config.txt` - ✅ Already tested (142 aliases, 218 fcaliases, 553 zones)
- `show-tech-support-section-headers.txt` - Section headers only

**Brocade Examples:**
- Location: `/Users/rickk/sanbox/claude_import_examples/brocade/`
- `Rick_Koetter_251017_2325_ESILABS_FabricSummary.csv`
- `Rick_Koetter_251017_2325_ESILABS_AliasInfo.csv`
- `Rick_Koetter_251017_2325_ESILABS_ZoneInfo.csv`

### 5. What to Check After Import

1. **Navigate to Fabrics**: `http://localhost:3000/san/fabrics`
   - Verify fabric was created/updated
   - Check zoneset name is correct

2. **Navigate to Aliases**: `http://localhost:3000/san/aliases`
   - Filter by fabric
   - Verify device-aliases and fcaliases are present
   - Check WWPN format (should be lowercase with colons)
   - Verify "Use" column shows init/target/both correctly

3. **Navigate to Zones**: `http://localhost:3000/san/zones`
   - Filter by fabric
   - Verify zone count matches preview
   - Check zone members are linked to aliases
   - Look for peer zones (should show member types)

4. **Check Import Logs**:
   - Navigate to Storage Insights Importer: `http://localhost:3000/import/ibm-storage-insights`
   - Click "View Import History"
   - Find your SAN import
   - Click "Logs" to see detailed import log

## Expected Results

### For show-running-config.txt (Tested):
- **Fabrics**: 3 (VSAN 75 variants)
- **Aliases**: 360 total
  - Device-aliases: 142
  - FCaliases: 218
- **Zones**: 553 total
  - Peer zones: ~48% (266 members with init/target tags)
  - Standard zones: ~52%

### For Your 45MB Tech-Support File:
Expect similar or higher counts depending on file contents. The parser will:
1. Extract all VSANs (skip inactive ones)
2. Parse device-alias database
3. Parse all fcaliases across all VSANs
4. Parse all zones across all VSANs
5. Extract active zoneset names

**Parsing time**: ~2-5 seconds for 45MB file
**Import time**: Depends on record count (~1-2 minutes for 500-1000 items)

## Recent Fixes Applied

### ✅ Fix 1: Upload Size Limit (45MB files now work)
- Increased `DATA_UPLOAD_MAX_MEMORY_SIZE` to 100MB
- Increased `FILE_UPLOAD_MAX_MEMORY_SIZE` to 100MB
- Backend restarted

### ✅ Fix 2: ZoneMember Import Error
**Error**: `cannot import name 'ZoneMember' from 'san.models'`

**Root Cause**: The code was trying to use a `ZoneMember` model that doesn't exist. Zone uses a simple `ManyToManyField` to Alias.

**Fixed in**: `backend/importer/import_orchestrator.py`
- Removed incorrect `ZoneMember` import
- Changed zone member creation to use `zone.members.add(*aliases)`
- Fixed Zone creation to not include non-existent `customer` field
- Fixed zone_type validation (must be 'smart' or 'standard')

**Status**: ✅ Applied and services restarted

## Troubleshooting

### Still Getting Upload Size Error?

1. **Verify backend restarted**:
   ```bash
   docker-compose -f docker-compose.dev.yml logs backend | grep "DATA_UPLOAD"
   ```

2. **Check settings are loaded**:
   ```bash
   docker-compose -f docker-compose.dev.yml exec backend python manage.py shell
   ```
   ```python
   from django.conf import settings
   print(settings.DATA_UPLOAD_MAX_MEMORY_SIZE)
   # Should print: 104857600
   ```

3. **Hard restart if needed**:
   ```bash
   docker-compose -f docker-compose.dev.yml down
   docker-compose -f docker-compose.dev.yml up -d
   ```

### Parser Not Detecting Format?

**For Cisco files**, ensure they contain at least one of:
- `device-alias database`
- `fcalias name`
- `zone name` followed by `vsan`
- `` `show tech-support``

**For Brocade files**, ensure CSV has headers:
- `Fabric Name,Fabric Principal Switch` (FabricSummary)
- `Fabric Name,Active Zone Config,Alias Name` (AliasInfo)
- `Fabric Name,Active Zone Config,Active Zones` (ZoneInfo)

### Import Shows 0 Items?

**Possible causes**:
1. File has no active VSANs (all operational state = down)
2. File is from wrong switch type (not MDS/Brocade)
3. File is corrupted or partial output

**Debug**: Use "Preview Import" and check warnings section for details.

### WWPN Type Shows Blank?

This is OK! Not all WWPN prefixes are in the database yet. You can:
1. Add more prefixes to the migration
2. Manually set via Aliases table
3. It doesn't affect zoning, just helpful for visibility

## Performance Tips

1. **Use running-config instead of tech-support** for faster uploads
2. **Import during low-traffic times** if importing 1000+ items
3. **Monitor Celery worker logs** to see real-time progress:
   ```bash
   docker-compose -f docker-compose.dev.yml logs -f celery
   ```
4. **Check Redis memory** if doing many large imports:
   ```bash
   docker-compose -f docker-compose.dev.yml exec redis redis-cli INFO memory
   ```

## Advanced: API Testing with curl

### Preview Import (No DB Commit)
```bash
curl -X POST http://localhost:8000/api/importer/parse-preview/ \
  -H "Content-Type: application/json" \
  -d @- << 'EOF'
{
  "customer_id": 1,
  "data": "device-alias database\n  device-alias name TEST_ALIAS pwwn 50:05:07:68:10:35:7a:a9\n\nfcalias name TEST_FCALIAS vsan 75\n  member pwwn 50:05:07:68:10:35:7a:a9\n\nzone name TEST_ZONE vsan 75\n  member device-alias TEST_ALIAS\n"
}
EOF
```

### Execute Import
```bash
curl -X POST http://localhost:8000/api/importer/import-san-config/ \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "data": "device-alias database\n  device-alias name TEST_ALIAS pwwn 50:05:07:68:10:35:7a:a9\n",
    "create_new_fabric": true,
    "fabric_name": "TEST_FABRIC"
  }'
```

### Check Progress
```bash
# Replace 123 with import_id from previous response
curl http://localhost:8000/api/importer/import-progress/123/
```

## Success Indicators

✅ **Preview shows correct counts**
✅ **No errors in preview warnings**
✅ **Import completes in <5 minutes**
✅ **Fabrics appear in /san/fabrics**
✅ **Aliases appear in /san/aliases**
✅ **Zones appear in /san/zones**
✅ **WWPN format is normalized** (lowercase, colons)
✅ **Peer zones show member types**
✅ **Import logs show no errors**

## Feedback

If you encounter any issues or have suggestions:
1. Check the import logs for detailed error messages
2. Review `/Users/rickk/sanbox/UNIVERSAL_IMPORTER_IMPLEMENTATION.md` for technical details
3. Check Celery worker logs: `docker-compose -f docker-compose.dev.yml logs celery`
4. Report issues with:
   - File type and size
   - Error message
   - Import logs
   - Browser console errors (F12)
