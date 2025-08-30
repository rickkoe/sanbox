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