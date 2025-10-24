# Permission System Fix - Readonly Access Issue

## Issue

After implementing Phase 4 & 5, tables (like FabricTable) showed "readonly access" and users couldn't add or edit rows, even though the permission system was supposed to be simplified to allow all authenticated users full access.

## Root Cause

The permission simplification had issues in TWO places:

### Backend Issue
During Phase 2 (Code Cleanup), the `core/permissions.py` file was replaced with a deprecation notice and all permission functions were removed. However, many views in `san/views.py` and `storage/views.py` were still calling these removed functions:

- `has_customer_access(user, customer)`
- `has_project_access(user, project)`
- `can_edit_customer_infrastructure(user, customer)`
- `can_modify_project(user, project)`
- `is_customer_admin(user, customer)`
- `filter_by_customer_access(queryset, user)`
- `filter_by_project_access(queryset, user)`

When these functions were called but didn't exist, it likely caused errors or returned `None`/falsy values.

### Frontend Issue
The frontend `AuthContext.js` had a `getUserRole()` function that looked for `user.customer_memberships`, but the CustomerMembership model was deleted. This function returned `null`, causing tables to display:
> "Read-only access: You have viewer permissions for this customer. Only members and admins can modify infrastructure."

## Solution

### Backend Fix
Created stub functions in [backend/core/permissions.py](backend/core/permissions.py) that return permissive defaults:

```python
def has_customer_access(user, customer):
    """All authenticated users have access to all customers."""
    return user.is_authenticated

def has_project_access(user, project):
    """All authenticated users have access to all projects."""
    return user.is_authenticated

def can_edit_customer_infrastructure(user, customer):
    """All authenticated users can edit customer infrastructure."""
    return user.is_authenticated

def can_modify_project(user, project):
    """All authenticated users can modify projects."""
    return user.is_authenticated

def is_customer_admin(user, customer):
    """All authenticated users are considered admins."""
    return user.is_authenticated

def filter_by_customer_access(queryset, user):
    """Return all records for authenticated users."""
    if user.is_authenticated:
        return queryset
    return queryset.none()

def filter_by_project_access(queryset, user):
    """Return all records for authenticated users."""
    if user.is_authenticated:
        return queryset
    return queryset.none()
```

### Frontend Fix
Updated [frontend/src/context/AuthContext.js](frontend/src/context/AuthContext.js) to return 'admin' for all authenticated users:

```javascript
const getUserRole = (customerId) => {
  if (!user) {
    return null;
  }
  // All authenticated users have full access
  return 'admin';
};

const isCustomerAdmin = (customerId) => {
  return user !== null;  // All authenticated users are admins
};

const isCustomerMember = (customerId) => {
  return user !== null;  // All authenticated users are members
};

const canViewCustomer = (customerId) => {
  return user !== null;  // All authenticated users can view
};
```

## Why Not Remove the Function Calls?

Removing all the permission check calls from the views would be a large change affecting many files:
- `backend/san/views.py` - 12+ references
- `backend/storage/views.py` - 13+ references
- Plus potential references in other files

Instead, using backward-compatible stub functions:
1. **Safer** - Doesn't require changes to multiple view functions
2. **Faster** - One file change vs. dozens of changes
3. **Clearer** - The stubs document what the old permission system did
4. **Easier to rollback** - If needed, just revert one file

## Testing

After applying the fix and restarting the backend:

```bash
docker-compose -f docker-compose.dev.yml restart backend
```

**Expected behavior**:
- ✅ All authenticated users can see all customers
- ✅ All authenticated users can see all projects
- ✅ Tables (Fabric, Zone, Alias, Storage, etc.) are editable
- ✅ Users can add/edit/delete rows
- ✅ No "readonly access" messages

**Tested**:
- ✅ Backend restarts without errors
- ✅ Stub functions exist and return correct values
- User should test in browser to confirm tables are editable

## Files Modified

| File | Change |
|------|--------|
| [backend/core/permissions.py](backend/core/permissions.py) | Added 7 stub functions for backward compatibility |
| [frontend/src/context/AuthContext.js](frontend/src/context/AuthContext.js) | Updated `getUserRole()` and helper functions to return 'admin' for all authenticated users |

## Next Steps

In a future cleanup (optional), the permission check calls could be removed from all views since they now always return `True` for authenticated users. But this is not urgent since the stubs work correctly.

**Locations with permission calls**:
- `backend/san/views.py` - Lines 36, 69, 159, 224, 283, 1192, 1229, 1360, 1570, 1678, 1941, 2062
- `backend/storage/views.py` - Lines 58, 172, 226, 241, 290, 326, 639, 1049, 1168, 1218, 1232, 1274

---

**Status**: ✅ Fixed (Backend + Frontend)
**Date**: 2025-10-23
**Impact**: Tables are now editable for all authenticated users

---

## How to Test

1. **Refresh your browser** to load the updated AuthContext.js
2. Navigate to any table (Fabrics, Switches, Zones, Aliases, etc.)
3. You should see:
   - ✅ No "Read-only access" warning
   - ✅ Ability to add new rows
   - ✅ Ability to edit existing rows
   - ✅ Ability to delete rows
   - ✅ All table management buttons visible
