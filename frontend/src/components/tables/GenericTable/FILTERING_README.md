# GenericTable Filtering Implementation

## Overview

This document explains how filtering works in the GenericTable component, particularly the multi-select dropdown filtering that was fixed to work correctly.

## Problem That Was Solved

**Issue**: When selecting multiple values from dropdown filters (like selecting multiple fabrics in AliasTable), the table would show no results or only results from one of the selected values.

**Root Cause**: Django's `request.GET.items()` only returns the last value when multiple URL parameters have the same name. So `fabric__name=value1&fabric__name=value2` would only process `value2`.

## Solution Implementation

### Frontend Changes

**File**: `frontend/src/components/tables/GenericTable/hooks/useServerPagination.js`

The `multi_select` filter case now uses regex pattern matching:

```javascript
case 'multi_select':
  if (Array.isArray(filter.value)) {
    if (filter.value.length > 0) {
      // Workaround: Use regex to match any of the selected values exactly
      // Create a regex pattern like ^(value1|value2|value3)$
      const escapedValues = filter.value.map(v => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regexPattern = `^(${escapedValues.join('|')})$`;
      url += `&${fieldName}__regex=${encodeURIComponent(regexPattern)}`;
    } else {
      // Empty array means show no results
      url += `&${fieldName}=__IMPOSSIBLE_MATCH_VALUE_123__`;
    }
  }
  break;
```

### How It Works

1. **Multi-Select Values**: When you select multiple values (e.g., "vwssan005p", "vwssan006p")
2. **Regex Pattern Creation**: Creates pattern `^(vwssan005p|vwssan006p)$`
3. **URL Generation**: Sends `fabric__name__regex=^(vwssan005p|vwssan006p)$`
4. **Django Processing**: Django's `__regex` lookup matches any fabric name that exactly equals one of the values
5. **OR Logic**: Results include aliases from ALL selected fabrics

### Filter Types Supported

- **Text Filter**: `contains` - Uses `__icontains` for partial matching
- **Multi-Select**: `multi_select` - Uses `__regex` with OR pattern for exact matching
- **Exact Match**: `equals` - Uses `__iexact` for case-insensitive exact matching
- **Other Types**: `starts_with`, `ends_with`, `not_contains`

### Field Mapping

The frontend automatically maps display fields to database fields:

```javascript
// Frontend field -> Backend database field
'fabric_details.name' -> 'fabric__name'
'fabric' -> 'fabric__name'
'storage' -> 'storage__name'
'host_details.name' -> 'host__name'
```

## Testing

To test multi-select filtering:

1. Open any table (e.g., AliasTable)
2. Click "Filters" button
3. Select a column (e.g., "Fabric")
4. Check multiple values from the dropdown
5. Verify results include data from ALL selected values

## Backend Limitation

The Django backend uses `request.GET.items()` which doesn't handle duplicate parameter names correctly. This limitation affects all tables that use server-side pagination with multi-select filters.

## Alternative Solutions Considered

1. **Multiple Parameters**: `fabric__name=val1&fabric__name=val2` - Doesn't work due to Django limitation
2. **Django __in Lookup**: `fabric__name__in=val1,val2` - Backend doesn't parse comma-separated values for non-boolean fields
3. **Regex Pattern (CHOSEN)**: `fabric__name__regex=^(val1|val2)$` - Works perfectly for exact OR matching

## Future Improvements

If backend modifications are possible, consider:

1. Update Django view to use `request.GET.getlist()` for handling multiple values
2. Add proper `__in` lookup support for all field types
3. Implement more efficient OR logic at the database level

## Files Modified

- `frontend/src/components/tables/GenericTable/hooks/useServerPagination.js` - Added regex-based multi-select filtering
- `frontend/src/components/tables/GenericTable/components/AdvancedFilter.jsx` - No changes needed, already supported multi-select UI

## Related Components

- **AdvancedFilter.jsx**: Handles the UI for selecting multiple values
- **useServerPagination.js**: Converts frontend filters to backend API calls
- **GenericTable.jsx**: Orchestrates filtering between components

---

# COMPREHENSIVE FILTER TROUBLESHOOTING GUIDE

## Common Filter Issues and Solutions (September 2025)

### Issue Pattern 1: Multi-Select Dropdown Filtering

**Symptoms**: Selecting multiple values shows no results or only results from one value.

**Root Cause**: Django `request.GET.items()` only processes the last value for duplicate parameter names.

**Frontend Fix** (`columnFilterUtils.js`):
```javascript
// Add problematic fields to regex handling:
} else if (serverFieldName === 'fabric__name' || serverFieldName === 'host__name' || serverFieldName === 'use') {
  if (filterValue.length === 1) {
    serverFilters[serverFieldName] = filterValue[0];  // Single = equals
  } else {
    const regexPattern = `^(${filterValue.join('|')})$`;  // Multi = regex
    serverFilters[`${serverFieldName}__regex`] = regexPattern;
  }
}
```

**Test**: Multi-select should return combined results from all selected values.

### Issue Pattern 2: Direct Field Equals Filtering

**Symptoms**: `field=value` returns all results instead of filtered results.

**Root Cause**: Backend only accepts parameters with `__` suffixes, not direct field names.

**Backend Fix** (in Django view functions):
```python
# Change this:
if param.startswith(('name__', 'fabric__name__', ...)):

# To this:
if param.startswith(('name__', 'fabric__name__', ...)) or param in ['fabric__name', 'use', 'create', ...]:
```

**Affected Tables**: AliasTable, ZoneTable, HostTable

### Issue Pattern 3: Calculated Field Equals Filtering

**Symptoms**: `zoned_count=1` returns all results instead of filtered results.

**Root Cause**: No direct handling for calculated field equals filters.

**Backend Fix**:
```python
elif param == 'zoned_count':
    try:
        filter_params['_zoned_count'] = int(value)
    except ValueError:
        filter_params['_zoned_count'] = value
```

**Test**: Should return specific count, not total count.

### Issue Pattern 4: Database Relationship Errors

**Symptoms**: 500 Internal Server Error when using count filters.

**Root Cause**: Wrong `related_name` in Count() annotations.

**Backend Fix**: Check model ForeignKey `related_name`:
```python
# Check the model:
host = models.ForeignKey(Host, related_name='alias_host', ...)

# Use correct name in annotation:
Count('alias_host', distinct=True)  # Not 'alias'
```

### Issue Pattern 5: Field Mapping Mismatches

**Symptoms**: Filters don't work due to frontend/backend field name mismatches.

**Root Cause**: Frontend display names don't match Django database field names.

**Frontend Fix** (`columnFilterUtils.js`):
```javascript
if (fieldName === 'fabric_details.name') {
  serverFieldName = 'fabric__name';
} else if (fieldName === 'fabric') {  // ZoneTable case
  serverFieldName = 'fabric__name';
}
```

### Issue Pattern 6: Special Value Filtering (Blank/Empty Values)

**Symptoms**: Need to filter for records with no value assigned (e.g., "Blank" storage systems).

**Root Cause**: Empty/null values require special Django queries with `isnull` and empty string checks.

**Backend Fix** (HostTable storage_system example):
```python
if value == 'Blank':
    hosts_queryset = hosts_queryset.filter(
        (Q(storage__isnull=True) | Q(storage__name__isnull=True) | Q(storage__name='')) &
        (Q(storage_system__isnull=True) | Q(storage_system=''))
    )
```

**Unique Values Fix**: Add "Blank" to dropdown options when empty records exist:
```python
hosts_without_storage = hosts_queryset.filter(
    Q(storage__isnull=True) | Q(storage__name__isnull=True) | Q(storage__name='')
).exists()
if hosts_without_storage:
    unique_values.append('Blank')
```

## Systematic Debugging Steps

When a filter isn't working:

### Step 1: Test Backend API Directly
```bash
# Test if backend filtering works:
curl "http://127.0.0.1:8000/api/san/ENDPOINT/project/25/?field=value"

# Test multi-select with regex:
curl "http://127.0.0.1:8000/api/san/ENDPOINT/project/25/?field__regex=^(val1|val2)$"
```

### Step 2: Check Browser Network Tab
- Look at the actual parameters being sent
- Compare with working curl commands
- Check for encoding issues

### Step 3: Common Fixes Needed

**For Multi-Select Issues**:
1. Add field to regex handling in `columnFilterUtils.js`
2. Ensure backend accepts `field__regex` parameters

**For Direct Filter Issues**:
1. Add field to backend allowed parameter list
2. Add field mapping in frontend if needed

**For Calculated Field Issues**:
1. Add direct field handling in backend view
2. Map to correct annotated field name (e.g., `_zoned_count`)

**For 500 Errors**:
1. Check Django model relationships
2. Fix Count() annotation field names
3. Check for typos in ForeignKey `related_name`

### Step 4: Field Mapping Quick Reference

```javascript
// Frontend Column -> Backend Database Field
'fabric_details.name' -> 'fabric__name'  // AliasTable
'fabric'             -> 'fabric__name'   // ZoneTable
'host_details.name'  -> 'host__name'
'storage'            -> 'storage__name'
'storage_system'     -> 'storage__name'  // HostTable: API shows storage.name, filter on ForeignKey
'zoned_count'        -> '_zoned_count'   // Calculated
'member_count'       -> '_member_count'  // Calculated
'aliases_count'      -> '_aliases_count' // Calculated (using alias_host relation)
```

## Testing Checklist

For each problematic filter:

- [ ] **Single value selection**: Should return subset of results
- [ ] **Multi-value selection**: Should return combined results  
- [ ] **Text search**: Should return partial matches
- [ ] **No 500 errors**: Check browser console and Django logs
- [ ] **Correct field mapping**: Frontend field maps to correct backend field

## Key Files for Fixes

1. **Frontend Filtering**: `columnFilterUtils.js` - Field mapping and multi-select logic
2. **Backend Views**: `san/views.py` - Parameter acceptance and calculated field handling  
3. **Models**: Check ForeignKey `related_name` for relationships
4. **Table Components**: Verify column `data` field names